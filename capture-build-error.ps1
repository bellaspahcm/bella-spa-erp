$ErrorActionPreference = "Continue"
npm run build 2>&1 | Tee-Object -FilePath "build-full.log"
$output = Get-Content "build-full.log" -Raw
$lines = $output -split "`n"
$errorLines = $lines | Where-Object { $_ -match "Type error|Failed to" }
$errorLines | Select-Object -Last 20
