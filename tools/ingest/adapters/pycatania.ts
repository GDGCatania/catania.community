import { fetchJson } from '../lib/fetch.js';
import { slugify, truncate } from '../lib/text.js';
import { localIsoWithOffset } from '../lib/time.js';
import type { Community, IngestConfig } from '../../../src/lib/schema.js';
import type { RawEvent } from './types.js';

/**
 * Adapter for the JSON feed Python Catania publishes on its own site.
 *
 * Their events live on Meetup, which we cannot crawl, but the organisers
 * maintain the site themselves in the open
 * (https://github.com/PythonCatania/PythonCatania.github.io, the feed is
 * `public/data/events.json`) and every entry carries the canonical Meetup link.
 * So this reads a first-party, hand-maintained source rather than scraping a
 * closed platform — the same deal as `manual`, except the curation happens
 * upstream and we do not have to copy it by hand.
 *
 * Two things to know about the format, both confirmed against the live feed:
 *
 *   1. IT IS AN ARCHIVE, NOT AN ANNOUNCEMENT FEED. An entry appears *after* the
 *      meetup: it always carries `attendees` and a photo `gallery`. So a normal
 *      run collects nothing, and that is not a failure. Backfilling the archive
 *      is a one-off `--since` run; see the README.
 *   2. `date` HAS NO TIME. We publish it at `defaultTime` (their meetups start
 *      in the evening) rather than at midnight, and say so in the YAML. The
 *      moment an entry carries its own `time`, that wins — the optional fields
 *      below are the shape we would like upstream to grow, not invention.
 */

/** An entry in their feed. Optional fields are read if present, never required. */
interface PyCataniaEvent {
  id: number;
  title: string;
  /** "YYYY-MM-DD", local date, no time. */
  date: string;
  description?: string | null;
  fullDescription?: string | null;
  /** Site-relative ("/images/events/…") or absolute. */
  image?: string | null;
  /** Canonical Meetup link for the event. */
  url?: string | null;
  attendees?: number | null;
  /** Not in the feed today: read if the organisers ever add it. */
  time?: string | null;
  endTime?: string | null;
  venue?: { name?: string | null; address?: string | null; city?: string | null } | null;
}

const TIME_PATTERN = /^\d{2}:\d{2}$/;

export async function fetchPyCatania(
  config: Extract<IngestConfig, { type: 'pycatania' }>,
  community: Community,
  options: { since: Date }
): Promise<RawEvent[]> {
  const payload = await fetchJson<unknown>(config.url);
  return parsePyCatania(payload, config, community, options);
}

/** Split out from the fetch so tests can run against a fixture, with no network. */
export function parsePyCatania(
  payload: unknown,
  config: Extract<IngestConfig, { type: 'pycatania' }>,
  community: Community,
  options: { since: Date }
): RawEvent[] {
  // A shape change upstream must be loud: failing here preserves the events we
  // already have instead of quietly emptying the community.
  if (!Array.isArray(payload)) {
    throw new Error(`${config.url} did not return a JSON array of events`);
  }

  const events: RawEvent[] = [];

  for (const entry of payload as PyCataniaEvent[]) {
    if (!entry || typeof entry !== 'object') continue;

    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const date = typeof entry.date === 'string' ? entry.date.trim() : '';
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const time = typeof entry.time === 'string' && TIME_PATTERN.test(entry.time)
      ? entry.time
      : config.defaultTime;

    let start: string;
    try {
      start = localIsoWithOffset(date, time);
    } catch {
      continue;
    }

    if (new Date(start) < options.since) continue;

    // Without a link we would send people nowhere: their own event page is the
    // honest fallback when an entry has no Meetup URL yet.
    const url = typeof entry.url === 'string' && /^https?:\/\//i.test(entry.url)
      ? entry.url
      : `${new URL(config.url).origin}/#/events`;

    const description = firstNonEmpty(entry.description, entry.fullDescription);
    const venueName = entry.venue?.name?.trim();

    events.push({
      // Their numeric id is the Meetup event id: stable, and the same value the
      // URL ends with.
      id: `pycatania:${entry.id}`,
      slug: slugify(title),
      title,
      description: description ? truncate(description, 5_000) : undefined,
      start,
      end:
        typeof entry.endTime === 'string' && TIME_PATTERN.test(entry.endTime)
          ? localIsoWithOffset(date, entry.endTime)
          : undefined,
      url,
      communityId: community.id,
      venue: venueName
        ? {
            name: venueName.slice(0, 200),
            address: entry.venue?.address?.trim() || undefined,
            city: entry.venue?.city?.trim() || undefined,
          }
        : undefined,
      online: false,
      // Their meetups are free; the feed has no price field and we do not invent one.
      price: { type: 'free', currency: 'EUR' },
      categories: community.categories,
      language: community.language,
      coverImage: absoluteUrl(entry.image, config.url),
      cancelled: false,
    });
  }

  return events;
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** Their images are site-relative: the schema wants a URL that resolves anywhere. */
function absoluteUrl(image: string | null | undefined, base: string): string | undefined {
  const trimmed = image?.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed, base).href;
  } catch {
    return undefined;
  }
}