# Phase 4.4: Migration Conflict Report

**Date:** 2026-08-24  
**Status:** 🛑 DEPLOYMENT BLOCKED — Migration Order Conflict  
**Action:** Awaiting Human Architect Decision

---

## Issue

**Supabase CLI detected local migrations not yet applied to remote database.**

```
Found local migration files to be inserted before the last migration on remote database.
```

**Conflict Count:** 16 migrations

---

## Conflicting Migrations (In Order)

1. `20260819040000_runtime_migration_e1_gate_schema_safe.sql`
2. `20260819050000_runtime_migration_05a_classification_reservation.sql`
3. `20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql`
4. `20260819050002_runtime_migration_05b_canonical_tenant_creation.sql`
5. `20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql`
6. `20260819050004_runtime_migration_e3_post_05c_verification.sql`
7. `20260820110000_database_role_separation_v2.sql`
8. `20260820140000_enable_rls_block_service_key.sql`
9. `20260820151000_r4_3_gate_tokens.sql`
10. `20260820152000_r4_4_monitoring_audit.sql`
11. `20260820150000_r4_approval_contract.sql`
12. `20260821115404_logistics_schema.sql`
13. `20260821122000_create_accessorial_rates_table.sql`
14. `20260821121000_create_carrier_rates_table.sql`
15. `20260821123000_create_discrepancies_table.sql`
16. `20260821120000_create_freight_audit_tables.sql`

**Target Migration (Blocked):**
- `20260824000000_finance_test_cleanup_rpc.sql`

---

## Root Cause Analysis

### Scenario 1: Migrations Applied Out-of-Order

**Evidence:**
- Local files exist with timestamps 20260819-20260821
- Remote database has later migrations (20260823+)
- Earlier migrations not recorded in remote

**Likely Cause:**
- Migrations were applied manually (SQL Editor)
- OR migrations were applied with `--include-all` previously
- OR migration history diverged between environments

### Scenario 2: Migration History Divergence

**Evidence:**
- Supabase expects strict sequential order
- 16 migrations "missing" from remote history
- But DDL may have been applied manually

**Risk:**
- Running `--include-all` may re-apply already-executed DDL
- Could cause conflicts, constraint violations, or schema corruption

---

## Options

### Option A: Manual Verification + Selective Push (SAFEST)

**Steps:**
1. Check which of the 16 migrations are actually missing DDL in remote
2. Apply only missing DDL via SQL Editor
3. Update `supabase_migrations.schema_migrations` manually
4. Retry `npx supabase db push` (should only push 20260824000000)

**Pros:**
- ✅ No risk of re-applying existing DDL
- ✅ Full control over what gets executed
- ✅ Can verify each migration individually

**Cons:**
- ⏱️ Time-consuming (manual verification)
- 🔧 Requires SQL expertise

**Effort:** 30-60 minutes

---

### Option B: Direct RPC Deployment (RECOMMENDED)

**Since only the RPC migration is needed:**

