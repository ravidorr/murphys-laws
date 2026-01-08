import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const SHARED_DATA_DIR = path.resolve(__dirname, '../../shared/data/murphys-laws');

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

    // Collect category info for the Browse page
    categories.push({ slug, title });

    // Output directory: dist/category/[slug]/
    const outDir = path.join(DIST_DIR, 'category', slug);
    await fs.mkdir(outDir, { recursive: true });

    // Inject into template
    let pageHtml = template;
    
    // Update Title
    const titleTag = `<title>${title} - Murphy's Law Archive</title>`;
    pageHtml = pageHtml.replace(/<title>.*?<\/title>/, titleTag);
    
    // Update Description (first 160 chars of text)
    const firstText = tokens.find(t => t.type === 'list')?.items[0]?.text || '';
    const description = firstText.substring(0, 160).replace(/"/g, '&quot;') || `Read ${title} at Murphy's Law Archive.`;
    pageHtml = pageHtml.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${description}">`);
    
    // Canonical URL
    pageHtml = pageHtml.replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="https://murphys-laws.com/category/${slug}">`);

    // Inject Content
    // We replace the loading content in <main>
    const staticContent = `
      <div class="container page pt-0" role="main">
        <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-8 text-primary">
          <span class="accent-text">${title.split(' ')[0]}</span> ${title.split(' ').slice(1).join(' ')}
        </h1>
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
      <div class="category-grid">
        ${categories.map(cat => `
          <div class="category-card">
            <h2 class="category-title">
              <a href="/category/${cat.slug}">${cat.title}</a>
            </h2>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  browseHtml = browseHtml.replace(
    /<main class="flex-1 container page">[\s\S]*?<\/main>/, 
    `<main class="flex-1 container page">${browseContent}</main>`
  );

  await fs.writeFile(path.join(browseDir, 'index.html'), browseHtml);

  // 3. Generate Static Pages (About, Terms, etc.)
  // We can just copy the template to these dirs if we don't have static content for them handy in this script,
  // but better to fetch it if possible. For now, let's just ensure the directories exist so NGINX finds index.html.
  const staticRoutes = ['about', 'privacy', 'terms', 'contact', 'origin-story', 'calculator', 'toastcalculator', 'submit'];
  
  for (const route of staticRoutes) {
    const routeDir = path.join(DIST_DIR, route);
    await fs.mkdir(routeDir, { recursive: true });
    
    // Just copy the main index.html for now (SPA fallback)
    // Ideally we would inject specific content for these too.
    // For 'calculator', it's interactive JS anyway, so static content is less critical (though "Loading calculator..." would be good).
    await fs.copyFile(path.join(DIST_DIR, 'index.html'), path.join(routeDir, 'index.html'));
  }
  
  console.log('SSG Complete!');
}

main().catch(console.error);
