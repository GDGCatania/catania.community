import { it, type TranslationKey } from './it';
import { en } from './en';
import { SITE_LOCALE } from './config';

/**
 * Translation layer, resolved entirely at build time.
 *
 * The site ships in one language — the one set in `config.ts`. Nothing about
 * i18n reaches the browser: `t()` runs during the build and what lands in the
 * HTML is plain text in a single language, which is also what makes the pages
 * cleanly indexable.
 */

export const LOCALES = ['it', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const DICTIONARIES = { it, en } satisfies Record<Locale, Record<TranslationKey, string>>;

export const LOCALE_NAMES: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
};

/** BCP 47 tags, used for `<html lang>` and every `Intl` formatter. */
export const LOCALE_TAGS: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-GB',
};

export type { TranslationKey };

/** Fills `{name}` placeholders, leaving unknown ones visible rather than "undefined". */
export function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

/** A `t()` bound to a specific language. Useful in tests; pages import `t`. */
export function useTranslations(locale: Locale) {
  const dictionary = DICTIONARIES[locale];
  return (key: TranslationKey, values?: Record<string, string | number>): string =>
    interpolate(dictionary[key], values);
}

export type Translate = ReturnType<typeof useTranslations>;

/** The active language and its bound helpers — what components actually use. */
export const locale = SITE_LOCALE;
export const localeTag = LOCALE_TAGS[SITE_LOCALE];
export const t: Translate = useTranslations(SITE_LOCALE);
