import { Browse } from '@views/browse.js';

describe('Browse view', () => {
  const localThis = {};

  it('shows search query when provided', () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: 'gravity', onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/gravity/);
  });

  it('navigates when clicking buttons with data-nav', () => {
    let navigated = '';
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: (name) => { navigated = name; }, _onVote: () => {} });
    el.querySelector('[data-nav="home"]').click();
    expect(navigated).toBe('home');
  });
});


