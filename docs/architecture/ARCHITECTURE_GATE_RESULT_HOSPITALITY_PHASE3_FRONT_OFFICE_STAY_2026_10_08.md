# Architecture Gate Result - Hospitality Phase 3 Front Office / Stay

Date: 2026-10-08

## Result

```ini
GATE = PASS
PHASE = 3_FRONT_OFFICE_STAY
CODE_AUTHORIZED = YES
DB_AUTHORIZED = YES
UI_AUTHORIZED = NO
ROUTE_IMPLEMENTATION_AUTHORIZED = NO
FOLIO_AUTHORIZED = NO
PAYMENT_AUTHORIZED = NO
HOUSEKEEPING_AUTHORIZED = NO
MAINTENANCE_AUTHORIZED = NO
FNB_AUTHORIZED = NO
REVENUE_AUTHORIZED = NO
TRAVEL_AUTHORIZED = NO
RESOURCE_KERNEL_AUTHORIZED = NO
ALLOCATION_ENGINE_AUTHORIZED = NO
```

## Problem / Non-Goals

Phase 3 opens the Front Office runtime capability for Hotel: a sealed
reservation becomes an active stay, the reserved room becomes occupied, then
check-out completes the stay and releases the occupancy.

Authorized chain:

```text
Guest
  -> Reservation
  -> Reserved Room
  -> Check-in
  -> Active Stay
  -> Room Occupancy
  -> Check-out
  -> Completed Stay
```

Non-goals:

- Folio
- Folio items
- Payment
- Housekeeping
- Maintenance
- F&B
- Revenue
- Travel / Tour
- Generic Resource / Availability / Allocation kernel
- Generic allocation engine

## Truth and Source of Truth

| Question | Source | Result |
| --- | --- | --- |
| Product identity | Phase 0 ProductRegistry / ProductResolver proof | `bella_hospitality` is sealed |
| Physical hotel foundation | Phase 1 Real DB / RLS proof | Property, Room Type, and Room are sealed |
| Guest + reservation | Phase 2 Real DB / RLS proof | Guest, Reservation, Reserved Room are sealed |
| Resource kernel | `RESOURCE_AVAILABILITY_ALLOCATION_DECISION_2026_10_08.md` | Not created |
| Front Office semantics | User-approved Phase 3 boundary | Check-in, Stay, Occupancy, Check-out only |

## Business Test Contract

| Rule | Canonical source | Expected invariant |
| --- | --- | --- |
| Check-in | Phase 3 boundary | A check-in can be created only for an existing tenant/property reservation and reserved room |
| Stay | Phase 3 boundary | A stay belongs to one tenant, property, reservation, and guest |
| Room occupancy | Phase 3 boundary | Occupancy references the same reserved room and room as the stay's reservation |
| Active occupancy | Hotel front office semantic | A room can have only one active occupancy |
| Check-out | Phase 3 boundary | Check-out completes the active stay and releases the active occupancy |
| Tenant isolation | Bella RLS contract | Tenant A cannot read Tenant B stay rows through RLS |

Phase 2 stores reservation status as `confirmed`. In Phase 3 this is the
existing persisted equivalent of `RESERVED`. Phase 3 does not alter the sealed
reservation table to rename status values; operational state is proven through
`hospitality_stays.status` and `hospitality_room_occupancies.status`.

## Product Manifest Delta

Phase 3 does not change ProductRegistry. It adds product-owned Hospitality
contracts underneath the existing `bella_hospitality` identity:

```text
Stay
Room Occupancy
Check-in / Check-out service
```

## Ownership Map

| Data / Contract | Owner | Phase 3 action |
| --- | --- | --- |
| `bella_hospitality` product key | Platform Product Registry | Reuse |
| Party identity | Platform Party | Reuse through Guest from Phase 2 |
| Property / Room Type / Room | Hospitality Product Phase 1 | Reuse sealed tables |
| Guest / Reservation / Reserved Room | Hospitality Product Phase 2 | Reuse sealed tables |
| Stay | Hospitality Product | Create product table and service contract |
| Room Occupancy | Hospitality Product | Create product table and service contract |
| Folio / Payment | Future Hospitality phases | Not started |
| Resource / Availability / Allocation kernel | Not created | Forbidden in this phase |

## Contract Dependency Map

```text
Tenant.product_key = bella_hospitality
  -> ProductRegistry / ProductResolver
  -> Hospitality Guest
  -> Hospitality Reservation
  -> Hospitality Reserved Room
  -> Hospitality Stay
  -> Hospitality Room Occupancy
```

The room occupancy rule is local Hotel front-office semantics. It is not a
cross-industry Resource kernel and it does not reuse Beauty H8, Healthcare bed,
Education classroom, or Logistics allocation internals.

## Change Authority

Authorized:

- New product-owned files under `src/products/bella-hospitality/`
- New additive migration creating `hospitality_stays` and
  `hospitality_room_occupancies`
- Focused tests for service contract, migration shape, tenant isolation, RLS,
  active occupancy conflict, check-in, and check-out

Not authorized:

- Healthcare H1-H12 files or `hc_*` tables
- Education kernel files
- Logistics E7.1/E7.2/E7.3 files
- Beauty H5/H8 files
- App route/UI files
- Finance/Folio/Payment files
- Travel/Tour files
- Global Resource / Availability / Allocation kernel

## UI -> Contract Reconciliation

No UI is modified in Phase 3.

## Additive Migration Plan

Create product-owned tables only:

```text
hospitality_stays
hospitality_room_occupancies
```

Each table:

- Has `tenant_id`
- Has RLS enabled
- Has authenticated/service role grants
- Uses additive `CREATE TABLE IF NOT EXISTS`
- Preserves reservation/room consistency through FKs and product-owned validation triggers

No migration modifies Platform, Beauty, Healthcare, Education, Logistics,
Finance, Folio, Payment, or Travel tables.

## 11 Automated Verification Gates Plan

1. Front Office service unit tests prove Check-in -> Active Stay -> Occupancy -> Check-out.
2. Migration shape test proves additive tables, RLS, grants, tenant ownership, and forbidden future tables are absent.
3. Real DB test applies the full Guest -> Reservation -> Reserved Room -> Check-in -> Stay -> Occupancy chain.
4. Real DB check-out test proves stay completion and occupancy release.
5. Real DB negative test proves active room occupancy conflict rejection and rollback.
6. Product identity regression tests prove `bella_hospitality` still resolves through ProductRegistry/ProductResolver.
7. Static architecture tests prove no cross-vertical imports and no Resource kernel / allocation engine.
8. `npm run arch:guard` protects sealed Logistics E7.1/E7.2/E7.3.
9. Scoped ESLint must pass without Phase 3 violations.
10. `npm run typecheck:changed` must pass with zero diagnostics.
11. `npm run db:migration:zero-downtime`, `npm run db:migration:check` with `BASE_REF=origin/main`, and `git diff --check` must pass.

## Decision

```ini
HOSPITALITY_PHASE3_FRONT_OFFICE_STAY = PASS
CHECK_IN = CREATED
STAY = CREATED
ROOM_OCCUPANCY = CREATED
CHECK_OUT = CREATED
FOLIO = NOT_STARTED
PAYMENT = NOT_STARTED
HOUSEKEEPING = NOT_STARTED
MAINTENANCE = NOT_STARTED
FNB = NOT_STARTED
TRAVEL = NOT_STARTED
RESOURCE_KERNEL = NOT_CREATED
ALLOCATION_ENGINE = NOT_CREATED
```
