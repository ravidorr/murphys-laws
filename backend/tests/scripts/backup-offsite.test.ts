import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  install,
  readLog,
  runFile,
  sandbox,
  scratchDir,
  scriptsDir,
  type Sandbox,
} from '../helpers/shell-sandbox.ts';

// These tests run the real backup-murphys.sh, test-backup-restore.sh and backup-offsite.sh against a fake
// `rclone` that keeps each remote in a directory, and the real gpg and sqlite3. Nothing leaves the sandbox.

const source = (name: string) => readFileSync(path.join(scriptsDir, name), 'utf8');
/** The default is lifecycle (the key has no delete right); these tests opt in to client-side pruning. */
const SERVER_PRUNE = { OFFSITE_PRUNE: 'server' };
const PASSPHRASE = 'correct horse battery staple';
const SECRET_MARKER = 'SMTP_PASS=do-not-leak-this-value';

// A directory-backed rclone: `name:bucket/dir/` is $FAKE_RCLONE_ROOT/name/bucket/dir. It supports only what
// backup-offsite.sh calls (copyto, lsf with --files-only/--max-age, delete with --min-age), logs every call,
// and fails the subcommand named in $FAKE_RCLONE_FAIL.
const FAKE_RCLONE = `#!/bin/bash
echo "$*" >> "$FAKE_RCLONE_LOG"
cmd="$1"; shift
[ "$cmd" = "\${FAKE_RCLONE_FAIL:-}" ] && { echo "fake rclone: $cmd failed" >&2; exit 1; }
path_of() { case "$1" in /*) printf '%s' "$1" ;; *) printf '%s/%s' "$FAKE_RCLONE_ROOT" "\${1/://}" ;; esac; }
max_age=""; min_age=""; args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --files-only) ;;
    --max-age) max_age="$2"; shift ;;
    --min-age) min_age="$2"; shift ;;
    *) args+=("$1") ;;
  esac
  shift
done
case "$cmd" in
  copyto)
    dest="$(path_of "\${args[1]}")"; mkdir -p "$(dirname "$dest")"; cp "$(path_of "\${args[0]}")" "$dest" ;;
  lsf)
    dir="$(path_of "\${args[0]}")"; [ -d "$dir" ] || { echo "directory not found" >&2; exit 3; }
    if [ -n "$min_age" ]; then
      find "$dir" -maxdepth 1 -type f -mmin "+$(( \${min_age%d} * 1440 ))" -exec basename {} \\;
    elif [ -n "$max_age" ]; then
      find "$dir" -maxdepth 1 -type f -mmin "-$(( \${max_age%h} * 60 ))" -exec basename {} \\;
    else
      find "$dir" -maxdepth 1 -type f -exec basename {} \\;
    fi ;;
  delete)
    dir="$(path_of "\${args[0]}")"; [ -d "$dir" ] || { echo "directory not found" >&2; exit 3; }
    find "$dir" -maxdepth 1 -type f -mmin "+$(( \${min_age%d} * 1440 ))" -delete ;;
  *) echo "fake rclone: unsupported $cmd" >&2; exit 2 ;;
esac
`;

const hostTool = (name: string): string => {
  const found = execFileSync('bash', ['-c', `command -v ${name}`], { encoding: 'utf8' }).trim();
  expect(found, `${name} must be installed to run these tests`).not.toBe('');
  return found;
};

interface Offsite {
  box: Sandbox;
  bucket: string;
  env: Record<string, string>;
  rcloneLog: string;
}

