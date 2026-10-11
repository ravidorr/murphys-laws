/**
 * Daily operational report renderer and delivery.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ReportItemKind =
  | 'row'
  | 'bullet'
  | 'bullet-pass'
  | 'callout'
  | 'callout-check-failed'
  | 'subheading'
  | 'command'
  | 'closing';

export interface ReportItem {
  label?: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'critical';
  kind?: ReportItemKind;
  /** ISO timestamp shown in muted parentheses (peak metrics). */
  timestamp?: string;
  boldValue?: boolean;
  valueSecondary?: string;
}

export interface ReportSection {
  title: string;
  items: ReportItem[];
}

export interface DailyReport {
  date: string;
  subjectSuffix: string;
  /** When set, appended to the subject as `[test <timestamp>]` for smoke-test mail. */
  testEmailSentAtUtc?: string;
  preview: string;
  summary: ReportItem[];
  sections: ReportSection[];
}

export interface CollectOptions {
  mode?: 'live' | 'test-email';
  now?: Date;
  repoRoot?: string;
}

export interface MessageOptions {
  from: string;
  to: string;
}

const DEFAULT_FROM = "Murphy's Laws Server <alerts@murphys-laws.com>";
const DEFAULT_ALERT_EMAIL = 'ravidor@gmail.com';
const SECTION_RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type GlanceState = 'healthy' | 'attention' | 'check-failed' | 'down';

function itemToneColor(tone: ReportItem['tone']): string {
  switch (tone) {
    case 'success':
      return '#15803d';
    case 'warning':
      return '#a16207';
    case 'critical':
      return '#b91c1c';
    default:
      return '#111827';
  }
}

function glanceStateFromItem(item: ReportItem): GlanceState {
  if (item.tone === 'success') {
    return 'healthy';
  }
  if (item.tone === 'critical') {
    return 'down';
  }
  if (item.tone === 'warning' && /unknown|unavailable/i.test(item.value)) {
    return 'check-failed';
  }
  if (item.tone === 'warning') {
    return 'attention';
  }
  return 'attention';
}

function plainGlanceTag(state: GlanceState): string {
  switch (state) {
    case 'healthy':
      return '[OK]';
    case 'attention':
      return '[!]';
    case 'check-failed':
      return '[?]';
    case 'down':
      return '[X]';
  }
}

function splitSectionTitle(title: string): { main: string; suffix?: string } {
  const match = title.match(/^(.+?)\s+\(([^)]+)\)$/);
  if (!match) {
    return { main: title };
  }
  return { main: match[1], suffix: match[2] };
}

function renderGlyphSpan(state: GlanceState): string {
  switch (state) {
    case 'healthy':
      return '<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border:1px solid #15803d;background:#f0fdf4;color:#15803d;font-size:14px;font-weight:bold;">&#10003;</span>';
    case 'attention':
      return '<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border:1px solid #a16207;background:#fefce8;color:#a16207;font-size:14px;font-weight:bold;">!</span>';
    case 'check-failed':
      return '<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border:1px dashed #a16207;background:#fefce8;color:#a16207;font-size:14px;font-weight:bold;">?</span>';
    case 'down':
      return '<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border:1px solid #b91c1c;background:#b91c1c;color:#ffffff;font-size:14px;font-weight:bold;">&#10005;</span>';
  }
}

function renderHtmlHeader(date: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%">',
    '<tr><td style="font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#4b5563;padding:0 0 4px 0;">Murphy&#39;s Laws Server</td></tr>',
    '<tr><td style="font-size:22px;line-height:28px;font-weight:bold;color:#111827;">Daily Status Report</td></tr>',
    `<tr><td style="font-size:14px;color:#4b5563;padding:2px 0 0 0;">${escapeHtml(date)}</td></tr>`,
    '</table>',
  ].join('');
}

function renderHtmlAtAGlance(items: ReportItem[]): string {
  const rows: string[] = [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0 0 0;">',
    '<tr><td colspan="3" style="padding:10px 0 6px 0;border-top:2px solid #111827;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#111827;">At a glance</td></tr>',
  ];
  for (const item of items) {
    const state = glanceStateFromItem(item);
    const toneColor = itemToneColor(item.tone);
    rows.push(
      `<tr><td width="96" style="width:96px;padding:10px 8px 10px 0;border-top:1px solid #e5e7eb;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#4b5563;vertical-align:middle;">${escapeHtml(item.label ?? 'Status')}</td>`,
      `<td width="36" style="width:36px;padding:10px 0;border-top:1px solid #e5e7eb;vertical-align:middle;">${renderGlyphSpan(state)}</td>`,
      `<td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:15px;line-height:20px;font-weight:bold;color:${toneColor};vertical-align:middle;">${escapeHtml(item.value)}</td></tr>`,
    );
  }
  rows.push('</table>');
  return rows.join('');
}

function renderHtmlLabelValueRow(item: ReportItem, strongTop: boolean): string {
  const topRule = strongTop ? '2px solid #111827' : '1px solid #e5e7eb';
  let valueHtml = escapeHtml(item.value);
  if (item.timestamp) {
    valueHtml += `<span style="font-size:12px;color:#4b5563;"> (${escapeHtml(item.timestamp)})</span>`;
  }
  if (item.tone === 'warning') {
    valueHtml = `<span style="color:#a16207;font-weight:bold;">! </span>${valueHtml}`;
  } else if (item.boldValue && !item.label?.includes('MAIN DROPLET')) {
    valueHtml = `<span style="font-weight:bold;">${valueHtml}</span>`;
  }
  const monoValue =
    item.label === 'MAIN DROPLET (murphys-laws.com)'
      ? `<span style="font-family:&#39;Courier New&#39;,Courier,monospace;">${escapeHtml(item.value)}</span>`
      : valueHtml;
  const labelHtml =
    item.boldValue && item.label
      ? `<span style="font-weight:bold;color:#111827;">${escapeHtml(item.label)}</span>`
      : escapeHtml(item.label ?? '');
  return [
    `<tr><td width="38%" style="width:38%;padding:8px 12px 8px 0;border-top:${topRule};font-size:13px;line-height:20px;color:#4b5563;vertical-align:top;">${labelHtml}</td>`,
    `<td style="padding:8px 0;border-top:${topRule};font-size:14px;line-height:20px;color:#111827;vertical-align:top;word-break:break-word;">${monoValue}</td></tr>`,
  ].join('');
}

