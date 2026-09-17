import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  eventId,
  findEvent,
  jsonLdBlocks,
  markIfCut,
  parseJsonLdEvent,
  toIsoWithOffset,
} from '../adapters/jsonld.js';
import type { Community } from '../../../src/lib/schema.js';

/**
 * The fixtures are trimmed copies of real pages, captured on 2026-09-17: the
 * JSON-LD blocks are byte-for-byte what the platforms served. Tests never touch
 * the network, so a platform changing its markup is caught by a failing fetch
 * in production, not by a test that silently started downloading something else.
 */
const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');

const community: Community = {
  id: 'community-di-prova',
  name: 'Community di prova',
  categories: ['tech'],
  area: 'citta',
  language: 'Italiano',
  links: {},
  ingest: [],
  active: true,
};

describe('parseJsonLdEvent, on Meetup', () => {
  const html = fixture('meetup-event.html');
  const url = 'https://www.meetup.com/global-ai-catania/events/313630893/';

  it('reads the event Meetup publishes as JSON-LD', () => {
    const event = parseJsonLdEvent(html, url, community)!;

    expect(event.title).toBe('Global AI Catania Launch Meetup + MCP SDK per C#');
    expect(event.start).toBe('2026-03-18T18:30:00+01:00');
    expect(event.end).toBe('2026-03-18T20:30:00+01:00');
    expect(event.url).toBe(url);
    expect(event.online).toBe(false);
    expect(event.cancelled).toBe(false);
  });

  it('keeps the venue with its street address, so the geocoder has something real', () => {
    const event = parseJsonLdEvent(html, url, community)!;

    expect(event.venue?.name).toBe('Paradigma SpA');
    expect(event.venue?.address).toBe('viale Africa 31, Catania, CT');
    expect(event.venue?.city).toBe('Catania');
  });

  it('takes the community\'s categories and language, which the markup does not carry', () => {
    const event = parseJsonLdEvent(html, url, community)!;

    expect(event.categories).toEqual(['tech']);
    expect(event.language).toBe('Italiano');
  });
});

describe('parseJsonLdEvent, on Eventbrite', () => {
  const html = fixture('eventbrite-event.html');
  const url = 'https://www.eventbrite.it/e/registrazione-tech-drinks-catania-1989225068729';

  /**
   * The reason this adapter exists in the shape it does. Eventbrite types every
   * event `SocialEvent`; an adapter matching the bare `Event` type finds
   * nothing here and concludes, wrongly, that the page carries no markup.
   */
  it('recognises SocialEvent, not just Event', () => {
    const node = findEvent(html)!;

    expect(node['@type']).toBe('SocialEvent');
    expect(parseJsonLdEvent(html, url, community)?.title).toBe('Tech Drinks @Catania');
  });

  it('reads dates with their offset and the venue address', () => {
    const event = parseJsonLdEvent(html, url, community)!;

    expect(event.start).toBe('2026-06-10T18:30:00+02:00');
    expect(event.venue?.name).toBe('Le Village by Ca Sicilia');
    expect(event.venue?.address).toBe('58 Via Ursino, 95131 Catania');
  });
});

describe('eventId', () => {
  it('derives a stable id from the numeric id in the URL', () => {
    expect(eventId('https://www.meetup.com/global-ai-catania/events/313630893/')).toBe(
      'jsonld:meetup:313630893'
    );
    expect(
      eventId('https://www.eventbrite.it/e/registrazione-tech-drinks-catania-1989225068729')
    ).toBe('jsonld:eventbrite:1989225068729');
  });

  /** A title-derived id would move the day an organiser fixes a typo. */
  it('does not change when the slug around the id changes', () => {
    expect(eventId('https://www.meetup.com/global-ai-catania/events/313630893/')).toBe(
      eventId('https://www.meetup.com/global-ai-catania/events/313630893/?utm_source=x')
    );
  });

  it('falls back to the URL for a host with no numeric id', () => {
    expect(eventId('https://example.org/eventi/serata-python')).toBe(
      'jsonld:example-org-eventi-serata-python'
    );
  });
});

describe('toIsoWithOffset', () => {
  it('keeps a timestamp that already carries an offset', () => {
    expect(toIsoWithOffset('2026-03-18T18:30:00+01:00')).toBe('2026-03-18T18:30:00+01:00');
  });

  it('reads a floating time as Italian local time, with the right DST offset', () => {
    // March is still CET, June is CEST: the offset is computed per date.
    expect(toIsoWithOffset('2026-03-18T18:30')).toBe('2026-03-18T18:30:00+01:00');
    expect(toIsoWithOffset('2026-06-10T18:30')).toBe('2026-06-10T18:30:00+02:00');
  });

  it('puts a date without a time at local midnight, not at 02:00', () => {
    expect(toIsoWithOffset('2026-06-10')).toBe('2026-06-10T00:00:00+02:00');
  });

  it('returns nothing for what it cannot read', () => {
    expect(toIsoWithOffset('prossimamente')).toBeUndefined();
    expect(toIsoWithOffset(undefined)).toBeUndefined();
    expect(toIsoWithOffset('')).toBeUndefined();
  });
});

