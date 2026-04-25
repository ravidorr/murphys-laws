import { describe, it, expect } from 'vitest';
import {
  isIgnorableWarning,
  isWcagFailureWarning,
  runDesignMdLint,
  type RunLintOptions,
} from '../../shared/design-tokens/design-md-lint.ts';

interface IgnorableLocalThis {
  finding?: Parameters<typeof isIgnorableWarning>[0];
  result?: boolean;
}

interface RunLintLocalThis {
  stdout?: string;
  stderr?: string;
  status?: number | null;
  lastArgs?: string[];
  logs?: string[];
  errors?: string[];
  options?: RunLintOptions;
  code?: 0 | 1;
}

function buildRunLintLocalThis(
  stdout: string,
  status: number | null = 0,
): RunLintLocalThis {
  const localThis: RunLintLocalThis = {};
  localThis.stdout = stdout;
  localThis.stderr = '';
  localThis.status = status;
  localThis.logs = [];
  localThis.errors = [];
  localThis.options = {
    designMdPath: '/virt/DESIGN.md',
    packageSpec: '@google/design.md@0.1.1',
    runner: (args: string[]) => {
      localThis.lastArgs = args;
      return {
        status: localThis.status === undefined ? 0 : localThis.status,
        stdout: localThis.stdout ?? '',
        stderr: localThis.stderr ?? '',
      };
    },
    logger: {
      log: (...args: unknown[]): void => {
        localThis.logs!.push(args.map((a) => String(a)).join(' '));
      },
      error: (...args: unknown[]): void => {
        localThis.errors!.push(args.map((a) => String(a)).join(' '));
      },
    },
  };
  return localThis;
}

describe('isIgnorableWarning', () => {
  it('ignores "defined but never referenced by any component" warnings', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'warning',
      path: 'colors.dark-error-bg',
      message: "'dark-error-bg' is defined but never referenced by any component.",
    };
    localThis.result = isIgnorableWarning(localThis.finding);

    expect(localThis.result).toBe(true);
  });

  it('does not ignore other warnings', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'warning',
      path: 'components.btn-primary',
      message: 'textColor (#fff) on backgroundColor (#ccc) fails WCAG AA.',
    };
    localThis.result = isIgnorableWarning(localThis.finding);

    expect(localThis.result).toBe(false);
  });

  it('never treats errors as ignorable', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'error',
      message: 'is defined but never referenced by any component',
    };
    localThis.result = isIgnorableWarning(localThis.finding);

    expect(localThis.result).toBe(false);
  });

  it('never treats infos as ignorable warnings', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'info',
      message: 'something is defined but never referenced by any component',
    };
    localThis.result = isIgnorableWarning(localThis.finding);

    expect(localThis.result).toBe(false);
  });
});

describe('isWcagFailureWarning', () => {
  it('detects "below WCAG AA" contrast-ratio warnings', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'warning',
      path: 'components.btn-primary',
      message:
        'textColor (#fff) on backgroundColor (#ccc) has contrast ratio 3.1:1, below WCAG AA minimum of 4.5:1.',
    };
    localThis.result = isWcagFailureWarning(localThis.finding);

    expect(localThis.result).toBe(true);
  });

  it('detects AAA-level contrast failures too', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'warning',
      message: 'contrast 5:1, below WCAG AAA threshold.',
    };
    localThis.result = isWcagFailureWarning(localThis.finding);

    expect(localThis.result).toBe(true);
  });

  it('does not flag passing or unrelated warnings', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'warning',
      message: "'primary' is defined but never referenced by any component.",
    };
    localThis.result = isWcagFailureWarning(localThis.finding);

    expect(localThis.result).toBe(false);
  });

  it('does not flag error-severity findings (they already fail)', () => {
    const localThis: IgnorableLocalThis = {};
    localThis.finding = {
      severity: 'error',
      message: 'below WCAG AA',
    };
    localThis.result = isWcagFailureWarning(localThis.finding);

    expect(localThis.result).toBe(false);
  });
});

