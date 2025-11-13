#!/bin/bash

#############################################################################
# Performance Tracking Script
# Collects and logs performance metrics over time
# Tracks: response times, memory usage, PM2 restarts, database size
# Should be run via cron every hour
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/performance-tracker.log"
METRICS_DIR="/var/log/performance-metrics"
METRICS_FILE="$METRICS_DIR/metrics-$(date +%Y-%m).csv"

# Create metrics directory if it doesn't exist
mkdir -p "$METRICS_DIR"

# Initialize CSV file with headers if it doesn't exist
if [ ! -f "$METRICS_FILE" ]; then
    echo "timestamp,frontend_response_ms,api_response_ms,db_query_ms,memory_used_mb,memory_available_mb,memory_percent,cpu_load_1m,cpu_load_5m,cpu_load_15m,disk_used_gb,disk_available_gb,disk_percent,db_size_mb,pm2_api_restarts,pm2_frontend_restarts,pm2_api_uptime_hours,pm2_frontend_uptime_hours" > "$METRICS_FILE"
fi

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Collecting Performance Metrics"
log "=========================================="

# Get timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 1. Check HTTP response times
log "Measuring HTTP response times..."

FRONTEND_URL="https://murphys-laws.com"
API_URL="https://murphys-laws.com/api/health"

# Frontend response time
FRONTEND_START=$(date +%s%N)
FRONTEND_HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time 30 "$FRONTEND_URL" 2>/dev/null)
FRONTEND_END=$(date +%s%N)
FRONTEND_RESPONSE_MS=$(( (FRONTEND_END - FRONTEND_START) / 1000000 ))

if [ "$FRONTEND_HTTP_CODE" != "200" ]; then
    log "Frontend returned HTTP $FRONTEND_HTTP_CODE"
    FRONTEND_RESPONSE_MS=""
else
    log "Frontend: ${FRONTEND_RESPONSE_MS}ms"
fi

# API response time and DB query time
API_START=$(date +%s%N)
API_RESPONSE=$(curl -s --max-time 30 "$API_URL" 2>/dev/null)
API_END=$(date +%s%N)
API_RESPONSE_MS=$(( (API_END - API_START) / 1000000 ))

# Extract DB query time from API response
DB_QUERY_MS=$(echo "$API_RESPONSE" | grep -o '"dbQueryTime":[0-9]*' | cut -d: -f2)

if [ -z "$DB_QUERY_MS" ]; then
    log "Failed to get DB query time from API"
    DB_QUERY_MS=""
else
    log "API: ${API_RESPONSE_MS}ms (DB: ${DB_QUERY_MS}ms)"
fi

# 2. Memory usage
log "Checking memory usage..."
MEMORY_STATS=$(free -m | grep "Mem:")
MEMORY_USED=$(echo "$MEMORY_STATS" | awk '{print $3}')
MEMORY_AVAILABLE=$(echo "$MEMORY_STATS" | awk '{print $7}')
MEMORY_TOTAL=$(echo "$MEMORY_STATS" | awk '{print $2}')
MEMORY_PERCENT=$(echo "scale=1; ($MEMORY_USED / $MEMORY_TOTAL) * 100" | bc)

log "Memory: ${MEMORY_USED}MB used / ${MEMORY_AVAILABLE}MB available (${MEMORY_PERCENT}%)"

# 3. CPU load
log "Checking CPU load..."
CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}')
CPU_LOAD_1M=$(echo "$CPU_LOAD" | awk -F',' '{print $1}' | xargs)
CPU_LOAD_5M=$(echo "$CPU_LOAD" | awk -F',' '{print $2}' | xargs)
CPU_LOAD_15M=$(echo "$CPU_LOAD" | awk -F',' '{print $3}' | xargs)

log "CPU Load: ${CPU_LOAD_1M} (1m), ${CPU_LOAD_5M} (5m), ${CPU_LOAD_15M} (15m)"

# 4. Disk usage
log "Checking disk usage..."
DISK_STATS=$(df -BG /root | tail -1)
DISK_USED=$(echo "$DISK_STATS" | awk '{print $3}' | tr -d 'G')
DISK_AVAILABLE=$(echo "$DISK_STATS" | awk '{print $4}' | tr -d 'G')
DISK_PERCENT=$(echo "$DISK_STATS" | awk '{print $5}' | tr -d '%')

log "Disk: ${DISK_USED}GB used / ${DISK_AVAILABLE}GB available (${DISK_PERCENT}%)"

# 5. Database size
log "Checking database size..."
DB_PATH="/root/murphys-laws/backend/murphys.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE_BYTES=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null)
    DB_SIZE_MB=$(echo "scale=2; $DB_SIZE_BYTES / 1024 / 1024" | bc)
    log "Database: ${DB_SIZE_MB}MB"
else
    DB_SIZE_MB=""
    log "Database file not found"
fi

