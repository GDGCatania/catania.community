#!/usr/bin/env node
import { access, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import {
  CommunitySchema,
  ManualEventSchema,
  CATEGORIES,
  AREAS,
  PRICE_TYPES,
  type Community,
} from '../src/lib/schema.js';
import type { z } from 'zod';
import { slugify } from './ingest/lib/text.js';
import { PATHS } from './ingest/lib/paths.js';
import { localIsoWithOffset } from './ingest/lib/time.js';
import { loadYamlDir } from './ingest/lib/yaml.js';

/**
 * Turns the body of an Issue Form into YAML files.
 *
 *   tools/issue-to-yaml.ts            → `sources/communities/<slug>.yml`
 *   tools/issue-to-yaml.ts event      → `sources/events/<date>-<slug>.yml`,
 *                                       plus the community file when the
 *                                       organiser is not listed yet
 *
 * Reads the body from stdin. For a community it prints the slug on stdout; for
 * an event, `key=value` lines ready to append to `$GITHUB_OUTPUT`.
 *
 * Important: the YAML is produced with the library's `stringify`, never by
 * concatenating strings. A name like "AperiTech #42" written by hand without
 * quotes would come back as "AperiTech", because `#` opens a comment — data
 * lost in silence, which is the worst way to lose it.
 *
 * GitHub writes the field *labels* into the issue body, not their ids, so the
 * labels below must match `.github/ISSUE_TEMPLATE/new-community.yml` exactly
 * (case aside). Renaming a field there means renaming it here too.
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

/**
 * Meetup puts an optional locale before the group — `/it-IT/<group>/` — and
 * organisers paste whichever URL their browser was showing: the group, its
 * events tab, or a single event. All of them identify the same group, so all of
 * them reduce to the same listing page.
 */
const MEETUP_GROUP = /^\/(?:[a-z]{2}-[a-zA-Z]{2}\/)?([^/]+)/;

/**
 * Turns an events URL into a `jsonld` source, when the host is one the adapter
 * has a discovery rule for. Anything else returns nothing: guessing a listing
 * strategy for an unchecked platform is how a source breaks silently.
 */
function jsonLdSource(eventsUrl: string): Record<string, unknown> | undefined {
  let url: URL;
  try {
    url = new URL(eventsUrl);
  } catch {
    return undefined;
  }

  if (url.host.endsWith('meetup.com')) {
    const group = MEETUP_GROUP.exec(url.pathname)?.[1];
    // `/find/`, `/pro/` and friends are not groups.
    if (!group || ['find', 'pro', 'topics', 'cities', 'members'].includes(group)) return undefined;
    return { type: 'jsonld', list: `https://www.meetup.com/${group}/events/` };
  }

  if (/(^|\.)eventbrite\.[a-z.]+$/.test(url.host)) {
    // An organiser page lists events; a single event page is just itself.
    if (url.pathname.startsWith('/o/')) return { type: 'jsonld', list: url.href };
    if (url.pathname.startsWith('/e/')) return { type: 'jsonld', urls: [url.href] };
  }

  return undefined;
}

function detectIngest(eventsUrl: string, icsUrl: string) {
  const ingest: Array<Record<string, unknown>> = [];

  if (icsUrl) ingest.push({ type: 'ics', url: icsUrl });

  // A Bevy chapter is recognisable from the host, but the numeric id has to be
  // read off the page: leave it to whoever reviews the PR rather than guess.
  if (/gdg\.community\.dev|\.bevy\.com/.test(eventsUrl)) {
    ingest.push({ type: 'bevy', chapter: 0, _todo: `chapter id to be read from ${eventsUrl}` });
  }

  const jsonLd = jsonLdSource(eventsUrl);
  if (jsonLd) ingest.push(jsonLd);

  if (ingest.length === 0) ingest.push({ type: 'manual' });

  return ingest;
}

export function buildCommunity(fields: Record<string, string>) {
  const name = pick(fields, 'Community name', 'name');
  if (!name) throw new Error('The issue has no community name.');

  const eventsUrl = pick(fields, 'Where you publish your events', 'events_url');
  const icsUrl = pick(fields, '.ics feed, if you have one', 'ics_url');
  const website = pick(fields, 'Website', 'website');
  const tagline = pick(fields, 'In one line', 'tagline');

  const categories = parseList(pick(fields, 'Topics', 'categories')).filter(
    (category): category is (typeof CATEGORIES)[number] =>
      (CATEGORIES as readonly string[]).includes(category)
  );

  const areaRaw = pick(fields, 'Where you usually meet', 'area').toLowerCase();
  const area = (AREAS as readonly string[]).includes(areaRaw) ? areaRaw : 'citta';

  const links: Record<string, string> = {};
  if (website) links.website = website;
  // The events URL doubles as the website when no website was given.
  if (!website && /^https?:\/\//.test(eventsUrl)) links.website = eventsUrl;

  for (const line of pick(fields, 'Other contacts', 'contacts').split('\n')) {
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

function tryUrl(value: string): URL | undefined {
  if (!/^https?:\/\//i.test(value)) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/** `https://www.Example.org/group/` and `example.org/group` are the same page. */
function comparableUrl(url: URL): string {
  return `${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
}

/**
 * Finds the community a reporter meant. Issue Forms cannot offer a dropdown
 * filled at runtime, so this is free text: a slug, a name, a page of this site
 * or one of the community's own links. No fuzzy matching: a wrong guess would
 * credit the event to someone else, which is worse than asking.
 */
export function matchCommunity(query: string, communities: Community[]): Community | undefined {
  const value = query.trim();
  if (!value) return undefined;

  const url = tryUrl(value);
  if (url) {
    const ownPage = /\/communities\/([a-z0-9-]+)/.exec(url.pathname)?.[1];
    const byPage = ownPage ? communities.find((c) => c.id === ownPage) : undefined;
    if (byPage) return byPage;

    const target = comparableUrl(url);
    return communities.find((c) =>
      Object.values(c.links).some((link) => {
        const linkUrl = tryUrl(String(link));
        return linkUrl !== undefined && comparableUrl(linkUrl) === target;
      })
    );
  }

  const slug = slugify(value, 60);
  return communities.find((c) => c.id === slug || slugify(c.name, 60) === slug);
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// "18.30" is how times are often written in Italy: accept it as "18:30".
const TIME = /^(\d{1,2})[:.](\d{2})$/;

function parseDate(value: string): string {
  const match = DATE.exec(value.trim());
  const [year, month, day] = match ? match.slice(1).map(Number) : [];
  const date = match ? new Date(Date.UTC(year!, month! - 1, day!)) : undefined;

  if (!date || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) {
    throw new Error(`The date "${value}" is not valid: write it as YYYY-MM-DD, e.g. 2026-11-14.`);
  }
  return value.trim();
}

function parseTime(value: string, label: string): string {
  const match = TIME.exec(value.trim());
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);

  if (!match || hour > 23 || minute > 59) {
    throw new Error(`The ${label} "${value}" is not valid: write it as HH:MM, e.g. 18:30.`);
  }
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

/** A yes/no dropdown, or a checkbox (which arrives as a task list: `- [X] label`). */
function isYes(value: string): boolean {
  return /^yes$/i.test(value.trim()) || /\[x\]/i.test(value);
}

export interface BuiltEvent {
  /** What is written is what was given, without the schema's defaults filled in. */
  event: z.input<typeof ManualEventSchema>;
  /** `sources/events/<file>`: one file per event, so two reports never conflict. */
  file: string;
  /** Set when the organiser is not listed yet and has to be added too. */
  community?: ReturnType<typeof buildCommunity>;
}

export function buildEvent(fields: Record<string, string>, communities: Community[]): BuiltEvent {
  const title = pick(fields, 'Event title', 'event_title');
  if (!title) throw new Error('The issue has no event title.');

  const communityQuery = pick(fields, 'Organising community', 'community');
  if (!communityQuery) throw new Error('The issue does not say which community organises the event.');

  const communityUrl = pick(fields, 'Community website, if it is not listed yet', 'community_url');

  const categories = parseList(pick(fields, 'Topics', 'categories')).filter(
    (category): category is (typeof CATEGORIES)[number] =>
      (CATEGORIES as readonly string[]).includes(category)
  );

  const online = isYes(pick(fields, 'Online', 'online'));

  const existing =
    matchCommunity(communityQuery, communities) ??
    (communityUrl ? matchCommunity(communityUrl, communities) : undefined);

  let community: BuiltEvent['community'];
  if (!existing) {
    if (!communityUrl || tryUrl(communityQuery)) {
      throw new Error(
        `No community on the site matches "${communityQuery}". ` +
          'If it is not listed yet, give its name and its website, and the pull request will add it too.'
      );
    }

    community = buildCommunity({
      'community name': communityQuery,
      'where you publish your events': communityUrl,
      topics: categories.join(', '),
      'where you usually meet': online ? 'online' : 'citta',
    });
  }

  const communityId = existing?.id ?? community!.id;

  const date = parseDate(pick(fields, 'Date', 'date'));
  const start = localIsoWithOffset(date, parseTime(pick(fields, 'Start time', 'start_time'), 'start time'));
  const endTime = pick(fields, 'End time', 'end_time');
  const end = endTime ? localIsoWithOffset(date, parseTime(endTime, 'end time')) : undefined;

  if (end && Date.parse(end) <= Date.parse(start)) {
    throw new Error(
      `The event ends (${endTime}) before it starts: if it runs past midnight, ` +
        'leave the end time empty and mention it in the description.'
    );
  }

  const venueName = pick(fields, 'Venue name', 'venue');
  const address = pick(fields, 'Address', 'address');
  const description = pick(fields, 'Description', 'description');

  const priceRaw = pick(fields, 'Price', 'price').toLowerCase();
  const priceType = (PRICE_TYPES as readonly string[]).includes(priceRaw)
    ? (priceRaw as (typeof PRICE_TYPES)[number])
    : 'free';

  const event: BuiltEvent['event'] = {
    title,
    communityId,
    start,
    ...(end ? { end } : {}),
    url: pick(fields, 'Event page', 'url'),
    ...(description ? { description } : {}),
    // An address with no name still places the event: it becomes the name.
    ...(venueName || address
      ? { venue: { name: venueName || address, ...(venueName && address ? { address } : {}) } }
      : {}),
    online,
    price: { type: priceType },
    // Left out, the event inherits the community's topics at ingest.
    ...(categories.length > 0 ? { categories } : {}),
  };

  // Same rule as for communities: fail in the workflow, not in the PR.
  const parsed = ManualEventSchema.safeParse(event);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`The issue does not describe a valid event:\n${issues}`);
  }

  return {
    event,
    file: `${date}-${slugify(title, 60)}.yml`,
    community,
  };
}

const HEADER = [
  '# Generated by tools/issue-to-yaml.ts from an Issue Form.',
  '# Before merging: check the links and resolve any _todo entries.',
  '',
].join('\n');

async function writeCommunity(community: ReturnType<typeof buildCommunity>): Promise<string> {
  const file = path.join(PATHS.communities, `${community.id}.yml`);
  await mkdir(PATHS.communities, { recursive: true });
  await writeFile(file, HEADER + stringify(community, { lineWidth: 100 }), 'utf8');
  return file;
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false
  );
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString('utf8');
  const fields = parseIssueForm(body);

  if (process.argv[2] !== 'event') {
    const community = buildCommunity(fields);
    await writeCommunity(community);
    // The workflow uses the slug to name the branch and the pull request.
    process.stdout.write(community.id);
    return;
  }

  const communities = await loadYamlDir(PATHS.communities, CommunitySchema);
  const { event, file, community } = buildEvent(fields, communities);

  const eventFile = path.join(PATHS.manualEvents, file);
  if (await exists(eventFile)) {
    throw new Error(`sources/events/${file} already exists: the event is probably listed already.`);
  }

  await mkdir(PATHS.manualEvents, { recursive: true });
  await writeFile(eventFile, HEADER + stringify([event], { lineWidth: 100 }), 'utf8');
  const communityFile = community ? await writeCommunity(community) : undefined;

  const relative = (p: string) => path.relative(process.cwd(), p);
  process.stdout.write(
    [
      `slug=${file.replace(/\.yml$/, '')}`,
      `paths=${[eventFile, communityFile].filter(Boolean).map((p) => relative(p!)).join(' ')}`,
      `community=${community?.id ?? ''}`,
    ].join('\n') + '\n'
  );
}

// Only runs from the command line: importing it from a test does nothing.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
