import { sync as icalSync, type VEvent, type ParameterValue } from 'node-ical';
import { fetchText } from '../lib/fetch.js';
import { htmlToText, slugify, truncate, normalizeForCompare } from '../lib/text.js';
import { DEFAULT_TZ, timeZoneOffsetMinutes } from '../lib/time.js';
import type { Community, IngestConfig } from '../../../src/lib/schema.js';
import type { RawEvent } from './types.js';

/**
 * iCalendar adapter (RFC 5545). A single parser covers every platform that
 * publishes an .ics feed: Luma (per calendar and per city), public Google
 * Calendars, Gancio, Mobilizon, Nextcloud. This is the source to prefer,
 * because it is a standard rather than an API that can be shut off.
 */

export async function fetchIcs(
  config: Extract<IngestConfig, { type: 'ics' }>,
  community: Community,
  options: { since: Date }
): Promise<RawEvent[]> {
  const body = await fetchText(config.url, { accept: 'text/calendar, text/plain' });

  if (!body.includes('BEGIN:VCALENDAR')) {
    throw new Error(`${config.url} is not an iCalendar feed (no BEGIN:VCALENDAR)`);
  }

  return parseIcs(body, config, community, options);
}

/** Split out from fetchIcs so tests can run against fixtures without network. */
export function parseIcs(
  body: string,
  config: Extract<IngestConfig, { type: 'ics' }>,
  community: Community,
  options: { since: Date }
): RawEvent[] {
  const parsed = icalSync.parseICS(body);
  const filter = config.titleFilter ? normalizeForCompare(config.titleFilter) : null;
  const events: RawEvent[] = [];

  for (const entry of Object.values(parsed)) {
    // CalendarResponse values are optional: VTIMEZONE blocks and the feed's
    // bookkeeping keys are not components to ingest.
    if (!entry || entry.type !== 'VEVENT') continue;
    const vevent: VEvent = entry;

    const title = plain(vevent.summary).trim();
    if (!title) continue;
    if (filter && !normalizeForCompare(title).includes(filter)) continue;

    const start = vevent.start;
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) continue;
    if (start < options.since) continue;

    // All-day events carry no time: normalising them to local midnight stops
    // them showing up at 02:00 as a side effect of the UTC offset.
    const allDay = vevent.datetype === 'date' || start.dateOnly === true;

    const description = plain(vevent.description);
    const descriptionText = description ? htmlToText(description) : undefined;

    const locationRaw = plain(vevent.location).trim();
    const online = isOnline(locationRaw, descriptionText);

    // The UID is the event's stable identity within the feed: reusing it for
    // our internal id keeps later runs from creating duplicates.
    const uid = vevent.uid || `${title}-${start.getTime()}`;

    events.push({
      id: `ics:${slugify(uid, 120) || slugify(`${title}-${start.getTime()}`)}`,
      slug: slugify(title),
      title,
      description: descriptionText ? truncate(descriptionText, 5_000) : undefined,
      start: toIsoWithOffset(start, allDay),
      end: vevent.end instanceof Date ? toIsoWithOffset(vevent.end, allDay) : undefined,
      url: pickUrl(vevent, config.url),
      communityId: community.id,
      venue: !online && locationRaw ? parseLocation(locationRaw) : undefined,
      online,
      // ICS has no price field: we do not invent an amount, and most community
      // feeds publish free events.
      price: { type: 'free', currency: 'EUR' },
      categories: community.categories,
      language: community.language,
      // STATUS:CANCELLED is part of the standard: the event stays in the feed but is flagged.
      cancelled: vevent.status === 'CANCELLED',
    });
  }

  return events;
}

/** ICS fields arrive either as a string or as `{ val, params }`. */
function plain(value: ParameterValue | undefined): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.val === 'string') return value.val;
  return '';
}

/**
 * node-ical returns UTC Dates with the original timezone in `.tz`.
 * We rebuild the correct offset for that date, so the published time is the
 * event's own local time even when the build runs on a UTC runner.
 */
function toIsoWithOffset(date: Date & { tz?: string }, allDay: boolean): string {
  const tz = date.tz && date.tz.includes('/') ? date.tz : DEFAULT_TZ;

  let offsetMinutes: number;
  try {
    offsetMinutes = timeZoneOffsetMinutes(date, tz);
  } catch {
    offsetMinutes = timeZoneOffsetMinutes(date, DEFAULT_TZ);
  }

  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);

  const time = allDay
    ? '00:00:00'
    : `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;

  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function pickUrl(vevent: VEvent, feedUrl: string): string {
  const candidate = plain(vevent.url as ParameterValue | undefined).trim();
  if (/^https?:\/\//i.test(candidate)) return candidate;

  // With no URL in the VEVENT we have nowhere to send people: the feed itself
  // (usually the calendar's public page) beats nothing.
  return feedUrl;
}

const ONLINE_HINTS = [
  'zoom.us',
  'meet.google',
  'teams.microsoft',
  'meet.jit.si',
  'youtube.com',
  'twitch.tv',
  'webinar',
  'streaming',
];

function isOnline(location: string, description?: string): boolean {
  if (/^https?:\/\//i.test(location.trim())) return true;

  const haystack = `${location} ${description ?? ''}`.toLowerCase();
  if (ONLINE_HINTS.some((hint) => haystack.includes(hint))) return true;

  // "online" on its own is ambiguous (it shows up in "register online"), so we
  // only accept it when LOCATION is the field saying it.
  return /\bonline\b/i.test(location);
}

/**
 * LOCATION is free text. In practice feeds use "Name, Street, Town" or just
 * "Name": the first part is the venue name.
 */
function parseLocation(location: string): { name: string; address?: string; city?: string } {
  const parts = location
    .split(/\s*[,\n]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const first = parts[0];
  if (!first || parts.length <= 1) return { name: location.slice(0, 200) };

  const rest = parts.slice(1);
  // The last segment is the town only if it is not a postcode or a country.
  const last = rest.at(-1);
  const city = last && !/^\d{4,5}$/.test(last) && !/^ital(y|ia)$/i.test(last) ? last : undefined;

  return {
    name: first.slice(0, 200),
    address: rest.join(', ').slice(0, 300) || undefined,
    city: city?.slice(0, 120),
  };
}
