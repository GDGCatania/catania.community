import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { stringify } from 'yaml';
import { buildCommunity, buildEvent, matchCommunity, parseIssueForm } from '../../issue-to-yaml.js';
import { CommunitySchema, type Community } from '../../../src/lib/schema.js';

const body = `### Community name

AperiTech #42 Catania

### In one line

Talk brevi e aperitivo: 100% pratica, 0% slide di vendita

### Topics

tech, design

### Where you usually meet

citta

### Where you publish your events

https://gdg.community.dev/gdg-catania/

### .ics feed, if you have one

_No response_

### Website

https://esempio.org

### Other contacts

https://t.me/esempio
https://www.instagram.com/esempio

### Confirmation

- [X] I understand that this data ends up in a public repository
`;

describe('parseIssueForm', () => {
  it('extracts the fields from the headings GitHub generates', () => {
    const fields = parseIssueForm(body);

    expect(fields['community name']).toBe('AperiTech #42 Catania');
    expect(fields['where you usually meet']).toBe('citta');
  });

  it('treats _No response_ as an empty field', () => {
    expect(parseIssueForm(body)['.ics feed, if you have one']).toBe('');
  });
});

describe('buildCommunity', () => {
  it('builds a valid community', () => {
    const community = buildCommunity(parseIssueForm(body));

    expect(community.id).toBe('aperitech-42-catania');
    expect(community.name).toBe('AperiTech #42 Catania');
    expect(community.categories).toEqual(['tech', 'design']);
    expect(community.area).toBe('citta');
  });

  it('recognises contacts by their domain', () => {
    const community = buildCommunity(parseIssueForm(body));

    expect(community.links).toMatchObject({
      website: 'https://esempio.org',
      telegram: 'https://t.me/esempio',
      instagram: 'https://www.instagram.com/esempio',
    });
  });

  it('proposes the bevy adapter for a gdg.community.dev link, chapter left blank', () => {
    const community = buildCommunity(parseIssueForm(body));
    const bevy = community.ingest.find((entry) => entry.type === 'bevy');

    expect(bevy).toBeDefined();
    expect(bevy?.chapter).toBe(0);
    expect(String(bevy?._todo)).toContain('gdg-catania');
  });

  it('prefers the ics adapter when a feed is given', () => {
    const withIcs = body.replace("_No response_", 'https://esempio.org/events.ics');
    const community = buildCommunity(parseIssueForm(withIcs));

    expect(community.ingest[0]).toEqual({ type: 'ics', url: 'https://esempio.org/events.ics' });
  });

  const withEventsUrl = (url: string) =>
    buildCommunity(parseIssueForm(body.replace('https://gdg.community.dev/gdg-catania/', url)));

  it('proposes jsonld for a Meetup group, pointing at its events tab', () => {
    expect(withEventsUrl('https://www.meetup.com/global-ai-catania/').ingest).toEqual([
      { type: 'jsonld', list: 'https://www.meetup.com/global-ai-catania/events/' },
    ]);
  });

  /**
   * Organisers paste whatever their browser was showing. A locale segment, the
   * events tab and a single event all identify the same group, so all three
   * have to reduce to the same listing page. `/it-it/` is the form that turned
   * up in practice.
   */
  it('reduces every shape of Meetup URL to the same listing page', () => {
    const expected = 'https://www.meetup.com/meetup-wordpress-catania/events/';

    for (const url of [
      'https://www.meetup.com/it-it/meetup-wordpress-catania/',
      'https://www.meetup.com/meetup-wordpress-catania/events/',
      'https://www.meetup.com/meetup-wordpress-catania/events/307840861/',
    ]) {
      expect(withEventsUrl(url).ingest).toEqual([{ type: 'jsonld', list: expected }]);
    }
  });

  it('reads an Eventbrite organiser as a listing and a single event as itself', () => {
    expect(withEventsUrl('https://www.eventbrite.it/o/shetech-6376818437').ingest).toEqual([
      { type: 'jsonld', list: 'https://www.eventbrite.it/o/shetech-6376818437' },
    ]);

    expect(withEventsUrl('https://www.eventbrite.it/e/tech-drinks-catania-1989225068729').ingest).toEqual(
      [{ type: 'jsonld', urls: ['https://www.eventbrite.it/e/tech-drinks-catania-1989225068729'] }]
    );
  });

  /** A Meetup search or directory page is not a group: it must not become a source. */
  it('does not mistake a Meetup directory page for a group', () => {
    expect(withEventsUrl('https://www.meetup.com/find/?keywords=python').ingest).toEqual([
      { type: 'manual' },
    ]);
  });

  it('falls back to manual when the platform cannot be read automatically', () => {
    // Facebook groups are the real case: no feed, no markup, nothing to read.
    expect(withEventsUrl('https://www.facebook.com/groups/remote.workers.ct/').ingest).toEqual([
      { type: 'manual' },
    ]);
  });

  it('rejects an issue with no name', () => {
    expect(() => buildCommunity({})).toThrow(/no community name/);
  });

  /**
   * The case that actually bit us: `title: AperiTech #42` written by hand
   * without quotes comes back as "AperiTech", because `#` opens a comment in
   * YAML. Hence stringify, never string concatenation.
   */
  it('serialises a name containing # to YAML without losing data', () => {
    const community = buildCommunity(parseIssueForm(body));
    const roundTrip = parse(stringify(community)) as { name: string };

    expect(roundTrip.name).toBe('AperiTech #42 Catania');
  });
});

