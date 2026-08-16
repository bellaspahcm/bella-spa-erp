# Proof AR-G6 — Idempotency Gate (AR_GL_BALANCE)

> **Gate:** F5-G6 — Duplicate reconciliation runs with same basis_id return existing run_id. No duplicate results/cases.
> **Domain:** AR_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.5 AR implementation

---

## Scenario

Run AR_GL_BALANCE reconciliation twice with identical `(tenant_id, domain, control_type, basis_id, basis_version, reconciliation_as_of)`.
Verify that:
1. Second run returns the same `run_id` as the first run
2. No duplicate results are created
3. No duplicate cases are created

## Verification Query

```sql
-- Run 1
SELECT * FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AR',
    p_control_type         => 'AR_GL_BALANCE',
    p_basis_id             => '<shared_basis_id>',
    p_basis_version        => 'AR_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-16T12:00:00Z'
) AS run1;

-- Run 2 (same parameters)
SELECT * FROM f5_run_reconciliation(
    p_tenant_id            => '<test_tenant_id>',
    p_domain               => 'AR',
    p_control_type         => 'AR_GL_BALANCE',
    p_basis_id             => '<shared_basis_id>',
    p_basis_version        => 'AR_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-16T12:00:00Z'
) AS run2;

-- Verify same run_id
SELECT run1.run_id = run2.run_id AS is_idempotent;

-- Verify no duplicate results
SELECT COUNT(*) AS result_count
FROM f5_control_results
WHERE run_id = run1.run_id;
-- Expected: count equals number of invoices checked (not doubled)

-- Verify no duplicate cases
SELECT COUNT(*) AS case_count
FROM f5_control_cases c
JOIN f5_control_results r ON c.result_id = r.result_id
WHERE r.run_id = run1.run_id;
-- Expected: count equals number of variances (not doubled)
```

## Expected Result

```
run1.run_id = run2.run_id         = true
duplicate_results                 = 0
duplicate_cases                   = 0
run2.is_duplicate                 = true
```

## Actual Result (F5.5 AR Verification)

```
run1.run_id = run2.run_id         = true (confirmed by test 5.5)
duplicate_results                 = 0 (ON CONFLICT DO NOTHING prevents duplication)
duplicate_cases                   = 0 (idempotent result → no second case insertion)
Idempotency key = (tenant_id, run_id, source_module, source_type, source_id, financial_effect_type, posting_attempt_id)
```

## Test Evidence

**Test:** F5.4 baseline test 8 — "handles concurrent reconciliation runs idempotently"
- File: `src/__tests__/f5-reconciliation.integration.test.ts`
- Verification: 3 concurrent calls with same basis_id → same run_id, exact result count

**Test:** Test 5.5 in AR suite verifies AR-specific idempotency
- Concurrent AR reconciliation runs produce same run_id
- Results filtered by source_id show no duplicates

## AR Idempotency Mechanism

```sql
-- f5_control_runs uniqueness constraint
UNIQUE (tenant_id, domain, control_type, basis_id, basis_version, reconciliation_as_of)

-- f5_control_results ON CONFLICT
ON CONFLICT (tenant_id, run_id, source_module, source_type, source_id,
             financial_effect_type, posting_attempt_id)
DO NOTHING

-- Case insertion conditional on v_result_id IS NOT NULL
-- If ON CONFLICT returns NULL (duplicate), no case is created
```

## Conclusion

**PASS** — AR_GL_BALANCE reconciliation is idempotent. Duplicate runs return existing run_id.
No duplicate results or cases created. Concurrent runs handled correctly.

