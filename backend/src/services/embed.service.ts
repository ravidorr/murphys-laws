import type { LawService } from './laws.service.ts';
import {
  EMBED_DEFAULT_WIDTH,
  EMBED_ORIGIN,
  buildEmbedIframe,
  embedHeightForText,
  lawImageUrl
} from '../../../shared/modules/law-embed.ts';
import { escapeHtml } from '../../../shared/modules/html-escape.ts';
import { buildLawSeo, isGenericLawTitle } from '../../../shared/modules/law-seo.ts';

const OEMBED_HOSTS = new Set(['murphys-laws.com', 'www.murphys-laws.com']);
const LAW_PATH = /^\/law\/(\d+)\/?$/;
const CARD_CACHE_TTL_MS = 5 * 60 * 1000;
const CARD_CACHE_MAX_ENTRIES = 500;

export interface OEmbedResponse {
  version: '1.0';
  type: 'rich';
  provider_name: string;
  provider_url: string;
  title: string;
  html: string;
  width: number;
  height: number;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  cache_age: number;
}

export type OEmbedResult =
  | { ok: true; body: OEmbedResponse }
  | { ok: false; status: 400 | 404 | 501; message: string };

interface OEmbedRequest {
  url?: string | string[];
  format?: string | string[];
  maxwidth?: string | string[];
  maxheight?: string | string[];
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A positive integer from a query value, or undefined when it is missing or not usable. */
function positiveInteger(value: string | string[] | undefined): number | undefined {
  const parsed = Number(firstValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Standalone pages for the iframe embed, and the oEmbed document that lets sites unfurl a law URL.
 */
export class EmbedService {
  private lawService: Pick<LawService, 'getLaw' | 'getLawOfTheDay'>;
  private cardCache = new Map<string, { html: string; expires: number }>();

  constructor(lawService: Pick<LawService, 'getLaw' | 'getLawOfTheDay'>) {
    this.lawService = lawService;
  }

  /**
   * Embeds can sit on busy pages, so rendered cards are kept for as long as the response is
   * cacheable (five minutes) instead of querying the database for every view.
   */
  private async cachedCard(key: string, render: () => Promise<string | null>): Promise<string | null> {
    const hit = this.cardCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.html;

    const html = await render();
    if (html) {
      if (this.cardCache.size >= CARD_CACHE_MAX_ENTRIES) this.cardCache.clear();
      this.cardCache.set(key, { html, expires: Date.now() + CARD_CACHE_TTL_MS });
    }
    return html;
  }

  async getLawEmbedHtml(lawId: string): Promise<string | null> {
    const id = Number(lawId);
    if (!Number.isInteger(id) || id < 1) return null;
    return this.cachedCard(`law:${id}`, async () => {
      const law = await this.lawService.getLaw(id);
      if (!law) return null;
      // Name the card after the law when it has a real title, so the label says more than "Murphy's Law"
      const label = isGenericLawTitle(law.title) ? "Murphy's Law" : String(law.title);
      return this.renderCard({ id: law.id, title: law.title, text: String(law.text ?? ''), label });
    });
  }

  async getLawOfDayEmbedHtml(): Promise<string | null> {
    return this.cachedCard('law-of-day', async () => {
      const featured = await this.lawService.getLawOfTheDay();
      if (!featured) return null;
      return this.renderCard({ id: featured.law.id, title: featured.law.title, text: String(featured.law.text ?? ''), label: 'Law of the Day' });
    });
  }

  async getOEmbed(request: OEmbedRequest): Promise<OEmbedResult> {
    if (firstValue(request.format) && firstValue(request.format) !== 'json') {
      return { ok: false, status: 501, message: 'Only the json format is supported' };
    }

    const rawUrl = firstValue(request.url);
    let lawId: number | null = null;
    try {
      const parsed = new URL(rawUrl ?? '');
      const match = LAW_PATH.exec(parsed.pathname);
      if (OEMBED_HOSTS.has(parsed.hostname) && match) lawId = Number(match[1]);
    } catch {
      // Falls through to the 400 below
    }
    if (lawId === null) {
      return { ok: false, status: 400, message: 'url must be a Murphy\'s Law Archive law URL such as https://murphys-laws.com/law/1' };
    }

    const law = await this.lawService.getLaw(lawId);
    if (!law) return { ok: false, status: 404, message: 'Law not found' };

    const maxWidth = positiveInteger(request.maxwidth);
    const maxHeight = positiveInteger(request.maxheight);
    // maxwidth is a ceiling the consumer set for its layout, so it is honored even for very narrow slots
    const width = Math.min(EMBED_DEFAULT_WIDTH, maxWidth ?? EMBED_DEFAULT_WIDTH);
    const fittingHeight = embedHeightForText(String(law.text ?? ''));
    const height = Math.min(fittingHeight, maxHeight ?? fittingHeight);
    const title = buildLawSeo({ id: law.id, title: law.title, text: law.text }).headline;

    return {
      ok: true,
      body: {
        version: '1.0',
        type: 'rich',
        provider_name: "Murphy's Law Archive",
        provider_url: EMBED_ORIGIN,
        title,
        html: buildEmbedIframe({ target: law.id, width, height, title }),
        width,
        height,
        thumbnail_url: lawImageUrl(law.id),
        thumbnail_width: 1200,
        thumbnail_height: 630,
        cache_age: 3600
      }
    };
  }

  private renderCard({ id, title: lawTitle, text, label }: { id: number; title?: string | null; text: string; label: string }): string {
    const lawUrl = `${EMBED_ORIGIN}/law/${id}`;
    const title = buildLawSeo({ id, title: lawTitle, text }).headline;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Murphy's Law Archive</title>
  <meta name="robots" content="noindex, follow">
  <base target="_blank">
  <link rel="canonical" href="${lawUrl}">
  <link rel="stylesheet" href="/styles/partials/variables.css">
  <link rel="stylesheet" href="/styles/embed.css">
</head>
<body class="law-embed">
  <figure class="law-embed__card">
    <figcaption class="law-embed__label">${escapeHtml(label)}</figcaption>
    <blockquote class="law-embed__text">${escapeHtml(text)}</blockquote>
    <a class="law-embed__link" href="${lawUrl}" rel="noopener">Read more at Murphy's Law Archive</a>
  </figure>
</body>
</html>`;
  }
}
