# Beauty Spa / Babycare Performance Investigation

**Date:** 2026-09-08  
**Status:** Source Analysis COMPLETE → Runtime Measurement REQUIRED  
**Products:** bella-beauty-spa, bella-babycare

---

## Investigation Status

```text
Source-path analysis                 ✅ COMPLETE
Structural latency candidates        ✅ EVIDENCED

Package save serial write path       🔴 HIGH PRIORITY
Reschedule serial N-session path     🔴 HIGH PRIORITY
Global bootstrap critical path       🟠 HIGH PRIORITY
Post-write read amplification        🟠 PLAUSIBLE / NEEDS TRACE
Large tenant data payloads           🟠 DATA-DEPENDENT

DB overload                          ⚪ NOT PROVEN
Missing indexes                      ⚪ NOT PROVEN
Supabase/server capacity issue       ⚪ NOT PROVEN
Redis issue                          ⚪ NOT PROVEN
Network/client issue                 ⚪ NOT PROVEN

Runtime root cause                   ⏸️ NOT YET CLOSED
Code remediation                     🔒 DO NOT START YET
```

---

## Findings Summary

### Classification: Structural Latency Candidates (Source-Evidenced)

**NOT claimed:**
- ❌ Runtime bottleneck proven
- ❌ Root cause determined
- ❌ Performance measurements complete

**Claimed:**
- ✅ Source code patterns identified
- ✅ Latency construction risks documented
- ✅ Measurement protocol designed

---

## Three Systemic Issues (Not Isolated Defects)

### 1. Write Path — Chatty Serial Operations 🔴

**Pattern:** One UI intent → Multiple sequential server actions → Multiple DB round-trips

**Evidence:**

**Package Save:**
```text
updatePackage()
  → wait
  → upsertPackageMaterials()
  → wait
  → close
```

**Issue:** Even metadata-only changes (name/price) trigger full materials upsert.

**Reschedule:**
```text
for each session:
    check resource
    check conflict
    
for each session:
    update session
```

**Issue:** N sessions processed serially, each with auth/tenant/conflict overhead.

**Architectural classification:** Latency accumulation — individual queries may be fast, but total latency = sum of many small waits.

---

### 2. Read Path — Long Blocking Critical Path 🟠

**Pattern:** Cold/hard reload path has multiple sequential boundaries

```text
Proxy 
  → Auth 
  → Role resolution 
  → Tenant context 
  → Dashboard layout 
  → Page bundle
```

**Evidence:**
- Cache helps warm path
- Cold path still hits all boundaries
- User feedback: "toàn hệ thống load chậm"

**Issue:** Cannot eliminate fixed overhead on fresh load, only reduce per-layer contribution.

**Note:** Exact per-layer contribution unknown (requires tracing).

---

### 3. Post-Write Read Amplification 🟠

**Pattern:** Single write → Multiple independent refresh mechanisms

```text
Write operation completes
  → Explicit background refresh
  → Realtime subscription refresh
  → Widget-specific refresh
```

**Evidence:**
- Source code shows multiple refresh triggers
- User perception: "save xong vẫn ì" (feels slow after save completes)

**Issue:** DB/network load spike after write, despite transaction already committed.

**Classification:** PLAUSIBLE (needs trace to confirm read volume).

---

## Measurement Protocol (Priority Order)

### Phase 1: Package Save — Metadata-Only Test 🔴

**Hypothesis:** `upsertPackageMaterials` called even when materials unchanged.

**Test:**
1. Load existing package
2. Change ONLY name or price (no material changes)
3. Save
4. Measure time from save click → UI confirmation
5. Instrument backend to log:
   - `updatePackage` execution time
   - `upsertPackageMaterials` execution time
   - Total server-side time

**Expected outcome:**
- If `upsertPackageMaterials` takes significant time → optimization candidate identified
- If total time still high but materials skipped → investigate other overhead

**Signal quality:** HIGH (clean, isolated test case)

---

