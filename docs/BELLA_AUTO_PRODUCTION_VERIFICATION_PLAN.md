# Bella Auto - Production Verification Plan
## Gap Analysis: Code Complete → Production Ready

**Current Status:** Code Complete (10/10 features)  
**Target Status:** Production Ready (10/10 verified under load)  
**Gap:** Performance validation, stress testing, edge cases

---

## 🎯 Objective

Verify that Bella Auto Phases 11-15 can handle **real-world production scale** across 5 critical dimensions:

1. **Load Test** - Database performance at scale
2. **Rollback Stress Test** - Transaction cascade accuracy
3. **Temporal Database** - Long-term history performance
4. **Marketplace** - Complex dependency resolution
5. **Rule Engine** - Performance with thousands of rules

**Timeline:** 2 weeks intensive testing before production pilot

---

## 1️⃣ LOAD TEST

### Objective
Verify query performance with production-scale data volumes.

### Test Scenarios

#### Scenario 1.1: Journey Events at Scale
**Setup:**
- 10,000,000 journey events
- 5,000,000 touchpoints
- 1,000,000 VINs
- 100,000 customer journeys
- 10,000 concurrent users

**Test Queries:**
```sql
-- Q1: Customer journey timeline (most common query)
SELECT * FROM auto_customer_journeys 
WHERE customer_id = ? AND tenant_id = ?
ORDER BY created_at DESC LIMIT 50;

-- Q2: Journey events for a specific journey
SELECT * FROM auto_journey_events 
WHERE journey_id = ? AND tenant_id = ?
ORDER BY occurred_at DESC;

-- Q3: Active journeys by stage
SELECT stage_code, COUNT(*) 
FROM auto_customer_journeys
WHERE tenant_id = ? AND status = 'active'
GROUP BY stage_code;

-- Q4: VIN search (frequent admin operation)
SELECT * FROM auto_vehicles
WHERE vin = ? AND tenant_id = ?;

-- Q5: Touchpoint aggregation (analytics)
SELECT touchpoint_type, COUNT(*)
FROM auto_touchpoints
WHERE tenant_id = ? 
  AND occurred_at >= ? 
  AND occurred_at <= ?
GROUP BY touchpoint_type;
```

**Success Criteria:**
- ✅ P50 latency < 50ms
- ✅ P95 latency < 200ms
- ✅ P99 latency < 500ms
- ✅ Concurrent 1000 users: response time < 1s
- ✅ No table scans (EXPLAIN ANALYZE shows index usage)

**Tools:**
- Apache JMeter or k6 for load generation
- PostgreSQL `pg_stat_statements` for query analysis
- New Relic / Datadog for APM

**Risk if Failed:**
- Customer journey timeline takes 5+ seconds to load
- Admin VIN search becomes unusable
- Dashboard analytics timeout


---

## 2️⃣ ROLLBACK STRESS TEST

### Objective
Verify rollback cascade accuracy and performance under increasing complexity.

### Test Scenarios

#### Scenario 2.1: Small Transaction (50 rollbacks)
**Setup:**
- 50 booking cancellations
- Each booking has: 1 vehicle allocation, 2 deposits, 3 commission records
- Total affected rows: 50 × 7 = 350 rows

**Expected Behavior:**
- ✅ All 350 rows rolled back atomically
- ✅ Rollback completes in < 5 seconds
- ✅ Audit log has 50 transaction entries
- ✅ No orphaned records (foreign key integrity maintained)

#### Scenario 2.2: Medium Transaction (500 rollbacks)
**Setup:**
- 500 booking cancellations
- Total affected rows: 500 × 7 = 3,500 rows

**Expected Behavior:**
- ✅ All 3,500 rows rolled back atomically
- ✅ Rollback completes in < 30 seconds
- ✅ Database connection pool doesn't exhaust
- ✅ No deadlocks

#### Scenario 2.3: Large Transaction (5,000 rollbacks)
**Setup:**
- 5,000 booking cancellations
- Total affected rows: 5,000 × 7 = 35,000 rows

**Expected Behavior:**
- ✅ All 35,000 rows rolled back atomically
- ✅ Rollback completes in < 5 minutes
- ✅ Transaction log doesn't overflow
- ✅ No memory leaks in BusinessRollbackEngine

