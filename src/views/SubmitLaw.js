export function SubmitLaw({ isLoggedIn, _currentUser, onNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.innerHTML = `
    <h2 class="mb-4">Submit a Law</h2>
    ${!isLoggedIn ? '<p class="small">You are not logged in. You can still draft a law, but submission flow is simplified here.</p>' : ''}
    <form class="card"><div class="card-content">
      <div class="mb-4">
        <label class="small" for="title">Title</label><br/>
        <input id="title" type="text" placeholder="Law title" />
      </div>
      <div class="mb-4">
        <label class="small" for="text">Text</label><br/>
        <input id="text" type="text" placeholder="" />
      </div>
      <button type="submit">Submit</button>
      <button type="button" class="outline" data-nav="home">Cancel</button>
    </div></form>
  `;
  el.addEventListener('click', (e) => {
    const t = e.target; if (t instanceof HTMLElement && t.dataset.nav) onNavigate(t.dataset.nav);
  });
  el.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    onNavigate('submit-success');
  });
  return el;
}

