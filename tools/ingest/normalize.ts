import {
  ValidatedEventSchema,
  SOURCE_PRIORITY,
  type Area,
  type Community,
  type Event,
  type Override,
  type SourceType,
  eventHostIds,
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
 *
 * When the duplicate came from another community's feed, that community is an
 * organiser too: the surviving record takes it in `hostIds` rather than losing
 * it.
 */
export function dedupe(events: Event[]): { events: Event[]; duplicates: number } {
  const byId = collapse(events, (event) => event.id);
  const deduped = collapse(byId, dedupKey);
  return { events: deduped, duplicates: events.length - deduped.length };
}

function collapse(events: Event[], keyOf: (event: Event) => string): Event[] {
  const groups = new Map<string, Event[]>();
  for (const event of events) {
    const key = keyOf(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return [...groups.values()].map((group) => {
    const winner = group.reduce((best, event) => (wins(event, best) ? event : best));
    return withHostsOf(
      winner,
      group.filter((event) => event !== winner)
    );
  });
}

/**
 * `event`, organised also by whoever organises `others`. Its own organisers
 * come first; the others follow sorted, so the order does not depend on which
 * feed answered first and two runs produce the same file. Nothing changes when
 * every record came from the same community.
 */
export function withHostsOf(event: Event, others: Event[]): Event {
  const own = eventHostIds(event);
  const extra = [...new Set(others.flatMap(eventHostIds))]
    .filter((id) => !own.includes(id))
    .sort();
  return extra.length === 0 ? event : { ...event, hostIds: [...own, ...extra] };
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
): { events: Event[]; applied: number; dropped: number; aliased: number; unmatched: string[] } {
  if (overrides.length === 0) {
    return { events, applied: 0, dropped: 0, aliased: 0, unmatched: [] };
  }

  // Aliases first: a correction written on the canonical event then applies to
  // the merged one, and `hostIds` written there still has the last word.
  const aliases = resolveAliases(
    events,
    overrides.filter((override) => override.aliasOf)
  );
  events = aliases.events;

  const byId = new Map(
    overrides.filter((override) => !override.aliasOf).map((override) => [override.id, override])
  );
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
    aliased: aliases.aliased,
    unmatched: [
      ...aliases.unmatched,
      ...[...byId.values()].filter((o) => !used.has(o.id)).map((o) => o.id),
    ],
  };
}

/**
 * The same evening published on two feeds, with a title or a venue written
 * differently enough that `dedupe` cannot tell. An override marks one record as
 * an alias of the other: the alias disappears and its community joins the
 * organisers of the event it points to.
 *
 * An alias of an alias resolves to the end of the chain. An alias that did not
 * arrive this run is fine: past events are no longer listed by their source,
 * and the merged record is already in the archive with both organisers. An
 * event to point to that does not exist is a typo, or an event that is gone:
 * the alias is kept and the override reported as unmatched.
 */
function resolveAliases(
  events: Event[],
  aliases: Override[]
): { events: Event[]; aliased: number; unmatched: string[] } {
  const target = new Map(aliases.map((alias) => [alias.id, alias.aliasOf!]));
  const byId = new Map(events.map((event) => [event.id, event]));

  const canonicalOf = (id: string): string => {
    const seen = new Set<string>();
    let current = id;
    while (target.has(current) && !seen.has(current)) {
      seen.add(current);
      current = target.get(current)!;
    }
    return current;
  };

  const absorbed = new Map<string, Event[]>();
  const unmatched: string[] = [];

  for (const alias of aliases) {
    const canonicalId = canonicalOf(alias.id);
    if (!byId.has(canonicalId) || canonicalId === alias.id) {
      unmatched.push(alias.id);
      continue;
    }
    if (!byId.has(alias.id)) continue;
    absorbed.set(canonicalId, [...(absorbed.get(canonicalId) ?? []), byId.get(alias.id)!]);
  }

  const gone = new Set([...absorbed.values()].flat().map((event) => event.id));
  return {
    events: events
      .filter((event) => !gone.has(event.id))
      .map((event) => withHostsOf(event, absorbed.get(event.id) ?? [])),
    aliased: gone.size,
    unmatched,
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
