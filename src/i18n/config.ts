import type { Locale } from './index';

/**
 * The language the site is built in.
 *
 * Change this line, rebuild, and the whole interface comes out in the other
 * language: there is no runtime switching and no locale segment in the URLs,
 * so exactly one language ships at a time.
 *
 * Adding a language means adding a dictionary next to `it.ts` and `en.ts` and
 * registering it in `index.ts`. The dictionaries are typed against each other,
 * so a missing key is a build error, not a blank label in production.
 *
 * What is *not* translated: event titles, descriptions and venue names. Those
 * come from the communities that published them and stay in their own language
 * — translating them automatically would misrepresent what they wrote.
 */
export const SITE_LOCALE: Locale = 'it';
