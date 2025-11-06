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
sqlite3 /root/murphys-laws/murphys.db "SELECT COUNT(*) FROM laws;"
# Should be close to backup count (difference < 10)
```

---

## n8n Droplet (45.55.74.28)

### Test 1: n8n Database Backup

```bash
# SSH into n8n droplet
ssh root@45.55.74.28

# Check latest n8n backup
LATEST_N8N_BACKUP=$(ls -t /root/backups/n8n-*.db 2>/dev/null | head -1)

if [ -n "$LATEST_N8N_BACKUP" ]; then
    echo "n8n backup found: $(basename $LATEST_N8N_BACKUP)"

    # Test integrity
    sqlite3 "$LATEST_N8N_BACKUP" "PRAGMA integrity_check;"
    # Should output: ok

    # Check workflow count
    echo "Workflows in backup:"
    sqlite3 "$LATEST_N8N_BACKUP" "SELECT COUNT(*) FROM workflow_entity;"

    # Compare with production
    echo "Workflows in production:"
    docker exec n8n sqlite3 /home/node/.n8n/database.sqlite "SELECT COUNT(*) FROM workflow_entity;"
else
    echo "No n8n backup found"
fi
```

### Test 2: GitHub Workflow Backup

```bash
# Check GitHub backup repository
cd /home/deploy/n8n-workflows

# Update from GitHub
git pull

# Count workflow files
WORKFLOW_COUNT=$(ls -1 workflows/*.json 2>/dev/null | wc -l)
echo "GitHub has $WORKFLOW_COUNT workflow files"

# Verify files are valid JSON
for file in workflows/*.json; do
    if jq empty "$file" 2>/dev/null; then
        echo "Valid JSON: $(basename $file)"
    else
        echo "Invalid JSON: $(basename $file)"
    fi
done

# Check recent backup history
echo "Recent backups:"
git log --oneline -5
```

### Test 3: Test Restore to Temp Location

```bash
# Create test directory
TEST_DIR="/tmp/n8n-restore-test-$$"
mkdir -p "$TEST_DIR"

# Copy latest backup
LATEST_BACKUP=$(ls -t /root/backups/n8n-*.db | head -1)
cp "$LATEST_BACKUP" "$TEST_DIR/test-n8n.db"

# Test database integrity
sqlite3 "$TEST_DIR/test-n8n.db" "PRAGMA integrity_check;"
# Should output: ok

# List workflows in backup
echo "Workflows in backup:"
sqlite3 "$TEST_DIR/test-n8n.db" "SELECT id, name, active FROM workflow_entity;" | head -10

# Cleanup
rm -rf "$TEST_DIR"
echo "Restore test completed"
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

### n8n Droplet Success
- n8n database backup exists and is valid
- GitHub has workflow JSON files
- All JSON files are valid
- Workflow count matches between backup and production
- Can restore database to temp location

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
sqlite3 /root/murphys-laws/murphys.db "SELECT COUNT(*), MAX(created_at) FROM laws;"
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
