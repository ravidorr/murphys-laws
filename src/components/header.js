// Header component in plain JS
export function Header({ onSearch, onNavigate, currentPage, isLoggedIn, currentUser }) {
  const el = document.createElement('header');
  el.className = 'sticky';
  el.setAttribute('role', 'banner');

  el.innerHTML = `
    <div class="container">
      <div class="flex h-16 items-center justify-between gap-4">
        <div class="brand-wrapper">
          <a class="brand" href="#/home">
            <button class="brand-badge" id="nav-menu-toggle" type="button" aria-label="Toggle navigation menu" aria-expanded="false">
              M
            </button>
            <div class="brand-content">
              <h2 class="brand-name"><span class="accent-text">Murphy's</span> Law</h2>
              <span class="brand-subtitle">If it can go wrong, it will, and you'll find it here.</span>
            </div>
          </a>
          <nav class="nav-dropdown" id="nav-dropdown" aria-label="Main navigation">
            <a href="#/home" class="nav-dropdown-item" data-nav="home">
              <span class="material-symbols-outlined icon">home</span>
              Home
            </a>
            <a href="#/browse" class="nav-dropdown-item" data-nav="browse">
              <span class="material-symbols-outlined icon">list</span>
              All of Murphy's Laws
            </a>
            <a href="#/calculator" class="nav-dropdown-item" data-nav="calculator">
              <span class="material-symbols-outlined icon">calculate</span>
              Sod's Law Calculator
            </a>
            <a href="#/submit" class="nav-dropdown-item" data-nav="submit">
              <span class="material-symbols-outlined icon">send</span>
              Submit your Murphy's Law
            </a>
          </nav>
        </div>

        <form role="search" class="flex items-center gap-2" aria-label="Site Search">
          <input type="text" aria-label="Search" placeholder="Search" class="input" />
          <button type="submit" class="btn outline">Search</button>
        </form>
      </div>
    </div>
  `;

  const navToggle = el.querySelector('#nav-menu-toggle');
  const navDropdown = el.querySelector('#nav-dropdown');

  // Toggle dropdown
  const handleToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = navDropdown?.classList.toggle('open');
    navToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  navToggle?.addEventListener('click', handleToggleClick);

  // Close dropdown when clicking outside
  const handleDocumentClick = (e) => {
    if (!el.contains(e.target)) {
      navDropdown?.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  };

  document.addEventListener('click', handleDocumentClick);

  // Store cleanup function on the element
  el.cleanup = () => {
    document.removeEventListener('click', handleDocumentClick);
  };

  // Close dropdown when clicking a nav item
  navDropdown?.addEventListener('click', () => {
    navDropdown.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });

  el.addEventListener('click', (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.dataset.nav) {
      onNavigate(t.dataset.nav);
    }
  });

  const form = el.querySelector('form[role="search"]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[aria-label="Search"]') || form.querySelector('input');
      const q = input && 'value' in input ? input.value.trim() : '';
      onSearch(q);
    });
  }

  return el;
}
