#!/bin/bash
# Daily status report for murphys-laws.com server

ALERT_EMAIL="ravidor@gmail.com"
FROM_EMAIL="alerts@murphys-laws.com"
HOSTNAME=$(hostname)
DATE=$(date '+%Y-%m-%d')
DB_PATH="/root/murphys-laws/murphys.db"

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
Disk Usage: $(df -h / | tail -1 | awk '{print $5 " of " $2 " used (" $4 " free)"}')
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

WEBSITE ACTIVITY (Last 24h):
-----------------------------
Laws submitted: $(sqlite3 $DB_PATH "SELECT COUNT(*) FROM laws WHERE datetime(created_at) >= datetime('now', '-1 day')" 2>/dev/null || echo "N/A")
Upvotes: $(sqlite3 $DB_PATH "SELECT COUNT(*) FROM votes WHERE datetime(created_at) >= datetime('now', '-1 day') AND vote_type='up'" 2>/dev/null || echo "N/A")
Downvotes: $(sqlite3 $DB_PATH "SELECT COUNT(*) FROM votes WHERE datetime(created_at) >= datetime('now', '-1 day') AND vote_type='down'" 2>/dev/null || echo "N/A")
Total published laws: $(sqlite3 $DB_PATH "SELECT COUNT(*) FROM laws WHERE status='published'" 2>/dev/null || echo "N/A")

Murphy's Law of the Day:
-------------------------
$(sqlite3 $DB_PATH "SELECT COALESCE(title || ': ', '') || text FROM laws WHERE status='published' ORDER BY RANDOM() LIMIT 1" 2>/dev/null || echo "Unable to fetch law of the day")

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
    echo "Expires in $days_until_expiry days ($expiry_date)"
else
    echo "Certificate not found"
fi)

BACKUP STATUS:
--------------
Latest backups:
$(ls -lht /root/backups/*.db 2>/dev/null | head -3 | awk '{print $9 " (" $5 ", " $6 " " $7 ")"}')
Total backup size: $(du -sh /root/backups 2>/dev/null | cut -f1)

RECENT SECURITY EVENTS:
-----------------------
$(tail -20 /var/log/security-monitor.log 2>/dev/null | grep -E '\[(WARNING|CRITICAL)\]' || echo "No recent warnings or critical events")

SYSTEM UPDATES:
---------------
Kernel version: $(uname -r)
Reboot required: $([ -f /var/run/reboot-required ] && echo "YES - New kernel available" || echo "No")
Pending updates: $(apt list --upgradable 2>/dev/null | grep -c upgradable || echo "0")

=====================================
Report generated: $(date '+%Y-%m-%d %H:%M:%S %Z')

This is an automated report from murphys-laws.com server.
For critical alerts, you will receive immediate notifications.
REPORT
}

# Send the report
generate_report | mail -s "[$HOSTNAME] Daily Status Report - $DATE" -r "$FROM_EMAIL" $ALERT_EMAIL

# Log that report was sent
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daily status report sent to $ALERT_EMAIL" >> /var/log/daily-status-report.log
