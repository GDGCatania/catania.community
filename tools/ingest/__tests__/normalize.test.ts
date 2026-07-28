import { describe, expect, it } from 'vitest';
import { applyOverrides, dedupe, resolveArea, uniqueSlugs } from '../normalize.js';
import { CommunitySchema, type Community, type Event } from '../../../src/lib/schema.js';
import type { RawEvent } from '../adapters/types.js';

const community: Community = CommunitySchema.parse({
  id: 'test',
  name: 'Test',
  categories: ['tech'],
  area: 'citta',
});

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'bevy:1',
    slug: 'evento',
    title: 'Evento',
    start: '2026-08-01T19:00:00+02:00',
    url: 'https://example.org/1',
    communityId: 'test',
    online: false,
    area: 'citta',
    price: { type: 'free', currency: 'EUR' },
    categories: ['tech'],
    language: 'Italiano',
    cancelled: false,
    source: { type: 'bevy', fetchedAt: '2026-07-28T00:00:00+02:00' },
    ...overrides,
  };
}

describe('resolveArea', () => {
  const raw = (over: Partial<RawEvent> = {}): RawEvent =>
    ({ ...event(), ...over }) as unknown as RawEvent;

  it('puts online events in their own area', () => {
    expect(resolveArea(raw({ online: true }), community)).toBe('online');
  });

  it('recognises Catania as the city, whatever the case or accents', () => {
    expect(resolveArea(raw({ venue: { name: 'X', city: 'CATANIA' } }), community)).toBe('citta');
  });

  it('treats other towns as the province', () => {
    expect(resolveArea(raw({ venue: { name: 'X', city: 'Acireale' } }), community)).toBe('provincia');
  });

  it('inherits the community area when the town is unknown', () => {
    const provincia = { ...community, area: 'provincia' as const };
    expect(resolveArea(raw({ venue: { name: 'X' } }), provincia)).toBe('provincia');
  });
});

describe('dedupe', () => {
  it('keeps the more reliable source when the same event arrives twice', () => {
    const fromIcs = event({
      id: 'ics:abc',
      source: { type: 'ics', fetchedAt: '2026-07-28T00:00:00+02:00' },
    });
    const fromBevy = event({ id: 'bevy:1' });

    const { events, duplicates } = dedupe([fromIcs, fromBevy]);

    expect(duplicates).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.source.type).toBe('bevy');
  });

  it('does not merge same-titled events on different days', () => {
    const a = event({ id: 'a', start: '2026-08-01T19:00:00+02:00' });
    const b = event({ id: 'b', start: '2026-09-01T19:00:00+02:00' });

    expect(dedupe([a, b]).events).toHaveLength(2);
  });

  it('does not merge same-titled events at different venues on one day', () => {
    const a = event({ id: 'a', venue: { name: 'Fablab' } });
    const b = event({ id: 'b', venue: { name: 'Monastero' } });

    expect(dedupe([a, b]).events).toHaveLength(2);
  });

  it('keeps the richer record when the source is the same', () => {
    const povero = event({ id: 'bevy:1' });
    const ricco = event({
      id: 'bevy:1',
      description: 'Descrizione',
      venue: { name: 'Fablab', geo: { lat: 37.5, lon: 15.08 } },
    });

    const { events } = dedupe([povero, ricco]);

    expect(events[0]!.description).toBe('Descrizione');
  });
});

describe('applyOverrides', () => {
  it('overwrites the fields it names', () => {
    const result = applyOverrides([event()], [{ id: 'bevy:1', title: 'Titolo corretto' }]);

    expect(result.applied).toBe(1);
    expect(result.events[0]!.title).toBe('Titolo corretto');
  });

  it('hides an event with drop', () => {
    const result = applyOverrides([event()], [{ id: 'bevy:1', drop: true }]);

    expect(result.dropped).toBe(1);
    expect(result.events).toHaveLength(0);
  });

  it('reports overrides that match nothing', () => {
    const result = applyOverrides([event()], [{ id: 'bevy:999', title: 'X' }]);

    expect(result.unmatched).toEqual(['bevy:999']);
    expect(result.events).toHaveLength(1);
  });

  it('does not lose the event when an override makes it invalid', () => {
    // start without an offset: fails the schema.
    const result = applyOverrides([event()], [{ id: 'bevy:1', start: 'non-una-data' }]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.start).toBe('2026-08-01T19:00:00+02:00');
    expect(result.applied).toBe(0);
  });
});

describe('uniqueSlugs', () => {
  it('leaves already-unique slugs alone', () => {
    const events = uniqueSlugs([event({ id: 'a', slug: 'uno' }), event({ id: 'b', slug: 'due' })]);

    expect(events.map((e) => e.slug)).toEqual(['uno', 'due']);
  });

  it('disambiguates namesakes with the date', () => {
    const events = uniqueSlugs([
      event({ id: 'a', slug: 'aperitech', start: '2026-08-01T19:00:00+02:00' }),
      event({ id: 'b', slug: 'aperitech', start: '2026-09-01T19:00:00+02:00' }),
    ]);

    expect(events.map((e) => e.slug)).toEqual(['aperitech', 'aperitech-2026-09-01']);
  });

  it('always produces the same slugs for the same input', () => {
    const input = [
      event({ id: 'b', slug: 'x', start: '2026-09-01T19:00:00+02:00' }),
      event({ id: 'a', slug: 'x', start: '2026-08-01T19:00:00+02:00' }),
    ];

    // Same set, different input order: the URLs must not change.
    const first = uniqueSlugs(input).map((e) => `${e.id}:${e.slug}`);
    const second = uniqueSlugs([...input].reverse()).map((e) => `${e.id}:${e.slug}`);

    expect(first).toEqual(second);
  });
});
