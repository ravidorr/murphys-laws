import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { generateCategoryDescription } from '../src/utils/content-generator.ts';
import { groupCategories } from '../src/utils/category-groups.ts';
import {
  getArticleArchiveLinks,
  getCalculatorScenarioLinks,
  getCategoryHubLinks,
  getLawDetailInternalLinks,
  renderArticleFeaturedLawsActions,
  renderArticleNextSteps,
  renderInternalLinkList
} from '../src/utils/internal-links.ts';
import { renderNotFoundContent, renderNotFoundLaws } from '../src/utils/not-found-content.ts';
import { externalLinkRenderer } from '../src/utils/markdown-links.ts';
import { insertContentFigure } from '../src/utils/content-figures.ts';
import { CALCULATOR_META_DESCRIPTIONS, SITE_URL, WIDGET_CARD_COUNT } from '../src/utils/constants.ts';
import { buildBreadcrumbList, buildCanonicalUrl, buildUniqueLawSeo, buildLawSeo, truncateTitle } from '../src/utils/seo.ts';
import type { BreadcrumbItem, LawSeo } from '../src/utils/seo.ts';
import { oembedDiscoveryLink } from '../../shared/modules/law-embed.ts';
import type { ContentPage } from '../src/utils/markdown-content.ts';

// External citations open in a new tab, matching the client renderer
marked.use(externalLinkRenderer);

interface LawAttribution { name?: string; contact_type?: string; contact_value?: string; note?: string }
interface Law {
  id: number;
  title?: string;
  text?: string;
  attributions?: LawAttribution[];
  attribution?: string;
  author?: string;
  category_slug?: string;
  category_name?: string;
  category_context?: string | null;
  upvotes?: number;
  downvotes?: number;
  score?: number;
  created_at?: string;
  updated_at?: string;
  editorial?: {
    explanation: string;
    practical_example: string;
    source_label: string;
    source_url: string;
    reviewed_at: string;
  };
}

interface Category {
  slug: string;
  title: string;
  law_count: number;
}

interface CategoryListResponse {
  data: Category[];
}

type FetchCategoriesRequest = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

interface ContentPageMeta {
  slug: string;
  file: string;
  title: string;
  description: string;
}

interface PageMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  image?: string;
  type?: 'website' | 'article';
  robots?: string;
}

interface ContentMetadataEntry {
  lastUpdated?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const SHARED_CONTENT_DIR = path.resolve(__dirname, '../../shared/content');

async function readContentMetadata(): Promise<Record<string, ContentMetadataEntry>> {
  try {
    const raw = await fs.readFile(path.join(SHARED_CONTENT_DIR, 'metadata.json'), 'utf-8');
    return JSON.parse(raw) as Record<string, ContentMetadataEntry>;
  } catch {
    return {};
  }
}

// API configuration for fetching laws
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8787';
// Laws that carry an editorial annotation (migration 016, which names them by slug; the API list has no
// slug, so the build matches on title). They are never found by ID: a database built from the archive
// gives them IDs 2, 4, 8 and so on, while production gives them IDs between 2381 and 2470.
const REVIEWED_LAW_TITLES = [
  "Betteridge's law of headlines", "Brooks's law", "Chekhov's gun", "Chesterton's fence",
  'Sir Arthur Charles Clarke Third Law', "Conway's law", "Cunningham's law", "Metcalfe's law",
  "Gall's law", "Godwin's law", "Goodhart's law", "Hick's law", "Hofstadter's law", "Lindy's law",
  "Linus's law", "Occam's razor", 'Pareto principle', "Parkinson's law", "Parkinson's law of triviality",
  'Peter principle', "Poe's law", "Postel's law", "Segal's law", "Stigler's law of eponymy",
  'Streisand effect'
];

// Content pages metadata for SSG
const CONTENT_PAGES: ContentPageMeta[] = [
  { 
    slug: 'about', 
    file: 'about.md',
    title: 'About Murphy\'s Law Archive',
    description: 'Learn about Murphy\'s Law Archive - preserving and celebrating the world\'s favorite truism about inevitable mishaps since the late 1990s.'
  },
  { 
    slug: 'privacy', 
    file: 'privacy.md',
    title: 'Privacy Policy',
    description: 'Privacy Policy for Murphy\'s Law Archive - what information we collect, how we use it, and how we protect your trust.'
  },
  { 
    slug: 'terms', 
    file: 'terms.md',
    title: 'Terms of Service',
    description: 'Terms of Service for Murphy\'s Law Archive - usage guidelines and legal agreements for our community.'
  },
  { 
    slug: 'origin-story', 
    file: 'origin-story.md',
    title: 'The Origin of Murphy\'s Law',
    description: 'The true origin of Murphy\'s Law - Captain Edward A. Murphy Jr. and the 1949 Air Force experiment that gave birth to the famous maxim.'
  },
  { 
    slug: 'contact', 
    file: 'contact.md',
    title: 'Contact Murphy\'s Law Archive',
    description: 'Get in touch with Murphy\'s Law Archive - share a law, report an issue, or just say hello.'
  },
  { 
    slug: 'examples', 
    file: 'examples.md',
    title: 'Murphy\'s Law Examples',
    description: 'Real-life Murphy\'s Law examples from technology, work, travel, and everyday situations. See how anything that can go wrong, will go wrong.'
  },
  {
    slug: 'why-murphys-law-feels-true',
    file: 'why-murphys-law-feels-true.md',
    title: 'Why the Universe Hates Your Toast (And Other Lies We Tell Ourselves)',
    description: 'Why Murphy\'s Law feels true: negativity bias, the availability heuristic, and confirmation bias. Design for the inevitable instead of taking the universe\'s pranks personally.'
  },
  {
    slug: 'murphys-law-project-management',
    file: 'murphys-law-project-management.md',
    title: 'Project Management vs. The Universe: A Survival Guide',
    description: 'Plan for failure, tame scope creep, and assume you are being misunderstood. A survival guide to applying Murphy\'s Law in project management.'
  },
  {
    slug: 'developers',
    file: 'developers.md',
    title: 'Developers',
    description: 'REST API, MCP server, TypeScript SDK, CLI, and machine-readable feeds for Murphy\'s Law Archive.'
  },
  {
    slug: 'best-murphys-laws',
    file: 'best-murphys-laws.md',
    title: 'Best Murphy\'s Laws',
    description: 'A curated starting point for the best Murphy\'s Laws.'
  },
  {
    slug: 'funniest-murphys-laws',
    file: 'funniest-murphys-laws.md',
    title: 'Funniest Murphy\'s Laws',
    description: 'Funny Murphy\'s Laws that capture familiar failures.'
  },
  {
    slug: 'murphys-laws-about-work',
    file: 'murphys-laws-about-work.md',
    title: 'Murphy\'s Laws About Work',
    description: 'Murphy\'s Laws for work, offices, meetings, and projects.'
  },
  {
    slug: 'murphys-laws-about-technology',
    file: 'murphys-laws-about-technology.md',
    title: 'Murphy\'s Laws About Technology',
    description: 'Murphy\'s Laws about technology, software, and systems.'
  },
  {
    slug: 'murphys-law-vs-sods-law',
    file: 'murphys-law-vs-sods-law.md',
    title: 'Murphy\'s Law vs Sod\'s Law',
    description: 'The difference between Murphy\'s Law and Sod\'s Law.'
  },
  {
    slug: 'examples/work',
    file: 'examples-work.md',
    title: 'Murphy\'s Law Work Examples',
    description: 'Workplace Murphy\'s Law examples with linked laws and practical risk-reduction notes.'
  },
  {
    slug: 'examples/travel',
    file: 'examples-travel.md',
    title: 'Murphy\'s Law Travel Examples',
    description: 'Travel Murphy\'s Law examples with linked laws and practical risk-reduction notes.'
  },
  {
    slug: 'examples/tech',
    file: 'examples-tech.md',
    title: 'Murphy\'s Law Technology Examples',
    description: 'Technology Murphy\'s Law examples with linked laws and practical risk-reduction notes.'
  },
  {
    slug: 'examples/everyday-life',
    file: 'examples-everyday-life.md',
    title: 'Everyday Murphy\'s Law Examples',
    description: 'Everyday Murphy\'s Law examples with linked laws and practical risk-reduction notes.'
  }
];

/**
 * Fetch all published laws from the API.
 *
 * Every law page and sitemap entry comes from this list, so a partial or empty answer must stop the
 * build: shipping it would publish a site that silently lost its law pages.
 */
async function fetchAllLaws(fetchRequest: FetchCategoriesRequest = fetch, baseUrl: string = API_BASE_URL): Promise<Law[]> {
  const laws: Law[] = [];
  let offset = 0;
  let total = 0;
  const limit = 100; // Request up to 100, but API may return fewer

  while (true) {
    // created_at does not change when votes arrive and the API breaks ties by id, so paging is stable
    const response = await fetchRequest(`${baseUrl}/api/v1/laws?limit=${limit}&offset=${offset}&sort=created_at&order=asc`);
    if (!response.ok) {
      throw new Error(`Law API returned ${response.status}`);
    }

    const payload = await response.json() as { data?: unknown; total?: unknown };
    if (!Array.isArray(payload.data) || !Number.isInteger(payload.total) || (payload.total as number) < 0
      || !payload.data.every((item) => Number.isInteger((item as Law | null)?.id))) {
      throw new Error(`Law API returned an unexpected payload at offset ${offset}.`);
    }
    // A total that moves while the pages are read means laws were added or removed mid-run, which can
    // shift a page boundary and skip a law without the count check below noticing
    if (offset > 0 && payload.total !== total) {
      throw new Error(`Law API total changed from ${total} to ${payload.total as number} while paging; run the build again.`);
    }
    total = payload.total as number;

    // Stop if we got no data or have all items
    // Note: API may return fewer items than limit (e.g., max 25 per request)
    if (payload.data.length === 0) break;
    laws.push(...(payload.data as Law[]));
    if (laws.length >= total) break;
    offset += payload.data.length; // Use actual count returned, not requested limit
  }

  if (laws.length === 0) {
    throw new Error('Law API returned no laws; refusing to generate a site without law pages.');
  }
  if (laws.length !== total) {
    throw new Error(`Law API returned ${laws.length} of ${total} laws; refusing to generate an incomplete site.`);
  }
  if (new Set(laws.map((law) => law.id)).size !== laws.length) {
    throw new Error('Law API returned the same law more than once; refusing to generate duplicate pages.');
  }

  console.log(`Fetched ${laws.length} laws from API.`);
  // Keep the order the API's default listing used, which related-law picking depends on
  return laws.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.upvotes ?? 0) - (a.upvotes ?? 0) || b.id - a.id);
}

