---
title: 'Harden portal chat action errors'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden portal chat action errors

## Intent

**Problem:** `portal-chat-actions.ts` still used `catch (err: any)`, which weakened server action error typing at the customer portal chat boundary.

**Approach:** Add a local `unknown` error normalizer and route each action failure through it while preserving existing `{ success: false, error }` behavior and database error propagation.

## Suggested Review Order

**Error Normalization**

- Start with the helper that removes loose catch typing.
  [`portal-chat-actions.ts:6`](../../src/services/portal-chat-actions.ts#L6)

**Action Boundaries**

- Message fetch keeps the same failure contract without `any`.
  [`portal-chat-actions.ts:79`](../../src/services/portal-chat-actions.ts#L79)

- Message send keeps typed insert payload behavior unchanged.
  [`portal-chat-actions.ts:123`](../../src/services/portal-chat-actions.ts#L123)

- Read-state update now follows the same typed error path.
  [`portal-chat-actions.ts:155`](../../src/services/portal-chat-actions.ts#L155)

## Verification

**Commands:**
- `npm.cmd run lint -- src/services/portal-chat-actions.ts` -- passed.
- `npm.cmd test -- src/__tests__/portal-chat.test.ts --runInBand` -- passed, 10 tests.
- `npx.cmd tsc --noEmit --pretty false` -- passed.

## Review Notes

- BMAD subagent review was not used because the available subagent tool requires an explicit user request for delegation.
- Local adversarial review applied one patch: whitespace-only error messages now fall back instead of being returned as empty-looking errors.
