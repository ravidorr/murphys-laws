import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptsDir = path.resolve(__dirname, '../../scripts');
const root = (...parts: string[]) => path.resolve(__dirname, '../../..', ...parts);

const boxes: string[] = [];
afterEach(() => {
  for (const box of boxes.splice(0)) {
    rmSync(box, { recursive: true, force: true });
  }
});

/** A copy of the script inside a fake backend whose package.json lists `dependencies`. */
function fakeBackend(dependencies: Record<string, string>): string {
  const backend = mkdtempSync(path.join(tmpdir(), 'verify-deps-'));
  boxes.push(backend);
  mkdirSync(path.join(backend, 'scripts'));
  copyFileSync(path.join(scriptsDir, 'verify-installed-dependencies.mjs'), path.join(backend, 'scripts/verify-installed-dependencies.mjs'));
  writeFileSync(path.join(backend, 'package.json'), JSON.stringify({ name: 'fake', dependencies }));
  return backend;
}

/** Installs a package into the fake backend's node_modules from a map of file name to contents. */
function install(backend: string, name: string, files: Record<string, string>): void {
  const dir = path.join(backend, 'node_modules', name);
  mkdirSync(dir, { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), contents);
  }
}

function run(backend: string) {
  return spawnSync('node', [path.join(backend, 'scripts/verify-installed-dependencies.mjs')], { encoding: 'utf8' });
}

describe('verify-installed-dependencies.mjs', () => {
  it('passes when every runtime dependency resolves, whatever its entry point looks like', () => {
    const backend = fakeBackend({ plain: '1.0.0', 'with-main': '1.0.0', 'with-exports': '1.0.0' });
    install(backend, 'plain', { 'package.json': '{"name":"plain","version":"1.0.0"}', 'index.js': '' });
    install(backend, 'with-main', { 'package.json': '{"name":"with-main","main":"./dist/cjs/main.js"}', 'dist/cjs/main.js': '' });
    install(backend, 'with-exports', { 'package.json': '{"name":"with-exports","exports":{"import":"./esm.mjs"}}', 'esm.mjs': '' });

    const result = run(backend);

    expect(result.stdout).toContain('All 3 runtime dependencies resolve.');
    expect(result.status).toBe(0);
  });

  it('passes for a package that lists no dependencies at all', () => {
    const backend = mkdtempSync(path.join(tmpdir(), 'verify-deps-'));
    boxes.push(backend);
    mkdirSync(path.join(backend, 'scripts'));
    copyFileSync(path.join(scriptsDir, 'verify-installed-dependencies.mjs'), path.join(backend, 'scripts/verify-installed-dependencies.mjs'));
    writeFileSync(path.join(backend, 'package.json'), '{"name":"fake"}');

    const result = run(backend);

    expect(result.stdout).toContain('All 0 runtime dependencies resolve.');
    expect(result.status).toBe(0);
  });

  it('fails and names a package whose entry file is missing, as in the broken nodemailer install', () => {
    const backend = fakeBackend({ good: '1.0.0', nodemailer: '10.1.4' });
    install(backend, 'good', { 'package.json': '{"name":"good"}', 'index.js': '' });
    install(backend, 'nodemailer', { 'package.json': '{"name":"nodemailer","main":"./dist/cjs/nodemailer.js"}', 'README.md': '' });

    const result = run(backend);

    expect(result.stderr).toContain('1 installed dependency cannot be resolved:');
    expect(result.stderr).toContain('- nodemailer: ');
    expect(result.stderr).not.toContain('- good: ');
    expect(result.status).toBe(1);
  });

  it('fails when the entry file named by an exports map is missing, using the package.json of the real nodemailer', () => {
    const backend = fakeBackend({ nodemailer: '10.2.1' });
    const nodemailer = path.resolve(__dirname, '../../../node_modules/nodemailer/package.json');
    const manifest = existsSync(nodemailer) ? readFileSync(nodemailer, 'utf8') : readFileSync(path.resolve(__dirname, '../../node_modules/nodemailer/package.json'), 'utf8');
    install(backend, 'nodemailer', { 'package.json': manifest });

    const result = run(backend);

    expect(JSON.parse(manifest).exports['.']).toHaveProperty('import');
    expect(result.stderr).toContain('- nodemailer: resolves to ');
    expect(result.stderr).toContain('which does not exist');
    expect(result.status).toBe(1);
  });

  it('fails for an exports map whose target file is missing, and passes once the file exists', () => {
    const backend = fakeBackend({ mapped: '1.0.0' });
    install(backend, 'mapped', { 'package.json': '{"name":"mapped","exports":{".":{"import":"./dist/esm/main.js"}}}' });

    expect(run(backend).status).toBe(1);

    install(backend, 'mapped', { 'dist/esm/main.js': '' });

    expect(run(backend).status).toBe(0);
  });

  it('fails and names every package that is missing from node_modules', () => {
    const backend = fakeBackend({ 'absent-one': '1.0.0', 'absent-two': '1.0.0' });

    const result = run(backend);

    expect(result.stderr).toContain('2 installed dependencies cannot be resolved:');
    expect(result.stderr).toContain('- absent-one: ');
    expect(result.stderr).toContain('- absent-two: ');
    expect(result.status).toBe(1);
  });

  it('passes against the real backend install', () => {
    const result = spawnSync('node', [path.join(scriptsDir, 'verify-installed-dependencies.mjs')], { encoding: 'utf8' });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});

describe('verify-installed-dependencies wiring', () => {
  // A line that is not there fails here, instead of passing an ordering check as -1
  const lineOf = (text: string, needle: string) => {
    const index = text.split('\n').findIndex((line) => line.includes(needle));
    expect(index, `"${needle}" is present`).toBeGreaterThan(-1);
    return index;
  };

  it('npm run deploy verifies the install after npm ci and before migrations and the restart', () => {
    const text = readFileSync(path.join(scriptsDir, 'deploy.ts'), 'utf8');
    const verify = lineOf(text, 'node scripts/verify-installed-dependencies.mjs');

    expect(verify).toBeGreaterThan(lineOf(text, 'npm ci'));
    expect(verify).toBeLessThan(lineOf(text, 'npm run migrate'));
    expect(verify).toBeLessThan(lineOf(text, 'pm2 restart'));
  });

  it('the workflow verifies the install after npm ci and before migrations and the restart', () => {
    const text = readFileSync(root('.github/workflows/deploy.yml'), 'utf8');
    const verify = lineOf(text, 'node scripts/verify-installed-dependencies.mjs');

    expect(verify).toBeGreaterThan(lineOf(text, 'if npm ci; then'));
    expect(verify).toBeLessThan(lineOf(text, 'npm run migrate'));
    expect(verify).toBeLessThan(lineOf(text, 'pm2 start ecosystem.config.cjs'));
  });

  it('is not hidden behind an ignored failure in either deploy path', () => {
    for (const file of [path.join(scriptsDir, 'deploy.ts'), root('.github/workflows/deploy.yml')]) {
      const line = readFileSync(file, 'utf8').split('\n').find((candidate) => candidate.includes('node scripts/verify-installed-dependencies.mjs'));

      expect(line, file).toBeDefined();
      expect(line).not.toContain('|| true');
      expect(line).not.toContain('2>/dev/null');
    }
  });
});
