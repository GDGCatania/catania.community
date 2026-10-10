/**
 * Site-wide constants derived from the root config.
 *
 * Kept in one place so a fork only edits `site.config.ts` at the project root.
 */
import cfg from '../../site.config';

export const SITE_NAME = cfg.name;
export const SITE_URL = cfg.url;
export const REPO_URL = cfg.repo;

/**
 * The original project, credited in the footer of every instance. Not in
 * `site.config.ts` on purpose: a fork links its own code via `repo`, and
 * still points here for where the software comes from.
 */
export const UPSTREAM_REPO_URL = 'https://github.com/GDGCatania/catania.community';

/** Timezone the events are published in. */
export const TIMEZONE = cfg.timezone;

/** Default city name (fallback for schema.org, meta tags, etc.). */
export const DEFAULT_CITY = cfg.city;

/** ISO 3166-2 region code. */
export const DEFAULT_REGION = cfg.region;

/** ISO 3166-1 alpha-2 country code. */
export const DEFAULT_COUNTRY = cfg.country;

/** Full country name (for geocoding free-text queries). */
export const COUNTRY_NAME = cfg.countryName;

/** Default event/community language label. */
export const DEFAULT_LANGUAGE = cfg.defaultLanguage;

/** BCP 47 code of the default language, also used for geocoding. */
export const DEFAULT_LANGUAGE_CODE = cfg.defaultLanguageCode;

/** Default currency code. */
export const DEFAULT_CURRENCY = cfg.currency;

/** Map defaults. */
export const MAP_CENTER = cfg.map.center;
export const MAP_ZOOM = cfg.map.zoom;

/** Placeholder example for the submit form. */
export const EXAMPLE_COMMUNITY_NAME = cfg.exampleCommunityName;

/** Where the submit form posts; `null` means GitHub only. */
export const SUBMIT_ENDPOINT = cfg.submitEndpoint;

/** Default social preview image, or `null` for none. */
export const DEFAULT_OG_IMAGE = cfg.ogImage;

/** Bare hostname, for identifiers such as iCal UIDs. */
export const SITE_HOST = new URL(cfg.url).host;

// ── Branding copy ──────────────────────────────────────────────────────────

export const HEADLINE = cfg.headline;
export const HEADLINE_ACCENT = cfg.headlineAccent;
export const META_DESCRIPTION = cfg.metaDescription;
export const FEED_TITLE = cfg.feedTitle;
export const FEED_DESCRIPTION = cfg.feedDescription;
export const FOOTER_ABOUT = cfg.footerAbout;

/** Home meta description with the event count filled in. */
export function metaDescriptionForCount(count: number): string {
  return cfg.metaDescriptionWithCount.replace('{count}', String(count));
}

/** Internal routes. English slugs, one set — the site ships in one language. */
export const ROUTES = {
  home: '/',
  events: '/events',
  event: (slug: string) => `/events/${slug}`,
  eventIcs: (slug: string) => `/events/${slug}.ics`,
  communities: '/communities',
  community: (id: string) => `/communities/${id}`,
  submit: '/submit',
  submitEvent: '/submit/event',
  howItWorks: '/how-it-works',
  feedIcs: '/events.ics',
  feedRss: '/events.xml',
  feedJson: '/events.json',
} as const;

/** GitHub issue labels, also the names of the Issue Form templates. */
export const ISSUE_LABELS = cfg.issueLabels;

/**
 * A pre-filled Issue Form. `fields` are keyed by the field `id` in the
 * template; GitHub ignores the ones it cannot pre-fill.
 */
export function issueFormUrl(
  label: string,
  title: string,
  fields: Record<string, string> = {}
): string {
  const url = new URL(`${REPO_URL}/issues/new`);
  url.searchParams.set('template', `${label}.yml`);
  url.searchParams.set('labels', label);
  url.searchParams.set('title', title);
  for (const [id, value] of Object.entries(fields)) if (value) url.searchParams.set(id, value);
  return url.href;
}

/** Issue titles match the `title:` prefix of their template. */
export const ISSUE_TITLES = {
  newCommunity: (name = '') => `New community: ${name}`,
  newEvent: (title = '') => `New event: ${title}`,
  correction: (subject = '') => `Correction: ${subject}`,
} as const;

export const ISSUE_URLS = {
  newCommunity: issueFormUrl(cfg.issueLabels.newCommunity, ISSUE_TITLES.newCommunity()),
  newEvent: issueFormUrl(cfg.issueLabels.newEvent, ISSUE_TITLES.newEvent()),
  /** `page` pre-fills the "Affected page" field with the page being reported. */
  correction: (subject: string, page = '') =>
    issueFormUrl(cfg.issueLabels.correction, ISSUE_TITLES.correction(subject), { page }),
  all: `${REPO_URL}/issues`,
} as const;
