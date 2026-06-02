---
title: 'Type AI API route errors'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Type AI API route errors

## Intent

Problem: Small AI API routes still used `catch (error: any)`, weakening type safety in endpoints that authorize users and trigger AI/action side effects.

Approach: Replace loose catch bindings with `unknown`, derive details through a local helper, and preserve the existing HTTP 500 response paths and DB failure throws.

## Suggested Review Order

1. [`../../src/app/api/v1/ai/action-approval/route.ts`](../../src/app/api/v1/ai/action-approval/route.ts) - Verify notification/log insert errors still throw and return HTTP 500.
2. [`../../src/app/api/v1/ai/coo-orchestrator/route.ts`](../../src/app/api/v1/ai/coo-orchestrator/route.ts) - Verify orchestrator exceptions still return HTTP 500 with details.
3. [`spec-type-ai-api-route-errors.md`](spec-type-ai-api-route-errors.md) - Confirm artifact scope and verification.

## Review Notes

Adversarial review finding handled: `action-approval` writes both `app_notifications` and `ai_agent_logs`; those DB failures still throw and are not swallowed. The refactor only changes exception typing and message extraction.

Deferred: None.

Rejected: No behavior change needed in authorization or request validation for this narrow lint cleanup.

## Verification

- `npm.cmd run lint -- src/app/api/v1/ai/action-approval/route.ts src/app/api/v1/ai/coo-orchestrator/route.ts` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
