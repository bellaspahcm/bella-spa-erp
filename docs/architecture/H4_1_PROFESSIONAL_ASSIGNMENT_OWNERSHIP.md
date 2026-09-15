# H4.1 Professional Assignment Ownership Resolution

**Date:** 2026-09-16

**Branch:** `feat/haircut-h2-contract-extraction`

**Baseline:** `6b521ccd` — H3 Final Boundary Reconciliation

**Status:** H4.1 PASS E COMPLETE — OWNERSHIP LAYER RESOLVED

---

## Scope

H4 resolves ownership layer. It does not reopen H3 boundary validation.

```yaml
h4_1_scope:
  capability: PROFESSIONAL_ASSIGNMENT
  h3_boundary_decision: VALIDATED_SEPARATE
  h3_baseline_commit: 6b521ccd
  objective: "Resolve whether the capability belongs to Haircut Product, Beauty OS/domain, or Bella Platform."
  candidate_layers:
    - HAIRCUT_PRODUCT
    - BEAUTY_OS
    - PLATFORM
  ownership: BEAUTY_OS
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

H4.1 starts with Haircut semantics only. BabyCare evidence must not name the abstraction or shape the target boundary before Haircut invariants are extracted.

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
```

Key rule:

```text
Business evidence -> Boundary -> Ownership -> Contract -> Implementation
```

Not:

```text
Legacy code reuse -> Contract -> Ownership
```

Another key rule:

```text
Exists in two products != Platform ownership
```

H4 must test semantic invariants, not count reuse opportunities.

---

## Capability Under Review

H3 validated that Professional Assignment is separate from Appointment.

H4.1 asks:

```text
Who should own the Professional Assignment capability?

Haircut Product?
Beauty OS/domain?
Bella Platform?
Still unresolved?
```

Current H3 state:

```yaml
professional_assignment:
  h3_boundary_decision: VALIDATED_SEPARATE
  evidence_strength: PROPOSED_BY_PRODUCT
  field_observed: false
  ownership_layer: NOT_DETERMINED
  platform_contract: NOT_AUTHORIZED
  contract_design: NOT_AUTHORIZED
```

---

## H4.1 Gate Structure

```yaml
H4_1:
  capability: PROFESSIONAL_ASSIGNMENT

  haircut_semantic_invariants: FROZEN
  babycare_matching_invariants: COMPLETE
  nail_projection_result: COMPLETE
  consumer_test: COMPLETE
  semantic_overlap: STRONG_BEAUTY_DOMAIN_OVERLAP
  semantic_divergence: NO_SEMANTIC_BREAK

  consumers:
    appointment: UPSTREAM_SERVICE_COMMITMENT_PRODUCER
    workforce: UPSTREAM_AVAILABILITY_PRODUCER
    commission: DOWNSTREAM_CONSUMER

  ownership:
    verdict: BEAUTY_OS
    confidence: MEDIUM_HIGH

  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

---

## Step 1 — Haircut Semantic Invariant Extraction

This section removes Haircut vocabulary such as `stylist`, `barber`, `haircut`, `color`, and `perm`, then keeps only the business semantics discovered in H3.

### Candidate Invariant

```text
Service Commitment
  -> Professional Assignment
     -> proposed/assigned professional
     -> assignment state
     -> acceptance or rejection
     -> disruption
     -> reassignment
     -> history
     -> actual performer
```

### Neutral Semantic Model

```yaml
haircut_semantic_invariants:
  service_commitment:
    meaning: "A customer-facing unit of service that needs one or more professional commitments."
    haircut_terms_removed:
      - appointment
      - haircut
      - color
      - perm
    invariant_candidate: true

  professional:
    meaning: "A human service provider eligible to perform some or all required service work."
    haircut_terms_removed:
      - stylist
      - barber
    invariant_candidate: true

  assignment_identity:
    meaning: "A durable relationship between one service commitment or service segment and one professional candidate or assignee."
    owns_current_value_only: false
    invariant_candidate: true

  assignment_status:
    meaning: "The relationship has its own state, separate from customer appointment lifecycle."
    observed_requirement_statuses:
      - PROPOSED
      - ACCEPTED
      - REJECTED
      - DISRUPTED
      - REASSIGNED
    invariant_candidate: true

  professional_decision:
    meaning: "The professional or operating policy can accept or reject a proposed commitment."
    hard_boundary_note: "A rejection does not automatically cancel the customer service commitment."
    invariant_candidate: true

  disruption:
    meaning: "An already accepted or planned professional commitment can be interrupted by unavailability, no-show, lateness, conflict, or operational change."
    invariant_candidate: true

  reassignment:
    meaning: "A disrupted or rejected professional commitment can be replaced by a new professional commitment without destroying the old record."
    invariant_candidate: true

  assignment_history:
    meaning: "The system must preserve original professional, replacement professional, reason, actor, timestamp, and final service provider when relevant."
    current_value_only_is_insufficient: true
    invariant_candidate: true

  professional_conflict:
    meaning: "Professional availability is checked against active professional work segments, not necessarily the full customer service duration."
    differs_from_appointment_conflict: true
    differs_from_resource_conflict: true
    invariant_candidate: true

  actual_performer:
    meaning: "The professional who actually performs the service may differ from the originally assigned professional."
    consumed_by:
      - operations
      - audit
      - customer_dispute
      - commission
    invariant_candidate: true
