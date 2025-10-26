# Backup Restore Testing Guide

Complete guide for testing backup and restore procedures on both droplets.

## 🎯 Testing Approaches

### Option 1: Non-Disruptive Testing (Recommended First)
Tests backup integrity without affecting production.
- **Downtime**: None
- **Risk**: Very low
- **Duration**: 10-15 minutes per droplet
- **What it tests**: Backup validity, integrity, accessibility

### Option 2: Full Disaster Recovery Drill (Quarterly Recommended)
Complete restore simulation on a test environment.
- **Downtime**: 2-4 hours
- **Risk**: Medium (use maintenance window)
- **Duration**: 2-4 hours
- **What it tests**: Complete recovery procedures

---

## 🧪 Option 1: Non-Disruptive Testing

### Main Droplet (167.99.53.90)

#### Step 1: Upload Test Script

```bash
# From your local machine
scp scripts/test-backup-restore.sh ravidor@167.99.53.90:/tmp/

# SSH into server
ssh ravidor@167.99.53.90

# Install script
sudo cp /tmp/test-backup-restore.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/test-backup-restore.sh
```

#### Step 2: Run Test

```bash
# Run the comprehensive test
sudo /usr/local/bin/test-backup-restore.sh
```

**What the test does:**
1. ✅ Verifies backup files exist (database, environment, application)
2. ✅ Tests database integrity with SQLite PRAGMA checks
3. ✅ Compares backup data with production (row counts)
4. ✅ Restores to temporary location (no production impact)
5. ✅ Tests application archive extraction
6. ✅ Verifies environment file contents
7. ✅ Checks backup freshness (< 30 hours)
8. ✅ Validates backup script and cron configuration
9. ✅ Reviews backup logs for errors

#### Step 3: Review Results

```bash
# View the test report
cat /tmp/backup-restore-test-$(date +%Y-%m-%d).txt

# Check your email for the full report
```

**Expected Output:**
```
✅ ALL TESTS PASSED - Backups are ready for disaster recovery
Total Tests: 20
Passed: 20
Failed: 0
```

#### Step 4: Manual Verification (Optional)

Test a specific restore manually:

```bash
# Create test directory
TEST_DIR="/tmp/manual-restore-test"
mkdir -p "$TEST_DIR"

# Get latest backup
LATEST_BACKUP=$(ls -t /root/backups/murphys-*.db | head -1)

# Copy to test location
cp "$LATEST_BACKUP" "$TEST_DIR/test.db"

# Test database
sqlite3 "$TEST_DIR/test.db" "PRAGMA integrity_check;"
# Should output: ok

# Query data
sqlite3 "$TEST_DIR/test.db" "SELECT COUNT(*) FROM laws;"
# Should show number of laws

# Compare with production
sqlite3 /root/murphys-laws/murphys.db "SELECT COUNT(*) FROM laws;"
# Should be close to backup count

# Cleanup
rm -rf "$TEST_DIR"
```

---

### n8n Droplet (45.55.74.28)

#### Step 1: Test n8n Database Backup

```bash
# SSH into n8n server
ssh ravidor@45.55.74.28

# Check latest n8n backup
LATEST_N8N_BACKUP=$(ls -t /root/backups/n8n-*.db 2>/dev/null | head -1)

if [ -n "$LATEST_N8N_BACKUP" ]; then
    echo "✅ n8n backup found: $(basename $LATEST_N8N_BACKUP)"

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
    echo "❌ No n8n backup found"
fi
```

#### Step 2: Test GitHub Workflow Backup

```bash
# Check GitHub backup
cd /home/deploy/n8n-workflows

# Update from GitHub
git pull

# Count workflow files
WORKFLOW_COUNT=$(ls -1 workflows/*.json 2>/dev/null | wc -l)
echo "✅ GitHub has $WORKFLOW_COUNT workflow files"

# Verify files are valid JSON
for file in workflows/*.json; do
    if jq empty "$file" 2>/dev/null; then
        echo "✅ Valid JSON: $(basename $file)"
    else
        echo "❌ Invalid JSON: $(basename $file)"
    fi
done

# Check git history
echo "Recent backups:"
git log --oneline -5
```

#### Step 3: Test Restore to Temp Location

