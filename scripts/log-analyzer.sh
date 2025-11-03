#!/bin/bash

#############################################################################
# Centralized Log Analysis Script
# Analyzes logs for suspicious patterns, SQL injection attempts, and security issues
# Should be run daily via cron
#############################################################################

ALERT_EMAIL="ravidor@gmail.com"
LOG_FILE="/var/log/log-analyzer.log"
REPORT_FILE="/tmp/log-analysis-$(date +%Y-%m-%d).txt"

# Log files to analyze
NGINX_ACCESS_LOG="/var/log/nginx/access.log"
NGINX_ERROR_LOG="/var/log/nginx/error.log"
AUTH_LOG="/var/log/auth.log"
SYSLOG="/var/log/syslog"

# Suspicious patterns
SQL_INJECTION_PATTERNS=(
    "union.*select"
    "select.*from.*where"
    "insert.*into"
    "delete.*from"
    "drop.*table"
    "update.*set"
    "--"
    "xp_cmdshell"
    "exec.*xp"
    "';.*--"
    "or.*1=1"
    "or.*'1'='1"
    "admin'.*--"
)

XSS_PATTERNS=(
    "<script"
    "javascript:"
    "onerror="
    "onload="
    "onclick="
    "<iframe"
    "document.cookie"
    "eval\("
)

PATH_TRAVERSAL_PATTERNS=(
    "\.\.\/"
    "\.\.%2F"
    "\.\.%5C"
    "%2e%2e"
    "etc/passwd"
    "etc/shadow"
    "boot\.ini"
    "win\.ini"
)

COMMAND_INJECTION_PATTERNS=(
    "|cat"
    "|nc"
    "|wget"
    "|curl"
    "|bash"
    "|sh"
    "&cat"
    ";cat"
    "\`cat"
    "\$\(cat"
)

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Generate report
REPORT=""

log "=========================================="
log "Starting Log Analysis"
log "=========================================="

# 1. Nginx Access Log Analysis
log "Analyzing nginx access logs..."
REPORT+="NGINX ACCESS LOG ANALYSIS\n"
REPORT+="=========================\n\n"

if [ -f "$NGINX_ACCESS_LOG" ]; then
    # Get today's date in nginx log format
    TODAY=$(date +%d/%b/%Y)

    # Total requests today
    TOTAL_REQUESTS=$(grep "$TODAY" "$NGINX_ACCESS_LOG" | wc -l)
    REPORT+="Total requests today: $TOTAL_REQUESTS\n\n"

    # Status code distribution
    REPORT+="Status Code Distribution:\n"
    grep "$TODAY" "$NGINX_ACCESS_LOG" | awk '{print $9}' | sort | uniq -c | sort -rn | while read count code; do
        REPORT+="  $code: $count requests\n"
    done
    REPORT+="\n"

    # Top 10 IPs
    REPORT+="Top 10 IP Addresses:\n"
    grep "$TODAY" "$NGINX_ACCESS_LOG" | awk '{print $1}' | sort | uniq -c | sort -rn | head -10 | while read count ip; do
        REPORT+="  $ip: $count requests\n"
    done
    REPORT+="\n"

    # 4xx errors
    ERROR_4XX=$(grep "$TODAY" "$NGINX_ACCESS_LOG" | grep ' 4[0-9][0-9] ' | wc -l)
    if [ "$ERROR_4XX" -gt 0 ]; then
        REPORT+="⚠️  4xx Client Errors: $ERROR_4XX\n"
        REPORT+="Top 404 URLs:\n"
        grep "$TODAY" "$NGINX_ACCESS_LOG" | grep ' 404 ' | awk '{print $7}' | sort | uniq -c | sort -rn | head -10 | while read count url; do
            REPORT+="  $url: $count times\n"
        done
        REPORT+="\n"
    fi

    # 5xx errors
    ERROR_5XX=$(grep "$TODAY" "$NGINX_ACCESS_LOG" | grep ' 5[0-9][0-9] ' | wc -l)
    if [ "$ERROR_5XX" -gt 0 ]; then
        REPORT+="⚠️  5xx Server Errors: $ERROR_5XX\n"
        grep "$TODAY" "$NGINX_ACCESS_LOG" | grep ' 5[0-9][0-9] ' | tail -10 | while read line; do
            REPORT+="  $line\n"
        done
        REPORT+="\n"
    else
        REPORT+="✅ No 5xx server errors\n\n"
    fi

    # Suspicious User Agents
    REPORT+="Suspicious User Agents:\n"
    grep "$TODAY" "$NGINX_ACCESS_LOG" | grep -iE "(bot|crawler|spider|scan|nikto|sqlmap|havij|acunetix)" | awk -F'"' '{print $6}' | sort | uniq -c | sort -rn | head -10 | while read count agent; do
        REPORT+="  $count - $agent\n"
    done
    REPORT+="\n"
else
    REPORT+="Nginx access log not found\n\n"
fi

