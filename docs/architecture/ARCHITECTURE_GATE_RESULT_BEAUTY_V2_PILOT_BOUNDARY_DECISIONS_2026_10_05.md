# Architecture Gate Result - Beauty V2 Pilot Boundary Decisions

Status: SEALED_HUMAN_ARCHITECT_DECISION_RECORDED
Date: 2026-10-05
Scope: Pilot boundary decision packet for Staff DB concurrency and Idempotency after Beauty V2 dependency chain was sealed through Finance. This gate does not authorize code changes, production mutation, schema changes, new abstractions, or reopening Chain, Attendance, Payroll, Commission, or Finance.

## Current State

```yaml
Chain: SEALED_PROVEN
Attendance: SEALED_PROVEN
Payroll: SEALED_PROVEN
Commission: SEALED_PROVEN
Finance_SALARY_PAID_Branch_Mapping: SEALED_REAL_DB_PROVEN

Dependency_Chain_Through_Finance: SEALED
Beauty_V2_Go_Live: NOT_READY

Staff_DB_Concurrency_Decision: RESOURCE_DB_PROVEN_STAFF_APP_LEVEL_ACCEPTED
Idempotency_Boundary_Decision: DEFERRED_BY_SCOPE
Production_H8_Deployment: NEXT_BOUNDARY
```

## Purpose

Beauty V2 no longer has an open internal dependency-chain blocker through Finance. The remaining go-live blockers are pilot and production readiness boundaries.

This packet records the two human architecture decisions required before the go-live path can move cleanly into production deployment.

## Decision 1 - Staff DB Concurrency

### Proven

```text
Resource allocation DB concurrency = PROVEN
```

Prior Real DB proof showed that overlapping active allocations for the same resource are blocked at the database commit boundary.

### Not Claimed

```text
Staff-time DB concurrency = NOT_PROVEN
```

Current Beauty H8 staff/professional assignment records do not provide the same canonical interval persistence needed to prove staff overlap prevention at the database commit boundary.

### Decision

```text
STAFF_CONCURRENCY_FOR_PILOT
  = RESOURCE_DB_PROVEN_STAFF_APP_LEVEL_ACCEPTED
```

Meaning:

```text
Resource overlap is DB-proven.
Staff availability remains application-level for controlled pilot only.
No claim is made that staff-time conflicts are DB-enforced.
Operational monitoring treats staff double-booking reports as P0.
Staff interval DB contract remains required before higher-volume or self-serve rollout if this risk is not accepted.
```

### Rejected Alternative For This Pilot

Require DB staff concurrency before pilot:

```text
STAFF_CONCURRENCY_FOR_PILOT
  = BLOCKED_UNTIL_STAFF_DB_CONCURRENCY_PROOF
```

Required work if selected:

```text
Define canonical Beauty OS staff interval persistence contract.
Add staff-time DB enforcement at the Beauty OS boundary.
Add Real DB parallel-commit proof for staff overlap.
```

## Decision 2 - Idempotency Boundary

### Proven

Current Beauty V2 Real DB proofs exercise product and OS service paths. They do not prove a public retry/idempotency contract.

### Not Claimed

```text
Beauty V2 state-changing public API idempotency = NOT_PROVEN
```

The existing slice does not add a Beauty V2 public state-changing HTTP API, public retry contract, or idempotency-key boundary proof.

### Decision

```text
IDEMPOTENCY_FOR_PILOT
  = DEFERRED_BY_SCOPE
```

Meaning:

```text
Pilot does not expose a public state-changing Beauty V2 API or retry contract.
Operator workflow is controlled for pilot only.
No claim is made that Beauty V2 booking or checkout is retry-idempotent.
The first public state-changing Beauty V2 API must implement the canonical idempotency contract before broader rollout.
```

### Rejected Alternative For This Pilot

Require idempotency before pilot:

```text
IDEMPOTENCY_FOR_PILOT
  = BLOCKED_UNTIL_API_IDEMPOTENCY_PROOF
```

Required work if selected:

```text
Bind Beauty V2 state-changing API operations to the canonical idempotency contract.
Use the platform-approved idempotency store or service.
Prove duplicate request replay returns the original result without duplicate appointment, assignment, allocation, session, payment evidence, or history.
```

## Non-Goals

```text
No Chain work.
No Attendance work.
No Payroll work.
No Commission work.
No Finance work.
No staff concurrency implementation in this gate.
No idempotency implementation in this gate.
No production migration or production data mutation.
No Beauty-local workaround for staff locking or idempotency.
```

## Decision Record

Human architect recorded exactly one option for each boundary:

```text
STAFF_CONCURRENCY_FOR_PILOT =
  RESOURCE_DB_PROVEN_STAFF_APP_LEVEL_ACCEPTED

IDEMPOTENCY_FOR_PILOT =
  DEFERRED_BY_SCOPE
```

## Final Classification

```text
Beauty_V2_Dependency_Chain_Through_Finance = SEALED
Beauty_V2_Pilot_Boundary_Decisions = SEALED
Beauty_V2_Production_Deployment = NEXT_BOUNDARY
Beauty_V2_Go_Live = NOT_READY
```

The next bounded task is Production H8 Deployment Gate. This packet does not execute production deployment.