function renderHtmlBulletRow(item: ReportItem): string {
  const marker =
    item.kind === 'bullet-pass'
      ? '<span style="color:#15803d;font-weight:bold;">&#10003;</span>'
      : '&bull;';
  const text =
    item.kind === 'bullet-pass'
      ? `<span style="color:#111827;">${escapeHtml(item.value)}</span>`
      : escapeHtml(item.value);
  return [
    `<tr><td width="22" style="width:22px;padding:6px 0;border-top:1px solid #e5e7eb;font-size:14px;line-height:20px;color:#4b5563;vertical-align:top;">${marker}</td>`,
    `<td style="padding:6px 0;border-top:1px solid #e5e7eb;font-size:14px;line-height:20px;color:#111827;vertical-align:top;">${text}</td></tr>`,
  ].join('');
}

function renderHtmlTrafficCodeRow(value: string): string {
  const match = value.match(/^(\d{3}):\s*(.+)$/);
  if (!match) {
    return renderHtmlBulletRow({ value, kind: 'bullet' });
  }
  return [
    '<tr>',
    `<td width="38%" style="width:38%;padding:8px 12px 8px 0;border-top:1px solid #e5e7eb;font-size:13px;line-height:20px;color:#4b5563;vertical-align:top;"><span style="color:#4b5563;">&bull;</span> ${escapeHtml(match[1])}</td>`,
    `<td style="padding:8px 0;border-top:1px solid #e5e7eb;font-size:14px;line-height:20px;color:#111827;vertical-align:top;">${escapeHtml(match[2])}</td>`,
    '</tr>',
  ].join('');
}

function renderHtmlCallout(item: ReportItem): string {
  const checkFailed = item.kind === 'callout-check-failed';
  const critical = item.tone === 'critical';
  const background = checkFailed ? '#f3f4f6' : critical ? '#fef2f2' : '#fefce8';
  const border = checkFailed
    ? '1px dashed #a16207'
    : critical
      ? '1px solid #fecaca'
      : '1px solid #fde68a';
  const prefix = checkFailed
    ? '? '
    : critical
      ? '<span style="color:#b91c1c;font-weight:bold;">&#10005; </span>'
      : '<span style="color:#a16207;font-weight:bold;">! </span>';
  const primary = item.boldValue !== false ? `<strong>${escapeHtml(item.value)}</strong>` : escapeHtml(item.value);
  const secondary = item.valueSecondary
    ? ` ${escapeHtml(item.valueSecondary)}`
    : '';
  return [
    '<tr><td colspan="2" style="padding:8px 0 4px 0;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>',
    `<td style="padding:10px 12px;background:${background};border:${border};font-size:14px;line-height:20px;color:#111827;">${prefix}${primary}${secondary}</td>`,
    '</tr></table></td></tr>',
  ].join('');
}

function renderHtmlSubheading(label: string): string {
  return `<tr><td colspan="2" style="padding:16px 0 4px 0;font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#4b5563;">${escapeHtml(label)}</td></tr>`;
}

function renderHtmlCommand(value: string): string {
  return [
    '<tr><td colspan="2" style="padding:4px 0;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>',
    `<td style="padding:10px 12px;background:#f3f4f6;border:1px solid #e5e7eb;font-family:&#39;Courier New&#39;,Courier,monospace;font-size:13px;line-height:18px;color:#111827;word-break:break-all;">${escapeHtml(value)}</td>`,
    '</tr></table></td></tr>',
  ].join('');
}

function defaultItemKind(item: ReportItem): ReportItemKind {
  if (item.kind) {
    return item.kind;
  }
  if (item.label) {
    return 'row';
  }
  if (item.tone === 'warning' || item.tone === 'critical') {
    return 'callout';
  }
  return 'bullet';
}

function renderHtmlSection(sectionBlock: ReportSection): string {
  const { main, suffix } = splitSectionTitle(sectionBlock.title);
  const suffixHtml = suffix
    ? `<span style="font-weight:normal;color:#4b5563;"> (${escapeHtml(suffix)})</span>`
    : '';
  const rows: string[] = [
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0 0;">',
    `<tr><td colspan="2" style="padding:10px 0 6px 0;border-top:2px solid #111827;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#111827;">${escapeHtml(main)}${suffixHtml}</td></tr>`,
  ];

  for (const item of sectionBlock.items) {
    const kind = defaultItemKind(item);
    if (kind === 'subheading') {
      rows.push(renderHtmlSubheading(item.value));
      continue;
    }
    if (kind === 'callout' || kind === 'callout-check-failed') {
      rows.push(renderHtmlCallout(item));
      continue;
    }
    if (kind === 'command') {
      rows.push(renderHtmlCommand(item.value));
      continue;
    }
    if (kind === 'closing') {
      rows.push(renderHtmlLabelValueRow(item, true));
      continue;
    }
    if (kind === 'row' && item.label) {
      rows.push(renderHtmlLabelValueRow(item, false));
      continue;
    }
    if (!item.label && /^\d{3}:\s/.test(item.value)) {
      rows.push(renderHtmlTrafficCodeRow(item.value));
      continue;
    }
    rows.push(renderHtmlBulletRow(item));
  }

  rows.push('</table>');
  return rows.join('');
}

