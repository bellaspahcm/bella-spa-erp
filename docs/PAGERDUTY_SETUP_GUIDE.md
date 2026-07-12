# PagerDuty Integration Setup Guide for Decision Engine

**Purpose**: Configure PagerDuty to receive critical alerts from Decision Engine  
**Time Required**: 20-30 minutes  
**Prerequisites**: PagerDuty account (free trial available at pagerduty.com)  

---

## OVERVIEW

This guide walks you through:
1. Creating a PagerDuty service for Decision Engine
2. Configuring escalation policies
3. Setting up integration keys
4. Testing alert delivery
5. Verifying incident creation

**Alert Rules Configured** (from `monitoring/pagerduty-rules.json`):
- ❌ **Decision Engine Down** - No decisions for 5 minutes (CRITICAL)
- ❌ **High Error Rate** - >5% errors for any provider (CRITICAL)
- ❌ **Database Connection Failure** - Connection pool exhausted (CRITICAL)

---

## STEP 1: CREATE PAGERDUTY SERVICE

### 1.1 Login to PagerDuty

Go to: https://app.pagerduty.com/

If you don't have an account:
- Click "Start Free Trial"
- Enter company email
- Create organization name: e.g., "Bella Spa ERP"
- Verify email

### 1.2 Create Service

**Navigate to Services**:
```
Dashboard → Services → Create Service
```

**Service Configuration**:
- **Name**: `Decision Engine`
- **Description**: `Critical alerts for Decision Engine Platform - booking, discount, payroll, commission providers`
- **Integration Type**: `Events API V2`
- **Escalation Policy**: (create new or use existing - see next step)
- **Incident Urgency**: `High` (for all alerts)
- **Auto-Resolution**: `Disabled` (require manual acknowledgment)
- **Alert Grouping**: `Intelligent` (group similar alerts)

Click **Create Service**


### 1.3 Create Escalation Policy (if needed)

**Navigate to Escalation Policies**:
```
Dashboard → People → Escalation Policies → Create Escalation Policy
```

**Recommended Configuration**:

**Policy Name**: `Engineering On-Call`

**Escalation Rules**:
1. **Level 1** (immediate):
   - Notify: `On-Call Engineer` (create schedule)
   - After: `0 minutes`
   
2. **Level 2** (if not acknowledged):
   - Notify: `Engineering Manager`
   - After: `15 minutes`
   
3. **Level 3** (if still not acknowledged):
   - Notify: `CTO` + `Engineering Manager`
   - After: `30 minutes`

**Repeat escalation**: `Every 30 minutes` (until acknowledged)

Click **Save**

---

## STEP 2: CONFIGURE ON-CALL SCHEDULE

### 2.1 Create Schedule

**Navigate to Schedules**:
```
Dashboard → People → Schedules → Create Schedule
```

**Schedule Configuration**:
- **Name**: `Engineering On-Call Rotation`
- **Time Zone**: `Asia/Ho_Chi_Minh` (UTC+7)
- **Rotation Type**: `Weekly`
- **Handoff Time**: `Monday 9:00 AM`

**Add Team Members**:
- Add at least 2 engineers for rotation
- Example: Week 1: Engineer A, Week 2: Engineer B

Click **Create Schedule**

### 2.2 Link Schedule to Escalation Policy

Go back to: `People → Escalation Policies → Engineering On-Call → Edit`

**Level 1**: Change from "User" to "Schedule"
- Select: `Engineering On-Call Rotation`

Click **Save**

---

## STEP 3: GET INTEGRATION KEY

### 3.1 Find Integration Key

**Navigate to Service**:
```
Dashboard → Services → Decision Engine
```

**Integrations Tab**:
- Click on `Events API V2` integration
- You'll see **Integration Key** (32-character string)
- Example: `R0ABCDE1234567890FGHIJKLMNOPQR`

### 3.2 Copy Integration Key

**IMPORTANT**: Copy this key securely. You'll need it for:
1. GitHub Secrets configuration
2. Vercel environment variables
3. Local testing

