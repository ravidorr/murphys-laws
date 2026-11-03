import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const copyToClipboard = vi.fn().mockResolvedValue(undefined);
const recordQualifyingUserAction = vi.fn();
const trackPendoEvent = vi.fn();

vi.mock('../src/utils/clipboard.ts', () => ({ copyToClipboard }));
vi.mock('../src/components/install-prompt.ts', () => ({ recordQualifyingUserAction }));
vi.mock('../src/utils/pendo.ts', () => ({ trackPendoEvent, getPagePath: () => '/law/5' }));

const { canNativeShare, buildEmbedSnippet, handleShareAction, initShareActions } = await import('../src/utils/share-actions.ts');

function button(attributes: Record<string, string>): HTMLButtonElement {
  const el = document.createElement('button');
  Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
  document.body.appendChild(el);
  return el;
}

describe('share actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (navigator as { share?: unknown }).share;
  });

  it('detects the system share sheet', () => {
    expect(canNativeShare()).toBe(false);
    Object.assign(navigator, { share: vi.fn() });
    expect(canNativeShare()).toBe(true);
  });

  it('builds a responsive iframe snippet for a law', () => {
    expect(buildEmbedSnippet(5, 'x'.repeat(200))).toContain('height="300"');
    expect(buildEmbedSnippet(5)).toBe(
      `<iframe src="https://murphys-laws.com/embed/law/5" title="Murphy's Law" width="100%" height="220" frameborder="0" loading="lazy"></iframe>`
    );
  });

  it('copies the embed code and reports it', async () => {
    const btn = button({ 'data-action': 'copy-embed', 'data-copy-value': '<iframe></iframe>', 'data-law-id': '5', 'data-surface': 'law_detail' });
    const event = new Event('click');
    const stop = vi.spyOn(event, 'stopPropagation');

    expect(await handleShareAction(event, btn)).toBe(true);

    expect(stop).toHaveBeenCalled();
    expect(recordQualifyingUserAction).toHaveBeenCalled();
    expect(copyToClipboard).toHaveBeenCalledWith('<iframe></iframe>', 'Embed code copied to clipboard!');
    expect(trackPendoEvent).toHaveBeenCalledWith('law_shared', {
      law_id: '5', share_method: 'copy_embed', surface: 'law_detail', page_path: '/law/5'
    });
  });

  it('does nothing when the embed button has no code', async () => {
    const btn = button({ 'data-action': 'copy-embed' });
    expect(await handleShareAction(new Event('click'), btn)).toBe(true);
    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(trackPendoEvent).not.toHaveBeenCalled();
  });

  it('opens the system share sheet with the law and reports it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    const btn = button({
      'data-action': 'native-share', 'data-share-url': 'https://murphys-laws.com/law/5',
      'data-share-title': 'Title', 'data-share-text': 'Text', 'data-law-id': '5'
    });

    expect(await handleShareAction(new Event('click'), btn)).toBe(true);

    expect(share).toHaveBeenCalledWith({ title: 'Title', text: 'Text', url: 'https://murphys-laws.com/law/5' });
    expect(trackPendoEvent).toHaveBeenCalledWith('law_shared', expect.objectContaining({
      share_method: 'native_share', surface: 'law_card'
    }));
  });

  it('passes undefined for missing share fields', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    await handleShareAction(new Event('click'), button({ 'data-action': 'native-share' }));
    expect(share).toHaveBeenCalledWith({ title: undefined, text: undefined, url: undefined });
  });

  it('copies the link when the share sheet fails to open, and reports the copy', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')) });
    const btn = button({ 'data-action': 'native-share', 'data-share-url': 'https://murphys-laws.com/law/5', 'data-law-id': '5' });

    expect(await handleShareAction(new Event('click'), btn)).toBe(true);

    expect(copyToClipboard).toHaveBeenCalledWith('https://murphys-laws.com/law/5', 'Link copied to clipboard!');
    expect(trackPendoEvent).toHaveBeenCalledWith('law_shared', expect.objectContaining({ share_method: 'copy_link' }));
  });

  it('has nothing to copy when the share fails and the button has no url', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new TypeError('bad url')) });
    expect(await handleShareAction(new Event('click'), button({ 'data-action': 'native-share' }))).toBe(true);
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it('does not report a share the person cancelled', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) });
    const btn = button({ 'data-action': 'native-share', 'data-share-url': 'https://murphys-laws.com/law/5' });

    expect(await handleShareAction(new Event('click'), btn)).toBe(true);
    expect(trackPendoEvent).not.toHaveBeenCalled();
  });

  it('ignores other clicks', async () => {
    const btn = button({ 'data-action': 'copy-link' });
    expect(await handleShareAction(new Event('click'), btn)).toBe(false);
  });

  it('listens at the document level and ignores clicks that are not on elements', async () => {
    initShareActions();
    const btn = button({ 'data-action': 'copy-embed', 'data-copy-value': 'snippet' });

    btn.click();
    await vi.waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith('snippet', 'Embed code copied to clipboard!'));

    copyToClipboard.mockClear();
    document.dispatchEvent(new Event('click'));
    expect(copyToClipboard).not.toHaveBeenCalled();
  });
});
