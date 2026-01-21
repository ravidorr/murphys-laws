import { defineRoute, navigate, startRouter, forceRender, currentRoute } from './router.js';
import { Header } from './components/header.js';
import { Footer } from './components/footer.js';
import { MATHJAX_POLL_INTERVAL, MATHJAX_MAX_ATTEMPTS } from './utils/constants.js';
import { Home } from './views/home.js';
import { Browse } from './views/browse.js';
import { LawDetail } from './views/law-detail.js';
import { CategoryDetail } from './views/category-detail.js';
import { SubmitLawSection } from './components/submit-law.js';
import { Calculator } from './views/sods-calculator.js';
import { ButteredToastCalculator } from './views/buttered-toast-calculator.js';
import { OriginStory } from './views/origin-story.js';
import { About } from './views/about.js';
import { Privacy } from './views/privacy.js';
import { Terms } from './views/terms.js';
import { Contact } from './views/contact.js';
import { NotFound } from './views/not-found.js';
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
    setHomeStructuredData();
    return layout(Home({ onNavigate }));
  },
  category: ({ param }) => {
    clearPageStructuredData();
    return layout(CategoryDetail({ categoryId: param, onNavigate }));
  },
  browse: () => {
    setBrowseStructuredData();
    return layout(Browse({ searchQuery: state.searchQuery, onNavigate }), { hideAds: true });
  },
  law: ({ param }) => layout(LawDetail({ lawId: param, onNavigate, onStructuredData: setLawStructuredData })),
  submit: () => {
    const container = document.createElement('div');
    container.className = 'container page pt-0';

    const submitSection = SubmitLawSection({ onNavigate });
    container.appendChild(submitSection);
    clearPageStructuredData();
    return layout(container, { hideAds: true });
  },
  calculator: ({ param }) => {
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
    setToastCalculatorStructuredData();
    return layout(ButteredToastCalculator(), { hideAds: true });
  },
  'origin-story': () => {
    clearPageStructuredData();
    return layout(OriginStory());
  },
  about: () => {
    clearPageStructuredData();
    return layout(About({ onNavigate }));
  },
  privacy: () => {
    clearPageStructuredData();
    return layout(Privacy({ onNavigate }));
  },
  terms: () => {
    clearPageStructuredData();
    return layout(Terms({ onNavigate }));
  },
  contact: () => {
    clearPageStructuredData();
    return layout(Contact({ onNavigate }), { hideAds: true });
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

// Defer AdSense loading to ensure content is present first
import { setupAdSense } from './utils/ads.js';

// Initialize the listener. Ads will only load when a view triggers 'murphys-laws-content-ready'
setupAdSense();
