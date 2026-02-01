#!/bin/bash

#############################################################################
# Peak Resource Usage Analyzer
# Analyzes performance metrics CSVs to find peak resource usage.
# Usage: ./analyze-resource-peaks.sh [days]
# Default days: 30
#############################################################################

# Configuration
METRICS_DIR="/var/log/performance-metrics"
DEFAULT_DAYS=30
DAYS=$DEFAULT_DAYS
SHOW_HEADER=true

# Parse arguments
for arg in "$@"; do
    case $arg in
        --no-header)
            SHOW_HEADER=false
            shift
            ;;
        *)
            if [[ "$arg" =~ ^[0-9]+$ ]]; then
                DAYS=$arg
            fi
            ;;
    esac
done

# Check if metrics directory exists
if [ ! -d "$METRICS_DIR" ]; then
    echo "Error: Metrics directory $METRICS_DIR not found."
    echo "Make sure performance-tracker.sh is running via cron."
    exit 1
fi

if [ "$SHOW_HEADER" = true ]; then
    echo "================================================================"
    echo "Peak Resource Usage Analysis (Last $DAYS days)"
    echo "Source: $METRICS_DIR"
    echo "================================================================"
fi

# Identify relevant log files (Current and Previous Month to cover 30 days)
# Note: This is a simplified selection. For strict day filtering, we rely on awk.
CURRENT_MONTH=$(date +%Y-%m)
PREV_MONTH=$(date -d "1 month ago" +%Y-%m 2>/dev/null || date -v-1m +%Y-%m 2>/dev/null)

FILES=""
[ -f "$METRICS_DIR/metrics-$CURRENT_MONTH.csv" ] && FILES="$FILES $METRICS_DIR/metrics-$CURRENT_MONTH.csv"
[ -f "$METRICS_DIR/metrics-$PREV_MONTH.csv" ] && FILES="$FILES $METRICS_DIR/metrics-$PREV_MONTH.csv"

if [ -z "$FILES" ]; then
    echo "No metrics files found for $CURRENT_MONTH or $PREV_MONTH."
    exit 1
fi

# AWK script to find max values
awk -v days="$DAYS" -v show_header="$SHOW_HEADER" -F, '
    BEGIN {
        # Calculate cutoff timestamp (approximate)
        cmd = "date -d \"-" days " days\" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -v-" days "d +%Y-%m-%dT%H:%M:%SZ"
        cmd | getline cutoff_date
        close(cmd)
        
        if (show_header == "true") {
            printf "Analyzing data since: %s\n\n", cutoff_date
            printf "% -20s % -15s % -25s\n", "METRIC", "PEAK VALUE", "TIMESTAMP"
            printf "% -20s % -15s % -25s\n", "--------------------", "---------------    ", "-------------------------"
        } else {
             printf "% -20s % -15s % -25s\n", "METRIC", "PEAK VALUE", "TIMESTAMP"
             printf "% -20s % -15s % -25s\n", "--------------------", "---------------    ", "-------------------------"
        }
    }

    # Skip headers
    $1 == "timestamp" { next }

    # Process lines
    {
        timestamp = $1
        if (timestamp < cutoff_date) next

        # Memory Used MB ($5), Memory % ($7)
        if ($5 + 0 > max_mem_mb) { max_mem_mb = $5; t_mem_mb = $1; }
        if ($7 + 0 > max_mem_pct) { max_mem_pct = $7; t_mem_pct = $1; }
        
        # CPU 1m ($8), 5m ($9), 15m ($10)
        if ($8 + 0 > max_cpu_1) { max_cpu_1 = $8; t_cpu_1 = $1; }
        if ($9 + 0 > max_cpu_5) { max_cpu_5 = $9; t_cpu_5 = $1; }
        if ($10 + 0 > max_cpu_15) { max_cpu_15 = $10; t_cpu_15 = $1; }
        
        # Disk Used GB ($11), Disk % ($13)
        if ($11 + 0 > max_disk_gb) { max_disk_gb = $11; t_disk_gb = $1; }
        if ($13 + 0 > max_disk_pct) { max_disk_pct = $13; t_disk_pct = $1; }

        count++
    }
    
    END {
        if (count == 0) {
            print "No data records found within the specified date range."
            exit
        }

        printf "% -20s % -15s % -25s\n", "Memory Usage", max_mem_mb " MB", t_mem_mb
        printf "% -20s % -15s % -25s\n", "Memory %", max_mem_pct " %", t_mem_pct
        printf "% -20s % -15s % -25s\n", "CPU Load (1m)", max_cpu_1, t_cpu_1
        printf "% -20s % -15s % -25s\n", "CPU Load (5m)", max_cpu_5, t_cpu_5
        printf "% -20s % -15s % -25s\n", "Disk Usage", max_disk_gb " GB", t_disk_gb
        printf "% -20s % -15s % -25s\n", "Disk %", max_disk_pct " %", t_disk_pct
        
        print "\nTotal records analyzed: " count
    }
' $FILES
