# Decision Engine Production Runbook

**Version**: 1.0.0  
**Date**: 2026-07-12  
**Status**: Production Ready  
**Audience**: DevOps, SRE, Backend Engineers  

---

## Document Overview

This runbook provides comprehensive guidance for deploying, monitoring, troubleshooting, and scaling the Decision Engine Platform in production environments.

**Contents**:
- Part 1: Deployment Guide (~500 lines)
- Part 2: Monitoring & Observability (~500 lines)
- Part 3: Troubleshooting Guide (~600 lines)
- Part 4: Scaling Guide (~400 lines)
- Part 5: Automation Scripts & Alerts (~200 lines)

**Prerequisites**:
- Node.js 18+ installed
- PostgreSQL 15+ (Supabase) access
- Redis 7+ instance available
- Environment secrets configured
- CI/CD pipeline (Vercel/GitHub Actions) access

---

# PART 1: DEPLOYMENT GUIDE

## 1.1 Overview

The Decision Engine Platform uses a multi-environment deployment strategy:
- **Local**: Development and testing
- **Staging**: Integration testing and pre-production validation
- **Production**: Live customer traffic

**Deployment Flow**:
```
Local → Staging → Production
  ↓        ↓          ↓
Tests → Integration → Smoke Tests
```


## 1.2 Local Deployment

### Environment Setup

**Step 1: Clone Repository**
```bash
git clone https://github.com/your-org/bella-spa-erp.git
cd bella-spa-erp
```

**Step 2: Install Dependencies**
```bash
npm install
```

**Step 3: Configure Environment Variables**
Create `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key

# Redis (local)
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600

# Decision Engine
DECISION_ENGINE_LOG_LEVEL=debug
DECISION_ENGINE_CACHE_ENABLED=true
DECISION_ENGINE_METRICS_ENABLED=true
```

**Step 4: Start Local Services**
```bash
# Start Supabase (Docker required)
npx supabase start

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start Next.js dev server
npm run dev
```


### Database Migration

**Run Migrations**:
```bash
# Apply all pending migrations
npx supabase db push

# Verify migration status
npx supabase db status

# Rollback last migration (if needed)
npx supabase db reset --skip-seed
```

**Seed Decision Engine Rules**:
```bash
# Seed default rules for all providers
npm run seed:rules

# Verify rules loaded
npm run test:rules
```

### Verification

**Run Tests**:
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Decision Engine specific tests
npm test -- src/lib/decision-engine
```

**Expected Results**:
- ✅ All tests passing (337+ tests)
- ✅ Dev server running on http://localhost:3000
- ✅ Supabase Studio on http://localhost:54323
- ✅ Redis ping successful


## 1.3 Staging Deployment

### Environment Configuration

**Staging Environment Variables** (Vercel Dashboard):
```bash
# Supabase (Staging Project)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-key

# Redis (Upstash Staging)
REDIS_URL=redis://default:password@staging-redis.upstash.io:6379
REDIS_CACHE_TTL=1800

# Decision Engine
DECISION_ENGINE_LOG_LEVEL=info
DECISION_ENGINE_CACHE_ENABLED=true
DECISION_ENGINE_METRICS_ENABLED=true
DECISION_ENGINE_AUDIT_ENABLED=true
```

### Deployment Process

**Step 1: Push to Staging Branch**
```bash
# Create staging branch from main
git checkout -b staging
git push origin staging
```

**Step 2: Trigger Vercel Deployment**
Vercel auto-deploys on push to `staging` branch.

**Monitor deployment**:
```bash
# View deployment logs
vercel logs --app=bella-spa-staging

# Check deployment status
vercel inspect https://bella-spa-staging.vercel.app
```

**Step 3: Run Database Migrations**
```bash
# Connect to staging database
npx supabase link --project-ref your-staging-project

# Apply migrations
npx supabase db push --project-ref your-staging-project
```


### Staging Verification

**Smoke Tests**:
```bash
# Health check
curl https://bella-spa-staging.vercel.app/api/health

# Decision Engine status
curl https://bella-spa-staging.vercel.app/api/decision-engine/status

# Run automated E2E tests
npm run test:e2e -- --env=staging
```

**Manual Verification Checklist**:
- [ ] Booking provider decisions working (create test booking)
- [ ] Discount provider decisions working (apply test discount)
- [ ] Payroll provider decisions working (calculate test salary)
- [ ] Commission provider decisions working (calculate test commission)
- [ ] Inventory provider decisions working (test reorder decision)
- [ ] Workflow engine executing (trigger test workflow)
- [ ] Rule Management UI accessible (login as admin)
- [ ] Metrics being collected (check Redis cache hit rate)
- [ ] Audit logs being written (check `decision_audit_logs` table)
- [ ] No console errors in browser

**Performance Baseline** (expected staging results):
- Average decision latency: <5ms
- Cache hit rate: >80%
- P95 latency: <15ms
- Throughput: >500 decisions/sec


## 1.4 Production Deployment

### Pre-Deployment Checklist

**Code Quality Gates**:
- [ ] All tests passing (100%)
- [ ] No TypeScript errors (`npm run build`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Security scan passed (`npm audit`)
- [ ] Performance benchmarks met (see Task 3 report)
- [ ] Staging deployment successful for 24+ hours
- [ ] No critical bugs in staging environment

**Database Readiness**:
- [ ] Migration scripts tested in staging
- [ ] Rollback scripts prepared
- [ ] Database backup completed (<1 hour old)
- [ ] Connection pool limits verified (100+ connections)

**Infrastructure Readiness**:
- [ ] Redis instance scaled appropriately (2GB+ memory)
- [ ] CDN cache cleared (if applicable)
- [ ] Rate limits configured (1000 req/min per IP)
- [ ] Auto-scaling enabled (Vercel serverless)

### Deployment Process

**Step 1: Create Release Tag**
```bash
# Tag release
git tag -a v1.0.0 -m "Decision Engine Platform v1.0.0"
git push origin v1.0.0
```

**Step 2: Merge to Production Branch**
```bash
# Merge staging to main
git checkout main
git merge staging --no-ff
git push origin main
```


**Step 3: Deploy to Production (Vercel)**
```bash
# Trigger production deployment
vercel --prod

# Monitor deployment
vercel logs --prod --follow

# Check deployment status
vercel inspect https://bella-spa.vercel.app
```

**Step 4: Run Production Migrations**
```bash
# Connect to production database
npx supabase link --project-ref your-production-project

# Apply migrations (with backup confirmation)
npx supabase db push --project-ref your-production-project

# Verify migration applied
npx supabase db status --project-ref your-production-project
```

**Step 5: Warm Up Cache**
```bash
# Preload critical rules into Redis
npm run cache:warmup -- --env=production

# Verify cache populated
redis-cli -h production-redis.upstash.io keys "decision:*"
```

**Step 6: Enable Traffic Gradually** (Canary Deployment)
```bash
# Route 10% traffic to new version
vercel alias set bella-spa-v1-0-0.vercel.app bella-spa.vercel.app --weight=10

