# H3 BabyCare Assignment Audit — Narrow Reconciliation Before Haircut UC3

**Date:** 2026-09-16  
**Branch:** `feat/haircut-h2-contract-extraction`  
**Status:** NARROW AUDIT COMPLETE  
**Scope:** BabyCare/Spa session assignment evidence only  
**Purpose:** Check whether Bella already has assignment/reassignment behavior close to Haircut UC3 before continuing Haircut workflow validation.

---

## Guardrails

This audit is read-only and narrow.

It does not:

1. Re-audit Spa broadly.
2. Copy BabyCare implementation into Haircut.
3. Claim BabyCare has a complete Professional Assignment capability.
4. Promote any contract to Platform.
5. Change the H1 contract inventory.

BabyCare is evidence for reconciliation, not a blueprint.

---

## Summary Finding

BabyCare has real implementation evidence for:

- Booking-level primary caregiver/KTV assignment.
- Session-level actual caregiver/KTV execution.
- Session status lifecycle with start/check-in, in-progress, complete/check-out.
- GPS capture on check-in/check-out.
- Leave-driven reassignment of affected session logs.
- Attendance side effect when leave is approved.
- Rollback protection when leave approval or attendance write fails after reassignment.

BabyCare does **not** currently show enough evidence for:

- A durable standalone assignment table.
- Assignment states such as `PROPOSED`, `ACCEPTED`, `REJECTED`, `DISRUPTED`.
- Explicit caregiver accept/reject workflow.
- Full reassignment history chain.
- A general no-show lifecycle.
- Cleanly separated Workforce/Attendance and Assignment contracts.

Therefore, BabyCare is strong cross-product evidence that reassignment exists in Bella operations, but it is not proof that the complete Haircut Professional Assignment boundary already exists.

---

## 6-Point Audit

### 1. Where Assignment Is Stored

Evidence:

- `bookings.assigned_ktv_id` stores the primary booking-level caregiver/KTV assignment.
- `session_logs.completed_by_ktv_id` stores the caregiver/KTV who performs or is assigned to a specific session.
- `session_logs` also stores `assigned_date`, `assigned_time`, `status`, `start_time`, `end_time`, GPS fields, notes, and duration fields.

References:

- `supabase/migrations/20260511000000_initial_schema.sql` defines `bookings.assigned_ktv_id`, `session_logs.completed_by_ktv_id`, and `attendance`.
- `src/modules/bookings/actions/session-log-actions.ts` creates session logs with `completed_by_ktv_id`.
- `src/core/services/order/update-booking-action.ts` updates primary booking KTV and validates scheduled session conflicts.
- `src/core/services/order/update-session-log-action.ts` updates session-level `completed_by_ktv_id` and sends reassignment notifications.

Assessment:

```yaml
assignment_storage:
  booking_primary_assignment: bookings.assigned_ktv_id
  session_execution_or_substitute_assignment: session_logs.completed_by_ktv_id
  standalone_assignment_table: not_found
  evidence_strength: IMPLEMENTED
```

---

### 2. Whether Assignment Has Lifecycle

Evidence:

- `session_logs.status` supports scheduled/pending/in_progress/completed/cancelled shapes across migrations/actions.
- KTV check-in starts a session: `startSession` updates `session_logs.status = in_progress`, `start_time`, and `completed_by_ktv_id`.
- KTV check-out completes a session: `completeKTVSession` updates `status = completed`, `end_time`, `completed_date`, `completed_by_ktv_id`, notes, duration fields, and checkout note.

Assessment:

```yaml
assignment_lifecycle:
  session_lifecycle_present: true
  assignment_lifecycle_present: partial
  explicit_assignment_states:
    proposed: not_found
    accepted: not_found
    rejected: not_found
    disrupted: not_found
  evidence_strength: IMPLEMENTED_FOR_SESSION_LIFECYCLE
```

Conclusion:

BabyCare has session lifecycle, not a dedicated assignment lifecycle. `completed_by_ktv_id` changes indicate who performs the session, but the code does not model assignment as its own state machine.

---

### 3. Whether Accept/Reject Exists

Evidence:

- Auto-assignment and KTV suggestion flows can choose a KTV.
- Session start by KTV changes status to `in_progress`.
- No explicit accept/reject assignment action was found in the audited paths.
- No `accepted`, `rejected`, or controlled rejection reason fields were found for assignment lifecycle.

Assessment:

```yaml
accept_reject:
  explicit_accept: not_found
  explicit_reject: not_found
  implicit_accept_by_start_session: possible_but_not_claimed
  controlled_rejection: not_found
  evidence_strength: NOT_PROVEN
```

Conclusion:

BabyCare does not currently prove the Haircut Q3 `controlled_rejection` requirement.

---

### 4. How Caregiver Leave / Unavailability Is Handled

Evidence:

- `getKTVConflictSessions` finds scheduled session logs for a KTV on a leave date by joining `session_logs` to `bookings.assigned_ktv_id`.
- `approveLeaveRequest` accepts `reassignments?: { sessionLogId; newKtvId }[]`.
- For each reassignment, `approveLeaveRequest` updates `session_logs.completed_by_ktv_id` to the substitute KTV and writes a replacement note.
- The same action approves `staff_leaves` and writes an `attendance` side effect.
- Rollback restores changed `session_logs` when leave approval or attendance write fails.

References:

- `src/services/attendance-actions.ts` has `getKTVConflictSessions`, `approveLeaveRequest`, and `rollbackSessionReassignments`.
- `src/__tests__/attendance-actions.test.ts` verifies successful reassignment and rollback when leave approval or attendance write fails.
- `docs/implementation-artifacts/spec-harden-leave-reassignment-rollback.md` records the hardening intent and acceptance criteria.

Assessment:

```yaml
leave_reassignment:
  conflict_session_lookup: implemented
  reassignments_input: implemented
  session_reassignment_update: implemented
  leave_approval_attendance_side_effect: implemented
  rollback_on_failure: implemented
  general_no_show_lifecycle: not_found
  evidence_strength: IMPLEMENTED_FOR_LEAVE_APPROVAL_REASSIGNMENT
```

Conclusion:

BabyCare has real leave-driven reassignment behavior. It does not yet prove a general no-show lifecycle equivalent to Haircut UC3/Q4.

---

### 5. Whether History / Replacement Relationship Exists

Evidence:

- Booking-level original assignment can remain in `bookings.assigned_ktv_id`.
- Session-level substitute can be stored in `session_logs.completed_by_ktv_id`.
- Leave reassignment writes `notes: "[🔄 Thay ca] Làm thay cho KTV chính"`.
- Generic audit logging exists in some update paths, and tests verify rollback behavior.

Missing:

- No standalone assignment history table was found.
- No durable chain such as Assignment #1 -> disrupted -> Assignment #2 was found.
- No structured replacement relationship (`replaces_assignment_id`, `reason_code`, `actor_id`, `changed_at`) was found in the audited paths.
- Rollback snapshots are in-memory safety mechanisms, not durable business history.

Assessment:

```yaml
history_and_replacement:
  original_primary_assignment_preserved_on_booking: partial
  substitute_session_assignment_preserved_on_session_log: implemented
  structured_history_chain: not_found
  structured_replacement_relationship: not_found
  reason_code: notes_only
  evidence_strength: PARTIAL
```

Conclusion:

BabyCare preserves enough data to distinguish primary booking KTV from session performer/substitute in some cases. It does not prove the durable Professional Assignment history model proposed for Haircut.

---

### 6. Attendance / Workforce vs Assignment Ownership

Evidence:

- `staff_leaves` is the leave request source.
- `attendance` records presence/absence/half-day effects.
- `session_logs` receives reassignment effects through `completed_by_ktv_id`.
- `approveLeaveRequest` currently orchestrates leave approval, reassignment updates, attendance write, notifications, rollback, and audit.

Assessment:

```yaml
ownership_split:
  workforce_attendance:
    owns: "leave approval and attendance status side effects"
    evidence: implemented
  assignment_impact:
    owns: "affected session performer/substitute update"
    evidence: implemented_inside_attendance_action
  appointment_session:
    owns: "booking/session lifecycle"
    evidence: implemented
  clean_contract_separation: not_proven
```

Conclusion:

The conceptual split aligns with Haircut's guardrail:

```text
Workforce/Attendance owns staff absence.
Professional Assignment owns affected assignment impact.
Appointment/Session owns customer service lifecycle.
```

But BabyCare implementation currently bundles this orchestration inside attendance actions. This is useful evidence, not a final boundary model.

---

## Reconciliation Impact For Haircut UC3

BabyCare changes the UC3 question from:

> Does Haircut need Professional Assignment?

to:

> Is Haircut discovering a generalized Staff/Professional Assignment capability that already appears partially in BabyCare leave reassignment?

Current answer:

```yaml
babycare_reconciliation:
  cross_product_evidence: yes
  proves_assignment_reassignment_need: yes
  proves_full_professional_assignment_boundary: no
  proves_accept_reject_lifecycle: no
  proves_structured_history_chain: no
  candidate_common_capability: Staff/Professional Assignment Impact
  next_step: Continue Haircut UC3 with BabyCare evidence in view
```

---

## Recommendation

Continue Haircut UC3, but phrase it as a reconciliation use case:

1. Compare Haircut stylist unavailability with BabyCare leave reassignment.
2. Preserve BabyCare evidence as implemented cross-product signal.
3. Do not copy BabyCare storage shape.
4. Test whether Haircut needs a structured assignment lifecycle beyond BabyCare's current `session_logs.completed_by_ktv_id` mutation.
5. Keep `boundary_decision: NONE` until UC3 and UC4 are recorded.

---

## Audit Verdict

```yaml
status: NARROW_AUDIT_COMPLETE
babycare_has_assignment_evidence: true
babycare_has_reassignment_evidence: true
babycare_has_full_assignment_lifecycle: false
haircut_uc3_should_resume: true
platform_contract_claim_allowed: false
contract_inventory_change_allowed: false
```

