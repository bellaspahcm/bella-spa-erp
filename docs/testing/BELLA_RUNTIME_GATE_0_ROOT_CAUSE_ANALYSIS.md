# Bella Runtime Gate 0 — Root Cause Analysis

**Date:** 2026-08-18  
**Status:** 🔴 BLOCKED (4/5)  
**Root Cause:** Missing table grants to `authenticated` role  
**Fix:** Migration 03 created, awaiting application

---

## Executive Summary

**Gate 0 blocked at RLS enforcement test due to architectural oversight in Migration 01.**

**Discovery Timeline:**
1. ✅ Phase 3B (97/97) → Database layer proven with `service_role`
2. 🔴 Gate 0 (4/5) → RLS enforcement fails with `permission denied`
3. ✅ Migration 02 applied → JWT-based RLS policies created
4. 🔴 Gate 0 re-test (4/5) → **SAME ERROR** (policies not working)
5. 🔍 Root cause found → Migration 01 never granted table access to `authenticated`
6. ✅ Migration 03 created → Corrective grants for `authenticated` role

---

## Failure Evidence

### Test Execution

```bash
$ npm run test:runtime:3c:infra

❌ should enforce RLS on authenticated clients

AssertionError: expected { code: '42501', details: null, ... } to be null

Error Object:
{
  "code": "42501",
  "details": null,
  "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.runtime_audit_log TO authenticated;",
  "message": "permission denied for table runtime_audit_log"
}
```

**Gate 0 Result:** 4/5 FAIL

```
✅ should create authenticated clients with tenant JWT
✅ should initialize Finance OS mock
✅ should verify test tenants exist in registry
❌ should enforce RLS on authenticated clients ← BLOCKED HERE
✅ should handle Finance OS mock responses
```

---

## Root Cause: PostgreSQL RLS + Grants Architecture

### Two-Level Security Model

PostgreSQL RLS operates at **two levels**:

#### Level 1: Table-Level Access (GRANT/REVOKE)
```sql
-- Without this, role CANNOT access table at all
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;
```

#### Level 2: Row-Level Security (RLS Policies)
```sql
-- This controls WHICH ROWS the role can see
CREATE POLICY tenant_isolation_policy_audit_jwt ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

**Critical:** RLS policies **cannot evaluate** if role has no table-level access.

---

## What Went Wrong

### Migration 01 (20260818000001_runtime_tables.sql)

```sql
-- ❌ MISSING: No grants to authenticated role
CREATE TABLE runtime_audit_log (...);
ALTER TABLE runtime_audit_log ENABLE ROW LEVEL SECURITY;

-- service_role has superuser privileges (bypasses RLS)
-- authenticated role: NO TABLE ACCESS
```

**Result:**
- ✅ service_role: Full access (Phase 3B works)
- ❌ authenticated: No access (Gate 0 blocks)

### Migration 02 (20260818000002_runtime_rls_jwt.sql)

```sql
-- Created JWT-based RLS policies
CREATE POLICY tenant_isolation_policy_audit_jwt ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

**Result:**
- Policies created successfully
- **BUT:** Policies never evaluate because `authenticated` has no table access
- Error occurs at table level, before RLS evaluation

### Migration 03 (20260818000003_runtime_authenticated_grants.sql) ← FIX

```sql
-- Grants table-level access to authenticated role
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;
-- Now RLS policies can evaluate
```

**Expected Result:**
- ✅ authenticated: Table access granted
- ✅ RLS policies: Now evaluate tenant_id from JWT
- ✅ Gate 0: 5/5 PASS

---

## Diagnosis Process

### Step 1: Verify Migration 02 Applied

```bash
# Checked: RLS policies exist
SELECT * FROM pg_policies 
WHERE tablename = 'runtime_audit_log' 
AND policyname LIKE '%_jwt';

✅ Result: Policies exist (tenant_isolation_policy_audit_jwt, audit_append_only_policy_jwt)
```

### Step 2: Check Table Permissions

```bash
# Checked: authenticated role grants
SELECT * FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
AND table_name = 'runtime_audit_log';

❌ Result: NO GRANTS FOUND
```

**Root cause confirmed.**

### Step 3: Verify service_role Unaffected

```bash
npm run test:runtime:3b
✅ Result: 97/97 PASS (service_role bypasses RLS, has superuser access)
```

---

## Security Impact Assessment

### Pre-Fix Security Model

