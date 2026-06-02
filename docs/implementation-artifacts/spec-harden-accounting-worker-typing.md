---
title: 'Harden Accounting Worker Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Accounting Worker Typing

## Intent

**Problem:** Cron accounting worker van con cac diem dung `any` khi doc outbox RPC/payload va khi goi `mark_outbox_completed` voi journal entry rong, lam yeu type safety o duong xu ly but toan tu dong.

**Approach:** Chuyen batch sang type tu generated `Database`, parse `Json` payload qua helper fail-closed, bo `catch any`, va giu hanh vi retry/backoff bang cach mark event loi qua `mark_outbox_failed`.

## Suggested Review Order

- [../../src/app/api/cron/accounting-worker/route.ts](../../src/app/api/cron/accounting-worker/route.ts) -- Kiem tra parser payload fail-closed, typing RPC, va response `partial_failure`.
- [../../src/__tests__/accounting-outbox.test.ts](../../src/__tests__/accounting-outbox.test.ts) -- Kiem tra regression malformed payload khong goi recognition service va duoc mark failed.

## Code Map

- `src/app/api/cron/accounting-worker/route.ts` -- Next route handler cho cron worker claim/process accounting outbox events.
- `src/__tests__/accounting-outbox.test.ts` -- Jest coverage cho auth guard, dynamic routing, completion, failure backoff, va malformed payload.

## Review Notes

- Patch applied: payload helpers ban dau default missing numbers/strings thanh `0`/`''`; da doi sang required/optional readers de event sai shape bi fail ro rang.
- Deferred: none.
- Rejected: none.
- Sub-agent review note: sub-agent tooling in this session is policy-gated unless explicitly requested by the user, so review was performed locally using the adversarial checklist.

## Verification

**Commands:**
- `npm.cmd run lint -- src/app/api/cron/accounting-worker/route.ts src/__tests__/accounting-outbox.test.ts` -- passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` -- passed.
- `npm.cmd test -- src/__tests__/accounting-outbox.test.ts --runInBand` -- passed, 7 tests.
