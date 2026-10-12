import { getPageContent, getRawMarkdownContent, type ContentPage } from '@utils/markdown-content.ts';
import { SITE_NAME } from '@utils/constants.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import { handleNavClick, addNavigationListener } from '../utils/navigation.ts';
import { addArticleArchiveBlock } from '@components/article-featured-laws.ts';
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
  addArticleArchiveBlock(el, page, onNavigate);
  triggerAdSense(el);

  setExportContent({
    type: ContentType.CONTENT,
    title,
    data: getRawMarkdownContent(page)
  });

  // Shared utility keeps data-param for law and category links
  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !onNavigate) return;
    if (handleNavClick(target, onNavigate)) e.preventDefault();
  });
  if (onNavigate) addNavigationListener(el, onNavigate);

  (el as CleanableElement).cleanup = () => { clearExportContent(); };

  return el;
}
