# H7 - Beauty OS Persistence Mapping and Schema Freeze

Status: FROZEN (logical persistence mapping)
Parent: H6 Contract Design (`a9a49d3c`)
Scope: map the six frozen contracts to durable facts, derived facts, ownership, relationships, database invariants, indexes, RLS boundaries, and compatibility strategy.

## Guardrails

```yaml
contract_reinterpretation: FORBIDDEN
ownership_reopening: FORBIDDEN
legacy_schema_as_blueprint: FORBIDDEN
implementation_authorized: false
migration_files_created: false
```

H7 does not discover capabilities, redesign contracts, define UI, create ORM mappings, or write migrations.

## Persistence Categories

```text
SOURCE_OF_TRUTH   Canonical business fact; must be persisted.
HISTORY           Durable transition/audit fact; append-only where required.
DERIVED           Recomputable view or summary; never a competing canonical truth.
```

## Canonical Source-of-Truth Map

| Fact | Canonical owner | Persistence | Consumers |
|---|---|---|---|
| Customer service commitment and lifecycle | Appointment | Source of truth + history | Assignment, Allocation, Session |
| Service definition and requirements | Service Catalog | Source of truth | Appointment, Recommendation, Allocation |
| Professional assignment and reassignment | Professional Assignment | Source of truth + history | Appointment, Session, Commission |
| Resource allocation and reallocation | Resource Allocation | Source of truth + history | Service workflow, Analytics |
| Actual execution and actual performer | Session Tracking | Source of truth + history | Commission, Analytics, Audit |
| Resource availability and maintenance | Resource Availability/Maintenance | Source of truth | Resource Allocation |
| Waitlist lifecycle | Waitlist | Source of truth + history | Appointment and policy consumers |
| Recommendation ranking | Beauty Policy | Derived decision result | Assignment |
| Queue position and feasibility summaries | Policy/read model | Derived | UI, notifications |
| Payment, commission, payroll, accounting | Downstream financial owners | Downstream truth | Finance consumers |

## Actual Performer Consistency Lock

```yaml
canonical_owner: SESSION_TRACKING
canonical_fact: ACTUAL_PERFORMER_REFERENCE
professional_assignment:
  owns: planned_assignment_and_reassignment_relationship
  owns_canonical_actual_performer: false
commission:
  role: downstream_consumer
duplicate_canonical_actual_performer: FORBIDDEN
```

Assignment may record the planned professional, substitutions, and comparison with execution. Session Tracking is the only canonical source for who actually performed the service. A conflict between assignment and session must be resolved against execution evidence, not by maintaining two competing facts.

## Logical Persistence Mapping

### Appointment (DEDICATED_BUILD)

Persist tenant and branch scope, customer reference, service commitment reference, requested interval, lifecycle status, cancellation/reschedule facts, and created/updated timestamps. Persist lifecycle history when the transition affects customer or operational truth. Fulfillment summaries, current assignment summaries, and current allocation summaries are derived projections.

Appointment owns the customer commitment and appointment lifecycle. It does not own professional history, resource history, execution truth, or recommendation ranking.

### Service Catalog (EXTEND_ADAPT)

Retain the generic service definition kernel and add only the Beauty extension needed for pricing, presentation, service capability, and compensation policy references. `ktv_commission` is not a platform-wide commission truth and must not own commission results, payment, resource allocation, or execution.

### Session Tracking (DEDICATED_BUILD)

Persist session identity, tenant scope, appointment/service commitment reference, execution status, actual start/end, actual performer, outcome, and operational notes. Persist status/correction history where audit or reconciliation depends on it.

Required consistency rules include: actual end requires actual start; completed requires an outcome; actual performer is session-owned; session references a valid appointment commitment.

### Professional Assignment (DEDICATED_BUILD)

Persist assignment identity, tenant scope, service commitment reference, professional reference, status, proposed/accepted/rejected/disrupted timestamps, reason, and actor. Persist immutable history for original assignment, rejection, disruption, reassignment, and replacement relationship.

An original assignment is never overwritten to erase history. Rejection/disruption requires reason, actor, and timestamp. Active professional conflict is checked against active professional commitments and segments; attendance remains owned by Workforce.

### Resource Allocation (DEDICATED_BUILD)

Persist allocation identity, tenant scope, service commitment and segment reference, resource reference, half-open commitment interval, capacity units, allocation status, and created/released facts. Resource master identity and availability remain owned by Resource Master/Availability/Maintenance.

Persist allocation history with original/replacement links, old and new resource, affected segment, reason, actor, timestamp, and actual resource used when execution occurs. Original allocation facts are not deleted or overwritten during reallocation.

Required logical indexes:

```text
(tenant_id, resource_id, starts_at, ends_at)
(tenant_id, service_commitment_id, segment_id)
(tenant_id, allocation_status, starts_at)
```

The persistence model must support capacity-N, resource pools, interval overlap, per-segment resource changes, affected-allocation discovery, and hard blocking of exclusive capacity conflicts.

### Waitlist (EXTEND_ADAPT)

Retain the temporal queue kernel and extend it with Beauty policy for service preference, professional preference, resource feasibility, and prioritization. Persist entry identity, tenant scope, service reference, preferred interval, status, expiry, conversion reference, and lifecycle history.

Waitlist does not own appointment feasibility, assignment, allocation, or hard-constraint overrides. Queue position is derived according to policy.

## Database Invariants and RLS Boundary

```yaml
tenant:
  tenant_id_required: true
  cross_tenant_reference: FORBIDDEN
  branch_scope_enforced_where_applicable: true
appointment:
  valid_customer_and_service_commitment: required
  lifecycle_transition: constrained
professional_assignment:
  original_history_immutable: true
  replacement_link_valid: true
  disruption_requires_reason_actor_timestamp: true
  active_conflict_blocked: true
resource_allocation:
  interval_end_after_start: true
  capacity_units_positive: true
  exclusive_overlap_blocked: true
  unavailable_resource_blocked: true
  history_append_only: true
session_tracking:
  actual_performer_single_source: true
  completion_consistency: true
waitlist:
  active_entry_integrity: true
  conversion_requires_valid_appointment: true
rls:
  owner: TENANT_CONTEXT
  product_direct_cross_tenant_access: false
  legacy_compatibility_reads_preserve_tenant_scope: true
```

## Legacy Compatibility Strategy

Legacy BabyCare structures are compatibility inputs and evidence, not the target schema. Preserve only verified resource identity/status and narrow conflict behavior where useful. Legacy `booking_resource_id`, `assigned_ktv_id`, and `completed_by_ktv_id` may be mapped during compatibility work, but they must not become competing canonical truths.

The migration strategy is additive: create product/Beauty OS persistence only after H7; map legacy data through explicit adapters; keep tenant isolation; verify backfill and rollback before claiming migration readiness.

## H7 Result

```yaml
contract_boundaries_preserved: true
ownership_reopened: false
persisted_and_derived_facts_identified: true
canonical_source_of_truth_map: FROZEN
actual_performer_source: SESSION_TRACKING
duplicate_actual_performer_truth: FORBIDDEN
relationships_defined: true
database_invariants_defined: true
index_requirements_defined: true
rls_boundary_defined: true
migration_strategy_defined: true
legacy_schema_as_blueprint: false
schema_status: FROZEN
migration_implementation: NOT_CREATED
implementation_authorized: false
```

H7 is complete. H8 may implement the frozen mapping, subject to additive migration and verification gates. H9 remains responsible for integration, regression, tenant-isolation, and recovery evidence.
