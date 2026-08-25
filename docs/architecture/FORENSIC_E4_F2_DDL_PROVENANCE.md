# Forensic E4: F2 DDL Provenance Verification

**Date:** 2026-08-24  
**Purpose:** Determine if `20260824000000_f2_cash_effective_date.sql` DDL already exists on remote  
**Status:** ⏳ AWAITING HUMAN EXECUTION

---

## **Context**

**E1 Results confirmed:**
- `20260819040000` → `fix_legacy_spa_rls_policies` (remote canonical)
- `20260820110000` → `database_role_separation` (remote canonical)
- `20260824000000` → **FREE** (does not exist on remote)

**Critical question:**

Is the F2 DDL (effective_date column + index) already deployed on remote database?

**Scenario A:** DDL exists (applied without migration history record)
- Can safely DELETE `20260824000000_f2_cash_effective_date.sql` local file
- RPC can legitimately own version `20260824000000`
- Step 2 Gate: `db push` will show ONLY RPC ✅

**Scenario B:** DDL does NOT exist (genuine pending migration)
- F2 must be deployed BEFORE RPC
- RPC must use version `20260824000001` or later
- Step 2 Gate: Cannot pass with only RPC ❌

---

## **E4 Verification Query**

**Execute on Supabase Dashboard → SQL Editor:**

File: `scripts/forensic_f2_ddl_provenance.sql`

Or run directly:

```sql
-- E4: F2 DDL Provenance Check

-- Step 1: Check if effective_date column exists
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'finance_transactions'
  AND table_name = 'finance_cash_movements'
  AND column_name = 'effective_date';

-- Step 2: Check if related index exists
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'finance_transactions'
  AND tablename = 'finance_cash_movements'
  AND indexdef LIKE '%effective_date%';

-- Step 3: Check column constraints
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'finance_transactions'
  AND tc.table_name = 'finance_cash_movements'
  AND kcu.column_name = 'effective_date';
```

---

## **Expected Results**

### **CASE A: F2 DDL Already Applied**

**Step 1 (Column check):**
```
table_schema         | finance_transactions
table_name           | finance_cash_movements
column_name          | effective_date
data_type            | timestamp with time zone
is_nullable          | NO
```

**Step 2 (Index check):**
```
indexname            | idx_finance_cash_movements_effective_date
indexdef             | CREATE INDEX ... ON finance_cash_movements(tenant_id, bank_account_id, effective_date)
```

**Interpretation:**
- ✅ F2 DDL already deployed
- ✅ Column exists with NOT NULL constraint
- ✅ Index created
- 🎯 Migration was applied without recording history (Class B)

**Resolution:**
1. DELETE local file: `20260824000000_f2_cash_effective_date.sql`
2. Keep: `20260824000000_finance_test_cleanup_rpc.sql` (RPC owns version)
3. Delete non-canonical duplicates:
   - `20260819040000_runtime_migration_e1_gate_schema_safe.sql`
   - `20260820110000_database_role_separation_v2.sql`
4. Verify: `npx supabase db push` shows ONLY RPC
5. Deploy RPC
6. Verify RPC
7. 🛑 STOP

---

### **CASE B: F2 DDL NOT Applied**

**Step 1 (Column check):**
```
(No rows returned)
```

**Step 2 (Index check):**
```
(No rows returned)
```

**Interpretation:**
- ❌ F2 DDL NOT deployed
- ❌ effective_date column does NOT exist
- ⚠️ F2 is a genuine pending migration

**Resolution:**
1. Rename: `20260824000000_finance_test_cleanup_rpc.sql` → `20260824000001_finance_test_cleanup_rpc.sql`
2. Keep: `20260824000000_f2_cash_effective_date.sql` (F2 owns version)
3. Delete non-canonical duplicates (same as Case A)
4. Deploy F2 FIRST: `npx supabase db push` (will deploy 20260824000000)
5. THEN rename RPC back to next available version
6. Deploy RPC
7. 🛑 STOP

**OR Alternative:**
1. Delete: `20260824000000_f2_cash_effective_date.sql`
2. Rename: → `20260824000001_f2_cash_effective_date.sql`
3. Keep: `20260824000000_finance_test_cleanup_rpc.sql` (RPC owns version)
4. Delete duplicates
5. Verify: `npx supabase db push` shows TWO migrations (RPC + F2)
6. ❌ Step 2 Gate FAILS (requires ONLY RPC)
7. Human Architect decision required

---

## **F2 Migration Analysis**

From `20260824000000_f2_cash_effective_date.sql`:

**DDL Operations:**
1. `ALTER TABLE finance_cash_movements ADD COLUMN effective_date TIMESTAMPTZ`
2. Backfill: `UPDATE ... SET effective_date = ft.posted_at FROM finance_transactions ft`
3. Orphan fallback: `UPDATE ... SET effective_date = recorded_at WHERE effective_date IS NULL`
4. `ALTER TABLE ... ALTER COLUMN effective_date SET NOT NULL`
5. `CREATE INDEX idx_finance_cash_movements_effective_date ON ...`

**Trigger Operations:**
- Temporarily disables `trg_finance_cash_movements_immutability`
- Temporarily disables `trg_finance_cash_movements_mutation_guard`
- Re-enables both after backfill

**Contract:** F2 Cash Temporal v1.2
**Invariants:** INV-F2-T1, INV-F2-T3

---

## **E4 Decision Matrix**

| E4 Result | F2 DDL Exists | Action | Step 2 Gate |
|-----------|---------------|--------|-------------|
| Column EXISTS + Index EXISTS | ✅ YES | DELETE F2 local file, RPC owns 20260824000000 | ✅ PASS |
| Column NOT FOUND | ❌ NO | Rename RPC to 20260824000001, F2 deploys first | ❌ FAIL (2 migrations) |
| Column EXISTS but Index MISSING | ⚠️ PARTIAL | Manual intervention required | ❌ BLOCKED |

---

## **Gate Enforcement Reminder**

**Step 2 Gate Requirement:**

```bash
npx supabase db push
```

**Must show:**
```
Local migrations to apply:
  20260824000000_finance_test_cleanup_rpc.sql

Apply migrations? [y/N]
```

**If ANY other migration appears → 🛑 STOP**

---

## **Next Steps**

1. **Human Architect:** Execute E4 query on Dashboard
2. **Report:** E4 results (column exists? index exists?)
3. **Kiro:** Analyze E4 + determine resolution strategy
4. **Human Architect:** Approve resolution strategy
5. **Kiro:** Execute file operations (delete/rename as approved)
6. **Verify:** `db push` shows ONLY RPC
7. **Deploy:** RPC migration
8. **Verify:** `verify_cleanup_rpc.ts` (4/4 PASS)
9. **🛑 STOP:** Report to Architect

---

**Status:** E1/E2/E3 complete, E4 awaiting execution  
**Blocker:** Cannot determine F2 resolution without DDL provenance  
**File:** `scripts/forensic_f2_ddl_provenance.sql` (ready to execute)
