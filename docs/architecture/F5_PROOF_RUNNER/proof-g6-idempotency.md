# Proof G6 — Idempotency Gate (AP_GL_BALANCE)

> **Gate:** F5-G6 — Re-running same run identity returns existing `run_id`; `f5_control_results` count unchanged.
> **Domain:** AP_GL_BALANCE
> **Status:** ✅ PASS
> **Phase:** F5.1–F5.3 (sequential idempotency) + F5.4 test 4.1 (concurrent idempotency)

---

## Scenario

The run identity hash is computed as:

```
source_snapshot_hash = SHA-256(
    tenant_id || '|' || control_type || '|' ||
    basis_id  || '|' || basis_version || '|' ||
    reconciliation_as_of
)
```

Any call with the same five inputs produces the same `source_snapshot_hash`.
The engine checks for an existing row with this hash before executing the reconciliation loop.
If found, it returns the existing `run_id` and counts immediately — no new rows written.

## Sequential Idempotency

```sql
-- Call 1: first run
SELECT run_id, is_duplicate, matched
FROM f5_run_reconciliation(
    p_tenant_id            => '<tenant_id>',
    p_domain               => 'AP',
    p_control_type         => 'AP_GL_BALANCE',
    p_basis_id             => '<fixed_basis_id>',
    p_basis_version        => 'AP_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-15T00:00:00Z'
);
-- is_duplicate = false, run_id = <UUID_A>

-- Call 2: same parameters
SELECT run_id, is_duplicate
FROM f5_run_reconciliation(
    p_tenant_id            => '<tenant_id>',
    p_domain               => 'AP',
    p_control_type         => 'AP_GL_BALANCE',
    p_basis_id             => '<fixed_basis_id>',
    p_basis_version        => 'AP_GL_BALANCE:v1',
    p_reconciliation_as_of => '2026-08-15T00:00:00Z'
);
-- is_duplicate = true, run_id = <UUID_A>  (same as Call 1)

-- Row count unchanged
SELECT COUNT(*) FROM f5_control_results
WHERE tenant_id = '<tenant_id>' AND basis_id = '<fixed_basis_id>';
-- Same count as after Call 1
```

## Concurrent Idempotency (F5.4 Test 4.1)

Three `f5_run_reconciliation` calls fired simultaneously via `Promise.all`:

```typescript
const [r1, r2, r3] = await Promise.all([
    supabase.rpc('f5_run_reconciliation', params),
    supabase.rpc('f5_run_reconciliation', params),
    supabase.rpc('f5_run_reconciliation', params),
]);

// All must return same run_id
expect(new Set([r1.data.run_id, r2.data.run_id, r3.data.run_id]).size).toBe(1);

// Exactly 1 result row
const { data: rows } = await supabase
    .from('f5_control_results')
    .select('result_id')
    .eq('run_id', r1.data.run_id);
expect(rows).toHaveLength(1);
```

## Expected Result

```
call_1.is_duplicate       = false
call_2.is_duplicate       = true
call_1.run_id             == call_2.run_id
delta_rows_after_call_2   = 0
concurrent_run_ids_unique = 1  (all three concurrent calls return same run_id)
concurrent_result_rows    = 1  (no duplicate inserts)
```

## Actual Result (F5.1–F5.3 + F5.4 Test 4.1)

```
sequential_idempotency = true   ✅ (integration test: "handles concurrent reconciliation runs idempotently")
concurrent_idempotency = true   ✅ (test 4.1: Promise.all 3 calls → same run_id, 1 result row)
delta_rows_concurrent  = 0      ✅
```

## Conclusion

**PASS** — Run identity is fully idempotent under both sequential and concurrent conditions.
The `ON CONFLICT DO NOTHING` + pre-check pattern prevents any duplicate rows under
all tested concurrency levels.
