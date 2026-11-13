import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployScript = path.join(rootDirectory, 'backend/scripts/deploy.ts');

// `npm run deploy` (backend/scripts/deploy.ts), run for real with stand-ins for npm, rsync, ssh, tsx and, on the "server", sudo,
// nginx and systemctl. deploy.ts hands each remote command to /bin/sh exactly as it would for ssh, and the stand-in ssh
// runs that argument with sh (dash on Linux, the shell a server login would use) after the local shell has unquoted it, so
// the quoting chain from the local shell to the remote shell is the real one, not a copy of the strings. The paths of the
// server (/root/murphys-laws, /etc/nginx) are redirected into a throwaway directory; the stand-in sudo only runs the file
// commands whose paths are inside it, and records every other command without running it. PATH holds the stand-ins and a
// few plain tools only (the stand-ins come first, then the directory of node), so a command that deploy.ts gains later is
// not run by a stand-in by accident.

// The plain tools the stand-ins use.
const plainTools = ['sh', 'bash', 'sed', 'cp', 'rm', 'mv', 'cat', 'wc', 'tr', 'test'];
// `command -v` answers a bare word for a shell builtin such as test, so fall back to the file of the same name.
const toolPath = (name: string): string => {
  const found = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).stdout.trim();
  return path.isAbsolute(found) ? found : ['/usr/bin', '/bin'].map((dir) => path.join(dir, name)).find((file) => existsSync(file)) ?? found;
};

type Sandbox = { directory: string; bin: string; tools: string; site: string; remoteRoot: string; trace: string };

function createSandbox(previous: string | null): Sandbox {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'deploy-ts-'));
  const bin = path.join(directory, 'bin');
  const tools = path.join(directory, 'tools');
  const remoteRoot = path.join(directory, 'root/murphys-laws');
  const site = path.join(directory, 'etc/nginx/sites-available/murphys-laws');
  const trace = path.join(directory, 'trace.log');
  mkdirSync(bin);
  mkdirSync(tools);
  for (const name of plainTools) symlinkSync(toolPath(name), path.join(tools, name));
  mkdirSync(remoteRoot, { recursive: true });
  mkdirSync(path.dirname(site), { recursive: true });
  writeFileSync(trace, '');
  writeFileSync(path.join(remoteRoot, 'nginx.conf'), 'repository copy before the deploy\n');
  if (previous !== null) writeFileSync(site, previous);

  const fake = (name: string, body: string) => {
    writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(path.join(bin, name), 0o755);
  };
  fake('npm', 'echo "npm $*" >> "$TRACE"');
  fake('tsx', 'echo "tsx $*" >> "$TRACE"');
  // The upload of nginx.conf lands in the sandbox; every other rsync is only recorded.
  fake(
    'rsync',
    [
      'echo "rsync $*" >> "$TRACE"',
      'penultimate=""; last=""',
      'for arg; do penultimate=$last; last=$arg; done',
      '[ -z "$STUB_RSYNC_FAIL" ] || case "$last" in *nginx.conf.next) ;; *) exit 1 ;; esac',
      'case "$last" in',
      '  *:/root/murphys-laws/nginx.conf.next) cp "$penultimate" "$SANDBOX/root/murphys-laws/nginx.conf.next" ;;',
      'esac',
    ].join('\n'),
  );
  // ssh gets the host and one command, runs the command with sh (the server's login shell) and returns its status.
  fake(
    'ssh',
    [
      'echo "ssh $2" >> "$TRACE"',
      'remote=$(printf "%s" "$2" | sed -e "s#/root/murphys-laws#$SANDBOX/root/murphys-laws#g" -e "s#/etc/nginx#$SANDBOX/etc/nginx#g")',
      'exec sh -c "$remote"',
    ].join('\n'),
  );
  // sudo runs only the commands that name no path outside the sandbox, and fails a cp onto STUB_FAIL_TARGET (relative to the sandbox), the
  // restoring `cp -p` onto the site file when STUB_FAIL_RESTORE is set, and mv when STUB_FAIL_MV is set.
  fake(
    'sudo',
    [
      'echo "sudo $*" >> "$TRACE"',
      'case "$1" in nginx|systemctl|-u) ;; *)',
      '  for arg; do',
      '    case "$arg" in /*) case "$arg" in "$SANDBOX"/*) ;; *) exit 0 ;; esac ;; esac',
      '  done ;;',
      'esac',
      'case "$1" in',
      '  nginx) shift; echo "nginx $* [site bytes: $(wc -c < "$SANDBOX/etc/nginx/sites-available/murphys-laws" | tr -d " ")]" >> "$TRACE"; [ "$STUB_NGINX_TEST" != fail ] || { echo "nginx: [emerg] unknown directive \\"module_directive\\"" >&2; exit 1; } ;;',
      '  systemctl) [ -z "$STUB_RELOAD_FAIL" ] ;;',
      '  cp|rm|mv|test) for last; do :; done; if [ "$1" = mv ] && [ -n "$STUB_FAIL_MV" ]; then exit 1; fi; if [ "$1" = cp ] && [ "$2" = -p ] && [ -n "$STUB_FAIL_RESTORE" ] && [ "$last" = "$SANDBOX/etc/nginx/sites-available/murphys-laws" ]; then exit 1; fi; if [ -n "$STUB_FAIL_TARGET" ] && [ "$1" = cp ] && [ "$last" = "$SANDBOX/$STUB_FAIL_TARGET" ]; then exit 1; fi; exec "$@" ;;',
      'esac',
    ].join('\n'),
  );
  return { directory, bin, tools, site, remoteRoot, trace };
}

