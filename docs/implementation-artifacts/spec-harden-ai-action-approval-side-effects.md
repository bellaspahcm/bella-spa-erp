---
title: 'Harden AI Action Approval Side Effects'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '9f26ff342d963808c1a76788a28f3ca411bea1c9'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** AI action approval creates a notification and then writes an AI audit log. If the notification succeeds but audit log fails, the system may emit an approved action without complete audit history.

**Approach:** Keep the route contract stable for successful approvals, but make side effects explicit and compensating: notification failure returns 500; audit log failure rolls back the created notification before returning 500. Invalid draft payloads must return 400 before any side effect.

## Boundaries & Constraints

**Always:** Required DB failures must be returned as explicit failures. Notification and audit payloads must use generated Supabase table types. Audit failure after notification creation must attempt to delete the notification and report rollback failure if deletion fails.

**Ask First:** New database schema, new notification delivery channels, async outbox migration, action type whitelist changes, or changing the success response shape.

**Never:** Do not swallow notification, audit, or rollback errors. Do not create notification/audit side effects for invalid draft action payloads.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Success | Valid approval payload | Notification created, AI audit log inserted, 200 with notificationId | No error |
| Invalid payload | Missing type/recipient/reason/draftMessage | 400 | No DB side effects after user lookup |
| Notification insert fails | app_notifications insert/select/single returns error | 500 | Details include notification failure |
| Audit log insert fails | Notification succeeds, ai_agent_logs insert fails | Notification is deleted, 500 | Details include audit failure and rollback failure if any |

</frozen-after-approval>

## Code Map

- `src/app/api/v1/ai/action-approval/route.ts` -- API route that authorizes approval, creates notification, and writes audit log.
- `src/__tests__/ai-agent.test.ts` -- Existing AI route tests for orchestrator and action approval.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/api/v1/ai/action-approval/route.ts` -- add strict DB payload typing, full payload validation, and notification rollback on audit failure.
- [x] `src/__tests__/ai-agent.test.ts` -- add notification failure, audit rollback, rollback failure, and invalid payload tests.
- [x] `docs/DEVELOPMENT_LOG.md` -- append verification entry after checks pass.

**Acceptance Criteria:**
- Given notification creation succeeds and audit log insert fails, when the route returns, then notification deletion is attempted and the response is 500.
- Given notification deletion also fails, when the route returns, then response details include both audit and rollback errors.
- Given draft approval payload is invalid, when the route handles it, then response is 400 and no notification/audit side effects are attempted.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/ai-agent.test.ts --runInBand` -- pass, 15/15 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/app/api/v1/ai/action-approval/route.ts src/__tests__/ai-agent.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 66 suites / 729 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- Route payload typing now uses generated Supabase table insert types for `app_notifications` and `ai_agent_logs`.
- Invalid approval payloads now fail before notification/audit side effects are attempted.
- Audit log failure now attempts a compensating delete of the just-created notification, and the API reports rollback failure details if that delete also fails.

## Suggested Review Order

1. `src/app/api/v1/ai/action-approval/route.ts:5` -- generated DB insert type aliases.
2. `src/app/api/v1/ai/action-approval/route.ts:66` -- full approval payload validation including `reason`.
3. `src/app/api/v1/ai/action-approval/route.ts:73` -- typed notification insert payload.
4. `src/app/api/v1/ai/action-approval/route.ts:98` -- typed audit log insert payload.
5. `src/app/api/v1/ai/action-approval/route.ts:117` -- notification rollback path on audit failure.
6. `src/__tests__/ai-agent.test.ts:421` -- invalid payload no-side-effect regression.
7. `src/__tests__/ai-agent.test.ts:444` -- notification insert failure regression.
8. `src/__tests__/ai-agent.test.ts:490` -- audit failure rollback regression.
9. `src/__tests__/ai-agent.test.ts:543` -- rollback failure detail regression.
