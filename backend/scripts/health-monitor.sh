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
COULD_NOT_RUN_COOLDOWN=21600  # at most one "could not run" mail per cause every 6 hours
WARNING_COOLDOWN=86400        # at most one slow-site warning mail a day

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

# Get current failure count
get_failure_count() {
    if [ -f "$HEALTH_CHECK_FAILURES" ]; then
        cat "$HEALTH_CHECK_FAILURES"
    else
        echo "0"
    fi
}

# Increment failure count
increment_failure_count() {
    local count=$(get_failure_count)
    count=$((count + 1))
    echo "$count" > "$HEALTH_CHECK_FAILURES"
    echo "$count"
}

# Reset failure count
reset_failure_count() {
    echo "0" > "$HEALTH_CHECK_FAILURES"
}

# Cooldowns for mails that would otherwise repeat on every 5-minute run. A state file holds the time the
# last mail for a key was accepted; it is written only after that, so a mail that could not be sent does
# not hide the next attempt.
alert_due() {
    local file="$ALERT_STATE_DIR/$1" last now
    [ -f "$file" ] || return 0
    last="$(cat "$file" 2>/dev/null)"
    [[ "$last" =~ ^[0-9]+$ ]] || return 0
    now="$(date +%s)"
    [ $((now - last)) -ge "$2" ]
}

record_alert_sent() {
    mkdir -p "$ALERT_STATE_DIR" && date +%s > "$ALERT_STATE_DIR/$1" \
        || log "Warning: could not record the alert time in $ALERT_STATE_DIR (it may repeat on every run)"
}

# Forgets the cooldown of every key starting with $1, so the next occurrence is reported straight away.
clear_alert_state() {
    rm -f "$ALERT_STATE_DIR/$1"* 2>/dev/null
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

# Runs the TypeScript health check, preferring the locally installed tsx (deploys run `npm ci` in backend/).
# It runs with --no-email: this script is the only sender, so one run sends at most one mail and SMTP
# settings cannot stop the checks. Exit codes: 0 healthy, 1 a check failed, 3 healthy but with warnings
# (slow responses). Anything else (2, 126/127 when tsx, npx or node cannot be started, 137 when it is killed,
# ...) means the check itself could not run, which says nothing about the site.
run_health_check() {
    local tsx_bin="$PROJECT_DIR/backend/node_modules/.bin/tsx"
    if [ -x "$tsx_bin" ]; then
        "$tsx_bin" backend/scripts/health-check.ts --no-email
    else
        npx --yes tsx backend/scripts/health-check.ts --no-email
    fi
}

# What an exit code from run_health_check means: healthy, outage (a real check failed) or monitor-problem
# (the check could not run or is misconfigured). Only an outage counts towards a restart.
classify_health_exit() {
    case "$1" in
        0|3) echo healthy ;;
        1) echo outage ;;
        *) echo monitor-problem ;;
    esac
}

# Run health check
log "Running health check monitor"

cd "$PROJECT_DIR" || exit 1

# Run the health check script
health_check_exit_code=0
run_health_check > /tmp/health-check-output.txt 2>&1 || health_check_exit_code=$?

health_check_class="$(classify_health_exit "$health_check_exit_code")"

if [ "$health_check_class" = "healthy" ]; then
    log "Health check passed"
    reset_failure_count
    clear_alert_state could-not-run
    clear_alert_state outage-reported
    if [ "$health_check_exit_code" -eq 3 ]; then
        health_check_output=$(cat /tmp/health-check-output.txt)
        log "Health check passed with warnings: $health_check_output"
        send_alert_limited warnings "$WARNING_COOLDOWN" "Health Check Warning - Performance Degraded" \
"The site is up, but the health check reported slow responses.

Output:
$health_check_output

Time: $(date)

This is sent at most once a day." || true
    else
        clear_alert_state warnings
    fi
    ping_deadman
    exit "$(delivery_exit_code 0)"
