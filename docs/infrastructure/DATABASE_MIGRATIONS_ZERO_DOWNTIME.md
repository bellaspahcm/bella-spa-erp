# Database Migrations - Zero Downtime Strategy

## Overview

Bella ERP thực hiện database migrations với **zero downtime** bằng cách:
1. **Backward-compatible migrations** - Old code vẫn chạy được với new schema
2. **Blue-green deployments** - Deploy code mới sau khi migrate
3. **Rollback-safe** - Có thể rollback code mà không break database

## Migration Workflow

### Standard Migration Process

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Prepare Migration (Backward Compatible)            │
├─────────────────────────────────────────────────────────────┤
│ 1. Write migration SQL                                       │
│ 2. Test locally với old code                                │
│ 3. Test rollback procedure                                   │
│ 4. Review by team lead                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Run Migration on Database                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Create backup snapshot                                    │
│ 2. Run migration in transaction                              │
│ 3. Verify schema changes                                     │
│ 4. Old code still works (backward compatible)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Deploy New Code                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Deploy application code using new schema                 │
│ 2. Run smoke tests                                           │
│ 3. Monitor for errors                                        │
│ 4. Rollback if issues detected                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Cleanup (Optional)                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Remove old columns/tables (after 1 week)                 │
│ 2. Drop backward compatibility code                          │
│ 3. Archive migration logs                                    │
└─────────────────────────────────────────────────────────────┘
```

## Backward-Compatible Patterns

### ✅ Pattern 1: Adding New Column

**Safe Migration:**
```sql
-- Migration: 20260618_add_phone_to_customers.sql
BEGIN;

-- Add column with default value (backward compatible)
ALTER TABLE customers
ADD COLUMN phone VARCHAR(20) DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customers_phone 
ON customers(phone);

-- Update RLS policy if needed
-- (existing queries still work)

COMMIT;
```

**Old Code (still works):**
```typescript
// Doesn't know about 'phone' column - no problem
const { data } = await supabase
  .from('customers')
  .select('id, name, email')
  .eq('id', customerId);
```

**New Code (uses new column):**
```typescript
const { data } = await supabase
  .from('customers')
  .select('id, name, email, phone') // Now includes phone
  .eq('id', customerId);
```

### ✅ Pattern 2: Renaming Column (Multi-Step)

**Step 1 Migration - Add new column:**
```sql
-- Migration: 20260618_01_add_full_name_column.sql
BEGIN;

-- Add new column
ALTER TABLE staff
ADD COLUMN full_name VARCHAR(255);

-- Backfill data from old column
UPDATE staff
SET full_name = name
WHERE full_name IS NULL;

-- NOT NULL constraint will be added in Step 3

COMMIT;
```

**Step 2 Code - Write to both columns:**
```typescript
// Update old and new code to write to BOTH columns
await supabase
  .from('staff')
  .insert({
    name: fullName,      // Old column
    full_name: fullName, // New column
  });
```

**Deploy Step 2, wait 24 hours**

**Step 3 Migration - Drop old column:**
```sql
-- Migration: 20260618_03_drop_name_column.sql
BEGIN;

-- Now safe to drop old column
ALTER TABLE staff
DROP COLUMN name;

-- Add NOT NULL constraint
ALTER TABLE staff
ALTER COLUMN full_name SET NOT NULL;

COMMIT;
```

**Step 4 Code - Use only new column:**
```typescript
await supabase
  .from('staff')
  .insert({
    full_name: fullName, // Only new column
  });
```

### ❌ Pattern 3: Breaking Changes (AVOID)

**Unsafe Migration (causes downtime):**
```sql
-- ❌ DON'T DO THIS
ALTER TABLE bookings
DROP COLUMN status; -- Old code breaks immediately!

ALTER TABLE bookings
ADD COLUMN status_id INTEGER NOT NULL; -- Can't add NOT NULL without default
```

**Why it breaks:**
1. Old code still running tries to query `status` column
2. Column doesn't exist → SQL error
3. All booking queries fail → **DOWNTIME**

## Migration File Structure

### Supabase Migrations

**Location:** `supabase/migrations/`

**Naming Convention:**
```
20260618120000_descriptive_name.sql
├─ Timestamp: YYYYMMDDHHmmss (sortable)
└─ Description: what_the_migration_does
```

**Example:**
```
supabase/migrations/
├── 20260618120000_add_phone_to_customers.sql
├── 20260618130000_add_sessions_package_multiplier.sql
├── 20260618140000_add_salary_records_decimal_sessions.sql
└── 20260618150000_create_api_gateway_tables.sql
```

### Migration Template

```sql
-- Migration: [Descriptive Name]
-- Created: 2026-06-18
-- Author: Developer Name
-- Description: What this migration does
-- Backward Compatible: YES/NO
-- Rollback: See rollback procedure below