#### Scenario 2.4: Extreme Cascade (50,000 rollbacks) ⚠️ CRITICAL
**Setup:**
- 50,000 booking cancellations
- Total affected rows: 50,000 × 7 = 350,000 rows
- Simulate real-world scenario: mass data migration rollback

**Expected Behavior:**
- ✅ Rollback completes in < 30 minutes
- ✅ No database server crash
- ✅ Rollback can be paused/resumed
- ✅ Progress indicator accurate (e.g., "45,000 / 50,000 rolled back")

**Validation Queries:**
```sql
-- Check for orphaned allocations
SELECT COUNT(*) FROM auto_vehicle_allocations
WHERE booking_id NOT IN (SELECT id FROM auto_bookings);
-- Must return 0

-- Check for orphaned deposits
SELECT COUNT(*) FROM auto_deposits
WHERE booking_id NOT IN (SELECT id FROM auto_bookings);
-- Must return 0

-- Check audit trail completeness
SELECT COUNT(*) FROM auto_rollback_audit_log
WHERE transaction_id IN (...);
-- Must equal number of rollbacks
```

**Risk if Failed:**
- Data corruption (orphaned records)
- Financial discrepancy (deposits not refunded)
- Commission errors (KTV paid for cancelled bookings)


---

## 3️⃣ TEMPORAL DATABASE

### Objective
Verify long-term history performance and storage growth.

### Test Scenarios

#### Scenario 3.1: As-Of Query (5 years ago)
**Setup:**
- Seed 5 years of history (1,825 days)
- 10,000 bookings with 50 updates each = 500,000 history snapshots
- Query "as-of" date 5 years ago

**Test Queries:**
```sql
-- Q1: Single entity as-of
SELECT * FROM auto_bookings_history
WHERE id = ? 
  AND tenant_id = ?
  AND snapshot_at <= '2021-08-04'
ORDER BY snapshot_at DESC LIMIT 1;

-- Q2: Bulk as-of query (compliance report)
SELECT * FROM auto_bookings_history h
WHERE tenant_id = ?
  AND snapshot_at <= '2021-08-04'
  AND h.id IN (
    SELECT DISTINCT id FROM auto_bookings_history
    WHERE snapshot_at <= '2021-08-04'
  )
ORDER BY h.id, h.snapshot_at DESC;

-- Q3: Change history for single entity
SELECT * FROM auto_bookings_history
WHERE id = ? AND tenant_id = ?
ORDER BY snapshot_at ASC;
```

**Success Criteria:**
- ✅ Q1 (single entity): < 100ms
- ✅ Q2 (bulk compliance): < 5 seconds for 1000 entities
- ✅ Q3 (full history): < 200ms even with 1000 snapshots

**Storage Growth Analysis:**
```sql
-- Check table size growth
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'auto_%_history'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Expected: < 10x source table size
-- If auto_bookings = 1GB, auto_bookings_history should be < 10GB
```

**Risk if Failed:**
- Compliance queries timeout (audit reports fail)
- History table bloat (disk space exhaustion)
- Index size explosion (memory issues)

#### Scenario 3.2: History Retention & Purging
**Question:** Do we need to purge history older than 7 years (legal retention)?

**Purge Strategy (if needed):**
```sql
-- Soft delete (mark as archived)
UPDATE auto_bookings_history
SET is_archived = true
WHERE snapshot_at < NOW() - INTERVAL '7 years';

-- Hard delete (after backup)
DELETE FROM auto_bookings_history
WHERE snapshot_at < NOW() - INTERVAL '7 years'
  AND is_archived = true;
```


---

## 4️⃣ MARKETPLACE (The Hard Part) 🔥

### Objective
Verify complex capability lifecycle: install → upgrade → downgrade → rollback → dependency conflicts.

### Test Scenarios

#### Scenario 4.1: Simple Install
**Steps:**
1. Install `journey_engine` v1.0.0 (no dependencies)
2. Verify migration script runs successfully
3. Verify tables created: `auto_customer_journeys`, `auto_journey_stages`, `auto_journey_events`
4. Verify RLS policies applied
5. Verify capability status = 'active'

**Success Criteria:**
- ✅ Install completes in < 30 seconds
- ✅ All tables created with correct schema
- ✅ No errors in install log
- ✅ Rollback script generated

