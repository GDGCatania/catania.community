import type { Event, Geo } from '../../../src/lib/schema.js';

/**
 * What an adapter can work out on its own.
 * `area` is decided by `normalize.ts` (it needs the community and the venue's
 * town) and `source` is added by the orchestrator.
 *
 * `venue.geo` is optional because geocoding is a later, shared step: only
 * hand-curated events can arrive with coordinates already, and when they do
 * they beat the geocoder.
 */
export type RawEvent = Omit<Event, 'area' | 'source' | 'venue'> & {
  venue?: { name: string; address?: string; city?: string; geo?: Geo };
};
