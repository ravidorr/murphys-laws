#!/usr/bin/env node
/**
 * Safe deployment script for Murphy's Laws
 *
 * This script:
 * 1. Builds the web project locally
 * 2. Syncs web dist and backend source/runtime files to the server
 * 3. Restarts PM2 services safely
 *
 * Usage: npm run deploy (from repo root)
 */

import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(BACKEND_ROOT, '..');

const DROPLET_HOST = 'ravidor@167.99.53.90';
const DROPLET_PATH = '/root/murphys-laws';

const colors: Record<string, string> = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(msg: string, color: string = 'reset'): void {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function exec(cmd: string, description: string): void {
  log(`\n${description}...`, 'blue');
  try {
    execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT });
    log(`${description} complete`, 'green');
  } catch (error) {
    log(`${description} failed`, 'red');
    throw error;
  }
}

async function deploy(): Promise<void> {
  log('\nStarting deployment to production droplet\n', 'blue');

  exec('npm run build', 'Building project locally');

  log('\nSyncing web/dist/ folder to droplet...', 'blue');
  exec(
    `rsync -avz --delete web/dist/ ${DROPLET_HOST}:${DROPLET_PATH}/web/dist/`,
    'Syncing web dist folder'
  );

  log('\nSyncing backend runtime artifacts...', 'blue');
  exec(
    `rsync -avz --delete backend/src/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/src/`,
    'Syncing backend src'
  );
  exec(
    `rsync -avz --delete backend/scripts/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/scripts/`,
    'Syncing backend scripts'
  );
  exec(
    `rsync -avz --delete backend/db/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/db/`,
    'Syncing backend db'
  );
  exec(
    `rsync -avz --delete backend/config/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/config/`,
    'Syncing backend config'
  );
  exec(
    `rsync -avz --delete shared/modules/ ${DROPLET_HOST}:${DROPLET_PATH}/shared/modules/`,
    'Syncing shared modules'
  );
  exec(
    `rsync -avz backend/ecosystem.config.cjs ${DROPLET_HOST}:${DROPLET_PATH}/backend/`,
    'Syncing PM2 config'
  );
  exec(
    `rsync -avz backend/package.json backend/package-lock.json ${DROPLET_HOST}:${DROPLET_PATH}/backend/`,
    'Syncing backend package files'
  );

  exec(
    `rsync -avz web/vite.config.ts ${DROPLET_HOST}:${DROPLET_PATH}/web/`,
    'Syncing web vite config'
  );

  exec(
    `rsync -avz nginx.conf ${DROPLET_HOST}:${DROPLET_PATH}/`,
    'Syncing nginx config'
  );

  log('\nUpdating nginx configuration...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/nginx.conf /etc/nginx/sites-available/murphys-laws && sudo nginx -t && sudo systemctl reload nginx"`,
    'Updating and reloading nginx'
  );

  log('\nUpdating server maintenance scripts...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/daily-report.sh /usr/local/bin/daily-report.sh 2>/dev/null && sudo chmod +x /usr/local/bin/daily-report.sh || true"`,
    'Updating daily report script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/backup-murphys.sh /usr/local/bin/backup-murphys.sh 2>/dev/null && sudo chmod +x /usr/local/bin/backup-murphys.sh || true"`,
    'Updating backup script'
  );

  log('\nValidating Node.js version on server...', 'blue');
  execSync(`tsx backend/scripts/validate-node-version.ts --server`, {
    stdio: 'inherit',
    cwd: REPO_ROOT
  });
  log('Validating Node.js version complete', 'green');

  log('\nInstalling dependencies and rebuilding native modules...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'cd ${DROPLET_PATH}/backend && source ~/.nvm/nvm.sh && npm ci && npm rebuild better-sqlite3'"`,
    'Installing dependencies and rebuilding native modules'
  );

  log('\nRestarting PM2 services...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'source ~/.nvm/nvm.sh && cd ${DROPLET_PATH}/backend && pm2 restart ecosystem.config.cjs'"`,
    'Restarting PM2 services'
  );

  log('\nChecking service status...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 list'"`,
    'Service status check'
  );

  log('\nRunning post-deployment validation...', 'blue');
  execSync(`tsx backend/scripts/validate-node-version.ts --server`, {
    stdio: 'inherit',
    cwd: REPO_ROOT
  });
  log('Post-deployment validation complete', 'green');

  log('\nDeployment complete!\n', 'green');
  log(`Visit: https://murphys-laws.com\n`, 'blue');
}

deploy().catch((error) => {
  log('\nDeployment failed!', 'red');
  console.error(error);
  process.exit(1);
});
