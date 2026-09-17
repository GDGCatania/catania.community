import { fetchText } from '../lib/fetch.js';
import { htmlToText, slugify, truncate } from '../lib/text.js';
import { localIsoWithOffset } from '../lib/time.js';
import type { Community, Event, IngestConfig } from '../../../src/lib/schema.js';
import type { RawEvent } from './types.js';

/**
 * Adapter for schema.org `Event` markup embedded in a page as JSON-LD.
 *
 * Named after the standard, not after a platform: Meetup and Eventbrite are
 * simply the first two places we meet it, and the parser below works unchanged
 * on any site that publishes proper Event markup. Both closed their public APIs
 * and both still emit complete markup on every event page, so "the API is gone"
 * never meant "the data is gone".
 *
 * The adapter has two halves, and they are not equally trustworthy:
 *
 *   1. PARSING an event page is structured data and safe. One parser covers
 *      both platforms; the only wrinkle is that Eventbrite types its events
 *      `SocialEvent`, a schema.org subtype of `Event`, so matching `Event`
 *      exactly finds nothing there.
 *   2. DISCOVERING which events exist is link extraction from a listing page,
 *      because listing pages carry only `Organization`/`BreadcrumbList` markup.
 *      This is the half that will break silently, so every listing strategy
 *      below has to prove the page it received is the page it asked for —
 *      see `looksRight`.
 *
 * Point 2 is why this adapter cannot simply return `[]` when it finds no links:
 * a group with nothing scheduled and a layout change look identical from the
 * outside. Verified in the field on 2026-09-17: the `?type=upcoming` page of a
 * group with no upcoming events and of a group with one carry exactly the same
 * markers and differ only by the event links themselves.
 */

/** Only these hosts are recognised: a listing page we cannot vouch for is refused. */
interface Listing {
  /**
   * Proves the response is the listing page we asked for rather than an error
   * page, a login wall or a redirect. Without this check, zero links would be
   * indistinguishable from a broken selector.
   */
  looksRight(html: string): boolean;
  /** Absolute event URLs found on the listing page. */
  eventUrls(html: string, listUrl: string): string[];
}

/** `<script type="application/ld+json">` blocks, parsed; unparseable ones are skipped. */
export function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    try {
      blocks.push(JSON.parse(match[1]!));
    } catch {
      // A single malformed block is not worth failing the page over: the
      // interesting one may well be the next.
    }
  }

  return blocks;
}

/** Flattens a block into the objects it contains, following `@graph` and arrays. */
function flatten(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!value || typeof value !== 'object') return [];

  const node = value as Record<string, unknown>;
  const graph = node['@graph'];
  return graph ? [node, ...flatten(graph)] : [node];
}

/**
 * schema.org `Event` and the subtypes we can actually meet on a community
 * listing. Eventbrite uses `SocialEvent` for everything, which is why matching
 * the bare `Event` type is not enough.
 */
const EVENT_TYPES = new Set([
  'Event',
  'BusinessEvent',
  'ChildrensEvent',
  'ComedyEvent',
  'CourseInstance',
  'DanceEvent',
  'EducationEvent',
  'ExhibitionEvent',
  'Festival',
  'FoodEvent',
  'Hackathon',
  'LiteraryEvent',
  'MusicEvent',
  'ScreeningEvent',
  'SocialEvent',
  'SportsEvent',
  'TheaterEvent',
  'VisualArtsEvent',
]);

function isEvent(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === 'string' && EVENT_TYPES.has(t));
}

/** The first schema.org Event object on the page, if there is one. */
export function findEvent(html: string): Record<string, unknown> | undefined {
  for (const block of jsonLdBlocks(html)) {
    for (const node of flatten(block)) {
      if (isEvent(node)) return node;
    }
  }
  return undefined;
}

const MEETUP_EVENT = /\/([a-z0-9-]+)\/events\/(\d{6,})/gi;
const EVENTBRITE_EVENT = /https:\/\/www\.eventbrite\.[a-z.]+\/e\/[a-z0-9-]*?(\d{10,})/gi;

