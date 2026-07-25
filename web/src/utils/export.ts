/**
 * @fileoverview Export Utilities
 *
 * Provides functions to export page content to various formats:
 * - PDF (using a dependency-free PDF writer)
 * - CSV (for structured data)
 * - Markdown
 * - Plain Text
 *
 * All export functions accept a content object from the export context
 * and generate a downloadable file.
 *
 * @example
 * import { exportToPDF, exportToCSV } from '../utils/export.ts';
 * import { getExportContent } from '../utils/export-context.ts';
 *
 * const content = getExportContent();
 * exportToPDF(content, 'my-laws.pdf');
 *
 * @module export
 */

import * as Sentry from '@sentry/browser';
import { SITE_NAME, SITE_URL } from './constants.ts';
import { ContentType } from './export-context.ts';
import type { ExportContent } from './export-context.ts';
import type { Law, Category } from '../types/app.d.ts';

/**
 * Trigger file download by creating a temporary anchor element.
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename for the download
 */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get formatted date string for export headers.
 * @returns {string} Formatted date (e.g., "January 26, 2026")
 */
function getDateString(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Generate a safe filename from a title.
 * @param {string} title - The title to convert
 * @param {string} extension - File extension (without dot)
 * @returns {string} Safe filename
 */
export function generateFilename(title: string, extension: string): string {
  const safeName = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .substring(0, 50); // Limit length
  return `${safeName || 'murphys-laws'}.${extension}`;
}

const PDF_MAX_LINE_LENGTH = 88;
const PDF_LINES_PER_PAGE = 48;

function normalizePdfText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

function wrapPdfText(value: unknown): string[] {
  return normalizePdfText(value)
    .split('\n')
    .flatMap((paragraph) => {
      if (paragraph.length === 0) return [''];

      const lines: string[] = [];
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        if (word.length > PDF_MAX_LINE_LENGTH) {
          if (current) {
            lines.push(current);
            current = '';
          }
          for (let offset = 0; offset < word.length; offset += PDF_MAX_LINE_LENGTH) {
            lines.push(word.slice(offset, offset + PDF_MAX_LINE_LENGTH));
          }
          continue;
        }

        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > PDF_MAX_LINE_LENGTH) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);
      return lines;
    });
}

function escapePdfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdfDocument(lines: string[]): string {
  const pages: string[][] = [];
  for (let offset = 0; offset < lines.length; offset += PDF_LINES_PER_PAGE) {
    pages.push(lines.slice(offset, offset + PDF_LINES_PER_PAGE));
  }

  const fontObject = 3 + (pages.length * 2);
  const objects: string[] = [];
  const pageReferences: string[] = [];

  pages.forEach((pageLines, index) => {
    const pageObject = 3 + (index * 2);
    const contentObject = pageObject + 1;
    pageReferences.push(`${pageObject} 0 R`);

    const body = pageLines
      .map((line) => `(${escapePdfString(line)}) Tj\nT*`)
      .join('\n');
    const footer = escapePdfString(
      `Page ${index + 1} of ${pages.length} | Exported ${getDateString()} | ${SITE_URL}`,
    );
    const stream = [
      'BT',
      '/F1 10 Tf',
      '14 TL',
      '50 742 Td',
      body,
      'ET',
      'BT',
      '/F1 8 Tf',
      `50 30 Td`,
      `(${footer}) Tj`,
      'ET',
    ].join('\n');

    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontObject} 0 R >> >> ` +
      `/Contents ${contentObject} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] =
    `<< /Type /Pages /Kids [${pageReferences.join(' ')}] ` +
    `/Count ${pages.length} >>`;
  objects[fontObject] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  let document = '%PDF-1.4\n%MurphysLaws\n';
  const offsets = [0];
  for (let object = 1; object <= fontObject; object++) {
    offsets[object] = document.length;
    document += `${object} 0 obj\n${objects[object]}\nendobj\n`;
  }

  const xrefOffset = document.length;
  document += `xref\n0 ${fontObject + 1}\n`;
  document += '0000000000 65535 f \n';
  for (let object = 1; object <= fontObject; object++) {
    document += `${String(offsets[object]).padStart(10, '0')} 00000 n \n`;
  }
  document +=
    `trailer\n<< /Size ${fontObject + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;
  return document;
}

/**
 * Export content to a downloadable PDF without runtime styling or third-party
 * rendering dependencies.
 *
 * @param {Object} content - Export content from context
 * @param {string} [filename] - Optional filename (auto-generated if not provided)
 */
export async function exportToPDF(content: ExportContent, filename?: string): Promise<void> {
  const { type, title, data } = content;
  const sourceLines: string[] = [SITE_NAME, title, ''];

  if (type === ContentType.LAWS || type === ContentType.SINGLE_LAW) {
    const laws = (Array.isArray(data) ? data : [data]) as Partial<Law>[];
    laws.forEach((law) => {
      sourceLines.push(getLawDisplayText(law));
      if (law.attribution) sourceLines.push(`- ${law.attribution}`);
      sourceLines.push('');
    });
  } else if (type === ContentType.CONTENT) {
    const plainText = String(data || '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    sourceLines.push(plainText);
  } else if (type === ContentType.CATEGORIES && Array.isArray(data)) {
    const categories = data as Partial<Category>[];
    categories.forEach((category) => {
      const categoryName = category.title || category.name || '';
      sourceLines.push(`${categoryName} (${category.law_count || 0} laws)`);
    });
  }

  const lines = sourceLines.flatMap(wrapPdfText);
  const blob = new Blob([buildPdfDocument(lines)], { type: 'application/pdf' });
  downloadFile(blob, filename || generateFilename(title, 'pdf'));
}

/**
 * Escape a value for CSV (handle quotes and special characters).
 * Exported for testing branch coverage (null/undefined).
 * @param {*} value - Value to escape
 * @returns {string} Escaped value
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Escape double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  // Wrap in quotes if contains comma, newline, or quotes
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') || escaped.includes('\r')) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Export content to CSV format.
 * CSV is only available for structured data (laws, categories).
 *
 * @param {Object} content - Export content from context
 * @param {string} [filename] - Optional filename
 */
export function exportToCSV(content: ExportContent, filename?: string): void {
  const { type, title, data } = content;
  let csv = '';

  if (type === ContentType.LAWS || type === ContentType.SINGLE_LAW) {
    const laws = (Array.isArray(data) ? data : [data]) as Partial<Law>[];

    // Header row - includes Full Text which combines title and text
    csv = '"ID","Full Text","Title","Text","Attribution","Category","Upvotes","Downvotes"\n';

    // Data rows
    laws.forEach(law => {
      const fullText = getLawDisplayText(law);
      const row = [
        escapeCSVValue(law.id || ''),
        escapeCSVValue(fullText),
        escapeCSVValue(law.title || ''),
        escapeCSVValue(law.text || ''),
        escapeCSVValue(law.attribution || ''),
        escapeCSVValue(law.category_slug || ''),
        escapeCSVValue(law.upvotes || 0),
        escapeCSVValue(law.downvotes || 0)
      ];
      csv += row.join(',') + '\n';
    });
  } else if (type === ContentType.CATEGORIES && Array.isArray(data)) {
    // Header row
    const categories = data as Partial<Category>[];
    csv = '"ID","Name","Slug","Law Count"\n';

    // Data rows
    categories.forEach(cat => {
      const row = [
        escapeCSVValue(cat.id || ''),
        escapeCSVValue(cat.title || cat.name || ''),
        escapeCSVValue(cat.slug || ''),
        escapeCSVValue(cat.law_count || 0)
      ];
      csv += row.join(',') + '\n';
    });
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const outputFilename = filename || generateFilename(title, 'csv');
  downloadFile(blob, outputFilename);
}

/**
 * Combine law title and text into a single display string.
 * Some laws have their content split between title and text fields.
 * This matches the display behavior in the UI components.
 * @param {Object} law - Law object with title and text properties
 * @returns {string} Combined law text
 */
function getLawDisplayText(law: Partial<Law>): string {
  const title = law.title || '';
  const text = law.text || '';
  let result;
  if (title && text) {
    result = `${title}: ${text}`;
  } else {
    result = title || text;
  }
  // Remove unnecessary markdown escape characters that may be in the data
  return result.replace(/\\([!*_`\-#>[\]()])/g, '$1');
}