```

### Haircut Ownership Hypothesis

The Haircut semantic extraction suggests Professional Assignment owns only the relationship between professional and service commitment.

It must not own:

```yaml
not_owned_by_professional_assignment:
  recommendation:
    owns: "Candidate generation and ranking advice."
  workforce_attendance:
    owns: "Staff absence, leave, late arrival, and attendance facts."
  appointment:
    owns: "Customer appointment lifecycle and service commitment existence."
  resource_allocation:
    owns: "Chair, station, equipment, resource segment commitment, and capacity conflicts."
  commission:
    owns: "Compensation calculation, entitlement, payroll, and financial posting."
```

Professional Assignment may produce facts consumed by those capabilities:

```yaml
facts_owned_or_published_by_professional_assignment:
  - ORIGINAL_PROFESSIONAL
  - ASSIGNED_PROFESSIONAL
  - ACCEPTED_PROFESSIONAL
  - REJECTED_ASSIGNMENT
  - DISRUPTED_ASSIGNMENT
  - REPLACEMENT_ASSIGNMENT
  - FINAL_ACTUAL_PERFORMER
  - ASSIGNMENT_REASON
  - ASSIGNMENT_ACTOR
  - ASSIGNMENT_TIMESTAMP
```

### Preliminary Haircut-Only Finding

```yaml
haircut_only_finding:
  professional_assignment_is_god_capability: false
  owns_professional_to_service_commitment_truth: true
  owns_recommendation: false
  owns_workforce_attendance: false
  owns_appointment_lifecycle: false
  owns_resource_allocation: false
  owns_commission: false
  semantic_invariant_candidate_strength: STRONG
  ownership_verdict: UNRESOLVED
```

At this point H4.1 has extracted Haircut invariants only. It has not yet used BabyCare as naming source or architecture source.

---

## Step 2 — BabyCare Semantic Mapping

Pass B maps BabyCare evidence only into the Haircut invariants frozen in Pass A. It does not add new invariants from BabyCare fields, tables, or services.

```yaml
babycare_mapping_guardrails:
  map_only_to_frozen_haircut_invariants: true
  add_new_invariant_from_babycare: false
  architecture_shape_reused: false
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Evidence scale:

```yaml
semantic_mapping_scale:
  MATCH: "Business meaning is substantially equivalent."
  PARTIAL: "Related business meaning exists, but lifecycle, history, or ownership is incomplete or indirect."
  DIVERGENT: "Business behavior exists but means something materially different."
  NOT_FOUND: "No confirming BabyCare evidence was found in the existing H3 audit/reconciliation docs."
```

### Mapping Matrix

