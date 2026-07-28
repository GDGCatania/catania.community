import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';

/**
 * Reads a directory of YAML files and validates them against a Zod schema.
 * An invalid file stops everything: that is an authoring mistake, not a network
 * hiccup, and it has to be fixed before publishing.
 */
export async function loadYamlDir<S extends z.ZodType>(
  dir: string,
  schema: S
): Promise<Array<z.infer<S>>> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch {
    return []; // Missing directory: no data, not an error.
  }

  const items: Array<z.infer<S>> = [];

  // Alphabetical: the output must not depend on filesystem ordering.
  for (const file of files.sort()) {
    const fullPath = path.join(dir, file);
    const raw = parse(await readFile(fullPath, 'utf8'));
    if (raw === null || raw === undefined) continue; // Empty file, or only comments.

    const result = schema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  · ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
      throw new Error(`${path.relative(process.cwd(), fullPath)} is not valid:\n${issues}`);
    }

    items.push(result.data);
  }

  return items;
}
