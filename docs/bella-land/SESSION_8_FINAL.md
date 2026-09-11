# Session 8: Customers C3.0-C3.1 + C3.2 Preparation — CLOSED

**Date:** 2026-09-11  
**Session:** 8  
**Focus:** Phase 3 Customers Evidence Closure (Discovery + Write Flow + Security Prep)  
**Status:** ✅ CLOSED (Ready for C3.2 execution)

---

## Session Scope

**Completed:**
- C3.0 Discovery
- C3.1 Write Flow (5/5 PASS)
- C3.2 Preparation (RLS policies ready, test script ready)

**Not Completed (Next Session):**
- C3.2 Execution (policy apply + A1-A9)
- C3.3 Browser Runtime
- C3.4 Regression
- C3.5 Customers Seal

---

## Work Completed

### C3.0: Discovery ✅ COMPLETE

**Entity Analysis:**
- Table: `re_customers` (Real Estate domain)
- Classification: Tenant-scoped root aggregate
- Relationships: Referenced by reservations, bookings, contracts
- No parent ownership (unlike Products → Projects)

**Layer 5 Boundary:**
- C3 Capability Level: ❌ NOT applicable (no local parent FK)
- Phase 5 Integration: ✅ REQUIRED (Customer ↔ Reservation tenant consistency)

**Security Model:**
- RLS: Enabled
- Policies: Missing/misconfigured (hypothesis)
- Pattern: Must match Projects/Products canonical

**Artifacts:**
- `C3_0_CUSTOMERS_DISCOVERY.md`

---

### C3.1: Write Flow ✅ 5/5 PASS (VERIFIED)

**Method:** service_role (bypasses RLS)  
**Script:** `scripts/bella-land/test-customer-creation.ts`

**Results:**
```
✅ T1: Create customer via production path
✅ T2: Field semantics (name, phone, email, tenant_id)
✅ T3: Reload/read-back
✅ T4: Service tenant injection
✅ T5: Unique constraint (phone per tenant)
```

**Evidence:**
- Proves: Write flow + data semantics
- Does NOT prove: RLS enforcement (service_role bypasses RLS)

**Verdict:** C3.1 🔒 VERIFIED

---

### C3.2: Preparation ✅ READY

**Test Script:** `scripts/bella-land/test-customer-authenticated-security.ts`  
**Method:** Authenticated clients (Tenant A/B)  
**Gates:** A1-A9

**Blocker Identified:**
- Authenticated INSERT blocked by RLS
- Error: "new row violates row-level security policy"
- Hypothesis: Policies missing/misconfigured

**RCA (Corrected):**
- RLS enabled: ✅ Confirmed
- Policy existence: 🔴 Cannot directly verify (pg_policies query blocked)
- Conservative conclusion: Policies missing → default deny

**Solution: Canonical RLS Policies**

**Pattern Identified:**
- Projects/Products use: `public.get_auth_tenant_id()` + `public.is_hq_super_admin()`
- Role list: `('admin', 'super_admin', 'admin_staff')` — EXACT

**Migration Created:**
- File: `supabase/migrations/20260911010000_add_re_customers_rls_policies.sql`
- Pattern: Matches Projects/Products canonical authorization
- Helpers: Reuses existing `get_auth_tenant_id()` and `is_hq_super_admin()`

**Test User Requirements:**
- Tenant A: `loadtest-realestate@test.local` (regular tenant admin)
- Tenant B: `loadtest-healthcare@test.local` (regular tenant admin)
- 🔴 CRITICAL: Must NOT be HQ super admin (would bypass isolation)

**Artifacts:**
- `C3_0_RLS_POLICY_GAP.md` — RCA + remediation
- `C3_2_PRE_EXECUTION_CHECKLIST.md` — Verification checklist
- `test-customer-authenticated-security.ts` — Ready to run

---

## Governance Artifact Created

**New Document:** `docs/architecture/CANONICAL_PATTERN_PRINCIPLE.md`

**Golden Rule:**
> Before creating a new pattern, first prove that no canonical pattern already exists.

