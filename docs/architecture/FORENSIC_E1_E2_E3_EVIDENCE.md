# Forensic Evidence Collection: E1-E2-E3

**Date:** 2026-08-24  
**Purpose:** Determine identity of duplicate migration versions before any modifications  
**Status:** 🟡 IN PROGRESS — E2/E3 complete, E1 awaiting Human execution

---

## **E1: Remote Identity** ⏳ PENDING

### Query to Execute

**Via Supabase Dashboard → SQL Editor:**

```sql
-- READ-ONLY: Remote Migration Identity Check
SELECT *
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260819040000',
  '20260820110000',
  '20260824000000'
)
ORDER BY version;
```

### Expected Output

For each version, need:
- `version` (timestamp)
- `name` (migration file name without `.sql`)
- `statements` (array of DDL types)
- `applied_at` (timestamp when applied)

### Critical Questions

1. **Does `20260824000000` exist on remote?**
   - If YES → Which name? (`f2_cash_effective_date` or `finance_test_cleanup_rpc`)
   - If NO → Version is free for RPC deployment

2. **Which file names match remote for duplicates?**
   - `20260819040000` → `fix_legacy_spa_rls_policies` OR `runtime_migration_e1_gate_schema_safe`?
   - `20260820110000` → `database_role_separation` OR `database_role_separation_v2`?

---

## **E2: Local Identity** ✅ COMPLETE

### Git Status

**All 5 migrations are UNTRACKED (`??`):**

```
?? supabase/migrations/20260824000000_f2_cash_effective_date.sql
?? supabase/migrations/20260824000000_finance_test_cleanup_rpc.sql
?? supabase/migrations/20260824010000_f2_fix_cash_contract.sql
?? supabase/migrations/20260824020000_f2_opening_balance_contract.sql
?? supabase/migrations/20260824030000_f2_opening_balance_provenance.sql
```

**Interpretation:**
- ✅ These are NEW files created in current working session
- ✅ NOT committed to Git yet
- ✅ NOT pushed to remote repository
- ⚠️ Both `20260824000000` files created in this session

---

## **E3: Git Provenance** ✅ COMPLETE

### 20260819040000 Duplicates

**Git History:**
```
39d70165 E6: R3 Location Hierarchy Validation complete (6/6 PASS, 0 bugs)
9af524b1 🛡️ SECURITY GATE: Fix Healthcare RLS tenant isolation (P0)
```

**Files:**
- `20260819040000_fix_legacy_spa_rls_policies.sql` ← Commit: `9af524b1` (Security Gate)
- `20260819040000_runtime_migration_e1_gate_schema_safe.sql` ← Commit: `39d70165` (E6: R3)

**Canonical:** `runtime_migration_e1_gate_schema_safe.sql` (newer commit)

---

### 20260820110000 Duplicates

**Git History:**
```
39d70165 E6: R3 Location Hierarchy Validation complete (6/6 PASS, 0 bugs)
```

**Files:**
- `20260820110000_database_role_separation.sql` ← Commit: `39d70165`
- `20260820110000_database_role_separation_v2.sql` ← Commit: `39d70165`

**Interpretation:** Both from same commit (`39d70165`). Likely `_v2` is newer version.

**Canonical (likely):** `database_role_separation_v2.sql`

---

### 20260824000000 Duplicates

**Git History:**
```
(empty — no commits found)
```

**Files:**
- `20260824000000_f2_cash_effective_date.sql` ← UNTRACKED (new)
- `20260824000000_finance_test_cleanup_rpc.sql` ← UNTRACKED (new)

**Interpretation:**
- ✅ Both created in current session
- ✅ Neither committed yet
- ✅ Neither applied to remote database (unless manually via Dashboard)
- 🎯 Version `20260824000000` is effectively FREE for deployment

---

## **Resolution Strategy (After E1 Confirmation)**

### Scenario A: `20260824000000` does NOT exist on remote

**Action:**
1. Rename: `20260824000000_f2_cash_effective_date.sql` → `20260824000001_f2_cash_effective_date.sql`
2. Keep: `20260824000000_finance_test_cleanup_rpc.sql` (RPC deployment)
3. Verify: `npx supabase db push` shows ONLY RPC

**Rationale:**
- Version is free
- No remote conflict
- Safe to proceed

---

### Scenario B: `20260824000000` EXISTS on remote as `f2_cash_effective_date`

**Action:**
1. Delete: `20260824000000_finance_test_cleanup_rpc.sql` (local only)
2. Rename: → `20260824000002_finance_test_cleanup_rpc.sql` (after existing F2 migrations)
3. Verify: `npx supabase db push` shows ONLY RPC

**Rationale:**
- Remote owns `20260824000000`
- Must use different version for RPC

---

### Scenario C: `20260824000000` EXISTS on remote as `finance_test_cleanup_rpc`

**Action:**
1. Delete: `20260824000000_f2_cash_effective_date.sql` (local duplicate)
2. Rename: → `20260824000001_f2_cash_effective_date.sql`
3. Skip deployment (RPC already applied)

**Rationale:**
- RPC already on remote
- Proceed to verification only

---

## **Duplicate Resolution: 20260819040000**

**After E1 confirmation:**

If remote name = `runtime_migration_e1_gate_schema_safe`:
- Delete: `20260819040000_fix_legacy_spa_rls_policies.sql`
- Keep: `20260819040000_runtime_migration_e1_gate_schema_safe.sql`

If remote name = `fix_legacy_spa_rls_policies`:
- Delete: `20260819040000_runtime_migration_e1_gate_schema_safe.sql`
- Keep: `20260819040000_fix_legacy_spa_rls_policies.sql`

---

## **Duplicate Resolution: 20260820110000**

**After E1 confirmation:**

If remote name = `database_role_separation_v2`:
- Delete: `20260820110000_database_role_separation.sql`
- Keep: `20260820110000_database_role_separation_v2.sql`

If remote name = `database_role_separation`:
- Delete: `20260820110000_database_role_separation_v2.sql`
- Keep: `20260820110000_database_role_separation.sql`

---

## **Gate Enforcement**

**After resolution, verify:**

```bash
npx supabase db push
```

**Expected output:**
```
Remote database is up to date.

Local migrations to apply:
  20260824000000_finance_test_cleanup_rpc.sql

Apply migrations? [y/N]
```

**If ANY other migration appears → 🛑 STOP**

---

## **Next Steps**

1. **Human Architect:** Execute E1 query on Dashboard
2. **Report:** E1 results (3 versions)
3. **Kiro:** Analyze E1 + determine resolution strategy
4. **Human Architect:** Approve resolution strategy
5. **Kiro:** Execute file operations (delete/rename)
6. **Verify:** `db push` shows ONLY RPC
7. **Deploy:** RPC migration
8. **Verify:** `verify_cleanup_rpc.ts` (4/4 PASS)
9. **🛑 STOP:** Report to Architect

---

**Status:** E2/E3 complete, awaiting E1 from Human Architect  
**Blocker:** Cannot determine resolution strategy without remote identity  
**File:** `scripts/forensic_migration_identity.sql` (ready to execute)
