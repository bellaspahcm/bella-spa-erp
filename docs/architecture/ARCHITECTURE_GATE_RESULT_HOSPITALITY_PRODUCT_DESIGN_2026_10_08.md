# ARCHITECTURE GATE RESULT — Bella Hospitality Product Design

Date: 2026-10-08

Status: **PASS_FOR_PRODUCT_DESIGN_ONLY**

Related boundary:

- `docs/architecture/RESOURCE_AVAILABILITY_ALLOCATION_DECISION_2026_10_08.md`

This document records the first product architecture design for future `bella_hospitality` after the Hospitality OS audit and Resource / Availability / Allocation decision were sealed. It does not authorize runtime code, ProductRegistry registration, UI routes, database migrations, tests, or production-readiness claims.

## 1. Bella OS / Product Development Process Gate

| Gate | Result | Evidence / decision |
| --- | --- | --- |
| Problem | PASS | Design one future Hospitality product after OS audit, without building it yet. |
| Truth / Source of Truth | PARTIAL | User-provided Hospitality target workflow + sealed OS audit boundary + sealed Resource / Availability / Allocation decision. Runtime business semantics remain unimplemented. |
| Ownership | PASS_FOR_DESIGN | Hospitality owns hotel/travel product semantics. Platform, Party, Finance, Logistics, Audit, Tenant/RLS remain reused capabilities through public boundaries. |
| Reuse Analysis | PASS_FOR_DESIGN | Reuse existing OS capabilities where semantics are proven; do not promote Beauty/Hospital/Education/Logistics resource models into a global kernel. |
| Canonical Contracts | PARTIAL | Target contracts are named for future work, but no Hospitality public contracts exist yet. |
| Boundary & Data Flow | PASS_FOR_DESIGN | Product-specific Hospitality semantics stay inside `bella_hospitality`; OS integration is through public contracts only. |
| Change Authority | DESIGN_ONLY | The current request authorizes architecture documentation only. |
| Minimal Implementation Plan | DEFER | Future implementation must start with product identity + Hotel MVP chain, not the full product surface. |
| Verification Plan | FUTURE | Verification gates are defined below as future requirements. No verification is required for this docs-only decision. |

## 2. Product Manifest

Proposed future product identity:

```text
productKey: bella_hospitality
displayName: Bella Hospitality
subtitle: Hospitality & Travel Operations
requiredModules: [platform_foundation, party, finance, logistics_inventory]
serviceProfile: hospitality
defaultRoute: /dashboard/hospitality
navigationProfile: hospitality
```

Product shape:

```text
BELLA PRODUCT
  bella_hospitality
    ├── Hotel / Resort / Property
    └── Travel / Tourism
```

Rejected split identities:

```text
bella_hotel
bella_resort
bella_travel
```

Reason: Hotel and Travel are domains inside one Hospitality product. They are not separate product identities unless future tenant/product evidence proves a need.

Current status:

```ini
PRODUCT_REGISTRY_ENTRY = NOT_CREATED
HOSPITALITY_RUNTIME = NOT_STARTED
HOSPITALITY_UI = NOT_STARTED
HOSPITALITY_DB = NOT_STARTED
```

## 3. Architecture Boundary

```text
BELLA PLATFORM
  ├── Tenant / RLS
  ├── Product Registry / Product Resolver
  ├── Organization / Branch / Property ownership primitives
  ├── Party / People identity
  ├── Finance receivable / payment primitives
  ├── Logistics inventory primitives
  ├── Audit / Notification / Workflow patterns
  └── bella_hospitality product
        ├── Hotel domain
        └── Travel domain
```

Hospitality must reuse OS capabilities by public contract. It must not modify frozen Healthcare, Education, or Logistics kernels to make Hospitality easier.

The sealed Resource / Availability / Allocation decision remains active:

```ini
CROSS_INDUSTRY_RESOURCE_KERNEL = NOT_CREATED
SELECTED_OPTION = OPTION_C_DOMAIN_SPECIFIC_WITH_INTEGRATION_BOUNDARY
```

Therefore:

