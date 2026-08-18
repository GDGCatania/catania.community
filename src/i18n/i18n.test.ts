import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as m from '../paraglide/messages.js';
import { locales } from '../paraglide/runtime.js';

const ROOT = path.resolve(process.cwd(), 'messages');

type Variant = { declarations?: string[]; selectors?: string[]; match: Record<string, string> };
type Message = string | Variant[];

function load(locale: string): Record<string, Message> {
  return JSON.parse(readFileSync(path.join(ROOT, `${locale}.json`), 'utf8'));
}

const dictionaries = Object.fromEntries(locales.map((locale) => [locale, load(locale)]));

/** Every string a message can produce, variants flattened. */
function patterns(message: Message): string[] {
  return typeof message === 'string' ? [message] : message.flatMap((v) => Object.values(v.match));
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{([a-zA-Z][\w]*)\}/g)].map((match) => match[1]).sort();

const linkTargets = (text: string) =>
  [...text.matchAll(/\{#\w+\s+to=\$(\w+)/g)].map((match) => match[1]).sort();

describe('message files', () => {
  test('every locale defines the same messages', () => {
    const [reference, ...rest] = locales;
    for (const locale of rest) {
      expect(Object.keys(dictionaries[locale]!).sort(), `keys differ in ${locale}.json`).toEqual(
        Object.keys(dictionaries[reference!]!).sort()
      );
    }
  });

  test('no message is left empty', () => {
    for (const locale of locales) {
      for (const [key, message] of Object.entries(dictionaries[locale]!)) {
        for (const pattern of patterns(message)) {
          expect(pattern.trim(), `empty pattern for ${key} in ${locale}.json`).not.toBe('');
        }
      }
    }
  });

  test('placeholders match across locales', () => {
    const [reference, ...rest] = locales;
    for (const key of Object.keys(dictionaries[reference!]!)) {
      const expected = patterns(dictionaries[reference!]![key]!).flatMap(placeholders).sort();
      for (const locale of rest) {
        const actual = patterns(dictionaries[locale]![key]!).flatMap(placeholders).sort();
        expect(new Set(actual), `placeholder mismatch on ${key} in ${locale}.json`).toEqual(
          new Set(expected)
        );
      }
    }
  });

  test('inline links match across locales', () => {
    const [reference, ...rest] = locales;
    for (const key of Object.keys(dictionaries[reference!]!)) {
      const expected = patterns(dictionaries[reference!]![key]!).flatMap(linkTargets).sort();
      for (const locale of rest) {
        const actual = patterns(dictionaries[locale]![key]!).flatMap(linkTargets).sort();
        expect(actual, `link mismatch on ${key} in ${locale}.json`).toEqual(expected);
      }
    }
  });

  test('plural messages cover the same categories in every locale', () => {
    const [reference, ...rest] = locales;
    for (const [key, message] of Object.entries(dictionaries[reference!]!)) {
      if (typeof message === 'string') continue;
      const expected = message.flatMap((v) => Object.keys(v.match)).sort();
      for (const locale of rest) {
        const other = dictionaries[locale]![key]!;
        expect(typeof other, `${key} is a variant in ${reference} but not in ${locale}`).not.toBe(
          'string'
        );
        const actual = (other as Variant[]).flatMap((v) => Object.keys(v.match)).sort();
        expect(actual, `plural categories differ on ${key} in ${locale}.json`).toEqual(expected);
      }
    }
  });
});

describe('compiled messages', () => {
  test('plural forms come from Intl.PluralRules, not a hand-rolled check', () => {
    expect(m.event_count({ count: 1 })).toBe('1 evento');
    expect(m.event_count({ count: 0 })).toBe('0 eventi');
    expect(m.event_count({ count: 7 })).toBe('7 eventi');
    expect(m.event_seatsLeft({ count: 1 })).toBe('1 posto rimasto');
  });

  test('numbers are formatted for the locale', () => {
    // Italian groups only from five digits: 1240 stays bare, 12400 gets a dot.
    expect(m.communities_members({ count: 1240 })).toBe('1240 iscritti');
    expect(m.communities_members({ count: 12400 })).toBe('12.400 iscritti');
  });

  test('a sentence with inline links exposes its parts with resolved targets', () => {
    const parts = m.footer_license.parts({
      code: 'https://example.org/code',
      data: 'https://example.org/data',
      osm: 'https://example.org/osm',
    });

    const targets = parts
      .filter((part) => part.type === 'markup-start')
      .map((part) => (part as { options?: Record<string, unknown> }).options?.to);

    expect(targets).toEqual([
      'https://example.org/code',
      'https://example.org/data',
      'https://example.org/osm',
    ]);
  });

  test('the same sentence read as plain text drops the markup', () => {
    const text = m.footer_license({ code: 'a', data: 'b', osm: 'c' });

    expect(text).toContain('AGPL-3.0');
    expect(text).not.toContain('{#link');
  });
});