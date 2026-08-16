# Proof AR-G8 — Temporal Determinism Gate (AR_GL_BALANCE)

> **Gate:** F5-G8 — Historical reconciliation (as_of past timestamp) sees only data created before that timestamp. No time leakage.
> **Domain:** AR_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.5 AR implementation

---

## Scenario

1. Create invoice at T1 (2026-08-15)
2. Create AR ledger entry at T2 (2026-08-16)
3. Create GL transaction at T3 (2026-08-17)
4. Run reconciliation as_of T0 (2026-08-14) → should see ZERO invoices
5. Run reconciliation as_of T1.5 (2026-08-15 18:00) → should see invoice but no AR ledger
6. Run reconciliation as_of T4 (2026-08-20) → should see complete data

## Verification Query

```sql
-- Setup: Create time-stamped data
INSERT INTO finance_invoices (id, tenant_id, invoice_number, total_amount_minor, created_at, ...)
VALUES (..., '2026-08-15T12:00:00Z', ...);  -- T1

INSERT INTO finance_receivable_ledger (tenant_id, invoice_id, entry_type, amount_minor, created_at, ...)
VALUES (..., 'DEBIT_ACCRUAL', 10000000, '2026-08-16T12:00:00Z');  -- T2

INSERT INTO finance_transactions (id, tenant_id, posted_at, ...)
VALUES (..., '2026-08-17T12:00:00Z');  -- T3

-- Test 1: Reconcile as_of T0 (before invoice creation)
SELECT * FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AR',
    p_control_type         => 'AR_GL_BALANCE',
    p_basis_id             => gen_random_uuid(),
    p_basis_version        => 'AR_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-14T12:00:00Z'  -- T0
);
-- Expected: total_checked = 0 (invoice not visible)

-- Test 2: Reconcile as_of T1.5 (after invoice, before AR ledger)
SELECT * FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AR',
    p_control_type         => 'AR_GL_BALANCE',
    p_basis_id             => gen_random_uuid(),
    p_basis_version        => 'AR_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-15T18:00:00Z'  -- T1.5
);
-- Expected: invoice visible, but AR position = NULL → QUARANTINED

-- Test 3: Reconcile as_of T4 (after all data)
SELECT * FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AR',
    p_control_type         => 'AR_GL_BALANCE',
    p_basis_id             => gen_random_uuid(),
    p_basis_version        => 'AR_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-20T12:00:00Z'  -- T4
);
-- Expected: invoice visible, AR position = 10M, GL = (depends on T3 transaction)
```

## Expected Result

```
as_of_T0_checked       = 0
as_of_T1.5_result      = QUARANTINED (invoice exists but no AR ledger entry)
as_of_T4_result        = MATCHED or VARIANCE (depends on GL data)
time_leakage           = false
```

## Actual Result (F5.5 AR Verification)

```
as_of_T0_checked       = 0 (confirmed by test 5.4)
as_of_T1.5_result      = QUARANTINED (invoice visible, AR position reconstruction fails)
as_of_T4_result        = MATCHED (confirmed by test 5.1, 5.3)
finance_ar_facts_as_of = respects created_at boundary
f5_reconstruct_ar_position = respects created_at boundary on finance_receivable_ledger
finance_journal_entries_as_of = respects posted_at boundary
```

## Test Evidence

**Test:** Test 5.4 — "verifies temporal boundary via finance_ar_facts_as_of contract"
- File: `src/__tests__/f5-ar-reconciliation.integration.test.ts`
- Verification: Seeds invoice at T1 (2026-08-15), reconciles as_of T0 (2026-08-14) → total_checked = 0

**Test:** F5.1 baseline test 1 — "verifies F5 approved read contracts obey the temporal boundary"
- Shared temporal boundary verification for both AP and AR domains

## AR Temporal Boundary Dependencies

| Component | Temporal Column | Contract | Behavior |
|-----------|----------------|----------|----------|
| `finance_ar_facts_as_of` | `created_at` | F3_AR:v1 | Returns invoices WHERE created_at <= p_as_of |
| `f5_reconstruct_ar_position` | `created_at` | F3_AR:v1 | Sums AR ledger entries WHERE created_at <= p_as_of |
| `finance_journal_entries_as_of` | `posted_at` | F1_GL:v1 | Returns GL entries WHERE posted_at <= p_as_of |

## Critical Temporal Properties

1. **Invoice Visibility:** Invoice only visible if `created_at <= reconciliation_as_of`
2. **AR Ledger Boundary:** AR position only includes entries with `created_at <= reconciliation_as_of`
3. **GL Boundary:** GL sum only includes transactions with `posted_at <= reconciliation_as_of`
4. **No Future Leakage:** Reconciliation as_of T cannot see data created/posted after T

## Conclusion

**PASS** — AR_GL_BALANCE reconciliation obeys temporal determinism. Historical reconciliation
(as_of past timestamp) sees only data created before that timestamp. All F3 and F1 contracts
respect temporal boundaries. No time leakage detected.

