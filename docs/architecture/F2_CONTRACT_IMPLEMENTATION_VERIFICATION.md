# F2 Cash Temporal & Opening Balance Contract — Implementation Verification

**Date:** 2026-08-24  
**Status:** 🟢 MIGRATIONS 1–4a COMPLETE — AWAITING DEPLOYMENT & VERIFICATION  
**Contract Version:** F2_CASH:v1.2 & F2_OPENING:v1  

---

## IMPLEMENTATION SUMMARY

### Migrations Created (M1–M4a)

| Migration | File | Purpose | Status |
|-----------|------|---------|--------|
| **M1** | `20260824000000_f2_cash_effective_date.sql` | Add effective_date column to finance_cash_movements, backfill from F1 | ✅ Created |
| **M2** | `20260824010000_f2_fix_cash_contract.sql` | Update finance_get_cash_movements_as_of() to use effective_date | ✅ Created |
| **M3** | `20260824020000_f2_opening_balance_contract.sql` | Create finance_cash_opening_balances table + contract function | ✅ Created |
| **M4a** | `20260824030000_f2_opening_balance_provenance.sql` | Create baseline provenance decision registry | ✅ Created |

### Architectural Invariants Enforced

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| **INV-F2-T1** | effective_date immutable after INSERT | Migration + Application logic |
| **INV-F2-T2** | effective_date = F1.posted_at (authoritative source) | Backfill query (M1) |
| **INV-F2-T3** | Temporal determinism (same as_of → same results) | Contract uses effective_date (M2) |
| **INV-F2-O1** | Baseline Closure (opening balance at D includes movements <= D) | Contract documentation (M3) |
| **INV-F2-O2** | Baseline Provenance (source_type, notes mandatory) | NOT NULL constraints (M3) |
| **INV-F2-O3** | No Historical Reinterpretation (no backdating without evidence) | Decision registry (M4a) |
| **INV-F2-O4** | Baseline Coverage (baseline_found signal) | Contract return field (M3) |
| **INV-F2-D3** | Opening balance immutability | Trigger (M3) |

---

## PRE-DEPLOYMENT VERIFICATION

### Static Verification (Completed)

✅ **M1:** 5,556 bytes — ALTER TABLE, backfill, verification, NOT NULL, index  
✅ **M2:** 6,831 bytes — CREATE OR REPLACE FUNCTION with v1.2 schema  
✅ **M3:** 13,281 bytes — CREATE TABLE, TRIGGER, FUNCTION, RLS, indexes  
✅ **M4a:** 13,554 bytes — CREATE TABLE, RLS, index, decision types  

✅ All migrations contain valid SQL structures (CREATE TABLE, FUNCTION, INDEX, TRIGGER)  
✅ All migrations have comments and verification checklists  
✅ No data seeding in M1–M4a (architectural boundary respected)  

---

## DEPLOYMENT VERIFICATION CHECKLIST

### Environment Requirements

- [ ] Supabase project accessible
- [ ] `supabase` CLI installed
- [ ] Database connection established
- [ ] Migrations folder: `supabase/migrations/`

### Deployment Steps

```bash
# Option 1: Reset database (development only)
supabase db reset

# Option 2: Apply migrations only (production)
supabase db push

# Option 3: Individual migration (troubleshooting)
psql $DATABASE_URL -f supabase/migrations/20260824000000_f2_cash_effective_date.sql
```

---

## POST-DEPLOYMENT VERIFICATION

### V1: Migration M1 — effective_date Column

```sql
-- V1.1: Verify column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'finance_cash_movements'
  AND column_name = 'effective_date';
-- Expected: 1 row, data_type = 'timestamp with time zone', is_nullable = 'NO'

-- V1.2: Verify no NULL values
SELECT COUNT(*) AS null_count
FROM public.finance_cash_movements
WHERE effective_date IS NULL;
-- Expected: 0

-- V1.3: Verify backfill lineage (effective_date = F1.posted_at)
SELECT 
    COUNT(*) AS total_movements,
    COUNT(CASE WHEN fcm.effective_date = ft.posted_at THEN 1 END) AS lineage_valid_count
FROM public.finance_cash_movements fcm
JOIN public.finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id;
-- Expected: total_movements = lineage_valid_count (all rows have valid lineage)

-- V1.4: Verify index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'finance_cash_movements'
  AND indexname = 'idx_finance_cash_movements_effective_date';
-- Expected: 1 row
```

