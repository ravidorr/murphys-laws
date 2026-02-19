/**
 * Dynamically loads the Google AdSense script.
 * This is used to defer loading until after the main content has rendered,
 * preventing "Google-served ads on screens without publisher-content" violations.
 */

let isAdSenseInitialized: boolean = false;

function initAdSense(): void {
  // Prevent double loading
  if (isAdSenseInitialized || window.adsbygoogle || document.querySelector('script[src*="adsbygoogle"]')) {
    return;
  }

  isAdSenseInitialized = true;

  const script = document.createElement('script');
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3615614508734124';
  script.async = true;
  script.crossOrigin = 'anonymous';

  // Note: We intentionally don't report AdSense load failures to Sentry.
  // Ad blockers commonly block this script, which is expected user behavior
  // and not an application error.

  document.head.appendChild(script);
}

/**
 * Sets up the listener for the content-ready event.
 * specific events will trigger the ad loading.
 */
export function setupAdSense(): void {
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
 * Checks if the element has sufficient text content for AdSense compliance.
 * Google requires substantial content on pages showing ads.
 * @param {HTMLElement} element - The element to check for content
 * @param {number} minChars - Minimum character count (default: 500)
 * @returns {boolean} True if content meets minimum requirements
 */
export function hasMinimumContent(element: HTMLElement | null, minChars: number = 500): boolean {
  if (!element) return false;
  const textContent = element.textContent || '';
  // Remove excessive whitespace and count meaningful characters
  const contentLength = textContent.replace(/\s+/g, ' ').trim().length;
  return contentLength >= minChars;
}

/**
 * Triggers the ad loading process.
 * Should be called by views when they have rendered meaningful content.
 * @param {HTMLElement} [contentElement] - Optional element to validate for minimum content
 */
export function triggerAdSense(contentElement?: HTMLElement): void {
  // If a content element is provided, validate it has sufficient content
  if (contentElement && !hasMinimumContent(contentElement)) {
    return; // Don't trigger ads if content is insufficient
  }
  document.dispatchEvent(new CustomEvent('murphys-laws-content-ready'));
}

/**
 * Resets the AdSense initialization state.
 * ONLY FOR TESTING PURPOSES.
 */
export function resetAdSenseForTesting(): void {
  isAdSenseInitialized = false;
}
