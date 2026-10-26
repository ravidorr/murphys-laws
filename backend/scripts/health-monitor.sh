#!/bin/bash

#############################################################################
# Health Monitor Script
# Runs health checks periodically and restarts services if they're unresponsive
# Should be run via cron every 5 minutes
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/root/murphys-laws"  # Hardcoded for cron execution
LOG_FILE="/var/log/health-monitor.log"
HEALTH_CHECK_FAILURES="/var/tmp/health-check-failures"
ALERT_STATE_DIR="/var/tmp/health-monitor-alerts"
COULD_NOT_RUN_COOLDOWN=21600  # at most one "could not run" mail per exit code every 6 hours
WARNING_COOLDOWN=86400        # at most one slow-site warning mail a day
OUTAGE_REPORT_WINDOW=21600    # an outage mail covers the next 6 hours, in case no healthy run ever clears it
LOCK_DIR="/var/tmp/health-monitor.lock"
LOCK_STALE_SECONDS=900        # a lock older than this is taken over even if its process still exists
CHECK_TIMEOUT_SECONDS=120     # backstop for one run of the check, which bounds its own requests to 10 seconds

# Configuration
MAX_FAILURES=3  # Restart after 3 consecutive failures

# cron's default PATH is just /usr/bin:/bin; add the usual places for mail, sendmail and node after it
export PATH="$PATH:/usr/local/bin:/usr/sbin"
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
    logger -t murphys-alerts -p user.err -- "FATAL: $(basename "$0") cannot load alert-email.sh" 2>/dev/null
    exit 1
fi
ALERT_EMAIL="$(resolve_alert_email)"

# Optional config overrides (kept out of the repo so secrets like the dead-man-switch
# UUID stay off public git history). Currently recognized:
#   HEALTHCHECKS_PING_URL  full https://hc-ping.com/<uuid> or self-hosted equivalent
[ -f /etc/default/health-monitor ] && . /etc/default/health-monitor

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Optional dead-man-switch ping. Only fires when HEALTHCHECKS_PING_URL is set; absence
# is silent so dev / fresh deploys without the env file behave identically. Ping failure
# is non-fatal so a flaky outbound network does not break local restart logic.
ping_deadman() {
    if [ -n "${HEALTHCHECKS_PING_URL:-}" ]; then
        curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECKS_PING_URL" \
            || log "Dead-man-switch ping failed (non-fatal)"
    fi
}

# State files (the failure count, the alert times) are written to a temporary file and then moved into
# place, so a run that overlaps another never reads a half-written value.
write_state() {
    local file="$1" value="$2" tmp="$1.tmp.$$"
    if printf '%s\n' "$value" > "$tmp" 2>/dev/null && mv -f "$tmp" "$file" 2>/dev/null; then
        return 0
    fi
    rm -f -- "${tmp:?}" 2>/dev/null
    return 1
}

# Get current failure count (a missing or non-numeric file counts as 0)
get_failure_count() {
    local value
    value="$(cat "$HEALTH_CHECK_FAILURES" 2>/dev/null)"
    if [[ "$value" =~ ^[0-9]+$ ]]; then
        echo "$((10#$value))"
    else
        echo "0"
    fi
}

# Increment failure count. It runs inside $(...), so it must not log; the caller checks that the new
# count was really saved.
increment_failure_count() {
    local count
    count=$(( $(get_failure_count) + 1 ))
    write_state "$HEALTH_CHECK_FAILURES" "$count"
    echo "$count"
}

# Reset failure count
reset_failure_count() {
    write_state "$HEALTH_CHECK_FAILURES" 0 || log "Warning: could not reset the failure count in $HEALTH_CHECK_FAILURES"
}

