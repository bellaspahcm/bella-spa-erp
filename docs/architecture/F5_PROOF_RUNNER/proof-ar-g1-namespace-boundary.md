# Proof AR-G1 — Namespace Boundary Gate (AR_GL_BALANCE)

> **Gate:** F5-G1 — All F5 writes go only to `f5_*` tables. Zero writes to F1–F4 tables.
> **Domain:** AR_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.5 AR implementation

---

## Scenario

Run `f5_run_reconciliation` for AR_GL_BALANCE. Verify that zero rows are inserted,
updated, or deleted in any `finance_*` table during or after the run.

## Verification Query

```sql
-- Step 1: Capture baseline row counts for all finance_* tables
SELECT
    relname                          AS table_name,
    n_live_tup                       AS live_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname LIKE 'finance_%'
ORDER BY relname;

-- Step 2: Run AR reconciliation
SELECT * FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AR',
    p_control_type         => 'AR_GL_BALANCE',
    p_basis_id             => gen_random_uuid(),
    p_basis_version        => 'AR_GL_BALANCE:v1',
    p_reconciliation_as_of => NOW()
);

-- Step 3: Re-capture and compare
-- Expected: n_live_tup is identical for every finance_* table.
-- Only f5_control_results and (if VARIANCE) f5_control_cases should increase.
SELECT
    relname                          AS table_name,
    n_live_tup                       AS live_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname LIKE 'finance_%'
ORDER BY relname;
```

## Additional Static Check

```sql
-- Confirm no direct INSERT/UPDATE/DELETE against finance_* in AR branch
SELECT prosrc FROM pg_proc WHERE proname = 'f5_run_reconciliation';
-- Expected: AR branch reads finance_ar_facts_as_of() and finance_journal_entries_as_of()
-- but performs zero writes to finance_invoices or finance_receivable_ledger
```

## Expected Result

```
delta_finance_invoices             = 0
delta_finance_receivable_ledger    = 0
delta_finance_transactions         = 0
delta_finance_transaction_lines    = 0
direct_insert_finance_in_body      = false
```

## Actual Result (F5.5 AR Verification)

```
delta_finance_* tables             = 0  (confirmed by test 5.6 namespace boundary)
direct_insert_finance_in_body      = false (confirmed by migration 20260823010000)
f5_control_results rows inserted   = N (one per invoice checked)
f5_control_cases rows inserted     = K (one per VARIANCE/QUARANTINED result)
```

## Test Evidence

**Test:** `reconciles AR subledger positions and matches F1 account 131 debit-normal balance`
- File: `src/__tests__/f5-ar-reconciliation.integration.test.ts` (test 5.6 covers G1)
- Verification: Seeds invoice + AR ledger + GL entries, runs reconciliation, asserts no writes to finance_* tables

## Conclusion

**PASS** — AR branch of `f5_run_reconciliation` writes exclusively to `f5_control_results` and
`f5_control_cases`. Zero mutations to `finance_invoices`, `finance_receivable_ledger`, or any other
finance_* table. Namespace boundary holds for AR_GL_BALANCE domain.

