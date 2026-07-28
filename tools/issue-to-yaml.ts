#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { CommunitySchema, CATEGORIES, AREAS } from '../src/lib/schema.js';
import { slugify } from './ingest/lib/text.js';
import { PATHS } from './ingest/lib/paths.js';

/**
 * Turns the body of an Issue Form into a community YAML file.
 *
 * Reads the body from stdin, writes `sources/communities/<slug>.yml`, and
 * prints the slug on stdout for the next step of the workflow.
 *
 * Important: the YAML is produced with the library's `stringify`, never by
 * concatenating strings. A name like "AperiTech #42" written by hand without
 * quotes would come back as "AperiTech", because `#` opens a comment — data
 * lost in silence, which is the worst way to lose it.
 *
 * The field labels below are Italian because the Issue Forms are: they are the
 * contribution surface for local organisers. Translating a form means
 * translating these labels alongside it.
 */

/**
 * GitHub serialises Issue Forms as `### Label\n\nvalue`.
 * Fields left blank come through as `_No response_`.
 */
export function parseIssueForm(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const sections = body.split(/^###\s+/m).slice(1);

  for (const section of sections) {
    const newline = section.indexOf('\n');
    if (newline === -1) continue;

    const label = section.slice(0, newline).trim();
    const value = section.slice(newline + 1).trim();
    if (!label) continue;

    fields[label.toLowerCase()] = value === '_No response_' ? '' : value;
  }

  return fields;
}

function pick(fields: Record<string, string>, ...labels: string[]): string {
  for (const label of labels) {
    const value = fields[label.toLowerCase()];
    if (value) return value;
  }
  return '';
}

/** Multi-select answers arrive either as "a, b" or as a bullet list. */
function parseList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim().toLowerCase())
    .filter(Boolean);
}

function detectIngest(eventsUrl: string, icsUrl: string) {
  const ingest: Array<Record<string, unknown>> = [];

  if (icsUrl) ingest.push({ type: 'ics', url: icsUrl });

  // A Bevy chapter is recognisable from the host, but the numeric id has to be
  // read off the page: leave it to whoever reviews the PR rather than guess.
  if (/gdg\.community\.dev|\.bevy\.com/.test(eventsUrl)) {
    ingest.push({ type: 'bevy', chapter: 0, _todo: `chapter id to be read from ${eventsUrl}` });
  }

  if (ingest.length === 0) ingest.push({ type: 'manual' });

  return ingest;
}

export function buildCommunity(fields: Record<string, string>) {
  const name = pick(fields, 'Nome della community', 'name');
  if (!name) throw new Error('The issue has no community name.');

  const eventsUrl = pick(fields, 'Dove pubblicate gli eventi', 'events_url');
  const icsUrl = pick(fields, "Feed .ics, se ce l'avete", 'ics_url');
  const website = pick(fields, 'Sito', 'website');
  const tagline = pick(fields, 'In una riga', 'tagline');

  const categories = parseList(pick(fields, 'Argomenti', 'categories')).filter(
    (category): category is (typeof CATEGORIES)[number] =>
      (CATEGORIES as readonly string[]).includes(category)
  );

  const areaRaw = pick(fields, 'Dove vi trovate di solito', 'area').toLowerCase();
  const area = (AREAS as readonly string[]).includes(areaRaw) ? areaRaw : 'citta';

  const links: Record<string, string> = {};
  if (website) links.website = website;
  // The events URL doubles as the website when no website was given.
  if (!website && /^https?:\/\//.test(eventsUrl)) links.website = eventsUrl;

  for (const line of pick(fields, 'Altri contatti', 'contacts').split('\n')) {
    const url = line.trim();
    if (!/^https?:\/\//.test(url)) continue;
    if (url.includes('t.me') || url.includes('telegram')) links.telegram = url;
    else if (url.includes('instagram')) links.instagram = url;
    else if (url.includes('linkedin')) links.linkedin = url;
    else if (url.includes('github')) links.github = url;
    else if (url.includes('meetup')) links.meetup = url;
    else if (url.includes('lu.ma')) links.luma = url;
  }

  const community = {
    id: slugify(name, 60),
    name,
    ...(tagline ? { tagline } : {}),
    categories: categories.length > 0 ? categories : ['tech'],
    area,
    links,
    ingest: detectIngest(eventsUrl, icsUrl),
    active: true,
  };

  // The very schema the crawlers use: what fails here would fail in production
  // too. Better to fail in the workflow than to open a broken PR.
  const parsed = CommunitySchema.safeParse({
    ...community,
    ingest: community.ingest.filter((entry) => entry.type !== 'bevy' || entry.chapter !== 0),
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`The issue does not describe a valid community:\n${issues}`);
  }

  return community;
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString('utf8');

  const community = buildCommunity(parseIssueForm(body));

  const header = [
    '# Generated by tools/issue-to-yaml.ts from an Issue Form.',
    '# Before merging: check the links and resolve any _todo entries.',
    '',
  ].join('\n');

  const file = path.join(PATHS.communities, `${community.id}.yml`);
  await mkdir(PATHS.communities, { recursive: true });
  await writeFile(file, header + stringify(community, { lineWidth: 100 }), 'utf8');

  // The workflow uses the slug to name the branch and the pull request.
  process.stdout.write(community.id);
}

// Only runs from the command line: importing it from a test does nothing.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
