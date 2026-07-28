import type { APIRoute } from 'astro';
import { getCommunities, getUpcomingEvents } from '../lib/events';
import { REPO_URL } from '../lib/site';

/**
 * Raw JSON, under the same ODbL licence as the rest of `data/`.
 * For anyone who wants to reuse the agenda elsewhere without running the
 * crawlers themselves.
 */
export const GET: APIRoute = async () => {
  const [events, communities] = await Promise.all([getUpcomingEvents(), getCommunities()]);

  const payload = {
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution: 'catania.community — Catania community events',
    source: REPO_URL,
    communities: communities.map(({ ingest: _ingest, ...rest }) => rest),
    events,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // It is an open dataset: anyone must be able to read it cross-origin.
      'Access-Control-Allow-Origin': '*',
    },
  });
};
