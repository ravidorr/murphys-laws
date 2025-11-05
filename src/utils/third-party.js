const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-XG7G6KRP0E';
const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3615614508734124';

let analyticsBootstrapStarted = false;
let thirdPartyTriggered = false;
let gtagPromise;
let adsensePromise;

// Track loaded scripts without polluting DOM attributes
const loadedScripts = new Set();

function toAbsoluteUrl(src) {
  if (typeof document === 'undefined') {
    return src;
  }
  try {
    return new URL(src, document.baseURI).href;
  } catch {
    return src;
  }
}

function loadScript(src, props = {}) {
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
    if (loadedScripts.has(absoluteSrc)) {
      return Promise.resolve();
    }

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
        script[key] = value;
      } else {
        script.setAttribute(key, value);
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

function triggerThirdPartyLoads() {
  if (thirdPartyTriggered || typeof window === 'undefined') {
    return;
  }

  thirdPartyTriggered = true;

  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  if (!gtagPromise) {
    gtagPromise = loadScript(GTAG_SRC).then(() => {
      if (window.gtag) {
        window.gtag('js', new Date());
        window.gtag('config', 'G-XG7G6KRP0E', { transport_type: 'beacon' });
      }
    });
  }
}

function cleanupInteractionListeners(listener) {
  window.removeEventListener('pointerdown', listener);
  window.removeEventListener('keydown', listener);
  window.removeEventListener('scroll', listener);
}

export function initAnalyticsBootstrap() {
  if (analyticsBootstrapStarted || typeof window === 'undefined') {
    return;
  }

  analyticsBootstrapStarted = true;

  const interactionListener = () => {
    cleanupInteractionListeners(interactionListener);
    triggerThirdPartyLoads();
  };

  window.addEventListener('pointerdown', interactionListener, { once: true });
  window.addEventListener('keydown', interactionListener, { once: true });
  window.addEventListener('scroll', interactionListener, { once: true, passive: true });

  const idleFallback = () => {
    cleanupInteractionListeners(interactionListener);
    triggerThirdPartyLoads();
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(idleFallback, { timeout: 5000 });
  } else {
    window.setTimeout(idleFallback, 5000);
  }
}

export function ensureAdsense() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.adsbygoogle && window.adsbygoogle.loaded) {
    return Promise.resolve();
  }

  if (!adsensePromise) {
    adsensePromise = loadScript(ADSENSE_SRC, {
      async: true,
      crossOrigin: 'anonymous',
    }).catch((error) => {
      adsensePromise = undefined;
      throw error;
    });
  }

  return adsensePromise;
}

