import { describe, expect, it } from 'vitest';
import { mergeEvents, originKey, preserveFetchedAt } from '../store.js';
import type { Event } from '../../../src/lib/schema.js';

const SINCE = new Date('2026-07-28T00:00:00Z');

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'bevy:1',
    slug: 'evento',
    title: 'Evento',
    start: '2026-08-15T19:00:00+02:00',
    url: 'https://example.org/1',
    communityId: 'test',
    online: false,
    area: 'citta',
    price: { type: 'free', currency: 'EUR' },
    categories: ['tech'],
    language: 'Italiano',
    cancelled: false,
    source: { type: 'bevy', fetchedAt: '2026-07-01T00:00:00+02:00' },
    ...overrides,
  };
}

const CONFIGURED = new Set([originKey('test', 'bevy')]);

describe('mergeEvents — the site must never empty out', () => {
  it('keeps the events of a source that stopped responding', () => {
    const existing = [event({ id: 'bevy:1' })];

    const result = mergeEvents({
      fresh: [],
      existing,
      succeeded: new Set(), // the source failed
      configured: CONFIGURED,
      since: SINCE,
    });

    expect(result.preserved).toBe(1);
    expect(result.events).toHaveLength(1);
  });

  it('replaces upcoming events when the source responds', () => {
    const existing = [event({ id: 'bevy:1', title: 'Titolo vecchio' })];
    const fresh = [event({ id: 'bevy:1', title: 'Titolo nuovo' })];

    const result = mergeEvents({
      fresh,
      existing,
      succeeded: CONFIGURED,
      configured: CONFIGURED,
      since: SINCE,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.title).toBe('Titolo nuovo');
    expect(result.preserved).toBe(0);
  });

  it('never deletes past events, even once the source stops listing them', () => {
    const passato = event({ id: 'bevy:old', start: '2025-03-01T19:00:00+01:00' });

    const result = mergeEvents({
      fresh: [],
      existing: [passato],
      succeeded: CONFIGURED,
      configured: CONFIGURED,
      since: SINCE,
    });

    // The archive stays indexable: a deliberate SEO choice, not leftovers.
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.id).toBe('bevy:old');
  });

  it('forgets upcoming events of a source removed from the configuration', () => {
    const result = mergeEvents({
      fresh: [],
      existing: [event({ id: 'bevy:1' })],
      succeeded: new Set(),
      configured: new Set(), // the community is no longer in sources/
      since: SINCE,
    });

    expect(result.events).toHaveLength(0);
  });

  it('still keeps the past of a removed community', () => {
    const result = mergeEvents({
      fresh: [],
      existing: [event({ id: 'bevy:old', start: '2025-03-01T19:00:00+01:00' })],
      succeeded: new Set(),
      configured: new Set(),
      since: SINCE,
    });

    expect(result.events).toHaveLength(1);
  });
});

describe('preserveFetchedAt — idempotent bot commits', () => {
  it('keeps the previous timestamp when the event has not changed', () => {
    const existing = [event({ source: { type: 'bevy', fetchedAt: '2026-07-01T00:00:00+02:00' } })];
    const fresh = [event({ source: { type: 'bevy', fetchedAt: '2026-07-28T06:00:00+02:00' } })];

    const result = preserveFetchedAt(fresh, existing);

    expect(result[0]!.source.fetchedAt).toBe('2026-07-01T00:00:00+02:00');
  });

  it('updates the timestamp when a field changed', () => {
    const existing = [event({ title: 'Prima' })];
    const fresh = [
      event({ title: 'Dopo', source: { type: 'bevy', fetchedAt: '2026-07-28T06:00:00+02:00' } }),
    ];

    const result = preserveFetchedAt(fresh, existing);

    expect(result[0]!.source.fetchedAt).toBe('2026-07-28T06:00:00+02:00');
  });

  it('leaves brand-new events alone', () => {
    const fresh = [
      event({ id: 'bevy:2', source: { type: 'bevy', fetchedAt: '2026-07-28T06:00:00+02:00' } }),
    ];

    expect(preserveFetchedAt(fresh, [])[0]!.source.fetchedAt).toBe('2026-07-28T06:00:00+02:00');
  });
});
