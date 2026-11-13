import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(rootDirectory, 'scripts/check-nginx-config.sh');
const repositoryConfig = path.join(rootDirectory, 'nginx.conf');

// scripts/check-nginx-config.sh runs `nginx -t` on nginx.conf in the "nginx config" job of lockfile-sync.yml, in an
// ubuntu:24.04 container with the real nginx. These tests run it with stand-ins for nginx and openssl against throwaway
// directories (NGINX_ETC_DIR, LETSENCRYPT_DIR), so what they pin is the setup around nginx -t: which file nginx reads, from
// which path, with which stand-in files next to it, and that a rejection fails the script. The real rejections (an unknown
// directive, a syntax error, the missing brotli module) were run against nginx 1.24 in the container; the CHANGELOG entry
// that added the script has the results.

type Sandbox = { directory: string; etc: string; letsencrypt: string; bin: string; tools: string; calls: string };

// The plain tools the script and the stand-ins use, and nothing else on PATH: the machine's own openssl or nginx must never
// be found when a test removes the stand-in.
const plainTools = ['ls', 'mkdir', 'rm', 'cp', 'ln', 'cat', 'wc', 'tr', 'sh', 'mktemp'];
const toolPath = (name: string): string => spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();

function createSandbox({ withNginx = true, withBrotli = true } = {}): Sandbox {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'check-nginx-'));
  const etc = path.join(directory, 'etc-nginx');
  const letsencrypt = path.join(directory, 'etc-letsencrypt');
  const bin = path.join(directory, 'bin');
  const tools = path.join(directory, 'tools');
  const calls = path.join(directory, 'calls.log');
  mkdirSync(path.join(etc, 'modules-enabled'), { recursive: true });
  mkdirSync(path.join(etc, 'sites-enabled'));
  mkdirSync(bin);
  mkdirSync(tools);
  for (const name of plainTools) symlinkSync(toolPath(name), path.join(tools, name));
  writeFileSync(calls, '');
  // The stock site that the nginx package enables; the server removed it, so the script must too.
  writeFileSync(path.join(etc, 'sites-enabled', 'default'), 'server { listen 80 default_server; }\n');
  if (withBrotli) {
    writeFileSync(path.join(etc, 'modules-enabled', '50-mod-http-brotli-static.conf'), 'load_module modules/ngx_http_brotli_static_module.so;\n');
  }
  const fake = (name: string, body: string) => {
    writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(path.join(bin, name), 0o755);
  };
  if (withNginx) {
    // nginx -t reads the site through sites-enabled, like the real one; it fails when STUB_NGINX_FAIL is set.
    fake(
      'nginx',
      [
        'if [ "$1" = -v ]; then echo "nginx version: nginx/1.24.0 (stub)" >&2; echo "nginx -v" >> "$CALLS"; exit 0; fi',
        'echo "nginx $* [read: $(wc -c < "$NGINX_ETC_DIR/sites-enabled/murphys-laws" | tr -d " ")]" >> "$CALLS"',
        'if [ -n "$STUB_NGINX_FAIL" ]; then echo "nginx: [emerg] unknown directive \\"brotli_static\\"" >&2; exit 1; fi',
        'echo "nginx: configuration file test is successful"',
      ].join('\n'),
    );
  }
  // openssl writes what it is asked to write (-keyout and -out of req, -out of genpkey) and records the arguments.
  fake(
    'openssl',
    [
      'echo "openssl $*" >> "$CALLS"',
      'prev=""',
      'for arg in "$@"; do',
      '  if [ "$prev" = -keyout ] || [ "$prev" = -out ]; then echo "stand-in $prev" > "$arg"; fi',
      '  prev="$arg"',
      'done',
    ].join('\n'),
  );
  return { directory, etc, letsencrypt, bin, tools, calls };
}

function run(sandbox: Sandbox, args: string[], fail = false, extraEnv: Record<string, string> = {}) {
  return spawnSync(toolPath('bash'), [script, ...args], {
    encoding: 'utf8',
    env: {
      PATH: `${sandbox.bin}:${sandbox.tools}`,
      NGINX_ETC_DIR: sandbox.etc,
      LETSENCRYPT_DIR: sandbox.letsencrypt,
      CALLS: sandbox.calls,
      STUB_NGINX_FAIL: fail ? '1' : '',
      ...extraEnv,
    },
  });
}

