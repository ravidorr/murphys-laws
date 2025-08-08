import { LawDetail } from '@views/law-detail.js';

describe('LawDetail view', () => {
  it('renders not found for unknown id', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const el = LawDetail({ lawId: 'nope', _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });
    await new Promise(r => setTimeout(r, 0));
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders title for existing law and triggers onVote', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, submittedBy: 'tester' };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });

    let captured = '';
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: (id, type) => { captured = `${id}:${type}`; } });

    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(law.title);
    el.querySelector('[data-vote="up"]').click();
    expect(captured).toBe(`${law.id}:up`);
  });
});


