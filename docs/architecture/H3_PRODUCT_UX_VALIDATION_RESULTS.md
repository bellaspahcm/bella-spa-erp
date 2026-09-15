# H3 Product/UX Validation Results — Bella Haircut Shop

**Date:** 2026-09-15  
**Branch:** `feat/haircut-h2-contract-extraction`  
**Status:** PARTIAL  
**Validation packet:** `H3_PRODUCT_UX_VALIDATION_PACKET.md`  

---

## Evidence Classification

These answers are Product/UX + BA domain requirements established for Bella Haircut. They are not yet observed evidence from a live operating branch.

```yaml
evidence_type: PRODUCT_DOMAIN_REQUIREMENT
validation_strength: PROPOSED_BY_PRODUCT
field_observed: false
```

This is sufficient to continue Product/UX validation. It is not sufficient to mark a boundary as `VALIDATED_SEPARATE` or `VALIDATED_ABSORBED`.

---

## Validation Progress

```yaml
phase: H3 Product/UX Validation
status: PARTIAL
questions:
  answered: 4
  total: 12
use_cases:
  validated: 1
  total: 6
boundaries:
  professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
  resource_allocation: UNRESOLVED
  professional_recommendation: UNRESOLVED
contract_inventory:
  h1_baseline: 8
  effective_count: TBD
  change_authorized: false
phase2_status:
  can_close: false
  reason: "Professional Assignment questions Q1-Q4 and UC1 answered at Product Domain Requirement level; Q5-Q12 and UC2-UC6 still pending."
```

---

## Q1 — Stylist/Barber Reassignment Frequency

```yaml
Q1:
  question: "How often do stylist/barber reassignments happen?"
  answer: daily
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "Stylist is unavailable because of sudden leave or late arrival; the appointment must be reassigned to another suitable professional."
    - "Manager redistributes appointments between stylists during peak hours to balance load and reduce customer waiting time."
  implication:
    professional_assignment: STRONG_SEPARATE_SIGNAL
  boundary_decision: NONE
```

### Operating Scenarios

**Scenario 1 — Staff Becomes Unavailable**

Customer A books a 14:00 appointment with Stylist Minh. At the beginning of the shift, Minh reports sudden leave or late arrival. The manager moves the appointment to Stylist Nam, who has suitable skills and availability. The appointment remains the same business object; the assigned professional changes.

**Scenario 2 — In-Day Load Balancing**

Stylist A has too many customers between 17:00 and 19:00 while Stylist B still has service capacity. The manager moves one appointment from A to B to reduce waiting time. This is normal operational dispatching, not data correction.

### Boundary Signal

Q1 creates a strong signal that Professional Assignment may need behavior separate from Appointment because the product requirement treats reassignment as a normal daily operation:

```text
Appointment A -> Stylist Minh -> Stylist Nam
```

This differs from treating assignment as only the latest appointment field:

```text
Appointment A -> stylist_id = Nam
```

However, Q1 alone does not authorize `VALIDATED_SEPARATE`. Q2 must establish whether Bella Haircut needs assignment history/audit, such as original assignee, final service provider, actor, timestamp, and reason.

---

## Q2 — Assignment History

```yaml
Q2:
  question: "Is assignment history business-critical?"
  answer: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "An appointment initially assigned to Stylist A can later move to Stylist B because A is absent, late, overloaded, or unavailable. The system needs both the previous and new assignment, not only the current stylist."
    - "When a customer complains about a stylist change or service quality, the manager needs to trace who was originally assigned, who ultimately served the customer, when the change happened, and why it happened."
    - "Reassignment history supports operations analysis: which stylists are frequently reassigned away from customers, who often receives replacement customers, why dispatch changes happen, and how volatile schedules are."
    - "Assignment history may feed commission calculation, performance review, and dispute handling; storing only the current stylist loses the operational dispatch trail."
  implication:
    professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
  boundary_decision: NONE
```

### Operating Scenarios

**Scenario 1 — Original and Final Assignee Differ**

An appointment is initially assigned to Stylist A. Before service starts, the appointment is moved to Stylist B because A is absent, late, overloaded, or otherwise unavailable. Bella Haircut needs to preserve both the original assignment and the final service provider.

**Scenario 2 — Customer Complaint or Service Quality Review**

A customer complains that the stylist was changed or that service quality did not match expectation. The manager needs to review who was assigned first, who performed the service, when the change happened, who made the change, and the stated reason.

**Scenario 3 — Operations Analytics and Compensation**

