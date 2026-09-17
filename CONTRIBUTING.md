# Contributing

There are two doors into this project, and only one of them needs code.

## Reporting a community or a mistake

No GitHub account, no code: **[the form on the site](https://catania.community/submit)**. If you do
have an account, the [Issue Forms](../../issues/new/choose) work just as well.

A report about a new community becomes a pull request with the YAML file already written — merging it
is the approval. A correction lands in `data/overrides/` and from then on wins over every crawler.

Those surfaces are in **Italian on purpose**: they are the contribution surface for local organisers.
Everything below is in English, because code should be readable by anyone.

## Working on the code

Requires Node ≥ 22.12.

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output in dist/
npm run preview      # serve dist/ the way production does
npm run check        # type-check .astro and .ts
npm test             # adapter tests, no network access
npm run ingest -- --dry-run   # collect events, write nothing
```

### Where things live

| Path                      | What it is                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| `sources/communities/`    | One community per file. The editorial heart of the project.             |
| `sources/events/`         | Events curated by hand, for communities on closed platforms.            |
| `sources/venues/`         | Venues with hand-checked coordinates. These always beat the geocoder.   |
| `data/`                   | Crawler output. Owned by the bot — see [Data](#data).                   |
| `src/`                    | The Astro site.                                                         |
| `tools/ingest/`           | The crawlers and the orchestrator.                                      |
| `messages/`               | Interface copy, in the inlang message format.                           |

### Adding a community

One file, `sources/communities/<slug>.yml`, validated by `CommunitySchema` in `src/lib/schema.ts`.
Open an existing one and follow it: both start with a comment saying **where the data was checked and
on what date**, which is what makes the file auditable later.

Then pick how its events are collected, and verify before opening the PR:

```bash
npm run ingest -- --source <slug> --dry-run
```

Some field values (`citta`, `provincia`, `impresa`…) stay in Italian: they are domain vocabulary that
also appears in the YAML people edit by hand. Their human-readable labels live in `src/i18n`.

### Writing an adapter

An adapter turns one source into `RawEvent[]`. It does not decide `area`, does not geocode and does
not set `source`: `tools/ingest/normalize.ts` does that. Four rules:

1. **Split fetching from parsing.** Export the parse function separately so tests run against a
   fixture. Tests never touch the network — a broken adapter must be caught in CI, not by writing bad
   data into the repo.
2. **Fail loudly.** If the payload no longer has the shape you expect, throw. A thrown adapter keeps
   its previous events and opens an `ingest-failure` issue; an adapter that quietly returns `[]`
   empties the community.
3. **Do not invent data.** No guessed prices, no venues parsed out of prose. A missing venue shows as
   "no location"; a wrong one puts a pin on the map that nobody verified. Where an approximation is
   unavoidable, declare it in the community YAML rather than burying it in the code.
4. **Name it after the standard, or after the community.** `ics` and `jsonld` are standards, and a
   standard covers every platform that speaks it: one `jsonld` parser reads both Meetup and
   Eventbrite. Name an adapter after a single community only when the format really is theirs alone,
   and generalise it the day a second community adopts the same shape.

Registering a new one touches four places: `IngestConfigSchema` and `SOURCE_PRIORITY` in
`src/lib/schema.ts`, `runAdapter` in `tools/ingest/index.ts`, and the adapter table in the README.

### Data

`data/` is the bot's: the scheduled run collects events twice a day and commits them. Do not hand-edit
what it produced.

Two exceptions:

- **Corrections** go in `data/overrides/*.yml`, keyed by event id. They take precedence over every
  crawler, so a value that is wrong at the source gets fixed without waiting for the source.
- **A one-off backfill** may be committed by hand, in its own commit, because the scheduled run only
  looks back to yesterday and will never pick up an archive. Run it across **every** source:

  ```bash
  npm run ingest -- --since 2024-01-01 --dry-run
  npm run ingest -- --since 2024-01-01
  ```

  Not with `--source`: an event starting after `--since` whose source was not part of the run counts
  as "no longer configured" and is dropped from `data/`. The same job can be done by dispatching the
  "Collect events" workflow with a `since` input, which leaves the commit to the bot.

**Two consecutive runs with no upstream change must produce zero diff.** Serialisation is
deterministic and `source.fetchedAt` is only bumped when an event actually changed. If your work makes
the second run produce a diff, that is a bug: it turns the bot's commits into unreadable noise.

### Interface copy

No user-facing string in a `.astro` file. Copy lives in `messages/*.json` and is compiled into typed
functions under `src/paraglide/`. Links go *inside* the sentence, so a translator can move them:

```json
"footer_license": "Mappe © collaboratori {#link to=$osm}OpenStreetMap{/link}."
```

Event titles, descriptions and venue names are **not** translated: they belong to the communities that
published them.

## Conventions

**Language.** Code, comments, URL slugs, commit messages and branch names are in English. What the
public reads — site copy, Issue Forms, the bodies of automated pull requests — is in Italian.

**Commits** follow [Conventional Commits](https://www.conventionalcommits.org), in English:

```
feat(ingest): read Python Catania's own JSON feed
fix(dates): show the year when it is not the current one
chore(data): backfill the Python Catania archive
```

Types in use: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Scopes are the area touched
(`ingest`, `dates`, `i18n`, `data`, `community`). Explain *why* in the body — the diff already says
what. **This applies to the automation too**: the messages generated by `tools/commit-message.mjs` and
by the workflows follow the same rule.

**Branches.** `features/<short-english-kebab-case>` for human work, whatever the type of change.
`community/<slug>` is reserved for the report-to-PR bot; do not use it by hand.

**Pull requests.** The "Verify" workflow runs `npm run check`, `npm test`, `npm run build` and
`npm run ingest -- --dry-run` — the dry run validates `sources/` and `data/` against the production
schemas. Run them locally first, and say in the description what you actually verified, not what you
assume works.

**Merging.** `main` carries one commit per change, plus the merge that recorded it: a branch is
**squashed to a single commit** and merged with a **merge commit, never a fast-forward**. GitHub has
no single button for that combination — squashing there drops the merge commit — so squash first and
merge after:

```bash
git rebase -i main            # collapse into one commit
git push --force-with-lease
gh pr merge <number> --merge  # merge commit, no fast-forward
```

A branch that is already a single commit only needs the last step.

The exception is a commit that has to stay **separately revertible**: a one-off `data/` backfill
sitting next to the code that produced it, for instance, so that dropping the data does not mean
dropping the adapter with it. Keep it out of the squash and say why in the pull request.

## Licences

By contributing you agree to release your work under the project's licences:
[AGPL-3.0-or-later](LICENSE) for code, [ODbL 1.0](LICENSE-DATA) for the data in `data/` and `sources/`.