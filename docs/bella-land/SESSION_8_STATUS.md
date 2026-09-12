# Session 8: Customers Discovery + C3.1-C3.2 — STATUS

**Date:** 2026-09-11  
**Session:** 8  
**Focus:** Phase 3 Customers Evidence Closure  
**Status:** 🔴 BLOCKED on RLS policies

---

## Work Completed

### C3.0: Discovery ✅ COMPLETE

**Entity Analysis:**
- Table: `re_customers` (Real Estate domain)
- Root aggregate (no parent ownership)
- Referenced by: reservations, bookings, contracts
- Layer 5: NOT APPLICABLE (no composite FK needed)

**Security Model:**
- RLS: Enabled
- Policies: ❌ NOT DEFINED (critical gap!)
- Tenant isolation: Layers 1-4 only

**Scope Defined:**
- ~38 gates total (C3.1: 5, C3.2: 9, C3.3: 10, C3.4: ~14)
- NO Layer 5 testing required
- Cross-entity invariants deferred to Phase 5

**Artifacts:**
- `C3_0_CUSTOMERS_DISCOVERY.md`

---

### C3.1: Customers Write Flow ✅ 5/5 PASS

**Test Script:** `test-customer-creation.ts`  
**Method:** service_role client (bypasses RLS)

**Results:**
```
✅ T1: Create customer via production path
✅ T2: Field semantics (name, phone, email, tenant_id)
✅ T3: Reload/read-back
✅ T4: Service tenant injection
✅ T5: Unique constraint (phone per tenant)
```

**Evidence:** Write flow + data semantics verified  
**Does NOT prove:** RLS enforcement (service_role bypasses RLS)

---

### C3.2: Authenticated Security 🔴 BLOCKED

**Test Script:** `test-customer-authenticated-security.ts`  
**Method:** Authenticated clients (Tenant A/B)

**Blocker:** Authenticated INSERT blocked by RLS

**Error:**
```
A1: Tenant A can SELECT own customer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FAIL
   Setup failed: new row violates row-level security policy for table "re_customers"
```

**RCA:**
- RLS enabled: ✅ Confirmed
- Policy existence: 🔴 Cannot verify (pg_policies query blocked)
- Runtime tenant authorization: 🔴 NOT VERIFIED
- Hypothesis: RLS enabled but policies missing → default deny

**Status:** ⏸️ CANNOT PROCEED until policies applied

---

## Critical Gap Identified

### GAP: RLS Policies Missing/Misconfigured (P0 🔴 BLOCKING)

**Issue:** Authenticated INSERT blocked by RLS on `re_customers`

**Evidence:**
- Error: "new row violates row-level security policy"
- RLS enabled: Confirmed
- Policy verification: Blocked by postgREST permissions
- Hypothesis: Policies missing or misconfigured

**Required Policies:**
1. `re_customers_tenant_read` (SELECT with HQ override)
2. `re_customers_tenant_write` (ALL with role check + HQ override)

**Pattern:** Must match canonical authorization used by Projects/Products
- Helper: `public.get_auth_tenant_id()`
- Override: `public.is_hq_super_admin()`
- Roles: admin, super_admin, admin_staff

**Resolution:** Apply policies via Supabase Dashboard SQL Editor

**Documentation:** `C3_0_RLS_POLICY_GAP.md`

---

## Artifacts Created

### Documentation
- `C3_0_CUSTOMERS_DISCOVERY.md` — Complete entity analysis
- `C3_0_RLS_POLICY_GAP.md` — RLS blocker documentation

### Test Scripts
- `test-customer-creation.ts` — C3.1 write flow (✅ 5/5 PASS)
- `test-customer-authenticated-security.ts` — C3.2 security (🔴 BLOCKED)

### Migration Files
- `20260911010000_add_re_customers_rls_policies.sql` — Not yet applied

---

## Program Status

```
BELLA LAND V2 RC — CUSTOMERS PHASE

Projects       🔒 CLOSED (10/10)
Products       🔒 CLOSED (35/35)
Customers      🟡 IN PROGRESS
├─ C3.0        ✅ COMPLETE
├─ C3.1        🔒 VERIFIED (5/5)
├─ C3.2        🔴 BLOCKED (RLS policies)
├─ C3.3        ⏸️ PENDING
├─ C3.4        ⏸️ PENDING
└─ C3.5        ⏸️ PENDING

Reservations   🔒 CLOSED
Phase 5        ⏸️ PENDING
RC Final Seal  ⏸️ PENDING
```

---

## Next Steps

### Immediate: Fix RLS Policies

**Action Required:** Apply policies via Supabase Dashboard

