#!/bin/bash

# ============================================================================
# Booking Engine Schema Deployment Script
# ============================================================================
# Usage:
#   ./scripts/deploy-booking-engine-schema.sh local    # Deploy to local
#   ./scripts/deploy-booking-engine-schema.sh staging  # Deploy to staging
#   ./scripts/deploy-booking-engine-schema.sh prod     # Deploy to production
# ============================================================================

set -e  # Exit on error

ENV=${1:-local}
MIGRATION_FILE="20260709140000_booking_engine_schema.sql"

echo "🚀 Booking Engine Schema Deployment"
echo "Environment: $ENV"
echo "Migration: $MIGRATION_FILE"
echo ""

# ============================================================================
# Functions
# ============================================================================

check_docker() {
  if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
  fi
  echo "✅ Docker is running"
}

check_supabase_cli() {
  if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Install: npm install -g supabase"
    exit 1
  fi
  echo "✅ Supabase CLI installed"
}

deploy_local() {
  echo ""
  echo "📦 Deploying to LOCAL..."
  echo ""
  
  # Check Docker
  check_docker
  
  # Start Supabase if not running
  echo "🔧 Starting Supabase local..."
  npx supabase start || true
  
  # Apply migration
  echo "📝 Applying migration..."
  npx supabase db push
  
  # Generate types
  echo "🔨 Generating TypeScript types..."
  npx supabase gen types typescript --local > src/types/supabase-generated.ts
  
  echo ""
  echo "✅ Local deployment complete!"
  echo ""
  echo "📊 Verify:"
  echo "  - Studio: http://localhost:54323"
  echo "  - API: http://localhost:54321"
  echo ""
}

deploy_staging() {
  echo ""
  echo "📦 Deploying to STAGING..."
  echo ""
  
  read -p "Enter Staging Project Ref: " PROJECT_REF
  
  if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project ref required"
    exit 1
  fi
  
  # Link project
  echo "🔗 Linking to staging project..."
  npx supabase link --project-ref "$PROJECT_REF"
  
  # Apply migration
  echo "📝 Applying migration..."
  npx supabase db push --project-ref "$PROJECT_REF"
  
  # Generate types
  echo "🔨 Generating TypeScript types..."
  npx supabase gen types typescript --project-ref "$PROJECT_REF" > src/types/supabase-generated.ts
  
  echo ""
  echo "✅ Staging deployment complete!"
  echo ""
}

deploy_prod() {
  echo ""
  echo "⚠️  PRODUCTION DEPLOYMENT"
  echo ""
  echo "This will deploy to PRODUCTION database."
  echo "Make sure you have:"
  echo "  1. Tested in local"
  echo "  2. Tested in staging"
  echo "  3. Created a backup"
  echo ""
  
  read -p "Type 'YES' to continue: " CONFIRM
  
  if [ "$CONFIRM" != "YES" ]; then
    echo "❌ Deployment cancelled"
    exit 0
  fi
  
  read -p "Enter Production Project Ref: " PROJECT_REF
  
  if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project ref required"
    exit 1
  fi
  
  # Link project
  echo "🔗 Linking to production project..."
  npx supabase link --project-ref "$PROJECT_REF"
  
  # Backup reminder
  echo ""
  echo "⚠️  BACKUP REMINDER"
  echo "Have you created a backup? (Dashboard > Settings > Database > Backups)"
  read -p "Type 'YES' to continue: " BACKUP_CONFIRM
  
  if [ "$BACKUP_CONFIRM" != "YES" ]; then
    echo "❌ Deployment cancelled. Please create backup first."
    exit 0
  fi
  
  # Apply migration
  echo "📝 Applying migration to PRODUCTION..."
  npx supabase db push --project-ref "$PROJECT_REF"
  
  # Generate types
  echo "🔨 Generating TypeScript types..."
  npx supabase gen types typescript --project-ref "$PROJECT_REF" > src/types/supabase-generated.ts
  
  echo ""
  echo "✅ Production deployment complete!"
  echo ""
  echo "📊 Next steps:"
  echo "  1. Verify tables in Supabase Dashboard"
  echo "  2. Run verification queries (see deployment guide)"
  echo "  3. Monitor logs for errors"
  echo "  4. Test basic queries"
  echo ""
}

verify_migration() {
  echo ""
  echo "🔍 Verifying migration..."
  echo ""
  
  # Check if migration file exists
  if [ ! -f "supabase/migrations/$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
  fi
  
  echo "✅ Migration file found"
  
  # Check file size
  FILE_SIZE=$(wc -c < "supabase/migrations/$MIGRATION_FILE")
  echo "📄 File size: $FILE_SIZE bytes"
  
  # Check SQL syntax (basic)
  if grep -q "CREATE TABLE" "supabase/migrations/$MIGRATION_FILE"; then
    echo "✅ Contains CREATE TABLE statements"
  else
    echo "⚠️  No CREATE TABLE statements found"
  fi
}

# ============================================================================
# Main
# ============================================================================

# Check prerequisites
check_supabase_cli

# Verify migration
verify_migration

# Deploy based on environment
case "$ENV" in
  local)
    deploy_local
    ;;
  staging)
    deploy_staging
    ;;
  prod|production)
    deploy_prod
    ;;
  *)
    echo "❌ Invalid environment: $ENV"
    echo "Usage: $0 [local|staging|prod]"
    exit 1
    ;;
esac

echo ""
echo "🎉 Done!"
echo ""
echo "📚 See docs/BOOKING_ENGINE_DEPLOYMENT_GUIDE.md for more details"