# Cooldowns for mails that would otherwise repeat on every 5-minute run. A state file holds the time the
# last mail for a key was accepted; it is written only after that, so a mail that could not be sent does
# not hide the next attempt. A missing, malformed or future time (the clock went back) counts as due.
alert_due() {
    local file="$ALERT_STATE_DIR/$1" last now
    [ -f "$file" ] || return 0
    last="$(cat "$file" 2>/dev/null)"
    [[ "$last" =~ ^[0-9]+$ ]] || return 0
    last=$((10#$last))
    now="$(date +%s)"
    [ "$last" -gt "$now" ] && return 0
    [ $((now - last)) -ge "$2" ]
}

record_alert_sent() {
    mkdir -p "$ALERT_STATE_DIR" 2>/dev/null && write_state "$ALERT_STATE_DIR/$1" "$(date +%s)" \
        || log "Warning: could not record the alert time in $ALERT_STATE_DIR (it may repeat on every run)"
}

# Forgets the cooldown of every key starting with $1, so the next occurrence is reported straight away.
clear_alert_state() {
    local prefix="$1"
    rm -f -- "${ALERT_STATE_DIR:?}/${prefix:?}"* 2>/dev/null
    return 0
}

# Send alert email
send_alert() {
    local subject="$1"
    local body="$2"
    local mail_status=0
    echo "$body" | send_alert_mail "[Murphy's Laws] $subject" || mail_status=$?
    if [ "$mail_status" -eq 0 ]; then
        log "Alert sent: $subject"
    else
        log "ALERT NOT SENT ($(describe_alert_mail_status "$mail_status")): $subject"
        ALERT_UNDELIVERED=1
    fi
    return "$mail_status"
}

# send_alert, but at most once per $2 seconds for the key $1 (arguments: key, seconds, subject, body).
send_alert_limited() {
    local key="$1" seconds="$2" subject="$3" body="$4" mail_status=0
    if ! alert_due "$key" "$seconds"; then
        log "ALERT SUPPRESSED (cooldown): $subject"
        return 0
    fi
    send_alert "$subject" "$body" || mail_status=$?
    if [ "$mail_status" -eq 0 ]; then
        record_alert_sent "$key"
    fi
    return "$mail_status"
}

# One run at a time: a hung or slow earlier run must not overlap this one (they would share the failure
# count). The lock is a directory holding the owner's pid and start time. It is taken over when the owner
# is gone, or has run for more than LOCK_STALE_SECONDS.
acquire_lock() {
    local attempt holder started
    for attempt in 1 2; do
        if mkdir "$LOCK_DIR" 2>/dev/null; then
            echo "$$" > "$LOCK_DIR/pid"
            date +%s > "$LOCK_DIR/started"
            return 0
        fi
        holder="$(cat "$LOCK_DIR/pid" 2>/dev/null)"
        started="$(cat "$LOCK_DIR/started" 2>/dev/null)"
        if [[ "$holder" =~ ^[0-9]+$ ]] && [[ "$started" =~ ^[0-9]+$ ]] \
            && kill -0 "$holder" 2>/dev/null && [ $(( $(date +%s) - started )) -lt "$LOCK_STALE_SECONDS" ]; then
            log "Another health monitor run (pid $holder) is still in progress; skipping this run"
            return 1
        fi
        log "Taking over a stale health monitor lock (owner: ${holder:-unknown})"
        rm -rf -- "${LOCK_DIR:?}"
    done
    log "Could not take the health monitor lock $LOCK_DIR; skipping this run"
    return 1
}

cleanup() {
    [ -n "${OUTPUT_FILE:-}" ] && rm -f -- "$OUTPUT_FILE"
    [ -n "${RETEST_FILE:-}" ] && rm -f -- "$RETEST_FILE"
    if [ "$(cat "$LOCK_DIR/pid" 2>/dev/null)" = "$$" ]; then
        rm -rf -- "${LOCK_DIR:?}"
    fi
    return 0
}

# Runs the TypeScript health check, preferring the locally installed tsx (deploys run `npm ci` in backend/),
# under `timeout` where it exists. It runs with --no-email: this script is the only sender, so one run
# sends at most one mail and SMTP settings cannot stop the checks. Exit codes: 0 healthy, 1 a check failed
# (the output then says "Health check FAILED"), 3 healthy but with warnings (slow responses). Anything else
# (2, 4, 124 when it timed out, 126/127 when tsx, npx or node cannot be started, 137 when it is killed, or an
# exit 1 without that line, as from a crash or a broken install) means the check itself could not run,
# which says nothing about the site.
run_health_check() {
    local tsx_bin="$PROJECT_DIR/backend/node_modules/.bin/tsx"
    local -a runner
    if [ -x "$tsx_bin" ]; then
        runner=("$tsx_bin" backend/scripts/health-check.ts --no-email)
    else
        runner=(npx --yes tsx backend/scripts/health-check.ts --no-email)
    fi
    if command -v timeout >/dev/null 2>&1; then
        timeout "$CHECK_TIMEOUT_SECONDS" "${runner[@]}"
    else
        "${runner[@]}"
    fi
}

# What a run of the check means, from its exit code ($1) and output file ($2): healthy, outage (a real
# check failed) or monitor-problem (the check could not run). Only an outage counts towards a restart.
classify_health_exit() {
    case "$1" in
        0|3) echo healthy ;;
        1)
            if grep -q 'Health check FAILED' "$2" 2>/dev/null; then
                echo outage
            else
                echo monitor-problem
            fi
            ;;
        *) echo monitor-problem ;;
    esac
}

