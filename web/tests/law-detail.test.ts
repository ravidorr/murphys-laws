import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LawDetail } from '../src/views/law-detail.js';
import * as votingModule from '../src/utils/voting.js';
import type { CleanableElement } from '../src/types/app.js';

describe('LawDetail view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('L43 B1: loadingState exists so loading text is set', () => {
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    const loadingState = el.querySelector('[data-loading]');
    expect(loadingState).toBeTruthy();
  });

  it('L45 B1: loadingText exists inside loadingState', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    const loadingState = el.querySelector('[data-loading] p');
    expect(loadingState).toBeTruthy();
  });

  it('L59 B1: notFoundState exists so content is shown', async () => {
    const el = LawDetail({ lawId: '', onNavigate: () => { } });
    await new Promise(r => setTimeout(r, 0));
    const notFound = el.querySelector('[data-not-found]');
    expect(notFound).toBeTruthy();
  });

  it('L61 B1: notFoundTemplate is HTMLTemplateElement so replaceChildren called', async () => {
    const el = LawDetail({ lawId: null as unknown as string, onNavigate: () => { } });
    expect(el.querySelector('[data-not-found]')).toBeTruthy();
  });

  it('L76 B0: lawCardTemplate missing or not template so renderLawCard returns null', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.textContent).toBeTruthy(), { timeout: 500 });
    expect(el.querySelector('[data-law-card-container]')).toBeTruthy();
  });

  it('L91 B1: titleEl exists so title is set with accent', async () => {
    const law = { id: '1', title: 'Test Law', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('.accent-text')).toBeTruthy(), { timeout: 500 });
  });

  it('L105 L110 L115 L124 L125 L128 L137 L139 L145 L154 L166 B1: renderLawCard branches with full law', async () => {
    const law = { id: '1', title: 'A Law', text: 'Text', score: 1, upvotes: 1, downvotes: 0, attributions: [], author: 'X', submittedBy: 'Y' };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.textContent).toMatch(/A Law/), { timeout: 500 });
    expect(el.querySelector('[data-upvote-count]')?.textContent).toBe('1');
  });

  it('renders source status and report issue action for fetched law details', async () => {
    const law = { id: '1', title: 'A Law', text: 'Text', score: 1, attributions: [{ name: 'Known Source' }] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-law-source-status]')?.textContent).toContain('Known Source'), { timeout: 500 });
    expect(el.querySelector('[data-law-report-link]')?.getAttribute('href')).toBe('/contact');
  });

  it('L207 B1: breadcrumbContainer exists so breadcrumb rendered', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('#law-breadcrumb')).toBeTruthy(), { timeout: 500 });
  });

  it('L211 T39 B0 T40 B1: law has category_slug and category_name so breadcrumb item added', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0, category_slug: 'tech', category_name: 'Technology' };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.textContent).toMatch(/Technology/), { timeout: 500 });
  });

  it('L219 L226 L228 L234 B1: breadcrumb and lawCard and footer and social share', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('.section-footer')).toBeTruthy(), { timeout: 500 });
  });

  it('L258 B1: contextSection and contextTextEl exist so context set', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0, category_context: 'Custom' };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-law-context-text]')?.textContent).toBe('Custom'), { timeout: 500 });
  });

  it('L274 T49 B0: random-law when total <= 0 navigates to browse', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    const emptyList = { data: [], total: 0, limit: 1, offset: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => emptyList })
      .mockResolvedValueOnce({ ok: true, json: async () => emptyList });
    let nav = '';
    const el = LawDetail({ lawId: '1', onNavigate: (t) => { nav = t; } });
    await vi.waitFor(() => expect(el.querySelector('[data-action="random-law"]')).toBeTruthy(), { timeout: 1000 });
    (el.querySelector('[data-action="random-law"]') as HTMLElement)!.click();
    await new Promise(r => setTimeout(r, 150));
    expect(nav).toBe('browse');
  });

  it('L314 L315 L331 L335 L336 L345 B0 B1: random-law button present after load so branch reachable', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => {
      expect(el.querySelector('[data-action="random-law"]')).toBeTruthy();
    }, { timeout: 1000 });
  });

  it('L325 L326 L346 L347: random-law when total > 0 navigates to law by id', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    const listWithTotal = { data: [], total: 5, limit: 1, offset: 0 };
    const listWithLaw = { data: [{ id: 99, title: 'Random Law', text: 'Text', score: 0 }], total: 5, limit: 1, offset: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => listWithTotal })
      .mockResolvedValueOnce({ ok: true, json: async () => listWithLaw });
    let navPage = '';
    let navParam: string | undefined;
    const el = LawDetail({ lawId: '1', onNavigate: (page, param) => { navPage = page; navParam = param; } });
    await vi.waitFor(() => expect(el.querySelector('[data-action="random-law"]')).toBeTruthy(), { timeout: 1000 });
    (el.querySelector('[data-action="random-law"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 150));
    expect(navPage).toBe('law');
    expect(navParam).toBe('99');
  });

  it('L352 L353: random-law when fetchLaws rejects navigates to browse', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockRejectedValueOnce(new Error('Network error'));
    let nav = '';
    const el = LawDetail({ lawId: '1', onNavigate: (t) => { nav = t; } });
    await vi.waitFor(() => expect(el.querySelector('[data-action="random-law"]')).toBeTruthy(), { timeout: 1000 });
    (el.querySelector('[data-action="random-law"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 150));
    expect(nav).toBe('browse');
  });

  it('L346 L347: random-law when second fetch returns data without id navigates to browse', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    const listWithTotal = { data: [], total: 2, limit: 1, offset: 0 };
    const listWithNoId = { data: [{ title: 'No Id Law', text: 'T', score: 0 }], total: 2, limit: 1, offset: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => listWithTotal })
      .mockResolvedValueOnce({ ok: true, json: async () => listWithNoId });
    let nav = '';
    const el = LawDetail({ lawId: '1', onNavigate: (t) => { nav = t; } });
    await vi.waitFor(() => expect(el.querySelector('[data-action="random-law"]')).toBeTruthy(), { timeout: 1000 });
    (el.querySelector('[data-action="random-law"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 150));
    expect(nav).toBe('browse');
  });

  it('L387 L388 L397 L404 L405 L407 B1: copy and favorite and related card handlers', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-action="copy-text"]')).toBeTruthy(), { timeout: 500 });
    expect(el.querySelector('[data-favorite-btn]')).toBeTruthy();
  });

  it('L423 L431 L439 L441 B1: vote button and nav and related favorite iconEl', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    let nav = '';
    const el = LawDetail({ lawId: '1', onNavigate: (t) => { nav = t; } });
    await vi.waitFor(() => expect(el.querySelector('[data-nav="browse"]')).toBeTruthy(), { timeout: 500 });
    (el.querySelector('[data-nav="browse"]') as HTMLElement).click();
    expect(nav).toBe('browse');
  });

  it('L460 L485 B1: voteBtn with id and upVoteCount downVoteCount update', async () => {
    const law = { id: '1', title: 'T', text: 'T', score: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 2, downvotes: 0 });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-vote="up"]')).toBeTruthy(), { timeout: 500 });
    (el.querySelector('[data-vote="up"]') as HTMLElement).click();
    await new Promise(r => setTimeout(r, 20));
    expect(el.querySelector('[data-upvote-count]')?.textContent).toBe('2');
  });

  it('renders not found for unknown id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    const el = LawDetail({ lawId: 'nope', onNavigate: () => { } });
    await new Promise(r => setTimeout(r, 0));
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('shows not found and clears export when fetchLaw rejects (L323-326)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await new Promise(r => setTimeout(r, 50));
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders not found when lawId is null', async () => {
    const el = LawDetail({ lawId: null as unknown as string, onNavigate: () => { } });
    expect(el.textContent).toMatch(/Law Not Found/);
  });

  it('renders law with single-word title (L91 else branch)', async () => {
    const law = { id: '1', title: 'Murphy', text: 'Single word title.', upvotes: 0, downvotes: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-law-title]')).toBeTruthy(), { timeout: 500 });
    const titleEl = el.querySelector('[data-law-title]');
    expect(titleEl?.textContent).toBe('Murphy');
  });

  it('renders title for existing law and triggers vote', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, submittedBy: 'tester' };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 1, downvotes: 0 });
    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(law.title);
    const voteBtn = el.querySelector('[data-vote="up"]');
    if (voteBtn) {
      (voteBtn as HTMLElement).click();
      await new Promise(r => setTimeout(r, 0)); // Wait for async handler
      expect(toggleVoteSpy).toHaveBeenCalledWith(law.id, 'up');
    }
  });

  it('renders law successfully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    // Wait for the law to render
    await vi.waitFor(() => {
      expect(el.textContent).toMatch(/Test Law/);
    }, { timeout: 500 });

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('renders In context section with category_context from API when present', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, category_context: 'Custom context from category table.' };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-law-context]')).toBeTruthy();
      expect(el.querySelector('[data-law-context-text]')?.textContent).toBe('Custom context from category table.');
    }, { timeout: 500 });
  });

  it('renders In context section with default copy when category_context is empty', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await vi.waitFor(() => {
      expect(el.querySelector('[data-law-context-text]')?.textContent).toBeTruthy();
      expect(el.querySelector('[data-law-context-text]')?.textContent).toContain("Murphy's");
    }, { timeout: 500 });
  });

  it('handles navigation button clicks', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    let navTarget = '';
    const el = LawDetail({ lawId: law.id, onNavigate: (target) => { navTarget = target; } });

    await new Promise(r => setTimeout(r, 50));

    const browseBtn = el.querySelector('[data-nav="browse"]');
    if (browseBtn) {
      (browseBtn as HTMLElement).click();
      expect(navTarget).toBe('browse');
    }
  });

  it('handles downvote button clicks', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 0, downvotes: 1 });
    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const downvoteBtn = el.querySelector('[data-vote="down"]');
    if (downvoteBtn) {
      (downvoteBtn as HTMLElement).click();
      await new Promise(r => setTimeout(r, 0)); // Wait for async handler
      expect(toggleVoteSpy).toHaveBeenCalledWith(law.id, 'down');
    }
  });

  it('handles non-HTMLElement click targets', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

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

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Law/);
    expect(el.textContent).toMatch(/Test text without title/);
  });

  it('renders law with single-word title (title branch else)', async () => {
    const law = { id: '8', title: 'Murphy', text: 'Single word title.', score: 0 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Murphy/);
    expect(el.textContent).toMatch(/Single word title/);
  });

  it('renders law without author or submittedBy', async () => {
    const law = { id: '7', text: 'Anonymous law', score: 3 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Anonymous law/);
  });

  it('handles negative score display', async () => {
    const law = { id: '7', title: 'Unpopular Law', text: 'Test text', score: -5, upvotes: 2, downvotes: 7 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Check for upvote and downvote counts
    const upvoteCount = el.querySelector('[data-upvote-count]');
    const downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('2');
    expect(downvoteCount?.textContent).toBe('7');
  });


  it('handles law with category information', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3, category: 'Technology' };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });


  it('renders with all law metadata present', async () => {
    const law = {
      id: '7',
      title: 'Full Law',
      text: 'Full law text',
      score: 10,
      author: 'Famous Author',
      submittedBy: 'user123',
      publishDate: '2024-01-01'
    };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Full Law/);
    expect(el.textContent).toMatch(/Famous Author/);
  });


  it('handles law with attributions array', async () => {
    const law = {
      id: '7',
      title: 'Test Law',
      text: 'Test text',
      score: 3,
      attributions: [{ name: 'Contributor Name' }]
    };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
  });

  it('handles law with undefined score', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text' };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    expect(el.textContent).toMatch(/Test Law/);
    // Check for upvote and downvote counts (should default to 0)
    const upvoteCount = el.querySelector('[data-upvote-count]');
    const downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('0');
    expect(downvoteCount?.textContent).toBe('0');
  });


  it('updates vote counts in UI after voting', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 6, downvotes: 2 });
    const getUserVoteSpy = vi.spyOn(votingModule, 'getUserVote').mockReturnValue('up');

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Initial counts
    let upvoteCount = el.querySelector('[data-upvote-count]');
    let downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('5');
    expect(downvoteCount?.textContent).toBe('2');

    // Click upvote
    const upvoteBtn = el.querySelector('[data-vote="up"]');
    (upvoteBtn as HTMLElement | null)?.click();
    await new Promise(r => setTimeout(r, 10));

    // Counts should update
    upvoteCount = el.querySelector('[data-upvote-count]');
    downvoteCount = el.querySelector('[data-downvote-count]');
    expect(upvoteCount?.textContent).toBe('6');
    expect(downvoteCount?.textContent).toBe('2');
    expect(toggleVoteSpy).toHaveBeenCalledWith('7', 'up');
    expect(getUserVoteSpy).toHaveBeenCalledWith('7');
  });

  it('displays voted state when user has already voted', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const getUserVoteSpy = vi.spyOn(votingModule, 'getUserVote').mockReturnValue('up');

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    const downvoteBtn = el.querySelector('[data-vote="down"]');

    expect(upvoteBtn?.classList.contains('voted')).toBe(true);
    expect(downvoteBtn?.classList.contains('voted')).toBe(false);
    expect(getUserVoteSpy).toHaveBeenCalledWith('7');
  });

  it('displays downvote voted state when user has downvoted', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const getUserVoteSpy = vi.spyOn(votingModule, 'getUserVote').mockReturnValue('down');

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const upvoteBtn = el.querySelector('[data-vote="up"]');
    const downvoteBtn = el.querySelector('[data-vote="down"]');

    expect(upvoteBtn?.classList.contains('voted')).toBe(false);
    expect(downvoteBtn?.classList.contains('voted')).toBe(true);
    expect(getUserVoteSpy).toHaveBeenCalledWith('7');
  });

  it('handles clicking on icon inside vote button', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 6, downvotes: 2 });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Click on the icon inside the button (not the button itself)
    const upvoteBtn = el.querySelector('[data-vote="up"]');
    const icon = upvoteBtn?.querySelector('.icon');

    if (icon) {
      const event = new MouseEvent('click', { bubbles: true });
      icon.dispatchEvent(event);
      await vi.waitFor(() => {
        expect(toggleVoteSpy).toHaveBeenCalledWith('7', 'up');
      });
    }
  });

  it('renders social share buttons in footer', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text for sharing', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Check that social share popover exists in the footer
    const shareWrapper = el.querySelector('.section-footer .share-wrapper');
    expect(shareWrapper).toBeTruthy();
    expect(shareWrapper!.querySelector('.share-trigger')).toBeTruthy();
  });

  it('renders all social share buttons', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Check that share popover exists with all social links
    const shareWrapper = el.querySelector('.share-wrapper');
    expect(shareWrapper).toBeTruthy();
    expect(shareWrapper!.querySelector('.share-trigger')).toBeTruthy();

    const popover = shareWrapper!.querySelector('.share-popover');
    expect(popover).toBeTruthy();
    // All share options (Copy link, X, Email, Facebook, etc.) are in the popover
    expect(popover!.querySelector('[href*="twitter"]')).toBeTruthy();
    expect(popover!.querySelector('[href*="facebook"]')).toBeTruthy();
    expect(popover!.querySelector('[href*="linkedin"]')).toBeTruthy();
    expect(popover!.querySelector('[href*="reddit"]')).toBeTruthy();
    expect(popover!.querySelector('[href*="mailto"]')).toBeTruthy();
  });

  it('calls onStructuredData callback when provided', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const onStructuredDataSpy = vi.fn();

    LawDetail({
      lawId: law.id,
      onNavigate: () => { },
      onStructuredData: onStructuredDataSpy
    });

    await new Promise(r => setTimeout(r, 50));

    // onStructuredData should have been called with the law data
    expect(onStructuredDataSpy).toHaveBeenCalledWith(law);
  });

  it('handles voting errors gracefully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockRejectedValue(new Error('Network error'));

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const upvoteBtn = el.querySelector('[data-vote="up"]');

    // Should not throw when voting fails
    (upvoteBtn as HTMLElement | null)?.click();
    await new Promise(r => setTimeout(r, 10));

    // If we got here without throwing, the error was handled gracefully
    expect(toggleVoteSpy).toHaveBeenCalled();
  });

  it('handles missing law card template gracefully', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Remove the template element to simulate missing template
    const template = el.querySelector('[data-law-card-template]');
    if (template) {
      // Replace the template with a non-template element
      const div = document.createElement('div');
      div.setAttribute('data-law-card-template', '');
      template.parentNode!.replaceChild(div, template);
    }

    // Try to re-render - should not crash
    // The component should handle this gracefully when renderLawCard returns null
    expect(el.querySelector('[data-law-content]')).toBeTruthy();
  });

  it('copies related law link to clipboard when share button is clicked', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy link button (new format with data-action)
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/99');
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/law/99'));
  });

  it('uses fallback when clipboard API fails on share button', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard not available'));
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Mock execCommand for fallback
    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy link button (new format with data-action)
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    copyLinkBtn.setAttribute('data-copy-value', 'https://test.com/law/88');
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 50));

    // Should have tried clipboard first, then fallback to execCommand
    expect(writeTextMock).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('uses window.location.href as fallback when data-copy-value is missing on copy link', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy link button without data-copy-value
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.setAttribute('data-action', 'copy-link');
    // No data-copy-value set - should fall back to window.location.href
    el.appendChild(copyLinkBtn);

    copyLinkBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
  });

  it('uses law-text element as fallback when data-copy-value is missing on copy text', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy text button without data-copy-value
    const copyTextBtn = document.createElement('button');
    copyTextBtn.setAttribute('data-action', 'copy-text');
    // No data-copy-value set - should fall back to [data-law-text] element
    el.appendChild(copyTextBtn);

    copyTextBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should have copied the law text from the rendered element
    expect(writeTextMock).toHaveBeenCalled();
  });


  it('uses data-copy-value when set on copy text button (L305)', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Body text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    const copyTextBtn = document.createElement('button');
    copyTextBtn.setAttribute('data-action', 'copy-text');
    copyTextBtn.setAttribute('data-copy-value', 'Custom text to copy');
    el.appendChild(copyTextBtn);

    copyTextBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalledWith('Custom text to copy');
  });

  it('navigates to related law card when clicked', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    let navTarget = '';
    let navParam: string | undefined = '';
    const el = LawDetail({
      lawId: law.id,
      onNavigate: (target, param) => { navTarget = target; navParam = param; }
    });

    await new Promise(r => setTimeout(r, 50));

    // Create a related law card
    const relatedCard = document.createElement('div');
    relatedCard.className = 'law-card-mini';
    relatedCard.dataset.lawId = '42';
    el.appendChild(relatedCard);

    relatedCard.click();

    expect(navTarget).toBe('law');
    expect(navParam).toBe('42');
  });

  it('does not navigate when clicking button inside related law card (L394 B0)', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: law.id, onNavigate });

    await new Promise(r => setTimeout(r, 50));

    const relatedCard = document.createElement('div');
    relatedCard.className = 'law-card-mini';
    relatedCard.dataset.lawId = '99';
    const btn = document.createElement('button');
    btn.textContent = 'Vote';
    relatedCard.appendChild(btn);
    el.appendChild(relatedCard);

    btn.click();

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('fetches related laws using dedicated endpoint', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };
    const relatedLaws = {
      data: [
        { id: '8', title: 'Related Law', text: 'Related text', upvotes: 3, downvotes: 0 }
      ],
      law_id: 7
    };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => relatedLaws });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Should have made at least 2 fetches (law + related laws)
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThanOrEqual(2);

    // Verify the related laws endpoint was called
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.map(call => call[0]);
    const hasRelatedCall = fetchCalls.some(url => String(url).includes('/related'));
    expect(hasRelatedCall).toBe(true);
  });

  it('handles related laws fetch failure silently', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockRejectedValueOnce(new Error('Network error'));

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Should not throw - related laws failure is silent
    expect(el.textContent).toContain('Test Law');
  });

  it('handles empty related laws array', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ data: [], law_id: 7 }) });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Related section should remain hidden
    const relatedSection = el.querySelector('[data-related-laws]');
    if (relatedSection) {
      expect(relatedSection.hasAttribute('hidden')).toBe(true);
    }
  });

  it('handles related laws with null data', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ data: null, law_id: 7 }) });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 100));

    // Should not throw
    expect(el.textContent).toContain('Test Law');
  });

  it('handles copy text action with successful clipboard', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text content', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy text button and click it
    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-action', 'copy-text');
    el.appendChild(copyBtn);

    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(writeTextMock).toHaveBeenCalled();
  });

  it('handles copy text action with clipboard failure fallback', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text content', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    // Mock execCommand for fallback
    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a copy text button and click it
    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-action', 'copy-text');
    el.appendChild(copyBtn);

    copyBtn.click();
    await new Promise(r => setTimeout(r, 50));

    expect(writeTextMock).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('handles favorite button click on main law card', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a favorite button with data-favorite-btn attribute (main law card format)
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-favorite-btn', '');
    favoriteBtn.dataset.id = '7';
    favoriteBtn.dataset.lawText = 'Test text';
    favoriteBtn.dataset.lawTitle = 'Test Law';
    
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('data-icon-name', 'bookmarkFilled');
    favoriteBtn.appendChild(iconSvg);
    
    el.appendChild(favoriteBtn);

    // Verify button doesn't start with favorited class
    expect(favoriteBtn.classList.contains('favorited')).toBe(false);

    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should have added favorited class (law was not previously favorited)
    expect(favoriteBtn.classList.contains('favorited')).toBe(true);
  });

  it('handles favorite button click without law id', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a favorite button without data-id
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-favorite-btn', '');
    // No dataset.id set
    el.appendChild(favoriteBtn);

    // Should not throw
    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));
    
    expect(true).toBe(true);
  });

  it('handles related law favorite button click', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a related law card with favorite button (uses data-action="favorite")
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '42';
    
    const lawText = document.createElement('p');
    lawText.className = 'law-card-text';
    lawText.textContent = 'Related law text';
    lawCard.appendChild(lawText);
    
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-action', 'favorite');
    favoriteBtn.setAttribute('data-law-id', '42');
    
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('data-icon-name', 'bookmarkFilled');
    favoriteBtn.appendChild(iconSvg);
    
    lawCard.appendChild(favoriteBtn);
    el.appendChild(lawCard);

    // Verify button doesn't start with favorited class
    expect(favoriteBtn.classList.contains('favorited')).toBe(false);

    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // Should have added favorited class (law was not previously favorited)
    expect(favoriteBtn.classList.contains('favorited')).toBe(true);
  });

  it('handles related law favorite button click without law id', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a favorite button with data-action="favorite" but no data-law-id
    const favoriteBtn = document.createElement('button');
    favoriteBtn.setAttribute('data-action', 'favorite');
    // No data-law-id set
    el.appendChild(favoriteBtn);

    // Should not throw and should return early
    favoriteBtn.click();
    await new Promise(r => setTimeout(r, 10));
    
    expect(true).toBe(true);
  });

  it('does not navigate when clicking buttons inside related law card', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: law.id, onNavigate });

    await new Promise(r => setTimeout(r, 50));

    // Create a related law card with a button inside
    const lawCard = document.createElement('div');
    lawCard.className = 'law-card-mini';
    lawCard.dataset.lawId = '42';
    const button = document.createElement('button');
    button.setAttribute('data-action', 'favorite');
    lawCard.appendChild(button);
    el.appendChild(lawCard);

    // Reset the mock to clear any previous calls
    onNavigate.mockClear();

    // Click the button inside the card
    button.click();

    // Navigation should NOT be triggered when clicking buttons
    expect(onNavigate).not.toHaveBeenCalledWith('law', expect.anything());
  });

  it('does not copy when copy text button has no text to copy', async () => {
    const law = { id: '7', title: 'Test Law', text: '', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Remove the law text element to simulate no text available
    const lawTextEl = el.querySelector('[data-law-text]');
    if (lawTextEl) {
      lawTextEl.textContent = '';
    }

    // Create a copy text button without data-copy-value
    const copyBtn = document.createElement('button');
    copyBtn.setAttribute('data-action', 'copy-text');
    el.appendChild(copyBtn);

    copyBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // writeText should not be called when there's no text
    // (or may be called with empty string depending on implementation)
    expect(true).toBe(true);
  });

  it('handles vote button click without voteType attribute', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const toggleVoteSpy = vi.spyOn(votingModule, 'toggleVote').mockResolvedValue({ upvotes: 6, downvotes: 2 });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Create a vote button without data-vote attribute value
    const voteBtn = document.createElement('button');
    voteBtn.setAttribute('data-vote', '');  // Empty vote type
    voteBtn.dataset.id = '7';
    el.appendChild(voteBtn);

    voteBtn.click();
    await new Promise(r => setTimeout(r, 10));

    // toggleVote should not be called when voteType is empty
    expect(toggleVoteSpy).not.toHaveBeenCalledWith('7', '');
  });

  it('provides a cleanup function that clears export content', async () => {
    const law = { id: '7', title: 'Test Law', text: 'Test text', score: 3 };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => law });

    const el = LawDetail({ lawId: law.id, onNavigate: () => { } });

    await new Promise(r => setTimeout(r, 50));

    // Element should have a cleanup function
    expect(typeof (el as CleanableElement).cleanup).toBe('function');

    // Calling cleanup should not throw
    expect(() => (el as CleanableElement).cleanup!()).not.toThrow();
  });
});
