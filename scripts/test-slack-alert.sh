#!/bin/bash
# Test Slack alert delivery for Decision Engine
# Usage: SLACK_WEBHOOK_URL=xxx ./scripts/test-slack-alert.sh

WEBHOOK_URL="${SLACK_WEBHOOK_URL}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "❌ Error: SLACK_WEBHOOK_URL not set"
  echo "Usage: SLACK_WEBHOOK_URL=xxx ./scripts/test-slack-alert.sh"
  exit 1
fi

echo "📤 Sending test alert to Slack..."
echo "Webhook URL: ${WEBHOOK_URL:0:40}..."

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ *Decision Engine Alert Test*",
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "🧪 Decision Engine Alert Test",
          "emoji": true
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "This is a test alert to verify Slack integration.\n\n*Status:* All systems operational\n*Environment:* Test\n*Timestamp:* '"$TIMESTAMP"'"
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": "*Provider:*\ntest"
          },
          {
            "type": "mrkdwn",
            "text": "*Alert Type:*\ntest"
          },
          {
            "type": "mrkdwn",
            "text": "*Severity:*\ninfo"
          },
          {
            "type": "mrkdwn",
            "text": "*Source:*\ntest-script"
          }
        ]
      },
      {
        "type": "divider"
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "View Runbook",
              "emoji": true
            },
            "url": "https://docs.bella-spa.com/runbook",
            "style": "primary"
          },
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Dashboard",
              "emoji": true
            },
            "url": "https://bella-spa.vercel.app/dashboard/decision-engine"
          }
        ]
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "Decision Engine Platform | Test Alert"
          }
        ]
      }
    ]
  }')

echo ""

if [ "$RESPONSE" = "ok" ]; then
  echo "✅ Test alert sent successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Open Slack and check your channel"
  echo "2. Verify message appears with proper formatting"
  echo "3. Click buttons to verify links work"
  echo "4. Check you received desktop/mobile notification"
else
  echo "❌ Test alert failed"
  echo "Response: $RESPONSE"
  echo ""
  echo "Possible issues:"
  echo "- Invalid webhook URL"
  echo "- App removed from channel"
  echo "- Network connectivity issues"
  exit 1
fi
