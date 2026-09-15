# H3 Product/UX Validation Results — Bella Haircut Shop

**Date:** 2026-09-15  
**Branch:** `feat/haircut-h2-contract-extraction`  
**Status:** PARTIAL  
**Validation packet:** `H3_PRODUCT_UX_VALIDATION_PACKET.md`  
**BabyCare assignment audit:** `H3_BABYCARE_ASSIGNMENT_AUDIT.md`

**BabyCare capability reconciliation:** `H3_BABYCARE_CAPABILITY_RECONCILIATION.md`

**Legacy financial domain evidence:** `H3_LEGACY_FINANCIAL_DOMAIN_EVIDENCE.md`

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
  answered: 12
  total: 12
use_cases:
  validated: 6
  total: 6
boundaries:
  professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
  resource_allocation: VERY_STRONG_SEPARATE_SIGNAL
  professional_recommendation: COMPLEX_POLICY_CAPABILITY
contract_inventory:
  h1_baseline: 8
  effective_count: TBD
  change_authorized: false
phase2_status:
  can_close: false
  reason: "H3 validation input is complete: Q1-Q12 answered and UC1-UC6 validated at Product Domain Requirement level. Boundary decisions and H2 Phase 2 closure still require final boundary reconciliation."
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

## UC2 — Customer Requests Busy Stylist/Barber

```yaml
UC2:
  name: CUSTOMER_REQUESTS_BUSY_STYLIST
  valid_business_flow: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  scenario:
    requested_time: "14:00"
    requested_professional: "Stylist A"
    condition: "Stylist A already has an incompatible overlapping assignment."
  workflow:
    step_1:
      action: CHECK_APPOINTMENT_TIME
      owner: APPOINTMENT_SCHEDULING
      description: "Check whether the salon can receive an appointment at 14:00, independent of whether Stylist A is available."
    step_2:
      action: CHECK_PROFESSIONAL_AVAILABILITY
      owner: PROFESSIONAL_ASSIGNMENT
      result: CONFLICT
      description: "Check whether Stylist A can accept the requested assignment window. Existing incompatible overlap creates conflict."
    step_3:
      action: DO_NOT_CREATE_INVALID_ASSIGNMENT
      assignment_created: false
      description: "Do not create a PROPOSED assignment for Stylist A when the system already knows it violates a hard conflict."
    step_4:
      action: PRESERVE_CUSTOMER_INTENT
      description: "Do not automatically cancel the customer's booking intent only because Stylist A is unavailable."
    step_5:
      action: GENERATE_ALTERNATIVES
      alternatives:
        - SAME_TIME_DIFFERENT_PROFESSIONAL
        - DIFFERENT_TIME_SAME_PROFESSIONAL
        - WAITLIST_REQUESTED_PROFESSIONAL
      description: "Suggest a different professional at the same time, a different time for Stylist A, or waitlist if the customer only wants Stylist A."
  conflict_ownership:
    appointment_scheduling:
      owns:
        - "Validity of appointment time"
        - "Salon/business opening availability"
        - "Appointment temporal lifecycle"
    professional_assignment:
      owns:
        - "Professional availability for assignment"
        - "Professional overlap detection"
        - "Whether a professional can accept another assignment"
    recommendation:
      owns:
        - "Ranking feasible alternatives"
      does_not_own:
        - "Conflict truth"
        - "Assignment persistence"
  hard_conflict_policy:
    default: BLOCK_ASSIGNMENT
    manager_override: false
    rationale: "Two services that truly require the same stylist at the same time cannot become feasible by manager override."
  appointment:
    may_be_preserved: true
    possible_status: PENDING
    cancellation_required: false
  assignment:
    invalid_assignment_created: false
    status_when_conflict_detected: NONE
  recommendation:
    suggest_alternative_professional: true
    suggest_alternative_time: true
    waitlist_option: true
    advisory_only: true
  implication:
    professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
    professional_conflict_detection: ASSIGNMENT_OWNED
    appointment_scheduling: DISTINCT_TEMPORAL_RESPONSIBILITY
    recommendation: ADVISORY
    waitlist_engine: POTENTIAL_CONSUMER
  boundary_decision: NONE
```

### Conflict Handling

UC2 separates customer booking intent from invalid assignment creation:

```text
Request Stylist A at 14:00
        |
        v
Professional availability check
        |
        v
Hard conflict
        |
        v
Do not create Assignment
        |
        v
Suggest alternatives or waitlist
```

Do not use `PROPOSED -> CONFLICTED` when the system already knows the proposed assignment is impossible. Do not use `REJECTED` either, because Stylist A did not reject; the system determined A is unavailable.

### Hard vs Soft Conflict

Hard conflicts should block assignment and should not be manager-overridable. Soft conflicts may be overridable, such as high workload warnings or too-short transition time. UC2 only establishes the hard-conflict policy.

### Active Professional Segments

Some future services may include periods where the professional is not actively required for the entire appointment window, such as chemical processing wait time. This means UC4 must test whether Professional Assignment needs active professional segments rather than treating the full appointment duration as fully blocking.

### Boundary Signal

UC2 reinforces three separate responsibilities:

```text
Appointment Scheduling -> can the salon receive an appointment at this time?
Professional Assignment -> can this professional be assigned at this time?
Recommendation -> what feasible alternative should be suggested?
```

This strongly reinforces assignment-owned professional conflict detection. It still does not authorize `VALIDATED_SEPARATE`; UC3-UC4 must test reassignment and double-booking paths.

---

## UC3 - Stylist Sick / No-Show / Unavailable Reassignment

