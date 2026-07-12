# Decision Engine Monitoring Setup

This directory contains alert rules and monitoring configurations for the Decision Engine Platform.

## Files

### Alert Rules
- **`pagerduty-rules.json`**: Critical alerts that trigger PagerDuty incidents
  - Decision Engine Down (no decisions for 5 min)
  - High Error Rate (>5% errors)
  - Database Connection Failure (connection pool exhausted)

- **`slack-rules.json`**: Warning and informational alerts sent to Slack
  - High Latency Warning (P95 >20ms)
  - Low Cache Hit Rate (<60%)
  - Dead Rule Detected (not executed in 48 hours)
  - New Rule Deployed (info notification)

### Load Testing
- **`artillery-loadtest.yml`**: Artillery configuration for load testing
  - Normal load: 10 users/sec
  - Peak load: 50 users/sec
  - Stress test: Ramp up to 100 users/sec

## Setup Instructions

### 1. PagerDuty Integration

**Step 1**: Create PagerDuty service
```bash
# Go to PagerDuty dashboard → Services → Create Service
# Name: "Decision Engine"
# Escalation Policy: "Engineering On-Call"
# Copy integration key
```

**Step 2**: Configure webhook in Vercel
```bash
# Vercel dashboard → Integrations → PagerDuty
# Paste integration key
# Select alert rules: All critical alerts
```

**Step 3**: Test alert
```bash
# Trigger test alert
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_INTEGRATION_KEY",
    "event_action": "trigger",
    "payload": {
      "summary": "Decision Engine test alert",
      "severity": "critical",
      "source": "decision-engine"
    }
  }'
```

### 2. Slack Integration

**Step 1**: Create Slack app
```bash
# Go to api.slack.com/apps → Create New App
# Add permissions: chat:write, chat:write.public
# Install to workspace
# Copy webhook URL
```

**Step 2**: Configure Slack webhook
```bash
# Add to Vercel environment variables
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Step 3**: Test notification
```bash
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Decision Engine test alert ✅"}'
```

### 3. Load Testing Setup

**Install Artillery**:
```bash
npm install -g artillery
```

**Run load test**:
```bash
# Normal load test
artillery run monitoring/artillery-loadtest.yml

# Quick smoke test (10 seconds)
artillery quick --duration 10 --rate 5 \
  https://bella-spa.vercel.app/api/health

# Generate HTML report
artillery run monitoring/artillery-loadtest.yml \
  --output monitoring/results.json
artillery report monitoring/results.json
```

## Monitoring Dashboards

### Vercel Dashboard
- URL: https://vercel.com/dashboard
- Metrics: Request count, latency, error rate
- Logs: Real-time application logs

### Supabase Dashboard
- URL: https://app.supabase.com/project/YOUR_PROJECT/database/metrics
- Metrics: Database CPU, connections, query performance
- Logs: SQL queries, slow queries

### Upstash Dashboard (Redis)
- URL: https://console.upstash.com/redis/YOUR_REDIS
- Metrics: Memory usage, commands/sec, hit rate
- Logs: Redis commands

## Alert Response Procedures

### Critical Alerts (PagerDuty)

1. **Decision Engine Down**
   - Acknowledge alert in PagerDuty
   - Check Vercel deployment status
   - Run health check: `npm run health:check -- --env=production`
   - Follow runbook: Section 3.1

2. **High Error Rate**
   - Identify failing provider in logs
   - Check recent rule deployments
   - Consider disabling problematic rules
   - Follow runbook: Section 3.1 Issue #4

3. **Database Connection Failure**
   - Check Supabase connection pool usage
   - Verify no long-running queries
   - Consider increasing pool size
   - Follow runbook: Section 3.1 Issue #1

### Warning Alerts (Slack)

1. **High Latency**
   - Check cache hit rate (may be Redis issue)
   - Review slow queries in Supabase
   - Follow runbook: Section 3.1 Issue #2

2. **Low Cache Hit Rate**
   - Check Redis status (Upstash dashboard)
   - Run cache warmup: `npm run cache:warmup`
   - Follow runbook: Section 3.1 Issue #3

3. **Dead Rule Detected**
   - Review rule configuration
   - Determine if rule is still needed
   - Consider deprecating unused rules

## Maintenance

### Weekly Tasks
- [ ] Review alert history (any false positives?)
- [ ] Check alert rule effectiveness
- [ ] Update escalation policies if needed

### Monthly Tasks
- [ ] Run load test to verify performance baselines
- [ ] Review alert thresholds (still appropriate?)
- [ ] Update this documentation if procedures changed

## Related Documentation
- Production Runbook: `../docs/DECISION_ENGINE_PRODUCTION_RUNBOOK.md`
- Architecture: `../docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md`
- Performance Report: `../docs/DECISION_ENGINE_PERFORMANCE_REPORT.md`
