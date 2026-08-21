# WEEK 3 — RESIDUAL LEDGER

**Purpose:** Track unresolved verification items across Gate A and Gate B

**Principle:** Residuals are NOT failures. They are documented items requiring future resolution.

---

## 🔴 ACTIVE RESIDUALS

### Residual #1: Integration Runtime Verification

**Origin:** Gate A — Step 7  
**Status:** ⚠️ PENDING  
**Severity:** Medium (Does not block Gate B)

**Description:**
Integration test framework established (~450 LOC) but execution blocked by test environment configuration.

**Root Cause:**
1. Missing `tenants` table in test database
2. Foreign key constraint on `tenant_id` prevents test data creation
3. Service role RLS bypass not configured for test mode

**Current State:**
- Test framework: CREATED ✅
- Test execution: BLOCKED ⚠️
- Tests written: 8 (shipment creation, tracking, status updates, carrier assignment, history, idempotency, positive/negative isolation)
- Tests passing: 0/8 (execution blocked by environment configuration)
- Functional correctness: UNCLAIMED (cannot conclude without successful execution)

**Impact:**
- Architecture verified (Level 1) ✅
- Infrastructure verified (Level 2) ✅
- Runtime functional verification incomplete (Level 3) ⚠️

**Resolution Path:**
1. Create `tenants` table in test database OR
2. Remove FK constraint for test environment OR
3. Use database seeding to populate tenant fixtures

**Owner:** TBD  
**Target:** Post-Gate B (Does not block Route Management)

**Evidence Required for Closure:**
- [ ] Test environment configured
- [ ] Integration tests executed
- [ ] Output captured showing 8/8 PASS (or documented failures with fixes)
- [ ] Evidence document updated with new results

**Note:** Framework is architecturally sound. This is configuration, not design defect.

---

### Residual #2: RLS Runtime Isolation Verification

**Origin:** Gate A — Step 8  
**Status:** ⚠️ PENDING  
**Severity:** Low (Static verification complete)

**Description:**
RLS tenant isolation policies verified statically (Step 4) but runtime verification blocked by missing PostgreSQL `set_config` function.

**Root Cause:**
- Supabase environment does not expose `set_config(setting, value, is_local)` function
- Tenant context switching mechanism differs from expected PostgreSQL standard

**Current State:**
- RLS enabled: VERIFIED ✅ (5/5 data tables via pg_tables query)
- RLS policies exist: VERIFIED ✅ (5/5 tenant isolation policies via pg_policies query)
- Policy syntax: VERIFIED ✅ (policies use tenant_id filtering via current_setting)
- RLS runtime test: BLOCKED ⚠️ (cannot set tenant context dynamically)

**Impact:**
- Static verification complete: Policies exist and use tenant_id isolation pattern ✅
- Runtime tenant isolation behavior: Unverified (requires execution) ⚠️
- Policies verified statically but runtime effectiveness pending ⚠️

**Resolution Path:**
1. Use Supabase-specific tenant context API (not standard PostgreSQL) OR
2. Test via application layer (not direct SQL) OR
3. Use service role queries without explicit tenant context setting

**Owner:** TBD  
**Target:** Post-Gate B (Alternative approach exploration)

**Evidence Required for Closure:**
- [ ] Alternative verification approach identified
- [ ] Runtime isolation test executed with alternative method
- [ ] Output captured showing positive/negative isolation tests
- [ ] Evidence document updated with new approach

**Note:** Static verification confirms policies exist with tenant_id isolation pattern. Runtime verification requires different approach to confirm actual isolation behavior, not policy syntax fixes.

---

## 🟢 RESOLVED RESIDUALS

None yet. Gate A residuals are first documented residuals in Week 3.

---

## 📋 RESIDUAL TRACKING RULES

### When to Create Residual

**YES - Create Residual:**
- Verification step blocked by external dependency
- Infrastructure created but execution pending
- Static verification complete but runtime pending
- Configuration gap prevents execution
- Alternative approach needed