function runDeploy(sandbox: Sandbox, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', deployScript], {
    cwd: rootDirectory,
    encoding: 'utf8',
    env: {
      PATH: `${sandbox.bin}:${path.dirname(process.execPath)}:${sandbox.tools}`,
      TRACE: sandbox.trace,
      SANDBOX: sandbox.directory,
      STUB_NGINX_TEST: 'pass',
      ...env,
    },
  });
}

const traceOf = (sandbox: Sandbox): string[] => readFileSync(sandbox.trace, 'utf8').split('\n').filter(Boolean);
const rsyncs = (trace: string[]): string[] => trace.filter((line) => line.startsWith('rsync '));
const testedNginx = (trace: string[]): number => trace.findIndex((line) => line.startsWith('sudo nginx -t'));
const leftovers = (sandbox: Sandbox): string[] => readdirSync(sandbox.remoteRoot).filter((name) => name !== 'nginx.conf');

function finish(sandbox: Sandbox) {
  rmSync(sandbox.directory, { recursive: true, force: true });
}

test('npm run deploy installs and tests nginx.conf before it syncs anything, and reloads nginx only after the files are in place', () => {
  const sandbox = createSandbox('old site\n');
  try {
    const result = runDeploy(sandbox);
    assert.equal(result.status, 0, result.stdout + result.stderr);

    const trace = traceOf(sandbox);
    const tested = testedNginx(trace);
    const firstSync = trace.findIndex((line) => line.startsWith('rsync -avz --delete web/dist/'));
    const lastSync = trace.findLastIndex((line) => line.startsWith('rsync '));
    const reload = trace.findIndex((line) => line.startsWith('sudo systemctl reload nginx'));
    assert.ok(tested > -1 && firstSync > -1 && reload > -1);
    assert.match(trace[trace.findIndex((line) => line.startsWith('rsync '))] as string, /rsync -avz nginx\.conf [^ ]+:\/root\/murphys-laws\/nginx\.conf\.next/, 'the first sync is the upload of nginx.conf, under another name');
    assert.ok(trace.findIndex((line) => line.startsWith('npm run build')) < tested, 'the build comes first');
    assert.ok(tested < firstSync, 'nginx -t runs before the first sync of the release');
    assert.deepEqual(rsyncs(trace.slice(0, tested)).length, 1, 'only the nginx.conf upload comes before nginx -t');
    assert.ok(reload > lastSync, 'the reload comes after every sync');
    assert.equal(trace.filter((line) => line.startsWith('sudo systemctl reload nginx')).length, 1, 'nginx is reloaded once');
    assert.ok(!trace.some((line) => /systemctl restart/.test(line)), 'never restarted');
    assert.ok(trace.findIndex((line) => line.includes('alert-email.sh /usr/local/bin')) > reload, 'the maintenance scripts come after');

    assert.equal(readFileSync(sandbox.site, 'utf8'), readFileSync(path.join(rootDirectory, 'nginx.conf'), 'utf8'), 'the site is the repository nginx.conf');
    assert.equal(readFileSync(path.join(sandbox.remoteRoot, 'nginx.conf'), 'utf8'), readFileSync(path.join(rootDirectory, 'nginx.conf'), 'utf8'), 'the repository copy on the server is updated');
    assert.deepEqual(leftovers(sandbox), [], 'neither the upload nor the backup of the previous site file is left');
  } finally {
    finish(sandbox);
  }
});

