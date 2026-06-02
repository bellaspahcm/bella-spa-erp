---
title: 'Harden Payment Webhook Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Payment Webhook Typing

## Intent

**Problem:** Payment webhook route van dung `any` khi parse payload tu SePay, PayOS, Casso va khi bat loi route, dong thoi duplicate revenue lookup dang bo qua DB error.

**Approach:** Doi parser sang `unknown` + record guards, type ket qua xu ly transaction, bat loi bang `unknown`, va fail transaction ro rang neu duplicate lookup loi truoc khi update booking/insert revenue.

## Suggested Review Order

- [../../src/app/api/webhooks/payment/route.ts](../../src/app/api/webhooks/payment/route.ts) -- Kiem tra parser multi-provider, duplicate lookup fail path, va response contract duoc giu nguyen.
- [../../src/__tests__/subscription.test.ts](../../src/__tests__/subscription.test.ts) -- Kiem tra regression duplicate lookup loi khong update booking, khong insert revenue, khong enqueue outbox.

## Code Map

- `src/app/api/webhooks/payment/route.ts` -- Next route handler xu ly webhook thanh toan, subscription renewal, booking revenue, audit log, accounting outbox.
- `src/__tests__/subscription.test.ts` -- Jest coverage cho subscription quota va payment webhook reconciler.

## Review Notes

- Patch applied: duplicate revenue lookup error now records a failed transaction result and stops before side effects.
- Patch applied: route-level `any` warnings were removed from payment webhook parser and catch block.
- Deferred: top-level webhook response still returns `success: true` with per-transaction failed details; changing that is a public response contract decision and should be handled separately.
- Sub-agent review note: sub-agent tooling in this session is policy-gated unless explicitly requested by the user, so review was performed locally using the adversarial checklist.

## Verification

**Commands:**
- `npm.cmd run lint -- src/app/api/webhooks/payment/route.ts` -- passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` -- passed.
- `npm.cmd test -- src/__tests__/subscription.test.ts --runInBand` -- passed, 24 tests.
