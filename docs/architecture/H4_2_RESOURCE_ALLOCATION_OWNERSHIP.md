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

## Pending Passes

```yaml
H4_2_pending:
  pass_B_babycare_semantic_mapping:
    status: COMPLETE
    semantic_overlap: STRONG_PARTIAL
    rule_followed: "Mapped BabyCare/Beauty only to frozen Haircut invariants. No new invariant was added from legacy."

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
  h4_2_status: PASS_B_COMPLETE
  haircut_resource_allocation_invariants: FROZEN
  babycare_mapping: COMPLETE
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
H4.2 Pass C — Nail Resource Allocation Projection
```

Pass C must keep `PROJECTION_ONLY` evidence strength and must not treat Nail plausibility as implementation evidence.