### V2: Migration M2 — finance_get_cash_movements_as_of()

```sql
-- V2.1: Verify function exists
SELECT proname, pronargs
FROM pg_proc
WHERE proname = 'finance_get_cash_movements_as_of';
-- Expected: 1 row, pronargs = 3

-- V2.2: Verify function callable (no syntax errors)
SELECT * FROM finance_get_cash_movements_as_of(
    (SELECT id FROM tenants LIMIT 1),
    NOW(),
    'F2_CASH:v1'
) LIMIT 1;
-- Expected: Returns row (if movements exist) OR empty set (if no movements)
-- Should NOT raise syntax error or missing column error

-- V2.3: Verify return schema includes v1.2 fields
SELECT 
    column_name, 
    data_type
FROM information_schema.routine_columns
WHERE routine_name = 'finance_get_cash_movements_as_of'
ORDER BY ordinal_position;
-- Expected columns:
--   movement_id (uuid)
--   bank_account_id (uuid) ✅ v1.2
--   direction (character varying)
--   amount_minor (bigint)
--   currency (character)
--   cash_effective_date (timestamp with time zone)
--   valuation_rate (numeric)
--   f1_transaction_id (uuid) ✅ v1.2

-- V2.4: Verify temporal filtering uses effective_date (not recorded_at)
-- This requires inspecting function source or testing with known data
-- Test: Create movement with effective_date in past, query with as_of = yesterday
```

### V3: Migration M3 — Opening Balance Contract

```sql
-- V3.1: Verify table exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'finance_cash_opening_balances';
-- Expected: 1 row, table_type = 'BASE TABLE'

-- V3.2: Verify table is empty (no data seeded)
SELECT COUNT(*) AS row_count
FROM public.finance_cash_opening_balances;
-- Expected: 0

-- V3.3: Verify provenance columns exist
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'finance_cash_opening_balances'
  AND column_name IN ('source_type', 'notes', 'recorded_by');
-- Expected: 3 rows
--   source_type: is_nullable = 'NO' (INV-F2-O2)
--   notes: is_nullable = 'YES' (can be NULL)
--   recorded_by: is_nullable = 'YES' (can be NULL in some cases)

-- V3.4: Verify immutability trigger exists
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'finance_cash_opening_balances'
  AND trigger_name = 'trg_opening_balance_immutability';
-- Expected: 2 rows (UPDATE, DELETE)

-- V3.5: Test immutability (requires test data)
/*
-- Insert test opening balance
INSERT INTO public.finance_cash_opening_balances (
    tenant_id, bank_account_id, balance_minor, currency,
    effective_date, source_type, notes
) VALUES (
    (SELECT id FROM tenants LIMIT 1),
    (SELECT id FROM finance_bank_accounts LIMIT 1),
    100000000,
    'VND',
    NOW()::DATE,
    'MIGRATION_SEED',
    'Test opening balance'
) RETURNING id;

-- Try UPDATE (should fail)
UPDATE public.finance_cash_opening_balances
SET balance_minor = 200000000
WHERE id = '<test-id>';
-- Expected: ERROR: OPENING_BALANCE_IMMUTABLE

-- Try DELETE (should fail)
DELETE FROM public.finance_cash_opening_balances
WHERE id = '<test-id>';
-- Expected: ERROR: OPENING_BALANCE_IMMUTABLE

-- Cleanup: Need to disable trigger temporarily or truncate table
*/

-- V3.6: Verify contract function exists
SELECT proname, pronargs
FROM pg_proc
WHERE proname = 'finance_cash_opening_balance_as_of';
-- Expected: 1 row, pronargs = 4

-- V3.7: Verify function callable (baseline_found = FALSE when no baseline)
SELECT * FROM finance_cash_opening_balance_as_of(
    (SELECT id FROM tenants LIMIT 1),
    (SELECT id FROM finance_bank_accounts LIMIT 1),
    NOW(),
    'F2_OPENING:v1'
);
-- Expected: 1 row with:
--   opening_balance_minor = 0
--   baseline_found = FALSE (INV-F2-O4)

-- V3.8: Verify RLS enabled
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'finance_cash_opening_balances';
-- Expected: At least 1 row (tenant isolation policy)

-- V3.9: Verify unique constraint (one baseline per account per date)
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'finance_cash_opening_balances'
  AND constraint_name = 'uq_opening_balance_per_account_date';
-- Expected: 1 row, constraint_type = 'UNIQUE'
```

