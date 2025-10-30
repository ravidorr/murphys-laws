// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.js';
import { SodCalculatorSimple } from '@components/sod-calculator-simple.js';
import { ButteredToastCalculatorSimple } from '@components/buttered-toast-calculator-simple.js';
import { SubmitLawSection } from '@components/submit-law.js';
import { fetchLawOfTheDay } from '../utils/api.js';
import { createErrorState } from '../utils/dom.js';
import { getRandomLoadingMessage } from '../utils/constants.js';

// Exported for testing
export function renderHome(el, lawOfTheDay, onNavigate) {
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
  el.className = 'container page pt-0';
  el.setAttribute('role', 'main');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `<p class="small">${getRandomLoadingMessage()}</p>`;

  function fetchAndRender() {
    fetchLawOfTheDay()
      .then(json => {
        const lawOfTheDay = json && json.data && json.data[0] ? json.data[0] : null;
        renderHome(el, lawOfTheDay, onNavigate);
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
        onNavigate(navTarget);
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