```yaml
babycare_semantic_mapping:
  service_commitment:
    haircut_meaning: "A customer-facing unit of service that needs one or more professional commitments."
    babycare_evidence:
      booking: MATCH
      session_log: MATCH
    business_meaning_equivalence: "BabyCare booking/session represents a customer-facing service commitment requiring caregiver/KTV execution."
    semantic_result: MATCH
    architecture_shape_reused: false
    ownership_implication: NONE

  professional:
    haircut_meaning: "A human service provider eligible to perform some or all required service work."
    babycare_evidence:
      ktv_or_caregiver: MATCH
      availability_filtering: MATCH
    business_meaning_equivalence: "BabyCare KTV/caregiver is the human service provider considered for assignment and execution."
    semantic_result: MATCH
    architecture_shape_reused: false
    ownership_implication: NONE

  assignment_identity:
    haircut_meaning: "A durable relationship between service commitment or service segment and professional candidate or assignee."
    babycare_evidence:
      bookings_assigned_ktv_id: MATCH
      session_logs_completed_by_ktv_id: MATCH
      standalone_assignment_table: NOT_FOUND
    business_meaning_equivalence: "BabyCare preserves booking-level primary assignment and session-level performer/substitute, but not as a standalone assignment identity."
    semantic_result: PARTIAL
    architecture_shape_reused: false
    ownership_implication: NONE

  assignment_status:
    haircut_meaning: "The relationship has its own state, separate from customer appointment lifecycle."
    babycare_evidence:
      session_status_lifecycle: PARTIAL
      proposed_status: NOT_FOUND
      accepted_status: NOT_FOUND
      rejected_status: NOT_FOUND
      disrupted_status: NOT_FOUND
    business_meaning_equivalence: "BabyCare has session lifecycle, but does not prove a dedicated assignment lifecycle."
    semantic_result: PARTIAL
    architecture_shape_reused: false
    ownership_implication: NONE

  professional_decision:
    haircut_meaning: "Professional or operating policy can accept or reject a proposed commitment."
    babycare_evidence:
      explicit_accept: NOT_FOUND
      explicit_reject: NOT_FOUND
      controlled_rejection_reason: NOT_FOUND
      implicit_accept_by_start_session: PARTIAL
    business_meaning_equivalence: "BabyCare may imply acceptance when a session starts, but it does not prove controlled accept/reject semantics."
    semantic_result: NOT_FOUND
    architecture_shape_reused: false
    ownership_implication: NONE

  disruption:
    haircut_meaning: "An accepted or planned professional commitment can be interrupted by unavailability, no-show, lateness, conflict, or operational change."
    babycare_evidence:
      staff_leave_source: MATCH
      affected_session_lookup: MATCH
      general_no_show_lifecycle: NOT_FOUND
      late_arrival_lifecycle: NOT_FOUND
    business_meaning_equivalence: "BabyCare proves leave-driven disruption of scheduled sessions, but not the full Haircut no-show/late-arrival disruption space."
    semantic_result: PARTIAL
    architecture_shape_reused: false
    ownership_implication: NONE

  reassignment:
    haircut_meaning: "A disrupted or rejected professional commitment can be replaced by a new professional commitment without destroying the old record."
    babycare_evidence:
      leave_reassignment_input: MATCH
      session_reassignment_update: MATCH
      rollback_protection: MATCH
      rejected_assignment_reassignment: NOT_FOUND
    business_meaning_equivalence: "BabyCare proves replacement professional assignment for leave-affected sessions, with rollback safety."
    semantic_result: MATCH
    architecture_shape_reused: false
    ownership_implication: NONE

  assignment_history:
    haircut_meaning: "Preserve original professional, replacement professional, reason, actor, timestamp, and final service provider when relevant."
    babycare_evidence:
      booking_primary_ktv: MATCH
      session_actual_ktv: MATCH
      leave_reassignment_note: PARTIAL
      generic_audit_logging: PARTIAL
      structured_history_chain: NOT_FOUND
      structured_replacement_relationship: NOT_FOUND
    business_meaning_equivalence: "BabyCare preserves enough facts to distinguish primary KTV from actual/substitute KTV, but not a structured assignment history chain."
    semantic_result: PARTIAL
    architecture_shape_reused: false
    ownership_implication: NONE

  professional_conflict:
    haircut_meaning: "Professional availability is checked against professional work commitments, distinct from appointment and resource conflict."
    babycare_evidence:
      time_overlap_filter: MATCH
      break_buffer_conflict: MATCH
      daily_limit_conflict: MATCH
      active_professional_segment_model: NOT_FOUND
    business_meaning_equivalence: "BabyCare proves professional conflict filtering, but not Haircut's active professional segment model."
    semantic_result: PARTIAL
    architecture_shape_reused: false
    ownership_implication: NONE

  actual_performer:
    haircut_meaning: "The professional who actually performs the service may differ from the originally assigned professional."
    babycare_evidence:
      bookings_assigned_ktv_id: MATCH
      session_logs_completed_by_ktv_id: MATCH
      commission_reads_completed_by_ktv_id: MATCH
      salary_recalculation_by_completed_session_provider: MATCH
    business_meaning_equivalence: "BabyCare distinguishes original booking KTV from session performer, and commission/salary consume actual completed-by provider."
    semantic_result: MATCH
    architecture_shape_reused: false
    ownership_implication: NONE
```

