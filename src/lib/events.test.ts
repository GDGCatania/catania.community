import { describe, expect, it } from 'vitest';
import { formatDateLong, formatDayMonth, groupByDay } from './events.js';
import { ValidatedEventSchema, type Event } from './schema.js';

/**
 * The assertions look for the presence of a four-digit year rather than for an
 * exact string: the site is built in one language at a time, and these helpers
 * must behave the same whichever `baseLocale` a fork ships.
 */
const hasYear = (text: string) => /\d{4}/.test(text);

const now = new Date('2026-09-17T10:00:00+02:00');

function event(start: string, title = 'Meetup'): Event {
  return ValidatedEventSchema.parse({
    id: `manual:${start}`,
    slug: 'meetup',
    title,
    start,
    url: 'https://example.org/e',
    communityId: 'community-di-prova',
    online: false,
    area: 'citta',
    price: { type: 'free', currency: 'EUR' },
    categories: ['tech'],
    language: 'Italiano',
    cancelled: false,
    source: { type: 'manual', fetchedAt: '2026-09-17T08:00:00Z' },
  });
}

describe('formatDayMonth', () => {
  it('leaves the year out for a date in the current year', () => {
    expect(hasYear(formatDayMonth('2026-07-14T18:30:00+02:00', now))).toBe(false);
  });

  it('shows the year for an older date', () => {
    const formatted = formatDayMonth('2025-12-09T18:30:00+01:00', now);

    // Three editions of the same meetup in an archive are otherwise
    // indistinguishable: "14 LUG" twice, two years apart.
    expect(formatted).toContain('2025');
  });

  it('shows the year for a date in a future year', () => {
    expect(formatDayMonth('2027-02-11T18:30:00+01:00', now)).toContain('2027');
  });

  it('still reads the day from the offset in the string, not from the runner', () => {
    // 00:30 in Catania is 22:30 UTC the day before: the date shown is the local one.
    expect(formatDayMonth('2026-07-15T00:30:00+02:00', now)).toContain('15');
  });
});

describe('formatDateLong', () => {
  it('leaves the year out for a date in the current year', () => {
    expect(hasYear(formatDateLong('2026-07-14T18:30:00+02:00', now))).toBe(false);
  });

  it('shows the year for an archived event', () => {
    expect(formatDateLong('2024-02-01T18:30:00+01:00', now)).toContain('2024');
  });
});

describe('groupByDay', () => {
  it('labels days in the current year without one', () => {
    const [day] = groupByDay([event('2026-11-14T11:00:00+01:00')], now);

    expect(hasYear(day!.label)).toBe(false);
  });

  it('labels a day in another year with it', () => {
    const [day] = groupByDay([event('2027-01-09T18:30:00+01:00')], now);

    expect(day!.label).toContain('2027');
  });

  it('keeps today and tomorrow named rather than dated', () => {
    const days = groupByDay(
      [event('2026-09-17T19:00:00+02:00'), event('2026-09-18T19:00:00+02:00')],
      now
    );

    expect(days[0]!.label).not.toBe(days[1]!.label);
    expect(days.map((day) => day.key)).toEqual(['2026-09-17', '2026-09-18']);
  });
});