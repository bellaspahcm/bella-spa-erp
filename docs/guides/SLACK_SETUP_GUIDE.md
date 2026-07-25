# Slack Integration Setup Guide for Decision Engine

**Purpose**: Configure Slack to receive warning and informational alerts from Decision Engine  
**Time Required**: 15-20 minutes  
**Prerequisites**: Slack workspace with admin access  

---

## OVERVIEW

This guide walks you through:
1. Creating a Slack app for Decision Engine alerts
2. Configuring incoming webhooks
3. Setting up alert channels
4. Testing message delivery
5. Customizing alert formatting

**Alert Rules Configured** (from `monitoring/slack-rules.json`):
- ⚠️ **High Latency Warning** - P95 >20ms for 10 minutes
- ⚠️ **Low Cache Hit Rate** - <60% for 15 minutes
- ℹ️ **Dead Rule Detected** - Not executed in 48 hours
- ℹ️ **New Rule Deployed** - Notification when rule created

---

## STEP 1: CREATE SLACK APP

### 1.1 Navigate to Slack API

Go to: https://api.slack.com/apps

Click **Create New App**

### 1.2 Choose Creation Method

Select **From scratch**:
- **App Name**: `Decision Engine Alerts`
- **Workspace**: Select your workspace (e.g., "Bella Spa Team")
- Click **Create App**

### 1.3 Basic Information