# 6. PM2 process metrics
log "Checking PM2 processes..."
if command -v pm2 &> /dev/null; then
    PM2_JSON=$(pm2 jlist 2>/dev/null)

    if [ $? -eq 0 ]; then
        # API process
        PM2_API_RESTARTS=$(echo "$PM2_JSON" | jq -r '.[] | select(.name=="murphys-api") | .pm2_env.restart_time' 2>/dev/null || echo "0")
        PM2_API_UPTIME_MS=$(echo "$PM2_JSON" | jq -r '.[] | select(.name=="murphys-api") | .pm2_env.pm_uptime' 2>/dev/null || echo "0")
        PM2_API_UPTIME_HOURS=$(echo "scale=2; ($PM2_API_UPTIME_MS) / 1000 / 3600" | bc 2>/dev/null || echo "0")

        # Frontend process
        PM2_FRONTEND_RESTARTS=$(echo "$PM2_JSON" | jq -r '.[] | select(.name=="murphys-frontend") | .pm2_env.restart_time' 2>/dev/null || echo "0")
        PM2_FRONTEND_UPTIME_MS=$(echo "$PM2_JSON" | jq -r '.[] | select(.name=="murphys-frontend") | .pm2_env.pm_uptime' 2>/dev/null || echo "0")
        PM2_FRONTEND_UPTIME_HOURS=$(echo "scale=2; ($PM2_FRONTEND_UPTIME_MS) / 1000 / 3600" | bc 2>/dev/null || echo "0")

        log "PM2 API: ${PM2_API_RESTARTS} restarts, ${PM2_API_UPTIME_HOURS}h uptime"
        log "PM2 Frontend: ${PM2_FRONTEND_RESTARTS} restarts, ${PM2_FRONTEND_UPTIME_HOURS}h uptime"
    else
        PM2_API_RESTARTS=""
        PM2_FRONTEND_RESTARTS=""
        PM2_API_UPTIME_HOURS=""
        PM2_FRONTEND_UPTIME_HOURS=""
        log "Failed to get PM2 status"
    fi
else
    PM2_API_RESTARTS=""
    PM2_FRONTEND_RESTARTS=""
    PM2_API_UPTIME_HOURS=""
    PM2_FRONTEND_UPTIME_HOURS=""
    log "PM2 not available"
fi

# 7. Write metrics to CSV
log "Writing metrics to CSV..."
echo "$TIMESTAMP,$FRONTEND_RESPONSE_MS,$API_RESPONSE_MS,$DB_QUERY_MS,$MEMORY_USED,$MEMORY_AVAILABLE,$MEMORY_PERCENT,$CPU_LOAD_1M,$CPU_LOAD_5M,$CPU_LOAD_15M,$DISK_USED,$DISK_AVAILABLE,$DISK_PERCENT,$DB_SIZE_MB,$PM2_API_RESTARTS,$PM2_FRONTEND_RESTARTS,$PM2_API_UPTIME_HOURS,$PM2_FRONTEND_UPTIME_HOURS" >> "$METRICS_FILE"

log "Metrics saved to $METRICS_FILE"

# 8. Check for performance issues and send alerts if needed
ALERT_EMAIL="ravidor@gmail.com"
ALERTS=""

# Check for high memory usage
if [ -n "$MEMORY_PERCENT" ]; then
    MEMORY_PERCENT_INT=${MEMORY_PERCENT%.*}
    if [ "$MEMORY_PERCENT_INT" -gt 80 ]; then
        ALERTS="$ALERTS\n• High memory usage: ${MEMORY_PERCENT}%"
    fi
fi

# Check for high disk usage
if [ -n "$DISK_PERCENT" ] && [ "$DISK_PERCENT" -gt 80 ]; then
    ALERTS="$ALERTS\n• High disk usage: ${DISK_PERCENT}%"
fi

# Check for slow response times
if [ -n "$FRONTEND_RESPONSE_MS" ] && [ "$FRONTEND_RESPONSE_MS" -gt 5000 ]; then
    ALERTS="$ALERTS\n• Slow frontend response: ${FRONTEND_RESPONSE_MS}ms"
fi

if [ -n "$API_RESPONSE_MS" ] && [ "$API_RESPONSE_MS" -gt 5000 ]; then
    ALERTS="$ALERTS\n• Slow API response: ${API_RESPONSE_MS}ms"
fi

if [ -n "$DB_QUERY_MS" ] && [ "$DB_QUERY_MS" -gt 1000 ]; then
    ALERTS="$ALERTS\n• Slow database queries: ${DB_QUERY_MS}ms"
fi

# Check for frequent restarts (more than 5 in the last tracking period)
if [ -n "$PM2_API_RESTARTS" ] && [ "$PM2_API_RESTARTS" -gt 5 ]; then
    ALERTS="$ALERTS\n• API has restarted ${PM2_API_RESTARTS} times"
fi

if [ -n "$PM2_FRONTEND_RESTARTS" ] && [ "$PM2_FRONTEND_RESTARTS" -gt 5 ]; then
    ALERTS="$ALERTS\n• Frontend has restarted ${PM2_FRONTEND_RESTARTS} times"
fi

# Send alert if issues detected
if [ -n "$ALERTS" ]; then
    log "Performance issues detected, sending alert..."

    echo -e "Performance issues detected during monitoring:$ALERTS\n\nMetrics:\n- Frontend Response: ${FRONTEND_RESPONSE_MS}ms\n- API Response: ${API_RESPONSE_MS}ms\n- DB Query: ${DB_QUERY_MS}ms\n- Memory: ${MEMORY_PERCENT}%\n- Disk: ${DISK_PERCENT}%\n- CPU Load: ${CPU_LOAD_1M}, ${CPU_LOAD_5M}, ${CPU_LOAD_15M}\n\nTime: $(date)" | \
        mail -s "[Murphy's Laws] Performance Issues Detected" "$ALERT_EMAIL"

    log "Alert sent"
fi

log "=========================================="
log "Performance tracking completed"
log "=========================================="

# Cleanup old metrics files (keep last 6 months)
find "$METRICS_DIR" -name "metrics-*.csv" -mtime +180 -delete