const communities: Community[] = [
  CommunitySchema.parse({
    id: 'gdg-catania',
    name: 'GDG Catania',
    categories: ['tech'],
    area: 'citta',
    links: { website: 'https://gdg.community.dev/gdg-catania/' },
  }),
  CommunitySchema.parse({
    id: 'python-catania',
    name: 'Python Catania',
    categories: ['tech'],
    area: 'citta',
  }),
];

const eventBody = (overrides: Record<string, string> = {}) => {
  const fields: Record<string, string> = {
    'Event title': 'Hack #3: Etna Edition',
    'Organising community': 'GDG Catania',
    'Community website, if it is not listed yet': '_No response_',
    Date: '2026-11-14',
    'Start time': '18:30',
    'End time': '21:00',
    'Event page': 'https://example.org/hack-3',
    'Venue name': 'Impact Hub',
    Address: 'Via Example 1, Catania',
    Online: 'no',
    Price: 'free',
    Topics: '_No response_',
    Description: '_No response_',
    Confirmation: '- [X] I understand',
    ...overrides,
  };
  return Object.entries(fields)
    .map(([label, value]) => `### ${label}\n\n${value}`)
    .join('\n\n');
};

const event = (overrides: Record<string, string> = {}) =>
  buildEvent(parseIssueForm(eventBody(overrides)), communities);

describe('matchCommunity', () => {
  it('matches by slug, by name and by a page of this site', () => {
    expect(matchCommunity('gdg-catania', communities)?.id).toBe('gdg-catania');
    expect(matchCommunity('  gdg catania ', communities)?.id).toBe('gdg-catania');
    expect(
      matchCommunity('https://catania.community/communities/python-catania', communities)?.id
    ).toBe('python-catania');
  });

  it("matches by one of the community's own links, whatever the trailing slash or www", () => {
    expect(matchCommunity('https://www.gdg.community.dev/gdg-catania', communities)?.id).toBe(
      'gdg-catania'
    );
  });

  it('does not guess', () => {
    expect(matchCommunity('GDG', communities)).toBeUndefined();
    expect(matchCommunity('https://example.org/', communities)).toBeUndefined();
  });
});

describe('buildEvent', () => {
  it('builds a valid event for a listed community', () => {
    const built = event();

    expect(built.community).toBeUndefined();
    expect(built.file).toBe('2026-11-14-hack-3-etna-edition.yml');
    expect(built.event).toMatchObject({
      title: 'Hack #3: Etna Edition',
      communityId: 'gdg-catania',
      url: 'https://example.org/hack-3',
      venue: { name: 'Impact Hub', address: 'Via Example 1, Catania' },
      online: false,
      price: { type: 'free' },
    });
    // No topics given: the event inherits the community's at ingest.
    expect(built.event).not.toHaveProperty('categories');
  });

  /** The offset is the one in force on the event's date, never asked to the reporter. */
  it('writes the local time with the summer or winter offset of that date', () => {
    expect(event().event.start).toBe('2026-11-14T18:30:00+01:00');
    expect(event({ Date: '2026-07-14' }).event.start).toBe('2026-07-14T18:30:00+02:00');
    expect(event().event.end).toBe('2026-11-14T21:00:00+01:00');
  });

  it('accepts 18.30 as well as 18:30', () => {
    expect(event({ 'Start time': '9.05' }).event.start).toBe('2026-11-14T09:05:00+01:00');
  });

  it('rejects a malformed date or time with a message the reporter can act on', () => {
    expect(() => event({ Date: '14/11/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => event({ Date: '2026-02-30' })).toThrow(/YYYY-MM-DD/);
    expect(() => event({ 'Start time': '25:00' })).toThrow(/HH:MM/);
  });

  it('rejects an event that ends before it starts', () => {
    expect(() => event({ 'End time': '17:00' })).toThrow(/before it starts/);
  });

  it('reads online, the price and the topics', () => {
    const built = event({
      Online: 'yes',
      Price: 'donation',
      Topics: 'design, sociale',
      'Venue name': '_No response_',
      Address: '_No response_',
    });

    expect(built.event.online).toBe(true);
    expect(built.event.price).toEqual({ type: 'donation' });
    expect(built.event.categories).toEqual(['design', 'sociale']);
    expect(built.event).not.toHaveProperty('venue');
  });

  it('adds a community that is not listed yet when its website is given', () => {
    const built = event({
      'Organising community': 'Etna Hackers',
      'Community website, if it is not listed yet': 'https://etnahackers.example.org',
    });

    expect(built.community).toMatchObject({
      id: 'etna-hackers',
      name: 'Etna Hackers',
      links: { website: 'https://etnahackers.example.org' },
      ingest: [{ type: 'manual' }],
    });
    expect(built.event.communityId).toBe('etna-hackers');
  });

  it('fails rather than guess when the community is unknown and has no website', () => {
    expect(() => event({ 'Organising community': 'Etna Hackers' })).toThrow(/No community/);
  });

  it('serialises a title containing # to YAML without losing data', () => {
    const roundTrip = parse(stringify([event().event])) as Array<{ title: string }>;

    expect(roundTrip[0]?.title).toBe('Hack #3: Etna Edition');
  });
});
