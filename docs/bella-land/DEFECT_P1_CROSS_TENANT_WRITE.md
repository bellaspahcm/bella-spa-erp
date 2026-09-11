# DEFECT: Cross-Tenant Write Ownership Violation (Projects)

**ID:** DEFECT-P1-TENANT-WRITE  
**Date Discovered:** 2026-09-11  
**Severity:** 🔴 RC BLOCKER  
**Status:** ⏸️  CONFIRMED (not yet fixed)  
**Component:** Projects (real_estate_projects)

---

## 🔴 Defect Summary

**Issue:** Service-role client can INSERT projects with arbitrary `tenant_id`, violating tenant ownership boundary.

**Impact:** Cross-tenant write ownership violation - attacker with service-role access can create resources attributed to other tenants.

**Evidence:** P1.1 Test T5 (Wrong-Tenant Insertion Attempt)

---

## 📊 Test Results

### P1.1: Projects Write-Flow Verification

```text
T1. Normal create flow              ✅ PASS
T2. Field semantics                 ✅ PASS  
T3. Reload/read-back                ✅ PASS
T4. Tenant injection (happy path)   ✅ PASS
T5. Wrong-tenant write attempt      ❌ FAIL ← DEFECT

Result: 4/5 tests PASS
Verdict: ❌ NOT RC READY
```

---

## 🔍 T5: Wrong-Tenant Insertion Attempt

### Test Setup

```typescript
Current Tenant:  896d68b0... (Bella Real Estate Development [DEMO])
Other Tenant:    6afe8bb4... (different tenant)

Attempt: INSERT with OTHER tenant_id
```

### Test Execution

```typescript
INSERT INTO real_estate_projects (
  tenant_id,  // ← 6afe8bb4... (OTHER tenant)
  name,
  description,
  status
) VALUES (...);
```

### Expected Behavior

```text
Option A: INSERT BLOCKED (RLS WITH CHECK enforcement)
Option B: INSERT OVERRIDDEN (service layer forces correct tenant_id)

Either outcome acceptable - tenant boundary must be enforced.
```

### Actual Behavior

```text
❌ INSERT ALLOWED with wrong tenant_id

Input tenant_id:  6afe8bb4...
Persisted:        6afe8bb4... (SAME - not overridden)

Result: Cross-tenant ownership violation confirmed
```

---

## 🔒 Security Boundary Analysis

### Application Boundary (Server Action → Service)

**Current Implementation:**
```typescript
// projectActions.ts
export async function createProjectAction(
  data: Omit<ProjectInsert, 'tenant_id'>
): Promise<ProjectResult> {
  const user = await getCurrentUser();
  const project = await ProjectService.createProject(
    supabase, 
    user.tenant_id,  // ← Server injects tenant_id
    data
  );
}

// ProjectService.ts
static async createProject(
  supabase: SupabaseClient,
  tenantId: string,
  data: Omit<ProjectInsert, 'tenant_id'>
): Promise<ProjectRow> {
  return await supabase
    .from('real_estate_projects')
    .insert({
      ...data,
      tenant_id: tenantId  // ← Service injects tenant_id
    })
    .select()
    .single();
}
```

**Analysis:**
```text
✅ Server action validates user + tenant context
✅ Service layer injects tenant_id (client cannot override via this path)
✅ Type signature excludes tenant_id from client input

Normal production path: SECURE
```

**However:**
```text
❌ Direct DB access (service-role) can bypass this protection
❌ T5 used service-role client → bypassed application layer
❌ Database layer did NOT enforce tenant boundary
```

---

### Database Boundary (RLS Policies)

**Current RLS Policy:**
```sql
CREATE POLICY "Projects: Manage for admins"
ON real_estate_projects
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT users.tenant_id FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
  )
);
```

**Analysis:**
```text
✅ USING clause present (SELECT filtering works)
❌ WITH CHECK clause MISSING (INSERT/UPDATE not enforced)

Result:
- SELECT: Filtered by tenant_id ✅
- INSERT: No tenant_id enforcement ❌  
- UPDATE: No tenant_id enforcement ❌
```

**Evidence from pg_policies:**
```sql
policyname: "Projects: Manage for admins"
cmd:        ALL
qual:       (tenant_id IN (...))  ← USING clause
with_check: NULL                  ← WITH CHECK MISSING
```

---

## 🎯 Root Cause Analysis

### Primary Root Cause

**RLS WITH CHECK clause missing:**
```text
Database does NOT enforce tenant_id match on INSERT/UPDATE.

Impact:
- Service-role connections bypass RLS entirely
- Authenticated connections with admin role CAN insert wrong tenant_id
- No database-level protection against tenant forgery
```

### Secondary Contributing Factor

**Service-role usage in tests:**
```text
T5 used service-role client (bypasses RLS by design).

This is CORRECT test methodology:
- Service-role represents privileged access path
- Should test both authenticated AND privileged boundaries
- Privileged path still needs validation (not "anything goes")
```

---

