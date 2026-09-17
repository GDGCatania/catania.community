#!/usr/bin/env node
import { parseArgs } from 'node:util';
import {
  CommunitySchema,
  CuratedVenueSchema,
  ManualEventFileSchema,
  OverrideSchema,
  type Community,
  type Event,
  type ManualEvent,
  type Override,
  type SourceType,
} from '../../src/lib/schema.js';
import { loadYamlDir } from './lib/yaml.js';
import { PATHS, REPO_ROOT } from './lib/paths.js';
import { readJson, writeJsonIfChanged } from './lib/json.js';
import { Geocoder } from './geocode.js';
import { fetchBevy } from './adapters/bevy.js';
import { fetchIcs } from './adapters/ics.js';
import { fetchJsonLd } from './adapters/jsonld.js';
import { fromManual } from './adapters/manual.js';
import type { RawEvent } from './adapters/types.js';
import { applyOverrides, dedupe, normalizeEvent, uniqueSlugs } from './normalize.js';
import {
  mergeEvents,
  originKey,
  preserveFetchedAt,
  readAllEvents,
  writeEvents,
} from './store.js';
import path from 'node:path';

/**
 * The collection orchestrator.
 *
 * Non-negotiable principle: one source failing must neither empty the site nor
 * stop the other sources. Every adapter is isolated in a try/catch, the outcome
 * lands in `data/ingest-report.json`, and events from failing sources stay as
 * they were on the last successful run.
 *
 *   npm run ingest -- --dry-run
 *   npm run ingest -- --source gdg-catania
 *   npm run ingest -- --since 2026-01-01
 */

interface SourceOutcome {
  community: string;
  type: SourceType;
  ok: boolean;
  events: number;
  skipped: number;
  error?: string;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      source: { type: 'string' },
      since: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(
      [
        'Usage: npm run ingest -- [options]',
        '',
        '  --dry-run              write nothing, print what would happen',
        '  --source <id>          collect only the given community',
        '  --since <YYYY-MM-DD>   ignore events starting before this date',
      ].join('\n')
    );
    return 0;
  }

  const dryRun = values['dry-run'] === true;
  const startedAt = new Date();

  // By default we look back to the start of yesterday: that catches tonight's
  // events without re-reading the whole archive on every run.
  const since = values.since
    ? new Date(`${values.since}T00:00:00Z`)
    : new Date(startedAt.getTime() - 24 * 60 * 60 * 1_000);

  if (Number.isNaN(since.getTime())) {
    console.error(`--since is not a valid date: ${values.since}`);
    return 1;
  }

  console.log(`▶ Collecting events from ${since.toISOString().slice(0, 10)}${dryRun ? ' (dry run)' : ''}`);

  const [communitiesAll, venues, manualEvents, overrides] = await Promise.all([
    loadYamlDir(PATHS.communities, CommunitySchema),
    loadYamlDir(PATHS.venues, CuratedVenueSchema),
    loadManualEvents(),
    loadOverrides(),
  ]);

  const communities = values.source
    ? communitiesAll.filter((c) => c.id === values.source)
    : communitiesAll.filter((c) => c.active);

  if (values.source && communities.length === 0) {
    console.error(`No community with id "${values.source}" in sources/communities/`);
    return 1;
  }

  console.log(
    `  ${communities.length} ${communities.length === 1 ? 'community' : 'communities'}, ${venues.length} curated venues, ` +
      `${manualEvents.length} manual events, ${overrides.length} overrides`
  );

  const geocoder = await Geocoder.load(venues);
  const fetchedAt = startedAt.toISOString();

  const outcomes: SourceOutcome[] = [];
  const fresh: Event[] = [];
  const succeeded = new Set<string>();
  const configured = new Set<string>();

  for (const community of communities) {
    for (const ingest of community.ingest) {
      const origin = originKey(community.id, ingest.type);
      configured.add(origin);

      try {
        const raws = await runAdapter(ingest, community, manualEvents, since);
        const { events, skipped } = await normalizeAll(raws, {
          community,
          sourceType: ingest.type,
          fetchedAt,
          geocoder,
        });

        fresh.push(...events);
        succeeded.add(origin);
        outcomes.push({
          community: community.id,
          type: ingest.type,
          ok: true,
          events: events.length,
          skipped,
        });

        console.log(
          `  ✓ ${community.id} via ${ingest.type}: ${events.length} events` +
            (skipped ? ` (${skipped} skipped)` : '')
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({
          community: community.id,
          type: ingest.type,
          ok: false,
          events: 0,
          skipped: 0,
          error: message,
        });
        console.error(`  ✗ ${community.id} via ${ingest.type}: ${message}`);
      }
    }
  }

  // A partial run is normal; a run where NO source answered is a fault (runner
  // network, DNS) and must not be mistaken for "no events".
  const allFailed = outcomes.length > 0 && outcomes.every((o) => !o.ok);
  if (allFailed) {
    console.error('\n✗ No source responded: the existing data is left untouched.');
  }

  const existing = await readAllEvents();
  const merged = mergeEvents({ fresh, existing, succeeded, configured, since });

  const deduped = dedupe(merged.events);
  const overridden = applyOverrides(deduped.events, overrides);
  // Before writing: an unchanged event keeps its previous fetchedAt.
  const finalEvents = preserveFetchedAt(uniqueSlugs(overridden.events), existing);

  console.log(
    `\n  ${finalEvents.length} events in total ` +
      `(${merged.preserved} preserved from failing sources, ` +
      `${deduped.duplicates} duplicates removed, ${overridden.applied} overrides applied` +
      `${overridden.dropped ? `, ${overridden.dropped} hidden` : ''})`
  );

  for (const id of overridden.unmatched) {
    console.warn(`  ⚠ override "${id}" matches no event: is it still needed?`);
  }

  if (dryRun) {
    printPreview(finalEvents, communities);
    console.log('\n(dry run: nothing written)');
    return allFailed ? 1 : 0;
  }

  const { changed } = await writeEvents(finalEvents);
  const geocacheChanged = await geocoder.save();

  // The report does NOT record when the run happened: running twice a day that
  // would produce a timestamp-only commit every time. It records when the data
  // last changed instead — which is also the honest thing to show as "last
  // updated".
  const previousReport = await readJson<{ lastChangeAt?: string }>(PATHS.ingestReport, {});
  const somethingChanged = changed.length > 0;

  await writeJsonIfChanged(PATHS.ingestReport, {
    lastChangeAt: somethingChanged ? fetchedAt : (previousReport.lastChangeAt ?? fetchedAt),
    totalEvents: finalEvents.length,
    preservedFromFailedSources: merged.preserved,
    sources: outcomes.sort(
      (a, b) => a.community.localeCompare(b.community) || a.type.localeCompare(b.type)
    ),
  });

  if (changed.length === 0 && !geocacheChanged) {
    console.log('  No changes: the data was already up to date.');
  } else {
    for (const file of changed) console.log(`  → data/events/${file}`);
    if (geocacheChanged) console.log(`  → data/geocache.json (${geocoder.lookups} new lookups)`);
  }

  return allFailed ? 1 : 0;
}

