# H3 BabyCare Capability Reconciliation - Four Path Evidence Pass

**Date:** 2026-09-16

**Branch:** `feat/haircut-h2-contract-extraction`

**Status:** RECONCILIATION COMPLETE

**Scope:** BabyCare operational evidence for recommendation, reassignment, conflict, and waitlist paths before Haircut UC3.

**Purpose:** Determine what BabyCare actually proves as cross-product evidence without promoting any Haircut boundary or Platform contract.

---

## Guardrails

This pass extends `H3_BABYCARE_ASSIGNMENT_AUDIT.md`. It does not replace H3 Product/UX validation.

It does not:

1. Re-audit Spa broadly.
2. Copy BabyCare storage or implementation into Haircut.
3. Seal `IProfessionalAssignment`, `IProfessionalMatching`, `IResourceAllocation`, or `IWaitlistEngine`.
4. Change the H1/H2 contract inventory.
5. Convert Haircut `PROPOSED_BY_PRODUCT` requirements into field-validated facts.

BabyCare is cross-product implementation evidence. Haircut is product-domain requirement evidence. Reconciliation is still required before boundary decisions.

---

## Evidence Scale

```yaml
evidence_scale:
  IMPLEMENTED:
    meaning: "Code path and persistence behavior were found."
  PARTIAL:
    meaning: "Related behavior exists, but required lifecycle/history/ownership shape is incomplete or indirect."
  NOT_FOUND:
    meaning: "No confirming code path was found in this narrow pass."
  PROPOSED_BY_PRODUCT:
    meaning: "Haircut requirement established by Product/UX and BA reasoning, not field observation."
```

---

## Executive Finding

BabyCare has stronger operational evidence than the initial 6-point assignment audit showed. It is not only "replace KTV on leave"; it contains a wider cluster:

- Auto recommendation and alternatives through the Decision Engine.
- Admin/manual assignment from a recommendation.
- Leave-driven reassignment of affected sessions.
- Professional/time/capacity conflict checks.
- Resource schedule conflict checks.
- Smart waitlist add, notify, and convert-to-booking flow.

However, BabyCare still does not prove the complete Haircut Professional Assignment lifecycle:

- No explicit professional `ACCEPTED` / `REJECTED` assignment state was found.
- No controlled rejection reason workflow was found.
- No standalone durable assignment history table or replacement chain was found.
- Reassignment history is partly preserved through primary booking KTV, session performer KTV, notes, notifications, and audit logs, but not as a structured assignment ledger.

Therefore:

```yaml
babycare_reconciliation_result:
  cross_product_capability_evidence: yes
  evidence_strength: MIXED_IMPLEMENTED_AND_PARTIAL
  professional_assignment_boundary_signal: STRONGER_THAN_INITIAL_AUDIT
  platform_contract_claim_allowed: false
  contract_inventory_change_allowed: false
  haircut_boundary_decision: NONE
```

---

## Path 1 - Auto Recommendation

Question:

```text
recommendation -> accept/apply -> assignment
recommendation -> admin manual assignment
```

Evidence found:

- `src/modules/bookings/actions/ktv-suggestion-actions.ts`
  - `getKtvSuggestions()` calls `autoAssignKtv()` and returns a recommended KTV plus alternatives.
  - `filterAvailableKtvs()` removes candidates with existing time overlap, break-buffer conflict, or daily limit conflict.
  - `applyKtvSuggestion()` persists the admin-selected KTV to `bookings.assigned_ktv_id`.
- `src/modules/bookings/actions/session-log-actions.ts`
  - Booking/session creation can call `autoAssignKtv()` when no KTV was supplied.
  - The selected KTV becomes the session `completed_by_ktv_id` when session logs are created.
- `src/lib/decision-engine/providers/booking/auto-assignment-provider.ts`
  - Generates ranked assignment output and alternatives.

Assessment:

```yaml
auto_recommendation:
  system_recommendation: IMPLEMENTED
  alternatives: IMPLEMENTED
  admin_apply_recommendation: IMPLEMENTED
  auto_assignment_when_missing_ktv: IMPLEMENTED
  recommendation_is_assignment: false
  professional_accept_recommendation: NOT_FOUND
  controlled_rejection: NOT_FOUND
  evidence_strength: IMPLEMENTED_FOR_ADMIN_OR_SYSTEM_ASSIGNMENT
```

Reconciliation:

BabyCare proves that Bella already has a recommendation-and-apply pattern. It does not prove Haircut's proposed professional decision lifecycle. For Haircut, this supports separating:

```text
Recommendation -> advisory candidate ranking
Assignment -> persisted professional responsibility
Professional decision -> accept/reject lifecycle, still not proven by BabyCare
```

---

## Path 2 - Leave / Reassignment

Question:

```text
leave -> affected sessions -> replacement -> history -> commission
```

Evidence found:

- `src/services/attendance-actions.ts`
  - `getKTVConflictSessions()` finds scheduled sessions affected by a KTV leave date.
  - `approveLeaveRequest()` accepts reassignment inputs and updates affected `session_logs.completed_by_ktv_id`.
  - The same action approves `staff_leaves` and writes the related `attendance` side effect.
  - `rollbackSessionReassignments()` restores changed sessions if leave approval or attendance write fails.
- `src/__tests__/attendance-actions.test.ts`
  - Tests successful reassignment.
  - Tests rollback when leave approval fails.
  - Tests rollback when attendance insert/update fails.
  - Tests reassignment rollback failure reporting.
- `docs/implementation-artifacts/spec-harden-leave-reassignment-rollback.md`
  - Documents the accepted hardening scope and evidence expectations.
- `src/services/ktv-actions.ts`
  - KTV session lists can include sessions reassigned to the KTV through `completed_by_ktv_id`.
  - Commission/salary query paths use completed sessions and `completed_by_ktv_id`, so replacement affects who receives session credit.

Assessment:

```yaml
leave_reassignment:
  staff_leave_source: IMPLEMENTED
  affected_session_lookup: IMPLEMENTED
  replacement_assignment_update: IMPLEMENTED
  notification_to_replacement: IMPLEMENTED
  rollback_protection: IMPLEMENTED
  attendance_side_effect: IMPLEMENTED
  commission_impact_path: PARTIAL
  structured_assignment_history: PARTIAL
  durable_replacement_chain: NOT_FOUND
  general_no_show_lifecycle: NOT_FOUND
  evidence_strength: IMPLEMENTED_FOR_LEAVE_DRIVEN_SESSION_REASSIGNMENT
```

Reconciliation:

BabyCare proves leave-driven reassignment exists as a real Bella operational pattern. It does not prove a standalone assignment history ledger. Commission impact is indirect: the substitute KTV is recorded as the session performer, and salary/commission paths read completed sessions by performer; this is not the same as a structured assignment contract with reason codes and replacement relationships.

---

## Path 3 - Conflict

Question:

```text
KTV conflict
resource conflict
schedule conflict
```

Evidence found:

- `src/modules/bookings/actions/session-log-actions.ts`
  - Capacity checks call `checkBookingCapacity()`.
  - Conflict detection calls `checkBookingConflicts()`.
  - Blocking conflicts prevent booking/session creation and return conflicts/suggestions.
  - Warning conflicts can be logged and allowed.
- `src/modules/bookings/actions/ktv-suggestion-actions.ts`
  - Suggestion filtering excludes KTVs with time overlap, break buffer violation, or daily limit reached.
- `src/core/services/order/booking-resource-schedule-guard.ts`
  - Validates `booking_resources` availability.
  - Blocks active resource conflicts against `session_logs` for the same resource, date, and time.
- `src/core/services/order/update-session-log-action.ts`
  - Runs resource schedule validation before updating a session log.
  - Sends reassignment notifications when `completed_by_ktv_id` changes.

Assessment:

```yaml
conflict:
  professional_time_conflict: IMPLEMENTED
  capacity_conflict: IMPLEMENTED
  break_buffer_conflict: IMPLEMENTED
  daily_limit_conflict: IMPLEMENTED
  resource_availability_conflict: IMPLEMENTED
  resource_schedule_conflict: IMPLEMENTED
  blocking_vs_warning_conflict: IMPLEMENTED
  single_generalized_conflict_contract: NOT_FOUND
  evidence_strength: IMPLEMENTED_ACROSS_BOOKING_SESSION_RESOURCE_FLOWS
```

Reconciliation:

BabyCare proves Bella has multiple conflict mechanisms, but they are distributed across booking/session/resource actions and Decision Engine providers. Haircut should not assume one monolithic conflict contract already exists. UC3/UC4 must still decide whether Haircut needs assignment-owned conflict behavior, appointment-owned scheduling behavior, resource-owned allocation behavior, or a combination.

---

## Path 4 - Smart Waitlist

Question:

```text
conflict -> waitlist -> condition becomes feasible -> booking/assignment continuation
```

Evidence found:

- `src/services/waitlist/waitlist-service.ts`
  - `addToWaitlist()` persists `waitlist_entries`.
  - Entries can carry `preferred_ktv_id`, `preferred_resource_id`, preferred date/time, package, booking value, priority, and original failed booking context.
  - `processSlotAvailable()` finds matching active/notified entries and notifies top matches.
  - `convertToBooking()` creates a booking from a waitlist entry and marks the entry `converted`.
- `src/types/waitlist.ts`
  - Models waitlist lifecycle statuses: `active`, `notified`, `reserved`, `converted`, `cancelled`, `expired`.
  - Models conversion and notification metrics.
- `src/services/waitlist/__tests__/waitlist-service.test.ts`
  - Covers waitlist processing and conversion behavior.

