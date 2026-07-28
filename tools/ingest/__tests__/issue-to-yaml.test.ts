import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { stringify } from 'yaml';
import { buildCommunity, parseIssueForm } from '../../issue-to-yaml.js';

const body = `### Nome della community

AperiTech #42 Catania

### In una riga

Talk brevi e aperitivo: 100% pratica, 0% slide di vendita

### Argomenti

tech, design

### Dove vi trovate di solito

citta

### Dove pubblicate gli eventi

https://gdg.community.dev/gdg-catania/

### Feed .ics, se ce l'avete

_No response_

### Sito

https://esempio.org

### Altri contatti

https://t.me/esempio
https://www.instagram.com/esempio

### Conferma

- [X] So che i dati inseriti finiscono in un repository pubblico
`;

describe('parseIssueForm', () => {
  it('extracts the fields from the headings GitHub generates', () => {
    const fields = parseIssueForm(body);

    expect(fields['nome della community']).toBe('AperiTech #42 Catania');
    expect(fields['dove vi trovate di solito']).toBe('citta');
  });

  it('treats _No response_ as an empty field', () => {
    expect(parseIssueForm(body)["feed .ics, se ce l'avete"]).toBe('');
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

  it('falls back to manual when the platform cannot be read automatically', () => {
    const meetup = body.replace('https://gdg.community.dev/gdg-catania/', 'https://www.meetup.com/qualcosa/');
    const community = buildCommunity(parseIssueForm(meetup));

    expect(community.ingest).toEqual([{ type: 'manual' }]);
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
