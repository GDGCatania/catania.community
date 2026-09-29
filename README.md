# catania.community

One page with every community event in Catania and its province.

Events are scattered across Meetup, gdg.community.dev, Luma, Telegram and Instagram. This site
gathers them in one place and acts as a **mirror**: sign-ups and tickets stay on the organisers' own
platforms — we never handle registrations.

A static site built with [Astro](https://astro.build) and hosted on GitHub Pages. Crawlers run on
GitHub Actions twice a day and commit their results back into the repository, so if a source breaks
the site stays online with the last good data.

> The deployed site is in Italian. The interface is fully translated (see [Languages](#languages)),
> and everything specific to Catania lives in one config file: see
> [Run it for your city](#run-it-for-your-city).

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

| `type`       | Covers                                                            |
| ------------ | ----------------------------------------------------------------- |
| `bevy`       | GDG and other chapters on the Bevy platform (public API, no auth) |
| `ics`        | Luma, public Google Calendars, Gancio, Mobilizon, Nextcloud       |
| `jsonld`     | Meetup, Eventbrite, and any site publishing schema.org Event      |
| `manual`     | Events curated by hand in the repository                          |

**Meetup and Eventbrite have no public API, but their pages are structured.** Both publish complete
schema.org `Event` markup as JSON-LD on every event page — dates with an explicit offset, a named
venue with a street address, the canonical URL. `jsonld` reads that, and works on any site that
publishes the same markup.

It never touches a private API: Meetup's `robots.txt` disallows `/gql*`, `/api` and `/mu_api` while
allowing the event and listing pages, so the adapter reads pages only, with the project's
identifiable User-Agent.

Configure it with `urls:` for explicit event pages, which works on any host, or `list:` for a listing
page, accepted only for hosts with a discovery rule in the adapter. Two things to know:

- **Eventbrite types its events `SocialEvent`**, a schema.org subtype of `Event`. Matching `Event`
  exactly finds nothing there.
- **Discovery is the fragile half.** Listing pages carry no event JSON-LD, so event URLs are
  extracted from the HTML. A group with nothing scheduled and a page whose layout changed both yield
  zero links, so a listing strategy first proves the page is the one it asked for, and throws when it
  is not rather than reporting "no events".

**Backfilling the archive.** Past events are never re-read by the daily run, which only looks back to
yesterday. To import an archive once:

```bash
npm run ingest -- --since 2024-01-01 --dry-run   # check first
npm run ingest -- --since 2024-01-01
```

Run it across **every** source, without `--source`: an event that started after `--since` and whose
source was not part of the run counts as "no longer configured" and is dropped from `data/`.

### Two behaviours worth knowing about

**A failing source never empties the site.** Each adapter is isolated: if one fails, its events stay
as they were on the last successful run, the other sources carry on, and the workflow opens an issue
labelled `ingest-failure`.

**Geocoding verifies its own answers.** "Catania" is both a town and a province, so Nominatim happily
returns a same-named street 25 km away. Every result is checked against the expected town and
discarded if it does not match — the map says "N events without a location" rather than showing a pin
in the wrong place.

## Languages

The site ships in **one language at a time**, resolved at build time by
[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs). There is no locale segment in
the URLs and no runtime switching, which keeps every page cleanly indexable.

- `project.inlang/settings.json` — `baseLocale` selects the language the site is built in.
- `messages/it.json`, `messages/en.json` — the messages, in the inlang message format. Plain JSON, so
  they can be handed to [Weblate](https://weblate.org), Crowdin or
  [Fink](https://inlang.com/m/tdozzpar/app-inlang-finkLocalizationEditor) without anyone having to
  edit TypeScript.

To ship in English, set `"baseLocale": "en"` and rebuild. To add a language, add it to `locales`,
drop a `messages/<code>.json` next to the others, and map its `Intl` tag in `src/i18n/index.ts`.

Messages are compiled into typed, tree-shakeable functions under `src/paraglide/` (generated, not
committed). Two features are worth knowing about:

**Plurals** use `Intl.PluralRules`, so a language with more than two plural categories — Polish,
Russian, Arabic — works without touching any code:

```json
"event_count": [{
  "declarations": ["input count", "local countPlural = count: plural"],
  "selectors": ["countPlural"],
  "match": { "countPlural=one": "{count} evento", "countPlural=other": "{count} eventi" }
}]
```

**Links live inside the sentence**, not around it:

```json
"footer_license": "Mappe © collaboratori {#link to=$osm}OpenStreetMap{/link}."
```

Rendered with `<Message of={m.footer_license} links={{ osm: '…' }} />`. This is what lets English say
"Maps © OpenStreetMap contributors" while Italian says "Mappe © collaboratori OpenStreetMap": the
translator moves the link, instead of the sentence structure being frozen by the code. URLs stay out
of the message files — they are configuration, not copy.

Event titles, descriptions and venue names are **not** translated: they belong to the communities
that published them and stay in their own language.

Code, comments and URL slugs are in English so that anyone can contribute. The Issue Forms are in
Italian because they are the contribution surface for local organisers.

## Run it for your city

The code knows nothing about Catania: the city, the copy and the data live in a handful of files. A
fork for another city touches exactly these.

**1. `site.config.ts`** — the only source file to edit.

| Group | Keys |
| --- | --- |
| Identity | `name`, `url`, `repo` |
| Place | `city`, `region`, `country`, `countryName`, `timezone`, `boundingBox`, `map` |
| Language and money | `defaultLanguage`, `defaultLanguageCode`, `currency` |
| Vocabulary | `categories`, `areas` |
| Branding copy | `headline`, `headlineAccent`, `metaDescription`, `metaDescriptionWithCount`, `feedTitle`, `feedDescription`, `footerAbout` |
| Contributions | `issueLabels`, `exampleCommunityName`, `submitEndpoint` |
| Social preview | `ogImage` |

Every key is documented in the file. A few are worth reading twice:

- `timezone` is how every date without an explicit offset is read, at ingest and on the page. Get it
  wrong and events are shifted by an hour or more, silently.
- `city` is also what the geocoder checks every result against, and `defaultLanguageCode` is the
  language place names are requested in: spell the city the way OpenStreetMap does in that language.
- `boundingBox` rejects coordinates outside it. Draw it loosely around the whole area you cover.
- `areas` keeps its three keys (`citta`, `provincia`, `online`), because the ingest logic depends on
  what they mean — the city itself, the rest of the area, online. Change their labels, not the keys.
- Adding or renaming a category also means adding its `category_<key>` message and its entry in
  `src/i18n/labels.ts`; the type checker points at every place that is missing it.
- `submitEndpoint` is the service behind the "add your community" form. It is not part of this
  repository; set it to `null` and the form sends people to GitHub with their answers pre-filled.
- `ogImage` is `null` until you add a 1200×630 image under `public/` and point it there.

**2. The interface language** — `baseLocale` in `project.inlang/settings.json` (see
[Languages](#languages)). A handful of messages mention the place: they take `{city}` from the config,
but read `messages/<locale>.json` once with your area in mind (for instance `area_provincia`,
`communities_metaDescription`).

**3. The domain** — set the custom domain in the repository's Pages settings and put the same host in
`public/CNAME` (or delete the file if you stay on `github.io`). `robots.txt`, the sitemap, canonical
URLs and iCal identifiers follow `url` on their own.

**4. The Issue Forms** — `.github/ISSUE_TEMPLATE/*.yml` are the contribution surface for local
organisers, so they are written in the local language and point at the site. Translate them if
needed, but keep the field labels of `nuova-community.yml` in sync with `tools/issue-to-yaml.ts`,
which reads the issue by those labels, and keep the file names equal to `issueLabels`.

**5. The data** — empty `sources/communities/`, `sources/events/`, `sources/venues/` and `data/`, then
add your first community (see [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-community)) and run
`npm run ingest`.

**6. Hosting** — enable GitHub Pages with *GitHub Actions* as the source, create the
`nuova-community` and `correzione` labels (or whatever `issueLabels` says), and allow Actions to
open pull requests. The two ingest runs a day start on their own.

Then `npm test && npm run check && npm run build`: the schema validates every YAML file against the
new config, so a coordinate outside the bounding box or an unknown category fails the build.

## Contributing

**Your community is missing, or something is wrong?**
[Open a report](https://catania.community/submit) — no GitHub account needed. If you have one, the
[Issue Forms](../../issues/new/choose) work just as well.

Every report becomes a pull request with the YAML file already written: merging it is the approval.

Working on the code instead? [CONTRIBUTING.md](CONTRIBUTING.md) covers the setup, how to add a
community or an adapter, who owns `data/`, and the commit and branch conventions.

## Licences

- **Code**: [AGPL-3.0-or-later](LICENSE)
- **Data** in `data/` and `sources/`: [ODbL 1.0](LICENSE-DATA)
- Maps and geocoding: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Archivo and JetBrains Mono fonts: SIL Open Font License 1.1
