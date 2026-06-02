---
title: 'Harden HQ Billing Tab Errors'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden HQ Billing Tab Errors

## Intent

**Problem:** `HqBillingTab` still used `catch (err: any)` for invoice loading and sandbox payment errors.

**Approach:** Handle caught errors as `unknown`, centralize message extraction in a local helper, remove an unused icon import, and make the initial invoice load effect cancellation-aware.

## Suggested Review Order

- [../../src/app/dashboard/settings/components/HqBillingTab.tsx](../../src/app/dashboard/settings/components/HqBillingTab.tsx) - verify typed error handling and initial load behavior.

## Verification

- `npm.cmd run lint -- src/app/dashboard/settings/components/HqBillingTab.tsx` - passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` - passed.

## Review Notes

- No server action or database behavior changed.
- Toast messages preserve the previous Vietnamese prefixes while safely handling non-`Error` throws.
- The refresh button and post-payment reload still use `loadInvoices`.
