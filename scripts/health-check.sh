#!/bin/bash

#############################################################################
# Application Health Check Script
# Monitors HTTP endpoints, API response times, and database performance
# Sends alerts when issues are detected
#############################################################################

# Configuration
FRONTEND_URL="${HEALTH_CHECK_FRONTEND_URL:-https://murphys-laws.com}"
API_URL="${HEALTH_CHECK_API_URL:-https://murphys-laws.com/api/health}"
DB_PATH="/root/murphys-laws/murphys.db"
ALERT_EMAIL="ravidor@gmail.com"
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

# Check if alert was recently sent
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

    # Update alert timestamp
    date +%s > "$state_file"
    return 0  # Send alert
}

# Send email alert
send_alert() {
    local subject="$1"
    local body="$2"
    local alert_type="$3"

    if should_send_alert "$alert_type"; then
        echo "$body" | mail -s "$subject" "$ALERT_EMAIL"
        log "ALERT SENT: $subject"
    else
        log "ALERT SUPPRESSED (cooldown): $subject"
    fi
}

# Check HTTP endpoint
check_http_endpoint() {
    local url="$1"
    local name="$2"

    log "Checking $name: $url"

    # Use curl with timing information
    local temp_file=$(mktemp)
    local http_code=$(curl -o /dev/null -s -w "%{http_code}" \
        -w "time_total:%{time_total}\n" \
        --max-time 30 \
        "$url" 2>"$temp_file" | tee -a "$temp_file")

    local curl_exit=$?
    local response=$(cat "$temp_file")
    rm -f "$temp_file"

    # Extract response time (in seconds)
    local time_total=$(echo "$response" | grep "time_total:" | cut -d: -f2)
    local time_ms=$(echo "$time_total * 1000" | bc | cut -d. -f1)

    if [ $curl_exit -ne 0 ]; then
        log "❌ $name FAILED - curl error code: $curl_exit"
        send_alert \
            "[CRITICAL] $name Down" \
            "The $name endpoint is not responding.

URL: $url
Error: curl exit code $curl_exit
Time: $(date)

This requires immediate attention." \
            "${name}_down"
        return 1
    fi

    # Extract HTTP code from response
    http_code=$(echo "$response" | grep -o "^[0-9]\{3\}")

    if [ "$http_code" != "200" ]; then
        log "❌ $name returned HTTP $http_code (expected 200)"
        send_alert \
            "[CRITICAL] $name Error - HTTP $http_code" \
            "The $name endpoint returned an error status.

URL: $url
HTTP Status: $http_code
Response Time: ${time_ms}ms
Time: $(date)

This requires immediate attention." \
            "${name}_error"
        return 1
    fi

    # Check response time
    if [ "$time_ms" -gt "$ALERT_THRESHOLD_MS" ]; then
        log "⚠️  $name SLOW - ${time_ms}ms (threshold: ${ALERT_THRESHOLD_MS}ms)"
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
        log "✅ $name OK - ${time_ms}ms (HTTP $http_code)"
    fi

    # Return response time for tracking
    echo "$time_ms"
    return 0
}

# Check database performance
check_database_performance() {
    if [ ! -f "$DB_PATH" ]; then
        log "⚠️  Database file not found: $DB_PATH"
        return 1
    fi

    log "Checking database performance"

    # Test query with timing
    local start=$(date +%s%N)
    local count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM laws;" 2>&1)
    local end=$(date +%s%N)

    if [ $? -ne 0 ]; then
        log "❌ Database query failed: $count"
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

    log "✅ Database OK - Query returned $count rows in ${duration_ms}ms"

    # Check if query is too slow
    if [ "$duration_ms" -gt 1000 ]; then
        log "⚠️  Database query slow: ${duration_ms}ms"
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
        log "❌ PM2 not responding"
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
        log "❌ PM2 processes not online: $stopped_processes"
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
            log "❌ Restart failed for: $still_stopped"
            send_alert \
                "[CRITICAL] PM2 Restart Failed" \
                "Automatic restart failed for some processes.

Still Stopped:
$still_stopped

Time: $(date)

Manual intervention required." \
                "pm2_restart_failed"
        else
            log "✅ All processes restarted successfully"
        fi
        return 1
    fi

    log "✅ All PM2 processes online"
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
        log "✅ All Health Checks Passed"
        log "=========================================="
        exit 0
    else
        log "=========================================="
        log "❌ Some Health Checks Failed"
        log "=========================================="
        exit 1
    fi
}

# Run main function
main
