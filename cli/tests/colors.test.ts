import { describe, it, expect } from 'vitest';
import { selectColors } from '../src/colors.js';

describe('selectColors', () => {
  it('returns plain when colorFlag is false', () => {
    const c = selectColors({ colorFlag: false, isTTY: true, env: {} });
    expect(c.bold('x')).toBe('x');
    expect(c.red('x')).toBe('x');
    expect(c.green('x')).toBe('x');
    expect(c.gray('x')).toBe('x');
    expect(c.yellow('x')).toBe('x');
    expect(c.cyan('x')).toBe('x');
    expect(c.dim('x')).toBe('x');
  });

  it('returns plain when NO_COLOR env is set', () => {
    const c = selectColors({ colorFlag: true, isTTY: true, env: { NO_COLOR: '1' } });
    expect(c.cyan('x')).toBe('x');
  });

  it('returns plain when not a TTY', () => {
    const c = selectColors({ colorFlag: true, isTTY: false, env: {} });
    expect(c.green('x')).toBe('x');
  });

  it('returns ANSI when TTY and color enabled', () => {
    const c = selectColors({ colorFlag: true, isTTY: true, env: {} });
    expect(c.bold('x')).toContain('\u001b[');
    expect(c.dim('x')).toContain('\u001b[');
    expect(c.gray('x')).toContain('\u001b[');
    expect(c.yellow('x')).toContain('\u001b[');
  });

  it('FORCE_COLOR overrides non-TTY', () => {
    const c = selectColors({ colorFlag: true, isTTY: false, env: { FORCE_COLOR: '1' } });
    expect(c.red('x')).toContain('\u001b[');
  });

  it('FORCE_COLOR=0 does not force color', () => {
    const c = selectColors({ colorFlag: true, isTTY: false, env: { FORCE_COLOR: '0' } });
    expect(c.red('x')).toBe('x');
  });
});
