/**
 * Well-behaved fetching: an identifiable User-Agent, one request at a time per
 * host, at least a second between two requests to the same host, and retries
 * with backoff. The sources are free community services: do not hammer them.
 */

export const USER_AGENT = 'catania.community-bot/1.0 (+https://catania.community)';

const MIN_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_RETRIES = 2;

/** Last request time per host, used to serialise the calls. */
const lastRequestAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(host: string): Promise<void> {
  const previous = lastRequestAt.get(host) ?? 0;
  const wait = previous + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string
  ) {
    super(`HTTP ${status} on ${url}`);
    this.name = 'HttpError';
  }
}

/** Downloads a URL as text. Throws HttpError on final 4xx/5xx responses. */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, accept = '*/*' } = options;
  const host = new URL(url).host;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2 ** attempt * 1_000);
    await throttle(host);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: accept },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });

      if (!response.ok) {
        const error = new HttpError(response.status, url);
        // A 4xx (except 429) will not improve on retry: the request is wrong.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) throw error;
        lastError = error;
        continue;
      }

      return await response.text();
    } catch (error) {
      if (error instanceof HttpError && error.status >= 400 && error.status < 500) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Impossibile scaricare ${url}: ${String(lastError)}`);
}

export async function fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const body = await fetchText(url, { ...options, accept: 'application/json' });
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Response from ${url} is not JSON`);
  }
}
