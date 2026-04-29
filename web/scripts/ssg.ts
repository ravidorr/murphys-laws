import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { generateCategoryDescription } from '../src/utils/content-generator.ts';
import { groupCategories } from '../src/utils/category-groups.ts';
import { getCalculatorScenarioLinks, getCategoryHubLinks, getLawDetailInternalLinks, renderInternalLinkList } from '../src/utils/internal-links.ts';
import { SITE_URL } from '../src/utils/constants.ts';
import { buildCanonicalUrl, truncateTitle } from '../src/utils/seo.ts';
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
  created_at?: string;
  updated_at?: string;
}

interface ContentPageMeta {
  slug: string;
  file: string;
  title: string;
  description: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const SHARED_DATA_DIR = path.resolve(__dirname, '../../shared/data/murphys-laws');
const SHARED_CONTENT_DIR = path.resolve(__dirname, '../../shared/content');

// API configuration for fetching laws
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8787';

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
 * Fetch all published laws from the API
 */
async function fetchAllLaws(): Promise<Law[]> {
  const laws: Law[] = [];
  let offset = 0;
  const limit = 100; // Request up to 100, but API may return fewer

  try {
    while (true) {
      const response = await fetch(`${API_BASE_URL}/api/v1/laws?limit=${limit}&offset=${offset}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      laws.push(...data.data);

      // Stop if we got no data or have all items
      // Note: API may return fewer items than limit (e.g., max 25 per request)
      if (data.data.length === 0 || laws.length >= data.total) {
        break;
      }
      offset += data.data.length; // Use actual count returned, not requested limit
    }

    console.log(`Fetched ${laws.length} laws from API.`);
    return laws;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Could not fetch laws from API: ${message}`);
    return [];
  }
}

/**
 * Fetch first page of laws for SSG pre-render (browse, category)
 */
async function fetchFirstPageOfLaws(params: { limit: number; offset?: number; category_id?: number; category_slug?: string }): Promise<{ data: Law[]; total: number }> {
  const { limit, offset = 0, category_id, category_slug } = params;
  const searchParams = new URLSearchParams({ limit: String(limit), offset: String(offset), sort: 'score', order: 'desc' });
  if (category_id !== undefined) searchParams.set('category_id', String(category_id));
  if (category_slug) searchParams.set('category_slug', category_slug);
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/laws?${searchParams.toString()}`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const json = await response.json();
    return { data: json.data ?? [], total: Number.isFinite(json.total) ? json.total : 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Could not fetch first page of laws: ${message}`);
    return { data: [], total: 0 };
  }
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

function getLawAttributionName(law: Law): string | null {
  if (law.attributions && law.attributions.length > 0 && law.attributions[0]?.name) {
    return law.attributions[0].name;
  }
  return law.author || law.attribution || null;
}

function buildStaticLawDetailContent(law: Law): string {
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
          <li aria-current="page">${escapeHtml(title)}</li>
        </ol>
      </nav>
      <article class="law-detail-card card">
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
      <section class="section section-card mb-12" aria-labelledby="law-context-heading">
        <div class="section-header">
          <h2 id="law-context-heading" class="section-title" data-section-title="In context"><span class="accent-text">In</span> context</h2>
        </div>
        <div class="section-body">
          <p>${escapeHtml(context)}</p>
        </div>
      </section>
      <section class="section section-card mb-12" aria-labelledby="related-laws-heading">
        <div class="section-header">
          <h2 id="related-laws-heading" class="section-title" data-section-title="Related laws"><span class="accent-text">Related</span> laws</h2>
        </div>
        <div class="section-body">
          <p>Keep exploring laws from this topic or browse the full archive for neighboring ideas.</p>
          ${renderInternalLinkList(getLawDetailInternalLinks({ categorySlug, categoryName }))}
          <div class="not-found-actions">
            ${categorySlug ? `<a href="/category/${escapeHtml(categorySlug)}" class="btn">See this category</a>` : ''}
            <a href="/browse" class="btn outline">Browse all laws</a>
          </div>
        </div>
      </section>
      <section class="section section-card" aria-labelledby="law-actions-heading">
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

/**
 * Escape string for JSON embedding
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
/**
 * Generate JSON-LD script tag
 */
function generateJsonLd(data: object): string {
  return `<script type="application/ld+json">${JSON.stringify(data, null, 2)}</script>`;
}

/**
 * Inject JSON-LD into HTML head
 */
function injectJsonLd(html: string, jsonLd: string): string {
  return html.replace('</head>', `${jsonLd}\n</head>`);
}

/**
 * Generate HTML page for a single law with correct OG meta tags
 */
function generateLawPage(law: Law, template: string): string {
  let pageHtml = template;
  
  const title = law.title || "Murphy's Law";
  const description = (law.text || '').substring(0, 160);
  const lawUrl = `${SITE_URL}/law/${law.id}`;
  const ogImageUrl = `${SITE_URL}/api/v1/og/law/${law.id}.png`;
  
  // Update page title
  const pageTitle = `${escapeHtml(title)} - Murphy's Law Archive`;
  pageHtml = pageHtml.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
  
  // Update meta description
  pageHtml = pageHtml.replace(
    /<meta name="description" content=".*?">/,
    `<meta name="description" content="${escapeHtml(description)}">`
  );
  
  // Update canonical URL and hreflang
  pageHtml = pageHtml.replace(
    /<link rel="canonical" href=".*?">/,
    `<link rel="canonical" href="${lawUrl}">`
  );
  pageHtml = updateHreflang(pageHtml, lawUrl);
  
  // Update OG tags
  pageHtml = pageHtml.replace(
    /<meta property="og:url" content=".*?">/,
    `<meta property="og:url" content="${lawUrl}">`
  );
  pageHtml = pageHtml.replace(
    /<meta property="og:title" content=".*?">/,
    `<meta property="og:title" content="${escapeHtml(title)} - Murphy's Laws">`
  );
  pageHtml = pageHtml.replace(
    /<meta property="og:description"[\s\S]*?content="[\s\S]*?">/,
    `<meta property="og:description" content="${escapeHtml(description)}">`
  );
  pageHtml = pageHtml.replace(
    /<meta property="og:image" content=".*?">/,
    `<meta property="og:image" content="${ogImageUrl}">`
  );
  
  // Update Twitter Card tags
  pageHtml = pageHtml.replace(
    /<meta property="twitter:url" content=".*?">/,
    `<meta property="twitter:url" content="${lawUrl}">`
  );
  pageHtml = pageHtml.replace(
    /<meta property="twitter:title" content=".*?">/,
    `<meta property="twitter:title" content="${escapeHtml(title)} - Murphy's Laws">`
  );
  pageHtml = pageHtml.replace(
    /<meta property="twitter:description"[\s\S]*?content="[\s\S]*?">/,
    `<meta property="twitter:description" content="${escapeHtml(description)}">`
  );
  pageHtml = pageHtml.replace(
    /<meta property="twitter:image" content=".*?">/,
    `<meta property="twitter:image" content="${ogImageUrl}">`
  );
  
  // Get attribution name
  const attributionName = getLawAttributionName(law);

  // Build static content for law detail page
  const staticContent = buildStaticLawDetailContent(law);
  
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

  const breadcrumbJsonLd = generateJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
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
      {
        '@type': 'ListItem',
        'position': 3,
        'name': title,
        'item': lawUrl
      }
    ]
  });

  pageHtml = injectJsonLd(pageHtml, breadcrumbJsonLd);
  
  return pageHtml;
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
        <article class="card content-card">
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
        <article class="card content-card">
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
      <article class="card content-card">
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
      <article class="card content-card">
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

