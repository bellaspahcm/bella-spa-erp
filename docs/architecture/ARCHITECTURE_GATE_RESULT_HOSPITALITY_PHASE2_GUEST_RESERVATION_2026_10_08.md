# Architecture Gate Result - Hospitality Phase 2 Guest + Reservation

Date: 2026-10-08

## Result

```ini
GATE = PASS
PHASE = 2_GUEST_RESERVATION
CODE_AUTHORIZED = YES
DB_AUTHORIZED = YES
UI_AUTHORIZED = NO
ROUTE_IMPLEMENTATION_AUTHORIZED = NO
CHECK_IN_OUT_AUTHORIZED = NO
STAY_AUTHORIZED = NO
FOLIO_AUTHORIZED = NO
PAYMENT_AUTHORIZED = NO
HOUSEKEEPING_AUTHORIZED = NO
FNB_AUTHORIZED = NO
TRAVEL_AUTHORIZED = NO
RESOURCE_KERNEL_AUTHORIZED = NO
ALLOCATION_ENGINE_AUTHORIZED = NO
```

## Problem / Non-Goals

Phase 2 opens the next Hotel capability for `bella_hospitality`: a guest can
hold a reservation for a concrete room in a concrete property.

Authorized chain:

```text
Tenant
  -> Property
  -> Room Type / Room
  -> Guest
  -> Reservation
  -> Reserved Room
```

Non-goals:

- Check-in / check-out
- Stay
- Folio
- Payment
- Housekeeping
- F&B
- Travel / Tour
- Generic Resource / Availability / Allocation kernel
- Generic allocation engine

## Truth and Source of Truth

| Question | Source | Result |
| --- | --- | --- |
| Product identity | Phase 0 ProductRegistry / ProductResolver proof | `bella_hospitality` is sealed |
| Physical hotel foundation | Phase 1 Real DB / RLS proof | Property, Room Type, and Room are sealed |
| Resource kernel | `RESOURCE_AVAILABILITY_ALLOCATION_DECISION_2026_10_08.md` | Not created |
| Guest identity | Hospitality design gate | Party identity reused; Hospitality owns guest profile |
| Reservation semantics | User-approved Phase 2 boundary | Guest + Reservation + Reserved Room only |

## Business Test Contract

| Rule | Canonical source | Expected invariant |
| --- | --- | --- |
| Guest profile | Phase 2 boundary + Hospitality design | A Hospitality guest references one tenant-scoped Party identity |
| Reservation | Phase 2 boundary | A reservation belongs to one tenant, property, and primary guest |
| Reserved Room | Phase 2 boundary | A reserved room belongs to the same tenant/property/reservation and references a Phase 1 room type and room |
| Occupancy | Phase 1 room type contract | Adults + children must not exceed the room type max occupancy |
| Date range | Hotel reservation semantics | Check-out date must be after check-in date |
| Conflict | Hotel reservation semantics | The same room cannot be reserved for overlapping date ranges |
| Tenant isolation | Bella RLS contract | Tenant A cannot read Tenant B reservation rows through RLS |

## Product Manifest Delta

Phase 2 does not change ProductRegistry. It adds product-owned Hospitality
contracts underneath the existing `bella_hospitality` identity:

```text
Guest Profile
Reservation
Reserved Room
```

## Ownership Map

| Data / Contract | Owner | Phase 2 action |
| --- | --- | --- |
| `bella_hospitality` product key | Platform Product Registry | Reuse |
| Party identity | Platform Party | Reference through `party_parties.id` |
| Guest profile | Hospitality Product | Create product table and service contract |
| Property / Room Type / Room | Hospitality Product Phase 1 | Reuse sealed tables |
| Reservation | Hospitality Product | Create product table and service contract |
| Reserved Room | Hospitality Product | Create product table and service contract |
| Stay / Folio / Payment | Future Hospitality phases | Not started |
| Resource / Availability / Allocation kernel | Not created | Forbidden in this phase |

## Contract Dependency Map

```text
Tenant.product_key = bella_hospitality
  -> ProductRegistry / ProductResolver
  -> Platform Party identity
  -> Hospitality Guest profile
  -> Hospitality Property / Room Type / Room
  -> Hospitality Reservation
  -> Hospitality Reserved Room
```

The reservation conflict rule is local Hotel reservation semantics. It is not a
cross-industry Resource kernel and it does not reuse Beauty H8, Healthcare bed,
Education classroom, or Logistics allocation internals.

## Change Authority

Authorized:

- New product-owned files under `src/products/bella-hospitality/`
- New additive migration creating `hospitality_guests`,
  `hospitality_reservations`, and `hospitality_reservation_rooms`
- Focused tests for service contract, migration shape, tenant isolation, RLS,
  room conflict, and architecture boundary

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

No UI is modified in Phase 2.

## Additive Migration Plan

Create product-owned tables only:

```text
hospitality_guests
hospitality_reservations
hospitality_reservation_rooms
```

Each table:

- Has `tenant_id`
- Has RLS enabled
- Has authenticated/service role grants
- Uses additive `CREATE TABLE IF NOT EXISTS`
- Preserves hierarchy consistency through FKs and product-owned validation triggers

No migration modifies Platform, Beauty, Healthcare, Education, Logistics, or
Finance tables.

## 11 Automated Verification Gates Plan

1. Guest + Reservation service unit tests prove the Tenant -> Property -> Guest -> Reservation -> Reserved Room chain.
2. Migration shape test proves additive tables, RLS, grants, tenant ownership, and forbidden future tables are absent.
3. Real DB test applies the product chain and proves persisted read-back.
4. RLS proof verifies same-tenant visibility and cross-tenant invisibility for reservations.
5. Real DB negative tests prove room/property mismatch, occupancy overflow, and overlapping room reservation rejection.
6. Product identity regression tests prove `bella_hospitality` still resolves through ProductRegistry/ProductResolver.
7. Static architecture tests prove no cross-vertical imports and no Resource kernel / allocation engine.
8. `npm run arch:guard` protects sealed Logistics E7.1/E7.2/E7.3.
9. Scoped ESLint must pass without Phase 2 violations.
10. `npm run typecheck:changed` must pass with zero diagnostics.
11. `npm run db:migration:zero-downtime`, `npm run db:migration:check` with `BASE_REF=origin/main`, and `git diff --check` must pass.

## Decision

```ini
HOSPITALITY_PHASE2_GUEST_RESERVATION = PASS
GUEST = CREATED
RESERVATION = CREATED
RESERVED_ROOM = CREATED
CHECK_IN_OUT = NOT_STARTED
STAY = NOT_STARTED
FOLIO = NOT_STARTED
PAYMENT = NOT_STARTED
HOUSEKEEPING = NOT_STARTED
FNB = NOT_STARTED
TRAVEL = NOT_STARTED
RESOURCE_KERNEL = NOT_CREATED
ALLOCATION_ENGINE = NOT_CREATED
```
