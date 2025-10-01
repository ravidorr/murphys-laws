// Law of the Day widget component (scaffold)
// No inline CSS; scoped classes live in styles/site.css under .lod-*

export function LawOfTheDay({ law, onNavigate }) {
  const el = document.createElement('section');
  el.className = 'lod lod-card mb-12';

  if (!law) {
    el.innerHTML = `
      <div class="lod-skeleton" role="status" aria-label="Loading Law of the Day"></div>
    `;
    return el;
  }

  const iso = new Date().toISOString();
  const dateText = new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const score = Number.isFinite(law.score) ? law.score : 0;
  const up = Number.isFinite(law.up) ? law.up : Math.max(score, 0);
  const down = Number.isFinite(law.down) ? law.down : Math.max(-score, 0);

  el.innerHTML = `
    <div class="lod-body" data-law-id="${law.id}">
      <div class="lod-header">
        <h3 class="lod-title">⭐ Law of the Day</h3>
        <time class="lod-date" datetime="${iso}">${dateText}</time>
      </div>

      <blockquote class="lod-quote-large">“${law.text}”</blockquote>
      <p class="lod-attrib">${law.author ? `— ${law.author}` : ''}</p>
    </div>

    <div class="lod-footer">
      <div class="left">
        <span class="lod-count lod-up" aria-label="upvotes">
          <span class="material-symbols-outlined lod-icon">thumb_up</span>
          <span class="lod-num">${up}</span>
        </span>
        <span class="lod-count lod-down" aria-label="downvotes">
          <span class="material-symbols-outlined lod-icon">thumb_down</span>
          <span class="lod-num">${down}</span>
        </span>
      </div>
      <button class="btn" type="button" data-nav="law-history" aria-label="View history of Law of the Day">
        View History
        <span class="material-symbols-outlined lod-icon ml">arrow_forward</span>
      </button>
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
