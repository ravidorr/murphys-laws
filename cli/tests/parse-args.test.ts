import { describe, it, expect } from 'vitest';
import { parseArgs, parseIntOption, UsageError } from '../src/parse-args.js';

describe('parseArgs', () => {
  it('parses command and positionals', () => {
    const result = parseArgs(['search', 'hello', 'world']);
    expect(result.command).toBe('search');
    expect(result.positionals).toEqual(['hello', 'world']);
    expect(result.flags.json).toBe(false);
  });

  it('supports -- to terminate flag parsing', () => {
    const result = parseArgs(['get', '--', '--not-a-flag']);
    expect(result.command).toBe('get');
    expect(result.positionals).toEqual(['--not-a-flag']);
  });

  it('recognizes global boolean flags', () => {
    const result = parseArgs(['--json', '--no-color', 'random']);
    expect(result.flags.json).toBe(true);
    expect(result.flags.color).toBe(false);
    expect(result.command).toBe('random');
  });

  it('honors --color to force-enable', () => {
    const result = parseArgs(['--no-color', '--color', 'random']);
    expect(result.flags.color).toBe(true);
  });

  it('accepts --help and -h', () => {
    expect(parseArgs(['-h']).flags.help).toBe(true);
    expect(parseArgs(['--help']).flags.help).toBe(true);
  });

  it('accepts --version and -v', () => {
    expect(parseArgs(['-v']).flags.version).toBe(true);
    expect(parseArgs(['--version']).flags.version).toBe(true);
  });

  it('reads --base-url and --user-agent as separate args', () => {
    const r = parseArgs(['--base-url', 'https://x', '--user-agent', 'ua', 'random']);
    expect(r.flags.baseUrl).toBe('https://x');
    expect(r.flags.userAgent).toBe('ua');
  });

  it('reads --base-url=value form', () => {
    const r = parseArgs(['--base-url=https://example', 'random']);
    expect(r.flags.baseUrl).toBe('https://example');
  });

  it('reads --user-agent=value form', () => {
    const r = parseArgs(['--user-agent=custom', 'random']);
    expect(r.flags.userAgent).toBe('custom');
  });

  it('rejects missing value for --base-url', () => {
    expect(() => parseArgs(['--base-url'])).toThrow(UsageError);
  });

  it('rejects --base-url followed by another flag', () => {
    expect(() => parseArgs(['--base-url', '--json'])).toThrow(UsageError);
  });

  it('parses command value flags', () => {
    const r = parseArgs(['search', 'foo', '--limit', '5', '--offset', '10']);
    expect(r.options.limit).toBe('5');
    expect(r.options.offset).toBe('10');
  });

  it('parses command value flags with = form', () => {
    const r = parseArgs(['search', 'foo', '--limit=5']);
    expect(r.options.limit).toBe('5');
  });

  it('rejects bool flag with value', () => {
    expect(() => parseArgs(['--json=1'])).toThrow(UsageError);
  });

  it('rejects missing value for command flag', () => {
    expect(() => parseArgs(['search', 'foo', '--limit'])).toThrow(UsageError);
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(UsageError);
  });

  it('rejects unknown flag with = form', () => {
    expect(() => parseArgs(['--bogus=1'])).toThrow(UsageError);
  });

  it('treats trailing positionals after command as arguments', () => {
    const r = parseArgs(['submit', 'my law text', '--title', 'T']);
    expect(r.positionals).toEqual(['my law text']);
    expect(r.options.title).toBe('T');
  });
});

describe('parseIntOption', () => {
  it('returns undefined when raw is undefined', () => {
    expect(parseIntOption(undefined, 'limit', { min: 1, max: 10 })).toBeUndefined();
  });

  it('parses integers within range', () => {
    expect(parseIntOption('5', 'limit', { min: 1, max: 10 })).toBe(5);
  });

  it('rejects non-integer values', () => {
    expect(() => parseIntOption('5.5', 'limit', { min: 1, max: 10 })).toThrow(UsageError);
  });

  it('rejects out-of-range low values', () => {
    expect(() => parseIntOption('0', 'limit', { min: 1, max: 10 })).toThrow(UsageError);
  });

  it('rejects out-of-range high values', () => {
    expect(() => parseIntOption('11', 'limit', { min: 1, max: 10 })).toThrow(UsageError);
  });

  it('rejects non-numeric strings', () => {
    expect(() => parseIntOption('abc', 'limit', { min: 1, max: 10 })).toThrow(UsageError);
  });
});
