# H5.2 — Resource Allocation Semantic-Fit Investigation

**Status:** COMPLETE — semantic investigation only
**Parent checkpoint:** H5.1 Existing-Contract Discovery (`74b30729`)
**Scope:** Compare the legacy booking-resource behavior with the nine frozen Beauty OS Resource Allocation invariants.
**Explicit non-scope:** No interface, DTO, schema, migration, contract inventory, or reuse/extend/build decision.

## Guardrails

```yaml
H5_2:
  capability: RESOURCE_ALLOCATION
  owner_baseline: BEAUTY_OS
  evidence_role: BUSINESS_AND_IMPLEMENTATION_EVIDENCE_ONLY
  legacy_architecture_reuse_authorized: false
  contract_design_authorized: false
  schema_design_authorized: false
  inventory_change_authorized: false
```

Classification used in this investigation:

```yaml
semantic_fit_classification:
  SEMANTIC_EQUIVALENT: "Same business meaning and target invariant is represented."
  SEMANTIC_NARROWER: "Same business meaning exists, but legacy behavior covers a smaller case."
  STRUCTURAL_GAP: "Target requires a durable fact or lifecycle that legacy storage/flow cannot represent."
  SEMANTIC_DIVERGENCE: "Legacy and target model different business facts or commitment units."
```

## Evidence Base

The legacy path is distributed across resource master data, session references, and a schedule guard. The resource master has tenant-scoped identity, type, status, and a bounded capacity field (`supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql`, `supabase/migrations/20260611130000_add_session_booking_resource.sql`). Session create, update, and reschedule flows invoke the schedule guard, which blocks unavailable resources and active same-resource/date/time conflicts (`src/core/services/order/booking-resource-schedule-guard.ts`, `src/core/services/order/create-session-log-action.ts`, `src/core/services/order/update-session-log-action.ts`, `src/core/services/order/reschedule-session-action.ts`). Resource CRUD has audit entries, but that audit concerns master-data changes rather than allocation transitions (`src/services/booking-resource-actions.ts`).

The current implementation evidence is therefore useful for behavior reconstruction, but it is not evidence of a complete Beauty OS allocation contract.

## Five Semantic Clusters

### 1. Commitment Model

Legacy behavior binds `session_logs.booking_resource_id` to an individual session. That is closer to a service occurrence than a booking-wide resource field and preserves a useful session/resource relationship. Haircut requires a stronger model in which one service commitment can contain multiple segments, each with its own resource commitment. The target does not merely rename `session` to `segment`; it needs segment identity and commitment semantics.

**Finding:** `SEMANTIC_NARROWER`. The business meaning overlaps for one session/resource commitment, but multi-segment resource commitments are a structural extension of the current path.

### 2. Time Model

Legacy validation uses assigned date/time and checks duplicate active sessions at the same resource/date/time. Haircut requires active interval commitments, including release during processing and overlap checks on `[start_time, end_time)`. A single assigned time cannot express the active segments or the resource being occupied for only part of a service.

**Finding:** `STRUCTURAL_GAP` for the target interval model. This is not fixed by adding a display field; the commitment unit and conflict query shape must change.

### 3. Capacity Model

The legacy schema has a bounded `capacity` property, while the guard primarily proves exclusive duplicate conflict for one resource/date/time. It does not prove consumption of capacity greater than one, pooled resources, or a segment-specific capacity requirement. The field is valuable resource-master evidence but does not establish allocation capacity truth.

**Finding:** `SEMANTIC_NARROWER`, with a `STRUCTURAL_GAP` for capacity-N and resource-pool allocation. The target must distinguish master capacity from consumed capacity.

### 4. Change Model

The legacy update/reschedule flows can validate and persist a changed `booking_resource_id`. This preserves the final reference but does not establish a first-class allocation identity, disruption event, replacement relationship, reason, actor, timestamp chain, or operational confirmation.

**Finding:** `STRUCTURAL_GAP`. Current-reference mutation cannot preserve the target reallocation lifecycle and allocation history without a separate allocation fact model.

### 5. Recovery Model

Legacy checks run when a session is created, updated, or rescheduled. The inspected path does not show a resource-unavailable event that discovers all affected future allocations, classifies current versus future impact, proposes compatible replacements, or records controlled recovery. Resource master status and allocation recovery are separate concerns.

