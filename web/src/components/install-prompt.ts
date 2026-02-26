/**
 * PWA Install Prompt Component
 *
 * Provides a custom installation prompt for the PWA with:
 * - Deferred prompt handling for supported browsers
 * - iOS/Safari fallback instructions
 * - Smart timing based on user engagement
 * - Analytics tracking for install outcomes
 */

/** The beforeinstallprompt event fired by the browser when a PWA can be installed */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/** Navigator with iOS Safari standalone property */
interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

// Store the deferred prompt event
let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Track if user has dismissed the prompt (to avoid showing again this session)
let promptDismissedThisSession = false;

// Show at most once per session
let promptShownThisSession = false;

// Only show after a qualifying user action (download, calculator, share/copy link)
let qualifyingUserActionHappened = false;

const PWA_NEVER_SHOW_KEY = 'pwa_install_never_show';

/** Safe localStorage get (SecurityError in Safari insecure contexts, private mode, etc.) */
function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage set (SecurityError in Safari insecure contexts, private mode, etc.) */
function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Unavailable or insecure context
  }
}

// Track if app is already installed
let isInstalled = false;

// Engagement metrics for smart prompting
const engagement = {
  pageViews: 0,
  lawsViewed: 0,
  calculatorUsed: false,
  timeOnSite: 0,
  startTime: Date.now()
};

/**
 * Reset module state (for testing purposes only)
 * @internal
 */
export function _resetForTesting() {
  deferredPrompt = null;
  promptDismissedThisSession = false;
  promptShownThisSession = false;
  qualifyingUserActionHappened = false;
  isInstalled = false;
  engagement.pageViews = 0;
  engagement.lawsViewed = 0;
  engagement.calculatorUsed = false;
  engagement.timeOnSite = 0;
  engagement.startTime = Date.now();
}

export function _setPromptShownThisSessionForTesting(value: boolean) {
  promptShownThisSession = value;
}

export function _setQualifyingUserActionForTesting(value: boolean) {
  qualifyingUserActionHappened = value;
}

/**
 * Set the deferred prompt event (for testing purposes only)
 * @internal
 * @param {BeforeInstallPromptEvent|null} event
 */
export function _setDeferredPromptForTesting(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
}

/**
 * Get current engagement metrics (for testing purposes only)
 * @internal
 * @returns {Object}
 */
export function _getEngagementForTesting() {
  return { ...engagement };
}

/**
 * Update engagement metrics (for testing purposes only)
 * @internal
 * @param {Partial<typeof engagement>} updates
 */
export function _setEngagementForTesting(updates: Partial<typeof engagement>) {
  Object.assign(engagement, updates);
}

/**
 * Set installed state (for testing purposes only)
 * @internal
 * @param {boolean} value
 */
export function _setIsInstalledForTesting(value: boolean) {
  isInstalled = value;
}

// Minimum engagement thresholds before showing prompt
const ENGAGEMENT_THRESHOLDS = {
  minPageViews: 3,
  minLawsViewed: 2,
  minTimeOnSite: 30000, // 30 seconds
  calculatorBonus: true // Show immediately after calculator use
};

/**
 * Check if the app is running in standalone mode (already installed)
 * @returns {boolean}
 */
export function isRunningStandalone() {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         (window.navigator as NavigatorStandalone).standalone === true; // iOS Safari
}

/**
 * Check if the device is iOS
 * @returns {boolean}
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Check if the browser is Safari
 * @returns {boolean}
 */
export function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Initialize the install prompt system
 * Sets up event listeners and tracking
 */
export function initInstallPrompt() {
  // Don't initialize if already installed
  if (isRunningStandalone()) {
    isInstalled = true;
    return;
  }

  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    // Do not auto-show here; wait for qualifying user action
  });

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    hideInstallPrompt();
    console.log('PWA was installed');
  });

  // Track time on site only; do not trigger prompt from interval
  setInterval(() => {
    engagement.timeOnSite = Date.now() - engagement.startTime;
  }, 5000);
}

/**
 * Track a page view for engagement metrics (does not show prompt by itself)
 */
export function trackPageView() {
  engagement.pageViews++;
}

/**
 * Track a law view for engagement metrics (does not show prompt by itself)
 */
