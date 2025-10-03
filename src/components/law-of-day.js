// Law of the Day widget component

import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';

export function LawOfTheDay({ law, onNavigate, showButton = true }) {
  const el = document.createElement('section');
  el.className = 'section section-card mb-12';
  el.setAttribute('data-law-id', law?.id || '');

  if (!law) {
    el.innerHTML = `
      <div class="skeleton" role="status" aria-label="Loading Law of the Day"></div>
    `;
    return el;
  }

  const iso = new Date().toISOString();
  const dateText = new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const score = Number.isFinite(law.score) ? law.score : 0;
  const up = Number.isFinite(law.up) ? law.up : Math.max(score, 0);
  const down = Number.isFinite(law.down) ? law.down : Math.max(-score, 0);
  const attribution = firstAttributionLine(law);

  // Safely escape the law text
  const safeText = escapeHtml(law.text);

  el.innerHTML = `
    <div class="section-header">
      <h3 class="section-title"><span class="accent-text">Murphy's</span> Law of the Day</h3>
      <time class="section-date" datetime="${iso}">${dateText}</time>
      </div>
    <div class="section-body" data-law-id="${escapeHtml(String(law.id))}">
      <blockquote class="lod-quote-large">"${safeText}"</blockquote>
      <p class="lod-attrib">${attribution}</p>
    </div>
    <div class="section-footer">
      <div class="left">
        <span class="count-up" aria-label="upvotes">
          <span class="material-symbols-outlined icon">thumb_up</span>
          <span class="count-num">${up}</span>
        </span>
        <span class="count-down" aria-label="downvotes">
          <span class="material-symbols-outlined icon">thumb_down</span>
          <span class="count-num">${down}</span>
        </span>
      </div>
      ${showButton ? `
      <button class="btn" type="button" data-nav="browse" aria-label="View more laws">
        View More Laws
        <span class="material-symbols-outlined icon ml">arrow_forward</span>
      </button>
      ` : ''}
    </div>
  `;

  // Preserve click-to-detail navigation on the main body
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement) {
      // If click originated inside the card body, navigate to detail
      const host = t.closest('[data-law-id]');
      if (host) {
        const id = host.getAttribute('data-law-id');
        if (id) onNavigate('law', id);
      }
    }
  });

  return el;
}
