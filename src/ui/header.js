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

        <form class="flex-1 search-form">
          <input type="text" placeholder="Search laws..." aria-label="Search" />
        </form>

        <nav class="flex items-center gap-2">
          <button class="${currentPage === 'home' ? '' : 'outline'}" data-nav="home">Home</button>
          <button class="${currentPage === 'browse' ? '' : 'outline'}" data-nav="browse">Browse All Laws</button>
          <button class="${currentPage === 'calculator' ? '' : 'outline'}" data-nav="calculator">Calculator</button>
          <button class="${currentPage === 'submit' ? '' : 'outline'}" data-nav="submit">Submit a Law</button>
          ${isLoggedIn ? `<button class="outline" data-nav="profile">${currentUser ?? 'Profile'}</button>` : `
            <button data-nav="signup">Sign Up</button>
          `}
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

  // Search
  const form = el.querySelector('form');
  const input = el.querySelector('input[type="text"]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input && input.value.trim()) onSearch(input.value.trim());
  });

  el.querySelector('.brand')?.addEventListener('click', () => onNavigate('home'));

  return el;
}
