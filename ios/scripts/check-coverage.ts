import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface XcCovTarget {
  name: string;
  lineCoverage: number;
}

export interface XcCovReport {
  targets: XcCovTarget[];
}

export function getTargetLineCoverage(
  report: XcCovReport,
  targetName: string,
): number {
  const target = report.targets.find(({ name }) => name === targetName);

  if (target === undefined || !Number.isFinite(target.lineCoverage)) {
    throw new Error(`Coverage report has no valid ${targetName} target.`);
  }

  return target.lineCoverage;
}

export function meetsCoverageThreshold(actual: number, minimum: number): boolean {
  return actual >= minimum;
}

function main(): void {
  const [reportPath, minimumText = '0.65'] = process.argv.slice(2);

  if (reportPath === undefined) {
    throw new Error('Usage: check-coverage.ts <coverage.json> [minimum]');
  }

  const minimum = Number(minimumText);
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) {
    throw new Error('Coverage minimum must be a number from 0 to 1.');
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as XcCovReport;
  const actual = getTargetLineCoverage(report, 'MurphysLaws.app');

  if (!meetsCoverageThreshold(actual, minimum)) {
    throw new Error(
      `iOS coverage ${(actual * 100).toFixed(2)}% is below ${(minimum * 100).toFixed(2)}%.`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
