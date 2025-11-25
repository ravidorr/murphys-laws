#!/usr/bin/env node
/**
 * Node.js Version Validation Script
 *
 * Validates that the Node.js version on the server matches expectations
 * and that native modules are compiled for the correct version.
 *
 * This prevents the 502 error caused by Node.js version mismatches
 * between PM2's interpreter and compiled native modules.
 *
 * Usage:
 *   node backend/scripts/validate-node-version.mjs
 *   npm run validate:node-version (from backend)
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function getExpectedNodeVersion() {
  const packageJsonPath = resolve(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.engines.node;
}

function getCurrentNodeVersion() {
  return process.version;
}

function getBetterSqliteModuleVersion() {
  const modulePath = resolve(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');

  if (!existsSync(modulePath)) {
    return null;
  }

  try {
    // Use 'file' command to check the module
    const output = execSync(`file "${modulePath}"`, { encoding: 'utf-8' });
    return output;
  } catch (error) {
    return null;
  }
}

function getNodeModuleVersion(nodeVersion) {
  // Mapping of Node.js versions to NODE_MODULE_VERSION
  // https://nodejs.org/api/process.html#processversions
  const versionMap = {
    '18': 108,
    '20': 115,
    '22': 127
  };

  const major = nodeVersion.split('.')[0].replace('v', '');
  return versionMap[major] || 'unknown';
}

function validateOnServer(host) {
  log('\n=== Validating Node.js on Production Server ===\n', 'blue');

  try {
    // Check system node version
    const systemNode = execSync(`ssh ${host} "/usr/bin/node --version"`, { encoding: 'utf-8' }).trim();
    log(`System Node.js (/usr/bin/node): ${systemNode}`, 'blue');

    // Check NVM node version
    const nvmNode = execSync(`ssh ${host} "bash -c 'source ~/.nvm/nvm.sh && node --version'"`, { encoding: 'utf-8' }).trim();
    log(`NVM Node.js: ${nvmNode}`, 'blue');

    // Check PM2 interpreter
    const pm2Info = execSync(`ssh ${host} "pm2 jlist"`, { encoding: 'utf-8' });
    const processes = JSON.parse(pm2Info);
    const apiProcess = processes.find(p => p.name === 'murphys-api');

    if (apiProcess) {
      log(`\nPM2 Process 'murphys-api':`, 'blue');
      log(`  PID: ${apiProcess.pid}`, 'reset');
      log(`  Interpreter: ${apiProcess.pm2_env.exec_interpreter}`, 'reset');

      // Check what node version the process is actually using
      const procNode = execSync(`ssh ${host} "readlink -f /proc/${apiProcess.pid}/exe"`, { encoding: 'utf-8' }).trim();
      const actualVersion = execSync(`ssh ${host} "${procNode} --version"`, { encoding: 'utf-8' }).trim();
      log(`  Actual Node: ${procNode} (${actualVersion})`, 'reset');

      // Validate
      if (systemNode !== nvmNode) {
        log('\n⚠️  WARNING: System Node and NVM Node versions differ!', 'yellow');
        log(`   System: ${systemNode}`, 'yellow');
        log(`   NVM:    ${nvmNode}`, 'yellow');
        log('\n   Recommendation: System Node should be a symlink to NVM Node', 'yellow');
      }

      if (actualVersion !== nvmNode) {
        log('\n❌ ERROR: PM2 is using wrong Node.js version!', 'red');
        log(`   Expected: ${nvmNode}`, 'red');
        log(`   Actual:   ${actualVersion}`, 'red');
        log('\n   Fix: sudo ln -sf ~/.nvm/versions/node/vX.X.X/bin/node /usr/bin/node', 'red');
        process.exit(1);
      }

      log('\n✓ Node.js versions are correctly configured', 'green');
    } else {
      log('\n⚠️  WARNING: murphys-api process not found in PM2', 'yellow');
    }

  } catch (error) {
    log(`\n❌ ERROR: Failed to validate server: ${error.message}`, 'red');
    process.exit(1);
  }
}

function validateLocally() {
  log('\n=== Local Node.js Version Check ===\n', 'blue');

  const expected = getExpectedNodeVersion();
  const current = getCurrentNodeVersion();
  const currentMajor = current.split('.')[0];
  const expectedMajor = expected.replace('>=', '').split('.')[0];

  log(`Expected: ${expected}`, 'blue');
  log(`Current:  ${current}`, 'blue');

  if (currentMajor.replace('v', '') < expectedMajor) {
    log(`\n❌ ERROR: Node.js version ${current} does not meet requirement ${expected}`, 'red');
    process.exit(1);
  }

  log('\n✓ Local Node.js version is compatible', 'green');

  // Check better-sqlite3 compilation
  const moduleInfo = getBetterSqliteModuleVersion();
  if (moduleInfo) {
    log(`\nbetter-sqlite3 module status: Compiled`, 'green');
  } else {
    log(`\n⚠️  WARNING: better-sqlite3 not compiled. Run: npm rebuild better-sqlite3`, 'yellow');
  }
}

function main() {
  const args = process.argv.slice(2);
  const host = process.env.DROPLET_HOST || 'ravidor@167.99.53.90';

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