function appendPlainSection(lines: string[], sectionBlock: ReportSection): void {
  lines.push(SECTION_RULE);
  lines.push(sectionBlock.title);
  lines.push(SECTION_RULE);
  lines.push('');
  for (const item of sectionBlock.items) {
    const kind = defaultItemKind(item);
    if (kind === 'subheading') {
      lines.push('');
      continue;
    }
    if (kind === 'callout' || kind === 'callout-check-failed') {
      const tag = kind === 'callout-check-failed' ? '[?]' : '[!]';
      lines.push(`  • ${tag} ${item.value}${item.valueSecondary ? ` ${item.valueSecondary}` : ''}`);
      continue;
    }
    if (kind === 'command') {
      lines.push(`  • ${item.value}`);
      continue;
    }
    if (kind === 'closing' || (kind === 'row' && item.label)) {
      const ts = item.timestamp ? ` (${item.timestamp})` : '';
      const flagged = item.tone === 'warning' ? '[!] ' : '';
      lines.push(`${item.label}: ${flagged}${item.value}${ts}`);
      continue;
    }
    if (kind === 'bullet-pass') {
      lines.push(`  • [OK] ${item.value}`);
      continue;
    }
    lines.push(`  • ${item.value}`);
  }
  lines.push('');
}

export function renderPlainTextReport(report: DailyReport): string {
  const lines: string[] = ['Daily Status Report', report.date, ''];
  if (report.summary.length > 0) {
    lines.push('At a glance');
    lines.push('');
    for (const item of report.summary) {
      const tag = plainGlanceTag(glanceStateFromItem(item));
      lines.push(`${item.label ?? 'Status'}: ${tag} ${item.value}`);
    }
    lines.push('');
  }
  for (const sectionBlock of report.sections) {
    appendPlainSection(lines, sectionBlock);
  }
  return lines.join('\n').trimEnd();
}

export function renderHtmlReport(report: DailyReport): string {
  const inner: string[] = [
    renderHtmlHeader(report.date),
    report.summary.length > 0 ? renderHtmlAtAGlance(report.summary) : '',
    ...report.sections.map((sectionBlock) => renderHtmlSection(sectionBlock)),
  ].filter(Boolean);

  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#111827;background:#f3f4f6;">',
    `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(report.preview)}</div>`,
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f3f4f6"><tr><td align="center" style="padding:12px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#ffffff" style="max-width:640px;background:#ffffff;border-top:4px solid #111827;"><tr><td style="padding:20px;">',
    inner.join(''),
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

export function buildSubject(report: DailyReport): string {
  const base = `Daily Status Report - ${report.date}${report.subjectSuffix}`;
  if (report.testEmailSentAtUtc) {
    return `${base} [test ${report.testEmailSentAtUtc}]`;
  }
  return base;
}

/** RFC 5321 limit; Postfix folds longer lines with a leading space that breaks HTML tags. */
const MIME_HTML_MAX_LINE_BYTES = 900;

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function findHtmlMimeFoldEnd(segment: string, start: number, maxBytes: number): number {
  let bytes = 0;
  let lastGtEnd = start;
  let lastSpaceEnd = start;
  let index = start;

  while (index < segment.length) {
    const codePoint = segment.codePointAt(index)!;
    const unitLength = codePoint > 0xffff ? 2 : 1;
    const units = segment.slice(index, index + unitLength);
    const unitBytes = utf8ByteLength(units);

    if (bytes + unitBytes > maxBytes) {
      if (lastGtEnd > start) {
        return lastGtEnd;
      }
      if (lastSpaceEnd > start) {
        return lastSpaceEnd;
      }
      if (index > start) {
        return index;
      }
      return index + unitLength;
    }

    bytes += unitBytes;
    if (units === '>') {
      lastGtEnd = index + unitLength;
    } else if (/\s/u.test(units)) {
      lastSpaceEnd = index + unitLength;
    }
    index += unitLength;
  }

  return segment.length;
}

function foldEndAvoidingEntitySplit(segment: string, start: number, foldEnd: number): number {
  if (foldEnd <= start) {
    return foldEnd;
  }
  const probe = foldEnd - 1;
  const amp = segment.lastIndexOf('&', probe);
  if (amp < start) {
    return foldEnd;
  }
  const semi = segment.indexOf(';', amp);
  if (semi === -1 || semi < probe) {
    return foldEnd;
  }
  return amp > start ? amp : foldEnd;
}

/**
 * Inserts newlines between tags and folds any remaining long lines at `>` or
 * whitespace (UTF-8 byte length) so MTA transport does not split HTML tags or
 * entities.
 */
export function wrapHtmlForMimeTransport(html: string): string {
  const withTagBreaks = html.replace(/></g, '>\n<');
  const lines: string[] = [];
  for (const segment of withTagBreaks.split('\n')) {
    let start = 0;
    while (start < segment.length) {
      const rest = segment.slice(start);
      if (utf8ByteLength(rest) <= MIME_HTML_MAX_LINE_BYTES) {
        lines.push(rest);
        break;
      }
      let foldEnd = findHtmlMimeFoldEnd(segment, start, MIME_HTML_MAX_LINE_BYTES);
      foldEnd = foldEndAvoidingEntitySplit(segment, start, foldEnd);
      if (foldEnd <= start) {
        foldEnd = findHtmlMimeFoldEnd(segment, start, MIME_HTML_MAX_LINE_BYTES);
      }
      lines.push(segment.slice(start, foldEnd));
      start = foldEnd;
    }
  }
  return lines.join('\n');
}

export function buildMultipartMessage(
  report: DailyReport,
  options: MessageOptions,
): { subject: string; message: string } {
  const boundary = `murphys-daily-${Date.now().toString(16)}`;
  const plain = renderPlainTextReport(report);
  const html = wrapHtmlForMimeTransport(renderHtmlReport(report));
  const subject = buildSubject(report);

  const message = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    plain,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ].join('\n');

  return { subject, message };
}