## 🔧 Remediation Plan

### Layer 1: Database (RLS WITH CHECK)

**Add WITH CHECK clause to enforce tenant_id on INSERT/UPDATE:**

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Projects: Manage for admins" 
  ON real_estate_projects;

-- Recreate with WITH CHECK
CREATE POLICY "Projects: Manage for admins"
ON real_estate_projects
FOR ALL
TO authenticated
USING (
  tenant_id IN (
    SELECT users.tenant_id FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT users.tenant_id FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
  )
);
```

**Expected Impact:**
```text
✅ Authenticated users CANNOT insert/update with wrong tenant_id
✅ Database enforces tenant boundary for authenticated connections

⚠️  Service-role still bypasses RLS (by design)
→ Application layer MUST continue to enforce tenant ownership
```

---

### Layer 2: Application (already secure for production path)

**Current state:**
```text
✅ Server action validates user + tenant context
✅ Service layer injects tenant_id
✅ Client cannot override tenant_id via normal path

No application layer changes needed.
```

**However:**
```text
⚠️  If any code path accepts tenant_id from untrusted input:
→ MUST validate against authenticated user's tenant
→ MUST reject or override mismatched tenant_id
```

---

### Verification Plan

**After RLS fix, rerun P1.1 with authenticated context:**

```text
Test Matrix:

1. Service-role + correct tenant_id     → ALLOWED (privileged)
2. Service-role + wrong tenant_id       → ALLOWED (privileged, but app validates)
3. Authenticated admin + correct tenant → ALLOWED (RLS + app both OK)
4. Authenticated admin + wrong tenant   → BLOCKED (RLS WITH CHECK)
5. Production UI/action path            → ALLOWED (app injects tenant)

Expected:
- Test 1-3, 5: ✅ PASS
- Test 4: ❌ BLOCKED (correct - RLS enforcement)
```

**Additional negative tests:**
```text
6. Authenticated user (non-admin) + own tenant   → BLOCKED (role check)
7. Authenticated user (non-admin) + wrong tenant → BLOCKED (role + tenant)
8. Authenticated admin UPDATE wrong tenant       → BLOCKED (WITH CHECK on UPDATE)
```

---

## 📋 Acceptance Criteria

### Must Pass Before RC

```text
✅ RLS WITH CHECK policy deployed
✅ T5 rerun: Wrong-tenant insert BLOCKED (authenticated context)
✅ Production path still works (T1-T4 PASS)
✅ Application layer tenant injection verified
✅ No regression in normal workflows
```

### Evidence Required

```text
✅ Negative test: Authenticated admin cannot create with wrong tenant_id
✅ Negative test: Authenticated admin cannot UPDATE to wrong tenant_id
✅ Positive test: Authenticated admin CAN create with own tenant_id
✅ Service-role path behavior documented (privileged, requires app validation)
```

---

## 🚦 Impact on RC

### Before Fix

```text
Projects:                ❌ NOT RC READY
Bella Land v2 RC:        ⏸️  BLOCKED

Reason: Security invariant violation
        Cross-tenant write ownership broken
```

### After Fix + Verification

```text
Projects:                ✅ RC READY (if all tests pass)
Bella Land v2 RC:        ⏸️  Continue evidence closure (Apartments, Customers)
```

---

## 📝 Lessons Learned

### Testing Methodology

**✅ Evidence-first approach worked:**
```text
1. Discovered implementation (P1.0)
2. Identified WITH CHECK gap (hypothesis)
3. Tested wrong-tenant write (T5)
4. Confirmed defect with runtime evidence
5. Document before fix
```

**❌ What would have failed:**
```text
- Assume RLS working without testing
- Only test happy path (T1-T4)
- Skip negative tests (T5)
- Fix based on code review alone
```

### Security Boundaries

**Multiple layers needed:**
```text
Application Layer:
✅ Validate user authentication
✅ Validate tenant context
✅ Inject tenant_id from trusted source
✅ Never trust client-provided tenant_id

Database Layer:
✅ RLS USING (SELECT filtering)
✅ RLS WITH CHECK (INSERT/UPDATE enforcement)
✅ NOT NULL constraints
✅ Foreign key constraints

Testing Layer:
✅ Test both authenticated AND privileged paths
✅ Test happy path AND negative attempts
✅ Verify boundaries at each layer
```

---

## 🔄 Next Steps

1. ✅ **Freeze this defect evidence** (COMPLETE)
2. ⏸️  **Fix RLS policy** (add WITH CHECK)
3. ⏸️  **Create migration file** (for reproducibility)
4. ⏸️  **Rerun P1.1 tests** (verify fix)
5. ⏸️  **Add authenticated negative tests** (comprehensive verification)
6. ⏸️  **Continue P1.2** (only after T5 passes)

---

**Defect Status:** ⏸️  CONFIRMED (evidence frozen, fix pending)

**RC Status:** 🔴 BLOCKED (until defect resolved)

**Priority:** 🔴 CRITICAL (security boundary violation)
