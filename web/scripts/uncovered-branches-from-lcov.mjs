#!/usr/bin/env node
/**
 * Reads web/coverage/lcov.info and prints uncovered branches in uncovered-branches.md format.
 * Run from repo root: node web/scripts/uncovered-branches-from-lcov.mjs
 * Requires: npm run test:coverage has been run so coverage/lcov.info exists.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const lcovPath = join(process.cwd(), 'web/coverage/lcov.info');
const lcov = readFileSync(lcovPath, 'utf8');

function sourcePathToTestFile(sf) {
  const base = sf.replace(/^src\//, '').replace(/\.(ts|js)$/, '');
  const parts = base.split('/');
  const name = parts[parts.length - 1];
  if (parts[0] === 'views' && name === 'favorites') return 'favorites-view';
  return name;
}

const lines = lcov.split('\n');
let currentFile = null;
const uncovered = [];

for (const line of lines) {
  if (line.startsWith('SF:')) {
    currentFile = line.slice(3).trim();
    continue;
  }
  if (line.startsWith('BRDA:')) {
    const rest = line.slice(5);
    const [lineNum, block, branch, taken] = rest.split(',').map((s) => s.trim());
    const isUncovered = taken === '0' || taken === '-';
    if (isUncovered && currentFile) {
      const testBase = sourcePathToTestFile(currentFile);
      uncovered.push({
        line: lineNum,
        block,
        branch,
        file: currentFile,
        testFile: `tests/${testBase}.test.ts`,
      });
    }
    continue;
  }
}

const rows = uncovered.map(
  (b) => `- [ ] L${b.line} T${b.block} B${b.branch} | ${b.file}:${b.line} | ${b.testFile}`
);

const header = `# Uncovered branches (${uncovered.length})\n\n`;
const body = rows.join('\n');
console.log(header + body);
