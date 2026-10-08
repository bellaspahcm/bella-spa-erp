# Architecture Gate Result - Hospitality Phase 6 Housekeeping

Date: 2026-10-09

## Result

```ini
GATE = PASS
PHASE = 6_HOUSEKEEPING
CODE_AUTHORIZED = YES
DB_AUTHORIZED = YES
UI_AUTHORIZED = NO
ROUTE_IMPLEMENTATION_AUTHORIZED = NO
MAINTENANCE_AUTHORIZED = NO
FNB_AUTHORIZED = NO
REVENUE_ENGINE_AUTHORIZED = NO
TRAVEL_AUTHORIZED = NO
RESOURCE_KERNEL_AUTHORIZED = NO
ALLOCATION_ENGINE_AUTHORIZED = NO
PAYMENT_ENGINE_AUTHORIZED = NO
```

## Problem / Non-Goals

Phase 6 opens the first post-Hotel-Core operational capability:

```text
Room
  -> Housekeeping Status
  -> Housekeeping Task
  -> Cleaning / Inspection / Maintenance Request / Status Update
```

Authorized status vocabulary:

```text
AVAILABLE
OCCUPIED
DIRTY
CLEAN
INSPECTED
OUT_OF_ORDER
```

Authorized task vocabulary:

```text
CLEANING
INSPECTION
MAINTENANCE_REQUEST
STATUS_UPDATE
```

Non-goals:

- Modifying sealed Hotel Core check-in/check-out semantics
- Auto-rewriting Phase 3 occupancy contracts
- Maintenance work orders
- F&B
- Revenue
- Travel / Tour
- Generic Resource / Availability / Allocation kernel
- Generic task/workflow engine

## Truth and Source of Truth

| Question | Source | Result |
| --- | --- | --- |
| Product identity | Phase 0 ProductRegistry / ProductResolver proof | `bella_hospitality` is sealed |
| Hotel physical foundation | Phase 1 proof | Property, Room Type, and Room are sealed |
| Stay and occupancy | Phase 3 proof | Completed stay and released occupancy are sealed |
| Hotel Core chain | Hotel Core full-chain seal | Core chain is the base for Housekeeping |
| Housekeeping semantics | Hospitality design text | Room-owned housekeeping status and task lifecycle |
| Resource kernel | `RESOURCE_AVAILABILITY_ALLOCATION_DECISION_2026_10_08.md` | Not created |

## Business Test Contract

| Rule | Expected invariant |
| --- | --- |
| Room status ownership | Hospitality owns room housekeeping status; `hospitality_rooms.status` remains record lifecycle |
| Checkout handoff | A completed stay with released occupancy can open a cleaning task and mark the room `dirty` |
| Atomicity | Checkout handoff persists dirty room state and cleaning task in one repository transaction |
| Task ownership | Housekeeping task belongs to one tenant/property/room and optionally one stay |
| Task completion | Completing a task updates the product-owned room housekeeping status |
| Maintenance request | `maintenance_request` is only a Housekeeping task type in this phase; it does not create Maintenance runtime |
| Tenant isolation | Tenant A cannot read or mutate Tenant B housekeeping rows through RLS |

## Product Manifest Delta

Phase 6 does not change ProductRegistry. It adds product-owned Hospitality
contracts under the sealed `bella_hospitality` identity:

```text
Room Housekeeping Status
Housekeeping Task
```

## Ownership Map

| Data / Contract | Owner | Phase 6 action |
| --- | --- | --- |
| `bella_hospitality` product key | Platform Product Registry | Reuse |
| Property / Room | Hospitality Product Phase 1 | Reuse sealed tables |
| Stay / Occupancy | Hospitality Product Phase 3 | Read only to prove checkout handoff |
| Room housekeeping status | Hospitality Product | Create product table and service contract |
| Housekeeping task | Hospitality Product | Create product table and service contract |
| Maintenance work order | Not authorized | Not created |
| Resource / Availability / Allocation kernel | Not created | Forbidden |

## Contract Dependency Map

```text
Tenant.product_key = bella_hospitality
  -> ProductRegistry / ProductResolver
  -> Hospitality Room
  -> Hospitality Stay / Room Occupancy
  -> Hospitality Room Housekeeping Status
  -> Hospitality Housekeeping Task
```

No Finance, Party, Healthcare, Education, Logistics, Beauty, or cross-industry
Resource Kernel dependency is introduced.

## Change Authority

Authorized:

- New product-owned files under `src/products/bella-hospitality/`
- New additive migration creating Housekeeping tables only
- Static/unit/Real DB tests for task creation, status transitions, RLS, and migration shape
- Narrow architecture-test adjustment so sealed phase tests remain phase-local

Not authorized:

- Healthcare H1-H12 files or `hc_*` tables
- Education kernel files
- Logistics E7.1/E7.2/E7.3 files
- Beauty H5/H8 files
- Finance services, engines, migrations, or tables
- Sealed Hospitality check-in/check-out behavior
- App route/UI files
- Maintenance/F&B/Travel runtime
- Global Resource / Availability / Allocation kernel

## UI -> Contract Reconciliation

No UI is modified in Phase 6.

## Additive Migration Plan

Create product-owned tables only:

```text
hospitality_room_housekeeping_statuses
hospitality_housekeeping_tasks
```

Each table:

- Has `tenant_id`
- Has RLS enabled
- Has authenticated/service role grants
- Uses additive `CREATE TABLE IF NOT EXISTS`
- References Hospitality Room by product-owned identifiers

No migration modifies Platform, Beauty, Healthcare, Education, Logistics,
Finance, Folio, Travel, or Resource tables.

## 11 Automated Verification Gates Plan

1. Housekeeping service unit tests prove checkout handoff creates a dirty room status and cleaning task.
2. Unit tests prove housekeeping rejects checkout handoff before released occupancy.
3. Unit tests prove task completion updates room housekeeping status.
4. Migration shape test proves additive Housekeeping tables, RLS, grants, and status vocabularies.
5. Static architecture test proves no Maintenance/F&B/Travel/Resource Kernel implementation.
6. Phase-local architecture tests prove previous phases do not depend on Housekeeping.
7. Product identity regression tests prove `bella_hospitality` still resolves through ProductRegistry/ProductResolver.
8. Real DB test proves Room -> Dirty -> Cleaning Task -> Clean with tenant isolation when DB env is available.
9. `npm run arch:guard` protects sealed Logistics E7.1/E7.2/E7.3.
10. Scoped ESLint and `npm run typecheck:changed` must pass with zero diagnostics.
11. `npm run db:migration:zero-downtime`, `git diff --check`, and scoped no-`any` scan must pass.

## Decision

```ini
HOSPITALITY_PHASE6_HOUSEKEEPING = PASS
ROOM_HOUSEKEEPING_STATUS = CREATED
HOUSEKEEPING_TASK = CREATED
MAINTENANCE_RUNTIME = NOT_CREATED
FNB = NOT_STARTED
TRAVEL = NOT_STARTED
RESOURCE_KERNEL = NOT_CREATED
ALLOCATION_ENGINE = NOT_CREATED
```
