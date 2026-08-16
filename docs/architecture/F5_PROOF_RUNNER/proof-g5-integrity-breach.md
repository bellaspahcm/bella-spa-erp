# Proof G5 — Integrity Breach Gate (AP_GL_BALANCE)

> **Gate:** F5-G5 — Orphan records (GL with no subledger fact, or vice versa) → QUARANTINED. Immutability of result evidence.
> **Domain:** AP_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.1–F5.3 (VARIANCE + immutability verified) + F5.4 tests 4.2, 4.3, 4.5, 4.6

---

## Scenario A — Orphan GL Entry (F5-I-6)

A GL journal exists for a `source_id` that has no corresponding `finance_payable_ledger` fact.
`f5_check_ap_traceability` must classify this as `ORPHAN_GL`.

## Scenario B — Immutability Guard

Any UPDATE or DELETE on `f5_control_results` that touches core fields must be rejected
by the `trg_f5_control_results_mutation_guard` trigger with error `F5_RESULT_IMMUTABLE`.

## Scenario C — Resolved Case ≠ MATCHED (§4.13)

Resolving a control case does not change `financial_result` on the linked result row.
A re-run without correcting source data must still classify as VARIANCE.

---

## Verification Queries

### A — Orphan GL Detection

```sql
-- Seed a GL transaction for 'orphan_source_id' with NO finance_payable_ledger entry
-- Then call traceability check:
SELECT check_direction, source_id, trace_status
FROM f5_check_ap_traceability('<tenant_id>', '2026-08-15T00:00:00Z')
WHERE trace_status = 'ORPHAN_GL';

-- Expected: at least one row with source_id = orphan_source_id, trace_status = 'ORPHAN_GL'
```

### B — Immutability: UPDATE blocked

```sql
-- After inserting a result row:
UPDATE f5_control_results
SET financial_result = 'VARIANCE'
WHERE result_id = '<result_id>';
-- Expected: ERROR F5_RESULT_IMMUTABLE
```

### B — Immutability: DELETE blocked

```sql
DELETE FROM f5_control_results WHERE result_id = '<result_id>';
-- Expected: ERROR F5_RESULT_IMMUTABLE
```

### C — Case resolution does not alter evidence

```sql
-- After resolving case, check original result row:
SELECT financial_result FROM f5_control_results WHERE result_id = '<variance_result_id>';
-- Expected: 'VARIANCE' (unchanged — RESOLVED ≠ MATCHED)

-- Re-run reconciliation without fixing source:
SELECT variances FROM f5_run_reconciliation(
    p_tenant_id => '<tenant_id>', p_domain => 'AP',
    p_control_type => 'AP_GL_BALANCE',
    p_basis_id => gen_random_uuid(),
    p_basis_version => 'AP_GL_BALANCE:v1',
    p_reconciliation_as_of => '<same_as_of>'
);
-- Expected: variances >= 1 (source data unchanged, still VARIANCE)
```

## Expected Result

```
orphan_gl_detected              = true     (ORPHAN_GL row present for orphan_source_id)
update_blocked_error            = F5_RESULT_IMMUTABLE
delete_blocked_error            = F5_RESULT_IMMUTABLE
original_row_unchanged_after_update = true
original_row_present_after_delete   = true
result_financial_result_after_resolve = 'VARIANCE'  (not 'MATCHED')
rerun_without_fix_variances         >= 1
f1_f4_not_mutated               = true    (glCountBefore == glCountAfter, factCountBefore == factCountAfter)
```

## Actual Result (F5.1–F5.3 + F5.4 Tests 4.2, 4.3, 4.5, 4.6)

```
immutability_update_blocked = true  ✅ (test "proves f5_control_results obeys immutability guard")
immutability_delete_blocked = true  ✅ (test 4.3)
update_error_contains_F5_RESULT_IMMUTABLE = true ✅
delete_error_contains_F5_RESULT_IMMUTABLE = true ✅
orphan_gl_detected via f5_check_ap_traceability = true ✅ (test 4.5)
f1_f4_not_mutated = true ✅ (test 4.5 verifies glCount and factCount unchanged)
case_resolved_result_still_VARIANCE = true ✅ (test 4.6)
rerun_without_fix_still_VARIANCE = true ✅ (test 4.6)
```

## Conclusion

**PASS** — All three integrity breach scenarios hold:
- Orphan GL entries are detected via bidirectional traceability.
- `f5_control_results` is truly immutable: UPDATE and DELETE are blocked by trigger.
- Case resolution (RESOLVED) does not alter financial evidence. Only corrected source data
  can produce a subsequent MATCHED classification.