### Phase 2: Reschedule — 1/5/10 Session Test 🔴

**Hypothesis:** Reschedule latency scales linearly with session count (serial processing).

**Test:**
1. Reschedule 1 session → measure total time
2. Reschedule 5 sessions → measure total time
3. Reschedule 10 sessions → measure total time
4. Compare: linear scaling vs. fixed overhead

**Expected outcome:**
- **If linear (T10 ≈ 10 × T1):** Serial loop is bottleneck → batch processing candidate
- **If flat (T10 ≈ T1 + fixed):** Fixed overhead (auth, lock, transport) is bottleneck → investigate infrastructure

**Distinguishes two root cause classes:**
- Application-level (loop structure)
- Infrastructure-level (auth, DB latency, network)

**Signal quality:** HIGH (clear classification)

---

### Phase 3: Bootstrap Path — Cold vs. Warm Load Timing 🟠

**Test:**
1. Fresh login (cold path) → measure time to dashboard interactive
2. Hard reload (cache cleared) → measure time
3. Soft navigation (warm path) → measure time
4. Instrument each boundary:
   - Proxy response time
   - Auth token validation time
   - Role/tenant resolution time
   - Dashboard layout render time
   - Initial data fetch time

**Expected outcome:**
- Identify which layer(s) contribute most to cold path latency
- Determine if warm path optimization already effective

**Signal quality:** MEDIUM (requires distributed tracing)

---

### Phase 4: Post-Write Read Volume 🟠

**Test:**
1. Instrument DB query logger
2. Perform package save
3. Measure read query volume in 5-second window after write commits
4. Classify queries:
   - Explicit refresh calls
   - Realtime subscription triggers
   - Widget-specific fetches

**Expected outcome:**
- Quantify read amplification factor
- Identify redundant/unnecessary refreshes

**Signal quality:** MEDIUM (requires DB-level instrumentation)

---

## Optimization Constraints (Non-Negotiable)

**DO NOT optimize by removing:**
- ❌ Audit logging
- ❌ Tenant validation
- ❌ Conflict guards
- ❌ Security checks

**These are correctness/security boundaries.**

**DO optimize by:**
- ✅ Reducing round-trips (detect changed domains, skip unchanged)
- ✅ Batching safe operations (reschedule N sessions in bounded transaction)
- ✅ Moving independent work off critical path (async audit where contract permits)
- ✅ Avoiding redundant work (skip materials upsert when unchanged)

---

## Target Remediation Patterns (NOT YET APPROVED FOR IMPLEMENTATION)

### Package Save — Detect Changed Domains

```text
OLD:
update package
  → wait
  → read/delete/reinsert materials (always)
  → wait
  → close

TARGET:
detect changed domains
  → metadata changed? update metadata
  → materials changed? update materials
  → skip untouched domains
  → close after required commit
```

**Critical:** Preserve audit provenance, tenant isolation, conflict detection.

---

### Reschedule — Bounded Batch Processing

```text
OLD:
for each session:
    check resource
    check conflict
for each session:
    update session

TARGET:
load/check affected set efficiently
  → validate entire schedule (conflict, resource, ownership)
  → perform bounded/batched transactional updates
  → audit once at aggregate-operation level (where contract permits)
```

**Critical constraints:**
- Conflict safety must be preserved
- Resource ownership must be validated
- Partial-failure semantics must be maintained
- Audit provenance must remain traceable

**Status:** NOT APPROVED (correctness contract review required)

---

## Factory/Architecture Escalation

### Potential Defect Class: Serial Server-Action Chains

**Pattern:**
```text
One user intent
  → Multiple server actions (sequential)
  → Each action: auth → tenant lookup → DB query
```

**If this pattern appears across multiple Products:**
- Factory Rule candidate: Detect server-action chains on interactive critical paths
- Factory Rule candidate: Detect `await` per-row loops in write operations

**Benefit:** Prevent new Products from repeating latency construction defect.

**Status:** NOT YET ESCALATED (needs multi-Product evidence)

