# Proof G2 — Determinism Gate (AP_GL_BALANCE)

> **Gate:** F5-G2 — Same input snapshot → same classification. No non-deterministic side effects.
> **Domain:** AP_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.1–F5.3 (verified) + F5.4 test 4.1 (concurrent determinism)

---

## Scenario

Given identical input parameters (same `tenant_id`, `basis_id`, `basis_version`,
`reconciliation_as_of`), running `f5_run_reconciliation` multiple times must:
1. Return the same `run_id` every time (idempotency is determinism at the run level).
2. Produce the same `financial_result` classification on first run.
3. Produce no new rows on subsequent runs with the same identity.

## Verification Query

```sql
-- Run the same reconciliation twice
SELECT run_id, matched, variances, quarantined
FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AP',
    p_control_type         => 'AP_GL_BALANCE',
    p_basis_id             => '<fixed_basis_id>',
    p_basis_version        => 'AP_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-15T00:00:00Z'
);
-- Run again with identical parameters
SELECT run_id, matched, variances, quarantined
FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AP',
    p_control_type         => 'AP_GL_BALANCE',
    p_basis_id             => '<fixed_basis_id>',
    p_basis_version        => 'AP_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-15T00:00:00Z'
);

-- Verify run_id is identical, is_duplicate = true on second call
-- Verify row count in f5_control_results is unchanged after second call
SELECT COUNT(*) FROM f5_control_results
WHERE tenant_id = '<test_tenant_id>'
  AND basis_id  = '<fixed_basis_id>';
```

## Determinism of Classification Logic

The classification formula is purely arithmetic and referentially transparent:

```
variance_amount = gl_sum - reconstructed_outstanding

MATCHED     ← ABS(variance_amount) = 0
VARIANCE    ← ABS(variance_amount) > 0
QUARANTINED ← reconstructed_outstanding IS NULL
```

No random functions, no timestamps used in classification (only in `detected_at` metadata),
no external state reads. Same inputs → same output unconditionally.

## Expected Result

```
run1.run_id         == run2.run_id          (same deterministic hash)
run1.matched        == run2.matched
run1.variances      == run2.variances
run2.is_duplicate   = true
delta_rows_after_run2 = 0
```

## Actual Result (F5.1–F5.3 + F5.4 test 4.1)

```
concurrent_run_ids_unique = 1  (all 3 Promise.all calls returned same run_id)
result_rows_after_3_runs  = 1  (no duplicates)
classification_stable     = true
```

## Conclusion

**PASS** — Classification is deterministic. Same run identity always returns same `run_id`
and same counts. Zero non-deterministic side effects.
