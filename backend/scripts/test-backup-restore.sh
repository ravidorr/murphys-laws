#!/bin/bash

#############################################################################
# Backup Restore Testing Script
# Tests database and environment backup integrity without affecting production
#############################################################################

# Load the shared alert helper from beside this script (following symlinks), else from the repo copy;
# if neither exists, stop rather than carry on and lose every alert silently.
_alert_self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
_alert_helper="$(dirname "$_alert_self")/alert-email.sh"
[ -f "$_alert_helper" ] || _alert_helper="${REPO_ROOT:-/root/murphys-laws}/backend/scripts/alert-email.sh"
# The helper's existence is tested before sourcing it so a missing file is always handled here, whatever
# shell options are set (a POSIX-mode shell exits as soon as `source` fails).
# shellcheck source=alert-email.sh
if [ ! -f "$_alert_helper" ] || ! source "$_alert_helper"; then
    echo "FATAL: cannot load alert-email.sh (looked beside $0 and under \${REPO_ROOT:-/root/murphys-laws}); alerts would be lost" >&2
    logger -t murphys-alerts -p user.err -- "FATAL: $(basename "$0") cannot load alert-email.sh" 2>/dev/null
    exit 1
fi
ALERT_EMAIL="$(resolve_alert_email)"
TEST_REPORT="/tmp/backup-restore-test-$(date +%Y-%m-%d).txt"
PASSED=0
FAILED=0

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$TEST_REPORT"
}

test_pass() {
    echo "PASS: $1" | tee -a "$TEST_REPORT"
    PASSED=$((PASSED + 1))
}

test_fail() {
    echo "FAIL: $1" | tee -a "$TEST_REPORT"
    FAILED=$((FAILED + 1))
}

log "=========================================="
log "Backup Restore Testing"
log "=========================================="
log ""

#############################################################################
# TEST 1: Verify Database and Environment Backups Exist
#############################################################################

log "TEST 1: Checking database and environment backups..."

LATEST_DB_BACKUP=$(ls -t /root/backups/murphys_db_*.db 2>/dev/null | head -1)
LATEST_ENV_BACKUP=$(ls -t /root/backups/env_*.bak 2>/dev/null | head -1)

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
    PROD_COUNT=$(sqlite3 /root/murphys-laws/backend/murphys.db "SELECT COUNT(*) FROM laws;" 2>&1)
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
# Restored copies (including the decrypted env file) are private to this script
chmod 700 "$TEST_DIR"

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
            test_fail "Restored database integrity check failed: $TEST_INTEGRITY"
        fi

        # Test queries on restored database
        TEST_QUERY=$(sqlite3 "$TEST_DIR/test-restore.db" "SELECT substr(replace(replace(COALESCE(NULLIF(title, ''), text), char(13), ' '), char(10), ' '), 1, 120) FROM laws ORDER BY id LIMIT 1;" 2>&1)
        if [ $? -ne 0 ]; then
            test_fail "Cannot query restored database: $TEST_QUERY"
        elif [ -z "$TEST_QUERY" ]; then
            test_fail "Restored database has no laws to sample"
        else
            test_pass "Can query restored database"
            log "  Sample law: $TEST_QUERY"
        fi
    else
        test_fail "Failed to copy database to temp location"
    fi
fi

log ""

#############################################################################
# TEST 4: Test Environment File Restore
#############################################################################

log "TEST 4: Testing environment file..."

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
# TEST 5: Backup Age Check
#############################################################################

log "TEST 5: Checking backup freshness..."

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
# TEST 6: Test Backup Script Execution
#############################################################################

log "TEST 6: Testing backup script..."

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
# TEST 7: Cron Job Verification
#############################################################################

log "TEST 7: Verifying backup cron job..."

CRON_ENTRY=$(crontab -l 2>/dev/null | grep "backup-murphys.sh")

if [ -n "$CRON_ENTRY" ]; then
    test_pass "Backup cron job is configured"
    log "  Cron entry: $CRON_ENTRY"
else
    test_fail "Backup cron job not found in crontab"
fi

log ""

#############################################################################
# TEST 8: Check Recent Backup Logs
#############################################################################

log "TEST 8: Checking backup logs..."

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
# TEST 9: Encrypted Off-Site Copy
#############################################################################

log "TEST 9: Checking the encrypted off-site copy..."

OFFSITE_MAX_AGE_HOURS=30
_offsite_helper="$(dirname "$_alert_self")/backup-offsite.sh"
[ -f "$_offsite_helper" ] || _offsite_helper="${REPO_ROOT:-/root/murphys-laws}/backend/scripts/backup-offsite.sh"

