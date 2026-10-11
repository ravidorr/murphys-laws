# Backup Restore Testing Guide

Complete guide for testing backup and restore procedures on both droplets.

## Testing Approaches

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

## Option 1: Non-Disruptive Testing

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
1. Verifies backup files exist (database, environment, application)
2. Tests database integrity with SQLite PRAGMA checks
3. Compares backup data with production (row counts)
4. Restores to temporary location (no production impact)
5. Tests application archive extraction
6. Verifies environment file contents
7. Checks backup freshness (< 30 hours)
8. Validates backup script and cron configuration
9. Reviews backup logs for errors

#### Step 3: Review Results

```bash
# View the test report
cat /tmp/backup-restore-test-$(date +%Y-%m-%d).txt

# Check your email for the full report
```

**Expected Output:**
```
ALL TESTS PASSED - Backups are ready for disaster recovery
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
sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;"
# Should be close to backup count

# Cleanup
rm -rf "$TEST_DIR"
```

---

## Option 2: Full Disaster Recovery Drill

**WARNING**: This simulates a real disaster recovery. Schedule during maintenance window.

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
sudo mv /root/murphys-laws/backend/murphys.db /root/murphys-laws/backend/murphys.db.FAILED
```

#### Phase 2: Execute Recovery

Follow **[DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md)** - Scenario 1: Database Corruption

```bash
# 1. Find latest backup
LATEST_BACKUP=$(ls -t /root/backups/murphys-*.db | head -1)
echo "Restoring from: $LATEST_BACKUP"

# 2. Verify backup integrity
sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;"

# 3. Restore database
sudo cp "$LATEST_BACKUP" /root/murphys-laws/backend/murphys.db

# 4. Verify restored database
sqlite3 /root/murphys-laws/backend/murphys.db "PRAGMA integrity_check;"
sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;"

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
sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;"
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

Status: Success / Failed
EOF

# Email report
cat /tmp/recovery-drill-report.txt | mail -s "[Murphy's Laws] Disaster Recovery Drill Complete" ravidor@gmail.com
```

---

## Testing Schedule

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

## Success Criteria

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

## If Tests Fail

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
ls -l /root/murphys-laws/backend/murphys.db
sudo chown root:root /root/murphys-laws/backend/murphys.db
sudo chmod 644 /root/murphys-laws/backend/murphys.db
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

## Testing Checklist

### Before Testing
- [ ] Recent backups exist (< 24 hours)
- [ ] Sufficient disk space (> 5GB free)
- [ ] Services are running normally
- [ ] Have SSH access to the main droplet
- [ ] Email alerts are working

### Main Droplet Testing
- [ ] Run automated test script
- [ ] Review test report
- [ ] All tests passing
- [ ] Backup files verified
- [ ] Database integrity confirmed

### After Testing
- [ ] Document results
- [ ] Note any issues
- [ ] Update procedures if needed
- [ ] Schedule next test

---

## Test Report Template

Copy this template for each test:

```
BACKUP RESTORE TEST REPORT
==========================

Date: YYYY-MM-DD
Tester: [NAME]
Server: Main Droplet
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

STATUS: PASSED / ISSUES / FAILED

NEXT TEST: YYYY-MM-DD
```

---

**Last Updated**: 2025-01-26
**Next Review**: 2025-04-26
