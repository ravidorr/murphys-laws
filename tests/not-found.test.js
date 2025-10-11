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
});
