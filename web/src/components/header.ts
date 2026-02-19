// Header component in plain JS
import templateHtml from '@components/templates/header.html?raw';
import { hydrateIcons, createIcon } from '../utils/icons.ts';
import { getTheme, cycleTheme, getThemeIcon, getThemeLabel, getThemeTooltip, initTheme } from '../utils/theme.ts';
import { SearchAutocomplete } from './search-autocomplete.ts';
import { isFavoritesEnabled } from '../utils/feature-flags.ts';
import { ExportMenu } from './export-menu.ts';
import type { CleanableElement, OnNavigate, Theme } from '../types/app.d.ts';

export function Header({ onSearch, onNavigate }: { onSearch: (filters: { q: string }) => void; onNavigate: OnNavigate; currentPage?: string }) {
  const header = document.createElement('header');
  header.className = 'sticky';
  header.setAttribute('role', 'banner');

  header.innerHTML = templateHtml;
  
  // Initialize theme system
  initTheme();

  // Conditionally inject favorites nav item if feature is enabled
  if (isFavoritesEnabled()) {
    const navList = header.querySelector('#nav-dropdown ul');
    const categoriesItem = navList?.querySelector('[data-nav="categories"]')?.closest('li');
    if (categoriesItem && navList) {
      const favoritesItem = document.createElement('li');
      favoritesItem.innerHTML = `
        <a href="/favorites" class="nav-dropdown-item" data-nav="favorites">
          Browse My Favorites Laws
        </a>
      `;
      categoriesItem.after(favoritesItem);
    }
  }
  
  // Add export menu before theme toggle
  const exportMenuContainer = header.querySelector('#export-menu-container');
  let exportMenuCleanup: (() => void) | null | undefined = null;
  if (exportMenuContainer) {
    const exportMenu = ExportMenu();
    exportMenuContainer.replaceWith(exportMenu);
    exportMenuCleanup = (exportMenu as CleanableElement).cleanup;
  }

  // Hydrate icons
  hydrateIcons(header);

  const navToggle = header.querySelector('#nav-menu-toggle');
  const navDropdown = header.querySelector('#nav-dropdown');
  const themeToggle = header.querySelector('#theme-toggle');

  // Toggle dropdown
  const handleToggleClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = navDropdown?.classList.toggle('open');
    navToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  navToggle?.addEventListener('click', handleToggleClick);

  // Close dropdown when clicking outside
  const handleDocumentClick = (e: Event) => {
    if (!header.contains(e.target as Node)) {
      navDropdown?.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }
  };

  document.addEventListener('click', handleDocumentClick);

  // Theme toggle functionality
  const updateThemeToggle = (theme: Theme) => {
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
  const handleThemeChange = (e: Event) => {
    updateThemeToggle((e as CustomEvent).detail.theme);
  };
  document.addEventListener('themechange', handleThemeChange);

  // Store cleanup function on the element
  (header as CleanableElement).cleanup = () => {
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
  let autocompleteCleanup: (() => void) | null = null;

  if (form) {
    const input = form.querySelector<HTMLInputElement>('input[aria-label="Search"]') || form.querySelector<HTMLInputElement>('input');
    
    // Initialize search autocomplete
    if (input) {
      const autocomplete = SearchAutocomplete({
        inputElement: input,
        onSelect: (law) => {
          if (onNavigate && law.id) {
            onNavigate('law', String(law.id));
          }
        }
      });
      autocompleteCleanup = autocomplete.cleanup;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input && 'value' in input ? (input as HTMLInputElement).value.trim() : '';
      onSearch({ q: q });
    });
  }

  // Store cleanup function on the element
  const originalCleanup = (header as CleanableElement).cleanup;
  (header as CleanableElement).cleanup = () => {
    if (originalCleanup) {
      originalCleanup();
    }
    if (autocompleteCleanup) {
      autocompleteCleanup();
    }
    if (exportMenuCleanup) {
      exportMenuCleanup();
    }
  };

  return header;
}
