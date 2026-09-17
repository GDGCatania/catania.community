/**
 * Timezone helpers shared by the adapters.
 *
 * Everything we publish is an ISO 8601 string with an explicit offset, because
 * the build runs on a UTC runner and "18:30" in Catania must stay 18:30 for a
 * reader in Catania. Italy switches between CET (+01:00) and CEST (+02:00), so
 * the offset has to be computed for the event's own date, never hardcoded.
 */

/** Reference timezone: sources without one are read as Italian local time. */
export const DEFAULT_TZ = 'Europe/Rome';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A timezone's offset in minutes at a given instant (handles daylight saving).
 * Positive east of Greenwich: `local = utc + offset`.
 */
export function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Intl can return "24" for midnight in some combinations.
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return Math.round((asUtc - date.getTime()) / 60_000);
}

/**
 * Builds an ISO string with the right offset from a wall-clock date and time,
 * for sources that publish local time without saying so ("2026-07-14", "18:30").
 *
 * Two passes, because the offset depends on the instant and the instant depends
 * on the offset: the first pass reads the offset around the right moment, the
 * second corrects it for the few hours a year when the first guess falls on the
 * wrong side of a daylight-saving change.
 */
export function localIsoWithOffset(
  date: string,
  time: string,
  timeZone: string = DEFAULT_TZ
): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  if ([year, month, day, hour, minute].some((n) => n === undefined || Number.isNaN(n))) {
    throw new Error(`invalid date/time: "${date}" "${time}"`);
  }

  const asIfUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const firstGuess = timeZoneOffsetMinutes(new Date(asIfUtc), timeZone);
  const offset = timeZoneOffsetMinutes(new Date(asIfUtc - firstGuess * 60_000), timeZone);

  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);

  return (
    `${date}T${pad(hour!)}:${pad(minute!)}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}