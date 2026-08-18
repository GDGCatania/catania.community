import type { APIRoute } from 'astro';
import { getCommunityMap, getUpcomingEvents } from '../lib/events';
import { buildCalendar } from '../lib/ics';
import * as m from '../paraglide/messages.js';

/**
 * Subscribable calendar with every upcoming event.
 * Upcoming only: someone subscribing wants the agenda, not the archive.
 */
export const GET: APIRoute = async () => {
  const [events, communities] = await Promise.all([getUpcomingEvents(), getCommunityMap()]);

  return new Response(
    buildCalendar(events, communities, m.feed_calendarName()),
    {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
};
