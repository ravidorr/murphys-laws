// Trending component - fetches 3 most recently voted laws

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

function firstAttributionLine(law) {
  const a = Array.isArray(law.attributions) ? law.attributions[0] : null;
  if (!a) return law.author ? `— ${law.author}` : '';
  return `Sent by ${renderAttribution(a)}`;
}

function formatScore(val) {
  const n = Number.isFinite(val) ? val : 0;
  return `${n > 0 ? '+' : ''}${n}`;
}

export function Trending() {
  const el = document.createElement('div');
  el.className = 'card';

  el.innerHTML = `
    <div class="card-content">
      <h4 class="card-title">Trending Now</h4>
      <div class="loading-placeholder">
        <p class="small">Loading...</p>
      </div>
    </div>
  `;

  // Fetch 3 most recently voted laws
  async function fetchTrending() {
    const qs = new URLSearchParams({
      limit: '3',
      offset: '0',
      sort: 'last_voted_at',
      order: 'desc'
    });
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

  fetchTrending()
    .then(data => {
      const laws = data && Array.isArray(data.data) ? data.data : [];
      const trending = laws.slice(0, 3);

      const contentDiv = el.querySelector('.card-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <h4 class="card-title">Trending Now</h4>
          <div class="card-text">
            ${trending.map((law) => {
    const up = Number.isFinite(law.up) ? law.up : 0;
    const down = Number.isFinite(law.down) ? law.down : 0;
    const attribution = firstAttributionLine(law);
    const titleText = law.title ? `<strong>${law.title}:</strong> ${law.text}` : law.text;
    return `
              <div class="law-card-mini" data-law-id="${law.id}">
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
          <h4 class="card-title">Trending Now</h4>
          <p class="small">Failed to load trending laws.</p>
        `;
      }
    });

  return el;
}
