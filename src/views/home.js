// Home view: fetch laws from API and render sections (no local mock data)

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

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatScore(val) {
  const n = Number.isFinite(val) ? val : 0;
  return `${n > 0 ? '+' : ''}${n}`;
}

function renderHome(el, laws = []) {
  const data = Array.isArray(laws) ? laws : [];
  const sortedByScore = [...data].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const lawOfTheDay = sortedByScore[0] || null;
  const topVoted = sortedByScore.slice(0, 5);
  const trending = [...data].sort(() => Math.random() - 0.5).slice(0, 3);
  const recent = [...data].slice(0, 3);

  el.innerHTML = `
    ${lawOfTheDay ? `
    <div class="card mb-12 thick-border">
      <div class="card-content">
        <h3 class="card-title">⭐ Law of the Day <span class="small" style="margin-left:.5rem;">${fmtDate(new Date().toISOString())}</span></h3>
        <div class="p-2 cursor-pointer" data-law-id="${lawOfTheDay.id}">
          <blockquote class="blockquote">${lawOfTheDay.text}</blockquote>
          <p class="small mb-4">${firstAttributionLine(lawOfTheDay)}</p>
          <div class="small law-meta">
            <span>${formatScore(lawOfTheDay.score)}</span>
            ${lawOfTheDay.submittedBy ? `<span>Submitted by ${lawOfTheDay.submittedBy}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="grid mb-12 section-grid">
      <div class="card">
        <div class="card-content">
          <h4 class="card-title">Top Voted</h4>
          <div>
            ${topVoted.map((law, i) => `
            <div class="p-2 rounded cursor-pointer" data-law-id="${law.id}">
              <div class="flex items-start gap-2">
                <span class="rank">#${i + 1}</span>
                <div style="flex:1; min-width:0;">
                  <p class="small text-ellipsis">${law.text}</p>
                  <div class="small flex gap-2 mt-8">
                    <span>${formatScore(law.score)}</span>
                    ${firstAttributionLine(law) ? `<span>${firstAttributionLine(law)}</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
            `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-content">
        <h4 class="card-title">Trending Now</h4>
        <div>
          ${trending.map((law) => `
          <div class="p-2 rounded cursor-pointer" data-law-id="${law.id}">
            <p class="small">${law.text}</p>
            <div class="small flex gap-2 mt-8">
              <span>${formatScore(law.score)}</span>
              ${firstAttributionLine(law) ? `<span>${firstAttributionLine(law)}</span>` : ''}
            </div>
          </div>
          `).join('')}
        </div>
      </div>
    </div>

      <div class="card">
        <div class="card-content">
          <h4 class="card-title">Recently Added</h4>
          <div>
            ${recent.map((law) => `
            <div class="p-2 rounded cursor-pointer" data-law-id="${law.id}">
              <p class="small">${law.text}</p>
              <div class="small flex gap-2 items-center mt-8">
                <span>${formatScore(law.score)}</span>
                ${law.publishDate ? `<span>${fmtDate(law.publishDate)}</span>` : ''}
              </div>
            </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function Home({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';

  el.innerHTML = `<p class="small">Loading laws...</p>`;

  function getParams() {
    const params = new URLSearchParams(window.location.search);
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.max(1, Math.min(100, Number(params.get('limit') || 25)));
    return { page, limit };
  }

  function fetchAndRender() {
    const { page, limit } = getParams();
    const offset = (page - 1) * limit;

    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });

    fetchLawList(qs)
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
        renderHome(el, json && Array.isArray(json.data) ? json.data : []);
        renderPagination(el, { total, limit, page });
      })
      .catch(err => {
        console.error('API fetch failed:', err);
        el.innerHTML = `
          <div class="container page">
            <h2 class="mb-4">Failed to load laws</h2>
            <p class="small">Please try again later.</p>
          </div>
        `;
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
    // Pagination buttons
    if (t.matches('[data-page]')) {
      const newPage = Number(t.getAttribute('data-page'));
      if (Number.isFinite(newPage) && newPage > 0) {
        const params = new URLSearchParams(window.location.search);
        params.set('page', String(newPage));
        window.history.replaceState(null, '', `?${params.toString()}`);
        fetchAndRender();
      }
    }
  });

  return el;
}

function renderPagination(el, { total, limit, page }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return;

  function pageHref(p) {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(p));
    params.set('limit', String(limit));
    return `?${params.toString()}`;
  }

  function buildPageList(current, totalPgs) {
    const set = new Set([1, totalPgs, current]);
    if (current - 1 >= 1) set.add(current - 1);
    if (current + 1 <= totalPgs) set.add(current + 1);
    return Array.from(set).sort((a, b) => a - b);
  }

  const corePages = buildPageList(page, totalPages);
  const host = document.createElement('div');
  host.className = 'container mt-8';
  let parts = '';

  // First / Prev
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const firstDisabled = page === 1 ? 'disabled' : '';
  const prevDisabled = page === 1 ? 'disabled' : '';
  const nextDisabled = page === totalPages ? 'disabled' : '';
  const lastDisabled = page === totalPages ? 'disabled' : '';

  parts += `
    <a class="btn outline ${firstDisabled}" href="${pageHref(1)}" data-page="1" aria-label="First page" ${page === 1 ? 'aria-disabled="true"' : ''}>First</a>
    <a class="btn outline ${prevDisabled}" href="${pageHref(prev)}" data-page="${prev}" aria-label="Previous page" ${page === 1 ? 'aria-disabled="true"' : ''}>Prev</a>
  `;

  // Numbered pages with ellipses
  let lastRendered = 0;
  for (const p of corePages) {
    if (p - lastRendered > 1) {
      parts += `<span class="ellipsis" aria-hidden="true">…</span>`;
    }
    const isCurrent = p === page;
    parts += `
      <a class="btn ${isCurrent ? '' : 'outline'}" href="${pageHref(p)}" data-page="${p}" ${isCurrent ? 'aria-current="page"' : ''}>${p}</a>
    `;
    lastRendered = p;
  }

  // Next / Last
  parts += `
    <a class="btn outline ${nextDisabled}" href="${pageHref(next)}" data-page="${next}" aria-label="Next page" ${page === totalPages ? 'aria-disabled="true"' : ''}>Next</a>
    <a class="btn outline ${lastDisabled}" href="${pageHref(totalPages)}" data-page="${totalPages}" aria-label="Last page" ${page === totalPages ? 'aria-disabled="true"' : ''}>Last</a>
  `;

  host.innerHTML = `
    <nav class="pagination" aria-label="Pagination">${parts}</nav>
  `;
  el.appendChild(host);
}

async function fetchLawList(qs) {
  const primaryUrl = `/api/laws?${qs.toString()}`;
  try {
    const r = await fetch(primaryUrl, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`Primary fetch not ok: ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error('Primary returned non-JSON');
    return await r.json();
  } catch (err) {
    // Fallback to direct API host (CORS enabled in server)
    console.error('API fetch failed, falling back to mock data:', err);
    const fallbackUrl = `http://127.0.0.1:8787/api/laws?${qs.toString()}`;
    const r2 = await fetch(fallbackUrl, { headers: { 'Accept': 'application/json' } });
    if (!r2.ok) throw new Error(`Fallback fetch not ok: ${r2.status}`);
    return await r2.json();
  }
}