export function trackLawView() {
  engagement.lawsViewed++;
}

/**
 * Track calculator usage - qualifying user action; may show prompt once per session
 */
export function trackCalculatorUse() {
  engagement.calculatorUsed = true;
  recordQualifyingUserAction();
}

/**
 * Call when user takes a qualifying action (download, calculator, share/copy link).
 * Allows the install prompt to be shown at most once per session if thresholds are met.
 */
export function recordQualifyingUserAction() {
  qualifyingUserActionHappened = true;
  checkAndShowPrompt();
}

/**
 * Check if engagement thresholds are met and show prompt if appropriate.
 * Only runs after a qualifying user action; shows at most once per session.
 */
function checkAndShowPrompt() {
  if (isInstalled || promptDismissedThisSession || promptShownThisSession || isRunningStandalone()) {
    return;
  }
  if (!qualifyingUserActionHappened) {
    return;
  }

  if (safeLocalStorageGet(PWA_NEVER_SHOW_KEY) === '1') {
    return;
  }
  const lastDismissed = safeLocalStorageGet('pwa_install_dismissed');
  if (lastDismissed) {
    const dismissedDate = new Date(lastDismissed);
    const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed < 7) {
      return;
    }
  }

  engagement.timeOnSite = Date.now() - engagement.startTime;
  const meetsPageViews = engagement.pageViews >= ENGAGEMENT_THRESHOLDS.minPageViews;
  const meetsLawsViewed = engagement.lawsViewed >= ENGAGEMENT_THRESHOLDS.minLawsViewed;
  const meetsTimeOnSite = engagement.timeOnSite >= ENGAGEMENT_THRESHOLDS.minTimeOnSite;
  const calculatorBonus = engagement.calculatorUsed && ENGAGEMENT_THRESHOLDS.calculatorBonus;
  const shouldShow = calculatorBonus || (meetsPageViews && meetsLawsViewed && meetsTimeOnSite);

  if (shouldShow) {
    if (deferredPrompt) {
      showInstallPrompt();
    } else if (isIOS() && isSafari()) {
      showIOSInstallInstructions();
    }
  }
}

/**
 * Show the custom install prompt UI (at most once per session)
 */
export function showInstallPrompt() {
  if (!deferredPrompt || isInstalled || promptDismissedThisSession || promptShownThisSession) {
    return;
  }

  hideInstallPrompt();
  promptShownThisSession = true;

  const prompt = document.createElement('div');
  prompt.className = 'install-prompt';
  prompt.id = 'install-prompt';
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-labelledby', 'install-prompt-title');
  prompt.setAttribute('aria-describedby', 'install-prompt-desc');

  prompt.innerHTML = `
    <div class="install-prompt-content">
      <div class="install-prompt-icon">
        <img src="/android-chrome-192x192.png" alt="Murphy's Laws app icon" width="64" height="64">
      </div>
      <div class="install-prompt-text">
        <h3 id="install-prompt-title" class="install-prompt-title">Install Murphy's Laws</h3>
        <p id="install-prompt-desc" class="install-prompt-desc">
          Get quick access to laws and calculators, even offline. No app store needed.
        </p>
      </div>
    </div>
    <div class="install-prompt-actions">
      <button class="install-prompt-btn install-prompt-btn-primary" data-action="install">
        Install
      </button>
      <button class="install-prompt-btn install-prompt-btn-secondary" data-action="dismiss">
        Not now
      </button>
      <button class="install-prompt-btn install-prompt-btn-secondary" data-action="never">
        Never show again
      </button>
    </div>
  `;

  // Event handlers
  prompt.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-action');

    if (action === 'install') {
      await triggerInstall();
    } else if (action === 'dismiss') {
      dismissPrompt();
    } else if (action === 'never') {
      dismissPromptNeverShowAgain();
    }
  });

  document.body.appendChild(prompt);

  // Animate in
  requestAnimationFrame(() => {
    prompt.classList.add('install-prompt-visible');
  });
}

/**
 * Show iOS-specific install instructions (at most once per session)
 */
