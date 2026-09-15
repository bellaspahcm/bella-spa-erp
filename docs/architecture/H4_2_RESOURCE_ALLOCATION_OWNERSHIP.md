# H4.2 Resource Allocation Ownership Resolution

**Date:** 2026-09-16

**Branch:** `feat/haircut-h2-contract-extraction`

**Baseline:** `6b521ccd` — H3 Final Boundary Reconciliation

**Prior H4 Checkpoint:** `40705a88` — H4.1 Professional Assignment Ownership Resolved

**Status:** H4.2 PASS A COMPLETE — HAIRCUT RESOURCE ALLOCATION INVARIANTS FROZEN

---

## Scope

H4.2 resolves ownership layer for Resource Allocation. It does not reopen H3 product boundary validation.

```yaml
h4_2_scope:
  capability: RESOURCE_ALLOCATION
  h3_boundary_decision: VALIDATED_SEPARATE
  h3_baseline_commit: 6b521ccd
  objective: "Resolve whether Resource Allocation belongs to Haircut Product, Beauty OS/domain, Bella Platform, or remains unresolved."
  candidate_layers:
    - HAIRCUT_PRODUCT
    - BEAUTY_OS
    - PLATFORM
  ownership: UNRESOLVED
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

H4.2 starts with Haircut semantics only. BabyCare, Nail, Healthcare, Education, and Logistics evidence must not name the abstraction or shape the target boundary before Haircut invariants are extracted.

---

## Method Guardrails

```yaml
guardrails:
  do_not_modify_h3_conclusions: true
  do_not_design_interfaces: true
  do_not_design_schema: true
  do_not_change_contract_inventory: true
  do_not_promote_to_platform: true
  do_not_copy_legacy_architecture: true
  start_from_haircut_semantics: true
  resource_word_match_is_not_semantic_match: true
```

Key sequence:

```text
Business evidence -> Boundary -> Ownership -> Contract -> Implementation
```

Not:

```text
Legacy code reuse -> Contract -> Ownership
```

Additional H4.2 rule:

```text
Same word "Resource" != same semantic capability
```

A hospital bed, operating room, preschool classroom, wash chair, cutting station, and delivery vehicle can all be called resources. H4.2 must test whether their invariants are semantically equivalent, not whether the vocabulary overlaps.

---

## Why H4.2 Differs From H4.1

Professional Assignment had strong Beauty-domain evidence and weaker cross-vertical generality. Resource Allocation may generalize more widely, so H4.2 requires a cross-vertical probe before ownership can be closed.

```text
Haircut
  service segment
    -> cutting station / wash chair / equipment
    -> allocation
    -> capacity + availability + conflict

Preschool
  activity / classroom operation
    -> room / facility / equipment
    -> allocation?
    -> capacity + availability + conflict?

Healthcare
  clinical / surgical activity
    -> room / bed / equipment
    -> allocation?
    -> capacity + availability + conflict?
```

The cross-vertical probe is not authorized to promote Resource Allocation to Platform. It only tests whether the same semantic invariant exists outside Beauty.

---

## H4.2 Gate Structure

```yaml
H4_2:
  capability: RESOURCE_ALLOCATION

  haircut_semantic_invariants: FROZEN
  babycare_matching_invariants: PENDING
  nail_projection_result: PENDING
  producer_consumer_test: PENDING
  cross_vertical_probe: PENDING
  semantic_divergence: PENDING

  consumers:
    appointment_or_service_workflow: TBD
    service_definition: TBD
    smart_waitlist: TBD
    analytics: TBD

  ownership:
    verdict: UNRESOLVED
    confidence: TBD

  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

---

## H3 State Entering H4.2

H3 validated that Resource Allocation is separate from Appointment at Product Domain Requirement level.

```yaml
resource_allocation:
  h3_decision: VALIDATED_SEPARATE
  evidence_strength: PROPOSED_BY_PRODUCT
  field_observed: false
  ownership_layer: NOT_DETERMINED
  platform_contract: NOT_AUTHORIZED
  contract_design: NOT_AUTHORIZED
```

The H3 evidence base is:

```yaml
h3_resource_allocation_evidence:
  q5_maintenance_windows: regular
  q6_constrained_resources: true
  q7_reallocation_frequency: frequent
  q8_independent_bottleneck: true
  uc5_segment_based_conflict: true
  uc6_unavailability_recovery: true
  segment_based_commitment: true
  independent_conflict_rules: true
  allocation_history: required
```

This proves capability existence for Haircut. It does not prove Beauty OS ownership, Platform ownership, or contract design readiness.

---

## Pass A — Haircut Semantic Invariant Extraction

This section removes Haircut vocabulary such as `wash chair`, `cutting station`, `color station`, `steamer`, `hair service`, and `appointment`, then keeps only the business semantics discovered in H3.

### Candidate Semantic Model

```text
Service Commitment / Service Segment
  -> Resource Requirement
     -> Resource Allocation
        -> finite resource or resource pool
        -> time-windowed commitment
        -> capacity consumption
        -> conflict detection
        -> reallocation
        -> history
```

Resource Allocation answers:

