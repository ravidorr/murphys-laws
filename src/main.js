import { defineRoute, navigate, startRouter } from './router.js';
import { Header } from './ui/header.js';
import { Home } from './views/home.js';
import { Browse } from './views/browse.js';
import { LawDetail } from './views/law-detail.js';
import { SubmitLaw } from './views/submit-law.js';
import { Auth } from './views/auth.js';
import { Calculator } from './views/calculator.js';

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
  navigate('browse');
}
function onAuth(username) {
  state.isLoggedIn = true;
  state.currentUser = username;
  navigate('home');
}
function _onLogout() {
  state.isLoggedIn = false;
  state.currentUser = null;
  navigate('home');
}
function onVote(contentId, voteType) {
  console.log('Vote', voteType, 'on', contentId);
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
  // Global site hero shown on all pages
  const hero = document.createElement('section');
  hero.className = 'container page';
  hero.innerHTML = `
    <div class="text-center mb-12">
      <h1 class="gradient-title">Murphy's Law Archive</h1>
      <h2 class="subhead mb-8">If it can go wrong, you'll find it here.</h2>
    </div>
  `;
  main.appendChild(hero);
  main.appendChild(node);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <div class="mt-8 pt-8 text-center">
        <p class="small">
          <a href="https://murphys-laws.com">Murphy's Law Archive</a> by <a href="https://murphys-laws.com/about">Raanan Avidor</a> is marked <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0 Universal</a><img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;"><img src="https://mirrors.creativecommons.org/presskit/icons/zero.svg" alt="" style="max-width: 1em;max-height:1em;margin-left: .2em;">
        </p>
      </div>
    </div>
  `;

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
    const attempt = () => {
      const mj = window.MathJax;
      if (mj && typeof mj.typesetPromise === 'function') {
        mj.typesetPromise([element]).catch((err) => console.error('MathJax typeset error:', err));
        return;
      }
      // Try again shortly in case MathJax script (loaded async) isn't ready yet
      setTimeout(attempt, 50);
    };
    // Defer so the router can attach the element to the DOM first
    setTimeout(attempt, 0);
  };

  typesetWhenReady(wrap);
  return wrap;
}

// Define routes
defineRoute('home', () => layout(Home({ isLoggedIn: state.isLoggedIn, onNavigate, onVote })));

defineRoute('browse', () => layout(Browse({ isLoggedIn: state.isLoggedIn, searchQuery: state.searchQuery, onNavigate, onVote })));

defineRoute('law', ({ param }) => layout(LawDetail({ lawId: param, isLoggedIn: state.isLoggedIn, currentUser: state.currentUser, onNavigate, onVote })));

defineRoute('submit', () => layout(SubmitLaw({ isLoggedIn: state.isLoggedIn, currentUser: state.currentUser, onNavigate })));

defineRoute('login', () => layout(Auth({ type: 'login', onNavigate, onAuth })));

defineRoute('signup', () => layout(Auth({ type: 'signup', onNavigate, onAuth })));

defineRoute('calculator', () => layout(Calculator()));

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
    loader: { load: ['[tex]/html'] },
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']],
      packages: { '[+]': ['html'] }
    },
    options: {
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
    await import('mathjax/es5/tex-chtml-full.js');
    const mj = window.MathJax;
    const root = document.getElementById('app');
    if (mj && typeof mj.typesetPromise === 'function' && root) {
      mj.typesetPromise([root]).catch((err) => console.error('MathJax initial typeset error:', err));
    }
  } catch (err) {
    console.error('Failed to load MathJax locally:', err);
  }
})();
