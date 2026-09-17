import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * The bot commits twice a day, so its message is most of the history. Nothing
 * else in CI reads this script: without a test, it is the one place where the
 * convention in CONTRIBUTING.md can drift back without anyone noticing.
 *
 * It runs against the committed `data/ingest-report.json`, so the assertions
 * are on the shape of the message, never on the numbers of the day.
 */
const ROOT = path.resolve(__dirname, '../..');

function generate(): string {
  return execFileSync('node', ['tools/commit-message.mjs'], { cwd: ROOT, encoding: 'utf8' });
}

describe('bot commit message', () => {
  it('writes a Conventional Commits subject in English', () => {
    const [subject] = generate().split('\n');

    expect(subject).toMatch(/^chore\(data\): \d+ events? from \d+ sources?$/);
  });

  it('separates the subject from the body with a blank line', () => {
    const lines = generate().split('\n');

    expect(lines[1]).toBe('');
  });

  it('lists one indented line per source that answered', () => {
    const body = generate().split('\n').slice(2);
    const listed = body.filter((line) => /^ {2}\S+ via \S+: \d+$/.test(line));

    const subject = generate().split('\n')[0]!;
    const sources = Number(/from (\d+) source/.exec(subject)?.[1]);

    expect(listed).toHaveLength(sources);
  });
});