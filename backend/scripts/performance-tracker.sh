#!/bin/bash

#############################################################################
# Performance Tracking Script
# Collects hourly operational metrics (see shared/docs/OPERATIONAL-METRICS.md)
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f /etc/murphys-laws/operational-metrics.env ]; then
    # shellcheck source=/dev/null
    source /etc/murphys-laws/operational-metrics.env
fi

METRICS_ROLE="${METRICS_ROLE:-main-app}"
METRICS_DIR="${METRICS_DIR:-/var/log/performance-metrics}"
FRONTEND_URL="${FRONTEND_URL:-https://murphys-laws.com}"
API_URL="${API_URL:-https://murphys-laws.com/api/health}"
DB_PATH="${DB_PATH:-/root/murphys-laws/backend/murphys.db}"
PM2_API_NAME="${PM2_API_NAME:-murphys-api}"
PM2_API_MEMORY_LIMIT_MB="${PM2_API_MEMORY_LIMIT_MB:-}"

LOG_FILE="/var/log/performance-tracker.log"
METRICS_FILE="$METRICS_DIR/metrics-${METRICS_ROLE}-$(date +%Y-%m).csv"
HEADER="timestamp,role,frontend_response_ms,api_response_ms,db_query_ms,memory_used_mb,memory_available_mb,memory_pressure_percent,swap_used_mb,swap_in,swap_out,cpu_cores,cpu_load_1m,cpu_load_5m,cpu_load_15m,cpu_normalized_percent,disk_used_gb,disk_available_gb,disk_percent,db_size_mb,pm2_api_restarts,pm2_api_uptime_hours,pm2_api_rss_mb,pm2_api_memory_limit_mb,collector_errors"

mkdir -p "$METRICS_DIR"
COLLECTOR_ERRORS=""

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

append_error() {
    if [ -n "$COLLECTOR_ERRORS" ]; then
        COLLECTOR_ERRORS="${COLLECTOR_ERRORS};$1"
    else
        COLLECTOR_ERRORS="$1"
    fi
}

parse_pm2_memory_limit_mb() {
    local raw="$1"
    if [ -z "$raw" ] || [ "$raw" = "null" ]; then
        return 1
    fi
    if [[ "$raw" =~ ^[0-9]+$ ]]; then
        echo "scale=0; $raw / 1048576" | bc
        return 0
    fi
    if [[ "$raw" =~ ^([0-9]+)[Mm]$ ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi
    if [[ "$raw" =~ ^([0-9]+)[Gg]$ ]]; then
        echo $((${BASH_REMATCH[1]} * 1024))
        return 0
    fi
    return 1
}

if [ ! -f "$METRICS_FILE" ]; then
    echo "$HEADER" > "$METRICS_FILE"
fi

log "Collecting metrics for role=$METRICS_ROLE"

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FRONTEND_RESPONSE_MS=""
API_RESPONSE_MS=""
DB_QUERY_MS=""

if [ "$METRICS_ROLE" = "main-app" ] && [ -n "$FRONTEND_URL" ]; then
    FRONTEND_START=$(date +%s%N)
    FRONTEND_HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time 30 "$FRONTEND_URL" 2>/dev/null)
    FRONTEND_END=$(date +%s%N)
    FRONTEND_RESPONSE_MS=$(( (FRONTEND_END - FRONTEND_START) / 1000000 ))
    if [ "$FRONTEND_HTTP_CODE" != "200" ]; then
        FRONTEND_RESPONSE_MS=""
        append_error "frontend_http_${FRONTEND_HTTP_CODE}"
    fi
fi

if [ "$METRICS_ROLE" = "main-app" ] && [ -n "$API_URL" ]; then
    API_START=$(date +%s%N)
    API_RESPONSE=$(curl -s --max-time 30 "$API_URL" 2>/dev/null)
    API_END=$(date +%s%N)
    API_RESPONSE_MS=$(( (API_END - API_START) / 1000000 ))
    DB_QUERY_MS=$(echo "$API_RESPONSE" | grep -o '"dbQueryTime":[0-9]*' | cut -d: -f2)
    if [ -z "$DB_QUERY_MS" ]; then
        append_error "api_health_unavailable"
        API_RESPONSE_MS=""
    fi
fi

MEMORY_STATS=$(free -m | grep "Mem:")
MEMORY_TOTAL=$(echo "$MEMORY_STATS" | awk '{print $2}')
MEMORY_AVAILABLE=$(echo "$MEMORY_STATS" | awk '{print $7}')
MEMORY_USED=$((MEMORY_TOTAL - MEMORY_AVAILABLE))
if [ "$MEMORY_TOTAL" -gt 0 ]; then
    MEMORY_PRESSURE_PERCENT=$(echo "scale=1; (1 - $MEMORY_AVAILABLE / $MEMORY_TOTAL) * 100" | bc)
else
    MEMORY_PRESSURE_PERCENT=""
    append_error "memory_unavailable"
fi

SWAP_USED=$(free -m | awk '/Swap:/ {print $3}')
SWAP_IN=$(awk '/^pswpin / {print $2}' /proc/vmstat 2>/dev/null)
SWAP_OUT=$(awk '/^pswpout / {print $2}' /proc/vmstat 2>/dev/null)

CPU_CORES=$(nproc)
LOAD_LINE=$(uptime | awk -F'load average:' '{print $2}')
CPU_LOAD_1M=$(echo "$LOAD_LINE" | awk -F',' '{print $1}' | xargs)
CPU_LOAD_5M=$(echo "$LOAD_LINE" | awk -F',' '{print $2}' | xargs)
CPU_LOAD_15M=$(echo "$LOAD_LINE" | awk -F',' '{print $3}' | xargs)
CPU_NORMALIZED_PERCENT=$(echo "scale=1; ($CPU_LOAD_1M / $CPU_CORES) * 100" | bc)

DISK_STATS=$(df -BG /root 2>/dev/null | tail -1)
if [ -z "$DISK_STATS" ]; then
    DISK_STATS=$(df -BG / | tail -1)
fi
DISK_USED=$(echo "$DISK_STATS" | awk '{print $3}' | tr -d 'G')
DISK_AVAILABLE=$(echo "$DISK_STATS" | awk '{print $4}' | tr -d 'G')
DISK_PERCENT=$(echo "$DISK_STATS" | awk '{print $5}' | tr -d '%')

DB_SIZE_MB=""
if [ "$METRICS_ROLE" = "main-app" ] && [ -f "$DB_PATH" ]; then
    DB_SIZE_BYTES=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null)
    DB_SIZE_MB=$(echo "scale=2; $DB_SIZE_BYTES / 1024 / 1024" | bc)
