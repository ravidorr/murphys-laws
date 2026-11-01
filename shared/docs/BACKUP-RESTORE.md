# Backup and Restore Procedures

Complete guide for backing up and restoring the Murphy's Laws application and infrastructure.

## Table of Contents

1. [Backup Overview](#backup-overview)
2. [Manual Backup Procedures](#manual-backup-procedures)
3. [Restore Procedures](#restore-procedures)
4. [Testing Backups](#testing-backups)
5. [Backup Verification Checklist](#backup-verification-checklist)
6. [Off-Site Backup Strategy](#off-site-backup-strategy)

---

## Backup Overview

### What Gets Backed Up

**Main Application (167.99.53.90)**:
- Database (`backend/murphys.db`) - Contains all laws, submissions, votes
- Environment configuration (`.env`) - SMTP credentials, API keys
- Application code (excluding `node_modules`, logs, `.git`)

n8n workflow automation was retired; no separate automation host is backed up.

### Backup Schedule

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| Database (`murphys_db_*.db`) | Daily 4 AM UTC | 30 days | `/root/backups/` |
| Environment (`env_*.bak`) | Daily 4 AM UTC | 30 days | `/root/backups/` |
| Encrypted database and env copies (`*.gpg`) | Daily 4 AM UTC | 30 days | Backblaze B2 bucket (off-site) |
| Application code | Git (not tarred on server) | N/A | GitHub |

### Backup Scripts

- **Main App**: `/usr/local/bin/backup-murphys.sh` (source: `backend/scripts/backup-murphys.sh`, installed on deploy). The script exits non-zero if SQLite backup or `PRAGMA integrity_check` fails. With off-site configured it also encrypts and uploads both backups and fails the run if that does not work (see [Off-Site Backup Strategy](#off-site-backup-strategy)). The installed helper `backup-offsite.sh` is sourced by it and by the restore test.

---

## Manual Backup Procedures

### 1. Manual Database Backup

```bash
# SSH into the server
ssh ravidor@167.99.53.90

# Create timestamped backup
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
sqlite3 /root/murphys-laws/backend/murphys.db ".backup /root/backups/murphys-manual-$TIMESTAMP.db"

# Verify backup
sqlite3 /root/backups/murphys-manual-$TIMESTAMP.db "PRAGMA integrity_check;"

# Expected output: ok
```

### 2. Manual Full Application Backup

```bash
# SSH into the server
ssh ravidor@167.99.53.90

# Run the backup script manually
/usr/local/bin/backup-murphys.sh

# Or create a complete manual backup
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
cd /root
tar -czf /root/backups/murphys-laws-manual-$TIMESTAMP.tar.gz \
 --exclude='node_modules' \
 --exclude='logs' \
 --exclude='.git' \
 murphys-laws/

# Verify archive
tar -tzf /root/backups/murphys-laws-manual-$TIMESTAMP.tar.gz | head
```

### 3. Download Backup to Local Machine

```bash
# From your local machine
# Download database backup
scp ravidor@167.99.53.90:/root/backups/murphys-2025-01-26-020000.db \
 ~/local-backups/

# Download full backup
scp ravidor@167.99.53.90:/root/backups/murphys-laws-2025-01-26-020000.tar.gz \
 ~/local-backups/

# Verify download
sqlite3 ~/local-backups/murphys-2025-01-26-020000.db "SELECT COUNT(*) FROM laws;"
```

---

## Restore Procedures

### Scenario 1: Restore Database Only

**Use Case**: Database corruption, accidental data deletion

```bash
# 1. SSH into server
ssh ravidor@167.99.53.90

# 2. Stop application
pm2 stop all

# 3. List available backups
ls -lht /root/backups/*.db | head -10

# 4. Choose the backup to restore
BACKUP_FILE="/root/backups/murphys-2025-01-26-020000.db"

# 5. Verify backup integrity before restoring
sqlite3 $BACKUP_FILE "PRAGMA integrity_check;"
# Must output: ok

# 6. Backup current (potentially corrupted) database
cp /root/murphys-laws/backend/murphys.db /root/murphys-laws/backend/murphys.db.backup-before-restore

# 7. Restore the backup
cp $BACKUP_FILE /root/murphys-laws/backend/murphys.db

# 8. Verify restored database
sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;"
sqlite3 /root/murphys-laws/backend/murphys.db "PRAGMA integrity_check;"

# 9. Restart application
pm2 restart all

# 10. Verify application is working
curl https://murphys-laws.com/api/health
```

**Recovery Time**: 5-10 minutes
**Data Loss**: From backup time to incident (maximum 24 hours)

---

### Scenario 2: Restore Complete Application

**Use Case**: File system corruption, accidental deletion, major configuration issues

```bash
# 1. SSH into server
ssh ravidor@167.99.53.90

# 2. Stop application
pm2 stop all
pm2 delete all

# 3. Backup current state (if possible)
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
mv /root/murphys-laws /root/murphys-laws-broken-$TIMESTAMP

# 4. List available backups
ls -lht /root/backups/murphys-laws-*.tar.gz | head -10

# 5. Extract backup
cd /root
tar -xzf /root/backups/murphys-laws-2025-01-26-020000.tar.gz

# 6. Restore database separately (it's not in the tarball)
cp /root/backups/murphys-2025-01-26-020000.db /root/murphys-laws/backend/murphys.db

# 7. Restore environment file
cp /root/backups/.env-2025-01-26-020000 /root/murphys-laws/.env

# 8. Reinstall dependencies
cd /root/murphys-laws
npm ci

# 9. Rebuild application
npm run build

# 10. Start PM2
pm2 start ecosystem.config.cjs
pm2 save

# 11. Verify
pm2 list
curl https://murphys-laws.com/api/health
```

**Recovery Time**: 15-30 minutes
**Data Loss**: From backup time to incident (maximum 24 hours)

---

### Scenario 3: Restore from Local Backup

**Use Case**: Server completely lost, restoring to new server

```bash
# 1. Set up new server (see [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) for full setup)

# 2. From your local machine, upload backups
scp ~/local-backups/murphys-2025-01-26-020000.db \
 ravidor@<NEW_SERVER_IP>:/tmp/

scp ~/local-backups/.env-2025-01-26-020000 \
 ravidor@<NEW_SERVER_IP>:/tmp/

# 3. SSH into new server
ssh ravidor@<NEW_SERVER_IP>

# 4. Move backups to proper location
sudo cp /tmp/murphys-2025-01-26-020000.db /root/murphys-laws/backend/murphys.db
sudo cp /tmp/.env-2025-01-26-020000 /root/murphys-laws/.env

# 5. Continue with application setup (see [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md))
```

---

## Testing Backups

### Monthly Backup Test Procedure

Perform this test monthly to ensure backups are recoverable.

```bash
# 1. SSH into server
ssh ravidor@167.99.53.90

# 2. Get latest backup
LATEST_BACKUP=$(ls -t /root/backups/murphys-*.db | head -1)
echo "Testing backup: $LATEST_BACKUP"

# 3. Verify backup file exists and has size
ls -lh $LATEST_BACKUP

# 4. Test database integrity
sqlite3 $LATEST_BACKUP "PRAGMA integrity_check;"
# Must output: ok

# 5. Test data accessibility
echo "Total laws in backup:"
sqlite3 $LATEST_BACKUP "SELECT COUNT(*) FROM laws;"

echo "Sample law titles:"
sqlite3 $LATEST_BACKUP "SELECT title FROM laws LIMIT 5;"

# 6. Test restore to temp location
TEST_RESTORE="/tmp/test-restore-$(date +%Y%m%d).db"
cp $LATEST_BACKUP $TEST_RESTORE

# 7. Query restored database
sqlite3 $TEST_RESTORE "SELECT COUNT(*) FROM laws;"

# 8. Compare with production
PROD_COUNT=$(sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;")
BACKUP_COUNT=$(sqlite3 $LATEST_BACKUP "SELECT COUNT(*) FROM laws;")

echo "Production laws: $PROD_COUNT"
echo "Backup laws: $BACKUP_COUNT"

DIFF=$((PROD_COUNT - BACKUP_COUNT))
echo "Difference: $DIFF"

if [ $DIFF -lt 10 ]; then
 echo "Backup test PASSED - difference within acceptable range"
else
 echo "Backup test WARNING - significant difference detected"
fi

# 9. Clean up
rm $TEST_RESTORE

# 10. Document test results
echo "Backup test completed on $(date)" >> /var/log/backup-tests.log
```

### Automated Backup Verification

Create a cron job to verify backups automatically:

```bash
# Add to crontab (runs daily at 3 AM)
0 3 * * * /usr/local/bin/verify-backups.sh
```

Create `/usr/local/bin/verify-backups.sh`:

```bash
#!/bin/bash

LATEST_BACKUP=$(ls -t /root/backups/murphys-*.db 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
 echo "ERROR: No backups found" | mail -s "[Murphy's Laws] Backup Verification Failed" <your-email>
 exit 1
fi

if sqlite3 $LATEST_BACKUP "PRAGMA integrity_check;" | grep -q "ok"; then
 echo "Backup verification passed: $LATEST_BACKUP"
else
 echo "ERROR: Backup integrity check failed: $LATEST_BACKUP" | mail -s "[Murphy's Laws] Backup Corruption Detected" <your-email>
 exit 1
fi
```

---

## Backup Verification Checklist

Before relying on a backup, verify:

- [ ] Backup file exists and is not zero-sized
- [ ] SQLite integrity check passes (`PRAGMA integrity_check`)
- [ ] Can query data from backup
- [ ] Backup is recent (check timestamp)
- [ ] Backup contains expected number of records
- [ ] Environment file exists and contains required keys
- [ ] Application archive can be extracted
- [ ] Latest off-site copy exists, is under 30 hours old, and decrypts and restores (`test-backup-restore.sh`, test 9)

---

## Off-Site Backup Strategy

The daily backup (`backup-murphys.sh`) sends an encrypted copy of the database backup and of the `.env` backup to a Backblaze B2 bucket. B2 is a different provider from the droplet (DigitalOcean) on purpose: an incident at the hosting account, such as a compromised login or a billing lock, must not also take the backups.

- **Encryption**: each file is encrypted on the droplet with GPG (symmetric, AES-256, authenticated) before it leaves it. The bucket only ever holds `*.gpg` objects, so the SMTP credentials in `.env` are never stored in plain text off the server.
- **Transport**: `rclone` with its native `b2` backend. B2 is the supported target because it has file versioning and Object Lock. Cloudflare R2 would work through rclone's S3 backend (the scripts only know an rclone remote name) but has neither versioning nor Object Lock, so it is not supported here.
- **Layout**: `<remote>/db/murphys_db_YYYYMMDD_HHMMSS.db.gpg` and `<remote>/env/env_YYYYMMDD_HHMMSS.bak.gpg`. Names carry a timestamp to the second, so each run uploads a new name; a rare same-second rerun would add a new version of the same name, and versioning keeps the earlier one.
- **Retention**: 30 days, the same as the local copies, enforced by a B2 lifecycle rule (see below). The default `OFFSITE_PRUNE=lifecycle` means the server never deletes anything from the bucket.
- **Failure handling**: if off-site is configured and any step fails, the backup run exits non-zero, logs `ERROR: Off-site copy: FAILED (...)` to `/var/log/backup-murphys.log`, and emails the alert recipient. The local backup is kept. The last `Off-site copy:` line of that log is shown in the daily report, with a warning (also in its summary) unless it is an `ok` under 30 hours old from the latest backup run (one missed or interrupted run shows at the next report). With no off-site configuration the run succeeds and logs `Off-site copy: not configured (local integrity only)`, and the monthly restore test fails until it is set up.
- **Monthly check**: `test-backup-restore.sh` (test 9) confirms the newest off-site database and env copies exist and are under 30 hours old, downloads and decrypts them, runs `PRAGMA integrity_check` and a `laws` query on the database, and checks the SMTP keys in the env copy. It lists only current versions, so hidden or locked old versions do not affect it. It also fails if copies older than 35 days are still listed, which means the lifecycle rule is missing (the server cannot see the rule, so this is how a missing rule is noticed). It uses the passphrase file on the droplet, so it does not prove your stored copy of the passphrase is right; the restore drill below does.

### Threat model and the three protections

The droplet holds the B2 key and the passphrase file, so assume an attacker who owns the droplet can use both. The setup limits what that gets them:

1. **A key restricted to one bucket with the fewest capabilities.** A compromised droplet cannot reach other buckets or account settings (see step 3 of the setup).
2. **No delete right on that key.** With `OFFSITE_PRUNE=lifecycle` (the default) the scripts only list, read and upload. `rclone delete` on B2 would also only hide a version unless `hard_delete` is set, so client-side pruning does not even reclaim space; the lifecycle rule does the real expiry. `OFFSITE_PRUNE=server` is only for a bucket without Object Lock: it needs `deleteFiles`, and on B2 it reclaims space only if the rclone remote also sets `hard_delete = true`. It is not part of the B2 setup below; leave it off.
3. **Versioning plus Object Lock.** B2 keeps every version by default. Object Lock with a 30-day default retention stops any version from being deleted or overwritten for 30 days, even by a key that has `deleteFiles`. The retention applies to files uploaded after it is set, so set it before the first backup.

Governance or compliance mode (B2 Object Lock docs: <https://www.backblaze.com/docs/cloud-storage-object-lock>):

| Mode | Who can shorten or remove the retention | Cost of choosing it |
|------|------------------------------------------|---------------------|
| Governance (recommended) | Only a key that has the `bypassGovernance` capability, or the owner signed in to the web console. The droplet key never gets it, so the droplet cannot undo the lock, while you can still fix a mistake. | None beyond storage. |
| Compliance | Nobody, including you and Backblaze, until each version's retention ends. | A wrong upload (for example a huge file) is billed until it expires, and the bucket cannot be emptied or deleted early. Object Lock cannot be turned off once enabled. |

Governance is the default recommendation because it protects against the droplet (the stated threat) and stays reversible by the owner. Choose compliance only if you also want protection against a stolen owner login, and accept the lock-in. Object Lock cannot be disabled after it is enabled, in either mode.

Lifecycle rule to set on the bucket (B2 lifecycle docs: <https://www.backblaze.com/docs/cloud-storage-lifecycle-rules>): custom rule with `fileNamePrefix` empty (all files), `daysFromUploadingToHiding` = 30, `daysFromHidingToDeleting` = 1. Each version is locked for 30 days from upload, hidden at day 30, and deleted a day later, so nothing is removed while locked. Per the B2 docs an empty prefix applies to the whole bucket, so use this bucket only for these backups. (If you pick a longer lock than 30 days, raise `daysFromUploadingToHiding` to match.)

### One-time setup

Names and values used by the scripts (nothing here is secret):

1. Create a B2 account and a private bucket named `murphys-laws-backups`. Enable Object Lock when creating the bucket and set the default retention (governance, 30 days). B2 docs: <https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets>.
2. Set the lifecycle rule above.
3. Create an application key restricted to that one bucket (<https://www.backblaze.com/docs/cloud-storage-application-keys>) with the capabilities `listBuckets`, `listFiles`, `readFiles` and `writeFiles` only. Not `deleteFiles`, `bypassGovernance`, `writeFileRetentions`, any `*Bucket*` write capability or `listAllBucketNames`. This is the expected minimum, not a verified-by-Backblaze list (their docs do not say which capabilities rclone needs), so step 4's `rclone lsf` check and the first backup are the test. Each backup uploads a new object name, so no delete right is needed. If rclone reports a missing list or read capability, add only that one. Never add `deleteFiles` or `bypassGovernance` to the droplet's key to silence an error; ask first. Do not use the master application key.
4. On the droplet: `sudo apt install -y rclone gnupg`, then `sudo rclone config` and create a remote named `murphys-b2` of type `b2` (rclone docs: <https://rclone.org/b2/>). The `account` field takes the application key ID (the keyID), not the account ID. Check with `sudo rclone lsf murphys-b2:murphys-laws-backups`.
5. Create the passphrase file and store a copy off the droplet **before** the first backup:

   ```bash
   sudo install -d -m 755 /etc/murphys-laws
   sudo sh -c 'umask 077; openssl rand -base64 36 > /etc/murphys-laws/offsite-backup.passphrase'
   ```

   Read it once on your own terminal (`sudo cat /etc/murphys-laws/offsite-backup.passphrase`), paste it into a password manager entry, and never put it in a ticket, chat or the repo. **Without a copy off the droplet, losing the droplet loses every off-site backup, because they cannot be decrypted.**
6. Write the config file (no secrets in it):

   ```bash
   sudo sh -c 'umask 077; cat > /etc/murphys-laws/offsite-backup.env <<EOF
   OFFSITE_REMOTE=murphys-b2:murphys-laws-backups
   OFFSITE_PASSPHRASE_FILE=/etc/murphys-laws/offsite-backup.passphrase
   OFFSITE_PRUNE=lifecycle
   EOF'
   ```

7. Run `sudo /usr/local/bin/backup-murphys.sh` and look for `Off-site copy: ok`, then `sudo /usr/local/bin/test-backup-restore.sh` and confirm the off-site checks pass.
8. Do the restore drill below from a clean machine.

The deploy installs `backup-offsite.sh` next to the scripts; it is not run on its own.

### Restore drill (clean machine, stored passphrase)

Do this once after setup and after any passphrase or key change. It proves the backups can be recovered with only what exists off the droplet: the bucket and the passphrase from your password manager. Use a laptop or VM that has never held the droplet's files, and a separate read-only B2 application key (restricted to the bucket, capabilities `listBuckets`, `listFiles`, `readFiles`), not the droplet's key.

```bash
# Install rclone and gnupg, then create a remote with the read-only key (interactive, nothing is printed back)
rclone config            # remote name: murphys-b2-restore, type: b2

# List the copies and take the newest names
rclone lsf murphys-b2-restore:murphys-laws-backups/db/  | sort | tail -3
rclone lsf murphys-b2-restore:murphys-laws-backups/env/ | sort | tail -3

# Download, then decrypt: gpg prompts, so TYPE the passphrase from the password manager.
# Do not copy it from the droplet, or the drill proves nothing about the stored copy.
rclone copyto murphys-b2-restore:murphys-laws-backups/db/murphys_db_YYYYMMDD_HHMMSS.db.gpg ./restore.db.gpg
gpg --output ./restore.db --decrypt ./restore.db.gpg
sqlite3 ./restore.db "PRAGMA integrity_check;"       # must print: ok
sqlite3 ./restore.db "SELECT COUNT(*) FROM laws;"    # must be close to production

# The env copy: confirm it decrypts and has the expected key names, without printing values
rclone copyto murphys-b2-restore:murphys-laws-backups/env/env_YYYYMMDD_HHMMSS.bak.gpg ./env.bak.gpg
gpg --output ./env.bak --decrypt ./env.bak.gpg
grep -c '^SMTP_HOST=' ./env.bak                       # must print: 1

# Remove everything, then delete the restore key if you do not keep it
shred -u ./restore.db ./env.bak 2>/dev/null || rm -f ./restore.db ./env.bak
rm -f ./restore.db.gpg ./env.bak.gpg
```

A wrong passphrase makes `gpg` fail with "decryption failed"; if that happens, stop and fix the stored copy before relying on any backup. Record the drill date in your own notes.

### Restoring from the off-site copy after losing the droplet

Use the same commands as the drill, with a key that has read access, then continue with "Scenario 1" above using `restore.db`. Put the decrypted env file at `/root/murphys-laws/backend/.env` with `chmod 600`. Recreate `/etc/murphys-laws/offsite-backup.env` and the passphrase file from the password manager on the new droplet.

### Rotating the passphrase

Copies keep the passphrase they were encrypted with. To rotate, keep the old passphrase until the last old copy has aged out (30 days), put the new one in the passphrase file, update the password manager with both until then, and repeat the restore drill.

### Other options (not implemented)

- Scheduled pull to a local machine over `scp` (needs a machine that is always on, and the `.env` copy would need the same encryption).
- `rsync` to another host you control. The retired n8n droplet is not used for off-site copies.

---

## Backup Troubleshooting

### Backup Script Not Running

```bash
# Check cron logs
grep backup /var/log/syslog

# Check cron job exists
crontab -l | grep backup

# Manually run backup script
/usr/local/bin/backup-murphys.sh

# Check for errors
tail -50 /var/log/backup-murphys.log
```

### Backup Directory Full

```bash
# Check disk space
df -h /root/backups

# Delete old backups manually
find /root/backups -name "murphys-*.db" -mtime +30 -delete

# Verify cleanup worked
du -sh /root/backups
```

### Backup Integrity Check Fails

```bash
# Don't use this backup for restore!
# Check when the corruption started
for backup in /root/backups/murphys-*.db; do
 echo "Checking $backup..."
 sqlite3 $backup "PRAGMA integrity_check;"
done

# Use the most recent backup that passes integrity check
```

---

## Quick Reference Commands

```bash
# List backups
ls -lht /root/backups/

# Verify backup
sqlite3 /root/backups/murphys-YYYY-MM-DD-HHMMSS.db "PRAGMA integrity_check;"

# Check backup size
du -h /root/backups/murphys-YYYY-MM-DD-HHMMSS.db

# Count records in backup
sqlite3 /root/backups/murphys-YYYY-MM-DD-HHMMSS.db "SELECT COUNT(*) FROM laws;"

# Download backup
scp ravidor@167.99.53.90:/root/backups/murphys-YYYY-MM-DD-HHMMSS.db ~/

# Restore backup
cp /root/backups/murphys-YYYY-MM-DD-HHMMSS.db /root/murphys-laws/backend/murphys.db
```

---

**Last Updated**: 2025-01-26
**Next Review**: 2025-04-26