const callsOf = (sandbox: Sandbox): string[] => readFileSync(sandbox.calls, 'utf8').split('\n').filter(Boolean);

// A one-line config that stands for "the repository's nginx.conf", whose size nginx -t reports back to the test.
function writeConfig(sandbox: Sandbox, content = 'server { listen 80; }\n'): string {
  const file = path.join(sandbox.directory, 'candidate.conf');
  writeFileSync(file, content);
  return file;
}

test('the file is installed as the site and enabled through sites-enabled, the stock default site is gone, and nginx -t reads it', () => {
  const sandbox = createSandbox();
  try {
    const conf = writeConfig(sandbox, 'server { listen 80; server_name murphys-laws.com; }\n');
    const result = run(sandbox, [conf]);

    assert.equal(result.status, 0, result.stderr);
    const available = path.join(sandbox.etc, 'sites-available', 'murphys-laws');
    const enabled = path.join(sandbox.etc, 'sites-enabled', 'murphys-laws');
    assert.equal(readFileSync(available, 'utf8'), readFileSync(conf, 'utf8'), 'the candidate is the installed site, byte for byte');
    assert.ok(lstatSync(enabled).isSymbolicLink(), 'it is enabled as the server does, with a symbolic link');
    assert.equal(readlinkSync(enabled), available);
    assert.ok(!existsSync(path.join(sandbox.etc, 'sites-enabled', 'default')), 'the default site would otherwise shadow it');
    assert.equal(callsOf(sandbox).at(-1), `nginx -t [read: ${readFileSync(conf).length}]`, 'nginx -t is the last command and read the candidate through sites-enabled');
    assert.match(result.stdout, /Testing .*candidate\.conf as /);
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('the version is printed, then the TLS stand-ins are made, and only then does nginx -t run', () => {
  const sandbox = createSandbox();
  try {
    const result = run(sandbox, [writeConfig(sandbox)]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /nginx version: nginx\/1\.24\.0/, 'the log of a run says which nginx tested the file');
    const calls = callsOf(sandbox);
    assert.equal(calls[0], 'nginx -v');
    assert.match(calls[1] ?? '', /^openssl req -x509 /);
    assert.match(calls[2] ?? '', /^openssl genpkey -genparam -algorithm DH -pkeyopt dh_param:ffdhe2048 /);
    assert.match(calls[3] ?? '', /^nginx -t /);
    assert.equal(calls.length, 4);
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('every file under /etc/letsencrypt that the real nginx.conf names exists next to the throwaway certificate, key and parameters', () => {
  const sandbox = createSandbox();
  try {
    const result = run(sandbox, [repositoryConfig]);
    assert.equal(result.status, 0, result.stderr);

    const config = readFileSync(repositoryConfig, 'utf8');
    const named = [...config.matchAll(/(\/etc\/letsencrypt\/[\w./-]+?)\s*;/g)].map((match) => match[1] as string);
    assert.ok(named.length >= 4, `the file names its certificate, key, options and parameters (${named.join(', ')})`);
    for (const file of new Set(named)) {
      const stand = path.join(sandbox.letsencrypt, file.slice('/etc/letsencrypt/'.length));
      assert.ok(existsSync(stand), `${file} would be missing for nginx -t (the script has no stand-in for it)`);
    }
    const options = readFileSync(path.join(sandbox.letsencrypt, 'options-ssl-nginx.conf'), 'utf8');
    assert.match(options, /^ssl_session_cache shared:le_nginx_SSL:10m;$/m, 'the options file is a copy of the one Certbot installs');
    assert.match(options, /^ssl_protocols TLSv1\.2 TLSv1\.3;$/m);
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('the file the script tests by default is the nginx.conf at the repository root', () => {
  const sandbox = createSandbox();
  try {
    const result = spawnSync(toolPath('bash'), [script], {
      cwd: rootDirectory,
      encoding: 'utf8',
      env: { PATH: `${sandbox.bin}:${sandbox.tools}`, NGINX_ETC_DIR: sandbox.etc, LETSENCRYPT_DIR: sandbox.letsencrypt, CALLS: sandbox.calls, STUB_NGINX_FAIL: '' },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(path.join(sandbox.etc, 'sites-available', 'murphys-laws'), 'utf8'), readFileSync(repositoryConfig, 'utf8'));
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('a file that nginx rejects fails the script with nginx\'s message, so the job fails', () => {
  const sandbox = createSandbox();
  try {
    const result = run(sandbox, [writeConfig(sandbox)], true);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown directive "brotli_static"/);
    assert.ok(callsOf(sandbox).some((call) => call.startsWith('nginx -t')), 'nginx -t did run');
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('without the brotli module package the script says so and never reaches nginx -t', () => {
  const sandbox = createSandbox({ withBrotli: false });
  try {
    const result = run(sandbox, [writeConfig(sandbox)]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /::error::the brotli_static module is not installed \(libnginx-mod-http-brotli-static\)/);
    assert.ok(!callsOf(sandbox).some((call) => call.startsWith('nginx -t')));
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('a missing config file, nginx or openssl is an error, not a pass', () => {
  const sandbox = createSandbox();
  try {
    const missing = run(sandbox, [path.join(sandbox.directory, 'no-such.conf')]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /::error::.*no-such\.conf does not exist/);

    rmSync(path.join(sandbox.bin, 'openssl'));
    const noOpenssl = run(sandbox, [writeConfig(sandbox)]);
    assert.equal(noOpenssl.status, 1);
    assert.match(noOpenssl.stderr, /::error::openssl is not installed/);
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }

  const bare = createSandbox({ withNginx: false });
  try {
    const noNginx = run(bare, [writeConfig(bare)]);
    assert.equal(noNginx.status, 1);
    assert.match(noNginx.stderr, /::error::nginx is not installed/);
  } finally {
    rmSync(bare.directory, { recursive: true, force: true });
  }
});

test('a failing openssl fails the script instead of testing without a certificate', () => {
  const sandbox = createSandbox();
  try {
    writeFileSync(path.join(sandbox.bin, 'openssl'), '#!/bin/sh\nexit 1\n');
    const result = run(sandbox, [writeConfig(sandbox)]);

    assert.equal(result.status, 1);
    assert.ok(!callsOf(sandbox).some((call) => call.startsWith('nginx -t')));
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('it refuses to replace an existing certificate or site file, which only a server has, unless told to', () => {
  for (const existing of [['letsencrypt', 'live/murphys-laws.com/fullchain.pem'], ['letsencrypt', 'live/murphys-laws.com/privkey.pem'], ['etc', 'sites-available/murphys-laws']] as const) {
    const sandbox = createSandbox();
    try {
      const file = path.join(existing[0] === 'etc' ? sandbox.etc : sandbox.letsencrypt, existing[1]);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, 'the real one\n');

      const refused = run(sandbox, [writeConfig(sandbox)]);
      assert.equal(refused.status, 1, existing.join('/'));
      assert.match(refused.stderr, /::error::.*already exists; this script replaces them with throwaway files, so it never runs on a server/);
      assert.equal(readFileSync(file, 'utf8'), 'the real one\n', 'the existing file is untouched');
      assert.deepEqual(callsOf(sandbox), [], 'nothing ran: not even nginx -v');

      const allowed = run(sandbox, [writeConfig(sandbox)], false, { CHECK_NGINX_ALLOW_OVERWRITE: '1' });
      assert.equal(allowed.status, 0, allowed.stderr);
    } finally {
      rmSync(sandbox.directory, { recursive: true, force: true });
    }
  }
});

test('an openssl that cannot make the certificate shows its own message and fails the script', () => {
  const sandbox = createSandbox();
  try {
    writeFileSync(path.join(sandbox.bin, 'openssl'), '#!/bin/sh\necho "openssl: cannot write the key" >&2\nexit 1\n');
    const result = run(sandbox, [writeConfig(sandbox)]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /openssl: cannot write the key/);
    assert.match(result.stderr, /::error::openssl could not make the throwaway certificate/);
  } finally {
    rmSync(sandbox.directory, { recursive: true, force: true });
  }
});

test('the script, the GitHub deploy and npm run deploy test the same site file, and nginx.conf says where it goes', () => {
  const site = 'sites-available/murphys-laws';
  for (const file of ['scripts/check-nginx-config.sh', '.github/workflows/deploy.yml', 'backend/scripts/deploy.ts', 'nginx.conf']) {
    assert.ok(readFileSync(path.join(rootDirectory, file), 'utf8').includes(site), `${file} names ${site}`);
  }
});