fi

PM2_API_RESTARTS=""
PM2_API_UPTIME_HOURS=""
PM2_API_RSS_MB=""

if [ "$METRICS_ROLE" = "main-app" ] && [ -n "$PM2_API_NAME" ] && command -v pm2 &> /dev/null; then
    PM2_JSON=$(pm2 jlist 2>/dev/null)
    if [ $? -eq 0 ]; then
        PM2_API_RESTARTS=$(echo "$PM2_JSON" | jq -r --arg name "$PM2_API_NAME" '.[] | select(.name==$name) | .pm2_env.restart_time' 2>/dev/null)
        PM2_START_MS=$(echo "$PM2_JSON" | jq -r --arg name "$PM2_API_NAME" '.[] | select(.name==$name) | .pm2_env.pm_uptime' 2>/dev/null)
        PM2_MONIT_MEMORY=$(echo "$PM2_JSON" | jq -r --arg name "$PM2_API_NAME" '.[] | select(.name==$name) | .monit.memory' 2>/dev/null)
        if [ -n "$PM2_START_MS" ] && [ "$PM2_START_MS" != "null" ]; then
            NOW_MS=$(date +%s%3N 2>/dev/null || echo $(($(date +%s) * 1000)))
            UPTIME_MS=$((NOW_MS - PM2_START_MS))
            PM2_API_UPTIME_HOURS=$(echo "scale=2; $UPTIME_MS / 1000 / 3600" | bc)
        fi
        if [ -n "$PM2_MONIT_MEMORY" ] && [ "$PM2_MONIT_MEMORY" != "null" ]; then
            PM2_API_RSS_MB=$(echo "scale=1; $PM2_MONIT_MEMORY / 1024 / 1024" | bc)
        fi
        PM2_MAX_RESTART=$(echo "$PM2_JSON" | jq -r --arg name "$PM2_API_NAME" '.[] | select(.name==$name) | .pm2_env.max_memory_restart // empty' 2>/dev/null)
        if PARSED_LIMIT=$(parse_pm2_memory_limit_mb "$PM2_MAX_RESTART"); then
            PM2_API_MEMORY_LIMIT_MB="$PARSED_LIMIT"
        elif [ -z "$PM2_API_MEMORY_LIMIT_MB" ]; then
            append_error "pm2_memory_limit_unavailable"
        fi
    else
        append_error "pm2_unavailable"
    fi
fi

if [ "$METRICS_ROLE" = "main-app" ] && [ -z "$PM2_API_MEMORY_LIMIT_MB" ]; then
    PM2_API_MEMORY_LIMIT_MB="500"
fi

echo "$TIMESTAMP,$METRICS_ROLE,$FRONTEND_RESPONSE_MS,$API_RESPONSE_MS,$DB_QUERY_MS,$MEMORY_USED,$MEMORY_AVAILABLE,$MEMORY_PRESSURE_PERCENT,$SWAP_USED,$SWAP_IN,$SWAP_OUT,$CPU_CORES,$CPU_LOAD_1M,$CPU_LOAD_5M,$CPU_LOAD_15M,$CPU_NORMALIZED_PERCENT,$DISK_USED,$DISK_AVAILABLE,$DISK_PERCENT,$DB_SIZE_MB,$PM2_API_RESTARTS,$PM2_API_UPTIME_HOURS,$PM2_API_RSS_MB,$PM2_API_MEMORY_LIMIT_MB,$COLLECTOR_ERRORS" >> "$METRICS_FILE"

log "Metrics appended to $METRICS_FILE"

find "$METRICS_DIR" -name "metrics-*-*.csv" -mtime +180 -delete 2>/dev/null
find "$METRICS_DIR" -name "metrics-[0-9][0-9][0-9][0-9]-[0-9][0-9].csv" -mtime +180 -delete 2>/dev/null
