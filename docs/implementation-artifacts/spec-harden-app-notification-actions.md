---
title: 'Harden app notification actions'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'b3a1a46571aecb3f60b7ffc797099dee6948cf9c'
context:
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-crm-zalo-token-refresh-failures.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** App notification actions can hide profile/notification read failures behind empty arrays, and `markNotificationAsRead` updates by notification id without tenant scoping. The current dashboard caller also ignores returned mutation failures, so a failed mark-as-read can look successful in the UI.

**Approach:** Resolve the current user's tenant through a shared helper with explicit DB error handling. Scope notification updates by `tenant_id`, fail when a single notification cannot be updated, and update the current `app_notifications` caller to check mutation results before continuing.

## Boundaries & Constraints

**Always:** Keep exported action names stable. Use generated `Database['public']['Tables']['app_notifications']` payload typing for updates. Return explicit failure objects for unauthorized, profile errors, missing tenant, notification read errors, and update errors. Preserve empty notification lists only when the query succeeds with no rows.

**Ask First:** Changing notification schema, adding per-user notification ownership, changing dashboard alert aggregation, hardening the KTV legacy `Notification` table flow, or replacing app notifications with the legacy `Notification` table.

**Never:** Do not return `data: []` for DB failures. Do not mark an `app_notifications` row read without tenant scoping. Do not let the dashboard app-notification caller treat the action as successful when it returned failure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unauthorized | No auth user | Return explicit unauthorized failure | No DB update |
| Profile query failure | `users` tenant lookup errors | Return explicit profile failure | No silent empty |
| No tenant | Profile has no `tenant_id` | Return explicit missing-tenant failure | No notification query/update |
| Unread query success | Notifications query succeeds | Return rows or `[]` | No error |
| Unread query failure | Notifications query errors | Return explicit failure and `data: []` | Caller can inspect error |
| Mark one success | Notification id belongs to tenant | Update scoped by id + tenant and return success | Revalidate dashboards |
| Mark one not found/failure | Update errors or returns no row | Return explicit failure | Caller keeps UI state unchanged |
| Mark all success | Tenant unread notifications update succeeds | Return success | Revalidate dashboards |

</frozen-after-approval>

## Code Map

- `src/services/notification-actions.ts` -- app notification server actions to harden.
- `src/app/dashboard/page.tsx` -- dashboard notification click caller currently ignores mutation result.
- `src/app/ktv/dashboard/page.tsx` -- not changed in this slice; it uses the legacy `Notification` table through `ktv-actions`.
- `src/__tests__/notification-actions.test.ts` -- new focused tests for auth/profile/read/update behavior.
- `docs/DEVELOPMENT_LOG.md` -- implementation handoff log.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/notification-actions.ts` -- add tenant resolution helper, explicit failures, typed update payloads, and tenant-scoped mark-as-read.
- [x] `src/app/dashboard/page.tsx` -- check mark-as-read result before navigation/local assumptions.
- [x] `src/__tests__/notification-actions.test.ts` -- cover unauthorized, profile failure, read failure/success, scoped mark one success/failure, mark all success/failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- append dated implementation and verification evidence.
- [x] `docs/implementation-artifacts/spec-harden-app-notification-actions.md` -- mark completed after verification.

**Acceptance Criteria:**
- Given a profile or notification read query fails, when unread notifications are loaded, then the action returns an explicit failure instead of silently hiding data.
- Given a notification id from another tenant, when mark-as-read runs under the current tenant, then it fails instead of updating unscoped.
- Given mark-as-read fails, when the dashboard app-notification caller receives the result, then it does not treat it as success.

## Spec Change Log

- 2026-06-03: Completed implementation and verification. Kept KTV legacy `Notification` flow out of scope because it uses `src/services/ktv-actions.ts`, not `app_notifications`.

## Design Notes

Single-notification update uses `id + tenant_id` and requests the updated `id` back. No returned row is treated as a not-found/scope failure. Mark-all remains allowed to update zero rows because "no unread notifications" is a valid successful state.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/notification-actions.test.ts --runInBand` -- pass, 9/9 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/notification-actions.ts src/__tests__/notification-actions.test.ts src/app/dashboard/page.tsx` -- pass with existing warnings in `src/app/dashboard/page.tsx`.
- `npm.cmd test -- --runInBand` -- pass, 71 suites / 793 tests.
- `npm.cmd run build` -- pass.
