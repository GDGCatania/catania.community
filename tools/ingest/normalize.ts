import {
  ValidatedEventSchema,
  SOURCE_PRIORITY,
  type Area,
  type Community,
  type Event,
  type Override,
  type SourceType,
} from '../../src/lib/schema.js';
import { DEFAULT_CITY } from '../../src/lib/site.js';
import type { RawEvent } from './adapters/types.js';
import { normalizeForCompare } from './lib/text.js';
import type { Geocoder } from './geocode.js';

/** Towns counted as the city itself; everything else in the province is "provincia". */
const CITY_NAMES = new Set([normalizeForCompare(DEFAULT_CITY)]);

/**
 * Decides an event's area. Not cosmetic: this drives the
 * "Catania city / Province / Online" filter on the home page.
 */
export function resolveArea(raw: RawEvent, community: Community): Area {
  if (raw.online) return 'online';

  const city = raw.venue?.city?.trim();
  if (city) return CITY_NAMES.has(normalizeForCompare(city)) ? 'citta' : 'provincia';

  // With no explicit town we inherit the area the community declared, which is
  // curated by hand and therefore more trustworthy than a guess.
  return community.area === 'online' ? 'citta' : community.area;
}

export interface NormalizeContext {
  community: Community;
  sourceType: SourceType;
  fetchedAt: string;
  geocoder: Geocoder;
}

/**
 * From RawEvent to a validated Event. Returns an error instead of throwing:
 * one malformed record from an external source must not stop the whole run.
 */
export async function normalizeEvent(
  raw: RawEvent,
  context: NormalizeContext
): Promise<{ event: Event } | { error: string }> {
  const { community, sourceType, fetchedAt, geocoder } = context;

  let venue = raw.venue;
  if (venue && !venue.geo) {
    const geo = await geocoder.resolve(venue);
    if (geo) venue = { ...venue, geo };
  }

  const candidate = {
    ...raw,
    venue,
    area: resolveArea(raw, community),
    source: { type: sourceType, fetchedAt, ref: raw.url },
  };

  const result = ValidatedEventSchema.safeParse(candidate);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { error: `"${raw.title}" skipped — ${issues}` };
  }

  return { event: result.data };
}

/** An event's logical identity, used to compare records across sources. */
function dedupKey(event: Event): string {
  const day = event.start.slice(0, 10);
  const venue = event.venue?.name ? normalizeForCompare(event.venue.name) : '';
  return `${normalizeForCompare(event.title)}|${day}|${venue}`;
}

const PRIORITY = new Map<SourceType, number>(
  SOURCE_PRIORITY.map((type, index) => [type, index])
);

/**
 * Removes duplicates across sources. The same event can arrive both from an API
 * and from an ICS feed: the more reliable source wins (the order lives in
 * SOURCE_PRIORITY), not whichever was seen first.
 */
export function dedupe(events: Event[]): { events: Event[]; duplicates: number } {
  const byId = new Map<string, Event>();
  for (const event of events) {
    const existing = byId.get(event.id);
    if (!existing || wins(event, existing)) byId.set(event.id, event);
  }

  const byLogicalKey = new Map<string, Event>();
  for (const event of byId.values()) {
    const key = dedupKey(event);
    const existing = byLogicalKey.get(key);
    if (!existing || wins(event, existing)) byLogicalKey.set(key, event);
  }

  const deduped = [...byLogicalKey.values()];
  return { events: deduped, duplicates: events.length - deduped.length };
}

function wins(candidate: Event, incumbent: Event): boolean {
  const a = PRIORITY.get(candidate.source.type) ?? 99;
  const b = PRIORITY.get(incumbent.source.type) ?? 99;
  if (a !== b) return a < b;
  // Same source: keep the richer record, so a second pass never replaces a
  // complete entry with a thinner one.
  return richness(candidate) > richness(incumbent);
}

function richness(event: Event): number {
  return (
    (event.description ? 2 : 0) +
    (event.venue?.geo ? 2 : 0) +
    (event.venue ? 1 : 0) +
    (event.coverImage ? 1 : 0) +
    (event.end ? 1 : 0)
  );
}

/**
 * Applies the manual corrections in `data/overrides/`. They have the last word
 * over any crawler: this is how a value that is wrong at the source gets fixed
 * without waiting for the source to fix it.
 */
export function applyOverrides(
  events: Event[],
  overrides: Override[]
): { events: Event[]; applied: number; dropped: number; unmatched: string[] } {
  if (overrides.length === 0) {
    return { events, applied: 0, dropped: 0, unmatched: [] };
  }

  const byId = new Map(overrides.map((override) => [override.id, override]));
  const used = new Set<string>();
  const output: Event[] = [];
  let applied = 0;
  let dropped = 0;

  for (const event of events) {
    const override = byId.get(event.id);
    if (!override) {
      output.push(event);
      continue;
    }

    used.add(override.id);

    if (override.drop) {
      dropped++;
      continue;
    }

    const { drop: _drop, ...patch } = override;
    const merged = { ...event, ...stripUndefined(patch), source: { ...event.source } };

    const result = ValidatedEventSchema.safeParse(merged);
    if (result.success) {
      applied++;
      output.push(result.data);
    } else {
      // A broken override must not make the original event disappear.
      console.warn(`  ⚠ override ${override.id} is not valid, ignoring it`);
      output.push(event);
    }
  }

  return {
    events: output,
    applied,
    dropped,
    unmatched: overrides.filter((o) => !used.has(o.id)).map((o) => o.id),
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/** Makes slugs unique: two different events cannot share a URL. */
export function uniqueSlugs(events: Event[]): Event[] {
  const seen = new Map<string, number>();
  // Deterministic order by date: the same input always yields the same
  // suffixes, otherwise URLs would change on every run.
  const sorted = [...events].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id)
  );

  return sorted.map((event) => {
    const count = seen.get(event.slug) ?? 0;
    seen.set(event.slug, count + 1);
    if (count === 0) return event;

    // The second namesake gets the date appended, the third a counter.
    const suffix = count === 1 ? event.start.slice(0, 10) : `${event.start.slice(0, 10)}-${count}`;
    return { ...event, slug: `${event.slug}-${suffix}` };
  });
}
