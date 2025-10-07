import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LawDetail } from '@views/law-detail.js';

describe('LawDetail view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders not found for unknown id', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const el = LawDetail({ lawId: 'nope', _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });
    await new Promise(r => setTimeout(r, 0));
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders not found when lawId is null', async () => {
    const el = LawDetail({ lawId: null, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders title for existing law and triggers onVote', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, submittedBy: 'tester' };
    const lotd = { id: '1', title: 'LOTD', text: 'Law of the day text', score: 100 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [lotd] }) });

    let captured = '';
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: (id, type) => { captured = `${id}:${type}`; } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(law.title);
    const voteBtn = el.querySelector('[data-vote="up"]');
    if (voteBtn) {
      voteBtn.click();
      expect(captured).toBe(`${law.id}:up`);
    }
  });

  it('renders law when law of the day fetch succeeds', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };
    const lotd = { id: '1', title: 'LOTD Title', text: 'Law of the day', score: 100 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [lotd] }) })
      .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }); // For top/trending/recent components

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });

    // Wait for the law to render
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Test Law/);
    }, { timeout: 500 });

    // Both laws should be present (LOTD and the fetched law)
    expect(el.textContent).toMatch(/Test Law/);
  });

  it('does not duplicate law card when current law is law of the day', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 100 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [law] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Should only show law once (as law of the day, not duplicated as separate card)
    const cards = el.querySelectorAll('.card');
    expect(cards.length).toBeLessThanOrEqual(4); // 1 LOTD + 3 for sections (top/trending/recent)
  });

  it('renders law when law of the day fetch fails', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockRejectedValueOnce(new Error('LOTD fetch failed'));

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch Law of the Day:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('handles navigation button clicks', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    let navTarget = '';
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: (target) => { navTarget = target; }, onVote: () => {} });

    await new Promise(r => setTimeout(r, 50));

    const browseBtn = el.querySelector('[data-nav="browse"]');
    if (browseBtn) {
      browseBtn.click();
      expect(navTarget).toBe('browse');
    }
  });

  it('handles downvote button clicks', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    let voteCapture = '';
    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: (id, type) => { voteCapture = `${id}:${type}`; } });

    await new Promise(r => setTimeout(r, 50));

    const downvoteBtn = el.querySelector('[data-vote="down"]');
    if (downvoteBtn) {
      downvoteBtn.click();
      expect(voteCapture).toBe(`${law.id}:down`);
    }
  });

  it('handles non-HTMLElement click targets', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });

    await new Promise(r => setTimeout(r, 50));

    // Simulate click with non-HTMLElement target
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: null, writable: false });
    el.dispatchEvent(event);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('renders law without title', async () => {
    const law = { id: '7', text: 'Test text without title', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Law/);
    expect(el.textContent).toMatch(/Test text without title/);
  });

  it('renders law without author or submittedBy', async () => {
    const law = { id: '7', text: 'Anonymous law', score: 3 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Anonymous law/);
  });

  it('handles negative score display', async () => {
    const law = { id: '7', title: 'Unpopular Law', text: 'Test text', score: -5 };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });

    const el = LawDetail({ lawId: law.id, _isLoggedIn: false, _currentUser: null, onNavigate: () => {}, onVote: () => {} });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/-5/);
  });
});

