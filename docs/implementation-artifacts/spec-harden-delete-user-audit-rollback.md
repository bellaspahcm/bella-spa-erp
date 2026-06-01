---
title: 'Harden Delete User Audit Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '7eed1c89b4cc27a1bb630ba3ea600c6551b78a74'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `deleteUser` deletes the `users` row first and only records audit afterward. If `recordAuditLog` fails, the user is gone without a delete audit trail.

**Approach:** Snapshot the target user row before deletion, include that snapshot as `old_data` in the delete audit log, and restore the deleted row if audit logging fails after the delete succeeds.

## Boundaries & Constraints

**Always:** return explicit failure if snapshot, delete, audit, or restore fails; preserve the existing `{ success: true }` shape on successful delete; use Supabase generated `users` row/insert types; assert delete/restore/audit side effects in tests.

**Ask First:** deleting Supabase Auth accounts; changing soft-delete vs hard-delete behavior; adding a database RPC/transaction; extending this slice to `updateBaseSalary`.

**Never:** swallow audit failures; return success when delete audit fails; restore unrelated rows; change salary recalculation behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete succeeds | Existing user row, delete succeeds, audit succeeds | Return `{ success: true }` and revalidate settings | Audit contains `old_data` snapshot |
| Snapshot fails | User cannot be loaded before delete | Do not delete | Return snapshot error or user-not-found |
| Audit fails | Delete succeeds, audit throws | Restore deleted user row from snapshot | Return audit failure; no revalidate |
| Restore fails | Audit fails and restore insert fails | No success response | Return both audit and restore failure context |

</frozen-after-approval>

## Code Map

- `src/services/user-actions.ts` -- Server Actions for user delete and audit rollback behavior.
- `src/__tests__/user-actions.test.ts` -- focused Jest coverage for user create/update/delete rollback behavior.
- `docs/DEVELOPMENT_LOG.md` -- implementation log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/user-actions.ts` -- snapshot deleted user plus direct cascade `staff_leaves` rows and restore on audit failure -- prevent unaudited hard deletes.
- [x] `src/__tests__/user-actions.test.ts` -- add delete success, audit failure restore, staff leave restore, and restore-failure tests -- assert side effects directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- record scope, risk reduced, and verification commands -- preserve BMAD traceability.

**Acceptance Criteria:**
- Given `deleteUser` loads a user and audit succeeds, when the action returns, then it returns `{ success: true }` and audit includes the old user row.
- Given snapshot lookup fails, when `deleteUser` runs, then it returns failure and does not delete.
- Given audit fails after delete, when `deleteUser` returns, then it restores the deleted user row and does not revalidate.
- Given restore fails after audit failure, when `deleteUser` returns, then the error includes both audit and restore failure context.

## Design Notes

This keeps the existing hard-delete behavior. It is a compensating-action guard, not a replacement for a database transaction/RPC. Review found `staff_leaves.user_id` has `ON DELETE CASCADE`, so the rollback snapshots and restores those direct child rows too.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` -- expected: user create/update/delete rollback tests pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Delete Rollback Contract**

- Snapshot mapping makes user restore payload explicit and typed.
  [`user-actions.ts:220`](../../src/services/user-actions.ts#L220)

- Staff leave mapping covers the direct cascade path from user delete.
  [`user-actions.ts:242`](../../src/services/user-actions.ts#L242)

- Restore helpers reinsert user first, then dependent staff leaves.
  [`user-actions.ts:258`](../../src/services/user-actions.ts#L258)

- Delete action snapshots before hard-delete and audits `old_data`.
  [`user-actions.ts:523`](../../src/services/user-actions.ts#L523)

- Audit failure path restores user and staff leave snapshots.
  [`user-actions.ts:575`](../../src/services/user-actions.ts#L575)

**Side-Effect Coverage**

- Success path asserts delete audit includes old user data.
  [`user-actions.test.ts:345`](../../src/__tests__/user-actions.test.ts#L345)

- Snapshot failure confirms no delete or audit is attempted.
  [`user-actions.test.ts:365`](../../src/__tests__/user-actions.test.ts#L365)

- Audit rollback tests assert user and staff leave restore inserts.
  [`user-actions.test.ts:383`](../../src/__tests__/user-actions.test.ts#L383)

- Partial rollback test reports staff leave restore failure.
  [`user-actions.test.ts:427`](../../src/__tests__/user-actions.test.ts#L427)

**Traceability**

- Development log captures scope, exclusions, and verification commands.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
