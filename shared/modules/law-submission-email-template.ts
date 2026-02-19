/**
 * Email template module for law submission notifications
 * Provides HTML and plain text email templates with XSS protection
 */

type Escapable = string | number | boolean | null | undefined;

export interface LawSubmissionEmailData {
  id: number | string;
  title?: string | null;
  text: string;
  author?: string | null;
  email?: string | null;
}

/**
 * Escapes HTML special characters to prevent XSS attacks in email templates
 * @param {any} value - Value to escape
 * @returns {string} Escaped string safe for HTML insertion
 */
function escapeHtml(value: Escapable): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}

/**
 * Creates the subject line for law submission notification emails
 * @param {number|string} lawId - The ID of the submitted law
 * @returns {string} Email subject line
 */
export function createLawSubmissionEmailSubject(lawId: number | string): string {
  return `New Murphy's Law Submitted! (ID: ${escapeHtml(lawId)})`;
}

/**
 * Creates plain text version of law submission notification email
 * @param {Object} lawData - Law submission data
 * @param {number|string} lawData.id - Law ID
 * @param {string} lawData.title - Law title (optional)
 * @param {string} lawData.text - Law text
 * @param {string} lawData.author - Author name (optional)
 * @param {string} lawData.email - Author email (optional)
 * @param {string} reviewUrl - URL for reviewing submissions
 * @returns {string} Plain text email content
 */
export function createLawSubmissionEmailText(
  lawData: LawSubmissionEmailData,
  reviewUrl = 'http://murphys-laws.com/admin'
): string {
  const { id, title, text, author, email } = lawData;

  return `A new Murphy's Law has been submitted for review.

Law ID: ${id}
Title: ${title || '(no title)'}
Text: ${text}
Author: ${author || 'Anonymous'}
Email: ${email || 'Not provided'}

Review at: ${reviewUrl} (or use npm run review locally)
`;
}

/**
 * Creates HTML version of law submission notification email
 * @param {Object} lawData - Law submission data
 * @param {number|string} lawData.id - Law ID
 * @param {string} lawData.title - Law title (optional)
 * @param {string} lawData.text - Law text
 * @param {string} lawData.author - Author name (optional)
 * @param {string} lawData.email - Author email (optional)
 * @param {string} reviewUrl - URL for reviewing submissions
 * @returns {string} HTML email content
 */
export function createLawSubmissionEmailHtml(
  lawData: LawSubmissionEmailData,
  reviewUrl = 'http://murphys-laws.com/admin'
): string {
  const { id, title, text, author, email } = lawData;

  // Escape all user-submitted values to prevent XSS
  const safeId = escapeHtml(id);
  const safeTitle = escapeHtml(title);
  const safeText = escapeHtml(text);
  const safeAuthor = escapeHtml(author);
  const safeEmail = escapeHtml(email);
  const safeReviewUrl = escapeHtml(reviewUrl);

  return `
    <h2>New Murphy's Law Submitted!</h2>
    <p>A new law has been submitted for review.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 8px; font-weight: bold;">Law ID:</td><td style="padding: 8px;">${safeId}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Title:</td><td style="padding: 8px;">${safeTitle || '<em>(no title)</em>'}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Text:</td><td style="padding: 8px;">${safeText}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Author:</td><td style="padding: 8px;">${safeAuthor || 'Anonymous'}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${safeEmail || 'Not provided'}</td></tr>
    </table>
    <p><a href="${safeReviewUrl}">Review submissions</a> (or use <code>npm run review</code> locally)</p>
  `;
}
