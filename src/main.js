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
  main.appendChild(node);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <div class="container">
      <div class="grid">
        <div>
          <h4>Murphy's Law Archive</h4>
          <p class="small">The definitive, community-curated online repository of Murphy's Laws and their corollaries.</p>
        </div>
        <div>
          <h4>Browse</h4>
          <div class="small">
            <button class="link" data-nav="browse">All Laws</button>
            <br/>
            <button class="link" data-nav="browse">Top Voted</button>
            <br/>
            <button class="link" data-nav="browse">Recently Added</button>
          </div>
        </div>
        <div>
          <h4>Contribute</h4>
          <div>
            <button class="link" data-nav="submit">Submit a Law</button>
            ${!state.isLoggedIn ? '<br/><button class="link" data-nav="signup">Join Community</button>' : ''}
          </div>
        </div>
        <div>
          <h4>Community</h4>
          <p class="small">A platform for sharing the wisdom of things going wrong.</p>
        </div>
      </div>
      <div class="border-t mt-8 pt-8 text-center">
        <p class="small">© 2024 Murphy's Law Archive.</p>
      </div>
    </div>`;

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
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']]
    }
  };
  try {
    // Use SVG output to avoid webfont requests that can break under bundlers
    await import('mathjax/es5/tex-svg.js');
  } catch (err) {
    console.error('Failed to load MathJax locally:', err);
  }
})();
