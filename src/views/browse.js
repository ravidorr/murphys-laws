// Placeholder simple views to complete the router. You can enhance later.
export function Browse({ _isLoggedIn, searchQuery, onNavigate, _onVote }) {
  const el = document.createElement('div');
  el.className = 'container page';
  el.innerHTML = `
    <h2 class="mb-4">Browse All Laws</h2>
    <p class="small">Search query: ${searchQuery ? `<strong>${searchQuery}</strong>` : '— none —'}</p>
    <button class="outline" data-nav="home">Back to Home</button>
  `;
  el.addEventListener('click', (e) => {
    const t = e.target; if (t instanceof HTMLElement && t.dataset.nav) onNavigate(t.dataset.nav);
  });
  return el;
}
