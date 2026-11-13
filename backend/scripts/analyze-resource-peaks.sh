#!/bin/bash

#############################################################################
# Peak Resource Usage Analyzer
# Analyzes performance metrics CSVs (see shared/docs/OPERATIONAL-METRICS.md)
# Usage: ./analyze-resource-peaks.sh [--no-header] [--format text|json] [days] [--role main-app|n8n]
#   days: a whole number from 1 to 365 (default 30)
# Exit status: 0 on success, 1 when the window cannot be worked out, there is nothing to read or a file cannot be read
# (the message is on stderr and nothing is on stdout), 2 on a usage error.
#
# No `set -u` (bash before 4.4 fails on an empty array under it) and no `mapfile` or bash associative arrays: this runs
# under the bash 3.2 of macOS as well as under the bash of the server.
#############################################################################

# The C locale keeps the comparisons of the timestamps and the months byte-wise and the letter ranges plain ASCII, whatever
# the locale of the shell that runs the script (a cron job and a login shell differ).
export LC_ALL=C

METRICS_DIR="${METRICS_DIR:-/var/log/performance-metrics}"
DEFAULT_DAYS=30
MAX_DAYS=365
DAYS=$DEFAULT_DAYS
# Set from the days argument; emptied here so that a variable of the same name in the environment is not taken for it.
DAYS_ARGUMENT=""
SHOW_HEADER=true
OUTPUT_FORMAT="text"
METRICS_ROLE="${METRICS_ROLE:-main-app}"
# A window of MAX_DAYS touches at most 13 months (a year back lands in the same month a year earlier); MAX_MONTHS adds one
# as slack, and a longer list means the loop below is broken.
MAX_MONTHS=14

usage() {
    echo "Usage: $0 [--no-header] [--format text|json] [days] [--role main-app|n8n]" >&2
    echo "  days: a whole number from 1 to $MAX_DAYS (default $DEFAULT_DAYS)" >&2
}

usage_error() {
    echo "Error: $1" >&2
    usage
    exit 2
}

