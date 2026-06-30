#!/bin/bash
# Deploy Commission System to Staging Environment
# Usage: ./scripts/deploy-commission-system-staging.sh
# Prerequisites: 
#   - PostgreSQL client installed
#   - Staging DB credentials configured
#   - Backup directory exists

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/staging_backup_$TIMESTAMP.sql"
LOG_FILE="./logs/deployment_$TIMESTAMP.log"

# Check if running in correct directory
if [ ! -d "supabase/migrations" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# Create directories if not exist
mkdir -p "$BACKUP_DIR"
mkdir -p "./logs"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Commission System Deployment - STAGING${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Timestamp: $TIMESTAMP"
echo "Backup file: $BACKUP_FILE"
echo "Log file: $LOG_FILE"
echo ""

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check database connection
check_db_connection() {
    log "Checking database connection..."
    if ! psql "$STAGING_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${RED}Error: Cannot connect to staging database${NC}"
        exit 1
    fi
    log "Database connection OK"
}

# Function to create backup
backup_database() {
    log "Creating database backup..."
    echo -e "${YELLOW}Backing up staging database...${NC}"
    
    pg_dump "$STAGING_DB_URL" -Fc -f "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log "Backup created successfully: $BACKUP_FILE ($BACKUP_SIZE)"
        echo -e "${GREEN}✓ Backup created: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
    else
        echo -e "${RED}Error: Backup failed${NC}"
        exit 1
    fi
}

# Function to run migration
run_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file")
    
    log "Running migration: $migration_name"
    echo -e "${YELLOW}Executing: $migration_name${NC}"
    
    START_TIME=$(date +%s)
    psql "$STAGING_DB_URL" -f "$migration_file" >> "$LOG_FILE" 2>&1
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    if [ $? -eq 0 ]; then
        log "Migration completed in ${DURATION}s: $migration_name"
        echo -e "${GREEN}✓ Completed in ${DURATION}s${NC}"
    else
        log "ERROR: Migration failed: $migration_name"
        echo -e "${RED}✗ Migration failed: $migration_name${NC}"
        echo -e "${RED}Check log file: $LOG_FILE${NC}"
        exit 1
    fi
}

# Function to verify table exists
verify_table() {
    local table_name=$1
    log "Verifying table: $table_name"
    
    if psql "$STAGING_DB_URL" -c "\dt $table_name" | grep -q "$table_name"; then
        echo -e "${GREEN}✓ Table exists: $table_name${NC}"
        return 0
    else
        echo -e "${RED}✗ Table not found: $table_name${NC}"
        return 1
    fi
}

# Function to verify column exists
verify_column() {
    local table_name=$1
    local column_name=$2
    log "Verifying column: $table_name.$column_name"
    
    RESULT=$(psql "$STAGING_DB_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='$table_name' AND column_name='$column_name'")
    
    if [ -n "$RESULT" ]; then
        echo -e "${GREEN}✓ Column exists: $table_name.$column_name${NC}"
        return 0
    else
        echo -e "${RED}✗ Column not found: $table_name.$column_name${NC}"
        return 1
    fi
}

# Main deployment process
main() {
    log "=== Starting Commission System Deployment ==="
    
    # Step 1: Check database connection
    check_db_connection
    
    # Step 2: Create backup
    backup_database
    
    echo ""
    echo -e "${YELLOW}=== Running Migrations ===${NC}"
    echo ""
    
    # Step 3: Run migrations in order
    run_migration "supabase/migrations/20260615000000_create_booking_service_items.sql"
    run_migration "supabase/migrations/20260615100000_create_product_sales.sql"
    run_migration "supabase/migrations/20260615200000_create_salary_adjustments.sql"
    run_migration "supabase/migrations/20260616000000_extend_salary_records_commission.sql"
    run_migration "supabase/migrations/20260616100000_extend_users_position_tier.sql"
    run_migration "supabase/migrations/20260616200000_extend_tenants_commission_config.sql"
    
    echo ""
    echo -e "${YELLOW}=== Verification ===${NC}"
    echo ""
    
    # Step 4: Verify tables created
    log "Verifying new tables..."
    verify_table "booking_service_items"
    verify_table "product_sales"
    verify_table "salary_adjustments"
    
    # Step 5: Verify columns added
    log "Verifying new columns..."
    verify_column "salary_records" "service_commission_total"
    verify_column "salary_records" "product_sales_commission_total"
    verify_column "salary_records" "position_multiplier_bonus"
    verify_column "salary_records" "seniority_bonus"
    verify_column "salary_records" "manual_adjustments_total"
    verify_column "users" "position_tier"
    verify_column "users" "hire_date"
    verify_column "tenants" "commission_config"
    
    # Step 6: Check RLS policies
    log "Checking RLS policies..."
    echo -e "${YELLOW}Checking RLS policies...${NC}"
    POLICY_COUNT=$(psql "$STAGING_DB_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('booking_service_items', 'product_sales', 'salary_adjustments')")
    echo -e "${GREEN}✓ Found $POLICY_COUNT RLS policies${NC}"
    
    # Step 7: Check indexes
    log "Checking indexes..."
    echo -e "${YELLOW}Checking indexes...${NC}"
    INDEX_COUNT=$(psql "$STAGING_DB_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('booking_service_items', 'product_sales', 'salary_adjustments')")
    echo -e "${GREEN}✓ Found $INDEX_COUNT indexes${NC}"
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Backup: $BACKUP_FILE"
    echo "Log: $LOG_FILE"
    echo ""
    log "=== Deployment completed successfully ==="
}

# Run main function
main