Assessment:

```yaml
smart_waitlist:
  waitlist_entry_persistence: IMPLEMENTED
  preferred_professional: IMPLEMENTED
  preferred_resource: IMPLEMENTED
  priority_scoring: IMPLEMENTED
  slot_available_processing: IMPLEMENTED
  customer_notification: IMPLEMENTED
  convert_waitlist_to_booking: IMPLEMENTED
  direct_conflict_to_waitlist_trigger: PARTIAL
  assignment_continuation_after_conversion: PARTIAL
  evidence_strength: IMPLEMENTED_WITH_PARTIAL_TRIGGER_AND_ASSIGNMENT_LINKAGE
```

Reconciliation:

BabyCare proves a Smart Waitlist capability exists in the codebase, including notification and conversion. The narrow pass found enough evidence for `waitlist -> feasible slot -> booking`, but only partial evidence that every conflict path automatically creates waitlist intent, and partial evidence that converted bookings continue through a complete assignment lifecycle. For Haircut, waitlist can be treated as a likely consumer of Appointment, Recommendation, and Assignment, not as proof that Assignment is already solved.

---

## Cross-Product Matrix

Legend:

- `IMPLEMENTED`: code-confirmed in this pass.
- `PARTIAL`: related implementation exists, but not complete for the Haircut requirement shape.
- `NOT_FOUND`: not confirmed in this pass.
- `PROPOSED_BY_PRODUCT`: Haircut Product/UX requirement, not field observation.
- `H2_EVIDENCE_NOT_REAUDITED`: existing H2 Spa evidence exists, but Spa was intentionally not re-audited in H3.

| Capability | Spa | BabyCare | Haircut | Reconciliation |
| --- | --- | --- | --- | --- |
| Appointment / Session | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Shared operating shape exists, but Haircut appointment policy still needs validation. |
| Professional Assignment | H2_EVIDENCE_NOT_REAUDITED | PARTIAL | PROPOSED_BY_PRODUCT | BabyCare has primary and session-level KTV assignment; Haircut requires deeper lifecycle. |
| Reassignment | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | BabyCare leave reassignment strongly supports cross-product need. |
| Assignment History | H2_EVIDENCE_NOT_REAUDITED | PARTIAL | PROPOSED_BY_PRODUCT | BabyCare preserves some facts, but no structured assignment history chain was found. |
| Auto Recommendation | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | BabyCare proves recommendation and alternatives exist; assignment decision semantics remain separate. |
| Manual Assignment | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Admin apply and direct assignment paths exist. |
| Resource Conflict | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Resource schedule guard provides strong evidence. |
| Smart Waitlist | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Waitlist add/process/convert is implemented; direct conflict trigger and assignment continuation are partial. |
| Accept / Reject Lifecycle | H2_EVIDENCE_NOT_REAUDITED | NOT_FOUND | PROPOSED_BY_PRODUCT | BabyCare does not prove Haircut Q3 controlled rejection. |

---

## Boundary Impact

This pass strengthens the case that Haircut is rediscovering a cross-product operational cluster already visible in BabyCare:

```text
Appointment / Session
  -> Recommendation / Matching
  -> Professional Assignment
  -> Conflict / Resource Allocation
  -> Smart Waitlist
  -> Reassignment / Attendance Impact
```

But the evidence does not authorize contract design yet.

```yaml
boundary_impact:
  appointment: KEEP_UNDER_VALIDATION
  professional_assignment: VERY_STRONG_SEPARATE_SIGNAL
  professional_recommendation: STRONG_REUSE_SIGNAL
  resource_allocation: STRONG_REUSE_SIGNAL
  smart_waitlist: STRONG_REUSE_SIGNAL
  accept_reject_lifecycle: HAIRCUT_ONLY_REQUIREMENT_SO_FAR
  platform_contract_claim_allowed: false
  h1_h2_contract_count_change_allowed: false
  boundary_decision: NONE
```

---

## Next Step For UC3

Resume Haircut UC3 as a reconciliation use case:

```text
Stylist sick/no-show/unavailable
  -> identify affected appointments/assignments
  -> compare BabyCare leave-driven affected sessions
  -> decide whether Haircut needs structured assignment lifecycle beyond BabyCare mutation model
  -> preserve history/reason/actor/timestamp if required
```

UC3 should answer:

1. Does Haircut need a structured assignment state transition such as `ACCEPTED -> DISRUPTED -> REASSIGNED`?
2. Is staff absence sourced from Workforce/Attendance while Assignment owns only the customer-service impact?
3. Does reassignment need durable replacement links, or are appointment/session notes and audit logs enough?
4. Does Smart Waitlist participate when no replacement stylist is available?

Until those are answered:

```yaml
haircut_uc3_status: READY_TO_RESUME_WITH_BABYCARE_RECONCILIATION
boundary_decision: NONE
contract_design_allowed: false
```