```yaml
UC3:
  name: STYLIST_UNAVAILABLE_REASSIGNMENT
  valid_business_flow: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  cross_product_evidence:
    babycare:
      leave_reassignment: IMPLEMENTED
      affected_session_lookup: IMPLEMENTED
      replacement_assignment: IMPLEMENTED
      rollback_protection: IMPLEMENTED
      structured_assignment_history: PARTIAL
      accept_reject_lifecycle: NOT_FOUND
  trigger:
    examples:
      - SICK_LEAVE
      - STAFF_NO_SHOW
      - LATE_ARRIVAL
      - EMERGENCY_UNAVAILABLE
  workflow:
    step_1:
      action: RECORD_STAFF_UNAVAILABILITY
      owner: WORKFORCE_ATTENDANCE
      description: "Workforce/Attendance owns the fact that the stylist is absent, late, on approved leave, or otherwise unavailable."
    step_2:
      action: FIND_AFFECTED_ASSIGNMENTS
      owner: PROFESSIONAL_ASSIGNMENT
      description: "Find future active assignments affected by the professional's unavailable time window."
    step_3:
      action: DISRUPT_CURRENT_ASSIGNMENT
      owner: PROFESSIONAL_ASSIGNMENT
      previous_status: ACCEPTED
      new_status: DISRUPTED
      requirements:
        preserve_original_assignment: true
        reason_code_required: true
        actor_required: true
        timestamp_required: true
    step_4:
      action: FIND_REPLACEMENT
      owner: PROFESSIONAL_RECOMMENDATION
      role: ADVISORY
      factors:
        - SERVICE_SKILL
        - AVAILABILITY
        - ACTIVE_WORKLOAD
        - TIME_CONFLICT
        - RESOURCE_COMPATIBILITY
      description: "Recommendation returns feasible replacement candidates but does not own assignment persistence."
    step_5:
      action: CREATE_REPLACEMENT_ASSIGNMENT
      owner: PROFESSIONAL_ASSIGNMENT
      status: PROPOSED
      replacement_link_required: true
      description: "Replacement is a new assignment rather than overwriting the original assignment."
    step_6:
      action: PROFESSIONAL_DECISION
      possible_results:
        - ACCEPTED
        - REJECTED
      rejection_requires_reason: true
    step_7a:
      condition: ACCEPTED
      result:
        replacement_assignment: ACCEPTED
        appointment: PRESERVED
    step_7b:
      condition: REJECTED
      result:
        replacement_assignment: REJECTED
        next:
          - RECOMMEND_ANOTHER_PROFESSIONAL
          - MANAGER_MANUAL_ASSIGNMENT
    step_8:
      condition: NO_FEASIBLE_REPLACEMENT
      result:
        appointment_cancelled_automatically: false
        options:
          - SMART_WAITLIST
          - OFFER_DIFFERENT_TIME
          - CUSTOMER_CONTACT_REQUIRED
          - CUSTOMER_CANCEL_IF_DECLINED
  bulk_reassignment:
    required: true
    rationale: "One stylist absence can affect multiple appointments in the same shift, so handling each appointment manually is insufficient for chain operations."
  appointment_lifecycle:
    independent: true
    stylist_unavailable_automatically_cancels_appointment: false
  assignment_history:
    durable: true
    preserve:
      - ORIGINAL_PROFESSIONAL
      - ORIGINAL_ASSIGNMENT_STATUS
      - DISRUPTION_REASON
      - DISRUPTION_TIME
      - ACTOR
      - REPLACEMENT_ASSIGNMENT
      - REPLACEMENT_PROFESSIONAL
      - FINAL_SERVICE_PROVIDER
  ownership:
    workforce_attendance:
      owns:
        - STAFF_ABSENCE
        - LEAVE
        - LATE_ARRIVAL
        - ATTENDANCE_FACT
    professional_assignment:
      owns:
        - AFFECTED_ASSIGNMENT_DISCOVERY
        - ASSIGNMENT_DISRUPTION
        - REASSIGNMENT
        - REPLACEMENT_RELATIONSHIP
        - ASSIGNMENT_HISTORY
    professional_recommendation:
      owns:
        - REPLACEMENT_CANDIDATE_RANKING
      does_not_own:
        - ASSIGNMENT_STATE
        - ASSIGNMENT_HISTORY
    appointment:
      owns:
        - CUSTOMER_APPOINTMENT_LIFECYCLE
    smart_waitlist:
      participates_when:
        - NO_REPLACEMENT_AVAILABLE
        - CUSTOMER_ACCEPTS_WAITING
  implication:
    professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
    independent_lifecycle: VERY_STRONG_EVIDENCE
    durable_history: REQUIRED
    bulk_operations: REQUIRED
    workforce_dependency: CONFIRMED_CONCEPTUAL_BOUNDARY
    recommendation_dependency: CONFIRMED_CONCEPTUAL_BOUNDARY
    smart_waitlist: CONDITIONAL_CONSUMER
  boundary_decision: NONE
```

### Cross-Product Difference

BabyCare currently proves this operational shape:

```text
KTV leave
  -> find affected sessions
  -> update completed_by_ktv_id
  -> write note / notification
  -> continue session
```

Haircut requires a deeper assignment lifecycle:

```text
Stylist A ACCEPTED
  -> A sick / no-show / unavailable
  -> Assignment A = DISRUPTED
  -> preserve reason, actor, timestamp, and history
  -> recommend B/C/D
  -> Assignment B = PROPOSED
  -> ACCEPTED or REJECTED
```

This means Haircut should not copy a simple mutation model such as:

```sql
UPDATE appointment
SET stylist_id = B;
```

or even only:

```sql
UPDATE session
SET professional_id = B;
```

Those shapes would destroy the dispatch trail required by Q2, Q3, Q4, and UC3.

### Waitlist Role

Smart Waitlist does not own reassignment. It participates only when the product cannot produce a feasible replacement or alternative time and the customer accepts waiting.

```text
Stylist A unavailable
  -> replacement available?
     -> yes: reassign
     -> no: offer different time
        -> no feasible/accepted time: Smart Waitlist or customer contact
```

### Boundary Signal

UC3 adds very strong evidence that Professional Assignment has an independent reassignment lifecycle:

- Staff absence belongs to Workforce/Attendance.
- Affected assignment discovery and disruption belong to Professional Assignment.
- Replacement ranking belongs to Professional Recommendation.
- Appointment remains preserved unless the customer or business policy cancels it.
- Smart Waitlist is a conditional consumer, not the reassignment owner.

This is still not `VALIDATED_SEPARATE`. UC4 must test whether professional conflict is based on full appointment duration or active professional segments.

---

## UC4 - Stylist/Barber Double Booking With Active Professional Segments

```yaml
UC4:
  name: STYLIST_DOUBLE_BOOKING_ACTIVE_PROFESSIONAL_SEGMENTS
  valid_business_flow: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  principle:
    full_appointment_duration_blocks_professional: false
    full_appointment_overlap_is_sufficient_for_professional_conflict: false
    active_professional_segments_required: true
  example:
    service: PERM_OR_COLOR
    appointment_duration_minutes: 120
    segments:
      - name: APPLY
        type: ACTIVE_PROFESSIONAL
        duration_minutes: 30
        professional_occupied: true
        resource_occupied: true
      - name: PROCESS
        type: PROCESSING_WAIT
        duration_minutes: 40
        professional_occupied: false
        resource_occupied: true
      - name: FINISH
        type: ACTIVE_PROFESSIONAL
        duration_minutes: 50
        professional_occupied: true
        resource_occupied: true
  simple_service_example:
    service: MENS_CUT
    segments:
      - name: CUT
        type: ACTIVE_PROFESSIONAL
        duration_minutes: 30
        professional_occupied: true
        resource_occupied: true
  business_requirement:
    stylist_can_serve_customer_b_while_customer_a_processing: true
    condition: "Customer A segment does not require direct professional attention."
  conflict_policy:
    professional_conflict_basis: ACTIVE_PROFESSIONAL_SEGMENTS
    hard_conflict:
      condition: ACTIVE_PROFESSIONAL_SEGMENT_OVERLAP
      action: BLOCK
      manager_override: false
    soft_conflict_examples:
      - HIGH_ACTIVE_WORKLOAD
      - SHORT_TRANSITION_BUFFER
      - SKILL_PREFERENCE_MISMATCH
  time_commitments:
    appointment:
      owns: SERVICE_TIME_FLOW
      examples:
        - TOTAL_CUSTOMER_VISIT_WINDOW
        - SERVICE_PHASE_SEQUENCE
    professional_assignment:
      owns: PROFESSIONAL_ACTIVE_TIME_COMMITMENT
      examples:
        - ACTIVE_PROFESSIONAL_SEGMENT
        - PROFESSIONAL_DOUBLE_BOOKING_CONFLICT
    resource_allocation:
      owns: RESOURCE_TIME_COMMITMENT
      examples:
        - CHAIR_OR_STATION_OCCUPIED_DURING_PROCESSING
        - RESOURCE_DOUBLE_BOOKING_CONFLICT
  implication:
    professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
    resource_allocation: SEPARATE_SIGNAL
    appointment_time_flow: REQUIRED
    professional_availability_differs_from_resource_availability: true
    conflict_engine_must_not_assume_full_duration_professional_occupancy: true
  boundary_decision: NONE
```

