import type { ContentPage } from './markdown-content.ts';

export interface InternalLink {
  href: string;
  label: string;
  description: string;
}

/** A button into the archive (a category, Browse, Categories, or Submit). */
export interface ArticleArchiveLink {
  href: string;
  label: string;
}

/** Archive entry points for a long-form article page. */
export interface ArticleArchiveLinks {
  /** Category whose top-scoring laws are featured after the article. */
  featuredCategory: { slug: string; name: string };
  /** Button row under the article title. The first link is the primary call to action. */
  links: ArticleArchiveLink[];
}

interface LawLinkContext {
  categorySlug?: string | null;
  categoryName?: string | null;
}

const HUB_LINKS: InternalLink[] = [
  { href: '/best-murphys-laws', label: "Best Murphy's Laws", description: 'Start with the strongest archive entries.' },
  { href: '/funniest-murphys-laws', label: "Funniest Murphy's Laws", description: 'Browse the sharpest comic failures.' },
  { href: '/murphys-laws-about-work', label: "Murphy's Laws About Work", description: 'Office, project, and meeting mishaps.' },
  { href: '/murphys-laws-about-technology', label: "Murphy's Laws About Technology", description: 'Software, systems, and technical failures.' },
  { href: '/murphys-law-vs-sods-law', label: "Murphy's Law vs Sod's Law", description: 'Understand the difference between the two maxims.' },
];

const CATEGORY_LINKS: Record<string, InternalLink[]> = {
  'murphys-technology-laws': [
    { href: '/murphys-laws-about-technology', label: 'Technology hub', description: 'A curated technology-focused Murphy hub.' },
    { href: '/examples/tech', label: 'Technology examples', description: 'Real situations where tech goes sideways.' },
    { href: '/calculator/sods-law', label: "Sod's Law Calculator", description: 'Model task risk with urgency and complexity.' },
  ],
  'murphys-computer-laws': [
    { href: '/murphys-laws-about-technology', label: 'Technology hub', description: 'Software, hardware, and system failures.' },
    { href: '/examples/tech', label: 'Technology examples', description: 'Common tech scenarios with linked laws.' },
    { href: '/category/murphys-technology-laws', label: 'Related technology laws', description: 'A broader technical category.' },
  ],
  'murphys-office-laws': [
    { href: '/murphys-laws-about-work', label: 'Work hub', description: 'Murphy at meetings, email, and planning.' },
    { href: '/examples/work', label: 'Work examples', description: 'Real workplace scenarios.' },
    { href: '/calculator/sods-law', label: "Sod's Law Calculator", description: 'Estimate risk before the deadline does.' },
  ],
  'murphys-travel-laws': [
    { href: '/examples/travel', label: 'Travel examples', description: 'Flights, luggage, weather, and timing.' },
    { href: '/category/murphys-bus-laws', label: 'Bus laws', description: 'Related transport frustrations.' },
    { href: '/calculator/sods-law', label: "Sod's Law Calculator", description: 'Model what pressure does to travel plans.' },
  ],
  'murphys-love-laws': [
    { href: '/examples/everyday-life', label: 'Everyday examples', description: 'Life and relationship-adjacent mishaps.' },
    { href: '/funniest-murphys-laws', label: 'Funny laws', description: 'Humor that starts with painful recognition.' },
  ],
};

export function getHubLinks(): InternalLink[] {
  return [...HUB_LINKS];
}

export function getLawDetailInternalLinks(context: LawLinkContext): InternalLink[] {
  if (!context.categorySlug) {
    return [
      { href: '/browse', label: 'Browse all laws', description: 'Search the complete archive.' },
      { href: '/categories', label: 'Browse categories', description: 'Find laws by topic.' },
      HUB_LINKS[0]!,
    ];
  }

  return [
    {
      href: `/category/${context.categorySlug}`,
      label: context.categoryName || 'Same category',
      description: 'Read more laws in this category.',
    },
    ...(CATEGORY_LINKS[context.categorySlug] ?? []),
  ].slice(0, 4);
}

export function getCategoryHubLinks(categorySlug: string): InternalLink[] {
  return CATEGORY_LINKS[categorySlug] ?? [
    { href: '/best-murphys-laws', label: "Best Murphy's Laws", description: 'A curated starting point.' },
    { href: '/categories', label: 'All categories', description: 'Find neighboring topics.' },
  ];
}

export function getCalculatorScenarioLinks(calculator: 'sods-law' | 'buttered-toast'): InternalLink[] {
  if (calculator === 'sods-law') {
    return [
      { href: '/murphys-law-vs-sods-law', label: "Murphy's Law vs Sod's Law", description: 'Why this calculator uses Sod’s framing.' },
      { href: '/examples/work', label: 'Work examples', description: 'Deadline and meeting scenarios.' },
      { href: '/category/murphys-office-laws', label: 'Office laws', description: 'Where pressure tends to break plans.' },
    ];
  }

  return [
    { href: '/examples/everyday-life', label: 'Everyday examples', description: 'Small domestic failures with familiar timing.' },
    { href: '/funniest-murphys-laws', label: 'Funny laws', description: 'More memorable failures.' },
    { href: '/category/murphys-gravity-laws', label: 'Gravity laws', description: 'Related falling-object trouble.' },
  ];
}

