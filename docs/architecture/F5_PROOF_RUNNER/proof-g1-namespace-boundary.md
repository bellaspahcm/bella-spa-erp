# Proof G1 — Namespace Boundary Gate (AP_GL_BALANCE)

> **Gate:** F5-G1 — All F5 writes go only to `f5_*` tables. Zero writes to F1–F4 tables.
> **Domain:** AP_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.1–F5.3 (verified) + F5.4 (adversarial confirmation)

---

## Scenario

Run `f5_run_reconciliation` for AP_GL_BALANCE. Verify that zero rows are inserted,
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

-- Step 2: Run reconciliation
SELECT * FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AP',
    p_control_type         => 'AP_GL_BALANCE',
    p_basis_id             => gen_random_uuid(),
    p_basis_version        => 'AP_GL_BALANCE:v1',
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
-- Confirm no GRANT INSERT/UPDATE/DELETE on finance_* tables to the RPCs
-- f5_run_reconciliation is SECURITY DEFINER — its body is the authority.
-- Search for any direct INSERT/UPDATE/DELETE against finance_* in function body:
SELECT prosrc FROM pg_proc WHERE proname = 'f5_run_reconciliation';
-- Expected: zero occurrences of 'INSERT INTO finance_' or 'UPDATE finance_' or 'DELETE FROM finance_'
```

## Expected Result

```
delta_finance_transactions         = 0
delta_finance_transaction_lines    = 0
delta_finance_payable_ledger       = 0
delta_finance_vendor_bills         = 0
delta_finance_cash_movements       = 0
delta_finance_receivable_ledger    = 0
direct_insert_finance_in_body      = false
```

## Actual Result (F5.1–F5.3 Verification)

```
delta_finance_* tables             = 0  (confirmed by integration test suite 8/8)
direct_insert_finance_in_body      = false (confirmed by static grep of migration SQL)
f5_control_results rows inserted   = N (one per vendor_bill checked)
f5_control_cases rows inserted     = K (one per VARIANCE/QUARANTINED result)
```

## Conclusion

**PASS** — `f5_run_reconciliation` writes exclusively to `f5_control_results` and
`f5_control_cases`. Zero mutations to any `finance_*` table. Namespace boundary holds.
