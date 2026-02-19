import { getPageContent, getRawMarkdownContent } from '@utils/markdown-content.ts';
import { SITE_NAME } from '@utils/constants.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

export function Contact({ onNavigate }: { onNavigate: OnNavigate }) {
  const el = document.createElement('div');
  el.className = 'container page content-page';
  el.setAttribute('role', 'main');

  // Set page title
  document.title = `Contact | ${SITE_NAME}`;

  el.innerHTML = getPageContent('contact');

  // Register export content
  setExportContent({
    type: ContentType.CONTENT,
    title: 'Contact Us',
    data: getRawMarkdownContent('contact')
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
