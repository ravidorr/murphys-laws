import { NotFound } from '../src/views/not-found.js';

describe('NotFound view', () => {
  it('renders heading and message', () => {
    const el = NotFound({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/Page Not Found/i);
    expect(el.textContent).toMatch(/could not be found/i);
  });

  it('navigates back home when button is clicked', () => {
    const onNavigate = vi.fn();
    const el = NotFound({ onNavigate });

    const btn = el.querySelector('[data-nav="home"]');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('displays breadcrumb navigation', () => {
    const el = NotFound({ onNavigate: () => {} });

    const breadcrumb = el.querySelector('.breadcrumb');
    expect(breadcrumb).toBeTruthy();
    expect(breadcrumb.getAttribute('aria-label')).toBe('Breadcrumb');
  });

  it('breadcrumb shows "Not Found" as current page', () => {
    const el = NotFound({ onNavigate: () => {} });

    const current = el.querySelector('.breadcrumb-current');
    expect(current).toBeTruthy();
    expect(current.textContent).toBe('Not Found');
  });
});
