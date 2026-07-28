/** Site-wide constants. Kept in one place so a fork only edits this file. */

export const SITE_URL = 'https://catania.community';
export const REPO_URL = 'https://github.com/raffb/catania.community';

/** Timezone the events are published in. */
export const TIMEZONE = 'Europe/Rome';

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
  newCommunity: `${REPO_URL}/issues/new?labels=nuova-community&template=nuova-community.yml`,
  correction: (title: string) =>
    `${REPO_URL}/issues/new?labels=correzione&title=${encodeURIComponent(title)}`,
  all: `${REPO_URL}/issues`,
} as const;
