// Shared copy action event handlers
// Eliminates ~20 lines of duplicate copy-text/copy-link handling across 3 views

import { copyToClipboard } from './clipboard.ts';

/**
 * Handles copy-text and copy-link button clicks via event delegation.
 * Returns true if the event was handled (a copy action occurred).
 */
export async function handleCopyAction(e: Event, target: Element): Promise<boolean> {
  // Handle copy text action
  const copyTextBtn = target.closest('[data-action="copy-text"]');
  if (copyTextBtn) {
    e.stopPropagation();
    const textToCopy = copyTextBtn.getAttribute('data-copy-value') || '';
    if (textToCopy) {
      await copyToClipboard(textToCopy, 'Law text copied to clipboard!');
    }
    return true;
  }

  // Handle copy link action
  const copyLinkBtn = target.closest('[data-action="copy-link"]');
  if (copyLinkBtn) {
    e.stopPropagation();
    const linkToCopy = copyLinkBtn.getAttribute('data-copy-value') || '';
    if (linkToCopy) {
      await copyToClipboard(linkToCopy, 'Link copied to clipboard!');
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
    /* v8 ignore next - Click handler only fires on Element targets */
    if (!(t instanceof Element)) return;
    await handleCopyAction(e, t);
  });
}
