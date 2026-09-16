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

## Pass B — BabyCare Resource Allocation Semantic Mapping

Pass B maps BabyCare/Beauty legacy evidence into the nine frozen Haircut invariants. It does not import BabyCare storage shape into Haircut and it does not add new invariants from legacy code.

```yaml
H4_2_pass_B:
  source: BABYCARE_BEAUTY_LEGACY
  evidence_role: BUSINESS_AND_IMPLEMENTATION_EVIDENCE_ONLY
  architecture_shape_reused: false
  new_invariants_added: false
  ownership_implication: NONE
  ownership: UNRESOLVED
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

### Evidence Sources

```yaml
babycare_resource_evidence_sources:
  schema:
    - "supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql"
    - "supabase/migrations/20260611130000_add_session_booking_resource.sql"

  guard:
    - "src/core/services/order/booking-resource-schedule-guard.ts"

  session_flows:
    - "src/core/services/order/create-session-log-action.ts"
    - "src/core/services/order/update-session-log-action.ts"
    - "src/core/services/order/reschedule-session-action.ts"

  regression_tests:
    - "src/__tests__/booking-resource-schedule-guard.test.ts"
    - "src/__tests__/beauty-spa-phase2-schema.test.ts"

  prior_h3_reconciliation:
    - "docs/architecture/H3_BABYCARE_CAPABILITY_RECONCILIATION.md"
```

### Semantic Layers

BabyCare/Beauty evidence separates three concepts, but not with the same depth Haircut is proposing.

```text
Resource Availability
  "Can this resource be used?"
        |
        v
Resource Allocation
  "Which session currently references this resource at this date/time?"
        |
        v
Service / Session
  "Which customer service occurrence is happening?"
