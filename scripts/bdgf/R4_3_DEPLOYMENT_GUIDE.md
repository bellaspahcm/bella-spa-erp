# R4.3 — Schema Deployment Guide

**Status:** 🟡 PENDING DEPLOYMENT
**Migration:** `supabase/migrations/20260820151000_r4_3_gate_tokens.sql`
**Verification:** `scripts/bdgf/r4-3-schema-verify.mjs`

---

## Pre-Deployment Checklist

Before deploying R4.3 schema:

- ✅ R4.1 CONTRACT FROZEN
- ✅ R4.2 COMPLETE (25/25 tests PASSED)
- ✅ R4.3 CONTRACT FROZEN
- ✅ R3 BASELINE LOCKED (verified)
- ✅ Migration reviewed (4 critical points)

---

## Deployment Steps

### 1. Review Migration

**File:** `supabase/migrations/20260820151000_r4_3_gate_tokens.sql`

**Creates:**
- `bella_gate_tokens` table (gate authorization tokens)
- `bella_execution_audit` table (append-only audit log)
- Extended `bella_migration_approval` states (executing, executed, execution_failed)
- Triggers (prevent audit UPDATE/DELETE)
- RLS policies (bella_developer blocked from gate tokens)
- Permissions (explicit GRANTs)

**Critical Enforcement:**
1. ✅ bella_developer: NO access to bella_gate_tokens
2. ✅ bella_migration_executor: Cannot self-create approvals
3. ✅ Audit append-only (trigger blocks UPDATE/DELETE)
4. ✅ Single-use atomic (UNIQUE nonce + status check)

### 2. Deploy to DEV/TEST Environment

**⚠️ DO NOT deploy to Production first!**

**Steps:**
1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy content from `supabase/migrations/20260820151000_r4_3_gate_tokens.sql`
4. Execute SQL
5. Verify success message: `✅ R4.3 schema migration complete`

**Expected Output:**
```
NOTICE:  ✅ R4.3 schema migration complete

Success. No rows returned
```

### 3. Verify Tables Created

In Supabase Dashboard SQL Editor:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('bella_gate_tokens', 'bella_execution_audit')
ORDER BY table_name;
```

**Expected Output:**
```
bella_execution_audit
bella_gate_tokens
```

### 4. Verify Permissions

```sql
-- Check bella_developer has NO access to gate tokens
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'bella_gate_tokens'
ORDER BY grantee, privilege_type;
```

**Expected Output:**
```
bella_migration_executor | INSERT
bella_migration_executor | SELECT
bella_migration_executor | UPDATE
```

**❌ Should NOT see:** `bella_developer` in results

### 5. Verify Extended Approval States

```sql
-- Check approval table has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bella_migration_approval'
  AND column_name IN ('execution_started_at', 'execution_completed_at', 'execution_error')
ORDER BY column_name;
```

**Expected Output:**
```
execution_completed_at | timestamp with time zone
execution_error        | text
execution_started_at   | timestamp with time zone
```

### 6. Run Verification Script

**Critical:** This runs negative tests to PROVE enforcement.

```bash
node scripts/bdgf/r4-3-schema-verify.mjs
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║ R4.3 — SCHEMA DEPLOYMENT VERIFICATION                      ║
╚════════════════════════════════════════════════════════════╝

🧪 SCHEMA EXISTENCE CHECKS
✅ Test 1: bella_gate_tokens table exists
✅ Test 2: bella_execution_audit table exists
✅ Test 3: Approval table has execution_started_at
✅ Test 4: Approval table has execution_completed_at
✅ Test 5: Approval table has execution_error

🧪 POINT 1: bella_developer NO ACCESS to bella_gate_tokens
✅ Test 6: Developer SELECT gate_tokens → BLOCKED
✅ Test 7: Developer INSERT gate_tokens → BLOCKED
✅ Test 8: Developer UPDATE gate_tokens → BLOCKED
✅ Test 9: Developer DELETE gate_tokens → BLOCKED

🧪 POINT 2: Executor CANNOT self-create approvals
✅ Test 10: Executor INSERT approval → BLOCKED

🧪 POINT 3: Audit table is append-only
✅ Test 11: Audit INSERT works
✅ Test 12: Audit UPDATE → BLOCKED by trigger
✅ Test 13: Audit DELETE → BLOCKED by trigger

🧪 POINT 4: Single-use token enforcement (atomic)
✅ Test 14: First token INSERT succeeds
✅ Test 15: Duplicate nonce → BLOCKED
✅ Test 16: Token atomic consume succeeds
✅ Test 17: Token replay → BLOCKED (no rows updated)

═══════════════════════════════════════════════════════════
TEST SUMMARY: 17 total tests
✅ PASSED: 17
❌ FAILED: 0
═══════════════════════════════════════════════════════════

🎉 ALL TESTS PASSED - R4.3 SCHEMA VERIFIED

