// Header component in plain JS
import { navigate as _navigate } from '../router.js';

export function Header({ onSearch, onNavigate, currentPage, isLoggedIn, currentUser }) {
  const el = document.createElement('header');
  el.className = 'sticky';

  el.innerHTML = `
    <div class="container">
      <div class="flex h-16 items-center justify-between">
        <div class="brand" data-nav="home">
          <div class="brand-badge">M</div>
          <span class="font-semibold">Murphy's Law Archive</span>
        </div>

        

        <nav class="flex items-center gap-2">
          <button class="${currentPage === 'browse' ? '' : 'outline'}" data-nav="browse">Browse All Laws</button>
          <button class="${currentPage === 'calculator' ? '' : 'outline'}" data-nav="calculator">Calculator</button>
          <button class="${currentPage === 'submit' ? '' : 'outline'}" data-nav="submit">Submit a Law</button>
          ${isLoggedIn ? `<button class="outline" data-nav="profile">${currentUser ?? 'Profile'}</button>` : ''}
        </nav>
      </div>
    </div>
  `;

  // Nav clicks
  el.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.dataset.nav) {
      e.preventDefault();
      onNavigate(t.dataset.nav);
    }
  });

  // Removed header search form for this milestone

  el.querySelector('.brand')?.addEventListener('click', () => onNavigate('home'));

  return el;
}
