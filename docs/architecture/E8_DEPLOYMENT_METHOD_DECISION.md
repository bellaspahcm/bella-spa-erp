# E8: Deployment Method Decision

**Date:** 2026-08-24  
**Status:** 🟡 READY TO EXECUTE  
**Context:** F2 Cash Temporal & Opening Balance Contract deployment

**Prerequisites:**
- ✅ E5 PASS: 16/16 migrations exist with correct identity
- ✅ E7 PASS: Canonical identity verified, 20260824000000 FREE
- ✅ CLI limitation identified and documented

---

## Deployment Target

**Migration:** `20260824000000_finance_test_cleanup_rpc.sql`

**Purpose:** Phase 4.4 cleanup RPC (prerequisite for F2 deployment)

**Version status:** ✅ FREE (E7.3 verified)

**Next migrations:** F2 sequence (040000-070000) after RPC verified

---

## E8 Gate Structure

### E8.1 — Deployment Method Selection

**Options evaluated:**

| Method | Status | Assessment |
|--------|--------|------------|
| **CLI `db push`** | ❌ BLOCKED | Legacy migration reconciliation failure |
| **Dashboard SQL Editor** | ✅ AVAILABLE | Direct SQL execution, bypasses CLI |
| **Programmatic deployment** | ⚠️ COMPLEX | Requires custom tooling |

**Selected method:** Dashboard SQL Editor

**Rationale:**
- Bypasses CLI reconciliation limitation
- Direct SQL execution (same as manual migration)
- Standard Supabase deployment path
- Maintains migration provenance integrity
- No modifications to existing migrations required

### E8.2 — Pre-Deployment Identity Check

**Verify BEFORE deployment:**

```sql
-- Confirm version still FREE
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations 
      WHERE version = '20260824000000'
    ) THEN 'OCCUPIED'
    ELSE 'FREE'
  END as pre_deployment_status;
```

**Expected:** `FREE`

**If OCCUPIED:** STOP, investigate (concurrent deployment or version collision)

### E8.3 — Deploy Migration

**Method:** Execute via Dashboard SQL Editor

**Steps:**
1. Copy content of `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`
2. Paste into Dashboard SQL Editor
3. Execute
4. Capture execution result

**Expected:** Success (no SQL errors)

### E8.4 — Verify Migration Recorded

**Verify migration history updated:**

```sql
SELECT 
  version,
  name,
  array_length(statements, 1) as statement_count
FROM supabase_migrations.schema_migrations
WHERE version = '20260824000000';
```

**Expected:** 1 row with:
- `version` = '20260824000000'
- `name` = 'finance_test_cleanup_rpc'
- `statement_count` > 0

**If missing:** Deployment failed, migration not recorded

### E8.5 — Verify RPC Exists and Callable

**Verify function created:**

```sql
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'finance_test_cleanup';
```

**Expected:** 1 row with `routine_type` = 'FUNCTION'

**Test RPC invocation:**

```sql
-- Dry-run test (no actual deletions)
SELECT finance_test_cleanup(false) as dry_run_result;
```

**Expected:** Returns record count structure without errors

### E8.6 — Verify No Unexpected Side Effects

**Check for:**

1. **No schema corruption:**
```sql
SELECT COUNT(*) as total_migrations
FROM supabase_migrations.schema_migrations;
```
**Expected:** Previous count + 1

2. **No duplicate versions:**
```sql
SELECT version, COUNT(*) as occurrence_count
FROM supabase_migrations.schema_migrations
GROUP BY version
HAVING COUNT(*) > 1;
```
**Expected:** 0 rows

3. **No missing statements:**
```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE array_length(statements, 1) IS NULL 
   OR array_length(statements, 1) = 0;
```
**Expected:** 0 rows

---

## E8 PASS Conditions

**E8 PASS requires ALL of:**

- ✅ E8.1: Dashboard method selected
- ✅ E8.2: Pre-deployment check shows FREE
- ✅ E8.3: Deployment executes without SQL errors
- ✅ E8.4: Migration recorded in schema_migrations
- ✅ E8.5: RPC exists and is callable
- ✅ E8.6: No unexpected side effects detected

**E8 BLOCKED if ANY of:**

- ❌ E8.2: Version OCCUPIED before deployment
- ❌ E8.3: SQL errors during deployment
- ❌ E8.4: Migration not recorded after deployment
- ❌ E8.5: RPC missing or not callable
- ❌ E8.6: Side effects detected (corruption, duplicates, etc.)

---

## Post-E8 Next Steps

### If E8 PASS:

**Proven:**
- `20260824000000` successfully deployed
- RPC verified functional
- Migration history integrity maintained

**Next gate:** E9 — Phase 4.4 Cleanup Execution
1. Verify RPC with test data
2. Execute cleanup (274 records)
3. Verify cleanup results
4. STOP for Architect approval before F2

### If E8 BLOCKED:

**Actions:**
- Document failure mode
- Investigate root cause
- DO NOT retry deployment until issue resolved
- DO NOT modify migration history
- Escalate to Human Architect

---

## Governance Principles

**E8 follows:**

1. **Deployment transparency:** Every step verified with SQL evidence
2. **No silent failures:** Each gate has explicit PASS/FAIL condition
3. **Independent verification:** Post-deployment checks independent of deployment method
4. **Provenance integrity:** Migration history not modified to satisfy tooling
5. **Minimal intervention:** Use standard deployment path (Dashboard)

**E8 does NOT:**
- Modify existing migration history
- Repair CLI reconciliation
- Rename legacy migrations
- Bypass migration recording
- Skip post-deployment verification

---

## Execution Instructions

### Manual Execution (Dashboard)

**File:** `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`

**Steps:**
1. Navigate to Dashboard → SQL Editor
2. Execute E8.2 pre-deployment check
3. If FREE, copy entire migration file content
4. Paste into SQL Editor
5. Execute
6. Execute E8.4-E8.6 verification queries
7. Document results

### Automated Execution (Script)

**Script:** `scripts/e8_deploy_and_verify.ts` (to be created)

**Execute:**
```bash
npx tsx scripts/e8_deploy_and_verify.ts
```

**Output:** All 6 E8 gate results with PASS/BLOCKED determination

---

## Risk Assessment

**Low risk:**
- ✅ Migration SQL already reviewed
- ✅ RPC is read-only function (no data modifications)
- ✅ Version verified FREE before deployment
- ✅ Post-deployment verification catches failures

**Medium risk:**
- ⚠️ Manual Dashboard execution (human error possible)
- ⚠️ No automated rollback (migration is one-way)

**High risk:**
- ❌ None identified

**Mitigation:**
- Use verification script after manual deployment
- Document all steps and results
- Test RPC with dry-run before actual cleanup execution

---

## Files

**Deployment target:**
- `supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql`

**Verification script:**
- `scripts/e8_deploy_and_verify.ts` (to be created)

**Evidence document:**
- `docs/architecture/E8_DEPLOYMENT_EVIDENCE.md` (after execution)

---

## Summary

**E8 is the execution gate between:**
- E7: Provenance verified ✅
- E9: Phase 4.4 cleanup execution ⏸️

**E8 proves:** Migration deployment successful AND verified

**E8 does NOT prove:** CLI reconciliation fixed (out of scope)

**After E8 PASS:** F2 deployment path clear, pending Phase 4.4 cleanup completion

---

**Status:** READY TO EXECUTE

**Awaiting:** Human Architect approval to proceed with E8.2-E8.6