```

The important caution:

```text
resource conflict != resource reallocation lifecycle
```

BabyCare/Beauty proves scheduling conflict behavior. It does not prove the full Haircut lifecycle for reallocation, history, and impact discovery.

### Invariant Mapping

```yaml
invariant_mapping:
  resource_identity:
    result: MATCH
    business_meaning_equivalent: true
    evidence:
      - "`booking_resources` stores tenant-scoped schedulable resources."
      - "Resource type covers bed, room, machine, chair, and other."
      - "Resource status covers available, in_use, maintenance, and inactive."
    limitation: "This is Beauty/Spa resource identity evidence, not a target architecture model."
    architecture_shape_reused: false

  finite_capacity:
    result: PARTIAL
    business_meaning_equivalent: true
    evidence:
      - "`booking_resources.capacity` exists with a bounded check from 1 to 20."
      - "The resource business rule normalizes capacity into the resource payload."
    limitation:
      - "The current resource schedule guard checks duplicate active sessions for the same resource/date/time."
      - "It does not prove capacity-n scheduling enforcement where multiple concurrent allocations are allowed until capacity is exceeded."
    architecture_shape_reused: false

  service_segment_commitment:
    result: PARTIAL
    business_meaning_equivalent: true
    evidence:
      - "`session_logs.booking_resource_id` links a resource to an individual session instead of the whole booking."
      - "Schema regression tests explicitly guard that resources link to session logs and not to the bookings table."
    limitation:
      - "BabyCare/Beauty session-level allocation is more granular than whole booking allocation."
      - "It does not prove Haircut-style service segment allocation inside a single appointment flow, such as APPLY -> PROCESS -> WASH -> FINISH."
    architecture_shape_reused: false

  temporal_allocation:
    result: PARTIAL
    business_meaning_equivalent: true
    evidence:
      - "Resource conflict checks use `assigned_date` and `assigned_time` on `session_logs`."
      - "Create, update, and reschedule session flows run `validateBookingResourceSchedule` before persistence."
    limitation:
      - "BabyCare/Beauty evidence proves date/time allocation points."
      - "It does not prove start/end duration windows or overlapping interval conflict detection."
    architecture_shape_reused: false

  availability_constraint:
    result: MATCH
    business_meaning_equivalent: true
    evidence:
      - "`validateBookingResourceSchedule` reads the selected `booking_resources` row before conflict lookup."
      - "Statuses outside available/in_use are blocked before checking conflicts."
      - "Regression tests cover blocking a maintenance resource before conflict checks."
    limitation:
      - "Availability is implemented as current status, not a full time-windowed maintenance calendar."
    architecture_shape_reused: false

  capacity_conflict:
    result: PARTIAL
    business_meaning_equivalent: true
    evidence:
      - "`validateBookingResourceSchedule` blocks active session conflicts for the same tenant, resource, date, and time."
      - "Active statuses considered by the guard are scheduled and in_progress."
      - "The guard excludes the current session during update."
    limitation:
      - "This proves exclusive same-slot conflict detection."
      - "It does not prove capacity-n conflict rules, resource pool assignment, service segment duration overlap, or alternative allocation generation."
    architecture_shape_reused: false

  reallocation:
    result: PARTIAL
    business_meaning_equivalent: true
    evidence:
      - "Update session flow validates the new or existing `booking_resource_id` before updating `session_logs`."
      - "Reschedule flow preserves and validates each future session's `booking_resource_id` against the new date/time."
    limitation:
      - "BabyCare/Beauty proves resource assignment can be changed through session update paths."
      - "It does not prove a dedicated resource reallocation lifecycle with disruption, replacement, reason, actor, and operational confirmation."
    architecture_shape_reused: false

  allocation_history:
    result: PARTIAL
    business_meaning_equivalent: true
    evidence:
      - "Resource CRUD actions record audit logs for `booking_resources` create/update/delete."
      - "Session update paths persist the final `booking_resource_id` on `session_logs`."
    limitation:
      - "Audit around resource master-data changes is not the same as allocation history."
      - "No evidence was found for an allocation history chain preserving old resource, new resource, affected session/segment, reason, actor, timestamp, original allocation, and replacement allocation."
    architecture_shape_reused: false

  affected_allocation_discovery:
    result: NOT_FOUND
    business_meaning_equivalent: false
    evidence:
      - "Existing guards detect conflict during create, update, or reschedule."
    limitation:
      - "No evidence was found that changing a resource to maintenance/inactive discovers future or current sessions affected by that resource unavailability."
      - "No evidence was found for bulk impact classification such as FUTURE_ALLOCATION_AFFECTED, CURRENT_ALLOCATION_AFFECTED, or NO_IMPACT."
    architecture_shape_reused: false
```

### Smart Waitlist Note

Smart Waitlist has resource preference fields, but this is consumer evidence only.

```yaml
smart_waitlist_resource_evidence:
  preferred_resource_id: CONSUMER_SIGNAL
  proves_resource_allocation_ownership: false
  proves_resource_lifecycle: false
  proves_reallocation_history: false
```

Correct interpretation:

```text
Resource Allocation / Availability
          |
       conflict
          v
Smart Waitlist
```

Not:

```text
Smart Waitlist owns Resource Allocation
```

### Pass B Summary

```yaml
H4_2_pass_B_summary:
  frozen_invariants_tested: 9

  match:
    count: 2
    invariants:
      - RESOURCE_IDENTITY
      - AVAILABILITY_CONSTRAINT

  partial:
    count: 6
    invariants:
      - FINITE_CAPACITY
      - SERVICE_SEGMENT_COMMITMENT
      - TEMPORAL_ALLOCATION
      - CAPACITY_CONFLICT
      - REALLOCATION
      - ALLOCATION_HISTORY

  divergent:
    count: 0
    invariants: []

  not_found:
    count: 1
    invariants:
      - AFFECTED_ALLOCATION_DISCOVERY

  semantic_overlap: STRONG_PARTIAL
  semantic_divergence: NO_SEMANTIC_BREAK_FOUND
  common_semantic_kernel:
    - RESOURCE_IDENTITY
    - RESOURCE_AVAILABILITY_STATUS
    - SESSION_LEVEL_RESOURCE_REFERENCE
    - EXCLUSIVE_SAME_SLOT_RESOURCE_CONFLICT

  haircut_maturity_beyond_babycare:
    - SERVICE_SEGMENT_DURATION_COMMITMENT
    - CAPACITY_N_ENFORCEMENT
    - RESOURCE_POOL_ALLOCATION
    - REALLOCATION_LIFECYCLE
    - ALLOCATION_HISTORY_CHAIN
    - AFFECTED_ALLOCATION_DISCOVERY

  ownership_implication: NONE
  ownership: UNRESOLVED
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Pass B strengthens the conclusion that Bella already has real Beauty-domain resource scheduling and conflict evidence. It also shows that Haircut is asking for a more mature Resource Allocation capability than the current BabyCare/Beauty legacy implementation proves.

