#!/bin/bash

# Test Script for Marketing Intelligence Sync Job
# 
# Usage:
#   ./scripts/test-marketing-sync.sh local   # Test local dev server
#   ./scripts/test-marketing-sync.sh prod    # Test production (with prod secret)

set -e

ENV=${1:-local}
BASE_URL=""
CRON_SECRET=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Marketing Intelligence Sync Job Test ===${NC}\n"

# Determine environment
if [ "$ENV" = "local" ]; then
    BASE_URL="http://localhost:3000"
    CRON_SECRET="bella_cron_secret_dev_2026_secure_key_12345"
    echo -e "${YELLOW}Testing LOCAL environment${NC}"
elif [ "$ENV" = "prod" ]; then
    echo -e "${RED}WARNING: Testing PRODUCTION${NC}"
    echo "Enter production URL (e.g., https://your-domain.vercel.app):"
    read BASE_URL
    echo "Enter production CRON_SECRET:"
    read -s CRON_SECRET
else
    echo -e "${RED}Invalid environment. Use 'local' or 'prod'${NC}"
    exit 1
fi

echo -e "Base URL: ${GREEN}${BASE_URL}${NC}"
echo -e "Secret: ${GREEN}${CRON_SECRET:0:10}...${NC}\n"

# Test 1: Health check
echo -e "${BLUE}Test 1: API Health Check${NC}"
echo "GET /api/health"
curl -s "${BASE_URL}/api/health" | jq '.' || echo -e "${RED}Failed${NC}"
echo ""

# Test 2: Marketing API - Campaign Analytics (should fail - no data yet)
echo -e "${BLUE}Test 2: Marketing API - Campaign Analytics${NC}"
echo "GET /api/intelligence/marketing/campaign-analytics?campaignId=00000000-0000-0000-0000-000000000001&period=month"
curl -s "${BASE_URL}/api/intelligence/marketing/campaign-analytics?campaignId=00000000-0000-0000-0000-000000000001&period=month" | jq '.' || echo -e "${YELLOW}Expected to fail - no campaign data${NC}"
echo ""

# Test 3: Marketing API - Channel Performance (should return empty array)
echo -e "${BLUE}Test 3: Marketing API - Channel Performance${NC}"
echo "GET /api/intelligence/marketing/channel-performance?tenantId=00000000-0000-0000-0000-000000000001&period=month"
curl -s "${BASE_URL}/api/intelligence/marketing/channel-performance?tenantId=00000000-0000-0000-0000-000000000001&period=month" | jq '.' || echo -e "${YELLOW}May return empty data${NC}"
echo ""

# Test 4: Cron Job - Without Authentication (should fail with 401)
echo -e "${BLUE}Test 4: Cron Job - No Auth (Expected: 401)${NC}"
echo "GET /api/cron/sync-external-ads (no header)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/cron/sync-external-ads")
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Correctly rejected (401)${NC}"
else
    echo -e "${RED}✗ Unexpected status: ${HTTP_CODE}${NC}"
fi
echo ""

# Test 5: Cron Job - With Invalid Token (should fail with 401)
echo -e "${BLUE}Test 5: Cron Job - Invalid Auth (Expected: 401)${NC}"
echo "GET /api/cron/sync-external-ads (wrong token)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer wrong-token" "${BASE_URL}/api/cron/sync-external-ads")
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Correctly rejected (401)${NC}"
else
    echo -e "${RED}✗ Unexpected status: ${HTTP_CODE}${NC}"
fi
echo ""

# Test 6: Cron Job - With Valid Token (should succeed)
echo -e "${BLUE}Test 6: Cron Job - Valid Auth (Expected: 200)${NC}"
echo "GET /api/cron/sync-external-ads (correct token)"
RESPONSE=$(curl -s -H "Authorization: Bearer ${CRON_SECRET}" "${BASE_URL}/api/cron/sync-external-ads")
echo "$RESPONSE" | jq '.'

# Check if sync was successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Sync job completed successfully${NC}"
    
    # Show summary
    TENANTS_PROCESSED=$(echo "$RESPONSE" | jq -r '.data.summary.tenantsProcessed')
    TENANTS_SUCCEEDED=$(echo "$RESPONSE" | jq -r '.data.summary.tenantsSucceeded')
    TENANTS_FAILED=$(echo "$RESPONSE" | jq -r '.data.summary.tenantsFailed')
    TOTAL_RECORDS=$(echo "$RESPONSE" | jq -r '.data.summary.totalRecordsSynced')
    
    echo -e "\n${BLUE}Summary:${NC}"
    echo "  Tenants Processed: $TENANTS_PROCESSED"
    echo "  Tenants Succeeded: $TENANTS_SUCCEEDED"
    echo "  Tenants Failed: $TENANTS_FAILED"
    echo "  Total Records Synced: $TOTAL_RECORDS"
else
    echo -e "${RED}✗ Sync job failed${NC}"
fi
echo ""

# Test 7: Manual Trigger (POST) - With filters
echo -e "${BLUE}Test 7: Manual Trigger (POST) - With Filters${NC}"
echo "POST /api/cron/sync-external-ads (with body)"
RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -d '{"platforms":["facebook","google"]}' \
    "${BASE_URL}/api/cron/sync-external-ads")
echo "$RESPONSE" | jq '.'
echo ""

echo -e "${GREEN}=== Test Complete ===${NC}\n"
echo -e "${YELLOW}Note: Most tests will return empty data or 404 because:${NC}"
echo "  1. No marketing campaigns created yet"
echo "  2. No external ads data synced yet"
echo "  3. No tenant has ads credentials configured"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Create a marketing campaign in database"
echo "  2. Add ads credentials to tenant metadata"
echo "  3. Run sync job to fetch real data"
echo "  4. Test marketing APIs again"