# 2. SQL Injection Attempts
log "Checking for SQL injection attempts..."
REPORT+="SQL INJECTION ATTEMPTS\n"
REPORT+="======================\n\n"

SQL_ATTEMPTS=0
for pattern in "${SQL_INJECTION_PATTERNS[@]}"; do
    matches=$(grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | wc -l)
    if [ "$matches" -gt 0 ]; then
        SQL_ATTEMPTS=$((SQL_ATTEMPTS + matches))
    fi
done

if [ "$SQL_ATTEMPTS" -gt 0 ]; then
    REPORT+="⚠️  Detected $SQL_ATTEMPTS potential SQL injection attempts\n\n"
    REPORT+="Sample attempts:\n"

    for pattern in "${SQL_INJECTION_PATTERNS[@]}"; do
        grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | head -3 | while read line; do
            REPORT+="  $(echo $line | cut -c1-120)...\n"
        done
    done
    REPORT+="\n"

    # Get attacking IPs
    REPORT+="Attacking IPs:\n"
    for pattern in "${SQL_INJECTION_PATTERNS[@]}"; do
        grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | awk '{print $1}'
    done | sort | uniq -c | sort -rn | head -10 | while read count ip; do
        REPORT+="  $ip: $count attempts\n"
    done
    REPORT+="\n"

    log "⚠️  Found $SQL_ATTEMPTS SQL injection attempts"
else
    REPORT+="✅ No SQL injection attempts detected\n\n"
    log "No SQL injection attempts found"
fi

# 3. XSS Attempts
log "Checking for XSS attempts..."
REPORT+="CROSS-SITE SCRIPTING (XSS) ATTEMPTS\n"
REPORT+="====================================\n\n"

XSS_ATTEMPTS=0
for pattern in "${XSS_PATTERNS[@]}"; do
    matches=$(grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | wc -l)
    if [ "$matches" -gt 0 ]; then
        XSS_ATTEMPTS=$((XSS_ATTEMPTS + matches))
    fi
done

if [ "$XSS_ATTEMPTS" -gt 0 ]; then
    REPORT+="⚠️  Detected $XSS_ATTEMPTS potential XSS attempts\n\n"
    REPORT+="Sample attempts:\n"

    for pattern in "${XSS_PATTERNS[@]}"; do
        grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | head -2 | while read line; do
            REPORT+="  $(echo $line | cut -c1-120)...\n"
        done
    done
    REPORT+="\n"

    log "⚠️  Found $XSS_ATTEMPTS XSS attempts"
else
    REPORT+="✅ No XSS attempts detected\n\n"
    log "No XSS attempts found"
fi

# 4. Path Traversal Attempts
log "Checking for path traversal attempts..."
REPORT+="PATH TRAVERSAL ATTEMPTS\n"
REPORT+="=======================\n\n"

TRAVERSAL_ATTEMPTS=0
for pattern in "${PATH_TRAVERSAL_PATTERNS[@]}"; do
    matches=$(grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | wc -l)
    if [ "$matches" -gt 0 ]; then
        TRAVERSAL_ATTEMPTS=$((TRAVERSAL_ATTEMPTS + matches))
    fi
done

if [ "$TRAVERSAL_ATTEMPTS" -gt 0 ]; then
    REPORT+="⚠️  Detected $TRAVERSAL_ATTEMPTS potential path traversal attempts\n\n"
    REPORT+="Sample attempts:\n"

    for pattern in "${PATH_TRAVERSAL_PATTERNS[@]}"; do
        grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | head -2 | while read line; do
            REPORT+="  $(echo $line | cut -c1-120)...\n"
        done
    done
    REPORT+="\n"

    log "⚠️  Found $TRAVERSAL_ATTEMPTS path traversal attempts"
else
    REPORT+="✅ No path traversal attempts detected\n\n"
    log "No path traversal attempts found"
fi

# 5. Command Injection Attempts
log "Checking for command injection attempts..."
REPORT+="COMMAND INJECTION ATTEMPTS\n"
REPORT+="==========================\n\n"

CMD_ATTEMPTS=0
for pattern in "${COMMAND_INJECTION_PATTERNS[@]}"; do
    matches=$(grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | wc -l)
    if [ "$matches" -gt 0 ]; then
        CMD_ATTEMPTS=$((CMD_ATTEMPTS + matches))
    fi
done

if [ "$CMD_ATTEMPTS" -gt 0 ]; then
    REPORT+="⚠️  Detected $CMD_ATTEMPTS potential command injection attempts\n\n"
    REPORT+="Sample attempts:\n"

    for pattern in "${COMMAND_INJECTION_PATTERNS[@]}"; do
        grep -iE "$pattern" "$NGINX_ACCESS_LOG" 2>/dev/null | head -2 | while read line; do
            REPORT+="  $(echo $line | cut -c1-120)...\n"
        done
    done
    REPORT+="\n"

    log "⚠️  Found $CMD_ATTEMPTS command injection attempts"
else
    REPORT+="✅ No command injection attempts detected\n\n"
    log "No command injection attempts found"
