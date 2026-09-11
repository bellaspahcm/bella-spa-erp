# Session 2 Handoff - Projects P1.3 Authenticated Tenant Isolation

**Date:** 2026-09-11  
**Handoff From:** Session 1 (P1.0, P1.1, P1.2, RLS hardening)  
**Handoff To:** Session 2 (P1.3, P1.4, P1.5)

---

## 🎯 Session 2 Objectives

**Primary:** P1.3 Authenticated Tenant Isolation (CRITICAL)

**Secondary:** P1.4 UI Trace, P1.5 Regression & Seal (if P1.3 passes)

**DO NOT:** Re-discover implementation (already done in Session 1)

---

## 📋 Current State

### Projects Status

```text
BELLA LAND v2 — PROJECTS

P1.0 Discovery                    ✅ COMPLETE
P1.1 Production Write Flow        ✅ VERIFIED
P1.2 Field Semantics              ✅ COVERED
RLS Hardening                     ✅ DEPLOYED
P1.3 Authenticated Isolation      🔴 NOT VERIFIED
P1.4 UI → Service → DB Trace      ⏸️
P1.5 Regression / Seal            ⏸️

Projects                          🟡 NOT RC READY
Bella Land v2                     🟡 92–95% RC READINESS
Product RC                        ⏸️ NOT SEALED
```

### Implementation Context (Preserved)

**Files:**
```text
UI:      src/app/dashboard/real-estate/projects/page.tsx
Actions: src/modules/real_estate/actions/projectActions.ts
Service: src/modules/real_estate/services/ProjectService.ts
Table:   real_estate_projects
Policy:  "Projects: Manage for admins" (WITH CHECK deployed)
```

**Evidence:**
```text
Discovery:  docs/bella-land/P1_PROJECTS_DISCOVERY.md
P1.1 Test:  scripts/bella-land/test-project-creation.ts (5/5 PASS)
Analysis:   docs/bella-land/DEFECT_P1_CROSS_TENANT_WRITE.md
RLS Fix:    supabase/migrations/20260911020000_fix_projects_rls_with_check.sql
Checkpoint: docs/bella-land/CHECKPOINT_P1_SESSION_1.md
```

---

## 🔴 P1.3: Authenticated Tenant Isolation (START HERE)

### Why P1.3 is Critical

**Session 1 Limitation:**
```text
T5 in P1.1 used service-role client
→ Service-role bypasses RLS by design
→ T5 = expected privileged behavior (NOT RLS failure proof)

RLS WITH CHECK deployed BUT not runtime-tested with auth
→ Effectiveness unknown
→ Cannot claim tenant isolation until authenticated tests pass
```

**P1.3 Purpose:**
```text
Prove RLS enforcement works with REAL authenticated users
Prove cross-tenant access BLOCKED at database layer
Prove own-tenant access ALLOWED

Only then can Projects be marked "TENANT ISOLATION VERIFIED"
```

---

### Step 1: Verify WITH CHECK SQL Expression

**MUST DO FIRST:** Inspect actual SQL expression (not just boolean flag)

```sql
SELECT 
  schemaname, 
  tablename, 
  policyname,
  qual,          -- USING clause
  with_check     -- WITH CHECK clause
FROM pg_policies
WHERE tablename = 'real_estate_projects'
  AND policyname = 'Projects: Manage for admins';
```

**Required characteristics:**
```text
✅ WITH CHECK clause MUST exist (not NULL)
✅ Expression MUST enforce tenant boundary
✅ Expression MUST validate written rows against authenticated user context
✅ Can use auth.uid() directly OR membership/helper functions

❌ NOT acceptable: with_check = 'true' (allows any tenant_id)
❌ NOT acceptable: with_check = NULL (no write validation)
```

**Acceptance criteria:**
```text
Expression ensures authenticated user can ONLY write rows
belonging to their authorized tenant(s).

Exact SQL pattern may vary (direct auth.uid() check, 
membership table join, helper function) — 
what matters is runtime enforcement verified by A1-A8 tests.
```

**If expression looks weak/wrong:** Analyze carefully, may need policy fix before A1-A8.

---

### Step 2: Setup Authenticated Test Clients

**Get two users from different tenants:**

```typescript
// Find users
const { data: users } = await supabase
  .from('users')
  .select('id, tenant_id, email, role')
  .eq('role', 'admin')
  .limit(10);

// Pick two from different tenants
const userA = users.find(u => u.tenant_id === 'tenant-A-id');
const userB = users.find(u => u.tenant_id === 'tenant-B-id');
```

**Create authenticated clients (NOT service-role):**

```typescript
// Option 1: If you have JWT tokens
const clientA = createClient(url, anonKey, {
  global: { 
    headers: { Authorization: `Bearer ${userAToken}` } 
  }
});

// Option 2: Use supabase.auth.signInWithPassword() if needed
// But DO NOT use service-role for P1.3 tests
```

**Critical:** These clients MUST enforce RLS (authenticated role, not service-role)

---

### Step 3: Run A1-A8 Tenant Isolation Tests

**Test Matrix:**

```text
A1. Tenant A creates Project A              → ALLOW
A2. Tenant A reads Project A                → ALLOW
A3. Tenant B reads Project A                → BLOCK/invisible
A4. Tenant B updates Project A              → BLOCK
A5. Tenant B deletes Project A              → BLOCK
A6. Tenant B inserts with tenant_id=A       → BLOCK (WITH CHECK)
A7. Tenant A updates tenant_id A→B          → BLOCK (WITH CHECK)
A8. Tenant B project queries don't leak A   → PASS
```

