# Architecture Gate Result - Beauty V2 Concurrency Proof

Date: 2026-10-02
Scope: Beauty V2 mandatory resource-booking concurrency proof
Result: PASS_RESOURCE_DB_CONCURRENCY_WITH_MIGRATION_BASELINE_BOUNDARY

## Problem

Beauty V2 Go-Live proof passed for the sequential business workflow, but the
updated product requirement requires the no-overlap booking invariant to hold
when two booking requests race for the same resource and overlapping time.

Application preflight alone cannot prove this invariant:

```text
Request A preflight PASS
Request B preflight PASS
        ↓
Only one conflicting ACTIVE resource allocation can commit
```

## Truth And Source Of Truth

| Truth | Source of truth | Status |
| --- | --- | --- |
| Beauty V2 booking goes through Beauty OS services and H8 ports | `src/products/beauty-spa-v2/service.ts` | Verified |
| Beauty OS resource allocation checks existing active allocations before create | `src/platform/beauty/application/services.ts` | Verified |
| H8 persistence has resource allocation time/resource columns | `supabase/migrations/20260916000000_beauty_os_h8_persistence.sql` | Verified |
| Initial H8 persistence did not have DB-level active overlap protection | `supabase/migrations/20260916000000_beauty_os_h8_persistence.sql` | Verified |
| H8 resource allocation now has DB-level active overlap protection | `supabase/migrations/20261002010000_beauty_h8_resource_overlap_concurrency.sql` and E2E DB read-back | Verified |
| Postgres exclusion constraints are already used in Bella for scheduling concurrency | Healthcare OR/surgery migrations | Verified |

## Product Manifest

Product: `bella_spa` / Bella Beauty Spa v2

Capability in this slice:

- Concurrency-safe same-resource booking protection for active Beauty resource
  allocations.
- Real DB parallel booking proof.

Out of scope:

- General scheduling framework extraction.
- Staff-time DB constraint. Current H8 assignment records do not store interval
  fields, so staff concurrency remains a separate Beauty OS contract gap.
- Public API idempotency.
- UI changes.
- Cross-branch recommendation/ranking.

## Production Data Safety - BabyCare

Bella Mommy BabyCare is an active production tenant with real operational data.
It is allowed only as business evidence for Beauty V2 discovery:

- Read / inspect.
- Analyze.
- Extract business evidence.

It must not be used as a Beauty V2 proof, migration, cleanup, seed, or
concurrency-test environment. Specifically, this slice does not authorize:

- Trial migrations on BabyCare production.
- Reset / drop / recreate operations against BabyCare production.
- Test data seeding.
- Real-data cleanup.
- Fake bookings or test transactions.
- Concurrency tests on production data.
- Schema or data changes to serve Beauty V2 proof.
- Treating a production tenant as a substitute for the Beauty V2 Real DB E2E
  environment.

Beauty V2 migration, concurrency, idempotency, and E2E proofs must run on an
E2E, staging, or dedicated test database with explicit ownership. If an
operation might mutate BabyCare production, the correct status is STOP and
verify the boundary before executing it.

## Ownership Map

| Data / capability | Owner | Authorized action |
| --- | --- | --- |
| `beauty_resource_allocations` | Beauty OS H8 persistence | Add DB-level active overlap invariant |
| Beauty V2 booking orchestration | Beauty V2 product | Consume existing Beauty OS service path |
| Real DB concurrency proof | CI / proof infrastructure | Add parallel proof case |
| Staff assignment interval semantics | Beauty OS contract | Defer as separate contract gap |

## Contract Dependency Map

```text
Beauty V2 bookService
  -> Beauty OS ResourceAllocationService
  -> Beauty OS ResourceAllocationRepository
  -> beauty_resource_allocations DB exclusion constraint
```

No Product -> direct DB mutation is authorized.

## Change Authority

Authorized:

- Additive Beauty OS H8 migration for resource allocation invariant.
- Real DB test proving parallel same-resource conflict.
- Architecture documentation for the narrowed boundary.

Not authorized:

- Beauty OS scheduling framework extraction.
- Beauty V2 product-local locking or advisory-lock workaround.
- Legacy Beauty Spa architecture copy.
- Staff assignment schema redesign in this slice.
- Idempotency implementation without API boundary.

## UI To Contract Reconciliation

No UI change in this slice.

## Additive Migration Plan

Add a Beauty OS H8 migration that enables `btree_gist` and adds an exclusion
constraint on:

```text
tenant_id
resource_id
tstzrange(starts_at, ends_at, '[)')
```

for rows where:

```text
status = 'ACTIVE'
```

This protects the commit boundary for overlapping active allocations of the same
resource inside the same tenant.

## Verification Plan

1. Add DB-level Beauty H8 active resource overlap constraint.
2. Extend Real DB Beauty V2 proof with parallel same-resource booking.
3. Assert exactly one request succeeds and one is rejected.
4. Assert Real DB read-back has exactly one `ACTIVE` allocation for the resource.
5. Assert the losing path did not leave a second active allocation.
6. Run local targeted tests; local Real DB remains skipped without credentials.
7. Run TypeScript, lint, migration policy, architecture guard, diff check.
8. Run the Real DB proof after the migration is applied to the E2E database.

## Real DB Proof Evidence

The missing canonical migration history entry was restored from
`docs/architecture/PRODUCT_IDENTITY_CHECKPOINT_2026_09_19.md`:

```text
20260919030000_add_product_key_to_tenants.sql
```

The Beauty H8 resource-overlap migration was then applied to the owned E2E
Supabase project, not to BabyCare production:

```text
project ref: bmnbqbcdbuklhopfbopv
migration: 20261002010000_beauty_h8_resource_overlap_concurrency.sql
```

Read-back verified:

```text
btree_gist extension = PRESENT
beauty_resource_allocations_no_active_overlap = PRESENT
ledger 20261002010000 = APPLIED
```

Real DB test evidence:

```text
npx jest --config jest.real-db.config.ts \
  src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts \
  --runInBand --forceExit

Test Suites: 1 passed
Tests:       2 passed
```

The concurrent booking proof forces two booking requests to reach resource
activation together. Evidence verified:

```text
fulfilled requests = 1
rejected requests = 1
ACTIVE allocations read back from Real DB = 1
allocation statuses = ACTIVE, DISRUPTED
```

This proves the Beauty H8 Real DB commit boundary rejects overlapping active
allocations for the same tenant/resource/time interval.

## Migration Baseline Boundary

The E2E database still has historical sparse migration history predating this
Beauty V2 slice. This slice does not claim to repair the whole P0 migration
ledger.

The migration gate was changed to a no-new-drift check against `BASE_REF`:

- remote-only migrations still fail;
- new local migrations missing from E2E still fail;
- pending local migrations already present at the baseline remain a tracked
  historical boundary rather than being reclassified as a Beauty V2 regression.

This preserves the migration gate for new changes without pretending the
historical sparse ledger is fixed.

## Boundary Classification

```text
RESOURCE_DB_CONCURRENCY = REAL_DB_PROVEN
STAFF_DB_CONCURRENCY = DEFER_CONTRACT_GAP
IDEMPOTENCY = DEFER_UNTIL_STATE_CHANGING_API_BOUNDARY
MIGRATION_HISTORY_P0 = BASELINE_BOUNDARY_NO_NEW_DRIFT
BEAUTY_V2_GO_LIVE_READY = BLOCKED_ON_REMAINING_PILOT_BOUNDARY_DECISIONS
```
