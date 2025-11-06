// Header component in plain JS
import templateHtml from '@components/templates/header.html?raw';
import { hydrateIcons } from '../utils/icons.js';

export function Header({ onSearch, onNavigate }) {
  const header = document.createElement('header');
  header.className = 'sticky';
  header.setAttribute('role', 'banner');

  header.innerHTML = templateHtml;
  
  // Hydrate icons
  hydrateIcons(header);

  const navToggle = header.querySelector('#nav-menu-toggle');
  const navDropdown = header.querySelector('#nav-dropdown');

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
    if (!header.contains(e.target)) {
      navDropdown?.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  };

  document.addEventListener('click', handleDocumentClick);

  // Store cleanup function on the element
  header.cleanup = () => {
    document.removeEventListener('click', handleDocumentClick);
  };

  // Close dropdown when clicking a nav item
  navDropdown?.addEventListener('click', () => {
    navDropdown.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });

  header.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const navBtn = t.closest('[data-nav]');
    if (navBtn) {
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  const form = header.querySelector('form[role="search"]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[aria-label="Search"]') || form.querySelector('input');
      const q = input && 'value' in input ? input.value.trim() : '';
      onSearch(q);
    });
  }

  return header;
}
