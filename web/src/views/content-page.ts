import { getPageContent, getRawMarkdownContent, type ContentPage } from '@utils/markdown-content.ts';
import { SITE_NAME } from '@utils/constants.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

interface ContentPageViewProps {
  page: ContentPage;
  title: string;
  description: string;
  onNavigate?: OnNavigate;
}

export function ContentPageView({ page, title, description, onNavigate }: ContentPageViewProps): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page content-page';

  document.title = `${title} | ${SITE_NAME}`;
  updateMetaDescription(description);
  el.innerHTML = getPageContent(page);
  triggerAdSense(el);

  setExportContent({
    type: ContentType.CONTENT,
    title,
    data: getRawMarkdownContent(page)
  });

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const navBtn = target.closest('[data-nav]');
    if (!navBtn || !onNavigate) return;
    const navTarget = navBtn.getAttribute('data-nav');
    if (!navTarget) return;
    e.preventDefault();
    onNavigate(navTarget);
  });

  (el as CleanableElement).cleanup = () => { clearExportContent(); };

  return el;
}
