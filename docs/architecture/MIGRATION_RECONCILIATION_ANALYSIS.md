# Migration Reconciliation Analysis

**Date:** 2026-08-24  
**Status:** 🔴 CONFLICT DETECTED — Duplicate versions + remote-only migrations  
**Blocker:** Cannot proceed with RPC deployment until resolved

---

## Issue Summary

`npx supabase db push` failed with:
```
Remote migration versions not found in local migrations directory.
```

**Root cause:** Local migration files don't match remote `schema_migrations` history.

---

## Analysis: LOCAL vs REMOTE

### **DUPLICATES (Same version, different files locally)**

#### 1. **20260819040000** — DUPLICATE LOCAL FILES
- **Local file 1:** `20260819040000_fix_legacy_spa_rls_policies.sql`
- **Local file 2:** `20260819040000_runtime_migration_e1_gate_schema_safe.sql`
- **Remote:** `20260819040000` (1 entry, time: 2026-08-19 04:00:00)
- **Conflict:** 2 local files, 1 remote entry

#### 2. **20260820110000** — DUPLICATE LOCAL FILES
- **Local file 1:** `20260820110000_database_role_separation_v2.sql`
- **Local file 2:** `20260820110000_database_role_separation.sql`
- **Remote:** `20260820110000` (1 entry, time: 2026-08-20 11:00:00)
- **Conflict:** 2 local files, 1 remote entry

#### 3. **20260824000000** — DUPLICATE LOCAL FILES
- **Local file 1:** `20260824000000_f2_cash_effective_date.sql`
- **Local file 2:** `20260824000000_finance_test_cleanup_rpc.sql` ← **TARGET RPC**
- **Remote:** NONE (both local-only)
- **Conflict:** 2 local files with same version

---

### **REMOTE-ONLY (In remote history, no local file)**

From `migration list` output, these appear in Remote column but NOT in Local:

#### Group A: 20260820 migrations (3 versions shown with blank Local)
1. **20260820151000_r4_3_gate_tokens** — File exists locally: ✅ `20260820151000_r4_3_gate_tokens.sql`
2. **20260820152000_r4_4_monitoring_audit** — File exists locally: ✅ `20260820152000_r4_4_monitoring_audit.sql`
3. **20260820150000_r4_approval_contract** — File exists locally: ✅ `20260820150000_r4_approval_contract.sql`

**Note:** Migration list shows these with abbreviated version `20260820` in both columns, but **files exist locally**.

#### Group B: 20260821 migrations (4 versions shown with blank Local)
1. **20260821122000_create_accessorial_rates_table** — File exists locally: ✅
2. **20260821121000_create_carrier_rates_table** — File exists locally: ✅
3. **20260821123000_create_discrepancies_table** — File exists locally: ✅
4. **20260821120000_create_freight_audit_tables** — File exists locally: ✅

**Note:** Migration list shows abbreviated version `20260821`, but **files exist locally**.

#### Group C: 20260824 migrations (5 versions shown with blank Local)
1. **20260824000000** — 2 LOCAL FILES (duplicate)
2. **20260824010000** — File exists locally: ✅ `20260824010000_f2_fix_cash_contract.sql`
3. **20260824020000** — File exists locally: ✅ `20260824020000_f2_opening_balance_contract.sql`
4. **20260824030000** — File exists locally: ✅ `20260824030000_f2_opening_balance_provenance.sql`

---

## Root Cause

### **Issue 1: Duplicate Versions**

Supabase CLI **does not support multiple files with the same version**.

**Impact:**
- CLI cannot determine which file to deploy
- `db push` fails validation
- Migration chain is ambiguous

### **Issue 2: Abbreviated Version Display**

Migration list shows abbreviated versions (e.g., `20260820` instead of full timestamp) for migrations with non-standard naming (underscore suffix instead of timestamp suffix).

**These are NOT remote-only**, files exist locally but display format is confusing.

### **Issue 3: Step 1 Side Effect**

Step 1 recorded 16 migrations in `schema_migrations`, but:
- Did NOT verify corresponding local files exist
- Did NOT verify local files are unique per version
- Created mismatch between remote history and local file state

---

## Impact on RPC Deployment

**Gate requirement:** `db push` must show ONLY `20260824000000_finance_test_cleanup_rpc.sql`

**Current blocker:**
- ❌ Duplicate `20260824000000` (2 local files)
- ❌ CLI cannot resolve which file to deploy
- ❌ Cannot proceed with RPC deployment

---

## Resolution Options

### **Option A: Remove Duplicate Files (RECOMMENDED)**

**For 20260819040000:**
- Keep: `20260819040000_runtime_migration_e1_gate_schema_safe.sql` (matches remote)
- Delete: `20260819040000_fix_legacy_spa_rls_policies.sql`

**For 20260820110000:**
- Keep: `20260820110000_database_role_separation_v2.sql` (latest version)
- Delete: `20260820110000_database_role_separation.sql`

**For 20260824000000:**
- Keep: `20260824000000_finance_test_cleanup_rpc.sql` ← **TARGET RPC**
- Rename: `20260824000000_f2_cash_effective_date.sql` → `20260824000001_f2_cash_effective_date.sql`

**Then verify:**
```bash
npx supabase db push
```
Should show ONLY: `20260824000000_finance_test_cleanup_rpc.sql`

---

### **Option B: Rename All Conflicting Files**

Systematically rename duplicates to avoid version collision:
- `20260819040000_fix_legacy_spa_rls_policies.sql` → `20260819040001_*`
- `20260820110000_database_role_separation.sql` → `20260820110001_*`
- `20260824000000_f2_cash_effective_date.sql` → `20260824000001_*`

**Risk:** Requires re-deploying renamed files later.

---

### **Option C: Rollback Step 1 History Records**

Delete 16 migration records from `schema_migrations`, fix local files, then re-record.

**Risk:** Requires Manual SQL DELETE, not recommended.

---

## Recommended Action

**CHOOSE Option A:**

1. **Verify which file was actually applied on remote:**
   - Check `supabase_migrations.schema_migrations.name` column for exact name
   - Match with local file

2. **Delete non-matching duplicate files**

3. **Rename `20260824000000_f2_cash_effective_date.sql`:**
   - New version: `20260824000001_f2_cash_effective_date.sql`
   - Preserves RPC deployment at `20260824000000`

4. **Verify `db push` shows only RPC migration**

5. **Proceed with RPC deployment**

---

## Verification Query

To check which files were actually recorded in Step 1:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260819040000',
  '20260820110000',
  '20260820151000_r4_3_gate_tokens',
  '20260820152000_r4_4_monitoring_audit',
  '20260820150000_r4_approval_contract',
  '20260821122000_create_accessorial_rates_table',
  '20260821121000_create_carrier_rates_table',
  '20260821123000_create_discrepancies_table',
  '20260821120000_create_freight_audit_tables'
)
ORDER BY version;
```

This will show exact names recorded on remote.

---

## Next Steps

1. **Query remote `schema_migrations` to get exact names**
2. **Delete local duplicate files that don't match remote**
3. **Rename `20260824000000_f2_cash_effective_date.sql` → `20260824000001_*`**
4. **Verify `npx supabase db push` shows ONLY RPC**
5. **Deploy RPC**
6. **Verify RPC with `verify_cleanup_rpc.ts`**
7. **🛑 STOP — Report to Human Architect**

---

**Status:** Awaiting Human Architect decision on duplicate resolution strategy
