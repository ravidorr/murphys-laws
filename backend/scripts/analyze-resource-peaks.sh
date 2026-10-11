#!/bin/bash

#############################################################################
# Peak Resource Usage Analyzer
# Analyzes performance metrics CSVs (see shared/docs/OPERATIONAL-METRICS.md)
# Usage: ./analyze-resource-peaks.sh [--no-header] [days] [--role main-app|n8n]
#############################################################################

METRICS_DIR="${METRICS_DIR:-/var/log/performance-metrics}"
DEFAULT_DAYS=30
DAYS=$DEFAULT_DAYS
SHOW_HEADER=true
METRICS_ROLE="${METRICS_ROLE:-main-app}"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-header)
            SHOW_HEADER=false
            shift
            ;;
        --role)
            METRICS_ROLE="${2:-main-app}"
            shift 2
            ;;
        *)
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                DAYS=$1
            fi
            shift
            ;;
    esac
done

if [ ! -d "$METRICS_DIR" ]; then
    echo "Error: Metrics directory $METRICS_DIR not found."
    exit 1
fi

if [ "$SHOW_HEADER" = true ]; then
    echo "================================================================"
    echo "Peak Resource Usage Analysis (Last $DAYS days, role=$METRICS_ROLE)"
    echo "Source: $METRICS_DIR"
    echo "================================================================"
fi

CURRENT_MONTH=$(date +%Y-%m)
PREV_MONTH=$(date -d "1 month ago" +%Y-%m 2>/dev/null || date -v-1m +%Y-%m 2>/dev/null)

FILES=""
for pattern in "metrics-${METRICS_ROLE}-${CURRENT_MONTH}.csv" "metrics-${METRICS_ROLE}-${PREV_MONTH}.csv" "metrics-${CURRENT_MONTH}.csv" "metrics-${PREV_MONTH}.csv"; do
    if [ -f "$METRICS_DIR/$pattern" ]; then
        FILES="$FILES $METRICS_DIR/$pattern"
    fi
done

if [ -z "$FILES" ]; then
    echo "No metrics files found for role $METRICS_ROLE."
    exit 1
fi

awk -v days="$DAYS" -v show_header="$SHOW_HEADER" -v role_filter="$METRICS_ROLE" -F, '
    BEGIN {
        min_mem_avail = 999999
        cmd = "date -d \"-" days " days\" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -v-" days "d +%Y-%m-%dT%H:%M:%SZ"
        cmd | getline cutoff_date
        close(cmd)

        if (show_header == "true") {
            printf "Analyzing data since: %s\n\n", cutoff_date
        }
        printf "% -24s % -15s % -25s\n", "METRIC", "PEAK VALUE", "TIMESTAMP"
        printf "% -24s % -15s % -25s\n", "------------------------", "---------------", "-------------------------"
    }

    function col(name) { return cols[name] + 0 }

    FNR == 1 {
        delete cols
        for (i = 1; i <= NF; i++) cols[$i] = i
        legacy = (col("role") == 0)
        next
    }

    {
        timestamp = $1
        if (timestamp < cutoff_date) next

        if (!legacy) {
            row_role = $col("role")
            if (row_role != role_filter) next
        }

        mem_avail_idx = col("memory_available_mb")
        mem_pressure_idx = col("memory_pressure_percent")
        if (mem_pressure_idx == 0) mem_pressure_idx = col("memory_percent")
        swap_idx = col("swap_used_mb")
        cpu_norm_idx = col("cpu_normalized_percent")
        disk_pct_idx = col("disk_percent")
        api_rss_idx = col("pm2_api_rss_mb")

        mem_avail = (mem_avail_idx > 0 && $(mem_avail_idx) != "" ? $(mem_avail_idx) + 0 : -1)
        mem_pressure = (mem_pressure_idx > 0 && $(mem_pressure_idx) != "" ? $(mem_pressure_idx) + 0 : -1)
        swap_used = (swap_idx > 0 && $(swap_idx) != "" ? $(swap_idx) + 0 : -1)
        cpu_norm = (cpu_norm_idx > 0 && $(cpu_norm_idx) != "" ? $(cpu_norm_idx) + 0 : -1)
        if (cpu_norm < 0 && col("cpu_load_1m") > 0 && col("cpu_cores") > 0) {
            load = $(col("cpu_load_1m")) + 0
            cores = $(col("cpu_cores")) + 0
            if (cores > 0) cpu_norm = (load / cores) * 100
        }
        disk_pct = (disk_pct_idx > 0 && $(disk_pct_idx) != "" ? $(disk_pct_idx) + 0 : -1)
        api_rss = (api_rss_idx > 0 && $(api_rss_idx) != "" ? $(api_rss_idx) + 0 : -1)

        if (mem_avail >= 0 && mem_avail < min_mem_avail) { min_mem_avail = mem_avail; t_min_mem = $1 }
        if (mem_pressure >= 0 && mem_pressure > max_mem_pressure) { max_mem_pressure = mem_pressure; t_mem_p = $1 }
        if (swap_used >= 0 && swap_used > max_swap) { max_swap = swap_used; t_swap = $1 }
        if (cpu_norm >= 0 && cpu_norm > max_cpu) { max_cpu = cpu_norm; t_cpu = $1 }
        if (disk_pct >= 0 && disk_pct > max_disk) { max_disk = disk_pct; t_disk = $1 }
        if (api_rss >= 0 && api_rss > max_rss) { max_rss = api_rss; t_rss = $1 }

        count++
    }

    END {
        if (count == 0) {
            print "No data records found within the specified date range."
            exit
        }

        if (max_mem_pressure >= 0) printf "% -24s % -15s % -25s\n", "Memory pressure %", max_mem_pressure " %", t_mem_p
        if (min_mem_avail < 999999) printf "% -24s % -15s % -25s\n", "Min MemAvailable MB", min_mem_avail " MB", t_min_mem
        if (max_swap >= 0) printf "% -24s % -15s % -25s\n", "Swap used MB", max_swap " MB", t_swap
        if (max_cpu >= 0) printf "% -24s % -15s % -25s\n", "CPU normalized %", max_cpu " %", t_cpu
        if (max_disk >= 0) printf "% -24s % -15s % -25s\n", "Disk %", max_disk " %", t_disk
        if (max_rss >= 0) printf "% -24s % -15s % -25s\n", "API RSS MB", max_rss " MB", t_rss

        print "\nTotal records analyzed: " count
    }
' $FILES