elif [ "$health_check_class" = "monitor-problem" ]; then
    # The check is misconfigured (exit 2) or could not be started at all (for example tsx or node is
    # missing). That says nothing about the site, so it must not count towards a restart. Report it and
    # leave the failure count alone.
    health_check_output=$(cat /tmp/health-check-output.txt)
    log "Health check could not run (exit code: $health_check_exit_code): $health_check_output"
    send_alert_limited "could-not-run-$health_check_exit_code" "$COULD_NOT_RUN_COOLDOWN" "Health Check Could Not Run" \
"The health check could not run (exit code $health_check_exit_code), either because it is misconfigured or because tsx or node could not be started. This says nothing about the site, so services were not restarted.

Output:
$health_check_output

Time: $(date)

This is sent at most once every 6 hours for the same exit code." || true
    exit 2
else
    health_check_output=$(cat /tmp/health-check-output.txt)

    log "Health check failed (exit code: $health_check_exit_code)"
    log "Output: $health_check_output"

    # Increment failure count
    failure_count=$(increment_failure_count)
    log "Failure count: $failure_count/$MAX_FAILURES"

    # If failures exceed threshold, restart services
    if [ "$failure_count" -ge "$MAX_FAILURES" ]; then
        log "Failure threshold reached. Attempting to restart services..."

        # Get PM2 process status before restart
        pm2_status_before=$(pm2 jlist 2>&1 || echo "PM2 not available")

        # Restart PM2 processes
        pm2 restart all
        sleep 5

        # Get PM2 process status after restart
        pm2_status_after=$(pm2 jlist 2>&1 || echo "PM2 not available")

        # Reset failure count
        reset_failure_count

        # Send alert
        send_alert "Services Restarted Due to Health Check Failures" \
"Health checks failed $MAX_FAILURES times consecutively. Services have been automatically restarted.

Last Health Check Output:
$health_check_output

PM2 Status Before Restart:
$pm2_status_before

PM2 Status After Restart:
$pm2_status_after

Time: $(date)

Please investigate the root cause of the failures."

        log "Services restarted."

        # Wait a bit and run health check again
        sleep 10
        retest_exit_code=0
        run_health_check > /tmp/health-check-retest.txt 2>&1 || retest_exit_code=$?
        retest_class="$(classify_health_exit "$retest_exit_code")"
        if [ "$retest_class" = "healthy" ]; then
            log "Health check passed after restart"
            clear_alert_state outage-reported
            ping_deadman
            exit "$(delivery_exit_code 0)"
        elif [ "$retest_class" = "monitor-problem" ]; then
            retest_output=$(cat /tmp/health-check-retest.txt)
            log "Health check could not run after restart (exit code: $retest_exit_code)"

            send_alert_limited "could-not-run-$retest_exit_code" "$COULD_NOT_RUN_COOLDOWN" "Health Check Could Not Run After Restart" \
"Services were restarted, but the health check could not run afterwards (exit code $retest_exit_code), so it is not known whether the site recovered.

Output:
$retest_output

Time: $(date)" || true
            exit 2
        else
            retest_output=$(cat /tmp/health-check-retest.txt)
            log "Health check still failing after restart"

            send_alert "CRITICAL: Services Still Failing After Restart" \
"Services were restarted but health checks are still failing.

Health Check Output After Restart:
$retest_output

Time: $(date)

IMMEDIATE INVESTIGATION REQUIRED."

            exit 1
        fi
    else
        # Not at threshold yet. Email the outage once; the restart mail (and, if the restart does not help,
        # the critical one) cover the rest, so the runs in between would only repeat it. "Once" means once
        # delivered: the mark is written only after mail accepted the message, so if the first mail could
        # not be sent, the next failing run tries again instead of staying silent (and an outage that ends
        # before the restart is still reported).
        if [ -f "$ALERT_STATE_DIR/outage-reported" ]; then
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