### BabyCare Consumer Evidence

Finance and Commission are consumer evidence, not ownership evidence.

```text
Professional Assignment / Session Performer Facts
  -> original professional
  -> reassignment/substitute professional
  -> actual performer
       |
       v
  Commission / Salary
  consumes the fact
  does not own the fact
```

```yaml
babycare_commission_consumer_test:
  assignment_to_execution: IMPLEMENTED
  actual_performer_source: session_logs.completed_by_ktv_id
  commission_reads_actual_performer: MATCH
  commission_owns_assignment_truth: false
  professional_assignment_history_durability_signal: STRONG_CONSUMER_SIGNAL
  ownership_implication: "Commission strengthens durability need but does not own Professional Assignment."
```

### BabyCare Mapping Result

```yaml
babycare_mapping_result:
  mapped_against_frozen_haircut_invariants: true
  added_new_invariants_from_babycare: false
  architecture_shape_reused: false

  semantic_results:
    match:
      - service_commitment
      - professional
      - reassignment
      - actual_performer
    partial:
      - assignment_identity
      - assignment_status
      - disruption
      - assignment_history
      - professional_conflict
    divergent: []
    not_found:
      - professional_decision

  overall_semantic_overlap: STRONG_PARTIAL
  ownership_verdict: UNRESOLVED
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Interpretation:

BabyCare strongly supports that the professional-to-service-commitment relationship is not unique to Haircut. It also proves that actual performer facts are consumed by compensation workflows. However, BabyCare does not prove Haircut's full assignment lifecycle, controlled rejection, active segment model, or structured history chain.

Therefore Pass B strengthens cross-product evidence but does not resolve ownership.

---

## Step 3 — Nail Projection

Pass C tests whether the frozen Haircut semantic invariants are plausible for Bella Nail operations. This is projection only.

```yaml
nail_projection_guardrails:
  evidence_strength: PROJECTION_ONLY
  use_frozen_haircut_invariants_only: true
  add_new_nail_invariants: false
  product_requirement_claim: false
  implementation_evidence_claim: false
  beauty_os_ownership_proven: false
  platform_ownership_proven: false
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Projection scale:

```yaml
projection_result_scale:
  PLAUSIBLE: "The semantic appears likely to hold for Nail without material change."
  PLAUSIBLE_WITH_VARIATION: "The semantic likely holds, but Nail may vary in granularity or operating policy."
  HAIRCUT_SPECIFIC: "The semantic depends on Haircut-specific operations."
  UNKNOWN: "Projection cannot reasonably assess this without Nail Product/UX or implementation evidence."
```

### Projection Matrix

```yaml
nail_projection_matrix:
  SERVICE_COMMITMENT:
    question: "Does a Nail service or service visit create a commitment that needs technician execution?"
    projection_result: PLAUSIBLE
    reasoning: "A Nail customer visit/service is likely a customer-facing service commitment needing technician work."
    evidence_strength: PROJECTION_ONLY

  PROFESSIONAL_ASSIGNMENT:
    question: "Can a technician be assigned independently to a commitment?"
    projection_result: PLAUSIBLE
    reasoning: "Nail operations commonly require assigning a nail technician to a customer/service, but actual Bella Nail policy is not yet validated."
    evidence_strength: PROJECTION_ONLY

  ASSIGNMENT_IDENTITY:
    question: "Does assignment mean more than a single booking.technician_id?"
    projection_result: PLAUSIBLE_WITH_VARIATION
    reasoning: "A single booking may contain multiple nail service commitments, each potentially handled by a different technician. This tests assignment identity beyond one booking-level technician field."
    evidence_strength: PROJECTION_ONLY

  ACCEPT_REJECT:
    question: "Does a technician need controlled accept/reject?"
    projection_result: UNKNOWN
    reasoning: "Haircut requires controlled rejection, but Nail policy may be manager-dispatched without technician accept/reject. Product/UX validation is required."
    evidence_strength: PROJECTION_ONLY

  DISRUPTION:
    question: "Can absence, lateness, skill mismatch, or operational change disrupt an assignment?"
    projection_result: PLAUSIBLE
    reasoning: "Technician absence, delay, or skill mismatch can plausibly disrupt a Nail service assignment."
    evidence_strength: PROJECTION_ONLY

  REASSIGNMENT:
    question: "Can technician change without replacing the customer booking?"
    projection_result: PLAUSIBLE
    reasoning: "A Nail booking can plausibly continue while the technician changes, especially for absence or load balancing."
    evidence_strength: PROJECTION_ONLY

  ASSIGNMENT_HISTORY:
    question: "Is original technician -> replacement technician -> reason likely needed?"
    projection_result: PLAUSIBLE_WITH_VARIATION
    reasoning: "History is likely useful for audit, customer dispute, and compensation, but required depth depends on Nail operating policy."
    evidence_strength: PROJECTION_ONLY

  PROFESSIONAL_CONFLICT:
    question: "Does a technician have independent scheduling constraints?"
    projection_result: PLAUSIBLE
    reasoning: "A technician cannot perform overlapping active work beyond capacity; exact segment model may differ from Haircut."
    evidence_strength: PROJECTION_ONLY

  ACTUAL_PERFORMER:
    question: "Does the final performer need to be known for commission or audit?"
    projection_result: PLAUSIBLE
    reasoning: "Nail compensation and service audit likely need the technician who actually performed the service."
    evidence_strength: PROJECTION_ONLY
```