/** A sandbox laid out like the droplet: app dir, database, .env, backups dir, fake rclone, real gpg. */
function droplet({ withEnvFile = true, offsite = true }: { withEnvFile?: boolean; offsite?: boolean } = {}): Offsite {
  const box = sandbox();
  const db = new Database(path.join(box.root, 'backend', 'murphys.db'));
  try {
    db.exec('CREATE TABLE laws (id INTEGER PRIMARY KEY, title TEXT, text TEXT NOT NULL)');
    db.prepare('INSERT INTO laws (id, title, text) VALUES (?, ?, ?)').run(1, null, 'Anything that can go wrong will.');
  } finally {
    db.close();
  }
  if (withEnvFile) {
    writeFileSync(path.join(box.root, 'backend', '.env'), `SMTP_HOST=smtp.example.com\nSMTP_USER=mailer\n${SECRET_MARKER}\n`);
  }
  mkdirSync(path.join(box.root, 'backups'));

  symlinkSync(hostTool('gpg'), path.join(box.bin, 'gpg'));
  const rcloneLog = path.join(box.root, 'rclone.log');
  writeFileSync(path.join(box.bin, 'rclone'), FAKE_RCLONE);
  chmodSync(path.join(box.bin, 'rclone'), 0o755);

  const bucket = path.join(box.root, 'remote', 'off', 'bucket');
  const passphraseFile = path.join(box.root, 'offsite.passphrase');
  writeFileSync(passphraseFile, `${PASSPHRASE}\n`, { mode: 0o600 });
  const configFile = path.join(box.root, 'offsite.env');
  writeFileSync(configFile, `OFFSITE_REMOTE="off:bucket"\nOFFSITE_PASSPHRASE_FILE=${passphraseFile}\n`);

  const gnupg = scratchDir('gnupg-');
  chmodSync(gnupg, 0o700);
  return {
    box,
    bucket,
    rcloneLog,
    env: {
      EMAIL_TO: 'admin@example.com',
      FAKE_RCLONE_ROOT: path.join(box.root, 'remote'),
      FAKE_RCLONE_LOG: rcloneLog,
      GNUPGHOME: gnupg,
      HOME: box.root,
      ...(offsite ? { OFFSITE_BACKUP_ENV_FILE: configFile } : { OFFSITE_BACKUP_ENV_FILE: path.join(box.root, 'missing.env') }),
    },
  };
}

/** Points a script's hard-coded server paths at the sandbox. */
const retarget = (text: string, box: Sandbox) =>
  text.replaceAll('/root/murphys-laws', box.root).replaceAll('/root/backups', `${box.root}/backups`);

/**
 * Installs a script like the deploy does (install() redirects /var/log and quoted /tmp into the sandbox), and only
 * then points the hard-coded server paths at the sandbox, so a sandbox that itself lives under /tmp (as on Linux)
 * is never rewritten twice.
 */
const installRetargeted = (d: Offsite, name: string) => {
  const file = install(d.box, name, source(name));
  writeFileSync(file, retarget(readFileSync(file, 'utf8'), d.box));
  return file;
};

const installBackup = (d: Offsite, { withHelper = true } = {}) => {
  const file = installRetargeted(d, 'backup-murphys.sh');
  if (withHelper) {
    writeFileSync(path.join(path.dirname(file), 'backup-offsite.sh'), source('backup-offsite.sh'));
  }
  return file;
};

const runBackup = (d: Offsite, env: Record<string, string> = {}, options = {}) =>
  runFile(installBackup(d, options), [], d.box, { ...d.env, ...env });

const runRestoreTest = (d: Offsite, env: Record<string, string> = {}) => {
  const file = installRetargeted(d, 'test-backup-restore.sh');
  writeFileSync(path.join(path.dirname(file), 'backup-offsite.sh'), source('backup-offsite.sh'));
  return runFile(file, [], d.box, { ...d.env, ...env });
};

const files = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);
const ago = (hours: number) => new Date(Date.now() - hours * 3600 * 1000);
const seed = (dir: string, name: string, hours: number) => {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, 'old object');
  utimesSync(file, ago(hours), ago(hours));
};

const decrypt = (file: string, d: Offsite) =>
  execFileSync(
    'gpg',
    ['--batch', '--quiet', '--pinentry-mode', 'loopback', '--passphrase', PASSPHRASE, '--decrypt', file],
    { env: { PATH: `${d.box.bin}:/usr/bin:/bin`, GNUPGHOME: d.env.GNUPGHOME, HOME: d.box.root } },
  );

