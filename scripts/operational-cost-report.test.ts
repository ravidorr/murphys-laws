import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const costReport = readFileSync(
  path.join(rootDirectory, 'backend/scripts/cost-optimization-report.sh'),
  'utf8',
);
const performanceTracker = readFileSync(
  path.join(rootDirectory, 'backend/scripts/performance-tracker.sh'),
  'utf8',
);
const backupScript = readFileSync(
  path.join(rootDirectory, 'backend/scripts/backup-murphys.sh'),
  'utf8',
);
const dailyReport = readFileSync(
  path.join(rootDirectory, 'backend/scripts/daily-report.sh'),
  'utf8',
);
const peakAnalyzer = readFileSync(
  path.join(rootDirectory, 'backend/scripts/analyze-resource-peaks.sh'),
  'utf8',
);

const shellScripts = [
  'backend/scripts/performance-tracker.sh',
  'backend/scripts/cost-optimization-report.sh',
  'backend/scripts/analyze-resource-peaks.sh',
  'backend/scripts/backup-murphys.sh',
  'backend/scripts/daily-report.sh',
];

for (const relativePath of shellScripts) {
  test(`shell syntax valid: ${relativePath}`, () => {
    execSync(`bash -n ${JSON.stringify(path.join(rootDirectory, relativePath))}`, {
      stdio: 'pipe',
    });
  });
}

test('cost report does not recommend automatic consolidation or downsizing', () => {
  assert.doesNotMatch(costReport, /RECOMMENDATION #2: Consolidate Droplets/);
  assert.doesNotMatch(costReport, /Suggested: 512MB RAM droplets/);
  assert.match(costReport, /n8n automation retired/);
  assert.match(costReport, /512MB plans remain blocked/);
  assert.match(
    costReport,
    /CAPACITY_ANALYZER="\$\{CAPACITY_ANALYZER:-\$REPO_ROOT\/backend\/scripts\/analyze-capacity-metrics\.ts\}"/,
  );
  assert.match(costReport, /run_capacity_analysis main-app/);
  assert.doesNotMatch(costReport, /run_capacity_analysis n8n/);
  assert.match(costReport, /node_modules\/\.bin\/tsx/);
  assert.match(costReport, /cd "\$REPO_ROOT"/);
  assert.match(
    costReport,
    /UNVERIFIED — confirm costs against each provider listed in the inventory/,
  );
  assert.match(
    costReport,
    /INVENTORY_FILE="\$\{INVENTORY_FILE:-\/etc\/murphys-laws\/infrastructure-inventory\.json\}"/,
  );
});

test('performance tracker uses role-aware metrics file and header', () => {
  assert.match(performanceTracker, /metrics-\$\{METRICS_ROLE\}/);
  assert.match(performanceTracker, /memory_pressure_percent/);
  assert.match(performanceTracker, /pm2_api_rss_mb/);
  assert.doesNotMatch(performanceTracker, /murphys-frontend/);
  assert.match(performanceTracker, /\/\^pswpin /);
  assert.doesNotMatch(performanceTracker, /pgpgin/);
  assert.match(performanceTracker, /max_memory_restart/);
  assert.match(performanceTracker, /parse_pm2_memory_limit_mb/);
  assert.match(performanceTracker, /if \[ -n "\$API_URL" \]/);
  assert.doesNotMatch(
    performanceTracker,
    /if \[ "\$METRICS_ROLE" = "main-app" \] && \[ -n "\$API_URL" \]/,
  );
  assert.match(performanceTracker, /scale=4; \(1 - \$MEMORY_AVAILABLE/);
  assert.match(performanceTracker, /METRICS_ROLE" = "main-app" \]; then/);
  assert.doesNotMatch(performanceTracker, /^API_URL="\$\{API_URL:-/m);
});

test('daily report passes one combined awk program for metrics aggregates', () => {
  assert.match(dailyReport, /\$\{METRICS_AWK\} NR>1/);
  assert.doesNotMatch(
    dailyReport,
    /awk -F',' "\$METRICS_AWK" 'NR>1/,
  );
});

test('peak analyzer includes legacy metrics files only for main-app role', () => {
  assert.match(peakAnalyzer, /METRICS_ROLE" = "main-app"/);
  assert.match(peakAnalyzer, /PATTERNS\+=\("metrics-\$\{CURRENT_MONTH\}\.csv"/);
});

test('backup script verifies integrity before success', () => {
  assert.match(backupScript, /PRAGMA integrity_check/);
  assert.match(backupScript, /set -euo pipefail/);
  assert.match(backupScript, /Off-site copy: not configured/);
});
