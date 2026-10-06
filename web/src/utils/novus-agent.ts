/**
 * Novus by Pendo agent bootstrap.
 *
 * The inline snippet in index.html stubs `window.pendo` and loads the agent, but only
 * on the canonical production host. This module starts the agent under the same
 * guard so local, preview, Playwright and Lighthouse runs never initialize it.
 */

export const CANONICAL_HOSTNAME = 'murphys-laws.com';

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

/**
 * Initialize the Novus agent once, as an anonymous visitor: an empty id lets the agent
 * reuse the visitor id it stored on an earlier visit, or create a new one. The site has
 * no sign-in, so there is no identify() or clearSession() call. Location transforms keep
 * visitor-typed query text out of recorded URLs (they must be registered here: the
 * install snippet does not stub `pendo.location`).
 *
 * @returns true when the agent was initialized, false when skipped.
 */
export function initializeNovusAgent(
  runtime: TelemetryRuntime = getTelemetryRuntime(),
  agent: NovusAgent | undefined = typeof window !== 'undefined' ? window.pendo : undefined,
): boolean {
  if (!isCanonicalRuntime(runtime) || typeof agent?.initialize !== 'function') {
    return false;
  }
  agent.initialize({ visitor: { id: '' }, location: { transforms: LOCATION_TRANSFORMS } });
  return true;
}
