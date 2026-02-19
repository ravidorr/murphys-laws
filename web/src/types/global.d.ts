export {};

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      startup?: Record<string, unknown>;
      tex?: Record<string, unknown>;
      options?: Record<string, unknown>;
      loader?: Record<string, unknown>;
      chtml?: Record<string, unknown>;
    };
    adsbygoogle?: Array<Record<string, unknown>>;
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
    requestIdleCallback?: (callback: (deadline?: IdleDeadline) => void, options?: { timeout?: number }) => number;
  }
}
