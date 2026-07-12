#!/bin/bash
# Test PagerDuty alert delivery for Decision Engine
# Usage: PAGERDUTY_INTEGRATION_KEY=xxx ./scripts/test-pagerduty-alert.sh

INTEGRATION_KEY="${PAGERDUTY_INTEGRATION_KEY}"

if [ -z "$INTEGRATION_KEY" ]; then
  echo "❌ Error: PAGERDUTY_INTEGRATION_KEY not set"
  echo "Usage: PAGERDUTY_INTEGRATION_KEY=xxx ./scripts/test-pagerduty-alert.sh"
  exit 1
fi

echo "📤 Sending test alert to PagerDuty..."
echo "Integration Key: ${INTEGRATION_KEY:0:8}..."

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RESPONSE=$(curl -s -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d "{
    \"routing_key\": \"$INTEGRATION_KEY\",
    \"event_action\": \"trigger\",
    \"dedup_key\": \"test-alert-$(date +%s)\",
    \"payload\": {
      \"summary\": \"[TEST] Decision Engine Alert Test\",
      \"severity\": \"critical\",
      \"source\": \"decision-engine-test\",
      \"timestamp\": \"$TIMESTAMP\",
      \"component\": \"test-script\",
      \"group\": \"decision-engine\",
      \"class\": \"test\",
      \"custom_details\": {
        \"message\": \"This is a test alert to verify PagerDuty integration\",
        \"provider\": \"test\",
        \"environment\": \"test\",
        \"runbook_url\": \"https://docs.bella-spa.com/runbook\",
        \"timestamp\": \"$TIMESTAMP\"
      }
    },
    \"links\": [
      {
        \"href\": \"https://docs.bella-spa.com/runbook\",
        \"text\": \"View Runbook\"
      },
      {
        \"href\": \"https://bella-spa.vercel.app/dashboard/decision-engine\",
        \"text\": \"Dashboard\"
      }
    ]
  }")

echo ""
echo "Response:"
echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "\"status\":\"success\""; then
  echo "✅ Test alert sent successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Check PagerDuty dashboard: https://app.pagerduty.com/incidents"
  echo "2. Verify incident appears with title: [TEST] Decision Engine Alert Test"
  echo "3. Check you received notification (email/SMS/push)"
  echo "4. Acknowledge the incident"
  echo "5. Resolve the incident"
else
  echo "❌ Test alert failed"
  echo ""
  echo "Possible issues:"
  echo "- Invalid integration key"
  echo "- Service disabled or deleted"
  echo "- Network connectivity issues"
  exit 1
fi
