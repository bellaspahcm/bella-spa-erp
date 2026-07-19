# Run 12-spike-1000vus.js — 1000 VU spike test
# Loads env vars from .env.local before running k6

if (!(Test-Path ".env.local")) {
    Write-Error "[Error] .env.local not found!"
    exit 1
}

Write-Host "[Env] Loading .env.local..." -ForegroundColor Cyan
Get-Content ".env.local" | ForEach-Object {
    if ($_ -match "^\s*([^#=\s]+)\s*=\s*(.+)$") {
        $name  = $Matches[1].Trim()
        $value = $Matches[2].Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
        if ($name -eq "SUPABASE_SERVICE_ROLE_KEY") {
            [System.Environment]::SetEnvironmentVariable("SUPABASE_SERVICE_KEY", $value, "Process")
        }
    }
}

Write-Host "[k6] Starting 1000-VU SPIKE test..." -ForegroundColor Red
Write-Host "     Stages:" -ForegroundColor Gray
Write-Host "       0:00 → 0:30  ramp   0 → 100 VU  (warm-up)" -ForegroundColor Gray
Write-Host "       0:30 → 2:00  ramp 100 → 1000 VU (aggressive)" -ForegroundColor Gray
Write-Host "       2:00 → 4:00  hold 1000 VU       (peak spike)" -ForegroundColor Gray
Write-Host "       4:00 → 4:30  ramp 1000 → 0      (cool-down)" -ForegroundColor Gray

if (!(Test-Path "load-tests/results")) {
    New-Item -ItemType Directory -Force -Path "load-tests/results" | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile   = "load-tests/results/12-spike-1000vus-$timestamp.log"

k6 run load-tests/scripts/12-spike-1000vus.js *>&1 | Tee-Object -FilePath $logFile

Write-Host "[Done] Results saved to: $logFile" -ForegroundColor Green
