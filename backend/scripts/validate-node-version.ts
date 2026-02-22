#!/usr/bin/env node
/**
 * Node.js Version Validation Script
 *
 * Validates that the Node.js version on the server matches expectations
 * and that native modules are compiled for the correct version.
 *
 * Usage:
 *   tsx backend/scripts/validate-node-version.ts
 *   npm run validate:node (from backend)
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors: Record<string, string> = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function log(msg: string, color: string = 'reset'): void {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function getExpectedNodeVersion(): string {
  const packageJsonPath = resolve(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { engines: { node: string } };
  return packageJson.engines.node;
}

function getCurrentNodeVersion(): string {
  return process.version;
}

function getBetterSqliteModuleVersion(): string | null {
  const modulePath = resolve(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');

  if (!existsSync(modulePath)) {
    return null;
  }

  try {
    const output = execSync(`file "${modulePath}"`, { encoding: 'utf-8' });
    return output;
  } catch {
    return null;
  }
}

function validateOnServer(host: string): void {
  log('\n=== Validating Node.js on Production Server ===\n', 'blue');

  try {
    const systemNode = execSync(`ssh ${host} "/usr/bin/node --version"`, { encoding: 'utf-8' }).trim();
    log(`System Node.js (/usr/bin/node): ${systemNode}`, 'blue');

    const nvmNode = execSync(`ssh ${host} "bash -c 'source ~/.nvm/nvm.sh && node --version'"`, { encoding: 'utf-8' }).trim();
    log(`NVM Node.js: ${nvmNode}`, 'blue');

    const pm2Info = execSync(`ssh ${host} "pm2 jlist"`, { encoding: 'utf-8' });
    const processes = JSON.parse(pm2Info) as Array<{ name: string; pid: number; pm2_env: { exec_interpreter: string } }>;
    const apiProcess = processes.find((p) => p.name === 'murphys-api');

    if (apiProcess) {
      log(`\nPM2 Process 'murphys-api':`, 'blue');
      log(`  PID: ${apiProcess.pid}`, 'reset');
      log(`  Interpreter: ${apiProcess.pm2_env.exec_interpreter}`, 'reset');

      const procNode = execSync(`ssh ${host} "readlink -f /proc/${apiProcess.pid}/exe"`, { encoding: 'utf-8' }).trim();
      const actualVersion = execSync(`ssh ${host} "${procNode} --version"`, { encoding: 'utf-8' }).trim();
      log(`  Actual Node: ${procNode} (${actualVersion})`, 'reset');

      if (systemNode !== nvmNode) {
        log('\nWARNING: System Node and NVM Node versions differ!', 'yellow');
        log(`   System: ${systemNode}`, 'yellow');
        log(`   NVM:    ${nvmNode}`, 'yellow');
        log('\n   Recommendation: System Node should be a symlink to NVM Node', 'yellow');
      }

      if (actualVersion !== nvmNode) {
        log('\nERROR: PM2 is using wrong Node.js version!', 'red');
        log(`   Expected: ${nvmNode}`, 'red');
        log(`   Actual:   ${actualVersion}`, 'red');
        log('\n   Fix: sudo ln -sf ~/.nvm/versions/node/vX.X.X/bin/node /usr/bin/node', 'red');
        process.exit(1);
      }

      log('\nNode.js versions are correctly configured', 'green');
    } else {
      log('\nWARNING: murphys-api process not found in PM2', 'yellow');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\nERROR: Failed to validate server: ${message}`, 'red');
    process.exit(1);
  }
}

function validateLocally(): void {
  log('\n=== Local Node.js Version Check ===\n', 'blue');

  const expected = getExpectedNodeVersion();
  const current = getCurrentNodeVersion();
  const currentMajor = current.split('.')[0] ?? '';
  const expectedMajor = expected.replace('>=', '').split('.')[0] ?? '';

  log(`Expected: ${expected}`, 'blue');
  log(`Current:  ${current}`, 'blue');

  if (currentMajor.replace('v', '') < expectedMajor) {
    log(`\nERROR: Node.js version ${current} does not meet requirement ${expected}`, 'red');
    process.exit(1);
  }

  log('\nLocal Node.js version is compatible', 'green');

  const moduleInfo = getBetterSqliteModuleVersion();
  if (moduleInfo) {
    log(`\nbetter-sqlite3 module status: Compiled`, 'green');
  } else {
    log(`\nWARNING: better-sqlite3 not compiled. Run: npm rebuild better-sqlite3`, 'yellow');
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const host = process.env.DROPLET_HOST ?? 'ravidor@167.99.53.90';

  if (args.includes('--server')) {
    validateOnServer(host);
  } else if (args.includes('--all')) {
    validateLocally();
    validateOnServer(host);
  } else {
    validateLocally();
  }
}

main();
