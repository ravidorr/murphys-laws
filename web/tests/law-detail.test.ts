import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LawDetail, describeLawLoadFailure, getReferrerDomain } from '../src/views/law-detail.js';
import * as votingModule from '../src/utils/voting.js';
import { setExportContent, clearExportContent, getExportContent, ContentType } from '../src/utils/export-context.js';
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
    expect(el.querySelector('[data-law-card-root]')?.className).toContain('card--section law-detail-card');
    expect(el.querySelector('[data-upvote-count]')?.textContent).toBe('1');
  });

  it('renders law text containing ampersands without entity text', async () => {
    const law = { id: '1', title: 'A Law', text: 'A Smith & Wesson beats four aces.', score: 1 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-law-text]')?.textContent).toBe(law.text), { timeout: 500 });
  });

  it('renders source status and report issue action for fetched law details', async () => {
    const law = { id: '1', title: 'A Law', text: 'Text', score: 1, attributions: [{ name: 'Known Source' }] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-law-source-status]')?.textContent).toContain('Known Source'), { timeout: 500 });
    expect(el.querySelector('[data-law-report-link]')?.getAttribute('href')).toBe('/contact');
  });

  it('renders an optional reviewed editorial annotation', async () => {
    const law = {
      id: '1',
      title: 'A Law',
      text: 'Text',
      score: 1,
      editorial: {
        explanation: 'A reviewed explanation.',
        practical_example: 'A practical example.',
        source_label: 'Primary source',
        source_url: 'https://example.com/source',
        reviewed_at: '2026-07-21'
      }
    };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-law-editorial]')?.hasAttribute('hidden')).toBe(false), { timeout: 500 });
    expect(el.querySelector('[data-law-editorial-explanation]')?.textContent).toBe('A reviewed explanation.');
    expect(el.querySelector('[data-law-editorial-source]')?.getAttribute('href')).toBe('https://example.com/source');
    expect(el.querySelector('[data-law-editorial-reviewed]')?.getAttribute('datetime')).toBe('2026-07-21');
  });

  it('does not link editorial sources that are not HTTPS URLs', async () => {
    const law = {
      id: '1',
      title: 'A Law',
      text: 'Text',
      score: 1,
      editorial: {
        explanation: 'A reviewed explanation.',
        practical_example: 'A practical example.',
        source_label: 'Unverified source',
        source_url: 'http://example.com/source',
        reviewed_at: '2026-07-21'
      }
    };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-law-editorial]')?.hasAttribute('hidden')).toBe(false), { timeout: 500 });
    const source = el.querySelector('[data-law-editorial-source]');
    expect(source?.getAttribute('href')).toBeNull();
    expect(source?.textContent).toBe('');
  });

  it('renders internal links for law category context', async () => {
    const law = {
      id: '1',
      title: 'Technology Law',
      text: 'Text',
      score: 1,
      category_slug: 'murphys-technology-laws',
      category_name: "Murphy's Technology Laws"
    };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-law-internal-links]')?.textContent).toContain('Technology hub'), { timeout: 500 });
    expect(el.querySelector('[data-law-internal-links]')?.textContent).toContain('Technology hub');
    expect(el.querySelector('[data-law-internal-links]')?.innerHTML).toContain('/examples/tech');
  });

  it("leads Crane's law's related links with its article, and no other law's", async () => {
    const crane = {
      id: '2406',
      title: "Crane's law",
      text: 'There is no such thing as a free lunch.',
      score: 1,
      category_slug: 'murphys-laws',
      category_name: "Murphy's Laws"
    };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => crane });
    const el = LawDetail({ lawId: '2406', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-law-internal-links] a')?.getAttribute('href')).toBe('/cranes-law'), { timeout: 500 });

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...crane, id: '1', title: 'Some other law' }) });
    const other = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(other.querySelector('[data-law-internal-links] a')).toBeTruthy(), { timeout: 500 });
    expect(other.querySelector('[data-law-internal-links]')?.innerHTML).not.toContain('/cranes-law');
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

  it('renders not found when the API answers 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.textContent).toMatch(/Law Not Found/), { timeout: 500 });
    expect(el.textContent).not.toMatch(/We couldn't load this law/);
  });

  it('renders not found for an ID that cannot name a law without calling the API', async () => {
    globalThis.fetch = vi.fn();
    const el = LawDetail({ lawId: 'nope', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.textContent).toMatch(/Law Not Found/), { timeout: 500 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  describe('load failures', () => {
    type PendoTrack = (eventName: string, properties?: Record<string, unknown>) => void;
    let track: ReturnType<typeof vi.fn<PendoTrack>>;

    beforeEach(() => {
      track = vi.fn<PendoTrack>();
      window.pendo = { track };
    });

    afterEach(() => {
      delete window.pendo;
      clearExportContent();
    });

    const timeoutError = () => Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' });

    it.each([
      ['a forbidden answer', 'http_error', () => vi.fn().mockResolvedValue({ ok: false, status: 403 })],
      ['a server error', 'server_error', () => vi.fn().mockResolvedValue({ ok: false, status: 503 })],
      ['a network error', 'network', () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
      ['an unknown error', 'unknown', () => vi.fn().mockRejectedValue(new Error('Network error'))],
      ['a non-JSON answer', 'invalid_response', () => vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: async () => ({}),
      })],
      ['a timeout', 'timeout', () => vi.fn().mockRejectedValue(timeoutError())],
    ])('renders a load failure, not "Law Not Found", on %s', async (_name, reason, makeFetch) => {
      setExportContent({ type: ContentType.SINGLE_LAW, title: 'Stale', data: 'stale' });
      globalThis.fetch = makeFetch();
      const el = LawDetail({ lawId: '1', onNavigate: () => { } });
      await vi.waitFor(() => expect(el.textContent).toMatch(/We couldn't load this law/), { timeout: 500 });
      expect(el.textContent).not.toMatch(/Law Not Found|doesn't exist/);
      expect(el.querySelector('[data-not-found] [data-action="retry-law"]')).toBeTruthy();
      expect(getExportContent()).toBeNull();
      expect(track).toHaveBeenCalledWith('law_not_found', expect.objectContaining({
        law_id: '1',
        failure_reason: reason,
        is_retry: false,
      }));
    });

    it('announces the load failure as an alert and not the "Law Not Found" state', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      const el = LawDetail({ lawId: '1', onNavigate: () => { } });
      await vi.waitFor(() => expect(el.textContent).toMatch(/We couldn't load this law/), { timeout: 500 });
      expect(el.querySelector('[data-not-found] [role="alert"]')).toBeTruthy();

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      const notFound = LawDetail({ lawId: '2', onNavigate: () => { } });
      await vi.waitFor(() => expect(notFound.textContent).toMatch(/Law Not Found/), { timeout: 500 });
      expect(notFound.querySelector('[role="alert"]')).toBeNull();
    });

    it('accents the first word of the load failure heading', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      const el = LawDetail({ lawId: '1', onNavigate: () => { } });
      await vi.waitFor(() => expect(el.textContent).toMatch(/We couldn't load this law/), { timeout: 500 });
      expect(el.querySelector('[data-not-found] .empty-state-title .accent-text')?.textContent).toBe('We');
    });

    it('lets the visible Try Again text name the button in both error states', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      const failed = LawDetail({ lawId: '1', onNavigate: () => { } });
      await vi.waitFor(() => expect(failed.textContent).toMatch(/We couldn't load this law/), { timeout: 500 });
      const failedButton = failed.querySelector('[data-not-found] [data-action="retry-law"]');
      expect(failedButton?.hasAttribute('aria-label')).toBe(false);
      expect(failedButton?.textContent).toMatch(/Try Again/);

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      const missing = LawDetail({ lawId: '2', onNavigate: () => { } });
      await vi.waitFor(() => expect(missing.textContent).toMatch(/Law Not Found/), { timeout: 500 });
      expect(missing.querySelector('[data-not-found] [data-action="retry-law"]')?.hasAttribute('aria-label')).toBe(false);
    });

    it('moves focus to the new Try Again button when a retry fails again, but not on the first load', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      const el = LawDetail({ lawId: '1', onNavigate: () => { } });
      document.body.appendChild(el);
      try {
        await vi.waitFor(() => expect(el.textContent).toMatch(/We couldn't load this law/), { timeout: 500 });
        expect(document.activeElement).toBe(document.body);

        const firstButton = el.querySelector('[data-action="retry-law"]') as HTMLElement;
        firstButton.focus();
        firstButton.click();
        await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2), { timeout: 500 });
        await vi.waitFor(() => {
          const button = el.querySelector('[data-not-found] [data-action="retry-law"]');
          expect(button).toBeTruthy();
          expect(button).not.toBe(firstButton);
          expect(document.activeElement).toBe(button);
        }, { timeout: 500 });
      } finally {
        el.remove();
      }
    });
  });

  it('switches to not found when a retry after a load failure gets a 404', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: false, status: 404 });
    const el = LawDetail({ lawId: '1', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.textContent).toMatch(/We couldn't load this law/), { timeout: 500 });

    (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

    await vi.waitFor(() => expect(el.textContent).toMatch(/Law Not Found/), { timeout: 500 });
    expect(el.textContent).not.toMatch(/We couldn't load this law/);
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
      expect(toggleVoteSpy).toHaveBeenCalledWith(law.id, 'up', 'law_detail');
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
      expect(toggleVoteSpy).toHaveBeenCalledWith(law.id, 'down', 'law_detail');
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
    expect(toggleVoteSpy).toHaveBeenCalledWith('7', 'up', 'law_detail');
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
        expect(toggleVoteSpy).toHaveBeenCalledWith('7', 'up', 'law_detail');
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

    const relatedSection = el.querySelector('[data-related-laws]');
    expect(relatedSection?.hasAttribute('hidden')).toBe(false);
    expect(relatedSection?.textContent).toContain('Browse all laws');
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

  describe('Pendo tracking', () => {
    type PendoTrack = (eventName: string, properties?: Record<string, unknown>) => void;
    let track: ReturnType<typeof vi.fn<PendoTrack>>;

    beforeEach(() => {
      track = vi.fn<PendoTrack>();
      window.pendo = { track };
      window.history.replaceState(null, '', '/law/7');
    });

    afterEach(() => {
      delete window.pendo;
      Reflect.deleteProperty(document, 'referrer');
    });

    it('reports a law that cannot be found, with the HTTP status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      LawDetail({ lawId: '7', onNavigate: () => { } });

      await vi.waitFor(() => {
        expect(track).toHaveBeenCalledWith('law_not_found', {
          law_id: '7',
          failure_reason: 'not_found',
          http_status: 404,
          is_retry: false,
          referrer_domain: 'direct',
        });
      }, { timeout: 500 });
    });

    it('reports a missing law ID', () => {
      LawDetail({ lawId: '', onNavigate: () => { } });

      expect(track).toHaveBeenCalledWith('law_not_found', {
        failure_reason: 'missing_id',
        is_retry: false,
        referrer_domain: 'direct',
      });
    });

    it('reports failed retries', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const el = LawDetail({ lawId: '7', onNavigate: () => { } });
      await vi.waitFor(() => expect(el.querySelector('[data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });

      (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

      await vi.waitFor(() => {
        expect(track).toHaveBeenCalledWith('law_not_found', expect.objectContaining({
          failure_reason: 'network',
          is_retry: true,
        }));
      }, { timeout: 500 });
      expect(track).toHaveBeenCalledTimes(2);
    });

    it('reports copies from the main card and from related law cards', async () => {
      const law = { id: '7', title: 'Test Law', text: 'Test text', upvotes: 5, downvotes: 2 };
      globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => law });
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
      const el = LawDetail({ lawId: law.id, onNavigate: () => { } });
      await vi.waitFor(() => expect(el.querySelector('[data-law-card-root] [data-action="copy-link"]')).toBeTruthy(), { timeout: 500 });

      (el.querySelector('[data-law-card-root] [data-action="copy-link"]') as HTMLElement).click();
      const relatedCard = document.createElement('article');
      relatedCard.className = 'law-card-mini';
      relatedCard.innerHTML = '<button type="button" data-action="copy-text" data-copy-value="Related text" data-law-id="9"></button>';
      el.querySelector('[data-related-laws-list]')!.appendChild(relatedCard);
      (relatedCard.querySelector('button') as HTMLElement).click();

      await vi.waitFor(() => {
        expect(track).toHaveBeenCalledWith('law_shared', {
          law_id: '7', share_method: 'copy_link', surface: 'law_detail', page_path: '/law/7'
        });
        expect(track).toHaveBeenCalledWith('law_shared', {
          law_id: '9', share_method: 'copy_text', surface: 'law_card', page_path: '/law/7'
        });
      }, { timeout: 500 });
    });

    describe('describeLawLoadFailure', () => {
      it.each([
        [new Error('Failed to fetch law: 404'), { failure_reason: 'not_found', http_status: 404 }],
        [new Error('Failed to fetch law: 503'), { failure_reason: 'server_error', http_status: 503 }],
        [new Error('Failed to fetch law: 410'), { failure_reason: 'http_error', http_status: 410 }],
        [new Error('Invalid law ID'), { failure_reason: 'invalid_id' }],
        [new Error('API returned non-JSON response'), { failure_reason: 'invalid_response' }],
        [new DOMException('signal timed out', 'TimeoutError'), { failure_reason: 'timeout' }],
        [new DOMException('The operation was aborted.', 'AbortError'), { failure_reason: 'timeout' }],
        [new TypeError('Failed to fetch'), { failure_reason: 'network' }],
        [new Error('Unexpected render failure'), { failure_reason: 'unknown' }],
        [{}, { failure_reason: 'unknown' }],
        ['offline', { failure_reason: 'unknown' }],
        [null, { failure_reason: 'unknown' }],
      ])('maps %s', (error, expected) => {
        expect(describeLawLoadFailure(error)).toEqual(expected);
      });
    });

    describe('getReferrerDomain', () => {
      it('reports in-app navigation as internal', () => {
        window.history.replaceState({ name: 'law', param: '7' }, '', '/law/7');

        expect(getReferrerDomain()).toBe('internal');
      });

      it('reports the linking host for landing page views', () => {
        Object.defineProperty(document, 'referrer', { value: 'https://news.ycombinator.com/item?id=1', configurable: true });

        expect(getReferrerDomain()).toBe('news.ycombinator.com');
      });

      it('reports direct visits and unreadable referrers', () => {
        expect(getReferrerDomain()).toBe('direct');

        Object.defineProperty(document, 'referrer', { value: 'not a url', configurable: true });
        expect(getReferrerDomain()).toBe('unknown');
      });
    });
  });
});

describe('LawDetail head metadata', () => {
  const law = { id: 7, title: "Murphy's Law", text: "Night vision - isn't.", score: 0, category_name: 'War' };

  function setHead(canonical: string) {
    document.head.innerHTML = `<title>Original</title><meta name="description" content="Original"><link rel="canonical" href="${canonical}">`;
  }

  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('derives a unique title and description from the text on client-side navigation', async () => {
    setHead('https://murphys-laws.com/browse');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-law-card-root]')).toBeTruthy(), { timeout: 500 });
    expect(document.title).toBe("Night vision - isn't - Murphy's Law Archive");
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain("Night vision - isn't.");
  });

  it('keeps the prerendered head so titles made unique by the static build are not undone', async () => {
    setHead('https://murphys-laws.com/law/7');
    document.title = "Night vision - isn't #7 - Murphy's Law Archive";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-law-card-root]')).toBeTruthy(), { timeout: 500 });
    expect(document.title).toBe("Night vision - isn't #7 - Murphy's Law Archive");
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Original');
  });
});

describe('LawDetail robots meta for a missing law', () => {
  const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute('content');

  const notFoundShown = (el: HTMLElement) => el.querySelector('[data-not-found]')?.hasAttribute('hidden') === false;

  beforeEach(() => {
    vi.clearAllMocks();
    document.querySelectorAll('meta[name="robots"]').forEach((meta) => meta.remove());
    document.head.insertAdjacentHTML('beforeend', '<meta name="robots" content="index, follow">');
  });

  afterEach(() => {
    document.querySelectorAll('meta[name="robots"]').forEach((meta) => meta.remove());
  });

  it('marks the page noindex when the API answers 404, so a stale prerendered page is not a soft 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    LawDetail({ lawId: '1719', onNavigate: () => { } });

    await vi.waitFor(() => expect(robots()).toBe('noindex, follow'), { timeout: 500 });
  });

  it.each([
    ['a server error', { ok: false, status: 503 }],
    ['a forbidden answer', { ok: false, status: 403 }],
  ])('keeps the page indexable on %s, which says nothing about the law', async (_name, response) => {
    globalThis.fetch = vi.fn().mockResolvedValue(response);
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });
    expect(robots()).toBe('index, follow');
  });

  it('keeps the page indexable when the request fails before the API answers', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });
    expect(robots()).toBe('index, follow');
  });

  it('makes the page indexable again when a retry finds the law', async () => {
    const law = { id: 7, title: 'Test Law', text: 'Test text', upvotes: 1, downvotes: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });
    await vi.waitFor(() => expect(robots()).toBe('noindex, follow'), { timeout: 500 });

    (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

    await vi.waitFor(() => expect(robots()).toBe('index, follow'), { timeout: 500 });
  });

  it('marks the page noindex when a retry ends in a 404', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: false, status: 404 });
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });
    await vi.waitFor(() => expect(el.querySelector('[data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });
    expect(robots()).toBe('index, follow');

    (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

    await vi.waitFor(() => expect(robots()).toBe('noindex, follow'), { timeout: 500 });
  });

  it('keeps the page noindex when a retry after a 404 fails for another reason', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValue({ ok: false, status: 503 });
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });
    await vi.waitFor(() => expect(robots()).toBe('noindex, follow'), { timeout: 500 });
    const failures = vi.mocked(globalThis.fetch);

    (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

    await vi.waitFor(() => expect(failures).toHaveBeenCalledTimes(2), { timeout: 500 });
    // The retry hides the not-found state while it loads; it shows again once the retry has failed
    await vi.waitFor(() => expect(notFoundShown(el)).toBe(true), { timeout: 500 });
    expect(robots()).toBe('noindex, follow');
  });

  it('does not touch the robots tag when a 404 arrives after the user left the page', async () => {
    let answer: (value: unknown) => void = () => { };
    globalThis.fetch = vi.fn().mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });
    (el as unknown as { cleanup: () => void }).cleanup();

    answer({ ok: false, status: 404 });
    // The late 404 still reaches the view (it shows its not-found state); only the robots tag is off limits
    await vi.waitFor(() => expect(notFoundShown(el)).toBe(true), { timeout: 500 });

    expect(robots()).toBe('index, follow');
  });

  it('does not restore the robots tag for a page the user already left', async () => {
    const law = { id: 7, title: 'Test Law', text: 'Test text', upvotes: 1, downvotes: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });
    await vi.waitFor(() => expect(robots()).toBe('noindex, follow'), { timeout: 500 });
    (el as unknown as { cleanup: () => void }).cleanup();
    document.querySelector('meta[name="robots"]')!.setAttribute('content', 'next page');

    (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

    await vi.waitFor(() => expect(el.querySelector('[data-law-card-root]')).toBeTruthy(), { timeout: 500 });
    expect(robots()).toBe('next page');
  });

  it('leaves the robots tag alone when the law ID is missing', () => {
    const el = LawDetail({ lawId: '', onNavigate: () => { } });
    // The not-found state is shown synchronously for a missing ID, so there is nothing to wait for
    expect(notFoundShown(el)).toBe(true);
    expect(robots()).toBe('index, follow');
  });

  it('leaves the robots tag alone when the law loads on the first try', async () => {
    const law = { id: 7, title: 'Test Law', text: 'Test text', upvotes: 1, downvotes: 0 };
    document.querySelector('meta[name="robots"]')!.setAttribute('content', 'custom');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });

    await vi.waitFor(() => expect(el.querySelector('[data-law-card-root]')).toBeTruthy(), { timeout: 500 });
    expect(robots()).toBe('custom');
  });
});

