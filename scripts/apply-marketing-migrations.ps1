#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automated Marketing Intelligence Migrations via Supabase REST API
.DESCRIPTION
    Applies 5 Marketing Intelligence migrations to Supabase database using REST API.
    Reads migrations from supabase/migrations/ directory.
.NOTES
    Requires: SUPABASE_SERVICE_ROLE_KEY in .env.local
    Author: Kiro AI Agent
    Date: 2026-06-22
#>

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }

Write-Info "========================================"
Write-Info "🚀 Marketing Intelligence Migrations"
Write-Info "========================================"
Write-Host ""

# Load environment variables
if (-not (Test-Path ".env.local")) {
    Write-Error "❌ .env.local not found!"
    exit 1
}

Write-Info "📂 Loading environment variables..."
$envContent = Get-Content ".env.local" -Raw
$SUPABASE_URL = ($envContent | Select-String -Pattern "NEXT_PUBLIC_SUPABASE_URL=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
$SUPABASE_KEY = ($envContent | Select-String -Pattern "SUPABASE_SERVICE_ROLE_KEY=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()

if (-not $SUPABASE_KEY) {
    Write-Warning "⚠️  SUPABASE_SERVICE_ROLE_KEY not found, trying SUPABASE_ANON_KEY..."
    $SUPABASE_KEY = ($envContent | Select-String -Pattern "NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
}

if (-not $SUPABASE_URL -or -not $SUPABASE_KEY) {
    Write-Error "❌ Missing Supabase credentials in .env.local"
    Write-Error "   Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    exit 1
}

Write-Success "✓ Credentials loaded"
Write-Info "  URL: $SUPABASE_URL"
Write-Host ""

# Migration files in order
$migrations = @(
    @{
        name = "20260622200000_create_external_ads_data.sql"
        description = "External Ads Data Table"
    },
    @{
        name = "20260622201000_create_marketing_campaigns.sql"
        description = "Marketing Campaigns Table"
    },
    @{
        name = "20260622202000_create_mv_campaign_performance.sql"
        description = "Campaign Performance Materialized View"
    },
    @{
        name = "20260622203000_create_mv_channel_performance.sql"
        description = "Channel Performance Materialized View"
    },
    @{
        name = "20260622204000_create_mv_marketing_refresh_jobs.sql"
        description = "Auto-Refresh Cron Jobs"
    }
)

# Function to execute SQL via Supabase REST API
function Invoke-SupabaseSql {
    param(
        [string]$Sql,
        [string]$Description
    )

    Write-Info "🔧 Executing: $Description"
    
    if ($DryRun) {
        Write-Warning "   [DRY RUN] Would execute SQL (${Sql.Length} chars)"
        return @{ success = $true; message = "Dry run - not executed" }
    }

    try {
        # Use Supabase PostgREST API to execute raw SQL
        # Note: This requires service_role key with execute permissions
        $headers = @{
            "apikey" = $SUPABASE_KEY
            "Authorization" = "Bearer $SUPABASE_KEY"
            "Content-Type" = "application/json"
            "Prefer" = "return=representation"
        }

        # Execute via rpc function (if available) or direct query
        $endpoint = "$SUPABASE_URL/rest/v1/rpc/exec_sql"
        $body = @{
            sql = $Sql
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        Write-Success "   ✓ Success"
        return @{ success = $true; response = $response }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = ""
        
        if ($_.Exception.Response) {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
        }

        Write-Error "   ✗ Failed: $($_.Exception.Message)"
        if ($Verbose) {
            Write-Host "     Status: $statusCode" -ForegroundColor Red
            Write-Host "     Body: $errorBody" -ForegroundColor Red
        }

        return @{ 
            success = $false
            error = $_.Exception.Message
            statusCode = $statusCode
            body = $errorBody
        }
    }
}

# Function to execute SQL via psql (fallback)
function Invoke-PsqlSql {
    param(
        [string]$Sql,
        [string]$Description,
        [string]$DbUrl
    )

    Write-Info "🔧 Executing via psql: $Description"
    
    if ($DryRun) {
        Write-Warning "   [DRY RUN] Would execute SQL (${Sql.Length} chars)"
        return @{ success = $true }
    }

    try {
        $Sql | psql $DbUrl -v ON_ERROR_STOP=1 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "   ✓ Success"
            return @{ success = $true }
        }
        else {
            Write-Error "   ✗ Failed with exit code $LASTEXITCODE"
            return @{ success = $false; error = "psql exit code $LASTEXITCODE" }
        }
    }
    catch {
        Write-Error "   ✗ Failed: $($_.Exception.Message)"
        return @{ success = $false; error = $_.Exception.Message }
    }
}

# Check if we have direct DB URL for psql fallback
$DB_URL = ($envContent | Select-String -Pattern "SUPABASE_DB_URL=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }).Trim()
$hasPsql = Get-Command psql -ErrorAction SilentlyContinue

# Track results
$results = @()
$successCount = 0
$failCount = 0

# Execute migrations
Write-Info "📦 Applying migrations..."
Write-Host ""

foreach ($migration in $migrations) {
    $migrationPath = "supabase\migrations\$($migration.name)"
    
    Write-Info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Info "Migration: $($migration.name)"
    Write-Info "Description: $($migration.description)"
    Write-Host ""

    # Check if file exists
    if (-not (Test-Path $migrationPath)) {
        Write-Error "❌ Migration file not found: $migrationPath"
        $failCount++
        $results += @{
            migration = $migration.name
            success = $false
            error = "File not found"
        }
        continue
    }

    # Read SQL content
    $sql = Get-Content $migrationPath -Raw

    # Execute migration (try REST API first, fallback to psql if available)
    $result = Invoke-SupabaseSql -Sql $sql -Description $migration.description

    if (-not $result.success -and $hasPsql -and $DB_URL) {
        Write-Warning "   Retrying with psql..."
        $result = Invoke-PsqlSql -Sql $sql -Description $migration.description -DbUrl $DB_URL
    }

    # Track results
    if ($result.success) {
        $successCount++
    }
    else {
        $failCount++
    }

    $results += @{
        migration = $migration.name
        success = $result.success
        error = if ($result.error) { $result.error } else { $null }
    }

    Write-Host ""
}

# Summary
Write-Info "========================================"
Write-Info "📊 MIGRATION SUMMARY"
Write-Info "========================================"
Write-Host ""
Write-Host "Total Migrations: $($migrations.Count)"
Write-Success "✓ Success: $successCount"
if ($failCount -gt 0) {
    Write-Error "✗ Failed: $failCount"
}
Write-Host ""

# Detailed results
if ($failCount -gt 0) {
    Write-Warning "Failed migrations:"
    foreach ($result in $results) {
        if (-not $result.success) {
            Write-Error "  ✗ $($result.migration): $($result.error)"
        }
    }
    Write-Host ""
}

# Exit code
if ($failCount -gt 0) {
    Write-Error "❌ Migration failed. Please check errors above."
    exit 1
}
else {
    Write-Success "✅ All migrations applied successfully!"
    
    if (-not $DryRun) {
        Write-Host ""
        Write-Info "🧪 Next steps:"
        Write-Info "  1. Run: .\scripts\test-marketing-sync.ps1"
        Write-Info "  2. Verify: Check Supabase Dashboard → Database → Tables"
        Write-Info "  3. Test: Insert sample data and test APIs"
    }
    
    exit 0
}
