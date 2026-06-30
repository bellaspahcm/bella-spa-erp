#!/bin/bash
# Rollback Commission System Deployment
# Usage: ./scripts/rollback-commission-system.sh <backup_file>
# Example: ./scripts/rollback-commission-system.sh ./backups/staging_backup_20260622_143000.sql

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_FILE=$1
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="./logs/rollback_$TIMESTAMP.log"

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file required${NC}"
    echo "Usage: $0 <backup_file>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

echo -e "${RED}========================================${NC}"
echo -e "${RED}Commission System ROLLBACK${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}WARNING: This will restore database to backup${NC}"
echo -e "${YELLOW}All data after backup will be LOST${NC}"
echo ""
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (type 'YES' to confirm): " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo "Rollback cancelled"
    exit 0
fi

log "=== Starting rollback ==="

# Drop new tables (in reverse dependency order)
log "Dropping new tables..."
echo -e "${YELLOW}Dropping new tables...${NC}"

psql "$STAGING_DB_URL" -c "DROP TABLE IF EXISTS salary_adjustments CASCADE;" >> "$LOG_FILE" 2>&1
echo -e "${GREEN}✓ Dropped salary_adjustments${NC}"

psql "$STAGING_DB_URL" -c "DROP TABLE IF EXISTS product_sales CASCADE;" >> "$LOG_FILE" 2>&1
echo -e "${GREEN}✓ Dropped product_sales${NC}"

psql "$STAGING_DB_URL" -c "DROP TABLE IF EXISTS booking_service_items CASCADE;" >> "$LOG_FILE" 2>&1
echo -e "${GREEN}✓ Dropped booking_service_items${NC}"

# Restore from backup
log "Restoring from backup: $BACKUP_FILE"
echo -e "${YELLOW}Restoring from backup...${NC}"

pg_restore -d "$STAGING_DB_URL" --clean --if-exists "$BACKUP_FILE" >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
    log "Rollback completed successfully"
else
    echo -e "${RED}✗ Restore failed - check log: $LOG_FILE${NC}"
    log "ERROR: Restore failed"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Rollback completed${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Log: $LOG_FILE"
echo ""