for (const previous of ['old site\n', null]) {
  test(`a rejected nginx.conf ${previous === null ? 'on a server with no site file ' : ''}restores the site file and fails the deploy before anything else is synced or reloaded`, () => {
    const sandbox = createSandbox(previous);
    try {
      const result = runDeploy(sandbox, { STUB_NGINX_TEST: 'fail' });

      assert.notEqual(result.status, 0, 'the deploy fails');
      assert.match(result.stdout + result.stderr, /unknown directive "module_directive"/);
      assert.match(result.stderr, /ERROR: nginx\.conf could not be installed or nginx rejected it; restoring the previous site file/);
      assert.match(result.stdout, /Deployment failed!/);

      const trace = traceOf(sandbox);
      assert.deepEqual(rsyncs(trace).length, 1, 'only the nginx.conf upload ran');
      assert.ok(testedNginx(trace) > -1, 'nginx tested the file');
      assert.ok(!trace.some((line) => /systemctl|--delete|alert-email|pm2|migrate|npm ci/.test(line)), 'nothing after the test ran');
      assert.deepEqual(
        trace.filter((line) => /^(npm|tsx|rsync|ssh) /.test(line)).map((line) => line.split(' ').slice(0, 2).join(' ')),
        ['npm run', 'rsync -avz', 'ssh sudo'],
        'the build, the upload of nginx.conf and the one ssh command that tested it are everything the deploy ran',
      );
      assert.equal(trace.filter((line) => line.startsWith('sudo nginx -t')).length, 1);

      if (previous === null) {
        assert.ok(!existsSync(sandbox.site), 'a server that had no site file keeps none');
      } else {
        assert.equal(readFileSync(sandbox.site, 'utf8'), previous, 'sites-available has the previous file again');
      }
      assert.equal(readFileSync(path.join(sandbox.remoteRoot, 'nginx.conf'), 'utf8'), 'repository copy before the deploy\n', 'the repository copy on the server is not replaced by the rejected file');
      assert.deepEqual(leftovers(sandbox), [], 'neither the upload nor the backup is left');
    } finally {
      finish(sandbox);
    }
  });
}

test('nginx tests the uploaded file as the site: it reads the new content from sites-available', () => {
  const sandbox = createSandbox('old site\n');
  try {
    runDeploy(sandbox);
    const nginx = traceOf(sandbox).find((line) => line.startsWith('nginx -t'));
    assert.equal(nginx, `nginx -t [site bytes: ${readFileSync(path.join(rootDirectory, 'nginx.conf')).length}]`);
  } finally {
    finish(sandbox);
  }
});

test('a site file that cannot be backed up stops the deploy before it is replaced', () => {
  const sandbox = createSandbox('old site\n');
  try {
    const result = runDeploy(sandbox, { STUB_FAIL_TARGET: 'root/murphys-laws/nginx.site.previous' });

    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(sandbox.site, 'utf8'), 'old site\n', 'the live site file is untouched');
    assert.equal(testedNginx(traceOf(sandbox)), -1, 'nginx was not even asked');
    assert.equal(rsyncs(traceOf(sandbox)).length, 1);
  } finally {
    finish(sandbox);
  }
});

test('a previous site file that cannot be put back is reported with where its copy is, and the deploy still fails', () => {
  const sandbox = createSandbox('old site\n');
  try {
    const result = runDeploy(sandbox, { STUB_NGINX_TEST: 'fail', STUB_FAIL_TARGET: 'etc/nginx/sites-available/murphys-laws' });

    // The stand-in fails every copy onto the site file, the install of the new one included, so the restore fails too.
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERROR: could not restore .*sites-available\/murphys-laws; the previous copy is in .*nginx\.site\.previous/);
    assert.equal(readFileSync(path.join(sandbox.remoteRoot, 'nginx.site.previous'), 'utf8'), 'old site\n', 'the previous copy is kept');
    assert.equal(rsyncs(traceOf(sandbox)).length, 1);
  } finally {
    finish(sandbox);
  }
});