**Scope:**
- MUST check canonical: Architecture, data, security, auth, API, workflow, test, naming
- MAY skip: Local presentation (UI copy, spacing, tooltips)

**Decision Rule:**
```
IF change affects:
  - Multiple modules OR
  - Database/security/auth OR
  - API/workflow/test patterns
THEN: CHECK CANONICAL FIRST

ELSE IF local presentation only:
THEN: Handle locally
```

**Purpose:** Keep Bella cohesive as it scales, not fragmented

---

## Evidence Boundary Precision

### C3.1 Evidence Scope
**Proves:**
- ✅ Write flow works (create customer → DB)
- ✅ Data semantics (fields, constraints, timestamps)
- ✅ Tenant injection (tenant_id set correctly)
- ✅ Unique constraint (phone per tenant)

**Does NOT Prove:**
- ❌ RLS enforcement (service_role bypasses RLS)
- ❌ Tenant isolation (no cross-tenant tests)
- ❌ Authorization runtime

---

### C3.2 Evidence Scope (After Execution)
**Will Prove:**
- ✅ RLS runtime enforcement
- ✅ Tenant isolation (cross-tenant operations blocked)
- ✅ Forgery prevention (WITH CHECK on INSERT)
- ✅ Escape prevention (WITH CHECK on UPDATE)
- ✅ Canonical pattern enforcement

**Requires:**
- ✅ Authenticated clients (NOT service_role)
- ✅ Regular tenant users (NOT HQ super admin)
- ✅ Full A1-A9 execution (not partial)

---

### Phase 5 Evidence Scope (Deferred)
**Will Prove:**
- ✅ Customer ↔ Reservation tenant consistency
- ✅ Cross-entity linkage integrity
- ✅ End-to-end workflow: Project → Product → Customer → Reservation

---

## Critical Path Forward

```
Session 8 CLOSED
        ↓
Apply canonical RLS policies (manual)
        ↓
Verify pg_policies = 2 rows (policy objects exist)
        ↓
Run authenticated A1-A9 (runtime proof)
        ↓
VERDICT:
├─ 9/9 PASS → C3.2 🔒 VERIFIED → C3.3 Browser
└─ ANY FAIL → freeze evidence → RCA → fix → rerun full A1-A9
```

**Note:** `pg_policies = 2 rows` proves policy **existence**, NOT runtime correctness. A1-A9 PASS proves runtime enforcement.

---

## Key Corrections Applied

### 1. RCA Precision
**Before:** "RLS enabled + 0 policies confirmed"  
**After:** "Authenticated blocked; policy existence unverified (catalog query blocked)"  
**Why:** Error proves block, not policy count without catalog query

### 2. Canonical Pattern
**Before:** Custom `(SELECT tenant_id FROM users WHERE id = auth.uid())`  
**After:** Canonical `public.get_auth_tenant_id()` + `public.is_hq_super_admin()`  
**Why:** Must match Projects/Products for consistency

### 3. Layer 5 Boundary
**Before:** "Layer 5 not applicable"  
**After:** "Not applicable at C3 level; deferred to Phase 5"  
**Why:** Precision on scope boundary (C3 vs. Phase 5)

### 4. Test User Requirements
**Before:** Not explicitly documented  
**After:** Must be regular tenant admins (NOT HQ super admin)  
**Why:** HQ override would invalidate isolation evidence

---

## Key Decisions

### 1. Canonical Pattern Enforcement
**Decision:** Use `get_auth_tenant_id()` and `is_hq_super_admin()`  
**Rationale:** Match Projects/Products RLS policy pattern  
**Impact:** Consistent authorization across all entities  
**Governance:** Formalized in CANONICAL_PATTERN_PRINCIPLE.md

### 2. Layer 5 Scope Boundary
**Decision:** C3=no Layer 5; Phase 5=cross-entity verification  
**Rationale:** Customers is root entity (no parent ownership)  
**Boundary:** C3 proves RLS; Phase 5 proves Customer ↔ Reservation linkage

### 3. Evidence Separation
**Decision:** C3.1 PASS does NOT prove RLS  
**Rationale:** service_role bypasses RLS  
**Impact:** C3.2 required separately for security evidence

