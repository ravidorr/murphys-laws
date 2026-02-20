import { getPageContent, getRawMarkdownContent } from '@utils/markdown-content.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { SITE_NAME } from '@utils/constants.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

export function About({ onNavigate }: { onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page content-page';

  // Set page title and meta description
  document.title = `About | ${SITE_NAME}`;
  updateMetaDescription("Learn about Murphy's Law Archive - preserving and celebrating Murphy's Laws, corollaries, and observations about inevitable mishaps since the late 1990s.");

  el.innerHTML = getPageContent('about');
  // Only trigger ads if content meets minimum requirements
  triggerAdSense(el);

  // Register export content
  setExportContent({
    type: ContentType.CONTENT,
    title: 'About Murphy\'s Law Archive',
    data: getRawMarkdownContent('about')
  });

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) {
        onNavigate(navTarget);
      }
    }
  });

  // Cleanup function to clear export content on unmount
  (el as CleanableElement).cleanup =() => {
    clearExportContent();
  };

  return el;
}
