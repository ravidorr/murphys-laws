#!/bin/bash

#############################################################################
# Cost Optimization Report
# Evidence-based capacity summary (no automatic infrastructure changes)
# Use --no-email to suppress email sending (for inclusion in daily report)
#############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-/root/murphys-laws}"
CAPACITY_ANALYZER="${CAPACITY_ANALYZER:-$REPO_ROOT/backend/scripts/analyze-capacity-metrics.ts}"
REPORT_FILE="/tmp/cost-optimization-report-$(date +%Y-%m).txt"
ALERT_EMAIL="ravidor@gmail.com"
SEND_EMAIL=true
METRICS_DIR="${METRICS_DIR:-/var/log/performance-metrics}"
INVENTORY_FILE="${INVENTORY_FILE:-$REPO_ROOT/backend/config/infrastructure-inventory.json}"

if [ "${1:-}" = "--no-email" ]; then
    SEND_EMAIL=false
fi

REPORT=""
append() {
    REPORT+="$1\n"
}

append "COST OPTIMIZATION REPORT"
append "Murphy's Laws Infrastructure"
append "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
append "========================"
append ""
append "This report separates observed metrics from suggestions."
append "No droplet resize or consolidation is performed automatically."
append ""

append "1. INFRASTRUCTURE INVENTORY"
append "=============================="
append ""

if [ -f "$INVENTORY_FILE" ]; then
    VERIFIED=$(grep -o '"verified"[[:space:]]*:[[:space:]]*true' "$INVENTORY_FILE" || true)
    if [ -n "$VERIFIED" ]; then
        append "Inventory file: $INVENTORY_FILE (marked verified)"
    else
        append "Inventory file: $INVENTORY_FILE (UNVERIFIED — confirm against DigitalOcean billing)"
    fi
    append "$(sed 's/^/  /' "$INVENTORY_FILE" | head -40)"
else
    append "No infrastructure-inventory.json on this host."
    append "Copy backend/config/infrastructure-inventory.json.example and fill in verified costs."
fi
append ""

append "2. RESOURCE UTILIZATION (CURRENT SNAPSHOT)"
append "==========================================="
append ""

MEMORY_STATS=$(free -m | grep "Mem:")
MEMORY_TOTAL=$(echo "$MEMORY_STATS" | awk '{print $2}')
MEMORY_AVAILABLE=$(echo "$MEMORY_STATS" | awk '{print $7}')
MEMORY_USED=$((MEMORY_TOTAL - MEMORY_AVAILABLE))
MEMORY_PRESSURE=$(echo "scale=1; (1 - $MEMORY_AVAILABLE / $MEMORY_TOTAL) * 100" | bc)
SWAP_USED=$(free -m | awk '/Swap:/ {print $3}')

append "Memory: ${MEMORY_USED}MB used, ${MEMORY_AVAILABLE}MB available (${MEMORY_PRESSURE}% pressure)"
append "Swap used: ${SWAP_USED}MB"
append ""

CPU_CORES=$(nproc)
LOAD_1M=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | xargs)
CPU_NORM=$(echo "scale=1; ($LOAD_1M / $CPU_CORES) * 100" | bc)
append "CPU: ${CPU_CORES} cores, load ${LOAD_1M}, normalized ${CPU_NORM}%"
append ""

append "3. TRAFFIC & BANDWIDTH"
append "======================"
append ""

TRAFFIC_FILES=0
TOTAL_REQUESTS=0
TOTAL_BYTES=0
for logfile in /var/log/nginx/access.log /var/log/nginx/access.log.[0-9]*; do
    if [ ! -f "$logfile" ]; then
        continue
    fi
    if [[ "$logfile" == *.gz ]]; then
        TRAFFIC_FILES=$((TRAFFIC_FILES + 1))
        TOTAL_REQUESTS=$((TOTAL_REQUESTS + $(zcat "$logfile" | wc -l | tr -d ' ')))
        TOTAL_BYTES=$((TOTAL_BYTES + $(zcat "$logfile" | awk '{sum += $10} END {print sum+0}')))
    else
        TRAFFIC_FILES=$((TRAFFIC_FILES + 1))
        TOTAL_REQUESTS=$((TOTAL_REQUESTS + $(wc -l < "$logfile" | tr -d ' ')))
        TOTAL_BYTES=$((TOTAL_BYTES + $(awk '{sum += $10} END {print sum+0}' "$logfile")))
    fi
