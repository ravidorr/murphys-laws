import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildMultipartMessage,
  buildSubject,
  captureCommandStdout,
  collectDailyReport,
  escapeHtml,
  renderHtmlReport,
  mapVulnerabilitySection,
  renderPlainTextReport,
  runCli,
  wrapHtmlForMimeTransport,
  type DailyReport,
} from '../backend/scripts/render-daily-report.ts';

const SMTP_MAX_LINE_BYTES = 998;

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function htmlPartFromMultipart(message: string): string {
  const marker = 'Content-Type: text/html; charset=utf-8';
  const start = message.indexOf(marker);
  assert.ok(start >= 0);
  const bodyStart = message.indexOf('\n\n', start) + 2;
  const boundaryEnd = message.indexOf('\n--murphys-daily-', bodyStart);
  return message.slice(bodyStart, boundaryEnd === -1 ? undefined : boundaryEnd).trimEnd();
}

function simulateSmtpLineFolding(body: string): string {
  const out: string[] = [];
  for (const line of body.split('\n')) {
    if (utf8ByteLength(line) <= SMTP_MAX_LINE_BYTES) {
      out.push(line);
      continue;
    }
    let rest = line;
    while (utf8ByteLength(rest) > SMTP_MAX_LINE_BYTES) {
      let cut = 0;
      let bytes = 0;
      while (cut < rest.length) {
        const codePoint = rest.codePointAt(cut)!;
        const unitLength = codePoint > 0xffff ? 2 : 1;
        const unitBytes = utf8ByteLength(rest.slice(cut, cut + unitLength));
        if (bytes + unitBytes > SMTP_MAX_LINE_BYTES) {
          break;
        }
        bytes += unitBytes;
        cut += unitLength;
      }
      if (cut === 0) {
        cut = 1;
      }
      out.push(rest.slice(0, cut));
      rest = ` ${rest.slice(cut)}`;
    }
    if (rest.length > 0) {
      out.push(rest);
    }
  }
  return out.join('\n');
}

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

test('escapeHtml escapes metacharacters', () => {
  assert.equal(escapeHtml(`<script>"'&</script>`), '&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;');
});

test('captureCommandStdout preserves stdout on nonzero exit', () => {
  const output = captureCommandStdout('bash', ['-lc', 'echo inactive; exit 3']);
  assert.equal(output, 'inactive');
});

test('renderHtmlReport escapes dynamic values and avoids terminal separators', () => {
  const model: DailyReport = {
    date: '2026-10-11',
    subjectSuffix: '',
    preview: 'System status and security findings',
    summary: [{ label: 'API', value: 'Healthy', tone: 'success' }],
    sections: [
      {
        title: 'TRAFFIC & BANDWIDTH',
        items: [{ label: 'Top URL', value: '</script> & /laws' }],
      },
    ],
  };

  const html = renderHtmlReport(model);
  assert.match(html, /&lt;\/script&gt; &amp; \/laws/);
  assert.match(html, /max-width:640px/);
  assert.match(html, /Daily Status Report/);
  assert.match(html, /width:1%;white-space:nowrap/);
  assert.doesNotMatch(html, /width:38%/);
  assert.doesNotMatch(html, /━━━━━━━━|====|<pre>/);
});

