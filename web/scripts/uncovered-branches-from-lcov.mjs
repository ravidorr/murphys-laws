#!/usr/bin/env node
/**
 * Reads web/coverage/lcov.info and prints uncovered branches in uncovered-branches.md format.
 * Run from repo root: node web/scripts/uncovered-branches-from-lcov.mjs
 * Option: node web/scripts/uncovered-branches-from-lcov.mjs --update
 *   Updates web/uncovered-branches.md: moves any branch that is now covered from Uncovered to Completed.
 * Requires: npm run test:coverage has been run so coverage/lcov.info exists.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const repoRoot = process.cwd();
const lcovPath = join(repoRoot, 'web/coverage/lcov.info');
const mdPath = join(repoRoot, 'web/uncovered-branches.md');

function sourcePathToTestFile(sf) {
  const base = sf.replace(/^src\//, '').replace(/\.(ts|js)$/, '');
  const parts = base.split('/');
  const name = parts[parts.length - 1];
  if (parts[0] === 'views' && name === 'favorites') return 'favorites-view';
  return name;
}

const lcov = readFileSync(lcovPath, 'utf8');

const lines = lcov.split('\n');
let currentFile = null;
const uncovered = [];
let totalBranches = 0;

for (const line of lines) {
  if (line.startsWith('SF:')) {
    currentFile = line.slice(3).trim();
    continue;
  }
  if (line.startsWith('BRDA:')) {
    const rest = line.slice(5);
    const [lineNum, block, branch, taken] = rest.split(',').map((s) => s.trim());
    if (currentFile) totalBranches += 1;
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

const covered = totalBranches - uncovered.length;
const pct = totalBranches > 0 ? ((covered / totalBranches) * 100).toFixed(2) : '0.00';

const newUncoveredRows = uncovered.map(
  (b) => `- [ ] L${b.line} T${b.block} B${b.branch} | ${b.file}:${b.line} | ${b.testFile}`
);
const newUncoveredSet = new Set(newUncoveredRows);

if (process.argv.includes('--update')) {
  const md = readFileSync(mdPath, 'utf8');
  const completedSection = md.match(/## Completed\n\n([\s\S]*?)(?=\n## Uncovered)/)?.[1]?.trim() ?? '';
  const uncoveredSection = md.match(/## Uncovered[\s\S]*?\n\n(- \[ \][\s\S]*?)(?=\n$|\n#|$)/)?.[1]?.trim() ?? '';
  const oldUncoveredLines = uncoveredSection.split('\n').filter((l) => l.startsWith('- [ ]'));
  const newlyCovered = oldUncoveredLines.filter((line) => !newUncoveredSet.has(line));
  const completedLines = completedSection.split('\n').filter(Boolean);
  newlyCovered.forEach((line) => {
    completedLines.push(line.replace(/^- \[ \] /, '- [x] '));
  });
  const completedBlock = completedLines.length
    ? '## Completed\n\n' + completedLines.join('\n') + '\n\n'
    : '## Completed\n\n(none yet)\n\n';
  const uncoveredBlock =
    `## Uncovered (${uncovered.length}) | Branch coverage: ${pct}% (${covered}/${totalBranches})\n\n` +
    newUncoveredRows.join('\n') +
    '\n';
  const intro = md.match(/^[\s\S]*?(?=## Completed)/)?.[0] ?? '# Branch coverage checklist\n\nEach item is a todo';
  const newMd = intro + completedBlock + uncoveredBlock;
  writeFileSync(mdPath, newMd);
  if (newlyCovered.length) {
    console.log(`Updated ${mdPath}: moved ${newlyCovered.length} branch(es) to Completed.`);
  } else {
    console.log(`Updated ${mdPath}: no newly covered branches (${uncovered.length} still uncovered).`);
  }
} else {
  const header = `# Uncovered branches (${uncovered.length}) | Branch coverage: ${pct}% (${covered}/${totalBranches})\n\n`;
  console.log(header + newUncoveredRows.join('\n'));
}
