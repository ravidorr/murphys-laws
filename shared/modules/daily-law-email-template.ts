/**
 * Emails for the daily Law of the Day subscription: the double opt-in confirmation and the daily message.
 * Plain and unstyled like the other email templates: the repository prohibits inline CSS and email clients
 * cannot load app CSS.
 */
import { escapeHtml } from './html-escape.ts';

export interface DailyLawEmailData {
  id: number | string;
  title?: string | null;
  text: string;
}

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

export function createSubscriptionConfirmationHtml(confirmUrl: string): string {
  const url = escapeHtml(confirmUrl);
  return `<p>Someone asked for the Murphy's Law of the Day to be emailed to this address.</p>
<p><a href="${url}">Confirm and start the daily email</a></p>
<p>If this wasn't you, ignore this message. Nothing is sent until you confirm.</p>`;
}

export function createDailyLawSubject(law: DailyLawEmailData): string {
  const label = (law.title || '').trim();
  return label ? `Law of the Day: ${label}` : 'Murphy\'s Law of the Day';
}

function lawUrl(id: number | string, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/law/${encodeURIComponent(String(id))}`;
}

export function createDailyLawText(law: DailyLawEmailData, siteUrl: string, unsubscribeUrl: string): string {
  const heading = law.title ? `${law.title}\n` : '';
  return `Murphy's Law of the Day

${heading}${law.text}

Read it, vote on it and share it: ${lawUrl(law.id, siteUrl)}

Unsubscribe: ${unsubscribeUrl}
`;
}

export function createDailyLawHtml(law: DailyLawEmailData, siteUrl: string, unsubscribeUrl: string): string {
  const heading = law.title ? `<h2>${escapeHtml(law.title)}</h2>\n` : '';
  return `<h1>Murphy's Law of the Day</h1>
${heading}<p>${escapeHtml(law.text)}</p>
<p><a href="${escapeHtml(lawUrl(law.id, siteUrl))}">Read it, vote on it and share it</a></p>
<p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>`;
}
