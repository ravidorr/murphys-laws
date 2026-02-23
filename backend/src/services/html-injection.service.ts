import fs from 'node:fs/promises';
import path from 'node:path';
import type { LawService } from './laws.service.ts';
import type { CategoryService } from './categories.service.ts';

const SITE_URL = 'https://murphys-laws.com';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDistPath(): string {
  if (process.env.WEB_DIST_PATH) {
    return path.resolve(process.env.WEB_DIST_PATH);
  }
  const cwd = process.cwd();
  if (cwd.endsWith('backend') || cwd.endsWith(path.sep + 'backend')) {
    return path.resolve(cwd, '..', 'web', 'dist');
  }
  return path.resolve(cwd, 'web', 'dist');
}

export interface HtmlInjectionServiceOptions {
  lawService: LawService;
  categoryService: CategoryService;
}

export class HtmlInjectionService {
  private lawService: LawService;
  private categoryService: CategoryService;
  private templateCache: string | null = null;

  constructor(options: HtmlInjectionServiceOptions) {
    this.lawService = options.lawService;
    this.categoryService = options.categoryService;
  }

  private async readTemplate(): Promise<string> {
    if (this.templateCache) return this.templateCache;
    const distPath = getDistPath();
    const indexPath = path.join(distPath, 'index.html');
    try {
      const html = await fs.readFile(indexPath, 'utf-8');
      this.templateCache = html;
      return html;
    } catch {
      throw new Error(`Could not read index.html from ${indexPath}`);
    }
  }

  async getLawHtml(lawId: string): Promise<string | null> {
    const id = Number(lawId);
    if (!Number.isInteger(id) || id < 1) return null;
    const law = await this.lawService.getLaw(id);
    if (!law) return null;

    const template = await this.readTemplate();
    const title = (law.title ?? law.text ?? "Murphy's Law").toString();
    const description = (law.text ?? '').toString().substring(0, 160);
    const lawUrl = `${SITE_URL}/law/${law.id}/`;
    const ogImageUrl = `${SITE_URL}/api/v1/og/law/${law.id}.png`;

    let html = template;
    const pageTitle = `${escapeHtml(title)} - Murphy's Law Archive`;
    html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
    html = html.replace(
      /<meta name="description" content=".*?">/,
      `<meta name="description" content="${escapeHtml(description)}">`
    );
    html = html.replace(
      /<link rel="canonical" href=".*?">/,
      `<link rel="canonical" href="${lawUrl}">`
    );
    html = html.replace(
      /<meta property="og:url" content=".*?">/,
      `<meta property="og:url" content="${lawUrl}">`
    );
    html = html.replace(
      /<meta property="og:title" content=".*?">/,
      `<meta property="og:title" content="${escapeHtml(title)} - Murphy's Laws">`
    );
    html = html.replace(
      /<meta property="og:description"[\s\S]*?content="[\s\S]*?">/,
      `<meta property="og:description" content="${escapeHtml(description)}">`
    );
    html = html.replace(
      /<meta property="og:image" content=".*?">/,
      `<meta property="og:image" content="${ogImageUrl}">`
    );
    html = html.replace(
      /<meta property="twitter:url" content=".*?">/,
      `<meta property="twitter:url" content="${lawUrl}">`
    );
    html = html.replace(
      /<meta property="twitter:title" content=".*?">/,
      `<meta property="twitter:title" content="${escapeHtml(title)} - Murphy's Laws">`
    );
    html = html.replace(
      /<meta property="twitter:description"[\s\S]*?content="[\s\S]*?">/,
      `<meta property="twitter:description" content="${escapeHtml(description)}">`
    );
    html = html.replace(
      /<meta property="twitter:image" content=".*?">/,
      `<meta property="twitter:image" content="${ogImageUrl}">`
    );

    const titleWords = title.split(' ');
    const accentTitle =
      titleWords.length > 1
        ? `<span class="accent-text">${escapeHtml(titleWords[0] ?? '')}</span> ${escapeHtml(titleWords.slice(1).join(' '))}`
        : `<span class="accent-text">${escapeHtml(title)}</span>`;

    const attributionName =
      law.attributions && Array.isArray(law.attributions) && law.attributions.length > 0
        ? (law.attributions[0] as { name?: string })?.name ?? null
        : null;

    const staticContent = `
    <div class="container page law-detail pt-0">
      <article class="law-detail-card card">
        <header class="card-header">
          <h1 class="card-title">${accentTitle}</h1>
        </header>
        <div class="card-body">
          <blockquote class="law-text">${escapeHtml((law.text as string) ?? '')}</blockquote>
          ${attributionName ? `<p class="attribution">- ${escapeHtml(attributionName)}</p>` : ''}
        </div>
      </article>
    </div>
`;

    html = html.replace(
      /<main[^>]*>[\s\S]*?<\/main>/,
      `<main id="main-content" class="flex-1 container page" aria-label="Main content">${staticContent}</main>`
    );

    return html;
  }

  async getCategoryHtml(slug: string): Promise<string | null> {
    const category = await this.categoryService.getCategoryBySlug(slug);
    if (!category) return null;

    const template = await this.readTemplate();
    const title = category.title ?? category.slug.replace(/-/g, ' ');
    const description =
      (category.description ?? '').toString().substring(0, 160) ||
      `Browse ${escapeHtml(title)} at Murphy's Law Archive.`;
    const categoryUrl = `${SITE_URL}/category/${category.slug}`;
    const lawCount = Number(category.law_count ?? 0);

    let html = template;
    const pageTitle = `${escapeHtml(title)} - Murphy's Law Archive`;
    html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
    html = html.replace(
      /<meta name="description" content=".*?">/,
      `<meta name="description" content="${escapeHtml(description)}">`
    );
    html = html.replace(
      /<link rel="canonical" href=".*?">/,
      `<link rel="canonical" href="${categoryUrl}">`
    );

    const titleWords = title.split(' ');
    const accentTitle =
      titleWords.length > 1
        ? `<span class="accent-text">${escapeHtml(titleWords[0] ?? '')}</span> ${escapeHtml(titleWords.slice(1).join(' '))}`
        : `<span class="accent-text">${escapeHtml(title)}</span>`;

    const descriptionText =
      lawCount > 0
        ? `This category contains ${lawCount} law${lawCount === 1 ? '' : 's'}. Browse the collection below.`
        : `Explore ${escapeHtml(title)}.`;

    const staticContent = `
      <div class="container page pt-0">
        <h1 class="text-center text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-primary">
          ${accentTitle}
        </h1>
        <p class="lead text-center mb-8 text-muted-fg max-w-2xl mx-auto">${descriptionText}</p>
        <p class="loading-message text-center">Loading laws...</p>
      </div>
`;

    html = html.replace(
      /<main[^>]*>[\s\S]*?<\/main>/,
      `<main id="main-content" class="flex-1 container page" aria-label="Main content">${staticContent}</main>`
    );

    return html;
  }
}