/**
 * Both platforms cut the description themselves, around 150 characters and in
 * the middle of a word. We cannot recover the rest, only stop it rendering as
 * though we had mangled it.
 */
describe('markIfCut', () => {
  it('drops the half word Meetup left behind and marks the cut', () => {
    // Exactly what the 2025-07-17 Python Catania event serves.
    expect(markIfCut('la community si incontra alla ricerca di un poco di fre')).toBe(
      'la community si incontra alla ricerca di un poco di…'
    );
  });

  it('leaves a description that ends on punctuation alone', () => {
    expect(markIfCut('Un meetup per parlare di Python.')).toBe('Un meetup per parlare di Python.');
    expect(markIfCut('Che tu sia esperto o alle prime armi!')).toBe(
      'Che tu sia esperto o alle prime armi!'
    );
  });

  it('leaves an emoji ending alone, which is how they often close a line', () => {
    expect(markIfCut('per condividere del buon codice sorgente. ❤️🐘🐍')).toBe(
      'per condividere del buon codice sorgente. ❤️🐘🐍'
    );
  });

  it('does not eat a single long word, which would leave nothing', () => {
    expect(markIfCut('Supercalifragilisticoespiralidoso')).toBe('Supercalifragilisticoespiralidoso…');
  });

  /**
   * Ending on a comma or a dangling markdown marker is still a cut, but every
   * word is whole: dropping the last one here would lose real text.
   */
  it('keeps the whole last word when the cut landed on a separator', () => {
    expect(markIfCut('per condividere novità,')).toBe('per condividere novità…');
    expect(markIfCut('un nuovo meetup della community *')).toBe(
      'un nuovo meetup della community…'
    );
  });

  /** Dropping "in" from "meetup, in" must not leave the comma hanging. */
  it('does not strand a separator once the half word is dropped', () => {
    expect(markIfCut('il tempo per organizzare un nuovo meetup, in')).toBe(
      'il tempo per organizzare un nuovo meetup…'
    );
  });
});

describe('jsonLdBlocks', () => {
  it('skips a malformed block instead of failing the whole page', () => {
    const html =
      '<script type="application/ld+json">{ not json </script>' +
      '<script type="application/ld+json">{"@type":"Event","name":"ok"}</script>';

    expect(jsonLdBlocks(html)).toEqual([{ '@type': 'Event', name: 'ok' }]);
  });

  it('finds an Event nested inside @graph', () => {
    const html =
      '<script type="application/ld+json">' +
      '{"@graph":[{"@type":"WebPage"},{"@type":"Event","name":"nel grafo","startDate":"2026-06-10T18:30:00+02:00"}]}' +
      '</script>';

    expect(findEvent(html)?.name).toBe('nel grafo');
  });
});

/**
 * The hard part of this adapter. A listing page with no events and a listing
 * page whose layout changed look identical from the outside — both yield zero
 * links — and confusing them either empties a community in silence or files a
 * failure issue every quiet month.
 */
describe('discovery: telling "nothing scheduled" apart from "broken"', () => {
  const recognisable = (html: string) =>
    /"@type"\s*:\s*"Organization"/.test(html) && /"@type"\s*:\s*"BreadcrumbList"/.test(html);

  const meetupUrls = (html: string) => {
    const seen = new Set<string>();
    for (const [, group, id] of html.matchAll(/\/([a-z0-9-]+)\/events\/(\d{6,})/gi)) {
      seen.add(`https://www.meetup.com/${group}/events/${id}/`);
    }
    return [...seen];
  };

  it('finds every event on a populated listing page', () => {
    const urls = meetupUrls(fixture('meetup-list.html'));

    expect(urls).toHaveLength(10);
    expect(urls).toContain('https://www.meetup.com/python-catania/events/302671524/');
  });

  it('accepts an empty listing page as genuinely empty, because it still looks right', () => {
    const html = fixture('meetup-list-empty.html');

    expect(recognisable(html)).toBe(true);
    expect(meetupUrls(html)).toHaveLength(0);
  });

  it('refuses a page that lost its markers, rather than reporting no events', () => {
    expect(recognisable(fixture('meetup-list-broken.html'))).toBe(false);
  });
});