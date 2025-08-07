// Placeholder simple views to complete the router. You can enhance later.
export function Browse({ isLoggedIn, searchQuery, onNavigate, onVote }) {
  const el = document.createElement('div');
  el.className = 'container';
  el.style.padding = '2rem 1rem';
  el.innerHTML = `
    <h2 style="font-size:1.5rem; margin-bottom:1rem;">Browse All Laws</h2>
    <p class="small">Search query: ${searchQuery ? `<strong>${searchQuery}</strong>` : '— none —'}</p>
    <button class="outline" data-nav="home">Back to Home</button>
  `;
  el.addEventListener('click', (e) => {
    const t = e.target; if (t instanceof HTMLElement && t.dataset.nav) onNavigate(t.dataset.nav);
  });
  return el;
}

