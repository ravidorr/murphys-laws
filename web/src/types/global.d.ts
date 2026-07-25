export {};

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
    requestIdleCallback?: (callback: (deadline?: IdleDeadline) => void, options?: { timeout?: number }) => number;
  }
}
