import { Header } from '../src/components/header.js';

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

import { SearchAutocomplete } from '../src/components/search-autocomplete.js';

describe('Header component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('renders header with brand', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    expect(el.textContent).toMatch(/Murphy's/);
    expect(el.textContent).toMatch(/Law/);
  });

  it('shows navigation links in dropdown', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
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
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    el.querySelector('[data-nav="browse"]').click();
    expect(navigated).toBe('browse');
  });

  it('triggers onSearch when submitting search form', () => {
    let searchQuery = '';
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]');
    const searchForm = el.querySelector('form[role="search"]');

    searchInput.value = 'gravity';
    searchForm.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: 'gravity' });
    document.body.removeChild(el);
  });

  it('has navigation menu toggle', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'browse',
      isLoggedIn: false,
      currentUser: null
    });

    const menuToggle = el.querySelector('#nav-menu-toggle');
    expect(menuToggle).toBeTruthy();
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles navigation dropdown when clicking menu button', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);

    const menuToggle = el.querySelector('#nav-menu-toggle');
    const navDropdown = el.querySelector('#nav-dropdown');

    // Initially closed
    expect(navDropdown.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    // Click to open
    menuToggle.click();
    expect(navDropdown.classList.contains('open')).toBe(true);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('true');

    // Click to close
    menuToggle.click();
    expect(navDropdown.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    if (el.cleanup) el.cleanup();
    document.body.removeChild(el);
  });

  it('closes dropdown when clicking outside', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);

    const menuToggle = el.querySelector('#nav-menu-toggle');
    const navDropdown = el.querySelector('#nav-dropdown');

    // Open the dropdown
    menuToggle.click();
    expect(navDropdown.classList.contains('open')).toBe(true);

    // Click outside (on document body)
    const outsideDiv = document.createElement('div');
    document.body.appendChild(outsideDiv);
    outsideDiv.click();

    expect(navDropdown.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    if (el.cleanup) el.cleanup();
    document.body.removeChild(outsideDiv);
    document.body.removeChild(el);
  });

  it('closes dropdown when clicking a nav item', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);

    const menuToggle = el.querySelector('#nav-menu-toggle');
    const navDropdown = el.querySelector('#nav-dropdown');
    const navItem = el.querySelector('[data-nav="browse"]');

    // Open the dropdown
    menuToggle.click();
    expect(navDropdown.classList.contains('open')).toBe(true);

    // Click a nav item
    navItem.click();

    expect(navDropdown.classList.contains('open')).toBe(false);
    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');

    if (el.cleanup) el.cleanup();
    document.body.removeChild(el);
  });

  it('calls cleanup function to remove event listeners', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);

    expect(typeof el.cleanup).toBe('function');

    // Call cleanup
    el.cleanup();

    // After cleanup, clicking outside should not affect dropdown
    const menuToggle = el.querySelector('#nav-menu-toggle');
    const navDropdown = el.querySelector('#nav-dropdown');

    menuToggle.click();
    const outsideDiv = document.createElement('div');
    document.body.appendChild(outsideDiv);
    outsideDiv.click();

    // Dropdown should still be open since event listener was removed
    expect(navDropdown.classList.contains('open')).toBe(true);

    document.body.removeChild(outsideDiv);
    document.body.removeChild(el);
  });

  it('trims whitespace from search input', () => {
    let searchQuery = '';
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]');
    const searchForm = el.querySelector('form[role="search"]');

    searchInput.value = '  test query  ';
    searchForm.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: 'test query' });
    document.body.removeChild(el);
  });

  it('handles empty search query', () => {
    let searchQuery = null;
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]');
    const searchForm = el.querySelector('form[role="search"]');

    searchInput.value = '   ';
    searchForm.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: '' });
    document.body.removeChild(el);
  });

  it('handles search when input without aria-label exists', () => {
    let searchQuery = '';
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);
    const searchInput = el.querySelector('input[aria-label="Search"]');
    const searchForm = el.querySelector('form[role="search"]');

    // Remove aria-label to test fallback to generic input selector
    searchInput.removeAttribute('aria-label');

    searchInput.value = 'test';
    searchForm.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: 'test' });
    document.body.removeChild(el);
  });

  it('handles search when no input exists', () => {
    let searchQuery = 'not called';
    const el = Header({
      onSearch: (q) => { searchQuery = q; },
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    document.body.appendChild(el);
    const searchForm = el.querySelector('form[role="search"]');
    const searchInput = el.querySelector('input');

    // Remove the input element
    searchInput.remove();

    searchForm.dispatchEvent(new Event('submit'));

    expect(searchQuery).toEqual({ q: '' });
    document.body.removeChild(el);
  });

  it('ignores click on non-HTMLElement target', () => {
    let navigated = '';
    const el = Header({
      onSearch: () => {},
      onNavigate: (page) => { navigated = page; },
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    // Dispatch click event with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null });
    el.dispatchEvent(event);

    // Should not navigate
    expect(navigated).toBe('');
  });

  describe('Theme toggle', () => {
    it('renders theme toggle button', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      const themeToggle = el.querySelector('#theme-toggle');
      expect(themeToggle).toBeTruthy();
      expect(themeToggle.classList.contains('theme-toggle')).toBe(true);
    });

    it('initializes theme on mount', () => {
      Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      expect(initTheme).toHaveBeenCalled();
    });

    it('sets initial aria-label based on current theme', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      const themeToggle = el.querySelector('#theme-toggle');
      expect(themeToggle.getAttribute('aria-label')).toBe('Theme: Auto. Click for light mode');
    });

    it('sets initial tooltip based on current theme', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      const themeToggle = el.querySelector('#theme-toggle');
      expect(themeToggle.getAttribute('data-tooltip')).toBe('Auto mode');
      expect(themeToggle.getAttribute('data-tooltip-pos')).toBe('bottom');
    });

    it('cycles theme when toggle is clicked', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle');

      themeToggle.click();

      expect(cycleTheme).toHaveBeenCalled();

      if (el.cleanup) el.cleanup();
      document.body.removeChild(el);
    });

    it('updates aria-label after theme cycle', () => {
      // Mock cycleTheme to return 'light'
      cycleTheme.mockReturnValue('light');
      getThemeLabel.mockImplementation((theme) => {
        if (theme === 'light') return 'Theme: Light. Click for dark mode';
        return 'Theme: Auto. Click for light mode';
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle');

      themeToggle.click();

      expect(themeToggle.getAttribute('aria-label')).toBe('Theme: Light. Click for dark mode');

      if (el.cleanup) el.cleanup();
      document.body.removeChild(el);
    });

    it('updates tooltip after theme cycle', () => {
      // Mock cycleTheme to return 'light'
      cycleTheme.mockReturnValue('light');
      getThemeTooltip.mockImplementation((theme) => {
        if (theme === 'light') return 'Light mode';
        return 'Auto mode';
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle');

      themeToggle.click();

      expect(themeToggle.getAttribute('data-tooltip')).toBe('Light mode');

      if (el.cleanup) el.cleanup();
      document.body.removeChild(el);
    });

    it('listens to themechange events', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle');

      // Dispatch a themechange event
      getThemeLabel.mockReturnValue('Theme: Dark. Click for system preference');
      getThemeTooltip.mockReturnValue('Dark mode');
      document.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: 'dark', effectiveTheme: 'dark' }
      }));

      expect(themeToggle.getAttribute('aria-label')).toBe('Theme: Dark. Click for system preference');
      expect(themeToggle.getAttribute('data-tooltip')).toBe('Dark mode');

      if (el.cleanup) el.cleanup();
      document.body.removeChild(el);
    });

    it('updates tooltip on themechange events', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle');

      // Dispatch a themechange event
      getThemeTooltip.mockReturnValue('Light mode');
      document.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: 'light', effectiveTheme: 'light' }
      }));

      expect(themeToggle.getAttribute('data-tooltip')).toBe('Light mode');

      if (el.cleanup) el.cleanup();
      document.body.removeChild(el);
    });

    it('cleanup removes themechange listener', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle');

      // Get initial label
      const initialLabel = themeToggle.getAttribute('aria-label');

      // Call cleanup
      el.cleanup();

      // Dispatch a themechange event
      getThemeLabel.mockReturnValue('Theme: Dark. Click for system preference');
      document.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: 'dark', effectiveTheme: 'dark' }
      }));

      // Label should not have changed since listener was removed
      expect(themeToggle.getAttribute('aria-label')).toBe(initialLabel);

      document.body.removeChild(el);
    });

    it('handles icon replacement gracefully when existing icon not found', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
      });

      document.body.appendChild(el);
      const themeToggle = el.querySelector('#theme-toggle');

      // Remove the icon element
      const icon = themeToggle.querySelector('.icon');
      if (icon) icon.remove();

      // Should not throw when clicking
      expect(() => themeToggle.click()).not.toThrow();

      if (el.cleanup) el.cleanup();
      document.body.removeChild(el);
    });

    it('handles missing theme toggle element gracefully', () => {
      // Mock querySelector to return null for #theme-toggle
      const originalQuerySelector = Element.prototype.querySelector;
      Element.prototype.querySelector = function(selector) {
        if (selector === '#theme-toggle') {
          return null;
        }
        return originalQuerySelector.call(this, selector);
      };

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
        currentPage: 'home',
        isLoggedIn: false,
        currentUser: null
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

      if (el.cleanup) el.cleanup();
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
      SearchAutocomplete.mockReturnValue({ cleanup: mockCleanup, isOpen: () => false });

      const el = Header({
        onSearch: () => {},
        onNavigate: () => {}
      });

      if (el.cleanup) {
        el.cleanup();
      }

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should call onNavigate when suggestion is selected', () => {
      const mockOnNavigate = vi.fn();
      const mockCleanup = vi.fn();
      let onSelectCallback = null;

      SearchAutocomplete.mockImplementation(({ onSelect }) => {
        onSelectCallback = onSelect;
        return { cleanup: mockCleanup, isOpen: () => false };
      });

      const el = Header({
        onSearch: () => {},
        onNavigate: mockOnNavigate
      });

      // Simulate suggestion selection
      if (onSelectCallback) {
        onSelectCallback({ id: 123 });
      }

      expect(mockOnNavigate).toHaveBeenCalledWith('law', 123);
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
      expect(favoritesLink.textContent.trim()).toBe('Browse My Favorites Laws');
    });

    it('favorites link appears after "Browse Laws by Category"', () => {
      const el = Header({
        onSearch: () => {},
        onNavigate: () => {},
      });

      const navItems = el.querySelectorAll('#nav-dropdown li');
      const navTexts = Array.from(navItems).map((li) => li.textContent.trim());

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
      expect(favoritesLink.getAttribute('href')).toBe('/favorites');
    });

    it('clicking favorites link triggers onNavigate with "favorites"', () => {
      let navigated = '';
      const el = Header({
        onSearch: () => {},
        onNavigate: (page) => { navigated = page; },
      });

      el.querySelector('[data-nav="favorites"]').click();
      expect(navigated).toBe('favorites');
    });
  });
});