```text
Which finite resource capacity is committed to this service segment during this time window?
```

It does not answer:

```text
Is the customer appointment valid?
Who performs the service?
Is the resource under maintenance?
What should happen financially?
```

### Frozen Haircut Invariants

```yaml
haircut_resource_allocation_invariants:
  resource_identity:
    meaning: "A finite operational asset, capacity unit, or compatible resource pool usable by a service segment."
    haircut_terms_removed:
      - wash_chair
      - cutting_station
      - color_station
      - steamer
      - service_room
    invariant_candidate: true

  finite_capacity:
    meaning: "A resource or resource pool has bounded concurrent capacity."
    capacity_shapes:
      - capacity_one
      - capacity_n
      - resource_pool
    hard_conflict_when: "Concurrent commitments exceed available capacity."
    invariant_candidate: true

  service_segment_commitment:
    meaning: "Allocation binds resource capacity to a service segment, not necessarily to the full appointment duration."
    full_appointment_lock_required: false
    invariant_candidate: true

  temporal_allocation:
    meaning: "Allocation has a time window that can be checked against other commitments and unavailable windows."
    start_time_required: true
    end_time_required: true
    invariant_candidate: true

  availability_constraint:
    meaning: "A resource unavailable window or event can block new allocations or affect existing allocations."
    owner_split:
      resource_availability_or_maintenance:
        owns:
          - RESOURCE_UNAVAILABLE_EVENT
          - MAINTENANCE_WINDOW
          - OUT_OF_SERVICE_STATUS
      resource_allocation:
        owns:
          - IMPACT_ON_ALLOCATIONS
          - REALLOCATION_DECISION_RECORD
    invariant_candidate: true

  capacity_conflict:
    meaning: "A conflict exists when requested resource capacity overlaps a committed window beyond the resource or pool capacity."
    exclusive_hard_conflict_override_allowed: false
    conflict_scope: SERVICE_SEGMENT_WINDOW
    invariant_candidate: true

  reallocation:
    meaning: "An existing resource commitment can be replaced while preserving the customer service commitment."
    examples:
      - operational_reallocation_after_resource_failure
      - in_day_reallocation_to_reduce_wait
      - replacement_when_prior_service_runs_long
    invariant_candidate: true

  allocation_history:
    meaning: "Resource changes must preserve the original allocation and replacement allocation facts needed for operations and audit."
    preserve:
      - ORIGINAL_RESOURCE
      - REPLACEMENT_RESOURCE
      - AFFECTED_SERVICE_SEGMENT
      - REASON
      - ACTOR
      - TIMESTAMP
      - ORIGINAL_ALLOCATION
      - REPLACEMENT_ALLOCATION
    invariant_candidate: true

  affected_allocation_discovery:
    meaning: "When resource availability changes, the system must discover allocations whose commitment windows overlap the unavailable window."
    impact_classes:
      - FUTURE_ALLOCATION_AFFECTED
      - CURRENT_ALLOCATION_AFFECTED
      - NO_IMPACT
    invariant_candidate: true
```

### Haircut Evidence Trace

```yaml
evidence_trace:
  resource_identity:
    sources:
      - Q6_SHARED_CONSTRAINED_EQUIPMENT
      - UC5_CHAIR_STATION_DOUBLE_BOOKING
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  finite_capacity:
    sources:
      - Q6_SHARED_CONSTRAINED_EQUIPMENT
      - Q8_RESOURCE_CAPACITY_BOTTLENECK
      - UC5_CHAIR_STATION_DOUBLE_BOOKING
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  service_segment_commitment:
    sources:
      - Q6_SHARED_CONSTRAINED_EQUIPMENT
      - UC5_CHAIR_STATION_DOUBLE_BOOKING
      - UC6_RESOURCE_BECOMES_UNAVAILABLE
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  temporal_allocation:
    sources:
      - Q5_RESOURCE_MAINTENANCE_WINDOW
      - UC5_CHAIR_STATION_DOUBLE_BOOKING
      - UC6_RESOURCE_BECOMES_UNAVAILABLE
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  availability_constraint:
    sources:
      - Q5_RESOURCE_MAINTENANCE_WINDOW
      - UC6_RESOURCE_BECOMES_UNAVAILABLE
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  capacity_conflict:
    sources:
      - Q8_RESOURCE_CAPACITY_BOTTLENECK
      - UC5_CHAIR_STATION_DOUBLE_BOOKING
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  reallocation:
    sources:
      - Q7_RESOURCE_REASSIGNMENT_FREQUENCY
      - UC6_RESOURCE_BECOMES_UNAVAILABLE
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  allocation_history:
    sources:
      - Q7_RESOURCE_REASSIGNMENT_FREQUENCY
      - UC6_RESOURCE_BECOMES_UNAVAILABLE
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false

  affected_allocation_discovery:
    sources:
      - Q5_RESOURCE_MAINTENANCE_WINDOW
      - UC6_RESOURCE_BECOMES_UNAVAILABLE
    evidence_strength: PROPOSED_BY_PRODUCT
    field_observed: false
```

---

## Ownership Boundary Frozen for Pass A

Resource Allocation owns the truth about resource capacity commitments to service segments.