---

## Pass C — Nail Resource Allocation Projection

Pass C projects the nine frozen Haircut Resource Allocation invariants onto Bella Nail. This is a semantic plausibility test only. Nail has no implementation evidence in scope here, so none of the results upgrades the evidence strength or authorizes ownership, contract, or inventory decisions.

```yaml
H4_2_pass_C:
  source: NAIL_PROJECTION
  evidence_strength: PROJECTION_ONLY
  rules:
    frozen_invariants_only: true
    new_invariants_allowed: false
    implementation_claim_allowed: false
    field_observed: false
    ownership_implication: NONE

  invariant_mapping:
    resource_identity:
      result: PLAUSIBLE
      rationale: "Nail can plausibly operate on independently identified stations, pedicure chairs, or equipment."
    finite_capacity:
      result: PLAUSIBLE_WITH_VARIATION
      rationale: "Capacity may be expressed as one exclusive station, a pooled set of chairs, or limited concurrent equipment slots."
    service_segment_commitment:
      result: PLAUSIBLE_WITH_VARIATION
      rationale: "A Nail service may require different resources for preparation, treatment, curing, or finishing segments; the exact segmentation remains unvalidated."
    temporal_allocation:
      result: PLAUSIBLE
      rationale: "A resource commitment can plausibly be tied to a service segment and a scheduled time window."
    availability_constraint:
      result: PLAUSIBLE
      rationale: "Maintenance, cleaning, setup, or an operational outage can plausibly make a Nail resource unavailable for new work."
    capacity_conflict:
      result: PLAUSIBLE
      rationale: "A technician may be available while a required station, chair, or device has no feasible capacity for the segment."
    reallocation:
      result: PLAUSIBLE_WITH_VARIATION
      rationale: "A valid allocation may plausibly move to a compatible station or chair, subject to the physical state of the service and operating policy."
    allocation_history:
      result: PLAUSIBLE_WITH_VARIATION
      rationale: "Nail operations may need old/new resource, affected segment, reason, actor, and time, but the required audit depth is not product-validated."
    affected_allocation_discovery:
      result: UNKNOWN
      rationale: "It is plausible that an outage would require finding affected segments, but no Nail product or field evidence confirms the workflow."

  projection_scenarios:
    technician_changes_resource_between_segments:
      result: PLAUSIBLE_WITH_VARIATION
      description: "One technician may use a Nail station for one segment and a pedicure chair or compatible device for another."
    professional_available_resource_full:
      result: PLAUSIBLE
      description: "A service segment remains infeasible when the technician is available but the required resource has no capacity."
    resource_unavailable_after_allocation:
      result: UNKNOWN
      description: "A resource outage may require affected-allocation discovery and controlled reallocation, but Nail evidence is not available."

  summary:
    frozen_invariants_tested: 9
    plausible: 4
    plausible_with_variation: 4
    unknown: 1
    nail_specific_break: 0
    semantic_break_found: false
    cross_product_generality_signal: PROJECTION_SUPPORTS_BEAUTY_GENERALITY

  ownership: UNRESOLVED
  beauty_os_ownership_proven: false
  platform_ownership_proven: false
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

The projection supports a Beauty-domain generality signal without proving Beauty OS ownership. It also does not prove that Nail has the same operational maturity as Haircut: resource outage impact discovery, reallocation policy, and audit depth remain unknown until Product/UX or implementation evidence exists.

---

## Pass D — Producer / Consumer Ownership Test

Pass D identifies who supplies inputs to Resource Allocation, who owns allocation truth, and which capabilities consume the result. It does not resolve the ownership layer.

```yaml
H4_2_pass_D:
  capability: RESOURCE_ALLOCATION
  test: PRODUCER_CONSUMER_OWNERSHIP

  input_producers:
    service_definition:
      produces:
        - SERVICE_SEGMENT_FLOW
        - RESOURCE_TYPE_REQUIREMENT
        - RESOURCE_COMPATIBILITY_RULE
      owns_allocation: false

    resource_availability_maintenance:
      produces:
        - RESOURCE_AVAILABLE
        - RESOURCE_UNAVAILABLE
        - MAINTENANCE_WINDOW
        - OUT_OF_SERVICE_EVENT
      owns_allocation: false

    appointment_service_workflow:
      produces:
        - SERVICE_COMMITMENT
        - REQUESTED_TIME_CONTEXT
      owns_allocation: false

  allocation_owner_candidate:
    resource_allocation:
      produces:
        - RESOURCE_ALLOCATION_IDENTITY
        - RESOURCE_TO_SEGMENT_COMMITMENT
        - RESOURCE_COMMITMENT_WINDOW
        - CAPACITY_CONSUMPTION
        - CAPACITY_CONFLICT
        - AFFECTED_ALLOCATION_DISCOVERY
        - REALLOCATION
        - ALLOCATION_HISTORY
        - ACTUAL_RESOURCE_USED

  consumers:
    appointment_service_workflow:
      consumes:
        - ALLOCATION_FEASIBILITY
        - RESOURCE_CONFLICT
        - RESOURCE_DISRUPTION_IMPACT

    smart_waitlist:
      consumes:
        - RESOURCE_FEASIBILITY
        - RESOURCE_CONFLICT

    operations_dispatch:
      consumes:
        - CURRENT_ALLOCATION
        - AFFECTED_ALLOCATIONS
        - REALLOCATION_OPTIONS

    analytics:
      consumes:
        - ALLOCATION_HISTORY
        - RESOURCE_UTILIZATION

    finance_costing:
      consumes:
        - ACTUAL_RESOURCE_USAGE
      owns_allocation: false

  deletion_test:
    without_smart_waitlist: SURVIVES
    without_analytics: SURVIVES
    without_finance_costing: SURVIVES
    without_recommendation: SURVIVES
    without_professional_assignment: SURVIVES
    without_resource_availability_maintenance: SURVIVES_WITHOUT_AVAILABILITY_INPUT
    without_service_definition: SURVIVES_WITHOUT_RESOURCE_REQUIREMENT_INPUT

  ownership_finding:
    independent_capability: PROVEN
    owns:
      resource_commitment_truth: true
      capacity_consumption_truth: true
      resource_conflict_truth: true
      reallocation_truth: true
      allocation_history: true
    depends_on:
      service_definition: true
      resource_availability_maintenance: true
      service_commitment: true
    independent_ownership_signal: STRONG

  semantic_separation:
    resource_master_and_availability: "What the resource is and whether it can be used."
    resource_allocation: "Which commitment consumes which resource capacity during which window."
    service_workflow: "Which service step the customer is currently receiving."
    actual_resource_used: "Observed allocation outcome, not asset or facility ownership."

  ownership_layer: UNRESOLVED
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

