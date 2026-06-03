---
title: 'Harden Manual Inventory Mutations'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'a6fb94c57304286467a21e5f43be238e2bb9ba3a'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Trang Kho dang tu ghi truc tiep `inventory_items` va `inventory_logs` tu client hook cho thao tac nhap them va tao vat tu moi. Neu item/stock update thanh cong nhung log audit that bai, ton kho co the thay doi ma lich su kho khong day du.

**Approach:** Dua manual write path ve Server Actions trong `src/services/inventory-actions.ts`, bat loi DB ro rang va rollback side effects bat buoc. UI hook chi goi action va refresh du lieu, khong tu thuc hien multi-step Supabase writes.

## Boundaries & Constraints

**Always:** Giu UX hien tai cua modal nhap kho va them vat tu. Tenant/auth phai lay tu server action. Neu initial inventory log fail sau khi tao item moi, xoa item moi. Neu restock log fail sau khi stock update, restore stock cu. Tests phai assert stock/item va `inventory_logs` side effects.

**Ask First:** Bat ky thay doi schema, RLS, UI layout lon, monthly reconciliation behavior, hoac doi y nghia cac `inventory_logs.reason` hien co.

**Never:** Khong swallow loi DB bat buoc. Khong de client hook tu ghi `inventory_items` + `inventory_logs` thanh hai buoc rieng. Khong dung loose payload `any` cho DB mutation moi.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Add item with initial stock succeeds | Valid item, stock > 0 | Item created, initial log written, UI refreshes | Return success after both writes succeed |
| Add item initial log fails | Item insert succeeds, log insert fails | Newly-created item is deleted | Return failure with log error and rollback error if any |
| Restock from UI succeeds | Existing item, positive amount | Server action updates stock, writes restock log, UI refreshes | Return success after both writes succeed |
| Restock log fails | Stock update succeeds, log insert fails | Stock restored to previous value | Return explicit failure |

</frozen-after-approval>

## Code Map

- `src/services/inventory-actions.ts` -- Server Actions for inventory reads/writes, package materials, reconciliation, and auto-consume.
- `src/app/dashboard/inventory/hooks/useInventoryPageState.ts` -- UI state hook currently doing direct client DB writes for add/restock.
- `src/__tests__/inventory-actions.test.ts` -- Inventory action side-effect regression tests and scripted Supabase mock.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/inventory-actions.ts` -- harden `addInventoryItem` to write initial log and delete created item on log failure.
- [x] `src/app/dashboard/inventory/hooks/useInventoryPageState.ts` -- replace direct client write paths with `addInventoryItem` and `restockItem`.
- [x] `src/__tests__/inventory-actions.test.ts` -- add side-effect assertions for add-item success and rollback on initial-log failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- append verification entry after checks pass.

**Acceptance Criteria:**
- Given add item creates an item and initial log insert fails, when the action returns, then the created item is deleted and caller receives failure.
- Given UI submits restock, when the server action returns failure, then UI shows the explicit action error and does not perform direct client DB writes.
- Given add item has zero initial stock, when action succeeds, then no initial inventory log is required.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- pass, 20/20 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/inventory-actions.ts src/app/dashboard/inventory/hooks/useInventoryPageState.ts src/__tests__/inventory-actions.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 65 suites / 713 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- Local diff review found no patch findings in scope: client direct writes were removed only from add/restock flows; read/query flows remain unchanged.
- BMad parallel sub-agent review was not spawned because this runtime only permits sub-agents when the user explicitly requests agent delegation.

## Suggested Review Order

**Server-Side Write Safety**

- Delete newly-created inventory rows if required initial log fails.
  [`inventory-actions.ts:36`](../../src/services/inventory-actions.ts#L36)

- Add item now validates input and owns tenant-scoped insert.
  [`inventory-actions.ts:436`](../../src/services/inventory-actions.ts#L436)

- Initial stock now creates required audit log before success.
  [`inventory-actions.ts:473`](../../src/services/inventory-actions.ts#L473)

- Log failure rolls back the item instead of leaving unaudited stock.
  [`inventory-actions.ts:485`](../../src/services/inventory-actions.ts#L485)

**UI Boundary**

- Restock UI delegates stock/log writes to Server Action.
  [`useInventoryPageState.ts:234`](../../src/app/dashboard/inventory/hooks/useInventoryPageState.ts#L234)

- Add-item UI delegates item/log writes to Server Action.
  [`useInventoryPageState.ts:258`](../../src/app/dashboard/inventory/hooks/useInventoryPageState.ts#L258)

**Regression Coverage**

- Mock preserves mutation op across `insert().select().single()`.
  [`inventory-actions.test.ts:72`](../../src/__tests__/inventory-actions.test.ts#L72)

- Positive opening stock must write an initial log.
  [`inventory-actions.test.ts:244`](../../src/__tests__/inventory-actions.test.ts#L244)

- Initial-log failure must delete the new item.
  [`inventory-actions.test.ts:297`](../../src/__tests__/inventory-actions.test.ts#L297)
