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
  answered: 7
  total: 12
use_cases:
  validated: 4
  total: 6
boundaries:
  professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
  resource_allocation: VERY_STRONG_SEPARATE_SIGNAL
  professional_recommendation: UNRESOLVED
contract_inventory:
  h1_baseline: 8
  effective_count: TBD
  change_authorized: false
phase2_status:
  can_close: false
  reason: "Professional Assignment questions Q1-Q4 and UC1-UC4 answered at Product Domain Requirement level; Resource Allocation Q5-Q7 answered; BabyCare assignment audit and capability reconciliation complete; Q8-Q12 and UC5-UC6 still pending."
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
  automatic_reassignment: false
  combined_signal: VERY_STRONG_SEPARATE_SIGNAL
  evidence_strength: PROPOSED_BY_PRODUCT
  boundary_decision: NONE
```

Q8 should validate whether constrained resources are a real operational bottleneck compared with stylist/barber availability.

### Q8-Q12 — Resource Allocation and Recommendation

Q8-Q12 remain unanswered.

### UC5-UC6 — Use Case Walkthroughs

UC1, UC2, UC3, and UC4 are recorded. UC3 used the narrow BabyCare assignment audit and the four-path BabyCare capability reconciliation as cross-product evidence, without copying BabyCare storage or claiming final boundary. UC4 validates active professional segment semantics as a Product Domain Requirement.

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

UC5 and UC6 should validate Resource Allocation: whether chair/station/resource conflicts follow full appointment duration, service phases, shared resources, or product-specific room/station rules.

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