async function runAdapter(
  ingest: Community['ingest'][number],
  community: Community,
  manualEvents: ManualEvent[],
  since: Date
): Promise<RawEvent[]> {
  switch (ingest.type) {
    case 'bevy':
      return fetchBevy(ingest, community, { since });
    case 'ics':
      return fetchIcs(ingest, community, { since });
    case 'jsonld':
      return fetchJsonLd(ingest, community, { since });
    case 'manual':
      return fromManual(manualEvents, community, { since });
  }
}

async function normalizeAll(
  raws: RawEvent[],
  context: Parameters<typeof normalizeEvent>[1]
): Promise<{ events: Event[]; skipped: number }> {
  const events: Event[] = [];
  let skipped = 0;

  for (const raw of raws) {
    const result = await normalizeEvent(raw, context);
    if ('event' in result) events.push(result.event);
    else {
      skipped++;
      console.warn(`    ⚠ ${result.error}`);
    }
  }

  return { events, skipped };
}

async function loadManualEvents(): Promise<ManualEvent[]> {
  const files = await loadYamlDir(path.join(REPO_ROOT, 'sources/events'), ManualEventFileSchema);
  return files.flat();
}

async function loadOverrides(): Promise<Override[]> {
  const files = await loadYamlDir(PATHS.overrides, OverrideSchema.array());
  return files.flat();
}

function printPreview(events: Event[], communities: Community[]): void {
  const names = new Map(communities.map((c) => [c.id, c.name]));
  const upcoming = events
    .filter((event) => new Date(event.start) >= new Date())
    .slice(0, 12);

  if (upcoming.length === 0) {
    console.log('\n  No upcoming events.');
    return;
  }

  console.log('\n  Upcoming events:');
  for (const event of upcoming) {
    const when = new Date(event.start).toLocaleString('en-GB', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const where = event.online ? 'online' : (event.venue?.name ?? 'venue TBC');
    const geo = event.venue?.geo ? '📍' : '  ';
    console.log(
      `  ${geo} ${when}  ${event.title.slice(0, 58).padEnd(58)} ` +
        `${(names.get(event.communityId) ?? event.communityId).slice(0, 18).padEnd(18)} ${where}`
    );
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error('\n✗ Unhandled error:', error instanceof Error ? error.stack : error);
    process.exit(1);
  });