#### Scenario 4.2: Upgrade (Breaking Changes)
**Steps:**
1. Install `rule_engine` v1.0.0
2. Create 10 rules using v1.0.0 schema
3. Upgrade to `rule_engine` v2.0.0 (breaking: JSON DSL changed)
4. Verify data migration runs
5. Verify existing rules still work

**Success Criteria:**
- ✅ Upgrade shows "breaking changes" warning
- ✅ Data migration transforms old JSON → new JSON
- ✅ Existing rules evaluate correctly after upgrade
- ✅ New rules use v2.0.0 schema

**Risk if Failed:**
- Existing rules break (business logic fails)
- Data loss during migration

#### Scenario 4.3: Downgrade (Not Recommended)
**Steps:**
1. Downgrade `rule_engine` from v2.0.0 → v1.0.0
2. Verify reverse data migration runs
3. Check if rules created in v2.0.0 are compatible with v1.0.0

**Expected Behavior:**
- ⚠️ System blocks downgrade if data incompatible
- ⚠️ System forces manual data cleanup before downgrade
- ✅ If downgrade allowed, all rules still work

#### Scenario 4.4: Rollback Version (Critical)
**Steps:**
1. Install `temporal_history` v1.2.0
2. Run queries for 1 hour (generate traffic)
3. Discover bug in v1.2.0
4. Rollback to v1.1.0 (last stable)

**Success Criteria:**
- ✅ Rollback completes in < 5 minutes
- ✅ Rollback script removes v1.2.0 tables
- ✅ v1.1.0 tables restored
- ✅ Data created in v1.2.0 is preserved (if possible) or backed up

**Risk if Failed:**
- Data loss
- System downtime > 1 hour
- Cannot recover to stable state

#### Scenario 4.5: Dependency Conflict (The Hardest) 🔥🔥🔥
**Setup:**
- Capability A v1.0.0 requires Capability B v1.x
- Capability C v2.0.0 requires Capability B v2.x
- User tries to install both A and C

**Expected Behavior:**
```
❌ Cannot install Capability C v2.0.0
Reason: Dependency conflict
- Capability A v1.0.0 requires Capability B v1.x
- Capability C v2.0.0 requires Capability B v2.x
- Cannot satisfy both requirements

Suggestions:
1. Upgrade Capability A to v2.0.0 (requires B v2.x)
2. Downgrade Capability C to v1.0.0 (requires B v1.x)
3. Uninstall Capability A
```

**Algorithm Needed:**
```typescript
function resolveDependencies(capabilityId: string, version: string): {
  canInstall: boolean;
  conflicts: ConflictInfo[];
  suggestions: SuggestionInfo[];
} {
  // 1. Build dependency graph
  // 2. Check for version conflicts
  // 3. Suggest resolution paths
  // 4. Allow user to choose resolution
}
```

**Success Criteria:**
- ✅ System detects conflict before install
- ✅ System suggests valid resolution paths
- ✅ User can resolve conflict without manual SQL
- ✅ Dependency graph remains consistent

**Risk if Failed:**
- Silent dependency conflicts (system installs incompatible versions)
- Runtime errors in production
- Database schema corruption


---

## 5️⃣ RULE ENGINE PERFORMANCE

### Objective
Verify rule evaluation performance scales from 100 → 10,000 rules.

### Test Scenarios

#### Scenario 5.1: 100 Rules (Baseline)
**Setup:**
- 100 active rules
- Each rule has 3 conditions (AND logic)
- Priority-sorted evaluation

**Test Execution:**
- Evaluate 1,000 quotations against all 100 rules
- Measure: Total time, time per quotation, time per rule

**Expected Performance:**
- ✅ Evaluation: < 50ms per quotation
- ✅ Total: < 50 seconds for 1,000 quotations
- ✅ Memory: < 100MB

#### Scenario 5.2: 1,000 Rules
**Setup:**
- 1,000 active rules
- Mix of simple (1 condition) and complex (5 conditions)

**Expected Performance:**
- ✅ Evaluation: < 200ms per quotation
- ✅ Total: < 3.5 minutes for 1,000 quotations
- ✅ Memory: < 500MB

**If Slow:**
- ⚠️ Need rule caching
- ⚠️ Need rule compilation (JSON → executable code)
- ⚠️ Need parallel evaluation

