import { baseLocale, locales } from '../paraglide/runtime.js';


export { baseLocale as locale, locales };

const INTL_TAGS: Record<string, string> = {
  it: 'it-IT',
  en: 'en-GB',
};

export const localeTag: string = INTL_TAGS[baseLocale] ?? baseLocale;

export const LOCALE_NAMES: Record<string, string> = {
  it: 'Italiano',
  en: 'English',
};