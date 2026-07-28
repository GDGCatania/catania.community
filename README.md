# catania.community

One page with every community event in Catania and its province.

Events are scattered across Meetup, gdg.community.dev, Luma, Telegram and Instagram. This site
gathers them in one place and acts as a **mirror**: sign-ups and tickets stay on the organisers' own
platforms — we never handle registrations.

A static site built with [Astro](https://astro.build) and hosted on GitHub Pages. Crawlers run on
GitHub Actions twice a day and commit their results back into the repository, so if a source breaks
the site stays online with the last good data.

> The deployed site is in Italian. The interface is fully translated (see [Languages](#languages)),
> so a fork elsewhere can ship in English by changing one line.

## Development

Requires Node ≥ 22.12.

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output in dist/
npm run preview      # serve dist/ the way production does
npm run check        # type-check .astro and .ts
npm test             # adapter tests, no network access
```

## Collecting data

```bash
npm run ingest -- --dry-run                      # every source, writes nothing
npm run ingest -- --source gdg-catania --dry-run # a single source
npm run ingest                                   # writes to data/
```

Two consecutive runs with no upstream changes must produce **zero diff** in `data/`: serialisation is
deterministic and `source.fetchedAt` is only bumped when an event actually changed, which keeps the
bot's commits readable.

### How the sources are organised

- `sources/communities/*.yml` — one community per file, including how to collect its events. This is
  the editorial heart of the project.
- `sources/events/*.yml` — events curated by hand, for communities on closed platforms.
- `sources/venues/*.yml` — venues with hand-checked coordinates. These always beat the geocoder.
- `data/` — crawler output, committed by the bot. Do not edit by hand: use `data/overrides/*.yml`,
  which takes precedence over everything.

Available adapters:

| `type`   | Covers                                                            |
| -------- | ----------------------------------------------------------------- |
| `bevy`   | GDG and other chapters on the Bevy platform (public API, no auth) |
| `ics`    | Luma, public Google Calendars, Gancio, Mobilizon, Nextcloud       |
| `manual` | Events curated by hand in the repository                          |

**Meetup and Eventbrite are not reachable.** Meetup retired its open API and the GraphQL one now
requires a paid Pro subscription to create an OAuth consumer; Eventbrite removed its public search
endpoint in 2020. Communities on those platforms are covered with `manual`, or by asking them for a
public `.ics` feed.

### Two behaviours worth knowing about

**A failing source never empties the site.** Each adapter is isolated: if one fails, its events stay
as they were on the last successful run, the other sources carry on, and the workflow opens an issue
labelled `ingest-failure`.

**Geocoding verifies its own answers.** "Catania" is both a town and a province, so Nominatim happily
returns a same-named street 25 km away. Every result is checked against the expected town and
discarded if it does not match — the map says "N events without a location" rather than showing a pin
in the wrong place.

## Languages

The site ships in **one language at a time**, resolved at build time. There is no locale segment in
the URLs and no runtime switching, which keeps every page cleanly indexable.

- `src/i18n/config.ts` — the single line that selects the language.
- `src/i18n/it.ts`, `src/i18n/en.ts` — the dictionaries. Italian is the reference; English is typed
  against it, so a missing key is a build error rather than a blank label in production.

To ship in English, set `SITE_LOCALE = 'en'` and rebuild. To add a language, copy a dictionary and
register it in `src/i18n/index.ts`.

Event titles, descriptions and venue names are **not** translated: they belong to the communities
that published them and stay in their own language.

Code, comments and URL slugs are in English so that anyone can contribute. The Issue Forms are in
Italian because they are the contribution surface for local organisers.

## Contributing

**Your community is missing, or something is wrong?**
[Open a report](https://catania.community/submit) — no GitHub account needed. If you have one, the
[Issue Forms](../../issues/new/choose) work just as well.

Every report becomes a pull request with the YAML file already written: merging it is the approval.

## Licences

- **Code**: [AGPL-3.0-or-later](LICENSE)
- **Data** in `data/` and `sources/`: [ODbL 1.0](LICENSE-DATA)
- Maps and geocoding: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Archivo and JetBrains Mono fonts: SIL Open Font License 1.1
