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

export interface NovusAgent {
  initialize: (options?: { visitor?: { id: string } }) => void;
}

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
 * no sign-in, so there is no identify() or clearSession() call.
 *
 * @returns true when the agent was initialized, false when skipped.
 */
export function initializeNovusAgent(
  runtime: TelemetryRuntime = getTelemetryRuntime(),
  agent: NovusAgent | undefined = typeof window !== 'undefined' ? window.pendo : undefined,
): boolean {
  if (!isCanonicalRuntime(runtime) || !agent) {
    return false;
  }
  agent.initialize({ visitor: { id: '' } });
  return true;
}