```bash
# Create test directory
TEST_DIR="/tmp/n8n-restore-test"
mkdir -p "$TEST_DIR"

# Copy latest backup
LATEST_BACKUP=$(ls -t /root/backups/n8n-*.db | head -1)
cp "$LATEST_BACKUP" "$TEST_DIR/test-n8n.db"

# Test database integrity
sqlite3 "$TEST_DIR/test-n8n.db" "PRAGMA integrity_check;"

# List workflows
echo "Workflows in backup:"
sqlite3 "$TEST_DIR/test-n8n.db" "SELECT id, name, active FROM workflow_entity;" | head -10

# Cleanup
rm -rf "$TEST_DIR"
```

---

## 🚨 Option 2: Full Disaster Recovery Drill

**⚠️  WARNING**: This simulates a real disaster recovery. Schedule during maintenance window.

### Prerequisites

1. **Schedule maintenance window** (2-4 hours)
2. **Notify users** (if applicable)
3. **Have recent backups** (< 24 hours old)
4. **Document current state**:
   ```bash
   # On main droplet
   pm2 list > /tmp/pm2-before.txt
   systemctl list-units --state=active > /tmp/services-before.txt
   df -h > /tmp/disk-before.txt
   ```

### Drill Procedure - Main Droplet

#### Phase 1: Simulate Failure

```bash
# SSH into main droplet
ssh ravidor@167.99.53.90

# Stop all services (simulates failure)
sudo pm2 stop all

# Optional: Rename database to simulate corruption
sudo mv /root/murphys-laws/murphys.db /root/murphys-laws/murphys.db.FAILED
```

#### Phase 2: Execute Recovery

Follow **DISASTER-RECOVERY.md** - Scenario 1: Database Corruption

```bash
# 1. Find latest backup
LATEST_BACKUP=$(ls -t /root/backups/murphys-*.db | head -1)
echo "Restoring from: $LATEST_BACKUP"

# 2. Verify backup integrity
sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;"

# 3. Restore database
sudo cp "$LATEST_BACKUP" /root/murphys-laws/murphys.db

# 4. Verify restored database
sqlite3 /root/murphys-laws/murphys.db "PRAGMA integrity_check;"
sqlite3 /root/murphys-laws/murphys.db "SELECT COUNT(*) FROM laws;"

# 5. Restart services
sudo pm2 restart all

# 6. Wait for services to stabilize
sleep 10

# 7. Verify services
pm2 list
curl -I https://murphys-laws.com
curl https://murphys-laws.com/api/health
```

#### Phase 3: Verify Recovery

```bash
# Check all services are running
pm2 list
# All should show "online"

# Test frontend
curl -I https://murphys-laws.com
# Should return 200

# Test API
curl https://murphys-laws.com/api/health
# Should return {"ok":true,"dbQueryTime":...}

# Check database
sqlite3 /root/murphys-laws/murphys.db "SELECT COUNT(*) FROM laws;"
# Should return correct count

# Compare before/after
diff /tmp/pm2-before.txt <(pm2 list)
```

#### Phase 4: Document Results

```bash
# Calculate recovery time
echo "Recovery started: [TIME]"
echo "Services restored: [TIME]"
echo "Total RTO: [DURATION]"

# Data loss assessment
echo "Backup timestamp: $(stat -c %y $LATEST_BACKUP)"
echo "Current timestamp: $(date)"
echo "Data loss window: [HOURS]"

# Document any issues
cat > /tmp/recovery-drill-report.txt << EOF
Disaster Recovery Drill Report
Date: $(date)
Scenario: Database Corruption

Recovery Time Objective (RTO): [ACTUAL TIME]
Recovery Point Objective (RPO): [HOURS OF DATA LOSS]

Steps Taken:
1. Identified failure
2. Located latest backup
3. Verified backup integrity
4. Restored database
5. Restarted services
6. Verified functionality

Issues Encountered:
[LIST ANY ISSUES]

Lessons Learned:
[LIST IMPROVEMENTS]

Status: ✅ Success / ❌ Failed
EOF

# Email report
cat /tmp/recovery-drill-report.txt | mail -s "[Murphy's Laws] Disaster Recovery Drill Complete" ravidor@gmail.com
```

---

### Drill Procedure - n8n Droplet

#### Simulate n8n Container Failure

```bash
# SSH into n8n droplet
ssh ravidor@45.55.74.28

# Stop n8n
docker stop n8n

# Remove container (keeps data)
docker rm n8n

# Simulate data corruption
sudo mv /var/lib/docker/volumes/n8n_data/_data/database.sqlite \
     /var/lib/docker/volumes/n8n_data/_data/database.sqlite.FAILED
```

#### Execute Recovery

