import { fetchJson } from '../lib/fetch.js';
import { htmlToText, slugify, truncate } from '../lib/text.js';
import type { Community, Event, IngestConfig } from '../../../src/lib/schema.js';
import type { RawEvent } from './types.js';

/**
 * Adapter for the Bevy platform, used by Google Developer Groups
 * (gdg.community.dev) and other community programmes.
 *
 * The API is public and needs no authentication, but it has two treacherous
 * behaviours confirmed in the field:
 *   1. unsupported filter parameters are SILENTLY IGNORED (`chapter_slug`,
 *      `city`) and the response then contains the entire worldwide catalogue.
 *      Only `chapter` with the numeric id actually filters.
 *   2. without `fields=` the response carries very few keys.
 * Hence the adapter checks the filter was really applied before trusting what
 * came back.
 */

const FIELDS = [
  'id',
  'title',
  'description_short',
  'description',
  'start_date',
  'end_date',
  'url',
  'event_type_title',
  'venue_name',
  'venue_address',
  'venue_city',
  'audience_type',
  'picture',
  'status',
].join(',');

/** Past this threshold the response is plainly the global catalogue. */
const SANITY_LIMIT = 2_000;

interface BevyEvent {
  id: number;
  title: string;
  description?: string | null;
  description_short?: string | null;
  start_date: string;
  end_date?: string | null;
  url: string;
  event_type_title?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_city?: string | null;
  audience_type?: string | null;
  picture?: { url?: string } | null;
  status?: string | null;
}

interface BevyResponse {
  count: number;
  results: BevyEvent[];
  links?: { next?: string | null };
}

export async function fetchBevy(
  config: Extract<IngestConfig, { type: 'bevy' }>,
  community: Community,
  options: { since: Date }
): Promise<RawEvent[]> {
  const host = config.host;
  const params = new URLSearchParams({
    chapter: String(config.chapter),
    status: 'Published',
    order_by: 'start_date',
    fields: FIELDS,
    page_size: '100',
  });

  const response = await fetchJson<BevyResponse>(`https://${host}/api/event/?${params}`);

  if (response.count > SANITY_LIMIT) {
    throw new Error(
      `the API ignored the chapter=${config.chapter} filter and returned ${response.count} events. ` +
        `The parameter has changed: check the adapter before trusting this data.`
    );
  }

  const events: RawEvent[] = [];

  for (const raw of response.results) {
    if (raw.status && raw.status !== 'Published') continue;

    const start = new Date(raw.start_date);
    if (Number.isNaN(start.getTime()) || start < options.since) continue;

    events.push(toRawEvent(raw, community));
  }

  return events;
}

function toRawEvent(raw: BevyEvent, community: Community): RawEvent {
  const online = (raw.audience_type ?? '').toUpperCase() === 'VIRTUAL';
  const venueName = raw.venue_name?.trim();

  const description = raw.description
    ? htmlToText(raw.description)
    : (raw.description_short?.trim() ?? undefined);

  return {
    id: `bevy:${raw.id}`,
    slug: slugify(raw.title),
    title: raw.title.trim(),
    description: description ? truncate(description, 5_000) : undefined,
    start: raw.start_date,
    end: raw.end_date ?? undefined,
    url: raw.url,
    communityId: community.id,
    venue:
      !online && venueName
        ? {
            name: venueName,
            address: italianAddress(raw.venue_address),
            city: raw.venue_city?.trim() || undefined,
          }
        : undefined,
    online,
    price: mapPrice(raw.event_type_title),
    categories: community.categories,
    language: community.language,
    cancelled: false,
    coverImage: raw.picture?.url ?? undefined,
  };
}

/**
 * Bevy stores addresses the Anglo-Saxon way, house number first
 * ("2 Via Cardinale Dusmet", "14a Via Cesare Beccaria"). Italian puts the number
 * last, and this is the form people actually read on the page.
 */
export function italianAddress(address?: string | null): string | undefined {
  const trimmed = address?.trim();
  if (!trimmed) return undefined;

  // House number (digits with an optional letter, or "snc" = no street number)
  // followed by a recognisable street type.
  const match =
    /^(\d+(?:\/?[a-z])?|snc)\s+((?:via|viale|piazza|corso|largo|vicolo|contrada|piazzale|lungomare)\b.*)$/i.exec(
      trimmed
    );

  if (!match) return trimmed;

  const [, number, street] = match;
  // By convention "snc" is written lowercase after the street name.
  return `${street} ${number!.toLowerCase() === 'snc' ? 'snc' : number}`;
}

/**
 * Bevy exposes no amount: `event_type_title` is the only hint and it is free
 * text (the only value seen on GDG Catania is "Free registration").
 * The fallback is "free" because GDG chapters do not sell tickets through the
 * platform. If an unrecognised paid type ever appeared, the event would be
 * shown as free by mistake — better to add the case here than to discover it
 * on the live site.
 */
function mapPrice(eventType?: string | null): Event['price'] {
  const label = (eventType ?? '').toLowerCase();
  if (label.includes('paid') || label.includes('ticket')) return { type: 'paid', currency: 'EUR' };
  if (label.includes('donation')) return { type: 'donation', currency: 'EUR' };
  return { type: 'free', currency: 'EUR' };
}