function buildStaticHomeContent(): string {
  return `
    <div class="container page pt-0">
      <section class="section section-card mb-12" data-home-zone="archive-search">
        <div class="section-header">
          <h1 class="section-title" data-section-title="Search the Archive"><span class="accent-text">Search</span> the Archive</h1>
        </div>
        <div class="section-subheader">
          <p class="section-subtitle">Explore Murphy's Law history, browse thousands of laws, and find the category that fits your next mishap.</p>
        </div>
        <div class="section-body">
          <div class="home-proof-points">
            <span>2,400+ laws</span>
            <span>55+ categories</span>
            <span>Human-reviewed submissions</span>
            <span>Curated since the late 1990s</span>
          </div>
          <div class="not-found-actions">
            <a href="/browse" class="btn">Browse All Laws</a>
            <a href="/categories" class="btn outline">Explore Categories</a>
          </div>
        </div>
      </section>
      <section class="section section-card mb-12" data-home-zone="law-of-day">
        <div class="section-header">
          <h2 class="section-title"><span class="accent-text">Law</span> of the Day</h2>
        </div>
        <div class="section-body">
          <p>Enable JavaScript for today's rotating law, or browse the full archive now.</p>
        </div>
      </section>
      <section class="section section-card mb-12" data-home-zone="category-discovery">
        <div class="section-header">
          <h2 class="section-title"><span class="accent-text">Browse</span> by Theme</h2>
        </div>
        <div class="section-body">
          <p>Start with technology, work, travel, relationships, and everyday life categories.</p>
          <a href="/categories" class="btn">See category groups</a>
        </div>
      </section>
      <section class="section section-card mb-12" data-home-zone="trending-recent">
        <div class="section-header">
          <h2 class="section-title">Trending and Recently Added</h2>
        </div>
        <div class="section-body">
          <p>Jump from the homepage into active and fresh archive entries.</p>
          <div class="not-found-actions">
            <a href="/browse?sort=last_voted_at" class="btn">Trending now</a>
            <a href="/browse?sort=created_at" class="btn outline">Recently added</a>
          </div>
        </div>
      </section>
      <section class="section section-card mb-12" data-home-zone="tools-submit">
        <div class="section-header">
          <h2 class="section-title"><span class="accent-text">Tools</span> and Submissions</h2>
        </div>
        <div class="section-body">
          <p>Try the calculators for playful risk modeling, then submit your own law for human review.</p>
          <div class="not-found-actions">
            <a href="/calculator/sods-law" class="btn">Try Sod's Law Calculator</a>
            <a href="/calculator/buttered-toast" class="btn outline">Try Buttered Toast</a>
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
        <article class="card content-card">
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
      <article class="card content-card">
        <header class="card-header content-header">
          <h2 class="card-title"><span class="accent-text">Simulate</span> the Classic Mishap</h2>
          <p class="lead">Explore why toast seems destined to land butter-side down when breakfast is already running late.</p>
        </header>
        <div class="card-body">
          <section class="content-section">
            <h3>Assumptions</h3>
            <p>The simulator treats table height, rotation, butter coverage, and launch angle as playful inputs that influence the final landing side.</p>
            <p>Enable JavaScript for the live controls, or read the explanation here to understand the joke behind the physics.</p>
            ${renderInternalLinkList(getCalculatorScenarioLinks('buttered-toast'))}
          </section>
        </div>
      </article>
    </div>`;
}

