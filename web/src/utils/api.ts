// Centralized API utilities
import * as Sentry from '@sentry/browser';
import { API_BASE_URL, DEFAULT_FETCH_HEADERS, FETCH_TIMEOUT_MS } from './constants.ts';
import { createTimeoutSignal } from './timeout-signal.ts';
import { votedSince, votedWithinCacheWindow } from './recent-vote.ts';
import type { Law, Category, PaginatedResponse, RelatedLawsResponse, ListResponse } from '../types/app.d.ts';

function isFetchTransportError(error: unknown): boolean {
  // DOMException doesn't extend Error in every runtime (notably jsdom), so
  // accept it directly — AbortSignal.timeout() rejects with DOMException.
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError' || error.name === 'TimeoutError';
  }
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    (
      error instanceof TypeError &&
      /networkerror.*fetch|failed to fetch|load failed|network request failed/i.test(error.message)
    )
  );
}

/**
 * Fetches from API with automatic fallback
 * @param {string} endpoint - API endpoint (e.g., '/api/v1/laws')
 * @param {URLSearchParams|Object} params - Query parameters
 * @param {Object} options - Extra request options
 * @param {RequestCache} options.cache - HTTP cache mode for this request
 * @param {number} options.timeoutMs - Time the request may take before it is aborted (default: FETCH_TIMEOUT_MS)
 * @returns {Promise<any>} JSON response
 */
export async function fetchAPI(
  endpoint: string,
  params: URLSearchParams | Record<string, string> = {},
  { cache, timeoutMs = FETCH_TIMEOUT_MS }: { cache?: RequestCache; timeoutMs?: number } = {}
): Promise<unknown> {
  const qs = params instanceof URLSearchParams
    ? params
    : new URLSearchParams(params);

  const queryString = qs.toString();
  const url = `${API_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;

  const response = await fetch(url, {
    headers: DEFAULT_FETCH_HEADERS,
    signal: createTimeoutSignal(timeoutMs),
    ...(cache ? { cache } : {}),
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  // Check content-type if headers are available (may not be in test mocks)
  if (response.headers && typeof response.headers.get === 'function') {
    const ct = response.headers.get('content-type') || '';
    if (ct && !ct.includes('application/json')) {
      throw new Error('API returned non-JSON response');
    }
  }

  return await response.json();
}

/**
 * Fetches a single law by ID
 * @param {number|string} lawId - Law ID
 * @returns {Promise<Object>} Law object
 */
export async function fetchLaw(lawId: number | string): Promise<Law> {
  const numericId = Number(lawId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('Invalid law ID');
  }

  const endpoint = `/api/v1/laws/${numericId}`;
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: DEFAULT_FETCH_HEADERS,
    signal: createTimeoutSignal(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch law: ${response.status}`);
  }

  // Check content-type if headers are available (may not be in test mocks)
  if (response.headers && typeof response.headers.get === 'function') {
    const ct = response.headers.get('content-type') || '';
    if (ct && !ct.includes('application/json')) {
      throw new Error('API returned non-JSON response');
    }
  }

  return await response.json();
}

/**
 * Fetches related laws for a given law ID
 * @param {number|string} lawId - Law ID to find related laws for
 * @param {Object} options - Fetch options
 * @param {number} options.limit - Maximum number of related laws to return (1-10, default 5)
 * @returns {Promise<Object>} Response with data array of related laws and law_id
 */
export async function fetchRelatedLaws(lawId: number | string, { limit = 5 } = {}): Promise<RelatedLawsResponse> {
  const numericId = Number(lawId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('Invalid law ID');
  }

  const params: Record<string, string> = {};
  if (limit && limit !== 5) {
    params.limit = String(limit);
  }

  return await fetchAPI(`/api/v1/laws/${numericId}/related`, params) as RelatedLawsResponse;
}

export async function fetchDuplicateCandidates(text: string, { limit = 5 } = {}): Promise<PaginatedResponse<Law>> {
  const trimmed = text.trim();
  if (trimmed.length < 10) {
    return { data: [], total: 0, limit: 0, offset: 0 };
  }
  return await fetchAPI('/api/v1/laws/duplicates', { text: trimmed, limit: String(limit) }) as PaginatedResponse<Law>;
}

export async function fetchRelatedCategories(slug: string, { limit = 6 } = {}): Promise<ListResponse<Category>> {
  return await fetchAPI(`/api/v1/categories/${slug}/related`, { limit: String(limit) }) as ListResponse<Category>;
}

/**
 * Fetches laws with pagination and sorting
 * @param {Object} options - Fetch options
 * @param {number} options.limit - Number of laws to fetch
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.sort - Sort field
 * @param {string} options.order - Sort order (asc/desc)
 * @param {string} options.q - Search query
 * @param {number} options.category_id - Category ID to filter by
 * @param {string} options.attribution - Attribution name to filter by
 * @returns {Promise<Object>} Response with data and total
 */
interface FetchLawsOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  order?: string;
  q?: string;
  category_id?: number | string;
  category_slug?: string;
  attribution?: string;
  /** When true, exclude corollaries whose parent law is published (a corollary under an unpublished parent stays listed) */
  exclude_corollaries?: boolean;
}