/**
 * Fetch the category source of truth used by the API and application.  SSG
 * must not derive public routes from archived source filenames: those can
 * outlive a renamed category and create empty, indexable landing pages.
 */
async function fetchAllCategories(fetchRequest: FetchCategoriesRequest = fetch): Promise<Category[]> {
  const response = await fetchRequest(`${API_BASE_URL}/api/v1/categories`);
  if (!response.ok) {
    throw new Error(`Category API returned ${response.status}`);
  }

  const payload = await response.json() as Partial<CategoryListResponse>;
  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error('Category API returned no categories; refusing to generate an incomplete sitemap.');
  }

  const slugs = new Set<string>();
  return payload.data.map((category, index) => {
    const slug = typeof category.slug === 'string' ? category.slug.trim() : '';
    const title = typeof category.title === 'string' ? category.title.trim() : '';
    const lawCount = Number(category.law_count);

    if (!slug || !title || !Number.isInteger(lawCount) || lawCount < 0) {
      throw new Error(`Invalid category at API index ${index}.`);
    }
    if (slugs.has(slug)) {
      throw new Error(`Category API returned duplicate slug "${slug}".`);
    }
    slugs.add(slug);

    return { slug, title, law_count: lawCount };
  });
}

function categorySitemapPaths(categories: Category[]): string[] {
  return categories.map(({ slug }) => `/category/${slug}`);
}

/**
 * Add the editorial annotation to each reviewed law. A law is found by title in the list the build
 * already fetched; when another law shares the title, the one that carries an annotation is the
 * reviewed one. A reviewed law that cannot be found, or whose title is annotated on more than one law,
 * stops the build instead of quietly dropping its reviewed content from the page.
 */
async function mergeReviewedLawDetails(laws: Law[], fetchRequest: FetchCategoriesRequest = fetch, baseUrl: string = API_BASE_URL): Promise<Law[]> {
  if (laws.length === 0) return laws;

  const normalize = (title: string | undefined) => (title ?? '').trim().toLowerCase();
  const detailsById = new Map<number, Law>();
  for (const title of REVIEWED_LAW_TITLES) {
    const candidates = laws.filter((law) => normalize(law.title) === normalize(title));
    if (candidates.length === 0) throw new Error(`Reviewed law "${title}" is not in the API law list`);

    const details = await Promise.all(candidates.map(async (candidate) => {
      const response = await fetchRequest(`${baseUrl}/api/v1/laws/${candidate.id}`);
      if (!response.ok) throw new Error(`Could not fetch reviewed law "${title}" (${candidate.id}): API returned ${response.status}`);
      const detail = await response.json() as Law;
      if (detail.id !== candidate.id) throw new Error(`Reviewed law "${title}" (${candidate.id}): API answered with law ${detail.id}`);
      return detail;
    }));
    const annotated = details.filter((law) => law.editorial);
    if (annotated.length === 0) throw new Error(`Reviewed law "${title}" is missing its editorial annotation`);
    if (annotated.length > 1) throw new Error(`Reviewed law "${title}" has an editorial annotation on more than one law`);
    detailsById.set(annotated[0]!.id, annotated[0]!);
  }
  return laws.map((law) => detailsById.has(law.id) ? { ...law, ...detailsById.get(law.id)! } : law);
}

/**
 * Fetch first page of laws for SSG pre-render (browse, category)
 */
async function fetchFirstPageOfLaws(
  params: { limit: number; offset?: number; category_id?: number; category_slug?: string },
  fetchRequest: FetchCategoriesRequest = fetch,
  baseUrl: string = API_BASE_URL
): Promise<{ data: Law[]; total: number }> {
  const { limit, offset = 0, category_id, category_slug } = params;
  const searchParams = new URLSearchParams({ limit: String(limit), offset: String(offset), sort: 'score', order: 'desc' });
  if (category_id !== undefined) searchParams.set('category_id', String(category_id));
  if (category_slug) searchParams.set('category_slug', category_slug);
  // A failure stops the build: swallowing it published browse and category pages with no laws on them.
  const query = searchParams.toString();
  const response = await fetchRequest(`${baseUrl}/api/v1/laws?${query}`);
  if (!response.ok) throw new Error(`Law API returned ${response.status} for ?${query}`);
  const json = await response.json() as { data?: unknown; total?: unknown };
  if (!Array.isArray(json.data) || !Number.isInteger(json.total) || (json.total as number) < 0) {
    throw new Error(`Law API returned an unexpected payload for ?${query}`);
  }
  if (json.data.length === 0 && (json.total as number) > offset) {
    throw new Error(`Law API returned no laws for ?${query} although it reports ${json.total as number}`);
  }
  return { data: json.data as Law[], total: json.total as number };
}

/**
 * The laws a law page links to as "related". Plain "first three of the category" gave every law in a category
 * the same three links, so only those few laws were ever linked to. This walks the category as a ring instead:
 * the next law, and the laws one and two "strides" further on (a stride is about the square root of the category
 * size), so every law is linked from exactly three others and any law is reachable in a few hops.
 */
function pickRelatedLaws<T extends { id: number }>(law: T, categoryLaws: T[], count: number = 3): T[] {
  const size = categoryLaws.length;
  const index = categoryLaws.findIndex((candidate) => candidate.id === law.id);
  if (index < 0 || size < 2) return categoryLaws.filter((candidate) => candidate.id !== law.id).slice(0, count);

  const stride = Math.max(2, Math.round(Math.sqrt(size)));
  const picked = new Map<number, T>();
  const add = (offset: number): void => {
    const candidate = categoryLaws[(index + offset) % size] as T;
    if (candidate.id !== law.id) picked.set(candidate.id, candidate);
  };
  for (const offset of [1, stride, stride * 2]) add(offset);
  // Tiny categories can run out of distinct laws; fill with the next ones in order.
  for (let offset = 2; offset < size && picked.size < Math.min(count, size - 1); offset += 1) add(offset);
  return [...picked.values()].slice(0, count);
}

/** Plain list of links to laws (label only), for crawlable indexes that would be too long as cards. */
function renderLawLinkList(laws: Law[], seoById: Map<string, LawSeo>): string {
  if (laws.length === 0) return '';
  const items = laws.map((law) => {
    const label = seoById.get(String(law.id))?.headline ?? buildLawSeo(law).headline;
    return `<li><a href="/law/${law.id}">${escapeHtml(label)}</a></li>`;
  });
  return `<ul class="internal-link-list">${items.join('')}</ul>`;
}

/**
 * Render static law cards HTML for SSG (no client JS; same structure as client cards for SEO and no-JS users)
 */
function renderStaticLawCards(laws: Law[], baseUrl: string = SITE_URL): string {
  if (!laws || laws.length === 0) return '';
  return laws.map((law) => {
    const safeId = escapeHtml(String(law.id));
    const title = law.title ? escapeHtml(law.title) : '';
    const text = escapeHtml(law.text || '');
    const titleText = title ? `<strong>${title}:</strong> ${text}` : text;
    const attribution = law.attributions?.[0]?.name
      ? `- ${escapeHtml(law.attributions[0].name)}`
      : '';
    const up = Number.isFinite(law.upvotes) ? law.upvotes : 0;
    const down = Number.isFinite(law.downvotes) ? law.downvotes : 0;
    const lawUrl = `${baseUrl}/law/${law.id}`;
    const ariaLabel = title ? `${title}: ${text}` : text;
    return `
    <article class="law-card-mini" data-law-id="${safeId}" tabindex="0" role="article" aria-label="${ariaLabel}">
      <p class="law-card-text">
        <a href="${lawUrl}">${titleText}</a>
      </p>
      ${attribution ? `<p class="law-card-attrib">${attribution}</p>` : ''}
      <div class="law-card-footer">
        <div class="law-card-footer-left">
          <span class="vote-count" aria-hidden="true">${up} up</span>
          <span class="vote-count" aria-hidden="true">${down} down</span>
        </div>
      </div>
    </article>`;
  }).join('');
}

/**
 * Escape HTML special characters for safe embedding
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function lawScore(law: Law): number {
  return (law.upvotes ?? 0) - (law.downvotes ?? 0);
}

/**
 * Static archive blocks for an article page, matching the client view: the
 * button row into the archive (placed above the article card, which holds the
 * h1 in static markup) and up to three top-scoring laws from the article's
 * featured category. Pages without an archive mapping get empty strings.
 */
