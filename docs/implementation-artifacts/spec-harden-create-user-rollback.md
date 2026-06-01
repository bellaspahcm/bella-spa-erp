---
title: 'Harden Create User Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '497e63ed3855a0668459c932bcf1e679c9c1a4a3'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `createUser` creates the Supabase Auth account first, then inserts `public.users`, then records audit. If profile insert rollback fails, the current `.catch(() => {})` hides the failure; if audit fails after profile insert, the newly created user can remain without an audit trail.

**Approach:** Keep the existing create order, but make every compensating action explicit. On profile insert failure, attempt Auth rollback and report rollback failure in the returned error. On audit failure after profile insert, delete the profile row and Auth user, then return a failure that includes cleanup failures if any rollback step fails.

## Boundaries & Constraints

**Always:** preserve the existing Server Action return shape on success; keep subscription limit and env validation behavior; use typed Supabase payloads for `users` insert/delete-related data; assert Auth/profile/audit side effects in tests.

**Ask First:** changing onboarding/Auth metadata semantics; adding a database RPC/transaction; changing password generation or email confirmation behavior; extending this slice to `deleteUser` or `updateBaseSalary`.

**Never:** swallow Auth rollback errors; return success if audit logging fails; delete unrelated users; change salary recalculation behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create succeeds | Auth create, profile insert, and audit all succeed | Return created profile data and temporary password | Revalidate settings |
| Profile insert fails | Auth user was created, profile insert returns DB error | Attempt Auth rollback and return failure | Include profile error; include Auth rollback error if rollback fails |
| Audit fails | Auth user and profile insert succeed, audit throws | Attempt profile rollback and Auth rollback | Return failure; include cleanup failures if any |
| Auth rollback fails | Profile insert fails and Auth delete returns error | No success response | Return profile failure plus rollback failure context |

</frozen-after-approval>

## Code Map

- `src/services/user-actions.ts` -- Server Actions for user creation and user mutation audit behavior.
- `src/__tests__/user-actions.test.ts` -- focused Jest coverage for user create/update rollback behavior.
- `docs/DEVELOPMENT_LOG.md` -- implementation log and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/user-actions.ts` -- add explicit create-user cleanup helpers and wire them into `createUser` -- prevent orphan Auth/profile rows and unaudited successful creates.
- [x] `src/__tests__/user-actions.test.ts` -- add scripted tests for profile insert failure rollback, audit failure cleanup, and cleanup-failure reporting -- assert side effects directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- record scope, risk reduced, and verification commands -- preserve BMAD traceability.

**Acceptance Criteria:**
- Given `createUser` completes Auth/profile/audit successfully, when the action returns, then it returns profile data and a temporary password.
- Given profile insert fails after Auth create, when the action returns, then it calls Auth delete and returns an error.
- Given Auth rollback fails after profile insert failure, when the action returns, then the error includes both profile and Auth rollback failure context.
- Given audit fails after profile insert, when the action returns, then it deletes the profile row, deletes the Auth user, and does not revalidate settings.
- Given audit cleanup fails, when the action returns, then the error includes audit failure plus cleanup failure context.

## Design Notes

This is compensating-action hardening, not a true distributed transaction. Supabase Auth and `public.users` cannot be atomically committed together from this action, so the action must make each rollback attempt explicit and visible to callers/tests.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/user-actions.test.ts --runInBand` -- expected: user create/update rollback tests pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: existing security hardening suite remains green.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.
- `npx.cmd eslint src/services/user-actions.ts src/__tests__/user-actions.test.ts` -- expected: no new lint errors.

## Suggested Review Order

**Create Rollback Contract**

- Typed admin/insert contract removes loose create payload casts.
  [`user-actions.ts:11`](../../src/services/user-actions.ts#L11)

- Auth/profile rollback helpers expose cleanup failures explicitly.
  [`user-actions.ts:217`](../../src/services/user-actions.ts#L217)

- Create action keeps order but makes profile insert rollback visible.
  [`user-actions.ts:244`](../../src/services/user-actions.ts#L244)

- Audit failure now rolls back profile and Auth before returning.
  [`user-actions.ts:353`](../../src/services/user-actions.ts#L353)

**Side-Effect Coverage**

- Happy path asserts Auth, profile insert, audit, and revalidate.
  [`user-actions.test.ts:172`](../../src/__tests__/user-actions.test.ts#L172)

- Profile insert failure asserts Auth rollback and no audit/revalidate.
  [`user-actions.test.ts:221`](../../src/__tests__/user-actions.test.ts#L221)

- Audit rollback tests assert profile/Auth cleanup and failure reporting.
  [`user-actions.test.ts:248`](../../src/__tests__/user-actions.test.ts#L248)

**Traceability**

- Development log captures scope, exclusions, and verification commands.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
