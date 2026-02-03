// Initialize Sentry first to capture all errors
import * as Sentry from '@sentry/browser';

// Patterns to filter out from Sentry - these are not application bugs
const IGNORED_ERROR_PATTERNS = [
  // Browser extension errors (not our code)
  /runtime\.sendMessage/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  // Module import failures (transient network/cache issues)
  /Importing a module script failed/i,
  // Service worker errors (transient browser state issues)
  /Service worker registration failed/i,
  /Failed to update a ServiceWorker/i,
  /The object is in an invalid state/i,
];

// Initialize Sentry for production error tracking
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: 0.1,
    // Don't send errors in development
    enabled: import.meta.env.PROD,
    // Filter out errors that aren't application bugs
    beforeSend(event) {
      const errorMessage = event.exception?.values?.[0]?.value || '';
      const stackTrace = event.exception?.values?.[0]?.stacktrace?.frames || [];
      
      // Check if error message matches any ignored pattern
      for (const pattern of IGNORED_ERROR_PATTERNS) {
        if (pattern.test(errorMessage)) {
          return null; // Drop the event
        }
      }
      
      // Check if stack trace contains browser extension URLs
      for (const frame of stackTrace) {
        const filename = frame.filename || '';
        if (/^(chrome|moz|safari)-extension:\/\//i.test(filename)) {
          return null; // Drop events from browser extensions
        }
      }
      
      return event;
    },
  });
}

// Register PWA service worker for offline support
import { registerSW } from 'virtual:pwa-register';
import { showUpdateAvailable, showOfflineReady } from './components/update-notification.js';

const updateSW = registerSW({
  onNeedRefresh() {
    // Show notification when new content is available
    showUpdateAvailable(updateSW);
  },
  onOfflineReady() {
    // Show notification when app is ready for offline use
    showOfflineReady();
  },
  onRegisteredSW(swUrl, registration) {
    // Check for updates periodically (every hour)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    // Service worker registration errors are typically caused by:
    // - Module import failures (stale cache, network issues)
    // - Browser restrictions (private mode, extensions blocking)
    // These are transient issues outside our control, so we just log to console.
    console.error('Service worker registration failed:', error);
  }
});

import { defineRoute, navigate, startRouter, forceRender, currentRoute } from './router.js';
import { Header } from './components/header.js';
import { Footer } from './components/footer.js';
import { MATHJAX_POLL_INTERVAL, MATHJAX_MAX_ATTEMPTS } from './utils/constants.js';
import { Home } from './views/home.js';
import { Browse } from './views/browse.js';
import { LawDetail } from './views/law-detail.js';
import { CategoryDetail } from './views/category-detail.js';
import { Categories } from './views/categories.js';
import { Favorites } from './views/favorites.js';
import { SubmitLawSection } from './components/submit-law.js';
import { Calculator } from './views/sods-calculator.js';
import { ButteredToastCalculator } from './views/buttered-toast-calculator.js';
import { OriginStory } from './views/origin-story.js';
import { About } from './views/about.js';
import { Privacy } from './views/privacy.js';
import { Terms } from './views/terms.js';
import { Contact } from './views/contact.js';
import { Examples } from './views/examples.js';
import { NotFound } from './views/not-found.js';
import { isFavoritesEnabled } from './utils/feature-flags.js';
import { toggleFavorite } from './utils/favorites.js';
import {
  setSiteStructuredData,
  setHomeStructuredData,
  setBrowseStructuredData,
  setLawStructuredData,
  setSodCalculatorStructuredData,
  setToastCalculatorStructuredData,
  clearPageStructuredData
} from '@modules/structured-data.js';
import { hydrateIcons } from '@utils/icons.js';
import { initAnalyticsBootstrap } from '@utils/third-party.js';
import { initKeyboardShortcuts } from './utils/keyboard-shortcuts.js';
import {
  initInstallPrompt,
  trackPageView,
  trackLawView,
  trackCalculatorUse
} from './components/install-prompt.js';

// App state (no framework)
const state = {
  searchQuery: '',
};

// Actions
function onNavigate(page, param) {
  // Handle compound routes like "calculator/sods-law"
  if (page && page.includes('/') && !param) {
    const parts = page.split('/');
    navigate(parts[0], parts[1]);
  } else {
    navigate(page, param);
  }
}

/**
 * Handle navigation to a specific category page
 * @param {string|number} categoryId - The category ID or slug to navigate to
 */
