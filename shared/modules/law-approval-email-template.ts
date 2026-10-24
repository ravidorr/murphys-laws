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
}

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

export function createLawApprovalEmailText(
  lawData: LawApprovalEmailData,
  siteUrl = DEFAULT_SITE_URL,
): string {
  const { id, title, text, name } = lawData;
  const heading = title ? `${title}\n` : '';

  return `Hi ${greetingName(name)},

Thank you for submitting a law to Murphy's Laws. We reviewed it and it is now published:

${heading}${text}

See it on the site: ${getLawUrl(id, siteUrl)}

Thanks for contributing, and keep the laws coming.

Murphy's Laws
${siteUrl}
`;
}

export function createLawApprovalEmailHtml(
  lawData: LawApprovalEmailData,
  siteUrl = DEFAULT_SITE_URL,
): string {
  const { id, title, text, name } = lawData;
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
    <p><a href="${safeLawUrl}">See it on the site</a></p>
    <p>Thanks for contributing, and keep the laws coming.</p>
    <p>Murphy's Laws<br><a href="${safeSiteUrl}">${safeSiteUrl}</a></p>
  `;
}
