---
title: 'Optimize Zalo Batch Reminder Quota'
type: 'bugfix'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-crm-zalo-quota-side-effects.md'
---

# Optimize Zalo Batch Reminder Quota

## Intent

**Problem:** `triggerBatchReminders` processed due reminders one by one without a batch-level view of remaining SMS quota. When quota was nearly exhausted, operators could see partial sends as generic per-session errors rather than a clear quota skip report.

**Approach:** Before sending due sessions for each tenant, read the SMS quota snapshot, compute remaining capacity, and skip excess due reminders with `skipped` and `quotaSkipped` details while preserving the existing `count`, `messages`, `errors`, and `info` response shape.

## Suggested Review Order

1. `../../src/services/crm/zalo-messaging.ts` -- tenant-level due-session filtering, SMS remaining calculation, and quota skip reporting.
2. `../../src/__tests__/crm-zalo-quota.test.ts` -- batch regression for one remaining quota slot across two due reminders.
3. `../../src/app/dashboard/crm/page.tsx` -- manual scan alert includes quota-skipped reminders without breaking existing success messaging.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/crm-zalo-quota.test.ts src/__tests__/subscription.test.ts src/__tests__/subscription-actions.test.ts --runInBand` -- expected: all tests pass.
- `npm.cmd run lint -- src/services/crm/zalo-messaging.ts src/__tests__/crm-zalo-quota.test.ts` -- expected: no errors or warnings.
- `npx.cmd tsc --noEmit --pretty false` -- expected: no type errors.