The deletion test shows that Resource Allocation remains necessary without Waitlist, Analytics, Finance, Recommendation, or Professional Assignment. Removing Availability/Maintenance or Service Definition removes an input constraint, not the allocation capability itself. `Resource exists`, `Resource is available`, `Resource is allocated`, and `Resource was actually used` remain distinct facts.

Pass D proves independent capability ownership at the business-semantic level only. It does not prove Beauty OS or Platform ownership, and it does not authorize contract design.

---

## Pass E — Cross-Vertical Resource Allocation Probe

Pass E probes the nine frozen Haircut invariants in Healthcare, Education, and Logistics. The probe compares business meaning, not the presence of a table or a field named `resource`, `allocation`, `room`, or `capacity`.

Evidence strength is recorded independently from the semantic verdict:

```yaml
evidence_strength:
  - IMPLEMENTED_AND_VERIFIED
  - IMPLEMENTED_NOT_VERIFIED
  - DOCUMENTED_DESIGN
  - PROJECTION_ONLY
  - NOT_FOUND
```

### Healthcare

Healthcare has direct implementation evidence for several constrained clinical resources. A bed has tenant/ward identity, status, one active occupancy, assigned time, and explicit transfer behavior (`src/platform/healthcare/engines/bed-engine/domain/bed.entity.ts:6-9`, `src/platform/healthcare/engines/bed-engine/domain/bed.entity.ts:37-49`, `src/platform/healthcare/engines/bed-engine/domain/bed.entity.ts:98-134`). Emergency bays also have availability, occupancy, maintenance, release, and optimistic versioning (`src/platform/healthcare/engines/emergency-engine/domain/emergency-bay.resource.ts:1-17`, `src/platform/healthcare/engines/emergency-engine/domain/emergency-bay.resource.ts:70-119`). OR schedules use an operating-room identity and PostgreSQL time-range overlap checks (`src/platform/healthcare/engines/or-engine/or-engine.service.ts:76-109`, `src/platform/healthcare/engines/or-engine/or-engine.service.ts:372-388`).

