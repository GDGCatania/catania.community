#!/usr/bin/env node
/**
 * Builds the message for the automatic data commit, from
 * `data/ingest-report.json`. It lives in its own file because the message spans
 * several lines and is passed to `git commit -F`: inlining it would turn into a
 * nightmare of quotes nested inside the workflow YAML.
 */
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(new URL('../data/ingest-report.json', import.meta.url)));

const ok = report.sources.filter((source) => source.ok);
const failed = report.sources.filter((source) => !source.ok);

const lines = [
  `dati: ${report.totalEvents} eventi da ${ok.length} font${ok.length === 1 ? 'e' : 'i'}`,
  '',
];

for (const source of ok) {
  lines.push(`  ${source.community} via ${source.type}: ${source.events}`);
}

if (failed.length > 0) {
  lines.push('', 'Fonti in errore (dati precedenti conservati):');
  for (const source of failed) {
    lines.push(`  ${source.community} via ${source.type}: ${source.error ?? 'errore ignoto'}`);
  }
}

process.stdout.write(`${lines.join('\n')}\n`);
