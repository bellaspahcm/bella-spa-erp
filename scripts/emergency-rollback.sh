#!/bin/bash
# Emergency Rollback Script for Bella ERP
# Usage: ./scripts/emergency-rollback.sh [reason]

set -e

REASON=$1

if [ -z "$REASON" ]; then
  echo "Usage: ./scripts/emergency-rollback.sh <reason>"
  echo "Example: ./scripts/emergency-rollback.sh 'payment-webhook-broken'"
  exit 1
fi

echo "=========================================="
echo "🚨 EMERGENCY ROLLBACK INITIATED"
echo "=========================================="
echo "Reason: $REASON"
echo "Time: $(date)"
echo ""

# Get current and previous deployments
echo "📋 Fetching deployment information..."
CURRENT_DEPLOYMENT=$(vercel ls bella-erp-production --json 2>/dev/null | jq -r '.[0].url' 2>/dev/null || echo "unknown")
PREVIOUS_DEPLOYMENT=$(vercel ls bella-erp-production --json 2>/dev/null | jq -r '.[1].url' 2>/dev/null || echo "unknown")

echo "Current deployment: $CURRENT_DEPLOYMENT"
echo "Rolling back to: $PREVIOUS_DEPLOYMENT"
echo ""

# Confirm rollback
echo "⚠️  This will rollback production to the previous deployment."
echo "⚠️  This action affects LIVE USERS!"
echo ""
echo "Type 'ROLLBACK' to confirm:"
read -r confirmation

if [ "$confirmation" != "ROLLBACK" ]; then
  echo "❌ Rollback cancelled"
  exit 1
fi

# Execute rollback
echo ""
echo "⏳ Executing rollback..."
vercel promote "$PREVIOUS_DEPLOYMENT" --scope=bella-erp-production --yes

# Wait for propagation
echo "⏳ Waiting for deployment to propagate (30 seconds)..."
sleep 30

# Health check
echo "🏥 Running health check..."
HEALTH_RESPONSE=$(curl -s https://bella-erp.com/api/health)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")

echo ""
if [ "$HEALTH_STATUS" = "healthy" ]; then
  echo "✅ Rollback successful! Production is healthy."
else
  echo "⚠️  Health check status: $HEALTH_STATUS"
  echo "Response: $HEALTH_RESPONSE"
  echo ""
  echo "⚠️  Investigate immediately!"
  exit 1
fi

# Log rollback
echo "[$(date)] ROLLBACK: $REASON → $PREVIOUS_DEPLOYMENT" >> rollback-log.txt

# Notify team (if Slack webhook configured)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  echo "📢 Notifying team via Slack..."
  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"🚨 *Production Rollback Executed*\n\n*Reason:* $REASON\n*Rolled back to:* $PREVIOUS_DEPLOYMENT\n*Time:* $(date)\n*Status:* ✅ Healthy\"}" \
    2>/dev/null || echo "⚠️  Slack notification failed"
fi

echo ""
echo "=========================================="
echo "✅ ROLLBACK COMPLETE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. ✅ Verify production is working normally"
echo "2. 🔍 Investigate root cause of the issue"
echo "3. 📝 Create post-mortem document in docs/incidents/"
echo "4. 🛠️  Fix the issue and create new deployment"
echo "5. 🧪 Test thoroughly before re-deploying"
echo ""
