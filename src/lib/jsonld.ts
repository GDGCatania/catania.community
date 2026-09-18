import type { Community, Event } from './schema';

/**
 * schema.org structured data.
 *
 * This is the main reason the site is static and prerendered: without this
 * block in the source, Google shows no rich results for the events and half the
 * point of an aggregator is lost.
 */
import { SITE_URL, ROUTES, DEFAULT_CITY, DEFAULT_REGION, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from './site';

export function eventJsonLd(event: Event, community: Community | undefined, url: string) {
  const location = event.online
    ? {
        '@type': 'VirtualLocation',
        url: event.url,
      }
    : {
        '@type': 'Place',
        name: event.venue?.name ?? 'TBC',
        ...(event.venue?.address || event.venue?.city
          ? {
              address: {
                '@type': 'PostalAddress',
                ...(event.venue.address ? { streetAddress: event.venue.address } : {}),
                addressLocality: event.venue.city ?? DEFAULT_CITY,
                addressRegion: DEFAULT_REGION,
                addressCountry: DEFAULT_COUNTRY,
              },
            }
          : {}),
        ...(event.venue?.geo
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: event.venue.geo.lat,
                longitude: event.venue.geo.lon,
              },
            }
          : {}),
      };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    ...(event.description ? { description: event.description.slice(0, 500) } : {}),
    startDate: event.start,
    ...(event.end ? { endDate: event.end } : {}),
    eventStatus: event.cancelled
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location,
    ...(event.coverImage ? { image: [event.coverImage] } : {}),
    ...(community
      ? {
          organizer: {
            '@type': 'Organization',
            name: community.name,
            url: community.links.website ?? `${SITE_URL}${ROUTES.community(community.id)}`,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      // Google expects `price` as a numeric string.
      price: event.price.type === 'paid' ? String(event.price.amount ?? 0) : '0',
      priceCurrency: event.price.currency,
      availability: 'https://schema.org/InStock',
      // Registration happens elsewhere: point at the source.
      url: event.url,
    },
    inLanguage: event.language === DEFAULT_LANGUAGE ? 'it' : event.language,
    isAccessibleForFree: event.price.type !== 'paid',
    url,
  };
}

export function communityJsonLd(community: Community, url: string) {
  const sameAs = Object.entries(community.links)
    .filter(([key, value]) => key !== 'email' && typeof value === 'string')
    .map(([, value]) => value as string);

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: community.name,
    ...(community.description ? { description: community.description } : {}),
    url,
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(community.since ? { foundingDate: String(community.since) } : {}),
    location: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: DEFAULT_CITY,
        addressRegion: DEFAULT_REGION,
        addressCountry: DEFAULT_COUNTRY,
      },
    },
  };
}

/** Breadcrumbs: they help Google understand the site hierarchy. */
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
