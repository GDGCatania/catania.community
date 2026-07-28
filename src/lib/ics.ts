import type { Community, Event } from './schema';
import { t } from '../i18n';

/**
 * Outgoing iCalendar generation.
 *
 * The project consumes open standards, so it republishes them: anyone who wants
 * Catania's events in their own calendar should not have to come back here.
 */

/** RFC 5545: lines must not exceed 75 octets. */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    // Continuation lines start with a space, which costs one octet.
    const limit = chunks.length === 0 ? 75 : 74;
    if (currentBytes + size > limit) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  if (current) chunks.push(current);

  return chunks.join('\r\n ');
}

/** Separators are meaningful in the format, so they must be escaped. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** From ISO-with-offset to the compact UTC form the standard requires. */
function toIcsUtc(iso: string): string {
  return `${new Date(iso).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

export function eventToVevent(event: Event, community?: Community): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id.replace(/[^\w:.-]/g, '-')}@catania.community`,
    `DTSTAMP:${toIcsUtc(event.source.fetchedAt)}`,
    `DTSTART:${toIcsUtc(event.start)}`,
  ];

  // Without DTEND many clients show a zero-length event. Two hours is an honest
  // guess for a community meetup, and better than nothing.
  const end = event.end ?? new Date(new Date(event.start).getTime() + 2 * 3_600_000).toISOString();
  lines.push(`DTEND:${toIcsUtc(end)}`);

  lines.push(`SUMMARY:${escapeText(event.title)}`);

  const description = [
    event.description,
    community ? t('feed.organiser', { name: community.name }) : null,
    t('feed.detailsAt', { url: event.url }),
  ]
    .filter(Boolean)
    .join('\n\n');
  lines.push(`DESCRIPTION:${escapeText(description)}`);

  const location = event.online
    ? t('status.online')
    : [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(', ');
  if (location) lines.push(`LOCATION:${escapeText(location)}`);

  if (event.venue?.geo) lines.push(`GEO:${event.venue.geo.lat};${event.venue.geo.lon}`);

  lines.push(`URL:${event.url}`);
  lines.push(`STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
  if (community) lines.push(`CATEGORIES:${escapeText(community.categories.join(','))}`);

  lines.push('END:VEVENT');
  return lines;
}

export function buildCalendar(
  events: Event[],
  communities: Map<string, Community>,
  calendarName: string
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//catania.community//agenda//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Rome',
  ];

  for (const event of events) {
    lines.push(...eventToVevent(event, communities.get(event.communityId)));
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 mandates CRLF as the line terminator.
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
