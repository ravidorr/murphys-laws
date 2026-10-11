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
log "Off-site copy: not configured (local integrity only)"
