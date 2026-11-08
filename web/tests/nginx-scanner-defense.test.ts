import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
    '/docker-compose.prod.yml',
    '/docker-compose.yaml',
    '/Dockerfile',
    '/Dockerfile.prod',
    '/.dockerignore',
    '/readme.html',
    '/license.txt',
    '/account/create',
    '/account/register',
    '/auth/signup',
    '/create-account',
    '/email-signup',
    '/footer-signup',
    '/contact-form',
    '/company',
    '/leistungen',
    '/our-team',
    '/products',
    '/services',
    '/servicios',
    '/team',
    '/vpn',
    '/services/',
    '/team?ref=1',
    '/api/usage/stats',
    '/v1/auth/me',
    '/auth/register',
    '/api/usage/stats?x=1',
    '/api/usage/stats/',
    '/v1/auth/me?x=1',
    '/v1/auth/login',
    '/v1/auth/token/refresh',
    '/v1/auth/oauth2',
    '/crumbIssuer/api/json',
    '/crumbIssuer',
    '/run',
    '/RUN/',
    '/health',
    '/version?x=1',
    '/health/',
    '/version/',
    '/crumbIssuer?x=1',
    '/run?x',
    '/code/blocks/exec/code',
    '/code/blocks/exec/start',
    '/api/v1/code/blocks/exec/code',
    '/api/v1/code/blocks/exec/start',
    '/Team',
    '/ACCOUNT/Create',
    '/users/sign_in',
    '/users/sign_in/',
    '/users/sign_in?next=/',
    '/Users/Sign_In',
    '/users/sign_up',
    '/api/sonicos/is-sslvpn-enabled',
    '/api/sonicos/auth',
    '/sonicos/auth',
    '/WebInterface',
    '/WebInterface/login.html',
    '/wp',
    '/wp/',
    '/health/liveliness',
    '/health/readiness',
    '/health/liveliness?probe=1',
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
    '/.well-known/tdmrep.json',
    '/img/Murphys-law-book.gif',
    '/img/10001844.gif',
    '/contact-us',
    '/about-us',
    '/team/x',
    '/services/seo',
    '/law/team',
    '/category/team',
    '/api/v1/auth/login',
    '/api/health',
    '/browse?q=run',
    '/browse?q=health',
    '/law/run',
    '/api/v1/laws?q=version',
    '/running',
    '/runtime',
    '/healthz',
    '/versions',
    '/api/version',
    '/.well-known/security.txt',
    '/browse?q=team',
    '/browse?q=services',
    '/search?q=account/create',
    '/category/murphys-laws-of-team-work',
    '/api/v1/laws?q=vpn',
    '/browse?q=readme.html',
    '/browse?q=docker-compose.yml',
    '/users',
    '/law/users',
    '/browse?q=users/sign_in',
    '/users/sign_in_help',
    '/users/sign_up/extra',
    '/user/sign_in',
    '/murphy',
    '/img/pvtmurphy.gif',
    '/sitemaps.xml',
    '/favicon.png',
    '/browse?q=wp',
    '/browse?q=sonicos',
    '/search?q=WebInterface',
    '/wpa',
    '/healthcheck',
    '/law/health',
    '/browse?q=health/liveliness',
  ])('lets %s through', (uri) => {
    expect(isScannerPath(uri)).toBe(false);
  });

  it('flags exploit-kit user agents only', () => {
    expect(isScannerAgent('libredtail-http')).toBe(true);
    expect(isScannerAgent('sqlmap/1.7')).toBe(true);
    expect(isScannerAgent('rawgrab')).toBe(true);
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

  it('only blocks when the agent, path and method maps are all clear', () => {
    const start = conf.indexOf('map "$scanner_agent$scanner_path$scanner_post_root" $block_request {');
    expect(start).toBeGreaterThan(-1);
    const block = conf.slice(start, conf.indexOf('\n}', start));
    expect(block).toContain('default 1;');
    expect(block).toContain('"000" 0;');
    // "000" must be the only key that lets a request through.
    expect(block.match(/^\s*"[01]+" 0;$/gm)).toHaveLength(1);
  });

  // No route of the site accepts a POST at "/", so a POST to "/" is always a bot.
  describe('POST to the home page', () => {
    const postRootKeys = (): Set<string | undefined> => {
      const start = conf.indexOf('map "$request_method $request_uri" $scanner_post_root {');
      expect(start).toBeGreaterThan(-1);
      const body = conf.slice(start, conf.indexOf('\n}', start));
      expect(body).toContain('default 0;');
      // nginx map keys without ~ are exact matches.
      return new Set([...body.matchAll(/^\s*"(.+)" 1;$/gm)].map((match) => match[1]));
    };
    // The agent, path and method-and-path maps each give 0 or 1 and are joined into one key; only "000" passes.
    const blocked = (method: string, uri: string, agent = 'Mozilla/5.0'): boolean => {
      const flags = [isScannerAgent(agent), isScannerPath(uri), postRootKeys().has(`${method} ${uri}`)];
      return flags.map((flag) => (flag ? '1' : '0')).join('') !== '000';
    };

    it('is parsed from nginx.conf, with a default of 0 and POST / as the only blocked key', () => {
      expect([...postRootKeys()]).toEqual(['POST /']);
    });

    it('drops a POST to "/", also from a scanner user agent', () => {
      expect(blocked('POST', '/')).toBe(true);
      expect(blocked('POST', '/', 'libredtail-http')).toBe(true);
    });

    it('still drops scanner paths and agents on their own, by any method', () => {
      expect(blocked('GET', '/.env')).toBe(true);
      expect(blocked('POST', '/.env')).toBe(true);
      expect(blocked('GET', '/', 'libredtail-http')).toBe(true);
    });

    it.each([
      ['GET', '/'],
      ['HEAD', '/'],
      ['OPTIONS', '/'],
      ['POST', '/api/v1/laws'],
      ['POST', '/api/v1/laws/1/vote'],
      ['POST', '/subscription/unsubscribe?token=abc'],
      ['POST', '/?utm=x'],
      ['POST', '/law/1'],
    ])('lets %s %s through the whole chain', (method, uri) => {
      expect(blocked(method, uri)).toBe(false);
    });
  });
});

