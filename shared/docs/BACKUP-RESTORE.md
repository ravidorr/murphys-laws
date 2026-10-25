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
| Application code | Git (not tarred on server) | N/A | GitHub |

### Backup Scripts

- **Main App**: `/usr/local/bin/backup-murphys.sh` (source: `backend/scripts/backup-murphys.sh`, installed on deploy). The script exits non-zero if SQLite backup or `PRAGMA integrity_check` fails. Success logs distinguish local integrity from off-site copies (off-site not configured by default).

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
 echo "ERROR: No backups found" | mail -s "[Murphy's Laws] Backup Verification Failed" you@example.com
 exit 1
fi

if sqlite3 $LATEST_BACKUP "PRAGMA integrity_check;" | grep -q "ok"; then
 echo "Backup verification passed: $LATEST_BACKUP"
else
 echo "ERROR: Backup integrity check failed: $LATEST_BACKUP" | mail -s "[Murphy's Laws] Backup Corruption Detected" you@example.com
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

---

## Off-Site Backup Strategy

### Current Limitations

**Current backups are only on the same server as the application.**

If the entire droplet is lost, backups may be inaccessible.

### Recommended Improvements

#### Option 1: DigitalOcean Spaces (S3-compatible)

```bash
# Install s3cmd
apt install -y s3cmd

# Configure s3cmd
s3cmd --configure

# Add to backup script
s3cmd put /root/backups/murphys-$(date +%Y-%m-%d-*)db s3://murphys-laws-backups/
s3cmd put /root/backups/.env-$(date +%Y-%m-%d-*) s3://murphys-laws-backups/
```

**Cost**: ~$5/month for 250GB

#### Option 2: Automated Download to Local Machine

```bash
# On local machine, create daily backup download script
# ~/scripts/download-murphys-backups.sh

#!/bin/bash

DATE=$(date +%Y-%m-%d)
BACKUP_DIR=~/murphys-backups/$DATE
mkdir -p $BACKUP_DIR

# Download latest backups
scp ravidor@167.99.53.90:/root/backups/murphys-$DATE-*.db $BACKUP_DIR/
scp ravidor@167.99.53.90:/root/backups/.env-$DATE-* $BACKUP_DIR/

# Verify download
if [ -f $BACKUP_DIR/murphys-$DATE-*.db ]; then
 echo "Backup downloaded successfully"
else
 echo "Backup download failed" | mail -s "Backup Download Failed" you@example.com
fi

# Delete backups older than 90 days
find ~/murphys-backups/ -type d -mtime +90 -exec rm -rf {} \;
```

Add to local crontab:
```cron
0 4 * * * ~/scripts/download-murphys-backups.sh
```

#### Option 3: rsync to another host

Copy `/root/backups/` to a second machine or object storage you control. The retired
n8n droplet is not used for off-site copies.

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
