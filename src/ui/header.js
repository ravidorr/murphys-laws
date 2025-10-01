// Header component in plain JS
export function Header({ onSearch, onNavigate, currentPage, isLoggedIn, currentUser }) {
  const el = document.createElement('header');
  el.className = 'sticky';
  el.setAttribute('role', 'banner');

  el.innerHTML = `
    <div class="container">
      <div class="flex h-16 items-center justify-between gap-4">
        <a class="brand" href="#/home">
          <span class="brand-badge">M</span>
          <span class="font-semibold brand-name"><span class="accent-text">Murphy's</span> Law</span>
        </a>

        <form role="search" class="flex items-center gap-2" aria-label="Site Search">
          <input type="text" aria-label="Search" placeholder="Search" class="input" />
          <button type="submit" class="btn outline">Search</button>
        </form>

        <nav class="flex items-center gap-2">
          <button type="button" class="btn ${currentPage === 'browse' ? '' : 'outline'}" data-nav="browse">Browse All Laws</button>
          <button type="button" class="btn ${currentPage === 'calculator' ? '' : 'outline'}" data-nav="calculator">Sod's Law Calculator</button>
          <button type="button" class="btn ${currentPage === 'submit' ? '' : 'outline'}" data-nav="submit">Submit a Law</button>
        </nav>
      </div>
    </div>
  `;

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
