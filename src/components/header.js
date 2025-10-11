// Header component in plain JS
import templateHtml from '@components/templates/header.html?raw';

export function Header({ onSearch, onNavigate }) {
  const el = document.createElement('header');
  el.className = 'sticky';
  el.setAttribute('role', 'banner');

  el.innerHTML = templateHtml;

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