**Steps:**
1. Copy content: `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`
2. Supabase Dashboard → SQL Editor
3. Execute migration SQL directly
4. Manually insert into `supabase_migrations.schema_migrations`:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
   VALUES (
     '20260824000000',
     'finance_test_cleanup_rpc',
     ARRAY['CREATE FUNCTION', 'REVOKE', 'GRANT', 'COMMENT']
   );
   ```
5. Verify RPC: `npx tsx scripts/verify_cleanup_rpc.ts`

**Pros:**
- ✅ Fast (5 minutes)
- ✅ Only deploys needed RPC
- ✅ No risk to unrelated migrations
- ✅ Bypasses migration order conflict

**Cons:**
- ⚠️ Bypasses migration pipeline for this one file
- ⚠️ Manual schema_migrations update required

**Effort:** 5 minutes

---

### Option C: Force Push with --include-all (NOT RECOMMENDED)

**Command:**
```bash
npx supabase db push --include-all
```

**Risks:**
- ❌ May re-apply already-executed DDL
- ❌ Could cause:
  - "relation already exists" errors
  - Constraint conflicts
  - Data corruption
  - Schema inconsistencies
- ❌ No way to verify which of 16 migrations are actually missing

**Only safe if:**
- All 16 migrations are confirmed missing from remote
- Remote database is a fresh instance
- Acceptable to reset database state

**Effort:** 2 minutes (but high risk)

---

### Option D: Migration History Reconciliation (THOROUGH)

**Steps:**
1. Query remote `supabase_migrations.schema_migrations`:
   ```sql
   SELECT version, name 
   FROM supabase_migrations.schema_migrations 
   ORDER BY version;
   ```
2. Compare with local migration files
3. For each "missing" migration:
   - Check if DDL exists in remote (query pg_catalog)
   - If DDL exists: insert into schema_migrations only
   - If DDL missing: apply migration SQL
4. Retry `npx supabase db push`

**Pros:**
- ✅ Most accurate
- ✅ Resolves divergence properly
- ✅ Future migrations will work correctly

**Cons:**
- ⏱️ Very time-consuming (60-120 minutes)
- 🔧 Requires deep PostgreSQL knowledge

**Effort:** 1-2 hours

---

## Recommended Approach

**For Phase 4.4 RPC Deployment: Option B (Direct Deployment)**

**Rationale:**
1. **Time-sensitive:** Cleanup is blocked on RPC
2. **Isolated change:** RPC is self-contained (no dependencies)
3. **Low risk:** Creating a new function doesn't affect existing schema
4. **Reversible:** Can DROP FUNCTION if issues arise
5. **Proven pattern:** Manual SQL execution used in Phase 2.5

**Migration history reconciliation can be deferred** to a separate maintenance window.

---

## Execution Plan (Option B)

### Step 1: Extract RPC SQL

```bash
cat supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql
```

### Step 2: Apply via Supabase Dashboard

1. Navigate to: Supabase Dashboard → SQL Editor
2. Create new query
3. Paste RPC migration SQL
4. Execute
5. Verify: Check for errors in output

### Step 3: Update Migration History

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260824000000',
  'finance_test_cleanup_rpc',
  ARRAY[
    'DROP FUNCTION IF EXISTS public.finance_admin_cleanup_test_transactions',
    'CREATE OR REPLACE FUNCTION public.finance_admin_cleanup_test_transactions',
    'REVOKE ALL ON FUNCTION public.finance_admin_cleanup_test_transactions FROM PUBLIC',
    'GRANT EXECUTE ON FUNCTION public.finance_admin_cleanup_test_transactions TO service_role',
    'COMMENT ON FUNCTION public.finance_admin_cleanup_test_transactions'
  ]
);
```

### Step 4: Verify RPC Deployment

```bash
npx tsx scripts/verify_cleanup_rpc.ts
```

**Expected: 4/4 tests PASS**

### Step 5: Report Output for Review

**DO NOT proceed to cleanup execution.**

---

## Alternative: Wait for Migration Reconciliation

**If Human Architect prefers to resolve migration history first:**

1. Schedule migration reconciliation session (1-2 hours)
2. Run Option D (thorough verification)
3. Clean up migration state
4. Deploy RPC via CLI properly
5. Proceed with cleanup

**Pros:**
- ✅ Migration pipeline fully restored
- ✅ No manual bypasses

**Cons:**
- ⏱️ Phase 4.4 cleanup delayed by 1-2 hours
- 🔧 Requires manual investigation

---

## Decision Required

### Question 1: Deploy RPC via Dashboard (Option B)?

**Recommendation:** ✅ YES
- Fast, safe, isolated change
- Unblocks Phase 4.4 cleanup
- Migration history can be reconciled later

### Question 2: Reconcile migration history now?

**Recommendation:** ⏸️ DEFER
- Not blocking Phase 4.4
- Can be separate maintenance task
- More time for thorough investigation

---

## Files Ready (Option B)

✅ `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql` (ready to copy)  
✅ `scripts/verify_cleanup_rpc.ts` (ready to run after deployment)  
✅ Migration history INSERT statement (documented above)

---

## Risk Assessment

### Option B: Direct RPC Deployment

**Risk Level:** 🟢 LOW

**Risks:**
- ⚠️ Manual schema_migrations update (could be typo'd)
- ⚠️ Bypasses migration audit trail

**Mitigations:**
- ✅ SQL statement provided (copy-paste, no typos)
- ✅ Verification script will confirm RPC works
- ✅ Migration file preserved for future reconciliation
- ✅ Self-contained change (no dependencies)
- ✅ Reversible (DROP FUNCTION)

**Impact if Failed:**
- RPC doesn't deploy → retry
- Migration history incorrect → fix INSERT
- No data loss risk
- No schema corruption risk

---

## Current Status

**RPC Deployment:** 🛑 BLOCKED (migration order conflict)  
**Recommended Action:** Option B (Direct Dashboard deployment)  
**Cleanup Execution:** 🔒 BLOCKED (awaiting RPC)  
**Next Step:** Human Architect decision on deployment method

---

**Awaiting Human Architect decision:**
- ✅ Approve Option B (Direct Dashboard deployment)?
- OR
- ⏸️ Defer and reconcile migration history first?
