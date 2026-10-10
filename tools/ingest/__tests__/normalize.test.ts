import { describe, expect, it } from 'vitest';
import { applyOverrides, dedupe, resolveArea, uniqueSlugs } from '../normalize.js';
import {
  CommunitySchema,
  OverrideSchema,
  type Community,
  type Event,
} from '../../../src/lib/schema.js';
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

  it("keeps the other community as organiser when its copy is dropped", () => {
    const fromMeetup = event({
      id: 'jsonld:meetup:1',
      communityId: 'flutter-catania',
      source: { type: 'jsonld', fetchedAt: '2026-07-28T00:00:00+02:00' },
    });
    const fromBevy = event({ id: 'bevy:1', communityId: 'gdg-catania' });

    // Whichever feed answered first, the result is the same.
    for (const input of [[fromMeetup, fromBevy], [fromBevy, fromMeetup]]) {
      const [merged] = dedupe(input).events;

      expect(merged!.id).toBe('bevy:1');
      expect(merged!.communityId).toBe('gdg-catania');
      expect(merged!.hostIds).toEqual(['gdg-catania', 'flutter-catania']);
    }
  });

  it('adds no organisers when the duplicates come from one community', () => {
    const fromIcs = event({ id: 'ics:abc', source: { type: 'ics', fetchedAt: '2026-07-28T00:00:00+02:00' } });

    expect(dedupe([fromIcs, event()]).events[0]!.hostIds).toBeUndefined();
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

  /**
   * Parsed through the schema, as the ingest reads them: a field the override
   * does not name must not come back as its default and overwrite the event.
   */
  it('leaves alone the fields it does not name, defaults included', () => {
    const original = event({ online: true, cancelled: true, categories: ['design'], language: 'English' });
    const override = OverrideSchema.parse({ id: 'bevy:1', title: 'Titolo corretto' });

    const [patched] = applyOverrides([original], [override]).events;

    expect(patched).toEqual({ ...original, title: 'Titolo corretto' });
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

  it('sets the organisers of a co-organised event, replacing the list', () => {
    const once = applyOverrides([event()], [{ id: 'bevy:1', hostIds: ['gdg-catania', 'flutter-catania'] }]);
    const again = applyOverrides(once.events, [{ id: 'bevy:1', hostIds: ['flutter-catania'] }]);

    expect(once.events[0]!.hostIds).toEqual(['gdg-catania', 'flutter-catania']);
    // Declarative: an override states the whole list, it does not append.
    expect(again.events[0]!.hostIds).toEqual(['flutter-catania']);
    // Provenance stays where it was.
    expect(again.events[0]!.communityId).toBe(event().communityId);
  });

  it('refuses an organiser listed twice', () => {
    const result = applyOverrides([event()], [{ id: 'bevy:1', hostIds: ['a', 'a'] }]);

    expect(result.applied).toBe(0);
    expect(result.events[0]!.hostIds).toBeUndefined();
  });

  describe('aliasOf', () => {
    const bevy = event({ id: 'bevy:1', communityId: 'gdg-catania' });
    // Same evening, venue written differently: dedupe cannot tell.
    const meetup = event({
      id: 'jsonld:meetup:9',
      communityId: 'flutter-catania',
      title: 'Flutter Meetup',
      venue: { name: 'Centro Atena' },
      source: { type: 'jsonld', fetchedAt: '2026-07-28T00:00:00+02:00' },
    });

    it('merges the alias into the event it points to, organised by both', () => {
      const result = applyOverrides([bevy, meetup], [{ id: 'jsonld:meetup:9', aliasOf: 'bevy:1' }]);

      expect(result.aliased).toBe(1);
      expect(result.unmatched).toEqual([]);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.id).toBe('bevy:1');
      expect(result.events[0]!.hostIds).toEqual(['gdg-catania', 'flutter-catania']);
    });

    it('then applies the corrections written on the event it points to', () => {
      const result = applyOverrides(
        [bevy, meetup],
        [
          { id: 'jsonld:meetup:9', aliasOf: 'bevy:1' },
          { id: 'bevy:1', hostIds: ['flutter-catania', 'gdg-catania'] },
        ]
      );

      expect(result.events[0]!.hostIds).toEqual(['flutter-catania', 'gdg-catania']);
    });

    it('follows an alias of an alias', () => {
      const third = event({ id: 'ics:x', communityId: 'altra', title: 'X' });
      const result = applyOverrides(
        [bevy, meetup, third],
        [
          { id: 'ics:x', aliasOf: 'jsonld:meetup:9' },
          { id: 'jsonld:meetup:9', aliasOf: 'bevy:1' },
        ]
      );

      expect(result.events.map((e) => e.id)).toEqual(['bevy:1']);
      expect(result.events[0]!.hostIds).toEqual(['gdg-catania', 'altra', 'flutter-catania']);
    });

    /** Past events are no longer listed by their source: nothing to merge, nothing to report. */
    it('is quiet when the alias did not arrive this run', () => {
      const result = applyOverrides([bevy], [{ id: 'jsonld:meetup:9', aliasOf: 'bevy:1' }]);

      expect(result.events).toEqual([bevy]);
      expect(result.unmatched).toEqual([]);
    });

    it('keeps the alias and reports it when the event it points to does not exist', () => {
      const result = applyOverrides([meetup], [{ id: 'jsonld:meetup:9', aliasOf: 'bevy:404' }]);

      expect(result.events).toEqual([meetup]);
      expect(result.unmatched).toEqual(['jsonld:meetup:9']);
    });

    it('accepts nothing else next to aliasOf', () => {
      expect(
        OverrideSchema.safeParse({ id: 'jsonld:meetup:9', aliasOf: 'bevy:1', title: 'X' }).success
      ).toBe(false);
    });
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
