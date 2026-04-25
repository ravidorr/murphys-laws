/**
 * Thin wrapper around `@google/design.md lint` that:
 *   - runs the upstream linter over web/DESIGN.md
 *   - fails the process on any finding with severity `error`
 *   - surfaces warnings and infos to stdout for visibility
 *   - treats "defined but never referenced" warnings as acceptable
 *     (dark-mode tokens are authored for agent consumption, not for
 *     component contracts, so they will always be "unreferenced")
 *
 * The upstream package is proprietary-licensed and is pinned as a
 * devDependency in web/package.json. It is never bundled into the
 * shipped web artifact.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DESIGN_MD_PATH = path.resolve(__dirname, '../../web/DESIGN.md');
const DESIGN_MD_PACKAGE_SPEC = '@google/design.md@0.1.1';

interface Finding {
  severity: 'error' | 'warning' | 'info';
  path?: string;
  message: string;
}

interface LintReport {
  findings: Finding[];
  summary: { errors: number; warnings: number; infos: number };
}

export interface RunLintOptions {
  designMdPath: string;
  packageSpec: string;
  runner: (args: string[]) => { status: number | null; stdout: string; stderr: string };
  logger: Pick<Console, 'log' | 'error'>;
}

/**
 * Whether a warning is considered acceptable for this repo.
 *
 * DESIGN.md flags every color token that is not consumed by a
 * component-level contract. We use `dark-*` tokens as direct consumer
 * tokens (agents read them, CSS in `theme.css` references them) rather
 * than via component sub-tokens, so "unreferenced" warnings on them
 * are expected and not actionable here.
 */
export function isIgnorableWarning(finding: Finding): boolean {
  if (finding.severity !== 'warning') return false;
  return /is defined but never referenced by any component/.test(finding.message);
}

/**
 * Whether a warning should be promoted to an error for this repo.
 *
 * WCAG contrast failures ship as `warning`s from the upstream linter
 * but the project contract (see CLAUDE.md + DESIGN.md "Do's and Don'ts")
 * treats WCAG AA as a hard gate; any token pair that falls below
 * threshold must fail the build rather than silently land.
 */
export function isWcagFailureWarning(finding: Finding): boolean {
  if (finding.severity !== 'warning') return false;
  return /below WCAG\s*A{1,3}/i.test(finding.message);
}

export function runDesignMdLint(options: RunLintOptions): 0 | 1 {
  const { status, stdout, stderr } = options.runner([
    '--yes',
    options.packageSpec,
    'lint',
    '--format',
    'json',
    options.designMdPath,
  ]);

  if (status === null || status > 1) {
    options.logger.error(
      `design.md lint failed to run (exit ${String(status)}):\n${stderr}`,
    );
    return 1;
  }

  let report: LintReport;
  try {
    report = JSON.parse(stdout) as LintReport;
  } catch (err) {
    options.logger.error(
      `Could not parse design.md lint output as JSON: ${(err as Error).message}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
    return 1;
  }

  const upstreamErrors = report.findings.filter((f) => f.severity === 'error');
  const wcagFailures = report.findings.filter(isWcagFailureWarning);
  const otherWarnings = report.findings.filter(
    (f) =>
      f.severity === 'warning' &&
      !isIgnorableWarning(f) &&
      !isWcagFailureWarning(f),
  );
  const infos = report.findings.filter((f) => f.severity === 'info');

  for (const info of infos) {
    options.logger.log(`info  ${info.path ?? ''}: ${info.message}`);
  }
  for (const warn of otherWarnings) {
    options.logger.log(`warn  ${warn.path ?? ''}: ${warn.message}`);
  }
  for (const error of upstreamErrors) {
    options.logger.error(`error ${error.path ?? ''}: ${error.message}`);
  }
  for (const wcag of wcagFailures) {
    options.logger.error(
      `error ${wcag.path ?? ''}: ${wcag.message} (promoted from warning: WCAG AA is a hard gate)`,
    );
  }

  const ignored = report.findings.filter(
    (f) => f.severity === 'warning' && isIgnorableWarning(f),
  ).length;

  const totalErrors = upstreamErrors.length + wcagFailures.length;
  options.logger.log(
    `design.md lint: ${totalErrors} error(s), ${otherWarnings.length} warning(s), ${ignored} ignored-warning(s), ${infos.length} info(s).`,
  );

  return totalErrors === 0 ? 0 : 1;
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === new URL(`file://${entry}`).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const code = runDesignMdLint({
    designMdPath: DESIGN_MD_PATH,
    packageSpec: DESIGN_MD_PACKAGE_SPEC,
    runner: (args) => {
      const r = spawnSync('npx', args, { encoding: 'utf8' });
      return {
        status: r.status,
        stdout: r.stdout ?? '',
        stderr: r.stderr ?? '',
      };
    },
    logger: console,
  });
  process.exit(code);
}
