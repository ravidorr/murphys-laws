import { LawDetail } from '@views/law-detail.js';
import { mockLaws } from '@data/data.js';

describe('LawDetail view', () => {
  const localThis = {};

  it('renders not found for unknown id', () => {
    const el = LawDetail({ lawId: 'nope', _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders title for existing law and triggers onVote', () => {
    const law = mockLaws[0];
    let captured = '';
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: (id, type) => { captured = `${id}:${type}`; } });
    expect(el.textContent).toMatch(law.title);
    el.querySelector('[data-vote="up"]').click();
    expect(captured).toBe(`${law.id}:up`);
  });
});