fail() {
    echo "Error: $1" >&2
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-header)
            SHOW_HEADER=false
            shift
            ;;
        --format)
            if [[ $# -lt 2 || -z "$2" ]]; then
                usage_error "--format needs a value (text or json)"
            fi
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        --role)
            if [[ $# -lt 2 || -z "$2" ]]; then
                usage_error "--role needs a value (for example main-app or n8n)"
            fi
            METRICS_ROLE="$2"
            shift 2
            ;;
        *)
            DAYS_ARGUMENT_PATTERN='^[0-9]+$'
            if [[ "$1" =~ $DAYS_ARGUMENT_PATTERN ]]; then
                if [[ -n "${DAYS_ARGUMENT:-}" ]]; then
                    usage_error "days given twice ('$DAYS_ARGUMENT' and '$1')"
                fi
                DAYS_ARGUMENT="$1"
                shift
            else
                usage_error "unknown argument '$1'"
            fi
            ;;
    esac
done

# The number of days goes into `date` arithmetic, so it is checked before any use: at most four digits (a longer number
# would overflow the arithmetic below and `date`), then the range. Leading zeros are decimal (10# keeps 030 from being
# octal).
if [[ -n "${DAYS_ARGUMENT:-}" ]]; then
    DAYS_PATTERN='^[0-9]{1,4}$'
    if [[ ! "$DAYS_ARGUMENT" =~ $DAYS_PATTERN ]] || [ $((10#$DAYS_ARGUMENT)) -lt 1 ] || [ $((10#$DAYS_ARGUMENT)) -gt "$MAX_DAYS" ]; then
        usage_error "days must be a whole number from 1 to $MAX_DAYS, got '$DAYS_ARGUMENT'"
    fi
    DAYS=$((10#$DAYS_ARGUMENT))
fi

if [ "$OUTPUT_FORMAT" != "text" ] && [ "$OUTPUT_FORMAT" != "json" ]; then
    usage_error "--format must be text or json, got '$OUTPUT_FORMAT'"
fi

# The role is part of the file names, so it must stay one plain name: it starts with a letter or a digit, and goes on with
# letters, digits, - or _ (no slash, no leading dash). The METRICS_ROLE environment variable is held to the same rule.
ROLE_PATTERN='^[A-Za-z0-9][A-Za-z0-9_-]*$'
if [[ ! "$METRICS_ROLE" =~ $ROLE_PATTERN ]]; then
    usage_error "the role must start with a letter or a digit and go on with letters, digits, - or _, got '$METRICS_ROLE'"
fi

if [ "$OUTPUT_FORMAT" = "json" ]; then
    SHOW_HEADER=false
fi

# Prints the instant of epoch second $2 with the format $3, in UTC when $1 is "utc" and in the local zone otherwise. GNU
# date takes `-d @<seconds>`, BSD date takes `-r <seconds>`; each failure is silent so the other form gets its turn, and
# the checks below report an empty or odd result.
epoch_date() {
    if [ "$1" = "utc" ]; then
        date -u -d "@$2" "+$3" 2>/dev/null || date -u -r "$2" "+$3" 2>/dev/null
    else
        date -d "@$2" "+$3" 2>/dev/null || date -r "$2" "+$3" 2>/dev/null
    fi
}

# The start of the window. Every date this needs is worked out and checked before anything is printed, because a cutoff
# that is empty lets every row pass the filter and any other non-date makes the filter meaningless: the script would
# report an unbounded (or an empty) window as the last N days. All of them come from two instants, now and the cutoff,
# each read once, so the cutoff and the first month to read are the same instant, also across a change of daylight
# saving time, and a month change at midnight cannot fall between two calls.
EPOCH_PATTERN='^[0-9]+$'
CUTOFF_PATTERN='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
MONTH_PATTERN='^[0-9]{4}-(0[1-9]|1[0-2])$'
NOW_EPOCH=$(date +%s 2>/dev/null)
if [[ ! "$NOW_EPOCH" =~ $EPOCH_PATTERN ]]; then
    fail "could not work out the start of the ${DAYS}-day window: date +%s gave '$NOW_EPOCH' instead of the time, and without a cutoff the window would be unbounded"
fi
CUTOFF_EPOCH=$((NOW_EPOCH - DAYS * 86400))
# The CSV timestamps are UTC (performance-tracker.sh writes them with date -u), so the cutoff has to be UTC too: a local
# wall-clock time with a Z on it would shift the window by the zone offset.
CUTOFF=$(epoch_date utc "$CUTOFF_EPOCH" %Y-%m-%dT%H:%M:%SZ)
if [[ ! "$CUTOFF" =~ $CUTOFF_PATTERN ]]; then
    fail "could not work out the start of the ${DAYS}-day window: date gave '$CUTOFF' instead of a UTC timestamp, and without a cutoff the window would be unbounded"
fi
# The file name's month is the local one on purpose: performance-tracker.sh names the file with a local date +%Y-%m. So
# the first month to read is the local month of the cutoff instant, not the UTC month in the cutoff string.
CURRENT_MONTH=$(epoch_date local "$NOW_EPOCH" %Y-%m)
CUTOFF_MONTH=$(epoch_date local "$CUTOFF_EPOCH" %Y-%m)
if [[ ! "$CURRENT_MONTH" =~ $MONTH_PATTERN ]] || [[ ! "$CUTOFF_MONTH" =~ $MONTH_PATTERN ]]; then
    fail "could not work out the months of the ${DAYS}-day window: date gave '$CUTOFF_MONTH' and '$CURRENT_MONTH' instead of YYYY-MM"
fi

if [ ! -d "$METRICS_DIR" ]; then
    fail "Metrics directory $METRICS_DIR not found."
fi

# Every month the window touches, from the month of the cutoff to the current month, each file once. The next month is
# worked out from the month's number, never by adding a month to a date: that rolls over on days the next month does not
# have (GNU date -d "1 month ago" on Mar 29 is "Feb 29", which is Mar 1). The newest month is read first, which only
# matters for which of two equal peaks is named.
MONTHS=()
MONTH_YEAR=$((10#${CUTOFF_MONTH%-*}))
MONTH_NUMBER=$((10#${CUTOFF_MONTH#*-}))
while true; do
    MONTH=$(printf '%04d-%02d' "$MONTH_YEAR" "$MONTH_NUMBER")
    if [[ "$MONTH" > "$CURRENT_MONTH" ]] || [ "${#MONTHS[@]}" -ge "$MAX_MONTHS" ]; then
        fail "could not list the months from $CUTOFF_MONTH to $CURRENT_MONTH"
    fi
    MONTHS+=("$MONTH")
    if [ "$MONTH" = "$CURRENT_MONTH" ]; then
        break
    fi
    MONTH_NUMBER=$((MONTH_NUMBER + 1))
    if [ "$MONTH_NUMBER" -gt 12 ]; then
        MONTH_NUMBER=1
        MONTH_YEAR=$((MONTH_YEAR + 1))
    fi
done

FILES=()
for ((index = ${#MONTHS[@]} - 1; index >= 0; index--)); do
    MONTH="${MONTHS[$index]}"
    PATTERNS=("metrics-${METRICS_ROLE}-${MONTH}.csv")
    # The main app's files had no role in their name before the roles existed.
    if [ "$METRICS_ROLE" = "main-app" ]; then
        PATTERNS+=("metrics-${MONTH}.csv")
    fi
    for pattern in "${PATTERNS[@]}"; do
        if [ -f "$METRICS_DIR/$pattern" ]; then
            # A file that exists but cannot be read would make awk fail half way, after the output has started.
            if [ ! -r "$METRICS_DIR/$pattern" ]; then
                fail "cannot read $METRICS_DIR/$pattern"
            fi
            FILES+=("$METRICS_DIR/$pattern")
        fi
    done
done

if [ "${#FILES[@]}" -eq 0 ]; then
    fail "No metrics files found for role $METRICS_ROLE in $METRICS_DIR (months ${MONTHS[0]} to $CURRENT_MONTH)."
fi

# awk's output is held until awk has succeeded, so that a failure leaves no banner or half a table on stdout.
RESULT=$(awk -v cutoff_date="$CUTOFF" -v show_header="$SHOW_HEADER" -v role_filter="$METRICS_ROLE" -v output_format="$OUTPUT_FORMAT" -F, '
    BEGIN {
        if (show_header == "true") {
            printf "Analyzing data since: %s\n\n", cutoff_date
        }
        if (output_format != "json") {
            printf "% -24s % -15s % -25s\n", "METRIC", "PEAK VALUE", "TIMESTAMP"
            printf "% -24s % -15s % -25s\n", "------------------------", "---------------", "-------------------------"
        }

        # The metrics in the order they are reported: key, the label of the text table, the label of the JSON, the unit.
        metric_count = split("memory_pressure min_memory_available swap cpu disk api_rss", keys, " ")
        text_label["memory_pressure"] = "Memory pressure %";    json_label["memory_pressure"] = "Memory pressure percent"; unit["memory_pressure"] = "%"
        text_label["min_memory_available"] = "Min MemAvailable MB"; json_label["min_memory_available"] = "Min MemAvailable MB"; unit["min_memory_available"] = "MB"
        text_label["swap"] = "Swap used MB";                    json_label["swap"] = "Swap used MB";                  unit["swap"] = "MB"
        text_label["cpu"] = "CPU normalized %";                 json_label["cpu"] = "CPU normalized percent";         unit["cpu"] = "%"
        text_label["disk"] = "Disk %";                          json_label["disk"] = "Disk percent";                  unit["disk"] = "%"
        text_label["api_rss"] = "API RSS MB";                   json_label["api_rss"] = "API RSS MB";                 unit["api_rss"] = "MB"
    }

    function col(name) { return cols[name] + 0 }

    # A file written with CRLF line endings would leave a \r on the last column of every line.
    { sub(/\r$/, "") }

    # A number is only a plain non-negative decimal; an empty cell (a column that is missing, a row that is shorter than
    # the header, a field that was not collected) or text is not a reading and never becomes a 0.
    function reading(index_) {
        if (index_ > 0 && index_ <= NF && $(index_) ~ /^[0-9]+(\.[0-9]+)?$/) return $(index_) + 0
        return -1
    }

    # Keeps the highest reading of a metric (the lowest when `lowest` is set) and the timestamp of the first row read that
    # had it; the files are read newest first, so a tie across months names the newest. The "seen" test is `key in have`
    # and not a comparison with 0, so a metric that is 0 in every row is reported as 0.
    function track(key, value, lowest) {
        if (value < 0) return
        if (!(key in have) || (lowest ? value < peak[key] : value > peak[key])) {
            have[key] = 1
            peak[key] = value
            peak_time[key] = $1
        }
    }

    FNR == 1 {
        delete cols
        for (i = 1; i <= NF; i++) cols[$i] = i
        legacy = (col("role") == 0)
        next
    }

    {
        timestamp = $1
        if (timestamp !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z$/) next
        if (timestamp < cutoff_date) next

        if (!legacy) {
            row_role = $col("role")
            if (row_role != role_filter) next
        }

        mem_pressure_idx = col("memory_pressure_percent")
        if (mem_pressure_idx == 0) mem_pressure_idx = col("memory_percent")

        cpu_norm = reading(col("cpu_normalized_percent"))
        if (cpu_norm < 0) {
            load = reading(col("cpu_load_1m"))
            cores = reading(col("cpu_cores"))
            if (load >= 0 && cores > 0) cpu_norm = (load / cores) * 100
        }

        track("memory_pressure", reading(mem_pressure_idx), 0)
        track("min_memory_available", reading(col("memory_available_mb")), 1)
        track("swap", reading(col("swap_used_mb")), 0)
        track("cpu", cpu_norm, 0)
        track("disk", reading(col("disk_percent")), 0)
        track("api_rss", reading(col("pm2_api_rss_mb")), 0)

        count++
    }

    END {
        if (count == 0) {
            if (output_format == "json") {
                print "{\"sampleCount\":0,\"metrics\":[]}"
            } else {
                print "No data records found within the specified date range."
            }
            exit
        }

        if (output_format == "json") {
            printf("{\"sampleCount\":%d,\"metrics\":[", count)
            sep = ""
            missing = ""
            for (k = 1; k <= metric_count; k++) {
                key = keys[k]
                if (key in have) {
                    printf("%s{\"label\":\"%s\",\"value\":\"%s %s\",\"timestamp\":\"%s\"}", sep, json_label[key], peak[key], unit[key], peak_time[key])
                    sep = ","
                } else {
                    missing = missing (missing == "" ? "" : ",") "\"" json_label[key] "\""
                }
            }
            # A metric with no reading in any row is left out of "metrics", never printed blank, and named here. The
            # field only exists when something is missing, so data with no missing metric gives the same shape as before.
            if (missing != "") {
                printf("],\"missingMetrics\":[%s]}\n", missing)
            } else {
                print "]}"
            }
            exit
        }

        for (k = 1; k <= metric_count; k++) {
            key = keys[k]
            if (key in have) {
                printf "% -24s % -15s % -25s\n", text_label[key], peak[key] " " unit[key], peak_time[key]
            } else {
                printf "% -24s % -15s % -25s\n", text_label[key], "n/a", "-"
            }
        }

        print "\nTotal records analyzed: " count
    }
' "${FILES[@]}")
AWK_STATUS=$?
if [ "$AWK_STATUS" -ne 0 ]; then
    fail "awk failed (status $AWK_STATUS) reading ${FILES[*]}"
fi

if [ "$SHOW_HEADER" = true ]; then
    echo "================================================================"
    echo "Peak Resource Usage Analysis (Last $DAYS days, role=$METRICS_ROLE)"
    echo "Source: $METRICS_DIR"
    echo "================================================================"
fi
printf '%s\n' "$RESULT"
