---
title: 'Harden Subscription Tab Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Subscription Tab Typing

## Intent

**Problem:** `SubscriptionTab` still used loose `any` state for subscription status, selected plan, pending invoice, and plan selection.

**Approach:** Type subscription UI state from the server action return shape and generated database schema, define explicit plan option types, replace unsafe usage math with helpers, and remove derived expiry state.

## Suggested Review Order

- [../../src/app/dashboard/settings/components/SubscriptionTab.tsx](../../src/app/dashboard/settings/components/SubscriptionTab.tsx) - verify typed state, invoice QR rendering, and initial load behavior.
- [../../src/services/subscription-actions.ts](../../src/services/subscription-actions.ts) - server action contracts consumed by the typed component.
- [../../src/__tests__/subscription-actions.test.ts](../../src/__tests__/subscription-actions.test.ts) - direct regression coverage for subscription invoice actions.

## Verification

- `npm.cmd run lint -- src/app/dashboard/settings/components/SubscriptionTab.tsx` - passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` - passed.
- `npm.cmd test -- src/__tests__/subscription-actions.test.ts --runInBand` - passed, 8 tests.

## Review Notes

- No server action or database mutation behavior changed.
- `pendingInvoice` now matches the generated `subscription_invoices.Row` returned after invoice creation.
- The initial load effect now avoids updating state after unmount.