done

if [ "$TRAFFIC_FILES" -gt 0 ]; then
    TOTAL_GB=$(echo "scale=2; $TOTAL_BYTES / 1024 / 1024 / 1024" | bc)
    append "Sources: $TRAFFIC_FILES nginx access log file(s) on this host"
    append "Total requests in available logs: $TOTAL_REQUESTS"
    append "Total bandwidth in available logs: ${TOTAL_GB}GB"
    if [ "$TRAFFIC_FILES" -eq 1 ]; then
        append "Coverage: INCOMPLETE if logrotate removed older logs (not a guaranteed 30-day window)"
    fi
else
    append "No nginx access logs available for traffic analysis"
fi
append ""

append "4. CAPACITY DECISION (30-DAY METRICS)"
append "======================================="
append ""

run_capacity_analysis() {
    local role="$1"
    append "Capacity role: $role"
    TSX_BIN="$REPO_ROOT/node_modules/.bin/tsx"
    if [ ! -f "$CAPACITY_ANALYZER" ]; then
        append "Capacity analysis script not available on this host"
        append ""
        return
    fi
    if [ ! -x "$TSX_BIN" ] && ! command -v npx &> /dev/null; then
        append "Capacity analysis unavailable (tsx not installed in $REPO_ROOT)"
        append ""
        return
    fi
    if [ -x "$TSX_BIN" ]; then
        CAPACITY_SECTION=$(cd "$REPO_ROOT" && METRICS_DIR="$METRICS_DIR" METRICS_ROLE="$role" "$TSX_BIN" "$CAPACITY_ANALYZER" 2>/dev/null || true)
    else
        CAPACITY_SECTION=$(cd "$REPO_ROOT" && METRICS_DIR="$METRICS_DIR" METRICS_ROLE="$role" npx --yes tsx "$CAPACITY_ANALYZER" 2>/dev/null || true)
    fi
    if [ -n "$CAPACITY_SECTION" ]; then
        append "$CAPACITY_SECTION"
    else
        append "Capacity analysis unavailable (tsx or metrics missing)"
    fi
    append ""
}

run_capacity_analysis main-app

append "5. RECOMMENDATIONS"
append "=================="
append ""
append "Infrastructure: single application droplet (n8n automation retired)."
append "Droplet downsizing: Only via manual review after capacity decision above;"
append " 512MB plans remain blocked due to prior OOM on 1GB with swap."
append ""
append "Backup storage: Local retention 30 days; off-site copy not configured."
append "  Do not reduce retention until encrypted off-site restore is tested."
append ""
append "Performance:"
append "  • Static assets: long-lived browser cache configured in nginx.conf"
append "  • OG images: downstream cache headers only (no nginx proxy_cache zone yet)"
append "  • CDN (Cloudflare): deferred until origin bandwidth and cache-hit data exist"
append "  • Database: optimize only if API latency profiles show need"
append ""
append "Service tiers: Let's Encrypt, smtp2go, ImprovMX, GA — monitor usage; no change required at low volume."
append ""
append "Revenue (AdSense/SEO): review in GA, Search Console, and AdSense dashboards monthly."
append ""

append "6. ACTION ITEMS"
append "==============="
append ""
append "Immediate:"
append "  [ ] Ensure hourly performance-tracker cron is active on the main application host"
append "  [ ] Keep droplet topology unchanged during baseline collection"
append "  [ ] Run monthly test-backup-restore.sh (local integrity)"
append ""
append "After 30 days of metrics:"
append "  [ ] Re-read capacity decision in this report"
append "  [ ] If Manual review candidate, run explicit human capacity review (no auto-resize)"
append ""

append "Next review: $(date -d '+1 month' +%Y-%m-%d 2>/dev/null || date -v+1m +%Y-%m-%d 2>/dev/null)"
append ""

echo -e "$REPORT" > "$REPORT_FILE"
echo -e "$REPORT"

if [ "$SEND_EMAIL" = true ]; then
    echo -e "$REPORT" | mail -s "[Murphy's Laws] Monthly Cost Optimization Report" "$ALERT_EMAIL"
    echo "Report saved to $REPORT_FILE" >&2
    echo "Report emailed to $ALERT_EMAIL" >&2
fi
