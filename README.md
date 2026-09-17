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

| `type`       | Covers                                                            |
| ------------ | ----------------------------------------------------------------- |
| `bevy`       | GDG and other chapters on the Bevy platform (public API, no auth) |
| `ics`        | Luma, public Google Calendars, Gancio, Mobilizon, Nextcloud       |
| `pycatania`  | The JSON feed Python Catania publishes on its own site            |
| `manual`     | Events curated by hand in the repository                          |

**Meetup and Eventbrite are not reachable.** Meetup retired its open API and the GraphQL one now
requires a paid Pro subscription to create an OAuth consumer; Eventbrite removed its public search
endpoint in 2020. Communities on those platforms are covered with `manual`, by asking them for a
public `.ics` feed, or — best of all — by reading a feed they already maintain themselves.

**`pycatania` is that third case.** Python Catania runs on Meetup, but the organisers keep their site
open at [PythonCatania/PythonCatania.github.io](https://github.com/PythonCatania/PythonCatania.github.io)
and publish `public/data/events.json`, with the canonical Meetup link in every entry. Reading it beats
copying their events by hand. Two caveats are baked into the adapter rather than hidden:

- **It is an archive.** An entry appears _after_ the meetup — it always carries `attendees` and a photo
  gallery. A normal run therefore collects nothing, and that is not a failure. Their upcoming events
  will only reach the agenda if the feed starts announcing them.
- **`date` carries no time.** The adapter publishes at the `defaultTime` declared in the community's
  YAML (18:30, their usual start) and prefers a per-entry `time` the moment the feed provides one.

The adapter is named after the community on purpose: the format is theirs, not a standard. If another
community adopts the same shape, generalise it then.

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
