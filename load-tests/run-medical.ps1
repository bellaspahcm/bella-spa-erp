# PowerShell script to run medical tenant K6 load test
# Usage:
#   .\load-tests\run-medical.ps1 -Profile smoke
#   .\load-tests\run-medical.ps1 -Profile 200
#   .\load-tests\run-medical.ps1 -Profile 500

param (
    [ValidateSet("smoke", "200", "500")]
    [string]$Profile = "smoke"
)

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

# Set Profile for K6 script
[System.Environment]::SetEnvironmentVariable("PROFILE", $Profile, "Process")

Write-Host "[k6] Starting medical tenant load test with profile: $Profile..." -ForegroundColor Yellow

if (!(Test-Path "load-tests/results")) {
    New-Item -ItemType Directory -Force -Path "load-tests/results" | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile   = "load-tests/results/13-medical-$Profile-$timestamp.log"

k6 run load-tests/scripts/13-medical-load.js *>&1 | Tee-Object -FilePath $logFile

Write-Host "[Done] Results saved to: $logFile" -ForegroundColor Green
