#!/bin/bash

#############################################################################
# Consolidated Daily Report
# Single daily email at 5:00 AM UTC containing:
# - Daily status report
# - Log analysis
# - SSL monitoring
# - Vulnerability scan (Sundays only)
# - Cost optimization (1st of month only)
#############################################################################

ALERT_EMAIL="ravidor@gmail.com"
FROM_EMAIL="alerts@murphys-laws.com"
HOSTNAME=$(hostname)
DATE=$(date '+%Y-%m-%d')
DAY_OF_WEEK=$(date '+%u')  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date '+%d')

REPORT_FILE="/tmp/consolidated-daily-report-$DATE.txt"
TEMP_DIR="/tmp/daily-report-parts"
mkdir -p "$TEMP_DIR"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/consolidated-daily-report.log
}

log "=========================================="
log "Generating Consolidated Daily Report"
log "=========================================="

# Initialize report
REPORT=""

#############################################################################
# HEADER
#############################################################################

REPORT+="Daily Status Report for Murphy's Laws\n"
REPORT+="Server: $HOSTNAME\n"
REPORT+="Date: $(date '+%Y-%m-%d %H:%M:%S %Z')\n"
REPORT+="============================================\n\n"

#############################################################################
# PART 1: SYSTEM STATUS
#############################################################################

log "Collecting system status..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="1. SYSTEM STATUS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

# Uptime and load
REPORT+="Uptime: $(uptime -p)\n"
REPORT+="Load Average: $(uptime | awk -F'load average:' '{print $2}')\n"

# Memory
MEMORY_STATS=$(free -h | awk 'NR==2{printf "%s of %s used (%.1f%%)", $3, $2, $3*100/$2}')
REPORT+="Memory: $MEMORY_STATS\n"

# Disk
DISK_STATS=$(df -h / | tail -1 | awk '{print $5 " of " $2 " used (" $4 " free)"}')
REPORT+="Disk: $DISK_STATS\n\n"

# Services
REPORT+="Services:\n"
REPORT+="  • nginx: $(systemctl is-active nginx)\n"
REPORT+="  • fail2ban: $(systemctl is-active fail2ban)\n"
REPORT+="  • SSH: $(systemctl is-active ssh)\n"
REPORT+="  • Postfix: $(systemctl is-active postfix)\n\n"

