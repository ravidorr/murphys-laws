import { Home } from '@views/home.js';

describe('Home view', () => {
  it('renders Law of the Day after fetching data', async () => {
    const sample = [
      { id: '1', text: 'Anything that can go wrong will go wrong.', author: 'Edward Murphy', submittedBy: 'engineerMike', score: 10, publishDate: '2024-01-01' },
      { id: '2', text: 'Murphy was an optimist.', author: "O'Toole", submittedBy: 'projectSarah', score: 5, publishDate: '2024-01-02' },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: sample.length, data: sample }) });

    const el = Home({ isLoggedIn: false, onNavigate: () => {}, _onVote: () => {} });
    expect(el.textContent).toMatch(/Loading laws/);

    await new Promise(r => setTimeout(r, 0));

    expect(el.textContent).toMatch(/Law of the Day/);
  });

  it('navigates to law detail when clicking a law block (after fetch)', async () => {
    const sample = [
      { id: '42', text: 'Test law', author: 'Test', submittedBy: 'tester', score: 1, publishDate: '2024-01-03' },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: sample.length, data: sample }) });

    let nav = '';
    const el = Home({ isLoggedIn: false, onNavigate: (name, id) => { nav = `${name}:${id}`; }, _onVote: () => {} });

    await new Promise(r => setTimeout(r, 0));

    const block = el.querySelector(`[data-law-id="${sample[0].id}"]`);
    block.click();
    expect(nav).toBe(`law:${sample[0].id}`);
  });
});


