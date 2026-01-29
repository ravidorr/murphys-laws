import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { generateCategoryDescription } from '../src/utils/content-generator.js';
import { truncateTitle } from '../src/utils/seo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const SHARED_DATA_DIR = path.resolve(__dirname, '../../shared/data/murphys-laws');
const SHARED_CONTENT_DIR = path.resolve(__dirname, '../../shared/content');

// API configuration for fetching laws
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8787';
const SITE_URL = 'https://murphys-laws.com';

// Content pages metadata for SSG
const CONTENT_PAGES = [
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
  }
];

/**
 * Fetch all published laws from the API
 * @returns {Promise<Array>} Array of law objects
 */
async function fetchAllLaws() {
  const laws = [];
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
    console.warn(`Warning: Could not fetch laws from API: ${error.message}`);
    return [];
  }
}

/**
 * Escape HTML special characters for safe embedding
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Update hreflang tags to point to the correct URL
 * @param {string} html - HTML content
 * @param {string} url - Target URL
 * @returns {string} Updated HTML
 */
function updateHreflang(html, url) {
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
function escapeJsonString(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Generate JSON-LD script tag
 * @param {Object} data - Structured data object
 * @returns {string} Script tag HTML
 */
function generateJsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data, null, 2)}</script>`;
}

/**
 * Inject JSON-LD into HTML head
 * @param {string} html - HTML content
 * @param {string} jsonLd - JSON-LD script tag(s)
 * @returns {string} Updated HTML
 */
function injectJsonLd(html, jsonLd) {
  return html.replace('</head>', `${jsonLd}\n</head>`);
}

/**
 * Generate HTML page for a single law with correct OG meta tags
 * @param {Object} law - Law object
 * @param {string} template - HTML template
 * @returns {string} Generated HTML
 */
function generateLawPage(law, template) {
  let pageHtml = template;
  
  const title = law.title || "Murphy's Law";
  const description = (law.text || '').substring(0, 160);
  const lawUrl = `${SITE_URL}/law/${law.id}/`;
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
  const attributionName = law.attributions && law.attributions.length > 0 
    ? law.attributions[0].name 
    : null;
  
  // Split title for accent styling
  const titleWords = title.split(' ');
  const accentTitle = titleWords.length > 1
    ? `<span class="accent-text">${escapeHtml(titleWords[0])}</span> ${escapeHtml(titleWords.slice(1).join(' '))}`
    : `<span class="accent-text">${escapeHtml(title)}</span>`;
  
  // Build static content for law detail page
  const staticContent = `
    <div class="container page law-detail pt-0" role="main">
      <article class="law-detail-card card">
        <header class="card-header">
          <h1 class="card-title">${accentTitle}</h1>
        </header>
        <div class="card-body">
          <blockquote class="law-text">${escapeHtml(law.text || '')}</blockquote>
          ${attributionName ? `<p class="attribution">- ${escapeHtml(attributionName)}</p>` : ''}
        </div>
      </article>
    </div>
  `;
  
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
  
  return pageHtml;
}

/**
 * Wrap the first word of a heading with accent-text span
 */
function wrapFirstWordWithAccent(text) {
  const words = text.split(' ');
  if (words.length > 1) {
    return `<span class="accent-text">${words[0]}</span> ${words.slice(1).join(' ')}`;
  }
  return `<span class="accent-text">${text}</span>`;
}

/**
 * Process markdown HTML to add styling classes similar to the web app
 */
function enhanceMarkdownHtml(html) {
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
 * Extracts h1 and first paragraph into card-header, rest into card-body
 * @param {string} html - Enhanced HTML from enhanceMarkdownHtml
 * @param {Object} options - Options
 * @param {string} options.lastUpdated - Last updated date (for privacy/terms)
 * @returns {string} - HTML wrapped in card structure
 */
function wrapInCardStructure(html, options = {}) {
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

async function main() {
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
    const titleToken = tokens.find(t => t.type === 'heading' && t.depth === 1);
    const title = titleToken ? titleToken.text : slug.replace(/-/g, ' ');
    
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
    const firstText = tokens.find(t => t.type === 'list')?.items[0]?.text || '';
    const description = firstText.substring(0, 160).replace(/"/g, '&quot;') || `Read ${title} at Murphy's Law Archive.`;
    pageHtml = pageHtml.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${description}">`);
    
    // Canonical URL and hreflang
    pageHtml = pageHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="https://murphys-laws.com/category/${slug}">`);
    pageHtml = updateHreflang(pageHtml, `https://murphys-laws.com/category/${slug}`);

    // Inject Content
    // We replace the loading content in <main>
    const descriptionText = generateCategoryDescription(title, law_count);
    
    const staticContent = `
      <div class="container page pt-0" role="main">
        <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-primary">
          <span class="accent-text">${title.split(' ')[0]}</span> ${title.split(' ').slice(1).join(' ')}
        </h1>
        <p class="lead text-center mb-8 text-muted-fg max-w-2xl mx-auto">${descriptionText}</p>
        <div class="static-content prose mx-auto">
          ${htmlContent}
        </div>
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

  // 2. Generate Browse Page (Index of Categories)
  console.log('Generating browse page...');
  const browseDir = path.join(DIST_DIR, 'browse');
  await fs.mkdir(browseDir, { recursive: true });

  let browseHtml = template;
  browseHtml = browseHtml.replace(/<title>.*?<\/title>/, `<title>Browse All Murphy's Laws - Murphy's Law Archive</title>`);
  browseHtml = browseHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="https://murphys-laws.com/browse">`);
  browseHtml = updateHreflang(browseHtml, 'https://murphys-laws.com/browse');

  const browseContent = `
    <div class="container page pt-0" role="main">
      <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-8 text-primary">
        Browse <span class="accent-text">Murphy's</span> Laws
      </h1>
      <p class="text-center mb-8 text-lg text-muted-fg max-w-2xl mx-auto">
        Search and filter through our complete collection of Murphy's Laws.
      </p>
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
  categoriesHtml = categoriesHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="https://murphys-laws.com/categories">`);
  categoriesHtml = updateHreflang(categoriesHtml, 'https://murphys-laws.com/categories');

  // Build category cards HTML for SSG
  const categoryCardsHtml = categories
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(cat => {
      const lawText = cat.law_count === 1 ? 'law' : 'laws';
      return `
      <article class="category-card" data-category-slug="${cat.slug}">
        <h3 class="category-card-title">${cat.title}</h3>
        <p class="category-card-description">Explore ${cat.law_count} ${lawText} in this category.</p>
        <div class="category-card-footer">
          <span class="category-card-count">${cat.law_count} ${lawText}</span>
        </div>
      </article>`;
    })
    .join('');

  const categoriesContent = `
    <div class="container page pt-0" role="main">
      <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-primary">
        Browse <span class="accent-text">Murphy's</span> Laws by Category
      </h1>
      <p class="text-center mb-8 text-lg text-muted-fg max-w-2xl mx-auto">
        Explore our complete collection organized into ${categories.length} categories.
      </p>
      <div class="categories-grid">
        ${categoryCardsHtml}
      </div>
    </div>
  `;

  categoriesHtml = categoriesHtml.replace(
    /<main[^>]*class="flex-1 container page"[^>]*>[\s\S]*?<\/main>/, 
    `<main id="main-content" class="flex-1 container page">${categoriesContent}</main>`
  );

  await fs.writeFile(path.join(categoriesDir, 'index.html'), categoriesHtml);
  console.log('Generated categories page.');

  // 3. Generate Content Pages (About, Privacy, Terms, Origin Story, Contact)
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
      let htmlContent = marked.parse(mdContent);
      
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
        `<link rel="canonical" href="https://murphys-laws.com/${page.slug}">`
      );
      pageHtml = updateHreflang(pageHtml, `https://murphys-laws.com/${page.slug}`);

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
      <div class="container page content-page" role="main">
        ${cardHtml}
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
      console.warn(`Warning: Could not pre-render ${page.slug}, using SPA fallback:`, err.message);
      // Fallback: copy the main index.html
      await fs.copyFile(path.join(DIST_DIR, 'index.html'), path.join(routeDir, 'index.html'));
    }
  }
  console.log(`Generated ${CONTENT_PAGES.length} content pages.`);
  
  // 3b. Generate remaining static routes (calculator pages, submit) - SPA fallback only
  const spaOnlyRoutes = ['calculator', 'toastcalculator', 'submit'];
  
  for (const route of spaOnlyRoutes) {
    const routeDir = path.join(DIST_DIR, route);
    await fs.mkdir(routeDir, { recursive: true });
    await fs.copyFile(path.join(DIST_DIR, 'index.html'), path.join(routeDir, 'index.html'));
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
  
  const homeContent = `
    <div class="container page pt-0" role="main">
      <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-8 text-primary">
        The Ultimate <span class="accent-text">Murphy's Law</span> Archive
      </h1>
      <p class="text-center mb-12 text-lg text-muted-fg max-w-2xl mx-auto">
        "If anything can go wrong, it will." Explore the complete collection of laws, corollaries, and observations about the perversity of the universe.
      </p>
    </div>
  `;

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
  const baseUrl = 'https://murphys-laws.com';
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

  // Add SPA-only routes (calculators, submit)
  for (const route of spaOnlyRoutes) {
    sitemap += `
  <url>
    <loc>${baseUrl}/${route}</loc>
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
export { wrapFirstWordWithAccent, enhanceMarkdownHtml, wrapInCardStructure };
