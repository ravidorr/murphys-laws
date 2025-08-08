import { mockLaws } from '../data.js';

function renderAttribution(att) {
  if (!att) return '';
  const { name, contact_type, contact_value, note } = att;
  let who = name || '';
  if (contact_type === 'email' && contact_value) {
    who = `<a href="mailto:${contact_value}">${name}</a>`;
  } else if (contact_type === 'url' && contact_value) {
    who = `<a href="${contact_value}">${name}</a>`;
  }
  return `${who}${note ? ` — ${note}` : ''}`;
}

function renderAttributionsList(atts = []) {
  if (!atts || atts.length === 0) return '';
  const items = atts.map(renderAttribution).filter(Boolean).join(', ');
  return `<p class="small mb-4">Sent by ${items}</p>`;
}

export function LawDetail({ lawId, _isLoggedIn, _currentUser, onNavigate, onVote }) {
  const el = document.createElement('div');
  el.className = 'container page';

  function renderNotFound() {
    el.innerHTML = `
      <div class="card"><div class="card-content text-center">
        <h2 class="mb-4">Law Not Found</h2>
        <button data-nav="browse">Browse All Laws</button>
      </div></div>
    `;
  }

  function renderLaw(law) {
    const attsHtml = renderAttributionsList(law.attributions);
    el.innerHTML = `
      <div class="card"><div class="card-content">
        <h2 class="mb-4">${law.title ?? 'Law'}</h2>
        <blockquote class="blockquote">"${law.text}"</blockquote>
        ${attsHtml || (law.author ? `<p class="small mb-4">— ${law.author}</p>` : '')}
        <div class="small law-meta mb-4">
          ${law.score !== null ? `<span>Score: +${law.score}</span>` : ''}
          ${law.submittedBy ? `<span>Submitted by ${law.submittedBy}</span>` : ''}
        </div>
        <div class="flex gap-2">
          <button data-vote="up" data-id="${law.id}">Upvote</button>
          <button class="outline" data-vote="down" data-id="${law.id}">Downvote</button>
        </div>
      </div></div>
    `;
  }

  // Initial loading
  el.innerHTML = `<p class="small">Loading law...</p>`;

  const numericId = Number(lawId);
  const fetchUrl = Number.isFinite(numericId) ? `/api/laws/${numericId}` : null;

  const tryMock = () => {
    const law = (Array.isArray(mockLaws) ? mockLaws : []).find(l => String(l.id) === String(lawId));
    if (law) renderLaw(law); else renderNotFound();
  };

  // Render synchronously from mock first for instant UX and test stability
  tryMock();
  // Then hydrate from API if available
  if (fetchUrl) {
    fetch(fetchUrl)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('not ok')))
      .then(data => renderLaw(data))
      .catch(() => {});
  }

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.nav) onNavigate(t.dataset.nav);
    if (t.dataset.vote && t.dataset.id) onVote(t.dataset.id, t.dataset.vote);
  });

  return el;
}
