#!/bin/bash

# Workflow Engine - API Testing Script
# Test all workflow API endpoints on staging

set -e

echo "🧪 Workflow Engine - API Testing"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
echo -e "${YELLOW}📝 Configuration${NC}"
read -p "Staging URL (e.g., https://staging.bella-erp.com): " STAGING_URL
read -p "Auth Token (JWT): " AUTH_TOKEN
read -p "Tenant ID: " TENANT_ID

if [ -z "$STAGING_URL" ] || [ -z "$AUTH_TOKEN" ] || [ -z "$TENANT_ID" ]; then
    echo -e "${RED}❌ All fields are required${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Configuration set${NC}"
echo "  URL: $STAGING_URL"
echo "  Tenant: $TENANT_ID"
echo ""

# Test 1: List workflows
echo "Test 1: GET /api/workflows (List workflows)"
echo "-------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" "$STAGING_URL/api/workflows" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY" | jq '.' || echo "$BODY"
else
    echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
    echo "Response: $BODY"
fi

echo ""
read -p "Press Enter to continue..."

# Test 2: Execute workflow (will fail without valid booking)
echo ""
echo "Test 2: POST /api/workflows/execute (Execute workflow)"
echo "------------------------------------------------------"
echo -e "${YELLOW}Note: This will fail without a valid booking ID${NC}"
read -p "Enter Booking ID (or press Enter to skip): " BOOKING_ID

if [ ! -z "$BOOKING_ID" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$STAGING_URL/api/workflows/execute" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"workflowId\": \"booking-to-fulfillment-v1\",
        \"tenantId\": \"$TENANT_ID\",
        \"data\": {
          \"bookingId\": \"$BOOKING_ID\"
        }
      }")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
        echo "Response: $BODY" | jq '.' || echo "$BODY"
        
        # Extract execution ID
        EXECUTION_ID=$(echo "$BODY" | jq -r '.data.executionId')
        echo ""
        echo "Execution ID: $EXECUTION_ID"
    else
        echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
        echo "Response: $BODY"
    fi
else
    echo "Skipped (no booking ID provided)"
fi

echo ""
read -p "Press Enter to continue..."

# Test 3: Get execution details
echo ""
echo "Test 3: GET /api/workflows/:executionId (Get execution)"
echo "-------------------------------------------------------"
read -p "Enter Execution ID (or press Enter to skip): " EXECUTION_ID

if [ ! -z "$EXECUTION_ID" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" "$STAGING_URL/api/workflows/$EXECUTION_ID" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
        echo "Response: $BODY" | jq '.' || echo "$BODY"
    else
        echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
        echo "Response: $BODY"
    fi
else
    echo "Skipped (no execution ID provided)"
fi

echo ""
read -p "Press Enter to continue..."

# Test 4: Cancel workflow
echo ""
echo "Test 4: DELETE /api/workflows/:executionId (Cancel workflow)"
echo "------------------------------------------------------------"
read -p "Enter Execution ID to cancel (or press Enter to skip): " CANCEL_EXECUTION_ID

if [ ! -z "$CANCEL_EXECUTION_ID" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$STAGING_URL/api/workflows/$CANCEL_EXECUTION_ID" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"reason\": \"Test cancellation\"
      }")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Status: $HTTP_CODE"
        echo "Response: $BODY" | jq '.' || echo "$BODY"
    else
        echo -e "${RED}❌ FAIL${NC} - Status: $HTTP_CODE"
        echo "Response: $BODY"
    fi
else
    echo "Skipped (no execution ID provided)"
fi

# Summary
echo ""
echo "================================="
echo -e "${GREEN}✅ API Testing Complete${NC}"
echo "================================="
echo ""
echo "Next steps:"
echo "1. Review test results above"
echo "2. Check database for workflow_executions records"
echo "3. Verify logs in Vercel/Supabase"
echo "4. Update deployment checklist"
