const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-XG7G6KRP0E';

let analyticsBootstrapStarted = false;
let thirdPartyTriggered = false;
let gtagPromise;
let adsensePromise;

// Track loaded scripts without polluting DOM attributes
const loadedScripts = new Set();

export function toAbsoluteUrl(src) {
  if (typeof document === 'undefined') {
    return src;
  }
  try {
    return new URL(src, document.baseURI).href;
  } catch {
    return src;
  }
}

export function loadScript(src, props = {}) {
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
  if (thirdPartyTriggered) {
    return;
  }

  thirdPartyTriggered = true;

  // Initialize Google Analytics dataLayer if not already done
  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  // Load Google Analytics script (deferred until user interaction)
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

