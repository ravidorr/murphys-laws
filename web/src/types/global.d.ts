export {};

/** Visitor or account metadata. Pendo requires a stable, unique `id` for each. */
interface PendoMetadata {
  id: string;
  [field: string]: unknown;
}

/** Options for pendo.initialize() and pendo.identify(). */
interface PendoOptions {
  visitor?: PendoMetadata;
  account?: PendoMetadata;
  [option: string]: unknown;
}

/**
 * Novus by Pendo agent. The snippet in index.html defines `window.pendo` and queues
 * initialize/identify/updateOptions/pageLoad/track/trackAgent calls until the agent script
 * loads. Every member is optional because the agent is absent off the canonical host and
 * tests stub only the methods they exercise, so callers must check before calling.
 */
interface PendoAgent {
  initialize?: (options?: PendoOptions) => void;
  identify?: (options: PendoOptions) => void;
  updateOptions?: (options: PendoOptions) => void;
  pageLoad?: (url?: string) => void;
  track?: (eventName: string, properties?: Record<string, unknown>) => void;
  trackAgent?: (...args: unknown[]) => void;
  clearSession?: () => void;
}

declare global {
  /**
   * Result of the early Law of the Day request that the inline script in index.html starts on the home page,
   * before the app bundle loads. `law` is set once the response arrived; `promise` never rejects (null on failure).
   */
  interface EarlyLawOfDay {
    law: import('./app.d.ts').Law | null;
    /** URL the request went to; the app adopts the result only if it is the URL it would request itself */
    url: string;
    startedAt: number;
    promise: Promise<import('./app.d.ts').Law | null>;
  }

  interface Window {
    /** Early Law of the Day request started by the inline script in index.html (home page only) */
    __earlyLawOfDay?: EarlyLawOfDay;
    adsbygoogle?: Array<Record<string, unknown>>;
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
    /** Novus by Pendo agent (stubbed by the install snippet on the canonical host only) */
    pendo?: PendoAgent;
    requestIdleCallback?: (callback: (deadline?: IdleDeadline) => void, options?: { timeout?: number }) => number;
  }
}
