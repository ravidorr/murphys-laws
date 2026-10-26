import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ALERT_RECIPIENT_KEYS, fillEnvFromFiles, parseRecipientList, resolveAlertRecipient } from '../../scripts/alert-recipient.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scratchDir } from '../helpers/shell-sandbox.ts';

describe('resolveAlertRecipient', () => {
  it('prefers ALERT_EMAIL, then falls back to EMAIL_TO, the address the server already uses for notices', () => {
    expect([...ALERT_RECIPIENT_KEYS]).toEqual(['ALERT_EMAIL', 'EMAIL_TO']);
    expect(resolveAlertRecipient({ ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' })).toBe('alerts@example.com');
    expect(resolveAlertRecipient({ EMAIL_TO: 'admin@example.com' })).toBe('admin@example.com');
  });

  it('takes the first non-blank key from a custom list, in order', () => {
    const keys = ['HEALTH_CHECK_EMAIL_TO', 'ALERT_EMAIL', 'EMAIL_TO'];
    const env = { HEALTH_CHECK_EMAIL_TO: 'health@example.com', ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' };
    expect(resolveAlertRecipient(env, keys)).toBe('health@example.com');
    expect(resolveAlertRecipient({ ...env, HEALTH_CHECK_EMAIL_TO: '' }, keys)).toBe('alerts@example.com');
    expect(resolveAlertRecipient({ EMAIL_TO: 'admin@example.com' }, keys)).toBe('admin@example.com');
  });

  it('treats empty and blank values as unset, as the deploy writes for a missing secret', () => {
    expect(resolveAlertRecipient({ ALERT_EMAIL: '', EMAIL_TO: 'admin@example.com' })).toBe('admin@example.com');
    expect(resolveAlertRecipient({ ALERT_EMAIL: '   ', EMAIL_TO: 'admin@example.com' })).toBe('admin@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveAlertRecipient({ ALERT_EMAIL: '  alerts@example.com\n' })).toBe('alerts@example.com');
  });

  it('returns null when nothing is configured, so a script can stop instead of guessing', () => {
    expect(resolveAlertRecipient({})).toBeNull();
    expect(resolveAlertRecipient({ ALERT_EMAIL: '', EMAIL_TO: ' ' })).toBeNull();
    expect(resolveAlertRecipient({ ALERT_EMAIL: 'alerts@example.com' }, ['OTHER'])).toBeNull();
  });
});

describe('fillEnvFromFiles', () => {
  const repo = (files: Record<string, string>) => {
    const root = scratchDir('alert-recipient-');
    mkdirSync(path.join(root, 'backend'));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(root, name), content);
    }
    return root;
  };
  const keys = ['HEALTH_CHECK_EMAIL_TO', 'ALERT_EMAIL', 'EMAIL_TO'];

  it('checks ALERT_ENV_FILE, then the root .env, then backend/.env, the order alert-email.sh uses', () => {
    const root = repo({ '.env': 'EMAIL_TO=root@example.com\n', 'backend/.env': 'EMAIL_TO=backend@example.com\n' });
    const custom = path.join(root, 'custom.env');
    writeFileSync(custom, 'EMAIL_TO=custom@example.com\n');

    const withCustom: NodeJS.ProcessEnv = { ALERT_ENV_FILE: custom };
    fillEnvFromFiles(root, withCustom, keys);
    expect(withCustom.EMAIL_TO).toBe('custom@example.com');

    const plain: NodeJS.ProcessEnv = {};
    fillEnvFromFiles(root, plain, keys);
    expect(plain.EMAIL_TO).toBe('root@example.com');

    const backendOnly: NodeJS.ProcessEnv = {};
    fillEnvFromFiles(repo({ 'backend/.env': 'EMAIL_TO=backend@example.com\n' }), backendOnly, keys);
    expect(backendOnly.EMAIL_TO).toBe('backend@example.com');
  });

  it('never replaces a non-blank value, fills a blank one, and ignores other keys and missing files', () => {
    const root = repo({ '.env': 'ALERT_EMAIL=file@example.com\nEMAIL_TO=file-admin@example.com\nOTHER=1\n' });
    const env: NodeJS.ProcessEnv = { ALERT_EMAIL: 'env@example.com', EMAIL_TO: '  ', ALERT_ENV_FILE: path.join(root, 'missing.env') };
    fillEnvFromFiles(root, env, keys);
    expect(env.ALERT_EMAIL).toBe('env@example.com');
    expect(env.EMAIL_TO).toBe('file-admin@example.com');
    expect(env.OTHER).toBeUndefined();
  });
});

describe('parseRecipientList', () => {
  it('returns a single address, trimmed', () => {
    expect(parseRecipientList(' a@example.com\n')).toEqual(['a@example.com']);
  });

  it('splits a comma-separated list, ignoring spaces around the commas and empty entries', () => {
    expect(parseRecipientList('a@example.com, b@example.com ,c@example.com,')).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
    ]);
  });

  it.each([
    ['an address without an @', 'ops'],
    ['an address with a space inside', 'Ops <a@example.com>'],
    ['an option-looking address', '-Sfoo@example.com'],
    ['one bad entry among good ones', 'a@example.com, ops, b@example.com'],
  ])('throws, naming the setting, for %s', (_name, value) => {
    expect(() => parseRecipientList(value)).toThrow(/is not a valid email address/);
    expect(() => parseRecipientList(value)).toThrow(value.includes(',') ? 'recipient setting' : value.trim());
  });

  it('throws for a value with no address in it', () => {
    expect(() => parseRecipientList(' , ,')).toThrow('holds no email address');
  });
});

describe('fillEnvFromFiles with files it cannot use', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const keys = ['EMAIL_TO'];

  it('skips a file it cannot read, with a warning naming it, and uses the next one', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = scratchDir('alert-recipient-unreadable-');
    mkdirSync(path.join(root, 'backend'));
    mkdirSync(path.join(root, '.env')); // a directory where the file should be: reading it throws EISDIR
    writeFileSync(path.join(root, 'backend/.env'), 'EMAIL_TO=backend@example.com\n');
    const env: NodeJS.ProcessEnv = {};
    fillEnvFromFiles(root, env, keys);
    expect(env.EMAIL_TO).toBe('backend@example.com');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`cannot read ${path.join(root, '.env')}`));
  });

  it('ignores a whitespace-only ALERT_ENV_FILE', () => {
    const root = scratchDir('alert-recipient-blank-');
    mkdirSync(path.join(root, 'backend'));
    writeFileSync(path.join(root, 'backend/.env'), 'EMAIL_TO=backend@example.com\n');
    const env: NodeJS.ProcessEnv = { ALERT_ENV_FILE: '   ' };
    fillEnvFromFiles(root, env, keys);
    expect(env.EMAIL_TO).toBe('backend@example.com');
  });
});
