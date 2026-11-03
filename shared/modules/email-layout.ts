/**
 * Shared frame for the subscription emails: the site header and wordmark, a content area, a footer, and the
 * primary button. Email clients ignore stylesheets and CSS variables, so the values are written out
 * (inline, in a 600px table layout). The colors come from email-tokens.generated.ts, which
 * shared/design-tokens/export-email-tokens.ts generates from web/styles/partials/variables.css, so there is
 * no second token source. This is the only module with inline styles (see conformance-allowlist.md); the
 * templates build their content through the helpers below. A small <style> block only adds what inline
 * styles cannot express: dark mode and the phone layout.
 */
import { escapeHtml } from './html-escape.ts';
import { EMAIL_TOKENS } from './email-tokens.generated.ts';

export { EMAIL_TOKENS };

const T = EMAIL_TOKENS;

/** Work Sans first, as on the site; mail clients fall back to the system font. */
export const EMAIL_FONT = "'Work Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const DARK_MODE_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .em-bg { background-color: ${T['dark-bg-primary']} !important; }
  .em-fg { color: ${T['dark-fg-primary']} !important; }
  .em-muted { color: ${T['dark-muted-fg']} !important; }
  .em-link { color: ${T['dark-link']} !important; }
  .em-border { border-color: ${T['dark-surface-border']} !important; }
  .em-badge { background-color: ${T['dark-primary']} !important; }
  .em-accent { color: ${T['dark-link']} !important; }
  .em-quote { border-left-color: ${T['dark-link']} !important; }
}
@media only screen and (max-width: 620px) {
  .em-container { width: 100% !important; }
  .em-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .em-law { font-size: 22px !important; }
  .em-button-table { width: 100% !important; }
  .em-button-cell { display: block !important; width: 100% !important; }
  .em-button { display: block !important; text-align: center !important; }
}`;

/** Absolute URL of a site path, tolerating a trailing slash on the site URL. */
export function siteLink(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${path}`;
}

/** One block of the email: a table row holding one cell, padded like the others. */
export function emailRow(innerHtml: string, extraStyle = ''): string {
  return `<tr><td class="em-pad" style="padding:0 32px;${extraStyle}">${innerHtml}</td></tr>`;
}

/** Bulletproof button: a table cell carries the background (Outlook ignores it on links). */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" class="em-button-table" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
<tr><td class="em-button-cell" align="center" bgcolor="${T['btn-primary-bg']}" style="border-radius:8px;background-color:${T['btn-primary-bg']};mso-padding-alt:14px 28px;">
<a class="em-button" href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT};font-size:16px;font-weight:600;line-height:20px;color:${T['btn-primary-fg']};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

/** The site wordmark as in the web header: the "M" badge, "Murphy's Law" and the tagline. */
function header(siteUrl: string): string {
  const home = escapeHtml(siteLink(siteUrl, '/'));
  return `<tr><td class="em-pad em-border" style="padding:20px 32px;border-bottom:1px solid ${T['surface-border']};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="em-badge" width="44" height="44" align="center" valign="middle" bgcolor="${T.primary}" style="width:44px;height:44px;border-radius:6px;background-color:${T.primary};font-family:${EMAIL_FONT};font-size:24px;font-weight:800;line-height:44px;color:${T.white};"><a href="${home}" aria-label="Murphy's Law Archive" style="display:block;color:${T.white};text-decoration:none;">M</a></td>
<td style="padding-left:12px;font-family:${EMAIL_FONT};" valign="middle">
<div class="em-fg" style="font-size:24px;font-weight:700;line-height:26px;color:${T.fg};"><a class="em-fg" href="${home}" style="color:${T.fg};text-decoration:none;"><span class="em-accent" style="color:${T['btn-primary-bg']};">Murphy's</span> Law</a></div>
<div class="em-muted" style="padding-top:4px;font-size:14px;line-height:16px;color:${T['muted-fg']};">If it can go wrong, it will.</div>
</td>
</tr></table>
</td></tr>`;
}

export interface EmailLayoutOptions {
  /** Document title; also the heading some clients show in the inbox list. */
  title: string;
  /** Hidden text mail clients show after the subject in the inbox list. */
  preheader: string;
  siteUrl: string;
  /** Already-built, already-escaped rows (see emailRow). */
  bodyRows: string;
  /** Already-escaped footer content: the reason for the email and, when relevant, the unsubscribe link. */
  footerHtml: string;
}

/** The whole HTML document. */
export function renderEmailLayout({ title, preheader, siteUrl, bodyRows, footerHtml }: EmailLayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>${DARK_MODE_CSS}</style>
</head>
<body class="em-bg" style="margin:0;padding:0;background-color:${T.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" class="em-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${T.bg}" style="background-color:${T.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="em-container em-border" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border:1px solid ${T['surface-border']};border-radius:12px;border-collapse:separate;">
${header(siteUrl)}
${bodyRows}
<tr><td class="em-pad em-border" style="padding:20px 32px;border-top:1px solid ${T['surface-border']};font-family:${EMAIL_FONT};font-size:14px;line-height:21px;color:${T['muted-fg']};"><span class="em-muted" style="color:${T['muted-fg']};">${footerHtml}</span></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const STYLES = {
  heading: `font-family:${EMAIL_FONT};font-size:24px;font-weight:700;line-height:30px;color:${T.fg};`,
  body: `font-family:${EMAIL_FONT};font-size:16px;line-height:24px;color:${T.fg};`,
  muted: `font-family:${EMAIL_FONT};font-size:14px;line-height:21px;color:${T['muted-fg']};`,
  link: `color:${T.link};text-decoration:underline;`,
  eyebrow: `font-family:${EMAIL_FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;line-height:16px;text-transform:uppercase;color:${T['muted-fg']};`,
  law: `font-family:${EMAIL_FONT};font-size:26px;font-weight:600;line-height:36px;color:${T.fg};`,
} as const;

/** Page heading (h1). `text` is plain text. */
export function emailHeading(text: string): string {
  return `<h1 class="em-fg" style="margin:0;${STYLES.heading}">${escapeHtml(text)}</h1>`;
}

/** Body paragraph. `html` must already be escaped. */
export function emailParagraph(html: string): string {
  return `<p class="em-fg" style="margin:0;${STYLES.body}">${html}</p>`;
}

/** Smaller, quieter paragraph for details. `html` must already be escaped. */
export function emailDetails(html: string): string {
  return `<p class="em-muted" style="margin:0;${STYLES.muted}">${html}</p>`;
}

/** Small uppercase label above a heading. `text` is plain text. */
export function emailEyebrow(text: string): string {
  return `<p class="em-muted" style="margin:0;${STYLES.eyebrow}">${escapeHtml(text)}</p>`;
}

/** Underlined text link. `labelHtml` must already be escaped. */
export function emailLink(url: string, labelHtml: string): string {
  return `<a class="em-link" href="${escapeHtml(url)}" style="${STYLES.link}">${labelHtml}</a>`;
}

/** The law, large, in a quote block with the site's accent bar. `text` is plain text. */
export function emailQuote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="em-quote" style="padding:4px 0 4px 20px;border-left:4px solid ${T['btn-primary-bg']};"><p class="em-law em-fg" style="margin:0;${STYLES.law}">${escapeHtml(text)}</p></td></tr></table>`;
}
