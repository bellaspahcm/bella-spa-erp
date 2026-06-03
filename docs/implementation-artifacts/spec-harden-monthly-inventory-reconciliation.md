---
title: 'Harden Monthly Inventory Reconciliation'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '4dd475ed032f1ceee5d0a308764f8e1e0fe7ea02'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `saveMonthlyReconciliation` co the xu ly mot phan entries, gap loi o phan con lai, nhung van tra `success: true` neu `processed > 0`. Dieu nay lam nguoi van hanh de hieu nham ky kiem ke da luu xong toan bo.

**Approach:** Giu flow kiem ke hien tai va rollback tung item khi log fail, nhung doi contract: bat ky failure nao trong batch deu tra `success: false` kem `processed`, `failed`, va message ro. UI phai hien loi ro va refresh lai neu co item da thuc su duoc ghi thanh cong.

## Boundaries & Constraints

**Always:** Required DB failures phai duoc tra ve explicit. Neu stock update thanh cong nhung log kiem ke fail, phai rollback stock ve expected. Partial success khong duoc coi la full success. Tests phai assert side effects tren `inventory_items` va `inventory_logs`.

**Ask First:** Bat ky thay doi schema, RPC transaction rewrite, UI layout lon, hoac bat buoc all-or-nothing rollback toan batch.

**Never:** Khong swallow invalid entries, missing item, update fail, log fail, rollback fail. Khong tra `success: true` khi co failure trong batch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| All entries success | Valid entries, update/log all pass | `success: true`, `processed = entries.length`, `failed = 0` | Revalidate inventory |
| Invalid actual stock | One entry has negative/NaN stock | `success: false`, failed count increments | No DB write for invalid entry |
| Item not found | Fetch row fails or null | `success: false`, failed count increments | No update/log for that item |
| Log insert fails | Stock update succeeds, log fails | Stock rolls back to expected | Return failure including log error |
| Rollback fails | Stock update succeeds, log fails, rollback fails | Return failure including rollback failure | Do not hide original log failure |
| Partial success | Some entries pass, some fail | `success: false`, processed/failed both reported | UI refreshes because committed rows changed |

</frozen-after-approval>

## Code Map

- `src/services/inventory-actions.ts` -- `saveMonthlyReconciliation` batch write and rollback logic.
- `src/app/dashboard/inventory/hooks/useInventoryPageState.ts` -- UI caller that decides success/error toast and refresh behavior.
- `src/__tests__/inventory-actions.test.ts` -- Scripted Supabase mock and inventory write side-effect tests.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/inventory-actions.ts` -- return failure for any batch failures and expose `failed` count.
- [x] `src/app/dashboard/inventory/hooks/useInventoryPageState.ts` -- refresh after partial committed changes even when action returns failure.
- [x] `src/__tests__/inventory-actions.test.ts` -- add reconciliation tests for all-success, invalid input, log rollback, rollback failure, and partial failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- append verification entry after checks pass.

**Acceptance Criteria:**
- Given at least one reconciliation entry fails, when `saveMonthlyReconciliation` returns, then `success` is false even if other entries processed successfully.
- Given log insert fails after stock update, when the action returns, then stock rollback is attempted and the error includes rollback failure if rollback fails.
- Given partial success changed stock/log rows, when UI receives failure with `processed > 0`, then it refreshes stock and reconciliation data.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- pass, 25/25 tests.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/inventory-actions.ts src/app/dashboard/inventory/hooks/useInventoryPageState.ts src/__tests__/inventory-actions.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 65 suites / 718 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- Local diff review found no patch findings in scope: batch partial failure now returns `success: false`; per-item rollback behavior remains local and unchanged.
- BMad parallel sub-agent review was not spawned because this runtime only permits sub-agents when the user explicitly requests agent delegation.

## Suggested Review Order

**Batch Contract**

- Entry point now reports batch failures instead of partial success.
  [`inventory-actions.ts:327`](../../src/services/inventory-actions.ts#L327)

- Missing item IDs are counted as failures instead of skipped silently.
  [`inventory-actions.ts:345`](../../src/services/inventory-actions.ts#L345)

- Log failure still rolls stock back and preserves rollback errors.
  [`inventory-actions.ts:413`](../../src/services/inventory-actions.ts#L413)

- Any failure now returns `success: false` with `processed` and `failed`.
  [`inventory-actions.ts:425`](../../src/services/inventory-actions.ts#L425)

**UI Refresh**

- Partial committed writes trigger refresh even though the toast is an error.
  [`useInventoryPageState.ts:198`](../../src/app/dashboard/inventory/hooks/useInventoryPageState.ts#L198)

**Regression Coverage**

- All-success reconciliation verifies stock updates and audit logs.
  [`inventory-actions.test.ts:318`](../../src/__tests__/inventory-actions.test.ts#L318)

- Invalid entries do not touch the database.
  [`inventory-actions.test.ts:356`](../../src/__tests__/inventory-actions.test.ts#L356)

- Log failure restores stock.
  [`inventory-actions.test.ts:371`](../../src/__tests__/inventory-actions.test.ts#L371)

- Rollback failure is included in the returned error.
  [`inventory-actions.test.ts:393`](../../src/__tests__/inventory-actions.test.ts#L393)

- Partial success is not reported as full success.
  [`inventory-actions.test.ts:410`](../../src/__tests__/inventory-actions.test.ts#L410)
