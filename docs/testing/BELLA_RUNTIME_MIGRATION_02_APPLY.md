# Bella Runtime Migration 02 — Apply Instructions

**Migration:** `20260818000002_runtime_rls_jwt.sql`  
**Purpose:** Replace session variable RLS with JWT claim RLS  
**Status:** ⏳ READY TO APPLY  

---

## Prerequisites

- ✅ RLS Audit complete
- ✅ Migration file created
- ✅ No architecture changes
- ⏳ Awaiting Supabase application

---

## Application Methods

### Method 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New query**
5. Copy contents of `supabase/migrations/20260818000002_runtime_rls_jwt.sql`
6. Paste into SQL Editor
7. Click **Run**
8. Verify output: "Migration verification: 6 JWT-based RLS policies created"

---

### Method 2: Supabase CLI

```bash
# Ensure Supabase CLI installed
npm install -g supabase

# Link to project (if not already linked)
supabase link --project-ref your-project-ref

# Apply migration
supabase db push

# Or apply specific migration
psql $DATABASE_URL -f supabase/migrations/20260818000002_runtime_rls_jwt.sql
```

---

### Method 3: Direct psql

```bash
# Using connection string from Supabase Dashboard
psql "postgresql://postgres:[password]@[host]:5432/postgres" \
  -f supabase/migrations/20260818000002_runtime_rls_jwt.sql
```

---

## Expected Output

```
NOTICE:  Migration verification: 6 JWT-based RLS policies created

 status                                  | detail                                            | security_impact                              | compatibility
-----------------------------------------+---------------------------------------------------+----------------------------------------------+----------------------------------
 Runtime JWT-based RLS migration complete | 6 policies migrated from session variable to JWT | Tenant isolation maintained, append-only... | service_role unaffected...
```

---

## Verification Steps

### Step 1: Verify Migration Applied

```sql
-- Check JWT policies exist
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'runtime_tenant_registry',
    'runtime_idempotency_registry',
    'runtime_outbox',
    'runtime_audit_log',
    'runtime_quarantine'
  )
  AND policyname LIKE '%_jwt'
ORDER BY tablename, policyname;

-- Expected: 6 rows
```

### Step 2: Verify Old Policies Dropped

```sql
-- Check no old session-variable policies remain
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'runtime_tenant_registry',
    'runtime_idempotency_registry',
    'runtime_outbox',
    'runtime_audit_log',
    'runtime_quarantine'
  )
  AND policyname NOT LIKE '%_jwt'
  AND policyname NOT LIKE 'audit_no_%';  -- Exclude append-only enforcement policies

-- Expected: 2 rows (audit_no_update, audit_no_delete only)
```

---

## Post-Migration Testing

### CRITICAL: Test in Order

**Do NOT skip Step 2 regression test!**

```bash
# Step 1: Migration applied ✅ (done above)

# Step 2: Regression test (Phase 3B)
npm run test:runtime:3b
# Expected: 97/97 PASS
# If FAIL: STOP, diagnose regression

# Step 3: Gate 0 verification (Phase 3C)
npm run test:runtime:3c:infra
# Expected: 5/5 PASS
# If FAIL: diagnose JWT/RLS issue

# Step 4: Governance decision
# If both PASS → Week 2 unblocked
```

---

## Rollback Plan (Emergency)

If migration causes issues:

```sql
-- Rollback: Restore session-variable policies
BEGIN;

-- 1. runtime_tenant_registry
DROP POLICY IF EXISTS tenant_isolation_policy_registry_jwt ON runtime_tenant_registry;
CREATE POLICY tenant_isolation_policy_registry ON runtime_tenant_registry
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 2. runtime_idempotency_registry
DROP POLICY IF EXISTS tenant_isolation_policy_idempotency_jwt ON runtime_idempotency_registry;
CREATE POLICY tenant_isolation_policy_idempotency ON runtime_idempotency_registry
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 3. runtime_outbox
DROP POLICY IF EXISTS tenant_isolation_policy_outbox_jwt ON runtime_outbox;
CREATE POLICY tenant_isolation_policy_outbox ON runtime_outbox
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 4. runtime_audit_log
DROP POLICY IF EXISTS tenant_isolation_policy_audit_jwt ON runtime_audit_log;
DROP POLICY IF EXISTS audit_append_only_policy_jwt ON runtime_audit_log;
CREATE POLICY tenant_isolation_policy_audit ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));
CREATE POLICY audit_append_only_policy ON runtime_audit_log
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- 5. runtime_quarantine
DROP POLICY IF EXISTS tenant_isolation_policy_quarantine_jwt ON runtime_quarantine;
CREATE POLICY tenant_isolation_policy_quarantine ON runtime_quarantine
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

COMMIT;

SELECT 'Rollback complete: restored session-variable RLS policies' AS status;
```

**After rollback:**
- Phase 3B should still work (97/97)
- Phase 3C Gate 0 will fail (expected)
- Diagnose root cause before re-applying

---

## Success Criteria

**Migration SUCCESS if:**
- ✅ Migration executes without errors
- ✅ 6 JWT policies created
- ✅ Old policies dropped (except append-only enforcement)
- ✅ Phase 3B regression: 97/97 PASS
- ✅ Gate 0 verification: 5/5 PASS

**Migration FAIL if:**
- ❌ Migration SQL errors
- ❌ Phase 3B regression (not 97/97)
- ❌ Gate 0 still fails (not 5/5)

---

## Related Documents

- [RLS Audit Report](./BELLA_RUNTIME_RLS_AUDIT_REPORT.md)
- [Gate 0 Result](./BELLA_RUNTIME_PHASE_3C_GATE_0_RESULT.md)
- [Migration SQL](../../supabase/migrations/20260818000002_runtime_rls_jwt.sql)

---

**Status:** ⏳ AWAITING APPLICATION

**Next:** Apply migration → Test 3B → Test Gate 0 → Week 2 decision