```text
Hotel room allocation      -> Hospitality semantics
Vehicle / guide assignment -> Hospitality Travel semantics
Beauty room allocation     -> Beauty OS semantics
Hospital bed allocation    -> Healthcare OS semantics
Classroom allocation       -> Education/Product semantics
Inventory allocation       -> Logistics OS semantics
```

## 4. Ownership Map

| Capability / Data | Owner | Hospitality role | Design decision |
| --- | --- | --- | --- |
| Product identity | Platform Product Registry | Future product registration | DESIGN_ONLY / NOT_CREATED |
| Tenant / RLS / auth context | Platform | Consume | REUSE_EXISTING |
| Organization / property ownership graph | Platform organization + Hospitality product extension | Consume / extend only for property semantics | REUSE_WITH_PRODUCT_EXTENSION |
| Party identity | Platform Party | Consume for guest, traveler, supplier, employee, partner, organization | REUSE_EXISTING |
| Guest profile/history | Hospitality Product | Own product-specific role/profile/history | HOSPITALITY_PRODUCT_ONLY |
| Property / building / floor / room type / room / bed / amenity | Hospitality Product | Own | HOSPITALITY_PRODUCT_ONLY |
| Reservation / stay / check-in / check-out | Hospitality Product | Own | HOSPITALITY_PRODUCT_ONLY |
| Folio / folio item | Hospitality Product | Own operational account semantics | HOSPITALITY_PRODUCT_ONLY |
| Receivable / invoice / payment allocation | Finance OS | Consume | REUSE_EXISTING_AFTER_CONTRACT_PROOF |
| Consumable inventory | Logistics OS | Consume where item/location inventory semantics apply | REUSE_EXISTING_AFTER_CONTRACT_PROOF |
| Housekeeping task | Hospitality Product first; possible workflow integration later | Own initial semantics | DEFER |
| Maintenance work order | Hospitality Product first; possible workflow integration later | Own initial semantics | DEFER |
| F&B order | Future Hospitality domain | Own order semantics; consume inventory and folio/payment paths | DEFER |
| Tour / itinerary / departure / traveler booking | Hospitality Travel domain | Own | DEFER |
| Guide / transport / supplier assignment | Hospitality Travel domain | Own domain-specific semantics | DEFER |

## 5. Contract Dependency Map

Allowed future dependency direction:

```text
Bella Hospitality Product
  -> Platform Product Registry / Tenant Resolver
  -> Platform Organization / Party contracts
  -> Hospitality Product contracts
       -> Property
       -> Room Inventory
       -> Reservation
       -> Stay
       -> Folio
  -> Finance public contracts
       -> Receivable
       -> Payment
       -> Allocation
  -> Logistics public contracts
       -> Item
       -> Inventory
       -> Movement / allocation only when inventory semantics apply
```

Not allowed:

```text
Hospitality Product
  -> Beauty internal allocation tables
  -> Healthcare internal `hc_*` tables
  -> Education kernel internals
  -> Logistics sealed kernel internals
```

## 6. Hotel Domain Design

Hotel is the first domain and should be built before Travel.

### Property Core

```text
Property
  ├── Building
  ├── Floor
  ├── Room Type
  ├── Room
  ├── Bed
  ├── Amenity
  └── Property Configuration
```

Design notes:

- Property and room semantics are Hospitality-owned.
- Organization/branch primitives may be reused for ownership and tenant context, but they do not become room inventory.
- Room, room type, and bed are not Beauty resources, Healthcare beds, or Logistics inventory items.

### Reservation Core

Hospitality must not directly reuse legacy Spa `bookings` as the canonical reservation model.

Minimal reservation semantics:

```text
Reservation
  ├── Guest
  ├── Property
  ├── Room Type
  ├── Room
  ├── Check-in Date
  ├── Check-out Date
  ├── Adults
  ├── Children
  ├── Rate Plan
  ├── Price
  ├── Status
  ├── Source
  └── Notes
```

Minimal statuses:

```text
INQUIRY
CONFIRMED
CHECKED_IN
CHECKED_OUT
CANCELLED
NO_SHOW
```

Do not add a broad status machine until operational evidence proves each state.

### Front Office Core

```text
Reservation
  -> Arrival
  -> Check-in
  -> Stay
  -> Room / Services
  -> Folio
  -> Payment
  -> Check-out
```

