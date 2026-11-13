import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLog, runFile, sandbox, scriptsDir } from '../helpers/shell-sandbox.ts';

// Runs the real run-cron-job.sh, copied into a scratch backend/scripts so it finds its backend directory, log
// directory and alert-email.sh there. `mail` is the recording fake of the sandbox.

function setup(jobBody: string) {
  const box = sandbox();
  const scripts = path.join(box.root, 'backend/scripts');
  mkdirSync(scripts, { recursive: true });
  for (const name of ['run-cron-job.sh', 'alert-email.sh']) copyFileSync(path.join(scriptsDir, name), path.join(scripts, name));
  chmodSync(path.join(scripts, 'run-cron-job.sh'), 0o755);
  const job = path.join(scripts, 'job.sh');
  writeFileSync(job, jobBody);
  chmodSync(job, 0o755);
  const logs = path.join(box.root, 'backend/logs');
  const state = (name: string): Record<string, string> =>
    Object.fromEntries(
      readLog(path.join(logs, 'cron-state', `${name}.state`))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('=') as [string, string]),
    );
  const run = (name = 'nightly', env: Record<string, string> = {}, command: string[] = [job]) =>
    runFile(path.join(scripts, 'run-cron-job.sh'), [name, ...command], box, { ALERT_EMAIL: 'ops@example.com', ...env });
  return { box, logs, state, run, log: (name = 'nightly') => readLog(path.join(logs, `${name}.log`)), mails: () => readLog(box.mailLog) };
}

describe('run-cron-job.sh', () => {
  it('logs a successful run, records it and sends no mail', () => {
    const job = setup('#!/bin/bash\necho "did the work in $PWD"\n');

    const result = job.run();

    expect(result.status, result.stderr).toBe(0);
    expect(job.log()).toMatch(/nightly: start ===\ndid the work in .*\/backend\n=== .* nightly: end, exit status 0 ===\n/);
    const state = job.state('nightly');
    expect(state.last_status).toBe('0');
    expect(state.failures).toBe('0');
    expect(state.last_success).toBe(state.last_end);
    expect(Number(state.last_start)).toBeLessThanOrEqual(Number(state.last_end));
    expect(job.mails()).toBe('');
    expect(readdirSync(path.join(job.logs, 'cron-state'))).toEqual(['nightly.state']);
  });

  it('keeps the exit status of a failing job, mails one alert with the job, the status and the log tail', () => {
    const job = setup('#!/bin/bash\nfor i in $(seq 1 30); do echo "line $i"; done\necho "boom" >&2\nexit 3\n');

    const result = job.run();

    expect(result.status).toBe(3);
    expect(job.mails().match(/^ARGS: /gm)).toHaveLength(1);
    const mail = job.mails();
    expect(mail).toContain("ARG<Murphy's Laws cron job failed: nightly (exit 3)>");
    expect(mail).toContain('ARG<ops@example.com>');
    expect(mail).toContain("The nightly cron job 'nightly' exited with status 3.");
    expect(mail).toContain('Failures in a row: 1');
    expect(mail).toContain('boom');
    expect(mail).toContain('line 30');
    expect(mail).not.toContain('line 5\n');
    const state = job.state('nightly');
    expect(state.last_status).toBe('3');
    expect(state.failures).toBe('1');
    expect(state).not.toHaveProperty('last_success');
  });

  it('mails on the 1st, 2nd, 4th and 8th failure in a row only, and a success resets the count and keeps no mail', () => {
    const marker = '#!/bin/bash\n[ -f "$(dirname "$0")/ok" ] && exit 0\nexit 1\n';
    const job = setup(marker);
    const counts: number[] = [];
    for (let run = 1; run <= 8; run += 1) {
      job.run();
      counts.push((job.mails().match(/^ARGS: /gm) ?? []).length);
    }
    expect(counts).toEqual([1, 2, 2, 3, 3, 3, 3, 4]);
    expect(job.log()).toContain('alert for nightly skipped: failure 3 in a row');

    writeFileSync(path.join(job.box.root, 'backend/scripts/ok'), '');
    const success = job.run();
    expect(success.status).toBe(0);
    expect(job.state('nightly').failures).toBe('0');
    expect((job.mails().match(/^ARGS: /gm) ?? []).length).toBe(4);

    rmSync(path.join(job.box.root, 'backend/scripts/ok'));
    job.run();
    expect((job.mails().match(/^ARGS: /gm) ?? []).length).toBe(5);
    expect(job.state('nightly').failures).toBe('1');
    expect(job.state('nightly')).toHaveProperty('last_success');
  });

  it('gives the job CRON_JOB_TIMEOUT seconds (1800 by default) and reports a timeout, which `timeout` ends with status 124', () => {
    // `timeout` is not on every machine that runs the tests, so a stand-in records its limit and ends like the real one
    const job = setup('#!/bin/bash\nexit 0\n');
    const limits = path.join(job.box.root, 'timeout.log');
    writeFileSync(path.join(job.box.bin, 'timeout'), `#!/bin/bash\necho "$1" >> "${limits}"\n[ -z "\${FAKE_TIMEOUT:-}" ] || exit 124\nshift\n"$@"\n`);
    chmodSync(path.join(job.box.bin, 'timeout'), 0o755);

    expect(job.run().status).toBe(0);
    expect(job.run('nightly', { CRON_JOB_TIMEOUT: '60' }).status).toBe(0);
    expect(readLog(limits)).toBe('1800\n60\n');

    const timedOut = job.run('nightly', { FAKE_TIMEOUT: '1' });
    expect(timedOut.status).toBe(124);
    expect(job.mails()).toContain('(timed out)');
    expect(job.state('nightly').last_status).toBe('124');
  });

  it('logs and alerts when the command does not exist', () => {
    const job = setup('#!/bin/bash\n');

    const result = job.run('nightly', {}, ['/no/such/command']);

    expect(result.status).toBe(127);
    expect(job.log()).toContain('/no/such/command');
    expect(job.mails()).toContain('exit 127');
  });

  it('logs that the alert was not sent when no recipient is configured, and keeps the exit status of the job', () => {
    const failing = setup('#!/bin/bash\nexit 5\n');

    const result = failing.run('nightly', { ALERT_EMAIL: '', EMAIL_TO: '' });

    expect(result.status).toBe(5);
    expect(failing.log()).toContain('alert for nightly not sent: no recipient configured');
  });

  it('records each job under its own name', () => {
    const job = setup('#!/bin/bash\nexit 0\n');

    job.run('daily-email');
    job.run('daily-push');

    expect(readdirSync(path.join(job.logs, 'cron-state')).sort()).toEqual(['daily-email.state', 'daily-push.state']);
    expect(existsSync(path.join(job.logs, 'daily-email.log'))).toBe(true);
  });

  it.each([[[]], [['only-a-name']], [['bad name', 'true']], [['../escape', 'true']]])('refuses a bad call %j', (args) => {
    const job = setup('#!/bin/bash\n');
    const result = runFile(path.join(job.box.root, 'backend/scripts/run-cron-job.sh'), args, job.box, {});

    expect(result.status).toBe(64);
    expect(result.stderr).toContain('usage: run-cron-job.sh');
  });

  it('writes a state file that is never half-written: no temporary file is left behind', () => {
    const job = setup('#!/bin/bash\nexit 0\n');

    job.run();

    expect(readdirSync(path.join(job.logs, 'cron-state'), { withFileTypes: true }).every((entry) => !entry.name.startsWith('.'))).toBe(true);
  });
});