```yaml
healthcare:
  resource_identity:
    result: MATCH
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Beds, emergency bays, operating rooms, and equipment are independently identified operational resources."
  finite_capacity:
    result: MATCH
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Bed/bay occupancy is exclusive and concurrency tests protect one active occupant; this is a capacity-one implementation."
  service_segment_commitment:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_NOT_VERIFIED
    rationale: "OR equipment usage and schedules attach to clinical cases or procedures, but Haircut-style internal service segments are not established across Healthcare."
  temporal_allocation:
    result: MATCH
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "OR schedules use time ranges and overlap checks; bed occupancy records assignment time, though the bed model is not an interval model."
  availability_constraint:
    result: MATCH
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Unavailable, occupied, reserved, maintenance, cleaning, and sterile-hold states prevent or constrain allocation."
  capacity_conflict:
    result: MATCH
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Bed and emergency-bay concurrency tests prove atomic rejection of competing allocations; OR schedules query overlapping active ranges."
  reallocation:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_NOT_VERIFIED
    rationale: "Bed transfer releases the source and creates occupancy on the target, but a cross-resource reallocation lifecycle is not shown for every resource type."
  allocation_history:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_NOT_VERIFIED
    rationale: "Transfer events and assigned timestamps exist, but a unified old/new resource chain with reason, actor, affected segment, and audit history is not established."
  affected_allocation_discovery:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "The inspected evidence proves allocation conflict checks, not a maintenance event that discovers all affected future allocations for bulk resolution."
```

### Education

Education evidence proves bounded course enrollment capacity and teacher-to-course/classroom assignment conflicts, not physical classroom or equipment allocation. The Education constitution explicitly excludes timetabling and classroom layout planning from the kernel (`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md:46`). Teacher assignment persists an assignment identity and checks active lead-teacher conflicts by course and academic year (`src/platform/education/contracts/teacher-assignment.contract.impl.ts:61-104`, `src/platform/education/contracts/teacher-assignment.contract.impl.ts:127-166`). Course capacity concerns enrollment counts, which is a different commitment unit.