function repoRootFromEnv(envRoot?: string): string {
  if (envRoot && existsSync(envRoot)) {
    return envRoot;
  }
  const fromScript = path.resolve(scriptDirectory, '../..');
  if (existsSync(path.join(fromScript, 'backend'))) {
    return fromScript;
  }
  return process.env.REPO_ROOT ?? '/root/murphys-laws';
}

function scriptPath(repoRoot: string, fileName: string): string {
  const inRepo = path.join(repoRoot, 'backend/scripts', fileName);
  if (existsSync(inRepo)) {
    return inRepo;
  }
  const installed = path.join('/usr/local/bin', fileName);
  if (existsSync(installed)) {
    return installed;
  }
  return inRepo;
}

function runShellJson<T>(script: string, args: string[], env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync('bash', [script, ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(stdout) as T;
}

function runShellCapture(script: string, args: string[], env: NodeJS.ProcessEnv): string {
  return execFileSync('bash', [script, ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryCommand(command: string, args: string[]): string {
  return captureCommandStdout(command, args);
}

/** Returns stdout even when the process exits nonzero (e.g. systemctl is-active). */
export function captureCommandStdout(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdout = String((error as { stdout?: Buffer | string }).stdout ?? '').trim();
      if (stdout.length > 0) {
        return stdout;
      }
    }
    return '';
  }
}

interface Pm2Process {
  name?: string;
  pm2_env?: {
    status?: string;
    restart_time?: number;
  };
}

function resolvePm2Executable(): string | null {
  if (process.env.PM2_PATH && existsSync(process.env.PM2_PATH)) {
    return process.env.PM2_PATH;
  }
  const fromPath = captureCommandStdout('bash', ['-lc', 'command -v pm2']);
  if (fromPath) {
    return fromPath;
  }
  const defaultPath = '/root/.nvm/versions/node/v22.20.0/bin/pm2';
  return existsSync(defaultPath) ? defaultPath : null;
}

function collectMurphysApiPm2Status(): { section: ReportSection; summaryItem?: ReportItem } {
  const pm2Executable = resolvePm2Executable();
  if (!pm2Executable) {
    return {
      section: section('PM2 APPLICATIONS', [
        { value: 'PM2 not available', kind: 'callout-check-failed' },
      ]),
      summaryItem: { label: 'API', value: 'PM2 unavailable', tone: 'warning' },
    };
  }

  try {
    const stdout = execFileSync(pm2Executable, ['jlist'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const processes = JSON.parse(stdout) as Pm2Process[];
    const api = processes.find((process) => process.name === 'murphys-api');
    if (!api?.pm2_env?.status) {
      return {
        section: section('PM2 APPLICATIONS', [
          { value: 'murphys-api not found in PM2', kind: 'callout', tone: 'critical' },
        ]),
        summaryItem: { label: 'API', value: 'Not running', tone: 'critical' },
      };
    }

    const status = api.pm2_env.status;
    const restarts = String(api.pm2_env.restart_time ?? 0);
    const tone: ReportItem['tone'] = status === 'online' ? 'success' : 'critical';
    return {
      section: section('PM2 APPLICATIONS', [
        { label: 'Name', value: 'murphys-api' },
        { label: 'Status', value: status },
        { label: 'Restarts', value: restarts },
      ]),
      summaryItem: { label: 'API', value: `${status} (${restarts} restarts)`, tone },
    };
  } catch {
    return {
      section: section('PM2 APPLICATIONS', [
        { value: 'Unable to retrieve PM2 status', kind: 'callout-check-failed' },
      ]),
      summaryItem: { label: 'API', value: 'Unknown', tone: 'warning' },
    };
  }
}

function summarizePerformanceMetrics(metricsPath: string): ReportItem[] {
  const lines = readFileSync(metricsPath, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const header = lines[0].split(',');
  const indexOf = (name: string): number => header.indexOf(name);
  const fe = indexOf('frontend_response_ms');
  const ae = indexOf('api_response_ms');
  const de = indexOf('db_query_ms');
  const mp = indexOf('memory_pressure_percent') >= 0 ? indexOf('memory_pressure_percent') : indexOf('memory_percent');

  const average = (column: number): number | null => {
    if (column < 0) {
      return null;
    }
    const values = lines.slice(-24).flatMap((line) => {
      const cols = line.split(',');
      const raw = cols[column]?.trim();
      if (!raw) {
        return [];
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? [parsed] : [];
    });
    if (values.length === 0) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const avgFrontend = average(fe);
  const avgApi = average(ae);
  const avgDb = average(de);
  const avgMemory = average(mp);
  const items: ReportItem[] = [];
  if (avgFrontend !== null) {
    items.push({ value: `Frontend: avg ${avgFrontend.toFixed(0)}ms` });
  }
  if (avgApi !== null) {
    items.push({ value: `API: avg ${avgApi.toFixed(0)}ms` });
  }
  if (avgDb !== null) {
    items.push({ value: `Database: avg ${avgDb.toFixed(0)}ms` });
  }
  if (avgMemory !== null) {
    items.push({ value: `Avg Memory Usage: ${avgMemory.toFixed(1)}%` });
  }
  return items;
}

function section(title: string, items: ReportItem[]): ReportSection {
  return { title, items: items.filter((item) => item.value.trim() !== '') };
}

function subjectSuffixForDate(date: Date, forceAllOptional: boolean): string {
  const parts: string[] = [];
  const dayOfWeek = date.getUTCDay();
  const dayOfMonth = date.getUTCDate();

  if (forceAllOptional || dayOfWeek === 0) {
    parts.push('Vulnerability Scan');
  }
  if (forceAllOptional || dayOfMonth === 1) {
    parts.push('Cost Report');
    parts.push('Backup Test Reminder');
  }
  if (forceAllOptional || dayOfMonth === 15) {
    parts.push('Peak Resource Report');
  }
  if (parts.length === 0) {
    return '';
  }
  return ` (+ ${parts.join(' + ')})`;
}

interface LogAnalyzerJson {
  summary: {
    totalAttackAttempts: number;
    totalRequests: number;
    errors4xx: number;
    errors5xx: number;
    attackLines: string[];
  };
  statusCodes: Array<{ code: number; count: number }>;
  topUrls: Array<{ url: string; count: number }>;
  topIps: Array<{ ip: string; count: number }>;
  suspiciousUserAgents: Array<{ agent: string; count: number }>;
  securityFindings: Array<{ category: string; count: number; samples: string[] }>;
  applicationErrors: string[];
}

interface PeakJson {
  metrics: Array<{ label: string; value: string; timestamp: string }>;
  sampleCount: number;
}

interface VulnerabilityJson {
  summary: {
    totalIssues: number;
    securityUpdates: number;
    lines: string[];
  };
  findings: string[];
}

interface CostJson {
  generatedAt: string;
  inventoryNote: string;
  monthlyUsdEstimate: number | null;
  snapshot: {
    memory: string;
    swap: string;
    cpu: string;
  };
  traffic: {
    files: number;
    requests: number;
    bandwidthGb: string;
  };
  capacity: {
    decision: string;
    reasons: string[];
    details: string[];
  };
  recommendations: string[];
  actionItems: string[];
  nextReview: string;
}

function mapLogSections(log: LogAnalyzerJson): ReportSection[] {
  const sections: ReportSection[] = [];
  const summaryItems: ReportItem[] = [];
  for (const line of log.summary.attackLines) {
    summaryItems.push({ value: line });
  }
  summaryItems.push({ label: 'Total attack attempts', value: String(log.summary.totalAttackAttempts) });
  summaryItems.push({ label: 'Total requests today', value: String(log.summary.totalRequests) });
  summaryItems.push({ label: '4xx errors', value: String(log.summary.errors4xx) });
  summaryItems.push({ label: '5xx errors', value: String(log.summary.errors5xx) });
  sections.push(section('LOG ANALYSIS & ATTACK DETECTION', summaryItems));

  const nginxItems: ReportItem[] = [
    { label: 'Total requests today', value: String(log.summary.totalRequests) },
  ];
  for (const row of log.statusCodes) {
    nginxItems.push({ value: `${row.code}: ${row.count} requests` });
  }
  for (const row of log.topIps) {
    nginxItems.push({ value: `${row.ip}: ${row.count} requests` });
  }
  for (const row of log.topUrls.slice(0, 10)) {
    nginxItems.push({ value: `${row.url}: ${row.count} times` });
  }
  for (const row of log.suspiciousUserAgents) {
    nginxItems.push({ value: `${row.count} - ${row.agent}` });
  }
  sections.push(section('NGINX ACCESS LOG ANALYSIS', nginxItems));

  for (const finding of log.securityFindings) {
    const items: ReportItem[] = [
      { label: 'Detected', value: `${finding.count} potential ${finding.category} attempts` },
    ];
    for (const sample of finding.samples) {
      items.push({ value: sample });
    }
    sections.push(section(`${finding.category.toUpperCase()} ATTEMPTS`, items));
  }

  if (log.applicationErrors.length > 0) {
    sections.push(
      section(
        'APPLICATION ERRORS',
        log.applicationErrors.map((line) => ({ value: line })),
      ),
    );
  }

  return sections;
}

function mapPeakSection(peaks: PeakJson): ReportSection {
  const items: ReportItem[] = peaks.metrics.map((metric) => {
    const cpuMetric = metric.label.toLowerCase().includes('cpu normalized');
    const numeric = Number.parseFloat(metric.value.replace('%', '').trim());
    return {
      label: metric.label,
      value: metric.value,
      timestamp: metric.timestamp,
      tone: cpuMetric && Number.isFinite(numeric) && numeric > 50 ? 'warning' : undefined,
      kind: 'row',
    };
  });
  items.push({ label: 'Total records analyzed', value: String(peaks.sampleCount), kind: 'row' });
  return section('PEAK RESOURCE USAGE (Last 30 Days)', items);
}

export function mapVulnerabilitySection(vuln: VulnerabilityJson): ReportSection {
  const passing = vuln.summary.totalIssues === 0;
  const issueItem = (value: string): ReportItem =>
    passing
      ? { value, kind: 'bullet-pass' }
      : { value, kind: 'callout', tone: 'warning' };
  const items: ReportItem[] = vuln.summary.lines.map(issueItem);
  if (vuln.summary.totalIssues > 0) {
    items.push({
      label: 'Total issues',
      value: String(vuln.summary.totalIssues),
      tone: 'warning',
      kind: 'row',
    });
  }
  for (const finding of vuln.findings) {
    items.push(issueItem(finding));
  }
  return section('WEEKLY VULNERABILITY SCAN', items);
}

function mapCostSection(cost: CostJson): ReportSection {
  const items: ReportItem[] = [
    { label: 'Generated', value: cost.generatedAt, kind: 'row' },
    { label: 'Inventory', value: cost.inventoryNote, kind: 'row' },
  ];
  if (cost.monthlyUsdEstimate !== null) {
    items.push({
      label: 'Estimated monthly cost',
      value: `$${cost.monthlyUsdEstimate}`,
      boldValue: true,
      kind: 'row',
    });
  }
  items.push({ kind: 'subheading', value: 'Resources' });
  items.push({ label: 'Memory', value: cost.snapshot.memory, kind: 'row' });
  items.push({ label: 'Swap', value: cost.snapshot.swap, kind: 'row' });
  items.push({ label: 'CPU', value: cost.snapshot.cpu, kind: 'row' });
  items.push({
    label: 'Traffic',
    value: `${cost.traffic.requests} requests across ${cost.traffic.files} log file(s), ${cost.traffic.bandwidthGb}GB`,
    kind: 'row',
  });
  items.push({ kind: 'subheading', value: 'Decision' });
  items.push({
    label: 'Capacity decision',
    value: cost.capacity.decision,
    boldValue: true,
    kind: 'row',
  });
  for (const detail of cost.capacity.details) {
    items.push({ kind: 'callout', tone: 'warning', value: detail });
  }
  for (const reason of cost.capacity.reasons) {
    items.push({ value: reason, kind: 'bullet' });
  }
  for (const recommendation of cost.recommendations) {
    items.push({ value: recommendation, kind: 'bullet' });
  }
  for (const action of cost.actionItems) {
    items.push({ value: action, kind: 'bullet' });
  }
  items.push({ label: 'Next review', value: cost.nextReview, kind: 'closing' });
  return section('MONTHLY COST OPTIMIZATION REPORT', items);
}

function backupReminderSection(): ReportSection {
  return section('MONTHLY BACKUP TEST REMINDER', [
    {
      kind: 'callout',
      tone: 'warning',
      value: 'Monthly Action Required: Test Backup Restore Process',
      valueSecondary:
        "It's time to run the monthly non-disruptive backup test on the main application droplet.",
    },
    {
      label: 'MAIN DROPLET (murphys-laws.com)',
      value: 'ssh murphys-main',
      boldValue: true,
      kind: 'row',
    },
    { kind: 'command', value: 'sudo /usr/local/bin/test-backup-restore.sh' },
    { value: 'All tests should pass (20/20 for the main droplet)', kind: 'bullet' },
    { value: 'Backup age < 30 hours', kind: 'bullet' },
    { value: 'Database integrity checks pass', kind: 'bullet' },
  ]);
}

function buildTestEmailReport(now: Date): DailyReport {
  const date = now.toISOString().slice(0, 10);
  const pm2Status = collectMurphysApiPm2Status();
  const apiSummary: ReportItem =
    pm2Status.summaryItem ?? { label: 'API', value: 'Healthy', tone: 'success' };

  return {
    date,
    subjectSuffix: subjectSuffixForDate(now, true),
    testEmailSentAtUtc: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    preview: 'System Status | Database Metrics | Website Activity | Performance | Security | SSL Status | Backups',
    summary: [
      apiSummary,
      { label: 'Security', value: '2 path traversal attempts detected', tone: 'warning' },
    ],
    sections: [
      section('SYSTEM STATUS', [
        { label: 'Uptime', value: 'up 2 days' },
        { label: 'Memory', value: '512Mi of 961Mi used (53.2%)' },
      ]),
      pm2Status.section,
      section('TRAFFIC & BANDWIDTH', [
        { label: 'Total Requests', value: '120' },
        { value: '404: 2 requests' },
        { label: 'Top URL', value: '</script> & /laws' },
      ]),
      mapPeakSection({
        sampleCount: 720,
        metrics: [
          { label: 'Memory pressure %', value: '50 %', timestamp: '2026-10-10T12:00:00Z' },
          { label: 'CPU normalized %', value: '88 %', timestamp: '2026-10-09T08:00:00Z' },
        ],
      }),
      mapVulnerabilitySection({
        summary: { totalIssues: 0, securityUpdates: 0, lines: ['No critical npm vulnerabilities'] },
        findings: ['No critical vulnerabilities or security updates found'],
      }),
      mapCostSection({
        generatedAt: `${date} 05:00:00 UTC`,
        inventoryNote: 'Single application droplet (verified)',
        monthlyUsdEstimate: 7,
        snapshot: {
          memory: '433MB used, 528MB available (50.0% pressure)',
          swap: '52MB',
          cpu: '1 cores, load 0.16, normalized 10.0%',
        },
        traffic: { files: 15, requests: 415255, bandwidthGb: '2.97' },
        capacity: {
          decision: 'No change justified',
          reasons: ['Keep current application droplet size.'],
          details: ['Peak normalized CPU 88.0% exceeds 50%.'],
        },
        recommendations: [
          'Infrastructure: single application droplet (n8n automation retired).',
          'Backup storage: Local retention 30 days; off-site copy not configured.',
        ],
        actionItems: ['Run monthly test-backup-restore.sh (local integrity)'],
        nextReview: '2026-11-11',
      }),
      backupReminderSection(),
    ],
  };
}

function collectLiveReport(now: Date, repoRoot: string): DailyReport {
  const date = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getUTCDay();
  const dayOfMonth = now.getUTCDate();
  const env = { ...process.env, REPO_ROOT: repoRoot };

  const summary: ReportItem[] = [];
  const sections: ReportSection[] = [];

  const uptime = tryCommand('uptime', ['-p']);
  const load = tryCommand('bash', ['-lc', "uptime | awk -F'load average:' '{print $2}'"]);
  const memory = tryCommand('bash', ['-lc', "free -h | awk 'NR==2{printf \"%s of %s used (%.1f%%)\", $3, $2, $3*100/$2}'"]);
  const disk = tryCommand('bash', ['-lc', "df -h / | tail -1 | awk '{print $5 \" of \" $2 \" used (\" $4 \" free)\"}'"]);

  sections.push(
    section('SYSTEM STATUS', [
      { label: 'Uptime', value: uptime || 'Unknown' },
      { label: 'Load Average', value: load || 'Unknown' },
      { label: 'Memory', value: memory || 'Unknown' },
      { label: 'Disk', value: disk || 'Unknown' },
      { label: 'nginx', value: captureCommandStdout('systemctl', ['is-active', 'nginx']) || 'unknown' },
      {
        label: 'fail2ban',
        value: captureCommandStdout('systemctl', ['is-active', 'fail2ban']) || 'unknown',
      },
      { label: 'SSH', value: captureCommandStdout('systemctl', ['is-active', 'ssh']) || 'unknown' },
      {
        label: 'Postfix',
        value: captureCommandStdout('systemctl', ['is-active', 'postfix']) || 'unknown',
      },
    ]),
  );

  const pm2Status = collectMurphysApiPm2Status();
  sections.push(pm2Status.section);
  if (pm2Status.summaryItem) {
    summary.push(pm2Status.summaryItem);
  }

  const dbPath = path.join(repoRoot, 'backend/murphys.db');
  if (existsSync(dbPath)) {
    const dbSize = tryCommand('du', ['-h', dbPath]).split('\t')[0] ?? 'Unknown';
    const dbRows = tryCommand('sqlite3', [dbPath, 'SELECT COUNT(*) FROM laws;']);
    sections.push(
      section('DATABASE METRICS', [
        { label: 'Size', value: dbSize },
        { label: 'Total Laws', value: dbRows || 'N/A' },
      ]),
    );

    const lawsSubmitted = tryCommand('sqlite3', [
      dbPath,
      "SELECT COUNT(*) FROM laws WHERE datetime(created_at) >= datetime('now', '-1 day');",
    ]);
    const upvotes = tryCommand('sqlite3', [
      dbPath,
      "SELECT COUNT(*) FROM votes WHERE datetime(created_at) >= datetime('now', '-1 day') AND vote_type='up';",
    ]);
    const downvotes = tryCommand('sqlite3', [
      dbPath,
      "SELECT COUNT(*) FROM votes WHERE datetime(created_at) >= datetime('now', '-1 day') AND vote_type='down';",
    ]);
    const published = tryCommand('sqlite3', [dbPath, "SELECT COUNT(*) FROM laws WHERE status='published';"]);
    sections.push(
      section('WEBSITE ACTIVITY', [
        { label: 'Laws Submitted', value: lawsSubmitted || 'N/A' },
        { label: 'Upvotes', value: upvotes || 'N/A' },
        { label: 'Downvotes', value: downvotes || 'N/A' },
        { label: 'Total Published Laws', value: published || 'N/A' },
      ]),
    );

    const lawOfDay = tryCommand('sqlite3', [
      dbPath,
      `SELECT COALESCE(l.title || ': ', '') || l.text FROM law_of_the_day_history lod JOIN laws l ON lod.law_id = l.id WHERE lod.featured_date = '${date}' LIMIT 1;`,
    ]);
    sections.push(
      section('MURPHY\'S LAW OF THE DAY', [
        { value: lawOfDay || `No law of the day set for ${date}` },
      ]),
    );
  }

  const metricsMonth = date.slice(0, 7);
  let metricsFile = `/var/log/performance-metrics/metrics-main-app-${metricsMonth}.csv`;
  if (!existsSync(metricsFile)) {
    metricsFile = `/var/log/performance-metrics/metrics-${metricsMonth}.csv`;
  }
  if (existsSync(metricsFile)) {
    const perfItems = summarizePerformanceMetrics(metricsFile);
    if (perfItems.length > 0) {
      sections.push(section('PERFORMANCE METRICS', perfItems));
    }
  }

  if (dayOfMonth === 15) {
    try {
      const peaks = runShellJson<PeakJson>(
        scriptPath(repoRoot, 'analyze-resource-peaks.sh'),
        ['--format', 'json', '--role', 'main-app'],
        env,
      );
      sections.push(mapPeakSection(peaks));
    } catch {
      sections.push(section('PEAK RESOURCE USAGE (Last 30 Days)', [{ value: 'Peak resource analysis not available' }]));
    }
  }

  const trafficSummary = tryCommand('bash', [
    '-lc',
    `TODAY=$(date +%d/%b/%Y); if [ -f /var/log/nginx/access.log ]; then REQ=$(grep "$TODAY" /var/log/nginx/access.log | wc -l | tr -d ' '); MB=$(grep "$TODAY" /var/log/nginx/access.log | awk '{sum += $10} END {printf \"%.2f\", sum/1024/1024}'); echo "Total Requests: $REQ"; echo "Bandwidth: \${MB}MB"; fi`,
  ]);
  if (trafficSummary) {
    sections.push(
      section('TRAFFIC & BANDWIDTH', trafficSummary.split('\n').map((line) => ({ value: line }))),
    );
  }

  const failedSsh = tryCommand('bash', [
    '-lc',
    'grep "Failed password" /var/log/auth.log 2>/dev/null | grep "$(date +%b\\ %d)" | wc -l | tr -d " "',
  ]);
  const securityItems: ReportItem[] = [{ label: 'Failed SSH Attempts', value: failedSsh || '0' }];
  const banned = tryCommand('bash', [
    '-lc',
    'fail2ban-client status sshd 2>/dev/null | awk -F: \'/Currently banned/{print $2}\' | xargs',
  ]);
  const totalBans = tryCommand('bash', [
    '-lc',
    'fail2ban-client status sshd 2>/dev/null | awk -F: \'/Total banned/{print $2}\' | xargs',
  ]);
  if (banned) {
    securityItems.push({ label: 'Fail2ban Currently Banned', value: banned });
  }
  if (totalBans) {
    securityItems.push({ label: 'Fail2ban Total Bans', value: totalBans });
  }
  sections.push(section('SECURITY SUMMARY', securityItems));

  const certPath = '/etc/letsencrypt/live/murphys-laws.com/cert.pem';
  if (existsSync(certPath)) {
    const expiry = tryCommand('openssl', ['x509', '-enddate', '-noout', '-in', certPath]);
    const days = tryCommand('bash', [
      '-lc',
      `end=$(openssl x509 -enddate -noout -in ${certPath} | cut -d= -f2); echo $(( ($(date -d "$end" +%s 2>/dev/null || date -j -f '%b %d %T %Y %Z' "$end" +%s) - $(date +%s)) / 86400 ))`,
    ]);
    sections.push(
      section('SSL CERTIFICATE STATUS', [
        { label: 'Certificate Expiration', value: expiry.replace('notAfter=', '') },
        { label: 'Days Until Expiry', value: days || 'Unknown' },
        {
          label: 'Auto-renewal',
          value: tryCommand('bash', ['-lc', 'systemctl is-enabled certbot.timer 2>/dev/null || echo NOT ENABLED']),
        },
      ]),
    );
  }

  if (existsSync('/root/backups')) {
    const latestBackup = tryCommand('bash', [
      '-lc',
      'ls -t /root/backups/murphys_db_*.db 2>/dev/null | head -1',
    ]);
    const backupItems: ReportItem[] = [];
    if (latestBackup) {
      backupItems.push({ label: 'Latest backup file', value: path.basename(latestBackup) });
      backupItems.push({
        label: 'Backup size',
        value: tryCommand('du', ['-h', latestBackup]).split('\t')[0] ?? 'Unknown',
      });
      try {
        const backupStat = statSync(latestBackup);
        const hoursOld = Math.floor((Date.now() - backupStat.mtimeMs) / (1000 * 60 * 60));
        backupItems.push({
          label: 'Backup date',
          value: backupStat.mtime.toISOString().replace('T', ' ').slice(0, 19),
        });
        if (hoursOld > 48) {
          backupItems.push({
            value: `WARNING: Backup is ${hoursOld} hours old`,
            tone: 'warning',
          });
          summary.push({ label: 'Backups', value: `${hoursOld} hours old`, tone: 'warning' });
        }
      } catch {
        backupItems.push({ label: 'Backup date', value: 'Unknown' });
      }
    } else {
      backupItems.push({ value: 'No database backups found' });
    }
    backupItems.push({
      label: 'Total backup size',
      value: tryCommand('du', ['-sh', '/root/backups']).split('\t')[0] ?? 'Unknown',
    });
    backupItems.push({ value: 'Off-site copy: not configured (local integrity only)' });
    sections.push(section('BACKUP STATUS', backupItems));
  }

  sections.push(
    section('SYSTEM UPDATES', [
      { label: 'Kernel', value: tryCommand('uname', ['-r']) || 'Unknown' },
      {
        label: 'Reboot Required',
        value: existsSync('/var/run/reboot-required') ? 'YES' : 'No',
      },
      {
        label: 'Pending Updates',
        value:
          tryCommand('bash', ['-lc', "apt list --upgradable 2>/dev/null | grep -c upgradable || echo 0"]) ||
          '0',
      },
    ]),
  );

  try {
    const log = runShellJson<LogAnalyzerJson>(
      scriptPath(repoRoot, 'log-analyzer.sh'),
      ['--format', 'json'],
      env,
    );
    sections.push(...mapLogSections(log));
    if (log.summary.totalAttackAttempts > 0) {
      summary.push({
        label: 'Security',
        value: `${log.summary.totalAttackAttempts} attack attempts today`,
        tone: 'warning',
      });
    }
  } catch {
    sections.push(section('LOG ANALYSIS & ATTACK DETECTION', [{ value: 'Log analysis not available' }]));
  }

  if (dayOfWeek === 0) {
    try {
      const vuln = runShellJson<VulnerabilityJson>(
        scriptPath(repoRoot, 'vulnerability-scanner.sh'),
        ['--format', 'json'],
        env,
      );
      sections.push(mapVulnerabilitySection(vuln));
    } catch {
      sections.push(section('WEEKLY VULNERABILITY SCAN', [{ value: 'Vulnerability scan failed' }]));
    }
  }

  if (dayOfMonth === 1) {
    try {
      const cost = runShellJson<CostJson>(
        scriptPath(repoRoot, 'cost-optimization-report.sh'),
        ['--format', 'json', '--no-email'],
        env,
      );
      sections.push(mapCostSection(cost));
      sections.push(backupReminderSection());
    } catch {
      sections.push(section('MONTHLY COST OPTIMIZATION REPORT', [{ value: 'Cost optimization report not available' }]));
    }
  }

  if (summary.length === 0) {
    summary.push({ label: 'System', value: 'Daily report generated', tone: 'success' });
  }

  return {
    date,
    subjectSuffix: subjectSuffixForDate(now, false),
    preview:
      'System Status | Database Metrics | Website Activity | Performance | Security | SSL Status | Backups',
    summary,
    sections,
  };
}

export function collectDailyReport(options: CollectOptions = {}): DailyReport {
  const now = options.now ?? new Date();
  if (options.mode === 'test-email') {
    return buildTestEmailReport(now);
  }
  const repoRoot = repoRootFromEnv(options.repoRoot);
  return collectLiveReport(now, repoRoot);
}

export interface RunCliOptions {
  env?: NodeJS.ProcessEnv;
  sendmailPath?: string;
}

export function runCli(args: string[], options: RunCliOptions = {}): void {
  const env = options.env ?? process.env;
  const testEmail = args.includes('--test-email');
  const report = collectDailyReport({
    mode: testEmail ? 'test-email' : 'live',
    now: new Date(),
  });

  const recipient = testEmail
    ? env.DAILY_REPORT_TEST_RECIPIENT
    : (env.ALERT_EMAIL ?? DEFAULT_ALERT_EMAIL);

  if (!recipient) {
    throw new Error('DAILY_REPORT_TEST_RECIPIENT must be set for --test-email');
  }

  const from = env.FROM_EMAIL ?? DEFAULT_FROM;
  const { message } = buildMultipartMessage(report, { from, to: recipient });
  const sendmailPath = options.sendmailPath ?? 'sendmail';

  const result = spawnSync(sendmailPath, ['-t', recipient], {
    input: message,
    encoding: 'utf8',
    env,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `sendmail exited with code ${result.status ?? 'unknown'}`);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  runCli(process.argv.slice(2));
}
