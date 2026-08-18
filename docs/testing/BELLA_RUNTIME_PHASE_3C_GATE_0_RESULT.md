# Bella Runtime Phase 3C — Gate 0 Result

**Date:** 2026-08-18  
**Status:** 🔴 FAILED (RLS configuration gap detected)  
**Phase:** Phase 3C Gate 0 — Infrastructure Verification  

---

## Executive Summary

Gate 0 infrastructure verification **FAILED** with 4/5 tests PASS.

**Critical Finding:**
> RLS policies configured for `current_setting('app.current_tenant_id')` but JWT-based authentication uses different claim structure.

**This is NOT a test bug. This is a database configuration gap that Phase 3C is designed to detect.**

---

## Test Results

```
npm run test:runtime:3c:infra

Test Files  1 failed (1)
     Tests  4 passed | 1 failed | 1 skipped (6)
  Duration  10.43s
```

### Detailed Results

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Authenticated clients | ✅ PASS | 929ms | JWT generation works |
| Finance OS mock | ✅ PASS | 850ms | Mock functional |
| Test tenants exist | ✅ PASS | 978ms | Tenants in registry |
| RLS enforcement | ❌ FAIL | 2892ms | **Permission denied** |
| Finance OS responses | ✅ PASS | 2178ms | Mock responses work |

---

## Critical Failure Analysis

### Error Message

```
{
  "code": "42501",
  "details": null,
  "hint": "Grant the required privileges to the current role with: 
         GRANT SELECT ON public.runtime_audit_log TO authenticated;",
  "message": "permission denied for table runtime_audit_log"
}
```

### Root Cause

**RLS Policy Mismatch:**

Current RLS policy (from migration):
```sql
CREATE POLICY tenant_isolation_policy_audit ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));
```

**Problem:** 
- Policy expects `current_setting('app.current_tenant_id')`
- JWT-based auth provides `auth.jwt() ->> 'tenant_id'`
- **These are different mechanisms**

**Result:** Authenticated users cannot SELECT from `runtime_audit_log`

---

## Gap Classification

### Severity: 🔴 CRITICAL

**Impact:**
- Phase 3C cannot test RLS enforcement
- JWT-based authentication incompatible with current RLS policies
- Week 2 BLOCKED until resolved

**Scope:**
- Affects all Runtime tables:
  - `runtime_audit_log` ❌
  - `runtime_idempotency_registry` ❌ (likely)
  - `runtime_outbox` ❌ (likely)
  - `runtime_quarantine` ❌ (likely)
  - `runtime_tenant_registry` ❓ (needs verification)

---

## Resolution Options

### Option 1: Update RLS Policies (Recommended)

**Change RLS policies to use JWT claims:**

```sql
-- OLD (app.current_tenant_id)
CREATE POLICY tenant_isolation_policy_audit ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- NEW (JWT claim)
CREATE POLICY tenant_isolation_policy_audit_jwt ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

**Pros:**
- Aligns with JWT-based authentication
- Standard Supabase pattern
- Enables Phase 3C testing

**Cons:**
- Requires migration update
- Must update all 4 Runtime tables
- Needs testing to verify

---

### Option 2: Set `app.current_tenant_id` from JWT

**Use Supabase function to extract tenant_id from JWT and set context:**

```sql
CREATE OR REPLACE FUNCTION set_tenant_from_jwt()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'app.current_tenant_id',
    auth.jwt() ->> 'tenant_id',
    false
  );
END;
$$;
```

**Pros:**
- Keeps existing RLS policies
- No migration changes

**Cons:**
- Requires calling function on every request
- More complex
- Not standard Supabase pattern

---

### Option 3: Grant Direct Permissions (NOT Recommended)

```sql
GRANT SELECT ON runtime_audit_log TO authenticated;
```

**Pros:**
- Quick fix

**Cons:**
- ❌ Bypasses tenant isolation
- ❌ Security vulnerability
- ❌ Defeats purpose of RLS

**NOT ACCEPTABLE for production.**

---

## Recommended Action Plan

### Immediate (Unblock Gate 0)

1. **Create RLS policy update migration:**
   ```
   supabase/migrations/20260818000002_runtime_rls_jwt.sql
   ```

2. **Update policies for all Runtime tables:**
   - `runtime_audit_log`
   - `runtime_idempotency_registry`
   - `runtime_outbox`
   - `runtime_quarantine`
   - `runtime_tenant_registry`

3. **Apply migration** to Supabase project

4. **Re-run Gate 0:** `npm run test:runtime:3c:infra`

5. **Verify 5/5 PASS** → Gate 0 complete

---

### Migration Template

```sql
-- =============================================================================
-- Bella Runtime v1.1 — RLS Policies for JWT-based Authentication
-- Migration: 20260818000002_runtime_rls_jwt.sql
-- Purpose: Update RLS policies to use JWT claims instead of session variables
-- =============================================================================

-- Drop old policies
DROP POLICY IF EXISTS tenant_isolation_policy_audit ON runtime_audit_log;
DROP POLICY IF EXISTS audit_append_only_policy ON runtime_audit_log;

-- Create new JWT-based policies
CREATE POLICY tenant_isolation_policy_audit_jwt ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY audit_append_only_policy_jwt ON runtime_audit_log
  FOR INSERT
  WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

-- Repeat for other Runtime tables...
```

---

## Phase 3C Impact

### Current Status

```
Phase 3C
├─ Week 1 Infrastructure     ✅ COMPLETE (code)
├─ Gate 0 Verification       🔴 FAILED (RLS config)
├─ Week 2 Implementation     🔒 BLOCKED
└─ Weeks 3-5                 🔒 BLOCKED
```

### Unblock Criteria

**Gate 0 PASS requires:**
- ✅ JWT generation works
- ✅ Finance OS mock functional
- ✅ Test tenants exist
- ❌ **RLS enforcement proven** ← BLOCKER
- ✅ Finance OS responses work

**After RLS fix → 5/5 PASS → Week 2 unblocked**

---

## Governance Assessment

### Is This a Test Bug?

**NO.** This is a **legitimate infrastructure gap**.

**Evidence:**
1. Test correctly generates JWT with tenant claims
2. Test correctly creates authenticated client
3. Database correctly enforces RLS (permission denied)
4. **Problem:** RLS policy expects wrong tenant_id source

**This is exactly what Gate 0 is designed to find:**
> Infrastructure verification catches configuration mismatches before implementation begins.

---

### Is This an Architecture Issue?

**NO.** Architecture v1.1 correctly specifies JWT-based authentication.

**Gap:** Migration implementation used session variable pattern instead of JWT pattern.

**Resolution:** Update migration, not architecture.

---

## Related Documents

- [Phase 3C Test Plan](../architecture/BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md)
- [Week 1 Status](./BELLA_RUNTIME_PHASE_3C_WEEK1_STATUS.md)
- [Gate 0 Definition](./BELLA_RUNTIME_PHASE_3C_GATE_0.md)
- [Runtime Migration](../../supabase/migrations/20260818000001_runtime_tables.sql)

---

## Next Steps

1. **Create RLS policy update migration**
2. **Apply to Supabase**
3. **Re-run Gate 0**
4. **Document Gate 0 PASS**
5. **Unblock Week 2**

---

**Gate 0 Status: 🔴 FAILED (RLS configuration required)**

**Week 2 Status: 🔒 BLOCKED (Gate 0 prerequisite)**

**Action Required: Database migration update**
