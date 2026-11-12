import { isKindleBrowser } from './legacy-display.ts';

const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-XG7G6KRP0E';

let analyticsBootstrapStarted: boolean = false;
let thirdPartyTriggered: boolean = false;
let adsensePromise: Promise<void> | undefined;

// Track loaded scripts without polluting DOM attributes
const loadedScripts = new Set<string>();

export function shouldLoadThirdParty(): boolean {
  if (typeof window === 'undefined') return false;
  // No ads or analytics on Kindle: ad overlays cover the e-ink screen and the scripts throw opaque errors.
  if (isKindleBrowser()) return false;
  if (import.meta.env.MODE === 'test') return true;
  return import.meta.env.PROD && window.location.hostname === 'murphys-laws.com';
}

export function toAbsoluteUrl(src: string): string {
  if (typeof document === 'undefined') {
    return src;
  }
  try {
    return new URL(src, document.baseURI).href;
  } catch {
    return src;
  }
}

interface ScriptProps {
  async?: boolean;
  defer?: boolean;
  crossOrigin?: string;
  [key: string]: string | boolean | undefined;
}

export function loadScript(src: string, props: ScriptProps = {}): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

  const absoluteSrc = toAbsoluteUrl(src);

  // Check if script is already loaded
  if (loadedScripts.has(absoluteSrc)) {
    return Promise.resolve();
  }

  // Check for existing script in DOM by src attribute
  const existing = Array.from(document.scripts).find((node) => node.src === absoluteSrc);

  if (existing) {
    // Script exists, check if it's loaded
    // Note: loadedScripts check is already done above, but we kept this logic in case 
    // the set was cleared but DOM remains (unlikely). 
    // However, for coverage, this is unreachable.
    
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => {
        loadedScripts.add(absoluteSrc);
        resolve();
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    Object.entries(props).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (key in script) {
        (script as HTMLScriptElement & Record<string, unknown>)[key] = value;
      } else {
        script.setAttribute(key, String(value));
      }
    });

    script.addEventListener('load', () => {
      loadedScripts.add(absoluteSrc);
      resolve();
    }, { once: true });

    script.addEventListener('error', () => {
      reject(new Error(`Failed to load script: ${src}`));
    }, { once: true });

    document.head.appendChild(script);
  });
}

// Two schedules race to call this (idle after load, and the hard ceiling), so the first one wins.
function triggerThirdPartyLoads(): void {
  if (thirdPartyTriggered) {
    return;
  }

  thirdPartyTriggered = true;

  // Initialize Google Analytics dataLayer if not already done
  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }

  // Load Google Analytics script once the page has loaded and the browser is idle (or after the ceiling)
  // Catch errors silently - users with ad blockers will block this
  void loadScript(GTAG_SRC)
    .then(() => {
      if (window.gtag) {
        window.gtag('js', new Date());
        window.gtag('config', 'G-XG7G6KRP0E', { transport_type: 'beacon' });
      }
    })
    .catch(() => {
      // Silently ignore - script blocked by ad blocker, privacy extension, or network issue
      // This is expected behavior and not an error in our application
    });
}

/**
 * Longest wait, after the window load event, before a third-party script is loaded. The browser
 * normally picks an earlier idle moment; this only bounds the wait on a continuously busy page.
 */
export const THIRD_PARTY_IDLE_TIMEOUT_MS = 3000;

/**
 * Runs `callback` once the main thread is idle, at the latest after `timeoutMs`. Browsers without
 * requestIdleCallback (Safari) get a plain timer of the same length. Both can still fire while the main
 * thread is busy: this defers the start, it does not guarantee the work never overlaps input.
 */
export function scheduleWhenIdle(callback: () => void, timeoutMs: number = THIRD_PARTY_IDLE_TIMEOUT_MS): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: timeoutMs });
  } else {
    window.setTimeout(callback, timeoutMs);
  }
}

/**
 * Longest wait, from the start of the page, before analytics loads even if the window load event is
 * late (slow mobile, async ad and Pendo scripts hold it up). Keeps a visitor who taps around and leaves
 * before load counted, as the old 5 s idle fallback did.
 */
export const ANALYTICS_CEILING_MS = 5000;

/**
 * Loads analytics on whichever comes first: the window load event followed by an idle moment, or the
 * ceiling timer. It is not tied to a user interaction, so the script no longer starts on a first
 * keystroke or tap. The loser of the race finds the guard set and does nothing.
 */
export function initAnalyticsBootstrap(): void {
  if (analyticsBootstrapStarted || !shouldLoadThirdParty()) {
    return;
  }

  analyticsBootstrapStarted = true;

  window.setTimeout(triggerThirdPartyLoads, ANALYTICS_CEILING_MS);
  const loadWhenIdle = () => scheduleWhenIdle(triggerThirdPartyLoads);

  if (document.readyState === 'complete') {
    loadWhenIdle();
  } else {
    window.addEventListener('load', loadWhenIdle, { once: true });
  }
}

export function ensureAdsense(): Promise<void> {
  if (!shouldLoadThirdParty()) {
    return Promise.resolve();
  }

  // If AdSense is already loaded, return immediately
  if (window.adsbygoogle) {
    return Promise.resolve();
  }

  // Script is in index.html, so wait for it to load
  // This provides a promise-based API for footer.js to know when it's safe to create ads
  if (!adsensePromise) {
    adsensePromise = new Promise((resolve) => {
      // Poll for adsbygoogle to appear (script loads asynchronously)
      const checkInterval = setInterval(() => {
        if (window.adsbygoogle) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds - resolve anyway to not block ad creation
      // adsbygoogle.push() will handle the case if script isn't loaded yet
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  }

  return adsensePromise;
}
