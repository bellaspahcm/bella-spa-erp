---
title: 'Harden CRM stats read failures'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '83177feea822e1a46f982242900c0c585b51788b'
context:
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-tenant-settings-read-failures.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** CRM dashboard stats and upcoming reminder reads currently log database errors and return zeroes or empty arrays. Operators can misread an RLS/DB failure as "no reminders, no birthdays, no upcoming sessions".

**Approach:** Keep the no-tenant case as a valid empty state, but make real database errors in `getCRMStats` and `getUpcomingSessions` throw explicit errors. The CRM page hook already catches load failures and surfaces `loadError`, so the service should not hide them.

## Boundaries & Constraints

**Always:** Preserve the exported function names and normal return shapes. Keep `getCRMStats` returning a `CRMStats` object on success and `getUpcomingSessions` returning a session array on success. Preserve no-tenant fallback behavior. Use explicit error messages naming the failed CRM query.

**Ask First:** Changing CRM UI layout, changing Zalo quota behavior, changing customer birthday rules, or broadening into campaign send actions.

**Never:** Do not log a Supabase read error and continue with zero counts or `[]`. Do not treat a failed birthday query as "no birthdays". Do not create new repository abstractions for this narrow hardening slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No tenant | Current user has no `tenant_id` | Stats returns zero snapshot; upcoming sessions returns `[]` | No DB query required after user lookup |
| Stats success | Reminder counts and birthday query succeed | Return actual counts | No error |
| Reminder count failure | First `session_logs` count errors | Reject with `getCRMStats` reminder-count error | CRM hook catches and shows load error |
| Pending count failure | Scheduled reminder count errors | Reject with `getCRMStats` pending-count error | No silent zero |
| Birthday query failure | Customer DOB query errors | Reject with `getCRMStats` birthday-query error | No silent zero |
| Upcoming query failure | Upcoming `session_logs` query errors | Reject with `getUpcomingSessions` error | No silent `[]` |

</frozen-after-approval>

## Code Map

- `src/services/crm/stats.ts` -- CRM stats and upcoming session server actions to harden.
- `src/app/dashboard/crm/hooks/useCrmPageData.ts` -- caller already catches service failures and sets `loadError`.
- `src/__tests__/crm-stats.test.ts` -- new focused Jest coverage for CRM read failure behavior.
- `docs/DEVELOPMENT_LOG.md` -- implementation handoff log.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/crm/stats.ts` -- replace silent CRM read fallbacks with explicit thrown errors while preserving no-tenant empty state.
- [x] `src/__tests__/crm-stats.test.ts` -- cover success and failure scenarios for stats/upcoming reads.
- [x] `docs/DEVELOPMENT_LOG.md` -- append dated implementation and verification evidence.
- [x] `docs/implementation-artifacts/spec-harden-crm-stats-read-failures.md` -- mark completed after verification.

**Acceptance Criteria:**
- Given a CRM stats query fails, when `getCRMStats` runs, then it rejects instead of returning zeroes.
- Given the upcoming sessions query fails, when `getUpcomingSessions` runs, then it rejects instead of returning `[]`.
- Given no `tenant_id`, when either CRM read runs, then it preserves the current empty-state response.
- Given CRM reads succeed, when the functions run, then they return the same successful shape as before.

## Spec Change Log

## Design Notes

The CRM page already centralizes error presentation in `useCrmPageData`. This slice deliberately moves responsibility back to the service layer: data functions signal failure; UI functions decide how to display it.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/crm-stats.test.ts --runInBand` -- expected: focused CRM stats tests pass.
- `npx.cmd tsc --noEmit --incremental false` -- expected: no TypeScript errors.
- `npx.cmd eslint src/services/crm/stats.ts src/__tests__/crm-stats.test.ts` -- expected: no ESLint errors.
- `npm.cmd test -- --runInBand` -- expected: full Jest suite passes.
- `npm.cmd run build` -- expected: production build succeeds.
