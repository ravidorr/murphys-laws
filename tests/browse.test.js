import { Browse } from '@views/browse.js';

describe('Browse view', () => {

  it('shows search query when provided', () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: 'gravity', onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/gravity/);
  });

  it('renders Browse title', () => {
    const el = Browse({ _isLoggedIn: false, searchQuery: '', onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/Browse/);
    expect(el.textContent).toMatch(/All Laws/);
  });
});


