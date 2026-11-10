/**
 * Plain, semantic email templates. Deliberately unstyled: the repository
 * prohibits inline CSS and email clients cannot reliably load app CSS.
 */

type Escapable = string | number | boolean | null | undefined;

export interface LawSubmissionEmailData {
  id: number | string;
  title?: string | null;
  text: string;
  author?: string | null;
  email?: string | null;
  /** Corollaries submitted with the law; the moderator reviews them together with it. */
  corollaries?: { title?: string | null; text: string }[];
}

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

function corollaryLines(corollaries: LawSubmissionEmailData['corollaries']): string {
  return (corollaries ?? [])
    .map((corollary, index) => `Corollary ${index + 1}: ${corollary.title ? `${corollary.title} - ` : ''}${corollary.text}`)
    .join('\n');
}

export function createLawSubmissionEmailSubject(
  lawId: number | string,
): string {
  return `New Murphy's Law Submitted! (ID: ${escapeHtml(lawId)})`;
}

export function createLawSubmissionEmailText(
  lawData: LawSubmissionEmailData,
  reviewUrl = 'http://murphys-laws.com/admin',
): string {
  const { id, title, text, author, email, corollaries } = lawData;
  const corollaryBlock = corollaries && corollaries.length > 0 ? `${corollaryLines(corollaries)}\n` : '';

  return `A new Murphy's Law has been submitted for review.

Law ID: ${id}
Title: ${title || '(no title)'}
Text: ${text}
${corollaryBlock}Author: ${author || 'Anonymous'}
Email: ${email || 'Not provided'}

Review at: ${reviewUrl} (or use npm run review locally)
`;
}

export function createLawSubmissionEmailHtml(
  lawData: LawSubmissionEmailData,
  reviewUrl = 'http://murphys-laws.com/admin',
): string {
  const { id, title, text, author, email, corollaries } = lawData;
  const corollaryRows = (corollaries ?? [])
    .map(
      (corollary, index) =>
        `<tr><th scope="row">Corollary ${index + 1}:</th><td>${corollary.title ? `<strong>${escapeHtml(corollary.title)}</strong><br>` : ''}${escapeHtml(corollary.text)}</td></tr>`,
    )
    .join('\n        ');
  const safeId = escapeHtml(id);
  const safeTitle = escapeHtml(title);
  const safeText = escapeHtml(text);
  const safeAuthor = escapeHtml(author);
  const safeEmail = escapeHtml(email);
  const safeReviewUrl = escapeHtml(reviewUrl);

  return `
    <h2>New Murphy's Law Submitted!</h2>
    <p>A new law has been submitted for review.</p>
    <table>
      <tbody>
        <tr><th scope="row">Law ID:</th><td>${safeId}</td></tr>
        <tr><th scope="row">Title:</th><td>${safeTitle || '<em>(no title)</em>'}</td></tr>
        <tr><th scope="row">Text:</th><td>${safeText}</td></tr>
        ${corollaryRows}
        <tr><th scope="row">Author:</th><td>${safeAuthor || 'Anonymous'}</td></tr>
        <tr><th scope="row">Email:</th><td>${safeEmail || 'Not provided'}</td></tr>
      </tbody>
    </table>
    <p><a href="${safeReviewUrl}">Review submissions</a> (or use <code>npm run review</code> locally)</p>
  `;
}
