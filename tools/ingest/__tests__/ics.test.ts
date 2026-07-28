import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseIcs } from '../adapters/ics.js';
import { CommunitySchema, type Community, type IngestConfig } from '../../../src/lib/schema.js';

const fixture = readFileSync(path.join(__dirname, 'fixtures/luma-catania.ics'), 'utf8');

const community: Community = CommunitySchema.parse({
  id: 'community-di-prova',
  name: 'Community di prova',
  categories: ['tech'],
  area: 'citta',
});

type IcsConfig = Extract<IngestConfig, { type: 'ics' }>;

const config: IcsConfig = { type: 'ics', url: 'https://example.org/feed.ics' };
const since = new Date('2026-07-01T00:00:00Z');

function parse(overrides: Partial<IcsConfig> = {}) {
  return parseIcs(fixture, { ...config, ...overrides }, community, { since });
}

describe('ICS adapter', () => {
  it('drops events before `since` and those without a title', () => {
    const events = parse();
    const titles = events.map((event) => event.title);

    expect(titles).not.toContain('Evento troppo vecchio');
    expect(events).toHaveLength(5);
    // An empty SUMMARY must not produce a nameless entry.
    expect(events.every((event) => event.title.length > 0)).toBe(true);
  });

  it('keeps the local Italian time with the daylight-saving offset', () => {
    const event = parse().find((e) => e.title.startsWith('AperiTech'));

    // The event is at 19:00 in Catania: it must stay 19:00, not 17:00 UTC.
    expect(event?.start).toBe('2026-07-28T19:00:00+02:00');
    expect(event?.end).toBe('2026-07-28T22:00:00+02:00');
  });

  it('uses +01:00 for a date in standard time', () => {
    const event = parse().find((e) => e.title.startsWith('Retrospettiva'));

    // December: same feed, different offset. A +02:00 here would mean we are
    // using a fixed offset instead of the real timezone.
    expect(event?.start).toBe('2026-12-15T18:30:00+01:00');
  });

  it('normalises all-day events to local midnight', () => {
    const event = parse().find((e) => e.title.startsWith('Giornata'));

    expect(event?.start).toBe('2026-09-01T00:00:00+02:00');
  });

  it('treats a LOCATION that is a call URL as online', () => {
    const event = parse().find((e) => e.title.includes('Fediverso'));

    expect(event?.online).toBe(true);
    expect(event?.venue).toBeUndefined();
  });

  it('flags STATUS:CANCELLED events without removing them', () => {
    const event = parse().find((e) => e.title === 'Workshop annullato');

    expect(event).toBeDefined();
    expect(event?.cancelled).toBe(true);
  });

  it('splits LOCATION into name, address and town', () => {
    const event = parse().find((e) => e.title.startsWith('AperiTech'));

    expect(event?.venue).toEqual({
      name: 'Fablab Catania',
      address: 'Via Vittorio Emanuele II 12, Catania',
      city: 'Catania',
    });
  });

  it('keeps the whole name when LOCATION has no commas', () => {
    const event = parse().find((e) => e.title.startsWith('Giornata'));

    expect(event?.venue).toEqual({ name: 'Villa Bellini' });
  });

  it('converts HTML descriptions into readable text', () => {
    const event = parse().find((e) => e.title.startsWith('AperiTech'));

    expect(event?.description).toBe(
      'Tre interventi brevi su cosa si rompe davvero.\n\nAperitivo offerto.'
    );
  });

  it('prefers the VEVENT URL over the feed link', () => {
    const event = parse().find((e) => e.title.startsWith('AperiTech'));

    expect(event?.url).toBe('https://example.org/eventi/aperitech-42');
  });

  it('falls back to the feed link when URL is missing', () => {
    const event = parse().find((e) => e.title === 'Workshop annullato');

    expect(event?.url).toBe('https://example.org/eventi/annullato');
  });

  it('applies titleFilter for feeds covering several cities', () => {
    const events = parse({ titleFilter: 'AperiTech' });

    expect(events.map((e) => e.title)).toEqual(['AperiTech #42 — Agenti LLM in produzione']);
  });

  it('produces stable ids derived from the UID', () => {
    const first = parse().map((e) => e.id);
    const second = parse().map((e) => e.id);

    expect(first).toEqual(second);
    expect(first).toContain('ics:evt-estate-example-org');
  });

  it('handles a body that is not iCalendar', () => {
    expect(() => parseIcs('<html>404</html>', config, community, { since })).not.toThrow();
    // parseIcs does not validate the format (fetchIcs does): on non-ICS input
    // it simply finds no VEVENT.
    expect(parseIcs('<html>404</html>', config, community, { since })).toEqual([]);
  });
});