# Monitor error rates for 30 minutes
# If no errors, increase to 50%
vercel alias set bella-spa-v1-0-0.vercel.app bella-spa.vercel.app --weight=50

# Monitor for 1 hour, then route 100%
vercel alias set bella-spa-v1-0-0.vercel.app bella-spa.vercel.app --weight=100
```


### Post-Deployment Verification

**Automated Checks**:
```bash
# Health check
curl https://bella-spa.vercel.app/api/health
# Expected: {"status":"healthy","uptime":123,"timestamp":"2026-07-12T10:00:00Z"}

# Decision Engine status
curl https://bella-spa.vercel.app/api/decision-engine/status
# Expected: {"providers":6,"rules":83,"cacheHitRate":0.85,"avgLatency":0.6}

# Run production smoke tests
npm run test:smoke -- --env=production
```

**Manual Verification** (First 1 Hour):
- [ ] Monitor error logs (should be 0 decision engine errors)
- [ ] Check cache hit rate (should stabilize at >80% after 10 min)
- [ ] Verify audit logs writing correctly
- [ ] Test critical user flows (booking creation, payroll calculation)
- [ ] Check performance metrics (latency <5ms P95)

**Rollback Trigger Conditions**:
- Decision engine error rate >1%
- Average latency >50ms for 5+ minutes
- Cache completely failing (hit rate <10%)
- Critical business logic failure (wrong discount/salary calculation)
- Database connection pool exhausted


## 1.5 Rollback Procedures

### Immediate Rollback (Emergency)

**When to Execute**: Critical production failure requiring instant rollback.

**Step 1: Revert Vercel Deployment** (< 2 minutes)
```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel alias set bella-spa-previous.vercel.app bella-spa.vercel.app

# Verify rollback
curl https://bella-spa.vercel.app/api/health
```

**Step 2: Monitor Recovery**
```bash
# Check error rates dropped
vercel logs --prod | grep ERROR

# Verify cache working
redis-cli -h production-redis.upstash.io ping
```

**Step 3: Communicate Incident**
- [ ] Notify #engineering channel (Slack)
- [ ] Update status page (if customer-facing)
- [ ] Document incident in postmortem template

### Database Rollback (Rare)

**When Needed**: Migration caused data corruption or breaking changes.

**Step 1: Stop Application Traffic**
```bash
# Set maintenance mode
vercel env add MAINTENANCE_MODE true --prod
vercel deploy --prod
```


**Step 2: Restore Database Backup**
```bash
# Restore from latest backup (Supabase dashboard)
# Or use pg_restore:
pg_restore -h db.your-project.supabase.co \
  -U postgres -d postgres \
  -c backup_20260712.dump
```

**Step 3: Rollback Migration**
```bash
# Revert last migration
npx supabase db reset --version=20260711_previous

# Verify rollback
npx supabase db status
```

**Step 4: Resume Traffic**
```bash
# Remove maintenance mode
vercel env rm MAINTENANCE_MODE --prod
vercel deploy --prod
```

---

# PART 2: MONITORING & OBSERVABILITY

## 2.1 Metrics Collection

### Key Performance Indicators (KPIs)

**Decision Engine Metrics**:
1. **Latency** (P50, P95, P99)
   - Target: P95 <5ms, P99 <15ms
   - Collection: Every decision execution
   - Alert threshold: P95 >20ms for 5 minutes

2. **Throughput** (decisions/second)
   - Target: >1000 decisions/sec
   - Collection: Aggregate per minute
   - Alert threshold: <100 decisions/sec (sudden drop)


3. **Cache Hit Rate**
   - Target: >80%
   - Collection: Per provider, per minute
   - Alert threshold: <60% for 10 minutes

4. **Error Rate**
   - Target: <0.1%
   - Collection: Per provider, per decision type
   - Alert threshold: >1% for 5 minutes

5. **Rule Execution Count**
   - Target: All rules firing as expected
   - Collection: Per rule, per hour
   - Alert: Rule not executed in 24 hours (potential dead rule)

### Metrics Storage

**Redis Keys Structure**:
```
# Latency histogram
metrics:latency:booking:202607121000 → [0.5, 0.6, 0.7, ...]

# Cache hits/misses
metrics:cache:discount:hits → 8543
metrics:cache:discount:misses → 1234

# Error counts
metrics:errors:payroll:202607121000 → 3

# Rule execution counts
metrics:rules:membership_discount:202607121000 → 456
```

**Retention Policy**:
- Real-time metrics: 1 hour (Redis)
- Hourly aggregates: 30 days (PostgreSQL `decision_metrics` table)
- Daily aggregates: 1 year (PostgreSQL)


## 2.2 Logging Strategy

### Log Levels

**Production Log Level**: `info` (default)
- `error`: Decision engine failures, rule execution errors
- `warn`: Cache misses, slow queries (>10ms), deprecated rules
- `info`: Decision start/end, rule matches, cache hits
- `debug`: Full context, rule evaluation details (disabled in prod)

### Structured Logging Format

```json
{
  "timestamp": "2026-07-12T10:15:30.123Z",
  "level": "info",
  "provider": "booking",
  "decisionType": "availability",
  "duration": 0.6,
  "cacheHit": true,
  "ruleMatched": "time_slot_conflict",
  "context": {
    "tenantId": "tenant-123",
    "ktvId": "ktv-456",
    "sessionDate": "2026-07-15"
  },
  "result": {
    "decision": "unavailable",
    "reason": "KTV already has booking at 14:00"
  }
}
```

### Log Aggregation

**Vercel Logs Integration**:
```bash
# Stream production logs
vercel logs --prod --follow

# Filter by error level
vercel logs --prod | grep '"level":"error"'

# Filter by provider
vercel logs --prod | grep '"provider":"payroll"'
```


**External Log Management** (Optional):
- **DataDog**: Forward Vercel logs to DataDog APM
- **Sentry**: Capture errors with full context
- **LogRocket**: Session replay for decision debugging

### Audit Trail

**Database Audit Logs** (`decision_audit_logs` table):
```sql
-- Example audit log entry
INSERT INTO decision_audit_logs (
  tenant_id,
  user_id,
  provider,
  decision_type,
  context,
  result,
  duration_ms,
  cache_hit,
  rules_evaluated,
  created_at
) VALUES (
  'tenant-123',
  'ktv-456',
  'payroll',
  'bonus_calculation',
  '{"month":"2026-07","ktvId":"ktv-456"}',
  '{"totalBonus":1500000,"breakdown":{"kpi":500000,"session":800000,"rating":200000}}',
  0.11,
  false,
  ['kpi_bonus_rule', 'session_bonus_rule', 'rating_bonus_rule'],
  NOW()
);
```

**Retention**: 90 days (compliance requirement).

**Query Examples**:
```sql
-- Find all decisions for a specific user in last 24 hours
SELECT * FROM decision_audit_logs
WHERE user_id = 'ktv-456'
  AND created_at > NOW() - INTERVAL '24 hours';

