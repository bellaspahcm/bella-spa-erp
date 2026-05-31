---
title: 'Harden Attendance Leave Approval'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '31edd5bd8068c80890d5efc3273f03aa95d7b9f1'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `approveLeaveRequest` updates `staff_leaves` to approved before it writes the required `attendance` side effect. If the attendance write fails, the action returns failure but can leave the leave request approved without the salary-critical attendance row.

**Approach:** Keep the public action API stable, add focused side-effect tests, and harden rollback so leave approval does not persist when attendance cannot be recorded.

## Boundaries & Constraints

**Always:** Preserve `approveLeaveRequest(leaveId, reassignments?)` return shape and RBAC behavior. Preserve existing leave-type mapping: `morning`/`afternoon` to `half_day`, `full_day` to `absent`. If the leave status update succeeds but the attendance read/insert/update fails, restore the leave row's previous approval fields before returning failure.

**Ask First:** Stop before changing attendance schema, leave request schema, salary recalculation rules, session reassignment UI, or conflict-session scheduling semantics.

**Never:** Do not silently ignore attendance read/write, staff leave update, rollback, or audit errors. Do not touch `supabase/.temp/*` or `.claude/settings.local.json`. Do not broaden this slice into a full HR workflow transaction rewrite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Approve full-day leave | Pending full-day leave with no attendance row | Staff leave becomes approved; attendance row is inserted with `absent` | Return success only after attendance side effect succeeds |
| Approve half-day leave | Pending morning/afternoon leave with no attendance row | Staff leave becomes approved; attendance row is inserted with `half_day` | Return success only after attendance side effect succeeds |
| Attendance insert fails | Staff leave update succeeds; no existing attendance; insert fails | Staff leave is restored to previous status/approval fields | Return failure with attendance error and rollback error if rollback fails |
| Existing attendance update fails | Existing attendance is `absent`/`half_day`; status update fails | Staff leave is restored to previous status/approval fields | Return failure with attendance error and rollback error if rollback fails |

</frozen-after-approval>

## Code Map

- `src/services/attendance-actions.ts` -- contains KTV attendance, leave request, approval/rejection actions, and attendance side-effect logic.
- `src/__tests__/attendance-actions.test.ts` -- existing attendance action tests; extend with scripted side-effect tests.
- `src/__tests__/security-hardening.test.ts` -- existing RBAC coverage for leave approval denial.
- `src/app/dashboard/sessions/components/LeaveApprovalModal.tsx` -- caller context for admin approval flow.

## Tasks & Acceptance

**Execution:**
- [x] `src/__tests__/attendance-actions.test.ts` -- add side-effect tests for leave approval attendance insert/update and rollback on attendance failure.
- [x] `src/services/attendance-actions.ts` -- add typed rollback for `staff_leaves` approval when attendance side effect fails.
- [x] `docs/DEVELOPMENT_LOG.md` -- append concise BMAD entry with verification commands.

**Acceptance Criteria:**
- Given a pending full-day leave has no attendance row, when approved, then `attendance` is inserted with `status: 'absent'`.
- Given a pending half-day leave has no attendance row, when approved, then `attendance` is inserted with `status: 'half_day'`.
- Given staff leave approval succeeds but attendance write fails, when the action returns, then the staff leave row is restored to its previous status/approval fields.
- Given rollback also fails, when the action returns, then the error message includes both attendance failure and rollback failure.

## Spec Change Log

- 2026-06-01 -- Added leave approval rollback around attendance side effects and tests for full-day, half-day, attendance failure rollback, and rollback failure reporting.

## Design Notes

This slice intentionally rolls back only the approval fields changed by `approveLeaveRequest`: `status` and `approved_by`. It does not redesign session reassignment because that is a separate scheduling transaction with its own previous-state requirements.

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/services/attendance-actions.ts src/__tests__/attendance-actions.test.ts` -- pass with pre-existing `any` warnings in `attendance-actions.ts`.
- `npm.cmd test -- src/__tests__/attendance-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.

## Suggested Review Order

1. `src/services/attendance-actions.ts` -- review `approveLeaveRequest` rollback path and typed payloads.
2. `src/__tests__/attendance-actions.test.ts` -- review side-effect assertions for attendance insert/update and rollback.
3. `docs/DEVELOPMENT_LOG.md` -- confirm summary matches implemented behavior.
