# Architecture Gate Result - Hospitality Phase 1 Hotel Property + Room

Date: 2026-10-08

## Result

```ini
GATE = PASS
PHASE = 1_HOTEL_PROPERTY_ROOM
CODE_AUTHORIZED = YES
DB_AUTHORIZED = YES
UI_AUTHORIZED = NO
ROUTE_IMPLEMENTATION_AUTHORIZED = NO
RESERVATION_AUTHORIZED = NO
GUEST_AUTHORIZED = NO
STAY_AUTHORIZED = NO
FOLIO_AUTHORIZED = NO
PAYMENT_AUTHORIZED = NO
HOUSEKEEPING_AUTHORIZED = NO
TRAVEL_AUTHORIZED = NO
RESOURCE_KERNEL_AUTHORIZED = NO
```

## Problem / Non-Goals

Phase 1 opens the first Hotel capability for `bella_hospitality`: the physical
hotel foundation.

Authorized chain:

```text
Product
  -> Tenant ownership
  -> Property
  -> Building
  -> Floor
  -> Room Type
  -> Room
```

Non-goals:

- Reservation
- Guest
- Check-in / check-out
- Stay
- Folio
- Payment
- Housekeeping
- F&B
- Travel / Tour
- Cross-industry Resource / Availability / Allocation kernel

## Truth and Source of Truth

| Question | Source | Result |
| --- | --- | --- |
| Product identity | Phase 0 ProductRegistry / ProductResolver proof | `bella_hospitality` is sealed |
| Resource kernel | `RESOURCE_AVAILABILITY_ALLOCATION_DECISION_2026_10_08.md` | Not created |
| Phase 1 domain truth | User-approved Phase 1 boundary | Hotel physical hierarchy only |
| DB ownership | Bella Engineering Constitution | Product-owned additive tables |
| Tenant isolation | Bella RLS contract | Every table includes `tenant_id` and RLS |

## Product Manifest Delta

Phase 1 does not change the ProductRegistry manifest. It implements the first
product-owned Hotel foundation tables and service contracts underneath the
already registered `bella_hospitality` identity.

## Ownership Map

| Data / Contract | Owner | Phase 1 action |
| --- | --- | --- |
| `bella_hospitality` product key | Platform Product Registry | Reuse |
| Property | Hospitality Product | Create product table and service contract |
| Building | Hospitality Product | Create product table and service contract |
| Floor | Hospitality Product | Create product table and service contract |
| Room Type | Hospitality Product | Create product table and service contract |
| Room | Hospitality Product | Create product table and service contract |
| Reservation / Stay / Folio / Payment | Future Hospitality phases | Not started |
| Resource / Availability / Allocation kernel | Not created | Forbidden in this phase |

## Contract Dependency Map

```text
Tenant.product_key = bella_hospitality
  -> ProductRegistry / ProductResolver
  -> Hospitality Product service
  -> hospitality_properties
  -> hospitality_buildings
  -> hospitality_floors
  -> hospitality_room_types
  -> hospitality_rooms
```

The Product service owns this physical hierarchy. It does not call Beauty H8,
Healthcare bed allocation, Education classroom scheduling, or Logistics kernel
internals.

## Change Authority

Authorized:

- New product-owned files under `src/products/bella-hospitality/`
- New additive migration creating `hospitality_*` product tables
- Focused tests for service contract, migration shape, tenant isolation, and architecture boundary

Not authorized:

- Healthcare H1-H12 files or `hc_*` tables
- Education kernel files
- Logistics E7.1/E7.2/E7.3 files
- Beauty H5/H8 files
- App route/UI files
- ProductRegistry changes beyond already sealed Phase 0

## UI -> Contract Reconciliation

No UI is modified in Phase 1.

## Additive Migration Plan

Create product-owned tables only:

```text
hospitality_properties
hospitality_buildings
hospitality_floors
hospitality_room_types
hospitality_rooms
```

Each table:

- Has `tenant_id`
- Has RLS enabled
- Has authenticated/service role grants
- Uses additive `CREATE TABLE IF NOT EXISTS`
- Uses product-local foreign keys to preserve hierarchy consistency

No migration modifies Platform, Beauty, Healthcare, Education, or Logistics
tables.

## 11 Automated Verification Gates Plan

1. Product service unit tests prove the Property -> Building -> Floor -> Room Type -> Room chain.
2. Migration shape test proves additive tables, RLS, grants, tenant ownership, and forbidden non-goal tables are absent.
3. Real DB test applies the product hierarchy and proves tenant-scoped reads.
4. RLS proof verifies same-tenant visibility and cross-tenant invisibility for rooms.
5. Static architecture test proves no cross-vertical imports or forbidden runtime concepts.
6. Product identity regression tests prove `bella_hospitality` still resolves through ProductRegistry/ProductResolver.
7. `npm run arch:guard` protects sealed Logistics E7.1/E7.2/E7.3.
8. Scoped ESLint must pass without Phase 1 violations.
9. `npm run typecheck:changed` must pass with zero diagnostics.
10. `npm run db:migration:zero-downtime` must pass for the additive Hospitality migration.
11. `npm run db:migration:check` with `BASE_REF=origin/main` must show no new drift beyond the existing baseline, and `git diff --check` must pass.

## Decision

```ini
HOSPITALITY_PHASE1_PROPERTY_ROOM = PASS
PROPERTY = CREATED
BUILDING = CREATED
FLOOR = CREATED
ROOM_TYPE = CREATED
ROOM = CREATED
RESERVATION = NOT_STARTED
GUEST = NOT_STARTED
STAY = NOT_STARTED
FOLIO = NOT_STARTED
PAYMENT = NOT_STARTED
TRAVEL = NOT_STARTED
RESOURCE_KERNEL = NOT_CREATED
```
