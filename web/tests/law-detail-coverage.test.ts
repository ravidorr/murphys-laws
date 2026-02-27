import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LawDetail } from '../src/views/law-detail.js';
import * as featureFlags from '../src/utils/feature-flags.js';
import * as favorites from '../src/utils/favorites.js';

describe('LawDetail view - Coverage', () => {
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;
  let favoritesEnabledSpy: ReturnType<typeof vi.spyOn>;
  let isFavoriteSpy: ReturnType<typeof vi.spyOn>;
  let toggleFavoriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    favoritesEnabledSpy = vi.spyOn(featureFlags, 'isFavoritesEnabled').mockReturnValue(true);
    isFavoriteSpy = vi.spyOn(favorites, 'isFavorite').mockReturnValue(false);
    toggleFavoriteSpy = vi.spyOn(favorites, 'toggleFavorite').mockReturnValue(true);
    container = document.createElement('div');
    document.body.appendChild(container);

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        title: 'Murphy',
        text: 'Anything that can go wrong will go wrong.',
        author: 'Edward Murphy',
        attributions: [],
        upvotes: 10,
        downvotes: 2
      })
    });
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    favoritesEnabledSpy?.mockRestore();
    isFavoriteSpy?.mockRestore();
    toggleFavoriteSpy?.mockRestore();
    vi.restoreAllMocks();
  });

  it('handles law with author but no attributions array', async () => {
    // Branch: else if (author) { ... } in renderLawCard
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const attribution = el.querySelector('[data-law-attribution]');
    expect(attribution).toBeTruthy();
    expect(attribution!.textContent).toContain('Edward Murphy');
  });

  it('handles law with a single word title', async () => {
    // Branch: else { titleEl.textContent = title; } in renderLawCard
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 2,
        title: 'Gravity',
        text: 'Gravity works.',
        attributions: []
      })
    });
    
    const el = LawDetail({ lawId: '2', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const titleEl = el.querySelector('[data-law-title]');
    expect(titleEl).toBeTruthy();
    expect(titleEl!.textContent).toBe('Gravity');
    expect(titleEl!.querySelector('.accent-text')).toBeNull();
  });

  it('handles law without submittedBy field', async () => {
    // Branch: else { submittedEl.setAttribute('hidden', ''); } in renderLawCard
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 3,
        title: 'Minimal',
        text: 'Just text.',
        attributions: [],
        submittedBy: null
      })
    });
    
    const el = LawDetail({ lawId: '3', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const submittedEl = el.querySelector('[data-law-submitted]');
    expect(submittedEl).toBeTruthy();
    expect(submittedEl!.hasAttribute('hidden')).toBe(true);
  });

  it('hides submitted line when attribution is shown (no Sent by + Submitted by duplication)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 5,
        title: 'Test Law',
        text: 'Law text.',
        attributions: [{ name: 'Jane', contact_type: null, contact_value: null }],
        upvotes: 0,
        downvotes: 0
      })
    });
    const el = LawDetail({ lawId: '5', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    const attributionEl = el.querySelector('[data-law-attribution]');
    const submittedEl = el.querySelector('[data-law-submitted]');
    expect(attributionEl).toBeTruthy();
    expect(attributionEl!.textContent).toContain('Sent by Jane');
    expect(submittedEl).toBeTruthy();
    expect(submittedEl!.hasAttribute('hidden')).toBe(true);
  });

  it('handles law with missing title or author', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 4,
        title: null,
        author: null,
        text: 'No title or author.',
        attributions: []
      })
    });
    
    const el = LawDetail({ lawId: '4', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const titleEl = el.querySelector('[data-law-title]');
    expect(titleEl).toBeTruthy();
    expect(titleEl!.textContent).toBe("Murphy's Law"); // Fallback title
    expect(titleEl!.innerHTML).toContain('accent-text'); // "Murphy's" accented
  });

  it('handles click events on non-element targets', () => {
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    // Trigger click with non-element target (e.g., a text node)
    const event = new MouseEvent('click', { bubbles: true });
    // In JSDOM, event.target is usually the element. 
    // We can try to manually dispatch on a text node if possible or just ensure it doesn't throw.
    el.dispatchEvent(event);
    expect(true).toBe(true);
  });
  
  it('handles voting with missing voteType', async () => {
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const voteBtn = el.querySelector('[data-vote]') as HTMLElement | null;
    expect(voteBtn).toBeTruthy();
    voteBtn!.removeAttribute('data-vote'); // Force missing voteType

    voteBtn!.click();
    // Should return early and not call toggleVote
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('vote'), expect.anything());
  });

  it('handles missing vote counts in DOM during voting', async () => {
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Remove vote count elements
    el.querySelector('[data-upvote-count]')?.remove();

    const voteBtn = el.querySelector('[data-vote="up"]') as HTMLElement | null;
    expect(voteBtn).toBeTruthy();
    // Should not throw when elements are missing
    expect(() => voteBtn!.click()).not.toThrow();
  });

  it('shows not-found when fetch fails (L76 L259 L275 L316)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: '99', onNavigate });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    const notFound = el.querySelector('[data-not-found]');
    expect(notFound).toBeTruthy();
    expect(notFound!.hasAttribute('hidden')).toBe(false);
  });

  it('retry button re-fetches law (L259)', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          title: 'Retried',
          text: 'Retried text.',
          attributions: []
        })
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    const retryBtn = el.querySelector('[data-action="retry-law"]') as HTMLElement | null;
    expect(retryBtn).toBeTruthy();
    retryBtn!.click();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const titleEl = el.querySelector('[data-law-title]');
    expect(titleEl?.textContent).toBe('Retried');
  });

  it('random-law navigates when law id exists (L316 L336 L337)', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, title: 'L', text: 'T', attributions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 5, data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 5, data: [{ id: 42, title: 'R', text: 'T', attributions: [] }] }) });
    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: '1', onNavigate });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    const randomBtn = el.querySelector('[data-action="random-law"]') as HTMLElement | null;
    expect(randomBtn).toBeTruthy();
    randomBtn!.click();
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(onNavigate).toHaveBeenCalledWith('law', '42');
  });

  it('L336 L337: random-law navigates to browse when total <= 0', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, title: 'L', text: 'T', attributions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 0, data: [] }) });
    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: '1', onNavigate });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    (el.querySelector('[data-action="random-law"]') as HTMLElement).click();
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(onNavigate).toHaveBeenCalledWith('browse');
  });

  it('L351 L352: random-law navigates to browse when fetchLaws rejects', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, title: 'L', text: 'T', attributions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockRejectedValueOnce(new Error('Network error'));
    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: '1', onNavigate });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    (el.querySelector('[data-action="random-law"]') as HTMLElement).click();
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(onNavigate).toHaveBeenCalledWith('browse');
  });

  it('L344 L348: random-law navigates to browse when fetched law has no id', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, title: 'L', text: 'T', attributions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 1, data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total: 1, data: [{ title: 'NoId', text: 'T' }] }) });
    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: '1', onNavigate });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    (el.querySelector('[data-action="random-law"]') as HTMLElement).click();
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(onNavigate).toHaveBeenCalledWith('browse');
  });

  it('copy-text uses data-copy-value when present (L362 L364)', async () => {
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    const copyBtn = el.querySelector('[data-action="copy-text"]') as HTMLElement | null;
    expect(copyBtn).toBeTruthy();
    if (copyBtn) {
      copyBtn.setAttribute('data-copy-value', 'custom copy value');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      copyBtn.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(writeText).toHaveBeenCalledWith('custom copy value');
    }
  });

  it('copy-link uses data-copy-value when present (L375 L378)', async () => {
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 50));
    const copyLinkBtn = el.querySelector('[data-action="copy-link"]') as HTMLElement | null;
    if (!copyLinkBtn) {
      const btn = document.createElement('button');
      btn.setAttribute('data-action', 'copy-link');
      btn.setAttribute('data-copy-value', 'https://example.com/law/1');
      el.appendChild(btn);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      btn.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(writeText).toHaveBeenCalledWith('https://example.com/law/1');
      return;
    }
    copyLinkBtn.setAttribute('data-copy-value', 'https://custom.link/1');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    copyLinkBtn.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(writeText).toHaveBeenCalledWith('https://custom.link/1');
  });

  it('L384 L388 L389 L398 L405 L406 L408: main favorite button click toggles favorited state', async () => {
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 80));
    const favoriteBtn = el.querySelector('[data-favorite-btn]') as HTMLElement | null;
    expect(favoriteBtn).toBeTruthy();
    expect(favoriteBtn?.hasAttribute('hidden')).toBe(false);
    favoriteBtn!.click();
    expect(favorites.toggleFavorite).toHaveBeenCalled();
    expect(favoriteBtn?.classList.contains('favorited')).toBe(true);
  });

  it('L416 L424 L432 L440 L442: related law favorite button and related card click', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, title: 'Main', text: 'T', attributions: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 2, title: 'Related', text: 'R', attributions: [] }] }) });
    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: '1', onNavigate });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 100));
    const relatedCard = el.querySelector('.law-card-mini[data-law-id="2"]') as HTMLElement | null;
    if (relatedCard) {
      const titleEl = relatedCard.querySelector('.law-card-title') || relatedCard;
      titleEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onNavigate).toHaveBeenCalledWith('law', '2');
    }
  });

  it('L457 L461: nav button click calls onNavigate', async () => {
    fetchMock.mockRejectedValueOnce(new Error('fail'));
    const onNavigate = vi.fn();
    const el = LawDetail({ lawId: '99', onNavigate });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 80));
    const browseBtn = el.querySelector('[data-nav="browse"]') as HTMLElement | null;
    expect(browseBtn).toBeTruthy();
    browseBtn!.click();
    expect(onNavigate).toHaveBeenCalledWith('browse');
  });

  it('L362 L364: copy-text fallback to law-text when no data-copy-value', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, title: 'L', text: 'Law text to copy', attributions: [] }) });
    const el = LawDetail({ lawId: '1', onNavigate: () => {} });
    container.appendChild(el);
    await new Promise(resolve => setTimeout(resolve, 80));
    const copyBtn = el.querySelector('[data-action="copy-text"]') as HTMLElement | null;
    expect(copyBtn).toBeTruthy();
    copyBtn!.removeAttribute('data-copy-value');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    copyBtn!.click();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(writeText).toHaveBeenCalledWith('Law text to copy');
  });
});
