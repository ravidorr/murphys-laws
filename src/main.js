import { defineRoute, navigate, startRouter, forceRender } from './router.js';
import { Header } from './components/header.js';
import { Home } from './views/home.js';
import { Browse } from './views/browse.js';
import { LawDetail } from './views/law-detail.js';
import { SubmitLawSection } from './components/submit-law.js';
import { Auth } from './views/auth.js';
import { Calculator } from './views/sods-calculator.js';
import { ButteredToastCalculator } from './views/buttered-toast-calculator.js';

// App state (no framework)
const state = {
  isLoggedIn: false,
  currentUser: null,
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
function onAuth(username) {
  state.isLoggedIn = true;
  state.currentUser = username;
  navigate('home');
}

// Mount
const app = document.getElementById('app');

// Layout wrapper: header + page + footer
function layout(node) {
  const wrap = document.createElement('div');
  wrap.className = 'min-h-screen flex flex-col';

  const header = Header({
    onSearch,
    onNavigate,
    currentPage: location.hash.replace('#/','') || 'home',
    isLoggedIn: state.isLoggedIn,
    currentUser: state.currentUser,
  });

  const main = document.createElement('main');
  main.className = 'flex-1';
  main.appendChild(node);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <div class="mt-8 text-center">
        <!-- Google AdSense -->
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="ca-pub-3615614508734124"
             data-ad-slot="4091490183"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
      <div class="mt-8 pt-8 text-center">
        <p class="small">
          <a href="https://murphys-laws.com">Murphy's Law Archive</a> by <a href="https://murphys-laws.com/about">Raanan Avidor</a> is marked <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0 Universal</a><img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;"><img src="https://mirrors.creativecommons.org/presskit/icons/zero.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;">
        </p>
      </div>
    </div>
  `;

  // Initialize AdSense ad
  // Wrap in try-catch to silently handle "already initialized" errors
  // This happens on route changes when ads are already loaded
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (e) {
    // Silently ignore AdSense errors
  }

  footer.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.dataset.nav) {
      onNavigate(t.dataset.nav);
    }
  });

  wrap.appendChild(header);
  wrap.appendChild(main);
  wrap.appendChild(footer);
  
  // Ask MathJax (if present) to typeset this freshly rendered view.
  // We wait until MathJax is loaded and the node is attached to the DOM.
  const typesetWhenReady = (element) => {
    const MATHJAX_POLL_INTERVAL = 50;
    const MATHJAX_DEFER_TIMEOUT = 0;

    const attempt = () => {
      const mj = window.MathJax;
      if (mj && typeof mj.typesetPromise === 'function') {
        mj.typesetPromise([element]).catch(() => {
          // Silently handle MathJax errors
        });
        return;
      }
      // Try again shortly in case MathJax script (loaded async) isn't ready yet
      setTimeout(attempt, MATHJAX_POLL_INTERVAL);
    };
    // Defer so the router can attach the element to the DOM first
    setTimeout(attempt, MATHJAX_DEFER_TIMEOUT);
  };

  typesetWhenReady(wrap);
  return wrap;
}

// Define routes
defineRoute('home', () => layout(Home({ isLoggedIn: state.isLoggedIn, onNavigate })));

defineRoute('browse', () => layout(Browse({ isLoggedIn: state.isLoggedIn, searchQuery: state.searchQuery, onNavigate })));

defineRoute('law', ({ param }) => layout(LawDetail({ lawId: param, isLoggedIn: state.isLoggedIn, currentUser: state.currentUser, onNavigate })));

defineRoute('submit', () => {
  const container = document.createElement('div');
  container.className = 'container page pt-0';
  const submitSection = SubmitLawSection({ onNavigate });
  container.appendChild(submitSection);
  return layout(container);
});

defineRoute('login', () => layout(Auth({ type: 'login', onNavigate, onAuth })));

defineRoute('signup', () => layout(Auth({ type: 'signup', onNavigate, onAuth })));

defineRoute('calculator', () => layout(Calculator()));

defineRoute('toastcalculator', () => layout(ButteredToastCalculator()));

// Fallback
defineRoute('law-history', () => layout(document.createTextNode('Law of the Day History (coming soon)')));

startRouter(app);

// Load and configure MathJax v3 locally (bundled via Vite)
// We set window.MathJax before loading the component to ensure correct config
// Then dynamically import the tex-mml-chtml component and attach a ready hook
// so our existing typesetWhenReady logic works across route changes.
(async () => {
  // If MathJax already present (HMR/fast refresh), skip
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    return;
  }
  window.MathJax = {
    // Don't ask MathJax to lazy-load extra components; Vite bundles the full CHTML build we import below.
    loader: { load: [] },
    chtml: {
      // This is the setting that specifies the font location
      fontURL: 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/output/chtml/fonts/woff-v2'
    },
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']],
      packages: { '[+]': ['html'] }
    },
    // Prevent auto-typesetting; we call typesetPromise ourselves after mount
    startup: { typeset: false },
    // Disable optional features that trigger extra network fetches under bundlers
    options: {
      enableMenu: false,
      enableAssistiveMml: false,
      a11y: { speech: false },
      renderActions: {
        // Custom action to add titles to math variables after rendering
        addMathTitles: [
          200,  // Priority: higher runs later
          (doc) => {
            for (const node of doc.math) {
              const element = node.typesetRoot;
              if (element) {
                element.querySelectorAll('mjx-mi').forEach((mi) => {
                  const text = mi.textContent.trim();
                  const titles = {
                    'U': 'Urgency (1-9)',
                    'C': 'Complexity (1-9)',
                    'I': 'Importance (1-9)',
                    'S': 'Skill (1-9)',
                    'F': 'Frequency (1-9)',
                    'A': 'Activity constant (0.7)'
                  };
                  if (titles[text]) {
                    mi.setAttribute('title', titles[text]);
                  }
                });
              }
            }
          }
        ]
      }
    }
  };
  try {
    // Use CHTML output to enable easier DOM annotations of math tokens
    // Load the bundled CHTML build (no dynamic sub-loads expected)
    // Use the slimmer TeX + CHTML bundle (no menu/a11y components)
    await import('mathjax/es5/tex-chtml.js');
    const mj = window.MathJax;
    const root = document.getElementById('app');
    if (mj && typeof mj.typesetPromise === 'function' && root) {
      mj.typesetPromise([root]).catch(() => {
        // Silently handle MathJax errors
      });
    }
  } catch (err) {
    // Silently handle MathJax loading errors
  }
  // Ensure HMR picks up MathJax config changes: dispose the global instance on module replace
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      // Remove global to force re-init with new config on next import
      delete window.MathJax;
      // Clean up any MathJax-injected stylesheets to avoid duplication
      document
        .querySelectorAll('style[data-mathjax],link[data-mathjax]')
        .forEach((el) => {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
    });
  }
})();
