# Session 9: C3.2 Runtime Security Verification — KICKOFF

**Date:** 2026-09-11 (Ready to start)  
**Session:** 9  
**Focus:** C3.2 Authenticated Security Runtime Execution (A1-A9)  
**Type:** Pure runtime security execution (no discovery, no baseline changes)

---

## Session Scope

**ONE OBJECTIVE ONLY:**
Execute C3.2 authenticated security test A1-A9 and document verdict.

**NOT in Scope:**
- ❌ No discovery
- ❌ No baseline changes
- ❌ No canonical pattern modifications
- ❌ No "make test pass" adjustments
- ❌ No scope reduction

**Evidence Integrity:**
- Test what's prepared in Session 8
- Document what happens
- If fail → RCA → fix canonical implementation → rerun

---

## Session 8 Handoff State

```
Session 8                    🔒 CLOSED
C3.0 Discovery               ✅ COMPLETE
C3.1 Write Flow              🔒 VERIFIED — 5/5
C3.2 Preparation             ✅ COMPLETE
C3.2 Runtime Verification    ⏸️ NOT EXECUTED ← Session 9 starts HERE

Customers                    🟡 NOT SEALED
```

---

## Execution Plan

### Step 1: Apply Canonical RLS Policies

**Action:** Execute SQL via Supabase Dashboard SQL Editor

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

**Verification (policy objects exist):**
```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 're_customers';
```

**Expected:**
```
2 rows: re_customers_tenant_read, re_customers_tenant_write
```

**Note:** This proves policy **objects exist**, NOT runtime correctness.

---

### Step 2: Validate Test Users

**Query Tenant A User:**
```sql
SELECT id, email, tenant_id, role
FROM users
WHERE email = 'loadtest-realestate@test.local';
```

**Verify:**
- ✅ User exists
- ✅ tenant_id = `1a6643da-3806-4793-a301-7a6d60b0d888` (Real Estate)
- ✅ role IN ('admin', 'super_admin', 'admin_staff')
- ✅ User is NOT HQ super admin

**Query Tenant B User:**
```sql
SELECT id, email, tenant_id, role
FROM users
WHERE email = 'loadtest-healthcare@test.local';
```

**Verify:**
- ✅ User exists
- ✅ tenant_id = `60135a61-d8a0-47f2-a0d9-835ff0bd437e` (Healthcare)
- ✅ role IN ('admin', 'super_admin', 'admin_staff')
- ✅ User is NOT HQ super admin

**Critical:** If either user is HQ super admin → isolation tests INVALID → cannot proceed.

---

### Step 3: Execute Full A1-A9

**Command:**
```bash
npx tsx scripts/bella-land/test-customer-authenticated-security.ts
```

**Full Suite (NOT partial):**
```
A1: Tenant A can SELECT own customer
A2: Tenant A cannot SELECT Tenant B customer
A3: Tenant A can INSERT own customer
A4: Tenant A cannot INSERT with Tenant B tenant_id (forgery)
A5: Tenant A can UPDATE own customer
A6: Tenant A cannot UPDATE Tenant B customer
A7: Tenant A cannot UPDATE tenant_id → Tenant B (escape)
A8: Tenant A can DELETE own customer
A9: Tenant A cannot DELETE Tenant B customer
```

**Runtime Proof:** A1-A9 execution proves RLS enforcement (or lack thereof).

---

### Step 4: Document Verdict

#### Path A: 9/9 PASS

```
Result: 9/9 tests passed
✅ C3.2 PASS — Authenticated security verified
🎯 RLS POLICIES ENFORCED
▶️  Proceed to C3.3 Production Browser Runtime
```

**Verdict:** C3.2 🔒 VERIFIED

**Evidence:**
- Full test output
- All gates PASS
- Tenant isolation proven
- Forgery/escape blocked
- Canonical pattern enforced

**Next:** C3.3 Browser Runtime

---

#### Path B: ANY FAIL