const ORIGINAL_LAWS = { slug: 'murphys-laws', name: "Murphy's Laws" };
const OFFICE_LAWS = { slug: 'murphys-office-laws', name: "Murphy's Office Laws" };
const BROWSE_LINK: ArticleArchiveLink = { href: '/browse', label: 'Browse all laws' };
const CATEGORIES_LINK: ArticleArchiveLink = { href: '/categories', label: 'All categories' };
const ORIGINAL_LAWS_LINK: ArticleArchiveLink = { href: '/category/murphys-laws', label: "Murphy's original laws" };
const TECHNOLOGY_LAWS_LINK: ArticleArchiveLink = { href: '/category/murphys-technology-laws', label: 'Technology laws' };
const OFFICE_LAWS_LINK: ArticleArchiveLink = { href: '/category/murphys-office-laws', label: 'Office laws' };
const TRAVEL_LAWS_LINK: ArticleArchiveLink = { href: '/category/murphys-travel-laws', label: 'Travel laws' };

// Article pages render Markdown prose only; these give each one a way into the archive.
// Pages without an entry render no archive block.
const ARTICLE_ARCHIVE_LINKS: Partial<Record<ContentPage, ArticleArchiveLinks>> = {
  'origin-story': {
    featuredCategory: ORIGINAL_LAWS,
    links: [
      { href: '/category/murphys-laws', label: "Read the original Murphy's Laws" },
      TECHNOLOGY_LAWS_LINK,
      BROWSE_LINK,
    ],
  },
  examples: {
    featuredCategory: ORIGINAL_LAWS,
    links: [TECHNOLOGY_LAWS_LINK, OFFICE_LAWS_LINK, TRAVEL_LAWS_LINK, CATEGORIES_LINK],
  },
  'murphys-law-vs-sods-law': {
    featuredCategory: ORIGINAL_LAWS,
    links: [ORIGINAL_LAWS_LINK, OFFICE_LAWS_LINK, BROWSE_LINK],
  },
  'why-murphys-law-feels-true': {
    featuredCategory: OFFICE_LAWS,
    links: [OFFICE_LAWS_LINK, ORIGINAL_LAWS_LINK, BROWSE_LINK],
  },
  'murphys-law-project-management': {
    featuredCategory: OFFICE_LAWS,
    links: [OFFICE_LAWS_LINK, TECHNOLOGY_LAWS_LINK, BROWSE_LINK],
  },
  'murphys-laws-about-work': {
    featuredCategory: OFFICE_LAWS,
    links: [OFFICE_LAWS_LINK, BROWSE_LINK],
  },
  'examples/work': {
    featuredCategory: OFFICE_LAWS,
    links: [OFFICE_LAWS_LINK, BROWSE_LINK],
  },
  'examples/travel': {
    featuredCategory: { slug: 'murphys-travel-laws', name: "Murphy's Travel Laws" },
    links: [TRAVEL_LAWS_LINK, { href: '/category/murphys-bus-laws', label: 'Bus laws' }, BROWSE_LINK],
  },
  'examples/tech': {
    featuredCategory: { slug: 'murphys-technology-laws', name: "Murphy's Technology Laws" },
    links: [TECHNOLOGY_LAWS_LINK, { href: '/category/murphys-computer-laws', label: 'Computer laws' }, BROWSE_LINK],
  },
  'examples/everyday-life': {
    featuredCategory: ORIGINAL_LAWS,
    links: [ORIGINAL_LAWS_LINK, { href: '/category/murphys-gravity-laws', label: 'Gravity laws' }, CATEGORIES_LINK],
  },
};

export function getArticleArchiveLinks(page: ContentPage): ArticleArchiveLinks | null {
  return ARTICLE_ARCHIVE_LINKS[page] ?? null;
}

/**
 * Renders an archive button. `data-nav` is the route without its leading slash
 * ("category/<slug>", "browse"); onNavigate splits compound routes.
 */
function renderArticleCta(link: ArticleArchiveLink, variant: 'primary' | 'outline'): string {
  const route = link.href.slice(1);
  const kind = route.startsWith('category/') ? 'category' : route;
  return `<a href="${link.href}" class="btn ${variant} article-cta article-cta--${kind}" data-nav="${route}">${link.label}</a>`;
}

/** One compact button row into the archive, rendered under an article's title. */
export function renderArticleNextSteps(archive: ArticleArchiveLinks | null): string {
  if (!archive) return '';

  return `
    <nav class="section card card--section section-card article-next-steps" aria-label="Explore the archive">
      <div class="section-body">
        <div class="not-found-actions">
          ${archive.links.map((link, index) => renderArticleCta(link, index === 0 ? 'primary' : 'outline')).join('')}
        </div>
      </div>
    </nav>`;
}

/** Buttons under an article's featured laws: the whole category, then Submit. */
export function renderArticleFeaturedLawsActions({ slug, name }: ArticleArchiveLinks['featuredCategory']): string {
  return `
    <div class="not-found-actions">
      ${renderArticleCta({ href: `/category/${slug}`, label: `See all ${name}` }, 'primary')}
      ${renderArticleCta({ href: '/submit', label: 'Submit your own' }, 'outline')}
    </div>`;
}

export function renderInternalLinkList(links: InternalLink[]): string {
  return `
    <ul class="internal-link-list">
      ${links.map((link) => `
        <li>
          <a href="${link.href}">${link.label}</a>
          <span>${link.description}</span>
        </li>
      `).join('')}
    </ul>`;
}
