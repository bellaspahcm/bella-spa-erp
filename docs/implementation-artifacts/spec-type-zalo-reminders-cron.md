---
title: 'Type Zalo reminders cron handler'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Type Zalo reminders cron handler

## Intent

Problem: The Zalo reminders cron route still used `catch (error: any)`, weakening type safety around an operational side-effect endpoint.

Approach: Keep the existing authorization, batch trigger, and explicit failure responses unchanged; replace the loose catch binding with `unknown` and a small exception message helper.

## Suggested Review Order

1. [`../../src/app/api/cron/zalo-reminders/route.ts`](../../src/app/api/cron/zalo-reminders/route.ts) - Verify the cron route still returns HTTP 500 for batch errors and exceptions.
2. [`../../src/services/crm/zalo-messaging.ts`](../../src/services/crm/zalo-messaging.ts) - Context only: `triggerBatchReminders` already returns explicit error objects for DB/API failures.
3. [`spec-type-zalo-reminders-cron.md`](spec-type-zalo-reminders-cron.md) - Confirm artifact scope and verification.

## Review Notes

Adversarial review finding handled: because this endpoint triggers reminders, the refactor must not convert operational failures into success responses. The existing `result.error` HTTP 500 path remains unchanged, and exceptions still return `{ success: false }` with status 500.

Deferred: None.

Rejected: No behavior change needed in the batch service for this narrow lint cleanup.

## Verification

- `npm.cmd run lint -- src/app/api/cron/zalo-reminders/route.ts` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
