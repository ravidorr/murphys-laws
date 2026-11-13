import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLog, runFile, sandbox, scriptsDir, type Sandbox } from '../helpers/shell-sandbox.ts';

// Runs the real install-law-of-day-cron.sh against a scratch app directory and a scratch /etc/cron.d, with a
// fake `crontab` that keeps root's crontab in a file. Nothing outside the sandbox is touched.

const installer = path.join(scriptsDir, 'install-law-of-day-cron.sh');
const cronSource = path.resolve(scriptsDir, '../config/cron.d/murphys-laws-law-of-day');
const INSTALLED = 'murphys-laws-law-of-day';
const OLD_LINE = '0 0 * * * cd /root/murphys-laws && /usr/bin/node backend/scripts/select-law-of-day.mjs >> logs/law-of-day.log 2>&1';
const BACKUP_LINE = '0 4 * * * /usr/local/bin/backup-murphys.sh >> /var/log/backup-murphys.log 2>&1';
const HEALTH_LINE = '*/5 * * * * /usr/local/bin/health-monitor.sh > /dev/null 2>&1';

// `crontab -l` prints the file (or fails with "no crontab" when there is none); `crontab -` replaces it. Every
// call is logged. $FAKE_CRONTAB_LIST_FAILS makes `crontab -l` fail although a crontab exists, with the message
// in it; $FAKE_CRONTAB_WRITE_FAILS makes `crontab -` fail.
const FAKE_CRONTAB = `#!/bin/bash
echo "crontab $*" >> "$CRONTAB_LOG"
case "$1" in
  -l) [ -n "\${FAKE_CRONTAB_LIST_FAILS:-}" ] && { echo "$FAKE_CRONTAB_LIST_FAILS" >&2; exit 1; }; [ -f "$CRONTAB_FILE" ] || { echo "no crontab for root" >&2; exit 1; }; cat "$CRONTAB_FILE" ;;
  -) cat > "$CRONTAB_FILE.new"; [ -n "\${FAKE_CRONTAB_WRITE_FAILS:-}" ] && { echo "fake crontab: cannot write" >&2; exit 1; }; mv "$CRONTAB_FILE.new" "$CRONTAB_FILE" ;;
  *) echo "fake crontab: unsupported $*" >&2; exit 2 ;;
esac
`;

interface Install {
  box: Sandbox;
  app: string;
  cronD: string;
  installed: string;
  crontabFile: string;
  crontabLog: string;
  run: (env?: Record<string, string>) => ReturnType<typeof runFile>;
}

interface Options {
  crontab?: string;
  withSource?: boolean;
  withTsx?: boolean;
  withJobScript?: boolean;
  nvmrc?: string | null;
  nodeVersion?: string;
}

/**
 * A scratch release the installer can accept: the schedule file, tsx, an .nvmrc, and a `node` of the same major
 * version (the real one is /usr/bin/node, which the tests replace through NODE_BIN).
 */
function setup({ crontab, withSource = true, withTsx = true, withJobScript = true, nvmrc = '22.16.0\n', nodeVersion = 'v22.20.0' }: Options = {}): Install {
  const box = sandbox();
  const app = path.join(box.root, 'app');
  const cronD = path.join(box.root, 'etc-cron.d');
  const crontabFile = path.join(box.root, 'root-crontab');
  const crontabLog = path.join(box.root, 'crontab.log');
  const node = path.join(box.root, 'fake-node');
  mkdirSync(path.join(app, 'backend/config/cron.d'), { recursive: true });
  mkdirSync(path.join(app, 'backend/scripts'), { recursive: true });
  mkdirSync(cronD);
  if (withSource) {
    copyFileSync(cronSource, path.join(app, 'backend/config/cron.d', INSTALLED));
  }
  if (withTsx) {
    mkdirSync(path.join(app, 'backend/node_modules/tsx/dist'), { recursive: true });
    writeFileSync(path.join(app, 'backend/node_modules/tsx/dist/cli.mjs'), '// tsx\n');
  }
  if (withJobScript) {
    writeFileSync(path.join(app, 'backend/scripts/select-law-of-day.ts'), '// current\n');
  }
  if (nvmrc !== null) {
    writeFileSync(path.join(app, '.nvmrc'), nvmrc);
  }
  if (crontab !== undefined) {
    writeFileSync(crontabFile, crontab);
  }
  // `node -e <code>` is the load of better-sqlite3: it fails when $FAKE_NODE_LOAD_FAILS is set
  writeFileSync(node, `#!/bin/bash\nif [ "$1" = "-e" ]; then echo "$PWD" >> "$(dirname "$0")/node-load.log"; [ -z "\${FAKE_NODE_LOAD_FAILS:-}" ] || { echo "Error: was compiled against a different Node.js version" >&2; exit 1; }; exit 0; fi\necho "${nodeVersion}"\n`);
  chmodSync(node, 0o755);
  writeFileSync(path.join(box.bin, 'crontab'), FAKE_CRONTAB);
  chmodSync(path.join(box.bin, 'crontab'), 0o755);
  return {
    box,
    app,
    cronD,
    installed: path.join(cronD, INSTALLED),
    crontabFile,
    crontabLog,
    run: (env = {}) => runFile(installer, [app], box, { TMPDIR: box.root, CRON_D_DIR: cronD, NODE_BIN: node, CRONTAB_FILE: crontabFile, CRONTAB_LOG: crontabLog, ...env }),
  };
}