**Test Script:** Create `scripts/bella-land/test-project-tenant-isolation.ts`

**Expected Results:**
```text
A1: ✅ PASS (own-tenant create)
A2: ✅ PASS (own-tenant read)
A3: ✅ PASS (cross-tenant read blocked, 0 rows)
A4: ✅ PASS (cross-tenant update blocked, 0 rows affected)
A5: ✅ PASS (cross-tenant delete blocked, 0 rows affected)
A6: ✅ PASS (tenant forgery blocked, WITH CHECK enforcement)
A7: ✅ PASS (tenant escape blocked, WITH CHECK enforcement)
A8: ✅ PASS (no data leakage)

Result: 8/8 PASS → Tenant isolation VERIFIED

Note: A6/A7 are the critical WITH CHECK tests.
If A6/A7 allow cross-tenant writes, RLS policy is defective.
```

**If ANY test fails:**
```text
STOP immediately
→ RLS policy issue OR test setup issue
→ Investigate root cause
→ Fix policy/test
→ Rerun A1-A8
→ Do NOT continue to P1.4 until 8/8 PASS
```

---

### Step 4: Document P1.3 Results

**Create:** `docs/bella-land/P1_PROJECTS_TENANT_ISOLATION_VERIFIED.md`

**Include:**
```text
- Test methodology (authenticated clients, not service-role)
- WITH CHECK SQL expression inspected (actual expression documented)
- How expression enforces tenant boundary (analysis)
- 8 test results (A1-A8) with evidence
- A6/A7 results (critical WITH CHECK validation)
- Verdict: TENANT ISOLATION VERIFIED or FAILED
```

---

## ⏸️ P1.4: UI Trace (After P1.3 Passes)

**Only proceed if P1.3 = 8/8 PASS**

**Goal:** Trace full request path from browser to database

**Steps:**
```text
1. Open browser dev tools
2. Submit project creation form
3. Trace:
   - UI: handleCreateProject()
   - Network: POST to /api/...
   - Action: createProjectAction()
   - Service: ProjectService.createProject()
   - DB: INSERT + RLS enforcement
4. Verify tenant_id injected (not from client)
5. Document path in P1_PROJECTS_DISCOVERY.md
```

**Acceptance:** Full path traced, tenant validation at each layer

---

## ⏸️ P1.5: Regression & Projects Seal (After P1.3 + P1.4)

**Only proceed if P1.3 = 8/8 PASS AND P1.4 complete**

**Regression Tests:**
```text
1. Rerun P1.1 (5/5 should still PASS)
2. Verify normal workflows not broken
3. Spot-check UI (can create/view projects)
```

**Projects Seal Decision:**
```text
IF P1.1 + P1.3 + P1.4 + P1.5 all PASS:
  → Projects: ✅ VERIFIED
  → Evidence: COMPLETE
  → RC Ready: ✅ YES
  → Move to: Phase 2 (Apartments)

IF any test FAILS:
  → Projects: ❌ NOT VERIFIED
  → Fix issue
  → Retest
  → Do NOT seal until all tests PASS
```

---

## 🚫 What NOT to Do in Session 2

**❌ DO NOT:**
```text
- Re-discover implementation (already done P1.0)
- Use service-role for P1.3 tests (must use authenticated)
- Skip WITH CHECK expression verification
- Continue to P1.4 if P1.3 fails
- Seal Projects if any test fails
- Assume RLS working without runtime proof
```

**✅ DO:**
```text
- Inspect WITH CHECK expression (understand how it works)
- Use authenticated clients (two tenants, NOT service-role)
- Run all 8 isolation tests (A1-A8)
- Pay special attention to A6/A7 (WITH CHECK validation)
- Stop if any test fails
- Document results thoroughly
- Only seal Projects after ALL evidence complete
```

---

## 📊 Success Criteria for Session 2

**Minimum (P1.3 only):**
```text
✅ WITH CHECK SQL expression inspected & understood
✅ 8/8 authenticated tenant isolation tests PASS
✅ A6/A7 prove WITH CHECK enforcement working
✅ Evidence documented with test results
✅ Projects tenant isolation status updated

Result: Projects 80% complete (needs P1.4, P1.5)
```

**Optimal (P1.3 + P1.4 + P1.5):**
```text
✅ P1.3: 8/8 PASS (tenant isolation verified)
✅ P1.4: UI trace complete
✅ P1.5: Regression passed, no issues
✅ Projects: VERIFIED and SEALED

Result: Projects 100% complete, ready for Phase 2 (Apartments)
```

---

## 🎯 RC Impact

**After P1.3 Completes:**

```text
IF P1.3 PASS (8/8):
  Projects: 🟡 80% → ✅ 90-95% (after P1.4, P1.5)
  Bella Land: 92-95% → continue evidence closure
  
IF P1.3 FAIL (any test):
  Projects: 🔴 BLOCKED (security issue)
  Bella Land: 🔴 BLOCKED (cannot seal without Projects)
  
  Must fix before continuing to Apartments.
```

---

**Handoff Status:** ✅ COMPLETE

**Session 2 can start immediately with P1.3 (no discovery needed)**

**Next Action:** Verify WITH CHECK expression → Run A1-A8 tests
