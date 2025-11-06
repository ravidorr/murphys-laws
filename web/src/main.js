import { defineRoute, navigate, startRouter, forceRender } from './router.js';
import { Header } from './components/header.js';
import { Footer } from './components/footer.js';
import { MATHJAX_POLL_INTERVAL, MATHJAX_MAX_ATTEMPTS } from './utils/constants.js';
import { Home } from './views/home.js';
import { Browse } from './views/browse.js';
import { LawDetail } from './views/law-detail.js';
import { SubmitLawSection } from './components/submit-law.js';
import { Calculator } from './views/sods-calculator.js';
import { ButteredToastCalculator } from './views/buttered-toast-calculator.js';
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

// App state (no framework)
const state = {
  searchQuery: '',
};

// Actions
function onNavigate(page, lawId) {
  navigate(page, lawId);
}
function onSearch(q) {
  state.searchQuery = q;
  const current = location.hash.replace('#/', '').split(':')[0] || 'home';
  if (current === 'browse') {
    // Already on browse, just force a re-render with new search query
    forceRender();
  } else {
    navigate('browse');
  }
}

// Mount
const app = document.getElementById('app');

// Set evergreen structured data once
setSiteStructuredData();

// Layout wrapper: header + page + footer
function layout(node) {
  const wrap = document.createElement('div');
  wrap.className = 'min-h-screen flex flex-col';

  const header = Header({
    onSearch,
    onNavigate,
    currentPage: location.hash.replace('#/','') || 'home',
  });

  const main = document.createElement('main');
  main.className = 'flex-1';
  main.appendChild(node);

  const footer = Footer({ onNavigate });

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
  browse: () => {
    setBrowseStructuredData();
    return layout(Browse({ searchQuery: state.searchQuery, onNavigate }));
  },
  law: ({ param }) => layout(LawDetail({ lawId: param, onNavigate, onStructuredData: setLawStructuredData })),
  submit: () => {
    const container = document.createElement('div');
    container.className = 'container page pt-0';

    const submitSection = SubmitLawSection({ onNavigate });
    container.appendChild(submitSection);
    clearPageStructuredData();
    return layout(container);
  },
  calculator: () => {
    setSodCalculatorStructuredData();
    return layout(Calculator());
  },
  toastcalculator: () => {
    setToastCalculatorStructuredData();
    return layout(ButteredToastCalculator());
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
    return layout(Contact({ onNavigate }));
  },
};

Object.entries(routesMap).forEach(([name, render]) => {
  defineRoute(name, render);
});

const notFoundRoute = () => {
  clearPageStructuredData();
  return layout(NotFound({ onNavigate }));
};

startRouter(app, notFoundRoute);
initAnalyticsBootstrap();