You'll be redirected to app settings. Note:
- **App ID**: (automatically generated)
- **Client ID**: (you'll need this later)
- **Signing Secret**: (for webhook verification)

---

## STEP 2: CONFIGURE INCOMING WEBHOOKS

### 2.1 Enable Incoming Webhooks

**Navigate to**: `Features → Incoming Webhooks`

Toggle **Activate Incoming Webhooks**: `ON`

### 2.2 Add Webhook to Workspace

Scroll down → Click **Add New Webhook to Workspace**


**Select Channel**: 
- For production alerts: Create `#alerts` channel (if not exists)
- For dev/test: Create `#decision-engine-test` channel

Click **Allow**

### 2.3 Copy Webhook URL

You'll see **Webhook URL** (starts with `https://hooks.slack.com/services/...`)

Example:
```
https://hooks.slack.com/services/T01ABC234/B56DEF789/xxxxxxxxxxxxxxxxxxx1a2b3c
```

**IMPORTANT**: Copy this URL securely. You'll need it for:
1. Environment variables
2. GitHub Secrets
3. Testing

**Store in password manager** or `.env` file.

---

## STEP 3: CREATE ALERT CHANNELS

### 3.1 Create #alerts Channel (Critical Warnings)

In Slack workspace:
```
Click + next to Channels → Create a channel
```

**Channel Configuration**:
- **Name**: `alerts`
- **Description**: `Critical warnings from Decision Engine (high latency, low cache, errors)`
- **Privacy**: `Public` (so all team can see)
- Click **Create**

### 3.2 Invite Team Members

In `#alerts` channel:
```
/invite @backend-team @devops-team @oncall-engineer
```

### 3.3 Create #decision-engine Channel (Informational)

Repeat same process:
- **Name**: `decision-engine`
- **Description**: `Informational alerts (new rules, dead rules, deployments)`
- **Privacy**: `Public`

### 3.4 Set Channel Topic

In `#alerts`:
```
/topic Decision Engine Critical Warnings | Runbook: https://docs.bella-spa.com/runbook
```

In `#decision-engine`:
```
/topic Decision Engine Activity Feed | Docs: https://docs.bella-spa.com/platform
```

---

## STEP 4: CONFIGURE GITHUB SECRETS

### 4.1 Navigate to GitHub Secrets

Go to your repository:
```
https://github.com/bellaspahcm/bella-spa-erp/settings/secrets/actions
```

### 4.2 Add Slack Webhook URL

Click **New repository secret**:
- **Name**: `SLACK_WEBHOOK_URL`
- **Value**: (paste webhook URL from Step 2.3)
- Click **Add secret**

### 4.3 Verify Secret Added

You should see:
```
SLACK_WEBHOOK_URL     Updated X seconds ago
```

---

## STEP 5: TEST MESSAGE DELIVERY

### 5.1 Create Test Script

Create file: `scripts/test-slack-alert.sh`

```bash
#!/bin/bash
# Test Slack alert delivery

WEBHOOK_URL="${SLACK_WEBHOOK_URL}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "❌ Error: SLACK_WEBHOOK_URL not set"
  echo "Usage: SLACK_WEBHOOK_URL=xxx ./scripts/test-slack-alert.sh"
  exit 1
fi

echo "📤 Sending test alert to Slack..."

RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "✅ *Decision Engine Alert Test*",
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "🧪 Decision Engine Alert Test"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "This is a test alert to verify Slack integration.\n\n*Status*: All systems operational\n*Environment*: Test\n*Timestamp*: '"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "🔗 <https://docs.bella-spa.com/runbook|View Runbook> | <https://bella-spa.vercel.app/dashboard|Dashboard>"
          }
        ]
      }
    ]
  }')

if [ "$RESPONSE" = "ok" ]; then
  echo "✅ Test alert sent successfully!"
  echo "Check #alerts channel in Slack"
else
  echo "❌ Test alert failed"
  echo "Response: $RESPONSE"
  exit 1
fi
```

### 5.2 Make Script Executable

```bash
chmod +x scripts/test-slack-alert.sh
```

### 5.3 Run Test

```bash
SLACK_WEBHOOK_URL=your-webhook-url ./scripts/test-slack-alert.sh
```

**Expected Output**:
```
📤 Sending test alert to Slack...
✅ Test alert sent successfully!
Check #alerts channel in Slack
```

---

## STEP 6: VERIFY MESSAGE IN SLACK

### 6.1 Check #alerts Channel

Open Slack → Go to `#alerts` channel

You should see a message:
```
🧪 Decision Engine Alert Test
━━━━━━━━━━━━━━━━━━━━━━━
This is a test alert to verify Slack integration.

Status: All systems operational
Environment: Test
Timestamp: 2026-07-12T10:30:00Z

━━━━━━━━━━━━━━━━━━━━━━━
🔗 View Runbook | Dashboard
```

### 6.2 Test Mentions

Create another test with mentions:
```bash
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "⚠️ <!channel> High Latency Detected",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "⚠️ *High Latency Warning*\n\nP95 latency: 45ms (threshold: 20ms)\nProvider: booking\n\n<!channel> Please investigate"
        }
      }
    ]
  }'
```

**Verify**:
- Message appears with `@channel` mention
- You receive notification (desktop/mobile)


---

## STEP 7: CUSTOMIZE ALERT FORMATTING

### 7.1 Alert Templates

Create reusable templates for different alert types.

**High Latency Alert** (Warning):
```json
{
  "text": "⚠️ High Latency Detected",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "⚠️ High Latency Warning"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Provider:*\nbooking" },
        { "type": "mrkdwn", "text": "*P95 Latency:*\n45ms" },
        { "type": "mrkdwn", "text": "*Threshold:*\n20ms" },
        { "type": "mrkdwn", "text": "*Duration:*\n10 minutes" }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Recommended Action:*\nCheck cache hit rate and Redis status"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View Runbook" },
          "url": "https://docs.bella-spa.com/runbook#high-latency"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Dashboard" },
          "url": "https://bella-spa.vercel.app/dashboard/decision-engine"
        }
      ]
    }
  ]
}
```

**New Rule Deployed** (Info):
```json
{
  "text": "✅ New Rule Deployed",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "✅ *New Rule Deployed*\n\n*Rule ID:* `kpi_bonus_rule_v2`\n*Provider:* payroll\n*Priority:* 100\n*Created by:* @engineer"
      }
    }
  ]
}
```

### 7.2 Add Emojis for Quick Recognition

Use consistent emojis:
- ❌ `Critical errors` - Decision Engine down, database failure
- ⚠️ `Warnings` - High latency, low cache hit rate
- ℹ️ `Info` - New rules, dead rules
- ✅ `Success` - Deployments, tests passed
- 📊 `Metrics` - Performance reports, summaries

### 7.3 Color Coding (Attachments)

For legacy Slack apps or simpler formatting:
```json
{
  "attachments": [
    {
      "color": "#ff0000",
      "title": "❌ Critical Alert",
      "text": "Decision Engine is down",
      "footer": "Decision Engine Platform"
    }
  ]
}
```

Colors:
- `#ff0000` - Red (critical)
- `#ff9900` - Orange (warning)
- `#36a64f` - Green (success)
- `#439fe0` - Blue (info)

---

## STEP 8: CONFIGURE ALERT ROUTING

### 8.1 Create Webhook for Each Channel

If you want different alerts to different channels:

**For #alerts** (warnings):
- Create webhook → Select `#alerts`
- Store as `SLACK_WEBHOOK_ALERTS`

**For #decision-engine** (info):
- Create webhook → Select `#decision-engine`
- Store as `SLACK_WEBHOOK_INFO`

### 8.2 Route Alerts in Code

```typescript
// In your alerting service
const webhookUrl = severity === 'warning' 
  ? process.env.SLACK_WEBHOOK_ALERTS 
  : process.env.SLACK_WEBHOOK_INFO;

await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(alertMessage)
});
```

---

## STEP 9: SET UP ALERT THREADING

### 9.1 Use Thread Replies for Updates

When sending follow-up alerts about same issue:
```json
{
  "text": "Update: Issue resolved",
  "thread_ts": "1234567890.123456"
}
```

This keeps related alerts in one thread instead of spam.

### 9.2 Implement Deduplication

Store alert fingerprints in Redis:
```typescript
const fingerprint = `${provider}:${alertType}:${date}`;
const exists = await redis.get(`alert:${fingerprint}`);

if (!exists) {
  await sendSlackAlert(message);
  await redis.set(`alert:${fingerprint}`, '1', 'EX', 3600); // 1 hour
}
```

---

## TROUBLESHOOTING

### Issue 1: "Invalid Webhook URL" Error

**Symptoms**: Curl returns `invalid_payload` or 404

**Solutions**:
1. Verify webhook URL is complete (starts with `https://hooks.slack.com/services/`)
2. Ensure no extra spaces or newlines in URL
3. Check webhook is not revoked in Slack app settings
4. Try regenerating webhook URL

### Issue 2: Messages Not Appearing

**Symptoms**: Curl returns "ok" but no message in channel

**Solutions**:
1. Verify you're checking correct channel
2. Check app not removed from channel
3. Verify workspace permissions allow app posting
4. Try `/invite @Decision Engine Alerts` in channel

### Issue 3: Mentions Not Working

**Symptoms**: `@channel` appears as plain text

**Solutions**:
1. Use `<!channel>` instead of `@channel` in message
2. Use `<!here>` for online members only
3. For specific users: `<@U01234ABC>` (user ID, not username)

### Issue 4: Formatting Not Rendering

**Symptoms**: JSON visible instead of formatted message

**Solutions**:
1. Ensure `Content-Type: application/json` header
2. Validate JSON syntax (use jsonlint.com)
3. Check blocks format matches Slack Block Kit spec
4. Test in Block Kit Builder: https://app.slack.com/block-kit-builder

---

## PRODUCTION ALERT CONFIGURATION

### Real Alert Implementation

Example integration in monitoring system:

```typescript
// In scripts/collect-metrics.ts
async function sendSlackAlert(alert: Alert) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL!;
  
  const message = {
    text: `${alert.emoji} ${alert.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${alert.emoji} ${alert.title}`
        }
      },
      {
        type: 'section',
        fields: alert.fields.map(f => ({
          type: 'mrkdwn',
          text: `*${f.label}:*\n${f.value}`
        }))
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recommended Action:*\n${alert.action}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Runbook' },
            url: alert.runbookUrl
          }
        ]
      }
    ]
  };
  
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
}
```

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] ✅ Slack app created (`Decision Engine Alerts`)
- [ ] ✅ Incoming webhooks activated
- [ ] ✅ Webhook URL copied and stored securely
- [ ] ✅ `#alerts` channel created
- [ ] ✅ `#decision-engine` channel created
- [ ] ✅ Team members invited to channels
- [ ] ✅ GitHub secret `SLACK_WEBHOOK_URL` added
- [ ] ✅ Test script created and executable
- [ ] ✅ Test alert sent successfully
- [ ] ✅ Message appears in Slack channel
- [ ] ✅ Formatting renders correctly
- [ ] ✅ Buttons/links work
- [ ] ✅ Mentions work (`@channel`)
- [ ] ✅ Desktop/mobile notifications received
- [ ] ✅ Alert templates documented

**All checkboxes checked?** ✅ **Slack integration is COMPLETE!**

---

## NEXT STEPS

1. **Configure Vercel Environment Variables** - Add `SLACK_WEBHOOK_URL` to production
2. **Deploy Alert Logic** - Implement real-time alerting in monitoring system
3. **Monitor for 24 Hours** - Verify no spam or false positives
4. **Adjust Thresholds** - Fine-tune alert rules based on real data
5. **Document Custom Alerts** - Add any team-specific alert rules

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-07-12  
**Maintainer**: DevOps Team  
