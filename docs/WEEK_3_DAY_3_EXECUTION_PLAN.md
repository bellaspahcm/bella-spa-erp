# WEEK 3 DAY 3 — INTEGRATION & PRESSURE TEST

**Date:** 2026-08-21 (continuation)  
**Goal:** Close Day 2 residuals + Build Capability #2 + Generate GOLD evidence  
**Constraint:** Core = IMMUTABLE (47 modules frozen)

---

## 🎯 OBJECTIVES

### Primary
1. **Close Day 2 Residuals** — achieve full functional verification
2. **Implement Capability #2** — prove breadth, not just depth
3. **Generate GOLD Evidence** — capture "wanted to modify Core" events

### Success Criteria
- Day 2 residuals: 0 (all items closed)
- Unit tests: 8/8 PASS (not 4/8)
- Integration tests: PASS with real database
- RLS isolation: VERIFIED with negative tests
- Capability #2: Operational
- Core modifications: 0
- GOLD events: ≥1 if genuinely occurs (not fabricated)

---

## 📋 EXECUTION SEQUENCE

### TRACK A: DAY 2 RESIDUALS (PRIORITY 1)

#### Task A1: Fix Unit Tests (4/8 → 8/8)
**Current:** 4 tests passing, 4 tests failing (mock setup issues)

**Action:**
1. Analyze failure root cause (already identified: `createTrackingEvent` not mocked)
2. Enhance Supabase mock to handle full flow:
   - `log_shipments` insert
   - `log_tracking_events` insert
   - `log_idempotency_keys` upsert
3. Run tests: `npm run test -- src/platform/logistics/__tests__/shipment-engine.test.ts`
4. Target: 8/8 PASS

**Gate:** Cannot proceed to Capability #2 until tests = 8/8 PASS

#### Task A2: Apply Database Migration
**Current:** Migration file created but not applied

**Action:**
1. Verify Supabase connection: `supabase status`
2. Apply migration: `supabase db reset` or manual SQL execution
3. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name LIKE 'log_%';
   ```
4. Expected: 6 tables (shipments, tracking_events, routes, warehouses, carriers, idempotency_keys)

**Gate:** All 6 tables must exist with correct schema

#### Task A3: RLS Tenant Isolation Verification
**Current:** Schema has RLS policies, but not functionally verified

**Action:**
1. Create test script: `scripts/logistics/verify-tenant-isolation.ts`
2. Test scenarios:
   - ✅ Tenant A can create shipment for Tenant A
   - ✅ Tenant A can read shipment for Tenant A
   - ❌ Tenant A **CANNOT** read shipment for Tenant B
   - ❌ Tenant A **CANNOT** update shipment for Tenant B
   - ❌ Tenant A **CANNOT** delete shipment for Tenant B
3. Execute: `npx tsx scripts/logistics/verify-tenant-isolation.ts`
4. All negative tests must FAIL (proving isolation works)

**Gate:** RLS must block cross-tenant access

#### Task A4: Integration Test with Real Database
**Current:** Only unit tests with mocks

**Action:**
1. Create integration test: `src/platform/logistics/__tests__/shipment-engine.integration.test.ts`
2. Use real Supabase client (test database)
3. Test full flow:
   - Create shipment → verify in DB
   - Update status → verify tracking event created
   - Assign carrier → verify updated
   - Track shipment → verify full history
4. Cleanup: Delete test data after each test

**Gate:** Full lifecycle must work end-to-end

#### Task A5: Event Publishing Verification
**Current:** Events published but not verified

**Action:**
1. Add event listener in test
2. Verify events published with correct payload:
   - `log.shipment.created.v1`
   - `log.shipment.picked_up.v1`
   - `log.shipment.delivered.v1`
3. Verify event schema matches contract

**Gate:** All domain events must be published correctly

#### Task A6: Re-run Verification Gates
**Action:**
1. Architecture Guard: `npm run healthcare:guard`
2. Healthcare Regression: `npm run healthcare:test`
3. Core Integrity: `git diff --stat src/core/`

**Expected:** All PASS (again)

---

### TRACK B: CAPABILITY #2 (PRIORITY 2)

**Goal:** Prove platform can support multiple capabilities without Core modification

#### Option 1: Route Management Engine
**Scope:**
- Create route with waypoints
- Assign shipments to route
- Optimize route order
- Track route progress
- Complete route

**Why this tests pressure:**
- Requires coordination between Shipment + Route (cross-entity)
- Needs optimization logic (not in Core)
- Geographic/distance calculations (domain-specific)

#### Option 2: Carrier Management Engine
**Scope:**
- Register carrier
- Manage service levels
- Track carrier performance
- Carrier assignment logic
- Rate negotiation data

**Why this tests pressure:**
- Third-party integration concepts
- Performance metrics aggregation
- Complex business rules
- May need Core to expose new hooks

**SELECTED:** Route Management (more likely to create Core pressure)

#### Implementation Plan
1. Contract: `RouteManagementContract` (~300 LOC)
2. Engine: `RouteEngineService` (~600 LOC)
3. Tests: Route lifecycle tests
4. Integration: Route → Shipment coordination

**Critical Question to Answer:**
*"Does Route Management need anything from Core that doesn't exist?"*

---

## 💎 GOLD EVIDENCE GENERATION

### What is GOLD Evidence?
Events where developer **genuinely wanted to modify Core** but found alternative.

### How to Generate Legitimately
1. **Implement complex requirements** (not just CRUD)
2. **Push boundaries** of current abstractions
3. **Log every moment** of "I wish Core had..."
4. **Document alternatives** that worked instead
5. **Verify outcome** (feature completed or blocked)

### GOLD Event Template
```markdown
## GOLD EVENT #01

