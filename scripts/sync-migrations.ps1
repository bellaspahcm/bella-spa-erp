# Migration Sync Script — Mark remote-only migrations as reverted
# This script synchronizes local/remote migration history by marking
# remote-only migrations (20260815-16 experimental series) as reverted

Write-Host "🔄 Syncing migration history..." -ForegroundColor Cyan

# Mark remote-only migrations as reverted (we don't have these locally)
$remoteMigrations = @(
    "20260815142836",
    "20260816012941",
    "20260816013020",
    "20260816013143",
    "20260816014412",
    "20260816014825",
    "20260816014901",
    "20260816051512",
    "20260816052144",
    "20260816052548",
    "20260816052956",
    "20260816053008",
    "20260816053041",
    "20260816053859",
    "20260816055017",
    "20260816064540"
)

Write-Host "📝 Marking remote-only migrations as reverted..." -ForegroundColor Yellow
foreach ($migration in $remoteMigrations) {
    Write-Host "  - $migration"
    npx supabase migration repair --status reverted $migration --linked
}

Write-Host "`n✅ Remote migrations marked as reverted" -ForegroundColor Green
Write-Host "`n📤 Ready to push local F5 migrations (20260819-20)" -ForegroundColor Cyan
Write-Host "Run: npx supabase db push --linked" -ForegroundColor White
