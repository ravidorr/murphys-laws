/**
 * Dynamically loads the Google AdSense script.
 * This is used to defer loading until after the main content has rendered,
 * preventing "Google-served ads on screens without publisher-content" violations.
 */

let isAdSenseInitialized = false;

function initAdSense() {
  // Prevent double loading
  if (isAdSenseInitialized || window.adsbygoogle || document.querySelector('script[src*="adsbygoogle"]')) {
    return;
  }

  isAdSenseInitialized = true;

  const script = document.createElement('script');
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3615614508734124';
  script.async = true;
  script.crossOrigin = 'anonymous';

  script.onerror = () => {
    console.warn('AdSense failed to load');
  };

  document.head.appendChild(script);
}

/**
 * Sets up the listener for the content-ready event.
 * specific events will trigger the ad loading.
 */
export function setupAdSense() {
  document.addEventListener('murphys-laws-content-ready', () => {
    // specific events will trigger the ad loading.
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => initAdSense());
    } else {
      setTimeout(() => initAdSense(), 500);
    }
  }, { once: true });
}

/**
 * Triggers the ad loading process.
 * Should be called by views when they have rendered meaningful content.
 */
export function triggerAdSense() {
  document.dispatchEvent(new CustomEvent('murphys-laws-content-ready'));
}

/**
 * Resets the AdSense initialization state.
 * ONLY FOR TESTING PURPOSES.
 */
export function resetAdSenseForTesting() {
  isAdSenseInitialized = false;
}