**SQL to Execute (matches canonical Projects/Products pattern):**
```sql
DROP POLICY IF EXISTS "re_customers_tenant_read" ON re_customers;
DROP POLICY IF EXISTS "re_customers_tenant_write" ON re_customers;

CREATE POLICY "re_customers_tenant_read"
  ON re_customers FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

CREATE POLICY "re_customers_tenant_write"
  ON re_customers FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );
```

**Verification:**
```bash
npx tsx scripts/bella-land/test-customer-authenticated-security.ts
```

**Expected:** A1-A9 → 9/9 PASS (full suite, not just failed tests)  
**If ANY fail:** Real security evidence requiring RCA

---

### After RLS Fix: Continue C3.2-C3.5

**C3.2:** Execute authenticated security tests (9 gates)  
**C3.3:** Build customer UI + browser runtime (10 gates)  
**C3.4:** Full regression (C3.1 + C3.2 + read/update)  
**C3.5:** Customers seal

---

## Evidence Boundary Note

**C3.1 5/5 PASS does NOT prove RLS enforcement.**

- C3.1 used `service_role` (bypasses RLS)
- C3.1 only proves: write flow + data semantics
- C3.2 required to prove: RLS runtime security

**No evidence cross-contamination:** C3.1 PASS stands alone as "write flow verified", C3.2 will separately prove "security runtime verified".

---

## Session Metrics

**Duration:** ~2 hours  
**Documents:** 3  
**Scripts:** 3  
**Tests Passed:** 5/5 (C3.1 only)  
**Tests Blocked:** 9 (C3.2)  
**Critical Gaps:** 1 (RLS policies)

---

## Key Decisions

### 1. Layer 5 Scope Boundary
**Decision:** Customers does NOT need Layer 5 at C3 capability level  
**Rationale:** Root entity, no parent ownership (unlike Products → Projects)  
**Deferred:** Cross-entity invariants (Customer ↔ Reservation tenant consistency) to Phase 5  
**Evidence Boundary:** C3 proves RLS; Phase 5 proves cross-entity linkage

### 2. Evidence Boundary
**Decision:** C3.1 PASS does NOT prove RLS  
**Rationale:** service_role bypasses RLS; need authenticated client tests  
**Impact:** C3.2 required separately, cannot skip

### 3. Canonical Authorization Pattern
**Decision:** Use `public.get_auth_tenant_id()` and `public.is_hq_super_admin()`  
**Rationale:** Match Projects/Products RLS policy pattern for consistency  
**Impact:** Customers policies identical to Projects/Products structure

### 4. Manual Policy Application
**Decision:** Apply policies via Dashboard, not CLI migration  
**Rationale:** Migration history mismatch blocking `supabase db push`  
**Tradeoff:** Manual step, but unblocks evidence closure

---

## Lessons Learned

### 1. RLS Enabled ≠ RLS Configured
**Context:** Table had RLS enabled but policies could not be verified  
**Learning:** Error "violates RLS policy" proves block, NOT policy count  
**Practice:** Must verify `pg_policies` catalog query to confirm 0 rows vs. misconfiguration

### 2. Canonical Pattern Enforcement
**Context:** Found existing `get_auth_tenant_id()` and `is_hq_super_admin()` helpers  
**Learning:** New entities should match existing authorization patterns  
**Practice:** Check Projects/Products policies before creating new ones  
**Governance:** Created `CANONICAL_PATTERN_PRINCIPLE.md` to formalize this

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

### 2. service_role Masks RLS Gaps
**Context:** C3.1 passed using service_role, hiding RLS issue  
**Learning:** service_role tests cannot prove security runtime  
**Practice:** Always follow with authenticated client tests

### 3. Evidence Boundary Precision
**Context:** Initially stated "no Layer 5 needed"  
**Learning:** Layer 5 scope depends on test level (C3 vs. Phase 5)  
**Practice:** Clarify "not needed at C3" vs. "deferred to Phase 5"

---

## Resolution Path

🔴 **BLOCKED:** C3.2 cannot proceed without RLS policies

**Unblock:** Apply 2 SQL policies via Dashboard → ~2 minutes  
**Verify:** Run C3.2 script → expect 9/9 PASS  
**Continue:** C3.3 Browser UI → C3.4 Regression → C3.5 Seal

**Estimated to C3.5:** ~3-4 hours after unblock

**New Governance Artifact:** `docs/architecture/CANONICAL_PATTERN_PRINCIPLE.md`

---

**Session 8 Status: 🔴 BLOCKED (awaiting RLS policy fix)**

_Resume after policies applied and C3.2 verification complete._

---

_End of Session 8 Status_