### Multi-Commitment Booking Projection

Nail may stress-test whether a booking is the same as a service commitment:

```text
Booking
  -> Service Commitment A -> Professional Assignment A
  -> Service Commitment B -> Professional Assignment B
  -> Service Commitment C -> Professional Assignment C
```

This projection argues against assuming:

```text
Booking -> technician_id
```

However, this is not yet a Bella Nail requirement. It remains projection until Nail Product/UX validation or implementation evidence exists.

### Nail Projection Result

```yaml
nail_projection:
  evidence_strength: PROJECTION_ONLY
  frozen_invariants_tested: 9
  plausible:
    - SERVICE_COMMITMENT
    - PROFESSIONAL_ASSIGNMENT
    - DISRUPTION
    - REASSIGNMENT
    - PROFESSIONAL_CONFLICT
    - ACTUAL_PERFORMER
  plausible_with_variation:
    - ASSIGNMENT_IDENTITY
    - ASSIGNMENT_HISTORY
  haircut_specific: []
  unknown:
    - ACCEPT_REJECT

  cross_product_generality_signal: MODERATE_TO_STRONG_BEAUTY_DOMAIN_SIGNAL

  ownership:
    verdict: UNRESOLVED

  beauty_os_ownership_proven: false
  platform_ownership_proven: false
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Interpretation:

Haircut plus BabyCare implementation evidence plus Nail projection creates a stronger generality signal for the Beauty domain. It still does not prove Beauty OS ownership, and it certainly does not prove Platform ownership.

```text
Haircut validated
  + BabyCare implementation evidence
  + Nail projection
  != automatic Platform ownership
```

The result first suggests a possible Beauty-domain abstraction, which must still pass consumer/producer and semantic divergence tests.

---

## Step 4 — Producer / Consumer Ownership Test

Pass D tests who creates and owns each business fact. It does not decide the final layer yet.

```yaml
producer_consumer_guardrails:
  ownership_layer: UNRESOLVED
  beauty_os_ownership_proven: false
  platform_ownership_proven: false
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

### Ownership Graph

```text
Workforce / Attendance
  -> staff availability event
       |
       v
Professional Assignment
  -> assignment identity
  -> lifecycle
  -> reassignment
  -> history
  -> actual performer
       |
       +-> Appointment
       +-> Commission
       +-> Analytics
       +-> Notification
```

The graph must not invert ownership:

- Workforce/Attendance produces staff availability facts, but does not own assignment truth.
- Appointment produces the customer/service commitment, but should not own professional assignment history merely because assignment references the appointment.
- Recommendation produces candidate/ranking advice, but does not own final assignment.
- Resource Allocation manages physical resources, not professional availability or performer truth.
- Commission consumes actual performer and assignment history; it does not become source of truth for who performed.
- Analytics and Notification are downstream consumers.

### Producer / Consumer Matrix

