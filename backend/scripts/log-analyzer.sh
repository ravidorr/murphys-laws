#!/bin/bash

#############################################################################
# Centralized Log Analysis Script
# Analyzes logs for suspicious patterns, SQL injection attempts, and security issues
# Should be run daily via cron
#############################################################################

LOG_FILE="${LOG_ANALYZER_LOG:-/var/log/log-analyzer.log}"
REPORT_FILE="/tmp/log-analysis-$(date +%Y-%m-%d).txt"
OUTPUT_FORMAT="text"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --format)
            OUTPUT_FORMAT="${2:-text}"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Log files to analyze
NGINX_ACCESS_LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/access.log}"
NGINX_ERROR_LOG="${NGINX_ERROR_LOG:-/var/log/nginx/error.log}"
AUTH_LOG="${AUTH_LOG:-/var/log/auth.log}"
SYSLOG="${SYSLOG:-/var/log/syslog}"

# Suspicious patterns. Each is an extended regex matched case-insensitively against the request field only
# (the quoted `GET /path?query HTTP/1.1` part of an nginx combined-format line), never the referrer or
# User-Agent, so `update` and `set`, or `delete` and `from`, in a browser string cannot add up to an attack.
# A "separator" below is what a SQL keyword gap looks like in a logged URL: a space, `+`, `%20`, a tab or line
# break (`%09`, `%0a`, `%0d`) or `/**/`.
SQL_SEP='(%20|%09|%0[ad]|\+|[[:space:]]|/\*\*/)'

# Every pattern names a whole attack shape. Free-text words such as `update`, `set`, `from` or `or` do not
# match alone, and `.*` is replaced by a bounded run inside one query parameter (`[^&"]`), so a site search such
# as `q=update settings` stays out of the count. `or` and `and` must start a word (after a separator, quote or
# `)`), so `q=color+1=1` is not a tautology. A bare `--` is not a signal (slugs and User-Agents contain it); it
# counts only directly after a quote (with `)`, `;` or separators between them) or after `;` or `)`, in plain or
# URL-encoded (`%2D%2D`) form. A search that spells out `select ... from ... where` inside one parameter still
# counts: it is indistinguishable from the attack.
SQL_INJECTION_PATTERNS=(
    "union(${SQL_SEP}|\(|%28)+(all${SQL_SEP}+)?select"
    "select${SQL_SEP}[^&\"]{1,80}from${SQL_SEP}[^&\"]{1,80}where"
    "insert${SQL_SEP}+into${SQL_SEP}+[^&\"]{1,80}(values|select)"
    "delete${SQL_SEP}+from${SQL_SEP}+[^&\"]{1,80}where"
    "update${SQL_SEP}+[a-z0-9_.]+${SQL_SEP}+set${SQL_SEP}+[a-z0-9_.]+${SQL_SEP}*(=|%3D)"
    "(;|%3B)${SQL_SEP}*(delete${SQL_SEP}+from|insert${SQL_SEP}+into|update${SQL_SEP}+[a-z0-9_.]+${SQL_SEP}+set)"
    "drop${SQL_SEP}+table"
    "xp_cmdshell"
    "exec${SQL_SEP}+(master\.\.)?xp_"
    "('|%27)(${SQL_SEP}|;|%3B|\)|%29)*(--|%2D%2D)"
    "(;|%3B|\)|%29)${SQL_SEP}*(--|%2D%2D)"
    "(${SQL_SEP}|'|%27|\)|%29)(or|and)${SQL_SEP}+(\(|%28)?([0-9]+${SQL_SEP}*(=|%3D)${SQL_SEP}*[0-9]+|('|%27)[a-z0-9]*('|%27)${SQL_SEP}*(=|%3D)${SQL_SEP}*('|%27)[a-z0-9]*)"
)

