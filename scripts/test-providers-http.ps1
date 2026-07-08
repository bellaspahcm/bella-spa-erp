# Provider Activation Test Script (HTTP Method) - Windows PowerShell
# Run: powershell -ExecutionPolicy Bypass -File scripts\test-providers-http.ps1

Write-Host "🚀 Provider Activation Test (HTTP Method)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get usage instructions
Write-Host "📖 Step 1: Getting API instructions..." -ForegroundColor Yellow
try {
    $instructions = Invoke-RestMethod -Uri "http://localhost:3000/api/test/recalculate-salary" -Method Get
    $instructions | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "⚠️  Could not get instructions (API may not be ready yet)" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Get tenant context
Write-Host "🏢 Step 2: Getting tenant ID..." -ForegroundColor Yellow
try {
    $tenantResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/tenant/context" -Method Get
    $tenantId = $tenantResponse.tenant_id
    if (-not $tenantId) {
        $tenantId = $tenantResponse.tenantId
    }
    
    if (-not $tenantId) {
        Write-Host "❌ ERROR: Could not get tenant ID" -ForegroundColor Red
        Write-Host "Response:" -ForegroundColor Red
        $tenantResponse | ConvertTo-Json | Write-Host
        Write-Host ""
        Write-Host "Please login to localhost:3000 first and try again." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✅ Tenant ID: $tenantId" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Could not connect to API" -ForegroundColor Red
    Write-Host "Make sure dev server is running (npm run dev)" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 3: Prompt for employee ID
Write-Host "👤 Step 3: Enter Employee ID (KTV ID from /dashboard/salary table):" -ForegroundColor Yellow
Write-Host "   Hint: Open localhost:3000/dashboard/salary and copy any KTV's ID" -ForegroundColor Gray
$employeeId = Read-Host "Employee ID"

if (-not $employeeId) {
    Write-Host "❌ ERROR: Employee ID is required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Test Configuration:" -ForegroundColor Cyan
Write-Host "   Tenant ID: $tenantId"
Write-Host "   Employee ID: $employeeId"
Write-Host "   Month: 2026-06"
Write-Host ""

# Step 4: Trigger recalculation
Write-Host "⏳ Step 4: Triggering salary recalculation..." -ForegroundColor Yellow
Write-Host "   (Watch npm run dev terminal for [PHASE_2_ACTIVE] logs)" -ForegroundColor Gray
Write-Host ""

$body = @{
    employeeId = $employeeId
    tenantId = $tenantId
    month = "2026-06"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/test/recalculate-salary" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "📊 Response:" -ForegroundColor Cyan
    $result | ConvertTo-Json -Depth 5 | Write-Host
    Write-Host ""
    
    if ($result.success) {
        Write-Host "✅ SUCCESS!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔍 Next Steps:" -ForegroundColor Cyan
        Write-Host "   1. Check npm run dev terminal for [PHASE_2_ACTIVE] logs" -ForegroundColor White
        Write-Host "   2. If you see [PROVIDER_INTEGRATION] instead, providers are in comparison mode" -ForegroundColor White
        Write-Host "   3. To activate: set USE_CONFIG_PROVIDERS=true in .env.local" -ForegroundColor White
        Write-Host ""
        
        if ($result.data) {
            Write-Host "💰 Salary Details:" -ForegroundColor Yellow
            Write-Host "   Employee: $($result.data.employeeName)"
            Write-Host "   Total Salary: $($result.data.totalSalary.ToString('N0')) VNĐ"
            Write-Host "   Base Salary: $($result.data.baseSalary.ToString('N0')) VNĐ"
            Write-Host "   Session Bonus: $($result.data.sessionBonus.ToString('N0')) VNĐ"
            Write-Host "   KPI Bonus: $($result.data.kpiBonus.ToString('N0')) VNĐ"
            Write-Host "   Rating Bonus: $($result.data.ratingBonus.ToString('N0')) VNĐ"
            Write-Host "   Deductions: -$($result.data.deductions.ToString('N0')) VNĐ"
            Write-Host ""
        }
    } else {
        Write-Host "❌ FAILED!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error: $($result.error)" -ForegroundColor Red
        Write-Host ""
    }
    
} catch {
    Write-Host "❌ ERROR: Request failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
