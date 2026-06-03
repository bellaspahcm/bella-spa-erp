---
title: 'Harden Payment Webhook Idempotency'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'd34e3ede01e2edcb4ba3d5f4647d29d4bb82322d'
context:
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/AI_AGENT_ONBOARDING.md'
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/KNOWLEDGE_STORAGE_PROCESS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Payment webhook duplicate detection currently relies on `revenue.notes LIKE transactionId`. That is weak for idempotency and does not repair side effects if a previous attempt inserted revenue but failed audit/outbox and rollback did not fully succeed.

**Approach:** Store a stable webhook transaction id in `revenue.accounting_metadata`, query it before inserting, add a partial unique index for VietQR webhook transaction ids, and make duplicate retries explicitly ensure expected audit/outbox side effects instead of silently skipping.

## Boundaries & Constraints

**Always:** Preserve webhook authentication, booking-number parsing, subscription RPC behavior, accounting-period guard for new payments, and rollback behavior for fresh insert failures.

**Ask First:** If production already has duplicate non-empty webhook transaction ids in revenue metadata, stop before installing the unique index.

**Never:** Do not change payment provider formats, subscription invoice renewal semantics, booking-number regex semantics, or finance report recognition rules in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
|----------|---------------|-------------------|----------------|
| New booking payment | Valid BELLA transaction, no existing revenue metadata id | Insert confirmed revenue with `webhook_transaction_id`, audit log, outbox | Any side-effect failure rolls back fresh revenue/status as before |
| Duplicate retry, complete previous attempt | Existing revenue with matching metadata id and side effects present | Do not insert another revenue; return skipped/already processed | No new revenue side effect |
| Duplicate retry, missing side effect | Existing revenue with matching metadata id but audit/outbox missing | Ensure audit/outbox idempotently | If ensure fails, return failed explicitly |
| Concurrent duplicate insert | Existing check misses but DB unique index rejects insert | Re-query existing revenue, ensure side effects, do not return a blind failure | If re-query/ensure fails, return failed explicitly |

</frozen-after-approval>

## Code Map

- `src/app/api/webhooks/payment/route.ts` -- Add metadata idempotency, side-effect repair, and unique-violation recovery.
- `src/__tests__/payment-webhook.test.ts` -- Add focused webhook idempotency tests with side-effect assertions.
- `supabase/migrations/20260603060000_unique_payment_webhook_transaction.sql` -- Add duplicate audit and partial unique index.
- `docs/DEVELOPMENT_LOG.md` -- Record implementation and verification.

## Tasks & Acceptance

**Execution:**
- [x] `route.ts` -- Store `webhook_transaction_id` and provider metadata in revenue accounting metadata.
- [x] `route.ts` -- Query existing webhook revenue by metadata id before inserting, with legacy notes fallback.
- [x] `route.ts` -- On duplicate, ensure audit log and accounting outbox side effects instead of silently skipping.
- [x] `route.ts` -- Recover from unique-index race by re-querying and ensuring side effects.
- [x] `20260603060000_unique_payment_webhook_transaction.sql` -- Add duplicate audit and partial unique index.
- [x] `payment-webhook.test.ts` -- Cover new insert, duplicate repair, and side-effect failure propagation.
- [x] `DEVELOPMENT_LOG.md` -- Add concise handoff entry.

**Acceptance Criteria:**
- Given the same bank transaction id is delivered twice, when the first attempt already created revenue, then the second attempt must not insert another revenue row.
- Given an existing webhook revenue is found, when audit/outbox side effects are missing, then the webhook must attempt to restore them and fail explicitly if restoration fails.
- Given two webhook requests race, when the DB unique index rejects the second insert, then the route must re-query the existing revenue and complete idempotently.
- Given existing production duplicate webhook metadata ids exist, when the migration runs, then it must fail explicitly before installing uniqueness.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/payment-webhook.test.ts --runInBand` -- pass, 1 suite / 4 tests.
- `npm.cmd run build` -- pass.
- Supabase duplicate audit query -- pass, 0 duplicate webhook transaction metadata ids.
- `npx.cmd supabase db push --linked --dry-run` -- pass, only `20260603060000_unique_payment_webhook_transaction.sql`.
- `npx.cmd supabase db push --linked --yes` -- pass, migration applied.
- Supabase verification query -- pass, migration version `20260603060000` and `idx_revenue_vietqr_webhook_transaction_unique` exist.

## Suggested Review Order

**Webhook Idempotency**

- Metadata payload creates a stable transaction key.
  [`route.ts:121`](../../src/app/api/webhooks/payment/route.ts#L121)

- Duplicate lookup prefers metadata and keeps legacy notes fallback.
  [`route.ts:142`](../../src/app/api/webhooks/payment/route.ts#L142)

- Duplicate retries repair booking, audit, and outbox side effects.
  [`route.ts:177`](../../src/app/api/webhooks/payment/route.ts#L177)

- Missing transaction ids fail explicitly before money flow.
  [`route.ts:381`](../../src/app/api/webhooks/payment/route.ts#L381)

- Existing revenue path ensures side effects before skipping.
  [`route.ts:439`](../../src/app/api/webhooks/payment/route.ts#L439)

- Unique-index races re-query and complete idempotently.
  [`route.ts:549`](../../src/app/api/webhooks/payment/route.ts#L549)

**Database Invariant**

- Migration aborts if duplicate metadata ids already exist.
  [`20260603060000_unique_payment_webhook_transaction.sql:3`](../../supabase/migrations/20260603060000_unique_payment_webhook_transaction.sql#L3)

- Partial unique index protects VietQR webhook transaction ids.
  [`20260603060000_unique_payment_webhook_transaction.sql:17`](../../supabase/migrations/20260603060000_unique_payment_webhook_transaction.sql#L17)

**Regression Coverage**

- New inserts store metadata and create side effects.
  [`payment-webhook.test.ts:111`](../../src/__tests__/payment-webhook.test.ts#L111)

- Duplicate retries do not insert revenue and repair side effects.
  [`payment-webhook.test.ts:176`](../../src/__tests__/payment-webhook.test.ts#L176)

- Repair failures surface explicitly.
  [`payment-webhook.test.ts:226`](../../src/__tests__/payment-webhook.test.ts#L226)

- Concurrent unique violations recover through re-query.
  [`payment-webhook.test.ts:266`](../../src/__tests__/payment-webhook.test.ts#L266)

**Handoff**

- Development log records behavior, migration, and verification.
  [`DEVELOPMENT_LOG.md:8`](../DEVELOPMENT_LOG.md#L8)