# Matched against the request field only. `document\.cookie` and `eval\(` escape their punctuation so the dot
# is not a wildcard.
XSS_PATTERNS=(
    "<script"
    "javascript:"
    "onerror="
    "onload="
    "onclick="
    "<iframe"
    "document\.cookie"
    "eval\("
)

PATH_TRAVERSAL_PATTERNS=(
    "\.\./"
    "\.\.%2F"
    "\.\.%5C"
    "%2e%2e"
    "etc/passwd"
    "etc/shadow"
    "boot\.ini"
    "win\.ini"
)

# Each pattern is an extended regex run through `grep -iE`, so a bare `|` is alternation: `|cat` means
# "empty or cat" and matches every line (GNU grep; BSD grep rejects it).
# The pipe is therefore escaped, and every metacharacter is matched literally and in its URL-encoded form
# (`%7C`, `%26`, `%3B`, `%60`, `%24%28`). Between the metacharacter and the command there may be spaces written
# as `+`, `%20`, a tab (`%09`) or a line break (`%0a`, `%0d`); after `|`, backtick and `$(` literal whitespace is
# allowed too, but not after `&` and `;`, which are everywhere in User-Agents (`(Linux; Android 11; CAT S62)`).
# After `|`, backtick and `$(` the command must end at a word boundary. After `&` and `;` it must not be followed
# by a letter, digit, `_`, `=` or `&`, so `&category_id=23` and a parameter named `cat` (`&cat=5`) stay out of
# the count while `;cat</etc/passwd` and `;cat${IFS}...` are counted.
COMMAND_INJECTION_PATTERNS=(
    '(\||%7C)(%20|%09|%0[ad]|\+|[[:space:]])*cat\b'
    '(\||%7C)(%20|%09|%0[ad]|\+|[[:space:]])*nc\b'
    '(\||%7C)(%20|%09|%0[ad]|\+|[[:space:]])*wget\b'
    '(\||%7C)(%20|%09|%0[ad]|\+|[[:space:]])*curl\b'
    '(\||%7C)(%20|%09|%0[ad]|\+|[[:space:]])*bash\b'
    '(\||%7C)(%20|%09|%0[ad]|\+|[[:space:]])*sh\b'
    '(&|%26)(%20|%09|%0[ad]|\+)*cat([^[:alnum:]_=&]|$)'
    '(;|%3B)(%20|%09|%0[ad]|\+)*cat([^[:alnum:]_=&]|$)'
    '(`|%60)(%20|%09|%0[ad]|\+|[[:space:]])*cat\b'
    '(\$\(|%24%28)(%20|%09|%0[ad]|\+|[[:space:]])*cat\b'
)

# Logging - only to log file, not stdout (stdout goes to email)
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Today's date in nginx log format. Every nginx access-log count, sample and IP in the report is taken from
# lines stamped with this date, so the security scans cover the same day as the request totals.
# LOG_ANALYZER_DATE (same `dd/Mon/yyyy` form) analyses another day of the access log, such as yesterday's to
# rerun a report; it does not affect the auth log, rate-limit or API-error sections, which still use today.
TODAY="${LOG_ANALYZER_DATE:-$(date +%d/%b/%Y)}"

# Today's lines of the nginx access log. The date is matched as the bracketed start of the timestamp
# (`[dd/Mon/yyyy:`), so a bare date in a URL, referrer or User-Agent does not pull in another day's request.
todays_requests() {
    grep -F "[$TODAY:" "$NGINX_ACCESS_LOG" 2>/dev/null
}

# Today's request lines whose request field matches any of the given patterns. The patterns are joined into
# one alternation and run in a single pass, so a line is returned once however many of them it matches. The
# regex is anchored to the first quoted field of the line, the request, so nothing outside it can match.
scan_requests() {
    local regex="" pattern
    for pattern in "$@"; do
        regex+="${regex:+|}($pattern)"
    done
    todays_requests | grep -iE "^[^\"]*\"[^\"]*($regex)"
}

