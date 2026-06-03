---
title: 'Harden onboarding audit and auth cleanup'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
context:
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `registerNewTenant` can create a real tenant/admin user and still return success if onboarding audit logging fails, because the audit error is only logged as a warning. When database onboarding fails after Auth user creation, the action also only logs the created Auth user instead of attempting service-role cleanup and reporting cleanup failure details.

**Approach:** Treat onboarding audit as a required side effect: if audit fails, return explicit failure and do not revalidate success paths. Add service-role Auth cleanup after `onboard_tenant` RPC failure when the user was created through the admin client, and include cleanup failures in the returned error.

## Boundaries & Constraints

**Always:** Keep `onboard_tenant` as the single database onboarding RPC. Preserve current owned/franchise branch behavior. Do not revalidate dashboard caches after any failed required side effect. Return explicit failure text for DB, audit, and cleanup failures.

**Ask First:** Adding a new database transaction/RPC, deleting tenants created by `onboard_tenant`, changing seed data, changing subscription/quota defaults, or changing public UI forms.

**Never:** Do not swallow audit failures. Do not claim onboarding success when the audit log was not written. Do not attempt tenant deletion cleanup in this slice, because the RPC creates tenant, admin, sample package, sample KTV, customer, booking, chart of accounts, and accounting period side effects.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Owned branch success | Auth create succeeds, `onboard_tenant` succeeds, audit succeeds | Return success with tenant/user/email; no franchise update | No error |
| Franchise update fails | RPC succeeds, franchise update fails | Return failure; no audit or revalidate | Include franchise update DB message |
| Onboarding RPC fails after admin Auth create | Auth admin create succeeds, RPC returns error | Attempt `auth.admin.deleteUser(authUser.id)` and return failure | Include cleanup failure if delete fails |
| Audit fails after tenant create | RPC and optional franchise update succeed, `recordAuditLog` throws | Return failure and do not revalidate | Include tenantId/userId in response data for manual investigation |

</frozen-after-approval>

## Code Map

- `src/services/onboarding-actions.ts` -- server action for tenant registration, Auth user creation, `onboard_tenant`, franchise update, audit, and revalidation.
- `src/__tests__/onboarding.test.ts` -- focused tests for owned/franchise onboarding and failure propagation.
- `src/services/audit-actions.ts` -- context only: `recordAuditLog` throws on missing tenant/user or insert failure.
- `supabase/migrations/20260526060000_add_hr_role.sql` -- context only: current `onboard_tenant` creates multiple seeded rows, so tenant deletion is out of scope.
- `docs/DEVELOPMENT_LOG.md` -- append implementation evidence and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/onboarding-actions.ts` -- keep a service-role admin client reference and rollback the created Auth user when `onboard_tenant` fails.
- [x] `src/services/onboarding-actions.ts` -- make onboarding audit failure return explicit failure before cache revalidation.
- [x] `src/__tests__/onboarding.test.ts` -- add side-effect tests for audit success, audit failure, Auth cleanup success, and Auth cleanup failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- add dated evidence for future agent handoff.

**Acceptance Criteria:**
- Given audit logging throws after tenant creation, when `registerNewTenant` runs, then the action returns failure, includes audit error detail, and does not call `safeRevalidatePath`.
- Given `onboard_tenant` fails after admin Auth user creation, when cleanup succeeds, then `auth.admin.deleteUser` is called and the returned error contains the RPC failure.
- Given `onboard_tenant` fails after admin Auth user creation and cleanup fails, when the action returns, then the error includes both the RPC failure and cleanup failure.
- Given onboarding succeeds, when the action returns success, then audit logging was called before cache revalidation.

## Spec Change Log

## Design Notes

The existing `onboard_tenant` function is not a narrow tenant insert. It creates the tenant, admin user, sample service package, sample KTV, sample customer, sample booking, chart of accounts, and accounting period. Deleting the tenant from the application layer after an audit failure would require confirmed cascade semantics or a dedicated rollback RPC; that is intentionally outside this slice.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/onboarding.test.ts --runInBand` -- expected: onboarding tests pass.
- `npx.cmd tsc --noEmit --incremental false` -- expected: no TypeScript errors.
- `npx.cmd eslint src/services/onboarding-actions.ts src/__tests__/onboarding.test.ts` -- expected: no ESLint errors.
- `npm.cmd test -- --runInBand` -- expected: full Jest suite passes.
- `npm.cmd run build` -- expected: production build succeeds.
