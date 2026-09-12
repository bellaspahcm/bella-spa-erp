# Check Vercel Deployment Status
# Displays latest deployment info for current branch

$branch = git rev-parse --abbrev-ref HEAD
$commitHash = git rev-parse --short HEAD

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "VERCEL DEPLOYMENT STATUS CHECK" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Branch: " -NoNewline
Write-Host "$branch" -ForegroundColor Yellow
Write-Host "Commit: " -NoNewline
Write-Host "$commitHash" -ForegroundColor Yellow
Write-Host ""
Write-Host "Dashboard: " -NoNewline
Write-Host "https://vercel.com/bellaspahcm/bella-spa-erp/deployments" -ForegroundColor Blue
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "MANUAL STEPS:" -ForegroundColor Green
Write-Host "1. Open dashboard link above" -ForegroundColor White
Write-Host "2. Filter by branch: $branch" -ForegroundColor White
Write-Host "3. Find commit: $commitHash" -ForegroundColor White
Write-Host "4. Check status: Building → Ready" -ForegroundColor White
Write-Host "5. Copy preview URL when ready" -ForegroundColor White
Write-Host ""
Write-Host "THEN RUN SMOKE TEST:" -ForegroundColor Green
Write-Host "bash scripts/e1-smoke-test.sh <preview-url>" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or PowerShell equivalent:" -ForegroundColor Green
Write-Host '.\scripts\e1-smoke-test.ps1 "<preview-url>"' -ForegroundColor Yellow
Write-Host ""
