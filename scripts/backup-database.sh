#!/bin/bash
# Decision Engine Database Backup Script
# 
# Backs up critical Decision Engine tables to local storage and optionally S3.
# Run daily via cron: 0 2 * * * /path/to/backup-database.sh
# 
# Environment variables required:
#   - SUPABASE_PROJECT_ID (your Supabase project ID)
#   - SUPABASE_DB_PASSWORD (PostgreSQL password)
#   - AWS_S3_BUCKET (optional, for S3 upload)

set -e

BACKUP_DIR="${BACKUP_DIR:-/var/backups/bella-spa}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-your-project-id}"
SUPABASE_DB_HOST="db.${SUPABASE_PROJECT_ID}.supabase.co"

echo "[Backup] Starting Decision Engine database backup at $TIMESTAMP"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Backup Decision Engine tables
echo "[Backup] Dumping Decision Engine tables..."
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
  -h "$SUPABASE_DB_HOST" \
  -U postgres \
  -d postgres \
  -t policy_registry \
  -t decision_audit_logs \
  -t decision_metrics \
  -t rule_version_history \
  -t workflow_definitions \
  -t workflow_executions \
  -F c \
  -f "$BACKUP_DIR/decision_engine_$TIMESTAMP.dump"

BACKUP_FILE="$BACKUP_DIR/decision_engine_$TIMESTAMP.dump"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "[Backup] ✅ Backup completed: decision_engine_$TIMESTAMP.dump ($BACKUP_SIZE)"

# Verify backup file
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[Backup] ❌ ERROR: Backup file not created!"
  exit 1
fi

# Keep only last 7 days of backups
echo "[Backup] Cleaning up old backups (>7 days)..."
find "$BACKUP_DIR" -name "decision_engine_*.dump" -mtime +7 -delete
REMAINING=$(find "$BACKUP_DIR" -name "decision_engine_*.dump" | wc -l)
echo "[Backup] Remaining backups: $REMAINING"

# Upload to S3 (optional)
if [ -n "$AWS_S3_BUCKET" ]; then
  echo "[Backup] Uploading to S3..."
  aws s3 cp "$BACKUP_FILE" \
    "s3://$AWS_S3_BUCKET/decision-engine/" \
    --storage-class STANDARD_IA
  echo "[Backup] ✅ Uploaded to s3://$AWS_S3_BUCKET/decision-engine/"
fi

echo "[Backup] All done!"
echo "[Backup] Backup location: $BACKUP_FILE"
echo "[Backup] Restore command:"
echo "  PGPASSWORD=\$SUPABASE_DB_PASSWORD pg_restore -h $SUPABASE_DB_HOST -U postgres -d postgres -c $BACKUP_FILE"

exit 0