**Date:** [timestamp]  
**Context:** [What were you trying to build?]  
**Pressure Point:** [What Core modification seemed necessary?]

**Why Core Modification Appeared Necessary:**
[Detailed explanation]

**Requested Core Change:**
[Specific change that would have been made]

**Why Core Was NOT Modified:**
[Architectural principle / constraint / governance]

**Alternative Solution:**
- Type: [Contract / Kernel / Extension / Adapter / Domain Logic]
- Implementation: [Brief description]
- LOC: [Size of alternative]

**Outcome:**
- Feature Completed: [YES / NO]
- Core Modifications: [0]
- Workaround Quality: [Clean / Acceptable / Hacky]

**Lessons:**
[What did this teach about Core abstractions?]
```

### Non-Examples (DO NOT LOG)
- "Could have put this in Core for convenience" → not pressure
- "Slight duplication could be avoided" → not significant
- "Personal preference for different pattern" → not architectural

### Real Examples (LOG THESE)
- "Route optimization needs graph algorithms, Core has no graph support"
- "Event metadata insufficient, need additional context"
- "Orchestration pattern not supported by current event bus"
- "Performance issue requires index type Core doesn't have"

---

## 🚦 DAY 3 PASS CRITERIA

### HARD GATES (Must ALL Pass)
- [ ] Core modifications = 0
- [ ] Architecture Guard = PASS
- [ ] Healthcare Regression = PASS (52/52)
- [ ] **Logistics Unit Tests = 8/8 PASS** ✅ (not 4/8)
- [ ] **Integration Tests = PASS** ✅
- [ ] **RLS Isolation = VERIFIED** ✅
- [ ] **Migration Applied = YES** ✅
- [ ] Core → Logistics = 0
- [ ] Logistics → Core = 0
- [ ] Product → Engine bypass = 0
- [ ] Contract bypass = 0

### QUALITY GATES (Must ALL Pass)
- [ ] Capability #2 operational
- [ ] Contract-first design maintained
- [ ] No architectural workarounds
- [ ] No temporary exceptions
- [ ] No Core pollution
- [ ] No cross-product dependencies
- [ ] Event-driven integration maintained

### GOLD EVIDENCE (Conditional)
- [ ] ≥1 genuine "wanted to modify Core" event (if occurs)
- [ ] Alternative documented (if event occurs)
- [ ] Outcome verified (if event occurs)
- [ ] If 0 events: Documented as "No Core modification pressure observed"

**Important:** GOLD events cannot be fabricated for KPI. Must be genuine.

---

## 📊 MEASUREMENT TARGETS

### Code Metrics
| Metric | Day 2 | Day 3 Target | Method |
|--------|-------|--------------|--------|
| Logistics LOC | ~3,095 | ~4,500 | Count implementation |
| Core Modifications | 0 | 0 | `git diff` |
| Tests Passing | 4/8 (50%) | 16/16 (100%) | Test output |
| Capabilities | 1 | 2 | Feature count |

### Reusability Metrics (NEW)
| Item | Reused | Created New | Notes |
|------|--------|-------------|-------|
| Event Bus | ✅ | — | Platform infrastructure |
| RLS Pattern | ✅ | — | Platform infrastructure |
| Type Patterns | ✅ | — | Followed Healthcare |
| Graph Algorithms | — | ? | TBD (Route optimization) |
| Orchestration | ? | ? | TBD (Route + Shipment) |
| Aggregation | ? | ? | TBD (Metrics) |

**Action:** Track every infrastructure component used. Calculate reuse ratio.

### Performance Baselines
- Integration test execution time
- Database query count per operation
- Event publishing latency
- RLS policy overhead

---

## ⚠️ ANTI-PATTERNS TO AVOID

### 1. Fake GOLD Events
❌ **DO NOT:** Create artificial complexity just to log "wanted to modify Core"  
✅ **DO:** Only log genuine architectural tension

### 2. Workaround Acceptance
❌ **DO NOT:** Accept hacky workarounds and claim "Core wasn't modified"  
✅ **DO:** If alternative is hacky, that's evidence Core has a gap (log it)

### 3. Test Coverage Gaming
❌ **DO NOT:** Skip failing tests or lower assertions  
✅ **DO:** Fix root cause until all tests pass

### 4. Scope Inflation
❌ **DO NOT:** Add features beyond Day 3 plan  
✅ **DO:** Stay focused on residuals + Capability #2

### 5. Evidence Inflation
❌ **DO NOT:** Claim "Platform mature" after Day 3  
✅ **DO:** Only claim "Day 3 complete with X capabilities, 0 Core mods"

---

## 🔄 CONTINGENCY PLANS

### If Unit Tests Cannot Reach 8/8
**Option A:** Fix root cause (preferred)  
**Option B:** Accept 4/8 but document why (tech debt)  
**Option C:** Replace with integration tests only  
**Decision Criteria:** Is contract compliance verified? (Already YES)

### If RLS Isolation Fails
**Action:** BLOCK Day 3 progression. This is Gate 0 violation.  
**Fix:** Correct RLS policies immediately.

### If Capability #2 Requires Core Modification
**This is GOLD EVENT!** Log it thoroughly.  
**Then:** Find alternative or document as blocked requirement.  
**Do NOT:** Modify Core.

### If No GOLD Events Occur
**This is OK.** Document: "No Core modification pressure on Day 3."  
**NOT OK:** Claim this proves Core maturity.  
**OK:** Recognize need for more complex requirements in subsequent days.

---

## 📝 DELIVERABLES

### Code
- [ ] Fixed test mocks (8/8 passing)
- [ ] Integration test suite
- [ ] RLS verification script
- [ ] Route Management Contract (~300 LOC)
- [ ] Route Engine implementation (~600 LOC)
- [ ] Route tests

### Database
- [ ] Migration applied to test DB
- [ ] RLS verification results
- [ ] Performance baselines captured

### Evidence
- [ ] `evidence/week3/day-03.md` (7-question checklist)
- [ ] `evidence/week3/day-03-gold-events.md` (if any)
- [ ] `evidence/week3/day-03-reusability-metrics.md`
- [ ] Updated Day 2 evidence (residuals closed)

### Documentation
- [ ] Route Management Contract documentation
- [ ] Integration test guide
- [ ] Reusability ratio calculation
- [ ] Day 3 completion report

---

## 🎯 SUCCESS DEFINITION

**Day 3 is COMPLETE when:**
1. All Day 2 residuals closed (tests 8/8, migration applied, RLS verified)
2. Capability #2 operational (Route Management working)
3. All HARD gates pass (Core = 0, Architecture Guard, Regression)
4. GOLD evidence captured (if any genuine events occurred)
5. Reusability metrics measured (actual data, not estimates)
6. Evidence trail clean and accurate

**Day 3 is NOT complete if:**
- Tests still 4/8 (or worse)
- Migration not applied
- RLS not verified
- Capability #2 not working
- Any workarounds introduced
- Evidence trail has contradictions

---

## 📋 EXECUTION CHECKLIST

**Before Starting:**
- [x] Day 2 evidence corrected (contradictions fixed)
- [x] Day 3 plan documented (this file)
- [ ] Test environment verified (Supabase connected)
- [ ] Baseline measurements taken

**Track A (Residuals):**
- [ ] Task A1: Unit tests 8/8 PASS
- [ ] Task A2: Migration applied
- [ ] Task A3: RLS isolation verified
- [ ] Task A4: Integration tests PASS
- [ ] Task A5: Events verified
- [ ] Task A6: Gates re-run (all PASS)

**Track B (Capability #2):**
- [ ] Route Management Contract defined
- [ ] Route Engine implemented
- [ ] Route tests written and passing
- [ ] Route + Shipment coordination working

**Evidence:**
- [ ] GOLD events logged (if any)
- [ ] Reusability metrics measured
- [ ] Day 3 evidence complete
- [ ] Day 2 residuals marked closed

**Final Verification:**
- [ ] Core modifications = 0
- [ ] Architecture Guard = PASS
- [ ] Healthcare Regression = PASS
- [ ] No workarounds
- [ ] Evidence canonicalized

---

**Principle:** NO CLAIM WITHOUT EVIDENCE  
**Focus:** Breadth + pressure, not just LOC  
**Goal:** Prove Core can withstand business complexity increase

---

**END OF DAY 3 EXECUTION PLAN**
