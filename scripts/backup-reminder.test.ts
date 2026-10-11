import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const dailyReport = readFileSync(
  path.join(rootDirectory, 'backend/scripts/daily-report.sh'),
  'utf8',
);
const backupRestoreTest = readFileSync(
  path.join(rootDirectory, 'backend/scripts/test-backup-restore.sh'),
  'utf8',
);
const deployScript = readFileSync(
  path.join(rootDirectory, 'backend/scripts/deploy.ts'),
  'utf8',
);

test('monthly backup reminder targets the main droplet only', () => {
  const reminder = dailyReport.slice(
    dailyReport.indexOf('# MONTHLY BACKUP TEST REMINDER'),
    dailyReport.indexOf('# SAVE AND SEND REPORT'),
  );

  assert.match(reminder, /MAIN DROPLET \(murphys-laws\.com\):/);
  assert.match(reminder, /ssh murphys-main/);
  assert.match(reminder, /All tests should pass \(20\/20 for the main droplet\)/);
  assert.doesNotMatch(reminder, /n8n|45\.55\.74\.28/i);
});

test('backup restore test does not require an application archive', () => {
  assert.doesNotMatch(backupRestoreTest, /murphys_app_\*\.tar\.gz/);
  assert.doesNotMatch(backupRestoreTest, /Testing application archive extraction/);
});

test('deployment installs the backup restore checker', () => {
  assert.match(
    deployScript,
    /sudo cp .*test-backup-restore\.sh \/usr\/local\/bin\/test-backup-restore\.sh/,
  );
});

test('deployment installs operational monitoring scripts', () => {
  assert.match(
    deployScript,
    /performance-tracker\.sh \/usr\/local\/bin\/performance-tracker\.sh/,
  );
  assert.match(
    deployScript,
    /cost-optimization-report\.sh \/usr\/local\/bin\/cost-optimization-report\.sh/,
  );
});
