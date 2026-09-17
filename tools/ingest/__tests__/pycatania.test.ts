import { describe, expect, it } from 'vitest';
import { parsePyCatania } from '../adapters/pycatania.js';
import { CommunitySchema, type Community, type IngestConfig } from '../../../src/lib/schema.js';

const community: Community = CommunitySchema.parse({
  id: 'python-catania',
  name: 'Python Catania',
  categories: ['tech'],
  area: 'citta',
});

type PyConfig = Extract<IngestConfig, { type: 'pycatania' }>;

const config: PyConfig = {
  type: 'pycatania',
  url: 'https://catania.python.it/data/events.json',
  defaultTime: '18:30',
};

const since = new Date('2024-01-01T00:00:00Z');

/** Shaped like the live feed, fields and all. */
const feed = [
  {
    id: 315327982,
    title: 'Meetup Python Catania - After PyCon Italia 2026',
    date: '2026-07-14',
    image: '/images/events/14-07-2026/event-315327982.jpg',
    description: 'Condivisione dell’esperienza al PyCon Italia 2026 e talk della community.',
    descriptionEn: 'Sharing the PyCon Italia 2026 experience and community talks.',
    fullDescription: 'La community si è ritrovata presso Paradigma SpA, viale Africa 31.',
    attendees: 20,
    url: 'https://www.meetup.com/python-catania/events/315327982/',
    gallery: ['/images/events/14-07-2026/photo_1.jpg'],
    speakers: [{ name: 'Salvatore Rapisarda', topic: 'Novità di Python' }],
  },
  {
    id: 305231234,
    title: 'Meetup Python Catania - Ho! Ho! Python Code! 🎅🎄',
    date: '2025-12-09',
    description: 'Edizione natalizia con PyDinner finale.',
    attendees: 27,
    url: 'https://www.meetup.com/python-catania/events/305231234/',
  },
  {
    id: 290001111,
    title: 'Meetup troppo vecchio',
    date: '2023-11-02',
    description: 'Prima della finestra richiesta.',
    url: 'https://www.meetup.com/python-catania/events/290001111/',
  },
];

function parse(payload: unknown = feed, overrides: Partial<PyConfig> = {}, from = since) {
  return parsePyCatania(payload, { ...config, ...overrides }, community, { since: from });
}

describe('Python Catania adapter', () => {
  it('reads the feed and drops entries before `since`', () => {
    const events = parse();

    expect(events.map((event) => event.title)).toEqual([
      'Meetup Python Catania - After PyCon Italia 2026',
      'Meetup Python Catania - Ho! Ho! Python Code! 🎅🎄',
    ]);
  });

  it('applies defaultTime with the summer offset', () => {
    const [july] = parse();

    // Their feed has no time: 18:30 in Catania in July is +02:00.
    expect(july?.start).toBe('2026-07-14T18:30:00+02:00');
  });

  it('uses +01:00 for a date in standard time', () => {
    const december = parse().find((event) => event.start.startsWith('2025-12'));

    // A +02:00 here would mean we are using a fixed offset, not the real timezone.
    expect(december?.start).toBe('2025-12-09T18:30:00+01:00');
  });

  it('prefers a time published by the feed over defaultTime', () => {
    const events = parse([{ ...feed[0], time: '20:00' }]);

    expect(events[0]?.start).toBe('2026-07-14T20:00:00+02:00');
  });

  it('keeps the Meetup link and derives a stable id from theirs', () => {
    const [july] = parse();

    expect(july?.url).toBe('https://www.meetup.com/python-catania/events/315327982/');
    expect(july?.id).toBe('pycatania:315327982');
  });

  it('makes site-relative images absolute', () => {
    const [july] = parse();

    expect(july?.coverImage).toBe(
      'https://catania.python.it/images/events/14-07-2026/event-315327982.jpg'
    );
  });

  it('leaves the venue empty rather than guessing it from the prose', () => {
    const [july] = parse();

    // "viale Africa 31" appears in fullDescription: parsing it would put a pin
    // on the map that nobody verified.
    expect(july?.venue).toBeUndefined();
    expect(july?.online).toBe(false);
  });

  it('reads a structured venue if the feed ever carries one', () => {
    const events = parse([
      { ...feed[0], venue: { name: 'Paradigma SpA', address: 'Viale Africa 31', city: 'Catania' } },
    ]);

    expect(events[0]?.venue).toEqual({
      name: 'Paradigma SpA',
      address: 'Viale Africa 31',
      city: 'Catania',
    });
  });

  it('falls back to their events page when an entry has no link', () => {
    const events = parse([{ ...feed[0], url: null }]);

    expect(events[0]?.url).toBe('https://catania.python.it/#/events');
  });

  it('skips malformed entries without losing the good ones', () => {
    const events = parse([
      null,
      { id: 1, title: '', date: '2026-07-14' },
      { id: 2, title: 'Senza data', date: 'luglio' },
      feed[0],
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe('pycatania:315327982');
  });

  it('throws if the feed stops being an array, so the events are preserved', () => {
    // A shape change upstream must surface as an ingest failure, not as a
    // community that silently empties out.
    expect(() => parse({ events: feed })).toThrow(/did not return a JSON array/);
  });
});