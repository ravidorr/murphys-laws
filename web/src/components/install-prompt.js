/**
 * PWA Install Prompt Component
 *
 * Provides a custom installation prompt for the PWA with:
 * - Deferred prompt handling for supported browsers
 * - iOS/Safari fallback instructions
 * - Smart timing based on user engagement
 * - Analytics tracking for install outcomes
 */

// Store the deferred prompt event
let deferredPrompt = null;

// Track if user has dismissed the prompt (to avoid showing again this session)
let promptDismissedThisSession = false;

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
  isInstalled = false;
  engagement.pageViews = 0;
  engagement.lawsViewed = 0;
  engagement.calculatorUsed = false;
  engagement.timeOnSite = 0;
  engagement.startTime = Date.now();
}

/**
 * Set the deferred prompt event (for testing purposes only)
 * @internal
 * @param {BeforeInstallPromptEvent|null} event
 */
export function _setDeferredPromptForTesting(event) {
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
export function _setEngagementForTesting(updates) {
  Object.assign(engagement, updates);
}

/**
 * Set installed state (for testing purposes only)
 * @internal
 * @param {boolean} value
 */
export function _setIsInstalledForTesting(value) {
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
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         window.navigator.standalone === true; // iOS Safari
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
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default mini-infobar
    e.preventDefault();
    // Save the event for later
    deferredPrompt = e;

    // Check if we should show the prompt based on engagement
    checkAndShowPrompt();
  });

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    // Remove any visible prompt
    hideInstallPrompt();
    // Log for analytics
    console.log('PWA was installed');
  });

  // Track time on site
  setInterval(() => {
    engagement.timeOnSite = Date.now() - engagement.startTime;
  }, 5000);
}

/**
 * Track a page view for engagement metrics
 */
export function trackPageView() {
  engagement.pageViews++;
  checkAndShowPrompt();
}

/**
 * Track a law view for engagement metrics
 */
export function trackLawView() {
  engagement.lawsViewed++;
  checkAndShowPrompt();
}

/**
 * Track calculator usage for engagement metrics
 */
export function trackCalculatorUse() {
  engagement.calculatorUsed = true;
  // Calculator use is a high-intent action, check prompt immediately
  checkAndShowPrompt();
}

/**
 * Check if engagement thresholds are met and show prompt if appropriate
 */
function checkAndShowPrompt() {
  // Don't show if already installed, dismissed, or no prompt available
  if (isInstalled || promptDismissedThisSession || isRunningStandalone()) {
    return;
  }

  // Check if user has previously dismissed (stored in localStorage)
  const lastDismissed = localStorage.getItem('pwa_install_dismissed');
  if (lastDismissed) {
    const dismissedDate = new Date(lastDismissed);
    const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
    // Don't show again for 7 days after dismissal
    if (daysSinceDismissed < 7) {
      return;
    }
  }

  // Update time on site
  engagement.timeOnSite = Date.now() - engagement.startTime;

  // Check engagement thresholds
  const meetsPageViews = engagement.pageViews >= ENGAGEMENT_THRESHOLDS.minPageViews;
  const meetsLawsViewed = engagement.lawsViewed >= ENGAGEMENT_THRESHOLDS.minLawsViewed;
  const meetsTimeOnSite = engagement.timeOnSite >= ENGAGEMENT_THRESHOLDS.minTimeOnSite;
  const calculatorBonus = engagement.calculatorUsed && ENGAGEMENT_THRESHOLDS.calculatorBonus;

  // Show if calculator was used OR if other thresholds are met
  const shouldShow = calculatorBonus || (meetsPageViews && meetsLawsViewed && meetsTimeOnSite);

  if (shouldShow) {
    // For browsers with beforeinstallprompt support
    if (deferredPrompt) {
      showInstallPrompt();
    }
    // For iOS Safari
    else if (isIOS() && isSafari()) {
      showIOSInstallInstructions();
    }
  }
}

/**
 * Show the custom install prompt UI
 */
