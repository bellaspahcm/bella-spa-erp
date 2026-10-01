# Architecture Gate Result - Beauty V2 Proof Infrastructure

Date: 2026-10-02
Scope: Beauty V2 Go-Live Operational Proof Infrastructure
Result: PASS

## Problem / Non-Goals

Beauty V2 product layer is already sealed locally, but Go-Live proof is blocked because the Real DB path cannot prove Beauty V2 through canonical Beauty OS H8 persistence.

This slice does not add Beauty V2 product features, does not change product workflow semantics, does not claim DB-level concurrency, and does not invent a product-local idempotency contract.

## Truth And Source Of Truth

| Truth | Source of truth | Status |
| --- | --- | --- |
| Beauty H8 persistence schema | `supabase/migrations/20260916000000_beauty_os_h8_persistence.sql` | Identified |
| E2E DB has Beauty H8 tables | `supabase gen types typescript --project-id bmnbqbcdbuklhopfbopv` | Verified locally, no DB mutation |
| Global `src/types/database.types.ts` lacks Beauty H8 tables | `rg beauty_appointments src/types/database.types.ts` | Verified |
| Full replacement of global DB types is unsafe in this slice | no-index diff against E2E generated output: about 32k deletions | Deferred |
| Beauty OS H8 ports exist | `src/platform/beauty/application/ports.ts` | Identified |

## Product Manifest

Product: `bella_spa` / Bella Beauty Spa v2

Required capability for this slice:

- Beauty OS appointment persistence
- Beauty OS professional assignment persistence
- Beauty OS resource allocation persistence
- Beauty OS session persistence
- Beauty OS assignment/allocation history persistence
- Real DB E2E registration for Beauty V2 business proof

Out of scope:

- Product UI changes
- New Beauty V2 features
- Finance/idempotency contract changes
- DB-level concurrency guarantee
- Production deployment

## Ownership Map

| Data / capability | Owner | Authorized action |
| --- | --- | --- |
| `beauty_*` H8 tables | Beauty OS | Add adapter implementation against existing ports |
| Beauty V2 workflow | Product | Consume existing Beauty OS ports only |
| Real DB E2E suite registration | CI / test infrastructure | Add proof test path |
| CI secrets | Repository environment | Consume existing `E2E_SUPABASE_URL` and `E2E_SUPABASE_SERVICE_ROLE_KEY` |
| Idempotency | Canonical platform/Beauty OS contract | Defer |
| Concurrency guarantee | Architecture decision | Defer |

## Contract Dependency Map

```text
Beauty V2 Product Service
  -> Beauty OS application services
  -> Beauty OS H8 repository ports
  -> Supabase H8 repository adapter
  -> beauty_* Real DB tables
```

No Product -> direct DB dependency is authorized.

## Change Authority

Authorized layers:

- Beauty OS infrastructure adapter for existing H8 ports
- Test-only Real DB proof
- Real DB Jest registration
- Scope router awareness for the new real-db test file
- Architecture gate documentation

Not authorized:

- Beauty V2 product workflow changes
- Kernel/Core changes
- Generated global DB type replacement with broad schema deletion
- New idempotency semantics
- New DB-level locking/concurrency contract

## UI To Contract Reconciliation

No UI change in this slice.

## Additive Migration Plan

No migration is planned. The canonical H8 migration already exists and the E2E database generated type output confirms the six Beauty H8 tables are present.

## Verification Plan

1. Add scoped Beauty H8 DB type contract from generated E2E schema evidence.
2. Add Beauty OS Supabase repository adapters implementing existing H8 ports.
3. Add a Beauty V2 Real DB E2E proof path that executes business operations through `BeautySpaV2Service`.
4. Register the test in `jest.real-db.config.ts`.
5. Update CI scope routing so future edits to the Beauty V2 real-db proof file trigger Real DB E2E.
6. Run local targeted tests that do not require secrets.
7. Run TypeScript/ESLint/architecture/diff gates locally.
8. Leave Real DB execution to CI or a valid local E2E credential environment.

This slice verifies Beauty V2 business persistence and tenant-scoped repository
read-back under the approved Real DB proof path. It does not re-claim new
authenticated RLS runtime evidence; existing Beauty H8 RLS proof remains owned
by the prior H8 migration/closure evidence.

## Boundary Classification

`BEAUTY_V2_PRODUCT_LAYER = SEALED`

`BEAUTY_V2_PROOF_INFRASTRUCTURE = PASS_TO_IMPLEMENT`

`REAL_DB_BUSINESS_E2E = REGISTERED_AFTER_IMPLEMENTATION, NOT_PROVEN_UNTIL_EXECUTED`

`DB_CONCURRENCY = HUMAN_ARCHITECT_REVIEW`

`IDEMPOTENCY = DEFER_CONTRACT`