### Operating Model

Haircut services can contain service phases where the customer remains inside the appointment and the chair or station remains occupied, but the stylist/barber is released to perform active work for another customer.

```text
Perm / color appointment: 14:00 -> 16:00

14:00-14:30  ACTIVE_PROFESSIONAL
14:30-15:10  PROCESSING_WAIT
15:10-16:00  ACTIVE_PROFESSIONAL
```

During `PROCESSING_WAIT`, the system must not mark the professional as busy for the full appointment duration if the phase does not require direct professional work. However, the resource may still be occupied. This establishes an important split:

```text
Professional availability != Resource availability
```

### Conflict Rule

A professional double booking conflict is not proven by full appointment overlap alone. It is proven when active professional segments overlap.

```text
Appointment A: 14:00-16:00
  Active: 14:00-14:30
  Wait:   14:30-15:10
  Active: 15:10-16:00

Appointment B:
  14:35-15:05 active stylist work -> allowed if other constraints pass
  15:20-15:50 active stylist work -> hard conflict
```

If two active professional segments physically overlap for the same stylist/barber, the assignment must be blocked. Manager override is not allowed for this hard conflict because the professional cannot perform two direct-service segments at the same time.

### Boundary Signal

UC4 closes the Professional Assignment use-case group at Product Domain Requirement level. Q1-Q4 and UC1-UC4 now show that Haircut has at least three distinct time commitments:

```text
Appointment -> customer service flow and visit window
Professional Assignment -> active professional time commitment
Resource Allocation -> chair/station/resource time commitment
```

This is a very strong separate signal for Professional Assignment and a separate signal for Resource Allocation. It is still not a final boundary decision; it authorizes moving to Q5-Q8 and UC5-UC6 for Resource Allocation validation.

---

## Q5 - Resource Maintenance Window

```yaml
Q5:
  question: "Do chairs, wash chairs, stations, or service resources need time-windowed unavailability?"
  answer: regular
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "Chair, station, or equipment can be blocked on schedule for maintenance, deep cleaning, or technical inspection."
    - "Resources can also become unavailable because of ad hoc damage or sudden operational issues."
    - "During an unavailable window, the system must not allocate that resource to a new appointment or service segment."
    - "Existing bookings that overlap a maintenance window must be detected so managers can handle them."
  operating_policy:
    planned_maintenance: true
    adhoc_unavailability: true
    availability_window_required: true
    conflict_detection_required: true
    automatic_reassignment: false
  implication:
    resource_allocation: STRONG_SEPARATE_SIGNAL
  boundary_decision: NONE
```

### Resource Availability vs Allocation

Maintenance is not the same concept as allocation. Maintenance changes whether a resource can be used during a time window; allocation is the commitment of that resource to an appointment or service segment.

```text
Resource
  -> Availability
     -> AVAILABLE
     -> UNAVAILABLE
        -> Maintenance / repair / deep cleaning

Appointment or service segment
  -> Resource Allocation
     -> chair / wash chair / station / equipment
```

UC4 already established the operational split:

```text
Customer A is waiting during chemical processing

Professional: RELEASED
Resource:     OCCUPIED
Appointment:  STILL_ACTIVE
```

Therefore Haircut must not collapse these three concepts:

```text
Professional availability != Resource availability != Appointment duration
```

### Boundary Signal

Q5 creates a strong separate signal for Resource Allocation because resources have their own availability windows and conflict rules. However, this is still not a boundary decision. Q6 must validate whether stylists/barbers share constrained resources such as limited wash chairs, color stations, steamers, or other equipment.

---

## Q6 - Shared Constrained Equipment

```yaml
Q6:
  question: "Do stylists/barbers share constrained equipment?"
  answer: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "A branch can have more stylists than wash chairs, stations, or specialized equipment."
    - "A stylist can be available while a required service step still cannot start because the required resource is occupied."
    - "A service can use different resources by service segment instead of holding one resource for the full appointment."
    - "Resource conflict must be checked independently from professional conflict."
  operating_policy:
    shared_resources: true
    finite_capacity: true
    resource_required_by_service_segment: true
    independent_resource_conflict_check: true
  implication:
    resource_allocation: VERY_STRONG_SEPARATE_SIGNAL
    segment_based_allocation: STRONG_SIGNAL
  boundary_decision: NONE
```

### Segment-Based Resource Commitment

Q6 connects directly to UC4. The same appointment can have one professional commitment timeline and a different resource commitment timeline.

```text
Perm / color appointment

14:00        14:30        15:10        15:30       16:00
|------------|-------------|------------|-----------|
 APPLY        PROCESS       WASH         FINISH

 Stylist A    Stylist free  Stylist A    Stylist A
 Station 3    Station 3     Wash Chair 2 Station 3
```

This creates two parallel commitments:

```text
PROFESSIONAL COMMITMENT
Appointment A
  -> 14:00-14:30 Stylist A
  -> 14:30-15:10 RELEASED
  -> 15:10-15:30 Stylist A
  -> 15:30-16:00 Stylist A

RESOURCE COMMITMENT
Appointment A
  -> 14:00-15:10 Station 3
  -> 15:10-15:30 Wash Chair 2
  -> 15:30-16:00 Station 3
```

Service Segment describes what the work needs. Professional Assignment answers who performs the active work. Resource Allocation answers which finite resource is committed for each service segment.

```text
Service Segment -> work requirement
Professional Assignment -> who performs it
Resource Allocation -> which resource is used
```

### Boundary Signal

Q6 makes Resource Allocation stronger than simple availability checking. The system must understand shared finite resources, segment-level resource requirements, and resource conflicts independent of professional availability.

This still does not authorize `VALIDATED_SEPARATE`. Q7 must test whether resource changes or reallocations happen frequently enough to create a resource allocation lifecycle, or whether Resource Allocation remains primarily availability/capacity checking.

---

## Q7 - Resource Reassignment Frequency

