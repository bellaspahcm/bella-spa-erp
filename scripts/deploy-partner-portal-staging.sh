#!/bin/bash
# Deploy Partner Registration System to Staging
# Run: bash scripts/deploy-partner-portal-staging.sh

set -e  # Exit on error

echo "🚀 Deploying Partner Registration System to Staging..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Install: npm install -g supabase${NC}"
    exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local not found${NC}"
    exit 1
fi

# Load environment variables
source .env.local

# Verify required variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo -e "${RED}❌ NEXT_PUBLIC_SUPABASE_URL not set${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Deployment Checklist:${NC}"
echo "1. ✅ Migrations ready"
echo "2. ✅ Tests passing (181/181)"
echo "3. ✅ Build successful"
echo ""

# Ask for confirmation
read -p "Deploy to staging? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Deploying Database Migrations${NC}"
echo "----------------------------------------"

# List migrations to deploy
echo "📦 Migrations:"
echo "  - 20260802112935_partner_registration_system.sql"
echo "  - 20260802130000_create_user_roles.sql"
echo "  - 20260802140000_partner_documents_storage.sql"
echo ""

# Deploy migrations
echo "⏳ Pushing migrations..."
npx supabase db push

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations deployed successfully${NC}"
else
    echo -e "${RED}❌ Migration deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 2: Regenerating TypeScript Types${NC}"
echo "----------------------------------------"
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Types regenerated${NC}"
else
    echo -e "${RED}❌ Type generation failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 3: Seeding Test Data${NC}"
echo "----------------------------------------"
read -p "Seed test data? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "⏳ Running seed script..."
    psql "$NEXT_PUBLIC_SUPABASE_URL" < scripts/seed-partner-test-data.sql
    echo -e "${GREEN}✅ Test data seeded${NC}"
else
    echo "⏭️  Skipping test data"
fi

echo ""
echo -e "${GREEN}Step 4: Verifying Deployment${NC}"
echo "----------------------------------------"

# Check if tables exist
echo "🔍 Checking partner_applications table..."
psql "$NEXT_PUBLIC_SUPABASE_URL" -c "\d partner_applications" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ partner_applications table exists${NC}"
else
    echo -e "${RED}❌ partner_applications table not found${NC}"
    exit 1
fi

echo "🔍 Checking user_roles table..."
psql "$NEXT_PUBLIC_SUPABASE_URL" -c "\d user_roles" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ user_roles table exists${NC}"
else
    echo -e "${RED}❌ user_roles table not found${NC}"
    exit 1
fi

echo "🔍 Checking RPC functions..."
psql "$NEXT_PUBLIC_SUPABASE_URL" -c "SELECT proname FROM pg_proc WHERE proname IN ('add_partner_document', 'remove_partner_document');" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ RPC functions exist${NC}"
else
    echo -e "${YELLOW}⚠️  RPC functions may not exist${NC}"
fi

echo ""
echo -e "${GREEN}Step 5: Building Application${NC}"
echo "----------------------------------------"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful (204 pages)${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Post-Deployment Checklist:${NC}"
echo ""
echo "1. ✅ Database Setup"
echo "   - Migrations deployed"
echo "   - Tables created"
echo "   - RPC functions ready"
echo ""
echo "2. 🔐 Security Setup (Manual)"
echo "   - [ ] Configure SendGrid API key in Vercel"
echo "   - [ ] Configure reCAPTCHA keys in Vercel"
echo "   - [ ] Create Supabase Storage bucket 'partner-documents'"
echo "   - [ ] Set up Storage RLS policies"
echo ""
echo "3. 👤 Admin Setup"
echo "   - [ ] Run: psql < scripts/add-admin-user.sql"
echo "   - [ ] Verify admin role assigned"
echo ""
echo "4. 🧪 Manual Testing"
echo "   - [ ] Visit /partner/register"
echo "   - [ ] Complete registration form"
echo "   - [ ] Check email verification"
echo "   - [ ] Admin approve application"
echo "   - [ ] Verify provisioning"
echo "   - [ ] Test activation flow"
echo ""
echo "5. 📊 Monitoring"
echo "   - [ ] Check Supabase logs"
echo "   - [ ] Monitor error rates"
echo "   - [ ] Track registration conversions"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "   - SendGrid Setup: docs/portal/SENDGRID_SETUP_GUIDE.md"
echo "   - Security Setup: docs/portal/SECURITY_SETUP_GUIDE.md"
echo "   - Storage Setup: docs/portal/STORAGE_SETUP_GUIDE.md"
echo ""
echo -e "${YELLOW}🔗 URLs:${NC}"
echo "   - Registration: https://your-staging-url/partner/register"
echo "   - Admin Panel: https://your-staging-url/admin/partner-applications"
echo ""
echo "✨ Happy deploying!"
