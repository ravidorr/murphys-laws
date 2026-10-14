/**
 * Novus by Pendo agent bootstrap.
 *
 * The inline snippet in index.html stubs `window.pendo` and loads the agent, but only
 * on the canonical production host. This module starts the agent under the same
 * guard so local, preview, Playwright and Lighthouse runs never initialize it.
 */

export const CANONICAL_HOSTNAME = 'murphys-laws.com';

/** localStorage key holding this browser's random visitor id. */
export const VISITOR_ID_STORAGE_KEY = 'murphys_visitor_id';

// Not `_PENDO_T_…`: that prefix marks agent-generated anonymous ids, which Novus
// analytics (funnels, retention, usage totals) do not count as identified visitors.
const VISITOR_ID_PATTERN = /^murphy-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface TelemetryRuntime {
  isProd: boolean;
  mode: string;
  hostname: string | undefined;
}

export interface LocationTransform {
  attr: 'search' | 'hash';
  action: 'AllowOnlyKeys' | 'Replace';
  data: string[] | ((value: string) => string);
}

export interface NovusInitializeOptions {
  visitor?: { id: string };
  location?: { transforms: LocationTransform[] };
  [option: string]: unknown;
}

export interface NovusAgent {
  initialize?: (options?: NovusInitializeOptions) => void;
}

/**
 * Query parameters the app builds itself from fixed values: category id, sort field,
 * sort order and page number. Every other key is dropped from recorded URLs. That
 * deliberately removes `q` and `attribution` (free-text search typed by visitors, which
 * can contain personal or sensitive information) and the calculator-state parameters.
 */
export const ALLOWED_QUERY_KEYS = ['category_id', 'sort', 'order', 'page'];

/**
 * Legacy `#/route?query` links are rewritten to real paths by the router, but the
 * fragment can still be recorded first. Keep the route (`#/browse`) and drop any query
 * carried inside the fragment. Never throws: a throwing transform makes the SDK record
 * the untransformed URL.
 */
export function stripHashRouteQuery(hash: string): string {
  const value = String(hash ?? '');
  if (!value.startsWith('#/')) {
    return value;
  }
  const cut = value.indexOf('?');
  return cut === -1 ? value : value.slice(0, cut);
}

/**
 * Location API transforms, registered at initialize so they apply to every recorded URL.
 * `search` keeps only the allowlisted keys above. `hash` is rewritten rather than
 * cleared because the router still understands legacy `#/route` links.
 */
export const LOCATION_TRANSFORMS: LocationTransform[] = [
  { attr: 'search', action: 'AllowOnlyKeys', data: ALLOWED_QUERY_KEYS },
  { attr: 'hash', action: 'Replace', data: stripHashRouteQuery },
];

export function getTelemetryRuntime(): TelemetryRuntime {
  return {
    isProd: import.meta.env.PROD,
    mode: import.meta.env.MODE,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
  };
}

/**
 * True only for the production build served from the canonical host (or the
 * production-mode test build). Shared by Sentry and the Novus agent.
 */
export function isCanonicalRuntime(runtime: TelemetryRuntime = getTelemetryRuntime()): boolean {
  return runtime.isProd && (runtime.mode === 'test' || runtime.hostname === CANONICAL_HOSTNAME);
}

function generateUuid(): string | null {
  if (typeof crypto === 'undefined') return null;
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto.getRandomValues !== 'function') return null;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * This browser's stable, random visitor id, created on first use and kept in localStorage.
 * It identifies nothing about the person: it is generated here, never derived from
 * anything, and lives only in this browser. Giving visitors an id lets Novus count them
 * as identified, so funnels, retention and usage totals work for a site with no sign-in.
 *
 * Returns '' (the agent then falls back to its own anonymous id) when storage or
 * randomness is unavailable. An id that cannot be saved would change on every page load
 * and inflate visitor counts.
 */
export function getOrCreateVisitorId(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage(),
): string {
  if (!storage) return '';
  try {
    const stored = storage.getItem(VISITOR_ID_STORAGE_KEY);
    if (stored && VISITOR_ID_PATTERN.test(stored)) return stored;
    const uuid = generateUuid();
    if (!uuid) return '';
    const created = `murphy-${uuid}`;
    storage.setItem(VISITOR_ID_STORAGE_KEY, created);
    return created;
  } catch {
    // Storage can throw in private mode or when blocked.
    return '';
  }
}

function safeLocalStorage(): Storage | null {
  try {
    /* v8 ignore start -- SSR guard: window is always defined in the browser/jsdom */
    return typeof window !== 'undefined' ? window.localStorage : null;
    /* v8 ignore stop */
  } catch {
    return null;
  }
}

/**
 * Initialize the Novus agent once, as a pseudonymous visitor identified by a random id
 * kept in this browser (see getOrCreateVisitorId). The site has no sign-in, so there is
 * no identify() or clearSession() call. Location transforms keep visitor-typed query
 * text out of recorded URLs (they must be registered here: the install snippet does not
 * stub `pendo.location`).
 *
 * The visitor id is read only after the canonical-host check, so other hosts never
 * touch localStorage.
 *
 * @returns true when the agent was initialized, false when skipped.
 */
export function initializeNovusAgent(
  runtime: TelemetryRuntime = getTelemetryRuntime(),
  agent: NovusAgent | undefined = typeof window !== 'undefined' ? window.pendo : undefined,
  visitorId?: string,
): boolean {
  if (!isCanonicalRuntime(runtime) || typeof agent?.initialize !== 'function') {
    return false;
  }
  agent.initialize({
    visitor: { id: visitorId ?? getOrCreateVisitorId() },
    location: { transforms: LOCATION_TRANSFORMS },
  });
  return true;
}
