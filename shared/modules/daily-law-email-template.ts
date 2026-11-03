/**
 * Emails for the daily Law of the Day subscription: the double opt-in confirmation and the daily message.
 * Both use the shared branded layout in email-layout.ts (table layout, inline styles, dark mode) and send a
 * plain-text alternative alongside the HTML.
 */
import { escapeHtml } from './html-escape.ts';
import {
  emailButton,
  emailDetails,
  emailEyebrow,
  emailHeading,
  emailLink,
  emailParagraph,
  emailQuote,
  emailRow,
  renderEmailLayout,
  siteLink,
} from './email-layout.ts';

export interface DailyLawEmailData {
  id: number | string;
  title?: string | null;
  text: string;
  /** Primary category, when the law has one. Anything but a non-empty string is ignored. */
  category_name?: unknown;
  category_slug?: unknown;
  /** Who the law is attributed to, as stored: `{ name, note }` entries. Anything else is ignored. */
  attributions?: unknown;
}

const MAX_ATTRIBUTION_NAMES = 3;
const PREHEADER_LENGTH = 110;

export function createSubscriptionConfirmationSubject(): string {
  return 'Confirm your daily Murphy\'s Law email';
}

export function createSubscriptionConfirmationText(confirmUrl: string): string {
  return `Someone asked for the Murphy's Law of the Day to be emailed to this address.

To start the daily email, confirm here:
${confirmUrl}

If this wasn't you, ignore this message. Nothing is sent until you confirm.
`;
}

export function createSubscriptionConfirmationHtml(confirmUrl: string, siteUrl: string): string {
  const body = [
    emailRow(emailHeading('Confirm your daily Murphy\'s Law email'), 'padding-top:32px;'),
    emailRow(
      emailParagraph('Someone asked for the Murphy\'s Law of the Day to be emailed to this address. Confirm to start the daily email.'),
      'padding-top:16px;',
    ),
    emailRow(emailButton('Confirm and start the daily email', confirmUrl), 'padding-top:28px;padding-bottom:32px;'),
  ].join('\n');
  return renderEmailLayout({
    title: createSubscriptionConfirmationSubject(),
    preheader: 'Confirm to start the daily Murphy\'s Law email. Nothing is sent until you do.',
    siteUrl,
    bodyRows: body,
    footerHtml: 'If this wasn\'t you, ignore this message. Nothing is sent until you confirm.',
  });
}

export function createDailyLawSubject(law: DailyLawEmailData): string {
  const label = (law.title || '').trim();
  return label ? `Law of the Day: ${label}` : 'Murphy\'s Law of the Day';
}

function lawUrl(id: number | string, siteUrl: string): string {
  return siteLink(siteUrl, `/law/${encodeURIComponent(String(id))}`);
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Up to three attribution names, in stored order; ignores entries that are not `{ name: string }`. */
function attributionNames(attributions: unknown): string[] {
  if (!Array.isArray(attributions)) return [];
  const names: string[] = [];
  for (const entry of attributions) {
    const name = cleanString((entry as { name?: unknown } | null)?.name);
    if (name && !names.includes(name)) names.push(name);
  }
  return names.slice(0, MAX_ATTRIBUTION_NAMES);
}

function categoryUrl(slug: string, siteUrl: string): string {
  return siteLink(siteUrl, `/category/${encodeURIComponent(slug)}`);
}

function preheaderFor(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length > PREHEADER_LENGTH ? `${chars.slice(0, PREHEADER_LENGTH - 1).join('').trimEnd()}\u2026` : flat;
}

export function createDailyLawText(law: DailyLawEmailData, siteUrl: string, unsubscribeUrl: string): string {
  const title = cleanString(law.title);
  const heading = title ? `${title}\n` : '';
  const names = attributionNames(law.attributions);
  const category = cleanString(law.category_name);
  const details = [
    names.length ? `Attributed to: ${names.join(', ')}` : '',
    category ? `Category: ${category}` : '',
  ].filter(Boolean).join('\n');
  return `Murphy's Law of the Day

${heading}${law.text}
${details ? `\n${details}\n` : ''}
Read, vote and share: ${lawUrl(law.id, siteUrl)}

Unsubscribe: ${unsubscribeUrl}
`;
}

export function createDailyLawHtml(law: DailyLawEmailData, siteUrl: string, unsubscribeUrl: string): string {
  const title = cleanString(law.title);
  const names = attributionNames(law.attributions);
  const category = cleanString(law.category_name);
  const slug = cleanString(law.category_slug);
  const categoryHtml = category
    ? slug
      ? emailLink(categoryUrl(slug, siteUrl), escapeHtml(category))
      : escapeHtml(category)
    : '';
  const details = [
    names.length ? `Attributed to ${escapeHtml(names.join(', '))}` : '',
    categoryHtml ? `Category: ${categoryHtml}` : '',
  ].filter(Boolean).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;');

  const rows = [
    emailRow(emailEyebrow('Murphy\'s Law of the Day'), 'padding-top:32px;'),
    title
      ? emailRow(emailHeading(title), 'padding-top:8px;')
      : '',
    emailRow(emailQuote(law.text), 'padding-top:20px;'),
    details ? emailRow(emailDetails(details), 'padding-top:16px;') : '',
    emailRow(emailButton('Read, vote and share', lawUrl(law.id, siteUrl)), 'padding-top:28px;padding-bottom:32px;'),
  ].filter(Boolean).join('\n');

  return renderEmailLayout({
    title: createDailyLawSubject(law),
    preheader: preheaderFor(law.text),
    siteUrl,
    bodyRows: rows,
    footerHtml: `You get this email because you subscribed to the Murphy's Law of the Day.<br>${emailLink(unsubscribeUrl, 'Unsubscribe')}`,
  });
}
