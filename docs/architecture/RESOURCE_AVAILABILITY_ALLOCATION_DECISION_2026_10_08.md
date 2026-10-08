# Resource / Availability / Allocation Architecture Decision

**Date:** 2026-10-08
**Status:** ADOPTED BOUNDARY - NO RUNTIME IMPLEMENTATION
**Scope:** Cross-industry Resource / Availability / Allocation decision after Hospitality OS audit
**Related audit:** Hospitality OS Foundation Audit
**Code authority:** NONE

## Decision

```ini
HOSPITALITY_OS_READINESS = PARTIAL
OS_GAP_REQUIRES_DECISION = TRUE
CODE_REQUIRED_NOW = NO
HOSPITALITY_PRODUCT_BUILD = STOP

CROSS_INDUSTRY_RESOURCE_KERNEL = NOT_CREATED
SELECTED_OPTION = OPTION_C_DOMAIN_SPECIFIC_WITH_INTEGRATION_BOUNDARY
```

Bella will not promote Beauty H8 allocation, Healthcare bed allocation, Education classroom scheduling, Logistics inventory allocation, or any Hospitality candidate into a global Resource / Availability / Allocation kernel at this time.

The current boundary is:

```text
Beauty H8 Resource Allocation   -> remains Beauty OS
Healthcare Bed/OR/Bay           -> remains Healthcare OS through public contracts
Education Classroom/Room        -> remains Education/Product contract until proven otherwise
Logistics Inventory Allocation  -> remains Logistics OS inventory semantics
Hospitality Room/Vehicle/Guide  -> NOT STARTED

Cross-domain reuse              -> integration boundary only, not shared runtime kernel
```

## Why

The Hospitality audit found reusable Platform and OS capabilities for tenant, organization, party identity, finance, inventory, audit, and notification patterns. It did not prove a canonical cross-industry Resource / Availability / Allocation contract.

The term `Resource` is shared language, but the business semantics diverge:

```text
Hotel room        != Beauty room
Beauty room       != Hospital bed
Hospital bed      != Classroom
Classroom         != Vehicle
Vehicle           != Tour guide
```

Similarity of nouns is not enough to create an OS kernel. A shared kernel is allowed only when semantic equivalence is proven across real workflows.

## Prior Evidence Reconciliation

Existing H5 documents freeze Resource Allocation as a Beauty OS capability:

- `H5.1` found legacy `booking_resources` / `session_logs.booking_resource_id` is only a partial fit.
- `H5.2` found structural gaps for interval allocation, reallocation history, capacity-N, and affected-allocation recovery.
- `H5.3` selected a dedicated Beauty OS build, not legacy reuse.
- `H5.4` froze the Beauty Resource Allocation boundary and explicitly kept appointment lifecycle, service definition, resource maintenance, finance, and accounting outside that contract.

This decision does not undo H5. It narrows H5:

```text
H5 Beauty Resource Allocation boundary
  = valid for Beauty OS only
  != evidence for a cross-industry Resource kernel
```

## Options Considered

### Option A - Promote Beauty H8 Allocation

**Decision:** REJECTED NOW

Beauty H8 allocation models service commitments, segments, interval capacity consumption, reallocation, and history for Beauty workflows. That is useful evidence for Beauty. It does not prove hotel multi-night stay inventory, hospital bed clinical constraints, classroom academic scheduling, vehicle tour capacity, or tour guide allocation.

Promotion would risk semantic distortion and cross-domain exceptions.

### Option B - Create New Canonical OS Resource Kernel

**Decision:** DEFERRED

A new kernel may become valid later, but current evidence is insufficient. Creating it now would require guessing a lowest-common-denominator model or building a generalized scheduling system before business semantics are proven.

Both paths violate Bella's reuse-before-create and no-speculative-abstraction rules.

### Option C - Keep Domain-Specific and Define Integration Boundary

**Decision:** SELECTED

Each domain keeps ownership of its resource semantics. Cross-domain needs may be handled later through explicit integration events, translation contracts, or reporting projections. No domain is allowed to directly consume another domain's internal allocation tables or frozen kernel internals.

