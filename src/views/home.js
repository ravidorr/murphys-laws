// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.js';
import { SodCalculatorSimple } from '@components/sod-calculator.js';
import { SubmitLawSection } from '@components/submit-law.js';
import { fetchLaws } from '../utils/api.js';
import { createErrorState } from '../utils/dom.js';
import { LAWS_PER_PAGE } from '../utils/constants.js';

// Exported for testing
export function renderHome(el, laws = [], onNavigate) {
  const data = Array.isArray(laws) ? laws : [];
  const sortedByScore = [...data].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const lawOfTheDay = sortedByScore[0] || null;

  // Clear and progressively render: component first, then other sections
  el.innerHTML = '';

  if (lawOfTheDay) {
    const widget = LawOfTheDay({ law: lawOfTheDay, onNavigate });
    el.appendChild(widget);
  }

  // Add Sod's Law Calculator widget
  const calcWidget = SodCalculatorSimple({ onNavigate });
  el.appendChild(calcWidget);

  // Add Submit Law section
  const submitWidget = SubmitLawSection({ onNavigate });
  el.appendChild(submitWidget);
}

export function Home({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page pt-0';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `<p class="small">Loading laws...</p>`;

  function fetchAndRender() {
    fetchLaws({ limit: LAWS_PER_PAGE, offset: 0 })
      .then(json => {
        const total = json && typeof json.total === 'number' ? json.total : 0;
        if (total === 0) {
          el.innerHTML = `
            <div class="container page">
              <h2 class="mb-4">No results found</h2>
              <p class="small">There are no laws to show.</p>
            </div>
          `;
          return;
        }
        renderHome(el, json && Array.isArray(json.data) ? json.data : [], onNavigate);
      })
      .catch(err => {
        console.error('API fetch failed:', err);
        el.innerHTML = '';
        const errorEl = createErrorState('Failed to load laws. Please try again later.');
        el.appendChild(errorEl);
      });
  }

  // Initial render: loading, then fetch
  fetchAndRender();

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.nav) {
      onNavigate(t.dataset.nav);
    }
    const lawHost = t.closest('[data-law-id]');
    if (lawHost) {
      const id = lawHost.getAttribute('data-law-id');
      if (id) onNavigate('law', id);
    }
  });

  return el;
}