export async function fetchLaws({ limit = 25, offset = 0, sort = 'score', order = 'desc', q = '', category_id, category_slug, attribution, exclude_corollaries }: FetchLawsOptions = {}): Promise<PaginatedResponse<Law>> {
  const params: Record<string, string> = {
    limit: String(limit),
    offset: String(offset),
    sort,
    order
  };

  if (q && q.trim()) {
    params.q = q.trim();
  }

  if (category_id) {
    params.category_id = String(category_id);
  }

  if (category_slug) {
    params.category_slug = String(category_slug);
  }

  if (attribution && attribution.trim()) {
    params.attribution = attribution.trim();
  }

  if (exclude_corollaries) {
    params.exclude_corollaries = '1';
  }

  return await fetchAPI('/api/v1/laws', params) as PaginatedResponse<Law>;
}

/**
 * Fetches the Law of the Day
 * Returns the daily rotating law selected by the algorithm:
 * - Highest upvotes
 * - Not featured in last 365 days
 * - If tie, sorted alphabetically by text
 * When an early request (see index.html) is adopted, it and this call share one FETCH_TIMEOUT_MS window that starts
 * with the early request, so a call that is still pending then rejects with a TimeoutError at that deadline. Without
 * an early request the call gets a window of its own.
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchLawOfTheDay(): Promise<PaginatedResponse<Law>> {
  // Adopt the request the home page started before the bundle loaded (see index.html), if there is one
  const early = takeEarlyLawOfDay();
  const earlyLaw = early ? await waitForEarlyLaw(early) : null;
  const law = earlyLaw ?? await requestLawOfTheDay(early);
  // Return in same format as fetchLaws for compatibility
  return { data: [law], total: 1, limit: 1, offset: 0 };
}

const LAW_OF_THE_DAY_PATH = '/api/v1/law-of-day';

function timeoutError(): Error {
  const error = new Error('The Law of the Day request timed out');
  error.name = 'TimeoutError';
  return error;
}

/**
 * What is left of the one FETCH_TIMEOUT_MS window that began when the early request started. Clamped to the window
 * itself, so a wall clock that stepped backwards after the script ran cannot stretch it.
 */
function remainingEarlyWindow(early: EarlyLawOfDay): number {
  return Math.min(FETCH_TIMEOUT_MS, Math.max(0, FETCH_TIMEOUT_MS - (Date.now() - early.startedAt)));
}

/**
 * The app's own request for the Law of the Day. When an early request was adopted, the whole attempt shares the one
 * window that began when that request started: this request gets what is left of it, and when nothing is left (the
 * early request timed out, or ran out the clock) there is no second try and the caller shows its error state, whose
 * button asks again with a window of its own. A request that failed quickly leaves nearly the full window, so the
 * fallback request stays useful. The window is also enforced with a timer, because a request cannot be aborted where
 * there is no AbortController.
 */
async function requestLawOfTheDay(early: EarlyLawOfDay | null): Promise<Law> {
  const budget = early ? remainingEarlyWindow(early) : FETCH_TIMEOUT_MS;
  if (budget === 0) throw timeoutError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(timeoutError()), budget);
  });
  try {
    // The API lets caches reuse this response for up to a minute, so right after a vote ask the network: a cached
    // copy could show a count without the visitor's own vote next to their voted highlight.
    const cache = votedWithinCacheWindow() ? 'no-cache' : undefined;
    const payload = await Promise.race([fetchAPI(LAW_OF_THE_DAY_PATH, {}, { cache, timeoutMs: budget }), deadline]);
    return (payload as { law: Law }).law;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How old a result of the early request may be and still be adopted. The law changes at midnight UTC; this window
 * only bounds how stale a tab's unconsumed result can get (the bundle normally adopts it within seconds). A result
 * inside the window is used as it is, even if midnight UTC passed in between.
 */
const EARLY_LAW_MAX_AGE_MS = 60_000;

/**
 * Outcomes that are expected on a bad connection, in a long-open tab or after a vote in another tab; like
 * fetchSuggestions, these are not sent as events
 */
const EARLY_TRANSPORT_FAILURES = new Set(['timeout', 'abort', 'network', 'stale', 'voted']);

function freshEarlyLawOfDay(): EarlyLawOfDay | null {
  const early = window.__earlyLawOfDay;
  // Only an answer from the API the app would ask itself, a recent one, and one that does not predate a vote
  // (a visit that started on the home page, went to a law page and voted there)
  const usable = early && early.url === `${API_BASE_URL}${LAW_OF_THE_DAY_PATH}` && Date.now() - early.startedAt <= EARLY_LAW_MAX_AGE_MS && !votedSince(early.startedAt);
  return usable ? early : null;
}

/**
 * Hands out the early request once (the usable one, or nothing) and forgets it either way. A request that exists
 * but cannot be used is reported: a script that asked another API than the app uses (a build that did not wire the
 * API base) would otherwise waste a request on every visit without anyone noticing.
 */
function takeEarlyLawOfDay(): EarlyLawOfDay | null {
  const raw = window.__earlyLawOfDay;
  const early = freshEarlyLawOfDay();
  window.__earlyLawOfDay = undefined;
  if (raw && !early) {
    // Same API: either too old or made obsolete by a vote since it started; another API is a wiring mistake
    const reason = raw.url !== `${API_BASE_URL}${LAW_OF_THE_DAY_PATH}` ? 'url-mismatch' : votedSince(raw.startedAt) ? 'voted' : 'stale';
    reportEarlyFailure(reason, { url: raw.url });
  }
  return early;
}

/**
 * Waits for the early request, but only until its own 10 s are up, counted from when it started (not from now), even
 * if it never settles. Returns null when the caller has to ask again (with whatever is left of that 10 s, see
 * requestLawOfTheDay). Reports a recorded failure, including a failed early paint of a law that is still returned
 * (the inline script cannot report: Sentry is not running yet).
 */
async function waitForEarlyLaw(early: EarlyLawOfDay): Promise<Law | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), remainingEarlyWindow(early));
  });
  // The script's promise never rejects; if it ever did, fall back to the app's own request instead of failing the page
  const settled = early.promise.catch((): null => {
    early.error ??= 'error';
    return null;
  });
  try {
    const result = await Promise.race([settled, timeout]);
    const reason = early.error ?? (result === 'timeout' ? 'timeout' : null);
    if (reason) reportEarlyFailure(reason);
    return result === 'timeout' ? null : result;
  } finally {
    clearTimeout(timer);
  }
}

