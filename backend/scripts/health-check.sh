#!/bin/bash

#############################################################################
# Application Health Check Script
# Monitors HTTP endpoints, API response times, and database performance
# Sends alerts when issues are detected
#############################################################################

# Configuration
FRONTEND_URL="${HEALTH_CHECK_FRONTEND_URL:-https://murphys-laws.com}"
API_URL="${HEALTH_CHECK_API_URL:-https://murphys-laws.com/api/health}"
DB_PATH="/root/murphys-laws/backend/murphys.db"
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
ALERT_EMAIL="$(resolve_alert_email HEALTH_CHECK_EMAIL_TO)"
ALERT_THRESHOLD_MS=5000  # Alert if response time > 5 seconds
LOG_FILE="/var/log/health-check.log"
ALERT_COOLDOWN=3600  # Only send one alert per hour per issue
ALERT_STATE_DIR="/var/tmp/health-check-alerts"

# Create alert state directory
mkdir -p "$ALERT_STATE_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check whether an alert is due: not within the cooldown of the last one that was actually sent
should_send_alert() {
    local alert_type="$1"
    local state_file="$ALERT_STATE_DIR/$alert_type"

    if [ -f "$state_file" ]; then
        local last_alert=$(cat "$state_file")
        local now=$(date +%s)
        local elapsed=$((now - last_alert))

        if [ $elapsed -lt $ALERT_COOLDOWN ]; then
            return 1  # Don't send alert (cooldown active)
        fi
    fi

    return 0  # Send alert
}

# Start the cooldown. Called only after the mail was accepted, so a dropped alert cannot hide the next one.
record_alert_sent() {
    date +%s > "$ALERT_STATE_DIR/$1"
}

# Send email alert
send_alert() {
    local subject="$1"
    local body="$2"
    local alert_type="$3"

    if should_send_alert "$alert_type"; then
        local mail_status=0
        echo "$body" | send_alert_mail "$subject" || mail_status=$?
        if [ "$mail_status" -eq 0 ]; then
            record_alert_sent "$alert_type"
            log "ALERT SENT: $subject"
        else
            log "ALERT NOT SENT ($(describe_alert_mail_status "$mail_status")): $subject"
            ALERT_UNDELIVERED=1
        fi
    else
        log "ALERT SUPPRESSED (cooldown): $subject"
    fi
}

