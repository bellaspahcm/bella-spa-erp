---
title: 'Harden Lock Month Side Effects'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '03dc547adb2479cf8eef16ba37b7984fdcd7d386'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `lockMonth` first locks monthly records through `lock_monthly_records`, then creates or updates franchise royalty invoices and inter-branch clearing records. If a downstream side-effect fails after the lock RPC succeeds, the month can remain locked while required financial obligations are missing or stale.

**Approach:** Keep the public action contract stable, but make the workflow compensation-safe. Snapshot the lock state before the RPC, use stable local month scope calculations for all downstream queries, type invoice/clearing payloads from generated Supabase types, and if any downstream side-effect fails, restore the previous lock state for the month before returning an explicit failure.

## Boundaries & Constraints

**Always:** Preserve current auth checks, `lock_monthly_records` RPC invocation, success response shape, and `/dashboard/finance` revalidation on success. Treat royalty and clearing DB failures as hard failures. Use generated Supabase `Insert`/`Update` payload types for `franchise_royalty_invoices` and `inter_branch_clearing_records`. Restore only records that were changed by this lock attempt, scoped to current tenant and requested month.

**Ask First:** New database RPCs, schema changes, changing role requirements, skipping royalty or clearing generation, changing paid/cleared record rules, or adding new accounting outbox behavior.

**Never:** Do not report lock success if invoice or clearing side effects fail. Do not silently catch downstream failures. Do not unlock records that were already locked before this request, and do not broaden filters beyond the requested tenant/month.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Success | Admin locks a valid month and RPC, royalty, clearing all succeed | Returns `{ success: true, month }` and revalidates finance dashboard | No compensation |
| RPC lock fails | `lock_monthly_records` returns error | Returns `{ success: false }` with RPC error | No downstream side effects |
| Royalty side-effect fails | RPC succeeds, royalty tenant/revenue/invoice query or write fails | Returns `{ success: false }` after restoring prior lock state | Error includes side-effect failure and restore failure if any |
| Clearing side-effect fails | RPC and royalty succeed, clearing query or write fails | Returns `{ success: false }` after restoring prior lock state | Error includes side-effect failure and restore failure if any |
| Existing finalized docs | Royalty invoice is `paid` or clearing record is `cleared` | Does not overwrite finalized records | Still fails on DB query errors |

</frozen-after-approval>

## Code Map

- `src/services/finance/lock-month-action.ts` -- Server action that locks monthly records and generates royalty/clearing side effects.
- `src/services/finance/unlock-month-action.ts` -- Recent compensation-safe month lock-state pattern to mirror where appropriate.
- `src/services/finance/lock-month.ts` -- Public finance action export wrapper.
- `src/__tests__/finance.lockMonth.test.ts` -- Existing focused tests for `lockMonth`/`unlockMonth`.
- `src/__tests__/franchise-royalty.test.ts` -- Existing royalty integration coverage around `lockMonth`.
- `src/__tests__/inter-branch-clearing.test.ts` -- Existing clearing integration coverage around `lockMonth`.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/finance/lock-month-action.ts` -- add stable month-scope helper and pre-lock state snapshot for `revenue`, `expenses`, and `salary_records`.
- [x] `src/services/finance/lock-month-action.ts` -- add compensation path that restores previous lock state if royalty or clearing side effects fail after the RPC succeeds.
- [x] `src/services/finance/lock-month-action.ts` -- type royalty invoice and clearing insert/update payloads using generated Supabase types.
- [x] `src/__tests__/finance.lockMonth.test.ts` -- add regression tests for royalty failure restore, clearing failure restore, restore failure detail, finalized paid/cleared skip behavior, and stable date filters.
- [x] `docs/DEVELOPMENT_LOG.md` -- record the completed checkpoint and verification commands.

**Acceptance Criteria:**
- Given `lock_monthly_records` succeeds but royalty invoice creation fails, when `lockMonth` returns, then it is unsuccessful and prior lock state restoration was attempted for the month.
- Given clearing record creation fails after royalty succeeds, when `lockMonth` returns, then it is unsuccessful and prior lock state restoration was attempted for the month.
- Given restoration also fails, when `lockMonth` returns, then the error includes both the downstream side-effect failure and restoration failure.
- Given an existing royalty invoice is `paid` or clearing record is `cleared`, when `lockMonth` runs, then finalized records are not overwritten.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/finance.lockMonth.test.ts --runInBand` -- pass, 15/15 tests.
- `npm.cmd test -- src/__tests__/franchise-royalty.test.ts src/__tests__/inter-branch-clearing.test.ts --runInBand` -- pass, 26/26 tests.
- `npm.cmd test -- src/__tests__/cross-module-integrity.test.ts --runInBand` -- pass, 1/1 test.
- `npx.cmd tsc --noEmit --incremental false` -- pass.
- `npx.cmd eslint src/services/finance/lock-month-action.ts src/__tests__/finance.lockMonth.test.ts src/__tests__/franchise-royalty.test.ts src/__tests__/inter-branch-clearing.test.ts src/__tests__/cross-module-integrity.test.ts` -- pass.
- `npm.cmd test -- --runInBand` -- pass, 66 suites / 735 tests.
- `npm.cmd run build` -- pass.

