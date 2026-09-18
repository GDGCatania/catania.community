import { z } from 'zod';
import cfg from '../../site.config';

/**
 * Schema shared by the crawlers (`tools/ingest`) and the site build.
 * This is the single place where the shape of the data is defined: if an
 * adapter produces something that does not validate here, it never reaches
 * `data/`.
 *
 * The identifiers below (`citta`, `provincia`, `impresa`…) stay in Italian on
 * purpose: they are domain vocabulary that also appears in the YAML files
 * people edit by hand. Their human-readable labels live in `src/i18n`.
 *
 * Categories, areas, bounding box, default language and currency are all
 * derived from `site.config.ts` so that a fork only edits that one file.
 */

export const CATEGORIES = cfg.categories;
export const AREAS = cfg.areas;
export const PRICE_TYPES = ['free', 'donation', 'paid'] as const;

/**
 * Precedence when the same event arrives twice: the first one wins.
 * `jsonld` sits last because it is read from a page rather than from an API or
 * a feed: where a platform offers both, the structured endpoint is the one to
 * trust.
 */
export const SOURCE_PRIORITY = ['override', 'manual', 'bevy', 'ics', 'jsonld'] as const;

export const CategorySchema = z.enum(CATEGORIES);
export const AreaSchema = z.enum(AREAS);
export const SourceTypeSchema = z.enum(SOURCE_PRIORITY);

/** Lowercase, no accents, no spaces: it goes straight into a URL. */
export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalid slug: use lowercase letters, digits and hyphens only');

/** ISO 8601 with an explicit offset. Without one the time would be ambiguous. */
export const DateTimeSchema = z.iso.datetime({ offset: true });

export const GeoSchema = z.object({
  // Bounding box from site.config.ts. It catches swapped lat/lon pairs
  // and geocoding that wandered off to another country entirely.
  lat: z.number().min(cfg.boundingBox.lat.min).max(cfg.boundingBox.lat.max),
  lon: z.number().min(cfg.boundingBox.lon.min).max(cfg.boundingBox.lon.max),
});

export const VenueSchema = z.object({
  id: SlugSchema.optional(),
  name: z.string().min(1).max(200),
  address: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  geo: GeoSchema.optional(),
  accessible: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const CuratedVenueSchema = VenueSchema.extend({
  aliases: z.array(z.string().min(1).max(200)).optional(),
});

export const PriceSchema = z.object({
  type: z.enum(PRICE_TYPES),
  amount: z.number().nonnegative().optional(),
  currency: z.literal(cfg.currency).default(cfg.currency),
});

export const LinksSchema = z.object({
  website: z.url().optional(),
  meetup: z.url().optional(),
  luma: z.url().optional(),
  eventbrite: z.url().optional(),
  telegram: z.url().optional(),
  instagram: z.url().optional(),
  linkedin: z.url().optional(),
  mastodon: z.url().optional(),
  github: z.url().optional(),
  email: z.email().optional(),
});

/** How to collect a community's events. */
export const IngestConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bevy'),
    /** Numeric chapter id. Careful: the API silently ignores `chapter_slug`. */
    chapter: z.number().int().positive(),
    host: z.string().default('gdg.community.dev'),
  }),
  z.object({
    type: z.literal('ics'),
    url: z.url(),
    /** Some feeds also carry other cities' events: filter them out by title. */
    titleFilter: z.string().optional(),
  }),
  z.object({
    type: z.literal('jsonld'),
    /**
     * A listing page to discover event URLs from. Only hosts with a checked
     * discovery rule are accepted (Meetup, Eventbrite): everywhere else, list
     * the events explicitly.
     */
    list: z.url().optional(),
    /** Explicit event URLs. Boring, stable, and works on any host. */
    urls: z.array(z.url()).default([]),
  }),
  z.object({
    type: z.literal('manual'),
  }),
]);

export const CommunitySchema = z.object({
  id: SlugSchema,
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  categories: z.array(CategorySchema).min(1),
  area: AreaSchema,
  since: z.number().int().min(1990).max(2100).optional(),
  cadence: z.string().max(120).optional(),
  language: z.string().max(40).default(cfg.defaultLanguage),
  members: z.number().int().nonnegative().optional(),
  usualVenue: z.string().max(200).optional(),
  links: LinksSchema.default({}),
  ingest: z.array(IngestConfigSchema).default([]),
  /** Set to false to archive a community that no longer organises anything. */
  active: z.boolean().default(true),
});

export const EventSchema = z.object({
  /** Stable and derived from the source: `bevy:12345`, `ics:<uid>`, `manual:<slug>`, `jsonld:meetup:<id>`. */
  id: z.string().min(1).max(200),
  slug: SlugSchema,
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  start: DateTimeSchema,
  end: DateTimeSchema.optional(),
  /** Link to the organiser's platform: no sign-ups happen on this site. */
  url: z.url(),
  communityId: SlugSchema,
  venue: VenueSchema.optional(),
  online: z.boolean().default(false),
  area: AreaSchema,
  price: PriceSchema,
  categories: z.array(CategorySchema).default([]),
  language: z.string().max(40).default(cfg.defaultLanguage),
  beginnerFriendly: z.boolean().optional(),
  seatsLeft: z.number().int().nonnegative().optional(),
  coverImage: z.url().optional(),
  cancelled: z.boolean().default(false),
  source: z.object({
    type: SourceTypeSchema,
    fetchedAt: DateTimeSchema,
    ref: z.string().max(500).optional(),
  }),
});

/** An event has to end after it starts. */
export const ValidatedEventSchema = EventSchema.refine(
  (e) => !e.end || Date.parse(e.end) > Date.parse(e.start),
  { error: 'end must come after start', path: ['end'] }
);

export const EventFileSchema = z.array(ValidatedEventSchema);

/**
 * An event curated by hand in `sources/events/*.yml`.
 * Shaped to be written by a person: no `id` or `source`, which are derived,
 * and no `area`, which is inferred from the venue's town.
 */
export const ManualEventSchema = z.object({
  title: z.string().min(1).max(300),
  communityId: SlugSchema,
  start: DateTimeSchema,
  end: DateTimeSchema.optional(),
  url: z.url(),
  description: z.string().max(5000).optional(),
  venue: VenueSchema.optional(),
  online: z.boolean().default(false),
  price: PriceSchema.default({ type: 'free', currency: cfg.currency }),
  categories: z.array(CategorySchema).optional(),
  language: z.string().max(40).optional(),
  beginnerFriendly: z.boolean().optional(),
  seatsLeft: z.number().int().nonnegative().optional(),
  coverImage: z.url().optional(),
  cancelled: z.boolean().default(false),
});

export const ManualEventFileSchema = z.array(ManualEventSchema);

/** Manual correction: `id` is required, everything else is optional. */
export const OverrideSchema = EventSchema.partial().extend({
  id: z.string().min(1),
  /** Set to true to hide an event entirely (duplicate, spam, cancelled). */
  drop: z.boolean().optional(),
});

export type Category = z.infer<typeof CategorySchema>;
export type Area = z.infer<typeof AreaSchema>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type Geo = z.infer<typeof GeoSchema>;
export type Venue = z.infer<typeof VenueSchema>;
export type CuratedVenue = z.infer<typeof CuratedVenueSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type Links = z.infer<typeof LinksSchema>;
export type IngestConfig = z.infer<typeof IngestConfigSchema>;
export type Community = z.infer<typeof CommunitySchema>;
export type Event = z.infer<typeof EventSchema>;
export type ManualEvent = z.infer<typeof ManualEventSchema>;
export type Override = z.infer<typeof OverrideSchema>;
