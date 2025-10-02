// Home view: fetch laws from API and render sections (no local mock data)

import { LawOfTheDay } from '@components/law-of-day.js';
import { SodCalculatorSimple } from '@components/sod-calculator.js';
import { SubmitLawSection } from '@components/submit-law.js';

function renderHome(el, laws = [], onNavigate) {
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

  el.innerHTML = `<p class="small">Loading laws...</p>`;

  function fetchAndRender() {
    const qs = new URLSearchParams({ limit: String(25), offset: String(0) });

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
        renderHome(el, json && Array.isArray(json.data) ? json.data : [], onNavigate);
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
  });

  return el;
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
