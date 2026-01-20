// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.js';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.js';
import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.js';
import { SubmitLawSection } from '@components/submit-law.js';
import { fetchLawOfTheDay, fetchCategories } from '../utils/api.js';
import { createErrorState } from '../utils/dom.js';
import { getRandomLoadingMessage } from '../utils/constants.js';
import { triggerAdSense } from '../utils/ads.js';
import { hydrateIcons } from '@utils/icons.js';

// Exported for testing
export function renderHome(el, lawOfTheDay, categories, onNavigate) {
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

  // Add Browse All Categories button
  if (categories && Array.isArray(categories) && categories.length > 0) {
    const browseSection = document.createElement('section');
    browseSection.className = 'section section-card';
    browseSection.innerHTML = `
      <div class="section-footer" style="justify-content: center;">
        <button class="btn" data-nav="categories">
          <span class="btn-text">Browse all ${categories.length} Categories</span>
          <span class="icon" data-icon="arrowForward" aria-hidden="true"></span>
        </button>
      </div>
    `;
    el.appendChild(browseSection);
    hydrateIcons(browseSection);
  }
}

export function Home({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page pt-0';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');
  // Reserve space to prevent layout shift (min-height matches typical Law of the Day card height)
  el.style.minHeight = '400px';

  el.innerHTML = `
    <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-8 text-primary">The Ultimate Murphy's Law Archive</h1>
    <div class="text-center py-12">
      <p class="small text-muted-fg">${getRandomLoadingMessage()}</p>
    </div>
  `;

  function fetchAndRender() {
    Promise.all([
      fetchLawOfTheDay().catch(() => null),
      fetchCategories().catch(() => ({ data: [] }))
    ])
      .then(([lawJson, catJson]) => {
        const lawOfTheDay = lawJson && lawJson.data && lawJson.data[0] ? lawJson.data[0] : null;
        const categories = catJson && catJson.data ? catJson.data : [];
        
        renderHome(el, lawOfTheDay, categories, onNavigate);
        // Signal that meaningful content is ready for ads - pass element for validation
        triggerAdSense(el);
      })
      .catch(() => {
        el.innerHTML = '';
        const errorEl = createErrorState('Ironically, something went wrong while loading Murphy\'s Laws. Please try again.');
        el.appendChild(errorEl);
      });
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
      if (id) onNavigate('law', id);
    }
  });

  return el;
}