test('renderHtmlReport applies tone colors in section rows', () => {
  const model: DailyReport = {
    date: '2026-10-11',
    subjectSuffix: '',
    preview: 'Preview',
    summary: [],
    sections: [
      {
        title: 'BACKUP STATUS',
        items: [{ value: 'WARNING: Backup is 72 hours old', tone: 'warning' }],
      },
    ],
  };

  const html = renderHtmlReport(model);
  assert.match(html, /color:#a16207/);
  assert.match(html, /WARNING: Backup is 72 hours old/);
});

test('mapVulnerabilitySection uses passing markers only when scan is clean', () => {
  const clean = mapVulnerabilitySection({
    summary: { totalIssues: 0, securityUpdates: 0, lines: ['No npm issues'] },
    findings: ['All clear'],
  });
  const plainClean = renderPlainTextReport({
    date: '2026-10-11',
    subjectSuffix: '',
    preview: '',
    summary: [],
    sections: [clean],
  });
  assert.match(plainClean, /\[OK\] No npm issues/);
  assert.match(plainClean, /\[OK\] All clear/);

  const failing = mapVulnerabilitySection({
    summary: {
      totalIssues: 3,
      securityUpdates: 2,
      lines: ['2 security updates available'],
    },
    findings: ['High: lodash dependency'],
  });
  const plainFail = renderPlainTextReport({
    date: '2026-10-11',
    subjectSuffix: '',
    preview: '',
    summary: [],
    sections: [failing],
  });
  assert.match(plainFail, /\[!\] 2 security updates available/);
  assert.match(plainFail, /\[!\] High: lodash dependency/);
  assert.doesNotMatch(plainFail, /\[OK\]/);
  assert.match(plainFail, /Total issues: \[!\] 3/);
});

test('buildTestEmailReport vulnerability fixture has consistent issue count', () => {
  const report = collectDailyReport({ mode: 'test-email', now: new Date('2026-10-11T12:00:00Z') });
  const vuln = report.sections.find((entry) => entry.title === 'WEEKLY VULNERABILITY SCAN');
  assert.ok(vuln);
  const plain = renderPlainTextReport(report);
  assert.doesNotMatch(plain, /Total issues: [1-9]/);
  assert.match(plain, /No critical vulnerabilities or security updates found/);
});

test('renderPlainTextReport mirrors section content', () => {
  const model: DailyReport = {
    date: '2026-10-11',
    subjectSuffix: '',
    preview: 'Preview',
    summary: [],
    sections: [
      {
        title: 'TRAFFIC & BANDWIDTH',
        items: [{ label: 'Top URL', value: '</script> & /laws' }],
      },
    ],
  };

  const plain = renderPlainTextReport(model);
  assert.match(plain, /Daily Status Report/);
  assert.match(plain, /Top URL: <\/script> & \/laws/);
});

test('renderPlainTextReport tags glance rows from tone', () => {
  const model: DailyReport = {
    date: '2026-10-11',
    subjectSuffix: '',
    preview: 'Preview',
    summary: [
      { label: 'API', value: 'Healthy', tone: 'success' },
      { label: 'Security', value: '2 attempts', tone: 'warning' },
    ],
    sections: [],
  };
  const plain = renderPlainTextReport(model);
  assert.match(plain, /API: \[OK\] Healthy/);
  assert.match(plain, /Security: \[!\] 2 attempts/);
});

test('renderHtmlReport uses exclamation for attention glyphs', () => {
  const model: DailyReport = {
    date: '2026-10-11',
    subjectSuffix: '',
    preview: 'Preview',
    summary: [{ label: 'Security', value: '2 attempts', tone: 'warning' }],
    sections: [
      {
        title: 'PEAK',
        items: [
          {
            label: 'CPU',
            value: '88 %',
            tone: 'warning',
            timestamp: '2026-10-09T08:00:00Z',
          },
        ],
      },
      {
        title: 'CALLOUT',
        items: [{ value: 'Stale backup', tone: 'warning' }],
      },
    ],
  };
  const html = renderHtmlReport(model);
  assert.match(html, />!<\/span>/);
  assert.match(html, /font-weight:bold;">! /);
  assert.doesNotMatch(html, /&#9650;/);
});

test('wrapHtmlForMimeTransport keeps HTML lines SMTP-safe', () => {
  const report = collectDailyReport({ mode: 'test-email', now: new Date('2026-10-11T12:00:00Z') });
  const wrapped = wrapHtmlForMimeTransport(renderHtmlReport(report));
  for (const line of wrapped.split('\n')) {
    const bytes = utf8ByteLength(line);
    assert.ok(
      bytes <= SMTP_MAX_LINE_BYTES,
      `line utf8 length ${bytes} exceeds ${SMTP_MAX_LINE_BYTES}`,
    );
  }
  const folded = simulateSmtpLineFolding(wrapped);
  assert.doesNotMatch(folded, /< td\b/);
  assert.doesNotMatch(folded, /< tr\b/);
  assert.match(folded, /MAIN DROPLET \(murphys-laws\.com\)/);
  assert.match(folded, /ssh murphys-main/);
});

test('renderHtmlReport allows long label cells to wrap on narrow screens', () => {
  const report = collectDailyReport({ mode: 'test-email', now: new Date('2026-10-11T12:00:00Z') });
  const html = renderHtmlReport(report);
  assert.match(html, /MAIN DROPLET \(murphys-laws\.com\)/);
  assert.match(html, /max-width:42%;white-space:normal;word-break:break-word;/);
});

test('wrapHtmlForMimeTransport folds multibyte text on safe boundaries', () => {
  const emoji = '😀'.repeat(400);
  const wrapped = wrapHtmlForMimeTransport(
    `<table><tr><td>${escapeHtml(emoji)}</td></tr></table>`,
  );
  for (const line of wrapped.split('\n')) {
    assert.ok(utf8ByteLength(line) <= SMTP_MAX_LINE_BYTES);
  }
  assert.match(wrapped, /😀/);
  assert.doesNotMatch(wrapped, /&#[0-9]+;\n/);
});

test('buildMultipartMessage uses multipart alternative', () => {
  const model: DailyReport = {
    date: '2026-10-11',
    subjectSuffix: '',
    preview: 'Preview',
    summary: [],
    sections: [],
  };

  const { message, subject } = buildMultipartMessage(model, {
    from: 'Test <test@example.com>',
    to: 'user@example.com',
  });

  assert.match(subject, /Daily Status Report - 2026-10-11/);
  assert.match(message, /multipart\/alternative/);
  assert.match(message, /Content-Type: text\/plain/);
  assert.match(message, /Content-Type: text\/html/);
});

test('runCli --test-email requires DAILY_REPORT_TEST_RECIPIENT', () => {
  const env = { ...process.env };
  delete env.DAILY_REPORT_TEST_RECIPIENT;
  assert.throws(
    () => runCli(['--test-email'], { env, sendmailPath: '/bin/false' }),
    /DAILY_REPORT_TEST_RECIPIENT/,
  );
});

test('test-email subject includes UTC timestamp tag', () => {
  const report = collectDailyReport({ mode: 'test-email', now: new Date('2026-10-11T12:08:10.123Z') });
  assert.match(buildSubject(report), /\[test 2026-10-11T12:08:10Z\]/);
});

test('collectDailyReport test fixture includes all optional sections', () => {
  const report = collectDailyReport({ mode: 'test-email', now: new Date('2026-10-11T05:00:00Z') });
  const titles = report.sections.map((section) => section.title).join('\n');

  assert.match(titles, /WEEKLY VULNERABILITY SCAN/);
  assert.match(titles, /MONTHLY COST OPTIMIZATION REPORT/);
  assert.match(titles, /PEAK RESOURCE USAGE/);
  assert.match(titles, /MONTHLY BACKUP TEST REMINDER/);
  assert.doesNotMatch(renderPlainTextReport(report), /COST OPTIMIZATION REPORT\n.*====/s);
});

function nginxLogDate(date = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${months[date.getMonth()]}/${date.getFullYear()}`;
}

test('log-analyzer --format json includes detail arrays', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'log-analyzer-'));
  const logPath = path.join(tempDir, 'access.log');
  const today = nginxLogDate();
  writeFileSync(
    logPath,
    `1.2.3.4 - - [${today}:12:00:00 +0000] "GET /missing HTTP/1.1" 404 123 "-" "sqlmap"\n` +
      `1.2.3.4 - - [${today}:12:01:00 +0000] "GET /api HTTP/1.1" 200 123 "-" "Mozilla"\n`,
  );

  const script = path.join(rootDirectory, 'backend/scripts/log-analyzer.sh');
  const stdout = execFileSync('bash', [script, '--format', 'json'], {
    env: { ...process.env, NGINX_ACCESS_LOG: logPath, LOG_ANALYZER_LOG: path.join(tempDir, 'log.log') },
    encoding: 'utf8',
  });

  const parsed = JSON.parse(stdout) as {
    statusCodes: Array<{ code: number; count: number }>;
    topUrls: Array<{ url: string; count: number }>;
  };

  assert.deepEqual(parsed.statusCodes.find((row) => row.code === 404), { code: 404, count: 1 });
  assert.deepEqual(parsed.topUrls.find((row) => row.url === '/missing'), { url: '/missing', count: 1 });
});

test('analyze-resource-peaks --format json returns metrics array', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'peaks-'));
  const metricsDir = path.join(tempDir, 'metrics');
  mkdirSync(metricsDir, { recursive: true });
  const month = '2026-10';
  const header =
    'timestamp,role,frontend_response_ms,api_response_ms,db_query_ms,memory_used_mb,memory_available_mb,memory_pressure_percent,swap_used_mb,swap_in,swap_out,cpu_cores,cpu_load_1m,cpu_load_5m,cpu_load_15m,cpu_normalized_percent,disk_used_gb,disk_available_gb,disk_percent,db_size_mb,pm2_api_restarts,pm2_api_uptime_hours,pm2_api_rss_mb,pm2_api_memory_limit_mb,collector_errors';
  const row =
    '2026-10-10T12:00:00Z,main-app,,,,400,500,50,0,0,0,1,0.5,0.4,0.3,50,10,14,49,1.6,0,1,120,512,';
  writeFileSync(path.join(metricsDir, `metrics-main-app-${month}.csv`), `${header}\n${row}\n`);

  const script = path.join(rootDirectory, 'backend/scripts/analyze-resource-peaks.sh');
  const stdout = execFileSync('bash', [script, '--format', 'json', '--role', 'main-app'], {
    env: { ...process.env, METRICS_DIR: metricsDir },
    encoding: 'utf8',
  });

  const parsed = JSON.parse(stdout) as { metrics: Array<{ label: string }>; sampleCount: number };
  assert.ok(parsed.metrics.length > 0);
  assert.ok(parsed.sampleCount > 0);
});

test('cost-optimization-report --format json includes capacity decision', () => {
  const metricsDir = mkdtempSync(path.join(tmpdir(), 'cost-metrics-'));
  const header =
    'timestamp,role,frontend_response_ms,api_response_ms,db_query_ms,memory_used_mb,memory_available_mb,memory_pressure_percent,swap_used_mb,swap_in,swap_out,cpu_cores,cpu_load_1m,cpu_load_5m,cpu_load_15m,cpu_normalized_percent,disk_used_gb,disk_available_gb,disk_percent,db_size_mb,pm2_api_restarts,pm2_api_uptime_hours,pm2_api_rss_mb,pm2_api_memory_limit_mb,collector_errors';
  const row =
    '2026-10-10T12:00:00Z,main-app,100,100,1,400,500,50,0,0,0,1,0.5,0.4,0.3,50,10,14,49,1.6,0,1,120,512,';
  writeFileSync(path.join(metricsDir, 'metrics-main-app-2026-10.csv'), `${header}\n${row}\n`);

  const inventoryFile = path.join(rootDirectory, 'backend/config/infrastructure-inventory.json.example');
  const script = path.join(rootDirectory, 'backend/scripts/cost-optimization-report.sh');
  const stdout = execFileSync('bash', [script, '--format', 'json', '--no-email'], {
    env: {
      ...process.env,
      REPO_ROOT: rootDirectory,
      METRICS_DIR: metricsDir,
      INVENTORY_FILE: inventoryFile,
      PATH: `${path.join(rootDirectory, 'node_modules/.bin')}:${process.env.PATH ?? ''}`,
    },
    encoding: 'utf8',
  });

  const parsed = JSON.parse(stdout) as { capacity: { decision: string } };
  assert.ok(['Collecting baseline', 'No change justified', 'Manual review candidate'].includes(parsed.capacity.decision));
});

test('vulnerability-scanner --format json returns summary object', () => {
  const script = path.join(rootDirectory, 'backend/scripts/vulnerability-scanner.sh');
  const stdout = execFileSync('bash', [script, '--format', 'json'], {
    env: { ...process.env, VULNERABILITY_SCANNER_SKIP_APT: '1' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const parsed = JSON.parse(stdout) as { summary: { totalIssues: number } };
  assert.ok(typeof parsed.summary.totalIssues === 'number');
});

test('runCli test-email sends multipart message when recipient set', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'sendmail-'));
  const sendmailPath = path.join(tempDir, 'sendmail.sh');
  writeFileSync(
    sendmailPath,
    `#!/usr/bin/env bash
cat > "${path.join(tempDir, 'message.eml')}"
`,
    { mode: 0o755 },
  );

  runCli(['--test-email'], {
    env: {
      ...process.env,
      DAILY_REPORT_TEST_RECIPIENT: 'test@example.com',
    },
    sendmailPath,
  });

  const message = readFileSync(path.join(tempDir, 'message.eml'), 'utf8');
  assert.match(message, /MONTHLY COST OPTIMIZATION REPORT/);
  assert.match(message, /PEAK RESOURCE USAGE/);
  assert.match(message, /WEEKLY VULNERABILITY SCAN/);
  assert.doesNotMatch(message, /====/);
});

test('deploy workflow sends template smoke email when renderer changes', () => {
  const deployWorkflow = readFileSync(
    path.join(rootDirectory, '.github/workflows/deploy.yml'),
    'utf8',
  );
  assert.match(deployWorkflow, /render-daily-report\.ts/);
  assert.match(deployWorkflow, /DAILY_REPORT_TEST_RECIPIENT/);
  assert.match(deployWorkflow, /daily-report\.sh --test-email/);
});
