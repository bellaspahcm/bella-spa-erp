---
title: Harden Payment Webhook And Accounting Worker Env Guards
type: one-shot
created: 2026-06-03
status: done
route: one-shot
---

# Harden Payment Webhook And Accounting Worker Env Guards

## Intent

Problem: Local production build failed during page-data collection when `/api/webhooks/payment` created a Supabase client at module import time and required Supabase env values that may be absent on a developer machine.

Approach: Move payment webhook Supabase admin client creation into the authenticated request path, require server-side service-role credentials for real processing, and return an explicit 500 configuration error when env is missing. Add regression tests for payment webhook and accounting worker missing-env guards.

## Evidence

- `npm.cmd test -- src/__tests__/subscription.test.ts --runInBand` passed.
- `npm.cmd test -- src/__tests__/accounting-outbox.test.ts --runInBand` passed.
- `npx.cmd tsc --noEmit --incremental false` passed.
- `npm.cmd test -- --runInBand` passed: 65 suites / 708 tests.
- `npm.cmd run build` passed without injecting placeholder Supabase env values into the command.

## Suggested Review Order

1. `src/app/api/webhooks/payment/route.ts` - verify Supabase client creation is request-scoped and requires service-role credentials before DB side effects.
2. `src/__tests__/subscription.test.ts` - verify missing service env returns 500 after valid auth and does not call Supabase.
3. `src/__tests__/accounting-outbox.test.ts` - verify missing admin env returns 500 and does not claim outbox events.