# PM2 Processes
if command -v pm2 &> /dev/null; then
    REPORT+="PM2 Applications:\n"
    PM2_STATUS=$(/root/.nvm/versions/node/v22.20.0/bin/pm2 jlist 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$PM2_STATUS" | jq -r '.[] | select(.name | IN("murphys-api", "murphys-frontend")) | "  • \(.name): \(.pm2_env.status) (restarts: \(.pm2_env.restart_time))"' >> "$TEMP_DIR/pm2.txt"
        REPORT+="$(cat $TEMP_DIR/pm2.txt)\n"
    else
        REPORT+="  • Unable to retrieve PM2 status\n"
    fi
    REPORT+="\n"
fi

#############################################################################
# PART 2: PERFORMANCE METRICS
#############################################################################

log "Collecting performance metrics..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="2. PERFORMANCE METRICS (Last 24h)\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

METRICS_FILE="/var/log/performance-metrics/metrics-$(date +%Y-%m).csv"
if [ -f "$METRICS_FILE" ]; then
    tail -24 "$METRICS_FILE" > "$TEMP_DIR/metrics-24h.csv"

    # Calculate averages
    AVG_FRONTEND=$(awk -F',' 'NR>1 && $2 != "" {sum+=$2; count++} END {if (count>0) printf "%.0f", sum/count; else print "N/A"}' "$TEMP_DIR/metrics-24h.csv")
    AVG_API=$(awk -F',' 'NR>1 && $3 != "" {sum+=$3; count++} END {if (count>0) printf "%.0f", sum/count; else print "N/A"}' "$TEMP_DIR/metrics-24h.csv")
    AVG_DB=$(awk -F',' 'NR>1 && $4 != "" {sum+=$4; count++} END {if (count>0) printf "%.0f", sum/count; else print "N/A"}' "$TEMP_DIR/metrics-24h.csv")
    AVG_MEMORY=$(awk -F',' 'NR>1 && $7 != "" {sum+=$7; count++} END {if (count>0) printf "%.1f", sum/count; else print "N/A"}' "$TEMP_DIR/metrics-24h.csv")

    # Get max values
    MAX_FRONTEND=$(awk -F',' 'NR>1 && $2 != "" {if ($2>max) max=$2} END {if (max>0) printf "%.0f", max; else print "N/A"}' "$TEMP_DIR/metrics-24h.csv")
    MAX_API=$(awk -F',' 'NR>1 && $3 != "" {if ($3>max) max=$3} END {if (max>0) printf "%.0f", max; else print "N/A"}' "$TEMP_DIR/metrics-24h.csv")
    MAX_DB=$(awk -F',' 'NR>1 && $4 != "" {if ($4>max) max=$4} END {if (max>0) printf "%.0f", max; else print "N/A"}' "$TEMP_DIR/metrics-24h.csv")

    REPORT+="Response Times:\n"
    REPORT+="  • Frontend: avg ${AVG_FRONTEND}ms, max ${MAX_FRONTEND}ms\n"
    REPORT+="  • API: avg ${AVG_API}ms, max ${MAX_API}ms\n"
    REPORT+="  • Database: avg ${AVG_DB}ms, max ${MAX_DB}ms\n"
    REPORT+="  • Avg Memory Usage: ${AVG_MEMORY}%\n\n"

    # Performance warnings
    if [ "$MAX_API" != "N/A" ] && [ "$MAX_API" -gt 5000 ]; then
        REPORT+="⚠️  WARNING: Peak API response time exceeded 5 seconds\n\n"
    fi
else
    REPORT+="Performance metrics not yet available.\n\n"
fi

#############################################################################
# PART 3: DATABASE METRICS
#############################################################################

log "Collecting database metrics..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="3. DATABASE METRICS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

DB_PATH="/root/murphys-laws/murphys.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    DB_ROWS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM laws;" 2>/dev/null || echo "N/A")

    REPORT+="Size: $DB_SIZE\n"
    REPORT+="Total Laws: $DB_ROWS\n"

    # Check database growth
    YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null)
    YESTERDAY_BACKUP=$(ls -t /root/backups/murphys-$YESTERDAY-*.db 2>/dev/null | head -1)
    if [ -n "$YESTERDAY_BACKUP" ]; then
        YESTERDAY_SIZE=$(stat -f%z "$YESTERDAY_BACKUP" 2>/dev/null || stat -c%s "$YESTERDAY_BACKUP" 2>/dev/null)
        CURRENT_SIZE=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null)
        GROWTH_BYTES=$((CURRENT_SIZE - YESTERDAY_SIZE))
        GROWTH_MB=$(echo "scale=2; $GROWTH_BYTES / 1024 / 1024" | bc)
        if [ "$GROWTH_BYTES" -gt 0 ]; then
            REPORT+="Growth (24h): +${GROWTH_MB}MB\n"
        else
            REPORT+="Growth (24h): No change\n"
        fi
    fi
    REPORT+="\n"
else
    REPORT+="Database file not found\n\n"
fi

#############################################################################
# PART 4: TRAFFIC & BANDWIDTH
#############################################################################

log "Analyzing traffic and bandwidth..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="4. TRAFFIC & BANDWIDTH (Last 24h)\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

if [ -f /var/log/nginx/access.log ]; then
    TODAY=$(date +%d/%b/%Y)
    TOTAL_REQUESTS=$(grep "$TODAY" /var/log/nginx/access.log | wc -l)

    # Estimate bandwidth
    TOTAL_BYTES=$(awk -v date="$TODAY" '$0 ~ date {sum += $10} END {print sum}' /var/log/nginx/access.log)
    TOTAL_MB=$(echo "scale=2; $TOTAL_BYTES / 1024 / 1024" | bc)

    REPORT+="Total Requests: $TOTAL_REQUESTS\n"
    REPORT+="Bandwidth: ${TOTAL_MB}MB\n\n"

    # Status codes
    REPORT+="Status Codes:\n"
    grep "$TODAY" /var/log/nginx/access.log | awk '{print $9}' | sort | uniq -c | sort -rn | head -5 | while read count code; do
        REPORT+="  • $code: $count requests\n"
    done
    REPORT+="\n"

    # Top 5 URLs
    REPORT+="Top 5 URLs:\n"
    grep "$TODAY" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -5 | while read count url; do
        REPORT+="  • $count - $url\n"
    done
    REPORT+="\n"
else
    REPORT+="Nginx access log not available\n\n"
fi

#############################################################################
# PART 5: SECURITY SUMMARY
#############################################################################

log "Collecting security information..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="5. SECURITY SUMMARY\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

# Failed SSH attempts
FAILED_SSH=$(grep "Failed password" /var/log/auth.log 2>/dev/null | grep "$(date +%b\ %d)" | wc -l)
REPORT+="Failed SSH Attempts: $FAILED_SSH\n"

# Fail2ban
if systemctl is-active fail2ban >/dev/null 2>&1; then
    BANNED_IPS=$(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}')
    TOTAL_BANS=$(fail2ban-client status sshd 2>/dev/null | grep "Total banned" | awk '{print $NF}')
    REPORT+="Fail2ban Currently Banned: $BANNED_IPS\n"
    REPORT+="Fail2ban Total Bans: $TOTAL_BANS\n"
