# Architecture Gate Result - Hospitality Phase 7 Maintenance

Date: 2026-10-09

## Result

```ini
GATE = PASS
PHASE = 7_MAINTENANCE
CODE_AUTHORIZED = YES
DB_AUTHORIZED = YES
UI_AUTHORIZED = NO
ROUTE_IMPLEMENTATION_AUTHORIZED = NO
FNB_AUTHORIZED = NO
REVENUE_ENGINE_AUTHORIZED = NO
TRAVEL_AUTHORIZED = NO
RESOURCE_KERNEL_AUTHORIZED = NO
ALLOCATION_ENGINE_AUTHORIZED = NO
PAYMENT_ENGINE_AUTHORIZED = NO
```

## Bella OS / Product Development Process Gate

The canonical Bella rule for this phase is:

```text
Root Cause -> Minimal Decision -> Verify -> Seal -> Stop
```

Phase 7 opens only the next Hospitality capability after Hotel Core and
Housekeeping have been proven and sealed:

```text
Room
  -> Maintenance Request
  -> Assignment / Work Status
  -> Completion
  -> Housekeeping room state remains not ready for sale
```

This phase does not infer or create a shared Resource / Availability /
Allocation kernel. Room maintenance is a Hospitality-owned operational
semantic and is integrated through Housekeeping room status.

## Problem / Non-Goals

Authorized:

- Report a maintenance issue for a Hospitality room.
- Assign maintenance work.
- Move work through `reported -> assigned -> in_progress -> completed`.
- Mark the room `out_of_order` while maintenance is open.
- Mark the room `dirty` after maintenance completion so Housekeeping must
  clean or inspect the room before it can be ready.
- Prove Real DB/RLS tenant isolation for maintenance rows.

Non-goals:

- Generic task/workflow engine
- Generic Resource / Availability / Allocation kernel
- Reservation allocation or availability engine
- Housekeeping redesign
- Maintenance inventory, procurement, vendor, SLA, or scheduling engine
- F&B
- Revenue
- Travel / Tour
- App route or UI

## Product Manifest

Phase 7 does not change ProductRegistry. It adds a product-owned Hospitality
contract under the sealed `bella_hospitality` identity:

```text
Hospitality Maintenance Request
```

The capability depends on existing sealed product contracts:

```text
Phase 1 Property / Room
Phase 6 Housekeeping Room State
```

## Ownership Map - Who Owns This Data?

| Data / Contract | Owner | Phase 7 action |
| --- | --- | --- |
| `bella_hospitality` product key | Platform Product Registry | Reuse |
| Property / Room | Hospitality Product Phase 1 | Reuse sealed tables |
| Room housekeeping status | Hospitality Product Phase 6 | Update through product-owned boundary |
| Housekeeping task | Hospitality Product Phase 6 | Optional source pointer only |
| Maintenance request | Hospitality Product Phase 7 | Create product table and service contract |
| Maintenance assignment/status | Hospitality Product Phase 7 | Keep inside maintenance request lifecycle |
| Finance receivable/payment | Finance OS | Not used |
| Healthcare H1-H12 | Healthcare OS | Forbidden |
| Education Kernel | Education OS | Forbidden |
| Logistics E7.1/E7.2/E7.3 | Logistics OS | Forbidden |
| Resource / Availability / Allocation kernel | Not created | Forbidden |

## Contract Dependency Map

```text
Tenant.product_key = bella_hospitality
  -> ProductRegistry / ProductResolver
  -> Hospitality Property / Room
  -> Hospitality Room Housekeeping Status
  -> Hospitality Maintenance Request
```

No Finance, Party, Healthcare, Education, Logistics, Beauty, or cross-industry
Resource Kernel dependency is introduced.

## Change Authority

Authorized:

- New product-owned files under `src/products/bella-hospitality/`
- New additive migration creating Maintenance tables only
- Static/unit/Real DB tests for request creation, assignment, status transitions,
  Housekeeping room-state coordination, RLS, and migration shape
- CI routing updates needed to execute the new Real DB proof file

Not authorized:

- Healthcare H1-H12 files or `hc_*` tables
- Education kernel files
- Logistics E7.1/E7.2/E7.3 files
- Beauty H5/H8 files
- Finance services, engines, migrations, or tables
- Sealed Hospitality Reservation, Stay, Folio, Payment, or Housekeeping
  semantics except invoking Housekeeping room state as an integration boundary
- App route/UI files
- F&B, Revenue, Travel runtime
- Global Resource / Availability / Allocation kernel

## UI -> Contract Reconciliation

No UI is modified in Phase 7.

## Additive Migration Plan

Create product-owned table only:

```text
hospitality_maintenance_requests
```

The table:

- Has `tenant_id`
- Has RLS enabled
- Has authenticated/service role grants
- Uses additive `CREATE TABLE IF NOT EXISTS`
- References Hospitality Room by product-owned identifiers
- Optionally references a Phase 6 Housekeeping task as source evidence
- Does not modify Platform, Beauty, Healthcare, Education, Logistics, Finance,
  Folio, Travel, or Resource tables

## 11 Automated Verification Gates Plan

1. Maintenance service unit tests prove report creates a maintenance request and
   marks room `out_of_order`.
2. Unit tests prove assignment changes status to `assigned` and records assignee.
3. Unit tests prove work start changes status to `in_progress`.
4. Unit tests prove completion marks request `completed` and room `dirty`.
5. Migration shape test proves additive Maintenance table, RLS, grants, bounded
   statuses, and no Resource/F&B/Travel tables.
6. Static architecture test proves Maintenance stays inside Hospitality product
   and does not import frozen OS internals.
7. Phase 6 regression proves Housekeeping did not create Maintenance runtime.
8. Real DB test proves Room -> Maintenance -> Out of Order -> Completed -> Dirty
   with same-tenant read access.
9. Real DB test proves cross-tenant read returns no rows and cross-tenant
   `UPDATE ... RETURNING` mutates no rows.
10. `npm run arch:guard`, scoped ESLint, and `npm run typecheck:changed` must
    pass with zero new diagnostics.
11. `npm run db:migration:zero-downtime`, CI scope routing, `git diff --check`,
    and scoped no-`any`/`ts-ignore` scan must pass.

## Decision

```ini
HOSPITALITY_PHASE7_MAINTENANCE = PASS
MAINTENANCE_REQUEST = CREATED
ROOM_OUT_OF_ORDER_DURING_MAINTENANCE = REQUIRED
ROOM_DIRTY_AFTER_MAINTENANCE_COMPLETION = REQUIRED
HOUSEKEEPING_REOPEN = NO
FNB = NOT_STARTED
TRAVEL = NOT_STARTED
RESOURCE_KERNEL = NOT_CREATED
ALLOCATION_ENGINE = NOT_CREATED
```
