# H5.4 — Resource Allocation Contract Boundary Freeze

**Status:** COMPLETE — boundary freeze only
**Parent disposition:** H5.3 Dedicated Beauty OS Build (`b34f60a9`)
**Capability owner:** `BEAUTY_OS`
**Scope:** Freeze ownership, business facts, inputs, outputs, and exclusions for Resource Allocation.
**Explicit non-scope:** No interface methods, DTOs, schemas, migrations, implementation, or final contract count.

## Canonical Ownership

```yaml
canonical_ownership:
  layer: BEAUTY_OS
  capability: RESOURCE_ALLOCATION
  disposition: DEDICATED_BUILD
  canonical_truth_owner: RESOURCE_ALLOCATION
```

The boundary is frozen because H4.2 proved the capability and H5.3 selected a dedicated canonical build. This does not authorize implementation. It only defines which business facts the future contract must own and which facts must remain outside it.

## Contract Owns

```yaml
owns:
  - ALLOCATION_IDENTITY
  - SEGMENT_RESOURCE_COMMITMENT
  - TEMPORAL_INTERVAL
  - CAPACITY_CONSUMPTION
  - CAPACITY_CONFLICT
  - REALLOCATION
  - ALLOCATION_HISTORY
  - ACTUAL_RESOURCE_USED
  - AFFECTED_ALLOCATION_DISCOVERY
```

These facts describe the relationship between a Beauty service commitment segment and the resource capacity consumed by that segment. The capability owns the allocation truth, not the resource master, service definition, or customer workflow.

## Contract Consumes

```yaml
consumes:
  service_definition:
    provides:
      - SERVICE_SEGMENT_FLOW
      - RESOURCE_TYPE_REQUIREMENT
      - RESOURCE_COMPATIBILITY_RULE
    ownership: SERVICE_DEFINITION

  resource_availability_maintenance:
    provides:
      - RESOURCE_AVAILABLE
      - RESOURCE_UNAVAILABLE
      - MAINTENANCE_WINDOW
      - OUT_OF_SERVICE_EVENT
    ownership: RESOURCE_AVAILABILITY_MAINTENANCE

  appointment_service_workflow:
    provides:
      - SERVICE_COMMITMENT
      - REQUESTED_TIME_CONTEXT
    ownership: APPOINTMENT_SERVICE_WORKFLOW
```

Inputs constrain or initiate allocation decisions. They do not become allocation state merely because Resource Allocation consumes them.

## Contract Produces

```yaml
produces:
  - ALLOCATION_RESULT
  - ALLOCATION_FEASIBILITY
  - RESOURCE_CONFLICT_RESULT
  - AFFECTED_ALLOCATIONS
  - REALLOCATION_FACTS
  - DURABLE_ALLOCATION_HISTORY
  - ACTUAL_RESOURCE_USAGE_FACT
```

These outputs are operational facts or decisions about resource commitment. Appointment/Service Workflow remains responsible for deciding how the customer-facing service proceeds after receiving an allocation result or disruption impact.

## Explicit Exclusions

```yaml
does_not_own:
  - APPOINTMENT_LIFECYCLE
  - PROFESSIONAL_ASSIGNMENT
  - PROFESSIONAL_RECOMMENDATION
  - RESOURCE_MASTER
  - RESOURCE_AVAILABILITY
  - RESOURCE_MAINTENANCE
  - SERVICE_DEFINITION
  - SERVICE_EXECUTION_LIFECYCLE
  - WAITLIST
  - COMMISSION
  - PAYMENT
  - FINANCE
  - ACCOUNTING
```

The exclusions prevent a God Contract. In particular, resource availability emits a constraint, Resource Allocation records capacity consumption, and service workflow decides the customer outcome.

```text
Resource Availability / Maintenance
        ↓ availability or unavailable event
Resource Allocation
        ↓ allocation, conflict, reallocation, history
Service Workflow
        ↓ customer-facing service state
```

