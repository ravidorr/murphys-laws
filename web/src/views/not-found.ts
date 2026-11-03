import { fetchTopVoted } from '@utils/api.ts';
import { renderNotFoundContent, renderNotFoundLaws, NOT_FOUND_LAW_COUNT } from '@utils/not-found-content.ts';
import { pickNotFoundLine } from '@utils/not-found-lines.ts';

export function NotFound(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'container page pt-0';
  el.innerHTML = renderNotFoundContent({ line: pickNotFoundLine() });

  // Law suggestions are a bonus. If the API is down the section stays hidden.
  void fetchTopVoted(NOT_FOUND_LAW_COUNT)
    .then(({ data }) => {
      const lawsHtml = renderNotFoundLaws(data);
      if (!lawsHtml) return;
      el.querySelector('[data-not-found-laws]')!.innerHTML = lawsHtml;
      el.querySelector('.not-found-laws-section')!.removeAttribute('hidden');
    })
    .catch(() => undefined);

  return el;
}
