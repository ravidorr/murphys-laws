import { spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readLog, sandbox, scratchDir, type Sandbox } from '../helpers/shell-sandbox.ts';

const backendDir = path.resolve(__dirname, '../..');

interface Outcome {
  status: number | null;
  stdout: string;
  stderr: string;
}

const children = new Set<ChildProcess>();

// A script that outlives its test (a timeout, a failed assertion) is stopped rather than left running.
afterEach(() => {
  for (const child of children) {
    child.kill('SIGKILL');
  }
  children.clear();
});

/** Runs a script file with tsx in a clean environment. Async, so an in-process SMTP server can answer. */
function runScript(script: string, args: string[], env: Record<string, string>): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', path.join(backendDir, 'scripts', script), ...args], {
      cwd: backendDir,
      env: { PATH: '/usr/bin:/bin', ...env },
    });
    children.add(child);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

/** A port nothing is listening on: bound to an ephemeral port, then released. */
function closedPort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** A local site: `/` answers like a healthy frontend and `/health` like a healthy API with a slow database. */
function startAppServer(dbQueryTime: number): Promise<{ frontend: string; api: string; close: () => Promise<void> }> {
  const server = http.createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, dbQueryTime }));
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<html></html>');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
      resolve({
        frontend: base,
        api: `${base}/health`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

/** A minimal SMTP server that accepts any mail (or rejects every recipient) and records every RCPT TO address. */
function startSmtpServer({ rejectRecipients = false } = {}): Promise<{ port: number; recipients: string[]; close: () => Promise<void> }> {
  const recipients: string[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let buffer = '';
    let inData = false;
    socket.write('220 test ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) {
            return;
          }
          buffer = buffer.slice(end + 5);
          inData = false;
          socket.write('250 queued\r\n');
          continue;
        }
        const eol = buffer.indexOf('\r\n');
        if (eol === -1) {
          return;
        }
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO')) {
          socket.write('250-test\r\n250 AUTH PLAIN\r\n');
        } else if (command.startsWith('AUTH')) {
          socket.write('235 ok\r\n');
        } else if (command.startsWith('RCPT TO:')) {
          recipients.push(line.slice('RCPT TO:'.length).replace(/[<>\s]/g, ''));
          socket.write(rejectRecipients ? '550 no such user\r\n' : '250 ok\r\n');
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 go\r\n');
        } else if (command === 'QUIT') {
          socket.write('221 bye\r\n');
          socket.end();
        } else {
          socket.write('250 ok\r\n');
        }
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: (server.address() as net.AddressInfo).port,
        recipients,
        close: () =>
          new Promise<void>((done) => {
            sockets.forEach((socket) => socket.destroy());
            server.close(() => done());
          }),
      });
    });
  });
}

