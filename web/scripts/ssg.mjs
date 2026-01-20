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
  }
];

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
    
    // Canonical URL
    pageHtml = pageHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="https://murphys-laws.com/category/${slug}">`);

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
      /<main class="flex-1 container page">[\s\S]*?<\/main>/, 
      `<main class="flex-1 container page">${staticContent}</main>`
    );

    await fs.writeFile(path.join(outDir, 'index.html'), pageHtml);
    // console.log(`Generated category/${slug}/index.html`);
  }
  console.log(`Generated ${mdFiles.length} category pages.`);

  // 2. Generate Browse Page (Index of Categories)
  console.log('Generating browse page...');
  const browseDir = path.join(DIST_DIR, 'browse');
  await fs.mkdir(browseDir, { recursive: true });

  let browseHtml = template;
  browseHtml = browseHtml.replace(/<title>.*?<\/title>/, `<title>Browse All Categories - Murphy's Law Archive</title>`);
  browseHtml = browseHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="https://murphys-laws.com/browse">`);

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
    /<main class="flex-1 container page">[\s\S]*?<\/main>/, 
    `<main class="flex-1 container page">${browseContent}</main>`
  );

  await fs.writeFile(path.join(browseDir, 'index.html'), browseHtml);

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
      
      // Update canonical URL
      pageHtml = pageHtml.replace(
        /<link rel="canonical" href=".*?">/,
        `<link rel="canonical" href="https://murphys-laws.com/${page.slug}">`
      );
      
      // Build the static content wrapper
      const staticContent = `
      <div class="container page content-page" role="main">
        <article class="card content-card">
          <div class="card-content">
            ${htmlContent}
          </div>
        </article>
      </div>
      `;
      
      // Inject into main
      pageHtml = pageHtml.replace(
        /<main class="flex-1 container page">[\s\S]*?<\/main>/,
        `<main class="flex-1 container page">${staticContent}</main>`
      );
      
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
    /<main class="flex-1 container page">[\s\S]*?<\/main>/, 
    `<main class="flex-1 container page">${homeContent}</main>`
  );

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

  sitemap += '\n</urlset>';

  await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('Generated sitemap.xml');
  
  console.log('SSG Complete!');
}

main().catch(console.error);
