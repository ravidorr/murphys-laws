// Photos shown at the top of article pages. They live in the web app (not the shared markdown) because
// the mobile apps render the same markdown and cannot resolve web paths.

interface ContentFigure {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

const CONTENT_FIGURES: Record<string, ContentFigure> = {
  'origin-story': {
    src: '/img/sledtrk.jpg',
    width: 604,
    height: 483,
    alt: 'Black-and-white photo of a helmeted test subject seated on a rocket sled while crew members in hats and jackets gather around it.',
    caption: "Rocket sled test preparations, the kind of Air Force experiment where Murphy's Law was born."
  }
};

const CARD_BODY_OPEN = '<div class="card-body">';

/** Render the figure markup for a page, or an empty string when the page has none */
export function renderContentFigure(page: string): string {
  const figure = CONTENT_FIGURES[page];
  if (!figure) return '';
  return `<figure class="content-figure">
    <img src="${figure.src}" width="${figure.width}" height="${figure.height}" alt="${figure.alt}" decoding="async">
    <figcaption class="small">${figure.caption}</figcaption>
  </figure>`;
}

/** Insert a page's figure at the start of the first card body; returns the html unchanged without one */
export function insertContentFigure(page: string, html: string): string {
  const figure = renderContentFigure(page);
  if (!figure || !html.includes(CARD_BODY_OPEN)) return html;
  return html.replace(CARD_BODY_OPEN, `${CARD_BODY_OPEN}\n    ${figure}`);
}
