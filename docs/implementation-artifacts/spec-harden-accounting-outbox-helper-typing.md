---
title: 'Harden Accounting Outbox Helper Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Accounting Outbox Helper Typing

## Intent

**Problem:** `src/lib/accounting-outbox.ts` van dung generic RPC client voi `any`, trong khi day la helper trung tam de enqueue but toan tu booking, finance, inventory, salary va webhook payment.

**Approach:** Thay `any` bang `RpcCapableClient` va adapter typed rieng cho RPC `enqueue_accounting_event` dua tren generated `Database` function args, giu contract hien tai la log loi va tra `false` khi enqueue that bai.

## Suggested Review Order

- [../../src/lib/accounting-outbox.ts](../../src/lib/accounting-outbox.ts) -- Kiem tra `RpcCapableClient`, RPC args generated type, va contract boolean cua enqueue helper.
- [../../src/__tests__/accounting-outbox-helper.test.ts](../../src/__tests__/accounting-outbox-helper.test.ts) -- Kiem tra success, RPC error, va exception path cua helper.

## Code Map

- `src/lib/accounting-outbox.ts` -- Helper trung tam cho transactional accounting outbox producers.
- `src/__tests__/accounting-outbox-helper.test.ts` -- Unit test truc tiep cho `enqueueAccountingEvent`.

## Review Notes

- Patch applied: `RpcCapableClient` duoc siết thanh function type thay vi `unknown` de tranh chap nhan object co `rpc` khong phai function.
- Deferred: cac mock test khac van co `any` o file rieng; khong thuoc phạm vi helper production.
- Rejected: none.
- Sub-agent review note: sub-agent tooling in this session is policy-gated unless explicitly requested by the user, so review was performed locally using the adversarial checklist.

## Verification

**Commands:**
- `npm.cmd run lint -- src/lib/accounting-outbox.ts src/__tests__/accounting-outbox-helper.test.ts` -- passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` -- passed.
- `npm.cmd test -- src/__tests__/accounting-outbox-helper.test.ts --runInBand` -- passed, 3 tests.