fi
REPORT+="\n"

#############################################################################
# PART 6: SSL CERTIFICATE STATUS
#############################################################################

log "Checking SSL certificate..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="6. SSL CERTIFICATE STATUS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

CERT_PATH="/etc/letsencrypt/live/murphys-laws.com/cert.pem"
if [ -f "$CERT_PATH" ]; then
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

    REPORT+="Certificate Expiration: $EXPIRY_DATE\n"
    REPORT+="Days Until Expiry: $DAYS_UNTIL_EXPIRY\n"

    if [ "$DAYS_UNTIL_EXPIRY" -lt 30 ]; then
        if [ "$DAYS_UNTIL_EXPIRY" -lt 7 ]; then
            REPORT+="⚠️  CRITICAL: Certificate expires in $DAYS_UNTIL_EXPIRY days!\n"
        elif [ "$DAYS_UNTIL_EXPIRY" -lt 14 ]; then
            REPORT+="⚠️  WARNING: Certificate expires in $DAYS_UNTIL_EXPIRY days\n"
        else
            REPORT+="ℹ️  NOTICE: Certificate expires in $DAYS_UNTIL_EXPIRY days\n"
        fi
    else
        REPORT+="✅ Certificate valid for $DAYS_UNTIL_EXPIRY days\n"
    fi

    # Check auto-renewal
    if systemctl is-enabled certbot.timer >/dev/null 2>&1; then
        REPORT+="Auto-renewal: Enabled\n"
    else
        REPORT+="⚠️  Auto-renewal: NOT ENABLED\n"
    fi
    REPORT+="\n"
else
    REPORT+="⚠️  Certificate file not found\n\n"
fi

#############################################################################
# PART 7: LOG ANALYSIS & ATTACK DETECTION
#############################################################################

log "Running log analysis..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="7. LOG ANALYSIS & ATTACK DETECTION\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

# Run log analyzer and capture output
/usr/local/bin/log-analyzer.sh > "$TEMP_DIR/log-analysis.txt" 2>&1

# Extract summary
if [ -f "$TEMP_DIR/log-analysis.txt" ]; then
    # Get just the summary section
    sed -n '/^Log Analysis Summary/,/^=======/p' "$TEMP_DIR/log-analysis.txt" | head -20 > "$TEMP_DIR/log-summary.txt"
    REPORT+="$(cat $TEMP_DIR/log-summary.txt)\n\n"
else
    REPORT+="Log analysis not available\n\n"
fi

#############################################################################
# PART 8: BACKUP STATUS
#############################################################################

log "Checking backup status..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="8. BACKUP STATUS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

if [ -d /root/backups ]; then
    LATEST_DB_BACKUP=$(ls -t /root/backups/murphys-*.db 2>/dev/null | head -1)
    if [ -n "$LATEST_DB_BACKUP" ]; then
        BACKUP_AGE=$(stat -c %y "$LATEST_DB_BACKUP" 2>/dev/null | cut -d'.' -f1)
        BACKUP_SIZE=$(du -h "$LATEST_DB_BACKUP" | cut -f1)
        REPORT+="Latest Database Backup:\n"
        REPORT+="  • File: $(basename $LATEST_DB_BACKUP)\n"
        REPORT+="  • Size: $BACKUP_SIZE\n"
        REPORT+="  • Date: $BACKUP_AGE\n"

        # Check backup age
        BACKUP_TIME=$(stat -c %Y "$LATEST_DB_BACKUP")
        NOW=$(date +%s)
        HOURS_OLD=$(( ($NOW - $BACKUP_TIME) / 3600 ))
        if [ "$HOURS_OLD" -gt 48 ]; then
            REPORT+="  ⚠️  WARNING: Backup is $HOURS_OLD hours old\n"
        fi
    else
        REPORT+="⚠️  No database backups found\n"
    fi

    TOTAL_BACKUP_SIZE=$(du -sh /root/backups 2>/dev/null | cut -f1)
    REPORT+="Total Backup Size: $TOTAL_BACKUP_SIZE\n"
    REPORT+="\n"
else
    REPORT+="Backup directory not found\n\n"
fi

#############################################################################
# PART 9: SYSTEM UPDATES
#############################################################################

log "Checking for system updates..."

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="9. SYSTEM UPDATES\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

REPORT+="Kernel: $(uname -r)\n"
REPORT+="Reboot Required: $([ -f /var/run/reboot-required ] && echo 'YES' || echo 'No')\n"

PENDING_UPDATES=$(apt list --upgradable 2>/dev/null | grep -c upgradable || echo "0")
REPORT+="Pending Updates: $PENDING_UPDATES\n\n"

