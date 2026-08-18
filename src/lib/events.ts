import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { CommunitySchema, EventFileSchema, type Community, type Event } from './schema';
import { TIMEZONE } from './site';
import { localeTag } from '../i18n';
import * as m from '../paraglide/messages.js';

/**
 * Loads the data at build time. This runs in Node during `astro build`, never
 * in the browser: the result is baked into the generated HTML.
 */

const ROOT = path.resolve(process.cwd());
const EVENTS_DIR = path.join(ROOT, 'data/events');
const COMMUNITIES_DIR = path.join(ROOT, 'sources/communities');

export { TIMEZONE };

let cache: { events: Event[]; communities: Community[] } | null = null;

async function load(): Promise<{ events: Event[]; communities: Community[] }> {
  if (cache) return cache;

  const [events, communities] = await Promise.all([loadEvents(), loadCommunities()]);
  cache = { events, communities };
  return cache;
}

async function loadEvents(): Promise<Event[]> {
  let files: string[];
  try {
    files = (await readdir(EVENTS_DIR)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
  } catch {
    // Nothing collected yet: the site builds empty rather than failing.
    return [];
  }

  const events: Event[] = [];
  for (const file of files.sort()) {
    const raw = JSON.parse(await readFile(path.join(EVENTS_DIR, file), 'utf8'));
    events.push(...EventFileSchema.parse(raw));
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

async function loadCommunities(): Promise<Community[]> {
  let files: string[];
  try {
    files = (await readdir(COMMUNITIES_DIR)).filter((f) => f.endsWith('.yml'));
  } catch {
    return [];
  }

  const communities: Community[] = [];
  for (const file of files.sort()) {
    const raw = parseYaml(await readFile(path.join(COMMUNITIES_DIR, file), 'utf8'));
    if (raw) communities.push(CommunitySchema.parse(raw));
  }

  return communities.sort((a, b) => a.name.localeCompare(b.name, localeTag));
}

/** Every event, past ones included: the archive stays indexable. */
export async function getAllEvents(): Promise<Event[]> {
  return (await load()).events;
}

export async function getCommunities(): Promise<Community[]> {
  return (await load()).communities;
}

export async function getCommunityMap(): Promise<Map<string, Community>> {
  return new Map((await getCommunities()).map((community) => [community.id, community]));
}

/**
 * Events that have not finished yet, in chronological order.
 * An event with an end time counts as running until it ends: someone opening
 * the site at 20:00 should still see the aperitivo that started at 19:00.
 */
export async function getUpcomingEvents(now = new Date()): Promise<Event[]> {
  const events = await getAllEvents();
  return events.filter((event) => new Date(event.end ?? event.start) >= now);
}

export async function getPastEvents(now = new Date()): Promise<Event[]> {
  const events = await getAllEvents();
  return events.filter((event) => new Date(event.end ?? event.start) < now).reverse();
}

export async function getEventsByCommunity(
  communityId: string,
  now = new Date()
): Promise<{ upcoming: Event[]; past: Event[] }> {
  const [upcoming, past] = await Promise.all([getUpcomingEvents(now), getPastEvents(now)]);
  return {
    upcoming: upcoming.filter((event) => event.communityId === communityId),
    past: past.filter((event) => event.communityId === communityId),
  };
}

/** Local `YYYY-MM-DD` of an event, read from the offset it carries. */
export function eventDayKey(event: Event): string {
  return event.start.slice(0, 10);
}

export interface EventDay {
  key: string;
  date: Date;
  label: string;
  events: Event[];
}

/**
 * Groups by day, like the "Tonight · Tue 28 Jul" headers in the design.
 * Grouping uses the local date already present in the ISO string rather than
 * `new Date()`, so the output does not depend on the build runner's timezone.
 */
export function groupByDay(events: Event[], now = new Date()): EventDay[] {
  const days = new Map<string, Event[]>();

  for (const event of events) {
    const key = eventDayKey(event);
    const bucket = days.get(key);
    if (bucket) bucket.push(event);
    else days.set(key, [event]);
  }

  const todayKey = localDayKey(now);
  const tomorrowKey = localDayKey(new Date(now.getTime() + 86_400_000));

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayEvents]) => ({
      key,
      date: new Date(`${key}T12:00:00Z`),
      label: dayLabel(key, todayKey, tomorrowKey),
      events: dayEvents,
    }));
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  const formatted = new Intl.DateTimeFormat(localeTag, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);

  if (key === todayKey) return `${m.event_today()} · ${formatted}`;
  if (key === tomorrowKey) return `${m.event_tomorrow()} · ${formatted}`;
  return capitalise(formatted);
}

/** Italian weekday names come out lowercase from Intl; English already caps. */
function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** `YYYY-MM-DD` of an instant, in the events' timezone. */
export function localDayKey(date: Date): string {
  // en-CA gives ISO-ordered output regardless of the site language.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatTime(iso: string): string {
  // The offset is already in the string: read the local time as written rather
  // than converting, so the time shown is the event's own.
  return iso.slice(11, 16);
}

export function formatDateLong(iso: string): string {
  return capitalise(
    new Intl.DateTimeFormat(localeTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))
  );
}

export function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat(localeTag, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))
    .toUpperCase()
    .replace('.', '');
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(localeTag).format(value);
}

/** Events per day, feeding the calendar dots. */
export function eventsPerDay(events: Event[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const key = eventDayKey(event);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** "1 event" / "N events" — plural category chosen by Intl.PluralRules. */
export function eventCount(count: number): string {
  return m.event_count({ count });
}