-- Average latency per provider (last 7 days)
SELECT provider, AVG(duration_ms) as avg_latency
FROM decision_audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY provider;
```


## 2.3 Dashboards

### Real-Time Operations Dashboard

**URL**: `https://bella-spa.vercel.app/admin/decision-engine/dashboard`

**Panels**:
1. **System Health** (top row)
   - Overall status (green/yellow/red)
   - Current throughput (decisions/sec)
   - Average latency (P50, P95, P99)
   - Cache hit rate

2. **Provider Performance** (middle row)
   - Latency comparison chart (6 providers)
   - Error rate by provider
   - Cache hit rate by provider
   - Throughput by provider

3. **Rule Execution** (bottom row)
   - Top 10 most-fired rules (last 1 hour)
   - Rules with errors (last 1 hour)
   - Dead rules (not fired in 24 hours)
   - New rules deployed (last 7 days)

### Business Impact Dashboard

**URL**: `https://bella-spa.vercel.app/admin/decision-engine/business-impact`

**Panels**:
1. **Revenue Impact**
   - Total discounts applied (last 30 days)
   - Discount distribution by rule
   - Average discount per booking

2. **Payroll Accuracy**
   - Total salaries calculated (last 30 days)
   - Manual adjustments needed (should be <5%)
   - Average calculation time


3. **Workflow Execution**
   - Active workflows (currently running)
   - Completed workflows (last 24 hours)
   - Failed workflows (requires investigation)
   - Average workflow duration

### Grafana Dashboard (Optional Advanced Setup)

**Metrics Source**: PostgreSQL `decision_metrics` table

**Dashboard Queries**:
```sql
-- Latency P95 timeseries (15-minute intervals)
SELECT
  time_bucket('15 minutes', created_at) AS time,
  provider,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_latency
FROM decision_audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY time, provider
ORDER BY time;

-- Cache hit rate timeseries
SELECT
  time_bucket('1 hour', created_at) AS time,
  provider,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*)::FLOAT AS hit_rate
FROM decision_audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY time, provider
ORDER BY time;
```

**Alert Rules** (configured in Grafana):
- P95 latency >20ms for 5 minutes → Slack #alerts
- Cache hit rate <60% for 10 minutes → Slack #alerts
- Error rate >1% for 5 minutes → PagerDuty (critical)


## 2.4 Alerting Rules

### Critical Alerts (PagerDuty)

**1. Decision Engine Down**
- Condition: No decisions executed for 5 minutes
- Check: `COUNT(*) FROM decision_audit_logs WHERE created_at > NOW() - INTERVAL '5 minutes'` = 0
- Action: Page on-call engineer immediately

**2. Error Rate Spike**
- Condition: Error rate >5% for any provider
- Check: `errors / total_decisions > 0.05` (last 5 minutes)
- Action: Page on-call engineer

**3. Database Connection Failure**
- Condition: All decisions failing with DB error
- Check: Error logs contain "connection pool exhausted"
- Action: Page on-call engineer + DBA

### Warning Alerts (Slack #alerts)

**1. High Latency**
- Condition: P95 latency >20ms for 10 minutes
- Action: Notify backend team
- Runbook: See Section 3.2 "Performance Degradation"

**2. Low Cache Hit Rate**
- Condition: Cache hit rate <60% for 15 minutes
- Action: Notify backend team
- Runbook: See Section 3.3 "Redis Cache Issues"

**3. Dead Rules Detected**
- Condition: Rule not executed in 48 hours (excluding scheduled rules)
- Action: Notify product team (potential unused rule)
- Runbook: Review rule configuration, consider deprecation


### Informational Alerts (Slack #decision-engine)

**1. New Rule Deployed**
- Condition: New rule inserted into `policy_registry`
- Action: Notify team for awareness

**2. Rule Disabled**
- Condition: Rule marked `enabled = false`
- Action: Notify team (ensure intentional)

**3. High Traffic Event**
- Condition: Throughput >2000 decisions/sec (2x normal)
- Action: Notify team (monitor for scaling)

### Alert Configuration Example (Vercel)

```json
{
  "name": "Decision Engine Error Rate",
  "condition": {
    "metric": "decision_errors",
    "threshold": 5,
    "period": "5m",
    "aggregation": "rate"
  },
  "channels": ["pagerduty", "slack"],
  "severity": "critical"
}
```

---

# PART 3: TROUBLESHOOTING GUIDE

## 3.1 Common Issues

### Issue 1: Decision Engine Not Responding

**Symptoms**:
- API returns 500 errors
- Logs show "Decision engine initialization failed"
- Dashboard shows no metrics

**Diagnosis**:
```bash
# Check Decision Engine status
curl https://bella-spa.vercel.app/api/decision-engine/status

# Check provider initialization
vercel logs --prod | grep "Provider initialized"
```


**Root Causes**:
1. Missing environment variables (Redis URL, Supabase keys)
2. Redis connection failure
3. Database migration not applied
4. Rule loading failure (invalid rule syntax)

**Resolution**:
```bash
# 1. Verify environment variables
vercel env ls --prod

# 2. Test Redis connectivity
redis-cli -h production-redis.upstash.io ping

# 3. Check database migration status
npx supabase db status --project-ref production

# 4. Validate all rules
npm run test:rules -- --env=production

# If all checks pass, restart deployment
vercel deploy --prod --force
```

### Issue 2: High Latency (P95 >50ms)

**Symptoms**:
- Dashboard shows red latency spike
- User reports slow booking/checkout
- Logs show "Decision took X ms" warnings

**Diagnosis**:
```bash
# Check slow queries in logs
vercel logs --prod | grep "duration" | grep -E "[0-9]{2,}\." | head -20

# Check database query performance
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%decision%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```


**Root Causes**:
1. Cache not working (100% cache misses)
2. Complex rules with heavy database queries
3. Database connection pool exhausted
4. Network latency to Supabase/Redis

**Resolution**:
```bash
# 1. Check cache status
redis-cli -h production-redis.upstash.io info stats
# Look for: keyspace_hits, keyspace_misses

# 2. Warm up cache if cold
npm run cache:warmup -- --env=production

# 3. Scale Redis if memory full
# (Upstash dashboard: upgrade to higher tier)

# 4. Optimize slow rules
# Identify slow rules from logs, add indexes:
CREATE INDEX IF NOT EXISTS idx_bookings_ktv_date 
ON bookings(assigned_ktv_id, session_date);

# 5. Increase database connection pool
# Update Supabase dashboard: Connection Pooling → Max Connections: 200
```

### Issue 3: Cache Completely Failing (0% Hit Rate)