# Check HTTP endpoint
check_http_endpoint() {
    local url="$1"
    local name="$2"

    log "Checking $name: $url"

    # One -w only: curl keeps just the last one, so a separate -w for the status code is never printed.
    # The exit status is read from the command itself; after `local x=$(...)` it would be local's (always 0).
    # -S keeps curl's error text (-s alone hides it), which goes into the log and the alert.
    local result http_code time_total curl_error err_file
    local curl_exit=0
    # Without a temporary file `2>""` would stop curl from running at all and read as a site outage.
    err_file=$(mktemp "${TMPDIR:-/tmp}/health-check-curl.XXXXXX") || {
        log "$name: could not create a temporary file, so the check was not run"
        return 1
    }
    result=$(curl -o /dev/null -sS -w "%{http_code} %{time_total}" --max-time 30 "$url" 2>"$err_file") || curl_exit=$?
    curl_error=$(head -c 300 "$err_file" | tr '\n' ' ')
    curl_error="${curl_error% }"
    rm -f "$err_file"
    read -r http_code time_total <<< "$result"

    if [ $curl_exit -ne 0 ]; then
        log "$name FAILED - curl error code: $curl_exit${curl_error:+ ($curl_error)}"
        send_alert \
            "[CRITICAL] $name Down" \
            "The $name endpoint is not responding.

URL: $url
Error: curl exit code $curl_exit${curl_error:+ ($curl_error)}
Time: $(date)

This requires immediate attention." \
            "${name}_down"
        return 1
    fi

    # curl exited 0, so it should have printed a three-digit status. Anything else (empty, garbled) is a broken
    # check, reported as such instead of as an HTTP error with a blank code.
    if [[ ! "$http_code" =~ ^[0-9]{3}$ ]]; then
        log "$name: curl returned no usable HTTP status (output: '$result')"
        send_alert \
            "[CRITICAL] $name Check Failed" \
            "The $name check could not read an HTTP status from curl, so the endpoint's state is unknown.

URL: $url
curl output: '$result'
Time: $(date)

Check the monitoring host (disk space, curl) before assuming the site is down." \
            "${name}_check_failed"
        return 1
    fi

    # Response time in whole milliseconds, from curl's "seconds.fraction" with plain shell arithmetic (no bc,
    # which a minimal host may lack). Anything else leaves the time unknown, which is logged and shown as such.
    local time_ms="" time_label="unknown"
    if [[ "$time_total" =~ ^([0-9]+)(\.([0-9]+))?$ ]]; then
        local fraction="${BASH_REMATCH[3]}000"
        time_ms=$((10#${BASH_REMATCH[1]} * 1000 + 10#${fraction:0:3}))
        time_label="${time_ms}ms"
    else
        log "$name: could not read the response time from curl ('$time_total')"
    fi

    if [ "$http_code" != "200" ]; then
        log "$name returned HTTP $http_code (expected 200)"
        send_alert \
            "[CRITICAL] $name Error - HTTP $http_code" \
            "The $name endpoint returned an error status.

URL: $url
HTTP Status: $http_code
Response Time: $time_label
Time: $(date)

This requires immediate attention." \
            "${name}_error"
        return 1
    fi

    # Check response time
    if [ -z "$time_ms" ]; then
        log "$name OK (HTTP $http_code) - response time unknown, slow-response check skipped"
    elif [ "$time_ms" -gt "$ALERT_THRESHOLD_MS" ]; then
        log "$name SLOW - ${time_ms}ms (threshold: ${ALERT_THRESHOLD_MS}ms)"
        send_alert \
            "[WARNING] $name Slow Response" \
            "The $name endpoint is responding slowly.

URL: $url
Response Time: ${time_ms}ms
Threshold: ${ALERT_THRESHOLD_MS}ms
HTTP Status: $http_code
Time: $(date)

Consider investigating performance issues." \
            "${name}_slow"
    else
        log "$name OK - ${time_ms}ms (HTTP $http_code)"
    fi

    # Return response time for tracking
    echo "$time_ms"
    return 0
}

# Check database performance
check_database_performance() {
    if [ ! -f "$DB_PATH" ]; then
        log "Database file not found: $DB_PATH"
        return 1
    fi

    log "Checking database performance"

    # Test query with timing
    local start=$(date +%s%N)
    local count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM laws;" 2>&1)
    local end=$(date +%s%N)

    if [ $? -ne 0 ]; then
        log "Database query failed: $count"
        send_alert \
            "[CRITICAL] Database Query Failed" \
            "Database query failed on the main application.

Error: $count
Database: $DB_PATH
Time: $(date)

This requires immediate attention." \
            "db_query_failed"
        return 1
    fi

    # Calculate query time in milliseconds
    local duration_ns=$((end - start))
    local duration_ms=$((duration_ns / 1000000))

    log "Database OK - Query returned $count rows in ${duration_ms}ms"

    # Check if query is too slow
    if [ "$duration_ms" -gt 1000 ]; then
        log "Database query slow: ${duration_ms}ms"
        send_alert \
            "[WARNING] Database Performance Degraded" \
            "Database queries are taking longer than expected.

Query Time: ${duration_ms}ms
Database: $DB_PATH
Rows: $count
Time: $(date)

Consider investigating database performance." \
            "db_slow"
    fi

    # Check database size
    local db_size=$(du -h "$DB_PATH" | cut -f1)
    log "Database size: $db_size"

    echo "$duration_ms"
    return 0
}

# Check PM2 processes
check_pm2_processes() {
    log "Checking PM2 processes"

    local pm2_status=$(pm2 jlist 2>&1)

    if [ $? -ne 0 ]; then
        log "PM2 not responding"
        send_alert \
            "[CRITICAL] PM2 Not Responding" \
            "PM2 process manager is not responding.

Error: $pm2_status
Time: $(date)

This requires immediate attention." \
            "pm2_down"
        return 1
    fi

    # Check each process
    local stopped_processes=$(echo "$pm2_status" | jq -r '.[] | select(.pm2_env.status != "online") | .name' 2>/dev/null)

    if [ -n "$stopped_processes" ]; then
        log "PM2 processes not online: $stopped_processes"
        send_alert \
            "[CRITICAL] PM2 Processes Stopped" \
            "One or more PM2 processes are not running.

Stopped Processes:
$stopped_processes

Time: $(date)

Attempting automatic restart..." \
            "pm2_stopped"

        # Attempt restart
        pm2 restart all
        sleep 5

        # Verify restart
        local still_stopped=$(pm2 jlist | jq -r '.[] | select(.pm2_env.status != "online") | .name' 2>/dev/null)
        if [ -n "$still_stopped" ]; then
            log "Restart failed for: $still_stopped"
            send_alert \
                "[CRITICAL] PM2 Restart Failed" \
                "Automatic restart failed for some processes.

Still Stopped:
$still_stopped

Time: $(date)

Manual intervention required." \
                "pm2_restart_failed"
        else
            log "All processes restarted successfully"
        fi
        return 1
    fi

    log "All PM2 processes online"
    return 0
}

# Main health check
main() {
    log "=========================================="
    log "Starting Application Health Check"
    log "=========================================="

    local all_ok=true

    # Check frontend
    check_http_endpoint "$FRONTEND_URL" "Frontend" || all_ok=false

    # Check API
    check_http_endpoint "$API_URL" "API" || all_ok=false

    # Check database (only if file exists)
    if [ -f "$DB_PATH" ]; then
        check_database_performance || all_ok=false
    fi

    # Check PM2 processes (only if pm2 is available)
    if command -v pm2 &> /dev/null; then
        check_pm2_processes || all_ok=false
    fi

    if [ "$all_ok" = true ]; then
        log "=========================================="
        log "All Health Checks Passed"
        log "=========================================="
        exit "$(delivery_exit_code 0)"
    else
        log "=========================================="
        log "Some Health Checks Failed"
        log "=========================================="
        exit 1
    fi
}

# Run main function
main
