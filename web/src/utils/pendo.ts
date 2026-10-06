/**
 * Pendo Track Events helper.
 *
 * Sends client-side Track Events through the Pendo agent (`window.pendo.track`).
 * The agent attaches the visitor, account, URL and timestamp itself, so callers
 * only pass event-specific properties. Calls are no-ops when the agent is not
 * loaded (local dev, tests, blocked script) and never throw into app code.
 */
import type { SearchFilters } from '../types/app.d.ts';

/**
 * Track Event names registered in Pendo. Pendo matches these exactly
 * (case-sensitive), so never rename them without updating Pendo too.
 */
export type PendoTrackEventName =
  | 'search_performed'
  | 'search_no_results'
  | 'search_result_opened'
  | 'search_suggestion_selected'
  | 'categories_filtered'
  | 'law_voted'
  | 'law_vote_failed'
  | 'law_shared'
  | 'law_not_found'
  | 'law_favorite_toggled'
  | 'favorites_cleared'
  | 'calculator_used'
  | 'calculator_result_shared'
  | 'law_submitted'
  | 'law_submission_failed'
  | 'law_duplicate_detected'
  | 'experiment_exposed'
  | 'content_exported'
  | 'pwa_install_prompt_responded'
  | 'pwa_installed'
  | 'theme_changed';

export type PendoPropertyValue = string | number | boolean | null | undefined;
export type PendoTrackProperties = Record<string, PendoPropertyValue>;

// Pendo rejects property payloads over 512 bytes, so cap every string value.
const MAX_STRING_LENGTH = 100;

function truncate(value: string): string {
  return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
}

/**
 * Send a Track Event to Pendo. Empty (null/undefined) and non-finite values are
 * dropped and long strings are truncated to keep the payload within limits.
 */
export function trackPendoEvent(name: PendoTrackEventName, properties: PendoTrackProperties = {}): void {
  /* v8 ignore start -- SSR guard: window is always defined in the browser/jsdom */
  const pendo = typeof window !== 'undefined' ? window.pendo : undefined;
  /* v8 ignore stop */
  if (!pendo || typeof pendo.track !== 'function') return;

  const payload: Record<string, string | number | boolean> = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    payload[key] = typeof value === 'string' ? truncate(value) : value;
  });

  try {
    pendo.track(name, payload);
  } catch {
    // Analytics must never break the user flow.
  }
}

/** Current path without query string, for events that need page context as a property. */
export function getPagePath(): string {
  /* v8 ignore start -- SSR guard: window is always defined in the browser/jsdom */
  return typeof window !== 'undefined' ? window.location.pathname : '';
  /* v8 ignore stop */
}

/**
 * Free-text queries are lower-cased, whitespace-collapsed and truncated before
 * they leave the browser.
 */
export function normalizeQuery(query: string | null | undefined): string {
  return truncate((query ?? '').trim().replace(/\s+/g, ' ').toLowerCase());
}

/** Search context shared by the search_* events. */
export function getSearchProperties(filters: SearchFilters, sort: string): PendoTrackProperties {
  const query = filters.q ?? '';
  const categoryId = filters.category_id;
  return {
    query: normalizeQuery(query) || undefined,
    query_length: query.trim().length,
    category_id: categoryId !== undefined && categoryId !== '' ? String(categoryId) : undefined,
    attribution: filters.attribution || undefined,
    sort,
  };
}

/** Message of a caught error, for an error_message property. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Ordered rules mapping the user-facing messages from utils/request.ts (and the
// API's JSON error bodies) to a stable error type.
const REQUEST_ERROR_TYPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/rate limit/i, 'rate_limited'],
  [/timed out|timeout/i, 'timeout'],
  [/network error|failed to fetch|load failed/i, 'network'],
  [/invalid response|non-json/i, 'invalid_response'],
  [/server encountered an error|internal server error/i, 'server_error'],
  [/not found/i, 'not_found'],
  [/permission/i, 'forbidden'],
  [/must be|is required|invalid/i, 'validation'],
];

/** Classify a failed API request for analytics (e.g. 'rate_limited', 'timeout', 'validation'). */
export function getRequestErrorType(error: unknown): string {
  const message = getErrorMessage(error);
  const match = REQUEST_ERROR_TYPES.find(([pattern]) => pattern.test(message));
  return match ? match[1] : 'unknown';
}
