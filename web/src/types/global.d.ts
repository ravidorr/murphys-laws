export {};

declare global {
  interface Window {
    MathJax?: Record<string, any> & {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      startup?: Record<string, any>;
      tex?: Record<string, unknown>;
      options?: Record<string, unknown>;
    };
    adsbygoogle?: Array<Record<string, unknown>>;
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
    requestIdleCallback?: (callback: (deadline?: IdleDeadline) => void, options?: { timeout?: number }) => number;
  }
}
