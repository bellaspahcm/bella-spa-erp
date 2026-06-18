#!/bin/bash
# Migration Validation Script
# Usage: ./scripts/validate-migration.sh 20260618120000_add_phone.sql

set -e

MIGRATION_FILE=$1

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: ./scripts/validate-migration.sh <migration-file>"
  exit 1
fi

echo "🔍 Validating migration: $MIGRATION_FILE"

# Check file exists
if [ ! -f "supabase/migrations/$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: supabase/migrations/$MIGRATION_FILE"
  exit 1
fi

# Check for dangerous keywords
echo "Checking for dangerous operations..."
DANGEROUS_KEYWORDS=("DROP TABLE" "DROP DATABASE" "TRUNCATE" "DELETE FROM" "DROP SCHEMA")
for keyword in "${DANGEROUS_KEYWORDS[@]}"; do
  if grep -qi "$keyword" "supabase/migrations/$MIGRATION_FILE"; then
    echo "⚠️  Found dangerous keyword: $keyword"
    echo "   This operation is destructive and may cause data loss."
    echo "   Are you sure you want to proceed? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
      echo "❌ Migration validation cancelled"
      exit 1
    fi
  fi
done

# Check for NOT NULL without DEFAULT
echo "Checking for NOT NULL constraints..."
if grep -qi "ALTER COLUMN.*NOT NULL" "supabase/migrations/$MIGRATION_FILE"; then
  if ! grep -B5 "ALTER COLUMN.*NOT NULL" "supabase/migrations/$MIGRATION_FILE" | grep -qi "DEFAULT"; then
    echo "❌ Found NOT NULL constraint without DEFAULT value"
    echo "   This will fail if table has existing rows."
    echo "   Add DEFAULT value or backfill data first."
    exit 1
  fi
fi

# Check for transaction wrapping
echo "Checking for transaction wrapping..."
if ! grep -qi "BEGIN;" "supabase/migrations/$MIGRATION_FILE"; then
  echo "⚠️  Migration not wrapped in BEGIN/COMMIT transaction"
  echo "   Consider wrapping in transaction for atomicity."
fi

# Check for rollback documentation
echo "Checking for rollback procedure..."
if ! grep -qi "ROLLBACK" "supabase/migrations/$MIGRATION_FILE"; then
  echo "⚠️  No rollback procedure documented"
  echo "   Consider adding rollback steps in comments."
fi

# Syntax check (if psql available)
if command -v psql &> /dev/null; then
  echo "Running PostgreSQL syntax check..."
  psql --set ON_ERROR_STOP=1 --quiet --file="supabase/migrations/$MIGRATION_FILE" --dry-run 2>&1 | head -n 5
fi

echo "✅ Migration validation completed"
echo ""
echo "Next steps:"
echo "1. Test migration on local database: supabase db reset && supabase db push"
echo "2. Verify old code still works (backward compatibility)"
echo "3. Deploy to staging: supabase db push --db-url \$STAGING_DATABASE_URL"
echo "4. Run E2E tests: npm run test:e2e:staging"
echo "5. Deploy to production (with backup!)"