## Four Use-Case Gate

A future shared Resource / Availability / Allocation kernel may be reconsidered only if one proposed contract can represent all four use cases without hacks, exception fields, or direct access to another OS's internal tables.

| Use case | Current owner | Required semantic proof before promotion | Current result |
| --- | --- | --- | --- |
| Beauty room / nail station | Beauty OS | service segment, interval, capacity units, reallocation lifecycle, allocation history | DOMAIN-SPECIFIC |
| Hospital bed | Healthcare OS | clinical admission/transfer/discharge, encounter boundary, H1-H12 public contracts, no direct `hc_*` access | DOMAIN-SPECIFIC |
| Education classroom | Education/Product boundary | class session, academic calendar, room availability, branch/tenant rules, no Healthcare coupling | DOMAIN-SPECIFIC / NOT_PROVEN_SHARED |
| Hotel room | Future Hospitality | room type, room inventory, multi-night stay, reservation item, modification, cancellation, no-show, group booking, folio linkage | NOT_STARTED |

If any future proposed contract needs domain-specific switch statements to preserve these semantics, it must not become a global OS kernel.

## Integration Boundary

The only cross-domain boundary allowed now is integration, not shared ownership.

Allowed later:

```text
Domain allocation event
  -> integration contract
  -> reporting / orchestration / reconciliation consumer
```

Not allowed:

```text
Product or OS A
  -> direct query to OS B internal resource tables
```

Not allowed:

```text
Beauty allocation schema
  -> renamed as Platform Resource kernel
```

## Hospitality Boundary

Hospitality remains valid as a future product, but it is not authorized for build.

```ini
BELLA_HOSPITALITY_PRODUCT = NOT_STARTED
HOSPITALITY_UI = NOT_STARTED
HOSPITALITY_DB = NOT_STARTED
HOSPITALITY_PRODUCT_REGISTRY_ENTRY = NOT_AUTHORIZED_NOW
```

Future Hospitality discovery may reuse:

- tenant and product identity rules
- organization / branch / property ownership primitives where semantically proven
- Party identity for guest, traveler, supplier, employee, partner, and organization roles
- Finance receivable/payment contracts where folio/accounting semantics are proven
- Logistics inventory for consumable goods where inventory semantics apply
- audit, notification, workflow, and reporting patterns through public boundaries

Future Hospitality must prove locally:

- hotel room / room type / property semantics
- reservation and stay lifecycle
- group booking, modification, cancellation, no-show
- guest folio operational semantics
- travel/tour resource semantics for vehicle, guide, activity, supplier

## Promotion Criteria

Before opening Option A or B again, Bella must have evidence for each item:

1. Canonical business semantics for all four use cases.
2. Contract to implementation to DB/RLS to tests to real usage trace.
3. Tenant, branch/property, and ownership rules.
4. Capacity model: exclusive, shared, capacity-N, pooled, and multi-day.
5. Availability model: maintenance, outage, closure, and temporary unavailability.
6. Allocation model: create, modify, transfer, release, cancel, no-show, and recovery.
7. History model: durable allocation identity and replacement chain.
8. Public contract access only; no frozen Healthcare/Education/Logistics kernel modifications.
9. No `any`, no schema invention, no compatibility aliases to force reuse.
10. Affected-product verification across Beauty, Healthcare, Education, and Hospitality candidate flows.

Until then:

```text
NOT_PROVEN_SHARED != BLOCKED_PRODUCT_FOREVER
NOT_PROVEN_SHARED == DO_NOT_PROMOTE_TO_OS_KERNEL
```

## Final Boundary

```text
RESOURCE_ALLOCATION_DECISION = OPTION_C_DOMAIN_SPECIFIC_WITH_INTEGRATION_BOUNDARY
OS_RESOURCE_KERNEL = NOT_CREATED
HOSPITALITY_BUILD = STOP
CODE_REQUIRED_NOW = NO
```
