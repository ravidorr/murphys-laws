#!/bin/bash

#############################################################################
# Health Monitor Script
# Runs health checks periodically and restarts services if they're unresponsive
# Should be run via cron every 5 minutes
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/root/murphys-laws"  # Hardcoded for cron execution
LOG_FILE="/var/log/health-monitor.log"
HEALTH_CHECK_FAILURES="/var/tmp/health-check-failures"

# Configuration
MAX_FAILURES=3  # Restart after 3 consecutive failures
ALERT_EMAIL="ravidor@gmail.com"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Get current failure count
get_failure_count() {
    if [ -f "$HEALTH_CHECK_FAILURES" ]; then
        cat "$HEALTH_CHECK_FAILURES"
    else
        echo "0"
    fi
}

# Increment failure count
increment_failure_count() {
    local count=$(get_failure_count)
    count=$((count + 1))
    echo "$count" > "$HEALTH_CHECK_FAILURES"
    echo "$count"
}

# Reset failure count
reset_failure_count() {
    echo "0" > "$HEALTH_CHECK_FAILURES"
}

# Send alert email
send_alert() {
    local subject="$1"
    local body="$2"
    echo "$body" | mail -s "[Murphy's Laws] $subject" "$ALERT_EMAIL"
}

# Run health check
log "Running health check monitor"

cd "$PROJECT_DIR" || exit 1

# Run the health check script
if node backend/scripts/health-check.mjs > /tmp/health-check-output.txt 2>&1; then
    log "Health check passed"
    reset_failure_count
    exit 0
else
    health_check_exit_code=$?
    health_check_output=$(cat /tmp/health-check-output.txt)

    log "Health check failed (exit code: $health_check_exit_code)"
    log "Output: $health_check_output"

    # Increment failure count
    failure_count=$(increment_failure_count)
    log "Failure count: $failure_count/$MAX_FAILURES"

    # If failures exceed threshold, restart services
    if [ "$failure_count" -ge "$MAX_FAILURES" ]; then
        log "Failure threshold reached. Attempting to restart services..."

        # Get PM2 process status before restart
        pm2_status_before=$(pm2 jlist 2>&1 || echo "PM2 not available")

        # Restart PM2 processes
        pm2 restart all
        sleep 5

        # Get PM2 process status after restart
        pm2_status_after=$(pm2 jlist 2>&1 || echo "PM2 not available")

        # Reset failure count
        reset_failure_count

        # Send alert
        send_alert "Services Restarted Due to Health Check Failures" \
"Health checks failed $MAX_FAILURES times consecutively. Services have been automatically restarted.

Last Health Check Output:
$health_check_output

PM2 Status Before Restart:
$pm2_status_before

PM2 Status After Restart:
$pm2_status_after

Time: $(date)

Please investigate the root cause of the failures."

        log "Services restarted. Alert sent."

        # Wait a bit and run health check again
        sleep 10
        if node backend/scripts/health-check.mjs > /tmp/health-check-retest.txt 2>&1; then
            log "Health check passed after restart"
            exit 0
        else
            retest_output=$(cat /tmp/health-check-retest.txt)
            log "Health check still failing after restart"

            send_alert "CRITICAL: Services Still Failing After Restart" \
"Services were restarted but health checks are still failing.

Health Check Output After Restart:
$retest_output

Time: $(date)

IMMEDIATE INVESTIGATION REQUIRED."

            exit 1
        fi
    else
        # Not at threshold yet, just log and alert
        send_alert "Health Check Failed ($failure_count/$MAX_FAILURES)" \
"Health check has failed $failure_count time(s). Services will be automatically restarted after $MAX_FAILURES consecutive failures.

Health Check Output:
$health_check_output

Time: $(date)"

        exit 1
    fi
fi
