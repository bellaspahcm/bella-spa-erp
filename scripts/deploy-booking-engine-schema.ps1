# ============================================================================
# Booking Engine Schema Deployment Script (PowerShell)
# ============================================================================
# Usage:
#   .\scripts\deploy-booking-engine-schema.ps1 local    # Deploy to local
#   .\scripts\deploy-booking-engine-schema.ps1 staging  # Deploy to staging
#   .\scripts\deploy-booking-engine-schema.ps1 prod     # Deploy to production
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('local', 'staging', 'prod')]
    [string]$Environment = 'local'
)

$ErrorActionPreference = "Stop"
$MigrationFile = "20260709140000_booking_engine_schema.sql"

Write-Host "🚀 Booking Engine Schema Deployment" -ForegroundColor Cyan
Write-Host "Environment: $Environment"
Write-Host "Migration: $MigrationFile"
Write-Host ""

# ============================================================================
# Functions
# ============================================================================

function Check-Docker {
    try {
        docker info 2>&1 | Out-Null
        Write-Host "✅ Docker is running" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Docker is not running!" -ForegroundColor Red
        Write-Host "Please start Docker Desktop and try again."
        exit 1
    }
}

function Check-SupabaseCLI {
    try {
        npx supabase --version 2>&1 | Out-Null
        Write-Host "✅ Supabase CLI available" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
        Write-Host "Install: npm install -g supabase"
        exit 1
    }
}

function Deploy-Local {
    Write-Host ""
    Write-Host "📦 Deploying to LOCAL..." -ForegroundColor Yellow
    Write-Host ""
    
    # Check Docker
    Check-Docker
    
    # Start Supabase if not running
    Write-Host "🔧 Starting Supabase local..."
    try {
        npx supabase start
    }
    catch {
        Write-Host "ℹ️  Supabase already running or error starting"
    }
    
    # Apply migration
    Write-Host "📝 Applying migration..."
    npx supabase db push
    
    # Generate types
    Write-Host "🔨 Generating TypeScript types..."
    npx supabase gen types typescript --local > src/types/supabase-generated.ts
    
    Write-Host ""
    Write-Host "✅ Local deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Verify:"
    Write-Host "  - Studio: http://localhost:54323"
    Write-Host "  - API: http://localhost:54321"
    Write-Host ""
}

function Deploy-Staging {
    Write-Host ""
    Write-Host "📦 Deploying to STAGING..." -ForegroundColor Yellow
    Write-Host ""
    
    $ProjectRef = Read-Host "Enter Staging Project Ref"
    
    if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
        Write-Host "❌ Project ref required" -ForegroundColor Red
        exit 1
    }
    
    # Link project
    Write-Host "🔗 Linking to staging project..."
    npx supabase link --project-ref $ProjectRef
    
    # Apply migration
    Write-Host "📝 Applying migration..."
    npx supabase db push --project-ref $ProjectRef
    
    # Generate types
    Write-Host "🔨 Generating TypeScript types..."
    npx supabase gen types typescript --project-ref $ProjectRef > src/types/supabase-generated.ts
    
    Write-Host ""
    Write-Host "✅ Staging deployment complete!" -ForegroundColor Green
    Write-Host ""
}

function Deploy-Production {
    Write-Host ""
    Write-Host "⚠️  PRODUCTION DEPLOYMENT" -ForegroundColor Red
    Write-Host ""
    Write-Host "This will deploy to PRODUCTION database."
    Write-Host "Make sure you have:"
    Write-Host "  1. Tested in local"
    Write-Host "  2. Tested in staging"
    Write-Host "  3. Created a backup"
    Write-Host ""
    
    $Confirm = Read-Host "Type 'YES' to continue"
    
    if ($Confirm -ne "YES") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 0
    }
    
    $ProjectRef = Read-Host "Enter Production Project Ref"
    
    if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
        Write-Host "❌ Project ref required" -ForegroundColor Red
        exit 1
    }
    
    # Link project
    Write-Host "🔗 Linking to production project..."
    npx supabase link --project-ref $ProjectRef
    
    # Backup reminder
    Write-Host ""
    Write-Host "⚠️  BACKUP REMINDER" -ForegroundColor Red
    Write-Host "Have you created a backup? (Dashboard > Settings > Database > Backups)"
    $BackupConfirm = Read-Host "Type 'YES' to continue"
    
    if ($BackupConfirm -ne "YES") {
        Write-Host "❌ Deployment cancelled. Please create backup first." -ForegroundColor Red
        exit 0
    }
    
    # Apply migration
    Write-Host "📝 Applying migration to PRODUCTION..."
    npx supabase db push --project-ref $ProjectRef
    
    # Generate types
    Write-Host "🔨 Generating TypeScript types..."
    npx supabase gen types typescript --project-ref $ProjectRef > src/types/supabase-generated.ts
    
    Write-Host ""
    Write-Host "✅ Production deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Next steps:"
    Write-Host "  1. Verify tables in Supabase Dashboard"
    Write-Host "  2. Run verification queries (see deployment guide)"
    Write-Host "  3. Monitor logs for errors"
    Write-Host "  4. Test basic queries"
    Write-Host ""
}

function Verify-Migration {
    Write-Host ""
    Write-Host "🔍 Verifying migration..." -ForegroundColor Cyan
    Write-Host ""
    
    # Check if migration file exists
    $MigrationPath = "supabase\migrations\$MigrationFile"
    if (-not (Test-Path $MigrationPath)) {
        Write-Host "❌ Migration file not found: $MigrationFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Migration file found" -ForegroundColor Green
    
    # Check file size
    $FileSize = (Get-Item $MigrationPath).Length
    Write-Host "📄 File size: $FileSize bytes"
    
    # Check SQL syntax (basic)
    $Content = Get-Content $MigrationPath -Raw
    if ($Content -match "CREATE TABLE") {
        Write-Host "✅ Contains CREATE TABLE statements" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  No CREATE TABLE statements found" -ForegroundColor Yellow
    }
}

# ============================================================================
# Main
# ============================================================================

# Check prerequisites
Check-SupabaseCLI

# Verify migration
Verify-Migration

# Deploy based on environment
switch ($Environment) {
    'local' {
        Deploy-Local
    }
    'staging' {
        Deploy-Staging
    }
    'prod' {
        Deploy-Production
    }
    default {
        Write-Host "❌ Invalid environment: $Environment" -ForegroundColor Red
        Write-Host "Usage: .\deploy-booking-engine-schema.ps1 [local|staging|prod]"
        exit 1
    }
}

Write-Host ""
Write-Host "🎉 Done!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 See docs\BOOKING_ENGINE_DEPLOYMENT_GUIDE.md for more details"