function handleCategoryNavigation(categoryId) {
  onNavigate('category', categoryId);
}

/**
 * Handle search query navigation - navigates to or refreshes the browse page
 */
function handleSearchNavigation() {
  const { name } = currentRoute();
  if (name === 'browse') {
    forceRender();
  } else {
    navigate('browse');
  }
}

/**
 * Handle clearing filters - returns to home or refreshes browse if already there
 */
function handleClearFilters() {
  const { name } = currentRoute();
  if (name === 'browse') {
    forceRender();
  } else {
    navigate('home');
  }
}

/**
 * Main search handler - dispatches to appropriate navigation handler based on filters
 * @param {Object} filters - Search filters object
 * @param {string} [filters.q] - Search query text
 * @param {string|number} [filters.category_id] - Category ID for category navigation
 * @param {string} [filters.attribution] - Attribution filter
 */
function onSearch(filters) {
  state.searchQuery = filters.q || '';

  if (filters.category_id) {
    handleCategoryNavigation(filters.category_id);
  } else if (filters.q || filters.attribution) {
    handleSearchNavigation();
  } else {
    handleClearFilters();
  }
}

// Mount
const app = document.getElementById('app');

// Set evergreen structured data once
setSiteStructuredData();

// Layout wrapper: header + page + footer
function layout(node, { hideAds = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'min-h-screen flex flex-col';

  const header = Header({
    onSearch,
    onNavigate,
    currentPage: currentRoute().name || 'home',
  });

  const main = document.createElement('main');
  main.className = 'flex-1';
  main.id = 'main-content';
  main.appendChild(node);

  const footer = Footer({ onNavigate, hideAds });

  wrap.appendChild(header);
  wrap.appendChild(main);
  wrap.appendChild(footer);

  // Ask MathJax (if present) to typeset this freshly rendered view.
  // We wait until MathJax is loaded and the node is attached to the DOM.
  const typesetWhenReady = (element) => {
    const MATHJAX_DEFER_TIMEOUT = 0;

    let attempts = 0;

    const attempt = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const mj = window.MathJax;
      if (mj && typeof mj.typesetPromise === 'function') {
        mj.typesetPromise([element]).catch(() => {
          // Silently handle MathJax errors
        });
        return;
      }

      attempts += 1;
      if (attempts < MATHJAX_MAX_ATTEMPTS) {
        // Try again shortly in case MathJax script (loaded async) isn't ready yet
        setTimeout(attempt, MATHJAX_POLL_INTERVAL);
      }
    };
    // Defer so the router can attach the element to the DOM first
    setTimeout(attempt, MATHJAX_DEFER_TIMEOUT);
  };

  typesetWhenReady(wrap);
  
  hydrateIcons(wrap);
  
  return wrap;
}

// Define routes
const routesMap = {
  home: () => {
    trackPageView();
    setHomeStructuredData();
    return layout(Home({ onNavigate }));
  },
  category: ({ param }) => {
    trackPageView();
    clearPageStructuredData();
    return layout(CategoryDetail({ categoryId: param, onNavigate }));
  },
  browse: () => {
    trackPageView();
    setBrowseStructuredData();
    return layout(Browse({ searchQuery: state.searchQuery, onNavigate }), { hideAds: true });
  },
  categories: () => {
    trackPageView();
    clearPageStructuredData();
    return layout(Categories({ onNavigate }));
  },
  favorites: () => {
    trackPageView();
    clearPageStructuredData();
    // If feature disabled, redirect to home
    if (!isFavoritesEnabled()) {
      return layout(Home({ onNavigate }));
    }
    return layout(Favorites({ onNavigate }));
  },
  law: ({ param }) => {
    trackPageView();
    trackLawView();
    return layout(LawDetail({ lawId: param, onNavigate, onStructuredData: setLawStructuredData }));
  },
  submit: () => {
    trackPageView();
    const container = document.createElement('div');
    container.className = 'container page pt-0';

    // Add page title h1
    const h1 = document.createElement('h1');
    h1.className = 'page-title mb-4';
    h1.innerHTML = '<span class="accent-text">Submit</span> a Law';
    container.appendChild(h1);

    const submitSection = SubmitLawSection();
    container.appendChild(submitSection);
    clearPageStructuredData();
    return layout(container, { hideAds: true });
  },
  calculator: ({ param }) => {
    trackPageView();
    trackCalculatorUse();
    // Handle /calculator/sods-law and /calculator/buttered-toast
    if (param === 'buttered-toast') {
      setToastCalculatorStructuredData();
      return layout(ButteredToastCalculator(), { hideAds: true });
    }
    // Default to Sod's Law Calculator (handles /calculator/sods-law and legacy /calculator)
    setSodCalculatorStructuredData();
    return layout(Calculator(), { hideAds: true });
  },
  // Keep legacy routes for backward compatibility
  toastcalculator: () => {
    trackPageView();
    trackCalculatorUse();
    setToastCalculatorStructuredData();
    return layout(ButteredToastCalculator(), { hideAds: true });
  },
  'origin-story': () => {
    trackPageView();
    clearPageStructuredData();
    return layout(OriginStory());
  },
  about: () => {
    trackPageView();
    clearPageStructuredData();
    return layout(About({ onNavigate }));
  },
  privacy: () => {
    trackPageView();
    clearPageStructuredData();
    return layout(Privacy({ onNavigate }));
  },
  terms: () => {
    trackPageView();
    clearPageStructuredData();
    return layout(Terms({ onNavigate }));
  },
  contact: () => {
    trackPageView();
    clearPageStructuredData();
    return layout(Contact({ onNavigate }), { hideAds: true });
  },
  examples: () => {
    trackPageView();
    clearPageStructuredData();
    return layout(Examples({ onNavigate }));
  },
};