```yaml
Q7:
  question: "How often are chairs/stations/resources reassigned?"
  answer: frequent
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "Chair or station may need to change when the assigned resource breaks or must be blocked urgently."
    - "Manager may move a customer to another station to reduce waiting time or rebalance resource usage."
    - "A service may move between resources by segment, such as cutting station -> wash chair -> cutting station."
    - "If an earlier service runs long and keeps a resource longer than expected, the next appointment may need a replacement resource."
    - "Resource changes must preserve the original resource, replacement resource, timestamp, reason, and actor when audit is required."
  operating_policy:
    resource_reassignment_allowed: true
    in_day_reallocation: true
    emergency_reallocation: true
    segment_resource_change: true
    reassignment_reason_required: true
    history_required: true
  implication:
    resource_allocation: VERY_STRONG_SEPARATE_SIGNAL
    resource_allocation_lifecycle: STRONG_SIGNAL
    resource_history: REQUIRED
  boundary_decision: NONE
```

### Planned Segment Allocation vs Operational Reallocation

Q7 separates normal service design from operational exception handling.

Planned segment allocation is part of the intended service flow:

```text
Service flow
  -> Cutting Station #3
  -> Wash Chair #2
  -> Cutting Station #3
```

Operational reallocation happens after a resource commitment already exists:

```text
Wash segment
  -> Wash Chair #2
  -> CHAIR_OUT_OF_SERVICE
  -> Wash Chair #4
```

Both cases are lost if the system only stores one `appointment.resource_id`. Planned segment allocation needs segment-level commitments. Operational reallocation needs history of the original resource, replacement resource, reason, actor, and time.

### Symmetry With Professional Assignment

Q7 creates a parallel with Professional Assignment without collapsing the two concepts:

```text
Professional Assignment
  Stylist A -> unavailable -> Stylist B
  Question: who performs?

Resource Allocation
  Chair 2 -> unavailable -> Chair 4
  Question: what is used?

Appointment
  Same customer service commitment is preserved.
```

### Boundary Signal

Q7 strengthens Resource Allocation from availability/capacity checking into an operational lifecycle signal. However, it still does not authorize `VALIDATED_SEPARATE`. Q8 must validate whether resources are a real capacity bottleneck relative to stylists/barbers, then UC5 and UC6 must test whether this lifecycle and conflict model stays coherent in end-to-end workflows.

---

## Q8 - Resource Capacity Bottleneck

```yaml
Q8:
  question: "Are chairs/stations/resources a bottleneck compared with stylists?"
  answer: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "A branch can have available stylists while wash chairs, cutting stations, or specialized equipment are insufficient for simultaneous service segments."
    - "Appointment intake depends on both professional capacity and resource capacity."
    - "An appointment can be feasible for stylist availability but infeasible for required resource availability."
    - "The bottleneck can change by service mix; peak color or perm hours may overload wash chairs or equipment while stylists remain available."
    - "Capacity planning must treat professional capacity and resource capacity as independent dimensions."
  operating_policy:
    resource_can_be_bottleneck: true
    professional_can_be_bottleneck: true
    bottleneck_is_service_dependent: true
    resource_capacity_checked_independently: true
  implication:
    resource_allocation: VERY_STRONG_SEPARATE_SIGNAL
    independent_capacity_dimension: STRONG_EVIDENCE
  boundary_decision: NONE
```

### Capacity Feasibility

Haircut appointment intake cannot be reduced to one question:

```text
Is a stylist available?
  -> yes
  -> accept appointment
```

The feasibility check must evaluate at least three dimensions:

```text
Appointment Request
  -> service/time feasible?
  -> professional feasible?
  -> resource feasible?
       -> appointment can be accepted
```

For example, a branch can have 8 stylists but only 3 wash chairs. At 15:00, if all 3 wash chairs are occupied, Stylist D may still be available while a new customer requiring a `WASH` segment at 15:00 is not feasible.

```text
Professional capacity = AVAILABLE
Resource capacity     = FULL

Result:
  service segment is not feasible yet
```

At the same time, a simple `CUT` service could still be feasible if a cutting station and stylist are available. The bottleneck is service-dependent, not a single branch-wide capacity number.

### Effective Capacity

Haircut capacity should not be treated as:

```text
Salon capacity = number of stylists
```

The Product Domain Requirement is closer to:

```text
Effective capacity
  = feasibility(
      service segments,
      professional capacity,
      resource capacity,
      time
    )
```

### Boundary Signal

Q5-Q8 complete the Resource Allocation question group at Product Domain Requirement level:

```yaml
resource_allocation_question_group:
  Q5_resource_maintenance_window: regular
  Q6_shared_constrained_equipment: yes
  Q7_resource_reassignment_frequency: frequent
  Q8_resource_bottleneck: yes
  combined_signal: VERY_STRONG_SEPARATE_SIGNAL
  boundary_decision: NONE
```

This does not authorize contract design or `VALIDATED_SEPARATE`. UC5 must validate chair/station double booking to test whether Resource Allocation conflict is genuinely different from Professional Assignment conflict, and UC6 must test end-to-end resource reallocation behavior.

---

## UC5 - Chair/Station Double Booking

```yaml
UC5:
  name: CHAIR_STATION_DOUBLE_BOOKING
  valid_business_flow: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  scenario:
    resource: "Wash Chair #2"
    condition: "Two service segments require exclusive use of the same resource during overlapping time."
  workflow:
    step_1:
      action: RESOLVE_SEGMENT_RESOURCE_REQUIREMENT
      owner: SERVICE_DEFINITION
      description: "Determine what resource type or capacity the service segment requires."
    step_2:
      action: CHECK_RESOURCE_AVAILABILITY
      owner: RESOURCE_ALLOCATION
      description: "Check the resource commitment window for the relevant service segment."
    step_3:
      condition: EXCLUSIVE_RESOURCE_OVERLAP
      result: HARD_CONFLICT
      allocation_created: false
    step_4:
      action: GENERATE_FEASIBLE_ALTERNATIVES
      alternatives:
        - SAME_TIME_DIFFERENT_RESOURCE
        - SHIFT_SEGMENT_TIME
        - WAIT_FOR_RESOURCE
        - SMART_WAITLIST_IF_APPOINTMENT_CANNOT_BE_FULFILLED
  hard_conflict_policy:
    exclusive_resource_overlap: BLOCK
    manager_override: false
  resource_model:
    full_appointment_lock_required: false
    segment_based_commitment: true
    different_resource_per_segment: true
    pooled_resources_supported: true
    capacity_based_resources_supported: true
  capacity_model:
    capacity_one:
      max_concurrent_allocations: 1
      exclusive_overlap_is_hard_conflict: true
    capacity_n:
      max_concurrent_allocations: "resource.capacity"
      hard_conflict_when: "concurrent allocation count exceeds capacity"
    resource_pool:
      allocation_rule: "any compatible resource in the pool can satisfy the segment requirement"
  ownership:
    appointment_scheduling:
      owns:
        - CUSTOMER_TIME_AND_SERVICE_FEASIBILITY
    professional_assignment:
      owns:
        - PROFESSIONAL_ACTIVE_CAPACITY
    resource_allocation:
      owns:
        - RESOURCE_SEGMENT_COMMITMENT
        - RESOURCE_CAPACITY_CONFLICT
        - RESOURCE_ALLOCATION_ALTERNATIVES
    smart_waitlist:
      participates_when:
        - RESOURCE_CONFLICT_PREVENTS_APPOINTMENT_FULFILLMENT
  implication:
    resource_allocation: VERY_STRONG_SEPARATE_SIGNAL
    segment_based_allocation: VERY_STRONG_EVIDENCE
    independent_resource_conflict: VERY_STRONG_EVIDENCE
    finite_capacity: REQUIRED
    alternative_allocation: REQUIRED
  boundary_decision: NONE
```

