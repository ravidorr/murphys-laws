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

    expect(searchQuery).toBe('gravity');
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
});