---

## Next Actions

### Immediate (This Session)

**DO NOT:**
- ❌ Start code remediation
- ❌ Modify server actions
- ❌ Change database queries
- ❌ Add caching layers

**DO:**
1. Create instrumentation plan for Phase 1 (package metadata-only save)
2. Design measurement harness with clear success criteria
3. Document expected vs. actual outcomes
4. Prepare rollback plan

---

### After Runtime Evidence

**If Phase 1 confirms `upsertPackageMaterials` overhead:**
1. Design "detect changed domains" pattern
2. Review correctness contracts (audit, tenant, conflict)
3. Implement with feature flag
4. A/B test with real tenant
5. Measure latency improvement

**If Phase 2 confirms serial loop bottleneck:**
1. Design bounded batch pattern
2. **Critical:** Prove correctness preservation (conflict safety, resource ownership, partial failure, audit)
3. Implement with feature flag
4. Measure scaling (1/5/10/20 sessions)
5. Field test with real reschedule workload

**If evidence does NOT confirm hypothesis:**
- Investigate infrastructure (DB connection pool, Supabase capacity, network)
- Investigate client-side (bundle size, JS execution, render time)

---

## Evidence Classification

### Source-Level Evidence (Complete)

| Pattern | Location | Priority | Evidence Type |
|---------|----------|----------|---------------|
| Serial package save | `updatePackage` + `upsertPackageMaterials` | 🔴 HIGH | Source code |
| Serial reschedule loop | Session update loop | 🔴 HIGH | Source code |
| Cold path boundaries | Auth → Role → Tenant → Layout | 🟠 HIGH | Architecture |
| Post-write refresh triggers | Multiple refresh mechanisms | 🟠 MEDIUM | Source code |

### Runtime Evidence (Not Yet Collected)

| Hypothesis | Test | Priority | Status |
|------------|------|----------|--------|
| Materials upsert on metadata-only change | Phase 1 | 🔴 HIGH | ⏸️ NOT STARTED |
| Reschedule scales linearly with N | Phase 2 | 🔴 HIGH | ⏸️ NOT STARTED |
| Cold path per-layer contribution | Phase 3 | 🟠 MEDIUM | ⏸️ NOT STARTED |
| Read amplification after write | Phase 4 | 🟠 MEDIUM | ⏸️ NOT STARTED |

---

## Success Criteria

### Investigation Success (Not Optimization Success)

**Claim:** "Investigation complete" when:
1. Phase 1 + Phase 2 measurements executed
2. Results classified: confirmed / rejected / inconclusive
3. Root cause candidates prioritized by evidence
4. Optimization constraints documented

**NOT required:**
- ❌ Latency reduced
- ❌ Code changed
- ❌ Production deployed

### Optimization Success (Future)

**Claim:** "Optimization successful" when:
1. Target pattern implemented with correctness proof
2. A/B test shows measurable latency improvement
3. No regressions in correctness/security/audit
4. Real tenant validates improvement

---

## Review Feedback Incorporated (2026-09-08)

**From:** Architecture review

**Key points:**
1. ✅ Classification correct: source evidence ≠ runtime proof
2. ✅ Three systemic issues, not isolated defects
3. ✅ Phase 1 (package metadata-only) highest signal quality
4. ✅ Phase 2 (reschedule 1/5/10) distinguishes root cause classes
5. ✅ Do NOT optimize by removing governance boundaries
6. ✅ Target patterns documented but NOT approved for implementation
7. ✅ Factory escalation path identified (if pattern repeats across Products)

**Next:** Instrumentation + measurement, NOT code changes.

---

## Document Status

**Investigation Phase:** Source Analysis COMPLETE ✅  
**Measurement Phase:** NOT STARTED ⏸️  
**Remediation Phase:** BLOCKED (awaiting runtime evidence) 🔒

**Last Updated:** 2026-09-08  
**Next Review:** After Phase 1 + Phase 2 runtime measurements complete