---

## Session Metrics

**Duration:** ~3 hours  
**Documents Created:** 6  
**Test Scripts Created:** 2  
**Tests Executed:** 5 (C3.1)  
**Tests Blocked:** 9 (C3.2)  
**Governance Principles:** 1  

---

## Lessons Learned

### 1. RLS Enabled ≠ RLS Configured
**Context:** RLS flag enabled but operations blocked  
**Learning:** Error proves block, not policy count  
**Practice:** Must verify catalog query to confirm 0 rows vs. misconfiguration

### 2. Canonical Pattern Discovery
**Context:** Found `get_auth_tenant_id()` after proposing custom pattern  
**Learning:** Check existing patterns BEFORE creating new ones  
**Practice:** Formalized in CANONICAL_PATTERN_PRINCIPLE.md

### 3. Evidence Boundary Precision
**Context:** C3.1 vs. C3.2 vs. Phase 5 scope  
**Learning:** Be precise about what each phase proves  
**Practice:** Document scope boundaries explicitly

### 4. Test User Validation
**Context:** HQ super admin would bypass isolation  
**Learning:** Test users MUST match test intent (regular tenant users)  
**Practice:** Document test user requirements explicitly

---

## Artifacts Created

### Documentation
- `C3_0_CUSTOMERS_DISCOVERY.md` — Entity analysis
- `C3_0_RLS_POLICY_GAP.md` — RCA + remediation
- `C3_2_PRE_EXECUTION_CHECKLIST.md` — Execution checklist
- `SESSION_8_STATUS.md` — Working status
- `SESSION_8_CORRECTED_STATUS.md` — Corrections summary
- `SESSION_8_FINAL.md` — This document

### Code
- `scripts/bella-land/test-customer-creation.ts` — C3.1 write flow
- `scripts/bella-land/test-customer-authenticated-security.ts` — C3.2 security

### Migrations
- `supabase/migrations/20260911010000_add_re_customers_rls_policies.sql` — RLS policies

### Governance
- `docs/architecture/CANONICAL_PATTERN_PRINCIPLE.md` — Pattern enforcement principle

---

## Program Status

```
Projects       🔒 CLOSED (10/10 gates)
Products       🔒 CLOSED (35/35 gates)
Customers      🟡 IN PROGRESS
├─ C3.0        ✅ COMPLETE
├─ C3.1        🔒 VERIFIED (5/5)
├─ C3.2        ▶️ APPLY POLICY + RUN A1-A9
├─ C3.3        ⏸️ BLOCKED (awaiting C3.2)
├─ C3.4        ⏸️ BLOCKED
└─ C3.5        ⏸️ BLOCKED

Reservations   🔒 CLOSED
Phase 5        ⏸️ PENDING
RC Final Seal  ⏸️ PENDING
```

---

## Next Session: C3.2 Execution

**Objective:** Apply RLS policies + execute full A1-A9

**Prerequisites:**
1. ✅ RLS policies prepared (canonical pattern)
2. ✅ Test script ready
3. ✅ Test user requirements documented
4. ⏸️ Policies NOT YET applied (manual step)

**Action Required:**
1. Apply RLS policies via Supabase Dashboard SQL Editor
2. Verify `pg_policies` shows 2 rows (policy objects exist)
3. Run full A1-A9: `npx tsx scripts/bella-land/test-customer-authenticated-security.ts`
4. Document verdict:
   - 9/9 PASS → C3.2 🔒 VERIFIED → C3.3 Browser
   - ANY FAIL → freeze evidence → RCA → fix → rerun

**Estimated Duration:** ~30 min (policy apply + test execution)

---

## Session 8 Closure

**Status:** ✅ CLOSED  
**Outcome:** Ready for C3.2 execution  
**Quality:** Evidence boundaries clear, canonical pattern enforced, governance formalized

**Handoff:** Next session starts with manual policy application, then C3.2 A1-A9 execution

---

**Session 8: CLOSED — Ready for C3.2 Execution**

_All preparation complete. Next action: Apply policies → Run A1-A9._

---

_End of Session 8 Final Document_
