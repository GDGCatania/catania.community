import { TIMEZONE } from './site';
import { localeTag } from '../i18n';
import * as m from '../paraglide/messages.js';

/**
 * Date helpers with no Node dependencies, so the same code runs at build time
 * and in the browser. The site is static: anything relative to "today" is
 * computed once during the build and then corrected on the client, because a
 * build only happens when the data changes.
 */

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

/** Heading of a day in the agenda: "Oggi · …", "Domani · …" or the date. */
export function dayLabel(key: string, now: Date): string {
  const todayKey = localDayKey(now);
  const tomorrowKey = localDayKey(new Date(now.getTime() + 86_400_000));

  const formatted = new Intl.DateTimeFormat(localeTag, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    // Same rule as the lists: the year shows up only once it is not this one.
    ...(key.slice(0, 4) !== todayKey.slice(0, 4) ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${key}T12:00:00Z`));

  if (key === todayKey) return `${m.event_today()} · ${formatted}`;
  if (key === tomorrowKey) return `${m.event_tomorrow()} · ${formatted}`;
  return capitalise(formatted);
}

/**
 * Whether a date needs its year spelled out: only when it is not the current
 * one. This is what keeps an archive readable — the communities here run
 * recurring meetups, so a list of "14 LUG · 23 APR · 14 LUG" gives no way to
 * tell three editions apart. Within the current year the year is noise.
 */
function isOtherYear(iso: string, now: Date): boolean {
  return iso.slice(0, 4) !== localDayKey(now).slice(0, 4);
}

export function formatDateLong(iso: string, now = new Date()): string {
  return capitalise(
    new Intl.DateTimeFormat(localeTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(isOtherYear(iso, now) ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))
  );
}

export function formatDayMonth(iso: string, now = new Date()): string {
  return new Intl.DateTimeFormat(localeTag, {
    day: '2-digit',
    month: 'short',
    ...(isOtherYear(iso, now) ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  })
    .format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))
    .toUpperCase()
    .replace('.', '');
}

/** Italian weekday names come out lowercase from Intl; English already caps. */
function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