### Segment Conflict Example

UC5 does not mean a resource is locked for the whole appointment when it is only needed for one segment.

```text
Appointment A
14:00  CUT      Station #3
14:30  PROCESS  Station #3
15:10  WASH     Wash Chair #2

Appointment B
14:40  CUT      Station #5
15:10  WASH     Wash Chair #2  -> CONFLICT
```

The conflict is on the resource commitment window:

```text
Wash Chair #2

15:10 -------- 15:30
████ Appointment A

15:15 -------- 15:35
████ Appointment B

       overlap -> HARD CONFLICT
```

The system must not infer:

```text
Appointment A 14:00-16:00
  -> Wash Chair #2 locked for 120 minutes
```

The correct model is segment-based commitment:

```text
Wash Chair #2 is committed only for the WASH segment window.
```

### Capacity Nuance

`manager_override: false` applies to an exclusive hard conflict: one resource capacity unit cannot serve two customers at the same time. Resource Allocation must still be able to represent resources with different capacity shapes:

```text
Resource capacity = 1
  -> at most 1 concurrent allocation

Resource capacity = 3
  -> at most 3 concurrent allocations

Resource pool
  -> any compatible resource in the pool can satisfy the segment
```

This avoids accidentally designing Haircut only for one-to-one physical chairs. A hard conflict occurs when the required concurrent allocation would exceed the resource or pool capacity.

### Conflict Ownership

UC5 separates three different meanings of "schedule conflict":

```text
Appointment Scheduling
  -> is the customer/service/time request valid?

Professional Assignment
  -> does the stylist have enough active capacity?

Resource Allocation
  -> does the resource or resource pool have enough capacity for the segment?
```

The constraints are different and the owner is different, even when all are experienced by the salon as "double booking".

### Boundary Signal

UC5 provides very strong evidence for `segment_based_allocation`, `independent_resource_conflict`, `finite_capacity`, and `alternative_allocation`. It still does not authorize `VALIDATED_SEPARATE`; UC6 must test the other half of the lifecycle: an allocation is valid, then the resource becomes unavailable and the salon must recover.

---

## UC6 - Resource Becomes Unavailable

```yaml
UC6:
  name: RESOURCE_BECOMES_UNAVAILABLE
  valid_business_flow: yes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  scenarios:
    planned:
      example: "Wash Chair #2 is scheduled for maintenance from 13:00 to 15:00."
    adhoc:
      example: "Wash Chair #2 breaks at 14:20 during operations."
  workflow:
    step_1:
      action: MARK_RESOURCE_UNAVAILABLE
      owner: RESOURCE_AVAILABILITY
      description: "Resource is blocked for a time window or from the incident time."
    step_2:
      action: FIND_AFFECTED_ALLOCATIONS
      owner: RESOURCE_ALLOCATION
      description: "Find allocations whose resource commitment overlaps the unavailable window."
    step_3:
      action: CLASSIFY_IMPACT
      owner: RESOURCE_ALLOCATION
      results:
        - FUTURE_ALLOCATION_AFFECTED
        - CURRENT_ALLOCATION_AFFECTED
        - NO_IMPACT
    step_4:
      action: FIND_REPLACEMENT_RESOURCE
      owner: RESOURCE_ALLOCATION
      description: "Find a same-type or compatible resource with available capacity."
    step_5a:
      condition: REPLACEMENT_FOUND
      action: REALLOCATE
      owner: RESOURCE_ALLOCATION
      requirements:
        preserve_history: true
        reason_code: RESOURCE_UNAVAILABLE
        actor_required: true
        timestamp_required: true
    step_5b:
      condition: NO_REPLACEMENT
      action: ESCALATE
      alternatives:
        - SHIFT_SERVICE_SEGMENT
        - RESCHEDULE_APPOINTMENT
        - SMART_WAITLIST
        - MANUAL_MANAGER_RESOLUTION
        - CANCEL_IF_NO_FEASIBLE_OPTION
  automation_policy:
    system_may_detect_impact: true
    system_may_recommend_alternatives: true
    system_auto_moves_entire_appointment: false
  current_service_policy:
    automatic_move: false
    require_operational_confirmation: true
    rationale: "The system cannot infer the customer's physical state from the schedule alone."
  allocation_history:
    durable: true
    preserve:
      - OLD_RESOURCE
      - NEW_RESOURCE
      - AFFECTED_SEGMENT
      - REASON
      - ACTOR
      - TIMESTAMP
      - ORIGINAL_ALLOCATION
      - REPLACEMENT_ALLOCATION
  ownership:
    resource_availability:
      owns:
        - RESOURCE_UNAVAILABLE_EVENT
        - MAINTENANCE_WINDOW
        - OUT_OF_SERVICE_STATUS
    resource_allocation:
      owns:
        - AFFECTED_ALLOCATION_DISCOVERY
        - IMPACT_CLASSIFICATION
        - REPLACEMENT_RESOURCE_SELECTION
        - RESOURCE_REALLOCATION
        - ALLOCATION_HISTORY
    appointment:
      owns:
        - CUSTOMER_APPOINTMENT_LIFECYCLE
    smart_waitlist:
      participates_when:
        - NO_REPLACEMENT_OR_FEASIBLE_TIME
  implication:
    resource_allocation: VERY_STRONG_SEPARATE_SIGNAL
    resource_allocation_lifecycle: VERY_STRONG_EVIDENCE
    resource_history: REQUIRED
    resource_availability_dependency: CONFIRMED_CONCEPTUAL_BOUNDARY
    smart_waitlist: CONDITIONAL_CONSUMER
  boundary_decision: NONE
```

### Recovery Flow

UC6 must not collapse resource availability events into appointment mutation. The correct recovery path is:

```text
Resource unavailable
  -> detect affected allocations
  -> find feasible alternatives
  -> recommend options
  -> manager/system policy decides
  -> resource reallocation
```

The system should not jump straight to:

```text
Resource breaks
  -> automatically move the whole appointment
```

For a resource currently being used by a customer, operational confirmation is required because the system cannot know the customer's physical state from schedule data alone.

### Allocation History

UC6 requires durable history for resource reallocation:

