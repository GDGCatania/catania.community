import { slugify } from '../lib/text.js';
import type { Community, ManualEvent } from '../../../src/lib/schema.js';
import type { RawEvent } from './types.js';

/**
 * Events curated by hand in `sources/events/*.yml`.
 * This is the source that keeps the site standing: it covers communities on
 * closed platforms (Meetup, Eventbrite) and still works if every crawler breaks.
 */
export function fromManual(
  manualEvents: ManualEvent[],
  community: Community,
  options: { since: Date }
): RawEvent[] {
  return manualEvents
    .filter((event) => event.communityId === community.id)
    .filter((event) => new Date(event.start) >= options.since)
    .map((event) => ({
      // The id derives from title and date: change either and it is a new event.
      id: `manual:${community.id}:${slugify(event.title, 60)}:${event.start.slice(0, 10)}`,
      slug: slugify(event.title),
      title: event.title,
      description: event.description,
      start: event.start,
      end: event.end,
      url: event.url,
      communityId: community.id,
      venue: event.venue
        ? {
            name: event.venue.name,
            address: event.venue.address,
            city: event.venue.city,
            // Coordinates written by hand in the YAML beat the geocoder.
            ...(event.venue.geo ? { geo: event.venue.geo } : {}),
          }
        : undefined,
      online: event.online,
      price: event.price,
      categories: event.categories ?? community.categories,
      language: event.language ?? community.language,
      beginnerFriendly: event.beginnerFriendly,
      seatsLeft: event.seatsLeft,
      coverImage: event.coverImage,
      cancelled: event.cancelled,
    }));
}
