# Fix duplicate ResponsiveContainer imports
Write-Host "Fixing duplicate ResponsiveContainer imports..." -ForegroundColor Cyan

$files = Get-ChildItem -Path "src" -Filter "*.tsx" -Recurse | Where-Object {
  $content = Get-Content $_.FullName -Raw
  $content -like "*from 'recharts'*" -and $content -like "*ResponsiveContainer*" -and $content -like "*SafeResponsiveContainer*"
}

foreach ($file in $files) {
  $content = Get-Content $file.FullName -Raw
  
  # Remove ResponsiveContainer from recharts import
  $content = $content -replace '(\{[^}]*?),\s*ResponsiveContainer\s*,\s*([^}]*?}\s+from\s+.recharts)', '$1, $2'
  $content = $content -replace '(\{[^}]*?),\s*ResponsiveContainer\s*([^}]*?}\s+from\s+.recharts)', '$1$2'
  $content = $content -replace '(import\s+\{)\s*ResponsiveContainer\s*,\s*([^}]+}\s+from\s+.recharts)', '$1 $2'
  
  Set-Content -Path $file.FullName -Value $content -NoNewline
  Write-Host "FIXED: $($file.Name)" -ForegroundColor Green
}

Write-Host "Done! Fixed $($files.Count) files" -ForegroundColor Cyan