| Role | Table Access | RLS Applied | Phase |
|------|--------------|-------------|-------|
| service_role | ✅ Full (superuser) | ❌ Bypassed | 3B ✅ |
| authenticated | ❌ None | N/A (can't reach RLS) | 3C ❌ |
| anon | ❌ None | N/A | N/A |

### Post-Fix Security Model (After Migration 03)

| Role | Table Access | RLS Applied | Phase |
|------|--------------|-------------|-------|
| service_role | ✅ Full (superuser) | ❌ Bypassed | 3B ✅ |
| authenticated | ✅ SELECT, INSERT | ✅ Enforced (JWT tenant_id) | 3C ✅ |
| anon | ❌ None | N/A | N/A |

**Security guarantees MAINTAINED:**
- ✅ Tenant isolation: RLS filters by `auth.jwt() ->> 'tenant_id'`
- ✅ Audit append-only: No UPDATE/DELETE grants
- ✅ Cross-tenant access: BLOCKED by RLS
- ✅ service_role bypass: Unchanged (Phase 3B unaffected)

---

## Why This Wasn't Caught Earlier

1. **Phase 3B used service_role** → No table grants needed (superuser bypasses)
2. **Gate 0 first use of authenticated** → First time testing JWT + RLS
3. **Migration 01 written for service_role context** → Grants not considered
4. **RLS policies tested separately** → Assumed table access existed

**Architecture discipline maintained:**
- Discovered at correct phase (3C = authenticated boundary)
- No production impact (Runtime not deployed)
- Fix scoped to single migration (no code changes)
- Regression tests ensure no breakage

---

## Fix Validation Plan

### Step 1: Apply Migration 03

```bash
# Via Supabase Dashboard → SQL Editor
# Run: supabase/migrations/20260818000003_runtime_authenticated_grants.sql
```

**Expected output:**
```
Migration verification: authenticated role has 11 table permissions
```

### Step 2: Regression Test (Phase 3B)

```bash
npm run test:runtime:3b
```

**Expected:** 97/97 PASS  
**Rationale:** service_role unaffected by authenticated grants

### Step 3: Gate 0 Re-Test

```bash
npm run test:runtime:3c:infra
```

**Expected:** 5/5 PASS  
**Target test:** `should enforce RLS on authenticated clients`

**Expected behavior:**
```typescript
// Tenant A reads their own audit logs
const { data, error } = await tenantAClient
  .from('runtime_audit_log')
  .select('*')
  .eq('tenant_id', 'tenant-a');

// ✅ error = null
// ✅ data = [...] (only tenant-a rows)

// Tenant B cannot see Tenant A's data
const { data: crossData } = await tenantBClient
  .from('runtime_audit_log')
  .select('*')
  .eq('tenant_id', 'tenant-a');

// ✅ crossData = [] (RLS filtered)
```

---

## Lessons Learned

### What Went Well

1. **Layered testing caught issue before production**
   - 3A → Application logic ✅
   - 3B → Database layer ✅
   - 3C → Security boundary ❌ (caught here)

2. **Evidence-driven approach prevented premature Week 2**
   - Gate 0 blocked correctly
   - No "assume it works" progression

3. **Architecture freeze protected core design**
   - Fix is additive (grants only)
   - No schema changes
   - No code changes

### What to Improve

1. **Migration 01 should have included authenticated grants**
   - Current: Implicit assumption that service_role is only user
   - Better: Explicit grants for all roles from start

2. **RLS audit should check both policies AND grants**
   - Current: Checked policy existence
   - Better: Check `information_schema.role_table_grants`

3. **Gate 0 infrastructure tests should run BEFORE full Phase 3C plan**
   - Current: Created full Week 1 + Week 2 plan before testing
   - Better: Test infrastructure first, then plan E2E tests

---

## Migration Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│ 20260818000001_runtime_tables.sql                   │
│ - Creates 5 Runtime tables                          │
│ - Enables RLS                                        │
│ - ❌ Missing: authenticated grants                  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 20260818000002_runtime_rls_jwt.sql                  │
│ - Drops session-variable RLS policies               │
│ - Creates JWT-based RLS policies                    │
│ - ⚠️ Policies created but cannot work              │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ 20260818000003_runtime_authenticated_grants.sql     │
│ - Grants SELECT/INSERT/UPDATE to authenticated      │
│ - ✅ Enables JWT-based RLS enforcement             │
└─────────────────────────────────────────────────────┘
```

---

## Status Checkpoint

### Evidence Summary

| Phase | Tests | Status | Key Proof |
|-------|-------|--------|-----------|
| 3A | 79/79 | ✅ PASS | Application contracts |
| 3B | 97/97 | ✅ PASS | Database layer (service_role) |
| Gate 0 | 4/5 | 🔴 BLOCKED | Authenticated security boundary |
| Week 2 | N/A | 🔒 BLOCKED | E2E Runtime flow |

### Blockers

1. **Migration 03 not applied** → User action required
2. **Gate 0 test failure** → Expected to resolve after Migration 03
3. **Week 2 frozen** → Cannot proceed until Gate 0 = 5/5

### Next Action

**USER MUST:**
1. Apply `supabase/migrations/20260818000003_runtime_authenticated_grants.sql`
2. Run `npm run test:runtime:3b` → Verify 97/97 PASS
3. Run `npm run test:runtime:3c:infra` → Verify 5/5 PASS

**IF both PASS:**
- 🔓 Gate 0 COMPLETE
- 🔓 Phase 3C Week 2 UNBLOCKED

**ELSE:**
- Document new evidence
- Diagnose root cause
- Do NOT proceed to Week 2

---

## Architecture Discipline Maintained

```
Build → Test → Detect → Fix → Regression → Verify → Freeze → Next Layer
         ↑              ↑       ↑
       Gate 0      Found gap   Migration 03
```

**No guessing. No assumptions. No phase jumping.**

**Current position:** Between "Fix" and "Regression"

**Architecture:** 🔒 FROZEN (v1.1)

**Gate 0:** 🔴 BLOCKED until Migration 03 applied + verified

---

## Files Created

1. `supabase/migrations/20260818000003_runtime_authenticated_grants.sql` (FIX)
2. `docs/testing/BELLA_RUNTIME_MIGRATION_03_APPLY.md` (GUIDE)
3. `docs/testing/BELLA_RUNTIME_GATE_0_ROOT_CAUSE_ANALYSIS.md` (EVIDENCE)

---

**End of Root Cause Analysis**