#### Scenario 5.3: 10,000 Rules (Extreme) 🔥
**Setup:**
- 10,000 active rules (enterprise-scale)
- Real-world distribution:
  - 60% simple (1-2 conditions)
  - 30% medium (3-4 conditions)
  - 10% complex (5+ conditions)

**Expected Performance:**
- ⚠️ Evaluation: < 2 seconds per quotation (acceptable for admin operations)
- ⚠️ Total: < 35 minutes for 1,000 quotations
- ⚠️ Memory: < 2GB

**Optimization Strategies (if needed):**

**Strategy 1: Rule Compilation**
```typescript
// Before: Evaluate JSON DSL at runtime (slow)
function evaluateRule(rule: Rule, data: any): boolean {
  for (const condition of rule.conditions) {
    if (!evaluateCondition(condition, data)) return false;
  }
  return true;
}

// After: Compile JSON → JavaScript function (fast)
function compileRule(rule: Rule): CompiledRule {
  const code = generateJavaScriptCode(rule.conditions);
  return new Function('data', code) as CompiledRule;
}

// Cache compiled rules
const ruleCache = new Map<string, CompiledRule>();
```

**Performance Gain:** 10-50x faster

**Strategy 2: Rule Indexing**
```typescript
// Index rules by first condition field
// E.g., rules on `total_price` only evaluated for quotations with total_price

const ruleIndex = {
  'total_price': [rule1, rule2, rule3],
  'brand': [rule4, rule5],
  'customer_type': [rule6, rule7, rule8]
};

// Only evaluate relevant rules
function evaluateQuotation(quotation: Quotation) {
  const relevantRules = getRulesForFields(Object.keys(quotation));
  return evaluateRules(relevantRules, quotation);
}
```

**Performance Gain:** 5-20x faster (depends on rule distribution)

**Strategy 3: Parallel Evaluation**
```typescript
// Evaluate independent rules in parallel (Web Workers / Worker Threads)
async function evaluateRulesParallel(
  rules: Rule[], 
  data: any, 
  concurrency: number = 4
): Promise<RuleResult[]> {
  const chunks = chunkArray(rules, Math.ceil(rules.length / concurrency));
  const promises = chunks.map(chunk => 
    evaluateRulesInWorker(chunk, data)
  );
  const results = await Promise.all(promises);
  return results.flat();
}
```

**Performance Gain:** 2-4x faster (limited by CPU cores)

**Success Criteria:**
- ✅ 10,000 rules: < 2s per evaluation
- ✅ No memory leaks
- ✅ Cache hit rate > 90%
- ✅ Compilation happens once per rule change

**Risk if Failed:**
- Quotation approval takes 10+ seconds (unusable)
- Admin screens timeout
- System becomes unresponsive under load


---

## 📋 EXECUTION PLAN

### Week 1: Setup & Baseline

**Day 1-2: Data Seeding**
- Generate 10M journey events
- Generate 5M touchpoints
- Generate 1M VINs
- Generate 10K rules
- Generate 5 years of temporal history

**Day 3-4: Tooling Setup**
- Set up k6 / JMeter
- Configure APM (New Relic / Datadog)
- Set up monitoring dashboards
- Create automated test scripts

**Day 5: Baseline Measurements**
- Run all 5 test scenarios at minimum scale
- Document baseline performance
- Identify immediate bottlenecks

### Week 2: Stress Testing & Optimization

**Day 1-2: Load Test (Scenario 1)**
- Run query performance tests
- Analyze slow queries with EXPLAIN
- Add missing indexes
- Re-test until success criteria met

**Day 3: Rollback Stress Test (Scenario 2)**
- Test 50 → 500 → 5,000 → 50,000 rollbacks
- Monitor transaction log size
- Test rollback accuracy with validation queries

**Day 4: Temporal Database (Scenario 3)**
- Test as-of queries 5 years back
- Measure history table growth
- Implement purging strategy if needed

**Day 5: Marketplace (Scenario 4)**
- Test install/upgrade/downgrade flows
- Implement dependency conflict resolution
- Test rollback version scenarios

**Day 6-7: Rule Engine (Scenario 5)**
- Test 100 → 1,000 → 10,000 rules
- Implement rule compilation if needed
- Implement rule indexing if needed
- Implement parallel evaluation if needed