```text
Allocation #1
  Wash Chair #2
  15:00-15:20
    -> RESOURCE_UNAVAILABLE
    -> Allocation #2
       Wash Chair #4
       15:00-15:20
```

At minimum, the history must preserve:

```text
old resource
new resource
affected segment
reason
actor
timestamp
```

### Symmetry With Professional Assignment

UC6 mirrors the Professional Assignment disruption pattern while preserving ownership:

```text
STAFF_UNAVAILABLE
  -> affected assignments
  -> professional reassignment

RESOURCE_UNAVAILABLE
  -> affected allocations
  -> resource reallocation
```

Workforce/Attendance does not own Professional Assignment. Resource Availability or Maintenance does not own Resource Allocation. They emit availability facts; assignment/allocation own the impact on commitments.

### Boundary Signal

UC6 completes Resource Allocation use-case validation at Product Domain Requirement level. Resource Allocation now has availability windows, finite shared capacity, segment-based commitments, reallocation frequency, bottleneck behavior, hard conflict handling, recovery behavior, and durable history.

This is a very strong separate signal, but still not `VALIDATED_SEPARATE`. Boundary decisions remain blocked until all H3 questions are complete and H2 reconciliation is performed.

---

## Q9 - Walk-In Professional Recommendation

```yaml
Q9:
  question: "Are walk-in customers auto-assigned to stylists?"
  answer: sometimes
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  cross_product_evidence:
    babycare:
      auto_recommendation: IMPLEMENTED
      alternatives: IMPLEMENTED
      admin_apply: IMPLEMENTED
      manual_assignment: IMPLEMENTED
      evidence_role: LEGACY_BUSINESS_AND_IMPLEMENTATION_EVIDENCE_ONLY
  evidence:
    - "Walk-in customers who do not choose a stylist can receive recommended available professionals."
    - "Recommendation should not always become the final assignment automatically."
    - "Manager or receptionist can accept the recommendation, choose another candidate, or assign manually."
    - "Some operating policies can allow auto-assignment when conditions are clear and no conflict exists."
    - "If the customer requests a specific stylist, customer preference must not be overwritten by auto-assignment."
  operating_policy:
    recommendation_for_walk_in: true
    automatic_final_assignment: conditional
    manual_assignment_supported: true
    manager_override: true
    customer_preference_preserved: true
  dispatch_modes:
    - RECOMMEND_ONLY
    - AUTO_ASSIGN
    - MANUAL
  implication:
    professional_recommendation: REQUIRED
    professional_assignment: CONSUMER_OF_DECISION
    recommendation_persistence_boundary: NOT_PROVEN
  boundary_decision: NONE
```

### Recommendation Is Not Assignment

Q9 confirms that Haircut needs professional recommendation behavior for walk-in flow, but recommendation must not be collapsed into assignment.

```text
Walk-in
  -> service requirements
  -> feasible professionals
  -> recommendation
     -> Stylist A
     -> Stylist B
     -> Stylist C
  -> manager/system policy
  -> create Professional Assignment
```

Recommendation answers:

```text
Who are good candidates?
```

Professional Assignment answers:

```text
Who is actually committed to the appointment?
```

### Dispatch Modes

Q9 deliberately uses `sometimes`, not `always`, because Haircut should support multiple operating modes:

```text
RECOMMEND_ONLY
  -> system proposes candidates
  -> human decides

AUTO_ASSIGN
  -> policy allows system to choose and create assignment

MANUAL
  -> admin bypasses recommendation and assigns directly
```

Customer preference remains stronger than automatic assignment. If a walk-in requests a specific stylist, the recommendation flow may still check feasibility and alternatives, but it must not silently overwrite the preference.

### Cross-Product Evidence

BabyCare has legacy evidence for auto recommendation, alternatives, admin apply, and manual assignment. This means Haircut is not the first Bella product to discover this business need.

However, BabyCare remains legacy business and implementation evidence only. Q9 does not authorize copying BabyCare recommendation code or declaring a Platform contract.

### Boundary Signal

Q9 establishes that Professional Recommendation is required as business behavior. It does not prove that Recommendation needs its own persistence boundary or Platform Contract. Q10 must validate ranking factors; that is where Recommendation may remain a simple helper or become a deeper policy engine.

---

## Q10 - Professional Recommendation Factors

```yaml
Q10:
  question: "Which factors influence stylist/barber recommendation?"
  answer:
    - service
    - availability
    - workload
    - skill
    - rating
    - history
    - vip
    - seniority
    - continuity_of_service
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  hard_eligibility:
    service_capability: true
    required_skill: true
    professional_availability: true
    hard_conflict_free: true
    branch_eligibility: true
  ranking_factors:
    workload_balance: true
    skill_match: true
    customer_history: true
    customer_preference: true
    rating: true
    vip_policy: true
    seniority: true
    continuity_of_service: true
  manual_only: false
  implication:
    professional_recommendation: STRONG_POLICY_SIGNAL
    recommendation_is_simple_helper: false
    platform_ownership: NOT_PROVEN
  boundary_decision: NONE
```

### Eligibility Before Ranking

Q10 splits recommendation into two stages:

```text
Eligibility -> who is allowed to receive this service?
Ranking     -> among eligible candidates, who is the best fit?
```

Ranking score must not compensate for a hard eligibility failure.

```text
Stylist A
  rating           +20
  customer history +30
  seniority        +10
  total score       60

Required skill: FAIL

Result:
  A = INELIGIBLE
```

The system must not produce:

```text
A has high score -> still recommend
```

The correct recommendation flow is:

```text
SERVICE REQUEST
  -> HARD ELIGIBILITY
     -> service capability
     -> required skill
     -> professional availability
     -> hard conflict free
     -> branch eligibility
  -> FEASIBLE CANDIDATES
  -> RANKING
     -> workload balance
     -> customer history
     -> rating
     -> VIP policy
     -> preference
     -> seniority
     -> continuity of service
  -> RECOMMENDATION
  -> accept / override / manual
  -> ASSIGNMENT
```

### Continuity Of Service

`continuity_of_service` is a Haircut product factor added during validation. If a customer previously had color work with Stylist B and returns for follow-up care or correction, continuity may be a stronger signal than generic rating.

This factor expands the Haircut product requirement. It does not change the H1/H2 contract inventory and does not authorize Platform ownership.

### Boundary Signal

Q10 shows that Professional Recommendation is not a simple `findAvailableStylist()` helper. It has at least two conceptual layers:

```text
Eligibility -> allowed candidates
Ranking     -> ordered candidates
```

This is a strong policy signal. However, even a deeper policy signal does not prove Platform ownership, persistence boundary, or contract design. Q11 must validate human override behavior, and Q12 must summarize complexity before H3 can classify Recommendation as `HELPER`, `BEAUTY_POLICY`, or `PLATFORM_CANDIDATE`.

---

## Q11 - Manager Override Of Recommendation

