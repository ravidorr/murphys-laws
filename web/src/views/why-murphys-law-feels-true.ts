// Article view: Why the Universe Hates Your Toast (psychology / cognitive bias)

import { getPageContent, getRawMarkdownContent } from '@utils/markdown-content.ts';
import { setJsonLd } from '@modules/structured-data.ts';
import { SITE_URL, SITE_NAME } from '@utils/constants.ts';
import { triggerAdSense } from '../utils/ads.ts';
import { setExportContent, clearExportContent, ContentType } from '../utils/export-context.ts';
import { updateMetaDescription } from '@utils/dom.ts';
import type { CleanableElement, OnNavigate } from '../types/app.d.ts';

const PAGE_TITLE = "Why the Universe Hates Your Toast (And Other Lies We Tell Ourselves)";
const META_DESCRIPTION = "Why Murphy's Law feels true: negativity bias, the availability heuristic, and confirmation bias. Design for the inevitable instead of taking the universe's pranks personally.";

export function WhyMurphysLawFeelsTrue({ onNavigate }: { onNavigate?: OnNavigate } = {}): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page content-page';

  document.title = `${PAGE_TITLE} | ${SITE_NAME}`;
  updateMetaDescription(META_DESCRIPTION);

  el.innerHTML = getPageContent('why-murphys-law-feels-true');
  triggerAdSense(el);

  setExportContent({
    type: ContentType.CONTENT,
    title: PAGE_TITLE,
    data: getRawMarkdownContent('why-murphys-law-feels-true')
  });

  setJsonLd('why-murphys-law-feels-true-article', {
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': PAGE_TITLE,
    'description': META_DESCRIPTION,
    'image': `${SITE_URL}/social/home.png`,
    'datePublished': '2026-02-22T00:00:00Z',
    'dateModified': new Date().toISOString(),
    'author': { '@type': 'Person', 'name': 'Raanan Avidor' },
    'publisher': {
      '@type': 'Organization',
      'name': "Murphy's Law Archive",
      'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/favicon-512x512.png` }
    },
    'mainEntityOfPage': { '@type': 'WebPage', '@id': `${SITE_URL}/why-murphys-law-feels-true` }
  });

  el.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const navBtn = target.closest('[data-nav]');
    if (navBtn && onNavigate) {
      e.preventDefault();
      const navTarget = navBtn.getAttribute('data-nav');
      if (navTarget) onNavigate(navTarget);
    }
  });

  (el as CleanableElement).cleanup = () => {
    clearExportContent();
  };

  return el;
}
