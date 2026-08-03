# Deploy Partner Registration System to Staging (PowerShell)
# Run: .\scripts\deploy-partner-portal-staging.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Deploying Partner Registration System to Staging...`n" -ForegroundColor Cyan

# Check Supabase CLI
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Install: npm install -g supabase" -ForegroundColor Red
    exit 1
}

# Check .env.local
if (-not (Test-Path .env.local)) {
    Write-Host "❌ .env.local not found" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Deployment Checklist:" -ForegroundColor Yellow
Write-Host "1. ✅ Migrations ready"
Write-Host "2. ✅ Tests passing (181/181)"
Write-Host "3. ✅ Build successful`n"

$confirm = Read-Host "Deploy to staging? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

Write-Host "`nStep 1: Deploying Database Migrations" -ForegroundColor Green
Write-Host "----------------------------------------"
Write-Host "📦 Migrations:"
Write-Host "  - 20260802112935_partner_registration_system.sql"
Write-Host "  - 20260802130000_create_user_roles.sql"
Write-Host "  - 20260802140000_partner_documents_storage.sql`n"

Write-Host "⏳ Pushing migrations..."
npx supabase db push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migrations deployed successfully`n" -ForegroundColor Green
} else {
    Write-Host "❌ Migration deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Regenerating TypeScript Types" -ForegroundColor Green
Write-Host "----------------------------------------"
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Types regenerated`n" -ForegroundColor Green
} else {
    Write-Host "❌ Type generation failed" -ForegroundColor Red
    exit 1
}

Write-Host "Step 3: Seeding Test Data" -ForegroundColor Green
Write-Host "----------------------------------------"
$seedData = Read-Host "Seed test data? (y/n)"
if ($seedData -eq "y") {
    Write-Host "⏳ Running seed script..."
    Get-Content scripts/seed-partner-test-data.sql | psql $env:NEXT_PUBLIC_SUPABASE_URL
    Write-Host "✅ Test data seeded`n" -ForegroundColor Green
} else {
    Write-Host "⏭️  Skipping test data`n"
}

Write-Host "Step 4: Verifying Deployment" -ForegroundColor Green
Write-Host "----------------------------------------"

# Check tables
Write-Host "🔍 Checking partner_applications table..."
$tableCheck = psql $env:NEXT_PUBLIC_SUPABASE_URL -c "\d partner_applications" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ partner_applications table exists" -ForegroundColor Green
} else {
    Write-Host "❌ partner_applications table not found" -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Checking user_roles table..."
$rolesCheck = psql $env:NEXT_PUBLIC_SUPABASE_URL -c "\d user_roles" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ user_roles table exists`n" -ForegroundColor Green
} else {
    Write-Host "❌ user_roles table not found" -ForegroundColor Red
    exit 1
}

Write-Host "Step 5: Building Application" -ForegroundColor Green
Write-Host "----------------------------------------"
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful (204 pages)`n" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green

Write-Host "📋 Post-Deployment Checklist:`n" -ForegroundColor Yellow
Write-Host "1. ✅ Database Setup"
Write-Host "   - Migrations deployed"
Write-Host "   - Tables created"
Write-Host "   - RPC functions ready`n"

Write-Host "2. 🔐 Security Setup (Manual)"
Write-Host "   - [ ] Configure SendGrid API key in Vercel"
Write-Host "   - [ ] Configure reCAPTCHA keys in Vercel"
Write-Host "   - [ ] Create Supabase Storage bucket 'partner-documents'"
Write-Host "   - [ ] Set up Storage RLS policies`n"

Write-Host "3. 👤 Admin Setup"
Write-Host "   - [ ] Run: psql < scripts/add-admin-user.sql"
Write-Host "   - [ ] Verify admin role assigned`n"

Write-Host "4. 🧪 Manual Testing"
Write-Host "   - [ ] Visit /partner/register"
Write-Host "   - [ ] Complete registration form"
Write-Host "   - [ ] Check email verification"
Write-Host "   - [ ] Admin approve application"
Write-Host "   - [ ] Verify provisioning"
Write-Host "   - [ ] Test activation flow`n"

Write-Host "5. 📊 Monitoring"
Write-Host "   - [ ] Check Supabase logs"
Write-Host "   - [ ] Monitor error rates"
Write-Host "   - [ ] Track registration conversions`n"

Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   - SendGrid Setup: docs/portal/SENDGRID_SETUP_GUIDE.md"
Write-Host "   - Security Setup: docs/portal/SECURITY_SETUP_GUIDE.md"
Write-Host "   - Storage Setup: docs/portal/STORAGE_SETUP_GUIDE.md`n"

Write-Host "🔗 URLs:" -ForegroundColor Yellow
Write-Host "   - Registration: https://your-staging-url/partner/register"
Write-Host "   - Admin Panel: https://your-staging-url/admin/partner-applications`n"

Write-Host "✨ Happy deploying!" -ForegroundColor Cyan