BEGIN;

-- ============================================================================
-- STEP 1: Schema Changes
-- ============================================================================

-- Add your DDL here
ALTER TABLE example_table
ADD COLUMN example_column VARCHAR(255) DEFAULT NULL;

-- ============================================================================
-- STEP 2: Data Backfill (if needed)
-- ============================================================================

-- Update existing rows
UPDATE example_table
SET example_column = 'default_value'
WHERE example_column IS NULL;

-- ============================================================================
-- STEP 3: Indexes & Constraints
-- ============================================================================

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_example_column
ON example_table(example_column);

-- Add constraints (only if backward compatible)
-- ALTER TABLE example_table
-- ALTER COLUMN example_column SET NOT NULL; -- Do this in separate migration

-- ============================================================================
-- STEP 4: RLS Policies (if needed)
-- ============================================================================

-- Update Row Level Security policies
-- DROP POLICY IF EXISTS old_policy ON example_table;
-- CREATE POLICY new_policy ON example_table
--   FOR ALL
--   USING (tenant_id = auth.uid());

-- ============================================================================
-- STEP 5: Functions & Triggers (if needed)
-- ============================================================================

-- Create or replace functions
CREATE OR REPLACE FUNCTION example_function()
RETURNS TRIGGER AS $$
BEGIN
  -- Function logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================
-- To rollback this migration:
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_example_column;
-- ALTER TABLE example_table DROP COLUMN example_column;
-- COMMIT;
--
-- Note: Data loss may occur if column is dropped
-- ============================================================================
```

## Running Migrations

### Local Development

```bash
# Link to Supabase project
supabase link --project-ref bella-erp-staging

# Create new migration
supabase migration new add_phone_to_customers

# Edit the migration file
# supabase/migrations/YYYYMMDD_add_phone_to_customers.sql

# Run migration locally
supabase db push

# Verify schema
supabase db diff
```

### Staging Environment

```bash
# Push to staging database
supabase db push --db-url $STAGING_DATABASE_URL

# Verify migration succeeded
supabase db remote commit
```

### Production Environment

**Manual Process (Safer):**

1. **Create backup:**
```bash
# Supabase Dashboard → Database → Backups → Create Backup
```

2. **Test migration on staging:**
```bash
supabase db push --db-url $STAGING_DATABASE_URL
```

3. **Run smoke tests on staging:**
```bash
npm run test:e2e:staging
```

4. **Apply to production:**
```bash
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

5. **Verify production:**
```bash
curl https://bella-erp.com/api/health
```

6. **Monitor errors for 15 minutes**

## Pre-Deployment Validation

### Migration Checklist

Run this script before deploying:

**`scripts/validate-migration.sh`:**
```bash
#!/bin/bash
set -e

echo "🔍 Validating migration..."

# 1. Check migration file exists
if [ ! -f "supabase/migrations/$1" ]; then
  echo "❌ Migration file not found: $1"
  exit 1
fi

# 2. Check for dangerous keywords
DANGEROUS_KEYWORDS=("DROP TABLE" "DROP COLUMN" "TRUNCATE" "DELETE FROM")
for keyword in "${DANGEROUS_KEYWORDS[@]}"; do
  if grep -qi "$keyword" "supabase/migrations/$1"; then
    echo "⚠️  Found dangerous keyword: $keyword"
    echo "Are you sure? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
      exit 1
    fi
  fi
done

# 3. Check for NOT NULL without DEFAULT
if grep -qi "ALTER COLUMN.*NOT NULL" "supabase/migrations/$1"; then
  if ! grep -qi "DEFAULT" "supabase/migrations/$1"; then
    echo "❌ NOT NULL constraint without DEFAULT value"
    exit 1
  fi
fi

# 4. Check for transaction wrapping
if ! grep -qi "BEGIN;" "supabase/migrations/$1"; then
  echo "⚠️  Migration not wrapped in transaction"
fi

echo "✅ Migration validation passed"
```

**Usage:**
```bash
./scripts/validate-migration.sh 20260618120000_add_phone.sql
```

## Rollback Procedures

### Automatic Rollback

**If migration fails during transaction:**
```sql
BEGIN;
ALTER TABLE customers ADD COLUMN invalid_syntax; -- Syntax error
-- Automatic ROLLBACK, no changes applied
COMMIT;
```

### Manual Rollback

**1. Identify deployed version:**
```bash
# Check current migration version
supabase db version

# Output: 20260618120000
```

**2. Revert to previous version:**
```sql
-- Create rollback migration
-- supabase/migrations/20260618130000_rollback_add_phone.sql

BEGIN;

-- Reverse the changes
DROP INDEX IF EXISTS idx_customers_phone;
ALTER TABLE customers DROP COLUMN phone;

COMMIT;
```

