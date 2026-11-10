/**
 * Thank-you email sent to a submitter when their law is published. Plain and unstyled like the other
 * email templates: the repository prohibits inline CSS and email clients cannot load app CSS.
 */

type Escapable = string | number | boolean | null | undefined;

export interface LawApprovalEmailData {
  id: number | string;
  title?: string | null;
  text: string;
  name?: string | null;
  /** The corollaries that were published with the law; rejected ones are left out. */
  corollaries?: { id: number | string; title?: string | null; text: string }[];
}

/** Production origin; callers pass their own (the backend uses SITE_URL from its constants). */
export const DEFAULT_SITE_URL = 'https://murphys-laws.com';

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

function greetingName(name: string | null | undefined): string {
  const trimmed = (name || '').trim();
  return trimmed && trimmed.toLowerCase() !== 'anonymous' ? trimmed : 'there';
}

export function createLawApprovalEmailSubject(): string {
  return 'Your Murphy\'s Law is now published';
}

export function getLawUrl(id: number | string, siteUrl = DEFAULT_SITE_URL): string {
  return `${siteUrl.replace(/\/+$/, '')}/law/${encodeURIComponent(String(id))}`;
}

function corollaryTextBlock(corollaries: LawApprovalEmailData['corollaries'], siteUrl: string): string {
  if (!corollaries || corollaries.length === 0) {
    return '';
  }
  const items = corollaries
    .map((corollary) => `- ${corollary.title ? `${corollary.title}: ` : ''}${corollary.text}\n  ${getLawUrl(corollary.id, siteUrl)}`)
    .join('\n');
  return `\nPublished with it ${corollaries.length === 1 ? 'as a corollary' : 'as corollaries'}:\n\n${items}\n`;
}

export function createLawApprovalEmailText(
  lawData: LawApprovalEmailData,
  siteUrl = DEFAULT_SITE_URL,
): string {
  const { id, title, text, name, corollaries } = lawData;
  const heading = title ? `${title}\n` : '';

  return `Hi ${greetingName(name)},

Thank you for submitting a law to Murphy's Laws. We reviewed it and it is now published:

${heading}${text}
${corollaryTextBlock(corollaries, siteUrl)}
See it on the site: ${getLawUrl(id, siteUrl)}

Thanks for contributing, and keep the laws coming.

Murphy's Laws
${siteUrl}

You received this because this email address was given when submitting law #${id} to Murphy's Laws.
`;
}

export function createLawApprovalEmailHtml(
  lawData: LawApprovalEmailData,
  siteUrl = DEFAULT_SITE_URL,
): string {
  const { id, title, text, name, corollaries } = lawData;
  const corollaryItems = (corollaries ?? [])
    .map(
      (corollary) =>
        `<li>${corollary.title ? `<strong>${escapeHtml(corollary.title)}</strong>: ` : ''}${escapeHtml(corollary.text)} (<a href="${escapeHtml(getLawUrl(corollary.id, siteUrl))}">see it</a>)</li>`,
    )
    .join('\n      ');
  const corollaryList = corollaryItems
    ? `<p>Published with it ${corollaries && corollaries.length === 1 ? 'as a corollary' : 'as corollaries'}:</p>\n    <ul>\n      ${corollaryItems}\n    </ul>`
    : '';
  const safeTitle = escapeHtml(title);
  const safeLawUrl = escapeHtml(getLawUrl(id, siteUrl));
  const safeSiteUrl = escapeHtml(siteUrl);

  return `
    <p>Hi ${escapeHtml(greetingName(name))},</p>
    <p>Thank you for submitting a law to Murphy's Laws. We reviewed it and it is now published:</p>
    <blockquote>
      ${safeTitle ? `<p><strong>${safeTitle}</strong></p>` : ''}
      <p>${escapeHtml(text)}</p>
    </blockquote>
    ${corollaryList}
    <p><a href="${safeLawUrl}">See it on the site</a></p>
    <p>Thanks for contributing, and keep the laws coming.</p>
    <p>Murphy's Laws<br><a href="${safeSiteUrl}">${safeSiteUrl}</a></p>
    <p><small>You received this because this email address was given when submitting law #${escapeHtml(id)} to Murphy's Laws.</small></p>
  `;
}