```yaml
resource_allocation_owns:
  - RESOURCE_ALLOCATION_IDENTITY
  - RESOURCE_TO_SERVICE_SEGMENT_COMMITMENT
  - RESOURCE_COMMITMENT_WINDOW
  - RESOURCE_CAPACITY_CONSUMPTION
  - RESOURCE_CAPACITY_CONFLICT
  - AFFECTED_ALLOCATION_DISCOVERY
  - RESOURCE_REALLOCATION
  - RESOURCE_ALLOCATION_HISTORY
  - ACTUAL_RESOURCE_USED
```

Resource Allocation must not become a god capability.

```yaml
resource_allocation_does_not_own:
  resource_availability_or_maintenance:
    owns:
      - RESOURCE_UNAVAILABLE_EVENT
      - MAINTENANCE_WINDOW
      - OUT_OF_SERVICE_STATUS

  appointment_or_service_workflow:
    owns:
      - CUSTOMER_APPOINTMENT_LIFECYCLE
      - CUSTOMER_SERVICE_COMMITMENT
      - RESCHEDULE_OR_CANCEL_DECISION

  professional_assignment:
    owns:
      - PROFESSIONAL_ACTIVE_CAPACITY
      - PROFESSIONAL_CONFLICT
      - ACTUAL_PROFESSIONAL_PERFORMER

  service_definition:
    owns:
      - SERVICE_SEGMENT_FLOW
      - RESOURCE_TYPE_REQUIREMENT_BY_SEGMENT
      - RESOURCE_COMPATIBILITY_RULES

  professional_recommendation:
    owns:
      - PROFESSIONAL_CANDIDATE_RANKING
      - PROFESSIONAL_RECOMMENDATION_POLICY

  smart_waitlist:
    owns:
      - CUSTOMER_DEMAND_WAITING_FOR_FEASIBLE_SLOT

  finance_or_commission:
    owns:
      - FINANCIAL_ENTITLEMENT
      - PAYMENT
      - COMMISSION_CALCULATION
```

Important split:

```text
Resource Availability / Maintenance
        |
        | unavailable window / event
        v
Resource Allocation
        |
        | allocation, capacity, conflict, reallocation, history
        v
Appointment / Service Workflow
```

Maintenance causes allocation impact. Maintenance does not own allocation truth.

---

## Pass A Finding

```yaml
H4_2_pass_A:
  semantic_invariant_extraction: COMPLETE
  haircut_invariants_frozen: true
  frozen_invariants: 9

  invariants:
    - RESOURCE_IDENTITY
    - FINITE_CAPACITY
    - SERVICE_SEGMENT_COMMITMENT
    - TEMPORAL_ALLOCATION
    - AVAILABILITY_CONSTRAINT
    - CAPACITY_CONFLICT
    - REALLOCATION
    - ALLOCATION_HISTORY
    - AFFECTED_ALLOCATION_DISCOVERY

  resource_allocation_is_god_capability: false
  owns_resource_to_service_segment_truth: true
  owns_resource_availability_event: false
  owns_appointment_lifecycle: false
  owns_professional_assignment: false
  owns_service_definition: false
  owns_waitlist: false
  owns_finance_or_commission: false

  haircut_only_independent_capability_signal: STRONG
  evidence_strength: PROPOSED_BY_PRODUCT
  field_observed: false

  ownership:
    verdict: UNRESOLVED
    confidence: TBD

  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

---

## Pending Passes

```yaml
H4_2_pending:
  pass_B_babycare_semantic_mapping:
    status: PENDING
    rule: "Map BabyCare only to frozen Haircut invariants. Do not add new invariants from BabyCare legacy."

  pass_C_nail_projection:
    status: PENDING
    evidence_strength: PROJECTION_ONLY
    rule: "Use Nail only to test plausibility and variation inside Beauty. Do not treat it as implementation evidence."

  pass_D_producer_consumer_ownership:
    status: PENDING
    rule: "Identify who produces availability/resource requirements and who consumes allocation truth."

  pass_E_cross_vertical_probe:
    status: PENDING
    candidate_verticals:
      - HEALTHCARE
      - EDUCATION
      - LOGISTICS
    rule: "Probe semantic invariants, not resource vocabulary. Platform ownership requires semantic equivalence outside Beauty."

  pass_F_semantic_divergence_and_ownership:
    status: PENDING
    allowed_verdicts:
      - HAIRCUT_PRODUCT
      - BEAUTY_OS
      - PLATFORM
      - UNRESOLVED
```

---

## Current Checkpoint

```yaml
checkpoint:
  h4_2_status: PASS_A_COMPLETE
  haircut_resource_allocation_invariants: FROZEN
  babycare_mapping: PENDING
  nail_projection: PENDING
  producer_consumer_test: PENDING
  cross_vertical_probe: PENDING
  semantic_divergence: PENDING
  ownership: UNRESOLVED
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Next step:

```text
H4.2 Pass B — BabyCare Resource Allocation Semantic Mapping
```

Pass B must map BabyCare to the nine frozen Haircut invariants and must not import BabyCare legacy architecture as the target design.