describe('plain HTTP sent to a TLS port', () => {
  // nginx raises error 497 for it and would answer "400 The plain HTTP request was sent to HTTPS port",
  // which shows up in the main access log and the daily report. It is dropped like any scanner hit.
  const dropPlainHttp = new RegExp(
    'error_page 497 =444 @plain_http_on_tls;\\s+' +
      'location @plain_http_on_tls \\{\\s+' +
      'access_log /var/log/nginx/scanner\\.log combined;\\s+' +
      'return 444;\\s+\\}',
  );
  const serverBlocks = conf.split(/^server \{$/m).slice(1);
  const tlsBlocks = serverBlocks.filter((block) => /^\s*listen 443 ssl;/m.test(block));

  it('drops it, logged to scanner.log only, in every server block that listens for TLS', () => {
    // A new TLS server block that forgets the rule would make this count differ.
    expect(serverBlocks).toHaveLength(3);
    expect(tlsBlocks).toHaveLength(2);
    for (const block of tlsBlocks) {
      expect(block).toMatch(dropPlainHttp);
    }
  });

  it('leaves the plain HTTP server block alone, which redirects instead', () => {
    const plainBlocks = serverBlocks.filter((block) => !tlsBlocks.includes(block));

    expect(plainBlocks).toHaveLength(1);
    expect(plainBlocks[0]).toContain('return 301 https://murphys-laws.com$request_uri;');
    expect(plainBlocks[0]).not.toContain('error_page 497');
  });

  it('writes a 444 line that the fail2ban filter counts as a strike', () => {
    const filter = readFileSync(resolve(root, 'config', 'fail2ban', 'filter.d-nginx-scanner.conf'), 'utf8');
    const failregex = (/^failregex = (.*)$/m.exec(filter)?.[1] ?? '').replace('<HOST>', '(?<host>\\S+)');
    const agent = '"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:65.0) Gecko/20100101 Firefox/65.0"';
    const line = (status: number, bytes: number) =>
      `194.187.176.248 - - [07/Nov/2026:01:11:41 +0000] "GET /favicon.ico HTTP/1.1" ${status} ${bytes} "-" ${agent}`;

    expect(new RegExp(failregex).exec(line(444, 0))?.groups?.host).toBe('194.187.176.248');
    // The 400 that nginx logged before this rule is not counted.
    expect(new RegExp(failregex).test(line(400, 264))).toBe(false);
  });
});

describe('MCP discovery paths', () => {
  // The MCP server is a local stdio package (mcp/server.json), so nothing is served at /mcp or
  // /.well-known/mcp*, and llms.txt, llms-full.txt and mcp/README.md say so.
  const update =
    'If a hosted MCP endpoint is added, update the stdio-only statements in web/public/llms.txt, web/public/llms-full.txt and mcp/README.md';

  it('has no nginx location for an MCP endpoint or discovery file', () => {
    expect(conf, update).not.toMatch(/^\s*location[^\n{]*mcp/im);
  });

  it('ships no static MCP discovery file', () => {
    const publicDir = resolve(root, 'web', 'public');
    const wellKnown = resolve(publicDir, '.well-known');
    const names = [...readdirSync(publicDir), ...(existsSync(wellKnown) ? readdirSync(wellKnown) : [])];

    expect(
      names.filter((name) => /^mcp/i.test(name)),
      update,
    ).toEqual([]);
  });

  it.each(['web/public/llms.txt', 'web/public/llms-full.txt', 'mcp/README.md'])(
    '%s says the server is stdio-only with no hosted or remote endpoint',
    (file) => {
      const text = readFileSync(resolve(root, file), 'utf8');

      expect(text).toMatch(/stdio/i);
      expect(text).toMatch(/no hosted or remote/i);
    },
  );

  it('keeps the claim in step with mcp/server.json, which declares stdio and the Registry name', () => {
    const server = JSON.parse(readFileSync(resolve(root, 'mcp', 'server.json'), 'utf8')) as {
      name: string;
      packages: Array<{ transport: { type: string } }>;
    };

    expect(server.packages.map((pkg) => pkg.transport.type)).toEqual(['stdio']);
    for (const file of ['web/public/llms.txt', 'web/public/llms-full.txt']) {
      expect(readFileSync(resolve(root, file), 'utf8')).toContain(server.name);
    }
  });
});

describe('legacy images', () => {
  it.each(['Murphys-law-book.gif', '10001844.gif', 'pvtmurphy.gif'])('%s is a real GIF, not another format renamed to .gif', (name) => {
    const file = resolve(root, 'web', 'public', 'img', name);
    expect(existsSync(file)).toBe(true);
    expect(['GIF87a', 'GIF89a']).toContain(readFileSync(file).subarray(0, 6).toString('ascii'));
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
    ['/about-us', '/about'],
    ['/contact-us', '/contact'],
    ['/old/index.htm', '/'],
    ['/murphy', '/'],
    ['/apple-touch-icon-precomposed.png', '/apple-touch-icon.png'],
    ['/sitemaps.xml', '/sitemap.xml'],
    ['/favicon.png', '/favicon-32x32.png'],
  ])('redirects %s to %s', (from, to) => {
    const start = conf.indexOf(`location = ${from} {`);
    expect(start).toBeGreaterThan(-1);
    expect(conf.slice(start, conf.indexOf('}', start))).toContain(
      `return 301 https://murphys-laws.com${to};`,
    );
  });

  it('sends an old /murphy/ link home in two hops: the trailing-slash rewrite, then the exact redirect', () => {
    expect(conf).toMatch(/^\s*rewrite \^\/\(\.\+\)\/\$ \/\$1 permanent;$/m);
    expect('/murphy/'.replace(/^\/(.+)\/$/, '/$1')).toBe('/murphy');
    expect(conf).toContain('location = /murphy {');
  });

  it('redirects /favicon.png to a favicon file that exists', () => {
    expect(existsSync(resolve(root, 'web', 'public', 'favicon-32x32.png'))).toBe(true);
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

  it('serves an RFC 9116 security.txt that points at the private reporting channel', () => {
    const start = conf.indexOf('location = /.well-known/security.txt {');
    expect(start).toBeGreaterThan(-1);
    const block = conf.slice(start, conf.indexOf('\n    }', start));
    expect(block).toContain('default_type text/plain;');
    expect(block).toContain('charset utf-8;');
    expect(block).toContain('Contact: https://github.com/ravidorr/murphys-laws/security/advisories/new\\n');
    expect(block).toMatch(/Expires: \d{4}-\d{2}-\d{2}T00:00:00\.000Z\\n/);
  });

  // CI is the renewal reminder: this fails 30 days before the Expires date in nginx.conf passes.
  it('serves a security.txt whose Expires date is more than 30 days away', () => {
    const start = conf.indexOf('location = /.well-known/security.txt {');
    const expires = /Expires: (\d{4}-\d{2}-\d{2}T00:00:00\.000Z)/.exec(conf.slice(start))?.[1];
    expect(expires).toBeDefined();
    const daysLeft = (Date.parse(expires as string) - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(30);
  });

  it('serves the TDM reservation file with AI crawling not reserved', () => {
    const start = conf.indexOf('location = /.well-known/tdmrep.json {');
    expect(start).toBeGreaterThan(-1);
    const block = conf.slice(start, conf.indexOf('\n    }', start));
    expect(block).toContain('default_type application/json;');
    expect(block).toContain(`return 200 '[{"location":"/*","tdm-reservation":0}]';`);
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
    expect(
      regex.exec('159.89.227.118 - - [08/Nov/2026:09:01:02 +0000] "POST / HTTP/1.1" 444 0 "-" "Mozilla/5.0"')?.groups?.host,
    ).toBe('159.89.227.118');
    expect(regex.test(`66.132.195.44 - - [30/Oct/2026:20:53:32 +0000] ${request} 400 264 "-" "Mozilla/5.0"`)).toBe(false);
    expect(regex.test(`66.132.195.44 - - [] ${request} 4441 ${agent}`)).toBe(false);
  });
});

describe('fail2ban scanner jail', () => {
  const jail = readFileSync(resolve(root, 'config', 'fail2ban', 'jail.d-nginx-scanner.local'), 'utf8');
  // Comment lines start with #, so only real settings match.
  const setting = (key: string): string | undefined => new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm').exec(jail)?.[1]?.trim();

  it('reads the log file instead of the journal', () => {
    // Debian and Ubuntu set backend = systemd for every jail, and a systemd jail ignores logpath, so
    // until this was set the jail never saw a strike and never banned anyone.
    expect(['auto', 'polling', 'pyinotify']).toContain(setting('backend'));
  });

  it('watches the scanner log that nginx writes', () => {
    expect(setting('logpath')).toBe('/var/log/nginx/scanner.log');
    expect(conf).toContain(`access_log ${setting('logpath')} combined`);
  });

  it('uses the nginx-scanner filter on the web ports, and is enabled', () => {
    expect(setting('filter')).toBe('nginx-scanner');
    expect(existsSync(resolve(root, 'config', 'fail2ban', 'filter.d-nginx-scanner.conf'))).toBe(true);
    expect(setting('port')).toBe('http,https');
    expect(setting('enabled')).toBe('true');
  });
});

describe('embed routes', () => {
  it('proxies embeddable law cards to the backend and never blocks framing', () => {
    expect(conf).toContain('location ~ ^/embed/(law/\\d+|law-of-day)/?$ {');
    const start = conf.indexOf('location ~ ^/embed/');
    const block = conf.slice(start, conf.indexOf('\n    }', start));
    expect(block).toContain('proxy_pass http://127.0.0.1:8787;');
    expect(conf).not.toMatch(/add_header\s+(X-Frame-Options|Content-Security-Policy)/i);
  });
});
