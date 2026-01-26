import { getPageContent, getRawMarkdownContent } from '@utils/markdown-content.js';
import { SITE_NAME } from '@utils/constants.js';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.js';

export function Contact({ onNavigate }) {
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
  el.cleanup = () => {
    clearExportContent();
  };

  return el;
}
