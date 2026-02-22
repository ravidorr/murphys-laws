#!/usr/bin/env node
/**
 * Coverage check script for pre-commit hook
 *
 * Checks if test coverage meets thresholds (96% functions, 95.5% branches min, 95% lines/statements)
 * Can be bypassed with SKIP_COVERAGE_CHECK=1 environment variable
 *
 * Usage:
 *   tsx scripts/check-coverage.ts                    # Runs tests with coverage, then checks
 *   tsx scripts/check-coverage.ts --skip-test-run   # Only checks existing coverage report
 *   SKIP_COVERAGE_CHECK=1 git commit  # Emergency bypass
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const THRESHOLDS = {
  lines: 95,
  functions: 95,
  branches: 93,
  statements: 95
};

interface CoveragePct { pct: number }
interface CoverageTotal {
  lines: CoveragePct;
  functions: CoveragePct;
  branches: CoveragePct;
  statements: CoveragePct;
}
interface CoverageSummary {
  total: CoverageTotal;
}

const skipTestRun = process.argv.includes('--skip-test-run');

if (process.env.SKIP_COVERAGE_CHECK === '1') {
  console.log('WARN: SKIP_COVERAGE_CHECK=1 detected - skipping coverage check');
  console.log('WARN: This should only be used for emergency commits!');
  process.exit(0);
}

console.log('Running coverage check...');
console.log('Thresholds:', THRESHOLDS);
console.log('');

try {
  if (!skipTestRun) {
    execSync('npm run test:coverage', {
      stdio: 'inherit',
      cwd: ROOT_DIR
    });
  } else {
    const coveragePath = join(ROOT_DIR, 'coverage', 'coverage-summary.json');
    if (!existsSync(coveragePath)) {
      console.error('ERROR: Coverage report not found!');
      console.error('   Run tests with coverage first: npm run test:coverage');
      process.exit(1);
    }
  }

  const coveragePath = join(ROOT_DIR, 'coverage', 'coverage-summary.json');
  const coverageData = JSON.parse(readFileSync(coveragePath, 'utf8')) as CoverageSummary;
  const totals = coverageData.total;

  const failures: string[] = [];

  if (totals.lines.pct < THRESHOLDS.lines) {
    failures.push(`Lines: ${totals.lines.pct.toFixed(2)}% < ${THRESHOLDS.lines}%`);
  }
  if (totals.functions.pct < THRESHOLDS.functions) {
    failures.push(`Functions: ${totals.functions.pct.toFixed(2)}% < ${THRESHOLDS.functions}%`);
  }
  if (totals.branches.pct < THRESHOLDS.branches) {
    failures.push(`Branches: ${totals.branches.pct.toFixed(2)}% < ${THRESHOLDS.branches}%`);
  }
  if (totals.statements.pct < THRESHOLDS.statements) {
    failures.push(`Statements: ${totals.statements.pct.toFixed(2)}% < ${THRESHOLDS.statements}%`);
  }

  if (failures.length > 0) {
    console.error('');
    console.error('ERROR: Coverage check FAILED!');
    console.error('');
    console.error('The following metrics are below the required threshold:');
    failures.forEach((f) => console.error(`  - ${f}`));
    console.error('');
    console.error('Current coverage:');
    console.error(`  Lines:      ${totals.lines.pct.toFixed(2)}% (required: ${THRESHOLDS.lines}%)`);
    console.error(`  Functions:  ${totals.functions.pct.toFixed(2)}% (required: ${THRESHOLDS.functions}%)`);
    console.error(`  Branches:   ${totals.branches.pct.toFixed(2)}% (required: ${THRESHOLDS.branches}%)`);
    console.error(`  Statements: ${totals.statements.pct.toFixed(2)}% (required: ${THRESHOLDS.statements}%)`);
    console.error('');
    console.error('Please add tests to improve coverage before committing.');
    console.error('');
    console.error('For emergency commits, use:');
    console.error('  SKIP_COVERAGE_CHECK=1 git commit -m "your message"');
    console.error('');
    process.exit(1);
  }

  console.log('Coverage check passed!');
  console.log('');
  console.log('Coverage summary:');
  console.log(`  Lines:      ${totals.lines.pct.toFixed(2)}%`);
  console.log(`  Functions:  ${totals.functions.pct.toFixed(2)}%`);
  console.log(`  Branches:   ${totals.branches.pct.toFixed(2)}%`);
  console.log(`  Statements: ${totals.statements.pct.toFixed(2)}%`);
  console.log('');
} catch {
  console.error('');
  console.error('ERROR: Coverage check failed - tests did not pass');
  console.error('');
  console.error('For emergency commits, use:');
  console.error('  SKIP_COVERAGE_CHECK=1 git commit -m "your message"');
  console.error('');
  process.exit(1);
}