# Number of lines scan_requests returns for the given patterns (each matching line once, however many of the
# patterns it matches).
count_requests() {
    scan_requests "$@" | awk 'END {print NR}'
}

# How many sample lines each security section prints.
SAMPLE_LINES=5

# Up to SAMPLE_LINES of the lines scan_requests returns, uncut; the text report cuts them to 120 characters
# when it prints them.
sample_requests() {
    scan_requests "$@" | head -"$SAMPLE_LINES"
}

# Generate report
REPORT=""

log "=========================================="
log "Starting Log Analysis"
log "=========================================="

# 1. Nginx Access Log Analysis
log "Analyzing nginx access logs..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="NGINX ACCESS LOG ANALYSIS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

if [ -f "$NGINX_ACCESS_LOG" ]; then
    # Total requests today
    TOTAL_REQUESTS=$(todays_requests | awk 'END {print NR}')
    REPORT+="Total requests today: $TOTAL_REQUESTS\n\n"

    # Status code distribution
    REPORT+="Status Code Distribution:\n"
    while read -r count code; do
        REPORT+="  $code: $count requests\n"
    done < <(todays_requests | awk '{print $9}' | sort | uniq -c | sort -rn)
    REPORT+="\n"

    # Top 10 IPs
    REPORT+="Top 10 IP Addresses:\n"
    while read -r count ip; do
        REPORT+="  $ip: $count requests\n"
    done < <(todays_requests | awk '{print $1}' | sort | uniq -c | sort -rn | head -10)
    REPORT+="\n"

    # 4xx errors
    ERROR_4XX=$(todays_requests | awk -F'"' '{split($3, rest, " "); if (rest[1] ~ /^4[0-9][0-9]$/) count++} END {print count + 0}')
    if [ "$ERROR_4XX" -gt 0 ]; then
        REPORT+="4xx Client Errors: $ERROR_4XX\n"
        REPORT+="Top 404 URLs:\n"
        while read -r count url; do
            REPORT+="  $url: $count times\n"
        done < <(todays_requests | grep ' 404 ' | awk '{print $7}' | sort | uniq -c | sort -rn | head -10)
        REPORT+="\n"
    fi

    # 5xx errors
    ERROR_5XX=$(todays_requests | awk -F'"' '{split($3, rest, " "); if (rest[1] ~ /^5[0-9][0-9]$/) count++} END {print count + 0}')
    if [ "$ERROR_5XX" -gt 0 ]; then
        REPORT+="5xx Server Errors: $ERROR_5XX\n"
        while IFS= read -r line; do
            REPORT+="  $line\n"
        done < <(todays_requests | grep ' 5[0-9][0-9] ' | tail -10)
        REPORT+="\n"
    else
        REPORT+="No 5xx server errors\n\n"
    fi

    # Suspicious User Agents
    REPORT+="Suspicious User Agents:\n"
    while read -r count agent; do
        REPORT+="  $count - $agent\n"
    done < <(todays_requests | grep -iE "(bot|crawler|spider|scan|nikto|sqlmap|havij|acunetix)" | awk -F'"' '{print $6}' | sort | uniq -c | sort -rn | head -10)
    REPORT+="\n"
else
    TOTAL_REQUESTS=0
    ERROR_4XX=0
    ERROR_5XX=0
    REPORT+="Nginx access log not found\n\n"
fi

# 2. SQL Injection Attempts
log "Checking for SQL injection attempts..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="SQL INJECTION ATTEMPTS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

SQL_ATTEMPTS=$(count_requests "${SQL_INJECTION_PATTERNS[@]}")

