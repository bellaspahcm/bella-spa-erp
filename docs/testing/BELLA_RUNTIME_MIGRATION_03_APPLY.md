# Bella Runtime Migration 03 — authenticated Role Grants

**Migration:** `20260818000003_runtime_authenticated_grants.sql`  
**Date:** 2026-08-18  
**Status:** 🔴 REQUIRED — Gate 0 BLOCKED  
**Type:** Corrective (fixes missing permissions from Migration 01)

---

## Problem Statement

**Gate 0 Status:** 4/5 FAIL

**Error:**
```
code: "42501"
message: "permission denied for table runtime_audit_log"
hint: "Grant the required privileges to the current role with: GRANT SELECT ON public.runtime_audit_log TO authenticated;"
```

**Root Cause:**
- Migration 01 created tables with RLS enabled
- Migration 02 created JWT-based RLS policies
- **BUT:** Migration 01 never granted table-level permissions to `authenticated` role
- RLS policies control **row-level** access, but role needs **table-level** access first
- Without grants, RLS policies cannot evaluate (permission denied at table level)

---

## What This Migration Does

**Grants minimal table-level permissions to `authenticated` role:**

*(Derived from repository contracts - see `BELLA_RUNTIME_PRIVILEGE_MATRIX_V1.md`)*

| Table | Permissions | Rationale |
|-------|-------------|-----------|
| `runtime_tenant_registry` | SELECT, INSERT, UPDATE | CRUD with soft delete |
| `runtime_idempotency_registry` | SELECT, INSERT, DELETE | Immutable + TTL garbage collection |
| `runtime_audit_log` | SELECT, INSERT | **Append-only** (NO UPDATE/DELETE) |
| `runtime_outbox` | SELECT, INSERT, UPDATE | State machine (status transitions) |
| `runtime_quarantine` | SELECT, INSERT, UPDATE, DELETE | Review workflow + retention cleanup |

**Security guarantees MAINTAINED:**
- ✅ Tenant isolation: RLS policies enforce `tenant_id` filtering
- ✅ Audit append-only: No UPDATE/DELETE grants
- ✅ Cross-tenant access: BLOCKED by RLS
- ✅ service_role: Unaffected (bypasses RLS)

---

## Migration Dependency Chain

```
20260818000001_runtime_tables.sql
  ↓ Creates tables + enables RLS
  ↓ Missing: grants to authenticated
  
20260818000002_runtime_rls_jwt.sql
  ↓ Creates JWT-based RLS policies
  ↓ Policies cannot work without table grants
  
20260818000003_runtime_authenticated_grants.sql ← YOU ARE HERE
  ↓ Grants table permissions to authenticated
  ↓ Enables JWT-based RLS enforcement
```

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Copy entire content from:
   ```
   supabase/migrations/20260818000003_runtime_authenticated_grants.sql
   ```
3. Paste into SQL Editor
4. Click **Run**
5. Verify output:
   ```
   Migration verification: authenticated role has 11 table permissions
   ```

### Option 2: Supabase CLI

```bash
# From workspace root
supabase db push
```

---

## Verification Steps

### Step 1: Regression Test (3B)

```bash
npm run test:runtime:3b
```

**Expected:** 97/97 PASS  
**If FAIL:** STOP, diagnose, consider rollback

### Step 2: Gate 0 Test (3C Infrastructure)

```bash
npm run test:runtime:3c:infra
```

**Expected:** 5/5 PASS  
**Current:** 4/5 FAIL (should fix with this migration)

---

## Expected Behavior Change

### Before Migration 03

```typescript
// Authenticated client with JWT
const { data, error } = await tenantAClient
  .from('runtime_audit_log')
  .select('*');

// ❌ error = { code: "42501", message: "permission denied for table runtime_audit_log" }
```

### After Migration 03

```typescript
// Authenticated client with JWT (tenant_id: tenant-a)
const { data, error } = await tenantAClient
  .from('runtime_audit_log')
  .select('*');

// ✅ error = null
// ✅ data = [...] (only tenant-a's rows, RLS enforced)
```

---

## Security Impact

**Threat Model:**

| Threat | Mitigation | Status |
|--------|------------|--------|
| Cross-tenant data access | RLS policies filter by `auth.jwt() ->> 'tenant_id'` | ✅ ENFORCED |
| Audit log tampering | No UPDATE/DELETE grants to authenticated | ✅ ENFORCED |
| Unauthorized table access | Grants limited to authenticated role only | ✅ SAFE |
| service_role bypass | Expected behavior (Phase 3B tests) | ✅ UNCHANGED |

**Risk Level:** ⚠️ LOW

- Grants are scoped to `authenticated` role (JWT-authenticated users)
- RLS policies enforce tenant isolation at row level
- No schema changes, no new attack surface
- Append-only enforcement preserved

---

## Rollback Plan

If migration causes issues:

```sql
BEGIN;

-- Revoke all grants
REVOKE ALL ON runtime_tenant_registry FROM authenticated;
REVOKE ALL ON runtime_idempotency_registry FROM authenticated;
REVOKE ALL ON runtime_audit_log FROM authenticated;
REVOKE ALL ON runtime_outbox FROM authenticated;
REVOKE ALL ON runtime_quarantine FROM authenticated;

COMMIT;
```

**Note:** This rollback returns system to previous state where:
- ✅ Phase 3B (service_role) works: 97/97 PASS
- ❌ Phase 3C (authenticated) blocked: 4/5 FAIL

---

## Gate 0 Decision Tree

```
Apply Migration 03
  ↓
Run: npm run test:runtime:3b
  ├─ 97/97 PASS → Continue
  └─ FAIL → STOP, diagnose, rollback if needed
  
Run: npm run test:runtime:3c:infra
  ├─ 5/5 PASS → 🎉 Gate 0 COMPLETE → Week 2 UNBLOCKED
  └─ FAIL → Document evidence, diagnose root cause
```

---

## Files Changed

**New:**
- `supabase/migrations/20260818000003_runtime_authenticated_grants.sql`
- `docs/testing/BELLA_RUNTIME_MIGRATION_03_APPLY.md` (this file)

**Unchanged:**
- All Phase 3B test files (regression must pass)
- All Phase 3C test files (Gate 0 should now pass)
- Application code (no code changes required)

---

## Status Summary

| Item | Status |
|------|--------|
| Architecture v1.1 | 🔒 FROZEN |
| Phase 3A | ✅ 79/79 |
| Phase 3B | ✅ 97/97 |
| Migration 01 | ✅ Applied |
| Migration 02 | ✅ Applied |
| **Migration 03** | 🔴 **REQUIRED** |
| Gate 0 | 🔴 4/5 BLOCKED |
| Week 2 | 🔒 BLOCKED |

---

## Next Action

**USER ACTION REQUIRED:**

Apply migration `20260818000003_runtime_authenticated_grants.sql` to Supabase, then:

```bash
npm run test:runtime:3b  # Must be 97/97
npm run test:runtime:3c:infra  # Target: 5/5
```

**IF both PASS → Phase 3C Week 2 UNBLOCKED**
