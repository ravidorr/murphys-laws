#!/bin/bash
# Automated backup script for Murphy's Laws application
# Source of truth: backend/scripts/backup-murphys.sh (deployed to /usr/local/bin via deploy)

set -euo pipefail

BACKUP_DIR="/root/backups"
DB_PATH="/root/murphys-laws/backend/murphys.db"
APP_DIR="/root/murphys-laws"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

fail() {
    log "ERROR: $1"
    exit 1
}

log "Starting backup..."

DB_BACKUP="$BACKUP_DIR/murphys_db_$DATE.db"
if ! sqlite3 "$DB_PATH" ".backup '$DB_BACKUP'"; then
    fail "SQLite backup failed for $DB_PATH"
fi

INTEGRITY=$(sqlite3 "$DB_BACKUP" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" != "ok" ]; then
    rm -f "$DB_BACKUP"
    fail "Backup integrity check failed: $INTEGRITY"
fi

ENV_BACKUP="$BACKUP_DIR/env_$DATE.bak"
if [ -f "$APP_DIR/backend/.env" ]; then
    if ! cp "$APP_DIR/backend/.env" "$ENV_BACKUP"; then
        rm -f "$DB_BACKUP"
        fail "Failed to copy .env to $ENV_BACKUP"
    fi
else
    log "No .env file found (skipped env backup)"
fi

# NOTE: App code is in git — no tarball needed. Recovery = git pull + npm install + restore DB.

find "$BACKUP_DIR" \( -name 'murphys_db_*' -o -name 'env_*' \) -mtime +"$RETENTION_DAYS" -delete

BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type f | wc -l)

log "Backup complete. Total: $BACKUP_COUNT files, Size: $BACKUP_SIZE"
log "Latest database backup: $DB_BACKUP (integrity ok)"
if [ -f "$ENV_BACKUP" ]; then
    log "Latest env backup: $ENV_BACKUP"
fi

#############################################################################
# Off-site copy: encrypted with GPG and sent to a Backblaze B2 bucket (see backup-offsite.sh and
# shared/docs/BACKUP-RESTORE.md). The local backup above is already done, so a failure here fails the run
# and sends an alert without losing it.
#############################################################################

_self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"

# Best effort: emails the failure when the shared alert helper and a recipient are available. It runs in a
# subshell, so nothing the helper does can end this script before offsite_fail has logged and exited.
alert_offsite_failure() {
    local message="$1" alert_helper
    alert_helper="$(dirname "$_self")/alert-email.sh"
    [ -f "$alert_helper" ] || alert_helper="$APP_DIR/backend/scripts/alert-email.sh"
    if [ ! -f "$alert_helper" ]; then
        log "Alert email was not sent (alert-email.sh not found)"
        return 0
    fi
    if ! (
        source "$alert_helper"
        ALERT_EMAIL="$(resolve_alert_email)"
        echo "$message" | send_alert_mail "[Murphy's Laws] Off-site backup FAILED"
    ); then
        log "Alert email was not sent"
    fi
}

offsite_fail() {
    log "ERROR: Off-site copy: FAILED ($1)"
    alert_offsite_failure "The local backup $DATE succeeded, but the off-site copy failed: $1. Check /var/log/backup-murphys.log on the main droplet."
    exit 1
}

OFFSITE_HELPER="$(dirname "$_self")/backup-offsite.sh"
[ -f "$OFFSITE_HELPER" ] || OFFSITE_HELPER="$APP_DIR/backend/scripts/backup-offsite.sh"
if [ ! -f "$OFFSITE_HELPER" ] || ! source "$OFFSITE_HELPER"; then
    offsite_fail "cannot load backup-offsite.sh (looked beside $0 and under $APP_DIR/backend/scripts)"
fi

OFFSITE_STATUS=0
offsite_load_config || OFFSITE_STATUS=$?
case "$OFFSITE_STATUS" in
    0)
        offsite_upload db "$DB_BACKUP" || offsite_fail "upload of $(basename "$DB_BACKUP") failed"
        if [ -f "$ENV_BACKUP" ]; then
            offsite_upload env "$ENV_BACKUP" || offsite_fail "upload of $(basename "$ENV_BACKUP") failed"
        fi
        offsite_prune db "$RETENTION_DAYS" || offsite_fail "pruning old database copies failed"
        offsite_prune env "$RETENTION_DAYS" || offsite_fail "pruning old env copies failed"
        log "Off-site copy: ok (encrypted, $OFFSITE_REMOTE, retention $RETENTION_DAYS days, pruning by $OFFSITE_PRUNE)"
        ;;
    1)
        log "Off-site copy: not configured (local integrity only)"
        ;;
    *)
        offsite_fail "$OFFSITE_ERROR"
        ;;
esac
