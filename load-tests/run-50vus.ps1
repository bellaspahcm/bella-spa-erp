# Run 03-booking-stress.js with its native 50-VU ramp stages
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

Write-Host "[k6] Starting 50-VU booking stress test..." -ForegroundColor Yellow
Write-Host "     Stages: 0→20 VU (30s) | 50 VU (1m) | hold 50 (30s) | ramp-down (30s)" -ForegroundColor Gray

if (!(Test-Path "load-tests/results")) {
    New-Item -ItemType Directory -Force -Path "load-tests/results" | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile   = "load-tests/results/03-booking-stress-50vus-$timestamp.log"

k6 run load-tests/scripts/03-booking-stress.js *>&1 | Tee-Object -FilePath $logFile

Write-Host "[Done] Results saved to: $logFile" -ForegroundColor Green