export function showInstallPrompt() {
  if (!deferredPrompt || isInstalled || promptDismissedThisSession) {
    return;
  }

  // Remove any existing prompt
  hideInstallPrompt();

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
    </div>
  `;

  // Add styles if not already present
  addInstallPromptStyles();

  // Event handlers
  prompt.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-action');

    if (action === 'install') {
      await triggerInstall();
    } else if (action === 'dismiss') {
      dismissPrompt();
    }
  });

  document.body.appendChild(prompt);

  // Animate in
  requestAnimationFrame(() => {
    prompt.classList.add('install-prompt-visible');
  });
}

/**
 * Show iOS-specific install instructions
 */
export function showIOSInstallInstructions() {
  if (isInstalled || promptDismissedThisSession || isRunningStandalone()) {
    return;
  }

  // Remove any existing prompt
  hideInstallPrompt();

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
    </div>
  `;

  // Add styles if not already present
  addInstallPromptStyles();

  // Event handler
  prompt.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.getAttribute('data-action') === 'dismiss') {
      dismissPrompt();
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
 * Dismiss the prompt and remember the choice
 */
function dismissPrompt() {
  promptDismissedThisSession = true;
  localStorage.setItem('pwa_install_dismissed', new Date().toISOString());
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

/**
 * Add CSS styles for the install prompt
 */
function addInstallPromptStyles() {
  if (document.getElementById('install-prompt-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'install-prompt-styles';
  styles.textContent = `
    .install-prompt {
      position: fixed;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%) translateY(100%);
      z-index: 10000;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 1rem;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.1);
      padding: 1.25rem;
      max-width: calc(100vw - 2rem);
      width: 380px;
      opacity: 0;
      transition: transform 0.3s ease-out, opacity 0.3s ease-out;
    }

    .install-prompt-visible {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    .install-prompt-content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .install-prompt-icon {
      flex-shrink: 0;
    }

    .install-prompt-icon img {
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .install-prompt-text {
      flex: 1;
      min-width: 0;
    }

    .install-prompt-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--fg);
      margin: 0 0 0.25rem 0;
    }

    .install-prompt-desc {
      font-size: 0.875rem;
      color: var(--muted-fg);
      margin: 0;
      line-height: 1.5;
    }

    .install-prompt-instructions {
      background: color-mix(in oklab, var(--bg) 90%, var(--fg) 10%);
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .install-step {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
    }

    .install-step:not(:last-child) {
      border-bottom: 1px solid var(--border);
    }

    .install-step-number {
      width: 24px;
      height: 24px;
      background: var(--btn-primary-bg);
      color: var(--btn-primary-fg);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .install-step-text {
      font-size: 0.875rem;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .install-step-icon {
      color: var(--btn-primary-bg);
      flex-shrink: 0;
    }

    .install-prompt-actions {
      display: flex;
      gap: 0.75rem;
    }

    .install-prompt-btn {
      flex: 1;
      padding: 0.75rem 1rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      transition: background-color 0.15s, transform 0.1s;
    }

    .install-prompt-btn:active {
      transform: scale(0.98);
    }

    .install-prompt-btn-primary {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-fg);
    }

    .install-prompt-btn-primary:hover {
      filter: brightness(1.1);
    }

    .install-prompt-btn-secondary {
      background: transparent;
      color: var(--muted-fg);
      border: 1px solid var(--border);
    }

    .install-prompt-btn-secondary:hover {
      background: color-mix(in oklab, var(--fg) 15%, var(--bg) 85%);
      color: var(--fg);
    }

    @media (max-width: 480px) {
      .install-prompt {
        bottom: 0.5rem;
        width: calc(100vw - 1rem);
        border-radius: 0.75rem;
      }

      .install-prompt-actions {
        flex-direction: column;
      }
    }

    /* Dark mode - system preference */
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) .install-prompt {
        background: var(--dark-bg-primary, #0b0b11);
        border-color: var(--dark-border, rgb(255 255 255 / 25%));
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4), 0 10px 20px -5px rgba(0, 0, 0, 0.3);
      }

      :root:not([data-theme="light"]) .install-prompt-title {
        color: var(--dark-fg-primary, #e9eaee);
      }

      :root:not([data-theme="light"]) .install-prompt-desc {
        color: var(--dark-muted-fg, #9ca3af);
      }

      :root:not([data-theme="light"]) .install-prompt-instructions {
        background: color-mix(in oklab, var(--dark-bg-primary, #0b0b11) 85%, #fff 15%);
      }

      :root:not([data-theme="light"]) .install-step:not(:last-child) {
        border-color: var(--dark-border, rgb(255 255 255 / 25%));
      }

      :root:not([data-theme="light"]) .install-step-text {
        color: var(--dark-fg-primary, #e9eaee);
      }

      :root:not([data-theme="light"]) .install-prompt-btn-secondary {
        color: var(--dark-muted-fg, #9ca3af);
        border-color: var(--dark-border, rgb(255 255 255 / 25%));
      }

      :root:not([data-theme="light"]) .install-prompt-btn-secondary:hover {
        background: color-mix(in oklab, #fff 20%, var(--dark-bg-primary, #0b0b11) 80%);
        color: #fff;
      }
    }

    /* Dark mode - explicit dark theme */
    :root[data-theme="dark"] .install-prompt {
      background: var(--dark-bg-primary, #0b0b11);
      border-color: var(--dark-border, rgb(255 255 255 / 25%));
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4), 0 10px 20px -5px rgba(0, 0, 0, 0.3);
    }

    :root[data-theme="dark"] .install-prompt-title {
      color: var(--dark-fg-primary, #e9eaee);
    }

    :root[data-theme="dark"] .install-prompt-desc {
      color: var(--dark-muted-fg, #9ca3af);
    }

    :root[data-theme="dark"] .install-prompt-instructions {
      background: color-mix(in oklab, var(--dark-bg-primary, #0b0b11) 85%, #fff 15%);
    }

    :root[data-theme="dark"] .install-step:not(:last-child) {
      border-color: var(--dark-border, rgb(255 255 255 / 25%));
    }

    :root[data-theme="dark"] .install-step-text {
      color: var(--dark-fg-primary, #e9eaee);
    }

    :root[data-theme="dark"] .install-prompt-btn-secondary {
      color: var(--dark-muted-fg, #9ca3af);
      border-color: var(--dark-border, rgb(255 255 255 / 25%));
    }

    :root[data-theme="dark"] .install-prompt-btn-secondary:hover {
      background: color-mix(in oklab, #fff 20%, var(--dark-bg-primary, #0b0b11) 80%);
      color: #fff;
    }

    /* Only show in browser mode (not when installed) */
    @media (display-mode: standalone), (display-mode: fullscreen) {
      .install-prompt {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(styles);
}
