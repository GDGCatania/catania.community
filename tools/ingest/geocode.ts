import { fetchJson } from './lib/fetch.js';
import { readJson, writeJsonIfChanged } from './lib/json.js';
import { PATHS } from './lib/paths.js';
import { GeoSchema, type CuratedVenue, type Geo } from '../../src/lib/schema.js';
import { DEFAULT_CITY, COUNTRY_NAME } from '../../src/lib/site.js';
import { normalizeForCompare } from './lib/text.js';

/**
 * Geocoding through Nominatim, OpenStreetMap's public service.
 * Its usage policy allows at most one request per second (enforced by
 * lib/fetch) and asks that results be cached: the cache is committed to
 * `data/geocache.json`, so the same address is never looked up twice.
 * Coordinates curated by hand in `sources/venues/` always win.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/** null = looked up and not found: stops us asking again on every run. */
type Cache = Record<string, Geo | null>;

export class Geocoder {
  #cache: Cache = {};
  #curated = new Map<string, Geo>();
  #lookups = 0;
  #dirty = false;

  static async load(curatedVenues: CuratedVenue[]): Promise<Geocoder> {
    const geocoder = new Geocoder();
    geocoder.#cache = await readJson<Cache>(PATHS.geocache, {});
    for (const venue of curatedVenues) {
      if (!venue.geo) continue;
      for (const name of [venue.name, ...(venue.aliases ?? [])]) {
        geocoder.#curated.set(normalizeForCompare(name), venue.geo);
      }
    }
    return geocoder;
  }

  get lookups(): number {
    return this.#lookups;
  }

  /** Resolves a venue to coordinates, or undefined when it cannot. */
  async resolve(venue: {
    name?: string;
    address?: string;
    city?: string;
  }): Promise<Geo | undefined> {
    if (venue.name) {
      const curated = this.#curated.get(normalizeForCompare(venue.name));
      if (curated) return curated;
    }

    const city = venue.city ?? DEFAULT_CITY;

    // Two attempts, most precise first: the address, then the venue name. The
    // name often works exactly where the address fails, because well-known
    // places are mapped in OSM as points of interest even when the street
    // number is not (e.g. "Vecchia Dogana" at the port of Catania).
    const queries = [
      venue.address ? `${venue.address}, ${city}, ${COUNTRY_NAME}` : null,
      venue.name ? `${venue.name}, ${city}, ${COUNTRY_NAME}` : null,
    ].filter((q): q is string => q !== null);

    for (const query of queries) {
      const key = normalizeForCompare(query);

      if (key in this.#cache) {
        const cached = this.#cache[key];
        if (cached) return cached;
        continue; // Already looked up with no result: try the next form.
      }

      const geo = await this.#lookup(query, city);
      this.#cache[key] = geo ?? null;
      this.#dirty = true;
      if (geo) return geo;
    }

    return undefined;
  }

  /**
   * Looks the address up and checks the result is really in the right town.
   *
   * This matters because "Catania" is both a town and a province: searching for
   * "Via Cardinale Dusmet, Catania" happily returns the street of the same name
   * in Giarre, 25 km away but still "in the province of Catania". Neither
   * `viewbox` nor a structured query prevents it. Better no pin at all — the
   * map says so openly — than a pin in the wrong place.
   */
  async #lookup(query: string, expectedCity: string): Promise<Geo | undefined> {
    this.#lookups++;
    const url = `${NOMINATIM}?${new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '5',
      addressdetails: '1',
      'accept-language': 'it',
    })}`;

    const wanted = normalizeForCompare(expectedCity);

    try {
      const results = await fetchJson<NominatimResult[]>(url);

      for (const result of results) {
        const locality = localityOf(result);
        if (locality && normalizeForCompare(locality) !== wanted) continue;

        const parsed = GeoSchema.safeParse({ lat: Number(result.lat), lon: Number(result.lon) });
        if (parsed.success) return parsed.data;
      }

      if (results.length > 0) {
        console.warn(
          `  ⚠ "${query}": no result inside ${expectedCity} ` +
            `(found: ${results.map(localityOf).filter(Boolean).join(', ') || 'no town'}). ` +
            `Add the coordinates by hand in sources/venues/ if the pin matters.`
        );
      }
      return undefined;
    } catch (error) {
      // Geocoding is an enrichment: if it fails the event is still published,
      // just without a pin on the map.
      console.warn(`  ⚠ geocoding failed for "${query}": ${(error as Error).message}`);
      return undefined;
    }
  }

  async save(): Promise<boolean> {
    if (!this.#dirty) return false;
    return writeJsonIfChanged(PATHS.geocache, this.#cache);
  }
}

interface NominatimResult {
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

/** The result's town, however OSM happened to classify it. */
function localityOf(result: NominatimResult): string | undefined {
  const a = result.address;
  return a?.city ?? a?.town ?? a?.village ?? a?.municipality;
}

