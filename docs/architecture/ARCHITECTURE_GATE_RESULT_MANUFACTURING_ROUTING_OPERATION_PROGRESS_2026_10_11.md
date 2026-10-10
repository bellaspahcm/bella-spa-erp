# Architecture Gate Result — Manufacturing Routing / Work Center / Operation Progress

Date: 2026-10-11

Baseline: `origin/main@55fa09f24c4e981cdf0d478dc5b36a334a901f4a`

Status: `PASS_FOR_MINIMAL_ROUTING_OPERATION_PROGRESS_ONLY`

## 1. Bella OS/Product Development Process Gate

This task is a scoped Bella Manufacturing OS capability after the full operational chain was sealed on `main`.

Allowed work:

- Add Manufacturing-owned Work Center, Routing Revision, Routing Operation, and Production Operation Progress contracts.
- Add additive Manufacturing persistence and RLS for those entities.
- Add service-level authorization, idempotency, state transitions, and completion integration.
- Verify with unit/integration, migration, type, architecture, and Real DB/RLS tests where environment is available.

Out of scope:

- UI/API, ProductRegistry, Finance posting, Go-Live.
- Logistics Stock-Out or Stock-In runtime changes.
- MES/IoT, machine telemetry, capacity optimizer, detailed scheduling, costing/WIP, Factory EIP.

## 2. Product Manifest

Product/OS scope: Bella Manufacturing OS.

Capabilities in scope:

- Work Center
- Routing Revision
- Routing Operation
- Production Operation Progress
- Conditional Production Order Completion guard for routed order lines

Capabilities already proven and reused:

- Production Order and Production Order Line
- BOM Revision and Material Requirement
- Material Issue / Production Consumption via public Logistics Stock-Out
- Production Execution
- FGR via public Logistics Stock-In
- Quality Disposition
- Production Order Completion reconciliation

## 3. Ownership Map

Manufacturing owns:

- Work centers inside the factory production context.
- Routing revisions and routing operations.
- Operation progress for a Production Order Line.
- Completion rule that requires mandatory applied routing operations to be completed.

Platform/IAM owns:

- Tenant identity.
- User identity.
- Factory/org-unit access context.

Logistics owns:

- Stock mutation, movement, ledger, traceability, and warehouse availability.

Finance owns:

- Posting, WIP valuation, costing, and variance accounting.

## 4. Contract Dependency Map

Manufacturing uses existing Manufacturing-owned Production Order and Production Order Line identifiers.

No Logistics or Finance contract delta is required. Routing/progress does not mutate stock and does not post accounting entries.

Data flow:

```text
Manufacturing service
  -> Manufacturing repository
  -> Manufacturing-owned routing/progress tables
  -> Completion guard reads Manufacturing progress only
```

## 5. Change Authority

The user explicitly approved implementation for:

- Work Center
- Routing Revision / Routing Operation
- Production Operation Progress
- Conditional Completion Integration

This authorizes Manufacturing domain types, service, repository, additive migrations, and tests.

It does not authorize UI/API, ProductRegistry, Logistics, Finance, Factory EIP, or Go-Live work.

## 6. UI to Contract Reconciliation

No UI is in scope.

## 7. Additive Migration Plan

Add new Manufacturing-owned tables only:

- `manufacturing_work_centers`
- `manufacturing_routing_revisions`
- `manufacturing_routing_operations`
- `manufacturing_operation_progress`

All new tables require tenant/factory-scoped RLS and authenticated grants. Existing production order behavior must remain unchanged when no routing progress has been applied.

## 8. Automated Verification Gates Plan

Required verification:

- Manufacturing service tests for routing creation, operation progress transitions, idempotency, invalid transitions, and completion guard.
- Migration tests for schema, constraints, RLS, and grants.
- Real DB Manufacturing E2E for persistence, tenant/factory isolation, idempotency, progress completion, and completion rejection when mandatory routed operations are incomplete.
- Existing full-chain Real DB test remains green for non-routed orders.
- TypeScript changed/full where supported.
- Architecture guard and `git diff --check`.

Evidence rules:

- `SKIP`, `TIMEOUT`, missing preflight, or route-only inclusion is not `PASS`.
- Routing progress can be sealed only when runtime, persistence, RLS, and completion guard evidence are observed.

Stop boundary: `MANUFACTURING_ROUTING_OPERATION_PROGRESS_ONLY`.
