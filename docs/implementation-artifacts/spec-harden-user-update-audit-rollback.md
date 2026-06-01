---
title: 'Harden User Update Audit Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'd1178b64283c48056ceeae88ed948ea5ce2ad153'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `updateUserStatus` and `updateUser` mutate `users` first, then call `recordAuditLog`. If audit logging fails, the caller gets a thrown/rejected action but the user row remains changed without an audit trail.

**Approach:** Snapshot the affected user fields before mutation, then rollback the user row if audit logging fails after a successful update. Return an explicit failure that includes the audit error and rollback failure details if rollback also fails.

## Boundaries & Constraints

**Always:** use Supabase generated update types for rollback payloads; return explicit failure instead of success when audit fails; assert DB side effects and rollback payloads in tests; keep the existing action API and revalidation path.

**Ask First:** changing auth user metadata; changing role/status allowed values; adding a DB transaction/RPC; extending this slice to salary/base salary or delete/create user flows.

**Never:** swallow audit failures; rollback unrelated user fields; change `updateBaseSalary`, `createUser`, or `deleteUser` in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Status update succeeds and audit succeeds | Existing user status is `active`, request sets `inactive` | User status remains `inactive`, action returns success | N/A |
| Status audit fails | User status update succeeds, audit insert throws | Status is restored to snapshot | Return failure including audit error |
| Profile audit fails | `full_name`/`role` update succeeds, audit insert throws | `full_name` and `role` are restored to snapshot | Return failure including audit error |
| Rollback fails | Audit fails and rollback update also fails | Action returns failure including both audit and rollback errors | No success response |

</frozen-after-approval>

## Code Map

- `src/services/user-actions.ts` -- Server Actions for user update/status mutations and audit logging.
- `src/__tests__/user-actions.test.ts` -- new focused Jest coverage for user update audit rollback behavior.
- `docs/DEVELOPMENT_LOG.md` -- BMAD refactor log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/user-actions.ts` -- add user snapshot/rollback helpers and wire them into `updateUserStatus` and `updateUser` -- avoid unaudited user changes.
- [x] `src/__tests__/user-actions.test.ts` -- add scripted Supabase tests for audit success, audit failure rollback, and rollback-failure reporting -- assert side effects directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- record scope, risk reduced, and verification commands -- preserve traceability.

**Acceptance Criteria:**
- Given `updateUserStatus` updates DB and audit succeeds, when the action returns, then it returns `{ success: true }`.
- Given `updateUserStatus` updates DB and audit fails, when the action returns, then it restores the old `status` and returns failure.
- Given `updateUser` updates DB and audit fails, when the action returns, then it restores old `full_name` and `role`.
- Given rollback fails after audit failure, when the action returns, then the error includes both audit and rollback failure context.

## Design Notes

This slice intentionally excludes `updateBaseSalary` because salary mutations have extra authorization and salary lifecycle rules. It also excludes create/delete user flows because they need separate decisions around Supabase Auth user rollback and delete restoration.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` -- expected: user action audit rollback tests pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Rollback Contract**

- Shared typed rollback helper keeps audit failure recovery narrow.
  [`user-actions.ts:195`](../../src/services/user-actions.ts#L195)

- Status action snapshots old state and rejects unaudited updates.
  [`user-actions.ts:315`](../../src/services/user-actions.ts#L315)

- Profile action restores only fields changed by this mutation.
  [`user-actions.ts:359`](../../src/services/user-actions.ts#L359)

**Side-Effect Coverage**

- Success path asserts audit old/new data and revalidation.
  [`user-actions.test.ts:89`](../../src/__tests__/user-actions.test.ts#L89)

- Failure paths assert rollback payloads and no revalidation.
  [`user-actions.test.ts:111`](../../src/__tests__/user-actions.test.ts#L111)

- Rollback failure path preserves both error contexts.
  [`user-actions.test.ts:129`](../../src/__tests__/user-actions.test.ts#L129)

**Traceability**

- Development log captures scope, exclusions, and verification commands.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
