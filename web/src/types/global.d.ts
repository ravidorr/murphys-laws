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
 * initialize/identify/updateOptions/pageLoad/track/trackAgent/clearSession calls until the
 * agent script loads.
 */
interface PendoAgent {
  initialize: (options?: PendoOptions) => void;
  identify: (options: PendoOptions) => void;
  updateOptions: (options: PendoOptions) => void;
  pageLoad: (url?: string) => void;
  track: (event: string, properties?: Record<string, unknown>) => void;
  trackAgent: (...args: unknown[]) => void;
  clearSession: () => void;
}

declare global {
  var pendo: PendoAgent | undefined;

  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
    requestIdleCallback?: (callback: (deadline?: IdleDeadline) => void, options?: { timeout?: number }) => number;
  }
}
