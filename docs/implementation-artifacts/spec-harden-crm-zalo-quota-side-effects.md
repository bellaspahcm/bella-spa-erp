---
title: 'Harden CRM Zalo Quota Side Effects'
type: 'bugfix'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/implementation-artifacts/investigations/crm-zalo-sms-quota-flow-investigation.md'
---

# Harden CRM Zalo Quota Side Effects

## Intent

**Problem:** CRM birthday greetings and Zalo reminders checked SMS quota before sending, but incremented usage only after outbound/send-log/audit side effects. If the counter failed late, the system could report a failure after a real or simulated outbound had already happened.

**Approach:** Treat SMS usage as a reservation for an approved CRM outbound attempt: check entitlement, fetch required source/template data, increment the counter, then perform external send and required persistence side effects. Required DB failures now return explicit errors instead of warning and continuing.

## Suggested Review Order

1. `../../src/services/crm/campaigns.ts` -- birthday customer query fail-fast and birthday greeting quota reservation order.
2. `../../src/services/crm/zalo-messaging.ts` -- reminder quota reservation order, tenant template failure handling, and notification insert failure handling.
3. `../../src/__tests__/crm-zalo-quota.test.ts` -- regression coverage for counter reservation failures and side-effect ordering.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/crm-zalo-quota.test.ts src/__tests__/subscription.test.ts src/__tests__/subscription-actions.test.ts --runInBand` -- expected: all tests pass.
- `npm.cmd run lint -- src/services/crm/campaigns.ts src/services/crm/zalo-messaging.ts src/__tests__/crm-zalo-quota.test.ts` -- expected: no errors or warnings.
- `npx.cmd tsc --noEmit --pretty false` -- expected: no type errors.
