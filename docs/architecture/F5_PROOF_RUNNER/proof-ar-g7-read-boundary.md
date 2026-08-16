# Proof AR-G7 — Read Boundary Gate (AR_GL_BALANCE)

> **Gate:** F5-G7 — F5 reads only from approved public contracts (F3 AR facts, F1 GL journal). No direct table reads.
> **Domain:** AR_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.5 AR implementation

---

## Scenario

Verify that AR_GL_BALANCE reconciliation:
1. Reads AR facts via `finance_ar_facts_as_of()` (F3 public contract)
2. Reconstructs position via `f5_reconstruct_ar_position()` (uses F3 contract internally)
3. Reads GL journal via `finance_journal_entries_as_of()` (F1 public contract)
4. Does NOT directly query `finance_invoices`, `finance_receivable_ledger`, `finance_transactions`, or `finance_transaction_lines`

## Verification Query — Static Analysis

```sql
-- Inspect f5_run_reconciliation source code
SELECT prosrc FROM pg_proc WHERE proname = 'f5_run_reconciliation';

-- Expected patterns in AR branch:
-- ✓ FOR v_ar_fact IN SELECT * FROM public.finance_ar_facts_as_of(...)
-- ✓ SELECT * FROM public.f5_reconstruct_ar_position(...)
-- ✓ SELECT ... FROM public.finance_journal_entries_as_of(...)
-- ✗ FROM finance_invoices
-- ✗ FROM finance_receivable_ledger
-- ✗ FROM finance_transactions
-- ✗ FROM finance_transaction_lines (except via journal contract)
```

## Expected Result

```
uses_finance_ar_facts_as_of         = true
uses_f5_reconstruct_ar_position     = true
uses_finance_journal_entries_as_of  = true
direct_finance_invoices_read        = false
direct_finance_receivable_ledger    = false
direct_finance_transactions_read    = false
```

## Actual Result (F5.5 AR Verification)

```sql
-- AR branch structure (migration 20260823010000):
FOR v_ar_fact IN
    SELECT * FROM public.finance_ar_facts_as_of(
        p_tenant_id, p_reconciliation_as_of, 'F3_AR:v1'
    )
LOOP
    -- Reconstruct AR position
    SELECT * INTO v_ar_position
    FROM public.f5_reconstruct_ar_position(
        p_tenant_id, v_ar_fact.invoice_id, p_reconciliation_as_of, 'F3_AR:v1'
    );

    -- Read GL journal via F1 contract
    SELECT COALESCE(SUM(debit_amount) - SUM(credit_amount), 0) INTO v_gl_sum_ar
    FROM public.finance_journal_entries_as_of(
        p_tenant_id, p_reconciliation_as_of, 'F1_GL:v1'
    )
    WHERE account_code = '131'
      AND source_id::TEXT = v_ar_fact.invoice_id::TEXT;
END LOOP;
```

## Test Evidence

**Test:** Test 5.7 — "verifies finance_ar_facts_as_of contract obeys temporal boundary"
- File: `src/__tests__/f5-ar-reconciliation.integration.test.ts`
- Verification: Seeds invoice at T1, reconciles as_of T0 → invoice not visible (proves contract usage)

**Static Verification:**
- Migration file `20260823010000_f5_ar_reconciliation_fix.sql` contains zero direct table reads
- All AR data accessed via F3 public contract
- All GL data accessed via F1 public contract

## AR Read Contract Dependencies

| Contract | Version | Purpose | Owner |
|----------|---------|---------|-------|
| `finance_ar_facts_as_of` | F3_AR:v1 | List all invoices with outstanding balances as of timestamp | F3 |
| `f5_reconstruct_ar_position` | F3_AR:v1 | Reconstruct single invoice position from AR ledger | F5 |
| `finance_journal_entries_as_of` | F1_GL:v1 | Read GL journal entries as of timestamp | F1 |

## Conclusion

**PASS** — AR_GL_BALANCE reconciliation reads exclusively from approved public contracts.
No direct table reads. All AR data via F3 contracts. All GL data via F1 contract.
Read boundary respected.

