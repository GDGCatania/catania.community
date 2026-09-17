import { describe, expect, it } from 'vitest';
import { Geocoder } from '../geocode.js';
import { VenueSchema, type CuratedVenue } from '../../../src/lib/schema.js';

const CREATIONDOSE: CuratedVenue = {
  id: 'creationdose',
  name: 'CreationDose',
  aliases: ['CreationDose Srl'],
  address: 'Via Antonino di Sangiuliano 197',
  city: 'Catania',
  geo: { lat: 37.50498, lon: 15.0895881 },
};

describe('Geocoder — curated venues beat the geocoder', () => {
  it('resolves the name and every alias to the same coordinates', async () => {
    const geocoder = await Geocoder.load([CREATIONDOSE]);

    for (const name of ['CreationDose', 'CreationDose Srl', 'creationdose srl']) {
      // An address Nominatim sends to Giarre: only the curated entry saves it.
      expect(await geocoder.resolve({ name, address: 'Via Antonino di S. Giuliano, 197' })).toEqual(
        CREATIONDOSE.geo
      );
    }

    expect(geocoder.lookups).toBe(0);
  });

  it('keeps aliases out of the venue published inside an event', () => {
    const { aliases, ...venue } = CREATIONDOSE;

    expect(aliases).toBeDefined();
    expect(VenueSchema.parse(CREATIONDOSE)).toEqual(venue);
  });
});