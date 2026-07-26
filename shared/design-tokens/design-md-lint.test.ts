import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  runDesignMdLint,
  validateDesignSystem,
} from './design-md-lint.ts';
import {
  buildDesignMd,
  classifyTokens,
  parseCssVariables,
} from './sync-design-tokens.ts';

const CSS = `:root {
  --font-sans: 'Work Sans', sans-serif;
  --font-mono: monospace;
  --space-1: 0.25rem;
  --rounded-sm: 0.25rem;
  --rounded-md: 0.375rem;
  --rounded-lg: 0.5rem;
  --rounded-xl: 0.75rem;
  --rounded-full: 624.9375rem;
  --component-control-min-size: 2.75rem;
  --component-icon-button-size: 2.75rem;
  --component-brand-badge-size: 2.75rem;
  --component-icon-size: 1.5rem;
  --component-button-icon-size: 1.25rem;
  --component-checkbox-size: 1.25rem;
  --bg: #ffffff;
  --fg: #111827;
  --surface: #ffffff;
  --btn-primary-bg: #0d5ea1;
  --btn-primary-fg: #ffffff;
  --primary: #030213;
  --white: #ffffff;
  --muted-fg: #4b5563;
  --text-high-contrast: #000000;
  --success-bg: #dcfce7;
  --success-text: #166534;
  --warning-bg: #fff8e1;
  --warning-text: #5a4300;
  --orange-bg: #ffe9d6;
  --orange-text: #6a2e00;
  --error-bg: #fee2e2;
  --error-text: #991b1b;
  --dark-bg: #f0d6d6;
  --dark-text: #2b0000;
  --tooltip-bg: #1f2937;
  --tooltip-fg: #f9fafb;
  --tooltip-bg-inverse: #ffffff;
  --tooltip-fg-inverse: #1f2937;
  --brand-social-email: #4b5563;
  --brand-social-icon-fg: #ffffff;
}`;

const BODY = `# Design system

## Typography

Accessibility is non-negotiable. Use semantic color tokens.

## Components

### States

Focus, hover, pressed, disabled, loading, success, and error states are required.
Use transitions and animations, with \`prefers-reduced-motion: reduce\`.
`;

function design(css = CSS): string {
  return buildDesignMd({
    parsed: classifyTokens(parseCssVariables(css)),
    existingContent: BODY,
  });
}

describe('local design.md lint', () => {
  it('computes WCAG contrast for opaque and alpha colors', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 3);
    expect(contrastRatio('#00000099', '#ffffff')).toBeGreaterThan(5.5);
    expect(contrastRatio('bad', '#ffffff')).toBeUndefined();
  });

  it('accepts synchronized, documented contracts', () => {
    expect(validateDesignSystem(design(), CSS)).toEqual([
      expect.objectContaining({ severity: 'info' }),
    ]);
  });

  it('rejects front-matter drift and incomplete documentation', () => {
    const findings = validateDesignSystem(
      design().replace('version: alpha', 'version: changed').replace('### States', ''),
      CSS,
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'front-matter', severity: 'error' }),
        expect.objectContaining({
          path: 'documentation.states',
          severity: 'error',
        }),
      ]),
    );
  });

  it('rejects invalid and inaccessible color contracts', () => {
    const invalidCss = CSS
      .replace('--fg: #111827;', '--fg: #zzzzzz;')
      .replace('--btn-primary-bg: #0d5ea1;', '--btn-primary-bg: #ffffff;');
    const findings = validateDesignSystem(design(invalidCss), invalidCss);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'components.btn-outline.textColor',
          severity: 'error',
        }),
        expect.objectContaining({
          path: 'components.btn-primary',
          severity: 'error',
        }),
      ]),
    );
  });

  it('fails clearly when an input file is missing', () => {
    const errors: string[] = [];
    const code = runDesignMdLint({
      designMdPath: '/design',
      variablesCssPath: '/tokens',
      existsFile: () => false,
      readFile: () => '',
      logger: {
        log: () => undefined,
        error: (message) => errors.push(String(message)),
      },
    });

    expect(code).toBe(1);
    expect(errors[0]).toContain('/design not found');
  });
});