OFFSITE_STATUS=0
if [ ! -f "$_offsite_helper" ] || ! source "$_offsite_helper"; then
    test_fail "Cannot load backup-offsite.sh (looked beside $0 and under \${REPO_ROOT:-/root/murphys-laws})"
else
    offsite_load_config || OFFSITE_STATUS=$?
    case "$OFFSITE_STATUS" in
        1)
            test_fail "Off-site backup is not configured (see shared/docs/BACKUP-RESTORE.md, Off-Site Backup Strategy)"
            ;;
        0)
            # Decrypted files stay inside the private $TEST_DIR, which is removed at the end
            OFFSITE_DB=$(offsite_latest db 2>/dev/null) || OFFSITE_DB=""
            if [ -z "$OFFSITE_DB" ]; then
                test_fail "No off-site database copy found in $OFFSITE_REMOTE/db/"
            else
                test_pass "Off-site database copy exists: $OFFSITE_DB"

                if offsite_is_fresh db "$OFFSITE_DB" "$OFFSITE_MAX_AGE_HOURS"; then
                    test_pass "Off-site database copy is fresh (< $OFFSITE_MAX_AGE_HOURS hours old)"
                else
                    test_fail "Off-site database copy is older than $OFFSITE_MAX_AGE_HOURS hours ($OFFSITE_DB)"
                fi

                if (umask 077; offsite_fetch db "$OFFSITE_DB" "$TEST_DIR/offsite-restore.db") 2>/dev/null; then
                    test_pass "Off-site database copy downloaded and decrypted"

                    OFFSITE_INTEGRITY=$(sqlite3 "$TEST_DIR/offsite-restore.db" "PRAGMA integrity_check;" 2>&1)
                    if [ "$OFFSITE_INTEGRITY" = "ok" ]; then
                        test_pass "Off-site database integrity check passed"
                    else
                        test_fail "Off-site database integrity check failed: $OFFSITE_INTEGRITY"
                    fi

                    OFFSITE_ROWS=$(sqlite3 "$TEST_DIR/offsite-restore.db" "SELECT COUNT(*) FROM laws;" 2>&1)
                    if [ $? -eq 0 ] && [ "${OFFSITE_ROWS:-0}" -gt 0 ] 2>/dev/null; then
                        test_pass "Can query data from the off-site copy ($OFFSITE_ROWS laws)"
                    else
                        test_fail "Cannot query laws from the off-site copy: $OFFSITE_ROWS"
                    fi
                else
                    test_fail "Could not download and decrypt the off-site database copy (wrong passphrase or damaged object)"
                fi
            fi

            if [ -n "$LATEST_ENV_BACKUP" ]; then
                OFFSITE_ENV=$(offsite_latest env 2>/dev/null) || OFFSITE_ENV=""
                if [ -z "$OFFSITE_ENV" ]; then
                    test_fail "No off-site env copy found in $OFFSITE_REMOTE/env/"
                elif ! offsite_is_fresh env "$OFFSITE_ENV" "$OFFSITE_MAX_AGE_HOURS"; then
                    test_fail "Off-site env copy is older than $OFFSITE_MAX_AGE_HOURS hours ($OFFSITE_ENV)"
                elif (umask 077; offsite_fetch env "$OFFSITE_ENV" "$TEST_DIR/offsite-env") 2>/dev/null; then
                    if grep -q "SMTP_HOST" "$TEST_DIR/offsite-env" && grep -q "SMTP_USER" "$TEST_DIR/offsite-env" \
                        && grep -q "SMTP_PASS" "$TEST_DIR/offsite-env"; then
                        test_pass "Off-site env copy is fresh, decrypts, and has the SMTP keys"
                    else
                        test_fail "Off-site env copy decrypted but is missing SMTP keys"
                    fi
                else
                    test_fail "Could not download and decrypt the off-site env copy"
                fi
            fi
            ;;
        *)
            test_fail "Off-site backup is misconfigured: $OFFSITE_ERROR"
            ;;
    esac
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
    log "ALL TESTS PASSED - Backups are ready for disaster recovery"
    EXIT_CODE=0
else
    log "SOME TESTS FAILED - Review issues above"
    EXIT_CODE=1
fi

log ""
log "Full report saved to: $TEST_REPORT"
log "=========================================="

# Email report
MAIL_STATUS=0
cat "$TEST_REPORT" | send_alert_mail "[Murphy's Laws] Backup Restore Test - $PASSED Passed, $FAILED Failed" || MAIL_STATUS=$?
if [ "$MAIL_STATUS" -ne 0 ]; then
    log "Report NOT emailed ($(describe_alert_mail_status "$MAIL_STATUS"))"
    ALERT_UNDELIVERED=1
fi

# A failed test keeps its own exit code; a passing run whose report was not delivered exits 2
exit "$(delivery_exit_code "$EXIT_CODE")"
