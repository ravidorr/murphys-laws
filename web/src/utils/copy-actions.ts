// Shared copy action event handlers
// Eliminates ~20 lines of duplicate copy-text/copy-link handling across 3 views

import { copyToClipboard } from './clipboard.ts';
import { recordQualifyingUserAction } from '../components/install-prompt.ts';
import { trackPendoEvent, getPagePath } from './pendo.ts';

// Report a completed copy from a law card's Share popover
function trackLawCopied(button: Element, shareMethod: 'copy_text' | 'copy_link'): void {
  trackPendoEvent('law_shared', {
    law_id: button.getAttribute('data-law-id'),
    share_method: shareMethod,
    surface: 'law_card',
    page_path: getPagePath(),
  });
}

/**
 * Handles copy-text and copy-link button clicks via event delegation.
 * Returns true if the event was handled (a copy action occurred).
 */
export async function handleCopyAction(e: Event, target: Element): Promise<boolean> {
  const copyTextBtn = target.closest('[data-action="copy-text"]');
  if (copyTextBtn) {
    e.stopPropagation();
    recordQualifyingUserAction();
    const textToCopy = copyTextBtn.getAttribute('data-copy-value') || '';
    if (textToCopy) {
      await copyToClipboard(textToCopy, 'Law text copied to clipboard!');
      trackLawCopied(copyTextBtn, 'copy_text');
    }
    return true;
  }

  const copyLinkBtn = target.closest('[data-action="copy-link"]');
  if (copyLinkBtn) {
    e.stopPropagation();
    recordQualifyingUserAction();
    const linkToCopy = copyLinkBtn.getAttribute('data-copy-value') || '';
    if (linkToCopy) {
      await copyToClipboard(linkToCopy, 'Link copied to clipboard!');
      trackLawCopied(copyLinkBtn, 'copy_link');
    }
    return true;
  }

  return false;
}

/**
 * Adds copy action listeners to a container element.
 */
export function addCopyActionListeners(el: HTMLElement): void {
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    await handleCopyAction(e, t);
  });
}
