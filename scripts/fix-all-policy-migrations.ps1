# Fix all CREATE POLICY statements in migrations to use IF NOT EXISTS pattern
# This prevents "policy already exists" errors when re-running migrations

Write-Host "Fixing all CREATE POLICY statements in migrations..." -ForegroundColor Cyan

$migrationsPath = "supabase/migrations"
$fixedCount = 0
$fileCount = 0

# Find all migration files with CREATE POLICY
$files = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Where-Object {
    $content = Get-Content $_.FullName -Raw
    $content -match "CREATE POLICY"
}

foreach ($file in $files) {
    Write-Host "`nProcessing: $($file.Name)" -ForegroundColor Yellow
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Pattern to match: CREATE POLICY policy_name ON table_name
    $pattern = 'CREATE POLICY\s+(\w+)\s+ON\s+([\w.]+)\s+FOR\s+ALL\s+USING\s+\(([^)]+)\);'
    
    $matches = [regex]::Matches($content, $pattern)
    
    if ($matches.Count -gt 0) {
        Write-Host "  Found $($matches.Count) CREATE POLICY statements" -ForegroundColor Gray
        
        foreach ($match in $matches) {
            $policyName = $match.Groups[1].Value
            $tableName = $match.Groups[2].Value
            $usingClause = $match.Groups[3].Value
            
            # Extract schema and table
            if ($tableName -match '(\w+)\.(\w+)') {
                $schema = $Matches[1]
                $table = $Matches[2]
            } else {
                $schema = 'public'
                $table = $tableName
            }
            
            # Create replacement with IF NOT EXISTS check
            $replacement = @"
DO `$`$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = '$schema' AND tablename = '$table' AND policyname = '$policyName') THEN
    CREATE POLICY $policyName ON $tableName FOR ALL USING ($usingClause);
  END IF;
END `$`$;
"@
            
            $content = $content.Replace($match.Value, $replacement)
            $fixedCount++
        }
        
        # Write back to file if changed
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            Write-Host "  ✓ Fixed $($matches.Count) policies" -ForegroundColor Green
            $fileCount++
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Files modified: $fileCount" -ForegroundColor Green
Write-Host "  Policies fixed: $fixedCount" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

if ($fixedCount -gt 0) {
    Write-Host "All CREATE POLICY statements have been fixed!" -ForegroundColor Green
    Write-Host "You can now run: supabase db push" -ForegroundColor Yellow
} else {
    Write-Host "No CREATE POLICY statements found to fix." -ForegroundColor Gray
}

