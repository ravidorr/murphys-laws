// Header component in plain JS
import templateHtml from '@components/templates/header.html?raw';
import { hydrateIcons, createIcon } from '../utils/icons.js';
import { getTheme, cycleTheme, getThemeIcon, getThemeLabel, getThemeTooltip, initTheme } from '../utils/theme.js';
import { SearchAutocomplete } from './search-autocomplete.js';
import { isFavoritesEnabled } from '../utils/feature-flags.js';

export function Header({ onSearch, onNavigate }) {
  const header = document.createElement('header');
  header.className = 'sticky';
  header.setAttribute('role', 'banner');

  header.innerHTML = templateHtml;
  
  // Initialize theme system
  initTheme();

  // Conditionally inject favorites nav item if feature is enabled
  if (isFavoritesEnabled()) {
    const navList = header.querySelector('#nav-dropdown ul');
    const browseItem = navList?.querySelector('[data-nav="browse"]')?.closest('li');
    if (browseItem && navList) {
      const favoritesItem = document.createElement('li');
      favoritesItem.innerHTML = `
        <a href="/favorites" class="nav-dropdown-item" data-nav="favorites">
          My Favorites
        </a>
      `;
      browseItem.after(favoritesItem);
    }
  }
  
  // Hydrate icons
  hydrateIcons(header);

  const navToggle = header.querySelector('#nav-menu-toggle');
  const navDropdown = header.querySelector('#nav-dropdown');
  const themeToggle = header.querySelector('#theme-toggle');

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

  // Theme toggle functionality
  const updateThemeToggle = (theme) => {
    if (!themeToggle) return;
    
    const iconName = getThemeIcon(theme);
    const label = getThemeLabel(theme);
    const tooltip = getThemeTooltip(theme);
    
    // Update aria-label and tooltip
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('data-tooltip', tooltip);
    
    // Replace the icon
    const existingIcon = themeToggle.querySelector('.icon');
    const newIcon = createIcon(iconName, { classNames: ['icon'] });
    if (existingIcon && newIcon) {
      existingIcon.replaceWith(newIcon);
    }
  };

  // Set initial state
  updateThemeToggle(getTheme());

  // Handle theme toggle click
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const newTheme = cycleTheme();
      updateThemeToggle(newTheme);
    });
  }

  // Listen for theme changes (e.g., from system preference changes in auto mode)
  const handleThemeChange = (e) => {
    updateThemeToggle(e.detail.theme);
  };
  document.addEventListener('themechange', handleThemeChange);

  // Store cleanup function on the element
  header.cleanup = () => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('themechange', handleThemeChange);
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
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  const form = header.querySelector('form[role="search"]');
  let autocompleteCleanup = null;

  if (form) {
    const input = form.querySelector('input[aria-label="Search"]') || form.querySelector('input');
    
    // Initialize search autocomplete
    if (input) {
      const autocomplete = SearchAutocomplete({
        inputElement: input,
        onSelect: (law) => {
          if (onNavigate && law.id) {
            onNavigate('law', law.id);
          }
        }
      });
      autocompleteCleanup = autocomplete.cleanup;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input && 'value' in input ? input.value.trim() : '';
      onSearch({ q: q });
    });
  }

  // Store cleanup function on the element
  const originalCleanup = header.cleanup;
  header.cleanup = () => {
    if (originalCleanup) {
      originalCleanup();
    }
    if (autocompleteCleanup) {
      autocompleteCleanup();
    }
  };

  return header;
}
