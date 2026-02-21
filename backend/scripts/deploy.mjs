#!/usr/bin/env node
/**
 * Safe deployment script for Murphy's Laws
 *
 * This script:
 * 1. Builds the web project locally
 * 2. Syncs web dist and backend source/runtime files to the server
 * 3. Restarts PM2 services safely
 *
 * Usage: npm run deploy
 */

import { execSync } from 'node:child_process';

const DROPLET_HOST = 'ravidor@167.99.53.90';
const DROPLET_PATH = '/root/murphys-laws';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function exec(cmd, description) {
  log(`\n${description}...`, 'blue');
  try {
    execSync(cmd, { stdio: 'inherit' });
    log(`${description} complete`, 'green');
  } catch (error) {
    log(`${description} failed`, 'red');
    throw error;
  }
}

async function deploy() {
  log('\nStarting deployment to production droplet\n', 'blue');

  // Step 1: Build locally (from root of monorepo)
  exec('cd .. && npm run build', 'Building project locally');

  // Step 2: Sync web/dist/ folder to droplet
  log('\nSyncing web/dist/ folder to droplet...', 'blue');
  exec(
    `rsync -avz --delete ../web/dist/ ${DROPLET_HOST}:${DROPLET_PATH}/web/dist/`,
    'Syncing web dist folder'
  );

  // Step 3: Sync backend runtime artifacts
  log('\nSyncing backend runtime artifacts...', 'blue');
  exec(
    `rsync -avz --delete src/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/src/`,
    'Syncing backend src'
  );
  exec(
    `rsync -avz --delete scripts/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/scripts/`,
    'Syncing backend scripts'
  );
  exec(
    `rsync -avz --delete db/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/db/`,
    'Syncing backend db'
  );
  exec(
    `rsync -avz --delete config/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/config/`,
    'Syncing backend config'
  );
  exec(
    `rsync -avz --delete ../shared/modules/ ${DROPLET_HOST}:${DROPLET_PATH}/shared/modules/`,
    'Syncing shared modules'
  );
  exec(
    `rsync -avz ecosystem.config.cjs ${DROPLET_HOST}:${DROPLET_PATH}/backend/`,
    'Syncing PM2 config'
  );
  exec(
    `rsync -avz package.json package-lock.json ${DROPLET_HOST}:${DROPLET_PATH}/backend/`,
    'Syncing backend package files'
  );

  // Step 3.5: Sync web config
  exec(
    `rsync -avz ../web/vite.config.js ${DROPLET_HOST}:${DROPLET_PATH}/web/`,
    'Syncing web vite config'
  );

  // Step 3.6: Sync nginx config
  exec(
    `rsync -avz ../nginx.conf ${DROPLET_HOST}:${DROPLET_PATH}/`,
    'Syncing nginx config'
  );

  // Step 3.7: Update nginx configuration on server
  log('\nUpdating nginx configuration...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/nginx.conf /etc/nginx/sites-available/murphys-laws && sudo nginx -t && sudo systemctl reload nginx"`,
    'Updating and reloading nginx'
  );

  // Step 3.8: Update server maintenance scripts in /usr/local/bin/
  log('\nUpdating server maintenance scripts...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/daily-report.sh /usr/local/bin/daily-report.sh 2>/dev/null && sudo chmod +x /usr/local/bin/daily-report.sh || true"`,
    'Updating daily report script'
  );
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/backend/scripts/backup-murphys.sh /usr/local/bin/backup-murphys.sh 2>/dev/null && sudo chmod +x /usr/local/bin/backup-murphys.sh || true"`,
    'Updating backup script'
  );

  // Step 4: Validate Node.js version on server
  log('\nValidating Node.js version on server...', 'blue');
  exec(
    `node scripts/validate-node-version.mjs --server`,
    'Validating Node.js version'
  );

  // Step 5: Install dependencies and rebuild native modules
  log('\nInstalling dependencies and rebuilding native modules...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'cd ${DROPLET_PATH}/backend && source ~/.nvm/nvm.sh && npm ci && npm rebuild better-sqlite3'"`,
    'Installing dependencies and rebuilding native modules'
  );

  // Step 6: Restart PM2 services
  log('\nRestarting PM2 services...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'source ~/.nvm/nvm.sh && cd ${DROPLET_PATH}/backend && pm2 restart ecosystem.config.cjs'"`,
    'Restarting PM2 services'
  );

  // Step 7: Check status
  log('\nChecking service status...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'source ~/.nvm/nvm.sh && pm2 list'"`,
    'Service status check'
  );

  // Step 8: Final validation - verify Node.js configuration after deployment
  log('\nRunning post-deployment validation...', 'blue');
  exec(
    `node scripts/validate-node-version.mjs --server`,
    'Post-deployment validation'
  );

  log('\nDeployment complete!\n', 'green');
  log(`Visit: https://murphys-laws.com\n`, 'blue');
}

// Run deployment
deploy().catch((error) => {
  log('\nDeployment failed!', 'red');
  console.error(error);
  process.exit(1);
});
