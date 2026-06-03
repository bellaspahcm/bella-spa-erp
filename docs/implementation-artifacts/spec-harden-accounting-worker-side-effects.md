---
title: 'Harden Accounting Worker Side Effects'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '99290bdb05c0b061ad9ec1fe8c53be55e4a18425'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The accounting worker is the downstream processor for money-facing outbox events. It already routes events and marks processing failures, but when `mark_outbox_failed` itself fails the worker only logs a critical error; the HTTP response does not expose which events are stuck or that retry/backoff state was not persisted.

**Approach:** Keep the worker claim/processing contract stable, but return structured per-event details for processed, failed, and mark-failed-critical events. Treat failure to persist an outbox failure state as a critical worker outcome so operators and tests can see exactly which event needs intervention.

## Boundaries & Constraints

**Always:** Preserve CRON auth behavior, request-scoped admin client env guard, `claim_outbox_batch` RPC use, existing event routing, sequential processing order, and success response for empty queues. Keep `mark_outbox_completed` required for successful events. Keep `mark_outbox_failed` required for failed event processing and surface its own failure explicitly.

**Ask First:** New database RPCs, schema changes, changing retry/backoff semantics inside SQL, changing batch size, parallel processing, or changing accounting event business mappings.

**Never:** Do not report a batch as clean success if any event failed processing or if a failed event could not be marked failed. Do not swallow handler errors, payload validation errors, mark-completed errors, or mark-failed errors. Do not skip later events merely because one event failed unless a global claim/admin failure occurs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Empty queue | `claim_outbox_batch` returns `[]` | Returns success with `processed: 0` | No event details required |
| All events complete | Handlers and `mark_outbox_completed` succeed | Returns `success: true`, status `success`, per-event completed details | No failed details |
| Handler/payload fails and mark failed succeeds | One event throws or validates invalid payload | Continues later events, returns `success: false`, status `partial_failure`, detail includes original error | `mark_outbox_failed` called with original error |
| Handler/payload fails and mark failed fails | Event fails, then `mark_outbox_failed` returns error | Continues later events, returns `success: false`, status `critical_failure`, detail includes original and mark-failed error | Count as failed and critical |
| Completion mark fails | Handler returns journal id but `mark_outbox_completed` fails | Event is marked failed with completion error and response detail names the completion failure | Do not count as success |

</frozen-after-approval>

## Code Map

- `src/app/api/cron/accounting-worker/route.ts` -- Cron route that claims accounting outbox events, routes each event to bookkeeping services, and marks outbox state.
- `src/__tests__/accounting-outbox.test.ts` -- Existing Jest coverage for worker auth, env guard, event routing, malformed payload failure, and failure marking.
- `src/services/revenue-recognition.ts` -- Bookkeeping handler service mocked by worker tests.
- `src/services/accounting-engine.ts` -- Manual journal handler service mocked by worker tests.
- `docs/implementation-artifacts/spec-harden-payment-webhook-worker-env-guards.md` -- Prior env guard context for this route.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/api/cron/accounting-worker/route.ts` -- add typed event result details for completed, failed, and critical mark-failed outcomes -- make worker response operationally inspectable.
- [x] `src/app/api/cron/accounting-worker/route.ts` -- include `criticalFailureCount` and set response status to `critical_failure` when mark-failed persistence fails -- distinguish ordinary processing failures from stuck outbox state.
- [x] `src/app/api/cron/accounting-worker/route.ts` -- preserve sequential processing after per-event failures -- keep batch progress while surfacing all event outcomes.
- [x] `src/__tests__/accounting-outbox.test.ts` -- add regression tests for mark-failed RPC failure, completion-mark failure, and mixed success/failure details -- assert RPC side effects directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- record the checkpoint and verification evidence.

**Acceptance Criteria:**
- Given an event handler throws and `mark_outbox_failed` succeeds, when the worker returns, then the response detail includes the event id, original error, and `failed` status.
- Given an event handler throws and `mark_outbox_failed` also fails, when the worker returns, then the response has status `critical_failure`, includes `criticalFailureCount`, and names both original and mark-failed errors.
- Given `mark_outbox_completed` fails after a handler returns a journal id, when the worker returns, then the event is not counted as success and `mark_outbox_failed` receives the completion error.
- Given a batch has one success and one failure, when the worker returns, then it continues processing both events and reports accurate per-event details.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/accounting-outbox.test.ts --runInBand` -- pass, 11/11 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/app/api/cron/accounting-worker/route.ts src/__tests__/accounting-outbox.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 66 suites / 742 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- BMad sub-agent review is not launched in this pass because current tool policy allows spawning sub-agents only when explicitly requested by the user. Local review focused on worker response contract, RPC side-effect ordering, and failure-state visibility.

## Suggested Review Order

**Worker Response Contract**

- Event result type defines completed, failed, and critical failed states.
  [`route.ts:12`](../../src/app/api/cron/accounting-worker/route.ts#L12)

- Batch counters and details are initialized before sequential processing.
  [`route.ts:155`](../../src/app/api/cron/accounting-worker/route.ts#L155)

- Successful events now contribute completed details with journal ids.
  [`route.ts:263`](../../src/app/api/cron/accounting-worker/route.ts#L263)

**Failure Visibility**

- Failed processing still calls `mark_outbox_failed` with original error.
  [`route.ts:294`](../../src/app/api/cron/accounting-worker/route.ts#L294)

- Mark-failed RPC failure becomes a critical event detail.
  [`route.ts:301`](../../src/app/api/cron/accounting-worker/route.ts#L301)

- Response status escalates to `critical_failure` when needed.
  [`route.ts:323`](../../src/app/api/cron/accounting-worker/route.ts#L323)

**Regression Coverage**

- Mark-failed RPC failure exposes both original and persistence errors.
  [`accounting-outbox.test.ts:375`](../../src/__tests__/accounting-outbox.test.ts#L375)

- Mark-completed failure is converted into failed outbox state.
  [`accounting-outbox.test.ts:426`](../../src/__tests__/accounting-outbox.test.ts#L426)

- Mixed batches continue and report per-event outcomes.
  [`accounting-outbox.test.ts:480`](../../src/__tests__/accounting-outbox.test.ts#L480)
