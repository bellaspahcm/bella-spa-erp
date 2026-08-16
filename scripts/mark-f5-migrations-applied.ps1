# Mark F5 migrations as applied (they already exist in remote DB)
Write-Host "📝 Marking F5 migrations as applied..." -ForegroundColor Cyan

$f5Migrations = @(
    "20260819000000",
    "20260819010000",
    "20260819020000",
    "20260819030000",
    "20260820000000",
    "20260820010000"
)

foreach ($migration in $f5Migrations) {
    Write-Host "  ✓ $migration" -ForegroundColor Green
    npx supabase migration repair --status applied $migration --linked
}

Write-Host "`n✅ All F5 migrations marked as applied" -ForegroundColor Green
