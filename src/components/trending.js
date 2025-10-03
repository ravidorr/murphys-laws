// Trending component - fetches 3 most recently voted laws

import { fetchTrending } from '../utils/api.js';
import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { createErrorState } from '../utils/dom.js';

export function Trending() {
  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
    <div class="card-content">
      <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
      <div class="loading-placeholder" role="status" aria-live="polite">
        <p class="small">Loading...</p>
      </div>
    </div>
  `;

  fetchTrending()
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      const trending = laws.slice(0, 3);

      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
          <div class="card-text">
            ${trending.map((law) => {
    const up = Number.isFinite(law.up) ? law.up : 0;
    const down = Number.isFinite(law.down) ? law.down : 0;
    const attribution = firstAttributionLine(law);

    // Safely escape title and text
    const safeTitle = law.title ? escapeHtml(law.title) : '';
    const safeText = escapeHtml(law.text);
    const titleText = safeTitle ? `<strong>${safeTitle}:</strong> ${safeText}` : safeText;

    return `
              <div class="law-card-mini" data-law-id="${escapeHtml(String(law.id))}">
                <p class="law-card-text">
                  ${titleText}
                </p>
                ${attribution ? `<p class="law-card-attrib">${attribution}</p>` : ''}
                <div class="law-card-footer">
                  <span class="count-up" aria-label="upvotes">
                    <span class="material-symbols-outlined icon-sm">thumb_up</span>
                    <span class="count-num">${up}</span>
                  </span>
                  <span class="count-down" aria-label="downvotes">
                    <span class="material-symbols-outlined icon-sm">thumb_down</span>
                    <span class="count-num">${down}</span>
                  </span>
                </div>
              </div>
            `;
  }).join('')}
          </div>
        `;
      }
    })
    .catch(err => {
      console.error('Failed to fetch trending laws:', err);
      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title"><span class="accent-text">Trending</span> Now</h4>
        `;
        const errorEl = createErrorState('Failed to load trending laws.');
        contentDiv.appendChild(errorEl);
      }
    });

  return el;
}