**3. Deploy rollback code:**
```bash
# Revert application code first
git revert HEAD
git push origin main

# Then rollback database
supabase db push --db-url $PRODUCTION_DATABASE_URL
```

### Code-Only Rollback (No DB Rollback)

**If migration is backward compatible:**
```bash
# Just rollback code, keep new database schema
git revert HEAD
git push origin main

# Database schema stays, old code still works
```

## Common Migration Scenarios

### Scenario 1: Add Optional Field

```sql
-- ✅ Safe - backward compatible
ALTER TABLE bookings
ADD COLUMN notes TEXT DEFAULT NULL;
```

**Deploy order:** Migration → Code (any order)

### Scenario 2: Add Required Field

```sql
-- Step 1: Add optional column
ALTER TABLE bookings
ADD COLUMN customer_phone VARCHAR(20) DEFAULT NULL;

-- Step 2: Backfill data
UPDATE bookings
SET customer_phone = (
  SELECT phone FROM customers WHERE customers.id = bookings.customer_id
);

-- Step 3: Make required (separate migration)
ALTER TABLE bookings
ALTER COLUMN customer_phone SET NOT NULL;
```

**Deploy order:** Migration 1 → Migration 2 → Code

### Scenario 3: Change Column Type

```sql
-- Step 1: Add new column with new type
ALTER TABLE salary_records
ADD COLUMN total_sessions_new NUMERIC(5,2) DEFAULT 0;

-- Step 2: Backfill
UPDATE salary_records
SET total_sessions_new = total_sessions::NUMERIC(5,2);

-- Step 3: Drop old column (separate migration after code deployed)
ALTER TABLE salary_records
DROP COLUMN total_sessions;

ALTER TABLE salary_records
RENAME COLUMN total_sessions_new TO total_sessions;
```

**Deploy order:** Migration 1 → Code (write to both) → Migration 2

### Scenario 4: Delete Table

```sql
-- Step 1: Stop writing to table (deploy code)
-- Step 2: Wait 1 week (verify no errors)
-- Step 3: Drop table

BEGIN;

-- Backup data first
CREATE TABLE archived_old_table AS
SELECT * FROM old_table;

-- Then drop
DROP TABLE old_table;

COMMIT;
```

**Deploy order:** Code (stop writes) → Wait → Migration (drop table)

## Monitoring Migrations

### Track Migration Status

**`src/app/api/admin/migrations/route.ts`:**
```typescript
export async function GET() {
  const db = getPrimaryClient();
  
  // Query Supabase migration history
  const { data } = await db
    .from('supabase_migrations')
    .select('*')
    .order('version', { ascending: false })
    .limit(10);

  return NextResponse.json(data);
}
```

### Alert on Migration Failures

```typescript
// Add to CI/CD workflow
if (migrationFailed) {
  await sendSlackAlert({
    text: '🚨 Database migration failed in production!',
    details: {
      migration: migrationFile,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    },
  });
}
```

## Best Practices

### ✅ DO:

1. **Always wrap in transaction**
2. **Add DEFAULT values for new NOT NULL columns**
3. **Test rollback procedure locally**
4. **Create backup before production migration**
5. **Use multi-step migrations for breaking changes**
6. **Document rollback steps in migration file**

### ❌ DON'T:

1. **Don't add NOT NULL without DEFAULT on existing tables**
2. **Don't DROP columns used by production code**
3. **Don't RENAME columns without multi-step process**
4. **Don't run migrations during peak hours**
5. **Don't skip testing on staging**
6. **Don't forget to update TypeScript types**

## Emergency Procedures

### Database Locked (Migration Running Too Long)

**Symptoms:**
- All queries timing out
- Migration still running after 5+ minutes

**Solution:**
```sql
-- Find blocking query
SELECT pid, query, state, wait_event
FROM pg_stat_activity
WHERE state = 'active';

-- Kill migration transaction (last resort)
SELECT pg_terminate_backend(12345); -- Use pid from above

-- ROLLBACK happens automatically
```

### Data Corruption After Migration

**Symptoms:**
- Query errors mentioning missing columns
- Data integrity violations

**Solution:**
1. **Immediate rollback:**
```bash
supabase db reset --db-url $PRODUCTION_DATABASE_URL
supabase db push --db-url $PRODUCTION_DATABASE_URL [previous-version]
```

2. **Restore from backup:**
```bash
# Supabase Dashboard → Backups → Restore [timestamp]
```

3. **Replay recent transactions (if available):**
```sql
-- Check accounting_outbox for pending entries
SELECT * FROM pending_accounting_entries
WHERE created_at > '2026-06-18 12:00:00';
```

## References

- [Supabase Migrations Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Zero-Downtime Deployments](https://www.brunton-spall.co.uk/post/2014/05/06/database-migrations-done-right/)