**Store in password manager** or secure location.


---

## STEP 4: CONFIGURE GITHUB SECRETS

### 4.1 Navigate to GitHub Secrets

Go to your repository:
```
https://github.com/bellaspahcm/bella-spa-erp/settings/secrets/actions
```

### 4.2 Add PagerDuty Integration Key

Click **New repository secret**:
- **Name**: `PAGERDUTY_INTEGRATION_KEY`
- **Value**: (paste the integration key from Step 3.1)
- Click **Add secret**

### 4.3 Verify Secret Added

You should see:
```
PAGERDUTY_INTEGRATION_KEY     Updated X seconds ago
```

---

## STEP 5: TEST ALERT DELIVERY

### 5.1 Create Test Script

Create file: `scripts/test-pagerduty-alert.sh`

```bash
#!/bin/bash
# Test PagerDuty alert delivery

INTEGRATION_KEY="${PAGERDUTY_INTEGRATION_KEY}"

if [ -z "$INTEGRATION_KEY" ]; then
  echo "❌ Error: PAGERDUTY_INTEGRATION_KEY not set"
  echo "Usage: PAGERDUTY_INTEGRATION_KEY=xxx ./scripts/test-pagerduty-alert.sh"
  exit 1
fi

echo "📤 Sending test alert to PagerDuty..."

RESPONSE=$(curl -s -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d "{
    \"routing_key\": \"$INTEGRATION_KEY\",
    \"event_action\": \"trigger\",
    \"payload\": {
      \"summary\": \"[TEST] Decision Engine Alert Test\",
      \"severity\": \"critical\",
      \"source\": \"decision-engine-test\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"custom_details\": {
        \"message\": \"This is a test alert to verify PagerDuty integration\",
        \"provider\": \"test\",
        \"environment\": \"test\"
      }
    }
  }")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "\"status\":\"success\""; then
  echo "✅ Test alert sent successfully!"
  echo "Check PagerDuty dashboard for incident"
else
  echo "❌ Test alert failed"
  echo "Response: $RESPONSE"
  exit 1
fi
```

### 5.2 Make Script Executable

```bash
chmod +x scripts/test-pagerduty-alert.sh
```

### 5.3 Run Test

```bash
PAGERDUTY_INTEGRATION_KEY=your-key-here ./scripts/test-pagerduty-alert.sh
```

**Expected Output**:
```
📤 Sending test alert to PagerDuty...
Response: {"status":"success","message":"Event processed","dedup_key":"..."}
✅ Test alert sent successfully!
Check PagerDuty dashboard for incident
```

---

## STEP 6: VERIFY INCIDENT CREATION

### 6.1 Check PagerDuty Dashboard

Go to: `Dashboard → Incidents`

You should see a new incident:
- **Title**: `[TEST] Decision Engine Alert Test`
- **Status**: `Triggered` (red badge)
- **Service**: `Decision Engine`
- **Assigned To**: On-call engineer

### 6.2 Acknowledge Incident

Click on the incident → Click **Acknowledge**

**Verify**:
- Status changes to `Acknowledged` (orange badge)
- You receive acknowledgment notification (email/SMS/push)

### 6.3 Resolve Incident

Click **Resolve**

**Verify**:
- Status changes to `Resolved` (green badge)
- Incident closes


---

## STEP 7: CONFIGURE NOTIFICATION CHANNELS

### 7.1 Email Notifications

**Navigate to**: `User Profile → Notification Rules`

**Add Rule**:
- **When**: `A high-urgency incident is assigned to me`
- **Notify me by**: `Email`
- **After**: `Immediately`

### 7.2 SMS Notifications (Recommended)

**Add Rule**:
- **When**: `A high-urgency incident is assigned to me`
- **Notify me by**: `SMS`
- **After**: `Immediately`
- **Phone Number**: Add your mobile number

### 7.3 Push Notifications (PagerDuty Mobile App)