Check-in must prove:

- Guest
- Reservation
- Room
- actual arrival
- identity/document evidence when required
- deposit/payment handoff when required

MVP should avoid over-engineered multi-stay modeling unless a real workflow proves it.

### Guest

Hospitality uses Party identity and adds Hospitality-owned guest semantics:

```text
Party
  -> Guest Role
  -> Guest Profile
  -> Reservation
  -> Stay History
```

Guest history may include:

```text
Reservations
Stays
Services
Folios
Payments
Preferences
```

### Folio

Folio is a Hospitality operational account, not a Finance ledger replacement.

```text
Guest / Room Stay
  -> Folio
       ├── Room Charge
       ├── F&B
       ├── Service
       ├── Extra Charge
       ├── Discount
       └── Adjustment
            -> Receivable
            -> Payment
```

Boundary:

```text
Hospitality owns Folio semantics.
Finance OS owns receivable, payment, ledger, and accounting primitives.
```

### Housekeeping

Housekeeping is not part of first Hotel Core implementation, but the architecture reserves it:

```text
Room
  -> Housekeeping Task
       ├── CLEANING
       ├── INSPECTION
       ├── MAINTENANCE_REQUEST
       └── STATUS_UPDATE
```

Minimal future room statuses:

```text
AVAILABLE
OCCUPIED
DIRTY
CLEAN
INSPECTED
OUT_OF_ORDER
```

### Maintenance

```text
Asset / Room
  -> Maintenance Request
  -> Work Order
  -> Technician
  -> Completion
```

Do not create a Maintenance OS for Hospitality MVP.

### Rate and Revenue

```text
Room Type
  -> Rate Plan
  -> Price
  -> Reservation
```

MVP rate plan examples:

```text
BAR
WEEKDAY
WEEKEND
SEASONAL
```

Revenue optimization and dynamic pricing are deferred.

### F&B

F&B is after Hotel Core:

```text
Restaurant / Cafe / Bar / Room Service / Banquet
  -> F&B Order
  -> Folio
  -> Payment
```

Consumable goods should reuse Logistics inventory only where inventory semantics are proven.

## 7. Travel Domain Design

Travel / Tourism starts after Hotel Core is sealed.

```text
Tour Product
  -> Itinerary
  -> Departure
  -> Traveler
  -> Booking
  -> Payment
```

Tour semantics:

```text
Tour
  ├── Destination
  ├── Itinerary
  ├── Duration
  ├── Activities
  ├── Price
  ├── Capacity
  └── Terms
```

Departure semantics:

```text
Tour
  ├── Departure 1
  ├── Departure 2
  └── Departure N
```

Traveler:

```text
Party
  -> Traveler Role
  -> Tour Booking
```

Supplier / Guide / Transport remain Travel-domain semantics:

```text
Supplier
  ├── Hotel
  ├── Restaurant
  ├── Transport
  ├── Activity Provider
  └── Local Operator

Guide
  ├── Profile
  ├── Qualification
  ├── Availability
  └── Assignment

Transport
  ├── Vehicle
  ├── Provider
  ├── Capacity
  └── Assignment
```

These must not be promoted into a global Resource kernel without a separate architecture decision.

## 8. First Hospitality Business Chain

Only one Hotel MVP chain should be sealed first:

```text
Guest
  -> Reservation
  -> Room Allocation
  -> Check-in
  -> Stay
  -> Charge
  -> Folio
  -> Payment
  -> Check-out
  -> Guest History
```

This chain is the first target for future implementation and evidence.

Do not build Housekeeping, Maintenance, F&B, Revenue Optimization, Travel, Tour, Supplier, Guide, or Transport before this chain has contract, runtime, DB/RLS, browser, and evidence closure.

## 9. Future Database Boundary

No migration is authorized now.

Future MVP migration planning may begin with:

```text
hospitality_properties
hospitality_buildings
hospitality_floors
hospitality_room_types
hospitality_rooms

hospitality_rate_plans
hospitality_reservations
hospitality_stays

hospitality_folios
hospitality_folio_items
```

Deferred table groups:

```text
housekeeping
maintenance
fnb
travel
tour
departure
guide
transport
supplier
```

