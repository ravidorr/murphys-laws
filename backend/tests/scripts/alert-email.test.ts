import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { describe, expect, it } from 'vitest';
import { bash, readLog, sandbox, type Sandbox } from '../helpers/shell-sandbox.ts';

const resolve = (box: Sandbox, env: Record<string, string> = {}, args = '') =>
  bash(`resolve_alert_email ${args}`, box, env).stdout;

describe('resolve_alert_email', () => {
  it('prefers ALERT_EMAIL over EMAIL_TO from the environment', () => {
    const box = sandbox();
    expect(resolve(box, { ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' })).toBe('alerts@example.com');
    expect(resolve(box, { EMAIL_TO: 'admin@example.com' })).toBe('admin@example.com');
  });

  it('takes extra variable names first, in the order given', () => {
    const box = sandbox();
    const env = { HEALTH_CHECK_EMAIL_TO: 'health@example.com', ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' };
    expect(resolve(box, env, 'HEALTH_CHECK_EMAIL_TO')).toBe('health@example.com');
    expect(resolve(box, { ...env, HEALTH_CHECK_EMAIL_TO: '' }, 'HEALTH_CHECK_EMAIL_TO')).toBe('alerts@example.com');
  });

  it('reads the server .env files when cron gives it no environment', () => {
    const box = sandbox({ 'backend/.env': 'EMAIL_TO=admin@example.com\n' });
    expect(resolve(box)).toBe('admin@example.com');
  });

  it('ranks ALERT_EMAIL above EMAIL_TO wherever each is set, then the environment above the files', () => {
    const box = sandbox({ 'backend/.env': 'ALERT_EMAIL=file-alert@example.com\nEMAIL_TO=file-admin@example.com\n' });
    expect(resolve(box, { EMAIL_TO: 'env-admin@example.com' })).toBe('file-alert@example.com');
    expect(resolve(box, { ALERT_EMAIL: 'env-alert@example.com' })).toBe('env-alert@example.com');
  });

  it('checks ALERT_ENV_FILE, then the root .env, then backend/.env, the order the TypeScript scripts use too', () => {
    const box = sandbox({ 'backend/.env': 'EMAIL_TO=backend@example.com\n', '.env': 'EMAIL_TO=root@example.com\n' });
    const custom = path.join(box.root, 'custom.env');
    writeFileSync(custom, 'EMAIL_TO=custom@example.com\n');
    expect(resolve(box, { ALERT_ENV_FILE: custom })).toBe('custom@example.com');
    expect(resolve(box)).toBe('root@example.com');
    expect(resolve(sandbox({ 'backend/.env': 'EMAIL_TO=backend@example.com\n' }))).toBe('backend@example.com');
  });

  it('skips a blank value and keeps looking', () => {
    const box = sandbox({ '.env': 'EMAIL_TO=\n', 'backend/.env': 'EMAIL_TO=backend@example.com\n' });
    expect(resolve(box, { ALERT_EMAIL: '   ' })).toBe('backend@example.com');
  });

  it.each([
    ['plain', 'EMAIL_TO=a@example.com\n'],
    ['double quotes', 'EMAIL_TO="a@example.com"\n'],
    ['single quotes', "EMAIL_TO='a@example.com'\n"],
    ['export prefix', 'export EMAIL_TO=a@example.com\n'],
    ['CRLF line ending', 'EMAIL_TO=a@example.com\r\n'],
    ['surrounding spaces', '  EMAIL_TO=  a@example.com  \n'],
    ['trailing comment', 'EMAIL_TO=a@example.com # the admin\n'],
    ['other keys around it', 'FOO=1\nEMAIL_TOO=wrong@example.com\nEMAIL_TO=a@example.com\nBAR=2\n'],
  ])('parses a .env line written as: %s', (_name, content) => {
    expect(resolve(sandbox({ 'backend/.env': content }))).toBe('a@example.com');
  });

  // The API server and the TypeScript scripts read these same files with dotenv, so the shell must agree.
  it.each([
    ['a quoted value followed by a comment', 'EMAIL_TO="a@example.com" # on-call\n'],
    ['a single-quoted value followed by a comment', "EMAIL_TO='a@example.com' # on-call\n"],
    ['a tab before the comment', 'EMAIL_TO=a@example.com\t# on-call\n'],
    ['a comment with no space before the #', 'EMAIL_TO=a@example.com#on-call\n'],
    ['spaces around the equals sign', 'EMAIL_TO = a@example.com\n'],
    ['duplicate keys (the last one wins)', 'EMAIL_TO=first@example.com\nEMAIL_TO=second@example.com\n'],
    ['an export prefix with quotes', 'export EMAIL_TO="a@example.com"\n'],
    ['trailing spaces', 'EMAIL_TO=a@example.com   \n'],
    ['an empty quoted value', 'EMAIL_TO=""\n'],
    ['a CRLF line ending after a quoted value', 'EMAIL_TO="a@example.com"\r\n'],
    ['a blank value followed by a real one', 'EMAIL_TO=\nEMAIL_TO=b@example.com\n'],
    ['a commented-out key above the real one', '# EMAIL_TO=old@example.com\nEMAIL_TO=a@example.com\n'],
    ['a commented-out key below the real one', 'EMAIL_TO=a@example.com\n# EMAIL_TO=old@example.com\n'],
    ['a commented-out key with no space after the #', '#EMAIL_TO=old@example.com\nEMAIL_TO=a@example.com\n'],
    ['a longer key that ends with the name', 'MY_EMAIL_TO=wrong@example.com\nEMAIL_TO=a@example.com\n'],
    ['a key that is only commented out', '# EMAIL_TO=old@example.com\n'],
  ])('reads %s the same way dotenv does', (_name, content) => {
    const fromDotenv = (dotenv.parse(content).EMAIL_TO ?? '').trim();
    expect(resolve(sandbox({ 'backend/.env': content }))).toBe(fromDotenv);
  });

  it('never runs anything found in a .env file, in a key or in the address itself', () => {
    const box = sandbox();
    const marker = path.join(box.root, 'pwned');
    writeFileSync(path.join(box.root, 'backend/.env'), `SECRET=$(touch ${marker})\nEMAIL_TO=a@example.com\n`);
    expect(resolve(box)).toBe('a@example.com');
    expect(existsSync(marker)).toBe(false);

    const valueBorne = sandbox();
    const valueMarker = path.join(valueBorne.root, 'pwned');
    writeFileSync(path.join(valueBorne.root, 'backend/.env'), `EMAIL_TO=$(touch ${valueMarker})@example.com\n`);
    expect(resolve(valueBorne)).toBe(`$(touch ${valueMarker})@example.com`);
    expect(existsSync(valueMarker)).toBe(false);
  });

  it('still reads the address from a file that has a stray binary byte elsewhere', () => {
    const box = sandbox({ 'backend/.env': 'BINARY=a\u0000b\nEMAIL_TO=a@example.com\n' });
    expect(resolve(box)).toBe('a@example.com');
  });

  it('ignores an ALERT_ENV_FILE that does not exist', () => {
    const box = sandbox({ 'backend/.env': 'EMAIL_TO=backend@example.com\n' });
    expect(resolve(box, { ALERT_ENV_FILE: path.join(box.root, 'missing.env') })).toBe('backend@example.com');
  });

  it('prints nothing and still succeeds when no address is configured', () => {
    const box = sandbox({ 'backend/.env': 'OTHER=1\n' });
    expect(bash('resolve_alert_email; echo "status=$?"', box).stdout).toBe('status=0\n');
    expect(bash('set -euo pipefail; x="$(resolve_alert_email)"; echo "ok:$x"', box).stdout).toBe('ok:\n');
  });

  it('defaults REPO_ROOT to /root/murphys-laws without failing when that does not exist', () => {
    const result = bash('resolve_alert_email; echo "status=$?"', sandbox(), {}, '', { withRepoRoot: false });
    expect(result.stdout).toBe('status=0\n');
  });
});

describe('send_alert_mail', () => {
  const send = (box: Sandbox, subject: string, env: Record<string, string> = {}, alertEmail = 'a@example.com') =>
    bash(`ALERT_EMAIL='${alertEmail}'; send_alert_mail ${subject}; echo "status=$?"`, box, env, 'details here\n');

  it('mails the body from stdin to ALERT_EMAIL with the subject and returns 0', () => {
    const box = sandbox();
    const result = send(box, '"Disk full"');
    expect(result.stdout).toBe('status=0\n');
    expect(readLog(box.mailLog)).toBe(
      'ARGS: -s Disk full -- a@example.com\nARG<-s>\nARG<Disk full>\nARG<-->\nARG<a@example.com>\ndetails here\n',
    );
    expect(readLog(box.loggerLog)).toBe('');
  });

  it('passes a subject with quotes, percent signs or a leading dash as one argument', () => {
    const box = sandbox();
    send(box, `"-x 100% 'quoted' \\"double\\""`);
    // The whole subject is one argument, then the option terminator, then the address.
    expect(readLog(box.mailLog)).toContain(`ARG<-s>\nARG<-x 100% 'quoted' "double">\nARG<-->\nARG<a@example.com>\n`);
  });

  it('drops the message with status 3, warning on stderr and in syslog, when there is no recipient', () => {
    const box = sandbox();
    const result = send(box, '"Disk full"', {}, '');
    expect(result.stdout).toBe('status=3\n');
    expect(result.stderr).toContain('no alert recipient');
    expect(result.stderr).toContain('Disk full');
    expect(readLog(box.mailLog)).toBe('');
    expect(readLog(box.loggerLog)).toContain('-t murphys-alerts -p user.warning');
    expect(readLog(box.loggerLog)).toContain('no alert recipient');
  });

  it.each([
    ['has no @', 'ops'],
    ['starts with a dash (would be read as an option)', '-Sfoo@example.com'],
    ['contains a space', 'Ops <a@example.com>'],
  ])('refuses a recipient that %s, with status 4', (_name, recipient) => {
    const box = sandbox();
    const result = send(box, '"Disk full"', {}, recipient);
    expect(result.stdout).toBe('status=4\n');
    expect(result.stderr).toContain('not a valid address');
    expect(readLog(box.mailLog)).toBe('');
    expect(readLog(box.loggerLog)).toContain('not a valid address');
  });

  it('accepts a comma-separated list, ignores spaces around the commas, and passes each address on its own', () => {
    const box = sandbox();
    const result = send(box, '"Disk full"', {}, 'a@example.com, b@example.com ,c@example.com,');
    expect(result.stdout).toBe('status=0\n');
    expect(readLog(box.mailLog)).toBe(
      'ARGS: -s Disk full -- a@example.com b@example.com c@example.com\n' +
        'ARG<-s>\nARG<Disk full>\nARG<-->\nARG<a@example.com>\nARG<b@example.com>\nARG<c@example.com>\ndetails here\n',
    );
  });

  it.each([
    ['one bad address in a list', 'a@example.com, ops'],
    ['an address with a space inside', 'a@example.com, Ops <b@example.com>'],
    ['an option-looking address in a list', 'a@example.com,-Sfoo@example.com'],
    ['only commas and spaces', ' , ,'],
  ])('refuses a list with %s, with status 4, and sends nothing', (_name, recipient) => {
    const box = sandbox();
    const result = send(box, '"Disk full"', {}, recipient);
    expect(result.stdout).toBe('status=4\n');
    expect(result.stderr).toContain('not a valid address');
    expect(readLog(box.mailLog)).toBe('');
  });

  it("returns mail's own status and logs it when mail fails", () => {
    const box = sandbox();
    const result = send(box, '"Disk full"', { MAIL_EXIT: '1' });
    expect(result.stdout).toBe('status=1\n');
    expect(result.stderr).toContain('mail exited with status 1');
    expect(readLog(box.loggerLog)).toContain('mail exited with status 1');
  });

  it('returns 127 and says so when the mail command is not installed', () => {
    const box = sandbox();
    // A PATH holding only `cat`, set from inside the script so bash itself can still be found. (A real
    // /usr/bin/mail exists on macOS, so the usual PATH cannot be used to simulate a missing mail.)
    const bare = path.join(box.root, 'bare');
    mkdirSync(bare);
    symlinkSync('/bin/cat', path.join(bare, 'cat'));
    const result = bash('PATH="$BARE_BIN"; ALERT_EMAIL=a@example.com; send_alert_mail "Disk full"; echo "status=$?"', box, { BARE_BIN: bare }, 'x\n');
    expect(result.stdout).toBe('status=127\n');
    expect(result.stderr).toContain('mail command is not installed or not on PATH');
    expect(result.stderr).toContain(bare);
  });

  it('survives being called with no arguments under set -u, and still drains stdin', () => {
    const box = sandbox();
    const result = bash('set -u; ALERT_EMAIL=""; send_alert_mail; echo "status=$?"', box, {}, 'details\n');
    expect(result.stdout).toBe('status=3\n');
    expect(result.stderr).not.toContain('unbound variable');
  });
});

describe('describe_alert_mail_status', () => {
  it.each([
    ['0', 'sent'],
    ['3', 'no recipient configured'],
    ['4', 'invalid recipient'],
    ['127', 'mail command not found'],
    ['1', 'mail exited with status 1'],
    ['75', 'mail exited with status 75'],
  ])('describes %s as "%s"', (status, words) => {
    expect(bash(`describe_alert_mail_status ${status}`, sandbox()).stdout).toBe(`${words}\n`);
  });
});

describe('delivery_exit_code', () => {
  const code = (env: string, arg: string) => bash(`${env}delivery_exit_code ${arg}`, sandbox()).stdout;

  it('turns a successful run into exit code 2 when something was not delivered', () => {
    expect(code('ALERT_UNDELIVERED=1; ', '0')).toBe('2\n');
  });

  it('leaves a failing exit code alone, whether or not something was undelivered', () => {
    expect(code('ALERT_UNDELIVERED=1; ', '1')).toBe('1\n');
    expect(code('', '1')).toBe('1\n');
  });

  it('keeps exit code 0 when everything was delivered or the flag was never set, also under set -u', () => {
    expect(code('ALERT_UNDELIVERED=0; ', '0')).toBe('0\n');
    expect(code('set -u; ', '0')).toBe('0\n');
    expect(bash('set -u; delivery_exit_code', sandbox()).stdout).toBe('0\n');
  });
});
