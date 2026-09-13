# C3.0: Critical RLS Policy Gap — BLOCKING C3.2

**Status:** 🔴 BLOCKING  
**Date:** 2026-09-11  
**Priority:** P0  
**Affects:** C3.2 Authenticated Security Testing

---

## Issue

**Authenticated INSERT on `re_customers` is BLOCKED by RLS.**

**Evidence:**
```
❌ FAIL: new row violates row-level security policy for table "re_customers"
```

**Analysis Required:**
- ✅ RLS enabled: Confirmed (`ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY`)
- 🔴 Policy existence: MUST VERIFY via `SELECT * FROM pg_policies WHERE tablename = 're_customers'`
- 🔴 Runtime tenant authorization: NOT YET VERIFIED

**Hypothesis:** RLS enabled but no policies defined → default deny all operations

**Status:** Policy catalog query blocked by postgREST permissions; cannot confirm 0 rows directly

**Conservative RCA:** Authenticated operations blocked; RLS likely misconfigured or missing policies

---

## Evidence

**C3.2 Test Execution:**
```
A1: Tenant A can SELECT own customer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FAIL
   Setup failed: new row violates row-level security policy for table "re_customers"
```

**Current Schema State:**
```sql
-- RLS is ENABLED
ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY;

-- But NO POLICIES exist
SELECT * FROM pg_policies WHERE tablename = 're_customers';
-- Returns: 0 rows
```

---

## Root Cause

Migration file `20260911010000_add_re_customers_rls_policies.sql` exists locally but has NOT been applied to production database due to migration history mismatch:

```
The remote database's migration history does not match local files
```

---

## Required Policies

**Pattern:** Must match canonical authorization used by Projects/Products

**Canonical Helpers:**
- `public.get_auth_tenant_id()` — Get authenticated user's tenant_id
- `public.is_hq_super_admin()` — Check if user is HQ super admin

### Policy 1: Read Access (SELECT)
```sql
DROP POLICY IF EXISTS "re_customers_tenant_read" ON re_customers;

CREATE POLICY "re_customers_tenant_read"
  ON re_customers
  FOR SELECT
  TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );
```

### Policy 2: Write Access (INSERT, UPDATE, DELETE)
```sql
DROP POLICY IF EXISTS "re_customers_tenant_write" ON re_customers;

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
```

**Note:** This pattern matches Projects/Products RLS policies for consistency.

---

## Manual Fix (Supabase Dashboard)

**Step 1:** Go to Supabase Dashboard → SQL Editor

**Step 2:** Execute the following SQL (matches canonical Projects/Products pattern):

```sql
-- Drop any existing policies (if any)
DROP POLICY IF EXISTS "re_customers_tenant_read" ON re_customers;
DROP POLICY IF EXISTS "re_customers_tenant_write" ON re_customers;

-- Create READ policy (with HQ super admin override)
CREATE POLICY "re_customers_tenant_read"
  ON re_customers
  FOR SELECT
  TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

-- Create WRITE policy (admin roles + HQ override)
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

-- Verify policies created
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 're_customers';
```

**Step 3:** Verify output shows 2 policies:
```
schemaname | tablename    | policyname                   | cmd | roles
public     | re_customers | re_customers_tenant_read     | r   | {authenticated}
public     | re_customers | re_customers_tenant_write    | *   | {authenticated}
```

**Step 4:** Re-run **FULL** C3.2 test (A1-A9, not just failed tests):
```bash
npx tsx scripts/bella-land/test-customer-authenticated-security.ts
```

**Expected:** A1-A9 → 9/9 PASS

**Critical Verification Points:**
1. ✅ Test users: Regular tenant users (NOT HQ super admin)
2. ✅ Test users: Have admin roles (`admin`, `super_admin`, or `admin_staff`)
3. ✅ Role list: Matches canonical exactly `('admin', 'super_admin', 'admin_staff')`

**If ANY gate fails after policies applied:** Real security evidence requiring RCA

---

## Test User Validation

**Tenant A User:** `loadtest-realestate@test.local`
- Must be: Regular tenant user (NOT HQ super admin)
- Must have: One of `admin`, `super_admin`, or `admin_staff` roles
- Tenant: K6 Load Test — Real Estate

**Tenant B User:** `loadtest-healthcare@test.local`
- Must be: Regular tenant user (NOT HQ super admin)
- Must have: One of `admin`, `super_admin`, or `admin_staff` roles
- Tenant: K6 Load Test — Healthcare OS

**Why This Matters:**
- `is_hq_super_admin()` bypasses tenant isolation
- Using HQ super admin would give FALSE PASS on tenant isolation tests
- C3.2 MUST prove tenant isolation, not HQ override

---

## Expected Behavior After Fix

**A1-A9 should follow this pattern:**

✅ **PASS:**
- A1: Tenant A SELECT own customer
- A3: Tenant A INSERT own customer
- A5: Tenant A UPDATE own customer
- A8: Tenant A DELETE own customer

❌ **BLOCK (RLS enforced):**
- A2: Tenant A cannot SELECT Tenant B customer
- A4: Tenant A cannot INSERT with Tenant B tenant_id (forgery)
- A6: Tenant A cannot UPDATE Tenant B customer
- A7: Tenant A cannot UPDATE own customer → Tenant B (escape)
- A9: Tenant A cannot DELETE Tenant B customer

---

## Impact

**Blocks:**
- ❌ C3.2 Authenticated Security (cannot test)
- ❌ C3.3 Browser Runtime (UI will fail silently)
- ❌ C3.4 Regression
- ❌ C3.5 Customers Seal

**Unblocks after fix:**
- ✅ C3.1 Write Flow already PASS (used service_role)
- ✅ C3.2 can proceed after policies applied
- ✅ Customer actions will work in production UI

---

## Priority

🔴 **P0 — MUST FIX BEFORE CONTINUING**

Cannot proceed with Customers evidence closure until RLS policies are in place.

---

## Resolution Status

⏸️ **PENDING MANUAL FIX**

**Action Required:** Apply policies via Supabase Dashboard SQL Editor

**Verification:** Run `npx tsx scripts/bella-land/test-customer-authenticated-security.ts`

---

_This document will be archived after policies are applied and C3.2 PASS is achieved._