Rules for any future migration:

- Tenant-scoped.
- RLS enabled.
- Additive only.
- Product-owned tables only.
- No direct FK to another OS's internal persistence unless the owning contract explicitly allows it.
- No duplicate Platform Party identity, Finance ledger, Logistics inventory, Healthcare bed, or Education classroom ownership.

## 10. Future Route Boundary

No route is authorized now.

Future route plan:

```text
/dashboard/hospitality
/dashboard/hospitality/properties
/dashboard/hospitality/reservations
/dashboard/hospitality/front-office
/dashboard/hospitality/rooms
/dashboard/hospitality/guests
/dashboard/hospitality/folios
```

Future Travel routes under the same product:

```text
/dashboard/hospitality/travel
/dashboard/hospitality/travel/tours
/dashboard/hospitality/travel/departures
/dashboard/hospitality/travel/bookings
```

Do not create platform-level `/dashboard/hotel` or `/dashboard/travel` routes as separate product identities.

## 11. Build Sequence

Future build order:

```text
PHASE 0  Product identity + product contract
PHASE 1  Property / Room
PHASE 2  Guest / Reservation
PHASE 3  Front Office
PHASE 4  Folio / Payment
PHASE 5  Full Hotel Core E2E
          -> SEAL HOTEL CORE
PHASE 6  Housekeeping
PHASE 7  Maintenance / F&B
PHASE 8  Travel / Tour
```

Target for first implementation:

```text
Guest books room
  -> room is allocated
  -> guest checks in
  -> charge is posted to folio
  -> payment is recorded
  -> guest checks out
  -> guest history is preserved
```

## 12. 11 Automated Verification Gates Plan

Future implementation must define and pass these gates for each phase before closure:

| Gate | Future Hospitality evidence required | Current status |
| --- | --- | --- |
| 1 Architecture Compliance | Product boundary, no cross-OS internal table access, no speculative Resource kernel | DESIGN_ONLY |
| 2 Product Identity | ProductRegistry / ProductResolver tests for `bella_hospitality` | NOT_STARTED |
| 3 Contract Boundary | Product consumes Platform/Party/Finance/Logistics through public contracts | NOT_STARTED |
| 4 Tenant Isolation | Real DB cross-tenant negative tests | NOT_STARTED |
| 5 RLS & Authorization | Tenant/property/role-scoped DB proof | NOT_STARTED |
| 6 Migration Safety | Additive product-only migration scan | NOT_STARTED |
| 7 Hotel Chain Runtime | Guest -> Reservation -> Room -> Check-in -> Stay -> Folio -> Payment -> Check-out | NOT_STARTED |
| 8 Finance Boundary | Folio -> receivable/payment handoff without accounting invention | NOT_STARTED |
| 9 Inventory Boundary | F&B/consumable inventory through Logistics public contract when in scope | DEFER |
| 10 Browser E2E | Full Hotel Core user journey | NOT_STARTED |
| 11 Regression / Kernel Guard | No Healthcare/Education/Logistics/Beauty regression or frozen kernel changes | NOT_STARTED |

## 13. Decision

**PASS_FOR_PRODUCT_DESIGN_ONLY**

This design is sealed as the target architecture for future `bella_hospitality` planning:

```ini
BELLA_HOSPITALITY_DESIGN = SEALED_FOR_PLANNING
PRODUCT_MODEL = ONE_PRODUCT_TWO_DOMAINS
HOTEL_CORE_FIRST = TRUE
TRAVEL_AFTER_HOTEL_CORE = TRUE
OS_RESOURCE_KERNEL = NOT_CREATED
IMPLEMENTATION_AUTHORIZED = NO
MIGRATION_AUTHORIZED = NO
ROUTE_AUTHORIZED = NO
PRODUCT_REGISTRY_AUTHORIZED = NO
```

Next valid action, only when explicitly requested later:

```text
PHASE 0 Hospitality Product Identity + Product Contract Gate
  -> ProductRegistry proposal
  -> ProductResolver tests
  -> no runtime UI
  -> no DB migrations
```

Stop boundary for this document:

```text
ARCHITECTURE_DESIGN_ONLY — NO CODE REQUIRED
```
