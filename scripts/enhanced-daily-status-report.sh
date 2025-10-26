#!/bin/bash
# Enhanced Daily Status Report for murphys-laws.com server

ALERT_EMAIL="ravidor@gmail.com"
FROM_EMAIL="alerts@murphys-laws.com"
HOSTNAME=$(hostname)
DATE=$(date '+%Y-%m-%d')
DB_PATH="/root/murphys-laws/murphys.db"
METRICS_DIR="/var/log/performance-metrics"
LATEST_METRICS="$METRICS_DIR/metrics-$(date +%Y-%m).csv"

# Generate report
generate_report() {
    cat << REPORT
Daily Status Report for $HOSTNAME
Date: $DATE
=====================================

SYSTEM STATUS:
--------------
Uptime: $(uptime -p)
Load Average: $(uptime | awk -F'load average:' '{print $2}')
Disk Usage: $(df -h / | tail -1 | awk '{print $5 " of " $2 " used ("$4 " free)"}')
Memory Usage: $(free -h | awk 'NR==2{printf "%s of %s used (%.2f%%)", $3, $2, $3*100/$2}')

SERVICES STATUS:
----------------
Nginx: $(systemctl is-active nginx)
Fail2ban: $(systemctl is-active fail2ban)
SSH: $(systemctl is-active ssh)
Postfix: $(systemctl is-active postfix)
Unattended-upgrades: $(systemctl is-active unattended-upgrades)

PM2 PROCESSES:
--------------
$(/root/.nvm/versions/node/v22.20.0/bin/pm2 list 2>/dev/null | grep -E '(murphys-api|murphys-frontend|pm2-logrotate)' | head -5)

PM2 RESTART STATS (Since last restart):
----------------------------------------
$(if command -v pm2 &> /dev/null; then
    pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | IN("murphys-api", "murphys-frontend")) | "  \(.name): \(.pm2_env.restart_time) restarts"' || echo "  Unable to retrieve PM2 stats"
else
    echo "  PM2 not available"
fi)

DATABASE METRICS:
-----------------
$(if [ -f "$DB_PATH" ]; then
    db_size=$(du -h "$DB_PATH" | cut -f1)
    db_rows=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM laws;" 2>/dev/null || echo "N/A")
    echo "  Size: $db_size"
    echo "  Total laws: $db_rows"

    # Check database growth (compare with yesterday's backup if available)
    yesterday=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null)
    yesterday_backup=$(ls -t /root/backups/murphys-$yesterday-*.db 2>/dev/null | head -1)
    if [ -n "$yesterday_backup" ]; then
        yesterday_size=$(stat -f%z "$yesterday_backup" 2>/dev/null || stat -c%s "$yesterday_backup" 2>/dev/null)
        current_size=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null)
        growth_bytes=$((current_size - yesterday_size))
        growth_mb=$(echo "scale=2; $growth_bytes / 1024 / 1024" | bc)
        if [ "$growth_bytes" -gt 0 ]; then
            echo "  Growth (24h): +${growth_mb}MB"
        else
            echo "  Growth (24h): ${growth_mb}MB (no change)"
        fi
    fi
else
    echo "  Database file not found"
fi)

PERFORMANCE METRICS (Last 24h):
--------------------------------
$(if [ -f "$LATEST_METRICS" ]; then
    # Get last 24 entries (hourly tracking)
    tail -24 "$LATEST_METRICS" > /tmp/last-24h-metrics.csv 2>/dev/null

    # Calculate averages
    avg_frontend=$(awk -F',' 'NR>1 && $2 != "" {sum+=$2; count++} END {if (count>0) printf "%.0f", sum/count; else print "N/A"}' /tmp/last-24h-metrics.csv)
    avg_api=$(awk -F',' 'NR>1 && $3 != "" {sum+=$3; count++} END {if (count>0) printf "%.0f", sum/count; else print "N/A"}' /tmp/last-24h-metrics.csv)
    avg_db=$(awk -F',' 'NR>1 && $4 != "" {sum+=$4; count++} END {if (count>0) printf "%.0f", sum/count; else print "N/A"}' /tmp/last-24h-metrics.csv)

    # Get max values
    max_frontend=$(awk -F',' 'NR>1 && $2 != "" {if ($2>max) max=$2} END {if (max>0) printf "%.0f", max; else print "N/A"}' /tmp/last-24h-metrics.csv)
    max_api=$(awk -F',' 'NR>1 && $3 != "" {if ($3>max) max=$3} END {if (max>0) printf "%.0f", max; else print "N/A"}' /tmp/last-24h-metrics.csv)
    max_db=$(awk -F',' 'NR>1 && $4 != "" {if ($4>max) max=$4} END {if (max>0) printf "%.0f", max; else print "N/A"}' /tmp/last-24h-metrics.csv)

    echo "  Frontend Response: avg ${avg_frontend}ms, max ${max_frontend}ms"
    echo "  API Response: avg ${avg_api}ms, max ${max_api}ms"
    echo "  DB Queries: avg ${avg_db}ms, max ${max_db}ms"

    # Memory trend
    avg_memory=$(awk -F',' 'NR>1 && $7 != "" {sum+=$7; count++} END {if (count>0) printf "%.1f", sum/count; else print "N/A"}' /tmp/last-24h-metrics.csv)
    echo "  Avg Memory Usage: ${avg_memory}%"

    rm -f /tmp/last-24h-metrics.csv
else
    echo "  No performance metrics available"
    echo "  (Performance tracking will begin once deployed)"
fi)