if [ "$PENDING_UPDATES" -gt 10 ]; then
    REPORT+="⚠️  More than 10 updates pending\n\n"
fi

#############################################################################
# PART 10: VULNERABILITY SCAN (Sundays Only)
#############################################################################

if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log "Running weekly vulnerability scan (Sunday)..."

    REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    REPORT+="10. WEEKLY VULNERABILITY SCAN\n"
    REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Run vulnerability scanner
    /usr/local/bin/vulnerability-scanner.sh > "$TEMP_DIR/vuln-scan.txt" 2>&1

    # Extract summary
    if [ -f "$TEMP_DIR/vuln-scan.txt" ]; then
        sed -n '/^Vulnerability Scan Summary/,/^=========/p' "$TEMP_DIR/vuln-scan.txt" | head -30 > "$TEMP_DIR/vuln-summary.txt"
        REPORT+="$(cat $TEMP_DIR/vuln-summary.txt)\n\n"

        # Add key findings
        REPORT+="Key Findings:\n"
        grep -E "(VULNERABILITIES FOUND|security update|critical|high)" "$TEMP_DIR/vuln-scan.txt" | head -20 | while read line; do
            REPORT+="  $line\n"
        done
        REPORT+="\n"
    else
        REPORT+="Vulnerability scan failed\n\n"
    fi
fi

#############################################################################
# PART 11: COST OPTIMIZATION (1st of Month Only)
#############################################################################

if [ "$DAY_OF_MONTH" = "01" ]; then
    log "Running monthly cost optimization report..."

    REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    REPORT+="11. MONTHLY COST OPTIMIZATION REPORT\n"
    REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Run cost optimization report
    /usr/local/bin/cost-optimization-report.sh > "$TEMP_DIR/cost-report.txt" 2>&1

    # Extract summary and recommendations
    if [ -f "$TEMP_DIR/cost-report.txt" ]; then
        # Get key sections
        sed -n '/^COST OPTIMIZATION REPORT/,/^1\. CURRENT INFRASTRUCTURE COSTS/p' "$TEMP_DIR/cost-report.txt" > "$TEMP_DIR/cost-header.txt"
        sed -n '/^1\. CURRENT INFRASTRUCTURE COSTS/,/^2\. RESOURCE UTILIZATION/p' "$TEMP_DIR/cost-report.txt" > "$TEMP_DIR/cost-current.txt"
        sed -n '/^2\. RESOURCE UTILIZATION/,/^3\. TRAFFIC ANALYSIS/p' "$TEMP_DIR/cost-report.txt" > "$TEMP_DIR/cost-resources.txt"
        sed -n '/^4\. COST OPTIMIZATION RECOMMENDATIONS/,/^5\. LONG-TERM/p' "$TEMP_DIR/cost-report.txt" | head -50 > "$TEMP_DIR/cost-recommendations.txt"

        REPORT+="$(cat $TEMP_DIR/cost-header.txt)\n"
        REPORT+="$(cat $TEMP_DIR/cost-current.txt)\n"
        REPORT+="$(cat $TEMP_DIR/cost-resources.txt)\n"
        REPORT+="$(cat $TEMP_DIR/cost-recommendations.txt)\n\n"
    else
        REPORT+="Cost optimization report failed\n\n"
    fi
fi

#############################################################################
# FOOTER
#############################################################################

REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="Report completed at $(date '+%Y-%m-%d %H:%M:%S %Z')\n"
REPORT+="Next report: $(date -d 'tomorrow 05:00' '+%Y-%m-%d 05:00 UTC' 2>/dev/null || date -v+1d '+%Y-%m-%d 05:00 UTC' 2>/dev/null)\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

#############################################################################
# SAVE AND SEND REPORT
#############################################################################

log "Saving report..."

# Save report
echo -e "$REPORT" > "$REPORT_FILE"

# Send email
log "Sending consolidated daily report..."

# Determine subject based on what's included
SUBJECT="Daily Status Report - $DATE"
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    SUBJECT="$SUBJECT (+ Vulnerability Scan)"
fi
if [ "$DAY_OF_MONTH" = "01" ]; then
    SUBJECT="$SUBJECT (+ Cost Report)"
fi

cat "$REPORT_FILE" | mail -s "$SUBJECT" -r "$FROM_EMAIL" "$ALERT_EMAIL"

log "Report sent to $ALERT_EMAIL"
log "Report saved to $REPORT_FILE"

# Cleanup temp files older than 7 days
find "$TEMP_DIR" -type f -mtime +7 -delete 2>/dev/null
find /tmp -name "consolidated-daily-report-*.txt" -mtime +7 -delete 2>/dev/null

log "=========================================="
log "Consolidated daily report completed"
log "=========================================="
