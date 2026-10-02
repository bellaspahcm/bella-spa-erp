# Beauty V2 Go-Live Boundary Decision Packet

Date: 2026-10-02
Scope: Bella Beauty Spa v2 Pilot Go-Live closure
Branch: `codex/beauty-spa-v2-chain-product`
Latest evidence commit: `bcdf8f433`
Status: `READY_FOR_HUMAN_ARCHITECT_DECISION`

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

## Boundary 1: Concurrency

### Evidence

Beauty OS currently prevents resource conflicts in application logic by reading
active allocations and rejecting overlapping capacity exhaustion before creating
the next allocation.

Beauty V2 then orchestrates appointment, professional assignments, resource
allocations, rollback, and history through Beauty OS services and ports.

The H8 persistence migration contains table constraints, indexes, RLS, and
tenant-scoped policies for `beauty_*`, but it does not define a DB-level
overlap exclusion constraint, advisory-lock contract, serializable transaction
contract, or RPC that atomically proves:

```text
Request A preflight PASS
Request B preflight PASS
        ↓
Only one conflicting allocation can commit
```

The Real DB Business E2E proof validates business persistence, read-back,
tenant-scoped repository reads, rollback, retry, history/audit, and checkout
evidence. It does not claim parallel commit race proof.

### Classification

```text
DB_CONCURRENCY = HUMAN_ARCHITECT_REVIEW_REQUIRED
```

### Pilot Decision Options

Option A: Accept current application-level conflict prevention for a controlled
pilot.

Conditions:

- Pilot tenant has controlled operator volume.
- No claim of DB-level conflict guarantee is made.
- Operational monitoring treats double-booking reports as P0.
- Full DB concurrency contract remains required before higher-volume or
  self-serve booking rollout.

Result if approved:

```text
CONCURRENCY_BOUNDARY_FOR_PILOT = ACCEPTED_RISK
```

Option B: Require DB-level concurrency guarantee before pilot.

Allowed next work only after architecture approval:

- Define canonical Beauty OS concurrency contract.
- Choose DB-level mechanism such as exclusion constraint, transactional RPC,
  serializable transaction, or advisory lock.
- Add Real DB parallel-commit proof.

Result if selected:

```text
GO_LIVE = BLOCKED_UNTIL_DB_CONCURRENCY_PROOF
```

AI recommendation:

```text
Do not claim DB-level concurrency today.
For a controlled pilot, Option A is operationally acceptable only if Human
Architect explicitly accepts the risk.
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
Required gates                        PASS
DB concurrency boundary               HUMAN_ARCHITECT_REVIEW_REQUIRED
Idempotency boundary                  HUMAN_ARCHITECT_DECISION_REQUIRED
```

## Final Classification

```text
BEAUTY_V2_GO_LIVE_PROOF = PASS
BEAUTY_V2_GO_LIVE_READY = BLOCKED_ON_PILOT_BOUNDARY_DECISIONS
```

Beauty V2 can move to pilot go-live only after Human Architect records which
pilot boundary option is accepted for concurrency and idempotency.
