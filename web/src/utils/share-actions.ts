// Share menu actions that are handled once at the document level: the system share sheet and the
// embed code. Per-view handlers cover copy link and copy text; these two work on any law card.

import { copyToClipboard } from './clipboard.ts';
import { recordQualifyingUserAction } from '../components/install-prompt.ts';
import { trackPendoEvent, getPagePath } from './pendo.ts';
import { buildEmbedIframe } from '@shared/modules/law-embed.ts';

/** True when the browser can open the system share sheet (most phones, some desktops). */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** The iframe snippet a person pastes into their own page to show one law. */
export function buildEmbedSnippet(lawId: number | string, lawText?: string): string {
  return buildEmbedIframe({ target: lawId, text: lawText });
}

function trackShare(button: Element, shareMethod: 'copy_embed' | 'native_share' | 'copy_link'): void {
  trackPendoEvent('law_shared', {
    law_id: button.getAttribute('data-law-id'),
    share_method: shareMethod,
    surface: button.getAttribute('data-surface') || 'law_card',
    page_path: getPagePath(),
  });
}

/**
 * Handle the embed-code and system-share buttons of a law's Share popover.
 * Returns true when the click belonged to one of them.
 */
export async function handleShareAction(e: Event, target: Element): Promise<boolean> {
  const embedBtn = target.closest('[data-action="copy-embed"]');
  if (embedBtn) {
    e.stopPropagation();
    recordQualifyingUserAction();
    const snippet = embedBtn.getAttribute('data-copy-value') || '';
    if (snippet) {
      await copyToClipboard(snippet, 'Embed code copied to clipboard!');
      trackShare(embedBtn, 'copy_embed');
    }
    return true;
  }

  const nativeBtn = target.closest('[data-action="native-share"]');
  if (nativeBtn) {
    e.stopPropagation();
    recordQualifyingUserAction();
    try {
      await navigator.share({
        title: nativeBtn.getAttribute('data-share-title') || undefined,
        text: nativeBtn.getAttribute('data-share-text') || undefined,
        url: nativeBtn.getAttribute('data-share-url') || undefined,
      });
      trackShare(nativeBtn, 'native_share');
    } catch (error) {
      // Closing the share sheet rejects with AbortError: nothing was shared and nothing failed.
      // Any other rejection means the sheet could not open, so copy the link instead of doing nothing.
      const url = nativeBtn.getAttribute('data-share-url');
      if (!(error instanceof DOMException && error.name === 'AbortError') && url) {
        await copyToClipboard(url, 'Link copied to clipboard!');
        trackShare(nativeBtn, 'copy_link');
      }
    }
    return true;
  }

  return false;
}

/** Listen once for share actions anywhere in the document. */
export function initShareActions(): void {
  document.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    await handleShareAction(e, target);
  });
}
