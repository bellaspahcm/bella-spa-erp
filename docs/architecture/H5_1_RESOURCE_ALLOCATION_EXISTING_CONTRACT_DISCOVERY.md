# H5.1 — Resource Allocation Existing-Contract Discovery

**Status:** COMPLETE — discovery only
**Parent decision:** H4.2 Resource Allocation ownership = `BEAUTY_OS` (`17f778f4`)
**Scope:** Find existing Resource Allocation contract or implementation candidates and compare their semantic fit.
**Explicit non-scope:** No interface design, schema change, migration, contract inventory change, or implementation.

## Guardrails

```yaml
H5_1:
  capability: RESOURCE_ALLOCATION
  owner_baseline: BEAUTY_OS
  activity: EXISTING_CONTRACT_DISCOVERY
  contract_design_authorized: false
  schema_design_authorized: false
  migration_authorized: false
  inventory_change_authorized: false
```

The H4.2 ownership result is the starting boundary, not proof that an existing contract fits. Legacy code is evidence of behavior and gaps; ADR prose is evidence of prior intent unless the referenced contract and tests are present and verified.

## Candidate Inventory

| Candidate | Evidence status | What it proves | What it does not prove |
| --- | --- | --- | --- |
| `src/core/services/order/booking-resource-schedule-guard.ts` | `IMPLEMENTED_AND_VERIFIED` | Resource status gating and active same-resource/session/date/time conflict checks used by create/update/reschedule flows | Beauty OS contract boundary, interval overlap, capacity-N, resource pools, reallocation lifecycle, affected-allocation discovery |
| `src/services/booking-resource-actions.ts` | `IMPLEMENTED_AND_VERIFIED` | Tenant-scoped resource master CRUD and audit of resource CRUD actions | Allocation truth or old/new allocation history |
| `booking_resources` plus `session_logs.booking_resource_id` migrations | `IMPLEMENTED_AND_VERIFIED` | Tenant-scoped resource identity/status/capacity field and resource reference on an individual session | Segment allocation model, time-window allocation ledger, capacity consumption, replacement chain |
| `IResourceAllocation` references in H1/ADR documents | `DOCUMENTED_DESIGN` | Previous architecture intent for a Beauty resource contract and multi-resource pattern | A current verified interface, implementation, compatibility, or approved inventory decision |
| Healthcare bed/bay/OR implementations | `IMPLEMENTED_AND_VERIFIED` | Non-Beauty resource patterns and constraints used as reconciliation evidence | Reuse of Healthcare contracts inside Beauty OS |

The existing repository contains no verified Beauty OS `IResourceAllocation` implementation artifact in the inspected source tree. The strongest current candidate is the distributed `booking-resource` path, not a single extracted contract.

## Semantic-Fit Matrix

The comparison uses the nine invariants frozen in H4.2. `MATCH` means the candidate directly expresses the invariant; `PARTIAL` means only a narrower form is present; `NOT_FOUND` means no evidence was found.

| Frozen invariant | Legacy booking-resource path | Evidence | Fit note |
| --- | --- | --- | --- |
| `RESOURCE_IDENTITY` | `MATCH` | `IMPLEMENTED_AND_VERIFIED` | `booking_resources` has tenant-scoped resource identity and type/status. |
| `FINITE_CAPACITY` | `PARTIAL` | `IMPLEMENTED_NOT_VERIFIED` | A bounded `capacity` field exists, but the guard enforces duplicate same-slot conflict rather than capacity consumption. |
| `SERVICE_SEGMENT_COMMITMENT` | `PARTIAL` | `IMPLEMENTED_NOT_VERIFIED` | A session references one resource; Haircut requires segment-level commitments and may change resource by segment. |
| `TEMPORAL_ALLOCATION` | `PARTIAL` | `IMPLEMENTED_NOT_VERIFIED` | Date/time fields are checked, but verified interval duration allocation is absent. |
| `AVAILABILITY_CONSTRAINT` | `MATCH` | `IMPLEMENTED_AND_VERIFIED` | Resource status is checked before schedule conflict validation. |
| `CAPACITY_CONFLICT` | `PARTIAL` | `IMPLEMENTED_AND_VERIFIED` | Same-resource active conflict is blocked, but pooled capacity and capacity-N behavior are not proven. |
| `REALLOCATION` | `PARTIAL` | `IMPLEMENTED_NOT_VERIFIED` | Update/reschedule can persist a different resource after validation; no dedicated disruption/replacement lifecycle is proven. |
| `ALLOCATION_HISTORY` | `NOT_FOUND` | `NOT_FOUND` | Resource CRUD audit exists, but no old/new allocation chain for a service commitment was found. |
| `AFFECTED_ALLOCATION_DISCOVERY` | `NOT_FOUND` | `NOT_FOUND` | No resource-unavailable event path discovers all affected future allocations. |

## Legacy Contract-Intent Reconciliation

The H1 and ADR documents describe `IResourceAllocation` as a planned Beauty contract and mention methods such as resource assignment, conflict checks, and optimization. Those references cannot be promoted to current contract evidence without a source interface, implementation, and verified test set. They remain `DOCUMENTED_DESIGN` and must not drive a reuse decision by themselves.

This distinction is material:

```text
Legacy implementation
  booking_resources + session_logs.booking_resource_id
  + schedule guard
        ≠
Verified Beauty OS contract
        ≠
Haircut target semantic capability
```

## H5.1 Finding

```yaml
H5_1_finding:
  existing_verified_beauty_contract: NOT_FOUND
  existing_legacy_implementation: FOUND
  strongest_candidate: DISTRIBUTED_BOOKING_RESOURCE_PATH
  semantic_fit: PARTIAL
  verified_invariants:
    match:
      - RESOURCE_IDENTITY
      - AVAILABILITY_CONSTRAINT
    partial:
      - FINITE_CAPACITY
      - SERVICE_SEGMENT_COMMITMENT
      - TEMPORAL_ALLOCATION
      - CAPACITY_CONFLICT
      - REALLOCATION
    not_found:
      - ALLOCATION_HISTORY
      - AFFECTED_ALLOCATION_DISCOVERY
  reuse_decision: NOT_YET_AUTHORIZED
  extension_decision: NOT_YET_AUTHORIZED
  dedicated_build_decision: NOT_YET_AUTHORIZED
  contract_design_authorized: false
  schema_design_authorized: false
  inventory_change_authorized: false
```

H5.1 establishes a semantic-fit gap, not a build decision. The legacy path may contribute verified behavior through an adapter or migration plan later, but the missing history, interval, capacity, and recovery semantics must be resolved before any contract shape is chosen.

## Next Gate

```text
H5.1 Existing-contract discovery       COMPLETE
             ↓
H5.2 Semantic-fit investigation        NEXT
             ↓
Reuse / Extend / Dedicated decision    NOT YET AUTHORIZED
             ↓
Contract boundary freeze               NOT YET AUTHORIZED
```

The next pass must inspect the candidate behavior against Haircut's segment-based, capacity-aware, history-preserving requirements. It must not start by writing `IResourceAllocation` methods or copying the legacy schema.
