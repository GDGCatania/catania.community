/** Text helpers shared by the adapters. */

/** URL-safe ASCII slug: "AperiTech #42 — Agenti LLM" → "aperitech-42-agenti-llm". */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // drop the diacritics
    .replace(/[’'`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) return slug;
  // Cut back to the previous hyphen so a word is not chopped in half.
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '');
}

/**
 * Turns the HTML descriptions (Bevy sends them with tags) into plain text.
 * This is not a parser: the sources are few and known, and the result ends up
 * in a meta attribute or a paragraph, never injected as markup.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Comparison key for titles coming from different sources (dedup). */
export function normalizeForCompare(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
