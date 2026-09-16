# H8 Migration Verification

Status: RUNTIME VERIFIED ON CONTROLLED BASELINE / GLOBAL CLEAN BUILD BLOCKED
Migration: `20260916000000_beauty_os_h8_persistence.sql`
Baseline: H8 `3d2ba125`
Runtime baseline: Supabase project `bmnbqbcdbuklhopfbopv` (`bella-spa-erp-e2e`)

## Evidence

```yaml
static_shape_test: PASS
tables_and_history_structures: PASS
rls_declarations: PASS
additive_frozen_kernel_check: PASS
db_migration_check: PASS
controlled_baseline_apply: PASS
runtime_tables_created: PASS
runtime_constraints: PASS
runtime_rls_enabled: PASS
runtime_tenant_isolation: PASS
runtime_history_persistence: PASS
test_data_cleanup: PASS
production_apply: NOT_RUN
production_apply_allowed: false
global_clean_build: BLOCKED_BY_LEGACY_MIGRATION_CHAIN
```

The migration declares six new Beauty tables, tenant-scoped RLS policies, required indexes, interval/capacity checks, append-only-compatible history references, and runtime grants for the `authenticated` role.

Runtime verification was executed against the controlled e2e baseline, not production. The first runtime RLS test exposed a missing `GRANT` for `authenticated`; the migration now grants `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the six H8 Beauty tables so RLS policies can execute at runtime.

Verified gates:

- H8 migration SQL applied on controlled baseline.
- Six H8 Beauty tables exist after apply.
- RLS is enabled on all six tables and tenant-isolation policies exist.
- Database constraints reject invalid appointment intervals, completed sessions without actual performer, disrupted assignments without reason/actor/decision time, non-positive resource capacity, and invalid resource intervals.
- Tenant A authenticated context can read/write Tenant A rows and cannot read/write Tenant B rows.
- Assignment replacement history, resource reallocation history, and session actual performer facts persist and can be reconstructed from database rows.
- Deterministic test rows were removed after verification.

The repository-wide clean-build path remains blocked before the H8 migration by legacy migration assumptions such as missing pre-H8 baseline tables. That is a separate global migration reproducibility debt and is not evidence of a Haircut H8 defect.

## Next Gate

Close H8 after local gates pass against the updated migration, then move to H9 integration and regression verification. Do not first-apply H8 to production; production deployment requires a separate backup, smoke, and monitoring gate.
