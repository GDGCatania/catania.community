import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Deterministic serialisation: keys in alphabetical order and a trailing
 * newline. Without it two identical runs would produce different diffs and the
 * bot's commits would become unreadable noise.
 */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();

  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    // undefined keys must not show up as `null` in the file.
    if (source[key] !== undefined) sorted[key] = sortKeys(source[key]);
  }
  return sorted;
}

/** Writes only when the content changes, keeping `git status` clean. */
export async function writeJsonIfChanged(filePath: string, value: unknown): Promise<boolean> {
  const next = stableStringify(value);
  let current: string | null = null;
  try {
    current = await readFile(filePath, 'utf8');
  } catch {
    // New file.
  }
  if (current === next) return false;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, next, 'utf8');
  return true;
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}
