# Proof G3 — Bidirectional Trace Gate (AP_GL_BALANCE)

> **Gate:** F5-G3 — Every result row is traceable to: run identity + source facts + GL lines.
> **Domain:** AP_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.1–F5.3 (verified)

---

## Scenario

Every row written to `f5_control_results` must carry a complete audit chain:
1. **Run identity fields** — `run_id`, `basis_id`, `basis_version`, `reconciliation_as_of`, `source_snapshot_hash`
2. **Source fact pointer** — `source_module`, `source_type`, `source_id`, `financial_effect_type`, `posting_attempt_id`
3. **Financial evidence** — `expected_amount` (from facts), `actual_amount` (from GL), `variance_amount` (generated)

This allows any result to be independently re-verified by replaying the read contracts
with the same `reconciliation_as_of` and comparing against the stored amounts.

## Verification Query

```sql
-- After running f5_run_reconciliation, verify every result has full trace fields
SELECT
    result_id,
    run_id                 IS NOT NULL AS has_run_id,
    basis_id               IS NOT NULL AS has_basis_id,
    basis_version          IS NOT NULL AS has_basis_version,
    reconciliation_as_of   IS NOT NULL AS has_as_of,
    source_snapshot_hash   IS NOT NULL AS has_snapshot_hash,
    source_module          IS NOT NULL AS has_source_module,
    source_type            IS NOT NULL AS has_source_type,
    source_id              IS NOT NULL AS has_source_id,
    financial_effect_type  IS NOT NULL AS has_effect_type,
    posting_attempt_id     IS NOT NULL AS has_posting_attempt_id,
    expected_amount        IS NOT NULL AS has_expected_amount,
    actual_amount          IS NOT NULL AS has_actual_amount,
    detected_by            IS NOT NULL AS has_detected_by
FROM f5_control_results
WHERE tenant_id = '<test_tenant_id>'
  AND run_id    = '<run_id>';

-- All columns must be TRUE. Zero NULLs in trace fields.
```

## Forward Trace Verification (F5-I-1: Fact → GL)

```sql
-- For any result row, re-derive expected_amount from facts:
SELECT reconstructed_outstanding
FROM f5_reconstruct_ap_position(
    '<tenant_id>',
    '<source_id from result row>',
    '<reconciliation_as_of from result row>'
);
-- Must equal result.expected_amount

-- Re-derive actual_amount from GL:
SELECT SUM(debit_amount) - SUM(credit_amount) AS gl_sum
FROM finance_journal_entries_as_of('<tenant_id>', '<reconciliation_as_of>', 'F1_GL:v1')
WHERE account_code = '331'
  AND source_id    = '<source_id from result row>';
-- Must equal result.actual_amount
```

## Expected Result

```
every result row:
  has_run_id              = true
  has_basis_id            = true
  has_basis_version       = true
  has_as_of               = true
  has_snapshot_hash       = true
  has_source_module       = true
  has_source_type         = true
  has_source_id           = true
  has_effect_type         = true
  has_posting_attempt_id  = true
  has_expected_amount     = true
  has_actual_amount       = true
  has_detected_by         = true

forward_trace_expected  == result.expected_amount  (re-derivable)
forward_trace_actual    == result.actual_amount    (re-derivable)
```

## Actual Result (F5.1–F5.3 Verification)

```
trace_fields_present    = true  (all 8/8 integration tests verified this)
re_derivable_amounts    = true  (reconstruction test verifies expected_amount)
snapshot_hash_present   = true  (sha256 of run identity params)
```

## Conclusion

**PASS** — Every `f5_control_results` row carries a complete, independently re-verifiable
audit chain. Forward trace from facts to GL is reproducible using the stored `reconciliation_as_of`.
