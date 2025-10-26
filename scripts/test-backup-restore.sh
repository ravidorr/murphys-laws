#!/bin/bash

#############################################################################
# Backup Restore Testing Script
# Tests backup integrity and restore procedures without affecting production
#############################################################################

ALERT_EMAIL="ravidor@gmail.com"
TEST_REPORT="/tmp/backup-restore-test-$(date +%Y-%m-%d).txt"
PASSED=0
FAILED=0

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$TEST_REPORT"
}

test_pass() {
    echo "✅ PASS: $1" | tee -a "$TEST_REPORT"
    PASSED=$((PASSED + 1))
}

test_fail() {
    echo "❌ FAIL: $1" | tee -a "$TEST_REPORT"
    FAILED=$((FAILED + 1))
}

log "=========================================="
log "Backup Restore Testing"
log "=========================================="
log ""

#############################################################################
# TEST 1: Verify Backup Files Exist
#############################################################################

log "TEST 1: Checking backup files..."

LATEST_DB_BACKUP=$(ls -t /root/backups/murphys_db_*.db 2>/dev/null | head -1)
LATEST_ENV_BACKUP=$(ls -t /root/backups/env_*.bak 2>/dev/null | head -1)
LATEST_APP_BACKUP=$(ls -t /root/backups/murphys_app_*.tar.gz 2>/dev/null | head -1)

if [ -n "$LATEST_DB_BACKUP" ]; then
    test_pass "Database backup exists: $(basename $LATEST_DB_BACKUP)"
    DB_SIZE=$(du -h "$LATEST_DB_BACKUP" | cut -f1)
    log "  Size: $DB_SIZE"
else
    test_fail "No database backup found"
fi

if [ -n "$LATEST_ENV_BACKUP" ]; then
    test_pass "Environment backup exists: $(basename $LATEST_ENV_BACKUP)"
else
    test_fail "No environment backup found"
fi

if [ -n "$LATEST_APP_BACKUP" ]; then
    test_pass "Application backup exists: $(basename $LATEST_APP_BACKUP)"
    APP_SIZE=$(du -h "$LATEST_APP_BACKUP" | cut -f1)
    log "  Size: $APP_SIZE"
else
    test_fail "No application backup found"
fi

log ""

#############################################################################
# TEST 2: Database Backup Integrity
#############################################################################

log "TEST 2: Testing database backup integrity..."

if [ -n "$LATEST_DB_BACKUP" ]; then
    # Test SQLite integrity
    INTEGRITY_CHECK=$(sqlite3 "$LATEST_DB_BACKUP" "PRAGMA integrity_check;" 2>&1)

    if [ "$INTEGRITY_CHECK" = "ok" ]; then
        test_pass "Database integrity check passed"
    else
        test_fail "Database integrity check failed: $INTEGRITY_CHECK"
    fi

    # Test data accessibility
    ROW_COUNT=$(sqlite3 "$LATEST_DB_BACKUP" "SELECT COUNT(*) FROM laws;" 2>&1)
    if [ $? -eq 0 ]; then
        test_pass "Can query data from backup ($ROW_COUNT laws)"
    else
        test_fail "Cannot query data from backup: $ROW_COUNT"
    fi

    # Compare with production
    PROD_COUNT=$(sqlite3 /root/murphys-laws/murphys.db "SELECT COUNT(*) FROM laws;" 2>&1)
    DIFF=$((PROD_COUNT - ROW_COUNT))
    log "  Production: $PROD_COUNT laws"
    log "  Backup: $ROW_COUNT laws"
    log "  Difference: $DIFF laws"

    if [ "$DIFF" -lt 10 ]; then
        test_pass "Backup data is recent (difference: $DIFF laws)"
    else
        test_fail "Backup may be outdated (difference: $DIFF laws)"
    fi
else
    test_fail "Skipping database tests (no backup found)"
fi

log ""

#############################################################################
# TEST 3: Test Restore to Temporary Location
#############################################################################

log "TEST 3: Testing restore to temporary location..."

TEST_DIR="/tmp/backup-restore-test-$$"
mkdir -p "$TEST_DIR"

if [ -n "$LATEST_DB_BACKUP" ]; then
    # Restore database to temp location
    cp "$LATEST_DB_BACKUP" "$TEST_DIR/test-restore.db"

    if [ $? -eq 0 ]; then
        test_pass "Database copied to temp location"

        # Verify restored database
        TEST_INTEGRITY=$(sqlite3 "$TEST_DIR/test-restore.db" "PRAGMA integrity_check;" 2>&1)
        if [ "$TEST_INTEGRITY" = "ok" ]; then
            test_pass "Restored database integrity verified"
        else
            test_fail "Restored database integrity check failed"
        fi

        # Test queries on restored database
        TEST_QUERY=$(sqlite3 "$TEST_DIR/test-restore.db" "SELECT title FROM laws LIMIT 1;" 2>&1)
        if [ $? -eq 0 ]; then
            test_pass "Can query restored database"
            log "  Sample law: $TEST_QUERY"
        else
            test_fail "Cannot query restored database"
        fi
    else
        test_fail "Failed to copy database to temp location"
    fi
fi

log ""

#############################################################################
# TEST 4: Test Application Archive Extraction
#############################################################################

log "TEST 4: Testing application archive extraction..."