const MEETUP: Listing = {
  // A real group page always carries the site's own Organization block and the
  // breadcrumb trail. An error page or a redirect carries neither.
  looksRight: (html) =>
    /"@type"\s*:\s*"Organization"/.test(html) && /"@type"\s*:\s*"BreadcrumbList"/.test(html),

  eventUrls(html, listUrl) {
    const origin = new URL(listUrl).origin;
    const seen = new Set<string>();
    for (const [, group, id] of html.matchAll(MEETUP_EVENT)) {
      seen.add(`${origin}/${group}/events/${id}/`);
    }
    return [...seen];
  },
};

const EVENTBRITE: Listing = {
  looksRight: (html) => /"@type"\s*:\s*"(ProfilePage|Organization)"/.test(html),

  eventUrls(html) {
    const seen = new Set<string>();
    for (const [url] of html.matchAll(EVENTBRITE_EVENT)) seen.add(url);
    return [...seen];
  },
};

function listingFor(url: string): Listing {
  const host = new URL(url).host;
  if (host.endsWith('meetup.com')) return MEETUP;
  if (/(^|\.)eventbrite\.[a-z.]+$/.test(host)) return EVENTBRITE;

  // Refusing is the point: discovery needs a rule we have actually checked
  // against that platform. Explicit `urls` work for any host.
  throw new Error(
    `no discovery rule for ${host}. List the event URLs explicitly with \`urls:\`, ` +
      `or add a listing strategy for this platform.`
  );
}

export async function fetchJsonLd(
  config: Extract<IngestConfig, { type: 'jsonld' }>,
  community: Community,
  options: { since: Date }
): Promise<RawEvent[]> {
  const urls = new Set(config.urls);

  if (config.list) {
    const listing = listingFor(config.list);
    const html = await fetchText(config.list, { accept: 'text/html' });

    if (!listing.looksRight(html)) {
      throw new Error(
        `${config.list} no longer looks like a listing page: the markers this adapter ` +
          `relies on are gone. Refusing to report "no events" for what is probably a layout change.`
      );
    }

    for (const url of listing.eventUrls(html, config.list)) urls.add(url);
  }

  if (urls.size === 0 && !config.list) {
    throw new Error('a jsonld source needs `list`, `urls`, or both');
  }

  const events: RawEvent[] = [];

  for (const url of urls) {
    const html = await fetchText(url, { accept: 'text/html' });
    const event = parseJsonLdEvent(html, url, community);

    // A page that was linked as an event but carries no Event markup is a
    // discovery mistake, not a missing event: say so rather than drop it.
    if (!event) throw new Error(`${url} carries no schema.org Event markup`);

    if (new Date(event.start) < options.since) continue;
    events.push(event);
  }

  return events;
}

/** Split out from the fetch so tests can run against fixtures, with no network. */
export function parseJsonLdEvent(
  html: string,
  url: string,
  community: Community
): RawEvent | undefined {
  const node = findEvent(html);
  if (!node) return undefined;

  const title = text(node.name)?.slice(0, 300);
  if (!title) return undefined;

  const start = toIsoWithOffset(node.startDate);
  if (!start) return undefined;

  const end = toIsoWithOffset(node.endDate);
  const canonical = text(node.url) ?? url;
  const online = /OnlineEventAttendanceMode/i.test(text(node.eventAttendanceMode) ?? '');
  const place = online ? undefined : toVenue(node.location);
  const description = text(node.description);

  return {
    id: eventId(canonical),
    slug: slugify(title),
    title,
    description: description ? markIfCut(truncate(htmlToText(description), 5_000)) : undefined,
    start,
    // An end that is not after the start would fail validation downstream; the
    // schema is right to reject it, so drop it here rather than ship a record
    // that cannot be stored.
    end: end && Date.parse(end) > Date.parse(start) ? end : undefined,
    url: canonical,
    communityId: community.id,
    venue: place,
    online,
    price: toPrice(node.offers),
    categories: community.categories,
    language: community.language,
    coverImage: firstImage(node.image),
    cancelled: /EventCancelled/i.test(text(node.eventStatus) ?? ''),
  };
}

/**
 * A stable id derived from the canonical URL. Both platforms end their event
 * URLs with a numeric id that never changes, which is what we want: an id built
 * from the title would move the moment an organiser fixes a typo.
 */
