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
import { existsSync } from 'node:fs';
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

// Installed on the server without ignoring errors, because they load the shared alert helper.
const STRICT_MONITORING_SCRIPTS = [
  'alert-email.sh',
  'backup-murphys.sh',
  'backup-offsite.sh',
  'health-monitor.sh',
  'ssl-monitor.sh',
  'cost-optimization-report.sh',
  'test-backup-restore.sh',
];

async function deploy(): Promise<void> {
  log('\nStarting deployment to production droplet\n', 'blue');

  // Check before the first sync, so a missing file cannot leave a half-applied release.
  for (const script of STRICT_MONITORING_SCRIPTS) {
    if (!existsSync(resolve(BACKEND_ROOT, 'scripts', script))) {
      throw new Error(`backend/scripts/${script} is missing; nothing was changed on the server`);
    }
  }

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
    `ssh ${DROPLET_HOST} "sudo install -d -m 755 /etc/murphys-laws && if [ -f ${DROPLET_PATH}/backend/config/infrastructure-inventory.json ] && [ ! -f /etc/murphys-laws/infrastructure-inventory.json ]; then sudo cp ${DROPLET_PATH}/backend/config/infrastructure-inventory.json /etc/murphys-laws/infrastructure-inventory.json && sudo chmod 644 /etc/murphys-laws/infrastructure-inventory.json; fi"`,
    'Migrating infrastructure inventory out of synced backend/config'
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
  // Sourced by the monitoring scripts below to resolve the alert address. They fall back to the repo
  // copy, but the installed one is preferred, so a failed copy here (or of the scripts that load it, which
  // would leave an old version running) must stop the deploy instead of being ignored; the other copies
  // (backup, daily report, performance tracker, ...) keep ignoring errors
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/alert-email.sh /usr/local/bin/alert-email.sh && sudo chmod +x /usr/local/bin/alert-email.sh"`,
    'Updating alert email helper'
  );
  // Sourced by the backup and the backup restore test for the encrypted off-site copy
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/backup-offsite.sh /usr/local/bin/backup-offsite.sh && sudo chmod +x /usr/local/bin/backup-offsite.sh"`,
    'Updating off-site backup helper'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/health-monitor.sh /usr/local/bin/health-monitor.sh && sudo chmod +x /usr/local/bin/health-monitor.sh"`,
    'Updating health monitor script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/ssl-monitor.sh /usr/local/bin/ssl-monitor.sh && sudo chmod +x /usr/local/bin/ssl-monitor.sh"`,
    'Updating SSL monitor script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/daily-report.sh /usr/local/bin/daily-report.sh 2>/dev/null && sudo chmod +x /usr/local/bin/daily-report.sh || true"`,
    'Updating daily report script'
  );
  // Strict like the helper it sources: a failed copy would leave cron running an old backup that never
  // makes the off-site copy
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/backup-murphys.sh /usr/local/bin/backup-murphys.sh && sudo chmod +x /usr/local/bin/backup-murphys.sh"`,
    'Updating backup script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/test-backup-restore.sh /usr/local/bin/test-backup-restore.sh && sudo chmod +x /usr/local/bin/test-backup-restore.sh"`,
    'Updating backup restore test script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/performance-tracker.sh /usr/local/bin/performance-tracker.sh 2>/dev/null && sudo chmod +x /usr/local/bin/performance-tracker.sh || true"`,
    'Updating performance tracker script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/cost-optimization-report.sh /usr/local/bin/cost-optimization-report.sh && sudo chmod +x /usr/local/bin/cost-optimization-report.sh"`,
    'Updating cost optimization report script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/analyze-resource-peaks.sh /usr/local/bin/analyze-resource-peaks.sh 2>/dev/null && sudo chmod +x /usr/local/bin/analyze-resource-peaks.sh || true"`,
    'Updating resource peaks analyzer'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/log-analyzer.sh /usr/local/bin/log-analyzer.sh 2>/dev/null && sudo chmod +x /usr/local/bin/log-analyzer.sh || true"`,
    'Updating log analyzer script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/vulnerability-scanner.sh /usr/local/bin/vulnerability-scanner.sh 2>/dev/null && sudo chmod +x /usr/local/bin/vulnerability-scanner.sh || true"`,
    'Updating vulnerability scanner script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo mkdir -p /etc/murphys-laws && sudo cp ${DROPLET_PATH}/backend/config/operational-metrics-main-app.env.example /etc/murphys-laws/operational-metrics.env.example 2>/dev/null || true && sudo cp ${DROPLET_PATH}/backend/config/infrastructure-inventory.json.example /etc/murphys-laws/infrastructure-inventory.json.example 2>/dev/null || true"`,
    'Publishing operational metrics and inventory examples under /etc/murphys-laws'
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
