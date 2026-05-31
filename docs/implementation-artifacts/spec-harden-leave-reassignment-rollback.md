---
title: 'Harden Leave Reassignment Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '0204e13ac02a0ff986e58efa08bbd37c103d142f'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `approveLeaveRequest` can update `session_logs` for leave reassignments before it approves `staff_leaves` and writes the required `attendance` side effect. If a later step fails, the leave approval is rolled back but reassigned sessions can remain changed, creating an inconsistent HR/scheduling state.

**Approach:** Snapshot the mutable `session_logs` fields before each reassignment, then rollback successful reassignments in reverse order if approval or attendance side effects fail. Keep the existing action API, permissions, leave-type attendance mapping, and audit behavior unchanged.

## Boundaries & Constraints

**Always:** preserve explicit failure returns; do not swallow database errors; type DB update payloads with Supabase generated types where this slice touches them; keep rollback scoped to rows changed during the current action call; include side-effect assertions in tests.

**Ask First:** introducing a PostgreSQL RPC/transaction wrapper; changing how leave conflicts are selected; changing visible UI copy or reassignment UX.

**Never:** rewrite the whole attendance module; alter salary calculation logic; overwrite present/late attendance records; remove existing audit logging for successful leave approval.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Successful approval with reassignment | Pending leave plus one or more `reassignments` | Reassignment updates run, leave becomes `approved`, attendance side effect is written, audit log is recorded | N/A |
| Leave approval fails after reassignment | Reassignment update succeeds, `staff_leaves` approval update fails | Action returns failure and restores reassigned `session_logs` fields | Failure message includes approval error; audit log is not recorded |
| Attendance fails after reassignment and leave approval | Reassignment and leave approval succeed, attendance read/insert/update fails | Action returns failure, rolls back leave approval and restores reassigned sessions | Failure message includes attendance error and any rollback failure details |
| Reassignment rollback fails | A later step fails and restoring a changed `session_logs` row fails | Action returns failure with the original error plus rollback failure context | No success response or audit log |

</frozen-after-approval>

## Code Map

- `src/services/attendance-actions.ts` -- Server Action module containing `approveLeaveRequest`, leave approval, reassignment, attendance write, rollback helpers, and cache revalidation.
- `src/__tests__/attendance-actions.test.ts` -- Jest coverage for attendance read fail-fast behavior and leave approval side effects using scripted Supabase calls.
- `docs/DEVELOPMENT_LOG.md` -- running development log for BMAD refactor slices and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/attendance-actions.ts` -- add typed reassignment snapshot/rollback helpers and wire them into `approveLeaveRequest` -- keep schedule state consistent when later side effects fail.
- [x] `src/__tests__/attendance-actions.test.ts` -- extend scripted tests for successful reassignment, approval failure rollback, attendance failure rollback, and rollback-failure reporting -- assert side-effect tables directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- add a concise entry with scope, risk reduced, and verification commands -- preserve refactor audit trail.

**Acceptance Criteria:**
- Given a pending leave with reassignment, when approval and attendance writes succeed, then `session_logs` receives the replacement KTV and the action returns success.
- Given a reassignment succeeds but leave approval fails, when the action exits, then the changed `session_logs` row is restored to its previous `completed_by_ktv_id` and `notes`.
- Given reassignment and leave approval succeed but attendance write fails, when the action exits, then both `staff_leaves` and changed `session_logs` are restored.
- Given rollback of a reassigned session fails, when the action exits, then it returns failure text that includes the original error and the reassignment rollback failure.

## Design Notes

Rollback should track only updates that actually succeeded. Use reverse-order rollback so multiple reassignments unwind like a stack. Keep the current non-RPC shape because this is a narrow hardening slice; a true DB transaction/RPC can be planned separately if needed.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/attendance-actions.test.ts --runInBand` -- expected: all attendance action tests pass, including new side-effect rollback cases.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes with typed DB payloads.
- `npx.cmd eslint src/services/attendance-actions.ts src/__tests__/attendance-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Rollback Design**

- Centralizes reverse-order session rollback for changed rows only.
  [`attendance-actions.ts:43`](../../src/services/attendance-actions.ts#L43)

- Snapshots session fields before each reassignment update.
  [`attendance-actions.ts:552`](../../src/services/attendance-actions.ts#L552)

- Restores reassigned sessions when leave approval fails.
  [`attendance-actions.ts:602`](../../src/services/attendance-actions.ts#L602)

- Rolls back leave and reassignment state after attendance failure.
  [`attendance-actions.ts:655`](../../src/services/attendance-actions.ts#L655)

**Side-Effect Tests**

- Covers successful reassignment with leave and attendance writes.
  [`attendance-actions.test.ts:255`](../../src/__tests__/attendance-actions.test.ts#L255)

- Covers leave approval failure after reassignment.
  [`attendance-actions.test.ts:299`](../../src/__tests__/attendance-actions.test.ts#L299)

- Covers attendance failure rolling back both tables.
  [`attendance-actions.test.ts:375`](../../src/__tests__/attendance-actions.test.ts#L375)

- Covers reassignment rollback failure reporting.
  [`attendance-actions.test.ts:458`](../../src/__tests__/attendance-actions.test.ts#L458)

**Traceability**

- Records scope, risk reduced, and verification trail.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