**Install App**:
- iOS: https://apps.apple.com/app/pagerduty/id594039512
- Android: https://play.google.com/store/apps/details?id=com.pagerduty.android

**Add Rule**:
- **When**: `A high-urgency incident is assigned to me`
- **Notify me by**: `Push Notification`
- **After**: `Immediately`

### 7.4 Test Notifications

Run test alert again:
```bash
./scripts/test-pagerduty-alert.sh
```

**Verify you receive**:
- ✅ Email notification
- ✅ SMS notification (if configured)
- ✅ Push notification (if configured)

---

## STEP 8: CONFIGURE VERCEL INTEGRATION (OPTIONAL)

### 8.1 Add PagerDuty Integration to Vercel

Go to: `Vercel Dashboard → Integrations → Browse Marketplace`

Search for **PagerDuty** → Click **Add Integration**

### 8.2 Connect to Service

- Select project: `bella-spa-erp`
- Select service: `Decision Engine`
- Configure alerts: `All production errors`

### 8.3 Test Vercel Integration

Trigger an error in production → Verify incident created in PagerDuty

---

## TROUBLESHOOTING

### Issue 1: Test Alert Not Received

**Symptoms**: Script returns success but no incident in dashboard

**Solutions**:
1. Verify integration key is correct (32 characters)
2. Check service is not paused/disabled
3. Verify escalation policy has at least one user
4. Check user notification rules are configured

### Issue 2: Notifications Not Received

**Symptoms**: Incident created but no email/SMS/push

**Solutions**:
1. Check notification rules in user profile
2. Verify phone number/email verified
3. Check spam folder for emails
4. Ensure mobile app installed and logged in

### Issue 3: "Invalid Routing Key" Error

**Symptoms**: API returns `{"status":"invalid","errors":["Routing key is invalid"]}`

**Solutions**:
1. Integration key must be from **Events API V2** (not legacy)
2. Copy key directly from PagerDuty dashboard (no extra spaces)
3. Verify service still exists and is not deleted

---

## PRODUCTION ALERT CONFIGURATION

### Real Alert Implementation

After testing, configure production alerts in your monitoring system.

**Example: Vercel Log Drain** (sends logs to external system)
```javascript
// In your monitoring/alerting service
if (decisionCount === 0 && timeWindow === '5m') {
  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: process.env.PAGERDUTY_INTEGRATION_KEY,
      event_action: 'trigger',
      dedup_key: 'decision-engine-down',
      payload: {
        summary: 'Decision Engine Down - No decisions in 5 minutes',
        severity: 'critical',
        source: 'decision-engine',
        custom_details: {
          runbook: 'https://docs.bella-spa.com/runbook#decision-engine-down',
          last_decision_time: lastDecisionTime,
          environment: 'production'
        }
      }
    })
  });
}
```

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] ✅ PagerDuty service created (`Decision Engine`)
- [ ] ✅ Escalation policy configured (`Engineering On-Call`)
- [ ] ✅ On-call schedule created with team members
- [ ] ✅ Integration key copied and stored securely
- [ ] ✅ GitHub secret `PAGERDUTY_INTEGRATION_KEY` added
- [ ] ✅ Test script created and executable
- [ ] ✅ Test alert sent successfully
- [ ] ✅ Incident appears in PagerDuty dashboard
- [ ] ✅ Email notification received
- [ ] ✅ SMS notification received (if configured)
- [ ] ✅ Push notification received (if app installed)
- [ ] ✅ Can acknowledge incident
- [ ] ✅ Can resolve incident
- [ ] ✅ Vercel integration configured (optional)

**All checkboxes checked?** ✅ **PagerDuty integration is COMPLETE!**

---

## NEXT STEPS

1. **Configure Slack Integration** - See `SLACK_SETUP_GUIDE.md`
2. **Deploy to Production** - Alerts will now trigger PagerDuty
3. **Monitor for 24 Hours** - Verify no false positives
4. **Adjust Thresholds** - Fine-tune alert rules if needed

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-07-12  
**Maintainer**: DevOps Team  