# A few words for the "could not run" mail.
describe_runner_exit() {
    case "$1" in
        1) echo "it failed without reporting a check result, as from a crash or a broken install" ;;
        2|4) echo "the check script reported an error of its own" ;;
        124) echo "it timed out after ${CHECK_TIMEOUT_SECONDS} seconds" ;;
        126|127) echo "tsx, npx or node could not be started" ;;
        137) echo "it was killed (possibly out of memory)" ;;
        *) echo "unexpected exit code" ;;
    esac
}

# Run health check
log "Running health check monitor"

if ! acquire_lock; then
    exit 0
fi
OUTPUT_FILE="$(mktemp "${TMPDIR:-/tmp}/health-monitor.XXXXXX" 2>/dev/null)"
RETEST_FILE="$(mktemp "${TMPDIR:-/tmp}/health-monitor.XXXXXX" 2>/dev/null)"
trap cleanup EXIT
trap 'exit 143' TERM INT
if [ -z "$OUTPUT_FILE" ] || [ -z "$RETEST_FILE" ]; then
    log "Cannot create a temporary file in ${TMPDIR:-/tmp}; the health check was not run"
    exit 2
fi

cd "$PROJECT_DIR" || exit 1

# Run the health check script
health_check_exit_code=0
run_health_check > "$OUTPUT_FILE" 2>&1 || health_check_exit_code=$?

health_check_class="$(classify_health_exit "$health_check_exit_code" "$OUTPUT_FILE")"

if [ "$health_check_class" = "healthy" ]; then
    log "Health check passed"
    reset_failure_count
    # A new outage must be reported straight away. (The could-not-run and warning cooldowns are only
    # cleared by time, so a check that flaps does not mail on every flap.)
    clear_alert_state outage-reported
    if [ "$health_check_exit_code" -eq 3 ]; then
        health_check_output=$(cat "$OUTPUT_FILE")
        log "Health check passed with warnings: $health_check_output"
        send_alert_limited warnings "$WARNING_COOLDOWN" "Health Check Warning - Performance Degraded" \
"The site is up, but the health check reported slow responses.

Output:
$health_check_output

Time: $(date)

This is sent at most once a day." || true
    fi
    ping_deadman
    exit "$(delivery_exit_code 0)"
elif [ "$health_check_class" = "monitor-problem" ]; then
    # The check could not run (for example tsx or node is missing, or it crashed). That says nothing about
    # the site, so it must not count towards a restart. Report it and leave the failure count alone.
    health_check_output=$(cat "$OUTPUT_FILE")
    health_check_reason="$(describe_runner_exit "$health_check_exit_code")"
    log "Health check could not run (exit code: $health_check_exit_code, $health_check_reason): $health_check_output"
    send_alert_limited "could-not-run-$health_check_exit_code" "$COULD_NOT_RUN_COOLDOWN" "Health Check Could Not Run" \
"The health check could not run (exit code $health_check_exit_code: $health_check_reason). This says nothing about the site, so services were not restarted.

Output:
$health_check_output

Time: $(date)

This is sent at most once every 6 hours for the same exit code." || true
    exit 2
else
    health_check_output=$(cat "$OUTPUT_FILE")

    log "Health check failed (exit code: $health_check_exit_code)"
    log "Output: $health_check_output"

    # Increment failure count, and make sure it was saved: if it cannot be, the restart threshold would
    # never be reached.
    failure_count=$(increment_failure_count)
    log "Failure count: $failure_count/$MAX_FAILURES"
    if [ "$(get_failure_count)" != "$failure_count" ]; then
        log "Warning: could not save the failure count in $HEALTH_CHECK_FAILURES; services will not be restarted automatically"
        send_alert_limited state-unwritable "$COULD_NOT_RUN_COOLDOWN" "Health Monitor Cannot Save Its State" \
