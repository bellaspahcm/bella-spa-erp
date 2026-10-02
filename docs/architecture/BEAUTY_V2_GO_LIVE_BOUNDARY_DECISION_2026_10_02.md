# Beauty V2 Go-Live Boundary Decision Packet

Date: 2026-10-02
Scope: Bella Beauty Spa v2 Pilot Go-Live closure
Branch: `codex/beauty-spa-v2-chain-product`
Latest prior evidence commit: `03ce1a9cb`
Status: `READY_FOR_REMAINING_PILOT_BOUNDARY_DECISIONS`

## Current Truth

Beauty V2 product-layer implementation, hardening, workflow completeness, and
proof infrastructure are sealed for the current PR scope.

Real DB Business E2E is now proven by CI:

- Workflow run: `36945178404`
- Job: `110645613703`
- Result: `Real Database Business E2E = PASS`
- Beauty V2 proof test:
  `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts`
- CI log summary:
  `PASS src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts`
  and `Test Suites: 1 skipped, 7 passed`

The proof path is:

```text
Beauty V2 Product Service
  -> Beauty OS application services
  -> Beauty OS H8 repository ports
  -> Supabase H8 repository adapter
  -> Real DB beauty_* tables
```

No Beauty V2 product runtime bypass to direct Supabase/DB is authorized or
needed for the proof.

## Production Data Safety - BabyCare

Bella Mommy BabyCare is an active production tenant with real operational data.
It may be used only as read-only business evidence for Beauty V2 discovery and
design.

BabyCare production must not be used as a Beauty V2 proof, migration, cleanup,
seed, or concurrency-test environment. This packet does not authorize trial
migrations, reset/drop/recreate operations, test data seeding, real-data
cleanup, fake bookings, test transactions, concurrency tests, or schema/data
changes against BabyCare production.

Beauty V2 migration, concurrency, idempotency, and E2E proofs must run on an
E2E, staging, or dedicated test database with explicit ownership. BabyCare
Production, the Beauty V2 E2E database, and local development databases are
separate environments. If an operation might mutate BabyCare production, stop
and verify the boundary before executing it.

## Boundary 1: Concurrency

### Evidence

Beauty V2 now has a Real DB proof for the same-resource active allocation race:

```text
Request A preflight PASS
Request B preflight PASS
        ↓
Only one conflicting allocation can commit
```

The proof was executed against the owned Beauty V2 E2E Supabase project, not
against BabyCare production.

Resource allocation DB evidence:

- `btree_gist` extension present.
- `beauty_resource_allocations_no_active_overlap` exclusion constraint present.
- Migration ledger records
  `20261002010000_beauty_h8_resource_overlap_concurrency`.
- Real DB concurrent booking test result: one request fulfilled, one request
  rejected, and exactly one `ACTIVE` allocation was read back from
  `beauty_resource_allocations`.
- Current concurrency slice CI is not claimed until the pushed commit runs CI.

The remaining concurrency boundary is staff-time DB enforcement. Current H8
professional assignment records do not carry the same interval fields required
to express a staff overlap exclusion constraint at the persistence boundary.
Beauty V2 still uses application-level staff availability checks through Beauty
OS services.

### Classification

```text
RESOURCE_ALLOCATION_DB_CONCURRENCY = PASS
STAFF_INTERVAL_DB_CONCURRENCY = CONTRACT_GAP_IF_REQUIRED_FOR_PILOT
```

### Pilot Decision Options

Option A: Accept the current pilot boundary.

Conditions:

- Resource allocation conflict is protected at the Real DB commit boundary.
- Staff availability remains application-level for the controlled pilot.
- No claim is made that staff-time conflict has DB-level enforcement.
- Operational monitoring treats staff double-booking reports as P0.
- Staff interval DB contract remains required before higher-volume or
  self-serve staff booking rollout if that risk is not accepted.

Result if approved:

```text
CONCURRENCY_BOUNDARY_FOR_PILOT = RESOURCE_DB_PROVEN_STAFF_APP_LEVEL_ACCEPTED
```

Option B: Require staff-time DB concurrency guarantee before pilot.

Allowed next work only after architecture approval:

- Define canonical Beauty OS staff interval persistence contract.
- Add staff-time DB enforcement at the correct OS boundary.
- Add Real DB parallel-commit proof for staff overlap.

Result if selected:

```text
GO_LIVE = BLOCKED_UNTIL_STAFF_DB_CONCURRENCY_PROOF
```

AI recommendation:

```text
Claim resource DB concurrency only.
Do not claim staff-time DB concurrency until Beauty OS has a canonical staff
interval contract and Real DB proof.
```

## Boundary 2: Idempotency

### Evidence

Bella Architecture Constitution Invariant 7 says:

```text
All state-changing APIs MUST be idempotent.
```

The documented implementation is:

```text
idempotency-key header
24h result store
cached result for duplicate requests
```

Platform Core has domain-agnostic idempotency primitives:

```text
tenantId + operation + businessKey
```

Current Beauty V2 proof scope exercises the product service directly through
Beauty OS ports. This slice does not add a Beauty V2 state-changing HTTP API
route, public retry contract, or distributed duplicate-submit contract. The
Beauty V2 service method itself does not accept a request id or idempotency key.

### Classification

```text
IDEMPOTENCY = API_BOUNDARY_REQUIRED_IF_STATE_CHANGING_API_IS_EXPOSED
```

### Pilot Decision Options

Option A: Defer idempotency for the controlled pilot.

Conditions:

- Pilot does not expose a public state-changing Beauty V2 API.
- Operator workflow is controlled enough that duplicate-submit risk is handled
  operationally for pilot only.
- No claim is made that Beauty V2 booking/checkout is retry-idempotent.
- First Beauty V2 state-changing API must implement the canonical idempotency
  contract at the API boundary before broader rollout.

Result if approved:

```text
IDEMPOTENCY_FOR_PILOT = DEFERRED_BY_SCOPE
```

Option B: Require idempotency before pilot.

Allowed next work only after architecture approval:

- Bind Beauty V2 state-changing API operations to the canonical idempotency
  contract.
- Use a production-appropriate 24h store, not a product-local in-memory
  workaround.
- Prove duplicate request replay returns cached result without duplicate
  appointment, assignment, allocation, session, payment evidence, or history.

Result if selected:

```text
GO_LIVE = BLOCKED_UNTIL_IDEMPOTENCY_CONTRACT_PROOF
```

AI recommendation:

```text
Do not invent a Beauty-local idempotency key.
Defer only if the pilot scope truly has no exposed state-changing API/retry
requirement. Otherwise implement the canonical API-boundary contract first.
```

## Go-Live Gate Status

```text
Product Layer SEALED                  PASS
Proof Infrastructure                  PASS
Real DB Business E2E                  PASS
DB read-back                          PASS
Tenant-scoped repository read-back    PASS
Audit/history evidence                PASS
Rollback/retry evidence               PASS
Architecture guard                    PASS
Type check affected                   PASS
Required local gates                  PASS
Current commit PR CI                  NOT_CLAIMED
Resource DB concurrency               PASS
Staff DB concurrency                  HUMAN_ARCHITECT_DECISION_REQUIRED
Idempotency boundary                  HUMAN_ARCHITECT_DECISION_REQUIRED
```

## Final Classification

```text
BEAUTY_V2_GO_LIVE_PROOF = PASS_WITH_RESOURCE_DB_CONCURRENCY
BEAUTY_V2_GO_LIVE_READY = BLOCKED_ON_PILOT_BOUNDARY_DECISIONS
```

Beauty V2 can move to pilot go-live only after Human Architect records which
pilot boundary option is accepted for staff concurrency and idempotency.