describe('runDesignMdLint', () => {
  it('returns 0 when there are only ignored warnings and infos', () => {
    const report = {
      findings: [
        {
          severity: 'warning',
          path: 'colors.dark-bg-primary',
          message: "'dark-bg-primary' is defined but never referenced by any component.",
        },
        { severity: 'info', message: 'Design system defines 52 colors.' },
      ],
      summary: { errors: 0, warnings: 1, infos: 1 },
    };
    const localThis = buildRunLintLocalThis(JSON.stringify(report));

    localThis.code = runDesignMdLint(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(localThis.errors!.length).toBe(0);
    expect(localThis.logs!.some((l) => l.startsWith('info  '))).toBe(true);
    expect(
      localThis.logs!.some((l) =>
        l.includes('0 error(s), 0 warning(s), 1 ignored-warning(s)'),
      ),
    ).toBe(true);
  });

  it('returns 1 and logs errors when the linter reports structural errors', () => {
    const report = {
      findings: [
        {
          severity: 'error',
          path: 'colors.primary',
          message: "Invalid color value 'oops'.",
        },
      ],
      summary: { errors: 1, warnings: 0, infos: 0 },
    };
    const localThis = buildRunLintLocalThis(JSON.stringify(report));

    localThis.code = runDesignMdLint(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) => e.includes("Invalid color value 'oops'")),
    ).toBe(true);
  });

  it('surfaces non-ignorable non-WCAG warnings without failing the run', () => {
    const report = {
      findings: [
        {
          severity: 'warning',
          path: 'colors.primary',
          message: "'primary' uses an unusual color-space annotation.",
        },
      ],
      summary: { errors: 0, warnings: 1, infos: 0 },
    };
    const localThis = buildRunLintLocalThis(JSON.stringify(report));

    localThis.code = runDesignMdLint(localThis.options!);

    expect(localThis.code).toBe(0);
    expect(
      localThis.logs!.some(
        (l) => l.startsWith('warn  ') && l.includes('color-space'),
      ),
    ).toBe(true);
  });

  it('promotes WCAG-failure warnings to errors and fails the run', () => {
    const report = {
      findings: [
        {
          severity: 'warning',
          path: 'components.btn-primary',
          message:
            'textColor (#ffffff) on backgroundColor (#aaccff) has contrast ratio 1.64:1, below WCAG AA minimum of 4.5:1.',
        },
      ],
      summary: { errors: 0, warnings: 1, infos: 0 },
    };
    const localThis = buildRunLintLocalThis(JSON.stringify(report));

    localThis.code = runDesignMdLint(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some(
        (e) => e.includes('below WCAG AA') && e.includes('promoted from warning'),
      ),
    ).toBe(true);
  });

  it('forwards the expected argv to the upstream package via the runner', () => {
    const report = { findings: [], summary: { errors: 0, warnings: 0, infos: 0 } };
    const localThis = buildRunLintLocalThis(JSON.stringify(report));

    runDesignMdLint(localThis.options!);

    expect(localThis.lastArgs).toEqual([
      '--yes',
      '@google/design.md@0.1.1',
      'lint',
      '--format',
      'json',
      '/virt/DESIGN.md',
    ]);
  });

  it('fails with a helpful error when the upstream command cannot run', () => {
    const localThis = buildRunLintLocalThis('', null);
    localThis.stderr = 'spawn npx ENOENT';

    localThis.code = runDesignMdLint(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) => e.includes('design.md lint failed to run')),
    ).toBe(true);
  });

  it('fails with a parse error when the upstream command emits non-JSON output', () => {
    const localThis = buildRunLintLocalThis('not json at all');

    localThis.code = runDesignMdLint(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) =>
        e.includes('Could not parse design.md lint output as JSON'),
      ),
    ).toBe(true);
  });

  it('treats upstream exit code > 1 as runtime failure', () => {
    const localThis = buildRunLintLocalThis('', 2);
    localThis.stderr = 'panic';

    localThis.code = runDesignMdLint(localThis.options!);

    expect(localThis.code).toBe(1);
    expect(
      localThis.errors!.some((e) => e.includes('design.md lint failed to run')),
    ).toBe(true);
  });
});
