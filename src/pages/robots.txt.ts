import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

/** Generated rather than static so the sitemap URL follows `site.config.ts`. */
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