Object.entries(routesMap).forEach(([name, render]) => {
  defineRoute(name, render);
});

const notFoundRoute = () => {
  clearPageStructuredData();
  return layout(NotFound({ onNavigate }), { hideAds: true });
};

startRouter(app, notFoundRoute);
initAnalyticsBootstrap();
initKeyboardShortcuts();
initInstallPrompt();

// Global event delegation for favorite buttons
if (isFavoritesEnabled()) {
  document.addEventListener('click', (e) => {
    const target = e.target;
    // Use Element instead of HTMLElement to support SVG elements (heart icons)
    if (!(target instanceof Element)) return;

    // Handle favorite button clicks
    const favoriteBtn = target.closest('[data-action="favorite"]');
    if (favoriteBtn) {
      // Skip global handling on the favorites page - let the favorites view handle it
      // The favorites view needs to re-render to show empty state, which global handler doesn't do
      if (location.pathname === '/favorites') {
        return;
      }
      e.stopPropagation();
      const lawId = favoriteBtn.getAttribute('data-law-id');
      if (!lawId) return;

      // Get law data from the card
      const lawCard = favoriteBtn.closest('.law-card-mini');
      const lawText = lawCard?.querySelector('.law-card-text')?.textContent?.trim() || '';

      // Toggle favorite state
      const isNowFavorite = toggleFavorite({
        id: lawId,
        text: lawText,
      });

      // Update button visual state
      const newTooltip = isNowFavorite ? 'Remove from favorites' : 'Add to favorites';
      favoriteBtn.classList.toggle('favorited', isNowFavorite);

      // Update icon
      const icon = favoriteBtn.querySelector('[data-icon-name]');
      if (icon) {
        const newIconName = isNowFavorite ? 'heartFilled' : 'heart';
        icon.setAttribute('data-icon-name', newIconName);
        // Re-render the icon by importing hydrateIcons dynamically
        import('./utils/icons.js')
          .then(({ createIcon }) => {
            const newIcon = createIcon(newIconName);
            if (newIcon && icon.parentNode) {
              icon.parentNode.replaceChild(newIcon, icon);
            }
          })
          .catch((error) => {
            // Module import failures are typically caused by:
            // - Stale service worker cache (old HTML references new chunks)
            // - Network connectivity issues
            // - Mobile Safari ES module bugs
            // These are transient issues outside our control, so we don't report to Sentry.
            // Graceful degradation: icon won't update visually but functionality still works
            console.error('Failed to load icons module:', error);
          });
      }

      // Update aria-label and tooltip
      favoriteBtn.setAttribute('aria-label', newTooltip);
      favoriteBtn.setAttribute('data-tooltip', newTooltip);
    }
  });
}

// Defer AdSense loading to ensure content is present first
import { setupAdSense } from './utils/ads.js';

// Initialize the listener. Ads will only load when a view triggers 'murphys-laws-content-ready'
setupAdSense();
