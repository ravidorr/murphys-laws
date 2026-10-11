# Quick Backup Restore Test Guide

Execute these commands directly on each droplet to test backup restore procedures.

---

## Main Application Droplet (167.99.53.90)

### Step 1: Upload and Install Test Script

```bash
# On your local machine
scp scripts/test-backup-restore.sh root@167.99.53.90:/tmp/

# SSH into main droplet
ssh root@167.99.53.90

# Install the test script
sudo cp /tmp/test-backup-restore.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/test-backup-restore.sh
```

### Step 2: Run Automated Test

```bash
# Execute the comprehensive test suite
sudo /usr/local/bin/test-backup-restore.sh
```

**Expected output:**
```
ALL TESTS PASSED - Backups are ready for disaster recovery
Total Tests: 20
Passed: 20
Failed: 0
```

### Step 3: Review Results

```bash
# View the detailed test report
cat /tmp/backup-restore-test-$(date +%Y-%m-%d).txt

# Check your email (ravidor@gmail.com) for the full report
```

### Step 4: Verify Specific Backups (Optional)

If you want to manually verify a specific backup:

```bash
# Get latest database backup
LATEST_BACKUP=$(ls -t /root/backups/murphys-*.db | head -1)
echo "Testing: $LATEST_BACKUP"

# Test database integrity
sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;"
# Should output: ok

# Query data from backup
sqlite3 "$LATEST_BACKUP" "SELECT COUNT(*) FROM laws;"
# Should show number of laws

# Compare with production
sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;"
# Should be close to backup count (difference < 10)
```

---

## Success Criteria

### Main Droplet Success
- All automated tests pass (20/20)
- Database integrity check returns "ok"
- Backup age < 30 hours
- Data difference between backup and production < 10 rows
- Application archive extracts successfully
- Environment backup contains required keys
- Cron job is configured

---

## If Tests Fail

### Database integrity check fails
```bash
# Check disk space
df -h

# Check backup logs
tail -50 /var/log/backup-murphys.log

# Run manual backup
sudo /usr/local/bin/backup-murphys.sh
```

### Backup is too old (> 30 hours)
```bash
# Check cron job
crontab -l | grep backup

# Check backup logs
tail -50 /var/log/backup-murphys.log

# Run manual backup
sudo /usr/local/bin/backup-murphys.sh
```

### Data difference is large (> 10 rows)
```bash
# This might be normal if laws are being added
# Check when backup was created
ls -lh /root/backups/murphys-*.db | head -1

# Check recent database activity
sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*), MAX(created_at) FROM laws;"
```

---

## Next Steps After Testing

1. **Document results** - Note any failures or warnings
2. **Fix issues** - Address any problems found
3. **Schedule monthly tests** - Add reminder for monthly testing
4. **Consider quarterly full drill** - Schedule a complete disaster recovery simulation

For full disaster recovery drill procedures, see [`TEST-BACKUP-RESTORE.md`](./TEST-BACKUP-RESTORE.md).

---

**Last Updated:** 2025-01-26