### V4: Migration M4a — Provenance Decision Registry

```sql
-- V4.1: Verify table exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'finance_cash_opening_balance_decisions';
-- Expected: 1 row, table_type = 'BASE TABLE'

-- V4.2: Verify table is empty (no decisions recorded yet)
SELECT COUNT(*) AS row_count
FROM public.finance_cash_opening_balance_decisions;
-- Expected: 0

-- V4.3: Verify decision_type constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name = 'chk_decision_type';
-- Expected: 1 row with CHECK clause containing valid decision types

-- V4.4: Test decision_type validation (should fail)
/*
INSERT INTO public.finance_cash_opening_balance_decisions (
    tenant_id, decided_by, decision_type, notes
) VALUES (
    (SELECT id FROM tenants LIMIT 1),
    gen_random_uuid(),
    'INVALID_TYPE',
    'Test'
);
-- Expected: ERROR: check constraint "chk_decision_type" violated
*/

-- V4.5: Verify scope constraint exists
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name = 'chk_decision_scope';
-- Expected: 1 row

-- V4.6: Verify RLS enabled
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'finance_cash_opening_balance_decisions';
-- Expected: At least 1 row (tenant isolation policy)
```

---

## INTEGRATION VERIFICATION

### Contract Interaction Test (After Baseline Seeding)

```sql
-- This test requires opening balance data (will be available after M4b)

-- Setup: Assume opening balance exists with effective_date = '2026-08-01'
-- and cash movements exist after that date

-- Test: Verify F5.6 reconstruction formula components

-- 1. Get opening balance
SELECT 
    opening_balance_minor,
    baseline_effective_date,
    baseline_found
FROM finance_cash_opening_balance_as_of(
    '<tenant-id>',
    '<bank-account-id>',
    '2026-08-23'::TIMESTAMPTZ,
    'F2_OPENING:v1'
);
-- Expected: baseline_found = TRUE, baseline_effective_date = '2026-08-01'

-- 2. Get movements AFTER baseline (exclusive boundary)
SELECT 
    movement_id,
    direction,
    amount_minor,
    cash_effective_date
FROM finance_get_cash_movements_as_of(
    '<tenant-id>',
    '2026-08-23'::TIMESTAMPTZ,
    'F2_CASH:v1'
)
WHERE bank_account_id = '<bank-account-id>'
  AND cash_effective_date > '2026-08-01'::TIMESTAMPTZ  -- Exclusive boundary
ORDER BY cash_effective_date ASC;
-- Expected: Only movements after 2026-08-01 (not including 2026-08-01 itself)

-- 3. Verify no double-counting with baseline replacement
-- (Requires multiple opening balances for same account at different dates)
```

---

## SUCCESS CRITERIA

### Schema Verification ✅

- [ ] finance_cash_movements.effective_date column exists (NOT NULL)
- [ ] finance_cash_opening_balances table exists
- [ ] finance_cash_opening_balance_decisions table exists
- [ ] All indexes created
- [ ] All triggers created
- [ ] All RLS policies active

### Contract Verification ✅

- [ ] finance_get_cash_movements_as_of() callable with v1.2 schema
- [ ] finance_cash_opening_balance_as_of() callable with baseline_found signal
- [ ] Both functions have SECURITY DEFINER
- [ ] Both functions validate contract_version