function reportEarlyFailure(reason: string, extra: Record<string, string> = {}): void {
  const message = `Early Law of the Day failed: ${reason}`;
  Sentry.addBreadcrumb({ category: 'law-of-day', level: 'warning', message });
  if (!EARLY_TRANSPORT_FAILURES.has(reason)) {
    Sentry.captureMessage(message, { level: 'warning', extra: { reason, ...extra } });
  }
}

/**
 * The Law of the Day the early request has already fetched, or null while it is pending or failed, and for a result
 * from another API, older than a minute or started before the last vote. Does not consume it: call consumeEarlyLawOfTheDay() once the law is used.
 */
export function peekEarlyLawOfTheDay(): Law | null {
  return freshEarlyLawOfDay()?.law ?? null;
}

/**
 * Takes over the early Law of the Day request started by the inline script in index.html, so the home page
 * does not issue a second request. Returns a promise that never rejects (null when the early request failed),
 * or null when there is nothing to adopt. Only the first call gets it: a later visit or a retry fetches again.
 * Reports a failure the early script already recorded (such as a failed early paint of a law that is still good),
 * and an early request it has to drop (see takeEarlyLawOfDay).
 */
export function consumeEarlyLawOfTheDay(): Promise<Law | null> | null {
  const early = takeEarlyLawOfDay();
  if (early?.error) reportEarlyFailure(early.error);
  return early?.promise ?? null;
}

/**
 * Fetches top voted laws
 * @param {number} limit - Number of laws to fetch
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchTopVoted(limit = 3): Promise<PaginatedResponse<Law>> {
  return await fetchLaws({ limit, offset: 0, sort: 'upvotes', order: 'desc' });
}

/**
 * Fetches trending laws (recently voted)
 * @param {number} limit - Number of laws to fetch
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchTrending(limit = 3): Promise<PaginatedResponse<Law>> {
  return await fetchLaws({ limit, offset: 0, sort: 'last_voted_at', order: 'desc' });
}

/**
 * Fetches recently added laws
 * @param {number} limit - Number of laws to fetch
 * @returns {Promise<Object>} Response with law data
 */
export async function fetchRecentlyAdded(limit = 3): Promise<PaginatedResponse<Law>> {
  return await fetchLaws({ limit, offset: 0, sort: 'created_at', order: 'desc' });
}

/**
 * Fetches all categories
 * @returns {Promise<Object>} Response with category data
 */
export async function fetchCategories(): Promise<ListResponse<Category>> {
  return await fetchAPI('/api/v1/categories') as ListResponse<Category>;
}

/**
 * Fetches search suggestions for autocomplete
 * @param {Object} options - Fetch options
 * @param {string} options.q - Search query (min 2 characters)
 * @param {number} options.limit - Number of suggestions to fetch (default: 10, max: 20)
 * @returns {Promise<Object>} Response with suggestions data
 */
export async function fetchSuggestions({ q, limit = 10 }: { q?: string | null; limit?: number } = {}): Promise<PaginatedResponse<Law>> {
  if (q == null || typeof q !== 'string' || q.trim().length < 2) {
    return { data: [], total: 0, limit: 0, offset: 0 };
  }

  const params = {
    q: q.trim(),
    limit: String(Math.min(limit, 20))
  };

  try {
    return await fetchAPI('/api/v1/laws/suggestions', params) as PaginatedResponse<Law>;
  } catch (error) {
    // Gracefully handle errors - return empty array
    if (!isFetchTransportError(error)) {
      Sentry.captureException(error);
    }
    return { data: [], total: 0, limit: 0, offset: 0 };
  }
}