Reassignment history can support operational analysis, commission calculation, performance review, and dispute handling. If only `current_stylist_id` is stored, the dispatch path is destroyed after each update.

### Boundary Signal

Q2 adds a durable history requirement to Professional Assignment:

```text
Appointment -> Stylist A -> Stylist B -> Stylist C
```

This is materially different from storing only:

```text
Appointment -> current_stylist_id = Stylist C
```

The requirement now includes time-based assignment data: who was assigned, when, who changed it, from whom, to whom, and why. This creates a very strong signal that Professional Assignment may own durable history independent of Appointment.

However, Q1 + Q2 still do not authorize `VALIDATED_SEPARATE`. Q3 and UC1-UC4 must validate whether assignment has workflow/lifecycle behavior beyond history.

---

## Q3 — Assignment Acceptance / Rejection

```yaml
Q3:
  question: "Can stylists/barbers reject assignments?"
  answer: controlled_rejection
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "Stylists/barbers should not have unrestricted authority to refuse customers because branch operations and customer commitments still need manager control."
    - "Stylists/barbers should be able to flag or reject unsuitable assignments for controlled reasons such as skill mismatch, service not supported, overload, health/safety concern, or customer-specific constraint."
    - "A manager or authorized dispatcher can review the rejection reason, override when appropriate, or reassign the appointment to another suitable professional."
    - "The system should preserve rejection reason, actor, timestamp, and follow-up assignment so the branch can distinguish valid operational rejection from refusal without acceptable reason."
  operating_policy:
    free_rejection_allowed: false
    controlled_rejection_allowed: true
    manager_override_allowed: true
    rejection_reason_required: true
    reassignment_required_when_rejection_accepted: true
  implication:
    professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
    assignment_status: REQUIRED
    rejection_reason: REQUIRED
    manager_override: REQUIRED
    assignment_lifecycle: STRONG_SIGNAL
  boundary_decision: NONE
```

### Operating Policy

Q3 establishes controlled rejection, not unrestricted professional autonomy.

Correct model:

```text
Manager/System proposes assignment
  -> Professional may accept
  -> Professional may reject with controlled reason
  -> Manager may override or reassign
```

This means Assignment needs status and decision history, but the product requirement still does not authorize interface design or final boundary closure.

---

## Q4 — Stylist/Barber No-Show Tracking

```yaml
Q4:
  question: "Are stylist/barber no-shows tracked/analyzed?"
  answer: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "A stylist/barber assigned to an appointment is not present at service time; the system needs to record the affected assignment and support moving the customer to another professional."
    - "Managers need to distinguish customer reassignment caused by staff no-show from reassignment caused by customer request, skill mismatch, overload, or proactive dispatch."
    - "One staff no-show can affect multiple appointments in the same shift; the system should help identify impacted assignments for bulk handling."
    - "Assignment history needs to show the affected appointment, original stylist, replacement stylist, reassignment time, and STAFF_NO_SHOW reason."
    - "Staff no-show data may support operations review, but the source of truth for staff attendance should belong to Workforce/Attendance if that capability exists."
  operating_policy:
    track_staff_no_show: true
    assignment_reason_code: STAFF_NO_SHOW
    reassignment_required_when_possible: true
    bulk_impact_possible: true
    assignment_owns_staff_attendance: false
  ownership_note:
    workforce_attendance:
      owns: "Staff presence, absence, late arrival, and shift attendance events."
    professional_assignment:
      owns: "Impact of attendance events on assignments and reassignment flow."
    appointment:
      owns: "Customer appointment lifecycle and service status."
  implication:
    professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
    assignment_history: REQUIRED
    reassignment: REQUIRED
    assignment_lifecycle: STRONG_SIGNAL
    workforce_dependency: POSSIBLE
  boundary_decision: NONE
```

### Ownership Boundary

Q4 must not turn Professional Assignment into a staff attendance or workforce system.

Correct ownership:

```text
Stylist no-show
  -> Workforce/Attendance owns the staff attendance fact, if that capability exists
  -> Professional Assignment owns the impact on affected assignments and reassignment
  -> Appointment owns the customer appointment lifecycle
```

Example:

```text
Appointment #A001 remains CONFIRMED
Assignment: Stylist A ACCEPTED -> STAFF_NO_SHOW -> Stylist B PROPOSED -> Stylist B ACCEPTED
```

This strengthens the signal that Professional Assignment may have lifecycle behavior, but it still does not authorize `VALIDATED_SEPARATE`. Q3 and UC1-UC4 must validate whether the lifecycle is coherent and required.