export function showIOSInstallInstructions() {
  if (isInstalled || promptDismissedThisSession || promptShownThisSession || isRunningStandalone()) {
    return;
  }

  hideInstallPrompt();
  promptShownThisSession = true;

  const prompt = document.createElement('div');
  prompt.className = 'install-prompt install-prompt-ios';
  prompt.id = 'install-prompt';
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-labelledby', 'install-prompt-title');
  prompt.setAttribute('aria-describedby', 'install-prompt-desc');

  prompt.innerHTML = `
    <div class="install-prompt-content">
      <div class="install-prompt-icon">
        <img src="/apple-touch-icon.png" alt="Murphy's Laws app icon" width="64" height="64">
      </div>
      <div class="install-prompt-text">
        <h3 id="install-prompt-title" class="install-prompt-title">Install Murphy's Laws</h3>
        <p id="install-prompt-desc" class="install-prompt-desc">
          Add this app to your home screen for quick access.
        </p>
      </div>
    </div>
    <div class="install-prompt-instructions">
      <div class="install-step">
        <span class="install-step-number">1</span>
        <span class="install-step-text">
          Tap the Share button
          <svg class="install-step-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
          </svg>
        </span>
      </div>
      <div class="install-step">
        <span class="install-step-number">2</span>
        <span class="install-step-text">Scroll down and tap "Add to Home Screen"</span>
      </div>
      <div class="install-step">
        <span class="install-step-number">3</span>
        <span class="install-step-text">Tap "Add" to confirm</span>
      </div>
    </div>
    <div class="install-prompt-actions">
      <button class="install-prompt-btn install-prompt-btn-secondary" data-action="dismiss">
        Got it
      </button>
      <button class="install-prompt-btn install-prompt-btn-secondary" data-action="never">
        Never show again
      </button>
    </div>
  `;

  prompt.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-action');
    if (action === 'dismiss') {
      dismissPrompt();
    } else if (action === 'never') {
      dismissPromptNeverShowAgain();
    }
  });

  document.body.appendChild(prompt);

  // Animate in
  requestAnimationFrame(() => {
    prompt.classList.add('install-prompt-visible');
  });
}

/**
 * Trigger the native install prompt
 */
async function triggerInstall() {
  if (!deferredPrompt) return;

  // Show the browser's install prompt
  deferredPrompt.prompt();

  // Wait for the user's choice
  const { outcome } = await deferredPrompt.userChoice;

  // Log for analytics
  if (outcome === 'accepted') {
    console.log('User accepted the install prompt');
  } else {
    console.log('User dismissed the install prompt');
  }

  // Clear the deferred prompt (can only be used once)
  deferredPrompt = null;

  // Hide our custom prompt
  hideInstallPrompt();
}

/**
 * Dismiss the prompt and remember for 7 days
 */
function dismissPrompt() {
  promptDismissedThisSession = true;
  safeLocalStorageSet('pwa_install_dismissed', new Date().toISOString());
  hideInstallPrompt();
}

/**
 * Dismiss and never show again (user choice)
 */
function dismissPromptNeverShowAgain() {
  promptDismissedThisSession = true;
  safeLocalStorageSet(PWA_NEVER_SHOW_KEY, '1');
  hideInstallPrompt();
}

/**
 * Hide the install prompt
 */
export function hideInstallPrompt() {
  const prompt = document.getElementById('install-prompt');
  if (prompt) {
    prompt.classList.remove('install-prompt-visible');
    prompt.addEventListener('transitionend', () => prompt.remove(), { once: true });
    // Fallback removal if transition doesn't fire
    setTimeout(() => {
      if (prompt.parentNode) prompt.remove();
    }, 300);
  }
}

/**
 * Manually trigger the install prompt (for use in UI buttons)
 * @returns {boolean} Whether the prompt was shown
 */
export function manuallyShowInstallPrompt() {
  if (isRunningStandalone()) {
    return false;
  }

  if (deferredPrompt) {
    showInstallPrompt();
    return true;
  }

  if (isIOS() && isSafari()) {
    showIOSInstallInstructions();
    return true;
  }

  return false;
}

/**
 * Check if install prompt can be shown
 * @returns {boolean}
 */
export function canShowInstallPrompt() {
  if (isRunningStandalone() || isInstalled) {
    return false;
  }
  return deferredPrompt !== null || (isIOS() && isSafari());
}
