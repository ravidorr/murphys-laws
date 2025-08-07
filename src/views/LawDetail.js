import { mockLaws } from '../data.js';

export function LawDetail({ lawId, isLoggedIn, currentUser, onNavigate, onVote }) {
  const law = mockLaws.find(l => l.id === lawId);
  const el = document.createElement('div');
  el.className = 'container page';

  if (!law) {
    el.innerHTML = `
      <div class="card"><div class="card-content text-center">
        <h2 class="mb-4">Law Not Found</h2>
        <button data-nav="browse">Browse All Laws</button>
      </div></div>
    `;
  } else {
    el.innerHTML = `
      <div class="card"><div class="card-content">
        <h2 class="mb-4">${law.title}</h2>
        <blockquote class="blockquote">"${law.text}"</blockquote>
        ${law.author ? `<p class="small mb-4">— ${law.author}</p>` : ''}
        <div class="small law-meta mb-4">
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