"The health monitor could not write $HEALTH_CHECK_FAILURES, so it cannot count consecutive failures and will not restart services automatically until this is fixed.

Time: $(date)" || true
    fi

    # If failures exceed threshold, restart services
    if [ "$failure_count" -ge "$MAX_FAILURES" ]; then
        log "Failure threshold reached. Attempting to restart services..."

        # Get PM2 process status before restart
        pm2_status_before=$(pm2 jlist 2>&1 || echo "PM2 not available")

        # Reset the count first, so a run killed in the middle of the restart does not restart again at once.
        reset_failure_count

        # Restart PM2 processes
        restart_status=0
        pm2 restart all || restart_status=$?
        sleep 5

        # Get PM2 process status after restart
        pm2_status_after=$(pm2 jlist 2>&1 || echo "PM2 not available")

        if [ "$restart_status" -eq 0 ]; then
            restart_subject="Services Restarted Due to Health Check Failures"
            restart_note="Services have been automatically restarted."
            log "Services restarted."
        else
            restart_subject="Services Restart FAILED After Health Check Failures"
            restart_note="The automatic restart FAILED (pm2 restart all exited with status $restart_status), so the services may still be down."
            log "pm2 restart FAILED (exit code: $restart_status)"
        fi

        # Send alert
        send_alert "$restart_subject" \
"Health checks failed $MAX_FAILURES times consecutively. $restart_note

Last Health Check Output:
$health_check_output

PM2 Status Before Restart:
$pm2_status_before

PM2 Status After Restart:
$pm2_status_after

Time: $(date)

Please investigate the root cause of the failures." || true

        # Wait a bit and run health check again
        sleep 10
        retest_exit_code=0
        run_health_check > "$RETEST_FILE" 2>&1 || retest_exit_code=$?
        retest_class="$(classify_health_exit "$retest_exit_code" "$RETEST_FILE")"
        if [ "$retest_class" = "healthy" ]; then
            log "Health check passed after restart"
            clear_alert_state outage-reported
            ping_deadman
            exit "$(delivery_exit_code 0)"
        elif [ "$retest_class" = "monitor-problem" ]; then
            retest_output=$(cat "$RETEST_FILE")
            log "Health check could not run after restart (exit code: $retest_exit_code)"

            # Its own key: it is the only mail saying it is unknown whether the restart helped, so an
            # earlier "could not run" mail must not silence it.
            send_alert_limited "could-not-run-after-restart-$retest_exit_code" "$COULD_NOT_RUN_COOLDOWN" "Health Check Could Not Run After Restart" \
"Services were restarted, but the health check could not run afterwards (exit code $retest_exit_code: $(describe_runner_exit "$retest_exit_code")), so it is not known whether the site recovered.

Output:
$retest_output

Time: $(date)" || true
            exit 2
        else
            retest_output=$(cat "$RETEST_FILE")
            log "Health check still failing after restart"

            send_alert "CRITICAL: Services Still Failing After Restart" \
"Services were restarted but health checks are still failing.

Health Check Output After Restart:
$retest_output

Time: $(date)

IMMEDIATE INVESTIGATION REQUIRED." || true

            exit 1
        fi
    else
        # Not at threshold yet. Email the outage once; the restart mail (and, if the restart does not help,
        # the critical one) cover the rest, so the runs in between would only repeat it. "Once" means once
        # delivered: the mark is written only after mail accepted the message, so if the first mail could
        # not be sent, the next failing run tries again instead of staying silent (and an outage that ends
        # before the restart is still reported). The mark also expires after OUTAGE_REPORT_WINDOW, so one
        # left behind by a run that could not see the recovery cannot hide a later outage.
        if ! alert_due outage-reported "$OUTAGE_REPORT_WINDOW"; then
            log "ALERT SUPPRESSED (this outage was already emailed): Health Check Failed ($failure_count/$MAX_FAILURES)"
        else
            outage_mail_status=0
            send_alert "Health Check Failed ($failure_count/$MAX_FAILURES)" \
"Health check has failed $failure_count time(s). Services will be automatically restarted after $MAX_FAILURES consecutive failures.

Health Check Output:
$health_check_output

Time: $(date)

No further email is sent until the restart, if the failures continue." || outage_mail_status=$?
            if [ "$outage_mail_status" -eq 0 ]; then
                record_alert_sent outage-reported
            fi
        fi

        exit 1
    fi
fi
