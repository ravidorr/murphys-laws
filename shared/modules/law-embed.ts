/**
 * Embeddable law cards.
 *
 * The iframe markup people paste into their site, shared by the web share menu and the backend
 * oEmbed endpoint so both hand out the same snippet. Only imports other shared modules.
 */

import { escapeAttribute } from './html-escape.ts';

export const EMBED_ORIGIN = 'https://murphys-laws.com';
export const EMBED_DEFAULT_WIDTH = 600;
export const EMBED_DEFAULT_HEIGHT = 220;

export type EmbedTarget = number | string | 'today';

/** Card height that fits the law text without scrolling in a column of typical width. */
export function embedHeightForText(text: string): number {
  if (text.length <= 140) return EMBED_DEFAULT_HEIGHT;
  return text.length <= 280 ? 300 : 380;
}

/** Site path of the framable card for a law, or for today's law. */
export function lawEmbedPath(target: EmbedTarget): string {
  return target === 'today' ? '/embed/law-of-day' : `/embed/law/${target}`;
}

/** Site path of the image rendered for a law. Relative, so "Save as image" stays same-origin. */
export function lawImagePath(lawId: number | string): string {
  return `/api/v1/og/law/${lawId}.png`;
}

/** Absolute URL of the law image (used for oEmbed thumbnails). */
export function lawImageUrl(lawId: number | string): string {
  return `${EMBED_ORIGIN}${lawImagePath(lawId)}`;
}

export interface EmbedIframeOptions {
  target: EmbedTarget;
  /** Pixels, or '100%' for a responsive card */
  width?: number | '100%';
  /** Pixels; defaults to a height that fits `text`, or the default height without it */
  height?: number;
  /** Law text, used to size the card */
  text?: string;
  title?: string;
}

/**
 * Build the iframe that shows a law card. A '100%' width is capped at the default width so the
 * card stays readable in wide columns.
 */
export function buildEmbedIframe({
  target,
  width = '100%',
  text,
  height = text ? embedHeightForText(text) : EMBED_DEFAULT_HEIGHT,
  title = "Murphy's Law"
}: EmbedIframeOptions): string {
  const src = `${EMBED_ORIGIN}${lawEmbedPath(target)}`;
  const style = width === '100%' ? `border:0;width:100%;max-width:${EMBED_DEFAULT_WIDTH}px` : 'border:0';
  return `<iframe src="${src}" title="${escapeAttribute(title)}" width="${width}" height="${height}" style="${style}" loading="lazy"></iframe>`;
}

/**
 * `<link>` that lets oEmbed consumers (WordPress, Notion, Slack and others) discover the embed
 * for a law page.
 */
export function oembedDiscoveryLink(lawId: number | string): string {
  const lawUrl = encodeURIComponent(`${EMBED_ORIGIN}/law/${lawId}`);
  return `<link rel="alternate" type="application/json+oembed" href="${EMBED_ORIGIN}/api/v1/oembed?url=${lawUrl}" title="Murphy's Law oEmbed">`;
}