function buildStaticArticleArchive(slug: string, laws: Law[]): { nextSteps: string; featuredLaws: string } {
  const archive = getArticleArchiveLinks(slug as ContentPage);
  if (!archive) return { nextSteps: '', featuredLaws: '' };

  // Same order as the API's score sort: score, then upvotes, then newest id
  const featured = laws
    .filter((law) => law.category_slug === archive.featuredCategory.slug)
    .sort((a, b) => lawScore(b) - lawScore(a) || (b.upvotes ?? 0) - (a.upvotes ?? 0) || b.id - a.id)
    .slice(0, WIDGET_CARD_COUNT);

  const featuredLaws = featured.length === 0 ? '' : `
        <div class="card card--law-list law-list-card law-list-card--reserved article-featured-laws mt-8">
          <header class="card-header">
            <h2 class="card-title"><span class="accent-text">Laws</span> behind this story</h2>
          </header>
          <div class="card-body card-body--flush">
            <div class="card-text">${renderStaticLawCards(featured, '')}</div>
          </div>
          <div class="card-footer">${renderArticleFeaturedLawsActions(archive.featuredCategory)}</div>
        </div>`;

  return { nextSteps: renderArticleNextSteps(archive), featuredLaws };
}

function getLawAttributionName(law: Law): string | null {
  if (law.attributions && law.attributions.length > 0 && law.attributions[0]?.name) {
    return law.attributions[0].name;
  }
  return law.author || law.attribution || null;
}

function buildStaticLawDetailContent(law: Law, relatedLaws: Law[] = []): string {
  const title = law.title || "Murphy's Law";
  const attributionName = getLawAttributionName(law);
  const sourceStatus = attributionName
    ? `Attributed to ${escapeHtml(attributionName)}`
    : 'Source not yet verified by the archive.';
  const categoryName = law.category_name || 'Murphy\'s Laws';
  const categorySlug = law.category_slug;
  const categoryLink = categorySlug
    ? `<a href="/category/${escapeHtml(categorySlug)}">${escapeHtml(categoryName)}</a>`
    : `<a href="/categories">Browse categories</a>`;
  const context = law.category_context
    || `This law belongs with ${categoryName}, where small assumptions, timing, and system complexity tend to turn into memorable failures.`;
  const upvotes = Number.isFinite(law.upvotes) ? law.upvotes : 0;
  const downvotes = Number.isFinite(law.downvotes) ? law.downvotes : 0;

  return `
    <div class="container page law-detail pt-0">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/browse">Browse</a></li>
          ${categorySlug ? `<li><a href="/category/${escapeHtml(categorySlug)}">${escapeHtml(categoryName)}</a></li>` : ''}
          <li aria-current="page">${escapeHtml(title)}</li>
        </ol>
      </nav>
      <article class="card card--section law-detail-card">
        <header class="card-header">
          <h1 class="card-title">${escapeHtml(title)}</h1>
          <p class="small">Source status: ${sourceStatus}</p>
        </header>
        <div class="card-body">
          <blockquote class="law-text">${escapeHtml(law.text || '')}</blockquote>
          ${attributionName ? `<p class="attribution">- ${escapeHtml(attributionName)}</p>` : ''}
          <div class="law-meta">
            <p><strong>Category:</strong> ${categoryLink}</p>
            <p><strong>Votes:</strong> ${upvotes} up, ${downvotes} down</p>
          </div>
        </div>
      </article>
      <section class="section card card--section section-card mb-12" aria-labelledby="law-context-heading">
        <div class="section-header">
          <h2 id="law-context-heading" class="section-title" data-section-title="In context"><span class="accent-text">In</span> context</h2>
        </div>
        <div class="section-body">
          <p>${escapeHtml(context)}</p>
        </div>
      </section>
      ${law.editorial ? `<section class="section card card--section section-card mb-12" aria-labelledby="law-editorial-heading">
        <div class="section-header"><h2 id="law-editorial-heading" class="section-title"><span class="accent-text">Editorial</span> note</h2></div>
        <div class="section-body">
          <p>${escapeHtml(law.editorial.explanation)}</p>
          <p><strong>Practical example:</strong> ${escapeHtml(law.editorial.practical_example)}</p>
          <p class="small">Reviewed <time datetime="${escapeHtml(law.editorial.reviewed_at)}">${escapeHtml(law.editorial.reviewed_at)}</time> · <a href="${escapeHtml(law.editorial.source_url)}" rel="noopener noreferrer">${escapeHtml(law.editorial.source_label)}</a></p>
        </div>
      </section>` : ''}
      <section class="section card card--section section-card mb-12" aria-labelledby="related-laws-heading">
        <div class="section-header">
          <h2 id="related-laws-heading" class="section-title" data-section-title="Related laws"><span class="accent-text">Related</span> laws</h2>
        </div>
        <div class="section-body">
          <p>Keep exploring laws from this topic or browse the full archive for neighboring ideas.</p>
          ${relatedLaws.length > 0 ? `<div class="related-laws-list">${renderStaticLawCards(relatedLaws, '')}</div>` : ''}
          ${renderInternalLinkList(getLawDetailInternalLinks({ categorySlug, categoryName }))}
          <div class="not-found-actions">
            ${categorySlug ? `<a href="/category/${escapeHtml(categorySlug)}" class="btn">See this category</a>` : ''}
            <a href="/browse" class="btn outline">Browse all laws</a>
          </div>
        </div>
      </section>
      <section class="section card card--section section-card" aria-labelledby="law-actions-heading">
        <div class="section-header">
          <h2 id="law-actions-heading" class="section-title"><span class="accent-text">Improve</span> this entry</h2>
        </div>
        <div class="section-body">
          <p>Know the original source, a better attribution, or a duplicate we should merge? <a href="/contact">Report an issue</a>.</p>
        </div>
      </section>
    </div>`;
}

/**
 * Update hreflang tags to point to the correct URL
 */
function updateHreflang(html: string, url: string): string {
  html = html.replace(
    /<link rel="alternate" hreflang="en" href=".*?">/,
    `<link rel="alternate" hreflang="en" href="${url}">`
  );
  html = html.replace(
    /<link rel="alternate" hreflang="x-default" href=".*?">/,
    `<link rel="alternate" hreflang="x-default" href="${url}">`
  );
  return html;
}

function replaceMetaContent(html: string, attribute: 'name' | 'property', key: string, content: string): string {
  const escaped = escapeHtml(content);
  const pattern = new RegExp(`<meta ${attribute}="${key}"[\\s\\S]*?content="[\\s\\S]*?">`);
  return html.replace(pattern, `<meta ${attribute}="${key}" content="${escaped}">`);
}

function applyPageMetadata(html: string, metadata: PageMetadata): string {
  const canonicalUrl = buildCanonicalUrl(metadata.canonicalPath);
  const image = metadata.image || `${SITE_URL}/social/home.png`;
  const type = metadata.type || 'website';
  let result = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`);
  result = replaceMetaContent(result, 'name', 'description', metadata.description);
  result = result.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${canonicalUrl}">`);
  result = updateHreflang(result, canonicalUrl);
  result = replaceMetaContent(result, 'property', 'og:type', type);
  result = replaceMetaContent(result, 'property', 'og:url', canonicalUrl);
  result = replaceMetaContent(result, 'property', 'og:title', metadata.title);
  result = replaceMetaContent(result, 'property', 'og:description', metadata.description);
  result = replaceMetaContent(result, 'property', 'og:image', image);
  result = replaceMetaContent(result, 'property', 'twitter:url', canonicalUrl);
  result = replaceMetaContent(result, 'property', 'twitter:title', metadata.title);
  result = replaceMetaContent(result, 'property', 'twitter:description', metadata.description);
  result = replaceMetaContent(result, 'property', 'twitter:image', image);
  if (metadata.robots) {
    result = replaceMetaContent(result, 'name', 'robots', metadata.robots);
  }
  return result;
}

/**
 * Escape string for JSON embedding
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
/**
 * Generate JSON-LD script tag
 */
function generateJsonLd(data: object, id?: string): string {
  const idAttr = id ? ` id="${id}"` : '';
  return `<script type="application/ld+json"${idAttr}>${JSON.stringify(data, null, 2)}</script>`;
}

/**
 * Inject a BreadcrumbList whose script id matches the client-side one (`jsonld-<id>`), so the
 * router replaces or removes it on navigation instead of leaving a stale duplicate behind.
 */
function injectBreadcrumbJsonLd(html: string, id: string, trail: BreadcrumbItem[]): string {
  const home: BreadcrumbItem = { name: 'Home', path: '/' };
  return injectJsonLd(html, generateJsonLd(buildBreadcrumbList([home, ...trail]), `jsonld-${id}`));
}

/**
 * Inject JSON-LD into HTML head
 */
function injectJsonLd(html: string, jsonLd: string): string {
  return html.replace('</head>', `${jsonLd}\n</head>`);
}

/**
 * Breadcrumb trail for a content page. Example subpages sit under /examples.
 */
function buildContentBreadcrumbTrail(page: { slug: string; title: string }): BreadcrumbItem[] {
  const trail: BreadcrumbItem[] = [];
  if (page.slug.startsWith('examples/')) {
    trail.push({ name: "Murphy's Law Examples", path: '/examples' });
  }
  trail.push({ name: page.title, path: `/${page.slug}` });
  return trail;
}

interface GeneratedPageExpectations {
  description?: string;
  canonicalPath: string;
  forbidMailto?: boolean;
  requireCategoryLink?: boolean;
  requireContentFigure?: boolean;
}

