#!/bin/bash
# Automated backup script for Murphy's Laws application
# Source of truth: backend/scripts/backup-murphys.sh (deployed to /usr/local/bin via deploy)

BACKUP_DIR="/root/backups"
DB_PATH="/root/murphys-laws/backend/murphys.db"
APP_DIR="/root/murphys-laws"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..."
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/murphys_db_$DATE.db'"

# Backup .env file (contains sensitive config)
cp $APP_DIR/.env $BACKUP_DIR/env_$DATE.bak 2>/dev/null || echo "No .env file found"

# Create tarball of application (exclude node_modules, logs, .git; restore runs npm install)
tar -czf $BACKUP_DIR/murphys_app_$DATE.tar.gz \
    -C /root \
    --exclude='murphys-laws/node_modules' \
    --exclude='murphys-laws/backend/node_modules' \
    --exclude='murphys-laws/web/node_modules' \
    --exclude='murphys-laws/logs' \
    --exclude='murphys-laws/.git' \
    murphys-laws

# Remove backups older than retention period (murphys_* and env_*)
find $BACKUP_DIR \( -name 'murphys_*' -o -name 'env_*' \) -mtime +$RETENTION_DAYS -delete

# Get backup size and count
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
BACKUP_COUNT=$(ls -1 $BACKUP_DIR | wc -l)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete. Total: $BACKUP_COUNT files, Size: $BACKUP_SIZE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Latest backup: $BACKUP_DIR/murphys_db_$DATE.db"