fi

# 6. Brute Force Detection
log "Checking for brute force attempts..."
REPORT+="BRUTE FORCE ATTEMPTS\n"
REPORT+="====================\n\n"

if [ -f "$AUTH_LOG" ]; then
    # SSH brute force
    FAILED_SSH=$(grep "Failed password" "$AUTH_LOG" | grep "$(date +%b\ %d)" | wc -l)

    if [ "$FAILED_SSH" -gt 20 ]; then
        REPORT+="⚠️  Detected $FAILED_SSH failed SSH login attempts today\n\n"

        REPORT+="Top attacking IPs:\n"
        grep "Failed password" "$AUTH_LOG" | grep "$(date +%b\ %d)" | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -10 | while read count ip; do
            REPORT+="  $ip: $count attempts\n"
        done
        REPORT+="\n"

        log "⚠️  Found $FAILED_SSH SSH brute force attempts"
    else
        REPORT+="✅ No significant brute force activity ($FAILED_SSH failed attempts)\n\n"
        log "No significant brute force activity"
    fi
fi

# 7. Rate Limiting Hits
log "Checking rate limit hits..."
REPORT+="RATE LIMITING\n"
REPORT+="=============\n\n"

if [ -f "$NGINX_ERROR_LOG" ]; then
    RATE_LIMIT_HITS=$(grep "limiting requests" "$NGINX_ERROR_LOG" | grep "$(date +%Y/%m/%d)" | wc -l)

    if [ "$RATE_LIMIT_HITS" -gt 0 ]; then
        REPORT+="Rate limit triggered $RATE_LIMIT_HITS times today\n\n"

        REPORT+="Top rate-limited IPs:\n"
        grep "limiting requests" "$NGINX_ERROR_LOG" | grep "$(date +%Y/%m/%d)" | grep -oP 'client: \K[0-9.]+' | sort | uniq -c | sort -rn | head -10 | while read count ip; do
            REPORT+="  $ip: $count times\n"
        done
        REPORT+="\n"

        log "Rate limiting triggered $RATE_LIMIT_HITS times"
    else
        REPORT+="✅ No rate limiting triggered\n\n"
    fi
fi

# 8. Application Errors
log "Checking application errors..."
REPORT+="APPLICATION ERRORS\n"
REPORT+="==================\n\n"

if [ -f "/root/murphys-laws/logs/api-error.log" ]; then
    API_ERRORS=$(grep -E "(Error|Exception|Failed)" "/root/murphys-laws/logs/api-error.log" | tail -10 | wc -l)

    if [ "$API_ERRORS" -gt 0 ]; then
        REPORT+="Recent API errors:\n"
        grep -E "(Error|Exception|Failed)" "/root/murphys-laws/logs/api-error.log" | tail -10 | while read line; do
            REPORT+="  $line\n"
        done
        REPORT+="\n"
    else
        REPORT+="✅ No recent API errors\n\n"
    fi
fi

# Generate summary
TOTAL_ISSUES=$((SQL_ATTEMPTS + XSS_ATTEMPTS + TRAVERSAL_ATTEMPTS + CMD_ATTEMPTS))

SUMMARY="Log Analysis Summary - $(date +%Y-%m-%d)\n"
SUMMARY+="=======================================\n\n"

if [ "$TOTAL_ISSUES" -gt 0 ]; then
    SUMMARY+="⚠️  SECURITY ISSUES DETECTED:\n"
    [ "$SQL_ATTEMPTS" -gt 0 ] && SUMMARY+="  • SQL Injection: $SQL_ATTEMPTS attempts\n"
    [ "$XSS_ATTEMPTS" -gt 0 ] && SUMMARY+="  • XSS: $XSS_ATTEMPTS attempts\n"
    [ "$TRAVERSAL_ATTEMPTS" -gt 0 ] && SUMMARY+="  • Path Traversal: $TRAVERSAL_ATTEMPTS attempts\n"
    [ "$CMD_ATTEMPTS" -gt 0 ] && SUMMARY+="  • Command Injection: $CMD_ATTEMPTS attempts\n"
    SUMMARY+="\nTotal attack attempts: $TOTAL_ISSUES\n\n"
else
    SUMMARY+="✅ No security issues detected in logs\n\n"
fi

SUMMARY+="Total requests today: $TOTAL_REQUESTS\n"
SUMMARY+="4xx errors: $ERROR_4XX\n"
SUMMARY+="5xx errors: $ERROR_5XX\n"
SUMMARY+="\n=======================================\n\n"

# Add summary to beginning of report
FULL_REPORT="$SUMMARY$REPORT"

# Output report to stdout for inclusion in daily report
echo -e "$FULL_REPORT"

# Also save to file for standalone access if needed
echo -e "$FULL_REPORT" > "$REPORT_FILE"
log "Report saved to $REPORT_FILE"

log "=========================================="
log "Log analysis completed"
log "=========================================="

# Cleanup old reports
find /tmp -name "log-analysis-*.txt" -mtime +30 -delete