```bash
# 1. Restore from local backup
LATEST_BACKUP=$(ls -t /root/backups/n8n-*.db | head -1)
sudo cp "$LATEST_BACKUP" \
     /var/lib/docker/volumes/n8n_data/_data/database.sqlite

# 2. Start n8n container
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 127.0.0.1:5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_HOST=n8n.murphys-laws.com \
  -e N8N_PROTOCOL=https \
  n8nio/n8n

# 3. Wait for startup
sleep 30

# 4. Verify
docker ps | grep n8n
curl -I https://n8n.murphys-laws.com

# 5. Check workflows (login to UI)
# Access https://n8n.murphys-laws.com and verify workflows exist
```

---

## 📊 Testing Schedule

### Recommended Testing Frequency

| Test Type | Frequency | Duration |
|-----------|-----------|----------|
| **Non-Disruptive Test** | Monthly | 15 min |
| **Full Recovery Drill** | Quarterly | 2-4 hours |
| **Backup Verification** | Weekly (automated) | 5 min |

### Next Testing Dates

Create calendar reminders:

```
Non-Disruptive Tests:
- [ ] January 26, 2025
- [ ] February 26, 2025
- [ ] March 26, 2025

Quarterly Recovery Drills:
- [ ] March 2025 (Q1)
- [ ] June 2025 (Q2)
- [ ] September 2025 (Q3)
- [ ] December 2025 (Q4)
```

---

## ✅ Success Criteria

### Non-Disruptive Test Success
- All 9 test sections pass
- No integrity check failures
- Backup age < 30 hours
- Data difference < 10 rows

### Full Drill Success
- RTO < 4 hours (recovery time)
- RPO < 24 hours (data loss)
- All services restored
- No data corruption
- Users can access site

---

## 🚨 If Tests Fail

### Common Issues and Solutions

**Issue**: Database integrity check fails
```bash
# Solution: Check disk space and backup script
df -h
tail -50 /var/log/backup-murphys.log
# Run manual backup
sudo /usr/local/bin/backup-murphys.sh
```

**Issue**: Backup age > 30 hours
```bash
# Solution: Check cron job
crontab -l | grep backup
# Check backup logs
tail -50 /var/log/backup-murphys.log
# Verify script works manually
sudo /usr/local/bin/backup-murphys.sh
```

**Issue**: Cannot query restored database
```bash
# Solution: Check permissions
ls -l /root/murphys-laws/murphys.db
sudo chown root:root /root/murphys-laws/murphys.db
sudo chmod 644 /root/murphys-laws/murphys.db
```

**Issue**: Services don't start after restore
```bash
# Solution: Check logs
pm2 logs
tail -50 /root/murphys-laws/logs/api-error.log
# Restart with fresh environment
pm2 delete all
pm2 start ecosystem.config.cjs
```

---

## 📋 Testing Checklist

### Before Testing
- [ ] Recent backups exist (< 24 hours)
- [ ] Sufficient disk space (> 5GB free)
- [ ] Services are running normally
- [ ] Have SSH access to both droplets
- [ ] Email alerts are working

### Main Droplet Testing
- [ ] Run automated test script
- [ ] Review test report
- [ ] All tests passing
- [ ] Backup files verified
- [ ] Database integrity confirmed

### n8n Droplet Testing
- [ ] n8n database backup verified
- [ ] GitHub workflow backup current
- [ ] Workflow JSON files valid
- [ ] Can restore from both sources

### After Testing
- [ ] Document results
- [ ] Note any issues
- [ ] Update procedures if needed
- [ ] Schedule next test

---

## 📝 Test Report Template

Copy this template for each test:

```
BACKUP RESTORE TEST REPORT
==========================

Date: YYYY-MM-DD
Tester: [NAME]
Server: Main Droplet / n8n Droplet
Test Type: Non-Disruptive / Full Drill

RESULTS:
--------
Total Tests: XX
Passed: XX
Failed: XX

ISSUES FOUND:
-------------
1. [Issue description]
   Solution: [How it was fixed]

2. [Issue description]
   Solution: [How it was fixed]

RECOMMENDATIONS:
----------------
1. [Improvement suggestion]
2. [Process update]

RECOVERY METRICS (Full Drill Only):
-----------------------------------
RTO (Recovery Time): XX hours
RPO (Data Loss): XX hours
Services Restored: XX/XX

STATUS: ✅ PASSED / ⚠️  ISSUES / ❌ FAILED

NEXT TEST: YYYY-MM-DD
```

---

**Last Updated**: 2025-01-26
**Next Review**: 2025-04-26