```yaml
producer_consumer_matrix:
  service_commitment:
    producer: APPOINTMENT
    professional_assignment_role: CONSUMER_AND_LINK_OWNER
    professional_assignment_owns_fact: false
    explanation: "Appointment owns the customer-facing service commitment; Assignment links a professional to that commitment."

  staff_availability_event:
    producer: WORKFORCE_ATTENDANCE
    professional_assignment_role: CONSUMER_OF_AVAILABILITY_IMPACT
    professional_assignment_owns_fact: false
    explanation: "Workforce owns absence, leave, late arrival, and attendance facts; Assignment owns which commitments are affected."

  recommendation_candidates:
    producer: PROFESSIONAL_RECOMMENDATION
    professional_assignment_role: CONSUMER_OF_SELECTED_DECISION
    professional_assignment_owns_fact: false
    explanation: "Recommendation owns candidate/ranking advice; Assignment owns only the chosen commitment relationship."

  assignment_identity:
    producer: PROFESSIONAL_ASSIGNMENT
    professional_assignment_role: SOURCE_OF_TRUTH
    professional_assignment_owns_fact: true
    explanation: "The durable relationship between a professional and a service commitment belongs to Assignment."

  assignment_lifecycle:
    producer: PROFESSIONAL_ASSIGNMENT
    professional_assignment_role: SOURCE_OF_TRUTH
    professional_assignment_owns_fact: true
    explanation: "States such as proposed, accepted, rejected, disrupted, and replaced describe the assignment relationship itself."

  reassignment:
    producer: PROFESSIONAL_ASSIGNMENT
    professional_assignment_role: SOURCE_OF_TRUTH
    professional_assignment_owns_fact: true
    explanation: "Replacement of one professional commitment with another is Assignment impact, not Workforce, Appointment, or Commission truth."

  assignment_history:
    producer: PROFESSIONAL_ASSIGNMENT
    professional_assignment_role: SOURCE_OF_TRUTH
    professional_assignment_owns_fact: true
    explanation: "Original professional, replacement professional, reason, actor, timestamp, and final performer are Assignment history facts."

  actual_performer:
    producer: PROFESSIONAL_ASSIGNMENT
    professional_assignment_role: SOURCE_OF_TRUTH
    professional_assignment_owns_fact: true
    explanation: "The actual performer is the operational result of the assignment relationship and is consumed by commission, audit, and analytics."

  resource_commitment:
    producer: RESOURCE_ALLOCATION
    professional_assignment_role: CONSUMER_OR_PEER_CONSTRAINT
    professional_assignment_owns_fact: false
    explanation: "Resource Allocation owns chair/station/equipment commitments and conflicts."

  commission_entitlement:
    producer: COMMISSION_COMPENSATION
    professional_assignment_role: FACT_SUPPLIER
    professional_assignment_owns_fact: false
    explanation: "Commission computes compensation using actual performer/history facts, but it does not own those facts."

  notification_message:
    producer: NOTIFICATION
    professional_assignment_role: EVENT_SOURCE_OR_CONTEXT
    professional_assignment_owns_fact: false
    explanation: "Notification informs people about assignment events; it does not own assignment truth."

  analytics_metric:
    producer: ANALYTICS
    professional_assignment_role: FACT_SUPPLIER
    professional_assignment_owns_fact: false
    explanation: "Analytics aggregates assignment facts; it does not own the operational source of truth."
```

### Deletion Test

Question:

```text
If Commission, Recommendation, or Workforce modules were absent,
would Professional Assignment facts still need to exist for salon operations?
```

Result:

```yaml
deletion_test:
  remove_commission:
    assignment_identity_still_required: true
    assignment_history_still_required: true
    actual_performer_still_required: true
    reason: "Operations, customer dispute, audit, and service accountability still need assignment truth even without compensation."

  remove_recommendation:
    assignment_identity_still_required: true
    assignment_history_still_required: true
    actual_performer_still_required: true
    reason: "Managers can assign manually; the assignment relationship still exists without recommendation."

  remove_workforce_attendance:
    assignment_identity_still_required: true
    assignment_history_still_required: true
    actual_performer_still_required: true
    reason: "Assignments still exist for normal operations, even if absence facts are entered manually or not integrated."

  remove_appointment:
    assignment_identity_still_required: false
    reason: "Without a service commitment, there is no professional assignment target."

  conclusion:
    independent_assignment_ownership_signal: STRONG
```

Interpretation:

Professional Assignment depends on a service commitment target, but it does not depend on Commission, Recommendation, or Workforce to justify its own facts. This supports independent ownership of assignment truth while preserving upstream/downstream ownership boundaries.

### Pass D Result