**Symptoms**:
- Dashboard shows cache hit rate = 0%
- All decisions showing `cache_hit: false`
- Latency 5-10x slower than normal

**Diagnosis**:
```bash
# Test Redis connectivity
redis-cli -h production-redis.upstash.io ping
# Expected: PONG

# Check Redis memory usage
redis-cli -h production-redis.upstash.io info memory
```


**Root Causes**:
1. Redis instance down/restarting
2. Redis memory eviction (maxmemory exceeded)
3. Network connectivity issues
4. Wrong Redis URL in environment variables

**Resolution**:
```bash
# 1. Verify Redis URL correct
vercel env get REDIS_URL --prod

# 2. Check Redis instance status (Upstash dashboard)
# If down: wait for restart or contact support

# 3. Clear cache if memory full
redis-cli -h production-redis.upstash.io FLUSHDB
npm run cache:warmup -- --env=production

# 4. Increase Redis memory (Upstash: upgrade plan)

# 5. Temporary fallback: disable cache
vercel env add DECISION_ENGINE_CACHE_ENABLED false --prod
vercel deploy --prod
# (Re-enable after Redis fixed)
```

### Issue 4: Wrong Decision Output (Business Logic Bug)

**Symptoms**:
- User reports incorrect discount applied
- Payroll calculation wrong (too high/low)
- Commission amount doesn't match expectations

**Diagnosis**:
```bash
# 1. Find the specific decision in audit logs
SELECT * FROM decision_audit_logs
WHERE tenant_id = 'tenant-123'
  AND user_id = 'ktv-456'
  AND decision_type = 'bonus_calculation'
  AND created_at > '2026-07-12 10:00:00'
ORDER BY created_at DESC
LIMIT 1;
```


**Root Causes**:
1. Rule condition incorrect (wrong operator or threshold)
2. Rule priority wrong (lower-priority rule matched first)
3. Context data incorrect (stale data passed to decision engine)
4. Rule recently modified (human error in Rule Management UI)

**Resolution**:
```bash
# 1. Review rule definition
SELECT * FROM policy_registry
WHERE rule_id = 'kpi_bonus_rule';

# 2. Check rule version history
SELECT * FROM rule_version_history
WHERE rule_id = 'kpi_bonus_rule'
ORDER BY created_at DESC
LIMIT 5;

# 3. Test rule in isolation
npm run test:rule -- kpi_bonus_rule --context='{"sessions":15,"rating":4.8}'

# 4. If rule is wrong, disable immediately
UPDATE policy_registry
SET enabled = false
WHERE rule_id = 'kpi_bonus_rule';

# 5. Fix rule and deploy corrected version
# (Use Rule Management UI or SQL update)

# 6. Re-run affected calculations
npm run recalculate:payroll -- --month=2026-07 --ktv=ktv-456
```

### Issue 5: Rule Not Firing (Expected to Match but Didn't)

**Symptoms**:
- User expects discount but not applied
- Expected bonus not calculated
- Dashboard shows rule execution count = 0


**Diagnosis**:
```bash
# 1. Check if rule is enabled
SELECT rule_id, enabled, priority FROM policy_registry
WHERE rule_id = 'bundle_discount_rule';

# 2. Check rule conditions
SELECT conditions FROM policy_registry
WHERE rule_id = 'bundle_discount_rule';

# 3. Test with actual context
npm run test:rule -- bundle_discount_rule \
  --context='{"packageType":"combo_vip","totalAmount":5000000}'
```

**Root Causes**:
1. Rule disabled by admin
2. Rule condition too strict (never matches)
3. Higher-priority rule matched first (preempts this rule)
4. Context data missing required fields

**Resolution**:
```bash
# 1. Enable rule if disabled
UPDATE policy_registry
SET enabled = true
WHERE rule_id = 'bundle_discount_rule';

# 2. Adjust rule conditions if too strict
# Use Rule Management UI or direct SQL update

# 3. Adjust rule priority if preempted
UPDATE policy_registry
SET priority = 100  -- Higher priority
WHERE rule_id = 'bundle_discount_rule';

# 4. Verify context data passed correctly
# Check caller code, ensure all required fields present
```


## 3.2 Performance Tuning

### Database Optimization

**Indexes for Decision Engine**:
```sql
-- Booking provider queries
CREATE INDEX IF NOT EXISTS idx_bookings_ktv_date 
ON bookings(assigned_ktv_id, session_date);

CREATE INDEX IF NOT EXISTS idx_bookings_status_date 
ON bookings(status, session_date);

-- Payroll provider queries
CREATE INDEX IF NOT EXISTS idx_sessions_ktv_month 
ON session_logs(ktv_id, DATE_TRUNC('month', completed_at));

CREATE INDEX IF NOT EXISTS idx_attendance_ktv_month 
ON attendance(employee_id, DATE_TRUNC('month', date));

-- Commission provider queries
CREATE INDEX IF NOT EXISTS idx_product_sales_ktv_status 
ON product_sales(ktv_id, status);

-- Audit logs (for analytics)
CREATE INDEX IF NOT EXISTS idx_audit_logs_provider_date 
ON decision_audit_logs(provider, created_at DESC);

-- Rule registry (frequently queried)
CREATE INDEX IF NOT EXISTS idx_policy_registry_enabled_priority 
ON policy_registry(provider, enabled, priority DESC);
```

### Redis Optimization

**Cache Key Strategy**:
```typescript
// Use consistent key patterns
const cacheKey = `decision:${provider}:${decisionType}:${hash(context)}`;

// Set appropriate TTLs
const ttl = {
  booking: 300,     // 5 minutes (changes frequently)
  discount: 1800,   // 30 minutes (semi-stable)
  payroll: 3600,    // 1 hour (calculated monthly)
  commission: 3600, // 1 hour (calculated daily)
};
```


**Memory Management**:
```bash
# Monitor Redis memory usage
redis-cli -h production-redis.upstash.io info memory

# Check cache eviction stats
redis-cli -h production-redis.upstash.io info stats | grep evicted

# Set eviction policy (LRU recommended)
redis-cli -h production-redis.upstash.io CONFIG SET maxmemory-policy allkeys-lru
```

### Rule Optimization

**Best Practices**:
1. **Order rules by selectivity** (most specific first)
   - High priority: Rules with multiple strict conditions
   - Low priority: Fallback rules with loose conditions

2. **Avoid heavy computations in conditions**
   ```typescript
   // ❌ BAD: Heavy computation in condition
   {
     field: 'totalSessions',
     operator: 'greater_than',
     value: calculateComplexThreshold(context) // Slow!
   }
   
   // ✅ GOOD: Pre-compute and cache
   const threshold = await cache.get('session_threshold') || 10;
   {
     field: 'totalSessions',
     operator: 'greater_than',
     value: threshold
   }
   ```

3. **Use database indexes for rule conditions**
   - If rule checks `bookings.status`, ensure index exists
   - If rule joins multiple tables, ensure join columns indexed