```text
Resource exists
  != Resource is available
  != Resource is allocated
  != Resource was actually used
```

## Ownership Separation Rules

| Concern | Owner | Resource Allocation relationship |
| --- | --- | --- |
| Resource identity, type, master status | Resource Master | Reads identity and compatibility input; does not own master lifecycle |
| Availability and maintenance window | Resource Availability/Maintenance | Consumes availability facts and discovers affected allocations |
| Service segments and required resource type | Service Definition | Consumes requirements; does not persist allocation truth |
| Customer appointment state | Appointment/Service Workflow | Consumes feasibility and disruption impact; owns customer lifecycle |
| Professional assignment | Professional Assignment | Independent parallel commitment; not a resource allocation owner |
| Candidate ranking | Professional Recommendation | Advisory consumer/input; never owns resource allocation |
| Waiting demand | Smart Waitlist | Downstream consumer when no feasible resource option exists |
| Actual resource usage cost | Finance/Costing | Consumes actual usage; does not own allocation facts |
| Commission and accounting | Commission/Finance/Accounting | Downstream consumers with separate financial ownership |

## Contract Inventory Reconciliation Gate

The prior H1 list of eight contracts remains a hypothesis. H5.4 adds no contract and removes no contract.

```yaml
contract_inventory_reconciliation:
  prior_hypothesis: 8
  action: RECONCILE_ONE_BY_ONE
  professional_assignment:
    capability: PROVEN
    owner: BEAUTY_OS
    contract_candidate: YES
  resource_allocation:
    capability: PROVEN
    owner: BEAUTY_OS
    disposition: DEDICATED_BUILD
    contract_candidate: YES
  professional_recommendation:
    capability: BEAUTY_POLICY
    independent_persistence_boundary: NOT_PROVEN
    contract_candidate: REVIEW
  final_count: NOT_YET_FROZEN
  inventory_change_authorized: false
```

Capability existence, independent ownership, contract candidacy, persistence, and database tables remain separate decisions:

```text
Capability exists
  != Independent contract is required
  != Durable persistence is required
  != New database tables are required
```

## Boundary Freeze Result

```yaml
H5_4_result:
  capability: RESOURCE_ALLOCATION
  owner: BEAUTY_OS
  boundary: FROZEN
  disposition: DEDICATED_BUILD
  canonical_truth:
    - ALLOCATION_IDENTITY
    - SEGMENT_RESOURCE_COMMITMENT
    - TEMPORAL_INTERVAL
    - CAPACITY_CONSUMPTION
    - CAPACITY_CONFLICT
    - REALLOCATION
    - ALLOCATION_HISTORY
    - ACTUAL_RESOURCE_USED
    - AFFECTED_ALLOCATION_DISCOVERY
  excluded_ownership:
    - RESOURCE_MAINTENANCE
    - SERVICE_DEFINITION
    - APPOINTMENT_LIFECYCLE
    - PROFESSIONAL_ASSIGNMENT
    - PROFESSIONAL_RECOMMENDATION
    - WAITLIST
    - FINANCE
    - COMMISSION
    - ACCOUNTING
  interface_methods_designed: false
  dto_designed: false
  schema_designed: false
  migration_designed: false
  implementation_authorized: false
  contract_inventory:
    prior_hypothesis: 8
    reconciliation_required: true
    final_count: NOT_YET_FROZEN
```

H5.4 freezes the boundary, not the contract shape. Legacy `booking_resources` remains a compatibility/evidence source only until H5.5 and later design gates establish translation, migration, and source-of-truth rules.

## Next Gate

```text
H5.4 Contract boundary freeze          COMPLETE
             ↓
H5.5 Contract inventory reconciliation NEXT
             ↓
H6 Contract design                     GATED
```

H5.5 must reconcile all eight prior contract hypotheses one by one. No interface or schema should be authored until that inventory is updated from current evidence.
