import { Home } from '@views/home.js';
import { mockLaws } from '@data/data.js';

describe('Home view', () => {
  const localThis = {};

  it('renders Law of the Day when available', () => {
    const el = Home({ isLoggedIn: false, onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('navigates to law detail when clicking a law block', () => {
    let nav = '';
    const el = Home({ isLoggedIn: false, onNavigate: (name, id) => { nav = `${name}:${id}`; }, _onVote: () => {} });
    const anyLaw = mockLaws[0];
    const block = el.querySelector(`[data-law-id="${anyLaw.id}"]`);
    block.click();
    expect(nav).toBe(`law:${anyLaw.id}`);
  });
});


