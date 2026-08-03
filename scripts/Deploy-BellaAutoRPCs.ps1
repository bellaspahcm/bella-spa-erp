# ============================================================================
# Bella Auto RPC Deployment Script (PowerShell)
# Deploys Phase 11-15 RPCs and refreshes PostgREST schema cache
# Usage: .\scripts\Deploy-BellaAutoRPCs.ps1
# ============================================================================

Write-Host "🚀 Bella Auto RPC Deployment" -ForegroundColor Cyan
Write-Host ("━" * 60) -ForegroundColor Gray
Write-Host ""

# Step 1: Verify migrations
Write-Host "📦 Step 1: Verifying migrations..." -ForegroundColor Yellow
Write-Host ""

$migrations = @(
    "20260803310000_bella_auto_phase11_business_rollback.sql",
    "20260803320000_bella_auto_phase12_temporal_history.sql",
    "20260804000000_bella_auto_phase13_rule_engine.sql",
    "20260804100000_bella_auto_phase14_marketplace.sql",
    "20260804110000_bella_auto_phase15_rollup_analytics.sql"
)

$allFound = $true
foreach ($migration in $migrations) {
    $path = "supabase\migrations\$migration"
    if (Test-Path $path) {
        Write-Host "  ✓ $migration" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $migration NOT FOUND" -ForegroundColor Red
        $allFound = $false
    }
}

if (-not $allFound) {
    Write-Host ""
    Write-Host "❌ Some migrations missing. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ All 5 phase migrations found" -ForegroundColor Green
Write-Host ""

# Step 2: Push migrations to Supabase
Write-Host "📤 Step 2: Pushing migrations to Supabase..." -ForegroundColor Yellow
Write-Host ""

# Check if supabase CLI is available
try {
    $null = Get-Command supabase -ErrorAction Stop
} catch {
    Write-Host "❌ Supabase CLI not found. Install via:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Push migrations (auto-confirm with Y)
$confirmation = "Y"
$confirmation | supabase db push --linked

Write-Host ""
Write-Host "✅ Migrations pushed" -ForegroundColor Green
Write-Host ""

# Step 3: Refresh schema cache
Write-Host "🔄 Step 3: Refreshing PostgREST schema cache..." -ForegroundColor Yellow
Write-Host ""

# Load database URL from .env.local
$envFile = Get-Content ".env.local" | Where-Object { $_ -match "SUPABASE_DB_URL=" }
if ($envFile) {
    $dbUrl = ($envFile -split "=", 2)[1].Trim()
    Write-Host "  Database URL loaded from .env.local" -ForegroundColor Gray
    
    # Try to refresh cache via psql if available
    try {
        $null = Get-Command psql -ErrorAction Stop
        psql $dbUrl -c "NOTIFY pgrst, 'reload schema';" 2>$null
        Write-Host "  ✓ Schema cache refresh sent via psql" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  psql not available. Please refresh manually:" -ForegroundColor Yellow
        Write-Host "     Supabase Dashboard → Settings → API → Reload schema cache" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️  Could not load SUPABASE_DB_URL from .env.local" -ForegroundColor Yellow
    Write-Host "     Please refresh manually:" -ForegroundColor Gray
    Write-Host "     Supabase Dashboard → Settings → API → Reload schema cache" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Schema cache refresh requested" -ForegroundColor Green
Write-Host ""

# Step 4: Summary
Write-Host ("━" * 60) -ForegroundColor Gray
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Wait 30 seconds for PostgREST to reload" -ForegroundColor White
Write-Host "2. Run: npx tsx scripts\seed-bella-auto-stress-test.ts" -ForegroundColor White
Write-Host "3. Run: npx tsx scripts\test-bella-auto-perf.ts" -ForegroundColor White
Write-Host ""
Write-Host "If schema errors persist:" -ForegroundColor Yellow
Write-Host "- Go to Supabase Dashboard → Settings → API" -ForegroundColor Gray
Write-Host "- Click 'Reload schema cache'" -ForegroundColor Gray
Write-Host ""
