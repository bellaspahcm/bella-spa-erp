---
title: 'Harden Inventory Transfer New Item Rollback'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '602838d06952aad2db7d61d3793c0a3ee5a3b008'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Khi chi nhanh xac nhan nhan hang va item chua ton tai o chi nhanh, action tu tao `inventory_items` truoc khi ghi log va cap nhat trang thai don. Neu buoc ghi log hoac cap nhat trang thai that bai, rollback hien tai chi dua stock cua item moi ve 0, de lai mot mat hang ao khong thuc su duoc nhan thanh cong.

**Approach:** Giu nguyen API va flow chuyen kho, nhung phan biet item da ton tai voi item moi sinh ra trong cung operation. Neu operation that bai sau khi tao item moi, rollback phai xoa item moi do va xoa log lien quan, thay vi giu item voi stock 0.

## Boundaries & Constraints

**Always:** Tra ve `{ success: false, error }` ro rang khi bat ky DB side-effect bat buoc nao fail. Giu tenant isolation, status check, auth check va revalidation hien co. Rollback phai dua du lieu ve trang thai truoc khi nhan kho: item cu restore stock, item moi bi xoa.

**Ask First:** Bat ky thay doi schema, RPC transaction rewrite, UI flow, notification behavior, hoac thay doi status semantics cua `inventory_transfer_orders`.

**Never:** Khong swallow loi DB. Khong de item moi sinh ra tu receipt loi nam lai nhu du lieu hop le. Khong dung `any` cho payload insert/update moi.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| New item receipt log fails | Shipped order co item chua ton tai o chi nhanh; create item thanh cong; insert receipt log fail | Item moi bi xoa, khong co receipt log, order van `shipped` | Return failure gom loi insert log va rollback failure neu co |
| New item receipt status update fails | Create item va receipt log thanh cong; update order completed fail | Item moi bi xoa, receipt log bi xoa, order van `shipped` | Return failure gom loi update order va rollback failure neu co |
| Mixed receipt rollback | Item cu da tang stock, item moi duoc tao; buoc sau fail | Item cu restore stock cu, item moi bi xoa, logs bi xoa | Return explicit failure |

</frozen-after-approval>

## Code Map

- `src/services/inventory-transfer-actions.ts` -- Server Actions va rollback helper cho transfer shipment/receipt.
- `src/__tests__/inventory-transfer.test.ts` -- In-memory Supabase mock va regression tests cho side-effect rollback.
- `docs/implementation-artifacts/spec-harden-inventory-transfer-rollbacks.md` -- Artifact truoc day da harden rollback nhung con giu item moi stock 0.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/inventory-transfer-actions.ts` -- them tracking `createdNewItem` vao mutation va xoa item moi khi rollback receipt fail.
- [x] `src/__tests__/inventory-transfer.test.ts` -- doi regression tu "reset stock 0" sang "delete new item" cho log failure, partial receipt failure va status update failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- them entry ngan neu verification pass.

**Acceptance Criteria:**
- Given branch receipt creates a new item and receipt log insert fails, when `confirmTransferReceipt` returns, then no branch item with that SKU remains and the order is not completed.
- Given branch receipt creates a new item and final order update fails, when rollback completes, then the new item and receipt log are removed.
- Given receipt includes both existing and new items, when a later failure occurs, then existing item stock is restored and the new item is deleted.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/inventory-transfer.test.ts --runInBand` -- pass, 29/29 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/inventory-transfer-actions.ts src/__tests__/inventory-transfer.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 65 suites / 710 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- Local diff review found no patch findings in scope: new items are deleted only when `createdNewItem` is tracked from the same receipt operation; existing items still restore stock.
- BMad parallel sub-agent review was not spawned because the runtime only permits sub-agents when the user explicitly requests agent delegation.

## Suggested Review Order

**Receipt Rollback Design**

- Track which mutations created branch items inside this receipt.
  [`inventory-transfer-actions.ts:24`](../../src/services/inventory-transfer-actions.ts#L24)

- Delete logs before deleting newly-created items during rollback.
  [`inventory-transfer-actions.ts:90`](../../src/services/inventory-transfer-actions.ts#L90)

- Roll back a current new item immediately when receipt log insert fails.
  [`inventory-transfer-actions.ts:589`](../../src/services/inventory-transfer-actions.ts#L589)

- Preserve existing-item restore behavior while tagging new-item mutations.
  [`inventory-transfer-actions.ts:607`](../../src/services/inventory-transfer-actions.ts#L607)

**Regression Coverage**

- Lock log-failure behavior to delete the new branch item.
  [`inventory-transfer.test.ts:698`](../../src/__tests__/inventory-transfer.test.ts#L698)

- Lock mixed rollback behavior: restore old stock, delete new item.
  [`inventory-transfer.test.ts:737`](../../src/__tests__/inventory-transfer.test.ts#L737)

- Lock final status-update failure to remove the new item.
  [`inventory-transfer.test.ts:751`](../../src/__tests__/inventory-transfer.test.ts#L751)
