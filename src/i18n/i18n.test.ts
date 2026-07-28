import { describe, expect, test } from 'vitest';
import { it as italian } from './it';
import { en } from './en';
import { interpolate, useTranslations, LOCALES, LOCALE_TAGS } from './index';

describe('dictionaries', () => {
  test('English covers every Italian key', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(italian).sort());
  });

  /**
   * An empty string is almost always a forgotten translation. The one honest
   * exception is a fragment that a language simply does not need: Italian says
   * "Mappe © collaboratori OpenStreetMap", English "Maps © OpenStreetMap
   * contributors", so the trailing fragment exists only in English.
   */
  const MAY_BE_EMPTY = new Set(['footer.licenseMapsSuffix']);

  test('no entry is left empty by accident', () => {
    for (const [key, value] of Object.entries({ ...italian, ...en })) {
      if (MAY_BE_EMPTY.has(key)) continue;
      expect(value.trim(), `empty value for ${key}`).not.toBe('');
    }
  });

  /**
   * A placeholder that exists in one language but not the other means a number
   * or a name silently disappears from the page once the site is rebuilt in
   * that language. The type checker cannot catch it, so this test does.
   */
  test('placeholders match across languages', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    for (const key of Object.keys(italian) as Array<keyof typeof italian>) {
      expect(placeholders(en[key]), `placeholder mismatch on ${key}`).toEqual(
        placeholders(italian[key])
      );
    }
  });

  test('every locale has a BCP 47 tag for Intl', () => {
    for (const code of LOCALES) {
      expect(LOCALE_TAGS[code]).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      // Throws on an invalid tag, which is the point of the assertion.
      expect(() => new Intl.DateTimeFormat(LOCALE_TAGS[code])).not.toThrow();
    }
  });
});

describe('useTranslations', () => {
  test('returns the string for the requested language', () => {
    expect(useTranslations('it')('nav.events')).toBe('Eventi');
    expect(useTranslations('en')('nav.events')).toBe('Events');
  });

  test('substitutes placeholders', () => {
    expect(useTranslations('en')('event.seatsLeft', { count: 12 })).toBe('12 seats left');
    expect(useTranslations('it')('event.seatsLeft', { count: 12 })).toBe('12 posti rimasti');
  });

  test('leaves an unknown placeholder visible instead of printing "undefined"', () => {
    expect(interpolate('{count} seats left', {})).toBe('{count} seats left');
  });

  test('the whole interface resolves in both languages', () => {
    // Guards against a key that exists but blows up when interpolated.
    for (const code of LOCALES) {
      const translate = useTranslations(code);
      for (const key of Object.keys(italian) as Array<keyof typeof italian>) {
        expect(typeof translate(key)).toBe('string');
      }
    }
  });
});
