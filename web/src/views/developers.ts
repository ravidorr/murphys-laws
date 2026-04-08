import { getPageContent, getRawMarkdownContent } from '@utils/markdown-content.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { SITE_NAME } from '@utils/constants.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

export function Developers({ onNavigate }: { onNavigate: OnNavigate }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page content-page';

  document.title = `Developers | ${SITE_NAME}`;
  updateMetaDescription("REST API, MCP server, and developer tools for Murphy's Laws. Integrate 1,500+ laws into your apps and AI agents.");

  el.innerHTML = getPageContent('developers');
  triggerAdSense(el);

  setExportContent({
    type: ContentType.CONTENT,
    title: 'Developers — Murphy\'s Law Archive',
    data: getRawMarkdownContent('developers')
  });

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const navBtn = target.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) onNavigate(navTarget);
    }
  });

  (el as CleanableElement).cleanup = () => { clearExportContent(); };

  return el;
}