### Invariant Verification ✅

- [ ] INV-F2-T1: effective_date backfilled correctly (all rows have valid F1 lineage)
- [ ] INV-F2-T3: Temporal determinism (contract queries effective_date, not recorded_at)
- [ ] INV-F2-O2: Provenance fields exist (source_type NOT NULL)
- [ ] INV-F2-O4: baseline_found signal returns FALSE when no baseline
- [ ] INV-F2-D3: Immutability trigger blocks UPDATE/DELETE

### Boundary Verification ✅

- [ ] No data seeded in M1–M4a (verified: all tables empty or column added only)
- [ ] F5.6 logic NOT implemented (M4b and F5.6 migrations do not exist)
- [ ] Worker NOT updated (CashProjectionWorker still missing p_effective_date parameter)

---

## BLOCKED ITEMS (Awaiting Approval)

### 🔴 Migration 4b: Opening Balance Data Seeding

**Blocker:** Baseline provenance decision required

**Decision Options:**
- **Option A:** ZERO_BASELINE (greenfield accounts)
- **Option B:** VERIFIED_HISTORICAL (evidence-based)
- **Option C:** CURRENT_POSITION_BASELINE (recommended for Bella)

**Next Step:** Human architect must record decision in `finance_cash_opening_balance_decisions`

---

### 🔴 F5.6 Cash Reconciliation Implementation

**Blocker:** F2 contracts must be verified operational with baseline data

**Prerequisites:**
- Migration 4b complete (opening balances seeded)
- Contract smoke tests pass
- Worker updated (CashProjectionWorker + RPC)

**Not Started:**
- `f5_reconstruct_cash_position()` function
- `f5_run_reconciliation()` CASH_GL_BALANCE branch
- F5.6 integration tests (G1–G8)

---

## DEPLOYMENT RECOMMENDATION

### Safe Deployment Path

```
1. Deploy M1–M4a to staging ✅ READY
   ↓
2. Run verification queries (this document)
   ↓
3. Verify no errors, all success criteria met
   ↓
4. Deploy M1–M4a to production ✅ READY
   ↓
5. STOP — Do NOT deploy M4b yet
   ↓
6. Human architect makes baseline provenance decision
   ↓
7. Record decision in finance_cash_opening_balance_decisions
   ↓
8. Create Migration 4b based on decision
   ↓
9. Deploy M4b + verify
   ↓
10. Update Worker (CashProjectionWorker + RPC)
   ↓
11. Verify F2 contracts operational with real data
   ↓
12. Implement F5.6
   ↓
13. Run AP/AR regression (16/16 tests must stay GREEN)
   ↓
14. F5.6 COMPLETE
```

---

## EXECUTION LOG

| Date | Action | Status | Notes |
|------|--------|--------|-------|
| 2026-08-24 | M1–M4a created | ✅ Complete | 4 migration files, 39,222 bytes total |
| 2026-08-24 | Static verification | ✅ Pass | All migrations contain expected SQL structures |
| TBD | Deploy to staging | ⏸️ Pending | Awaiting database environment |
| TBD | Run verification queries | ⏸️ Pending | After deployment |
| TBD | Baseline provenance decision | ⏸️ Pending | Human architect decision required |

---

## ARCHITECTURAL GATE STATUS

| Gate | Status | Owner |
|------|--------|-------|
| F2 Contract Design v1.2 | 🟢 LOCKED | Architecture |
| M1–M4a Implementation | 🟢 COMPLETE | AI Agent |
| M1–M4a Verification | 🟡 PENDING | DevOps / DBA |
| Baseline Provenance Decision | 🔴 BLOCKED | Human Architect |
| M4b Implementation | 🔴 BLOCKED | AI Agent (awaits decision) |
| F5.6 Implementation | 🔴 BLOCKED | AI Agent (awaits F2 verified) |

---

**STATUS SUMMARY:** 4/4 approved migrations created. Awaiting deployment and verification before proceeding to M4b.
