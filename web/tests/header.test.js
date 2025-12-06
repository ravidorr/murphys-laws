import { Header } from '../src/components/header.js';

describe('Header component', () => {
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

  it('shows navigation links', () => {
    const el = Header({
      onSearch: () => {},
      onNavigate: () => {},
      currentPage: 'home',
      isLoggedIn: false,
      currentUser: null
    });

    expect(el.querySelector('[data-nav="home"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="browse"]')).toBeTruthy();
    expect(el.querySelector('[data-nav="calculator"]')).toBeTruthy();
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
});
