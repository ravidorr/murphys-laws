import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');

function mapPatterns(mapHeader: string): RegExp[] {
  const start = conf.indexOf(mapHeader);
  expect(start).toBeGreaterThan(-1);
  const body = conf.slice(start, conf.indexOf('\n}', start));
  const patterns = [...body.matchAll(/^\s*"~\*(.+)" 1;$|^\s*~\*(.+) 1;$/gm)].map(
    (match) => new RegExp(match[1] ?? match[2] ?? '', 'i'),
  );
  // Every regex key in the map must have been parsed, so none is silently left untested.
  const regexKeys = body.split('\n').filter((line) => /^\s*"?~\*/.test(line));
  expect(patterns).toHaveLength(regexKeys.length);
  return patterns;
}

const pathPatterns = mapPatterns('map $request_uri $scanner_path {');
const agentPatterns = mapPatterns('map $http_user_agent $scanner_agent {');

const isScannerPath = (uri: string): boolean => pathPatterns.some((pattern) => pattern.test(uri));
const isScannerAgent = (agent: string): boolean => agentPatterns.some((pattern) => pattern.test(agent));

describe('nginx scanner defense', () => {
  it('parses every scanner pattern from nginx.conf', () => {
    expect(pathPatterns.length).toBeGreaterThan(10);
    expect(agentPatterns).toHaveLength(1);
  });

  it.each([
    '/.env',
    '/.env.production',
    '/.env-example',
    '/old/.env',
    '/.git/config',
    '/.aws/credentials',
    '/.config/gcloud/credentials.db',
    '/.htaccess',
    '/%2ehtaccess?v=ToOdG',
    '/%252eenv%252eold',
    '/%63%6f%6e%66%69%67.%70%68%70?v=NuoMS',
    '/wp-login.php',
    '/wp-admin/admin-ajax.php',
    '/wordpress/wp-config.php.txt',
    '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
    '/index.php?-d+allow_url_include%3don+-d+auto_prepend_file%3dphp%3a//input',
    '/OA_HTML/AppsTCFServer',
    '/actuator/health',
    '/_profiler/phpinfo',
    '/config/aws.json',
    '/config.json',
    '/appsettings.json',
    '/application-prod.yml',
    '/serviceAccount.json',
    '/aws/credentials.env',
    '/aws-exports.json.env',
    '/assets/env.js',
    '/composer.lock',
    '/latest/meta-data/iam/security-credentials',
    '/api/v1/%2eenv?v=MEnS9',
    '/storage/logs/laravel.log',
  ])('flags %s as a scanner path', (uri) => {
    expect(isScannerPath(uri)).toBe(true);
  });

  it.each([
    '/',
    '/law/123',
    '/category/murphys-computer-laws',
    '/examples',
    '/contact',
    '/admin',
    '/api/v1/laws?limit=5&q=%E2%9C%93',
    '/browse?q=env',
    '/browse?q=a%20b%20c',
    '/browse?q=error.log',
    '/browse?q=backup.zip',
    '/search?q=.env',
    '/browse?q=a/.hidden',
    '/browse?page=2&sort=config.json',
    '/search?q=wp-login',
    '/calculator/sods-law',
    '/origin-story',
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
    '/openapi.json',
    '/manifest.webmanifest',
    '/apple-touch-icon.png',
    '/assets/index-1a2b3c.js',
    '/.well-known/acme-challenge/abc123',
    '/.well-known/traffic-advice',
  ])('lets %s through', (uri) => {
    expect(isScannerPath(uri)).toBe(false);
  });

  it('flags exploit-kit user agents only', () => {
    expect(isScannerAgent('libredtail-http')).toBe(true);
    expect(isScannerAgent('sqlmap/1.7')).toBe(true);
    expect(isScannerAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBe(false);
    expect(isScannerAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(false);
  });

  it('applies the same drop and log split in all three server blocks', () => {
    expect(conf.match(/if \(\$block_request\) \{\s+return 444;\s+\}/g)).toHaveLength(3);
    expect(conf.match(/access_log \/var\/log\/nginx\/scanner\.log combined if=\$block_request;/g)).toHaveLength(3);
    expect(conf.match(/access_log \/var\/log\/nginx\/access\.log combined if=\$log_normal;/g)).toHaveLength(3);
  });

  it('drops blocked requests with 444 before the trailing-slash rewrite', () => {
    const drop = conf.indexOf('if ($block_request) {');
    expect(drop).toBeGreaterThan(-1);
    expect(conf.slice(drop, conf.indexOf('}', drop))).toContain('return 444;');
    expect(drop).toBeLessThan(conf.indexOf('rewrite ^/(.+)/$ /$1 permanent;'));
  });

  it('keeps blocked hits out of the main access log and in scanner.log', () => {
    const main = conf.slice(conf.indexOf('server_name murphys-laws.com;'));
    expect(main).toContain('access_log /var/log/nginx/access.log combined if=$log_normal;');
    expect(main).toContain('access_log /var/log/nginx/scanner.log combined if=$block_request;');
  });

  it('only blocks when both the agent and path maps are clear', () => {
    const start = conf.indexOf('map "$scanner_agent$scanner_path" $block_request {');
    const block = conf.slice(start, conf.indexOf('\n}', start));
    expect(block).toContain('default 1;');
    expect(block).toContain('"00" 0;');
  });
});

describe('nginx legacy URL redirects', () => {
  it.each([
    ['/murphy/murphy-true.html', '/examples'],
    ['/murphy/murphy-technology.html', '/category/murphys-technology-laws'],
    ['/murphy/murphy-laws.html', '/category/murphys-laws'],
    ['/murphy/murphy-computer.html', '/category/murphys-computer-laws'],
    ['/murphy/murphy-teaching.html', '/category/murphys-teaching-laws'],
    ['/murphy/murphy-cas.htm', '/category/murphys-cowboy-action-shooting-cas-laws'],
    ['/murphy/murphy-cars.htm', '/category/murphys-cars-laws'],
    ['/murphy/contact.html', '/contact'],
    ['/old/index.htm', '/'],
    ['/apple-touch-icon-precomposed.png', '/apple-touch-icon.png'],
  ])('redirects %s to %s', (from, to) => {
    const start = conf.indexOf(`location = ${from} {`);
    expect(start).toBeGreaterThan(-1);
    expect(conf.slice(start, conf.indexOf('}', start))).toContain(
      `return 301 https://murphys-laws.com${to};`,
    );
  });

  it('sends any other old /murphy/ page home without letting regex locations win', () => {
    const start = conf.indexOf('location ^~ /murphy/ {');
    expect(start).toBeGreaterThan(-1);
    expect(conf.slice(start, conf.indexOf('}', start))).toContain('return 301 https://murphys-laws.com/;');
  });

  it('answers the Google prefetch proxy instead of returning 404', () => {
    const start = conf.indexOf('location = /.well-known/traffic-advice {');
    expect(start).toBeGreaterThan(-1);
    const block = conf.slice(start, conf.indexOf('\n    }', start));
    expect(block).toContain('default_type application/trafficadvice+json;');
    expect(block).toContain('return 200');
  });
});

// This only pins the intended pattern with a hand-made stand-in for fail2ban's <HOST> and its
// timestamp removal. The real check is `fail2ban-regex` on the server (see the filter's header).
describe('fail2ban scanner filter', () => {
  const filter = readFileSync(resolve(root, 'config', 'fail2ban', 'filter.d-nginx-scanner.conf'), 'utf8');
  const failregex = (/^failregex = (.*)$/m.exec(filter)?.[1] ?? '').replace('<HOST>', '(?<host>\\S+)');

  it('does not depend on the bracketed timestamp that fail2ban strips before matching', () => {
    expect(failregex).not.toContain('\\[');
  });

  it('counts 444 lines, with or without the timestamp, and ignores other statuses', () => {
    const regex = new RegExp(failregex);
    const request = '"GET /.env HTTP/1.1"';
    const agent = '0 "-" "Mozilla/5.0"';

    expect(regex.exec(`66.132.195.44 - - [30/Oct/2026:20:54:41 +0000] ${request} 444 ${agent}`)?.groups?.host).toBe('66.132.195.44');
    expect(regex.exec(`66.132.195.44 - - [] ${request} 444 ${agent}`)?.groups?.host).toBe('66.132.195.44');
    expect(regex.test(`66.132.195.44 - - [30/Oct/2026:20:53:32 +0000] ${request} 400 264 "-" "Mozilla/5.0"`)).toBe(false);
    expect(regex.test(`66.132.195.44 - - [] ${request} 4441 ${agent}`)).toBe(false);
  });
});
