// Home view: mirrors HomePage.tsx sections using mock data
import { mockLaws } from '../data.js';

export function Home({ isLoggedIn, onNavigate, _onVote }) {
  const el = document.createElement('div');
  el.className = 'container page';

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
      <h1 class="gradient-title">Murphy's Law Archive</h1>
      <p class="small mb-8">If it can go wrong, you'll find it here.</p>
      <div class="flex gap-4 justify-center">
        <button data-nav="submit">Submit a Law</button>
        <button class="outline" data-nav="browse">Browse All Laws</button>
      </div>
    </div>

    ${lawOfTheDay ? `
      <div class="card mb-12 thick-border">
        <div class="card-content">
          <h3 class="card-title">⭐ Law of the Day <span class="small" style="margin-left:.5rem;">${fmtDate(new Date().toISOString())}</span></h3>
          <div class="p-2 cursor-pointer" data-law-id="${lawOfTheDay.id}">
            <blockquote class="blockquote">"${lawOfTheDay.text}"</blockquote>
            ${lawOfTheDay.author ? `<p class="small mb-4">— ${lawOfTheDay.author}</p>` : ''}
            <div class="small law-meta">
              <span>Score: +${lawOfTheDay.score}</span>
              <span>Submitted by ${lawOfTheDay.submittedBy}</span>
              ${lawOfTheDay.stories.length > 0 ? `<span>${lawOfTheDay.stories.length} stories</span>` : ''}
            </div>
            <div class="mt-8">
              <button class="link" data-nav="law-history">View History →</button>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="grid mb-12 section-grid">
      <div class="card"><div class="card-content">
        <h4 class="card-title">Top Voted</h4>
        <div>
          ${topVoted.map((law,i) => `
            <div class="p-2 rounded cursor-pointer" data-law-id="${law.id}">
              <div class="flex items-start gap-2">
                <span class="rank">#${i+1}</span>
                <div style="flex:1; min-width:0;">
                  <p class="small text-ellipsis">${law.text}</p>
                  <div class="small flex gap-2 mt-8">
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
        <h4 class="card-title">Trending Now</h4>
        <div>
          ${trending.map((law) => `
            <div class="p-2 rounded cursor-pointer" data-law-id="${law.id}">
              <p class="small">${law.text}</p>
              <div class="small flex gap-2 mt-8">
                <span>+${law.score}</span>
                ${law.author ? `<span>— ${law.author}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div></div>

      <div class="card"><div class="card-content">
        <h4 class="card-title">Recently Added</h4>
        <div>
          ${recent.map((law) => `
            <div class="p-2 rounded cursor-pointer" data-law-id="${law.id}">
              <p class="small">${law.text}</p>
              <div class="small flex gap-2 items-center mt-8">
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
        <h3 class="mb-4">Join the Community</h3>
        <p class="small mb-8">Contribute to the definitive collection of Murphy's Laws. Share your discoveries, vote on the best laws, and tell your stories of when things went wonderfully wrong.</p>
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