## 3.3 Debugging Workflows

### Enable Debug Logging

**Temporarily enable debug logs** for specific provider:
```bash
# Set environment variable
vercel env add DECISION_ENGINE_LOG_LEVEL debug --prod
vercel env add DEBUG_PROVIDER payroll --prod

# Deploy
vercel deploy --prod

# Monitor debug logs
vercel logs --prod --follow | grep '"level":"debug"'

# Disable after debugging
vercel env rm DEBUG_PROVIDER --prod
vercel env add DECISION_ENGINE_LOG_LEVEL info --prod
```

### Replay Decision

**Reproduce issue locally using production context**:
```bash
# 1. Get decision context from audit log
SELECT context FROM decision_audit_logs
WHERE id = 'decision-123';

# 2. Replay locally
npm run replay:decision -- \
  --provider=payroll \
  --type=bonus_calculation \
  --context='{"month":"2026-07","ktvId":"ktv-456"}'

# 3. Compare result with production
```

### Test Rule Changes Safely

**Use staging environment**:
```bash
# 1. Deploy rule change to staging
npm run deploy:rules -- --env=staging --rule=kpi_bonus_rule

# 2. Run integration tests
npm run test:integration -- --env=staging

# 3. Manual smoke test
curl https://bella-spa-staging.vercel.app/api/payroll/calculate \
  -d '{"ktvId":"test-ktv","month":"2026-07"}'

# 4. If successful, deploy to production
npm run deploy:rules -- --env=production --rule=kpi_bonus_rule
```


---

# PART 4: SCALING GUIDE

## 4.1 Horizontal Scaling

### Vercel Serverless (Current Architecture)

**Auto-Scaling Behavior**:
- Vercel automatically scales serverless functions based on traffic
- Each function instance handles 1 request at a time
- No configuration needed for basic scaling

**Scaling Limits** (Vercel Pro Plan):
- Concurrent executions: 1000
- Execution duration: 60 seconds
- Memory: 1024 MB per function

**Monitoring Auto-Scaling**:
```bash
# Check concurrent function executions
vercel inspect https://bella-spa.vercel.app --logs

# If hitting limits, upgrade plan or optimize
```

### Redis Scaling (Upstash)

**Current Setup**: Single Redis instance (2GB)

**Scaling Strategy**:
1. **Vertical Scaling** (increase memory)
   - 2GB → 4GB: Handle 2x more cache keys
   - 4GB → 8GB: Handle 4x more cache keys

2. **Read Replicas** (for read-heavy workloads)
   - Primary: Write operations
   - Replicas: Read operations (cache hits)
   - Configure in Upstash dashboard


### Database Scaling (Supabase/PostgreSQL)

**Current Setup**: Single PostgreSQL instance (8GB RAM, 2 vCPU)

**Scaling Triggers**:
- Connection pool exhausted (>80% utilization)
- Query latency >100ms consistently
- CPU utilization >70% for 10+ minutes

**Scaling Strategy**:
1. **Connection Pooling** (PgBouncer)
   - Current: 100 connections
   - Scale to: 200-500 connections
   - Configure in Supabase dashboard

2. **Vertical Scaling** (increase instance size)
   - 8GB → 16GB RAM: Handle 2x more concurrent queries
   - 2 vCPU → 4 vCPU: Process queries faster

3. **Read Replicas** (for analytics/reporting)
   - Primary: Write operations (decisions)
   - Replica: Read operations (dashboards, reports)
   - Supabase Pro plan feature

4. **Table Partitioning** (for large audit logs)
   ```sql
   -- Partition audit logs by month
   CREATE TABLE decision_audit_logs_202607 
   PARTITION OF decision_audit_logs
   FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
   ```

## 4.2 Vertical Scaling

### When to Scale Up

**Indicators**:
- P95 latency consistently >10ms
- CPU utilization >60% sustained
- Memory usage >70% sustained
- Cache eviction rate increasing


### Scaling Checklist

**Redis Scaling**:
```bash
# 1. Check current memory usage
redis-cli -h production-redis.upstash.io info memory | grep used_memory_human

# 2. Upgrade plan in Upstash dashboard
# (2GB → 4GB or 4GB → 8GB)

# 3. Verify new memory limit
redis-cli -h production-redis.upstash.io CONFIG GET maxmemory

# 4. Monitor cache hit rate after scaling
# (Should improve if eviction was the issue)
```

**Database Scaling**:
```bash
# 1. Check current resource usage (Supabase dashboard)
# CPU, Memory, Connection Pool

# 2. Upgrade instance size
# (8GB/2vCPU → 16GB/4vCPU)

# 3. Monitor query performance
SELECT query, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

# 4. Verify connection pool increased
SHOW max_connections;
```

## 4.3 High Availability (HA) Architecture

### Current Setup (Standard)

**Single Points of Failure**:
- Single Redis instance (if down, 0% cache hits)
- Single database instance (if down, 100% errors)
- Vercel handles function redundancy automatically


### HA Architecture (Future Enhancement)

**Redis HA Setup**:
1. **Upstash Global Database**
   - Primary: Vietnam (lowest latency)
   - Replicas: Singapore, Tokyo (failover)
   - Automatic failover in <30 seconds

2. **Fallback Strategy** (if Redis completely down)
   ```typescript
   // Graceful degradation
   try {
     const cached = await redis.get(cacheKey);
     if (cached) return cached;
   } catch (error) {
     console.warn('Redis unavailable, skipping cache');
     // Continue without cache (slower but functional)
   }
   
   const result = await executeDecision(context);
   return result;
   ```

**Database HA Setup**:
1. **Supabase High Availability** (Enterprise plan)
   - Primary: Active database
   - Standby: Hot standby replica (auto-failover)
   - RPO (Recovery Point Objective): <60 seconds
   - RTO (Recovery Time Objective): <120 seconds

2. **Backup Strategy**
   - Automated daily backups (Supabase)
   - Point-in-time recovery (last 7 days)
   - Manual backup before major deployments

### Disaster Recovery Plan

**Scenario 1: Database Completely Down**
```bash
# 1. Check Supabase status page
curl https://status.supabase.com/api/v2/status.json

# 2. Enable maintenance mode
vercel env add MAINTENANCE_MODE true --prod
vercel deploy --prod

# 3. Wait for Supabase recovery or restore from backup
# (See Section 1.5 for restoration procedure)

# 4. Disable maintenance mode
vercel env rm MAINTENANCE_MODE --prod
```


**Scenario 2: Redis Completely Down**
```bash
# 1. Verify Redis status
redis-cli -h production-redis.upstash.io ping

# 2. Decision: Continue without cache or wait?
# Option A: Disable cache (slower but functional)
vercel env add DECISION_ENGINE_CACHE_ENABLED false --prod

# Option B: Wait for Redis recovery (better performance)
# Monitor Upstash status page

# 3. After Redis recovery, re-enable cache
vercel env add DECISION_ENGINE_CACHE_ENABLED true --prod
npm run cache:warmup -- --env=production
```