describe('backup-murphys.sh off-site copy', () => {
  it('keeps the local backup and says so when off-site is not configured', () => {
    const d = droplet({ offsite: false });
    const result = runBackup(d);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Off-site copy: not configured (local integrity only)');
    expect(files(path.join(d.box.root, 'backups')).filter((name) => name.startsWith('murphys_db_'))).toHaveLength(1);
    expect(existsSync(d.rcloneLog)).toBe(false);
  });

  it('uploads an encrypted database and env backup, and never the plain text', () => {
    const d = droplet();
    const result = runBackup(d);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Off-site copy: ok (encrypted, off:bucket, retention 30 days, pruning by lifecycle; the restore test checks it is enforced)');
    const [dbObject] = files(path.join(d.bucket, 'db'));
    const [envObject] = files(path.join(d.bucket, 'env'));
    expect(dbObject).toMatch(/^murphys_db_\d{8}_\d{6}\.db\.gpg$/);
    expect(envObject).toMatch(/^env_\d{8}_\d{6}\.bak\.gpg$/);

    // Ciphertext: neither the secret nor the SQLite header is readable in what was uploaded.
    const uploadedEnv = readFileSync(path.join(d.bucket, 'env', envObject));
    const uploadedDb = readFileSync(path.join(d.bucket, 'db', dbObject));
    expect(uploadedEnv.toString('latin1')).not.toContain('SMTP_PASS');
    expect(uploadedEnv.toString('latin1')).not.toContain('do-not-leak');
    expect(uploadedDb.toString('latin1')).not.toContain('SQLite format 3');

    // And it decrypts back to the local backups.
    expect(decrypt(path.join(d.bucket, 'env', envObject), d).toString()).toContain(SECRET_MARKER);
    const restored = path.join(d.box.root, 'restored.db');
    writeFileSync(restored, decrypt(path.join(d.bucket, 'db', dbObject), d));
    const check = new Database(restored, { readonly: true });
    try {
      expect(check.prepare('SELECT COUNT(*) AS n FROM laws').get()).toEqual({ n: 1 });
    } finally {
      check.close();
    }
  });

  it('uploads no env copy when the server has no .env, and a missing env prefix is not a prune failure', () => {
    const d = droplet({ withEnvFile: false });
    const result = runBackup(d, SERVER_PRUNE);

    expect(result.status, result.stderr).toBe(0);
    expect(files(path.join(d.bucket, 'db'))).toHaveLength(1);
    expect(files(path.join(d.bucket, 'env'))).toEqual([]);
    // The env prefix does not exist (rclone status 3), which is nothing to prune and not a failure
    expect(readLog(d.rcloneLog)).toContain('lsf --files-only off:bucket/env/');
    expect(readLog(d.rcloneLog)).not.toContain('delete --min-age 30d off:bucket/env/');
  });

  it('prunes off-site copies older than the 30-day retention and keeps newer ones when OFFSITE_PRUNE=server', () => {
    const d = droplet();
    seed(path.join(d.bucket, 'db'), 'murphys_db_20250101_040000.db.gpg', 31 * 24);
    seed(path.join(d.bucket, 'db'), 'murphys_db_20251020_040000.db.gpg', 10 * 24);
    seed(path.join(d.bucket, 'env'), 'env_20250101_040000.bak.gpg', 31 * 24);
    const result = runBackup(d, SERVER_PRUNE);

    expect(result.status, result.stderr).toBe(0);
    expect(files(path.join(d.bucket, 'db'))).toContain('murphys_db_20251020_040000.db.gpg');
    expect(files(path.join(d.bucket, 'db'))).not.toContain('murphys_db_20250101_040000.db.gpg');
    expect(files(path.join(d.bucket, 'env'))).not.toContain('env_20250101_040000.bak.gpg');
    expect(readLog(d.rcloneLog)).toContain('delete --min-age 30d off:bucket/db/');
    expect(readLog(d.rcloneLog)).toContain('delete --min-age 30d off:bucket/env/');
  });

  it('fails the run, alerts, keeps the local backup and prunes nothing when the upload fails', () => {
    const d = droplet();
    seed(path.join(d.bucket, 'db'), 'murphys_db_20250101_040000.db.gpg', 31 * 24);
    const result = runBackup(d, { ...SERVER_PRUNE, FAKE_RCLONE_FAIL: 'copyto' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('ERROR: Off-site copy: FAILED (upload of murphys_db_');
    expect(readLog(d.box.mailLog)).toContain("-s [Murphy's Laws] Off-site backup FAILED");
    expect(readLog(d.box.mailLog)).toContain('The local backup');
    expect(files(path.join(d.box.root, 'backups')).filter((name) => name.startsWith('murphys_db_'))).toHaveLength(1);
    // An outage must never empty the bucket.
    expect(files(path.join(d.bucket, 'db'))).toEqual(['murphys_db_20250101_040000.db.gpg']);
  });

  it('fails the run when the pruning step fails after a good upload', () => {
    const d = droplet();
    const result = runBackup(d, { ...SERVER_PRUNE, FAKE_RCLONE_FAIL: 'delete' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('ERROR: Off-site copy: FAILED (pruning old database copies failed)');
  });

  it('prunes old env copies even when this run has no .env to upload', () => {
    const d = droplet({ withEnvFile: false });
    seed(path.join(d.bucket, 'env'), 'env_20250101_040000.bak.gpg', 31 * 24);
    const result = runBackup(d, SERVER_PRUNE);

    expect(result.status, result.stderr).toBe(0);
    expect(files(path.join(d.bucket, 'env'))).toEqual([]);
  });

  it('never deletes from the bucket by default: expiry is left to the B2 lifecycle rule', () => {
    const d = droplet();
    seed(path.join(d.bucket, 'db'), 'murphys_db_20250101_040000.db.gpg', 31 * 24);
    const result = runBackup(d);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('pruning by lifecycle');
    expect(files(path.join(d.bucket, 'db'))).toContain('murphys_db_20250101_040000.db.gpg');
    expect(readLog(d.rcloneLog)).not.toMatch(/^delete /m);
  });

  it('reads OFFSITE_PRUNE=server from the config file', () => {
    const d = droplet();
    writeFileSync(path.join(d.box.root, 'offsite.env'), `${readFileSync(path.join(d.box.root, 'offsite.env'), 'utf8')}OFFSITE_PRUNE=server\n`);

    expect(runBackup(d).stdout).toContain('pruning by server');
  });

  it('fails the run for an unknown OFFSITE_PRUNE value instead of guessing', () => {
    const d = droplet();
    writeFileSync(path.join(d.box.root, 'offsite.env'), `${readFileSync(path.join(d.box.root, 'offsite.env'), 'utf8')}OFFSITE_PRUNE=sometimes\n`);
    const result = runBackup(d);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("OFFSITE_PRUNE 'sometimes' must be server or lifecycle");
  });

  it('fails the run when an uploaded object is not listed afterwards', () => {
    const d = droplet();
    const result = runBackup(d, { FAKE_RCLONE_FAIL: 'lsf' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('ERROR: Off-site copy: FAILED (upload of murphys_db_');
  });

  it('still fails, and logs it, when no alert can be emailed', () => {
    const d = droplet();
    const result = runBackup(d, { FAKE_RCLONE_FAIL: 'copyto', EMAIL_TO: '', MAIL_EXIT: '1' });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Alert email was not sent');
  });

  it('fails when off-site is configured but the passphrase file is missing', () => {
    const d = droplet();
    writeFileSync(path.join(d.box.root, 'offsite.env'), `OFFSITE_REMOTE=off:bucket\nOFFSITE_PASSPHRASE_FILE=${d.box.root}/nope\n`);
    const result = runBackup(d);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('ERROR: Off-site copy: FAILED (passphrase file');
    expect(files(path.join(d.bucket, 'db'))).toEqual([]);
  });

  it('fails when the helper is not installed, after the local backup is made', () => {
    const d = droplet();
    const result = runBackup(d, {}, { withHelper: false });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('cannot load backup-offsite.sh');
    expect(result.stdout).toContain('ERROR: Off-site copy: FAILED');
    expect(files(path.join(d.box.root, 'backups')).filter((name) => name.startsWith('murphys_db_'))).toHaveLength(1);
  });
});

describe('backup-offsite.sh configuration', () => {
  const load = (d: Offsite, config: string, env: Record<string, string> = {}) => {
    writeFileSync(path.join(d.box.root, 'offsite.env'), config);
    const file = path.join(d.box.root, 'load.sh');
    writeFileSync(
      file,
      `source ${path.join(scriptsDir, 'backup-offsite.sh')}\noffsite_load_config; rc=$?\necho "rc=$rc remote=$OFFSITE_REMOTE pass=$OFFSITE_PASSPHRASE_FILE err=$OFFSITE_ERROR"\n`,
    );
    return runFile(file, [], d.box, { ...d.env, ...env }).stdout;
  };

  it('reads the remote and passphrase file from the config file, ignoring quotes, export and trailing slash', () => {
    const d = droplet();
    expect(load(d, `export OFFSITE_REMOTE='off:bucket/'\nOFFSITE_PASSPHRASE_FILE="${d.box.root}/offsite.passphrase"\n`)).toContain(
      `rc=0 remote=off:bucket pass=${d.box.root}/offsite.passphrase`,
    );
  });

  it('drops trailing comments from quoted and unquoted values', () => {
    const d = droplet();
    expect(load(d, 'OFFSITE_REMOTE=off:bucket   # the B2 bucket\nOFFSITE_PASSPHRASE_FILE="/etc/x pass" # secret\n')).toContain(
      'rc=2 remote=off:bucket pass=/etc/x pass err=passphrase file /etc/x pass is missing',
    );
    expect(load(d, "OFFSITE_REMOTE='off:bucket' # c\n")).toContain('remote=off:bucket pass=');
  });

  it('lets the environment override the config file', () => {
    const d = droplet();
    expect(load(d, 'OFFSITE_REMOTE=other:bucket\n', { OFFSITE_REMOTE: 'off:bucket' })).toContain('remote=off:bucket');
  });

  it('reports not configured (1) with no remote, and misconfigured (2) for a bad remote or missing tools', () => {
    const d = droplet();
    expect(load(d, 'OFFSITE_REMOTE=off:bucket\n', { OFFSITE_BACKUP_ENV_FILE: path.join(d.box.root, 'absent.env') })).toContain('rc=1');
    // A file that gives no remote (typo, blank value) is a mistake, not "never set up"
    expect(load(d, '# nothing\nOFFSITE_REMOT=off:bucket\n')).toMatch(/rc=2 .*gives no OFFSITE_REMOTE/);
    expect(load(d, 'OFFSITE_REMOTE=\n')).toContain('rc=2');
    expect(load(d, 'OFFSITE_REMOTE=just-a-bucket\n')).toContain('rc=2');
    expect(load(d, 'OFFSITE_REMOTE=off:bucket\n')).toContain('passphrase file');
    expect(load(d, `OFFSITE_REMOTE=off:bucket\nOFFSITE_PASSPHRASE_FILE=${d.box.root}/offsite.passphrase\n`, { PATH: '/usr/bin:/bin' })).toContain('rclone is not installed');
    // A PATH with rclone and the few tools the helper uses, but no gpg (the host's /usr/bin has one on Linux)
    const noGpg = path.join(d.box.root, 'no-gpg-bin');
    mkdirSync(noGpg);
    for (const tool of ['bash', 'grep', 'sed', 'tail']) {
      symlinkSync(hostTool(tool), path.join(noGpg, tool));
    }
    symlinkSync(path.join(d.box.bin, 'rclone'), path.join(noGpg, 'rclone'));
    expect(load(d, `OFFSITE_REMOTE=off:bucket\nOFFSITE_PASSPHRASE_FILE=${d.box.root}/offsite.passphrase\n`, { PATH: noGpg })).toContain('gpg is not installed');
  });

  it('never runs the config file', () => {
    const d = droplet();
    const marker = path.join(d.box.root, 'ran');
    load(d, `OFFSITE_REMOTE=off:bucket\n$(touch ${marker})\ntouch ${marker}\n`);
    expect(existsSync(marker)).toBe(false);
  });
});

describe('test-backup-restore.sh off-site checks', () => {
  /** A droplet with a good backup already copied off-site. */
  const backedUp = () => {
    const d = droplet();
    expect(runBackup(d).status).toBe(0);
    return d;
  };

  it('passes every off-site check against a fresh, encrypted copy', () => {
    const d = backedUp();
    const result = runRestoreTest(d);

    for (const line of [
      'PASS: Off-site database copy exists: murphys_db_',
      'PASS: Off-site database copy is fresh (< 30 hours old)',
      'PASS: Off-site database copy downloaded and decrypted',
      'PASS: Off-site database integrity check passed',
      'PASS: Can query data from the off-site copy (1 laws)',
      'PASS: Off-site env copy is fresh, decrypts, and has the SMTP keys',
    ]) {
      expect(result.stdout, line).toContain(line);
    }
    expect(result.stdout).not.toMatch(/FAIL: .*[Oo]ff-site/);
  });

  it('leaves no decrypted copy behind', () => {
    const d = backedUp();
    runRestoreTest(d);
    const leftovers = readdirSync(d.box.root).filter((name) => name.startsWith('backup-restore-test-') && !name.endsWith('.txt'));
    expect(leftovers).toEqual([]);
  });

  it('fails when off-site is not configured', () => {
    const d = droplet({ offsite: false });
    const result = runRestoreTest(d);

    expect(result.stdout).toContain('FAIL: Off-site backup is not configured');
    expect(result.status).toBe(1);
  });

  it('fails when off-site is misconfigured', () => {
    const d = backedUp();
    writeFileSync(path.join(d.box.root, 'offsite.env'), `OFFSITE_REMOTE=off:bucket\nOFFSITE_PASSPHRASE_FILE=${d.box.root}/nope\n`);

    expect(runRestoreTest(d).stdout).toContain('FAIL: Off-site backup is misconfigured: passphrase file');
  });

  it('fails when the bucket holds no database copy', () => {
    const d = droplet();
    const result = runRestoreTest(d);

    expect(result.stdout).toContain('FAIL: No off-site database copy found in off:bucket/db/');
  });

  it('passes the retention check with no copies past 35 days', () => {
    const result = runRestoreTest(backedUp());

    expect(result.stdout).toContain('PASS: No off-site db copies older than 35 days (retention is being enforced)');
    expect(result.stdout).toContain('PASS: No off-site env copies older than 35 days (retention is being enforced)');
  });

  it('fails when copies older than 35 days are still listed, meaning the lifecycle rule is missing', () => {
    const d = backedUp();
    seed(path.join(d.bucket, 'db'), 'murphys_db_20250101_040000.db.gpg', 40 * 24);
    seed(path.join(d.bucket, 'env'), 'env_20250101_040000.bak.gpg', 40 * 24);
    const result = runRestoreTest(d);

    expect(result.stdout).toContain('FAIL: Off-site db copies older than 35 days exist: the bucket lifecycle rule is missing or not working');
    expect(result.stdout).toContain('FAIL: Off-site env copies older than 35 days exist');
  });

  it('fails when the server has an env backup but the bucket has no env copy', () => {
    const d = backedUp();
    for (const name of files(path.join(d.bucket, 'env'))) {
      execFileSync('rm', [path.join(d.bucket, 'env', name)]);
    }

    expect(runRestoreTest(d).stdout).toContain('FAIL: No off-site env copy found in off:bucket/env/');
  });

  it('fails when the newest off-site copies are older than 30 hours', () => {
    const d = backedUp();
    for (const dir of ['db', 'env']) {
      for (const name of files(path.join(d.bucket, dir))) {
        utimesSync(path.join(d.bucket, dir, name), ago(48), ago(48));
      }
    }
    const result = runRestoreTest(d);

    expect(result.stdout).toContain('FAIL: Off-site database copy is older than 30 hours');
    expect(result.stdout).toContain('FAIL: Off-site env copy is older than 30 hours');
  });

  it('fails when the copy cannot be decrypted with the passphrase on the server', () => {
    const d = backedUp();
    writeFileSync(path.join(d.box.root, 'offsite.passphrase'), 'a different passphrase\n');
    const result = runRestoreTest(d);

    expect(result.stdout).toContain('FAIL: Could not download and decrypt the off-site database copy');
    expect(result.stdout).toContain('FAIL: Could not download and decrypt the off-site env copy');
  });

  it('fails when the decrypted database has no laws or the env copy lacks the SMTP keys', () => {
    const d = droplet();
    const empty = path.join(d.box.root, 'empty.db');
    const db = new Database(empty);
    db.exec('CREATE TABLE laws (id INTEGER PRIMARY KEY, title TEXT, text TEXT NOT NULL)');
    db.close();
    writeFileSync(path.join(d.box.root, 'plain-env'), 'SOMETHING=else\n');
    const name = 'murphys_db_20260101_000000.db';
    // Encrypt the way the backup does, by using the helper itself.
    const encrypt = path.join(d.box.root, 'encrypt.sh');
    writeFileSync(
      encrypt,
      `source ${path.join(scriptsDir, 'backup-offsite.sh')}\noffsite_load_config\noffsite_upload db "$1"\noffsite_upload env "$2"\n`,
    );
    const fresh = path.join(d.box.root, name);
    writeFileSync(fresh, readFileSync(empty));
    const envCopy = path.join(d.box.root, 'env_20260101_000000.bak');
    writeFileSync(envCopy, 'SOMETHING=else\n');
    expect(runFile(encrypt, [fresh, envCopy], d.box, d.env).status).toBe(0);
    // A local env backup makes the script check the off-site one too.
    writeFileSync(path.join(d.box.root, 'backups', 'env_20260101_000000.bak'), 'SMTP_HOST=x\n');

    const result = runRestoreTest(d);
    expect(result.stdout).toMatch(/FAIL: Cannot query laws from the off-site copy: 0/);
    expect(result.stdout).toContain('FAIL: Off-site env copy decrypted but is missing SMTP keys');
  });
});

describe('off-site helper deploy wiring', () => {
  it('npm run deploy and the workflow install backup-murphys.sh and backup-offsite.sh and refuse to continue without it', () => {
    const deployTs = readFileSync(path.join(scriptsDir, 'deploy.ts'), 'utf8');
    const workflow = readFileSync(path.resolve(__dirname, '../../../.github/workflows/deploy.yml'), 'utf8');

    expect(deployTs).toMatch(/STRICT_MONITORING_SCRIPTS = \[[^\]]*'backup-murphys\.sh'[^\]]*'backup-offsite\.sh'/);
    // The backup script itself is installed strictly too: an old copy would never make the off-site copy
    expect(deployTs).not.toMatch(/backup-murphys\.sh[^\n]*\|\| true/);
    expect(workflow).not.toMatch(/backup-murphys\.sh[^\n]*\|\| true/);
    expect(deployTs).toContain('backup-offsite.sh /usr/local/bin/backup-offsite.sh && sudo chmod +x');
    expect(workflow).toMatch(/for script in alert-email backup-murphys backup-offsite /);
    expect(workflow).toMatch(/for script in backup-murphys backup-offsite health-monitor /);
  });

  it('every script has valid syntax', () => {
    for (const name of ['backup-offsite.sh', 'backup-murphys.sh', 'test-backup-restore.sh']) {
      execFileSync('bash', ['-n', path.join(scriptsDir, name)]);
    }
  });
});
