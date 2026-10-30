import { describe, it, expect } from 'vitest';
import {
  createDiagnosticLog,
  describeError,
  isDiagnosticEnabled,
} from '../src/utils/error-diagnostics.ts';

describe('isDiagnosticEnabled', () => {
  it('is on for Kindle and Silk user agents', () => {
    expect(isDiagnosticEnabled('Mozilla/5.0 (Linux; Android) Kindle/3.0', '')).toBe(true);
    expect(isDiagnosticEnabled('Mozilla/5.0 Silk/120.0', '')).toBe(true);
  });

  it('is on with ?diag=1 on any browser', () => {
    expect(isDiagnosticEnabled('Mozilla/5.0 Chrome/120', '?diag=1')).toBe(true);
  });

  it('is off otherwise', () => {
    expect(isDiagnosticEnabled('Mozilla/5.0 Chrome/120', '')).toBe(false);
    expect(isDiagnosticEnabled('Mozilla/5.0 Chrome/120', '?diag=0')).toBe(false);
  });
});

describe('describeError', () => {
  it('formats an Error with name and message', () => {
    expect(describeError('E', new TypeError('boom'))).toBe('E TypeError: boom');
  });

  it('formats non-Error values as strings', () => {
    expect(describeError('R', 'plain reason')).toBe('R plain reason');
  });

  it('appends the last two path segments and line number', () => {
    expect(describeError('E', 'x', 'https://murphys-laws.com/assets/index-abc.js', 42))
      .toBe('E x @assets/index-abc.js:42');
  });

  it('uses ? when the line number is missing', () => {
    expect(describeError('E', 'x', 'a.js')).toBe('E x @a.js:?');
  });

  it('truncates the message but keeps the location', () => {
    const out = describeError('E', 'm'.repeat(500), 'dir/file.js', 7);
    expect(out.endsWith(' @dir/file.js:7')).toBe(true);
    expect(out.length).toBeLessThan(200);
  });

  it('does not throw for values that cannot be stringified', () => {
    expect(describeError('R', Object.create(null))).toBe('R [unprintable]');
  });
});

describe('createDiagnosticLog', () => {
  it('joins entries and caps them at five', () => {
    const log = createDiagnosticLog();
    expect(log.text()).toBe('');
    for (let i = 1; i <= 7; i += 1) log.add(`e${i}`);
    expect(log.text()).toBe('e1 | e2 | e3 | e4 | e5');
  });

  it('returns the current text from add', () => {
    const log = createDiagnosticLog();
    expect(log.add('a')).toBe('a');
    expect(log.add('b')).toBe('a | b');
  });
});