```yaml
education:
  resource_identity:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "No implemented physical classroom, facility, or equipment allocation capability was found in the inspected Education scope."
  finite_capacity:
    result: DIVERGENT
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Course max_students is learner enrollment capacity, not finite capacity of a resource committed to an activity time window."
  service_segment_commitment:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "Attendance/session dates exist, but no resource commitment per class activity segment was found."
  temporal_allocation:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "Teacher assignment has effective dates, but no physical-resource allocation window was found."
  availability_constraint:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "Teacher assignment availability/conflict is not evidence that a classroom or equipment resource is unavailable."
  capacity_conflict:
    result: DIVERGENT
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Enrollment and lead-teacher conflicts are real constraints, but their business meaning is not resource capacity conflict."
  reallocation:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "Teacher assignment termination is not evidence of reallocating a physical resource between activity segments."
  allocation_history:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "Assignment effective dates do not establish old/new physical resource allocation history."
  affected_allocation_discovery:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "No maintenance or facility outage workflow was found that discovers affected allocations."
```

### Logistics

Logistics has implemented allocation semantics for inventory quantity and route/shipment assignment. Inventory allocation records item, location, quantity, purpose, reference, actor, status, creation, release, and expiry (`src/platform/logistics/contracts/inventory.contract.ts:238-285`), and validates available quantity before reservation (`src/platform/logistics/contracts/inventory.contract.ts:290-306`). Route management can validate weight/volume and reassign a shipment between routes with reason and actor (`src/platform/logistics/contracts/route-management.contract.ts:65-86`, `src/platform/logistics/contracts/route-management.contract.ts:136-151`, `src/platform/logistics/contracts/route-management.contract.ts:649-657`). These are real allocation-like capabilities, but their commitment units are inventory quantity and shipment-to-route membership, not a physical resource held by service segments in a time window.

```yaml
logistics:
  resource_identity:
    result: DIVERGENT
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Items, locations, vehicles, and routes are identified, but they are inventory or transport entities with different allocation semantics from salon resources."
  finite_capacity:
    result: DIVERGENT
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Inventory quantity and route weight/volume limits are finite, but they are not concurrent physical-resource capacity for a service segment."
  service_segment_commitment:
    result: DIVERGENT
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "The commitment is to an order/reference, inventory quantity, shipment, waypoint, or route rather than a service segment requiring a resource."
  temporal_allocation:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Inventory supports expiry and shipments have planned/actual dates, but the inspected evidence does not establish resource occupancy intervals with overlap semantics."
  availability_constraint:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Inventory status and available quantity constrain reservation, but availability does not have the same physical-resource meaning as a salon station or clinical bed."
  capacity_conflict:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Quantity and route capacity violations are enforced, but no equivalent time-window resource conflict was found."
  reallocation:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Inventory release/re-reservation and shipment route reassignment exist, but they reassign different commitment units and do not prove Haircut-style resource replacement."
  allocation_history:
    result: PARTIAL
    evidence_strength: IMPLEMENTED_AND_VERIFIED
    rationale: "Allocation records preserve status, actor, created/released/expiry times and reference, but not an old-resource/new-resource segment chain."
  affected_allocation_discovery:
    result: NOT_FOUND
    evidence_strength: NOT_FOUND
    rationale: "No inspected workflow discovers all time-overlapping resource allocations after a physical resource becomes unavailable."
```

### Cross-Vertical Summary

