#!/usr/bin/env node
/**
 * Safe deployment script for Murphy's Laws
 *
 * This script:
 * 1. Builds the web project locally
 * 2. Installs nginx.conf and has nginx test it first, restoring the previous site file and stopping when it is rejected
 * 3. Syncs web dist and backend source/runtime files to the server
 * 4. Reloads nginx, runs the migrations and restarts PM2 services safely
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

const NGINX_SITE = '/etc/nginx/sites-available/murphys-laws';
const NGINX_UPLOAD = `${DROPLET_PATH}/nginx.conf.next`;
const NGINX_PREVIOUS = `${DROPLET_PATH}/nginx.site.previous`;

// The nginx commands below run on the server, each as one command under the user's shell (no bash-only syntax, no variables,
// so nothing in them needs the local shell to be told to leave a `$` alone, and no double quote, which would end the
// argument of ssh).
//
// Puts the previous site file back (or, on a server that had none, removes the new one) and deletes the upload. It exits
// non-zero when it cannot restore, and says where the previous copy is.
const NGINX_RESTORE = [
  `if sudo test -f ${NGINX_PREVIOUS}; then`,
  `sudo cp -p ${NGINX_PREVIOUS} ${NGINX_SITE} || { echo 'ERROR: could not restore ${NGINX_SITE}; the previous copy is in ${NGINX_PREVIOUS}' >&2; exit 1; };`,
  `sudo rm -f ${NGINX_PREVIOUS};`,
  `else sudo rm -f ${NGINX_SITE}; fi;`,
  `sudo rm -f ${NGINX_UPLOAD}`,
].join(' ');

// Keeps the previous site file, puts the uploaded one in its place and tests it. When nginx rejects it, or it cannot be
// installed, the previous file goes back and the command exits non-zero, which stops the deploy before anything else is
// synced. When nginx accepts it, the previous file and the upload stay (deploy() restores the previous file if the release
// fails before nginx is reloaded, so on any failure the script can see the new file does not wait on disk for an unrelated
// reload; a killed deploy skips that, and the previous copy is then in nginx.site.previous) and nothing is reloaded.
const NGINX_INSTALL_AND_TEST = [
  `sudo rm -f ${NGINX_PREVIOUS} || exit 1;`,
  `if sudo test -f ${NGINX_SITE}; then sudo cp -p ${NGINX_SITE} ${NGINX_PREVIOUS} || exit 1; fi;`,
  `if sudo cp ${NGINX_UPLOAD} ${NGINX_SITE} && sudo nginx -t; then :; else`,
  `echo 'ERROR: nginx.conf could not be installed or nginx rejected it; restoring the previous site file, nginx is not reloaded and nothing on the server was replaced' >&2;`,
  `${NGINX_RESTORE};`,
  `exit 1;`,
  `fi`,
].join(' ');

// After nginx was reloaded with the new file: the upload becomes the repository copy, nginx.conf, like the one the other
// syncs leave there, and the backup of the previous site file is no longer needed.
const NGINX_FINISH = `sudo mv -f ${NGINX_UPLOAD} ${DROPLET_PATH}/nginx.conf && sudo rm -f ${NGINX_PREVIOUS}`;

function restoreNginxSite(): void {
  log('\nThe release failed before nginx was reloaded; putting the previous nginx site file back...', 'yellow');
  try {
    exec(`ssh ${DROPLET_HOST} "${NGINX_RESTORE}"`, 'Restoring the previous nginx site file');
  } catch (error) {
    log(
      `WARNING: the previous nginx site file was not restored (${error instanceof Error ? error.message : String(error)}); ${NGINX_SITE} holds the new, tested file and the previous copy is in ${NGINX_PREVIOUS} if it exists, so put it back before anything reloads nginx`,
      'red'
    );
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

async function syncReleaseAndReloadNginx(): Promise<void> {
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
    // The retired select-law-of-day.mjs stays on the server until the installer below has installed the new job
    `rsync -avz --delete --exclude='select-law-of-day.mjs' backend/scripts/ ${DROPLET_HOST}:${DROPLET_PATH}/backend/scripts/`,
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

  // The site file was installed and accepted by nginx -t before the first sync, so only the reload is left. It waits
  // until the new files are in place so that nginx does not serve the new configuration next to the old web build.
  log('\nReloading nginx...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo systemctl reload nginx"`,
    'Reloading nginx'
  );
}

async function deploy(): Promise<void> {
  log('\nStarting deployment to production droplet\n', 'blue');

  // Check before the first sync, so a missing file cannot leave a half-applied release.
  for (const script of STRICT_MONITORING_SCRIPTS) {
    if (!existsSync(resolve(BACKEND_ROOT, 'scripts', script))) {
      throw new Error(`backend/scripts/${script} is missing; nothing was changed on the server`);
    }
  }

  exec('npm run build', 'Building project locally');

  // A bad nginx.conf must stop the deploy before anything on the server is replaced, or the new frontend would run next
  // to the old backend until the next deploy. nginx only tests the files under /etc/nginx, so the new file goes
  // into sites-available, where nginx -t reads it, and the previous one is put back when nginx rejects it. The old
  // "cp && nginx -t && reload" left the rejected file there, and the next reload or restart of nginx failed on it.
  exec(
    `rsync -avz nginx.conf ${DROPLET_HOST}:${NGINX_UPLOAD}`,
    'Uploading nginx config'
  );
  log('\nTesting the nginx configuration...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "${NGINX_INSTALL_AND_TEST}"`,
    'Installing and testing the nginx config'
  );

  // From here to the reload the new site file is installed but not loaded: a failure in between puts the previous file back.
  try {
    await syncReleaseAndReloadNginx();
  } catch (error) {
    restoreNginxSite();
    throw error;
  }
  // Only bookkeeping is left, and nginx already runs the new file: a failure here must neither restore the previous file
  // (it would undo what nginx loaded) nor stop the deploy before the migrations and the restart.
  try {
    exec(`ssh ${DROPLET_HOST} "${NGINX_FINISH}"`, 'Keeping nginx.conf as the repository copy');
  } catch (error) {
    log(
      `WARNING: nginx.conf was not kept as the repository copy and the backup of the previous site file was not removed (${error instanceof Error ? error.message : String(error)}); nginx runs the new file, and ${NGINX_UPLOAD} and ${NGINX_PREVIOUS} may still be on the server`,
      'yellow'
    );
  }

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

  // npm ci can exit 0 and still leave a package without its entry file, which only shows up later as
  // a crashing health check; stop here, before migrations and the restart, if any dependency is unusable
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'cd ${DROPLET_PATH}/backend && source ~/.nvm/nvm.sh && node scripts/verify-installed-dependencies.mjs'"`,
    'Verifying installed dependencies resolve'
  );

  log('\nApplying database migrations...', 'blue');
  exec(
    `ssh ${DROPLET_HOST} "sudo -u root bash -c 'cd ${DROPLET_PATH}/backend && source ~/.nvm/nvm.sh && npm run migrate'"`,
    'Applying database migrations'
  );

  // The files and dependencies are in place, and the job first runs at 00:00 UTC, so this does not wait for the
  // restart. It also never writes an empty root crontab when it removes the old select-law-of-day line. Like the
  // deploy workflow, a failure is only a warning: the API picks the law on the first request of the day when the
  // job is not installed, and holding back the release for it would be worse. The job runs the node this deploy
  // runs on the server (root's nvm node, which npm ci built better-sqlite3 for), as an absolute path in the cron
  // file; not process.execPath, which is the node of this machine. The installer reads nothing from stdin.
  try {
    exec(
      String.raw`ssh ${DROPLET_HOST} "sudo -u root bash -c 'source ~/.nvm/nvm.sh && cd ${DROPLET_PATH}/backend && LAW_OF_DAY_NODE_BIN=\$(readlink -f \$(command -v node)) bash scripts/install-law-of-day-cron.sh ${DROPLET_PATH} </dev/null'"`,
      'Installing the Law of the Day schedule'
    );
  } catch (error) {
    log(
      `WARNING: the Law of the Day schedule was not installed (${error instanceof Error ? error.message : String(error)}; see the message above); nothing picks the law at midnight until a deploy installs it, so the first request of each day does, and the deployment continues`,
      'yellow'
    );
  }

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