**Action:**
1. **Freeze evidence** at failed gate
2. **RCA:** Why did enforcement fail?
   - Policy applied incorrectly?
   - Canonical pattern not matched?
   - Test user has wrong role?
   - Test user is HQ super admin?
   - Policy logic error?
3. **Fix** canonical implementation (NOT test)
4. **Rerun** full A1-A9 (NOT just failed gate)

**DO NOT:**
- ❌ Skip failed gate
- ❌ Modify test to pass
- ❌ Change canonical pattern to make test pass
- ❌ Reduce scope

**Principle:** Test proves policy correctness. If test fails, fix policy, not test.

---

## Decision Tree

```
Apply RLS
    ↓
Confirm 2 policy objects exist
    ↓
Validate test users ≠ HQ override
    ↓
Run A1-A9
    ↓
   9/9?
  /    \
YES     NO
 ↓       ↓
C3.2    Freeze evidence
VERIFIED    ↓
 ↓      RCA (why policy failed?)
C3.3        ↓
       Fix canonical implementation
            ↓
       Rerun FULL A1-A9
            ↓
          9/9?
         /    \
       YES     NO
        ↓       ↓
      C3.2    Document failure
   VERIFIED   → Escalate
```

---

## Constraints

### MUST NOT Change

1. ❌ Canonical pattern (`get_auth_tenant_id()`, `is_hq_super_admin()`)
2. ❌ Role list (`('admin', 'super_admin', 'admin_staff')`)
3. ❌ Test gates A1-A9
4. ❌ Test users (must remain regular tenant admins)
5. ❌ Evidence methodology (gate-based, not averaging)

### MAY Change (If RCA Justified)

1. ✅ Policy SQL implementation (if canonical logic error)
2. ✅ Test user assignment (if current users invalid)

### MUST Document

1. ✅ Exact test output (PASS or FAIL)
2. ✅ RCA for ANY failure
3. ✅ Policy verification query results
4. ✅ Test user validation results

---

## Success Criteria

**Session 9 SUCCESS:**
- C3.2 executed
- Verdict documented (9/9 PASS or specific failure)
- Evidence preserved

**Session 9 DOES NOT require:**
- C3.2 PASS (that's outcome, not success criteria)
- If C3.2 FAIL → Session 9 successful if evidence + RCA documented

---

## Quality Gates

### Gate 1: Pre-Execution
- ✅ Policies applied
- ✅ Policy objects verified (2 rows)
- ✅ Test users validated (NOT HQ super admin)
- ✅ Canonical pattern confirmed

### Gate 2: Execution
- ✅ Full A1-A9 run (not partial)
- ✅ Test output captured
- ✅ No test modifications during run

### Gate 3: Post-Execution
- ✅ Verdict documented
- ✅ Evidence preserved
- ✅ RCA documented (if any failure)

---

## Time Estimates

**Optimistic (9/9 PASS):**
- Policy apply: 5 min
- Validation: 5 min
- Test execution: 2 min
- Documentation: 10 min
- **Total: ~20 min**

**Pessimistic (Failures + RCA):**
- Policy apply: 5 min
- Validation: 5 min
- Test execution: 2 min
- RCA + fix: 30-60 min
- Rerun: 2 min
- Documentation: 15 min
- **Total: ~60-90 min**

---

## Artifacts to Create

**Required:**
- `C3_2_EXECUTION_RESULTS.md` — Test output + verdict
- Update `SESSION_9_STATUS.md` — Session progress

**If PASS:**
- `C3_2_VERIFIED.md` — Seal evidence

**If FAIL:**
- `C3_2_FAILURE_RCA.md` — Root cause analysis
- Policy fix documentation

---

## Session 9 Kickoff

**Ready to Execute:** ✅ All prerequisites from Session 8 complete

**First Action:** Apply RLS policies via Supabase Dashboard

**Expected Duration:** 20-90 min (depending on outcome)

**Critical Principle:** Test what's prepared. Document what happens. Fix implementation, not test.

---

**Session 9: ▶️ READY TO START**

_Pure runtime security execution. No discovery. No baseline changes._

---

_End of Session 9 Kickoff_
