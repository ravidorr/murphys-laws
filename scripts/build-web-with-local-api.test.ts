import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(rootDirectory, 'scripts/build-web-with-local-api.mjs');

// The script talks to a fixed port, so these tests need it free (a dev server on 8787 would make them meaningless).
const portBusy = spawnSync('node', ['-e', "require('node:net').connect(8787, '127.0.0.1').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"]).status === 0;
const options = { skip: portBusy ? 'port 8787 is in use' : false };

type Run = { status: number | null; stderr: string; calls: string[] };

/** Runs the script with a stand-in `npm` that logs `args | MURPHYS_DB_PATH`, and fails `migrate` or `start` on request. */
function run(env: Record<string, string | undefined>, stub: { migrateFails?: boolean } = {}): Run {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'build-web-'));
  const log = path.join(directory, 'npm.log');
  const npm = path.join(directory, 'npm');
  writeFileSync(npm, `#!/bin/sh
echo "$* | $MURPHYS_DB_PATH" >> "${log}"
case "$*" in
  *"run migrate"*) exit ${stub.migrateFails ? 1 : 0} ;;
  *" start"*) exit 1 ;;
esac
exit 0
`);
  chmodSync(npm, 0o755);
  const baseEnv = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
  delete baseEnv.MURPHYS_DB_PATH;
  const result = spawnSync('node', [script], { cwd: rootDirectory, env: { ...baseEnv, ...env }, encoding: 'utf8' });
  return {
    status: result.status,
    stderr: result.stderr,
    calls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((line) => line.trimEnd()) : [],
  };
}

function databaseFile(content = 'not empty'): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'build-web-db-'));
  const file = path.join(directory, 'copy.db');
  writeFileSync(file, content);
  return file;
}

test('without MURPHYS_DB_PATH it builds the archive database, then starts the API', options, () => {
  const result = run({});
  assert.deepEqual(result.calls, ['--prefix backend run build:db |', '--prefix backend start |']);
  assert.match(result.stderr, /exited before becoming healthy/);
});

test('with a database copy it migrates that file instead of building the archive, then starts the API', options, () => {
  const file = databaseFile();
  const result = run({ MURPHYS_DB_PATH: file });
  assert.deepEqual(result.calls, [`--prefix backend run migrate | ${file}`, `--prefix backend start | ${file}`]);
  assert.match(result.stderr, /exited before becoming healthy/);
});

test('a relative path reaches the backend as an absolute one (npm runs it from backend/)', options, () => {
  const file = databaseFile();
  const result = run({ MURPHYS_DB_PATH: path.relative(rootDirectory, file) });
  assert.equal(result.calls[0], `--prefix backend run migrate | ${file}`);
});

test('a failing migration stops the build before the API starts', options, () => {
  const result = run({ MURPHYS_DB_PATH: databaseFile() }, { migrateFails: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.calls.length, 1);
  assert.match(result.calls[0] ?? '', /run migrate/);
});

test('a blank, missing, empty or directory path stops the build and never builds the archive', options, () => {
  const directory = path.dirname(databaseFile());
  const cases: Array<[string, string]> = [
    ['blank', '   '],
    ['empty string', ''],
    ['missing file', path.join(directory, 'missing.db')],
    ['empty file', databaseFile('')],
    ['directory', directory],
  ];
  for (const [name, value] of cases) {
    const result = run({ MURPHYS_DB_PATH: value });
    assert.notEqual(result.status, 0, name);
    assert.deepEqual(result.calls, [], `${name}: no npm command may run`);
    assert.match(result.stderr, /MURPHYS_DB_PATH/, name);
  }
});

test('it refuses to run while another API already answers on port 8787', options, async () => {
  const server = createServer((_request, response) => { response.writeHead(200); response.end('ok'); });
  await new Promise<void>((resolve) => server.listen(8787, '127.0.0.1', resolve));
  try {
    const env = { ...process.env };
    delete env.MURPHYS_DB_PATH;
    // Asynchronous, so this process can still answer the script's health request.
    const child = spawn('node', [script], { cwd: rootDirectory, env });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const status = await new Promise<number | null>((resolve) => child.on('exit', resolve));
    assert.notEqual(status, 0);
    assert.match(stderr, /Port 8787 already has a healthy API/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
