/**
 * Daily operational report renderer and delivery.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ReportItem {
  label?: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'critical';
}

export interface ReportSection {
  title: string;
  items: ReportItem[];
}

export interface DailyReport {
  date: string;
  subjectSuffix: string;
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

function formatHtmlItemValue(item: ReportItem): string {
  const escaped = escapeHtml(item.value);
  if (item.tone && item.tone !== 'neutral') {
    return `<span style="color:${itemToneColor(item.tone)};">${escaped}</span>`;
  }
  return escaped;
}

function appendPlainSection(lines: string[], section: ReportSection): void {
  lines.push(SECTION_RULE);
  lines.push(section.title);
  lines.push(SECTION_RULE);
  lines.push('');
  for (const item of section.items) {
    if (item.label) {
      lines.push(`${item.label}: ${item.value}`);
    } else {
      lines.push(`  • ${item.value}`);
    }
  }
  lines.push('');
}

export function renderPlainTextReport(report: DailyReport): string {
  const lines: string[] = [];
  if (report.summary.length > 0) {
    lines.push('At a glance');
    lines.push('');
    for (const item of report.summary) {
      lines.push(`${item.label ?? 'Status'}: ${item.value}`);
    }
    lines.push('');
  }
  for (const section of report.sections) {
    appendPlainSection(lines, section);
  }
  return lines.join('\n').trimEnd();
}

export function renderHtmlReport(report: DailyReport): string {
  const rows: string[] = [];
  rows.push('<!DOCTYPE html>');
  rows.push('<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#111827;">');
  rows.push(
    `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(report.preview)}</div>`,
  );

  if (report.summary.length > 0) {
    rows.push('<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0;">');
    rows.push('<tr><td style="font-size:16px;font-weight:bold;padding:8px 0;">At a glance</td></tr>');
    for (const item of report.summary) {
      rows.push('<tr><td style="padding:4px 0;font-size:14px;">');
      rows.push(
        `<strong>${escapeHtml(item.label ?? 'Status')}:</strong> ${formatHtmlItemValue(item)}`,
      );
      rows.push('</td></tr>');
    }
    rows.push('</table>');
  }

  for (const section of report.sections) {
    rows.push('<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border-top:1px solid #e5e7eb;">');
    rows.push(
      `<tr><td style="padding:12px 0 8px 0;font-size:15px;font-weight:bold;letter-spacing:0.02em;">${escapeHtml(section.title)}</td></tr>`,
    );
    for (const item of section.items) {
      rows.push('<tr><td style="padding:2px 0;font-size:14px;line-height:1.45;">');
      if (item.label) {
        rows.push(`<strong>${escapeHtml(item.label)}:</strong> ${formatHtmlItemValue(item)}`);
      } else {
        rows.push(`• ${formatHtmlItemValue(item)}`);
      }
      rows.push('</td></tr>');
    }
    rows.push('</table>');
  }

  rows.push('</body></html>');
  return rows.join('');
}

export function buildSubject(report: DailyReport): string {
  return `Daily Status Report - ${report.date}${report.subjectSuffix}`;
}

export function buildMultipartMessage(
  report: DailyReport,
  options: MessageOptions,
): { subject: string; message: string } {
  const boundary = `murphys-daily-${Date.now().toString(16)}`;
  const plain = renderPlainTextReport(report);
  const html = renderHtmlReport(report);
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
      section: section('PM2 APPLICATIONS', [{ value: 'PM2 not available' }]),
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
        section: section('PM2 APPLICATIONS', [{ value: 'murphys-api not found in PM2' }]),
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
      section: section('PM2 APPLICATIONS', [{ value: 'Unable to retrieve PM2 status' }]),
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
  const items = peaks.metrics.map((metric) => ({
    label: metric.label,
    value: `${metric.value} (${metric.timestamp})`,
  }));
  items.push({ label: 'Total records analyzed', value: String(peaks.sampleCount) });
  return section('PEAK RESOURCE USAGE (Last 30 Days)', items);
}

function mapVulnerabilitySection(vuln: VulnerabilityJson): ReportSection {
  const items: ReportItem[] = vuln.summary.lines.map((line) => ({ value: line }));
  if (vuln.summary.totalIssues > 0) {
    items.push({
      label: 'Total issues',
      value: String(vuln.summary.totalIssues),
      tone: 'warning',
    });
  }
  for (const finding of vuln.findings) {
    items.push({ value: finding });
  }
  return section('WEEKLY VULNERABILITY SCAN', items);
}

function mapCostSection(cost: CostJson): ReportSection {
  const items: ReportItem[] = [
    { label: 'Generated', value: cost.generatedAt },
    { label: 'Inventory', value: cost.inventoryNote },
  ];
  if (cost.monthlyUsdEstimate !== null) {
    items.push({ label: 'Estimated monthly cost', value: `$${cost.monthlyUsdEstimate}` });
  }
  items.push({ label: 'Memory', value: cost.snapshot.memory });
  items.push({ label: 'Swap', value: cost.snapshot.swap });
  items.push({ label: 'CPU', value: cost.snapshot.cpu });
  items.push({
    label: 'Traffic',
    value: `${cost.traffic.requests} requests across ${cost.traffic.files} log file(s), ${cost.traffic.bandwidthGb}GB`,
  });
  items.push({ label: 'Capacity decision', value: cost.capacity.decision, tone: 'neutral' });
  for (const detail of cost.capacity.details) {
    items.push({ value: detail });
  }
  for (const reason of cost.capacity.reasons) {
    items.push({ value: reason });
  }
  for (const recommendation of cost.recommendations) {
    items.push({ value: recommendation });
  }
  for (const action of cost.actionItems) {
    items.push({ value: action });
  }
  items.push({ label: 'Next review', value: cost.nextReview });
  return section('MONTHLY COST OPTIMIZATION REPORT', items);
}

function backupReminderSection(): ReportSection {
  return section('MONTHLY BACKUP TEST REMINDER', [
    { value: 'Monthly Action Required: Test Backup Restore Process' },
    {
      value:
        "It's time to run the monthly non-disruptive backup test on the main application droplet.",
    },
    { label: 'MAIN DROPLET (murphys-laws.com)', value: 'ssh murphys-main' },
    { value: 'sudo /usr/local/bin/test-backup-restore.sh' },
    { value: 'All tests should pass (20/20 for the main droplet)' },
    { value: 'Backup age < 30 hours' },
    { value: 'Database integrity checks pass' },
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
