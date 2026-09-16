# H5.6.1 — Appointment Engine Boundary and Ownership Resolution

**Status:** COMPLETE — Appointment hypothesis resolved
**Parent checkpoint:** H5.5 Contract Inventory Reconciliation (`7ce9ba88`)
**Scope:** Resolve Appointment's business boundary, ownership layer, contract need, and disposition.
**Explicit non-scope:** No interface, DTO, schema, migration, or implementation.

## Semantic Invariants First

The Appointment capability is defined before inspecting `bookings` storage. The frozen semantic candidates are:

```yaml
appointment_invariants:
  - CUSTOMER_SERVICE_COMMITMENT_IDENTITY
  - SERVICE_REQUEST_REFERENCE
  - REQUESTED_TIME_CONTEXT
  - CUSTOMER_AND_BRANCH_CONTEXT
  - APPOINTMENT_LIFECYCLE
  - APPOINTMENT_LEVEL_FEASIBILITY
  - RESCHEDULE_AND_CANCELLATION_FACTS
```

These invariants describe the customer's request to receive a service at a time and place. They do not include which professional performs the service, which physical resource is used, or how the service is executed.

## Ownership Boundary

```text
Customer / channel
        ↓ creates request
Appointment
        ├── customer + branch context
        ├── requested service
        ├── requested time
        ├── lifecycle
        └── feasibility result/context
        │
        ├── Professional Assignment consumes service commitment
        ├── Resource Allocation consumes timing/segment requirements
        ├── Session Tracking records execution
        └── Waitlist consumes unavailable feasibility
```

Appointment owns the customer-facing commitment and its lifecycle. It does not own downstream assignment, resource allocation, execution outcome, or waitlist position.

## Producer / Consumer Test

```yaml
producer_consumer_test:
  producers:
    customer_or_booking_channel:
      produces:
        - CUSTOMER_REQUEST
        - REQUESTED_TIME_CONTEXT
      owns_appointment_lifecycle: false
    service_catalog:
      produces:
        - SERVICE_REFERENCE
        - SERVICE_DURATION_OR_REQUIREMENTS
      owns_appointment_lifecycle: false
    branch_operating_policy:
      produces:
        - BOOKING_WINDOW_RULES
        - BRANCH_ELIGIBILITY
      owns_appointment_lifecycle: false

  capability_under_test:
    appointment:
      owns:
        - CUSTOMER_SERVICE_COMMITMENT_IDENTITY
        - APPOINTMENT_LIFECYCLE
        - REQUESTED_TIME_CONTEXT
        - APPOINTMENT_LEVEL_FEASIBILITY
        - RESCHEDULE_AND_CANCELLATION_FACTS

  consumers:
    professional_assignment:
      consumes:
        - SERVICE_COMMITMENT
        - REQUESTED_TIME_CONTEXT
    resource_allocation:
      consumes:
        - SERVICE_COMMITMENT
        - REQUESTED_TIME_CONTEXT
        - SERVICE_SEGMENT_REQUIREMENTS
    session_tracking:
      consumes:
        - APPOINTMENT_REFERENCE
    waitlist:
      consumes:
        - FEASIBILITY_RESULT
        - REQUESTED_TIME_CONTEXT

  ownership_inversion_detected: false
```

## Deletion Test

```yaml
deletion_test:
  without_professional_assignment: SURVIVES
  without_resource_allocation: SURVIVES
  without_session_tracking: SURVIVES
  without_waitlist: SURVIVES
  without_service_catalog: SURVIVES_WITHOUT_SERVICE_DEFINITION_INPUT
  without_branch_policy: SURVIVES_WITHOUT_POLICY_INPUT
  independent_appointment_truth: PROVEN_BY_SEMANTIC_TEST
```

An appointment still exists when no stylist, resource, execution session, or waitlist entry has been created. This distinguishes the customer commitment from the operational capabilities that fulfill it.

## Legacy Evidence Fit

Current booking flows provide implementation evidence for persisted booking identity, customer/service references, branch/tenant context, requested schedule, cancellation, and rescheduling behavior. The legacy path is useful behavior evidence, but the inspected source tree does not contain a verified `IAppointmentEngine` contract implementation.

The legacy storage shape must not define the boundary:

```text
bookings row
  != complete Appointment contract
  != Professional Assignment
  != Resource Allocation
  != Session Tracking
```

Legacy behaviors worth preserving selectively include tenant isolation, customer/branch context, booking lifecycle validation, and reschedule/cancellation audit behavior. The future contract must still keep assignment, resource, and execution facts outside Appointment ownership.

## Resolution

```yaml
H5_6_1:
  original_h1_name: IAppointmentEngine

  capability:
    exists: true
    evidence: PRODUCT_IMPLEMENTATION_AND_DOMAIN_REQUIREMENT

  boundary:
    status: VALIDATED_SEPARATE
    rationale: "Appointment owns durable customer service commitment and lifecycle independently of fulfillment capabilities."

  ownership:
    layer: BEAUTY_OS
    confidence: MEDIUM
    rationale: "The resolved commitment semantics support Bella Beauty products; no cross-vertical evidence was used to promote this capability to Platform."

  contract_need:
    independent_contract_required: true
    reason: "Appointment is the stable upstream commitment consumed by Assignment, Resource Allocation, Session Tracking, and Waitlist."

  existing_contract:
    found: false
    semantic_fit: LEGACY_BEHAVIOR_ONLY

  disposition: DEDICATED_BUILD
  persistence:
    durable_state_required: true
  final_inventory:
    include: true

  interface_design_authorized: false
  schema_design_authorized: false
  implementation_authorized: false
```

This is a dedicated Beauty OS contract disposition, not a request to rewrite legacy BabyCare booking flows. Existing booking behavior can be adapted selectively after contract design and migration rules are approved.

## H5.6.1 Exit and Remaining Hypotheses

```yaml
H5_6_1_exit:
  resolved: true
  appointment:
    boundary: VALIDATED_SEPARATE
    owner: BEAUTY_OS
    disposition: DEDICATED_BUILD
  remaining_unresolved: 3
    - ISessionTracking
    - IServiceCatalog
    - IWaitlistEngine
  H6_contract_design_authorized: false
```

Appointment is now resolved without reopening Resource Allocation or Professional Assignment boundaries. The remaining three hypotheses must be handled in their prescribed order before the final inventory can be frozen.

## Next Gate

```text
H5.6.1 Appointment resolution          COMPLETE
             ↓
H5.6.2 Session Tracking resolution     NEXT
             ↓
H5.6.3 Service Catalog resolution      GATED
H5.6.4 Waitlist resolution              GATED
```
