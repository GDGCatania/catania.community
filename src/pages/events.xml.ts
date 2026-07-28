import type { APIRoute } from 'astro';
import { getCommunityMap, getUpcomingEvents, formatDateLong, formatTime } from '../lib/events';

import { SITE_URL, ROUTES } from '../lib/site';
import { localeTag, t } from '../i18n';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RSS feed of the upcoming events. */
export const GET: APIRoute = async () => {
  const [events, communities] = await Promise.all([getUpcomingEvents(), getCommunityMap()]);

  const items = events
    .map((event) => {
      const community = communities.get(event.communityId);
      const where = event.online
        ? t('status.online')
        : [event.venue?.name, event.venue?.city].filter(Boolean).join(', ');

      const summary = [
        t('feed.at', { date: formatDateLong(event.start), time: formatTime(event.start) }),
        where ? t('feed.where', { place: where }) : null,
        community ? t('feed.organiser', { name: community.name }) : null,
        event.description,
      ]
        .filter(Boolean)
        .join('\n\n');

      return [
        '    <item>',
        `      <title>${escapeXml(event.title)}</title>`,
        `      <link>${SITE_URL}${ROUTES.event(event.slug)}</link>`,
        `      <guid isPermaLink="true">${SITE_URL}${ROUTES.event(event.slug)}</guid>`,
        `      <pubDate>${new Date(event.start).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(summary)}</description>`,
        ...event.categories.map((c) => `      <category>${escapeXml(c)}</category>`),
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(t('feed.rssTitle'))}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(t('feed.rssDescription'))}</description>
    <language>${localeTag}</language>
    <atom:link href="${SITE_URL}${ROUTES.feedRss}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
