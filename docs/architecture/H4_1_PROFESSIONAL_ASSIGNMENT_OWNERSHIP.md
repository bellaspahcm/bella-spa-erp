# H4.1 Professional Assignment Ownership Resolution

**Date:** 2026-09-16

**Branch:** `feat/haircut-h2-contract-extraction`

**Baseline:** `6b521ccd` — H3 Final Boundary Reconciliation

**Status:** H4.1 PASS B COMPLETE — BABYCARE SEMANTIC MAPPING RECORDED

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
  ownership: UNRESOLVED
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
  nail_projection_result: TBD
  semantic_overlap: TBD
  semantic_divergence: TBD

  consumers:
    appointment: TBD
    workforce: TBD
    commission: TBD

  ownership:
    verdict: UNRESOLVED
    confidence: TBD

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

## Next H4.1 Passes

```yaml
next_passes:
  babycare_evidence_reconciliation:
    status: COMPLETE
    purpose: "Compare BabyCare KTV/session/leave/substitute/commission behavior against Haircut semantic invariants."
    not_purpose: "Copy BabyCare architecture, tables, or services."

  nail_projection:
    status: TBD
    purpose: "Test whether nail technician booking/service flow preserves the same invariant."
    evidence_strength: PROJECTION_ONLY

  consumer_test:
    status: TBD
    consumers:
      appointment: TBD
      workforce: TBD
      commission: TBD

  semantic_divergence_test:
    status: TBD
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
    current_value: UNRESOLVED
```