function validateGeneratedPage(html: string, expectations: GeneratedPageExpectations): string[] {
  const failures: string[] = [];
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) failures.push(`expected one h1, found ${h1Count}`);
  if (expectations.forbidMailto && /mailto:/i.test(html)) failures.push('contains a public mailto link');
  const expectedCanonical = `rel="canonical" href="${buildCanonicalUrl(expectations.canonicalPath)}"`;
  if (!html.includes(expectedCanonical)) failures.push(`missing canonical ${expectations.canonicalPath}`);
  if (!/<meta name="description" content="[^"].*?">/i.test(html)) failures.push('missing route description');
  if (expectations.description) {
    const escapedDescription = escapeHtml(expectations.description);
    for (const [attribute, key] of [['name', 'description'], ['property', 'og:description'], ['property', 'twitter:description']] as const) {
      if (!html.includes(`<meta ${attribute}="${key}" content="${escapedDescription}">`)) {
        failures.push(`${key} does not match the route description`);
      }
    }
  }
  if (!/<meta property="og:title" content="[^"].*?">/i.test(html)) failures.push('missing Open Graph title');
  if (!/<meta property="twitter:title" content="[^"].*?">/i.test(html)) failures.push('missing Twitter title');
  if (expectations.requireCategoryLink && !/href="\/category\/[^"/]+"/i.test(html)) {
    failures.push('missing navigable category link');
  }
  if (expectations.requireContentFigure && !/<figure class="content-figure">[\s\S]*?<img [^>]*src="\/img\/[^"]+"/i.test(html)) {
    failures.push('missing article photo');
  }
  return failures;
}

function validateNotFoundPage(html: string): string[] {
  const failures: string[] = [];
  if (!html.includes('<meta name="robots" content="noindex">')) failures.push('missing noindex');
  if (!html.includes('class="not-found-code"')) failures.push('missing 404 content');
  if ((html.match(/<h1\b/gi) || []).length !== 1) failures.push('expected one h1');
  return failures;
}

async function validateGeneratedOutput(): Promise<void> {
  const checks: Array<{ file: string; expectations: GeneratedPageExpectations }> = [
    { file: 'browse/index.html', expectations: { canonicalPath: '/browse' } },
    { file: 'categories/index.html', expectations: { canonicalPath: '/categories', requireCategoryLink: true } },
    { file: 'submit/index.html', expectations: { canonicalPath: '/submit' } },
    { file: 'origin-story/index.html', expectations: { canonicalPath: '/origin-story', requireContentFigure: true } },
    { file: 'calculator/sods-law/index.html', expectations: { canonicalPath: '/calculator/sods-law', description: CALCULATOR_META_DESCRIPTIONS.sodsLaw } },
    { file: 'calculator/buttered-toast/index.html', expectations: { canonicalPath: '/calculator/buttered-toast', description: CALCULATOR_META_DESCRIPTIONS.butteredToast } }
  ];

  for (const { file, expectations } of checks) {
    const html = await fs.readFile(path.join(DIST_DIR, file), 'utf-8');
    const failures = validateGeneratedPage(html, expectations);
    if (failures.length > 0) throw new Error(`Invalid generated page ${file}: ${failures.join('; ')}`);
    if (expectations.requireContentFigure) {
      const figureSrc = html.match(/<figure class="content-figure">[\s\S]*?<img [^>]*src="(\/img\/[^"]+)"/i)![1]!;
      await fs.access(path.join(DIST_DIR, figureSrc)).catch(() => {
        throw new Error(`Invalid generated page ${file}: article photo ${figureSrc} is missing from the build output`);
      });
    }
  }

  const notFoundFailures = validateNotFoundPage(await fs.readFile(path.join(DIST_DIR, '404.html'), 'utf-8'));
  if (notFoundFailures.length > 0) throw new Error(`Invalid generated page 404.html: ${notFoundFailures.join('; ')}`);

  for (const routeName of ['category', 'law']) {
    const routeDir = path.join(DIST_DIR, routeName);
    const entries = await fs.readdir(routeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const relativePath = `${routeName}/${entry.name}/index.html`;
      const html = await fs.readFile(path.join(DIST_DIR, relativePath), 'utf-8');
      const failures = validateGeneratedPage(html, {
        canonicalPath: `/${routeName}/${entry.name}`,
        forbidMailto: true
      });
      if (failures.length > 0) throw new Error(`Invalid generated page ${relativePath}: ${failures.join('; ')}`);
    }
  }
}

/**
 * Generate HTML page for a single law with correct OG meta tags
 */
function generateLawPage(law: Law, template: string, relatedLaws: Law[] = [], seo: LawSeo = buildLawSeo(law)): string {
  let pageHtml = template;
  
  const title = seo.headline;
  const description = seo.description;
  const lawUrl = `${SITE_URL}/law/${law.id}`;
  const ogImageUrl = `${SITE_URL}/api/v1/og/law/${law.id}.png`;
  
  pageHtml = applyPageMetadata(pageHtml, {
    title: seo.title,
    description,
    canonicalPath: `/law/${law.id}`,
    image: ogImageUrl,
    type: 'article'
  });
  
  // Get attribution name
  const attributionName = getLawAttributionName(law);

  // Build static content for law detail page
  const staticContent = buildStaticLawDetailContent(law, relatedLaws);
  
  // Inject content into main
  pageHtml = pageHtml.replace(
    /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/,
    `<main id="main-content" class="flex-1 container page">${staticContent}</main>`
  );
  
  // Pre-render JSON-LD structured data for law page
  const lawJsonLd = generateJsonLd({
    '@context': 'https://schema.org',
    '@type': ['Article', 'Quotation'],
    'headline': title,
    'description': law.text || '',
    'text': law.text || '',
    'datePublished': law.created_at || undefined,
    'dateModified': law.updated_at || law.created_at || undefined,
    'author': attributionName ? {
      '@type': 'Person',
      'name': attributionName
    } : undefined,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': lawUrl
    },
    'publisher': {
      '@type': 'Organization',
      'name': "Murphy's Law Archive",
      'url': SITE_URL
    },
    'url': lawUrl,
    'image': ogImageUrl,
    'speakable': {
      '@type': 'SpeakableSpecification',
      'cssSelector': ['.law-text', '.card-title', '.attribution']
    }
  });
  
  pageHtml = injectJsonLd(pageHtml, lawJsonLd);

  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      'position': 1,
      'name': 'Home',
      'item': SITE_URL
    },
    {
      '@type': 'ListItem',
      'position': 2,
      'name': 'Browse',
      'item': `${SITE_URL}/browse`
    },
    ...(law.category_slug && law.category_name ? [{
      '@type': 'ListItem',
      'position': 3,
      'name': law.category_name,
      'item': `${SITE_URL}/category/${law.category_slug}`
    }] : []),
    {
      '@type': 'ListItem',
      'position': law.category_slug && law.category_name ? 4 : 3,
      'name': title,
      'item': lawUrl
    }
  ];
  const breadcrumbJsonLd = generateJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': breadcrumbItems
  });

  pageHtml = injectJsonLd(pageHtml, breadcrumbJsonLd);
  pageHtml = pageHtml.replace('</head>', `${oembedDiscoveryLink(law.id)}\n</head>`);
  
  return pageHtml;
}

interface SitemapInput {
  baseUrl: string;
  laws: Law[];
  categories: Category[];
  contentPages: ContentPageMeta[];
  contentMetadata: Record<string, ContentMetadataEntry>;
  staticRoutePaths: string[];
}

function toDateOnly(value?: string | null): string | undefined {
  return value ? value.split('T')[0] : undefined;
}

function latestDate(dates: Array<string | undefined>): string | undefined {
  const valid = dates.filter((date): date is string => Boolean(date));
  return valid.length > 0 ? valid.reduce((a, b) => (a > b ? a : b)) : undefined;
}

/**
 * Build sitemap.xml. A URL carries a lastmod only when a real content date is known (the newest
 * law for the home, browse, categories and category pages); changefreq and priority are omitted
 * because search engines ignore them.
 */