describe('health-check.ts', () => {
  // Blank values stop a developer's backend/.env (loaded by the script) from filling them in, and
  // REPO_ROOT points the recipient lookup at an empty directory instead of the real repository.
  const noConfig = (extra: Record<string, string> = {}) => ({
    ALERT_EMAIL: '',
    EMAIL_TO: '',
    HEALTH_CHECK_EMAIL_TO: '',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    REPO_ROOT: scratchDir('health-check-root-'),
    ...extra,
  });
  const smtp = (port: number) => ({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_USER: 'user', SMTP_PASS: 'pass' });
  let deadEndpoints: Record<string, string>;
  let closeServer: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const port = await closedPort();
    deadEndpoints = {
      HEALTH_CHECK_FRONTEND_URL: `http://127.0.0.1:${port}`,
      HEALTH_CHECK_API_URL: `http://127.0.0.1:${port}/health`,
    };
  });

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  it('still runs its checks when there is no recipient: warns, and says the alert email was NOT sent', async () => {
    const result = await runScript('health-check.ts', [], { ...noConfig(smtp(9)), ...deadEndpoints });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Running health check');
    expect(result.stderr).toContain('no alert recipient (set HEALTH_CHECK_EMAIL_TO, ALERT_EMAIL or EMAIL_TO)');
    expect(result.stderr).toContain('Health check FAILED. ALERT EMAIL NOT SENT.');
  });

  it('still runs its checks when SMTP is not configured: warns, and says the alert email was NOT sent', async () => {
    const result = await runScript('health-check.ts', [], { ...noConfig({ EMAIL_TO: 'admin@example.com' }), ...deadEndpoints });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Running health check');
    expect(result.stderr).toContain('SMTP not configured');
    expect(result.stderr).toContain('Health check FAILED. ALERT EMAIL NOT SENT.');
  });

  describe('with --no-email (as health-monitor.sh runs it)', () => {
    it('reports a failed check by exit code 1 and output only, sends nothing and needs no email settings', async () => {
      const server = await startSmtpServer();
      closeServer = server.close;
      const result = await runScript('health-check.ts', ['--no-email'], {
        ...noConfig({ EMAIL_TO: 'admin@example.com' }),
        ...deadEndpoints,
        ...smtp(server.port),
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Health check FAILED.');
      expect(result.stderr).not.toContain('Alert email');
      expect(result.stderr).not.toContain('ALERT EMAIL');
      expect(server.recipients).toEqual([]);

      const bare = await runScript('health-check.ts', ['--no-email'], { ...noConfig(), ...deadEndpoints });
      expect(bare.status).toBe(1);
      expect(bare.stderr).not.toContain('SMTP not configured');
      expect(bare.stderr).not.toContain('no alert recipient');
    }, 60_000);

    it('does not look at the recipient, so an invalid one cannot stop the checks', async () => {
      const result = await runScript('health-check.ts', ['--no-email'], { ...noConfig({ EMAIL_TO: 'ops' }), ...deadEndpoints });
      expect(result.status).toBe(1);
      expect(result.stderr).not.toContain('Invalid alert recipient');
    }, 60_000);
  });

  it.each([
    ['HEALTH_CHECK_EMAIL_TO first', { HEALTH_CHECK_EMAIL_TO: 'health@example.com', ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' }, 'health@example.com'],
    ['then ALERT_EMAIL', { ALERT_EMAIL: 'alerts@example.com', EMAIL_TO: 'admin@example.com' }, 'alerts@example.com'],
    ['then EMAIL_TO', { EMAIL_TO: 'admin@example.com' }, 'admin@example.com'],
  ])('sends its failure alert to the right address: %s', async (_name, recipients, expected) => {
    const server = await startSmtpServer();
    closeServer = server.close;
    const result = await runScript('health-check.ts', [], { ...noConfig(), ...deadEndpoints, ...smtp(server.port), ...recipients });
    expect(result.stdout).toContain('Running health check');
    expect(result.stdout).toContain('Alert email sent');
    expect(result.stderr).toContain('Health check FAILED. Alert email sent.');
    expect(result.status).toBe(1);
    expect(server.recipients).toEqual([expected]);
  }, 60_000);

  it('sends a comma-separated recipient list to every address', async () => {
    const server = await startSmtpServer();
    closeServer = server.close;
    const result = await runScript('health-check.ts', [], {
      ...noConfig({ EMAIL_TO: 'first@example.com, second@example.com' }),
      ...deadEndpoints,
      ...smtp(server.port),
    });
    expect(result.status).toBe(1);
    expect(server.recipients.sort()).toEqual(['first@example.com', 'second@example.com']);
  }, 60_000);

  it.each([
    ['an address without an @', 'ops'],
    ['an option-looking address', '-Sfoo@example.com'],
    ['one bad entry in a list', 'first@example.com, ops'],
  ])('stops at startup with exit code 2 for %s, before any check runs', async (_name, recipient) => {
    const result = await runScript('health-check.ts', [], {
      ...noConfig({ EMAIL_TO: recipient }),
      ...deadEndpoints,
      ...smtp(9),
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Invalid alert recipient');
    expect(result.stdout).not.toContain('Running health check');
  });

  describe('when the site is up but slow (warnings only)', () => {
    let app: Awaited<ReturnType<typeof startAppServer>>;

    beforeAll(async () => {
      app = await startAppServer(1500);
    });
    afterAll(async () => {
      await app.close();
    });
    const slow = () => ({ HEALTH_CHECK_FRONTEND_URL: app.frontend, HEALTH_CHECK_API_URL: app.api });

    it('emails the warning and exits 0 when the email is delivered', async () => {
      const server = await startSmtpServer();
      closeServer = server.close;
      const result = await runScript('health-check.ts', [], {
        ...noConfig({ EMAIL_TO: 'admin@example.com' }),
        ...slow(),
        ...smtp(server.port),
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Alert email sent: Health Check Warning');
      expect(result.stderr).toContain('passed with WARNINGS. Alert email sent.');
      expect(server.recipients).toEqual(['admin@example.com']);
    }, 60_000);

    it('exits 3 and does not email the warning with --no-email, so the caller can', async () => {
      const server = await startSmtpServer();
      closeServer = server.close;
      const result = await runScript('health-check.ts', ['--no-email'], {
        ...noConfig({ EMAIL_TO: 'admin@example.com' }),
        ...slow(),
        ...smtp(server.port),
      });
      expect(result.status).toBe(3);
      expect(result.stderr).toContain('passed with WARNINGS. Not emailed (--no-email).');
      expect(result.stdout + result.stderr).toContain('Database query time is slow');
      expect(server.recipients).toEqual([]);
    }, 60_000);

    it('exits 3, and says the email was NOT sent, when SMTP is not configured', async () => {
      const result = await runScript('health-check.ts', [], { ...noConfig({ EMAIL_TO: 'admin@example.com' }), ...slow() });
      expect(result.status).toBe(3);
      expect(result.stderr).toContain('passed with WARNINGS. ALERT EMAIL NOT SENT.');
    }, 60_000);

    it('exits 3, and says the email was NOT sent, when the SMTP server refuses it', async () => {
      const server = await startSmtpServer({ rejectRecipients: true });
      closeServer = server.close;
      const result = await runScript('health-check.ts', [], {
        ...noConfig({ EMAIL_TO: 'admin@example.com' }),
        ...slow(),
        ...smtp(server.port),
      });
      expect(result.status).toBe(3);
      expect(result.stderr).toContain('passed with WARNINGS. ALERT EMAIL NOT SENT.');
    }, 60_000);
  });

  it('finds the recipient in the root .env, the same file health-check.sh reads, when cron gives it no environment', async () => {
    const server = await startSmtpServer();
    closeServer = server.close;
    const root = scratchDir('health-check-root-');
    writeFileSync(path.join(root, '.env'), 'EMAIL_TO="root@example.com" # on-call\n');
    const result = await runScript('health-check.ts', [], { ...noConfig({ REPO_ROOT: root }), ...deadEndpoints, ...smtp(server.port) });
    expect(server.recipients).toEqual(['root@example.com']);
    expect(result.status).toBe(1);
  }, 60_000);

  it('says the alert email was NOT sent when the SMTP server refuses it, and still exits 1 for the failed check', async () => {
    const server = await startSmtpServer({ rejectRecipients: true });
    closeServer = server.close;
    const result = await runScript('health-check.ts', [], { ...noConfig({ EMAIL_TO: 'admin@example.com' }), ...deadEndpoints, ...smtp(server.port) });
    expect(result.stderr).toContain('Failed to send alert email');
    expect(result.stderr).toContain('Health check FAILED. ALERT EMAIL NOT SENT.');
    expect(result.stderr).not.toContain('Alert email sent');
    expect(result.status).toBe(1);
  }, 60_000);
});

describe('render-daily-report.ts as run by cron', () => {
  /** A fake sendmail that records its arguments and the message it is given. */
  function withSendmail(files: Record<string, string> = {}): Sandbox & { sendmailLog: string } {
    const box = sandbox(files);
    const sendmailLog = path.join(box.root, 'sendmail.log');
    writeFileSync(path.join(box.bin, 'sendmail'), `#!/bin/bash\n{ echo "ARGS: $*"; cat; } >> "$SENDMAIL_LOG"\n`);
    chmodSync(path.join(box.bin, 'sendmail'), 0o755);
    // A fake pm2 with nothing running, so the collector never looks for (or starts) a real one on the host.
    writeFileSync(path.join(box.bin, 'pm2'), '#!/bin/bash\necho "[]"\n');
    chmodSync(path.join(box.bin, 'pm2'), 0o755);
    mkdirSync(path.join(box.root, 'backend'), { recursive: true });
    return { ...box, sendmailLog };
  }
  // No environment at all except PATH and REPO_ROOT, as under cron.
  const cron = (box: Sandbox & { sendmailLog: string }, env: Record<string, string> = {}) =>
    runScript('render-daily-report.ts', [], {
      PATH: `${box.bin}:/usr/bin:/bin`,
      REPO_ROOT: box.root,
      PM2_PATH: path.join(box.bin, 'pm2'),
      SENDMAIL_LOG: box.sendmailLog,
      ...env,
    });

  it('finds the recipient in the server .env and emails the report there', async () => {
    const box = withSendmail({ 'backend/.env': 'EMAIL_TO="ops@example.com" # on-call\n' });
    const result = await cron(box);
    expect(result.stderr).not.toContain('No alert recipient');
    expect(result.status).toBe(0);
    const sent = readLog(box.sendmailLog);
    expect(sent).toContain('ARGS: -t ops@example.com');
    expect(sent).toContain('To: ops@example.com');
  }, 90_000);

  it('prefers ALERT_EMAIL over EMAIL_TO from the .env files', async () => {
    const box = withSendmail({ 'backend/.env': 'EMAIL_TO=admin@example.com\nALERT_EMAIL=alerts@example.com\n' });
    const result = await cron(box);
    expect(result.status).toBe(0);
    expect(readLog(box.sendmailLog)).toContain('ARGS: -t alerts@example.com');
  }, 90_000);

  it('sends to every address of a comma-separated list, as separate sendmail arguments', async () => {
    const box = withSendmail({ 'backend/.env': 'ALERT_EMAIL="first@example.com, second@example.com"\n' });
    const result = await cron(box);
    expect(result.status).toBe(0);
    const sent = readLog(box.sendmailLog);
    expect(sent).toContain('ARGS: -t first@example.com second@example.com');
    expect(sent).toContain('To: first@example.com, second@example.com');
  }, 90_000);

  it('refuses an option-looking recipient with exit code 1 before collecting anything, and sends nothing', async () => {
    const box = withSendmail({ 'backend/.env': 'ALERT_EMAIL=-Sfoo@example.com\n' });
    const result = await cron(box);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("'-Sfoo@example.com' is not a valid email address");
    expect(readLog(box.sendmailLog)).toBe('');
  }, 90_000);

  it('stops with exit code 1 and an error, and sends nothing, when no recipient is configured anywhere', async () => {
    const box = withSendmail({ 'backend/.env': 'OTHER=1\n' });
    const result = await cron(box);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No alert recipient. Set ALERT_EMAIL or EMAIL_TO');
    expect(readLog(box.sendmailLog)).toBe('');
  }, 90_000);
});
