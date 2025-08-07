import { mockLaws } from '../data.js';

export function LawDetail({ lawId, isLoggedIn, currentUser, onNavigate, onVote }) {
  const law = mockLaws.find(l => l.id === lawId);
  const el = document.createElement('div');
  el.className = 'container';
  el.style.padding = '2rem 1rem';

  if (!law) {
    el.innerHTML = `
      <div class="card"><div class="card-content" style="text-align:center;">
        <h2 style="font-size:1.25rem; margin-bottom:1rem;">Law Not Found</h2>
        <button data-nav="browse">Browse All Laws</button>
      </div></div>
    `;
  } else {
    el.innerHTML = `
      <div class="card"><div class="card-content">
        <h2 style="font-size:1.5rem; margin-bottom:.5rem;">${law.title}</h2>
        <blockquote style="font-style:italic; border-left:4px solid var(--primary); padding-left:1rem; margin:.5rem 0 1rem;">"${law.text}"</blockquote>
        ${law.author ? `<p class="small">— ${law.author}</p>` : ''}
        <div class="small" style="display:flex; gap:1rem; margin:.5rem 0;">
          <span>Score: +${law.score}</span>
          <span>Submitted by ${law.submittedBy}</span>
        </div>
        <div class="flex gap-2">
          <button data-vote="up" data-id="${law.id}">Upvote</button>
          <button class="outline" data-vote="down" data-id="${law.id}">Downvote</button>
        </div>
      </div></div>
    `;
  }

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.nav) onNavigate(t.dataset.nav);
    if (t.dataset.vote && t.dataset.id) onVote(t.dataset.id, t.dataset.vote);
  });

  return el;
}

