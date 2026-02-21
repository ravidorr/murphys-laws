import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Header } from '../src/components/header.js';
import type { CleanableElement, Law } from '../src/types/app.js';

// Mock feature flags
vi.mock('../src/utils/feature-flags.js', () => ({
  isFavoritesEnabled: vi.fn(() => true),
}));

import { isFavoritesEnabled } from '../src/utils/feature-flags.js';

// Mock theme module to avoid side effects during tests
vi.mock('../src/utils/theme.js', () => ({
  getTheme: vi.fn(() => 'auto'),
  cycleTheme: vi.fn(() => 'light'),
  getThemeIcon: vi.fn((theme) => {
    if (theme === 'light') return 'sun';
    if (theme === 'dark') return 'moon';
    return 'sunMoon';
  }),
  getThemeLabel: vi.fn((theme) => {
    if (theme === 'light') return 'Theme: Light. Click for dark mode';
    if (theme === 'dark') return 'Theme: Dark. Click for system preference';
    return 'Theme: Auto. Click for light mode';
  }),
  getThemeTooltip: vi.fn((theme) => {
    if (theme === 'light') return 'Light mode';
    if (theme === 'dark') return 'Dark mode';
    return 'Auto mode';
  }),
  initTheme: vi.fn()
}));

import { getTheme, cycleTheme, getThemeIcon, getThemeLabel, getThemeTooltip, initTheme } from '../src/utils/theme.js';

// Mock SearchAutocomplete module
vi.mock('../src/components/search-autocomplete.js', () => ({
  SearchAutocomplete: vi.fn(() => ({
    cleanup: vi.fn(),
    isOpen: vi.fn(() => false)
  }))
}));

// Mock ExportMenu so we can assert cleanup is called
vi.mock('../src/components/export-menu.js', () => ({
  ExportMenu: vi.fn(() => ({
    cleanup: vi.fn()
  }))
}));

import { ExportMenu } from '../src/components/export-menu.js';
import { SearchAutocomplete } from '../src/components/search-autocomplete.js';

interface HeaderLocalThis {
  navigated: string;
  searchQuery: { q: string } | null;
  el: HTMLElement | null;
}

