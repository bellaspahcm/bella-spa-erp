# C3.2 Pre-Execution Checklist — MUST VERIFY BEFORE RUNNING

**Status:** 🔴 INCOMPLETE  
**Date:** 2026-09-11  
**Purpose:** Verify prerequisites before C3.2 authenticated security test

---

## ✅ Pre-Execution Checklist

### 1. RLS Policies Applied

**Action:** Apply policies via Supabase Dashboard SQL Editor

**SQL:**
```sql
DROP POLICY IF EXISTS "re_customers_tenant_read" ON re_customers;
DROP POLICY IF EXISTS "re_customers_tenant_write" ON re_customers;

CREATE POLICY "re_customers_tenant_read"
  ON re_customers
  FOR SELECT
  TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

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

**Verification:**
```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 're_customers';
```

**Expected:**
```
schemaname | tablename    | policyname                   | cmd | roles
public     | re_customers | re_customers_tenant_read     | r   | {authenticated}
public     | re_customers | re_customers_tenant_write    | *   | {authenticated}
```

☐ **Confirmed:** 2 policies exist

---

### 2. Canonical Pattern Verification

☐ **Confirmed:** Policy uses `public.get_auth_tenant_id()` (NOT custom subquery)

☐ **Confirmed:** Policy uses `public.is_hq_super_admin()` (HQ override)

☐ **Confirmed:** Role list is EXACTLY `('admin', 'super_admin', 'admin_staff')`

☐ **Confirmed:** Pattern matches Projects/Products RLS policies

---

### 3. Test User Validation

**Tenant A User:** `loadtest-realestate@test.local`

Query to check:
```sql
SELECT id, email, tenant_id, role
FROM users
WHERE email = 'loadtest-realestate@test.local';
```

☐ **Confirmed:** User exists

☐ **Confirmed:** User has `tenant_id = 1a6643da-3806-4793-a301-7a6d60b0d888` (Real Estate)

☐ **Confirmed:** User role is one of: `admin`, `super_admin`, or `admin_staff`

☐ **Confirmed:** User is NOT HQ super admin

---

**Tenant B User:** `loadtest-healthcare@test.local`

Query to check:
```sql
SELECT id, email, tenant_id, role
FROM users
WHERE email = 'loadtest-healthcare@test.local';
```

☐ **Confirmed:** User exists

☐ **Confirmed:** User has `tenant_id = 60135a61-d8a0-47f2-a0d9-835ff0bd437e` (Healthcare)

☐ **Confirmed:** User role is one of: `admin`, `super_admin`, or `admin_staff`

☐ **Confirmed:** User is NOT HQ super admin

---

### 4. Test Environment

☐ **Confirmed:** Supabase connection working (can authenticate)

☐ **Confirmed:** Test users can authenticate with `Test123456!` password

☐ **Confirmed:** No pending schema changes

---

## 🚀 Execute C3.2

**Once all checkboxes above are checked:**

```bash
npx tsx scripts/bella-land/test-customer-authenticated-security.ts
```

---

## 📊 Expected Results

### Success Path (9/9 PASS)

```
✅ PASS A1: Tenant A can SELECT own customer
✅ PASS A2: Tenant A cannot SELECT Tenant B customer
✅ PASS A3: Tenant A can INSERT own customer
✅ PASS A4: Tenant A cannot INSERT with Tenant B tenant_id (forgery blocked)
✅ PASS A5: Tenant A can UPDATE own customer
✅ PASS A6: Tenant A cannot UPDATE Tenant B customer
✅ PASS A7: Tenant A cannot UPDATE tenant_id → Tenant B (escape blocked)
✅ PASS A8: Tenant A can DELETE own customer
✅ PASS A9: Tenant A cannot DELETE Tenant B customer

Result: 9/9 tests passed
✅ C3.2 PASS — Authenticated security verified
🎯 RLS POLICIES ENFORCED
▶️  Proceed to C3.3 Production Browser Runtime
```

**Verdict:** C3.2 🔒 VERIFIED

---

### Failure Path (ANY FAIL)

**Action:**
1. Freeze evidence at failed gate
2. RCA: Why did policy enforcement fail?
3. Check:
   - Policy applied correctly?
   - Canonical pattern matched exactly?
   - Test user has correct role?
   - Test user NOT HQ super admin?
4. Fix canonical implementation
5. Rerun FULL A1-A9 (not just failed test)

**Do NOT proceed to C3.3 until 9/9 PASS**

---

## 🔴 Critical Warnings

### WARNING 1: HQ Super Admin Bypass
If test users are HQ super admins:
- A2, A4, A6, A7, A9 will FALSE PASS (isolation not tested)
- C3.2 evidence will be INVALID
- Must rerun with regular tenant users

### WARNING 2: Partial Evidence
If only failed tests are rerun (not full A1-A9):
- Evidence chain incomplete
- Cannot confirm no regression
- Must rerun full suite for valid evidence

### WARNING 3: Role Mismatch
If role list differs from canonical `('admin', 'super_admin', 'admin_staff')`:
- Pattern divergence introduced
- Not matching Projects/Products
- Fix migration to match exact canonical

---

## ✅ Sign-Off

Before executing C3.2, confirm:

☐ All checklist items above are checked  
☐ Policies applied and verified  
☐ Test users validated (NOT HQ super admin)  
☐ Canonical pattern matched exactly  
☐ Ready to run full A1-A9 suite

**Executor:** ___________  
**Date:** ___________  
**Time:** ___________

---

_This checklist ensures C3.2 evidence validity and prevents false positives from HQ override or pattern drift._
