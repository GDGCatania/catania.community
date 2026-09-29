/**
 * Site configuration — the one source file a fork edits.
 *
 * Everything in the code that is specific to Catania lives here. The rest of
 * running an instance for another city (interface language, domain, issue
 * forms, data) is listed in the README, under "Run it for your city".
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

  /**
   * BCP 47 code of that same language. Used for `inLanguage` in schema.org and
   * for the language place names are requested in when geocoding, so it must
   * match how `city` is spelled. Independent of the interface language.
   */
  defaultLanguageCode: 'it',

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
   * The three keys are structural — the city itself, the rest of the
   * surrounding area, online — and `tools/ingest/normalize.ts` relies on them.
   * A fork keeps the keys and changes the labels (`area_<key>` in
   * `messages/*.json`).
   */
  areas: ['citta', 'provincia', 'online'] as const,

  /** GitHub issue labels used to build ISSUE_URLS. */
  issueLabels: {
    newCommunity: 'nuova-community',
    correction: 'correzione',
  },

  /** Placeholder example shown in the "add your community" form. */
  exampleCommunityName: 'GDG Catania',

  /**
   * Endpoint the "add your community" form posts to: a small service that
   * opens the GitHub issue on the sender's behalf. Set it to `null` and the
   * form sends people straight to GitHub with their answers pre-filled.
   */
  submitEndpoint: 'https://segnala.catania.community/submit' as string | null,

  /**
   * Default social preview image (1200×630), a path under `public/`. `null`
   * omits `og:image` on pages that have no image of their own.
   */
  ogImage: null as string | null,

  // ── Branding copy ──────────────────────────────────────────────────────
  // The editorial voice of this specific instance. A fork rewrites these
  // in its own language — they are not run through i18n because they are
  // the *identity* of the site, not translatable interface labels.

  /** Main headline on the home page. */
  headline: 'Tutte le community tech di Catania.',

  /** Second line of the headline, rendered with accent colour. */
  headlineAccent: 'Un solo calendario.',

  /** `<meta name="description">` when there are no upcoming events. */
  metaDescription:
    'Gli eventi delle community di Catania e provincia, raccolti in una pagina sola.',

  /**
   * `<meta name="description">` when there are upcoming events.
   * `{count}` is replaced at build time with the actual number.
   */
  metaDescriptionWithCount:
    '{count} eventi in arrivo dalle community di Catania e provincia: meetup, workshop e incontri. Aggiornato automaticamente.',

  /** Title of the RSS and iCal feeds. */
  feedTitle: 'Eventi delle community di Catania',

  /** Description shown in RSS readers. */
  feedDescription:
    'Meetup, workshop e incontri delle community di Catania e provincia.',

  /** Short paragraph in the footer explaining what the site does. */
  footerAbout:
    'Agenda delle community di Catania e provincia. Facciamo da specchio: iscrizioni e biglietti restano sulle piattaforme di chi organizza.',
} as const;

export default config;

// ── Derived types ──────────────────────────────────────────────────────────
// These are re-exported so that `schema.ts` and the rest of the codebase can
// refer to the configured values without importing the config directly.

export type SiteConfig = typeof config;
export type CategoryKey = SiteConfig['categories'][number];
export type AreaKey = SiteConfig['areas'][number];