Verified:
  ✓ bella_developer has NO access to gate tokens
  ✓ bella_migration_executor cannot self-create approvals
  ✓ Audit table is append-only (UPDATE/DELETE blocked)
  ✓ Single-use enforcement is atomic

✅ Ready for Step 2: Gate Token Module implementation
```

**If any test fails:**
- ❌ DO NOT proceed to Step 2
- Investigate failure cause
- Fix migration if needed
- Re-deploy and re-verify

---

## Verification Criteria

### ✅ PASS Criteria (all must be true)

1. **Table Existence:**
   - bella_gate_tokens table exists
   - bella_execution_audit table exists
   - bella_migration_approval has new columns

2. **Permission Enforcement (Point 1):**
   - bella_developer cannot SELECT bella_gate_tokens
   - bella_developer cannot INSERT bella_gate_tokens
   - bella_developer cannot UPDATE bella_gate_tokens
   - bella_developer cannot DELETE bella_gate_tokens

3. **Approval Creation (Point 2):**
   - bella_migration_executor cannot INSERT bella_migration_approval
   - (R3/R4.2 invariant preserved)

4. **Audit Immutability (Point 3):**
   - bella_execution_audit INSERT works
   - bella_execution_audit UPDATE blocked by trigger
   - bella_execution_audit DELETE blocked by trigger

5. **Single-Use Atomic (Point 4):**
   - Token INSERT succeeds
   - Duplicate nonce INSERT blocked (UNIQUE constraint)
   - Token status change is atomic (UPDATE WHERE status='issued')
   - Second consume attempt returns 0 rows (replay blocked)

### ❌ FAIL Criteria (any of these = BLOCK Step 2)

- bella_developer can access bella_gate_tokens
- bella_migration_executor can self-create approvals
- Audit UPDATE/DELETE succeeds (trigger not firing)
- Duplicate nonce INSERT succeeds (UNIQUE constraint not enforced)
- Token replay succeeds (atomic consume not working)

---

## Post-Verification

### If ALL Tests PASS ✅

**Status:** 🟢 Schema verified, ready for Step 2

**Next Steps:**
1. Document evidence (R4_3_SCHEMA_VERIFIED.md)
2. Proceed to Step 2: Gate Token Module
   - Implement sign/validate/consume functions
   - Use secrets manager for signing key
3. Continue implementation sequence

### If ANY Test FAILS ❌

**Status:** 🔴 Schema deployment failed, BLOCKED

**Actions:**
1. **DO NOT proceed to Step 2**
2. Investigate root cause:
   - Check Supabase logs
   - Verify RLS policies enabled
   - Verify triggers created
   - Check role permissions
3. Fix migration and re-deploy
4. Re-run verification
5. Document failure + remediation

---

## Rollback Plan

If deployment causes issues:

```sql
-- Rollback (if needed)
DROP TABLE IF EXISTS bella_execution_audit CASCADE;
DROP TABLE IF EXISTS bella_gate_tokens CASCADE;

-- Remove triggers
DROP TRIGGER IF EXISTS prevent_update_execution_audit ON bella_execution_audit;
DROP TRIGGER IF EXISTS prevent_delete_execution_audit ON bella_execution_audit;
DROP FUNCTION IF EXISTS prevent_audit_modification();

-- Revert approval table changes
ALTER TABLE bella_migration_approval
  DROP COLUMN IF EXISTS execution_started_at,
  DROP COLUMN IF EXISTS execution_completed_at,
  DROP COLUMN IF EXISTS execution_error;

-- Revert status constraint
ALTER TABLE bella_migration_approval
  DROP CONSTRAINT IF EXISTS status_valid;

ALTER TABLE bella_migration_approval
  ADD CONSTRAINT status_valid CHECK (
    status IN ('requested', 'approved', 'revoked', 'used', 'expired', 'rejected')
  );
```

**⚠️ Only use if absolutely necessary. Test rollback in DEV first.**

---

## Evidence Documentation

After successful verification (17/17 tests PASS), create:

**File:** `evidence/g3a-architecture/R4_3_SCHEMA_VERIFIED.md`

**Contents:**
- Deployment timestamp
- Verification test results (17/17 PASS)
- Database queries confirming enforcement
- Screenshot/output of verification script
- Confirmation: Ready for Step 2

---

## Critical Reminder

> **R4.3 Schema deployment is NOT complete just because SQL executes without error.**
>
> Deployment is complete ONLY when verification script confirms:
> - bella_developer access blocked
> - bella_migration_executor cannot self-approve
> - Audit immutability enforced
> - Single-use atomicity verified
>
> Evidence > Assumption.

---

**Status:** 🟡 PENDING DEPLOYMENT
**Next:** Deploy to DEV → Verify → Document → Proceed to Step 2
**Blocker:** None (ready to deploy)
