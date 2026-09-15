# H4.1 Professional Assignment Ownership Resolution

**Date:** 2026-09-16

**Branch:** `feat/haircut-h2-contract-extraction`

**Baseline:** `6b521ccd` — H3 Final Boundary Reconciliation

**Status:** H4.1 STARTED — HAIRCUT SEMANTIC INVARIANT EXTRACTION

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

  haircut_semantic_invariants: IN_PROGRESS
  babycare_matching_invariants: TBD
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

## Next H4.1 Passes

```yaml
next_passes:
  babycare_evidence_reconciliation:
    status: TBD
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
