#!/usr/bin/env node
/**
 * Coverage check script for pre-commit hook
 * 
 * Checks if test coverage meets thresholds (90% for all metrics)
 * Can be bypassed with SKIP_COVERAGE_CHECK=1 environment variable
 * 
 * Usage:
 *   node scripts/check-coverage.mjs
 *   SKIP_COVERAGE_CHECK=1 git commit  # Emergency bypass
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Coverage thresholds (must match vite.config.js)
const THRESHOLDS = {
  lines: 90,
  functions: 90,
  branches: 90,
  statements: 90
};

// Emergency bypass
if (process.env.SKIP_COVERAGE_CHECK === '1') {
  console.log('⚠️  SKIP_COVERAGE_CHECK=1 detected - skipping coverage check');
  console.log('⚠️  This should only be used for emergency commits!');
  process.exit(0);
}

console.log('Running coverage check...');
console.log('Thresholds:', THRESHOLDS);
console.log('');

try {
  // Run coverage test
  execSync('npm run test:coverage', {
    stdio: 'inherit',
    cwd: ROOT_DIR
  });

  // Parse coverage summary
  const coveragePath = join(ROOT_DIR, 'coverage', 'coverage-summary.json');
  const coverageData = JSON.parse(readFileSync(coveragePath, 'utf8'));
  const totals = coverageData.total;

  // Check thresholds
  const failures = [];

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
    console.error('❌ Coverage check FAILED!');
    console.error('');
    console.error('The following metrics are below the required threshold:');
    failures.forEach(f => console.error(`  - ${f}`));
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

  console.log('✅ Coverage check passed!');
  console.log('');
  console.log('Coverage summary:');
  console.log(`  Lines:      ${totals.lines.pct.toFixed(2)}%`);
  console.log(`  Functions:  ${totals.functions.pct.toFixed(2)}%`);
  console.log(`  Branches:   ${totals.branches.pct.toFixed(2)}%`);
  console.log(`  Statements: ${totals.statements.pct.toFixed(2)}%`);
  console.log('');

} catch {
  // If test:coverage fails, the error was already shown
  // Just exit with error code
  console.error('');
  console.error('❌ Coverage check failed - tests did not pass');
  console.error('');
  console.error('For emergency commits, use:');
  console.error('  SKIP_COVERAGE_CHECK=1 git commit -m "your message"');
  console.error('');
  process.exit(1);
}

