---
title: 'Harden Inventory Transfer Rollbacks'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'c8086c7f5d155201503326b00a0d7a6a381b2e3b'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Inventory transfer shipping/receipt updates stock and writes audit logs before the transfer order reaches its final state. If a later material or the final order-status update fails, the system can leave stock/log side effects that no longer match the order status.

**Approach:** Keep the public transfer action APIs stable, but add side-effect tests for partial transfer rollback and final-status-update rollback. Harden the action implementation so successful stock/log mutations are rolled back when the enclosing transfer operation cannot complete.

## Boundaries & Constraints

**Always:** Preserve `approveAndShipTransfer(transferId, carrier, trackingNumber)` and `confirmTransferReceipt(transferId)` return shape. Preserve existing auth, tenant isolation, status checks, stock validation, and revalidation behavior. If a transfer mutation fails after prior stock/log writes, restore stock and remove the related transfer log entries before returning failure.

**Ask First:** Stop before changing database schema, transfer order statuses, notification delivery behavior, UI flow, or HQ tenant discovery rules.

**Never:** Do not silently ignore inventory update, inventory log, rollback, or order status update errors. Do not touch `supabase/.temp/*` or `.claude/settings.local.json`. Do not introduce broad transaction abstractions outside the transfer action module in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shipment second item log fails | Pending transfer with two HQ items; first shipment stock/log succeeds; second log insert fails | First and second stock changes are restored, shipment logs removed, order remains pending | Return failure including log error and rollback error if rollback fails |
| Shipment status update fails | All HQ shipment stock/log writes succeed; final order update fails | All shipment stock changes are restored and shipment logs removed | Return explicit order update failure plus rollback failure if any |
| Receipt second item log fails | Shipped transfer with existing branch item first and new/existing item second; second receipt log fails | All receipt stock changes are restored, receipt logs removed, order remains shipped | Return failure including receipt log error and rollback error if rollback fails |
| Receipt status update fails | Branch receipt stock/log writes succeed; final order update fails | All receipt stock changes are restored and receipt logs removed | Return explicit order update failure plus rollback failure if any |

</frozen-after-approval>

## Code Map

- `src/services/inventory-transfer-actions.ts` -- Server Actions for inventory transfer create/list/ship/receive/cancel and current rollback helper.
- `src/__tests__/inventory-transfer.test.ts` -- in-memory Supabase mock and existing transfer side-effect tests.
- `src/app/dashboard/inventory/hooks/useInventoryPageState.ts` -- caller context for transfer request/receipt actions.

## Tasks & Acceptance

**Execution:**
- [x] `src/__tests__/inventory-transfer.test.ts` -- add side-effect tests for partial shipment rollback, shipment status-update rollback, partial receipt rollback, and receipt status-update rollback.
- [x] `src/services/inventory-transfer-actions.ts` -- track successful transfer stock/log mutations and rollback them if later transfer work fails.
- [x] `docs/DEVELOPMENT_LOG.md` -- append concise entry with verification commands.

**Acceptance Criteria:**
- Given an earlier transfer item has already changed stock and written an inventory log, when a later item fails, then the earlier item stock and log are rolled back.
- Given all transfer item mutations succeed but the order status update fails, when the action returns failure, then no transfer stock/log side effects remain.
- Given rollback itself fails, when the action returns, then the response includes the original failure and the rollback failure.

## Spec Change Log

- 2026-06-01 -- Added rollback tracking for successful transfer stock/log mutations and tests for partial/final-update failures in shipment and receipt flows.

## Design Notes

Rollback should be local to transfer mutations. The safest narrow identifier for deleting logs in this slice is the tuple already written by these actions: `item_id`, `reason`, `tenant_id`, and exact transfer-order `notes`. This avoids deleting unrelated inventory history while allowing rollback without changing insert calls to request returned log IDs.

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/services/inventory-transfer-actions.ts src/__tests__/inventory-transfer.test.ts` -- pass.
- `npm.cmd test -- src/__tests__/inventory-transfer.test.ts --runInBand` -- pass.

## Suggested Review Order

1. `src/services/inventory-transfer-actions.ts` -- review rollback helper and shipment/receipt failure branches.
2. `src/__tests__/inventory-transfer.test.ts` -- review new partial/final-update rollback assertions.
3. `docs/DEVELOPMENT_LOG.md` -- confirm the entry matches the implemented behavior.