**Scenario 3: Vercel Outage**
```bash
# 1. Check Vercel status
curl https://www.vercel-status.com/api/v2/status.json

# 2. If prolonged outage, consider alternative deployment
# (Self-hosted Next.js on AWS/GCP - requires preparation)

# 3. Communicate with users
# Update status page, send email notifications
```

## 4.4 Load Testing

### Performance Benchmarks

**Baseline Targets** (from Task 3 Performance Report):
- Average latency: <1ms
- P95 latency: <5ms
- P99 latency: <15ms
- Throughput: >1000 decisions/sec
- Cache hit rate: >80%


### Load Test Scenarios

**Test 1: Normal Load** (baseline)
```bash
# Simulate 100 concurrent users
npm run loadtest -- \
  --users=100 \
  --duration=5m \
  --scenario=booking_creation

# Expected results:
# - Average latency: <5ms
# - Error rate: <0.1%
# - Cache hit rate: >80%
```

**Test 2: Peak Load** (2x normal)
```bash
# Simulate 500 concurrent users
npm run loadtest -- \
  --users=500 \
  --duration=10m \
  --scenario=mixed_operations

# Expected results:
# - Average latency: <10ms
# - Error rate: <0.5%
# - Cache hit rate: >70%
```

**Test 3: Stress Test** (find breaking point)
```bash
# Gradually increase load until failure
npm run loadtest -- \
  --users=100 \
  --ramp-up=50-per-minute \
  --duration=30m \
  --stop-on-error=true

# Identify bottleneck:
# - Database connection pool exhausted?
# - Redis memory full?
# - Vercel function limits hit?
```

### Load Testing Tools

**Artillery** (recommended):
```yaml
# artillery-config.yml
config:
  target: https://bella-spa.vercel.app
  phases:
    - duration: 60
      arrivalRate: 10  # 10 users/sec
    - duration: 120
      arrivalRate: 50  # 50 users/sec
scenarios:
  - name: "Decision Engine Load Test"
    flow:
      - post:
          url: "/api/decision-engine/booking/availability"
          json:
            ktvId: "ktv-123"
            sessionDate: "2026-07-15"
```

```bash
# Run test
artillery run artillery-config.yml
```


---

# PART 5: AUTOMATION SCRIPTS & ALERT RULES

## 5.1 Deployment Automation

### GitHub Actions Workflow

**File**: `.github/workflows/decision-engine-deploy.yml`

```yaml
name: Decision Engine Deploy

on:
  push:
    branches: [main]
    paths:
      - 'src/lib/decision-engine/**'
      - 'supabase/migrations/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Decision Engine tests
        run: npm test -- src/lib/decision-engine
      
      - name: Performance benchmark
        run: npm run test:performance
      
      - name: Security audit
        run: npm audit --audit-level=high
  
  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: vercel deploy --token=${{ secrets.VERCEL_TOKEN }}
      
      - name: Run smoke tests
        run: npm run test:smoke -- --env=staging
  
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```


## 5.2 Cache Warmup Script

**File**: `scripts/cache-warmup.ts`

```typescript
/**
 * Preload critical rules into Redis cache
 * Usage: npm run cache:warmup -- --env=production
 */
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const env = process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'local';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

async function warmupCache() {
  console.log(`[Cache Warmup] Starting for ${env} environment...`);
  
  // Load all active rules
  const { data: rules, error } = await supabase
    .from('policy_registry')
    .select('*')
    .eq('enabled', true);
  
  if (error) throw error;
  
  console.log(`[Cache Warmup] Loading ${rules.length} rules into cache...`);
  
  for (const rule of rules) {
    const cacheKey = `decision:rule:${rule.rule_id}`;
    await redis.set(cacheKey, JSON.stringify(rule), 'EX', 3600);
  }
  
  console.log(`[Cache Warmup] ✅ Complete! ${rules.length} rules cached.`);
  process.exit(0);
}

warmupCache().catch(error => {
  console.error('[Cache Warmup] ❌ Failed:', error);
  process.exit(1);
});
```


## 5.3 Health Check Script

**File**: `scripts/health-check.ts`

```typescript
/**
 * Comprehensive health check for Decision Engine
 * Usage: npm run health:check -- --env=production
 */
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'critical';
  checks: {
    database: boolean;
    redis: boolean;
    providers: boolean;
    rules: boolean;
  };
  latency: {
    database: number;
    redis: number;
  };
}

async function healthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: 'healthy',
    checks: {
      database: false,
      redis: false,
      providers: false,
      rules: false,
    },
    latency: {
      database: 0,
      redis: 0,
    },
  };
  
  // Check database
  const dbStart = Date.now();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from('policy_registry').select('count').limit(1);
    result.checks.database = true;
    result.latency.database = Date.now() - dbStart;
  } catch (error) {
    console.error('❌ Database check failed:', error);
    result.status = 'critical';
  }
  
  // Check Redis
  const redisStart = Date.now();
  try {
    const redis = new Redis(process.env.REDIS_URL!);
    await redis.ping();
    result.checks.redis = true;
    result.latency.redis = Date.now() - redisStart;
    await redis.disconnect();
  } catch (error) {
    console.error('⚠️  Redis check failed:', error);
    result.status = result.status === 'critical' ? 'critical' : 'degraded';
  }
  
  return result;
}

healthCheck().then(result => {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'critical' ? 1 : 0);
});
```


## 5.4 Metrics Collection Script

**File**: `scripts/collect-metrics.ts`

```typescript
/**
 * Collect Decision Engine metrics and store in database
 * Run via cron every 5 minutes
 */
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

async function collectMetrics() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const redis = new Redis(process.env.REDIS_URL!);
  
  // Aggregate metrics from last 5 minutes
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  const { data: decisions } = await supabase
    .from('decision_audit_logs')
    .select('provider, duration_ms, cache_hit')
    .gte('created_at', fiveMinutesAgo.toISOString());
  
  if (!decisions || decisions.length === 0) {
    console.log('[Metrics] No decisions in last 5 minutes');
    return;
  }
  
  // Group by provider
  const providerMetrics = decisions.reduce((acc, d) => {
    if (!acc[d.provider]) {
      acc[d.provider] = {
        count: 0,
        totalLatency: 0,
        cacheHits: 0,
      };
    }
    acc[d.provider].count++;
    acc[d.provider].totalLatency += d.duration_ms;
    if (d.cache_hit) acc[d.provider].cacheHits++;
    return acc;
  }, {} as Record<string, any>);
  
  // Store metrics
  for (const [provider, metrics] of Object.entries(providerMetrics)) {
    const avgLatency = metrics.totalLatency / metrics.count;
    const cacheHitRate = metrics.cacheHits / metrics.count;
    
    await supabase.from('decision_metrics').insert({
      provider,
      timestamp: now.toISOString(),
      total_decisions: metrics.count,
      avg_latency_ms: avgLatency,
      cache_hit_rate: cacheHitRate,
    });
    
    console.log(`[Metrics] ${provider}: ${metrics.count} decisions, ${avgLatency.toFixed(2)}ms avg, ${(cacheHitRate * 100).toFixed(1)}% cache hit`);
  }
}

collectMetrics().catch(console.error);
```