describe('Header component', () => {
  const localThis: HeaderLocalThis = {
    navigated: '',
    searchQuery: null,
    el: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('renders header with brand', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home'
    });

    expect(el.textContent).toMatch(/Murphy's/);
    expect(el.textContent).toMatch(/Law/);
  });

  it('shows navigation links in dropdown', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home'
    });

    expect(el.querySelector('[data-nav="home"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="browse"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="categories"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="calculator/sods-law"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="origin-story"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="examples"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="submit"]')).toBeTruthy();
  });

  it('triggers onNavigate when clicking nav button', () => {
    let navigated = '';
    const el = Header({
      onSearch: () => {},
      onNavigate: (page) => { navigated = page; },
      currentPage: 'home'
    });

    (el.querySelector('[data-nav="browse"]') as HTMLElement).click();
    expect(navigated).toBe('browse');
  });

  it('triggers onSearch when submitting search form', () => {
    let searchQuery: { q: string } | null = null;
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]') as HTMLInputElement;
    const searchForm = el.querySelector('form[role="search"]');
    expect(searchForm).toBeTruthy();
    searchInput.value = 'gravity';
    searchForm!.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: 'gravity' });
    document.body.removeChild(el);
  });

  it('has navigation menu toggle', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'browse'
    });

    const menuToggle = el.querySelector('#nav-menu-toggle');
    expect(menuToggle).toBeTruthy();
    expect(menuToggle!.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles navigation dropdown when clicking menu button', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);

    const menuToggle = el.querySelector('#nav-menu-toggle') as HTMLElement;
    const navDropdown = el.querySelector('#nav-dropdown');
    expect(navDropdown).toBeTruthy();
    // Initially closed
    expect(navDropdown!.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    // Click to open
    menuToggle.click();
    expect(navDropdown!.classList.contains('open')).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('true');

    // Click to close
    menuToggle.click();
    expect(navDropdown!.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
    document.body.removeChild(el);
  });

  it('closes dropdown when clicking outside', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);

    const menuToggle = el.querySelector('#nav-menu-toggle') as HTMLElement;
    const navDropdown = el.querySelector('#nav-dropdown');
    expect(navDropdown).toBeTruthy();
    // Open the dropdown
    menuToggle.click();
    expect(navDropdown!.classList.contains('open')).toBe(true);

    // Click outside (on document body)
    const outsideDiv = document.createElement('div');
    document.body.appendChild(outsideDiv);
    outsideDiv.click();

    expect(navDropdown!.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
    document.body.removeChild(outsideDiv);
    document.body.removeChild(el);
  });

  it('closes dropdown when clicking a nav item', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);

    const menuToggle = el.querySelector('#nav-menu-toggle') as HTMLElement;
    const navDropdown = el.querySelector('#nav-dropdown');
    const navItem = el.querySelector('[data-nav="browse"]') as HTMLElement;

    // Open the dropdown
    menuToggle.click();
    expect(navDropdown!.classList.contains('open')).toBe(true);

    // Click a nav item
    navItem.click();

    expect(navDropdown!.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
    document.body.removeChild(el);
  });

  it('calls cleanup function to remove event listeners', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);

    expect(typeof (el as CleanableElement).cleanup).toBe('function');

    // Call cleanup
    (el as CleanableElement).cleanup!();

    // After cleanup, clicking outside should not affect dropdown
    const menuToggle = el.querySelector('#nav-menu-toggle');
    const navDropdown = el.querySelector('#nav-dropdown');

    (menuToggle as HTMLElement).click();
    const outsideDiv = document.createElement('div');
    document.body.appendChild(outsideDiv);
    outsideDiv.click();

    // Dropdown should still be open since event listener was removed
    expect(navDropdown!.classList.contains('open')).toBe(true);

    document.body.removeChild(outsideDiv);
    document.body.removeChild(el);
  });

  it('trims whitespace from search input', () => {
    let searchQuery: { q: string } | null = null;
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]') as HTMLInputElement;
    const searchForm = el.querySelector('form[role="search"]');
    expect(searchForm).toBeTruthy();
    searchInput.value = '  test query  ';
    searchForm!.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: 'test query' });
    document.body.removeChild(el);
  });

  it('handles empty search query', () => {
    let searchQuery: { q: string } | null = null;
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]') as HTMLInputElement;
    const searchForm = el.querySelector('form[role="search"]');
    expect(searchForm).toBeTruthy();
    searchInput.value = '   ';
    searchForm!.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: '' });
    document.body.removeChild(el);
  });

  it('handles search when input without aria-label exists', () => {
    let searchQuery: { q: string } | null = null;
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]') as HTMLInputElement;
    const searchForm = el.querySelector('form[role="search"]');

    // Remove aria-label to test fallback to generic input selector
    searchInput.removeAttribute('aria-label');

    searchInput.value = 'test';
    searchForm!.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: 'test' });
    document.body.removeChild(el);
  });

  it('handles search when no input exists', () => {
    let searchQuery: { q: string } | string | null = 'not called';
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home'
    });

    document.body.appendChild(el);
    const searchForm = el.querySelector('form[role="search"]');
    expect(searchForm).toBeTruthy();
    const searchInput = el.querySelector('input') as HTMLInputElement | null;

    // Remove the input element
    searchInput!.remove();

    searchForm!.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: '' });
    document.body.removeChild(el);
  });

  it('ignores click on non-HTMLElement target', () => {
    let navigated = '';
    const el = Header({
      onSearch: () => {},
      onNavigate: (page) => { navigated = page; },
      currentPage: 'home'
    });

    // Dispatch click event with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);

    // Should not navigate
    expect(navigated).toBe('');
  });

  it('does not call onNavigate when clicking element without data-nav', () => {
    const onNavigateMock = vi.fn();
    const el = Header({
      onSearch: () => {},
      onNavigate: onNavigateMock,
      currentPage: 'home'
    });

    const searchInput = el.querySelector('input[aria-label="Search"]') || el.querySelector('input');
    expect(searchInput).toBeTruthy();
    (searchInput as HTMLElement).click();

    expect(onNavigateMock).not.toHaveBeenCalled();
  });

  it('cleanup does not throw when #export-menu-container was missing (L38 L169)', () => {
    const originalQ = Element.prototype.querySelector;
    vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (this: Element, selector: string) {
      if (selector === '#export-menu-container') return null;
      return originalQ.call(this, selector);
    });
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home'
    });
    vi.restoreAllMocks();
    expect(ExportMenu).not.toHaveBeenCalled();
    expect(() => (el as CleanableElement).cleanup!()).not.toThrow();
  });

  it('does not attach search or autocomplete when form is missing (L137 L155)', () => {
    const originalQ = Element.prototype.querySelector;
    vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (this: Element, selector: string) {
      if (selector === 'form[role="search"]') return null;
      return originalQ.call(this, selector);
    });
    const onSearchMock = vi.fn();
    const el = Header({
      onSearch: onSearchMock,
      onNavigate: () => {},
      currentPage: 'home'
    });
    vi.restoreAllMocks();
    expect(SearchAutocomplete).not.toHaveBeenCalled();
    const form = el.querySelector('form[role="search"]');
    if (form) form.dispatchEvent(new Event('submit'));
    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('cleanup calls originalCleanup, autocompleteCleanup, and exportMenuCleanup when all present (L163 L166 L169)', () => {
    const exportCleanup = vi.fn();
    vi.mocked(ExportMenu).mockReturnValue({ cleanup: exportCleanup } as unknown as ReturnType<typeof ExportMenu>);
    const autoCleanup = vi.fn();
    vi.mocked(SearchAutocomplete).mockReturnValue({ cleanup: autoCleanup, isOpen: () => false });

    const el = Header({ onSearch: () => {}, onNavigate: () => {} });
    (el as CleanableElement).cleanup!();

    expect(exportCleanup).toHaveBeenCalled();
    expect(autoCleanup).toHaveBeenCalled();
  });

  it('nav click with navTarget calls onNavigate (L128)', () => {
    localThis.el = Header({ onSearch: () => {}, onNavigate: (page) => { localThis.navigated = page; }, currentPage: 'home' });
    document.body.appendChild(localThis.el);

    (localThis.el.querySelector('[data-nav="browse"]') as HTMLElement).click();
    expect(localThis.navigated).toBe('browse');

    document.body.removeChild(localThis.el);
  });

  it('form and input present when search is used (L138 L141)', () => {
    localThis.el = Header({ onSearch: () => {}, onNavigate: () => {}, currentPage: 'home' });
    const form = localThis.el.querySelector('form[role="search"]');
    const input = localThis.el.querySelector('input[aria-label="Search"]') || localThis.el.querySelector('input');
    expect(form).toBeTruthy();
    expect(input).toBeTruthy();
  });

  it('submit uses input.value and calls onSearch (L155)', () => {
    localThis.searchQuery = null;
    localThis.el = Header({
      onSearch: (q) => { localThis.searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home'
    });
    document.body.appendChild(localThis.el);
    const input = localThis.el.querySelector('input[aria-label="Search"]') as HTMLInputElement;
    const form = localThis.el.querySelector('form[role="search"]');
    input.value = 'gravity';
    form!.dispatchEvent(new Event('submit'));
    expect(localThis.searchQuery).toEqual({ q: 'gravity' });
    document.body.removeChild(localThis.el);
  });

  it('cleanup calls originalCleanup, autocompleteCleanup, exportMenuCleanup (L163 L166)', () => {
    const exportCleanup = vi.fn();
    const autoCleanup = vi.fn();
    vi.mocked(ExportMenu).mockReturnValue({ cleanup: exportCleanup } as unknown as ReturnType<typeof ExportMenu>);
    vi.mocked(SearchAutocomplete).mockReturnValue({ cleanup: autoCleanup, isOpen: () => false });

    localThis.el = Header({ onSearch: () => {}, onNavigate: () => {} });
    (localThis.el as CleanableElement).cleanup!();

    expect(exportCleanup).toHaveBeenCalled();
    expect(autoCleanup).toHaveBeenCalled();
  });

  it('hits navTarget, form/input, submit value, and cleanup branches in one flow (L128 L138 L141 L155 L163 L166)', () => {
    const onNavigateMock = vi.fn();
    const onSearchMock = vi.fn();
    const exportCleanup = vi.fn();
    const autoCleanup = vi.fn();
    vi.mocked(ExportMenu).mockReturnValue({ cleanup: exportCleanup } as unknown as ReturnType<typeof ExportMenu>);
    vi.mocked(SearchAutocomplete).mockReturnValue({ cleanup: autoCleanup, isOpen: () => false });

    const el = Header({ onSearch: onSearchMock, onNavigate: onNavigateMock });
    document.body.appendChild(el);

    (el.querySelector('[data-nav="browse"]') as HTMLElement).click();
    expect(onNavigateMock).toHaveBeenCalledWith('browse');

    const input = el.querySelector('input[aria-label="Search"]') as HTMLInputElement;
    const form = el.querySelector('form[role="search"]');
    input.value = 'test query';
    form!.dispatchEvent(new Event('submit'));
    expect(onSearchMock).toHaveBeenCalledWith({ q: 'test query' });

    (el as CleanableElement).cleanup!();
    expect(exportCleanup).toHaveBeenCalled();
    expect(autoCleanup).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  describe('Theme toggle', () => {
    it('renders theme toggle button', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      const themeToggle = el.querySelector('#theme-toggle');
      expect(themeToggle).toBeTruthy();
      expect(themeToggle!.classList.contains('theme-toggle')).toBe(true);
    });

    it('initializes theme on mount', () => {
      Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      expect(initTheme).toHaveBeenCalled();
    });

    it('sets initial aria-label based on current theme', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      const themeToggle = el.querySelector('#theme-toggle');
      expect(themeToggle!.getAttribute('aria-label')).toBe('Theme: Auto. Click for light mode');
    });

    it('sets initial tooltip based on current theme', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      const themeToggle = el.querySelector('#theme-toggle');
      expect(themeToggle!.getAttribute('data-tooltip')).toBe('Auto mode');
      expect(themeToggle!.getAttribute('data-tooltip-pos')).toBe('bottom');
    });

    it('cycles theme when toggle is clicked', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle') as HTMLElement;

      themeToggle!.click();

      expect(cycleTheme).toHaveBeenCalled();

      if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
      document.body.removeChild(el);
    });

    it('updates aria-label after theme cycle', () => {
      // Mock cycleTheme to return 'light'
      vi.mocked(cycleTheme).mockReturnValue('light');
      vi.mocked(getThemeLabel).mockImplementation((theme) => {
        if (theme === 'light') return 'Theme: Light. Click for dark mode';
        return 'Theme: Auto. Click for light mode';
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle') as HTMLElement;

      themeToggle!.click();

      expect(themeToggle!.getAttribute('aria-label')).toBe('Theme: Light. Click for dark mode');

      if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
      document.body.removeChild(el);
    });

    it('updates tooltip after theme cycle', () => {
      // Mock cycleTheme to return 'light'
      vi.mocked(cycleTheme).mockReturnValue('light');
      vi.mocked(getThemeTooltip).mockImplementation((theme) => {
        if (theme === 'light') return 'Light mode';
        return 'Auto mode';
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle') as HTMLElement;

      themeToggle!.click();

      expect(themeToggle!.getAttribute('data-tooltip')).toBe('Light mode');

      if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
      document.body.removeChild(el);
    });

    it('listens to themechange events', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle') as HTMLElement;

      // Dispatch a themechange event
      vi.mocked(getThemeLabel).mockReturnValue('Theme: Dark. Click for system preference');
      vi.mocked(getThemeTooltip).mockReturnValue('Dark mode');
      document.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: 'dark', effectiveTheme: 'dark' }
      }));

      expect(themeToggle!.getAttribute('aria-label')).toBe('Theme: Dark. Click for system preference');
      expect(themeToggle!.getAttribute('data-tooltip')).toBe('Dark mode');

      if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
      document.body.removeChild(el);
    });

    it('updates tooltip on themechange events', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle') as HTMLElement;

      // Dispatch a themechange event
      vi.mocked(getThemeTooltip).mockReturnValue('Light mode');
      document.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: 'light', effectiveTheme: 'light' }
      }));

      expect(themeToggle!.getAttribute('data-tooltip')).toBe('Light mode');

      if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
      document.body.removeChild(el);
    });

    it('cleanup removes themechange listener', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle') as HTMLElement;

      // Get initial label
      const initialLabel = themeToggle!.getAttribute('aria-label');

      // Call cleanup
      (el as CleanableElement).cleanup!();

      // Dispatch a themechange event
      vi.mocked(getThemeLabel).mockReturnValue('Theme: Dark. Click for system preference');
      document.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: 'dark', effectiveTheme: 'dark' }
      }));

      // Label should not have changed since listener was removed
      expect(themeToggle!.getAttribute('aria-label')).toBe(initialLabel);

      document.body.removeChild(el);
    });

    it('handles icon replacement gracefully when existing icon not found', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle') as HTMLElement;

      // Remove the icon element
      const icon = themeToggle!.querySelector('.icon');
      if (icon) icon.remove();

      // Should not throw when clicking
      expect(() => themeToggle!.click()).not.toThrow();

      if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
      document.body.removeChild(el);
    });

    it('handles missing theme toggle element gracefully', () => {
      // Mock querySelector to return null for #theme-toggle
      const originalQuerySelector = Element.prototype.querySelector;
      Element.prototype.querySelector = function(selector: string) {
        if (selector === '#theme-toggle') {
          return null;
        }
        return originalQuerySelector.call(this, selector);
      };

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home'
      });

      document.body.appendChild(el);

      // Dispatch a themechange event - should not throw even with no toggle
      expect(() => {
        document.dispatchEvent(new CustomEvent('themechange', {
          detail: { theme: 'dark', effectiveTheme: 'dark' }
        }));
      }).not.toThrow();

      // Restore original querySelector
      Element.prototype.querySelector = originalQuerySelector;

      if ((el as CleanableElement).cleanup) (el as CleanableElement).cleanup!();
      document.body.removeChild(el);
    });
  });

  describe('search autocomplete integration', () => {
    it('should initialize autocomplete on search input', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {}
      });

      const input = el.querySelector('#header-search');
      expect(input).toBeTruthy();
      // Autocomplete should be initialized (mocked function should be called)
      expect(SearchAutocomplete).toHaveBeenCalled();
    });

    it('should cleanup autocomplete when header cleanup is called', () => {
      const mockCleanup = vi.fn();
      vi.mocked(SearchAutocomplete).mockReturnValue({ cleanup: mockCleanup, isOpen: () => false });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {}
      });

      if ((el as CleanableElement).cleanup) {
        (el as CleanableElement).cleanup!();
      }

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should call ExportMenu cleanup when header cleanup is called', () => {
      const exportMenuCleanupMock = vi.fn();
      vi.mocked(ExportMenu).mockImplementation(() => {
        const container = document.createElement('div');
        (container as CleanableElement).cleanup = exportMenuCleanupMock;
        return container as ReturnType<typeof ExportMenu>;
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {}
      });

      (el as CleanableElement).cleanup!();
      expect(exportMenuCleanupMock).toHaveBeenCalled();
    });

    it('should call onNavigate when suggestion is selected', () => {
      const mockOnNavigate = vi.fn();
      const mockCleanup = vi.fn();
      let onSelectCallback: ((suggestion: { id: number }) => void) | null = null;

      vi.mocked(SearchAutocomplete).mockImplementation(({ onSelect }) => {
        onSelectCallback = onSelect as (suggestion: { id: number }) => void;
        return { cleanup: mockCleanup, isOpen: () => false };
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: mockOnNavigate
      });

      // Simulate suggestion selection (callback is set when SearchAutocomplete is invoked)
      if (onSelectCallback) {
        (onSelectCallback as (suggestion: { id: number }) => void)({ id: 123 });
      }

      expect(mockOnNavigate).toHaveBeenCalledWith('law', '123');
    });

    it('should not call onNavigate when suggestion has no id', () => {
      const mockOnNavigate = vi.fn();
      let onSelectCallback: ((law: Law) => void) | null = null;

      vi.mocked(SearchAutocomplete).mockImplementation(({ onSelect }) => {
        onSelectCallback = onSelect as (law: Law) => void;
        return { cleanup: vi.fn(), isOpen: () => false };
      });

      Header({
        onSearch: () => {},
        onNavigate: mockOnNavigate
      });

      if (onSelectCallback) {
        (onSelectCallback as (law: Law) => void)({} as Law);
      }

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Favorites navigation link', () => {
    beforeEach(() => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(true);
    });

    it('shows favorites link when feature is enabled', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
      });

      const favoritesLink = el.querySelector('[data-nav="favorites"]');
      expect(favoritesLink).toBeTruthy();
    });

    it('does not show favorites link when feature is disabled', () => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(false);

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
      });

      const favoritesLink = el.querySelector('[data-nav="favorites"]');
      expect(favoritesLink).toBeFalsy();
    });

    it('favorites link has text "Browse My Favorites Laws"', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
      });

      const favoritesLink = el.querySelector('[data-nav="favorites"]');
      expect(favoritesLink).toBeTruthy();
      expect(favoritesLink!.textContent!.trim()).toBe('Browse My Favorites Laws');
    });

    it('favorites link appears after "Browse Laws by Category"', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
      });

      const navItems = el.querySelectorAll('#nav-dropdown li');
      const navTexts = Array.from(navItems).map((li) => (li.textContent ?? '').trim());

      const categoriesIndex = navTexts.findIndex((text) => text === 'Browse Laws by Category');
      const favoritesIndex = navTexts.findIndex((text) => text === 'Browse My Favorites Laws');

      expect(categoriesIndex).toBeGreaterThan(-1);
      expect(favoritesIndex).toBeGreaterThan(-1);
      expect(favoritesIndex).toBe(categoriesIndex + 1);
    });

    it('favorites link href is "/favorites"', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
      });

      const favoritesLink = el.querySelector('[data-nav="favorites"]');
      expect(favoritesLink).toBeTruthy();
      expect(favoritesLink!.getAttribute('href')).toBe('/favorites');
    });

    it('does not throw when #nav-dropdown ul or categories item is missing', () => {
      vi.mocked(isFavoritesEnabled).mockReturnValue(true);
      const origQSA = Element.prototype.querySelector;
      let callCount = 0;
      vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (this: Element, selector: string) {
        if (selector === '#nav-dropdown ul' && callCount++ < 1) {
          return null;
        }
        return origQSA.call(this, selector);
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
      });

      expect(el.querySelector('[data-nav="favorites"]')).toBeFalsy();
      vi.restoreAllMocks();
    });

    it('clicking favorites link triggers onNavigate with "favorites"', () => {
      let navigated = '';
      const el = Header({
        onSearch: () => {},
        onNavigate: (page) => { navigated = page; },
      });

      (el.querySelector('[data-nav="favorites"]') as HTMLElement).click();
      expect(navigated).toBe('favorites');
    });
  });
});