```yaml
Q11:
  question: "Can managers override professional recommendations?"
  answer: always
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "Recommendation is advisory decision support, not an operational command."
    - "Manager may know real-world salon context that the system has not fully captured."
    - "Manager may choose another candidate because of customer preference, operational balancing, or in-salon circumstances."
    - "Override must not convert an ineligible professional into a valid assignment."
  operating_policy:
    manager_override_recommendation: true
    override_requires_eligible_candidate: true
    hard_constraint_override: false
    manual_assignment_supported: true
  decision_telemetry:
    recommended_professional: OPTIONAL
    selected_professional: REQUIRED_WHEN_ASSIGNMENT_CREATED
    override_reason: OPTIONAL_OR_POLICY_REQUIRED
    actor: REQUIRED_WHEN_OVERRIDE
    timestamp: REQUIRED_WHEN_OVERRIDE
  implication:
    recommendation_role: ADVISORY
    assignment_owns_final_persistence: true
    recommendation_quality_feedback: POSSIBLE
  boundary_decision: NONE
```

### Override Ranking, Not Eligibility

Manager override applies to the ranked eligible candidates.

```text
Eligibility
  -> [A, B, C]
Ranking
  -> A > B > C
Recommendation
  -> A
Manager chooses
  -> B
Result
  -> Assignment B is valid
```

Manager override must not bypass hard eligibility.

```text
Eligibility
  -> [A, B, C]
D
  -> INELIGIBLE because required skill fails

Manager chooses
  -> D
Result
  -> BLOCK
```

This means the manager can override ranking, but cannot override physical or business impossibility.

### Ownership Separation

Q11 reinforces the separation between advice, decision, and durable assignment:

```text
Professional Recommendation
  -> candidates and ranking

Manager/System Policy
  -> decision to accept, override, or assign manually

Professional Assignment
  -> durable assignment persistence
```

Recommendation does not own final assignment persistence even when its advice is accepted.

### Decision Telemetry

If managers frequently ignore recommendations, Bella may record telemetry to improve the recommendation policy:

```text
recommended: Stylist A
selected:    Stylist B
reason:      CUSTOMER_REQUEST
actor:       Manager X
```

This telemetry can help evaluate recommendation quality. It still does not make Recommendation the owner of Assignment.

### Boundary Signal

Q11 confirms Recommendation is advisory decision support with override semantics. It strengthens the policy signal, but it does not prove persistence ownership or Platform ownership. Q12 must summarize complexity across Q9-Q11 before H3 classification.

---

## Q12 - Professional Recommendation Complexity

```yaml
Q12:
  question: "How complex is recommendation logic?"
  answer: complex
  evidence_type: PRODUCT_DOMAIN_REQUIREMENT
  validation_strength: PROPOSED_BY_PRODUCT
  evidence:
    - "Recommendation must run hard eligibility before ranking."
    - "Hard eligibility includes service capability, required skill, professional availability, hard-conflict freedom, and branch eligibility."
    - "Ranking uses independent factors: workload, skill match, customer history, preference, rating, VIP policy, seniority, and continuity of service."
    - "Ranking score must not compensate for a hard constraint failure."
    - "Recommendation supports RECOMMEND_ONLY, AUTO_ASSIGN, and MANUAL operating modes."
    - "Manager can override ranking but cannot override hard eligibility."
    - "Recommendation works with Professional Assignment but does not own final assignment persistence."
    - "BabyCare provides cross-product implementation evidence for auto recommendation, alternatives, and admin/manual apply, but does not decide Haircut architecture."
  complexity:
    eligibility_layer: true
    ranking_layer: true
    multi_factor_policy: true
    exception_handling: true
    manager_override: true
    customer_preference: true
    operational_context: true
    multiple_dispatch_modes: true
  implication:
    professional_recommendation: COMPLEX_POLICY_CAPABILITY
    simple_helper: false
    durable_persistence_boundary: NOT_PROVEN
    platform_ownership: NOT_PROVEN
  boundary_decision: NONE
```

### Complexity Is Not Ownership

Q12 completes the Professional Recommendation question group, but complexity must not be over-interpreted.

```text
COMPLEX
  != SEPARATE PERSISTENCE BOUNDARY
  != PLATFORM CONTRACT
```

The current Haircut requirement shape is:

```text
Service Request
  -> Eligibility
  -> Feasible Candidates
  -> Ranking / Policy
  -> Recommendation
  -> Human/System Decision
  -> Professional Assignment
```

Recommendation computes advice and ordered candidates. The evidence recorded in Q9-Q12 does not prove that Recommendation owns durable business state in the same way Professional Assignment or Resource Allocation appear to own durable commitments and histories.

### H3 Completion Guardrail

After Q12, H3 has complete validation input:

```yaml
questions:
  answered: 12
  total: 12

use_cases:
  validated: 6
  total: 6
```

This must not automatically set H3 to `VALIDATED` or mark H2 Phase 2 as closable.

H3 now requires a final boundary reconciliation pass that places the evidence side by side:

```text
Professional Assignment
  Q1-Q4 + UC1-UC4
  -> VERY_STRONG_SEPARATE_SIGNAL

Resource Allocation
  Q5-Q8 + UC5-UC6
  -> VERY_STRONG_SEPARATE_SIGNAL

Professional Recommendation
  Q9-Q12 + BabyCare evidence
  -> COMPLEX_POLICY_CAPABILITY
```

Only that reconciliation pass may apply the Boundary Decision Rules and classify candidates as `VALIDATED_SEPARATE`, `VALIDATED_ABSORBED`, `HELPER`, `BEAUTY_POLICY`, `PLATFORM_CANDIDATE`, or `UNRESOLVED`.

### Boundary Signal

Q12 confirms Professional Recommendation is a complex policy capability, not a simple helper. It still does not prove durable persistence boundary or Platform ownership. Boundary decisions remain blocked until the final H3 boundary reconciliation.

---

## Pending Questions

### Professional Assignment Group Status

```yaml
professional_assignment:
  Q1_reassignment_frequency: daily
  Q2_assignment_history: required
  Q3_acceptance_rejection: controlled_rejection
  Q4_staff_no_show_impact: tracked
  UC1:
    independent_lifecycle: STRONG_EVIDENCE
  UC2:
    assignment_owned_conflict: STRONG_EVIDENCE
  UC3:
    reassignment_lifecycle: VERY_STRONG_EVIDENCE
    durable_history: REQUIRED
    bulk_operation: REQUIRED
  UC4:
    active_professional_segments: REQUIRED
    full_appointment_overlap: NOT_SUFFICIENT_FOR_CONFLICT
    hard_conflict:
      condition: ACTIVE_SEGMENT_OVERLAP
      action: BLOCK
      manager_override: false
    resource_allocation_signal: SEPARATE_SIGNAL
  combined_signal: VERY_STRONG_SEPARATE_SIGNAL
  evidence_strength: PROPOSED_BY_PRODUCT
  boundary_decision: NONE
```