**Cron Setup** (Vercel Cron):
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/collect-metrics",
    "schedule": "*/5 * * * *"
  }]
}
```


## 5.5 Alert Rule Definitions

### PagerDuty Alert Rules

**File**: `monitoring/pagerduty-rules.json`

```json
[
  {
    "name": "Decision Engine Down",
    "condition": {
      "metric": "decision_count",
      "operator": "equals",
      "threshold": 0,
      "window": "5m"
    },
    "severity": "critical",
    "notification": {
      "channels": ["pagerduty"],
      "escalation_policy": "engineering-oncall"
    },
    "runbook": "https://docs.bella-spa.com/runbook#decision-engine-down"
  },
  {
    "name": "High Error Rate",
    "condition": {
      "metric": "decision_error_rate",
      "operator": "greater_than",
      "threshold": 0.05,
      "window": "5m"
    },
    "severity": "critical",
    "notification": {
      "channels": ["pagerduty", "slack"],
      "escalation_policy": "engineering-oncall"
    },
    "runbook": "https://docs.bella-spa.com/runbook#high-error-rate"
  },
  {
    "name": "Database Connection Failure",
    "condition": {
      "metric": "database_connection_errors",
      "operator": "greater_than",
      "threshold": 10,
      "window": "1m"
    },
    "severity": "critical",
    "notification": {
      "channels": ["pagerduty"],
      "escalation_policy": "dba-oncall"
    }
  }
]
```


### Slack Alert Rules

**File**: `monitoring/slack-rules.json`

```json
[
  {
    "name": "High Latency Warning",
    "condition": {
      "metric": "p95_latency",
      "operator": "greater_than",
      "threshold": 20,
      "window": "10m"
    },
    "severity": "warning",
    "notification": {
      "channels": ["slack"],
      "slack_channel": "#alerts",
      "mention": "@backend-team"
    }
  },
  {
    "name": "Low Cache Hit Rate",
    "condition": {
      "metric": "cache_hit_rate",
      "operator": "less_than",
      "threshold": 0.6,
      "window": "15m"
    },
    "severity": "warning",
    "notification": {
      "channels": ["slack"],
      "slack_channel": "#alerts",
      "message": "Cache hit rate dropped below 60%. Check Redis health."
    }
  },
  {
    "name": "Dead Rule Detected",
    "condition": {
      "metric": "rule_execution_count",
      "operator": "equals",
      "threshold": 0,
      "window": "48h"
    },
    "severity": "info",
    "notification": {
      "channels": ["slack"],
      "slack_channel": "#decision-engine",
      "message": "Rule {{rule_id}} has not been executed in 48 hours. Review if still needed."
    }
  },
  {
    "name": "New Rule Deployed",
    "condition": {
      "event": "rule_created"
    },
    "severity": "info",
    "notification": {
      "channels": ["slack"],
      "slack_channel": "#decision-engine",
      "message": "✅ New rule deployed: {{rule_id}} ({{provider}})"
    }
  }
]
```


## 5.6 Database Backup Script

**File**: `scripts/backup-database.sh`

```bash
#!/bin/bash
# Automated database backup for Decision Engine tables
# Run daily via cron: 0 2 * * * /path/to/backup-database.sh

set -e

BACKUP_DIR="/var/backups/bella-spa"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUPABASE_PROJECT_ID="your-project-id"

echo "[Backup] Starting database backup at $TIMESTAMP"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Backup Decision Engine tables
pg_dump -h db.$SUPABASE_PROJECT_ID.supabase.co \
  -U postgres \
  -d postgres \
  -t policy_registry \
  -t decision_audit_logs \
  -t decision_metrics \
  -t rule_version_history \
  -F c \
  -f $BACKUP_DIR/decision_engine_$TIMESTAMP.dump

echo "[Backup] ✅ Backup completed: decision_engine_$TIMESTAMP.dump"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "decision_engine_*.dump" -mtime +7 -delete

echo "[Backup] Cleaned up old backups (>7 days)"

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/decision_engine_$TIMESTAMP.dump \
#   s3://bella-spa-backups/decision-engine/

echo "[Backup] All done!"
```

**Cron Schedule**:
```bash
# Run daily at 2 AM
0 2 * * * /opt/scripts/backup-database.sh >> /var/log/backup.log 2>&1
```


---

# APPENDIX

## A. Quick Reference

### Environment Variables Reference

| Variable | Local | Staging | Production | Description |
|----------|-------|---------|------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | localhost:54321 | staging.supabase.co | prod.supabase.co | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | local-key | staging-key | prod-key | Admin access key |
| `REDIS_URL` | localhost:6379 | staging-redis | prod-redis | Redis connection string |
| `DECISION_ENGINE_LOG_LEVEL` | debug | info | info | Logging verbosity |
| `DECISION_ENGINE_CACHE_ENABLED` | true | true | true | Enable/disable cache |
| `DECISION_ENGINE_METRICS_ENABLED` | false | true | true | Enable metrics collection |
| `DECISION_ENGINE_AUDIT_ENABLED` | false | true | true | Enable audit logging |

### Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Average Latency | <1ms | >5ms |
| P95 Latency | <5ms | >20ms |
| P99 Latency | <15ms | >50ms |
| Throughput | >1000/sec | <100/sec |
| Cache Hit Rate | >80% | <60% |
| Error Rate | <0.1% | >1% |

### Database Indexes

All critical indexes are defined in Section 3.2 "Performance Tuning".


## B. Contact Information

### On-Call Rotation

| Role | Primary | Backup | PagerDuty |
|------|---------|--------|-----------|
| Backend Engineer | @engineer-1 | @engineer-2 | backend-oncall |
| DevOps/SRE | @devops-1 | @devops-2 | devops-oncall |
| Database Admin | @dba-1 | @dba-2 | dba-oncall |

### Slack Channels

- **#alerts**: Critical production alerts
- **#decision-engine**: Decision Engine team discussion
- **#engineering**: General engineering channel
- **#incidents**: Active incident coordination

### Escalation Path

1. **Level 1**: On-call engineer (PagerDuty)
2. **Level 2**: Engineering manager (@manager)
3. **Level 3**: CTO (@cto)

## C. Incident Response Template

**When incident occurs**:
1. Acknowledge in PagerDuty (stops paging)
2. Create incident channel: `#incident-YYYY-MM-DD-description`
3. Post initial status update in `#incidents`
4. Follow runbook procedures (this document)
5. Document actions taken in incident channel
6. Resolve incident when service restored
7. Schedule postmortem within 24 hours