**Finding:** `STRUCTURAL_GAP`. Recovery requires an event-to-affected-allocation workflow that does not exist in the current booking-resource path.

## Invariant Fit Matrix

| Frozen invariant | Fit classification | Evidence confidence | Investigation finding |
| --- | --- | --- | --- |
| `RESOURCE_IDENTITY` | `SEMANTIC_EQUIVALENT` | `IMPLEMENTED_AND_VERIFIED` | Tenant-scoped resource identity/type/status is represented. |
| `FINITE_CAPACITY` | `SEMANTIC_NARROWER` | `IMPLEMENTED_NOT_VERIFIED` | A bounded master capacity exists, but consumed capacity and capacity-N conflict are not proven. |
| `SERVICE_SEGMENT_COMMITMENT` | `SEMANTIC_NARROWER` | `IMPLEMENTED_NOT_VERIFIED` | Session/resource linkage exists; multi-segment commitment is absent. |
| `TEMPORAL_ALLOCATION` | `STRUCTURAL_GAP` | `IMPLEMENTED_AND_VERIFIED` | Date/time conflict checking exists, but active interval commitments do not. |
| `AVAILABILITY_CONSTRAINT` | `SEMANTIC_EQUIVALENT` | `IMPLEMENTED_AND_VERIFIED` | Unavailable resource statuses block new session allocation. |
| `CAPACITY_CONFLICT` | `SEMANTIC_NARROWER` | `IMPLEMENTED_AND_VERIFIED` | Exclusive same-slot conflicts are blocked; pooled/capacity-N semantics are absent. |
| `REALLOCATION` | `STRUCTURAL_GAP` | `IMPLEMENTED_NOT_VERIFIED` | Changing the persisted resource reference is not a durable replacement lifecycle. |
| `ALLOCATION_HISTORY` | `STRUCTURAL_GAP` | `NOT_FOUND` | Master-data audit is not allocation transition history. |
| `AFFECTED_ALLOCATION_DISCOVERY` | `STRUCTURAL_GAP` | `NOT_FOUND` | No outage-driven discovery and impact classification were found. |

## Preservable Legacy Behaviors

The following behaviors are valid evidence and may be preserved through a future adapter or redesigned implementation after authorization:

- Tenant-scoped resource identity and resource type/status lookup.
- Blocking allocation against unavailable resource status.
- Active same-resource conflict prevention during create, update, and reschedule.
- Current session-to-resource linkage where the business operation is genuinely single-session and single-resource.
- Audit of resource master CRUD as a separate concern from allocation history.

## Legacy Structures That Must Not Dictate the Target

```text
booking_resources.capacity
  != consumed capacity ledger

session_logs.booking_resource_id
  != service-segment allocation identity

assigned_date + assigned_time
  != active interval commitment

UPDATE booking_resource_id
  != reallocation history

resource status
  != affected-allocation recovery workflow
```

## H5.2 Finding

```yaml
H5_2_finding:
  semantic_equivalent:
    - RESOURCE_IDENTITY
    - AVAILABILITY_CONSTRAINT
  semantic_narrower:
    - FINITE_CAPACITY
    - SERVICE_SEGMENT_COMMITMENT
    - CAPACITY_CONFLICT
  structural_gap:
    - TEMPORAL_ALLOCATION
    - REALLOCATION
    - ALLOCATION_HISTORY
    - AFFECTED_ALLOCATION_DISCOVERY
  semantic_divergence: []
  legacy_behavior_preservation: POSSIBLE_WITH_ADAPTATION
  semantic_fit: PARTIAL
  evidence_confidence: MEDIUM
  reuse_decision: NOT_YET_AUTHORIZED
  extension_decision: NOT_YET_AUTHORIZED
  dedicated_build_decision: NOT_YET_AUTHORIZED
  contract_design_authorized: false
  schema_design_authorized: false
  inventory_change_authorized: false
```

The investigation identifies structural gaps, not merely missing convenience methods. A future disposition must decide whether the legacy path can be adapted behind a new Beauty OS boundary, while preserving its verified status gating and conflict behavior without allowing its storage shape to define the target contract.

## Next Gate

```text
H5.1 Existing-contract discovery       COMPLETE
H5.2 Semantic-fit investigation        COMPLETE
             ↓
H5.3 Architecture Disposition           NEXT
             ↓
REUSE / EXTEND-ADAPT / DEDICATED        NOT YET DECIDED
```