/**
 * Export content to Markdown format.
 *
 * @param {Object} content - Export content from context
 * @param {string} [filename] - Optional filename
 */
export function exportToMarkdown(content: ExportContent, filename?: string): void {
  const { type, title, data } = content;
  let md = `# ${title}\n\n`;

  if (type === ContentType.LAWS || type === ContentType.SINGLE_LAW) {
    const laws = (Array.isArray(data) ? data : [data]) as Partial<Law>[];

    laws.forEach((law, index) => {
      const lawText = getLawDisplayText(law);
      md += `${index + 1}. ${lawText}\n`;
      if (law.attribution) {
        md += `   *- ${law.attribution}*\n`;
      }
      md += '\n';
    });
  } else if (type === ContentType.CONTENT) {
    // Content is already markdown, just append it
    md += String(data || '');
    md += '\n\n';
  } else if (type === ContentType.CATEGORIES && Array.isArray(data)) {
    const categories = data as Partial<Category>[];
    categories.forEach(cat => {
      md += `- **${cat.title || cat.name || ''}** (${cat.law_count || 0} laws)\n`;
    });
    md += '\n';
  }

  // Footer with export info
  md += `---\n\n*Exported from ${SITE_NAME} on ${getDateString()} | [${SITE_URL}](${SITE_URL})*\n`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const outputFilename = filename || generateFilename(title, 'md');
  downloadFile(blob, outputFilename);
}

/**
 * Export content to plain text format.
 *
 * @param {Object} content - Export content from context
 * @param {string} [filename] - Optional filename
 */
export function exportToText(content: ExportContent, filename?: string): void {
  const { type, title, data } = content;
  let txt = `${title.toUpperCase()}\n`;
  txt += '='.repeat(50) + '\n\n';

  if (type === ContentType.LAWS || type === ContentType.SINGLE_LAW) {
    const laws = (Array.isArray(data) ? data : [data]) as Partial<Law>[];

    laws.forEach(law => {
      const lawText = getLawDisplayText(law);
      txt += `${lawText}\n`;
      if (law.attribution) {
        txt += `- ${law.attribution}\n`;
      }
      txt += '\n' + '-'.repeat(30) + '\n\n';
    });
  } else if (type === ContentType.CONTENT) {
    // Strip markdown formatting for plain text
    const plainText = String(data || '')
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/_([^_]+)_/g, '$1') // Remove underscore italic
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/>\s*/gm, ''); // Remove blockquote markers

    txt += plainText;
  } else if (type === ContentType.CATEGORIES && Array.isArray(data)) {
    const categories = data as Partial<Category>[];
    categories.forEach(cat => {
      txt += `${cat.title || cat.name || ''} (${cat.law_count || 0} laws)\n`;
    });
  }

  // Footer with export info
  txt += '\n' + '='.repeat(50) + '\n';
  txt += `Exported from ${SITE_NAME} on ${getDateString()}\n`;
  txt += SITE_URL + '\n';

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
  const outputFilename = filename || generateFilename(title, 'txt');
  downloadFile(blob, outputFilename);
}

/**
 * Export content to the specified format.
 * Convenience function that routes to the appropriate export function.
 *
 * @param {Object} content - Export content from context
 * @param {string} format - Format identifier ('pdf', 'csv', 'md', 'txt')
 * @param {string} [filename] - Optional filename
 */
export async function exportContent(content: ExportContent, format: string, filename?: string): Promise<void> {
  switch (format) {
    case 'pdf':
      await exportToPDF(content, filename);
      break;
    case 'csv':
      exportToCSV(content, filename);
      break;
    case 'md':
      exportToMarkdown(content, filename);
      break;
    case 'txt':
      exportToText(content, filename);
      break;
    default:
      Sentry.captureMessage(`Unknown export format: ${format}`, 'warning');
  }
}
