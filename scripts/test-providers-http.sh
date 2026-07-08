#!/bin/bash
# Provider Activation Test Script (HTTP Method)
# Run: bash scripts/test-providers-http.sh

echo "🚀 Provider Activation Test (HTTP Method)"
echo "=========================================="
echo ""

# Step 1: Get usage instructions
echo "📖 Step 1: Getting API instructions..."
curl -s http://localhost:3000/api/test/recalculate-salary | jq '.'
echo ""
echo ""

# Step 2: Get tenant context
echo "🏢 Step 2: Getting tenant ID..."
TENANT_RESPONSE=$(curl -s http://localhost:3000/api/tenant/context)
TENANT_ID=$(echo $TENANT_RESPONSE | jq -r '.tenant_id // .tenantId // empty')

if [ -z "$TENANT_ID" ]; then
  echo "❌ ERROR: Could not get tenant ID. Response:"
  echo "$TENANT_RESPONSE" | jq '.'
  echo ""
  echo "Please login to localhost:3000 first and try again."
  exit 1
fi

echo "✅ Tenant ID: $TENANT_ID"
echo ""

# Step 3: Prompt for employee ID
echo "👤 Step 3: Enter Employee ID (KTV ID from /dashboard/salary table):"
read -p "Employee ID: " EMPLOYEE_ID

if [ -z "$EMPLOYEE_ID" ]; then
  echo "❌ ERROR: Employee ID is required"
  exit 1
fi

echo ""
echo "📋 Test Configuration:"
echo "   Tenant ID: $TENANT_ID"
echo "   Employee ID: $EMPLOYEE_ID"
echo "   Month: 2026-06"
echo ""

# Step 4: Trigger recalculation
echo "⏳ Step 4: Triggering salary recalculation..."
echo "   (Watch npm run dev terminal for [PHASE_2_ACTIVE] logs)"
echo ""

RESULT=$(curl -s -X POST http://localhost:3000/api/test/recalculate-salary \
  -H "Content-Type: application/json" \
  -d "{
    \"employeeId\": \"$EMPLOYEE_ID\",
    \"tenantId\": \"$TENANT_ID\",
    \"month\": \"2026-06\"
  }")

echo "📊 Response:"
echo "$RESULT" | jq '.'
echo ""

# Check success
SUCCESS=$(echo "$RESULT" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✅ SUCCESS!"
  echo ""
  echo "🔍 Next Steps:"
  echo "   1. Check npm run dev terminal for [PHASE_2_ACTIVE] logs"
  echo "   2. If you see [PROVIDER_INTEGRATION] instead, providers are in comparison mode"
  echo "   3. To activate: set USE_CONFIG_PROVIDERS=true in .env.local"
  echo ""
else
  echo "❌ FAILED!"
  echo ""
  ERROR=$(echo "$RESULT" | jq -r '.error')
  echo "Error: $ERROR"
  echo ""
fi