if [ -n "$LATEST_APP_BACKUP" ]; then
    # Extract to temp location
    tar -tzf "$LATEST_APP_BACKUP" > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        test_pass "Application archive is valid"

        # Extract to temp directory
        tar -xzf "$LATEST_APP_BACKUP" -C "$TEST_DIR" 2>&1

        if [ $? -eq 0 ]; then
            test_pass "Successfully extracted application archive"

            # Verify key files exist
            if [ -f "$TEST_DIR/murphys-laws/package.json" ]; then
                test_pass "package.json found in extracted archive"
            else
                test_fail "package.json not found in extracted archive"
            fi

            if [ -d "$TEST_DIR/murphys-laws/src" ]; then
                test_pass "src/ directory found in extracted archive"
            else
                test_fail "src/ directory not found in extracted archive"
            fi

            if [ -d "$TEST_DIR/murphys-laws/scripts" ]; then
                test_pass "scripts/ directory found in extracted archive"
            else
                test_fail "scripts/ directory not found in extracted archive"
            fi
        else
            test_fail "Failed to extract application archive"
        fi
    else
        test_fail "Application archive is corrupted"
    fi
fi

log ""

#############################################################################
# TEST 5: Test Environment File Restore
#############################################################################

log "TEST 5: Testing environment file..."

if [ -n "$LATEST_ENV_BACKUP" ]; then
    # Check file is readable
    if [ -r "$LATEST_ENV_BACKUP" ]; then
        test_pass "Environment backup is readable"

        # Check for required keys (without exposing values)
        if grep -q "SMTP_HOST" "$LATEST_ENV_BACKUP"; then
            test_pass "SMTP_HOST found in env backup"
        else
            test_fail "SMTP_HOST not found in env backup"
        fi

        if grep -q "SMTP_USER" "$LATEST_ENV_BACKUP"; then
            test_pass "SMTP_USER found in env backup"
        else
            test_fail "SMTP_USER not found in env backup"
        fi

        if grep -q "SMTP_PASS" "$LATEST_ENV_BACKUP"; then
            test_pass "SMTP_PASS found in env backup"
        else
            test_fail "SMTP_PASS not found in env backup"
        fi
    else
        test_fail "Environment backup is not readable"
    fi
fi

log ""

#############################################################################
# TEST 6: Backup Age Check
#############################################################################

log "TEST 6: Checking backup freshness..."

if [ -n "$LATEST_DB_BACKUP" ]; then
    BACKUP_TIME=$(stat -c %Y "$LATEST_DB_BACKUP" 2>/dev/null || stat -f %m "$LATEST_DB_BACKUP" 2>/dev/null)
    NOW=$(date +%s)
    HOURS_OLD=$(( ($NOW - $BACKUP_TIME) / 3600 ))

    log "  Database backup age: $HOURS_OLD hours"

    if [ "$HOURS_OLD" -lt 30 ]; then
        test_pass "Database backup is fresh (< 30 hours old)"
    else
        test_fail "Database backup is old (${HOURS_OLD} hours old)"
    fi
fi

log ""

#############################################################################
# TEST 7: Test Backup Script Execution
#############################################################################

log "TEST 7: Testing backup script..."

if [ -x /usr/local/bin/backup-murphys.sh ]; then
    test_pass "Backup script is executable"

    # Check if script runs (dry-run test)
    log "  Testing backup script syntax..."
    bash -n /usr/local/bin/backup-murphys.sh 2>&1

    if [ $? -eq 0 ]; then
        test_pass "Backup script syntax is valid"
    else
        test_fail "Backup script has syntax errors"
    fi
else
    test_fail "Backup script not found or not executable"
fi

log ""

#############################################################################
# TEST 8: Cron Job Verification
#############################################################################

log "TEST 8: Verifying backup cron job..."

CRON_ENTRY=$(crontab -l 2>/dev/null | grep "backup-murphys.sh")

if [ -n "$CRON_ENTRY" ]; then
    test_pass "Backup cron job is configured"
    log "  Cron entry: $CRON_ENTRY"
else
    test_fail "Backup cron job not found in crontab"
fi

log ""

#############################################################################
# TEST 9: Check Recent Backup Logs
#############################################################################

log "TEST 9: Checking backup logs..."

if [ -f /var/log/backup-murphys.log ]; then
    test_pass "Backup log file exists"

    # Check for recent successful backups
    RECENT_SUCCESS=$(grep "Backup complete" /var/log/backup-murphys.log | tail -1)

    if [ -n "$RECENT_SUCCESS" ]; then
        test_pass "Recent successful backup logged"
        log "  Last success: $RECENT_SUCCESS"
    else
        test_fail "No recent successful backups in log"
    fi

    # Check for errors
    RECENT_ERRORS=$(grep -i "error\|fail" /var/log/backup-murphys.log | tail -5)

    if [ -z "$RECENT_ERRORS" ]; then
        test_pass "No recent errors in backup log"
    else
        test_fail "Recent errors found in backup log"
        log "  Recent errors:"
        echo "$RECENT_ERRORS" | while read line; do
            log "    $line"
        done
    fi
else
    test_fail "Backup log file not found"
fi

log ""

#############################################################################
# Cleanup
#############################################################################

log "Cleaning up test files..."
rm -rf "$TEST_DIR"
test_pass "Cleanup completed"

log ""

#############################################################################
# Summary
#############################################################################

log "=========================================="
log "TEST SUMMARY"
log "=========================================="
log "Total Tests: $((PASSED + FAILED))"
log "Passed: $PASSED"
log "Failed: $FAILED"
log ""

if [ "$FAILED" -eq 0 ]; then
    log "✅ ALL TESTS PASSED - Backups are ready for disaster recovery"
    EXIT_CODE=0
else
    log "⚠️  SOME TESTS FAILED - Review issues above"
    EXIT_CODE=1
fi

log ""
log "Full report saved to: $TEST_REPORT"
log "=========================================="

# Email report
cat "$TEST_REPORT" | mail -s "[Murphy's Laws] Backup Restore Test - $PASSED Passed, $FAILED Failed" "$ALERT_EMAIL"

exit $EXIT_CODE
