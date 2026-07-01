# Test Script for Marketing Intelligence Sync Job (PowerShell)
# 
# Usage:
#   .\scripts\test-marketing-sync.ps1 local   # Test local dev server
#   .\scripts\test-marketing-sync.ps1 prod    # Test production

param(
    [string]$Env = "local"
)

$BaseUrl = ""
$CronSecret = ""

Write-Host ""
Write-Host "=== Marketing Intelligence Sync Job Test ===" -ForegroundColor Blue
Write-Host ""

# Determine environment
if ($Env -eq "local") {
    $BaseUrl = "http://localhost:3000"
    $CronSecret = "bella_cron_secret_dev_2026_secure_key_12345"
    Write-Host "Testing LOCAL environment" -ForegroundColor Yellow
} elseif ($Env -eq "prod") {
    Write-Host "WARNING: Testing PRODUCTION" -ForegroundColor Red
    $BaseUrl = Read-Host "Enter production URL (e.g., https://your-domain.vercel.app)"
    $CronSecret = Read-Host "Enter production CRON_SECRET" -AsSecureString
    $CronSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($CronSecret))
} else {
    Write-Host "Invalid environment. Use 'local' or 'prod'" -ForegroundColor Red
    exit 1
}

Write-Host "Base URL: $BaseUrl" -ForegroundColor Green
Write-Host "Secret: $($CronSecret.Substring(0,10))..." -ForegroundColor Green
Write-Host ""

# Test 1: Health check
Write-Host "Test 1: API Health Check" -ForegroundColor Blue
Write-Host "GET /api/health"
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/health" -Method Get
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Campaign Analytics
Write-Host "Test 2: Marketing API - Campaign Analytics" -ForegroundColor Blue
Write-Host "GET /api/intelligence/marketing/campaign-analytics"
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/intelligence/marketing/campaign-analytics?campaignId=00000000-0000-0000-0000-000000000001&period=month" -Method Get
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Expected to fail - no campaign data" -ForegroundColor Yellow
}
Write-Host ""

# Test 3: Channel Performance
Write-Host "Test 3: Marketing API - Channel Performance" -ForegroundColor Blue
Write-Host "GET /api/intelligence/marketing/channel-performance"
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/intelligence/marketing/channel-performance?tenantId=00000000-0000-0000-0000-000000000001&period=month" -Method Get
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "May return empty data" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Cron Job - No Auth
Write-Host "Test 4: Cron Job - No Auth (Expected: 401)" -ForegroundColor Blue
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/cron/sync-external-ads" -Method Get
    Write-Host "X Should have rejected (got 200)" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "OK Correctly rejected (401)" -ForegroundColor Green
    } else {
        Write-Host "X Unexpected status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 5: Cron Job - Invalid Auth
Write-Host "Test 5: Cron Job - Invalid Auth (Expected: 401)" -ForegroundColor Blue
try {
    $headers = @{
        "Authorization" = "Bearer wrong-token"
    }
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/cron/sync-external-ads" -Method Get -Headers $headers
    Write-Host "X Should have rejected (got 200)" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "OK Correctly rejected (401)" -ForegroundColor Green
    } else {
        Write-Host "X Unexpected status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 6: Cron Job - Valid Auth
Write-Host "Test 6: Cron Job - Valid Auth (Expected: 200)" -ForegroundColor Blue
Write-Host "GET /api/cron/sync-external-ads"
try {
    $headers = @{
        "Authorization" = "Bearer $CronSecret"
    }
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/cron/sync-external-ads" -Method Get -Headers $headers
    $response | ConvertTo-Json -Depth 5
    
    if ($response.success) {
        Write-Host ""
        Write-Host "OK Sync job completed successfully" -ForegroundColor Green
        Write-Host ""
        Write-Host "Summary:" -ForegroundColor Blue
        Write-Host "  Tenants Processed: $($response.data.summary.tenantsProcessed)"
        Write-Host "  Tenants Succeeded: $($response.data.summary.tenantsSucceeded)"
        Write-Host "  Tenants Failed: $($response.data.summary.tenantsFailed)"
        Write-Host "  Total Records Synced: $($response.data.summary.totalRecordsSynced)"
    } else {
        Write-Host ""
        Write-Host "X Sync job failed" -ForegroundColor Red
    }
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 7: Manual Trigger (POST)
Write-Host "Test 7: Manual Trigger (POST) - With Filters" -ForegroundColor Blue
try {
    $headers = @{
        "Authorization" = "Bearer $CronSecret"
        "Content-Type" = "application/json"
    }
    $body = @{
        platforms = @("facebook", "google")
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/cron/sync-external-ads" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Test Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Most tests will return empty data or 404 because:" -ForegroundColor Yellow
Write-Host "  1. No marketing campaigns created yet"
Write-Host "  2. No external ads data synced yet"
Write-Host "  3. No tenant has ads credentials configured"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Blue
Write-Host "  1. Create a marketing campaign in database"
Write-Host "  2. Add ads credentials to tenant metadata"
Write-Host "  3. Run sync job to fetch real data"
Write-Host "  4. Test marketing APIs again"