describe('install-law-of-day-cron.sh', () => {
  it('installs the schedule from the repository into cron.d, as cron requires it', () => {
    const install = setup();

    const result = install.run();

    expect(result.status, result.stderr).toBe(0);
    // better-sqlite3 is loaded from the backend directory of the release, where the job's `cd` finds it
    expect(readLog(path.join(install.box.root, 'node-load.log')).trim()).toMatch(/\/app\/backend$/);
    expect(readFileSync(install.installed, 'utf8')).toBe(readFileSync(cronSource, 'utf8'));
    // cron ignores a file in cron.d that the group or others can write to
    expect(statSync(install.installed).mode & 0o7777).toBe(0o644);
    expect(statSync(install.installed).isFile()).toBe(true);
    expect(result.stdout).toContain('Installed');
    expect(result.stderr).toBe('');
  });

  it('leaves nothing but the schedule in cron.d, so no temporary file is read as a job', () => {
    const install = setup();
    writeFileSync(path.join(install.cronD, 'other-job'), '# someone else\n');

    expect(install.run().status).toBe(0);

    expect(readdirSync(install.cronD).sort()).toEqual([INSTALLED, 'other-job']);
    expect(readFileSync(path.join(install.cronD, 'other-job'), 'utf8')).toBe('# someone else\n');
  });

  it('creates the log directory the job appends to, and keeps what is in it', () => {
    const install = setup();
    mkdirSync(path.join(install.app, 'backend/logs'));
    writeFileSync(path.join(install.app, 'backend/logs/law-of-day.log'), 'earlier run\n');

    expect(install.run().status).toBe(0);
    expect(readFileSync(path.join(install.app, 'backend/logs/law-of-day.log'), 'utf8')).toBe('earlier run\n');

    const fresh = setup();
    expect(existsSync(path.join(fresh.app, 'backend/logs'))).toBe(false);
    expect(fresh.run().status).toBe(0);
    expect(statSync(path.join(fresh.app, 'backend/logs')).isDirectory()).toBe(true);
  });

  it('is safe to run on every deploy: the second run changes nothing', () => {
    const install = setup({ crontab: `${BACKUP_LINE}\n${OLD_LINE}\n` });

    expect(install.run().status).toBe(0);
    const installed = readFileSync(install.installed, 'utf8');
    const crontab = readFileSync(install.crontabFile, 'utf8');
    const second = install.run();

    expect(second.status, second.stderr).toBe(0);
    expect(readFileSync(install.installed, 'utf8')).toBe(installed);
    expect(readFileSync(install.crontabFile, 'utf8')).toBe(crontab);
    expect(second.stdout).not.toContain('Removed');
    expect(second.stderr).toBe('');
  });

  it('replaces a copy that was edited on the server', () => {
    const install = setup();
    writeFileSync(install.installed, '30 3 * * * root true\n');
    chmodSync(install.installed, 0o666);

    expect(install.run().status).toBe(0);
    expect(readFileSync(install.installed, 'utf8')).toBe(readFileSync(cronSource, 'utf8'));
    expect(statSync(install.installed).mode & 0o777).toBe(0o644);
  });

  it('replaces a symlink with a regular file instead of writing through it', () => {
    const install = setup();
    // cron does not read a symlink in cron.d, and the installer must not write into where it points
    const target = path.join(install.box.root, 'elsewhere');
    writeFileSync(target, 'untouched\n');
    symlinkSync(target, install.installed);

    expect(install.run().status).toBe(0);
    expect(lstatSync(install.installed).isSymbolicLink()).toBe(false);
    expect(readFileSync(install.installed, 'utf8')).toBe(readFileSync(cronSource, 'utf8'));
    expect(readFileSync(target, 'utf8')).toBe('untouched\n');
  });

  describe("root's crontab", () => {
    it('loses the old line and keeps every other line, written once', () => {
      const install = setup({ crontab: `# Backup\n${BACKUP_LINE}\n${OLD_LINE}\n${HEALTH_LINE}\n` });

      const result = install.run();

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`# Backup\n${BACKUP_LINE}\n${HEALTH_LINE}\n`);
      expect(result.stdout).toContain("Removed the old select-law-of-day.mjs line from root's crontab");
      expect(readLog(install.crontabLog)).toBe('crontab -l\ncrontab -\n');
      expect(result.stderr).toBe('');
      expect(readdirSync(install.box.root).filter((name) => name.startsWith('root-crontab')).sort()).toEqual(['root-crontab']);
    });

    it('is never rewritten when it has no old line, so the job cannot run twice and nothing else changes', () => {
      const install = setup({ crontab: `${BACKUP_LINE}\n` });

      expect(install.run().status).toBe(0);
      expect(readLog(install.crontabLog)).toBe('crontab -l\n');
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${BACKUP_LINE}\n`);
    });

    it('keeps a line that runs the current .ts script by hand, which is not the retired job', () => {
      const handLine = '30 3 * * * cd /root/murphys-laws/backend && /usr/bin/node node_modules/tsx/dist/cli.mjs scripts/select-law-of-day.ts';
      const install = setup({ crontab: `${handLine}\n${OLD_LINE}\n` });

      expect(install.run().status).toBe(0);
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${handLine}\n`);
    });

    it('is not created when root has none, and that is not a problem', () => {
      const install = setup();

      const result = install.run();

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(existsSync(install.crontabFile)).toBe(false);
      expect(readLog(install.crontabLog)).toBe('crontab -l\n');
    });

    it('is never emptied: when the old line is the only entry it stays, with a warning, and the schedule is installed', () => {
      for (const crontab of [`${OLD_LINE}\n`, `${OLD_LINE}\n\n  \n`, `\n${OLD_LINE}`]) {
        const install = setup({ crontab });

        const result = install.run();

        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(install.crontabFile, 'utf8')).toBe(crontab);
        expect(readLog(install.crontabLog)).toBe('crontab -l\n');
        expect(result.stderr).toContain('WARNING: the old select-law-of-day.mjs line is the only entry in root\'s crontab, so it was left in place');
        expect(existsSync(install.installed)).toBe(true);
      }
    });

    it('is never emptied because `crontab -l` failed: it warns and the schedule is still installed', () => {
      const install = setup({ crontab: `${BACKUP_LINE}\n${OLD_LINE}\n` });

      const result = install.run({ FAKE_CRONTAB_LIST_FAILS: 'crontab: cannot read the spool directory' });

      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${BACKUP_LINE}\n${OLD_LINE}\n`);
      expect(readLog(install.crontabLog)).toBe('crontab -l\n');
      expect(result.stderr).toContain("WARNING: could not read root's crontab (exit 1: crontab: cannot read the spool directory), so the old select-law-of-day.mjs line was left in place");
      expect(existsSync(install.installed)).toBe(true);
    });

    it('is left as it was, with a warning, when it cannot be written, and the schedule is still installed', () => {
      const install = setup({ crontab: `${BACKUP_LINE}\n${OLD_LINE}\n` });

      const result = install.run({ FAKE_CRONTAB_WRITE_FAILS: '1' });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain('fake crontab: cannot write');
      expect(result.stderr).toContain("WARNING: could not write root's crontab, so the old select-law-of-day.mjs line was left in place");
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${BACKUP_LINE}\n${OLD_LINE}\n`);
      expect(existsSync(install.installed)).toBe(true);
    });

    it('is left alone, with a warning, when a temporary file for reading it cannot be made', () => {
      const install = setup({ crontab: `${BACKUP_LINE}\n${OLD_LINE}\n` });
      // The installer makes its cron.d temporary file first, with a template, then this one, without
      writeFileSync(path.join(install.box.bin, 'mktemp'), '#!/bin/bash\n[ $# -gt 0 ] && exec /usr/bin/mktemp "$@"\necho "mktemp: cannot create" >&2\nexit 1\n');
      chmodSync(path.join(install.box.bin, 'mktemp'), 0o755);

      const result = install.run();

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("WARNING: could not create a temporary file to read root's crontab, so the old select-law-of-day.mjs line was not looked for");
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${BACKUP_LINE}\n${OLD_LINE}\n`);
      expect(readLog(install.crontabLog)).toBe('');
      expect(existsSync(install.installed)).toBe(true);
    });

    it('is left alone, with a warning, when grep cannot search it', () => {
      const install = setup({ crontab: `${BACKUP_LINE}\n${OLD_LINE}\n` });
      writeFileSync(path.join(install.box.bin, 'grep'), '#!/bin/bash\necho "grep: input error" >&2\nexit 2\n');
      chmodSync(path.join(install.box.bin, 'grep'), 0o755);

      const result = install.run();

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("WARNING: could not search root's crontab for select-law-of-day.mjs, so it was left as it was");
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${BACKUP_LINE}\n${OLD_LINE}\n`);
      expect(readLog(install.crontabLog)).toBe('crontab -l\n');
    });

    it.each([
      ['builds the text without the old line', '-avF', "could not search root's crontab for select-law-of-day.mjs"],
      ['checks that something remains', '-a', "could not search root's crontab for select-law-of-day.mjs"],
    ])('is never written when grep fails while it %s', (_label, firstArgument, warning) => {
      const install = setup({ crontab: `${BACKUP_LINE}\n${OLD_LINE}\n` });
      // Only the grep call that starts with this option fails, the others work: a failing `grep -v` leaves an empty text
      writeFileSync(path.join(install.box.bin, 'grep'), `#!/bin/bash\n[ "$1" = "${firstArgument}" ] && { echo "grep: input error" >&2; exit 2; }\nexec /usr/bin/grep "$@"\n`);
      chmodSync(path.join(install.box.bin, 'grep'), 0o755);

      const result = install.run();

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain(warning);
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${BACKUP_LINE}\n${OLD_LINE}\n`);
      expect(readLog(install.crontabLog)).toBe('crontab -l\n');
    });

    it('keeps the other lines byte for byte: comments, blank lines, MAILTO, a % and an indented line', () => {
      const lines = ['MAILTO=ops@example.com', '', '# Backup', '0 1 * * * echo 100%\\n', OLD_LINE, '  */5 * * * * /usr/local/bin/health-monitor.sh', '', '0 4 * * * true'];
      const install = setup({ crontab: lines.join('\n') });

      expect(install.run().status).toBe(0);

      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${lines.filter((line) => line !== OLD_LINE).join('\n')}\n`);
    });

    it('warns, and goes on, when the temporary file for reading it cannot be removed', () => {
      const install = setup({ crontab: `${BACKUP_LINE}\n${OLD_LINE}\n` });
      // The one file named tmp.* is the one made by mktemp for the crontab's error text
      writeFileSync(path.join(install.box.bin, 'rm'), '#!/bin/bash\ncase "${2:-}" in */tmp.*) echo "rm: cannot remove: Operation not permitted" >&2; exit 1 ;; esac\nexec /bin/rm "$@"\n');
      chmodSync(path.join(install.box.bin, 'rm'), 0o755);

      const result = install.run();

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toMatch(/WARNING: could not remove the temporary file \S+/);
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${BACKUP_LINE}\n`);
    });
  });

  it('removes the old .mjs script, which no deploy ships any more', () => {
    const install = setup();
    writeFileSync(path.join(install.app, 'backend/scripts/select-law-of-day.mjs'), '// Feb 22\n');
    writeFileSync(path.join(install.app, 'backend/scripts/select-law-of-day.ts'), '// current\n');

    expect(install.run().status).toBe(0);
    expect(existsSync(path.join(install.app, 'backend/scripts/select-law-of-day.mjs'))).toBe(false);
    expect(existsSync(path.join(install.app, 'backend/scripts/select-law-of-day.ts'))).toBe(true);
  });

  describe('refuses, and changes nothing, when the job could not start', () => {
    const expectUntouched = (install: Install, crontab: string): void => {
      expect(existsSync(install.installed)).toBe(false);
      expect(existsSync(path.join(install.app, 'backend/logs'))).toBe(false);
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(crontab);
      expect(readdirSync(install.cronD)).toEqual([]);
      expect(readLog(install.crontabLog)).toBe('');
    };

    it('when the release has no schedule file', () => {
      const install = setup({ crontab: `${OLD_LINE}\n`, withSource: false });

      const result = install.run();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('murphys-laws-law-of-day is missing');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when tsx is not installed', () => {
      const install = setup({ crontab: `${OLD_LINE}\n`, withTsx: false });

      const result = install.run();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('tsx/dist/cli.mjs is missing');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when /usr/bin/node is another major version than .nvmrc', () => {
      const install = setup({ crontab: `${OLD_LINE}\n`, nodeVersion: 'v20.11.1' });

      const result = install.run();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('is Node 20 but .nvmrc wants Node 22');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when /usr/bin/node does not exist', () => {
      const install = setup({ crontab: `${OLD_LINE}\n` });

      const result = install.run({ NODE_BIN: path.join(install.box.root, 'no-such-node') });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('no-such-node is not an executable');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when /usr/bin/node cannot report its version', () => {
      const install = setup({ crontab: `${OLD_LINE}\n` });
      const broken = path.join(install.box.root, 'broken-node');
      writeFileSync(broken, '#!/bin/bash\nexit 1\n');
      chmodSync(broken, 0o755);

      const result = install.run({ NODE_BIN: broken });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('broken-node --version printed nothing or failed');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when select-law-of-day.ts is not in the release', () => {
      const install = setup({ crontab: `${OLD_LINE}\n`, withJobScript: false });

      const result = install.run();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('select-law-of-day.ts is missing');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when node cannot load better-sqlite3, although it has the right major version', () => {
      const install = setup({ crontab: `${OLD_LINE}\n` });

      const result = install.run({ FAKE_NODE_LOAD_FAILS: '1' });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('cannot load better-sqlite3');
      expect(result.stderr).toContain('compiled against a different Node.js version');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when there is no crontab command, so no cron to run the file', () => {
      const install = setup({ crontab: `${OLD_LINE}\n` });
      // A PATH with only the tools the installer needs, and no crontab
      const tools = path.join(install.box.root, 'tools');
      mkdirSync(tools);
      for (const tool of ['bash', 'install', 'mktemp', 'tr', 'date', 'cat', 'rm', 'mv', 'id', 'grep']) {
        const found = ['/usr/bin', '/bin'].map((dir) => path.join(dir, tool)).find((candidate) => existsSync(candidate));
        if (found) symlinkSync(found, path.join(tools, tool));
      }

      const result = install.run({ PATH: tools });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('crontab is not installed');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('when there is no .nvmrc to check the Node version against', () => {
      const install = setup({ crontab: `${OLD_LINE}\n`, nvmrc: null });

      const result = install.run();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('.nvmrc is missing');
      expectUntouched(install, `${OLD_LINE}\n`);
    });

    it('and keeps the schedule that is installed when it does', () => {
      const install = setup({ nodeVersion: 'v20.11.1' });
      writeFileSync(install.installed, 'previous schedule\n');

      expect(install.run().status).toBe(1);
      expect(readFileSync(install.installed, 'utf8')).toBe('previous schedule\n');
      expect(readdirSync(install.cronD)).toEqual([INSTALLED]);
    });
  });

  describe('the Node that cron runs', () => {
    it('is accepted when /usr/bin/node has the major version of .nvmrc, whatever the minor and patch', () => {
      const install = setup({ nodeVersion: 'v22.20.0', nvmrc: '22.16.0\n' });

      const result = install.run();

      expect(result.status, result.stderr).toBe(0);
      expect(existsSync(install.installed)).toBe(true);
    });

    it('accepts an .nvmrc written with a leading v or only a major version', () => {
      expect(setup({ nvmrc: 'v22\n' }).run().status).toBe(0);
      expect(setup({ nvmrc: '22' }).run().status).toBe(0);
    });
  });

  describe('the time zone of the server', () => {
    it('is not mentioned when it is UTC', () => {
      const result = setup().run({ TZ: 'UTC' });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    });

    it('is warned about, and the schedule is still installed, when it is not UTC', () => {
      const install = setup();

      const result = install.run({ TZ: 'IST-5:30' });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("WARNING: the server's time zone is UTC+0530;");
      expect(result.stderr).toContain('runs at 00:00 local time and not at 00:00 UTC');
      expect(existsSync(install.installed)).toBe(true);
    });

    it('is warned about west of UTC too', () => {
      const result = setup().run({ TZ: 'PST8' });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("WARNING: the server's time zone is UTC-0800;");
    });
  });

  describe('when the replacement of the cron.d file fails half way', () => {
    it('leaves the schedule that was installed and no temporary file, and does not touch the crontab', () => {
      const install = setup({ crontab: `${OLD_LINE}\n` });
      writeFileSync(install.installed, 'previous schedule\n');
      writeFileSync(path.join(install.box.bin, 'mv'), '#!/bin/bash\necho "mv: cannot rename" >&2\nexit 1\n');
      chmodSync(path.join(install.box.bin, 'mv'), 0o755);

      const result = install.run();

      expect(result.status).not.toBe(0);
      expect(readFileSync(install.installed, 'utf8')).toBe('previous schedule\n');
      expect(readdirSync(install.cronD)).toEqual([INSTALLED]);
      expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${OLD_LINE}\n`);
      expect(readLog(install.crontabLog)).toBe('');
    });
  });

  describe('ownership', () => {
    // `id -u` says 0 and `chown` records what it is asked to do, since the tests cannot be root
    const asRoot = (install: Install, chownFails = false): string => {
      const chownLog = path.join(install.box.root, 'chown.log');
      writeFileSync(path.join(install.box.bin, 'id'), '#!/bin/bash\necho 0\n');
      writeFileSync(path.join(install.box.bin, 'chown'), `#!/bin/bash\necho "$*" >> "${chownLog}"\n${chownFails ? 'echo "chown: not permitted" >&2\nexit 1\n' : ''}`);
      chmodSync(path.join(install.box.bin, 'id'), 0o755);
      chmodSync(path.join(install.box.bin, 'chown'), 0o755);
      return chownLog;
    };

    it('is root:root on the file that replaces the schedule, as root', () => {
      const install = setup();
      const chownLog = asRoot(install);

      expect(install.run().status).toBe(0);

      const calls = readLog(chownLog).trim().split('\n');
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatch(new RegExp(`^root:root .*/etc-cron\\.d/\\.${INSTALLED}\\.[A-Za-z0-9]+$`));
    });

    it('is not touched when not root', () => {
      const install = setup();
      const chownLog = path.join(install.box.root, 'chown.log');
      // Whatever user runs the tests, the installer sees an ordinary one
      writeFileSync(path.join(install.box.bin, 'id'), '#!/bin/bash\necho 1000\n');
      writeFileSync(path.join(install.box.bin, 'chown'), `#!/bin/bash\necho "$*" >> "${chownLog}"\n`);
      chmodSync(path.join(install.box.bin, 'id'), 0o755);
      chmodSync(path.join(install.box.bin, 'chown'), 0o755);

      expect(install.run().status).toBe(0);
      expect(readLog(chownLog)).toBe('');
    });

    it('stops without replacing the schedule when the owner cannot be set', () => {
      const install = setup({ crontab: `${OLD_LINE}\n` });
      writeFileSync(install.installed, 'previous schedule\n');
      asRoot(install, true);

      const result = install.run();

      expect(result.status).not.toBe(0);
      expect(readFileSync(install.installed, 'utf8')).toBe('previous schedule\n');
      expect(readdirSync(install.cronD)).toEqual([INSTALLED]);
      expect(readLog(install.crontabLog)).toBe('');
    });
  });

  it('fails when cron.d cannot be written, before it touches root\'s crontab', () => {
    const install = setup({ crontab: `${OLD_LINE}\n` });

    const result = install.run({ CRON_D_DIR: path.join(install.box.root, 'no-such-dir', 'cron.d') });

    expect(result.status).not.toBe(0);
    expect(readFileSync(install.crontabFile, 'utf8')).toBe(`${OLD_LINE}\n`);
    expect(readLog(install.crontabLog)).toBe('');
  });
});

describe('the schedule file', () => {
  const text = readFileSync(cronSource, 'utf8');
  const lines = text.split('\n');
  const jobs = lines.filter((line) => line.trim() !== '' && !line.startsWith('#') && !/^[A-Z_]+=/.test(line));

  it('has a name cron reads: letters, digits, underscore and hyphen only, so no dot', () => {
    expect(path.basename(cronSource)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(INSTALLED).toBe(path.basename(cronSource));
  });

  it('ends with a newline, which cron needs to read its last line', () => {
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('has one job with five time fields and then root as the user, which a cron.d file must name', () => {
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatch(/^0 0 \* \* \* root \S/);
  });

  it('sets the time zone and a PATH, and assigns them before the job', () => {
    expect(lines).toContain('CRON_TZ=UTC');
    expect(lines.findIndex((line) => line.startsWith('PATH='))).toBeGreaterThanOrEqual(0);
    expect(lines.indexOf('CRON_TZ=UTC')).toBeLessThan(lines.indexOf(jobs[0]));
  });
});
