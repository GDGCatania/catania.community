import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** tools/ingest/lib → repository root. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

export const PATHS = {
  communities: path.join(REPO_ROOT, 'sources/communities'),
  venues: path.join(REPO_ROOT, 'sources/venues'),
  events: path.join(REPO_ROOT, 'data/events'),
  overrides: path.join(REPO_ROOT, 'data/overrides'),
  geocache: path.join(REPO_ROOT, 'data/geocache.json'),
  ingestReport: path.join(REPO_ROOT, 'data/ingest-report.json'),
} as const;
