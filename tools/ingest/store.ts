import { readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { EventFileSchema, type Event, type SourceType } from '../../src/lib/schema.js';
import { PATHS } from './lib/paths.js';
import { writeJsonIfChanged } from './lib/json.js';

/**
 * Event persistence in `data/events/YYYY-MM.json`.
 *
 * Partitioning by month serves two purposes: the bot's commit diffs stay small
 * and readable, and past events are never rewritten (they stay indexed, which is
 * the point of the community archive).
 */

/** The month is read from the local date, not from UTC. */
export function monthKey(event: Event): string {
  return event.start.slice(0, 7);
}

export async function readAllEvents(): Promise<Event[]> {
  let files: string[];
  try {
    files = (await readdir(PATHS.events)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
  } catch {
    return [];
  }

  const events: Event[] = [];
  for (const file of files.sort()) {
    const fullPath = path.join(PATHS.events, file);
    const raw = JSON.parse(await readFile(fullPath, 'utf8'));
    const result = EventFileSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `data/events/${file} is corrupt. Restore it from git rather than editing it by hand:\n` +
          result.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n')
      );
    }
    events.push(...result.data);
  }

  return events;
}

/** Identifies the community+source pair an event came from. */
export function originKey(communityId: string, sourceType: SourceType): string {
  return `${communityId}::${sourceType}`;
}

export interface MergeInput {
  /** Events just downloaded from the sources that answered. */
  fresh: Event[];
  /** Events already in `data/`, from the previous run. */
  existing: Event[];
  /** community+source pairs that answered correctly in this run. */
  succeeded: Set<string>;
  /** Configured pairs: any that disappeared should be forgotten. */
  configured: Set<string>;
  /** Events starting before this instant are archive: leave them alone. */
  since: Date;
}

/**
 * Decides what survives. This is the rule that keeps the site up when a source
 * breaks: if a community+source pair did not answer, its events stay as they
 * were on the last successful run.
 */
export function mergeEvents(input: MergeInput): { events: Event[]; preserved: number } {
  const { fresh, existing, succeeded, configured, since } = input;

  const kept: Event[] = [];
  let preserved = 0;

  for (const event of existing) {
    const origin = originKey(event.communityId, event.source.type);

    // Archive: a past event stays published forever, even once the source stops
    // listing it and even if the community was removed.
    if (new Date(event.start) < since) {
      kept.push(event);
      continue;
    }

    // Configuration is the truth: a source removed from sources/ disappears.
    if (!configured.has(origin)) continue;

    // The source answered: its upcoming events are replaced by `fresh`.
    if (succeeded.has(origin)) continue;

    kept.push(event);
    preserved++;
  }

  return { events: [...kept, ...fresh], preserved };
}

/**
 * `source.fetchedAt` changes by definition on every run. Writing it every time
 * would produce a diff on every event and turn the bot's commits into
 * unreadable noise.
 *
 * So the timestamp is only bumped when the event actually changed: the useful
 * information ("this record was re-read on…") survives without breaking
 * idempotence.
 */
export function preserveFetchedAt(fresh: Event[], existing: Event[]): Event[] {
  const previous = new Map(existing.map((event) => [event.id, event]));

  return fresh.map((event) => {
    const before = previous.get(event.id);
    if (!before) return event;

    const sameContent =
      stableCompare({ ...event, source: withoutFetchedAt(event.source) }) ===
      stableCompare({ ...before, source: withoutFetchedAt(before.source) });

    return sameContent ? { ...event, source: { ...event.source, fetchedAt: before.source.fetchedAt } } : event;
  });
}

function withoutFetchedAt(source: Event['source']): Omit<Event['source'], 'fetchedAt'> {
  const { fetchedAt: _ignored, ...rest } = source;
  return rest;
}

/** Value comparison, independent of key order. */
function stableCompare(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(Object.entries(val as object).sort(([a], [b]) => a.localeCompare(b)));
    }
    return val;
  });
}

/**
 * Writes the events partitioned by month, removing files for months that ended
 * up empty — otherwise they would linger with stale data.
 */
export async function writeEvents(events: Event[]): Promise<{ changed: string[] }> {
  const byMonth = new Map<string, Event[]>();
  for (const event of events) {
    const key = monthKey(event);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(event);
    else byMonth.set(key, [event]);
  }

  const changed: string[] = [];

  for (const [month, monthEvents] of byMonth) {
    // Stable order inside the file: by date, then by id when dates tie.
    monthEvents.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    const file = path.join(PATHS.events, `${month}.json`);
    if (await writeJsonIfChanged(file, monthEvents)) changed.push(`${month}.json`);
  }

  let existingFiles: string[] = [];
  try {
    existingFiles = (await readdir(PATHS.events)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
  } catch {
    // First run: the directory does not exist yet.
  }

  for (const file of existingFiles) {
    const month = file.replace('.json', '');
    if (!byMonth.has(month)) {
      await unlink(path.join(PATHS.events, file));
      changed.push(`${file} (removed)`);
    }
  }

  return { changed };
}
