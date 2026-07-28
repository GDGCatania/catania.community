import type { APIRoute, GetStaticPaths } from 'astro';
import { getAllEvents, getCommunityMap } from '../../lib/events';
import { buildCalendar } from '../../lib/ics';
import type { Community, Event } from '../../lib/schema';

/** One .ics per event, behind the "add to calendar" button. */
export const getStaticPaths = (async () => {
  const [events, communities] = await Promise.all([getAllEvents(), getCommunityMap()]);

  return events.map((event) => ({
    params: { slug: event.slug },
    props: { event, community: communities.get(event.communityId) },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { event, community } = props as { event: Event; community?: Community };

  const communities = new Map<string, Community>();
  if (community) communities.set(community.id, community);

  return new Response(buildCalendar([event], communities, event.title), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
    },
  });
};
