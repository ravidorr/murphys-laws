import { LawOfTheDay } from '@components/law-of-day.js';
import { TopVoted } from '@components/top-voted.js';
import { Trending } from '@components/trending.js';
import { RecentlyAdded } from '@components/recently-added.js';

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
  el.className = 'container page law-detail pt-0';

  function renderNotFound() {
    el.innerHTML = `
      <div class="card"><div class="card-content text-center">
        <h2 class="mb-4">Law Not Found</h2>
        <button data-nav="browse">Browse All Laws</button>
      </div></div>
    `;
  }

  function renderLaw(law) {
    const displayScore = Number.isFinite(law.score) ? law.score : 0;
    const attsHtml = renderAttributionsList(law.attributions);

    // Clear and start fresh
    el.innerHTML = '';

    // Fetch Law of the Day
    fetchLawOfTheDay()
      .then(data => {
        const laws = data && Array.isArray(data.data) ? data.data : [];
        let lawOfTheDay = null;
        let isCurrentLawOfTheDay = false;

        if (laws.length > 0) {
          lawOfTheDay = laws[0]; // First result is the top-voted law
          isCurrentLawOfTheDay = lawOfTheDay && lawOfTheDay.id === law.id;
        }

        // Add Law of the Day component first (without button on detail page)
        if (lawOfTheDay) {
          const lodWidget = LawOfTheDay({ law: lawOfTheDay, onNavigate, showButton: false });
          el.appendChild(lodWidget);
        }

        // Only add current law details card if it's NOT the Law of the Day
        if (!isCurrentLawOfTheDay) {
          const lawCard = document.createElement('div');
          lawCard.innerHTML = `
            <div class="card"><div class="card-content">
              <h2 class="mb-4">${law.title ?? 'Law'}</h2>
              <blockquote class="blockquote">${law.text}</blockquote>
              ${attsHtml || (law.author ? `<p class="small mb-4">— ${law.author}</p>` : '')}
              <div class="small law-meta mb-4">
                <span>Score: ${displayScore > 0 ? '+' : ''}${displayScore}</span>
                ${law.submittedBy ? `<span>Submitted by ${law.submittedBy}</span>` : ''}
              </div>
              <div class="flex gap-2">
                <button data-vote="up" data-id="${law.id}" aria-label="Upvote" title="Upvote">
                  <span class="material-symbols-outlined">thumb_up</span>
                </button>
                <button class="outline" data-vote="down" data-id="${law.id}" aria-label="Downvote" title="Downvote">
                  <span class="material-symbols-outlined">thumb_down</span>
                </button>
                <button class="btn outline" data-nav="browse">Browse All Laws</button>
              </div>
            </div></div>
          `;
          el.appendChild(lawCard);
        }

        // Add Top Voted, Trending, Recently Added components (they fetch their own data)
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid mb-12 section-grid';

        const topVotedWidget = TopVoted();
        const trendingWidget = Trending();
        const recentlyAddedWidget = RecentlyAdded();

        gridWrapper.appendChild(topVotedWidget);
        gridWrapper.appendChild(trendingWidget);
        gridWrapper.appendChild(recentlyAddedWidget);

        el.appendChild(gridWrapper);
      })
      .catch(err => {
        console.error('Failed to fetch Law of the Day:', err);
        // Fallback: render law without Law of the Day component
        const lawCard = document.createElement('div');
        lawCard.innerHTML = `
          <div class="card"><div class="card-content">
            <h2 class="mb-4">${law.title ?? 'Law'}</h2>
            <blockquote class="blockquote">${law.text}</blockquote>
            ${attsHtml || (law.author ? `<p class="small mb-4">— ${law.author}</p>` : '')}
            <div class="small law-meta mb-4">
              <span>Score: ${displayScore > 0 ? '+' : ''}${displayScore}</span>
              ${law.submittedBy ? `<span>Submitted by ${law.submittedBy}</span>` : ''}
            </div>
            <div class="flex gap-2">
              <button data-vote="up" data-id="${law.id}" aria-label="Upvote" title="Upvote">
                <span class="material-symbols-outlined">thumb_up</span>
              </button>
              <button class="outline" data-vote="down" data-id="${law.id}" aria-label="Downvote" title="Downvote">
                <span class="material-symbols-outlined">thumb_down</span>
              </button>
              <button class="btn outline" data-nav="browse">Browse All Laws</button>
            </div>
          </div></div>
        `;
        el.appendChild(lawCard);

        // Still add the other components
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'grid mb-12 section-grid';

        const topVotedWidget = TopVoted();
        const trendingWidget = Trending();
        const recentlyAddedWidget = RecentlyAdded();

        gridWrapper.appendChild(topVotedWidget);
        gridWrapper.appendChild(trendingWidget);
        gridWrapper.appendChild(recentlyAddedWidget);

        el.appendChild(gridWrapper);
      });
  }

  async function fetchLawOfTheDay() {
    const qs = new URLSearchParams({ limit: '1', offset: '0', sort: 'score', order: 'desc' });
    const primaryUrl = `/api/laws?${qs.toString()}`;
    try {
      const r = await fetch(primaryUrl, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) throw new Error(`Primary fetch not ok: ${r.status}`);
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Primary returned non-JSON');
      return await r.json();
    } catch (err) {
      console.error('API fetch failed, falling back to direct API:', err);
      const fallbackUrl = `http://127.0.0.1:8787/api/laws?${qs.toString()}`;
      const r2 = await fetch(fallbackUrl, { headers: { 'Accept': 'application/json' } });
      if (!r2.ok) throw new Error(`Fallback fetch not ok: ${r2.status}`);
      return await r2.json();
    }
  }

  // Initial loading
  el.innerHTML = `<p class="small">Loading law...</p>`;

  const numericId = Number(lawId);
  const fetchUrl = Number.isFinite(numericId) ? `/api/laws/${numericId}` : null;

  if (!fetchUrl) {
    renderNotFound();
  } else {
    fetch(fetchUrl)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('not ok')))
      .then(data => renderLaw(data))
      .catch(() => {
        renderNotFound();
      });
  }

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.nav) onNavigate(t.dataset.nav);
    if (t.dataset.vote && t.dataset.id) onVote(t.dataset.id, t.dataset.vote);
  });

  return el;
}
