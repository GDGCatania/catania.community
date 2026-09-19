/**
 * Site configuration — the ONE file a fork edits.
 *
 * Everything that is specific to Catania lives here. A fork for another city
 * changes this file and `messages/*.json` (for the UI strings) and is done.
 *
 * Domain vocabulary keys (categories, areas) stay lowercase-ASCII because they
 * double as URL segments and YAML keys. Their human-readable labels live in
 * the i18n layer (`messages/*.json` + `src/i18n/labels.ts`).
 */

const config = {
  /** Display name, used in attribution and fallback meta. */
  name: 'catania.community',

  /** Production URL, no trailing slash. */
  url: 'https://catania.community',

  /** GitHub (or similar) repository URL. */
  repo: 'https://github.com/GDGCatania/catania.community',

  /** IANA timezone for event dates. */
  timezone: 'Europe/Rome',

  /** Default city name, used as fallback in schema.org and meta tags. */
  city: 'Catania',

  /** ISO 3166-2 region code (e.g. 'CT' for Catania, 'MI' for Milano). */
  region: 'CT',

  /** ISO 3166-1 alpha-2 country code. */
  country: 'IT',

  /** Full country name, used in geocoding queries (Nominatim free-text search). */
  countryName: 'Italia',

  /** Default event/community language (human-readable label). */
  defaultLanguage: 'Italiano',

  /** Default currency ISO 4217 code. */
  currency: 'EUR',

  /**
   * Loose bounding box for coordinate validation.
   * Catches swapped lat/lon pairs and geocoding that wandered off to another
   * country entirely.
   */
  boundingBox: {
    lat: { min: 36.5, max: 38.5 },
    lon: { min: 14.0, max: 15.8 },
  },

  /** Default map centre and zoom level. */
  map: {
    center: [37.5079, 15.083] as [number, number],
    zoom: 13,
  },

  /**
   * Domain vocabulary: the set of thematic categories.
   * Must match the keys used in `messages/*.json` (`category_<key>`) and in
   * `src/i18n/labels.ts`.
   */
  categories: ['tech', 'design', 'impresa', 'cultura', 'sociale'] as const,

  /**
   * Domain vocabulary: geographic area buckets.
   * Must match the keys used in `messages/*.json` (`area_<key>`) and in
   * `src/i18n/labels.ts`.
   */
  areas: ['citta', 'provincia', 'online'] as const,

  /** GitHub issue labels used to build ISSUE_URLS. */
  issueLabels: {
    newCommunity: 'nuova-community',
    correction: 'correzione',
  },

  /** Placeholder example shown in the "add your community" form. */
  exampleCommunityName: 'GDG Catania',
} as const;

export default config;

// ── Derived types ──────────────────────────────────────────────────────────
// These are re-exported so that `schema.ts` and the rest of the codebase can
// refer to the configured values without importing the config directly.

export type SiteConfig = typeof config;
export type CategoryKey = SiteConfig['categories'][number];
export type AreaKey = SiteConfig['areas'][number];