BANDWIDTH USAGE (Last 24h):
----------------------------
$(if [ -f /var/log/nginx/access.log ]; then
    # Count requests
    total_requests=$(grep "$(date +%d/%b/%Y)" /var/log/nginx/access.log | wc -l)

    # Estimate bandwidth (sum of bytes sent)
    total_bytes=$(awk -v date="$(date +%d/%b/%Y)" '$0 ~ date {sum += $10} END {print sum}' /var/log/nginx/access.log)
    total_mb=$(echo "scale=2; $total_bytes / 1024 / 1024" | bc)

    echo "  Total Requests: $total_requests"
    echo "  Total Bandwidth: ${total_mb}MB"

    # Top 5 requested paths
    echo "  Top 5 URLs:"
    grep "$(date +%d/%b/%Y)" /var/log/nginx/access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -5 | awk '{printf "    %s requests - %s\n", $1, $2}'
else
    echo "  Nginx access log not available"
fi)

SECURITY SUMMARY (Last 24h):
-----------------------------
Failed SSH attempts: $(grep "Failed password" /var/log/auth.log 2>/dev/null | grep "$(date +%b\ %d)" | wc -l)
Fail2ban current bans: $(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}')
Fail2ban total bans: $(fail2ban-client status sshd 2>/dev/null | grep "Total banned" | awk '{print $NF}')

SSL CERTIFICATE:
----------------
$(if [ -f /etc/letsencrypt/live/murphys-laws.com/cert.pem ]; then
    expiry_date=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/murphys-laws.com/cert.pem | cut -d= -f2)
    expiry_epoch=$(date -d "$expiry_date" +%s)
    current_epoch=$(date +%s)
    days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))

    if [ "$days_until_expiry" -lt 30 ]; then
        echo "⚠️  Expires in $days_until_expiry days ($expiry_date) - RENEWAL NEEDED SOON"
    else
        echo "Expires in $days_until_expiry days ($expiry_date)"
    fi

    # Verify renewal is configured
    if systemctl is-enabled certbot.timer >/dev/null 2>&1; then
        echo "Auto-renewal: Enabled (certbot.timer)"
    else
        echo "Auto-renewal: Not configured"
    fi
else
    echo "Certificate not found"
fi)

BACKUP STATUS:
--------------
Latest backups:
$(ls -lht /root/backups/*.db 2>/dev/null | head -3 | awk '{print $9 " (" $5 ", " $6 " " $7 ")"}')
Total backup size: $(du -sh /root/backups 2>/dev/null | cut -f1)
Backup age: $(ls -lt /root/backups/*.db 2>/dev/null | head -1 | awk '{print $6, $7, $8}')

RECENT SECURITY EVENTS:
-----------------------
$(tail -20 /var/log/security-monitor.log 2>/dev/null | grep -E '\[(WARNING|CRITICAL)\]' || echo "No recent warnings or critical events")

SYSTEM UPDATES:
---------------
Kernel version: $(uname -r)
Reboot required: $([ -f /var/run/reboot-required ] && echo "YES - New kernel available" || echo "No")
Pending updates: $(apt list --upgradable 2>/dev/null | grep -c upgradable || echo "0")

RESOURCE UTILIZATION ANALYSIS:
-------------------------------
$(
# Calculate resource usage patterns
current_memory_percent=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
current_disk_percent=$(df / | tail -1 | awk '{print $5}' | tr -d '%')

# Memory analysis
memory_int=${current_memory_percent%.*}
if [ "$memory_int" -gt 80 ]; then
    echo "  ⚠️  Memory: HIGH usage at ${current_memory_percent}%"
elif [ "$memory_int" -gt 60 ]; then
    echo "  Memory: Moderate usage at ${current_memory_percent}%"
else
    echo "  Memory: Healthy at ${current_memory_percent}%"
fi

# Disk analysis
if [ "$current_disk_percent" -gt 80 ]; then
    echo "  ⚠️  Disk: HIGH usage at ${current_disk_percent}%"
elif [ "$current_disk_percent" -gt 60 ]; then
    echo "  Disk: Moderate usage at ${current_disk_percent}%"
else
    echo "  Disk: Healthy at ${current_disk_percent}%"
fi

# CPU analysis
cpu_count=$(nproc)
load_1m=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | xargs)
load_normalized=$(echo "scale=2; $load_1m / $cpu_count" | bc)
load_percent=$(echo "scale=0; $load_normalized * 100" | bc)

if [ "$load_percent" -gt 80 ]; then
    echo "  ⚠️  CPU: HIGH load at ${load_percent}% (${load_1m} on ${cpu_count} cores)"
elif [ "$load_percent" -gt 50 ]; then
    echo "  CPU: Moderate load at ${load_percent}% (${load_1m} on ${cpu_count} cores)"
else
    echo "  CPU: Healthy at ${load_percent}% (${load_1m} on ${cpu_count} cores)"
fi
)

=====================================
Report generated: $(date '+%Y-%m-%d %H:%M:%S %Z')

This is an automated daily report from murphys-laws.com server.
For critical alerts, you will receive immediate notifications.
REPORT
}

# Send the report
generate_report | mail -s "[$HOSTNAME] Daily Status Report - $DATE" -r "$FROM_EMAIL" $ALERT_EMAIL

# Log that report was sent
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Enhanced daily status report sent to $ALERT_EMAIL" >> /var/log/daily-status-report.log
