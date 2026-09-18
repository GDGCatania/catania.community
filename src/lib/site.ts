/**
 * Site-wide constants derived from the root config.
 *
 * Kept in one place so a fork only edits `site.config.ts` at the project root.
 */
import cfg from '../../site.config';

export const SITE_NAME = cfg.name;
export const SITE_URL = cfg.url;
export const REPO_URL = cfg.repo;

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

/** Default currency code. */
export const DEFAULT_CURRENCY = cfg.currency;

/** Map defaults. */
export const MAP_CENTER = cfg.map.center;
export const MAP_ZOOM = cfg.map.zoom;

/** Placeholder example for the submit form. */
export const EXAMPLE_COMMUNITY_NAME = cfg.exampleCommunityName;

/** Internal routes. English slugs, one set — the site ships in one language. */
export const ROUTES = {
  home: '/',
  events: '/events',
  event: (slug: string) => `/events/${slug}`,
  eventIcs: (slug: string) => `/events/${slug}.ics`,
  communities: '/communities',
  community: (id: string) => `/communities/${id}`,
  submit: '/submit',
  feedIcs: '/events.ics',
  feedRss: '/events.xml',
  feedJson: '/events.json',
} as const;

export const ISSUE_URLS = {
  newCommunity: `${REPO_URL}/issues/new?labels=${encodeURIComponent(cfg.issueLabels.newCommunity)}&template=${encodeURIComponent(cfg.issueLabels.newCommunity)}.yml`,
  correction: (title: string) =>
    `${REPO_URL}/issues/new?labels=${encodeURIComponent(cfg.issueLabels.correction)}&title=${encodeURIComponent(title)}`,
  all: `${REPO_URL}/issues`,
} as const;