```yaml
H4_2_pass_E:
  source: CROSS_VERTICAL_PROBE
  evidence_role: BUSINESS_AND_IMPLEMENTATION_EVIDENCE_ONLY
  frozen_invariants_tested: 9
  verticals_tested:
    - HEALTHCARE
    - EDUCATION
    - LOGISTICS
  evidence_vocabulary_guard: PASS
  semantic_equivalence_guard: PASS
  findings:
    healthcare: "Strong resource allocation evidence, with partial maturity for segment/reallocation/history and no affected-allocation discovery evidence."
    education: "No physical-resource allocation capability found; capacity/conflict evidence is materially divergent."
    logistics: "Allocation capabilities exist, but inventory and route commitment semantics are materially different from Haircut resource allocation."
  cross_vertical_generality:
    signal: WEAK_TO_MODERATE
    common_semantic_kernel: "Independent resource identity, availability gating, finite constraint, and conflict prevention appear in some verticals but not with one stable commitment meaning."
    material_semantic_divergence: true
    platform_candidate: PLAUSIBLE_BUT_UNPROVEN
    platform_ownership_proven: false
  ownership: UNRESOLVED
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Pass E does not authorize a Platform verdict. Healthcare is the strongest non-Beauty match, but Education lacks the physical-resource capability in scope and Logistics uses materially different allocation units. The evidence currently supports a cross-vertical generality signal only at a broad pattern level; semantic ownership still requires Pass F.

---

## Pass F — Semantic Divergence and Ownership Resolution

Pass F reconciles the frozen Haircut semantics, BabyCare mapping, Nail projection, producer/consumer test, and cross-vertical probe. The question is ownership layer, not whether every vertical has the same implementation maturity.

```yaml
H4_2_pass_F:
  independent_capability: PROVEN

  haircut_product_test:
    capability_required_by_haircut: true
    independent_capability: true
    equivalent_beauty_semantics_exist_elsewhere: true
    haircut_specific_semantic_break: false
    result: REJECTED
    rationale: "Haircut needs the capability, but BabyCare has strong partial semantic overlap and no material within-Beauty break. Haircut's greater maturity requirement is an extension, not Haircut-only meaning."

  beauty_os_test:
    stable_beauty_semantics: true
    beauty_products_with_evidence:
      haircut: PRODUCT_VALIDATED
      babycare: STRONG_PARTIAL_IMPLEMENTATION_EVIDENCE
      nail: PROJECTION_ONLY
    semantic_kernel:
      - RESOURCE_IDENTITY
      - AVAILABILITY_CONSTRAINT
      - FINITE_CAPACITY
      - CAPACITY_CONFLICT
      - RESOURCE_COMMITMENT
    variations:
      - "Haircut requires service-segment commitments, resource pools, and mature reallocation/history workflows."
      - "BabyCare currently proves a narrower session/resource conflict path."
      - "Nail remains a plausibility projection, not implementation evidence."
    within_beauty_semantic_break: false
    result: PROVEN
    rationale: "The common business meaning survives between Haircut and BabyCare; the observed differences are maturity and policy variations, not a semantic break. Nail adds supporting generality only."

  platform_test:
    cross_vertical_pattern_exists: true
    stable_commitment_semantics: false
    material_semantic_divergence: true
    cross_vertical_signal: WEAK_TO_MODERATE
    platform_candidate: PLAUSIBLE_BUT_UNPROVEN
    result: NOT_PROVEN
    rationale: "Healthcare has the strongest non-Beauty match, but Education's capacity/assignment constraints and Logistics' inventory/route allocation use materially different commitment units."

  unresolved_test:
    evidence_still_indistinguishable_after_layer_tests: false
    result: REJECTED
    rationale: "Evidence is sufficient to reject Haircut-only ownership, establish Beauty-domain ownership, and withhold Platform promotion. Lack of Platform proof does not leave the owner unresolved."

  semantic_divergence:
    within_beauty:
      classification: DOMAIN_EXTENSION
      material_break: false
      detail: "Beauty products share resource-to-service commitment semantics; service segmentation, pool behavior, and operational recovery depth vary by product."
    cross_vertical:
      healthcare:
        classification: DOMAIN_EXTENSION
        material_break: false
        detail: "Clinical resource allocation shares constrained identity, availability, temporal commitment, and conflict semantics, with domain-specific safety and lifecycle rules."
      education:
        classification: SEMANTIC_BREAK
        material_break: true
        detail: "Observed enrollment and teacher-assignment constraints do not establish physical resource-to-activity allocation."
      logistics:
        classification: SEMANTIC_BREAK
        material_break: true
        detail: "Observed inventory quantity and shipment-route allocations use different commitment units from service-segment resource occupancy."

  ownership:
    verdict: BEAUTY_OS
    confidence: MEDIUM
    rationale: "Resource Allocation is independently owned, not Haircut-specific, and semantically stable across Haircut and BabyCare. Cross-vertical evidence is insufficient for Platform ownership, while Nail remains projection-only."

  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

