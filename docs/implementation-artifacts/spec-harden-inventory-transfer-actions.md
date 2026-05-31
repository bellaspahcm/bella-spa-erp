---
title: 'Harden inventory transfer actions'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '235e4f6'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `src/services/inventory-transfer-actions.ts` still updates stock and writes inventory logs as separate unchecked operations in the HQ shipment and branch receipt flows. If a stock update, log insert, or order status update fails silently, the transfer workflow can leave inventory quantities, transfer status, and audit logs out of sync.

**Approach:** Keep the existing transfer workflow and public action names, but type database payloads with generated Supabase types, check every database mutation result, and compensate stock/item changes when a later required side effect fails. Add regression tests that assert side-effect records and failure propagation.

## Boundaries & Constraints

**Always:** Preserve tenant isolation and HQ authorization rules; return `{ success: false, error }` on database failures; assert inventory side effects in tests; keep notification failures non-blocking only after required stock/log/status writes succeed.

**Ask First:** Any schema migration, RPC transaction rewrite, UI change, or change to transfer order status semantics.

**Never:** Do not swallow required `inventory_items`, `inventory_logs`, or `inventory_transfer_orders` errors; do not cast DB payloads as `any`; do not commit local Supabase temp files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HQ ships transfer | pending order, enough HQ stock | HQ stock decreases, shipment log inserted, order becomes `shipped` | return success only after all required writes succeed |
| Shipment log insert fails | stock update succeeded, `inventory_logs.insert` fails | stock rolls back to previous value, order remains pending | return failure with log error and rollback status |
| Branch confirms receipt | shipped order, existing branch item | branch stock increases, receipt log inserted, order becomes `completed` | return success only after all required writes succeed |
| Receipt log insert fails for existing item | branch stock update succeeded, `inventory_logs.insert` fails | branch stock rolls back to previous value, order remains shipped | return failure with log error and rollback status |
| Receipt log insert fails for new item | branch item created, `inventory_logs.insert` fails | new item is reset to zero stock so receipt is not counted | return failure with log error |

</frozen-after-approval>

## Code Map

- `src/services/inventory-transfer-actions.ts` -- server actions for branch transfer request, HQ shipment, branch receipt, and cancellation.
- `src/__tests__/inventory-transfer.test.ts` -- in-memory Supabase mock and transfer workflow regression tests.
- `src/types/database.types.ts` -- generated Supabase types for strict insert/update payloads.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/inventory-transfer-actions.ts` -- add strict payload aliases and error helpers, then check all required DB writes in shipment and receipt flows.
- [x] `src/services/inventory-transfer-actions.ts` -- compensate stock changes if required log insert fails before order status changes.
- [x] `src/__tests__/inventory-transfer.test.ts` -- extend mocks to script insert/update failures and assert rollback/no status transition.

**Acceptance Criteria:**
- Given HQ stock update succeeds but shipment log insert fails, when `approveAndShipTransfer` runs, then HQ stock is restored and the order is not marked shipped.
- Given branch receipt updates an existing item but receipt log insert fails, when `confirmTransferReceipt` runs, then branch stock is restored and the order is not marked completed.
- Given transfer success paths run, when tests inspect `inventory_logs`, then shipment and receipt side-effect records exist with correct reason, tenant, item, and change amount.

## Spec Change Log

## Verification

**Commands:**
- `npx.cmd eslint src/services/inventory-transfer-actions.ts src/__tests__/inventory-transfer.test.ts` -- expected: no errors.
- `npm.cmd test -- src/__tests__/inventory-transfer.test.ts --runInBand` -- expected: all transfer tests pass.
- `npx.cmd tsc --noEmit` -- expected: TypeScript passes.

## Suggested Review Order

**Transfer Safety**

- Start with shared error typing and rollback helper.
  [`inventory-transfer-actions.ts:17`](../../src/services/inventory-transfer-actions.ts#L17)

- Review HQ shipment mutation and log rollback.
  [`inventory-transfer-actions.ts:179`](../../src/services/inventory-transfer-actions.ts#L179)

- Check shipment log failure compensation path.
  [`inventory-transfer-actions.ts:291`](../../src/services/inventory-transfer-actions.ts#L291)

**Receipt Safety**

- Review branch receipt mutation path.
  [`inventory-transfer-actions.ts:390`](../../src/services/inventory-transfer-actions.ts#L390)

- Check existing/new item rollback behavior.
  [`inventory-transfer-actions.ts:485`](../../src/services/inventory-transfer-actions.ts#L485)

**Regression Coverage**

- Failure injection makes DB side-effect errors testable.
  [`inventory-transfer.test.ts:61`](../../src/__tests__/inventory-transfer.test.ts#L61)

- Shipment log failure must restore HQ stock.
  [`inventory-transfer.test.ts:468`](../../src/__tests__/inventory-transfer.test.ts#L468)

- Receipt log failures must not complete the order.
  [`inventory-transfer.test.ts:572`](../../src/__tests__/inventory-transfer.test.ts#L572)