**Postmortem Template**:
```markdown
# Incident Postmortem: [Title]

**Date**: YYYY-MM-DD
**Duration**: X hours Y minutes
**Severity**: Critical / Major / Minor
**Affected Users**: X users / Y bookings

## Timeline
- HH:MM - Initial detection
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service fully restored

## Root Cause
[What went wrong]

## Resolution
[How it was fixed]

## Action Items
- [ ] Task 1 (Owner: @person, Due: YYYY-MM-DD)
- [ ] Task 2 (Owner: @person, Due: YYYY-MM-DD)

## Lessons Learned
[What we learned, how to prevent in future]
```


## D. Useful Commands Cheat Sheet

### Local Development
```bash
# Start all services
npm run dev

# Run Decision Engine tests
npm test -- src/lib/decision-engine

# Run specific provider tests
npm test -- src/lib/decision-engine/providers/booking

# Performance benchmark
npm run test:performance

# Test specific rule
npm run test:rule -- kpi_bonus_rule --context='{"sessions":15}'
```

### Staging/Production
```bash
# Deploy to staging
vercel deploy

# Deploy to production
vercel deploy --prod

# View logs (live)
vercel logs --prod --follow

# Check deployment status
vercel inspect https://bella-spa.vercel.app

# Run database migration
npx supabase db push --project-ref production

# Warm up cache
npm run cache:warmup -- --env=production

# Health check
curl https://bella-spa.vercel.app/api/health

# Decision Engine status
curl https://bella-spa.vercel.app/api/decision-engine/status
```

### Redis Commands
```bash
# Connect to Redis
redis-cli -h production-redis.upstash.io -p 6379 -a password

# Check status
PING

# View cache keys
KEYS decision:*

# Get cache hit rate
INFO stats | grep keyspace

# Clear specific provider cache
KEYS decision:booking:* | xargs redis-cli DEL

# Flush all cache (CAUTION!)
FLUSHDB
```


### Database Queries
```sql
-- Check Decision Engine metrics (last 24 hours)
SELECT
  provider,
  COUNT(*) as total_decisions,
  AVG(duration_ms) as avg_latency,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*)::FLOAT as cache_hit_rate
FROM decision_audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY provider;

-- Find slow decisions (>50ms)
SELECT
  provider,
  decision_type,
  duration_ms,
  context,
  created_at
FROM decision_audit_logs
WHERE duration_ms > 50
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY duration_ms DESC
LIMIT 20;

-- Check rule execution counts
SELECT
  r.rule_id,
  r.provider,
  COUNT(dal.id) as execution_count,
  MAX(dal.created_at) as last_executed
FROM policy_registry r
LEFT JOIN decision_audit_logs dal
  ON dal.rules_evaluated @> ARRAY[r.rule_id]
  AND dal.created_at > NOW() - INTERVAL '24 hours'
WHERE r.enabled = true
GROUP BY r.rule_id, r.provider
ORDER BY execution_count DESC;

-- Find dead rules (not executed in 48 hours)
SELECT rule_id, provider, priority
FROM policy_registry
WHERE enabled = true
  AND rule_id NOT IN (
    SELECT UNNEST(rules_evaluated)
    FROM decision_audit_logs
    WHERE created_at > NOW() - INTERVAL '48 hours'
  )
ORDER BY provider, priority;
```


## E. Decision Engine Architecture Summary

**Core Components**:
1. **Rule Reasoner** (`RuleReasoner`): Evaluates rules against context
2. **Policy Registry** (`PolicyRegistry`): Manages rule storage and retrieval
3. **6 Decision Providers**:
   - Booking Provider (availability, conflicts)
   - Discount Provider (membership, campaigns, bundles)
   - Payroll Provider (bonuses, deductions, KPI)
   - Commission Provider (session-based, performance-based)
   - Inventory Provider (reorder, allocation, expiry)
   - (6th provider TBD)
4. **Workflow Engine**: Orchestrates multi-step decisions
5. **Observability Layer**: Metrics, audit logs, events

**Data Flow**:
```
User Request
    ↓
API Route (/api/decision-engine/*)
    ↓
Decision Provider (booking/discount/payroll/etc.)
    ↓
RuleReasoner.evaluateRule()
    ↓
Check Cache (Redis) → If hit, return cached
    ↓
Evaluate Rules (PolicyRegistry)
    ↓
Execute Actions
    ↓
Emit Metrics & Audit Log
    ↓
Return Decision
```

**10 Commandments** (see `DECISION_ENGINE_PRINCIPLES.md` for full details):
1. Single Source of Truth (rules in `policy_registry`)
2. Explicit Over Implicit (no hidden business logic)
3. Fail-Safe Defaults (conservative fallbacks)
4. Auditability by Design (log every decision)
5. Performance Over Flexibility (cache aggressively)
6. Separation of Concerns (rule, data, execution)
7. Testability First (mockable, isolated tests)
8. Progressive Enhancement (graceful degradation)
9. Domain-Agnostic Core (providers extend, not modify core)
10. Zero Silent Failures (errors propagate clearly)


## F. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-12 | AI Agent | Initial Production Runbook - Complete deployment, monitoring, troubleshooting, and scaling guide |

## G. Related Documents

- **Architecture**: `DECISION_ENGINE_PLATFORM_ARCHITECTURE.md`
- **Principles**: `DECISION_ENGINE_PRINCIPLES.md`
- **Implementation Roadmap**: `DECISION_ENGINE_IMPLEMENTATION_ROADMAP.md`
- **Performance Report**: `DECISION_ENGINE_PERFORMANCE_REPORT.md`
- **Multi-Provider Validation**: `DECISION_ENGINE_MULTI_PROVIDER_VALIDATION.md`
- **Foundation Audit**: `DECISION_ENGINE_FOUNDATION_AUDIT_2026_07_12.md`
- **Complete Roadmap Audit**: `DECISION_ENGINE_COMPLETE_ROADMAP_AUDIT_2026_07_12.md`

---

# DOCUMENT STATUS

**Completion**: ✅ 100%  
**Review Status**: Ready for review  
**Last Updated**: 2026-07-12  
**Next Review**: 2026-08-12 (monthly)  

**Quality Checklist**:
- [x] All 4 parts complete (Deployment, Monitoring, Troubleshooting, Scaling)
- [x] All automation scripts included
- [x] All alert rules defined
- [x] Performance targets documented
- [x] Rollback procedures documented
- [x] HA architecture documented
- [x] Contact information included
- [x] Incident response template included
- [x] Quick reference cheat sheet included
- [x] Database queries documented
- [x] Architecture summary included

**Total Lines**: ~2,200 lines  
**Estimated Reading Time**: 45-60 minutes  
**Target Audience**: DevOps, SRE, Backend Engineers, On-Call Engineers  

---

**END OF DOCUMENT**
