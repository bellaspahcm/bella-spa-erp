---
title: 'Type Telegram webhook payloads'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Type Telegram webhook payloads

## Intent

Problem: The Telegram AI webhook still used loose `any` for COO anomaly rendering and exception handling in a route that parses external webhook payloads and sends Telegram replies.

Approach: Add a narrow Telegram payload shape, normalize anomaly values from `unknown`, format anomaly lines without `any`, and replace the catch binding with `unknown` while preserving the route's deliberate HTTP 200 error response to avoid Telegram retry loops.

## Suggested Review Order

1. [`../../src/app/api/v1/ai/telegram-webhook/route.ts`](../../src/app/api/v1/ai/telegram-webhook/route.ts) - Verify payload parsing, anomaly formatting, DB failure throws, and Telegram retry behavior.
2. [`spec-type-telegram-webhook.md`](spec-type-telegram-webhook.md) - Confirm artifact scope and verification.

## Review Notes

Adversarial review finding handled: COO anomalies can arrive as strings or object-like values, so the formatter now supports both instead of assuming every item has `name`, `gpsAnomaly`, `late`, and `deductions`.

Deferred: None.

Rejected: Changing the final catch to HTTP 500 was rejected for this route because the existing comment explicitly avoids Telegram retry loops; the response remains status 200 with `{ ok: false }`.

## Verification

- `npm.cmd run lint -- src/app/api/v1/ai/telegram-webhook/route.ts` passed.
- `npx.cmd tsc --noEmit --pretty false` passed.