Q1-Q4 and UC1-UC4 form a very strong product requirement signal that Professional Assignment is more than a simple appointment `stylist_id`. The Professional Assignment group is complete at Product Domain Requirement level, but it still does not authorize `VALIDATED_SEPARATE` or contract design. Resource Allocation validation has started with Q5.

### Resource Allocation Group Status

```yaml
resource_allocation:
  Q5_resource_maintenance_window: regular
  Q6_shared_constrained_equipment: yes
  Q7_resource_reassignment_frequency: frequent
  Q8_resource_bottleneck: yes
  UC5:
    segment_based_allocation: VERY_STRONG_EVIDENCE
    independent_resource_conflict: VERY_STRONG_EVIDENCE
    finite_capacity: REQUIRED
    alternative_allocation: REQUIRED
    hard_conflict:
      condition: RESOURCE_CAPACITY_EXCEEDED
      action: BLOCK
      manager_override: false
  UC6:
    resource_allocation_lifecycle: VERY_STRONG_EVIDENCE
    affected_allocation_discovery: REQUIRED
    impact_classification: REQUIRED
    resource_history: REQUIRED
    resource_availability_dependency: CONFIRMED_CONCEPTUAL_BOUNDARY
    smart_waitlist: CONDITIONAL_CONSUMER
  planned_maintenance: REQUIRED
  adhoc_unavailability: REQUIRED
  availability_window_required: true
  conflict_detection_required: true
  shared_resources: REQUIRED
  finite_capacity: REQUIRED
  resource_required_by_service_segment: REQUIRED
  independent_resource_conflict_check: REQUIRED
  segment_based_allocation: STRONG_SIGNAL
  resource_reassignment_allowed: true
  in_day_reallocation: true
  emergency_reallocation: true
  reassignment_reason_required: true
  history_required: true
  resource_allocation_lifecycle: STRONG_SIGNAL
  resource_history: REQUIRED
  resource_can_be_bottleneck: true
  professional_can_be_bottleneck: true
  bottleneck_is_service_dependent: true
  resource_capacity_checked_independently: true
  independent_capacity_dimension: STRONG_EVIDENCE
  automatic_reassignment: false
  combined_signal: VERY_STRONG_SEPARATE_SIGNAL
  evidence_strength: PROPOSED_BY_PRODUCT
  boundary_decision: NONE
```

Q5-Q8 and UC5-UC6 are complete at Product Domain Requirement level. Resource Allocation now has a very strong separate signal, but it still does not authorize `VALIDATED_SEPARATE` or contract design.

### Professional Recommendation Group Status

```yaml
professional_recommendation:
  Q9_walk_in_auto_assignment: sometimes
  Q10_recommendation_factors:
    hard_eligibility:
      service_capability: true
      required_skill: true
      professional_availability: true
      hard_conflict_free: true
      branch_eligibility: true
    ranking_factors:
      workload_balance: true
      skill_match: true
      customer_history: true
      customer_preference: true
      rating: true
      vip_policy: true
      seniority: true
      continuity_of_service: true
  Q11_manager_override: always
  Q12_complexity: complex
  recommendation_for_walk_in: REQUIRED
  automatic_final_assignment: CONDITIONAL
  manual_assignment_supported: true
  manager_override: true
  override_requires_eligible_candidate: true
  hard_constraint_override: false
  customer_preference_preserved: true
  dispatch_modes:
    - RECOMMEND_ONLY
    - AUTO_ASSIGN
    - MANUAL
  recommendation_role: ADVISORY
  assignment_owns_final_persistence: true
  recommendation_quality_feedback: POSSIBLE
  recommendation_is_simple_helper: false
  professional_recommendation_complexity: COMPLEX_POLICY_CAPABILITY
  simple_helper: false
  durable_persistence_boundary: NOT_PROVEN
  recommendation_persistence_boundary: NOT_PROVEN
  platform_ownership: NOT_PROVEN
  combined_signal: COMPLEX_POLICY_CAPABILITY
  evidence_strength: PROPOSED_BY_PRODUCT
  boundary_decision: NONE
```

Q9-Q12 are complete at Product Domain Requirement level. Professional Recommendation is a complex policy capability, but durable persistence boundary and Platform ownership remain not proven.

### H3 Input Status

```yaml
h3_validation_input:
  questions:
    answered: 12
    total: 12
  use_cases:
    validated: 6
    total: 6
  final_boundary_reconciliation_required: true
  phase2_can_close: false
  boundary_decision: NONE
```

### Use Case Walkthrough Status

UC1, UC2, UC3, UC4, UC5, and UC6 are recorded. UC3 used the narrow BabyCare assignment audit and the four-path BabyCare capability reconciliation as cross-product evidence, without copying BabyCare storage or claiming final boundary. UC4 validates active professional segment semantics as a Product Domain Requirement. UC5 validates segment-based resource double booking. UC6 validates resource unavailability recovery and allocation history.

BabyCare audit result:

```yaml
babycare_has_assignment_evidence: true
babycare_has_reassignment_evidence: true
babycare_has_full_assignment_lifecycle: false
platform_contract_claim_allowed: false
```

BabyCare capability reconciliation result:

```yaml
babycare_capability_reconciliation:
  auto_recommendation: IMPLEMENTED
  leave_reassignment: IMPLEMENTED
  conflict: IMPLEMENTED_ACROSS_BOOKING_SESSION_RESOURCE_FLOWS
  smart_waitlist: IMPLEMENTED_WITH_PARTIAL_TRIGGER_AND_ASSIGNMENT_LINKAGE
  professional_accept_reject_lifecycle: NOT_FOUND
  structured_assignment_history: PARTIAL
  platform_contract_claim_allowed: false
  contract_inventory_change_allowed: false
```

All 6 use cases and all 12 questions are complete at Product Domain Requirement level. The next validation step is H3 Final Boundary Reconciliation, not contract design.

### Financial Domain Evidence — Legacy Business Invariants

Legacy financial domain evidence is recorded in `H3_LEGACY_FINANCIAL_DOMAIN_EVIDENCE.md`.

```yaml
legacy_financial_domain_evidence:
  assignment_to_execution: IMPLEMENTED
  execution_to_commission: IMPLEMENTED
  reassignment_to_commission: IMPLEMENTED_BY_COMPLETED_BY_KTV_ID
  commission_history: PARTIAL
  commission_to_payroll: IMPLEMENTED
  finance_source_of_truth: IMPLEMENTED_FOR_REVENUE_EXPENSE_SALARY_PAYMENT
  accounting_posting: IMPLEMENTED_VIA_OUTBOX_AND_WORKER
  ipayment_engine_represents_full_money_domain: false
  haircut_contract_design_allowed: false
  platform_promotion_allowed: false
  contract_inventory_change_allowed: false
  boundary_decision: NONE
```

Financial validation must not collapse Payment, Revenue, Commission, Payroll, Finance, and Accounting into one capability. BabyCare/Spa provide business evidence, not target Platform architecture. Haircut still needs Product/UX validation before contract design.