---

## UC1 — Customer Books Without Stylist/Barber Selection

```yaml
UC1:
  name: CUSTOMER_BOOKS_WITHOUT_STYLIST
  valid_business_flow: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  workflow:
    step_1:
      action: CREATE_APPOINTMENT
      appointment_status: PENDING
      professional_assignment: NONE
      description: "Customer selects service, date/time, and required customer details. Stylist/barber selection is optional."
    step_2:
      action: CHECK_APPOINTMENT_FEASIBILITY
      description: "System checks basic service feasibility for the selected time slot. Appointment feasibility does not mean a specific stylist has accepted the work."
    step_3:
      action: GENERATE_PROFESSIONAL_RECOMMENDATION
      actor: SYSTEM
      persistence_effect: NONE
      description: "When no stylist is selected, the system generates suitable professional candidates from configured policy."
      note: "Recommendation does not persist assignment."
    step_4:
      action: CREATE_ASSIGNMENT
      assignment_status: PROPOSED
      description: "A professional selected by recommendation or manager choice becomes a PROPOSED assignment."
    step_5:
      action: PROFESSIONAL_DECISION
      possible_results:
        - ACCEPTED
        - REJECTED
    step_6a:
      condition: ACCEPTED
      assignment_status: ACCEPTED
      description: "Stylist/barber officially accepts the appointment assignment."
    step_6b:
      condition: REJECTED
      assignment_status: REJECTED
      requirements:
        reason_required: true
        history_preserved: true
      next:
        - MANAGER_REASSIGN
        - SYSTEM_RECOMMEND_AGAIN
      description: "Rejected assignment remains in history. Manager or system finds another professional."
    step_7:
      action: REASSIGN_IF_REQUIRED
      assignment_status: PROPOSED
      description: "Create a new proposed assignment for a replacement professional without overwriting the rejected assignment history."
  appointment_lifecycle:
    initial_status: PENDING
    assignment_rejection_changes_appointment_status: false
    description: "Appointment and Professional Assignment have independent lifecycles. Stylist rejection does not automatically cancel the appointment."
  assignment_lifecycle:
    primary_flow:
      - PROPOSED
      - ACCEPTED
    rejection_flow:
      - PROPOSED
      - REJECTED
      - REASSIGNED
      - PROPOSED
      - ACCEPTED
  recommendation:
    owns_assignment: false
    persists_assignment: false
    role: ADVISORY
    manager_can_override: true
  implication:
    professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
    independent_lifecycle: STRONG_EVIDENCE
    history_required: true
    recommendation_separate_from_assignment: true
  boundary_decision: NONE
```

### Concept Separation

UC1 validates three separate concepts:

```text
APPOINTMENT
Customer wants service at a time
        |
        v
RECOMMENDATION
System says A/B/C are suitable
        |
        v
ASSIGNMENT
A is proposed to serve the appointment
        |
        +-- ACCEPTED
        +-- REJECTED -> find another professional
```

Recommendation is advisory. It does not own or persist assignment. A manager can override recommendation.

### Appointment Policy Note

Do not prematurely require Appointment to become `CONFIRMED` only after Assignment is `ACCEPTED`. Some salons may confirm the customer appointment first and dispatch the professional later. Appointment confirmation policy must remain a separate operating decision.

### Boundary Signal

UC1 strongly reinforces that Professional Assignment has its own lifecycle and history. It still does not authorize `VALIDATED_SEPARATE`; UC2-UC4 must test conflict, reassignment, and no-show paths.

---

## Pending Questions

### Professional Assignment Group Status

```yaml
professional_assignment:
  Q1_reassignment_frequency: daily
  Q2_assignment_history: required
  Q3_acceptance_rejection: controlled_rejection
  Q4_staff_no_show_impact: tracked
  combined_signal: VERY_STRONG_SEPARATE_SIGNAL
  evidence_strength: PROPOSED_BY_PRODUCT
  boundary_decision: NONE
```

Q1-Q4 form a strong product requirement signal that Professional Assignment is more than a simple appointment `stylist_id`. The next step is not contract design; it is UC1-UC4 walkthrough to test whether these requirements form a coherent workflow.

### Q5-Q12 — Resource Allocation and Recommendation

Q5-Q12 remain unanswered.

### UC2-UC6 — Use Case Walkthroughs

UC1 is recorded. UC2-UC4 should continue testing whether Q1, Q2, Q3, and Q4 form a coherent Professional Assignment lifecycle.
