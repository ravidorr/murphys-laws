import { describe, it, expect, vi } from 'vitest';
import {
  EMAIL_TOKEN_NAMES,
  buildEmailTokensSource,
  runEmailExport,
  type EmailExportOptions,
} from './export-email-tokens.ts';

const CSS = `:root {
  --bg: #fff;
  --fg: #111827;
  --muted-fg: #4B5563;
  --primary: #030213;
  --surface-border: #d1d5db;
  --link: #0d5ea1;
  --btn-primary-bg: #0d5ea1;
  --btn-primary-fg: #fff;
  --white: #fff;
  --dark-bg-primary: #0b0b11;
  --dark-fg-primary: #e9eaee;
  --dark-muted-fg: #9ca3af;
  --dark-primary: #6366f1;
  --dark-surface-border: #4b5563;
  --dark-link: #9ecbff;
}`;

function options(overrides: Partial<EmailExportOptions> = {}): EmailExportOptions & { written: string[] } {
  const written: string[] = [];
  return {
    check: false,
    variablesCssPath: 'v.css',
    outputPath: 'out.ts',
    readFile: (p) => (p === 'v.css' ? CSS : 'stale'),
    existsFile: () => true,
    writeFile: (_p, c) => written.push(c),
    logger: { log: vi.fn(), error: vi.fn() },
    written,
    ...overrides,
  };
}

describe('export-email-tokens', () => {
  it('writes every email token as a lower-case long hex value', () => {
    const source = buildEmailTokensSource(CSS);
    for (const name of EMAIL_TOKEN_NAMES) {
      expect(source).toContain(`'${name}': '#`);
    }
    expect(source).toContain("'bg': '#ffffff'");
    expect(source).toContain("'muted-fg': '#4b5563'");
    expect(source).toContain('Do not edit by hand');
  });

  it('fails when variables.css lacks a token', () => {
    expect(() => buildEmailTokensSource(':root { --bg: #fff; }')).toThrow('--fg');
  });

  it('writes the file', () => {
    const o = options();
    expect(runEmailExport(o)).toBe(0);
    expect(o.written).toEqual([buildEmailTokensSource(CSS)]);
  });

  it('checks the committed file against variables.css', () => {
    const inSync = options({ check: true, readFile: (p) => (p === 'v.css' ? CSS : buildEmailTokensSource(CSS)) });
    expect(runEmailExport(inSync)).toBe(0);
    expect(inSync.written).toEqual([]);

    const stale = options({ check: true });
    expect(runEmailExport(stale)).toBe(1);
    expect(stale.logger.error).toHaveBeenCalledWith(expect.stringContaining('design:export:email'));

    const missing = options({ check: true, existsFile: () => false });
    expect(runEmailExport(missing)).toBe(1);
  });
});
