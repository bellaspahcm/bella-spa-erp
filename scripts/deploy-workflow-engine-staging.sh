#!/bin/bash

# Workflow Engine - Staging Deployment Script
# Run this script to deploy Workflow Engine to staging environment

set -e  # Exit on error

echo "🚀 Workflow Engine - Staging Deployment"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"

# Prompt for project ref
echo ""
echo -e "${YELLOW}📝 Enter Supabase Staging Project Reference:${NC}"
read -p "Project Ref: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ Project reference is required${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Using project: $PROJECT_REF${NC}"

# Confirm before proceeding
echo ""
echo -e "${YELLOW}⚠️  This will apply database migration to STAGING${NC}"
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelled"
    exit 0
fi

# Step 1: Apply database migration
echo ""
echo "📦 Step 1: Applying database migration..."
npx supabase db push --project-ref $PROJECT_REF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration applied successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

# Step 2: Verify tables
echo ""
echo "🔍 Step 2: Verifying database schema..."
echo "Please run the verification script in Supabase SQL Editor:"
echo "  File: supabase/migrations/VERIFY_WORKFLOW_TABLES.sql"
echo ""
read -p "Press Enter after running verification script..."

# Step 3: Remind about environment variables
echo ""
echo "⚙️  Step 3: Set environment variables in Vercel"
echo ""
echo "Add these variables to Vercel Dashboard:"
echo "  FEATURE_WORKFLOW_ENGINE=true"
echo "  FEATURE_WF_BOOKING_FULFILLMENT=true"
echo "  WORKFLOW_ENGINE_ENABLE_LOGGING=true"
echo "  WORKFLOW_ENGINE_ENABLE_METRICS=true"
echo ""
read -p "Press Enter after setting environment variables..."

# Step 4: Deploy to Vercel (optional)
echo ""
echo "🚢 Step 4: Deploy code to Vercel"
echo ""
read -p "Deploy now with 'vercel'? (y/n): " DEPLOY_NOW

if [ "$DEPLOY_NOW" == "y" ]; then
    if command -v vercel &> /dev/null; then
        echo "Deploying to Vercel..."
        vercel
    else
        echo -e "${YELLOW}⚠️  Vercel CLI not found. Deploy manually.${NC}"
    fi
fi

# Done
echo ""
echo -e "${GREEN}✅ Deployment script completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Wait for Vercel deployment to finish"
echo "2. Test API endpoints (see checklist)"
echo "3. Verify database records"
echo "4. Monitor logs for errors"
echo ""
echo "Checklist: docs/WORKFLOW_ENGINE_STAGING_DEPLOYMENT_CHECKLIST.md"