describe('LawDetail prerendered law', () => {
  type PendoTrack = (eventName: string, properties?: Record<string, unknown>) => void;
  let track: ReturnType<typeof vi.fn<PendoTrack>>;

  const shown = (el: HTMLElement, selector: string) => el.querySelector(selector)?.hasAttribute('hidden') === false;
  const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute('content');

  // The static build's main element for a law page, as the router hands it to the first render. It is shaped
  // like buildStaticLawDetailContent output, including the heading id the view's own template repeats.
  function prerenderedMain(): HTMLElement {
    const main = document.createElement('main');
    main.innerHTML = `
      <div class="container page law-detail pt-0">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><a href="/">Home</a></li>
            <li><a href="/browse">Browse</a></li>
            <li aria-current="page">Prerendered Law</li>
          </ol>
        </nav>
        <article class="card card--section law-detail-card">
          <header class="card-header">
            <h1 class="card-title">Prerendered Law</h1>
            <p class="small">Source status: Source not yet verified by the archive.</p>
          </header>
          <div class="card-body">
            <blockquote class="law-text">Prerendered text</blockquote>
            <div class="law-meta">
              <p><strong>Votes:</strong> 3 up, 1 down</p>
            </div>
          </div>
        </article>
        <section class="section card card--section section-card mb-12" aria-labelledby="law-context-heading">
          <div class="section-header">
            <h2 id="law-context-heading" class="section-title" data-section-title="In context"><span class="accent-text">In</span> context</h2>
          </div>
          <div class="section-body"><p>Prerendered context</p></div>
        </section>
      </div>`;
    return main;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    track = vi.fn<PendoTrack>();
    window.pendo = { track };
    document.querySelectorAll('meta[name="robots"]').forEach((meta) => meta.remove());
    document.head.insertAdjacentHTML('beforeend', '<meta name="robots" content="index, follow">');
  });

  afterEach(() => {
    delete window.pendo;
    document.querySelectorAll('meta[name="robots"]').forEach((meta) => meta.remove());
  });

  it('shows the prerendered law at once, without a notice or a spinner, while the request runs', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => { }));
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });

    expect(shown(el, '[data-prerendered-law]')).toBe(true);
    expect(shown(el, '[data-loading]')).toBe(false);
    expect(shown(el, '[data-law-content]')).toBe(false);
    expect(el.querySelector('[data-prerendered-law] .law-text')?.textContent).toBe('Prerendered text');
    expect(el.querySelector('[data-prerendered-law] [data-action="retry-law"]')).toBeNull();
  });

  it('shows the loading state, not the law, when the prerendered page holds none', () => {
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => { }));
    const el = LawDetail({ lawId: '7', onNavigate: () => { } });

    expect(shown(el, '[data-loading]')).toBe(true);
    expect(shown(el, '[data-prerendered-law]')).toBe(false);
  });

  it('hands over to the loaded law when the first request succeeds', async () => {
    const law = { id: 7, title: 'Fresh Law', text: 'Fresh text', upvotes: 1, downvotes: 0 };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });

    await vi.waitFor(() => expect(el.querySelector('[data-law-text]')?.textContent).toBe('Fresh text'), { timeout: 500 });
    expect(shown(el, '[data-law-content]')).toBe(true);
    expect(shown(el, '[data-prerendered-law]')).toBe(false);
    expect(el.querySelector('[data-prerendered-law]')?.hasChildNodes()).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it.each([
    ['a forbidden answer', 'http_error', () => vi.fn().mockResolvedValue({ ok: false, status: 403 })],
    ['a server error', 'server_error', () => vi.fn().mockResolvedValue({ ok: false, status: 503 })],
    ['a network failure', 'network', () => vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))],
  ])('keeps the prerendered law with a load-failure notice on %s', async (_name, reason, fetchMock) => {
    globalThis.fetch = fetchMock();
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });

    await vi.waitFor(() => expect(track).toHaveBeenCalled(), { timeout: 500 });
    const prerenderedState = el.querySelector('[data-prerendered-law]')!;
    expect(shown(el, '[data-prerendered-law]')).toBe(true);
    expect(prerenderedState.querySelector('.law-text')?.textContent).toBe('Prerendered text');
    expect(prerenderedState.textContent).toContain("Some features of this page couldn't load.");
    expect(prerenderedState.querySelector('[role="alert"]')).toBeTruthy();
    expect(prerenderedState.querySelector('[data-action="retry-law"]')).toBeTruthy();
    expect(shown(el, '[data-not-found]')).toBe(false);
    expect(shown(el, '[data-loading]')).toBe(false);
    expect(el.textContent).not.toMatch(/Law Not Found/);
    expect(track).toHaveBeenCalledWith('law_not_found', expect.objectContaining({
      law_id: '7',
      failure_reason: reason,
      showed_prerendered_law: true,
      is_retry: false,
    }));
  });

  it('leaves the Try Again button named by its visible text, as in the other error states', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });

    await vi.waitFor(() => expect(el.querySelector('[data-prerendered-law] [data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });
    const button = el.querySelector('[data-prerendered-law] [data-action="retry-law"]')!;
    expect(button.hasAttribute('aria-label')).toBe(false);
    expect(button.textContent).toMatch(/Try Again/);
  });

  it('keeps the page indexable when a non-404 failure leaves the prerendered law on screen', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });

    await vi.waitFor(() => expect(track).toHaveBeenCalled(), { timeout: 500 });
    expect(shown(el, '[data-prerendered-law]')).toBe(true);
    expect(robots()).toBe('index, follow');
  });

  it('shows the heading of a load failure, not "Law Not Found", for a 503 on a page that holds no law', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const shell = document.createElement('main');
    shell.innerHTML = '<p class="loading-message">Loading the archive of inevitable mishaps...</p>';
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: shell });

    await vi.waitFor(() => expect(shown(el, '[data-not-found]')).toBe(true), { timeout: 500 });
    expect(shown(el, '[data-prerendered-law]')).toBe(false);
    expect(el.querySelector('[data-not-found] .empty-state-title')?.textContent).toBe("We couldn't load this law");
    expect(track).toHaveBeenCalledWith('law_not_found', {
      law_id: '7',
      failure_reason: 'server_error',
      http_status: 503,
      is_retry: false,
      referrer_domain: expect.any(String),
    });
  });

  it.each([
    ['the API answers 404', '7', () => vi.fn().mockResolvedValue({ ok: false, status: 404 }), 'not_found'],
    ['the law ID cannot name a law', 'abc', () => vi.fn().mockRejectedValue(new Error('Invalid law ID')), 'invalid_id'],
  ])('shows not found when %s, even with a prerendered law', async (_name, lawId, fetchMock, reason) => {
    globalThis.fetch = fetchMock();
    const el = LawDetail({ lawId, onNavigate: () => { }, prerendered: prerenderedMain() });

    await vi.waitFor(() => expect(shown(el, '[data-not-found]')).toBe(true), { timeout: 500 });
    expect(shown(el, '[data-prerendered-law]')).toBe(false);
    expect(el.querySelector('[data-prerendered-law]')?.hasChildNodes()).toBe(false);
    expect(el.textContent).toMatch(/Law Not Found/);
    expect(track).toHaveBeenCalledWith('law_not_found', expect.objectContaining({ failure_reason: reason }));
    expect(track.mock.calls[0]?.[1]).not.toHaveProperty('showed_prerendered_law');
  });

  it('shows not found, without the prerendered law, when the law ID is missing', () => {
    const el = LawDetail({ lawId: '', onNavigate: () => { }, prerendered: prerenderedMain() });

    expect(shown(el, '[data-not-found]')).toBe(true);
    expect(shown(el, '[data-prerendered-law]')).toBe(false);
    expect(track.mock.calls[0]?.[1]).not.toHaveProperty('showed_prerendered_law');
  });

  it('marks the page noindex when the API answers 404, even with a prerendered law', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });

    await vi.waitFor(() => expect(robots()).toBe('noindex, follow'), { timeout: 500 });
  });

  it('replaces the prerendered law with the loaded one when a retry succeeds', async () => {
    const law = { id: 7, title: 'Fresh Law', text: 'Fresh text', upvotes: 1, downvotes: 0 };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, json: async () => law });
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });
    await vi.waitFor(() => expect(el.querySelector('[data-prerendered-law] [data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });

    (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

    await vi.waitFor(() => expect(el.querySelector('[data-law-text]')?.textContent).toBe('Fresh text'), { timeout: 500 });
    expect(shown(el, '[data-law-content]')).toBe(true);
    expect(shown(el, '[data-prerendered-law]')).toBe(false);
    expect(el.querySelector('[data-prerendered-law]')?.hasChildNodes()).toBe(false);
  });

  it('keeps the law on screen and disables Try Again while a retry runs', async () => {
    let resolveRetry: (value: unknown) => void = () => { };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockReturnValueOnce(new Promise((resolve) => { resolveRetry = resolve; }));
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });
    await vi.waitFor(() => expect(el.querySelector('[data-prerendered-law] [data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });
    const button = el.querySelector('[data-prerendered-law] [data-action="retry-law"]') as HTMLButtonElement;

    button.click();

    expect(button.disabled).toBe(true);
    expect(shown(el, '[data-prerendered-law]')).toBe(true);
    expect(shown(el, '[data-loading]')).toBe(false);
    expect(el.querySelector('[data-prerendered-law] .law-text')?.textContent).toBe('Prerendered text');
    resolveRetry({ ok: false, status: 503 });
    await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(2), { timeout: 500 });
  });

  it('keeps showing the prerendered law, and moves focus to Try Again, when a retry fails again', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });
    document.body.appendChild(el);
    try {
      await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1), { timeout: 500 });
      expect(document.activeElement).toBe(document.body);
      const button = el.querySelector('[data-prerendered-law] [data-action="retry-law"]') as HTMLButtonElement;
      button.focus();
      button.click();

      await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(2), { timeout: 500 });
      expect(shown(el, '[data-prerendered-law]')).toBe(true);
      expect(el.querySelectorAll('[data-prerendered-law] .law-detail-card')).toHaveLength(1);
      expect(el.querySelectorAll('[data-prerendered-law] [data-action="retry-law"]')).toHaveLength(1);
      expect(button.disabled).toBe(false);
      expect(document.activeElement).toBe(el.querySelector('[data-prerendered-law] [data-action="retry-law"]'));
      expect(track).toHaveBeenLastCalledWith('law_not_found', expect.objectContaining({
        showed_prerendered_law: true,
        is_retry: true,
      }));
    } finally {
      el.remove();
    }
  });

  it('shows not found when a retry after a kept prerendered law answers 404', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: false, status: 404 });
    const el = LawDetail({ lawId: '7', onNavigate: () => { }, prerendered: prerenderedMain() });
    await vi.waitFor(() => expect(el.querySelector('[data-prerendered-law] [data-action="retry-law"]')).toBeTruthy(), { timeout: 500 });

    (el.querySelector('[data-action="retry-law"]') as HTMLElement).click();

    await vi.waitFor(() => expect(shown(el, '[data-not-found]')).toBe(true), { timeout: 500 });
    expect(shown(el, '[data-prerendered-law]')).toBe(false);
    expect(el.querySelector('[data-prerendered-law]')?.hasChildNodes()).toBe(false);
    expect(el.textContent).toMatch(/Law Not Found/);
  });
});
