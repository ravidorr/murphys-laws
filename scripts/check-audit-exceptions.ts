import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type AuditVia = string | {
  url?: string;
};

type AuditVulnerability = {
  severity?: string;
  via?: AuditVia[];
};

type AuditReport = {
  vulnerabilities?: Record<string, AuditVulnerability>;
};

export type AuditException = {
  id: string;
  expiresOn: string;
  reason: string;
};

type AuditExceptionConfig = {
  exceptions?: AuditException[];
};

export type DisallowedVulnerability = {
  advisories: string[];
  packageName: string;
};

const blockingSeverities = new Set(['high', 'critical']);

function advisoryId(url: string | undefined): string | undefined {
  return url?.match(/GHSA-[a-z0-9-]+/i)?.[0].toUpperCase();
}

function advisoriesFor(
  packageName: string,
  vulnerabilities: Record<string, AuditVulnerability>,
  visited = new Set<string>(),
): Set<string> {
  if (visited.has(packageName)) {
    return new Set();
  }

  visited.add(packageName);
  const vulnerability = vulnerabilities[packageName];
  const advisories = new Set<string>();

  for (const dependency of vulnerability?.via ?? []) {
    if (typeof dependency === 'string') {
      for (const id of advisoriesFor(dependency, vulnerabilities, visited)) {
        advisories.add(id);
      }
      continue;
    }

    const id = advisoryId(dependency.url);
    if (id) {
      advisories.add(id);
    }
  }

  return advisories;
}

function isActive(exception: AuditException, today: string): boolean {
  return exception.expiresOn >= today;
}

export function findDisallowedVulnerabilities(
  report: AuditReport,
  exceptions: readonly AuditException[],
  today: string,
): DisallowedVulnerability[] {
  const vulnerabilities = report.vulnerabilities ?? {};
  const activeExceptions = new Set(
    exceptions
      .filter((exception) => isActive(exception, today))
      .map((exception) => exception.id.toUpperCase()),
  );
  const disallowed: DisallowedVulnerability[] = [];

  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    if (!blockingSeverities.has(vulnerability.severity ?? '')) {
      continue;
    }

    const advisories = [...advisoriesFor(packageName, vulnerabilities)].sort();
    if (advisories.length === 0 || advisories.some((id) => !activeExceptions.has(id))) {
      disallowed.push({ packageName, advisories });
    }
  }

  return disallowed;
}

export function parseExceptions(contents: string): AuditException[] {
  const config = JSON.parse(contents) as AuditExceptionConfig;
  return config.exceptions ?? [];
}

function auditReport(): AuditReport {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      }),
    ) as AuditReport;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'stdout' in error &&
      typeof error.stdout === 'string'
    ) {
      return JSON.parse(error.stdout) as AuditReport;
    }

    throw error;
  }
}

function main(): void {
  const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const exceptions = parseExceptions(
    readFileSync(path.join(rootDirectory, 'config/audit-exceptions.json'), 'utf8'),
  );
  const today = new Date().toISOString().slice(0, 10);
  const disallowed = findDisallowedVulnerabilities(auditReport(), exceptions, today);

  if (disallowed.length === 0) {
    console.log('Full dependency audit matches active reviewed exceptions.');
    return;
  }

  console.error('Full dependency audit found unreviewed or expired high/critical advisories:');
  for (const vulnerability of disallowed) {
    const advisories = vulnerability.advisories.length > 0
      ? vulnerability.advisories.join(', ')
      : 'unidentified advisory';
    console.error(`- ${vulnerability.packageName}: ${advisories}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
