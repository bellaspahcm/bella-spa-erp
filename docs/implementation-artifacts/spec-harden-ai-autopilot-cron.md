---
title: 'Harden AI autopilot cron typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden AI autopilot cron typing

## Intent

Problem: The AI autopilot cron used loose `any` for RPC rows and exception handlers, and ignored attendance/reconciliation RPC errors while continuing as if no anomalies existed.

Approach: Type RPC return rows from the generated Supabase `Database` functions, throw tenant-scoped errors when required RPCs fail, collect tenant errors into the cron response, and keep global failures as HTTP 500.

## Suggested Review Order

1. [`../../src/app/api/cron/ai-autopilot/route.ts`](../../src/app/api/cron/ai-autopilot/route.ts) - Verify RPC errors are visible, tenant failures are reported, and alert formatting remains unchanged.
2. [`spec-harden-ai-autopilot-cron.md`](spec-harden-ai-autopilot-cron.md) - Confirm artifact scope and verification.

## Review Notes

Adversarial review finding handled: previously `attErr` and `reconErr` were assigned but ignored, which could hide DB failures and produce a false-success cron result. The route now records per-tenant failures and returns `success: false` with `status: "partial_failure"` when any tenant fails.

Deferred: Telegram send failures are still logged without failing the tenant, preserving the existing behavior. A later hardening pass should decide whether Telegram delivery failure should also mark the cron as partial failure.

Rejected: Returning HTTP 500 for partial tenant failures was not applied in this narrow change to avoid forcing full cron retry after other tenants already processed; the response body is explicit.

## Verification

- `npm.cmd run lint -- src/app/api/cron/ai-autopilot/route.ts` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