if [ "$SQL_ATTEMPTS" -gt 0 ]; then
    REPORT+="Detected $SQL_ATTEMPTS potential SQL injection attempts\n\n"
    REPORT+="Sample attempts:\n"

    while IFS= read -r line; do
        REPORT+="  $(echo "$line" | cut -c1-120)...\n"
    done < <(sample_requests "${SQL_INJECTION_PATTERNS[@]}")
    REPORT+="\n"

    # Get attacking IPs
    REPORT+="Attacking IPs:\n"
    while read -r count ip; do
        REPORT+="  $ip: $count attempts\n"
    done < <(scan_requests "${SQL_INJECTION_PATTERNS[@]}" | awk '{print $1}' | sort | uniq -c | sort -rn | head -10)
    REPORT+="\n"

    log "Found $SQL_ATTEMPTS SQL injection attempts"
else
    REPORT+="No SQL injection attempts detected\n\n"
    log "No SQL injection attempts found"
fi

# 3. XSS Attempts
log "Checking for XSS attempts..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="CROSS-SITE SCRIPTING (XSS) ATTEMPTS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

XSS_ATTEMPTS=$(count_requests "${XSS_PATTERNS[@]}")

if [ "$XSS_ATTEMPTS" -gt 0 ]; then
    REPORT+="Detected $XSS_ATTEMPTS potential XSS attempts\n\n"
    REPORT+="Sample attempts:\n"

    while IFS= read -r line; do
        REPORT+="  $(echo "$line" | cut -c1-120)...\n"
    done < <(sample_requests "${XSS_PATTERNS[@]}")
    REPORT+="\n"

    log "Found $XSS_ATTEMPTS XSS attempts"
else
    REPORT+="No XSS attempts detected\n\n"
    log "No XSS attempts found"
fi

# 4. Path Traversal Attempts
log "Checking for path traversal attempts..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="PATH TRAVERSAL ATTEMPTS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

TRAVERSAL_ATTEMPTS=$(count_requests "${PATH_TRAVERSAL_PATTERNS[@]}")

if [ "$TRAVERSAL_ATTEMPTS" -gt 0 ]; then
    REPORT+="Detected $TRAVERSAL_ATTEMPTS potential path traversal attempts\n\n"
    REPORT+="Sample attempts:\n"

    while IFS= read -r line; do
        REPORT+="  $(echo "$line" | cut -c1-120)...\n"
    done < <(sample_requests "${PATH_TRAVERSAL_PATTERNS[@]}")
    REPORT+="\n"

    log "Found $TRAVERSAL_ATTEMPTS path traversal attempts"
else
    REPORT+="No path traversal attempts detected\n\n"
    log "No path traversal attempts found"
fi

# 5. Command Injection Attempts
log "Checking for command injection attempts..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="COMMAND INJECTION ATTEMPTS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

CMD_ATTEMPTS=$(count_requests "${COMMAND_INJECTION_PATTERNS[@]}")

if [ "$CMD_ATTEMPTS" -gt 0 ]; then
    REPORT+="Detected $CMD_ATTEMPTS potential command injection attempts\n\n"
    REPORT+="Sample attempts:\n"

    while IFS= read -r line; do
        REPORT+="  $(echo "$line" | cut -c1-120)...\n"
    done < <(sample_requests "${COMMAND_INJECTION_PATTERNS[@]}")
    REPORT+="\n"

    log "Found $CMD_ATTEMPTS command injection attempts"
else
    REPORT+="No command injection attempts detected\n\n"
    log "No command injection attempts found"
fi

# 6. Brute Force Detection
log "Checking for brute force attempts..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="BRUTE FORCE ATTEMPTS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

if [ -f "$AUTH_LOG" ]; then
    # SSH brute force
    FAILED_SSH=$(grep "Failed password" "$AUTH_LOG" | grep "$(date +%b\ %d)" | wc -l)

    if [ "$FAILED_SSH" -gt 20 ]; then
        REPORT+="Detected $FAILED_SSH failed SSH login attempts today\n\n"

        REPORT+="Top attacking IPs:\n"
        while read -r count ip; do
            REPORT+="  $ip: $count attempts\n"
        done < <(grep "Failed password" "$AUTH_LOG" | grep "$(date +%b\ %d)" | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -10)
        REPORT+="\n"

        log "Found $FAILED_SSH SSH brute force attempts"
    else
        REPORT+="No significant brute force activity ($FAILED_SSH failed attempts)\n\n"
        log "No significant brute force activity"
    fi
