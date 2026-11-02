/**
 * SEO audit for a built site (web/dist).
 *
 * Reads sitemap.xml, loads the matching HTML file for every listed URL and reports
 * duplicate titles and descriptions, length problems, missing structured data, and
 * sitemap hygiene. Exits with code 1 when a blocking problem is found, so it can run in CI.
 *
 * Usage: npm run seo:audit [-- <dist-dir>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface PageInfo {
  url: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  h1Count: number;
  jsonLdTypes: string[];
  words: number;
}

const SITE_ORIGIN = 'https://murphys-laws.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function decodeEntities(value: string): string {
  return value
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function match(html: string, pattern: RegExp): string {
  return decodeEntities((pattern.exec(html)?.[1] || '').trim());
}

function parsePage(url: string, html: string): PageInfo {
  const jsonLdTypes: string[] = [];
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(block[1] as string) as { '@type'?: string | string[] };
      jsonLdTypes.push([data['@type']].flat().join('+'));
    } catch {
      jsonLdTypes.push('INVALID');
    }
  }
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');
  return {
    url,
    title: match(html, /<title>([\s\S]*?)<\/title>/),
    description: match(html, /<meta name="description"\s+content="([\s\S]*?)"/),
    canonical: match(html, /<link rel="canonical" href="(.*?)"/),
    robots: match(html, /<meta name="robots" content="(.*?)"/),
    h1Count: (html.match(/<h1[\s>]/g) || []).length,
    jsonLdTypes,
    words: body.split(/\s+/).filter(Boolean).length
  };
}

function duplicates(pages: PageInfo[], field: 'title' | 'description'): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const page of pages) counts.set(page[field], (counts.get(page[field]) || 0) + 1);
  return [...counts].filter(([value, count]) => value && count > 1);
}

async function readPage(distDir: string, url: string): Promise<PageInfo | null> {
  const route = url.replace(SITE_ORIGIN, '').replace(/^\/+|\/+$/g, '');
  const file = path.join(distDir, route, 'index.html');
  try {
    return parsePage(url, await fs.readFile(file, 'utf-8'));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const distDir = path.resolve(process.argv[2] || path.join(__dirname, '../dist'));
  const sitemap = await fs.readFile(path.join(distDir, 'sitemap.xml'), 'utf-8');
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1] as string);
  const urls = entries.map((entry) => /<loc>(.*?)<\/loc>/.exec(entry)?.[1] || '');

  const pages: PageInfo[] = [];
  const missingFiles: string[] = [];
  for (const url of urls) {
    const page = await readPage(distDir, url);
    if (page) pages.push(page);
    else missingFiles.push(url);
  }

  const isLaw = (page: PageInfo) => page.url.includes('/law/');
  const laws = pages.filter(isLaw);
  const blocking: string[] = [];
  const warnings: string[] = [];

  const lawDupTitles = duplicates(laws, 'title');
  const lawDupDescriptions = duplicates(laws, 'description');
  const noLastmod = entries.filter((entry) => !entry.includes('<lastmod>')).length;
  const stale = entries.filter((entry) => /<(changefreq|priority)>/.test(entry)).length;

  if (missingFiles.length) blocking.push(`${missingFiles.length} sitemap URLs have no built page (e.g. ${missingFiles[0]})`);
  if (lawDupTitles.length) blocking.push(`${lawDupTitles.reduce((n, [, c]) => n + c, 0)} law pages share ${lawDupTitles.length} titles (e.g. "${lawDupTitles[0]?.[0]}")`);
  if (lawDupDescriptions.length) blocking.push(`${lawDupDescriptions.reduce((n, [, c]) => n + c, 0)} law pages share ${lawDupDescriptions.length} descriptions`);
  for (const page of pages) {
    if (page.canonical !== page.url) blocking.push(`canonical mismatch: ${page.url} -> ${page.canonical}`);
    if (page.robots.includes('noindex')) blocking.push(`noindex page in sitemap: ${page.url}`);
    if (page.h1Count !== 1) blocking.push(`${page.h1Count} h1 elements: ${page.url}`);
    if (!page.title || !page.description) blocking.push(`missing title or description: ${page.url}`);
  }
  if (noLastmod) warnings.push(`${noLastmod} sitemap URLs have no lastmod`);
  if (stale) warnings.push(`${stale} sitemap URLs still carry changefreq or priority`);

  const longTitles = pages.filter((page) => page.title.length > 60);
  const shortLawDescriptions = laws.filter((page) => page.description.length < 70);
  const longDescriptions = pages.filter((page) => page.description.length > 160);
  const noSchema = pages.filter((page) => page.jsonLdTypes.length === 0);
  const noBreadcrumbs = pages.filter((page) => page.url !== `${SITE_ORIGIN}/` && !page.jsonLdTypes.some((type) => type.includes('BreadcrumbList')) && /\/(law|category|browse|categories)\b/.test(page.url));
  const thin = pages.filter((page) => !isLaw(page) && page.words < 150);

  if (longTitles.length) warnings.push(`${longTitles.length} titles over 60 characters`);
  if (shortLawDescriptions.length) warnings.push(`${shortLawDescriptions.length} law descriptions under 70 characters`);
  if (longDescriptions.length) warnings.push(`${longDescriptions.length} descriptions over 160 characters`);
  if (noSchema.length) warnings.push(`${noSchema.length} pages with no JSON-LD (e.g. ${noSchema[0]?.url})`);
  if (noBreadcrumbs.length) warnings.push(`${noBreadcrumbs.length} browse, category and law pages with no BreadcrumbList`);
  if (thin.length) warnings.push(`${thin.length} non-law pages under 150 words: ${thin.map((page) => page.url.replace(SITE_ORIGIN, '')).join(', ')}`);

  console.log(`Audited ${pages.length} of ${urls.length} sitemap URLs in ${distDir}`);
  console.log(`Law pages: ${laws.length}, unique titles: ${new Set(laws.map((page) => page.title)).size}`);
  for (const message of blocking.slice(0, 25)) console.log(`ERROR   ${message}`);
  if (blocking.length > 25) console.log(`ERROR   ... and ${blocking.length - 25} more`);
  for (const message of warnings) console.log(`WARNING ${message}`);
  if (!blocking.length && !warnings.length) console.log('No problems found.');
  if (blocking.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
