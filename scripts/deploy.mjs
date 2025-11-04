#!/usr/bin/env node
/**
 * Safe deployment script for Murphy's Laws
 *
 * This script:
 * 1. Builds the project locally
 * 2. Syncs only the dist/ folder to the server
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

  // Step 1: Build locally
  exec('npm run build', 'Building project locally');

  // Step 2: Sync dist/ folder to droplet
  log('\nSyncing dist/ folder to droplet...', 'blue');
  exec(
    `rsync -avz --delete dist/ ${DROPLET_HOST}:${DROPLET_PATH}/dist/`,
    'Syncing dist folder'
  );

  // Step 3: Sync scripts/ and ecosystem config (in case they changed)
  log('\n Syncing scripts and config...', 'blue');
  exec(
    `rsync -avz scripts/ ${DROPLET_HOST}:${DROPLET_PATH}/scripts/`,
    'Syncing scripts'
  );
  exec(
    `rsync -avz ecosystem.config.cjs ${DROPLET_HOST}:${DROPLET_PATH}/`,
    'Syncing PM2 config'
  );

  // Step 3.5: Update server maintenance scripts in /usr/local/bin/
  log('\nUpdating server maintenance scripts...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo cp ${DROPLET_PATH}/scripts/daily-report.sh /usr/local/bin/daily-report.sh && sudo chmod +x /usr/local/bin/daily-report.sh"`,
    'Updating daily report script'
  );

  // Step 4: Restart PM2 services
  log('\nRestarting services on droplet...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "cd ${DROPLET_PATH} && pm2 restart ecosystem.config.cjs"`,
    'Restarting PM2 services'
  );

  // Step 5: Check status
  log('\nChecking service status...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "pm2 list"`,
    'Service status check'
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