fi

# 7. Rate Limiting Hits
log "Checking rate limit hits..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="RATE LIMITING\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

if [ -f "$NGINX_ERROR_LOG" ]; then
    RATE_LIMIT_HITS=$(grep "limiting requests" "$NGINX_ERROR_LOG" | grep "$(date +%Y/%m/%d)" | wc -l)

    if [ "$RATE_LIMIT_HITS" -gt 0 ]; then
        REPORT+="Rate limit triggered $RATE_LIMIT_HITS times today\n\n"

        REPORT+="Top rate-limited IPs:\n"
        while read -r count ip; do
            REPORT+="  $ip: $count times\n"
        done < <(grep "limiting requests" "$NGINX_ERROR_LOG" | grep "$(date +%Y/%m/%d)" | grep -oP 'client: \K[0-9.]+' | sort | uniq -c | sort -rn | head -10)
        REPORT+="\n"

        log "Rate limiting triggered $RATE_LIMIT_HITS times"
    else
        REPORT+="No rate limiting triggered\n\n"
    fi
fi

# 8. Application Errors
log "Checking application errors..."
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
REPORT+="APPLICATION ERRORS\n"
REPORT+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

if [ -f "/root/murphys-laws/logs/api-error.log" ]; then
    API_ERRORS=$(grep -E "(Error|Exception|Failed)" "/root/murphys-laws/logs/api-error.log" | tail -10 | wc -l)

    if [ "$API_ERRORS" -gt 0 ]; then
        REPORT+="Recent API errors:\n"
        while IFS= read -r line; do
            REPORT+="  $line\n"
        done < <(grep -E "(Error|Exception|Failed)" "/root/murphys-laws/logs/api-error.log" | tail -10)
        REPORT+="\n"
    else
        REPORT+="No recent API errors\n\n"
    fi
else
    REPORT+="No API error log found\n\n"
fi

# Generate summary
# A request that matches two categories (a traversal into /etc/passwd with a piped cat, say) is one request,
# so the grand total counts each request once rather than adding the category counts. Each category line
# still shows every request that matches it.
CATEGORY_SUM=$((SQL_ATTEMPTS + XSS_ATTEMPTS + TRAVERSAL_ATTEMPTS + CMD_ATTEMPTS))
TOTAL_ISSUES=$(count_requests "${SQL_INJECTION_PATTERNS[@]}" "${XSS_PATTERNS[@]}" "${PATH_TRAVERSAL_PATTERNS[@]}" "${COMMAND_INJECTION_PATTERNS[@]}")

SUMMARY=""

if [ "$TOTAL_ISSUES" -gt 0 ]; then
    [ "$SQL_ATTEMPTS" -gt 0 ] && SUMMARY+="  • SQL Injection: $SQL_ATTEMPTS attempts\n"
    [ "$XSS_ATTEMPTS" -gt 0 ] && SUMMARY+="  • XSS: $XSS_ATTEMPTS attempts\n"
    [ "$TRAVERSAL_ATTEMPTS" -gt 0 ] && SUMMARY+="  • Path Traversal: $TRAVERSAL_ATTEMPTS attempts\n"
    [ "$CMD_ATTEMPTS" -gt 0 ] && SUMMARY+="  • Command Injection: $CMD_ATTEMPTS attempts\n"
    SUMMARY+="\nTotal attack attempts: $TOTAL_ISSUES\n"
    if [ "$CATEGORY_SUM" -gt "$TOTAL_ISSUES" ]; then
        SUMMARY+="(a request matching several categories is counted once in the total)\n"
    fi
    SUMMARY+="\n"
else
    SUMMARY+="No security issues detected in logs\n\n"