---

## 📊 SUCCESS CRITERIA MATRIX

| Test Scenario | Metric | Target | Status |
|--------------|--------|--------|--------|
| **1.1 Load Test** | P95 latency | < 200ms | ⏳ Pending |
| **1.1 Load Test** | Concurrent users | 1000 | ⏳ Pending |
| **2.4 Rollback** | 50K transactions | < 30 min | ⏳ Pending |
| **2.4 Rollback** | Data accuracy | 100% | ⏳ Pending |
| **3.1 Temporal** | As-of 5y ago | < 100ms | ⏳ Pending |
| **3.1 Temporal** | History growth | < 10x | ⏳ Pending |
| **4.4 Marketplace** | Version rollback | < 5 min | ⏳ Pending |
| **4.5 Marketplace** | Dependency conflicts | Detected | ⏳ Pending |
| **5.3 Rule Engine** | 10K rules eval | < 2s | ⏳ Pending |
| **5.3 Rule Engine** | Memory usage | < 2GB | ⏳ Pending |

**Overall Status:** ⏳ **NOT VERIFIED** - Testing Required

---

## 🚨 KNOWN RISKS & MITIGATION

### Risk 1: Database Connection Pool Exhaustion (Rollback Stress Test)
**Symptom:** "Too many connections" error during 50K rollback  
**Mitigation:**
- Increase `max_connections` in PostgreSQL
- Implement connection pooling with PgBouncer
- Batch rollback operations (1000 at a time)

### Risk 2: History Table Bloat (Temporal Database)
**Symptom:** auto_bookings_history grows to 100GB after 5 years  
**Mitigation:**
- Implement table partitioning by year
- Archive old history to cold storage (S3)
- Implement incremental snapshots (only changed fields)

### Risk 3: Rule Evaluation Timeout (Rule Engine)
**Symptom:** Quotation approval takes 10+ seconds with 10K rules  
**Mitigation:**
- Implement rule compilation (JSON → code)
- Implement rule caching (Redis)
- Implement rule indexing by condition field
- Parallelize rule evaluation

### Risk 4: Dependency Hell (Marketplace)
**Symptom:** Cannot install Capability C due to conflicts  
**Mitigation:**
- Implement semantic versioning strictly
- Implement conflict detection before install
- Provide resolution suggestions
- Allow "force install" with warnings for advanced users

### Risk 5: Slow Query Performance (Load Test)
**Symptom:** Customer journey query takes 5+ seconds  
**Mitigation:**
- Add composite indexes: `(tenant_id, customer_id, created_at)`
- Implement query result caching (Redis)
- Implement database read replicas
- Consider denormalization for hot paths

---

## 📈 NEXT STEPS AFTER VERIFICATION

### If ALL Tests Pass ✅
1. **Proceed to Production Pilot** (1 real tenant)
2. **Monitor for 30 days** with APM
3. **Collect user feedback**
4. **Iterate on performance if needed**

### If ANY Test Fails ❌
1. **Root cause analysis** (1-2 days)
2. **Implement optimization** (3-5 days)
3. **Re-test** until pass
4. **Document lessons learned**
5. **Update architecture if needed**

---

## 🎯 DEFINITION OF "PRODUCTION READY"

After completing this verification plan, Bella Auto Phases 11-15 can claim "Production Ready" if:

- ✅ All 10 success criteria met
- ✅ No data corruption under stress
- ✅ No system crashes under load
- ✅ Performance acceptable for 1000+ concurrent users
- ✅ Rollback accuracy 100%
- ✅ Marketplace dependency conflicts detected
- ✅ Rule engine scales to 10K rules
- ✅ Temporal queries work for 5+ years of history
- ✅ No memory leaks or connection leaks
- ✅ Monitoring and alerting in place

**Current Status:** Code Complete, **NOT** Production Verified  
**Timeline:** 2 weeks of intensive testing  
**Owner:** Engineering Team + QA Team

---

**Repository:** https://github.com/bellaspahcm/bella-spa-erp  
**Related Docs:**
- `BELLA_AUTO_PHASES_11-15_FINAL_REPORT.md` (Feature completion)
- `bella-auto-execution-plan.md` (Implementation checklist)
- This document (Production verification)
