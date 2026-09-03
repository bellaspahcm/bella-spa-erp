$units = @(
  'config-center', 'context', 'deployment', 'events', 'extensions', 
  'iam-matrix', 'integration-runtime', 'journey', 'knowledge', 'kpi-engine', 
  'lead-engine', 'metadata-engine', 'migration-governance', 'party', 
  'policy-engine', 'projection-engine', 'resource-engine', 'runtime', 
  'scheduler-registry', 'sdk', 'search-engine', 'specification', 
  'state-machine', 'template-engine', 'timeline'
)

$configTemplate = @'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/platform/UNIT/**/*.ts"],
  "exclude": ["node_modules", "**/__tests__"]
}
'@

$results = @()
foreach ($u in $units) {
  $config = $configTemplate -replace 'UNIT', $u
  $configPath = "tsconfig.platform-$u.json"
  $config | Out-File -Encoding utf8 $configPath
  
  $start = Get-Date
  $output = npx tsc --noEmit --project $configPath 2>&1
  $exit = $LASTEXITCODE
  $duration = (Get-Date) - $start
  $status = if ($exit -eq 0) { "✅ PASS" } else { "❌ FAIL" }
  
  $line = "$($u.PadRight(25)) | $([math]::Round($duration.TotalSeconds,1))s | $status"
  Write-Host $line
  $results += [PSCustomObject]@{
    Unit = $u
    Duration = $duration.TotalSeconds
    Status = $status
    ExitCode = $exit
  }
}

Write-Host "`n========================================`n"
Write-Host "SUMMARY:"
$pass = ($results | Where-Object { $_.ExitCode -eq 0 }).Count
$fail = ($results | Where-Object { $_.ExitCode -ne 0 }).Count
Write-Host "✅ PASS: $pass"
Write-Host "❌ FAIL: $fail"
Write-Host "Total: $($results.Count)"
