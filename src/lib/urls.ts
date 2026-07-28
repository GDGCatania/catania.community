/**
 * With `build.format: 'file'`, `Astro.url.pathname` carries the extension during
 * the build (`/index.html`, `/events/devfest-catania-2025.html`) while in dev it
 * is already clean. Canonicals and og:url have to match in both cases, or Google
 * indexes two URLs for the same page.
 */
export function normalizePath(pathname: string): string {
  let p = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (p === '') p = '/';
  // No trailing slash except on the home page (matching trailingSlash: 'never').
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

export function absoluteUrl(pathname: string, site: URL | undefined): string {
  const base = site ?? new URL('https://catania.community');
  return new URL(normalizePath(pathname), base).href;
}