export function eventId(url: string): string {
  const meetup = /meetup\.com\/[a-z0-9-]+\/events\/(\d{6,})/i.exec(url);
  if (meetup) return `jsonld:meetup:${meetup[1]}`;

  const eventbrite = /eventbrite\.[a-z.]+\/e\/[a-z0-9-]*?(\d{10,})/i.exec(url);
  if (eventbrite) return `jsonld:eventbrite:${eventbrite[1]}`;

  return `jsonld:${slugify(url.replace(/^https?:\/\//, ''), 180)}`;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** A sentence that reached its end: terminal punctuation, a closing mark, or an emoji. */
const LOOKS_FINISHED = /[.!?…»"')\]]$|\p{Extended_Pictographic}$/u;

/** Ending on a letter or a digit means the last word itself was sliced. */
const ENDS_MID_WORD = /[\p{L}\p{N}]$/u;

/** Trailing joiners and stray markdown left dangling by the cut. */
const DANGLING = /[\s*_,;:–—-]+$/u;

/**
 * Both platforms serve a `description` already cut to roughly 150 characters,
 * mid-word and with nothing to mark the cut: "…alla ricerca di un poco di fre".
 * The full text is not anywhere in the markup they serve — `og:description` is
 * cut too, just at 175 characters instead — so this cannot be undone without
 * digging into a framework's hydration payload, which is not what an adapter
 * named after a standard should be doing.
 *
 * What it can do is not render a word sliced in half, which reads as our bug
 * rather than theirs: drop the partial word and mark the cut.
 *
 * The cost is that a complete description happening to end without punctuation
 * gets an ellipsis it did not earn. That is the cheaper of the two mistakes.
 */
export function markIfCut(description: string): string {
  if (LOOKS_FINISHED.test(description)) return description;

  // The last word is half of one: dropping it beats showing "un poco di fre".
  // Otherwise every word is whole and only the sentence is not, so keep them all.
  let kept = description;
  if (ENDS_MID_WORD.test(description)) {
    const lastSpace = description.lastIndexOf(' ');
    if (lastSpace > description.length * 0.6) kept = description.slice(0, lastSpace);
  }

  // Either way the cut can leave a comma or a markdown marker hanging: dropping
  // "in" from "meetup, in" would otherwise produce "meetup,…".
  return `${kept.replace(DANGLING, '')}…`;
}

/**
 * schema.org asks for ISO 8601. Both platforms send an explicit offset, which
 * is what `DateTimeSchema` requires; a site that omits one is read as Italian
 * local time, the same assumption the ICS adapter makes for floating times.
 */
export function toIsoWithOffset(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;

  // Already carries an offset or an explicit Z.
  if (/[+-]\d{2}:?\d{2}$|Z$/i.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : raw;
  }

  const withTime = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(raw);
  if (withTime) {
    try {
      return localIsoWithOffset(withTime[1]!, withTime[2]!);
    } catch {
      return undefined;
    }
  }

  // A date with no time at all: local midnight, so an all-day event does not
  // surface at 02:00 as a side effect of the UTC offset.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    try {
      return localIsoWithOffset(raw, '00:00');
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function toVenue(location: unknown): RawEvent['venue'] {
  for (const node of flatten(location)) {
    // A VirtualLocation has a url, not a postal address: nothing to put on a map.
    if (node['@type'] === 'VirtualLocation') continue;

    const name = text(node.name);
    if (!name) continue;

    const address = flatten(node.address)[0];
    return {
      name: name.slice(0, 200),
      address: text(address?.streetAddress)?.slice(0, 300),
      city: text(address?.addressLocality)?.slice(0, 120),
    };
  }

  return undefined;
}

/**
 * `offers` is read when present and never guessed when absent. The fallback is
 * "free" because these are community meetups, but an event that charges without
 * declaring an offer would be shown as free by mistake — better to add the case
 * here than to discover it on the live site.
 */
function toPrice(offers: unknown): Event['price'] {
  for (const offer of flatten(offers)) {
    const raw = offer.price ?? offer.lowPrice;
    const amount = typeof raw === 'number' ? raw : Number.parseFloat(text(raw) ?? '');
    if (!Number.isFinite(amount)) continue;
    if (amount <= 0) return { type: 'free', currency: 'EUR' };
    return { type: 'paid', amount, currency: 'EUR' };
  }

  return { type: 'free', currency: 'EUR' };
}

function firstImage(image: unknown): string | undefined {
  for (const candidate of Array.isArray(image) ? image : [image]) {
    const url = text(candidate) ?? text((candidate as Record<string, unknown>)?.url);
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return undefined;
}