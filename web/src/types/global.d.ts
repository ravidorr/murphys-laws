export {};

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
    /** Pendo agent (loaded by the Pendo install snippet when present) */
    pendo?: {
      track?: (eventName: string, properties?: Record<string, string | number | boolean>) => void;
    };
    requestIdleCallback?: (callback: (deadline?: IdleDeadline) => void, options?: { timeout?: number }) => number;
  }
}
