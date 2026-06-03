---
title: 'Harden Payment Webhook Side Effects'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'cb4e21c55ebca5c3ccee7ae021bfc50da2ce5c16'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The payment webhook is a money-facing automation that can update booking status, insert revenue, write audit logs, and enqueue accounting outbox events. The current booking-payment path already handles several DB failures, but if booking status is changed before revenue insertion fails, the booking can remain `booked` even though no revenue was recorded; rollback failures can also escape as generic route exceptions instead of transaction-level failure details.

**Approach:** Keep the webhook API contract stable, but make the BELLA booking-payment side effects compensation-safe. Track each completed side effect, rollback booking and revenue mutations when required downstream work fails, and return explicit per-transaction failure reasons including rollback failure details.

## Boundaries & Constraints

**Always:** Preserve authorization behavior, multi-provider transaction parsing, subscription renewal behavior, duplicate lookup fail-closed behavior, accounting period guard, and the top-level successful webhook response with per-transaction `details`. Use generated Supabase table types for booking/revenue/audit payloads. Treat booking update, revenue insert, audit insert, and accounting outbox enqueue as required side effects for booking payments.

**Ask First:** New database RPCs, schema changes, changing webhook provider payload formats, changing subscription renewal semantics, changing public response status for partial failures, or introducing async retry/outbox behavior for payment reconciliation.

**Never:** Do not report a BELLA booking transaction as successful if any required side effect fails. Do not leave a booking status changed without matching revenue/audit/outbox success. Do not swallow rollback failures or broaden booking lookup beyond the existing booking-number path.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Booking payment success | BELLA transaction, open period, booking starts as `deposit_pending` | Booking becomes `booked`, revenue/audit/outbox succeed, transaction detail is `success` | No rollback |
| Revenue insert fails after booking update | Booking status update succeeds, revenue insert fails | Transaction detail is `failed`, booking is restored to prior status | Include revenue failure and booking rollback failure if any |
| Audit insert fails after revenue insert | Booking update and revenue insert succeed, audit insert fails | Delete inserted revenue, restore booking if it was changed, transaction detail is `failed` | Include audit failure and rollback failure if any |
| Outbox enqueue fails after audit insert | Booking/revenue/audit succeed, outbox enqueue returns false | Delete inserted revenue, restore booking if it was changed, transaction detail is `failed` | Include outbox failure and rollback failure if any |
| Existing booking already booked | Booking status does not require mutation | Revenue/audit/outbox behavior remains unchanged | No booking rollback attempted unless booking was changed |

</frozen-after-approval>

## Code Map

- `src/app/api/webhooks/payment/route.ts` -- Next.js webhook route for subscription renewals and BELLA booking payment reconciliation.
- `src/__tests__/subscription.test.ts` -- Existing subscription and payment webhook Jest coverage, including duplicate lookup, closed period, audit rollback, and success path.
- `src/services/accounting/period-guards.ts` -- Accounting period guard used before booking payment mutations.
- `docs/implementation-artifacts/spec-harden-payment-webhook-typing.md` -- Previous payment webhook typing and duplicate lookup hardening context.
- `docs/implementation-artifacts/spec-harden-payment-webhook-worker-env-guards.md` -- Previous payment webhook env guard context.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/api/webhooks/payment/route.ts` -- add typed booking status rollback helper and transaction failure helper -- make failed booking-payment side effects explicit without changing webhook response contract.
- [x] `src/app/api/webhooks/payment/route.ts` -- rollback booking status when revenue insert fails after a booking status change -- prevent booked-without-revenue drift.
- [x] `src/app/api/webhooks/payment/route.ts` -- make audit/outbox rollback paths return failed transaction details even when rollback partially fails -- avoid generic top-level exceptions for transaction-scoped failures.
- [x] `src/__tests__/subscription.test.ts` -- add regression tests for revenue insert rollback, rollback failure details, outbox rollback, and no booking rollback for already-booked payments -- assert side-effect tables directly.
- [x] `docs/DEVELOPMENT_LOG.md` -- record the checkpoint and verification evidence.

**Acceptance Criteria:**
- Given a BELLA payment updates a `deposit_pending` booking and revenue insert fails, when the webhook returns, then the transaction is failed, the booking is restored, no audit/outbox is attempted, and rollback failure detail is visible if restore fails.
- Given audit logging fails after revenue insert, when the webhook returns, then the inserted revenue is deleted, the booking status is restored if changed, and rollback failures are included in the transaction failure reason.
- Given outbox enqueue fails after audit succeeds, when the webhook returns, then revenue and booking side effects are compensated and the transaction is not counted as processed.
- Given a booking is already `booked`, when a downstream side effect fails, then the webhook does not attempt to restore booking status because this transaction did not mutate it.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/subscription.test.ts --runInBand` -- pass, 29/29 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/app/api/webhooks/payment/route.ts src/__tests__/subscription.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 66 suites / 739 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- BMad sub-agent review is not launched in this pass because the current tool policy allows spawning sub-agents only when explicitly requested by the user. Local review focused on transaction failure ordering and rollback side-effect assertions.

## Suggested Review Order

**Webhook Compensation**

- Helper keeps rollback failures visible in transaction-level details.
  [`route.ts:104`](../../src/app/api/webhooks/payment/route.ts#L104)

- Booking rollback is scoped to status changes made by this transaction.
  [`route.ts:336`](../../src/app/api/webhooks/payment/route.ts#L336)

- Revenue insert failure now restores booking before returning failed detail.
  [`route.ts:411`](../../src/app/api/webhooks/payment/route.ts#L411)

- Audit and outbox failures use the same non-throwing compensation path.
  [`route.ts:420`](../../src/app/api/webhooks/payment/route.ts#L420)

**Regression Coverage**

- Revenue insert failure asserts booking restore and no audit/outbox.
  [`subscription.test.ts:977`](../../src/__tests__/subscription.test.ts#L977)

- Rollback failure detail remains visible to operators.
  [`subscription.test.ts:1050`](../../src/__tests__/subscription.test.ts#L1050)

- Outbox failure compensates revenue and booking side effects.
  [`subscription.test.ts:1118`](../../src/__tests__/subscription.test.ts#L1118)

- Already-booked payments do not get fake booking rollback.
  [`subscription.test.ts:1195`](../../src/__tests__/subscription.test.ts#L1195)
