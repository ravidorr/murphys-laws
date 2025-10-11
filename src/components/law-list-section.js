import { firstAttributionLine } from '../utils/attribution.js';
import { escapeHtml } from '../utils/sanitize.js';
import { createErrorState, createLoadingPlaceholder } from '../utils/dom.js';
import { getUserVote, addVotingListeners } from '../utils/voting.js';

function renderLawCard(law, index, rankOffset) {
  const up = Number.isFinite(law.upvotes) ? law.upvotes : 0;
  const down = Number.isFinite(law.downvotes) ? law.downvotes : 0;
  const attribution = firstAttributionLine(law);
  const userVote = getUserVote(law.id);

  const safeId = escapeHtml(String(law.id));
  const safeTitle = law.title ? escapeHtml(law.title) : '';
  const safeText = escapeHtml(law.text || '');
  const titleText = safeTitle ? `<strong>${safeTitle}:</strong> ${safeText}` : safeText;

  const rankMarkup = typeof rankOffset === 'number'
    ? `<span class="rank">#${index + rankOffset}</span>`
    : '';

  return `
    <div class="law-card-mini" data-law-id="${safeId}">
      <p class="law-card-text">
        ${rankMarkup}
        ${titleText}
      </p>
      ${attribution ? `<p class="law-card-attrib">${attribution}</p>` : ''}
      <div class="law-card-footer">
        <button class="vote-btn count-up ${userVote === 'up' ? 'voted' : ''}" data-vote="up" data-law-id="${safeId}" aria-label="Upvote this law">
          <span class="material-symbols-outlined icon">thumb_up</span>
          <span class="count-num">${up}</span>
        </button>
        <button class="vote-btn count-down ${userVote === 'down' ? 'voted' : ''}" data-vote="down" data-law-id="${safeId}" aria-label="Downvote this law">
          <span class="material-symbols-outlined icon">thumb_down</span>
          <span class="count-num">${down}</span>
        </button>
      </div>
    </div>
  `;
}

export function createLawListSection({ accentText, remainderText }) {
  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
    <div class="card-content">
      <h4 class="card-title"><span class="accent-text">${accentText}</span>${remainderText}</h4>
    </div>
  `;

  const contentDiv = el.querySelector('.card-content');
  let loadingEl = null;

  if (contentDiv) {
    loadingEl = createLoadingPlaceholder();
    contentDiv.appendChild(loadingEl);
  }

  function renderLaws(laws = [], { skip = 0, limit = Infinity, rankOffset = null } = {}) {
    const content = el.querySelector('.card-content');
    if (!content) return;

    const sliced = laws.slice(skip, skip + limit);

    content.innerHTML = `
      <h4 class="card-title"><span class="accent-text">${accentText}</span>${remainderText}</h4>
      <div class="card-text">
        ${sliced.map((law, index) => renderLawCard(law, index, rankOffset)).join('')}
      </div>
    `;

    addVotingListeners(el);
  }

  function renderError(message) {
    const content = el.querySelector('.card-content');
    if (!content) return;

    content.innerHTML = `
      <h4 class="card-title"><span class="accent-text">${accentText}</span>${remainderText}</h4>
    `;
    content.appendChild(createErrorState(message));
  }

  return {
    el,
    renderLaws,
    renderError,
  };
}
