// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.js';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.js';
import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.js';
import { SubmitLawSection } from '@components/submit-law.js';
import { fetchLawOfTheDay, fetchCategories } from '../utils/api.js';
import { createErrorState } from '../utils/dom.js';
import { getRandomLoadingMessage } from '../utils/constants.js';
import { triggerAdSense } from '../utils/ads.js';

// Exported for testing
export function renderHome(el, lawOfTheDay, categories, onNavigate) {
  // Clear and progressively render: component first, then other sections
  el.innerHTML = '';

  if (lawOfTheDay) {
    const widget = LawOfTheDay({ law: lawOfTheDay, onNavigate });
    el.appendChild(widget);
  }

  // Render Categories Grid (Directory)
  if (categories && Array.isArray(categories) && categories.length > 0) {
    const categoriesSection = document.createElement('section');
    categoriesSection.className = 'section';
    categoriesSection.innerHTML = `
      <h2 class="text-2xl font-bold mb-6 text-center">Browse by Category</h2>
      <div class="category-grid">
        ${categories.map(cat => `
          <div class="category-card" data-nav="category:${cat.slug || cat.id}">
            <h3 class="category-title">${cat.title}</h3>
          </div>
        `).join('')}
      </div>
    `;
    el.appendChild(categoriesSection);
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