## Review Notes

- BMad review finding patched: month date filters now use `gte(start)` + `lt(nextMonthStart)` for snapshot and restore, avoiding end-of-day fractional-second gaps.
- BMad review finding patched: compensation restores both prior `is_locked` and prior `status` for `revenue`, `expenses`, and `salary_records`.
- BMad review finding patched: rollback failures are collected from both rejected promises and resolved Supabase `{ error }` results, then included in the returned failure.
- BMad review finding patched: finance dashboard cache is revalidated after compensated side-effect failure, not only after success.
- BMad review finding patched: clearing-failure regression test asserts royalty invoice creation happened first, so the test covers the actual partial-side-effect order.
- Full Jest initially exposed an older Supabase test mock without `.lt()` support in `cross-module-integrity.test.ts`; the mock now supports `gte/lte/lt` range filters and the suite passes.

## Deferred Work

- True all-or-nothing rollback for already-created royalty/clearing rows remains out of scope because it would require explicit product/accounting intent for deleting or reverting generated financial documents.
- Closing the remaining concurrency window fully should be handled later with a database transaction/RPC design; this checkpoint intentionally avoided new RPCs or schema changes per the Ask First boundary.

## Suggested Review Order

**Lock Flow**

- Entry point shows snapshot, RPC, side-effect sync, compensation, and revalidation.
  [`lock-month-action.ts:415`](../../src/services/finance/lock-month-action.ts#L415)

- Snapshot captures prior month state before the locking RPC mutates records.
  [`lock-month-action.ts:99`](../../src/services/finance/lock-month-action.ts#L99)

- Compensation restores previous lock/status groups within tenant and month scope.
  [`lock-month-action.ts:142`](../../src/services/finance/lock-month-action.ts#L142)

**Financial Side Effects**

- Royalty sync now checks read/write errors and uses typed payloads.
  [`lock-month-action.ts:191`](../../src/services/finance/lock-month-action.ts#L191)

- Clearing sync preserves cleared records and fails loudly on DB errors.
  [`lock-month-action.ts:283`](../../src/services/finance/lock-month-action.ts#L283)

**Regression Coverage**

- Royalty failure proves rollback restores prior state and scoped filters.
  [`finance.lockMonth.test.ts:352`](../../src/__tests__/finance.lockMonth.test.ts#L352)

- Clearing failure proves royalty happened first, then rollback runs.
  [`finance.lockMonth.test.ts:382`](../../src/__tests__/finance.lockMonth.test.ts#L382)

- Restore failure test keeps original and rollback errors visible.
  [`finance.lockMonth.test.ts:402`](../../src/__tests__/finance.lockMonth.test.ts#L402)

- Cross-module mock supports real range filters used by new month scope.
  [`cross-module-integrity.test.ts:134`](../../src/__tests__/cross-module-integrity.test.ts#L134)