The ownership result is `BEAUTY_OS`, not because Beauty has the most code reuse, but because the business meaning of a constrained resource committed to a Beauty service survives across Haircut and BabyCare without a material semantic break. Haircut-specific maturity requirements remain Beauty policy or implementation extensions. Healthcare supplies a useful neighboring pattern, but Education and Logistics prevent a Platform ownership claim under the current evidence.

H4.2 is now closed for ownership resolution. This closure does not design `IResourceAllocation`, DTOs, schemas, migrations, or alter the H1 contract inventory; those activities remain gated to the next phase.

---

## Pending Passes

```yaml
H4_2_pending:
  pass_B_babycare_semantic_mapping:
    status: COMPLETE
    semantic_overlap: STRONG_PARTIAL
    rule_followed: "Mapped BabyCare/Beauty only to frozen Haircut invariants. No new invariant was added from legacy."

  pass_C_nail_projection:
    status: COMPLETE
    evidence_strength: PROJECTION_ONLY
    result: "4 PLAUSIBLE, 4 PLAUSIBLE_WITH_VARIATION, 1 UNKNOWN, 0 NAIL_SPECIFIC_BREAK"
    rule_followed: "Tested only the nine frozen Haircut invariants. No Nail implementation claim or new invariant was added."

  pass_D_producer_consumer_ownership:
    status: COMPLETE
    independent_capability: PROVEN
    independent_ownership_signal: STRONG
    ownership_layer: UNRESOLVED
    rule_followed: "Separated input producers, allocation truth, downstream consumers, and deletion-test results."

  pass_E_cross_vertical_probe:
    status: COMPLETE
    evidence_strength: IMPLEMENTED_AND_VERIFIED_PLUS_IMPLEMENTED_NOT_VERIFIED
    result: "Healthcare strong partial; Education divergent/not found; Logistics partial/divergent"
    cross_vertical_generality_signal: WEAK_TO_MODERATE
    platform_candidate: PLAUSIBLE_BUT_UNPROVEN
    platform_ownership_proven: false
    candidate_verticals:
      - HEALTHCARE
      - EDUCATION
      - LOGISTICS
    rule_followed: "Probed all nine frozen invariants by business meaning and recorded evidence strength separately from verdict."

  pass_F_semantic_divergence_and_ownership:
    status: COMPLETE
    ownership: BEAUTY_OS
    confidence: MEDIUM
    platform_promotion_authorized: false
    contract_design_authorized: false
    inventory_change_authorized: false
    rule_followed: "Resolved layer only after semantic divergence reconciliation. Platform requires stable business meaning outside Beauty."
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
  h4_2_status: CLOSED
  haircut_resource_allocation_invariants: FROZEN
  babycare_mapping: COMPLETE
  nail_projection: COMPLETE_PROJECTION_ONLY
  producer_consumer_test: COMPLETE
  cross_vertical_probe: COMPLETE
  semantic_divergence: COMPLETE
  ownership: BEAUTY_OS
  ownership_confidence: MEDIUM
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Next step:

```text
H4.2 CLOSED — Ownership resolved to Beauty OS
```

Next phase: contract investigation and inventory reconciliation. No interface, schema, migration, or contract design is authorized in this H4.2 closure checkpoint.
