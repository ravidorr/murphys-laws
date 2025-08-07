// Home view: mirrors HomePage.tsx sections using mock data
import { mockLaws } from '../data.js';

export function Home({ isLoggedIn, onNavigate, onVote }) {
  const el = document.createElement('div');
  el.className = 'container';
  el.style.padding = '2rem 1rem';

  // Compute sections
  const sortedByScore = [...mockLaws].sort((a,b) => b.score - a.score);
  const lawOfTheDay = sortedByScore[0] || null;
  const topVoted = sortedByScore.slice(0,5);
  const trending = [...mockLaws].sort(() => Math.random() - 0.5).slice(0,3);
  const recent = [...mockLaws]
    .sort((a,b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
    .slice(0,3);

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  el.innerHTML = `
    <div class="text-center mb-12">
      <h1 style="font-size:2.5rem; margin:0 0 1rem; background:linear-gradient(90deg,var(--primary), #4b5563); -webkit-background-clip:text; color:transparent;">Murphy's Law Archive</h1>
      <p class="small" style="margin-bottom:2rem;">If it can go wrong, you'll find it here.</p>
      <div class="flex gap-4 justify-center">
        <button data-nav="submit">Submit a Law</button>
        <button class="outline" data-nav="browse">Browse All Laws</button>
      </div>
    </div>

    ${lawOfTheDay ? `
      <div class="card mb-12" style="border-width:2px;">
        <div class="card-content">
          <h3 style="display:flex; align-items:center; gap:.5rem; font-size:1.25rem;">⭐ Law of the Day <span class="small" style="margin-left:.5rem;">${fmtDate(new Date().toISOString())}</span></h3>
          <div class="p-2" data-law-id="${lawOfTheDay.id}" style="cursor:pointer;">
            <blockquote style="font-size:1.25rem; font-style:italic; border-left:4px solid var(--primary); padding-left:1rem; margin: .5rem 0 1rem;">"${lawOfTheDay.text}"</blockquote>
            ${lawOfTheDay.author ? `<p class="small" style="margin-bottom:.5rem;">— ${lawOfTheDay.author}</p>` : ''}
            <div class="small" style="display:flex; gap:1rem;">
              <span>Score: +${lawOfTheDay.score}</span>
              <span>Submitted by ${lawOfTheDay.submittedBy}</span>
              ${lawOfTheDay.stories.length > 0 ? `<span>${lawOfTheDay.stories.length} stories</span>` : ''}
            </div>
            <div style="margin-top:.5rem;">
              <button class="link" data-nav="law-history">View History →</button>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="grid mb-12" style="grid-template-columns: repeat(1,minmax(0,1fr)); gap:2rem;">
      <div class="card"><div class="card-content">
        <h4 style="display:flex; align-items:center; gap:.5rem;">Top Voted</h4>
        <div>
          ${topVoted.map((law,i) => `
            <div class="p-2 rounded" data-law-id="${law.id}" style="cursor:pointer;">
              <div class="flex items-start gap-2">
                <span style="width:1.5rem; color:var(--primary); font-weight:700;">#${i+1}</span>
                <div style="flex:1; min-width:0;">
                  <p class="small" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${law.text}</p>
                  <div class="small" style="display:flex; gap:.5rem; margin-top:.25rem;">
                    <span>+${law.score}</span>
                    ${law.author ? `<span>— ${law.author}</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div></div>

      <div class="card"><div class="card-content">
        <h4 style="display:flex; align-items:center; gap:.5rem;">Trending Now</h4>
        <div>
          ${trending.map((law) => `
            <div class="p-2 rounded" data-law-id="${law.id}" style="cursor:pointer;">
              <p class="small">${law.text}</p>
              <div class="small" style="display:flex; gap:.5rem; margin-top:.25rem;">
                <span>+${law.score}</span>
                ${law.author ? `<span>— ${law.author}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div></div>

      <div class="card"><div class="card-content">
        <h4 style="display:flex; align-items:center; gap:.5rem;">Recently Added</h4>
        <div>
          ${recent.map((law) => `
            <div class="p-2 rounded" data-law-id="${law.id}" style="cursor:pointer;">
              <p class="small">${law.text}</p>
              <div class="small" style="display:flex; gap:.5rem; margin-top:.25rem; align-items:center;">
                <span>+${law.score}</span>
                <span>${fmtDate(law.publishDate)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div></div>
    </div>

    <div class="card">
      <div class="card-content text-center">
        <h3 style="font-size:1.25rem; margin-bottom:.5rem;">Join the Community</h3>
        <p class="small" style="margin-bottom:1rem;">Contribute to the definitive collection of Murphy's Laws. Share your discoveries, vote on the best laws, and tell your stories of when things went wonderfully wrong.</p>
        <div class="flex gap-4 justify-center">
          ${!isLoggedIn ? '<button data-nav="signup">Sign Up to Contribute</button>' : ''}
          <button class="outline" data-nav="submit">Submit a New Law</button>
        </div>
      </div>
    </div>
  `;

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

