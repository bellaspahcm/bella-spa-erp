---
title: Fix Full Jest Accounting And Webhook Mocks
type: implementation
created: 2026-06-04
status: done
route: one-shot
---

# Fix Full Jest Accounting And Webhook Mocks

## Intent
**Problem**: Full Jest was blocked by stale test mocks after accounting outbox and payment webhook duplicate lookup hardening. `idempotency.test.ts` attempted real outbox enqueue behavior, and `subscription.test.ts` did not model Supabase `.contains()` for `accounting_metadata`.

**Approach**: Keep production code unchanged. Update test mocks to explicitly mock `enqueueWithAutoClient`, add `.contains()` to webhook query chains, and update assertions to expect propagated DB detail in failure messages.

## Suggested Review Order
1. `../../../src/__tests__/idempotency.test.ts` - accounting outbox mock for duplicate booking flow.
2. `../../../src/__tests__/subscription.test.ts` - webhook Supabase chain `.contains()` and stricter error-detail assertions.
3. `spec-accounting-health-preflight.md` - verification status now records full Jest pass.