```yaml
H4_1_pass_D:
  producer_consumer_test: COMPLETE

  upstream:
    service_commitment:
      producer: APPOINTMENT
      assignment_relation: CONSUMER_AND_LINK_OWNER
    workforce_attendance:
      producer: WORKFORCE_ATTENDANCE
      assignment_relation: CONSUMER_OF_AVAILABILITY_IMPACT
    recommendation:
      producer: PROFESSIONAL_RECOMMENDATION
      assignment_relation: CONSUMER_OF_SELECTED_DECISION

  capability_under_test:
    professional_assignment:
      owns_assignment_truth: true
      owns_lifecycle: true
      owns_reassignment: true
      owns_history: true
      owns_actual_performer: true
      owns_workforce_absence: false
      owns_appointment_lifecycle: false
      owns_recommendation_ranking: false
      owns_resource_allocation: false
      owns_commission: false

  downstream:
    commission: CONSUMER_CANDIDATE
    analytics: CONSUMER_CANDIDATE
    notification: CONSUMER_CANDIDATE

  independent_ownership_signal: STRONG

  ownership_layer: UNRESOLVED
  beauty_os_ownership_proven: false
  platform_ownership_proven: false
  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Pass D answers what Professional Assignment owns. It does not answer which layer should own the capability. That remains for Pass E semantic divergence and ownership layer resolution.

---

## Step 5 — Semantic Divergence And Ownership Layer Resolution

Pass E determines whether the frozen Professional Assignment semantics are Haircut-only, Beauty-domain, Platform-level, or still unresolved.

It asks:

```text
Do the core invariants keep the same business meaning when Haircut stylist is replaced by BabyCare KTV/caregiver and projected Nail technician?
```

It does not ask:

```text
Can code be reused?
```

### Divergence Scale

```yaml
divergence_scale:
  NONE:
    meaning: "Same business semantic."
  POLICY_VARIATION:
    meaning: "Same capability, different configurable rule."
  DOMAIN_EXTENSION:
    meaning: "Common capability plus Beauty/product-specific behavior."
  SEMANTIC_BREAK:
    meaning: "Same abstraction would distort business meaning."
```

`POLICY_VARIATION` and `DOMAIN_EXTENSION` do not automatically prevent shared ownership. `SEMANTIC_BREAK` is the signal that a shared owner would be unsafe.

### Semantic Divergence Matrix

```yaml
semantic_divergence_matrix:
  service_commitment:
    haircut: PROVEN_REQUIREMENT
    babycare: MATCH
    nail: PLAUSIBLE
    divergence: NONE
    material_break: false
    interpretation: "A customer-facing service unit needing professional execution is common across the Beauty products assessed."

  assignment_identity:
    haircut: REQUIRED
    babycare: PARTIAL
    nail: PLAUSIBLE_WITH_VARIATION
    divergence: DOMAIN_EXTENSION
    material_break: false
    interpretation: "The relationship exists across products, but Haircut requires more explicit durable identity than BabyCare currently implements."

  assignment_lifecycle:
    haircut: STRONG
    babycare: PARTIAL
    nail: PROJECTION_ONLY
    divergence: DOMAIN_EXTENSION
    material_break: false
    interpretation: "Lifecycle is a valid shared semantic, while Haircut needs richer states than BabyCare currently proves."

  accept_reject:
    haircut: REQUIRED
    babycare: NOT_FOUND
    nail: UNKNOWN
    divergence: DOMAIN_EXTENSION
    material_break: false
    interpretation: "Controlled accept/reject is best treated as a Haircut or Beauty policy extension, not as proof against shared ownership."

  disruption:
    haircut: REQUIRED
    babycare: IMPLEMENTED_FOR_LEAVE
    nail: PLAUSIBLE
    divergence: POLICY_VARIATION
    material_break: false
    interpretation: "The common semantic is availability/operational disruption; specific triggers differ by product."

  reassignment:
    haircut: REQUIRED
    babycare: IMPLEMENTED
    nail: PLAUSIBLE
    divergence: NONE
    material_break: false
    interpretation: "Replacement of one professional commitment with another preserves the same business meaning."

  assignment_history:
    haircut: REQUIRED
    babycare: PARTIAL
    nail: PLAUSIBLE_WITH_VARIATION
    divergence: DOMAIN_EXTENSION
    material_break: false
    interpretation: "History is common as a need, but required structure and depth vary."

  professional_conflict:
    haircut: REQUIRED
    babycare: IMPLEMENTED_WITH_DIFFERENT_MODEL
    nail: PLAUSIBLE
    divergence: POLICY_VARIATION
    material_break: false
    interpretation: "Professional capacity/conflict is common; Haircut active segment semantics are a richer product-specific policy."

  actual_performer:
    haircut: REQUIRED
    babycare: IMPLEMENTED
    nail: PLAUSIBLE
    divergence: NONE
    material_break: false
    interpretation: "The final performer fact has the same meaning and is consumed by audit/commission style workflows."
