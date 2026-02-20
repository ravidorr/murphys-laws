/**
 * @fileoverview Export Utilities
 *
 * Provides functions to export page content to various formats:
 * - PDF (using jsPDF)
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
import { jsPDF } from 'jspdf';
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

/**
 * Export content to PDF using jsPDF.
 * PDF generation uses jsPDF for client-side generation.
 * This avoids server load and works offline.
 * Page breaks are calculated based on content height.
 *
 * @param {Object} content - Export content from context
 * @param {string} [filename] - Optional filename (auto-generated if not provided)
 */
export function exportToPDF(content: ExportContent, filename?: string): void {
  const doc = new jsPDF();
  const { type, title, data } = content;

  let y = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (margin * 2);

  // Header - Site name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(SITE_NAME, margin, y);
  y += 10;

  // Title
  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 15;

  // Content based on type
  if (type === ContentType.LAWS || type === ContentType.SINGLE_LAW) {
    const laws = (Array.isArray(data) ? data : [data]) as Partial<Law>[];

    laws.forEach((law) => {
      // Check for page break - leave room for at least text + attribution
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }

      // Law text (combines title and text if both exist)
      const lawText = getLawDisplayText(law);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const textLines = doc.splitTextToSize(lawText, contentWidth);

      // Check if text will overflow
      if (y + (textLines.length * 5) > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      doc.text(textLines, margin, y);
      y += textLines.length * 5 + 3;

      // Attribution (if present)
      if (law.attribution) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(`- ${law.attribution}`, margin, y);
        y += 8;
      }

      y += 5; // Space between laws
    });
  } else if (type === ContentType.CONTENT) {
    // Content pages (about, privacy, etc.) - render as text
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Strip markdown for PDF (basic conversion)
    const plainText = String(data || '')
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Convert links to text

    const lines = doc.splitTextToSize(plainText, contentWidth);
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines[lineIndex], margin, y);
      y += 5;
      lineIndex++;
    }
  } else if (type === ContentType.CATEGORIES && Array.isArray(data)) {
    // Categories list
    const categories = data as Partial<Category>[];
    doc.setFontSize(10);

    categories.forEach((cat) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(cat.title || cat.title || cat.name || '', margin, y);

      doc.setFont('helvetica', 'normal');
      const countText = ` (${cat.law_count || 0} laws)`;
      const nameWidth = doc.getTextWidth(cat.title || cat.title || cat.name || '');
      doc.text(countText, margin + nameWidth, y);

      y += 7;
    });
  }

  // Footer with page numbers and export date
  const pageCount = doc.getNumberOfPages();
  const exportDate = getDateString();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i} of ${pageCount} | Exported ${exportDate} | ${SITE_URL}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const outputFilename = filename || generateFilename(title, 'pdf');
  doc.save(outputFilename);
}

/**
 * Escape a value for CSV (handle quotes and special characters).
 * @param {*} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeCSVValue(value: unknown): string {
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
export function exportContent(content: ExportContent, format: string, filename?: string): void {
  switch (format) {
    case 'pdf':
      exportToPDF(content, filename);
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