fi

SUMMARY+="Total requests today: $TOTAL_REQUESTS\n"
SUMMARY+="4xx errors: $ERROR_4XX\n"
SUMMARY+="5xx errors: $ERROR_5XX\n\n"

# Add summary to beginning of report
FULL_REPORT="$SUMMARY$REPORT"

emit_json_report() {
    local status_codes='[]'
    local top_urls='[]'
    local top_ips='[]'
    local suspicious='[]'
    local error_samples='[]'
    local app_errors='[]'
    local findings='[]'
    local attack_lines='[]'
    local samples='[]'

    if [ -f "$NGINX_ACCESS_LOG" ]; then
        status_codes=$(
            todays_requests | awk -F'"' '{split($3, rest, " "); if (rest[1] ~ /^[1-5][0-9][0-9]$/) print rest[1]}' | sort | uniq -c | sort -rn | head -10 |
                awk '{print $1"\t"$2}' |
                jq -R -s 'split("\n") | map(select(length>0)) | map(split("\t")) | map({count:(.[0]|tonumber), code:(.[1]|tonumber)})'
        )
        top_urls=$(
            todays_requests | awk '{print $7}' | sort | uniq -c | sort -rn | head -10 |
                awk '{print $1"\t"$2}' |
                jq -R -s 'split("\n") | map(select(length>0)) | map(split("\t")) | map({count:(.[0]|tonumber), url:.[1]})'
        )
        top_ips=$(
            todays_requests | awk '{print $1}' | sort | uniq -c | sort -rn | head -10 |
                awk '{print $1"\t"$2}' |
                jq -R -s 'split("\n") | map(select(length>0)) | map(split("\t")) | map({count:(.[0]|tonumber), ip:.[1]})'
        )
        suspicious=$(
            todays_requests | grep -iE "(bot|crawler|spider|scan|nikto|sqlmap|havij|acunetix)" |
                awk -F'"' '{print $6}' | sort | uniq -c | sort -rn | head -10 |
                awk '{count=$1; $1=""; sub(/^ /,""); print count"\t"$0}' |
                jq -R -s 'split("\n") | map(select(length>0)) | map(split("\t")) | map({count:(.[0]|tonumber), agent:.[1]})'
        )
        # Up to 10 most frequent distinct requests for each 4xx/5xx status code.
        error_samples=$(
            todays_requests |
                awk -F'"' '{
                    split($3, rest, " "); code = rest[1]
                    if (code !~ /^[45][0-9][0-9]$/) next
                    split($1, head, " "); req = $2; sub(/ HTTP\/[0-9.]+$/, "", req)
                    key = code "\t" req
                    if (!(key in count)) { ip[key] = head[1]; agent[key] = $6 }
                    count[key]++; total[code]++
                }
                END { for (key in count) { split(key, parts, "\t"); printf "%s\t%d\t%d\t%s\t%s\t%s\n", parts[1], total[parts[1]], count[key], ip[key], agent[key], parts[2] } }' |
                sort -t "$(printf '\t')" -k1,1n -k3,3nr |
                awk -F'\t' '{ if (seen[$1]++ < 10) print }' |
                jq -R -s 'split("\n") | map(select(length>0)) | map(split("\t")) | group_by(.[0]) |
                    map({code:(.[0][0]|tonumber), total:(.[0][1]|tonumber),
                         samples:map({count:(.[2]|tonumber), ip:.[3], agent:.[4], request:.[5]})})'
        )
    fi

    # Records one category: its count, and up to SAMPLE_LINES of its matching lines from today, found with
    # the same patterns and date filter as the count. The remaining arguments are the category's patterns.
    append_finding() {
        local category="$1"
        local count="$2"
        shift 2
        samples=$(sample_requests "$@" | jq -R -s 'split("\n") | map(select(length>0))')
        findings=$(jq -n --argjson findings "$findings" --arg category "$category" --argjson count "$count" --argjson samples "$samples" \
            '$findings + [{category:$category,count:$count,samples:$samples}]')
    }

    if [ "$SQL_ATTEMPTS" -gt 0 ]; then
        append_finding "SQL Injection" "$SQL_ATTEMPTS" "${SQL_INJECTION_PATTERNS[@]}"
    fi
    if [ "$XSS_ATTEMPTS" -gt 0 ]; then
        append_finding "Cross-Site Scripting (XSS)" "$XSS_ATTEMPTS" "${XSS_PATTERNS[@]}"
    fi
    if [ "$TRAVERSAL_ATTEMPTS" -gt 0 ]; then
        append_finding "Path Traversal" "$TRAVERSAL_ATTEMPTS" "${PATH_TRAVERSAL_PATTERNS[@]}"
    fi
    if [ "$CMD_ATTEMPTS" -gt 0 ]; then
        append_finding "Command Injection" "$CMD_ATTEMPTS" "${COMMAND_INJECTION_PATTERNS[@]}"
    fi

    if [ -f "/root/murphys-laws/logs/api-error.log" ]; then
        app_errors=$(
            grep -E "(Error|Exception|Failed)" "/root/murphys-laws/logs/api-error.log" | tail -10 |
                jq -R -s 'split("\n") | map(select(length>0))'
        )
    fi

    if [ "$TOTAL_ISSUES" -gt 0 ]; then
        attack_lines=$(
            jq -n \
                --argjson sql "$SQL_ATTEMPTS" \
                --argjson xss "$XSS_ATTEMPTS" \
                --argjson traversal "$TRAVERSAL_ATTEMPTS" \
                --argjson cmd "$CMD_ATTEMPTS" \
                '[("SQL Injection: " + ($sql|tostring) + " attempts"),
                  ("XSS: " + ($xss|tostring) + " attempts"),
                  ("Path Traversal: " + ($traversal|tostring) + " attempts"),
                  ("Command Injection: " + ($cmd|tostring) + " attempts")] | map(select(test("[1-9]")))'
        )
    else
        attack_lines='["No security issues detected in logs"]'
    fi

    jq -n \
        --argjson summary "$(jq -n \
            --argjson totalAttackAttempts "${TOTAL_ISSUES:-0}" \
            --argjson totalRequests "${TOTAL_REQUESTS:-0}" \
            --argjson errors4xx "${ERROR_4XX:-0}" \
            --argjson errors5xx "${ERROR_5XX:-0}" \
            --argjson attackLines "$attack_lines" \
            '{totalAttackAttempts:$totalAttackAttempts,totalRequests:$totalRequests,errors4xx:$errors4xx,errors5xx:$errors5xx,attackLines:$attackLines}')" \
        --argjson statusCodes "$status_codes" \
        --argjson topUrls "$top_urls" \
        --argjson topIps "$top_ips" \
        --argjson suspiciousUserAgents "$suspicious" \
        --argjson errorSamples "$error_samples" \
        --argjson securityFindings "$findings" \
        --argjson applicationErrors "$app_errors" \
        '{summary:$summary,statusCodes:$statusCodes,topUrls:$topUrls,topIps:$topIps,suspiciousUserAgents:$suspiciousUserAgents,errorSamples:$errorSamples,securityFindings:$securityFindings,applicationErrors:$applicationErrors}'
}

if [ "$OUTPUT_FORMAT" = "json" ]; then
    emit_json_report
    exit 0
fi

# Output report to stdout for inclusion in daily report
echo -e "$FULL_REPORT"

# Also save to file for standalone access if needed
echo -e "$FULL_REPORT" > "$REPORT_FILE"
log "Report saved to $REPORT_FILE"

log "=========================================="
log "Log analysis completed"
log "=========================================="

# Cleanup old reports
find /tmp -maxdepth 1 -name "log-analysis-*.txt" -mtime +30 -delete
