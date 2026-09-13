# Session 8: Customers C3.0-C3.2 — CORRECTED STATUS

**Date:** 2026-09-11  
**Session:** 8  
**Focus:** Phase 3 Customers Evidence Closure  
**Status:** 🔴 BLOCKED on RLS policies (corrected RCA)

---

## Corrections Applied

### 1. RCA Wording Precision
**Before:** "RLS enabled + 0 policies = confirmed"  
**After:** "Authenticated blocked; policy existence not directly verified"  
**Reason:** Error proves block, NOT policy count without catalog query

### 2. Canonical Authorization Pattern
**Before:** Custom `(SELECT tenant_id FROM users WHERE id = auth.uid())`  
**After:** Canonical `public.get_auth_tenant_id()` + `public.is_hq_super_admin()`  
**Reason:** Must match Projects/Products pattern for consistency

### 3. Layer 5 Boundary Clarification
**Before:** "Layer 5 NOT applicable"  
**After:** "Layer 5 NOT applicable at C3 level; cross-entity invariants deferred to Phase 5"  
**Reason:** Precision on scope boundary (C3 vs. Phase 5)

---

## Work Completed

### C3.0: Discovery ✅ COMPLETE

**Entity:** `re_customers` (Real Estate domain)  
**Classification:** Tenant-scoped root aggregate

**Layer 5 Scope:**
- C3 Level: ❌ NOT applicable (no parent ownership)
- Phase 5 Level: ✅ REQUIRED (Customer ↔ Reservation tenant consistency)

**Security Model:**
- RLS: Enabled
- Policies: 🔴 Missing/misconfigured (hypothesis)
- Pattern: Must match Projects/Products canonical authorization

---

### C3.1: Write Flow ✅ 5/5 PASS

**Method:** service_role (bypasses RLS)  
**Evidence:** Write flow + data semantics verified  
**Does NOT prove:** RLS enforcement

**Results:**
```
✅ T1: Create customer
✅ T2: Field semantics
✅ T3: Read-back
✅ T4: Tenant injection
✅ T5: Unique constraint
```

---

### C3.2: Authenticated Security 🔴 BLOCKED

**Method:** Authenticated clients (Tenant A/B)  
**Error:** "new row violates row-level security policy"

**RCA (Corrected):**
- RLS enabled: ✅ Confirmed
- Policy catalog: 🔴 Cannot query (pg_policies blocked by postgREST)
- Hypothesis: Policies missing or misconfigured → default deny
- Conservative conclusion: Authenticated operations blocked; RLS misconfigured

**Status:** ⏸️ BLOCKED awaiting policy application

---

## Required Fix

### Canonical Authorization Pattern

**Helpers (from Projects/Products):**
- `public.get_auth_tenant_id()` — Get user's tenant
- `public.is_hq_super_admin()` — HQ override
- Role check: `admin`, `super_admin`, `admin_staff`

### SQL to Apply (via Supabase Dashboard)

```sql
-- Drop existing (if any)
DROP POLICY IF EXISTS "re_customers_tenant_read" ON re_customers;
DROP POLICY IF EXISTS "re_customers_tenant_write" ON re_customers;

-- READ policy (SELECT + HQ override)
CREATE POLICY "re_customers_tenant_read"
  ON re_customers
  FOR SELECT
  TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

-- WRITE policy (ALL + role check + HQ override)
CREATE POLICY "re_customers_tenant_write"
  ON re_customers
  FOR ALL
  TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
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
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

-- Verify
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 're_customers';
```

### Verification

**Run FULL C3.2 suite (A1-A9):**
```bash
npx tsx scripts/bella-land/test-customer-authenticated-security.ts
```

**Expected:** 9/9 PASS

**If ANY fail:** Real security evidence requiring RCA (not policy absence)

---

## Program Status

```
Projects       🔒 CLOSED (10/10)
Products       🔒 CLOSED (35/35)
Customers      🟡 IN PROGRESS
├─ C3.0        ✅ COMPLETE
├─ C3.1        🔒 VERIFIED (5/5)
├─ C3.2        🔴 BLOCKED
├─ C3.3        ⏸️ PENDING
├─ C3.4        ⏸️ PENDING
└─ C3.5        ⏸️ PENDING
```

---

## Key Corrections

### 1. RCA Precision
**Issue:** Cannot claim "0 policies" without catalog query  
**Correction:** State "authenticated blocked; policies likely missing"  
**Evidence Standard:** Error proves block; catalog query proves count

### 2. Authorization Consistency
**Issue:** Proposed ad-hoc tenant query pattern  
**Correction:** Use canonical `get_auth_tenant_id()` helper  
**Standard:** Match existing Projects/Products policies

### 3. Layer 5 Scope
**Issue:** Absolute "Layer 5 not needed"  
**Correction:** "Not needed at C3; deferred to Phase 5"  
**Boundary:** C3 = RLS only; Phase 5 = cross-entity invariants

---

## Evidence Boundary

**C3.1 (service_role):**
- ✅ Proves: Write flow + data semantics
- ❌ Does NOT prove: RLS enforcement

**C3.2 (authenticated):**
- ✅ Will prove: RLS runtime + tenant isolation
- ⏸️ Currently blocked: Policy application required

**Phase 5 (integration):**
- ⏸️ Will prove: Customer ↔ Reservation tenant consistency
- ⏸️ Will prove: Cross-entity linkage integrity

---

## Next Steps

1. **Apply policies** via Supabase Dashboard (using canonical pattern)
2. **Run full C3.2** (A1-A9, not just failed tests)
3. **Document verdict:** 9/9 PASS → C3.2 🔒 VERIFIED
4. **Continue to C3.3:** Browser UI implementation

---

**Session 8 Status: 🔴 BLOCKED (corrected RCA, awaiting policy fix)**

_Documentation corrected for RCA precision, canonical pattern, and Layer 5 boundary clarity._

---

_End of Corrected Status_