function buildSitemapXml({ baseUrl, laws, categories, contentPages, contentMetadata, staticRoutePaths }: SitemapInput): string {
  const lawDate = (law: Law) => toDateOnly(law.updated_at || law.created_at);
  const siteDate = latestDate(laws.map(lawDate));

  const lawDatesByCategory = new Map<string, string[]>();
  for (const law of laws) {
    const date = lawDate(law);
    if (!law.category_slug || !date) continue;
    lawDatesByCategory.set(law.category_slug, [...(lawDatesByCategory.get(law.category_slug) || []), date]);
  }

  const entries: Array<{ loc: string; lastmod?: string }> = [
    { loc: `${baseUrl}/`, lastmod: siteDate },
    { loc: `${baseUrl}/browse`, lastmod: siteDate },
    { loc: `${baseUrl}/categories`, lastmod: siteDate },
    ...contentPages.map((page) => ({
      loc: `${baseUrl}/${page.slug}`,
      lastmod: contentMetadata[page.slug]?.lastUpdated
    })),
    ...staticRoutePaths.map((routePath) => ({ loc: `${baseUrl}/${routePath}`, lastmod: contentMetadata[routePath]?.lastUpdated })),
    ...categorySitemapPaths(categories).map((categoryPath) => ({
      loc: `${baseUrl}${categoryPath}`,
      lastmod: latestDate(lawDatesByCategory.get(categoryPath.replace('/category/', '')) || [])
    })),
    ...laws.map((law) => ({ loc: `${baseUrl}/law/${law.id}`, lastmod: lawDate(law) }))
  ];

  const urls = entries
    .map(({ loc, lastmod }) => `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

/**
 * Wrap the first word of a heading with accent-text span
 */
function wrapFirstWordWithAccent(text: string): string {
  const words = text.split(' ');
  if (words.length > 1) {
    return `<span class="accent-text">${words[0]}</span> ${words.slice(1).join(' ')}`;
  }
  return `<span class="accent-text">${text}</span>`;
}

/**
 * Process markdown HTML to add styling classes similar to the web app
 */
function enhanceMarkdownHtml(html: string): string {
  // Process h1 tags - wrap first word with accent-text
  html = html.replace(/<h1>([^<]+)<\/h1>/g, (match, content) => {
    return `<h1>${wrapFirstWordWithAccent(content)}</h1>`;
  });

  // Process h2 tags - wrap first word with accent-text and wrap in section
  // Each h2 closes the previous section and starts a new one
  html = html.replace(/<h2>([^<]+)<\/h2>/g, (match, content) => {
    return `</section><section class="content-section"><h2>${wrapFirstWordWithAccent(content)}</h2>`;
  });

  // Process h3 tags - wrap first word with accent-text
  html = html.replace(/<h3>([^<]+)<\/h3>/g, (match, content) => {
    return `<h3>${wrapFirstWordWithAccent(content)}</h3>`;
  });

  // Remove the first orphaned </section> that appears before the first <section>
  // This happens because h2 replacement adds </section> before <section>, but
  // the first h2 has no preceding section to close
  html = html.replace(/<\/section>(<section class="content-section">)/, '$1');
  
  // Add closing section at the end (to close the last section opened by h2)
  html = html + '</section>';

  return html;
}

/**
 * Wrap enhanced HTML in card structure with header/body separation
 */
function wrapInCardStructure(html: string, options: { lastUpdated?: string | null } = {}): string {
  // Extract h1 and first paragraph for header
  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/);
  
  if (!h1Match) {
    // No h1 found, wrap everything in card-body
    return `
        <article class="card card--content content-card">
          <div class="card-body">
            ${html}
          </div>
        </article>`;
  }

  const h1Content = h1Match[0];
  const h1Index = html.indexOf(h1Content);
  const afterH1 = h1Index + h1Content.length;
  
  // Find the first paragraph after h1 (for lead text)
  const afterH1Content = html.substring(afterH1);
  const firstPMatch = afterH1Content.match(/^[\s\n]*<p>([\s\S]*?)<\/p>/);
  
  let headerHtml = '          <header class="card-header content-header">\n';
  
  // Add last updated date if provided
  if (options.lastUpdated) {
    headerHtml += `            <p class="small">Last updated: ${options.lastUpdated}</p>\n`;
  }
  
  headerHtml += `            ${h1Content}\n`;
  
  let bodyContent;
  if (firstPMatch) {
    const leadText = firstPMatch[1];
    headerHtml += `            <p class="lead">${leadText}</p>\n`;
    headerHtml += '          </header>';
    // Body content is everything after the first paragraph
    const headerEndIndex = afterH1 + afterH1Content.indexOf(firstPMatch[0]) + firstPMatch[0].length;
    bodyContent = html.substring(headerEndIndex);
  } else {
    headerHtml += '          </header>';
    // No lead paragraph, body is everything after h1
    bodyContent = afterH1Content;
  }
  
  return `
        <article class="card card--content content-card">
${headerHtml}
          <div class="card-body">
            ${bodyContent.trim()}
          </div>
        </article>`;
}

function buildStaticFavoritesContent(): string {
  return `
    <div class="container page">
      <h1 class="page-title mb-4" data-page-title="My Favorites"><span class="accent-text">My</span> Favorites</h1>
      <article class="card card--empty content-card">
        <header class="card-header text-center">
          <h2 class="card-title"><span class="accent-text">Save</span> Laws You Want To Revisit</h2>
          <blockquote class="not-found-quote">
            "The law you need most will be the one you forgot to save."
          </blockquote>
          <p class="text-muted-fg">Favorites are stored in your browser on this device. No account is required.</p>
          <p class="text-muted-fg small">Enable JavaScript to see saved laws from this browser, or start building your collection from the archive.</p>
        </header>
        <div class="card-body text-center">
          <div class="not-found-actions">
            <a href="/browse" class="btn">
              <span class="btn-text">Browse All Laws</span>
            </a>
            <a href="/categories" class="btn outline">
              <span class="btn-text">Explore Categories</span>
            </a>
          </div>
        </div>
      </article>
    </div>`;
}

function buildStaticSubmitContent(): string {
  return `
    <div class="container page">
      <h1 class="page-title mb-4" data-page-title="Submit a Murphy's Law"><span class="accent-text">Submit</span> a Murphy's Law</h1>
      <article class="card card--content content-card">
        <header class="card-header content-header">
          <h2 class="card-title"><span class="accent-text">Share</span> a Law With the Archive</h2>
          <p class="lead">Every submission is reviewed by a human before publication so the archive stays useful, readable, and trustworthy.</p>
        </header>
        <div class="card-body">
          <section class="content-section">
            <h3>What makes a good law?</h3>
            <ul>
              <li>Keep it short enough to quote.</li>
              <li>Make the pattern specific, not just generally unlucky.</li>
              <li>Include attribution when you know the original author or source.</li>
              <li>Check the archive first so near-duplicates do not crowd out better versions.</li>
            </ul>
          </section>
          <section class="content-section">
            <h3>Submission expectations</h3>
            <p>You may submit anonymously. If you include a name or source note, we use it only for attribution and moderation context.</p>
            <p>If the form is unavailable, contact the archive directly at <a href="/contact">Contact</a>.</p>
          </section>
        </div>
      </article>
    </div>`;
}

function buildStaticHomeContent(featuredLaw?: Law): string {
  const lawOfDayBody = featuredLaw
    ? `${renderStaticLawCards([featuredLaw], '')}
          <p class="text-muted-fg small">A featured law from the archive; the daily rotating law loads with JavaScript. <a href="/browse">Browse the full archive</a> for more.</p>`
    : '<p>Today\'s rotating law could not be loaded. <a href="/browse">Browse the full archive</a> instead.</p>';
  return `
    <div class="container page pt-0">
      <section class="section card card--section section-card mb-12" data-home-zone="archive-search">
        <div class="section-header">
          <h1 class="section-title" data-section-title="Search the Archive"><span class="accent-text">Search</span> the Archive</h1>
        </div>
        <div class="section-subheader">
          <p class="section-subtitle">Explore Murphy's Law history, browse thousands of laws, and find the category that fits your next mishap.</p>
        </div>
        <div class="section-body">
          <form action="/browse" method="get" role="search" class="not-found-search-form" aria-label="Search the archive">
            <label class="visually-hidden" for="static-home-search">Search laws</label>
            <input id="static-home-search" type="search" name="q" class="form-control" placeholder="Search laws, categories, and mishaps">
            <button type="submit" class="btn primary">Search the Archive</button>
          </form>
          <div class="home-proof-points" aria-label="Archive facts">
            <span class="home-proof-point"><strong>Complete</strong> <span>archive</span></span>
            <span class="home-proof-point"><strong>55+</strong> <span>categories</span></span>
            <span class="home-proof-point"><strong>Human-reviewed</strong> <span>submissions</span></span>
            <span class="home-proof-point"><strong>Curated</strong> <span>since 1998</span></span>
          </div>
          <div class="not-found-actions">
            <a href="/browse" class="btn">Browse All Laws</a>
            <a href="/categories" class="btn outline">Explore Categories</a>
          </div>
        </div>
      </section>
      <section class="section card card--section section-card mb-12" data-home-zone="law-of-day">
        <div class="section-header">
          <h2 class="section-title"><span class="accent-text">Law</span> of the Day</h2>
        </div>
        <div class="section-body">
          ${lawOfDayBody}
        </div>
      </section>
      <section class="section card card--section section-card mb-12" data-home-zone="category-discovery">
        <div class="section-header">
          <h2 class="section-title"><span class="accent-text">Browse</span> by Theme</h2>
        </div>
        <div class="section-body">
          <p>Start with technology, work, travel, relationships, and everyday life categories.</p>
          <a href="/categories" class="btn">See category groups</a>
        </div>
      </section>
      <section class="section card card--section section-card mb-12" data-home-zone="trending">
        <div class="section-header">
          <h2 class="section-title"><span class="accent-text">Trending</span> Now</h2>
        </div>
        <div class="section-body">
          <p>See the laws receiving attention now, then continue into the complete archive.</p>
          <a href="/browse?sort=last_voted_at" class="btn">Trending now</a>
        </div>
      </section>
      <section class="section card card--section section-card mb-12" data-home-zone="tools-submit">
        <div class="section-header">
          <h2 class="section-title"><span class="accent-text">Tools</span> and Submissions</h2>
        </div>
        <div class="section-body">
          <p>Try the featured Sod's Law heuristic, then submit your own law for human review.</p>
          <div class="not-found-actions">
            <a href="/calculator/sods-law" class="btn">Try Sod's Law Calculator</a>
            <a href="/submit" class="btn outline">Submit a Law</a>
          </div>
        </div>
      </section>
    </div>`;
}

function buildStaticCalculatorContent(kind: 'sods-law' | 'buttered-toast'): string {
  if (kind === 'sods-law') {
    return `
      <div class="container page calculator">
        <h1 class="page-title mb-4" data-page-title="Sod's Law Calculator"><span class="accent-text">Sod's</span> Law Calculator</h1>
        <article class="card card--content content-card">
          <header class="card-header content-header">
            <h2 class="card-title"><span class="accent-text">Estimate</span> Your Risk</h2>
            <p class="lead">Model how likely a task is to go wrong using Urgency, Complexity, Importance, Skill, and Frequency.</p>
          </header>
          <div class="card-body">
            <section class="content-section">
              <h3>How the calculator works</h3>
              <p>The interactive version lets you adjust each input and see the result change. Without JavaScript, this page still explains the assumptions behind the model.</p>
              <ul>
                <li><strong>Urgency:</strong> how much time pressure surrounds the task.</li>
                <li><strong>Complexity:</strong> how many moving parts can fail.</li>
                <li><strong>Importance:</strong> how painful failure would be.</li>
                <li><strong>Skill:</strong> how much experience reduces risk.</li>
                <li><strong>Frequency:</strong> how repeated attempts increase exposure.</li>
              </ul>
              <p class="small">This calculator is for entertainment and lightweight planning, not engineering risk certification.</p>
              ${renderInternalLinkList(getCalculatorScenarioLinks('sods-law'))}
            </section>
          </div>
        </article>
      </div>`;
  }

  return `
    <div class="container page calculator">
      <h1 class="page-title mb-4" data-page-title="Buttered Toast Calculator"><span class="accent-text">Buttered</span> Toast Calculator</h1>
      <article class="card card--content content-card">
        <header class="card-header content-header">
          <h2 class="card-title"><span class="accent-text">Simulate</span> the Classic Mishap</h2>
          <p class="lead">Explore why toast seems destined to land butter-side down when breakfast is already running late.</p>
        </header>
        <div class="card-body">
          <section class="content-section">
            <h3>Assumptions</h3>
            <p>The simulator treats table height, rotation, butter coverage, and launch angle as playful inputs that influence the final landing side.</p>
            <p>Enable JavaScript for the live controls, or read the explanation here to understand the joke behind the physics.</p>
            <h3>The physics behind the joke</h3>
            <p>Toast that slides off a plate starts to rotate as it goes over the edge. In his analysis of a typical table height of about 75 centimeters, the toast has time to turn only about half a revolution before it hits the floor, so a slice that started butter-side up usually lands butter-side down.</p>
            <p>Physicist Robert Matthews of Aston University worked through this in a 1995 paper and later won the 1996 Ig Nobel Prize in Physics for it. His point is a useful reminder: the toast is not out to get you, the geometry of a kitchen simply favors the bad outcome.</p>
            <h3>What each input changes</h3>
            <p>The calculator turns six inputs into a rotation factor. Only the fractional part of that factor matters: a landing close to half a turn means butter-side down.</p>
            <ul>
              <li><strong>Height of Fall:</strong> a longer drop gives the toast more time to rotate.</li>
              <li><strong>Gravity:</strong> stronger gravity shortens the fall, so there is less rotation.</li>
              <li><strong>Push Force:</strong> how far the toast is pushed over the edge, which sets how much spin it gets.</li>
              <li><strong>Butter Factor:</strong> in this model, more butter means more rotation.</li>
              <li><strong>Air Friction and Toast Density:</strong> both resist rotation, so a higher value slows the spin.</li>
            </ul>
            <p class="small">This simplified model is for entertainment, not engineering, safety, or scientific prediction.</p>
            ${renderInternalLinkList(getCalculatorScenarioLinks('buttered-toast'))}
          </section>
        </div>
      </article>
    </div>`;
}

/**
 * Build the standalone 404 page (dist/404.html) inside the full site shell.
 * Served by nginx for unknown URLs; the app bundle then takes over client-side.
 */
function buildNotFoundPage(template: string, laws: Law[]): string {
  const html = applyPageMetadata(template, {
    title: "Page Not Found - Murphy's Laws",
    description: 'The page you requested could not be found or may have moved.',
    canonicalPath: '/404',
    robots: 'noindex'
  });
  // The canonical, hreflang, og:url and twitter:url tags stay in the head on purpose: the app only
  // updates tags that exist, so removing them would leave later pages in the session without them.
  const content = renderNotFoundContent({ lawsHtml: renderNotFoundLaws(laws) });
  return html.replace(
    /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/,
    `<main id="main-content" class="flex-1 container page"><div class="container page pt-0">${content}</div></main>`
  );
}

async function main(): Promise<void> {
  console.log('Starting Static Site Generation (SSG)...');
  const contentMetadata = await readContentMetadata();

  // Ensure dist exists (it should after build)
  try {
    await fs.access(DIST_DIR);
  } catch {
    console.error('Error: dist/ directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  // Read the shell template
  const templatePath = path.join(DIST_DIR, 'index.html');
  let template;
  try {
    template = await fs.readFile(templatePath, 'utf-8');
  } catch (err) {
    console.error(`Error reading template ${templatePath}:`, err);
    process.exit(1);
  }

  const laws = await mergeReviewedLawDetails(await fetchAllLaws());
  const categories = await fetchAllCategories();
  // A law in a category that has no page would be prerendered and listed in the sitemap, yet linked from no list page
  const categorySlugs = new Set(categories.map((category) => category.slug));
  const unknownCategory = laws.filter((law) => law.category_slug && !categorySlugs.has(law.category_slug));
  if (unknownCategory.length > 0) {
    throw new Error(`${unknownCategory.length} laws are in a category the category API does not list (for example law ${unknownCategory[0]!.id} in "${unknownCategory[0]!.category_slug}")`);
  }
  const lawSeoById = buildUniqueLawSeo(laws);
  const lawsByCategorySlug = new Map<string, Law[]>();
  const uncategorizedLaws: Law[] = [];
  for (const law of laws) {
    if (!law.category_slug) {
      uncategorizedLaws.push(law);
      continue;
    }
    const bucket = lawsByCategorySlug.get(law.category_slug) || [];
    bucket.push(law);
    lawsByCategorySlug.set(law.category_slug, bucket);
  }
  // Fixed order (by id), so the related-law links do not reshuffle every time votes change the API's ordering.
  for (const bucket of lawsByCategorySlug.values()) bucket.sort((left, right) => left.id - right.id);
  uncategorizedLaws.sort((left, right) => left.id - right.id);

  // 1. Generate Category Pages
  console.log('Generating category pages...');
  for (const { slug, title, law_count } of categories) {

    // Output directory: dist/category/[slug]/
    const outDir = path.join(DIST_DIR, 'category', slug);
    await fs.mkdir(outDir, { recursive: true });

    // Inject into template
    let pageHtml = template;
    
    const descriptionText = generateCategoryDescription(title, law_count);
    pageHtml = applyPageMetadata(pageHtml, {
      title: `${truncateTitle(title)} - Murphy's Law Archive`,
      description: descriptionText,
      canonicalPath: `/category/${slug}`
    });

    // Pre-render first page of laws from API for SEO and no-JS users
    const CATEGORY_LAWS_PER_PAGE = 25;
    const { data: categoryLaws } = await fetchFirstPageOfLaws({ limit: CATEGORY_LAWS_PER_PAGE, category_slug: slug });
    const categoryLawCardsHtml = renderStaticLawCards(categoryLaws);
    const ssgLawCardsSection = categoryLawCardsHtml
      ? `<div class="ssg-law-cards mt-8"><h2 class="text-xl font-semibold mb-4">Laws in this category</h2><section class="card-text">${categoryLawCardsHtml}</section></div>`
      : '';
    // Every law of the category as a link, so each law page is two clicks from the home page. The cards above only
    // cover the first page; the client renders the full paginated list after load.
    const shownIds = new Set(categoryLaws.map((law) => law.id));
    const moreCategoryLaws = (lawsByCategorySlug.get(slug) || []).filter((law) => !shownIds.has(law.id));
    const categoryLawIndex = moreCategoryLaws.length > 0
      ? `<section class="section mt-8" aria-labelledby="category-all-laws-${slug}"><h2 id="category-all-laws-${slug}" class="text-xl font-semibold mb-4">More laws in this category</h2>${renderLawLinkList(moreCategoryLaws, lawSeoById)}</section>`
      : '';

    const staticContent = `
      <div class="container page pt-0">
        <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-primary">
          ${wrapFirstWordWithAccent(escapeHtml(title))}
        </h1>
        <p class="lead text-center mb-8 text-muted-fg max-w-2xl mx-auto">${descriptionText}</p>
        <section class="section card card--section section-card mb-8" aria-labelledby="category-internal-links-${slug}">
          <div class="section-header">
            <h2 id="category-internal-links-${slug}" class="section-title"><span class="accent-text">Explore</span> nearby</h2>
          </div>
          <div class="section-body">
            ${renderInternalLinkList(getCategoryHubLinks(slug))}
          </div>
        </section>
        ${ssgLawCardsSection}
        ${categoryLawIndex}
      </div>
`;
    
    // Regex to replace inside <main>...<p>Loading...</p>...</main>
    // The template has: <main ...> ... <p ...>Loading...</p> </main>
    pageHtml = pageHtml.replace(
      /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/, 
      `<main id="main-content" class="flex-1 container page">${staticContent}</main>`
    );

    // Pre-render JSON-LD for category page
    const categoryUrl = `${SITE_URL}/category/${slug}`;
    const categoryJsonLd = generateJsonLd({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${title} - Murphy's Law Archive`,
      'url': categoryUrl,
      'description': descriptionText,
      'isPartOf': {
        '@type': 'WebSite',
        'name': "Murphy's Law Archive",
        'url': SITE_URL
      },
      'numberOfItems': law_count
    });
    
    pageHtml = injectJsonLd(pageHtml, categoryJsonLd);
    pageHtml = injectJsonLd(pageHtml, generateJsonLd(buildBreadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Categories', path: '/categories' },
      { name: `${title} Laws`, path: `/category/${slug}` }
    ])));

    await fs.writeFile(path.join(outDir, 'index.html'), pageHtml);
    // console.log(`Generated category/${slug}/index.html`);
  }
  console.log(`Generated ${categories.length} category pages.`);

  // 2. Generate Browse Page (first page of laws pre-rendered for SEO and no-JS)
  console.log('Generating browse page...');
  const browseDir = path.join(DIST_DIR, 'browse');
  await fs.mkdir(browseDir, { recursive: true });

  const LAWS_PER_PAGE = 25;
  const { data: browseLaws, total: browseTotal } = await fetchFirstPageOfLaws({ limit: LAWS_PER_PAGE });
  if (browseTotal !== laws.length) {
    throw new Error(`The browse list reports ${browseTotal} laws but the full list has ${laws.length}; the API changed during the build, run it again.`);
  }
  const staticLawCardsHtml = renderStaticLawCards(browseLaws);
  const showCount = browseTotal > 0
    ? `<p class="text-center text-muted-fg mb-6" aria-live="polite">Showing 1&ndash;${Math.min(LAWS_PER_PAGE, browseTotal)} of ${browseTotal} laws.</p>`
    : '';

  let browseHtml = applyPageMetadata(template, {
    title: "Browse All Murphy's Laws - Murphy's Law Archive",
    description: "Search and filter the complete collection of Murphy's Laws, corollaries, and field observations.",
    canonicalPath: '/browse'
  });

  // Laws with no category are not on any category page, so list them here to keep them linked from the site.
  const uncategorizedIndex = uncategorizedLaws.length > 0
    ? `<section class="section mt-8" aria-labelledby="browse-uncategorized-heading"><h2 id="browse-uncategorized-heading" class="text-xl font-semibold mb-4">Laws without a category</h2>${renderLawLinkList(uncategorizedLaws, lawSeoById)}</section>`
    : '';

  const browseContent = `
    <div class="container page pt-0">
      <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-8 text-primary">
        Browse <span class="accent-text">Murphy's</span> Laws
      </h1>
      <p class="text-center mb-8 text-lg text-muted-fg max-w-2xl mx-auto">
        Search and filter through our complete collection of Murphy's Laws.
      </p>
      ${showCount}
      <section class="card-text" id="browse-laws-list" aria-live="polite">
        ${staticLawCardsHtml || '<p class="text-muted-fg">No laws available. Enable JavaScript to search and filter.</p>'}
      </section>
      ${uncategorizedIndex}
    </div>
`;

  browseHtml = browseHtml.replace(
    /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/,
    `<main id="main-content" class="flex-1 container page">${browseContent}</main>`
  );

  browseHtml = injectJsonLd(browseHtml, generateJsonLd({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': "Browse All Murphy's Laws",
    'url': `${SITE_URL}/browse`,
    'description': "Search and filter the complete collection of Murphy's Laws, corollaries, and field observations.",
    'isPartOf': { '@type': 'WebSite', 'name': "Murphy's Law Archive", 'url': SITE_URL }
  }));
  browseHtml = injectJsonLd(browseHtml, generateJsonLd(buildBreadcrumbList([
    { name: 'Home', path: '/' },
    { name: "Browse Murphy's Laws", path: '/browse' }
  ])));

  await fs.writeFile(path.join(browseDir, 'index.html'), browseHtml);

  // 2b. Generate Categories Page (Browse by Category)
  console.log('Generating categories page...');
  const categoriesDir = path.join(DIST_DIR, 'categories');
  await fs.mkdir(categoriesDir, { recursive: true });

  let categoriesHtml = applyPageMetadata(template, {
    title: "Browse Murphy's Laws by Category - Murphy's Law Archive",
    description: `Explore all ${categories.length} categories of Murphy's Laws, from technology and work to travel and everyday life.`,
    canonicalPath: '/categories'
  });

  // Build grouped category cards HTML for SSG
  const categoryCardsHtml = groupCategories(categories)
    .map(group => {
      const cards = group.categories.map(cat => {
      const lawText = cat.law_count === 1 ? 'law' : 'laws';
      return `
      <a href="/category/${escapeHtml(cat.slug)}" class="card card--category category-card category-card--rich" data-category-slug="${escapeHtml(cat.slug)}">
        <h3 class="category-card-title">${escapeHtml(cat.title)}</h3>
        <p class="category-card-description">Explore ${cat.law_count} ${lawText} in this category.</p>
        <div class="category-card-footer">
          <span class="category-card-count">${cat.law_count} ${lawText}</span>
        </div>
      </a>`;
      }).join('');
      return `
      <section class="category-cluster" data-category-cluster="${group.name}">
        <header class="category-cluster-header">
          <h2 class="category-cluster-title">${group.name}</h2>
          <p class="category-cluster-description">${group.description}</p>
        </header>
        <div class="categories-grid">
${cards.trim()}
        </div>
      </section>`;
    })
    .join('');

  const categoriesContent = `
    <div class="container page pt-0">
      <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-primary">
        Browse <span class="accent-text">Murphy's</span> Laws by Category
      </h1>
      <p class="text-center mb-8 text-lg text-muted-fg max-w-2xl mx-auto">
        Explore our complete collection organized into ${categories.length} categories.
      </p>
      <div class="categories-grid">
${categoryCardsHtml.trim()}
      </div>
    </div>
`;

  categoriesHtml = categoriesHtml.replace(
    /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/, 
    `<main id="main-content" class="flex-1 container page">${categoriesContent}</main>`
  );

  categoriesHtml = injectJsonLd(categoriesHtml, generateJsonLd({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': "Browse Murphy's Laws by Category",
    'url': `${SITE_URL}/categories`,
    'description': `Explore all ${categories.length} categories of Murphy's Laws, from technology and work to travel and everyday life.`,
    'isPartOf': { '@type': 'WebSite', 'name': "Murphy's Law Archive", 'url': SITE_URL }
  }));
  categoriesHtml = injectJsonLd(categoriesHtml, generateJsonLd(buildBreadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Categories', path: '/categories' }
  ])));

  await fs.writeFile(path.join(categoriesDir, 'index.html'), categoriesHtml);
  console.log('Generated categories page.');

  // 3. Generate Content Pages (About, Privacy, Terms, Origin Story, Contact, Examples, long-form articles)
  // Pre-render these with actual markdown content for SEO and AdSense compliance
  console.log('Generating content pages...');
  
  for (const page of CONTENT_PAGES) {
    const routeDir = path.join(DIST_DIR, page.slug);
    await fs.mkdir(routeDir, { recursive: true });
    
    try {
      // Read the markdown content
      const mdPath = path.join(SHARED_CONTENT_DIR, page.file);
      const rawMdContent = await fs.readFile(mdPath, 'utf-8');
      const mdContent = rawMdContent.replace('{{ARCHIVE_SIZE}}', `${laws.length.toLocaleString('en-US')} laws`);
      
      // Convert to HTML
      let htmlContent = await marked.parse(mdContent);
      
      // Apply styling enhancements
      htmlContent = enhanceMarkdownHtml(htmlContent);
      
      // Build page HTML
      let pageHtml = template;
      
      pageHtml = applyPageMetadata(pageHtml, {
        title: `${page.title} - Murphy's Law Archive`,
        description: page.description,
        canonicalPath: `/${page.slug}`,
        type: 'article'
      });

      // Read metadata for last updated date
      let lastUpdated = null;
      try {
        // Only show lastUpdated for privacy and terms pages
        const metadataEntry = contentMetadata[page.slug];
        if ((page.slug === 'privacy' || page.slug === 'terms') && metadataEntry?.lastUpdated) {
          lastUpdated = metadataEntry.lastUpdated;
        }
      } catch {
        // Ignore metadata errors, proceed without lastUpdated
      }

      // Build the static content wrapper using card-header/card-body structure
      const cardHtml = insertContentFigure(page.slug, wrapInCardStructure(htmlContent, { lastUpdated }));
      // Article pages also get the archive button row and featured laws
      const articleArchive = buildStaticArticleArchive(page.slug, laws);
      const staticContent = `
      <div class="container page content-page">
${articleArchive.nextSteps}
${cardHtml.trim()}
${articleArchive.featuredLaws}
      </div>
`;
      
      // Inject into main
      pageHtml = pageHtml.replace(
        /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/,
        `<main id="main-content" class="flex-1 container page">${staticContent}</main>`
      );
      
      // Pre-render JSON-LD for content page
      const contentPageUrl = `${SITE_URL}/${page.slug}`;
      const contentJsonLd = generateJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': page.title,
        'description': page.description,
        'url': contentPageUrl,
        'dateModified': contentMetadata[page.slug]?.lastUpdated,
        'author': {
          '@type': 'Person',
          'name': 'Raanan Avidor'
        },
        'publisher': {
          '@type': 'Organization',
          'name': "Murphy's Law Archive",
          'url': SITE_URL
        },
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': contentPageUrl
        },
        'speakable': {
          '@type': 'SpeakableSpecification',
          'cssSelector': ['.card-header h1', '.card-header .lead', '.card-body', '.content-section']
        }
      });
      
      pageHtml = injectJsonLd(pageHtml, contentJsonLd);
      pageHtml = injectBreadcrumbJsonLd(pageHtml, 'content-page-breadcrumbs', buildContentBreadcrumbTrail(page));
      
      await fs.writeFile(path.join(routeDir, 'index.html'), pageHtml);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: Could not pre-render ${page.slug}, using SPA fallback:`, message);
      // Fallback: copy the main index.html
      await fs.copyFile(path.join(DIST_DIR, 'index.html'), path.join(routeDir, 'index.html'));
    }
  }
  console.log(`Generated ${CONTENT_PAGES.length} content pages.`);
  
  // 3b. Generate app routes that hydrate on the client but still need useful static content
  const staticAppRoutes = [
    {
      pathParts: ['calculator', 'sods-law'],
      title: 'Sod\'s Law Calculator - Murphy\'s Law Archive',
      description: CALCULATOR_META_DESCRIPTIONS.sodsLaw,
      content: buildStaticCalculatorContent('sods-law'),
      breadcrumb: { id: 'calculator-sod-breadcrumbs', name: "Sod's Law Calculator" },
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Sod\'s Law Calculator',
        'url': `${SITE_URL}/calculator/sods-law`,
        'description': CALCULATOR_META_DESCRIPTIONS.sodsLaw,
        'applicationCategory': 'EntertainmentApplication'
      }
    },
    {
      pathParts: ['calculator', 'buttered-toast'],
      title: 'Buttered Toast Calculator - Murphy\'s Law Archive',
      description: CALCULATOR_META_DESCRIPTIONS.butteredToast,
      content: buildStaticCalculatorContent('buttered-toast'),
      breadcrumb: { id: 'calculator-toast-breadcrumbs', name: 'Buttered Toast Calculator' },
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Buttered Toast Calculator',
        'url': `${SITE_URL}/calculator/buttered-toast`,
        'description': CALCULATOR_META_DESCRIPTIONS.butteredToast,
        'applicationCategory': 'EntertainmentApplication'
      }
    },
    {
      pathParts: ['submit'],
      title: 'Submit a Murphy\'s Law - Murphy\'s Law Archive',
      description: 'Submit a Murphy\'s Law for human review, with guidance on attribution, duplicate checks, and publication expectations.',
      content: buildStaticSubmitContent(),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': 'Submit a Murphy\'s Law',
        'url': `${SITE_URL}/submit`,
        'description': 'Submit a Murphy\'s Law for human review.'
      }
    },
    {
      pathParts: ['favorites'],
      indexable: false,
      title: 'My Favorites - Murphy\'s Law Archive',
      description: 'Save favorite Murphy\'s Laws in your browser and revisit them quickly.',
      content: buildStaticFavoritesContent(),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': 'My Favorites',
        'url': `${SITE_URL}/favorites`,
        'description': 'Save favorite Murphy\'s Laws in your browser and revisit them quickly.'
      }
    }
  ];

  for (const route of staticAppRoutes) {
    const routePath = route.pathParts.join('/');
    const routeDir = path.join(DIST_DIR, ...route.pathParts);
    await fs.mkdir(routeDir, { recursive: true });

    let routeHtml = applyPageMetadata(template, {
      title: route.title,
      description: route.description,
      canonicalPath: `/${routePath}`,
      robots: route.indexable === false ? 'noindex, follow' : undefined
    });
    routeHtml = routeHtml.replace(
      /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/,
      `<main id="main-content" class="flex-1 container page">${route.content}</main>`
    );
    routeHtml = injectJsonLd(routeHtml, generateJsonLd(route.jsonLd));
    if (route.breadcrumb) {
      routeHtml = injectBreadcrumbJsonLd(routeHtml, route.breadcrumb.id, [
        { name: route.breadcrumb.name, path: `/${routePath}` }
      ]);
    }
    await fs.writeFile(path.join(routeDir, 'index.html'), routeHtml);
  }

  // 3c. Generate Law Detail Pages
  // Pre-render individual law pages with correct OG meta tags for social sharing
  console.log('Generating law detail pages...');
  const lawDir = path.join(DIST_DIR, 'law');
  await fs.mkdir(lawDir, { recursive: true });

  for (const law of laws) {
    const lawPageDir = path.join(lawDir, String(law.id));
    await fs.mkdir(lawPageDir, { recursive: true });
    
    const relatedLaws = law.category_slug
      ? pickRelatedLaws(law, lawsByCategorySlug.get(law.category_slug) || [])
      : [];
    const lawPageHtml = generateLawPage(law, template, relatedLaws, lawSeoById.get(String(law.id)));
    await fs.writeFile(path.join(lawPageDir, 'index.html'), lawPageHtml);
  }
  console.log(`Generated ${laws.length} law detail pages.`);

  // 4. Update Home Page (dist/index.html)
  // Crucial for AdSense and SEO: Replace the empty shell with meaningful content
  console.log('Updating Home Page (index.html)...');
  
  let homeHtml = template;
  
  const homeContent = buildStaticHomeContent(browseLaws[0]);

  // Inject into main
  homeHtml = homeHtml.replace(
    /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/, 
    `<main id="main-content" class="flex-1 container page">${homeContent}</main>`
  );

  // Pre-render JSON-LD for homepage
  const homeJsonLd = generateJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': "Murphy's Law Archive",
    'url': SITE_URL,
    'description': "Explore Murphy's Law history, browse corollaries, and experiment with interactive probability calculators for everyday mishaps.",
    'publisher': {
      '@type': 'Organization',
      'name': "Murphy's Law Archive",
      'url': SITE_URL
    },
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${SITE_URL}/browse?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  });
  
  homeHtml = injectJsonLd(homeHtml, homeJsonLd);

  await fs.writeFile(path.join(DIST_DIR, 'index.html'), homeHtml);
  console.log('Updated index.html with static content.');

  // 4b. Generate the 404 page (dist/404.html)
  await fs.writeFile(path.join(DIST_DIR, '404.html'), buildNotFoundPage(template, browseLaws));
  console.log('Generated 404.html.');

  // 5. Generate Sitemap
  console.log('Generating sitemap.xml...');
  const sitemap = buildSitemapXml({
    baseUrl: SITE_URL,
    laws,
    categories,
    contentPages: CONTENT_PAGES,
    contentMetadata,
    staticRoutePaths: staticAppRoutes.filter((route) => route.indexable !== false).map((route) => route.pathParts.join('/'))
  });

  await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('Generated sitemap.xml');

  // 6. Generate Image Sitemap
  console.log('Generating image-sitemap.xml...');
  const baseUrl = SITE_URL;
  
  let imageSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}/</loc>
    <image:image>
      <image:loc>${baseUrl}/social/home.png</image:loc>
      <image:title>Murphy's Law Archive - Home</image:title>
      <image:caption>Murphy's Law Archive featuring laws, corollaries, and interactive calculators</image:caption>
    </image:image>
    <image:image>
      <image:loc>${baseUrl}/android-chrome-512x512.png</image:loc>
      <image:title>Murphy's Law Archive Logo</image:title>
    </image:image>
  </url>
  <url>
    <loc>${baseUrl}/calculator/sods-law</loc>
    <image:image>
      <image:loc>${baseUrl}/social/sods-calculator.png</image:loc>
      <image:title>Sod's Law Calculator</image:title>
      <image:caption>Calculate your probability of things going wrong with the Sod's Law Calculator</image:caption>
    </image:image>
  </url>
  <url>
    <loc>${baseUrl}/calculator/buttered-toast</loc>
    <image:image>
      <image:loc>${baseUrl}/social/buttered-toast-calculator.png</image:loc>
      <image:title>Buttered Toast Landing Calculator</image:title>
      <image:caption>Calculate the probability of your toast landing butter-side down</image:caption>
    </image:image>
  </url>`;

  // Add OG images for each law
  for (const law of laws) {
    const lawTitle = law.title || `Murphy's Law #${law.id}`;
    imageSitemap += `
  <url>
    <loc>${baseUrl}/law/${law.id}</loc>
    <image:image>
      <image:loc>${baseUrl}/api/v1/og/law/${law.id}.png</image:loc>
      <image:title>${escapeHtml(lawTitle)}</image:title>
      <image:caption>${escapeHtml((law.text || '').substring(0, 200))}</image:caption>
    </image:image>
  </url>`;
  }

  imageSitemap += '\n</urlset>';

  await fs.writeFile(path.join(DIST_DIR, 'image-sitemap.xml'), imageSitemap);
  console.log('Generated image-sitemap.xml');

  await validateGeneratedOutput();
  console.log('Validated generated route output.');
  
  console.log('SSG Complete!');
}

// Only run main() when executed directly, not when imported for testing
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

// Export functions for testing
export {
  CONTENT_PAGES,
  wrapFirstWordWithAccent,
  enhanceMarkdownHtml,
  wrapInCardStructure,
  buildStaticFavoritesContent,
  buildStaticSubmitContent,
  buildStaticHomeContent,
  buildStaticCalculatorContent,
  buildStaticLawDetailContent,
  buildStaticArticleArchive,
  buildNotFoundPage,
  validateNotFoundPage,
  applyPageMetadata,
  generateLawPage,
  buildSitemapXml,
  validateGeneratedPage,
  injectBreadcrumbJsonLd,
  buildContentBreadcrumbTrail,
  fetchAllCategories,
  fetchAllLaws,
  fetchFirstPageOfLaws,
  mergeReviewedLawDetails,
  REVIEWED_LAW_TITLES,
  categorySitemapPaths,
  pickRelatedLaws,
  renderLawLinkList
};
