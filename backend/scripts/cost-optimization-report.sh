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
    logger -t murphys-alerts -p user.err -- "FATAL: $(basename "$0") cannot load alert-email.sh" 2>/dev/null || true
    exit 1
fi
ALERT_EMAIL="$(resolve_alert_email)"
SEND_EMAIL=true
OUTPUT_FORMAT="text"
METRICS_DIR="${METRICS_DIR:-/var/log/performance-metrics}"
INVENTORY_FILE="${INVENTORY_FILE:-/etc/murphys-laws/infrastructure-inventory.json}"
if [ ! -f "$INVENTORY_FILE" ] && [ -f "$REPO_ROOT/backend/config/infrastructure-inventory.json" ]; then
    INVENTORY_FILE="$REPO_ROOT/backend/config/infrastructure-inventory.json"
fi
CAPACITY_SECTION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-email)
            SEND_EMAIL=false
            shift
            ;;
        --format)
            OUTPUT_FORMAT="${2:-text}"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

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
        append "Inventory file: $INVENTORY_FILE (UNVERIFIED — confirm costs against each provider listed in the inventory)"
    fi
    append "$(sed 's/^/  /' "$INVENTORY_FILE" | head -40)"
else
    append "No infrastructure inventory file on this host."
    append "Copy infrastructure-inventory.json.example to /etc/murphys-laws/infrastructure-inventory.json and fill in verified costs per provider."
fi
append ""

append "2. RESOURCE UTILIZATION (CURRENT SNAPSHOT)"
append "==========================================="
append ""

if command -v free >/dev/null 2>&1; then
    MEMORY_STATS=$(free -m | grep "Mem:")
    MEMORY_TOTAL=$(echo "$MEMORY_STATS" | awk '{print $2}')
    MEMORY_AVAILABLE=$(echo "$MEMORY_STATS" | awk '{print $7}')
    MEMORY_USED=$((MEMORY_TOTAL - MEMORY_AVAILABLE))
    MEMORY_PRESSURE=$(echo "scale=1; (1 - $MEMORY_AVAILABLE / $MEMORY_TOTAL) * 100" | bc)
    SWAP_USED=$(free -m | awk '/Swap:/ {print $3}')
else
    MEMORY_USED=0
    MEMORY_AVAILABLE=0
    MEMORY_PRESSURE=0
    SWAP_USED=0
fi

append "Memory: ${MEMORY_USED}MB used, ${MEMORY_AVAILABLE}MB available (${MEMORY_PRESSURE}% pressure)"
append "Swap used: ${SWAP_USED}MB"
append ""

CPU_CORES=$(nproc 2>/dev/null || echo 1)
LOAD_1M=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | xargs)
LOAD_1M=${LOAD_1M:-0}
CPU_NORM=$(echo "scale=1; ($LOAD_1M / $CPU_CORES) * 100" | bc 2>/dev/null || echo 0)
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
    TOTAL_GB="0"
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

emit_cost_json() {
    local inventory_note="No infrastructure inventory file on this host."
    local monthly_estimate="null"
    if [ -f "$INVENTORY_FILE" ]; then
        if grep -q '"verified"[[:space:]]*:[[:space:]]*true' "$INVENTORY_FILE"; then
            inventory_note="Inventory verified on this host."
        else
            inventory_note="Inventory present but unverified."
        fi
        monthly_estimate=$(jq -r '.monthly_usd_estimate // empty' "$INVENTORY_FILE")
        if [ -z "$monthly_estimate" ] || [ "$monthly_estimate" = "null" ]; then
            monthly_estimate=""
        fi
    fi

    local capacity_decision
    capacity_decision=$(echo "$CAPACITY_SECTION" | awk -F': ' '/^Decision:/{print $2; exit}')
    if [ -z "$capacity_decision" ]; then
        capacity_decision="Unavailable"
    fi

    local capacity_reasons capacity_details
    capacity_reasons=$(echo "$CAPACITY_SECTION" | awk '/^  - /{print substr($0,5)}' | jq -R -s 'split("\n") | map(select(length>0))' 2>/dev/null || echo '[]')
    capacity_details=$(echo "$CAPACITY_SECTION" | awk '/^Peak |^P95 |^Minimum |^Samples:/{print $0}' | jq -R -s 'split("\n") | map(select(length>0))' 2>/dev/null || echo '[]')

    jq -n \
        --arg generatedAt "$(date '+%Y-%m-%d %H:%M:%S')" \
        --arg inventoryNote "$inventory_note" \
        --arg monthlyUsdEstimate "${monthly_estimate}" \
        --arg memory "${MEMORY_USED}MB used, ${MEMORY_AVAILABLE}MB available (${MEMORY_PRESSURE}% pressure)" \
        --arg swap "${SWAP_USED}MB" \
        --arg cpu "${CPU_CORES} cores, load ${LOAD_1M}, normalized ${CPU_NORM}%" \
        --argjson trafficFiles "${TRAFFIC_FILES:-0}" \
        --argjson trafficRequests "${TOTAL_REQUESTS:-0}" \
        --arg trafficBandwidth "${TOTAL_GB:-0}" \
        --arg capacityDecision "$capacity_decision" \
        --argjson capacityReasons "$capacity_reasons" \
        --argjson capacityDetails "$capacity_details" \
        --arg nextReview "$(date -d '+1 month' +%Y-%m-%d 2>/dev/null || date -v+1m +%Y-%m-%d 2>/dev/null)" \
        '{
            generatedAt: $generatedAt,
            inventoryNote: $inventoryNote,
            monthlyUsdEstimate: (if $monthlyUsdEstimate == "" then null else ($monthlyUsdEstimate|tonumber) end),
            snapshot: { memory: $memory, swap: $swap, cpu: $cpu },
            traffic: { files: $trafficFiles, requests: $trafficRequests, bandwidthGb: $trafficBandwidth },
            capacity: { decision: $capacityDecision, reasons: $capacityReasons, details: $capacityDetails },
            recommendations: [
                "Infrastructure: single application droplet (n8n automation retired).",
                "Droplet downsizing: Only via manual review after capacity decision above.",
                "512MB plans remain blocked due to prior OOM on 1GB with swap.",
                "Backup storage: Local retention 30 days; off-site copy not configured."
            ],
            actionItems: [
                "Ensure hourly performance-tracker cron is active on the main application host",
                "Keep droplet topology unchanged during baseline collection",
                "Run monthly test-backup-restore.sh (local integrity)"
            ],
            nextReview: $nextReview
        }'
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

if [ "$OUTPUT_FORMAT" = "json" ]; then
    emit_cost_json
    exit 0
fi

echo -e "$REPORT"

if [ "$SEND_EMAIL" = true ]; then
    echo "Report saved to $REPORT_FILE" >&2
    if echo -e "$REPORT" | send_alert_mail "[Murphy's Laws] Monthly Cost Optimization Report"; then
        echo "Report emailed to $ALERT_EMAIL" >&2
    else
        echo "Report NOT emailed ($(describe_alert_mail_status "$?"))" >&2
        ALERT_UNDELIVERED=1
    fi
fi

exit "$(delivery_exit_code 0)"
