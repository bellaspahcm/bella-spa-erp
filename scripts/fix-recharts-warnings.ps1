# ============================================================================
# Script: Fix Recharts Width(-1) Height(-1) Warnings
# Purpose: Replace all ResponsiveContainer imports with SafeResponsiveContainer
# Date: 2026-08-04
# ============================================================================

Write-Host "Fix Recharts import replacement..." -ForegroundColor Cyan
Write-Host ""

# Files to update
$files = @(
  "src/app/hq/financial-overview/financial-overview-client.tsx",
  "src/components/bella-auto/BellaAutoAnalyticsDashboard.tsx",
  "src/components/features/dashboard/RevenueChart.tsx",
  "src/components/finance/charts.tsx",
  "src/components/intelligence/BudgetStatusChart.tsx",
  "src/components/intelligence/BudgetVarianceChart.tsx",
  "src/components/intelligence/CashFlowAnalysisChart.tsx",
  "src/components/intelligence/CashFlowForecastChart.tsx",
  "src/components/intelligence/customer/ChurnRiskChart.tsx",
  "src/components/intelligence/customer/CustomerActivityChart.tsx",
  "src/components/intelligence/customer/LtvByCohortChart.tsx",
  "src/components/intelligence/customer/LtvDistributionChart.tsx",
  "src/components/intelligence/customer/RetentionCurveChart.tsx",
  "src/components/intelligence/customer/RevenueBySegmentChart.tsx",
  "src/components/intelligence/customer/RFMMatrixChart.tsx",
  "src/components/intelligence/customer/SegmentDistributionChart.tsx",
  "src/components/intelligence/CustomerMetricsChart.tsx",
  "src/components/intelligence/ExpenseBreakdownChart.tsx",
  "src/components/intelligence/FinancialHealthChart.tsx",
  "src/components/intelligence/GrowthIndicatorsChart.tsx"
)

$successCount = 0

foreach ($file in $files) {
  $fullPath = Join-Path (Get-Location) $file
  
  if (-not (Test-Path $fullPath)) {
    Write-Host "SKIP: $file (not found)" -ForegroundColor Yellow
    continue
  }
  
  $content = Get-Content $fullPath -Raw
  
  # Check if already migrated
  if ($content -like "*@/components/ui/SafeResponsiveContainer*") {
    Write-Host "SKIP: $file (already migrated)" -ForegroundColor Green
    continue
  }
  
  # Check if uses ResponsiveContainer
  if ($content -notlike "*ResponsiveContainer*") {
    Write-Host "SKIP: $file (no ResponsiveContainer)" -ForegroundColor Yellow
    continue
  }
  
  # Add import after recharts import
  $lines = $content -split "`n"
  $newLines = @()
  $importAdded = $false
  
  foreach ($line in $lines) {
    $newLines += $line
    
    # Add SafeResponsiveContainer import after recharts import
    if (-not $importAdded -and $line -like "*from 'recharts'*") {
      $newLines += "import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';"
      $importAdded = $true
    }
  }
  
  if ($importAdded) {
    $newContent = $newLines -join "`n"
    Set-Content -Path $fullPath -Value $newContent -NoNewline
    Write-Host "UPDATED: $file" -ForegroundColor Green
    $successCount++
  }
}

Write-Host ""
Write-Host "Summary: Updated $successCount files" -ForegroundColor Cyan