```

### Divergence Result

```yaml
semantic_divergence_result:
  frozen_invariants: 9
  common_invariants:
    - service_commitment
    - reassignment
    - actual_performer
  policy_variations:
    - disruption
    - professional_conflict
  domain_extensions:
    - assignment_identity
    - assignment_lifecycle
    - accept_reject
    - assignment_history
  semantic_breaks: []
  haircut_specific_core: []
  independent_capability: PROVEN
```

Interpretation:

No frozen invariant creates a `SEMANTIC_BREAK` across Haircut, BabyCare evidence, and Nail projection. The differences are better classified as policy variation or Beauty/product-specific extensions.

### Ownership Ladder

```yaml
ownership_ladder:
  haircut_product:
    question: "Are semantics only valid inside Haircut?"
    result: REJECTED
    reason: "BabyCare implementation evidence and Nail projection both preserve the core relationship between professional and service commitment."

  beauty_os:
    question: "Are semantics stable across Beauty-domain products?"
    result: PROVEN
    reason: "Haircut validates the complete target semantics; BabyCare proves key implemented subsets; Nail projection shows no Haircut-specific semantic break."

  platform:
    question: "Is there evidence outside Beauty with the same ownership semantics?"
    result: NOT_PROVEN
    reason: "Current evidence is Haircut, BabyCare, and Nail projection, all within Beauty/service operations. No non-Beauty vertical has been reconciled here."
```

### H4.1 Ownership Verdict

```yaml
H4_1_pass_E:
  semantic_divergence_test: COMPLETE

  frozen_invariants: 9
  common_invariants:
    - service_commitment
    - reassignment
    - actual_performer
  policy_variations:
    - disruption
    - professional_conflict
  domain_extensions:
    - assignment_identity
    - assignment_lifecycle
    - accept_reject
    - assignment_history
  semantic_breaks: []

  independent_capability: PROVEN

  ownership:
    haircut_product: REJECTED
    beauty_os: PROVEN
    platform: NOT_PROVEN
    verdict: BEAUTY_OS
    confidence: MEDIUM_HIGH

  rationale:
    - "Professional Assignment owns independent business truth and history."
    - "The core semantic survives Haircut, BabyCare evidence, and Nail projection without semantic break."
    - "Differences are policy variations or domain extensions, not evidence against shared Beauty-domain ownership."
    - "No non-Beauty vertical evidence has been reconciled, so Platform ownership is not proven."

  platform_promotion_authorized: false
  contract_design_authorized: false
  inventory_change_authorized: false
```

Final H4.1 distinction:

```text
BEAUTY_OS ownership
  != Platform promotion
  != contract design authorization
  != contract inventory change
```

The next H4 work should resolve ownership for the remaining H3 capabilities before contract inventory reconciliation:

```text
H4.2 Resource Allocation Ownership Resolution
H4.3 Professional Recommendation Ownership Resolution
then H5 Contract Inventory Reconciliation
```

---

## Next H4.1 Passes

```yaml
next_passes:
  babycare_evidence_reconciliation:
    status: COMPLETE
    purpose: "Compare BabyCare KTV/session/leave/substitute/commission behavior against Haircut semantic invariants."
    not_purpose: "Copy BabyCare architecture, tables, or services."

  nail_projection:
    status: COMPLETE
    purpose: "Test whether nail technician booking/service flow preserves the same invariant."
    evidence_strength: PROJECTION_ONLY

  consumer_test:
    status: COMPLETE
    consumers:
      appointment: UPSTREAM_SERVICE_COMMITMENT_PRODUCER
      workforce: UPSTREAM_AVAILABILITY_PRODUCER
      commission: DOWNSTREAM_CONSUMER

  semantic_divergence_test:
    status: COMPLETE
    compare:
      - haircut_only_semantics
      - babycare_only_semantics
      - nail_projection_only_semantics
      - cross_product_invariants

  ownership_verdict:
    allowed_values:
      - HAIRCUT_PRODUCT
      - BEAUTY_OS
      - PLATFORM
      - UNRESOLVED
    current_value: BEAUTY_OS
    confidence: MEDIUM_HIGH
    platform_promotion_authorized: false
    contract_design_authorized: false
    inventory_change_authorized: false
```