async function main(): Promise<void> {
  console.log('Starting Static Site Generation (SSG)...');

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

  // 1. Generate Category Pages
  console.log('Generating category pages...');
  const files = await fs.readdir(SHARED_DATA_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  const categories = [];

  for (const file of mdFiles) {
    const slug = file.replace('.md', '');
    const content = await fs.readFile(path.join(SHARED_DATA_DIR, file), 'utf-8');
    
    // Parse Markdown
    const tokens = marked.lexer(content);
    const titleToken = tokens.find((t): t is import('marked').Tokens.Heading => t.type === 'heading' && t.depth === 1);
    const title = titleToken && 'text' in titleToken ? titleToken.text : slug.replace(/-/g, ' ');
    
    // Convert to HTML
    const htmlContent = marked.parser(tokens);

    // Count laws (list items)
    const law_count = (content.match(/^\s*\*/gm) || []).length;

    // Collect category info for the Browse page
    categories.push({ slug, title, law_count });

    // Output directory: dist/category/[slug]/
    const outDir = path.join(DIST_DIR, 'category', slug);
    await fs.mkdir(outDir, { recursive: true });

    // Inject into template
    let pageHtml = template;
    
    // Update Title (truncate if needed to stay under 70 chars)
    const truncatedTitle = truncateTitle(title);
    const titleTag = `<title>${truncatedTitle} - Murphy's Law Archive</title>`;
    pageHtml = pageHtml.replace(/<title>.*?<\/title>/, titleTag);
    
    // Update Description (first 160 chars of text)
    const listToken = tokens.find((t): t is import('marked').Tokens.List => t.type === 'list');
    const firstText = (listToken && 'items' in listToken && listToken.items?.[0] && 'text' in listToken.items[0])
      ? listToken.items[0].text
      : '';
    const description = firstText.substring(0, 160).replace(/"/g, '&quot;') || `Read ${title} at Murphy's Law Archive.`;
    pageHtml = pageHtml.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${description}">`);
    
    // Canonical URL and hreflang
    pageHtml = pageHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${buildCanonicalUrl(`/category/${slug}`)}">`);
    pageHtml = updateHreflang(pageHtml, buildCanonicalUrl(`/category/${slug}`));

    // Inject Content
    // We replace the loading content in <main>
    const descriptionText = generateCategoryDescription(title, law_count);

    // Pre-render first page of laws from API for SEO and no-JS users
    const CATEGORY_LAWS_PER_PAGE = 25;
    const { data: categoryLaws } = await fetchFirstPageOfLaws({ limit: CATEGORY_LAWS_PER_PAGE, category_slug: slug });
    const categoryLawCardsHtml = renderStaticLawCards(categoryLaws);
    const ssgLawCardsSection = categoryLawCardsHtml
      ? `<div class="ssg-law-cards mt-8"><h2 class="text-xl font-semibold mb-4">Laws in this category</h2><section class="card-text">${categoryLawCardsHtml}</section></div>`
      : '';

    const staticContent = `
      <div class="container page pt-0">
        <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-primary">
          <span class="accent-text">${title.split(' ')[0]}</span> ${title.split(' ').slice(1).join(' ')}
        </h1>
        <p class="lead text-center mb-8 text-muted-fg max-w-2xl mx-auto">${descriptionText}</p>
        <div class="static-content prose mx-auto">
          ${htmlContent}
        </div>
        <section class="section section-card mb-8" aria-labelledby="category-internal-links-${slug}">
          <div class="section-header">
            <h2 id="category-internal-links-${slug}" class="section-title"><span class="accent-text">Explore</span> nearby</h2>
          </div>
          <div class="section-body">
            ${renderInternalLinkList(getCategoryHubLinks(slug))}
          </div>
        </section>
        ${ssgLawCardsSection}
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

    await fs.writeFile(path.join(outDir, 'index.html'), pageHtml);
    // console.log(`Generated category/${slug}/index.html`);
  }
  console.log(`Generated ${mdFiles.length} category pages.`);

  // 2. Generate Browse Page (first page of laws pre-rendered for SEO and no-JS)
  console.log('Generating browse page...');
  const browseDir = path.join(DIST_DIR, 'browse');
  await fs.mkdir(browseDir, { recursive: true });

  const LAWS_PER_PAGE = 25;
  const { data: browseLaws, total: browseTotal } = await fetchFirstPageOfLaws({ limit: LAWS_PER_PAGE });
  const staticLawCardsHtml = renderStaticLawCards(browseLaws);
  const showCount = browseTotal > 0
    ? `<p class="text-center text-muted-fg mb-6" aria-live="polite">Showing 1&ndash;${Math.min(LAWS_PER_PAGE, browseTotal)} of ${browseTotal} laws.</p>`
    : '';

  let browseHtml = template;
  browseHtml = browseHtml.replace(/<title>.*?<\/title>/, `<title>Browse All Murphy's Laws - Murphy's Law Archive</title>`);
  browseHtml = browseHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${buildCanonicalUrl('/browse')}">`);
  browseHtml = updateHreflang(browseHtml, buildCanonicalUrl('/browse'));

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
    </div>
`;

  browseHtml = browseHtml.replace(
    /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/,
    `<main id="main-content" class="flex-1 container page">${browseContent}</main>`
  );

  await fs.writeFile(path.join(browseDir, 'index.html'), browseHtml);

  // 2b. Generate Categories Page (Browse by Category)
  console.log('Generating categories page...');
  const categoriesDir = path.join(DIST_DIR, 'categories');
  await fs.mkdir(categoriesDir, { recursive: true });

  let categoriesHtml = template;
  categoriesHtml = categoriesHtml.replace(/<title>.*?<\/title>/, `<title>Browse Murphy's Laws by Category - Murphy's Law Archive</title>`);
  categoriesHtml = categoriesHtml.replace(
    /<meta name="description"[\s\S]*?content="[\s\S]*?">/,
    `<meta name="description" content="Explore all ${categories.length} categories of Murphy's Laws - from computer laws to engineering principles. Find the perfect law for every situation.">`
  );
  categoriesHtml = categoriesHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${buildCanonicalUrl('/categories')}">`);
  categoriesHtml = updateHreflang(categoriesHtml, buildCanonicalUrl('/categories'));

  // Build grouped category cards HTML for SSG
  const categoryCardsHtml = groupCategories(categories)
    .map(group => {
      const cards = group.categories.map(cat => {
      const lawText = cat.law_count === 1 ? 'law' : 'laws';
      return `
      <article class="category-card" data-category-slug="${cat.slug}">
        <h3 class="category-card-title">${cat.title}</h3>
        <p class="category-card-description">Explore ${cat.law_count} ${lawText} in this category.</p>
        <div class="category-card-footer">
          <span class="category-card-count">${cat.law_count} ${lawText}</span>
        </div>
      </article>`;
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
      const mdContent = await fs.readFile(mdPath, 'utf-8');
      
      // Convert to HTML
      let htmlContent = await marked.parse(mdContent);
      
      // Apply styling enhancements
      htmlContent = enhanceMarkdownHtml(htmlContent);
      
      // Build page HTML
      let pageHtml = template;
      
      // Update title
      pageHtml = pageHtml.replace(/<title>.*?<\/title>/, `<title>${page.title} - Murphy's Law Archive</title>`);
      
      // Update description
      pageHtml = pageHtml.replace(
        /<meta name="description" content=".*?">/,
        `<meta name="description" content="${page.description}">`
      );
      
      // Update canonical URL and hreflang
      pageHtml = pageHtml.replace(
        /<link rel="canonical" href=".*?">/,
        `<link rel="canonical" href="${buildCanonicalUrl(`/${page.slug}`)}">`
      );
      pageHtml = updateHreflang(pageHtml, buildCanonicalUrl(`/${page.slug}`));

      // Read metadata for last updated date
      let lastUpdated = null;
      try {
        const metadataPath = path.join(SHARED_CONTENT_DIR, 'metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        // Only show lastUpdated for privacy and terms pages
        if ((page.slug === 'privacy' || page.slug === 'terms') && metadata[page.slug]?.lastUpdated) {
          lastUpdated = metadata[page.slug].lastUpdated;
        }
      } catch {
        // Ignore metadata errors, proceed without lastUpdated
      }

      // Build the static content wrapper using card-header/card-body structure
      const cardHtml = wrapInCardStructure(htmlContent, { lastUpdated });
      const staticContent = `
      <div class="container page content-page">
${cardHtml.trim()}
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
        'dateModified': new Date().toISOString(),
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
      description: 'Estimate how likely a task is to go wrong using urgency, complexity, importance, skill, and frequency.',
      content: buildStaticCalculatorContent('sods-law'),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Sod\'s Law Calculator',
        'url': `${SITE_URL}/calculator/sods-law`,
        'description': 'Estimate how likely a task is to go wrong using urgency, complexity, importance, skill, and frequency.',
        'applicationCategory': 'EntertainmentApplication'
      }
    },
    {
      pathParts: ['calculator', 'buttered-toast'],
      title: 'Buttered Toast Calculator - Murphy\'s Law Archive',
      description: 'A playful simulator for the classic Murphy\'s Law question: will toast land butter-side down?',
      content: buildStaticCalculatorContent('buttered-toast'),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'Buttered Toast Calculator',
        'url': `${SITE_URL}/calculator/buttered-toast`,
        'description': 'A playful simulator for the classic Murphy\'s Law question: will toast land butter-side down?',
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

    let routeHtml = template;
    routeHtml = routeHtml.replace(/<title>.*?<\/title>/, `<title>${route.title}</title>`);
    routeHtml = routeHtml.replace(
      /<meta name="description" content=".*?">/,
      `<meta name="description" content="${route.description}">`
    );
    routeHtml = routeHtml.replace(
      /<link rel="canonical" href=".*?">/,
      `<link rel="canonical" href="${SITE_URL}/${routePath}">`
    );
    routeHtml = updateHreflang(routeHtml, `${SITE_URL}/${routePath}`);
    routeHtml = routeHtml.replace(
      /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/,
      `<main id="main-content" class="flex-1 container page">${route.content}</main>`
    );
    routeHtml = injectJsonLd(routeHtml, generateJsonLd(route.jsonLd));
    await fs.writeFile(path.join(routeDir, 'index.html'), routeHtml);
  }

  // 3c. Generate Law Detail Pages
  // Pre-render individual law pages with correct OG meta tags for social sharing
  console.log('Generating law detail pages...');
  const laws = await fetchAllLaws();
  
  if (laws.length > 0) {
    const lawDir = path.join(DIST_DIR, 'law');
    await fs.mkdir(lawDir, { recursive: true });
    
    for (const law of laws) {
      const lawPageDir = path.join(lawDir, String(law.id));
      await fs.mkdir(lawPageDir, { recursive: true });
      
      const lawPageHtml = generateLawPage(law, template);
      await fs.writeFile(path.join(lawPageDir, 'index.html'), lawPageHtml);
    }
    console.log(`Generated ${laws.length} law detail pages.`);
  } else {
    console.log('Skipping law detail pages (API not available or no laws found).');
  }

  // 4. Update Home Page (dist/index.html)
  // Crucial for AdSense and SEO: Replace the empty shell with meaningful content
  console.log('Updating Home Page (index.html)...');
  
  let homeHtml = template;
  
  const homeContent = buildStaticHomeContent();

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

  // 5. Generate Sitemap
  console.log('Generating sitemap.xml...');
  const baseUrl = SITE_URL;
  const today = new Date().toISOString().split('T')[0];

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/browse</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/categories</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

  // Add content pages
  for (const page of CONTENT_PAGES) {
    sitemap += `
  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  // Add static app routes (calculators, submit, favorites)
  for (const route of staticAppRoutes) {
    const routePath = route.pathParts.join('/');
    sitemap += `
  <url>
    <loc>${baseUrl}/${routePath}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;
  }

  // Add category routes
  for (const cat of categories) {
    sitemap += `
  <url>
    <loc>${baseUrl}/category/${cat.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }

  // Add law detail routes
  for (const law of laws) {
    sitemap += `
  <url>
    <loc>${baseUrl}/law/${law.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  sitemap += '\n</urlset>';

  await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('Generated sitemap.xml');

  // 6. Generate Image Sitemap
  console.log('Generating image-sitemap.xml...');
  
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
  
  console.log('SSG Complete!');
}

// Only run main() when executed directly, not when imported for testing
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
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
  buildStaticLawDetailContent
};