test('the remote commands are plain: no double quote to end the argument of ssh, no dollar sign for the local shell to expand, nothing that reloads except the reload', () => {
  const source = readFileSync(deployScript, 'utf8');
  for (const name of ['NGINX_RESTORE', 'NGINX_INSTALL_AND_TEST']) {
    const start = source.indexOf(`const ${name} = [`);
    const end = source.indexOf("].join(' ');", start);
    assert.ok(start > -1 && end > start, name);
    const body = source.slice(start, end);

    assert.doesNotMatch(body, /"/, name);
    assert.doesNotMatch(body, /\$(?!\{NGINX_|\{DROPLET_)/, `${name}: the only dollar signs are the interpolations of the constants`);
    assert.doesNotMatch(body, /systemctl/, name);
  }
  const finish = /const NGINX_FINISH = (`[^`]*`);/.exec(source)?.[1] ?? '';
  assert.ok(finish, 'NGINX_FINISH is found');
  assert.doesNotMatch(finish, /"|systemctl/);
  assert.doesNotMatch(finish, /\$(?!\{NGINX_|\{DROPLET_)/);
});

for (const [label, env] of [
  ['a sync of the release fails', { STUB_RSYNC_FAIL: '1' }],
  ['the reload fails', { STUB_RELOAD_FAIL: '1' }],
] as const) {
  for (const previous of ['old site\n', null]) {
    test(`when ${label} after nginx accepted the file${previous === null ? ' on a server with no site file' : ''}, the previous site file is put back and the deploy fails`, () => {
      const sandbox = createSandbox(previous);
      try {
        const result = runDeploy(sandbox, env);

        assert.notEqual(result.status, 0);
        assert.match(result.stdout, /putting the previous nginx site file back/);
        if (previous === null) {
          assert.ok(!existsSync(sandbox.site), 'no site file is left armed for an unrelated reload');
        } else {
          assert.equal(readFileSync(sandbox.site, 'utf8'), previous, 'the new, tested file does not wait on disk for an unrelated reload');
        }
        assert.equal(readFileSync(path.join(sandbox.remoteRoot, 'nginx.conf'), 'utf8'), 'repository copy before the deploy\n');
        assert.deepEqual(leftovers(sandbox), [], 'neither the upload nor the backup is left');
        const trace = traceOf(sandbox);
        assert.ok(!trace.some((line) => /alert-email|pm2|npm ci/.test(line)), 'nothing after the failed step ran');
        if ('STUB_RSYNC_FAIL' in env) assert.ok(!trace.some((line) => line.startsWith('sudo systemctl')), 'nothing is reloaded after a failed sync');
      } finally {
        finish(sandbox);
      }
    });
  }
}

test('a failure after nginx was reloaded does not put the previous file back: the new one is live', () => {
  const sandbox = createSandbox('old site\n');
  try {
    writeFileSync(path.join(sandbox.bin, 'tsx'), '#!/bin/sh\nexit 1\n');
    const result = runDeploy(sandbox);

    assert.notEqual(result.status, 0, 'the validation of the Node version on the server fails the deploy');
    assert.ok(traceOf(sandbox).some((line) => line.startsWith('sudo systemctl reload nginx')));
    assert.equal(readFileSync(sandbox.site, 'utf8'), readFileSync(path.join(rootDirectory, 'nginx.conf'), 'utf8'), 'nginx runs the new file, so the site file must stay');
    assert.deepEqual(leftovers(sandbox), []);
  } finally {
    finish(sandbox);
  }
});

test('an old backup left by an earlier failed run is never restored over a server that has no site file', () => {
  const sandbox = createSandbox(null);
  try {
    writeFileSync(path.join(sandbox.remoteRoot, 'nginx.site.previous'), 'stale backup\n');
    const result = runDeploy(sandbox, { STUB_NGINX_TEST: 'fail' });

    assert.notEqual(result.status, 0);
    assert.ok(!existsSync(sandbox.site), 'the stale file did not become the site');
    assert.deepEqual(leftovers(sandbox), []);
  } finally {
    finish(sandbox);
  }
});

test('when the previous site file cannot be put back after a failed sync, the deploy warns where the copy is and still reports the sync failure', () => {
  const sandbox = createSandbox('old site\n');
  try {
    const result = runDeploy(sandbox, { STUB_RSYNC_FAIL: '1', STUB_FAIL_RESTORE: '1' });

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /WARNING: the previous nginx site file was not restored/);
    assert.match(result.stdout, /nginx\.site\.previous/);
    assert.match(result.stdout + result.stderr, /Syncing web dist folder failed/, 'the original failure is still the one reported');
    assert.equal(readFileSync(path.join(sandbox.remoteRoot, 'nginx.site.previous'), 'utf8'), 'old site\n', 'the previous copy is kept');
  } finally {
    finish(sandbox);
  }
});

test('when keeping nginx.conf as the repository copy fails after the reload, the deploy only warns: nginx runs the new file, which stays', () => {
  const sandbox = createSandbox('old site\n');
  try {
    const result = runDeploy(sandbox, { STUB_FAIL_MV: '1' });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /WARNING: nginx\.conf was not kept as the repository copy/);
    assert.ok(traceOf(sandbox).some((line) => line.startsWith('sudo pm2') || line.includes('pm2 restart')), 'the deploy went on to the restart');
    assert.equal(readFileSync(sandbox.site, 'utf8'), readFileSync(path.join(rootDirectory, 'nginx.conf'), 'utf8'), 'the previous file is not put back over what nginx loaded');
  } finally {
    finish(sandbox);
  }
});
