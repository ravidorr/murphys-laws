// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.js';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.js';
import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.js';
import { SubmitLawSection } from '@components/submit-law.js';
import { fetchLawOfTheDay } from '../utils/api.js';
import { createErrorState } from '../utils/dom.js';
import { getRandomLoadingMessage } from '../utils/constants.js';
import { triggerAdSense } from '../utils/ads.js';

// Exported for testing
// Note: _categories parameter kept for backward compatibility with tests
export function renderHome(el, lawOfTheDay, _categories, onNavigate) {
  // Clear and progressively render: component first, then other sections
  el.innerHTML = '';

  if (lawOfTheDay) {
    const widget = LawOfTheDay({ law: lawOfTheDay, onNavigate });
    el.appendChild(widget);
  }

  // Add Sod's Law Calculator widget
  const calcWidget = SodCalculatorSimple({ onNavigate });
  el.appendChild(calcWidget);

  // Add Buttered Toast Calculator widget
  const toastWidget = ButteredToastCalculatorSimple({ onNavigate });
  el.appendChild(toastWidget);

  // Add Submit Law section
  const submitWidget = SubmitLawSection({ onNavigate });
  el.appendChild(submitWidget);
}

export function Home({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page pt-0 min-h-400';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `
    <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-8 text-primary">The Ultimate Murphy's Law Archive</h1>
    <div class="text-center py-12">
      <p class="small text-muted-fg">${getRandomLoadingMessage()}</p>
    </div>
  `;

  function fetchAndRender() {
    fetchLawOfTheDay()
      .catch(() => null)
      .then((lawJson) => {
        const lawOfTheDay = lawJson && lawJson.data && lawJson.data[0] ? lawJson.data[0] : null;
        
        renderHome(el, lawOfTheDay, [], onNavigate);
        // Signal that meaningful content is ready for ads - pass element for validation
        triggerAdSense(el);
      })
      /* v8 ignore start - Error path only reachable if renderHome throws, tested via integration tests */
      .catch(() => {
        el.innerHTML = '';
        const errorEl = createErrorState('Ironically, something went wrong while loading Murphy\'s Laws. Please try again.');
        el.appendChild(errorEl);
      });
    /* v8 ignore stop */
  }

  // Initial render: loading, then fetch
  fetchAndRender();

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        if (navTarget.startsWith('category:')) {
          const catId = navTarget.split(':')[1];
          onNavigate('category', catId);
        } else {
          onNavigate(navTarget);
        }
        return;
      }
    }

    const lawHost = t.closest('[data-law-id]');
    if (lawHost) {
      const id = lawHost.getAttribute('data-law-id');
      /* v8 ignore next - Truthy check for navigation, tested via integration tests */
      if (id) onNavigate('law', id);
    }
  });

  // Keyboard navigation for law cards and category cards (WCAG 2.1.1)
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const t = e.target;
    if (!(t instanceof Element)) return;

    // Handle law card keyboard activation
    const lawHost = t.closest('[data-law-id]');
    if (lawHost) {
      const id = lawHost.getAttribute('data-law-id');
      if (id) {
        e.preventDefault();
        onNavigate('law', id);
      }
      return;
    }

    // Handle category card keyboard activation
    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        e.preventDefault();
        if (navTarget.startsWith('category:')) {
          const catId = navTarget.split(':')[1];
          onNavigate('category', catId);
        } else {
          onNavigate(navTarget);
        }
      }
    }
  });

  return el;
}
