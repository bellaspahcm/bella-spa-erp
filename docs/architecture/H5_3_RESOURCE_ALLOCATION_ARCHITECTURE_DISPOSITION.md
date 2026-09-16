# H5.3 — Resource Allocation Architecture Disposition

**Status:** COMPLETE — disposition only
**Parent evidence:** H5.2 Semantic-Fit Investigation (`b6c643aa`)
**Capability owner:** `BEAUTY_OS`
**Scope:** Decide between reuse, extend/adapt, and dedicated build using semantic fit, adaptation cost, and long-term ownership criteria.
**Explicit non-scope:** No contract method design, DTO design, schema, migration, implementation, or legacy deletion.

## Decision Rule

```yaml
reuse_rule:
  reuse_when:
    - semantic_fit_is_high
    - adaptation_is_simple
    - no_dual_source_of_truth
    - no_legacy_debt_propagation
    - reuse_cost_materially_lower_than_new_build

  build_new_when:
    - structural_gaps_are_large
    - adaptation_requires_many_compatibility_layers
    - legacy_storage_distorts_target_semantics
    - dual_source_of_truth_risk_exists
    - migration_and_testing_cost_approaches_new_build
    - long_term_maintenance_cost_is_higher

  governing_principle: "Reuse is earned by semantic fit, not required by architecture."
```

Reuse is evaluated at multiple levels. Proven business invariants and useful behavior may be reused even when legacy code, storage, and architecture are not reused.

```text
Reuse knowledge / invariant / verified behavior
        !=
Reuse legacy code / storage / ownership boundary
```

## Candidate Evaluation

| Option | Semantic fit | Structural gap impact | Long-term risk | Result |
| --- | --- | --- | --- | --- |
| `REUSE` legacy booking-resource as canonical contract | Low to partial | Cannot represent interval, segment, capacity-N, durable history, or affected recovery without changing its meaning | High dual-truth and legacy-debt risk | Rejected |
| `EXTEND_ADAPT` legacy path as canonical allocation model | Partial | Requires a new allocation identity/lifecycle around current session/resource references and compatibility rules | Medium-high migration, adapter, and source-of-truth risk | Not selected as canonical disposition |
| `DEDICATED_BUILD` Beauty OS allocation capability with compatibility boundary | High for target semantics | New model can express all frozen invariants without inheriting legacy constraints | Lowest semantic distortion; legacy integration remains an explicit compatibility concern | Selected |

The disposition does not claim that a greenfield implementation is cheaper in every short-term scenario. It records that extending the legacy path would require changes to its commitment unit, time model, capacity model, change model, and recovery model. At that point, adaptation cost approaches a dedicated build while retaining more compatibility risk.

## Selected Disposition

```yaml
H5_3_disposition:
  capability: RESOURCE_ALLOCATION
  owner: BEAUTY_OS
  decision: DEDICATED_BUILD
  canonical_truth: BEAUTY_OS_RESOURCE_ALLOCATION
  legacy_booking_resource_as_canonical_model: REJECTED
  legacy_code_reuse: SELECTIVE_ONLY
  legacy_schema_reuse: COMPATIBILITY_INPUT_ONLY
  legacy_architecture_reuse: false
  compatibility_adapter_allowed: true
  dual_source_of_truth_allowed: false

  preserve_from_legacy:
    - RESOURCE_IDENTITY
    - RESOURCE_TYPE_AND_STATUS
    - AVAILABILITY_GATING_BEHAVIOR
    - VERIFIED_SINGLE_RESOURCE_CONFLICT_BEHAVIOR
    - RESOURCE_MASTER_CRUD_AUDIT_AS_SEPARATE_CONCERN

  target_semantics_to_build:
    - RESOURCE_ALLOCATION_IDENTITY
    - SERVICE_SEGMENT_COMMITMENT
    - TEMPORAL_INTERVAL_ALLOCATION
    - FINITE_CAPACITY_CONSUMPTION
    - RESOURCE_POOL_SELECTION
    - CAPACITY_CONFLICT
    - REALLOCATION_LIFECYCLE
    - ALLOCATION_HISTORY
    - AFFECTED_ALLOCATION_DISCOVERY

  implementation_authorized: false
  contract_design_authorized: false
  schema_design_authorized: false
  migration_authorized: false
  inventory_change_authorized: false
```

## Compatibility Boundary

Dedicated build does not imply deleting or rewriting BabyCare legacy flows. Compatibility must be explicit and one-way until a later migration decision is approved:

```text
Legacy BabyCare resource path
  ├── remains operational for existing consumers
  ├── supplies verified behavior/invariant evidence
  └── may be wrapped by an approved compatibility adapter

Beauty OS Resource Allocation
  └── owns new canonical allocation truth
```

The adapter, if later authorized, must not silently turn `session_logs.booking_resource_id` into the canonical multi-segment allocation ledger. It must define what can be translated, what cannot, and how source-of-truth ownership avoids duplication.

## Governance Finding

```yaml
governance_finding:
  reuse_is_earned_by_semantic_fit: true
  reuse_is_architecture_obligation: false
  reuse_debt_risk_identified: true
  semantic_distortion_risk_identified: true
  canonical_owner: BEAUTY_OS
  canonical_disposition: DEDICATED_BUILD
  confidence: MEDIUM_HIGH
```

The selected disposition is based on structural semantic gaps, not a preference for new code. It reuses proven knowledge and behavior while refusing to make legacy storage and current-reference mutation define the Beauty OS capability.

## Next Gate

```text
H5.1 Existing-contract discovery       COMPLETE
H5.2 Semantic-fit investigation        COMPLETE
H5.3 Architecture disposition          COMPLETE
             ↓
H5.4 Contract boundary freeze           NEXT
             ↓
Contract design / inventory resolution  GATED
```

H5.4 must freeze the contract boundary and reconcile the prior eight-contract hypothesis before any interface or schema is written. The disposition alone does not authorize implementation.