**NO - Do NOT Create Residual:**
- Test failed due to code defect (fix the code)
- Architectural violation detected (fix the architecture)
- Regression detected (fix the regression)
- Known missing feature (implement or descope)

### Residual Lifecycle

```
PENDING → RESOLVED → CLOSED
   ↓          ↓
BLOCKED    VERIFIED
            (with new evidence)
```

### Closure Criteria

**To close a residual:**
1. Execute the deferred verification step
2. Capture NEW output/evidence (cannot reuse old evidence)
3. Update residual status with results
4. Link to new evidence document
5. Mark RESOLVED if verification passes
6. Mark CLOSED after review

**Invalid Closure:**
- ❌ "Deemed not necessary" (without execution)
- ❌ "Covered by other tests" (without specific evidence)
- ❌ "Will fix later" (without execution)

**Valid Closure:**
- ✅ Executed with output captured
- ✅ PASS with evidence documented
- ✅ Alternative approach verified

---

## 📊 RESIDUAL METRICS

**Gate A Residuals:**
- Total: 2
- Pending: 2
- Resolved: 0
- Closed: 0

**By Severity:**
- High: 0 (Gate B blockers)
- Medium: 1 (Integration runtime)
- Low: 1 (RLS runtime - static verification complete)

**By Type:**
- Configuration: 2
- Code Defect: 0
- Architecture Gap: 0

**Interpretation:** All residuals are environment/configuration issues, not architecture or code quality issues.

---

## 🎯 RESIDUAL IMPACT ON GATE B

**Question:** Can Gate B (Route Management) proceed with these residuals?

**Answer:** YES ✅

**Rationale:**
1. **Critical gates passed:** Architecture Guard, Healthcare Regression, Core Integrity (3/3)
2. **Infrastructure verified:** Schema, RLS policies, frameworks established (6/6)
3. **Residuals are non-blocking:** Configuration issues, not design defects
4. **Route Management scope:** Contract + Engine + Tests (does not depend on Shipment runtime verification)

**Condition:**
- Residuals must remain documented in ledger
- Gate B does NOT inherit these residuals as RESOLVED
- New evidence required to close residuals
- Cannot claim "full functional verification" until residuals resolved

---

## 📝 RESIDUAL DOCUMENTATION DISCIPLINE

### When Updating Ledger

**Add Entry:**
- When verification step deferred
- When execution blocked by external dependency
- When alternative approach needed

**Update Entry:**
- When new information about resolution path emerges
- When ownership assigned
- When target timeline changes
- When resolution attempted (regardless of outcome)

**Close Entry:**
- Only after execution with captured evidence
- Only after verification passes (or documented failure)
- Never without new output

### Evidence Requirements

**For Each Residual:**
- Origin: Which step/gate created it
- Root cause: Why blocked (not just "doesn't work")
- Current state: What IS verified vs what ISN'T
- Resolution path: Specific steps needed
- Impact: What claims are affected

**For Closure:**
- Execution output captured
- Pass/fail status clear
- New evidence document created or updated
- Cannot reuse old evidence

---

## 🔒 GATE A CLOSURE WITH RESIDUALS

**Gate A Status:** Critical Architecture Verification PASSED

**Level 1 (Architecture):** 3/3 PASS ✅  
**Level 2 (Infrastructure):** 6/6 PASS ✅  
**Level 3 (Runtime):** 2 residuals documented ⚠️

**Residuals:** 2 PENDING (non-blocking for Gate B)

**Authorization:** Gate B approved to proceed

**Principle:** Residuals are tracked, not hidden. Evidence discipline maintained.

---

**Ledger Owner:** Kiro AI  
**Created:** 2026-08-21  
**Last Updated:** 2026-08-21

**Next Review:** After Gate B completion

---

**END OF RESIDUAL LEDGER**
