---
title: 'Harden Package Materials'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '800595fb694d01e3ca61c1eee46bfeef0458dbe1'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `upsertPackageMaterials` deletes old package material rows before inserting replacements, but if the replacement insert fails, the previous material definition can be lost. This affects automatic inventory consumption for completed sessions.

**Approach:** Snapshot existing material rows before replacement, keep all DB errors explicit, and restore the old definition if the replacement insert fails. Add side-effect tests for delete, insert, failure propagation, and rollback.

## Boundaries & Constraints

**Always:** Preserve public function names `getPackageMaterials` and `upsertPackageMaterials`. Keep Services page caller behavior and payload shape unchanged. Use generated Supabase package material types for DB payloads. Return explicit `{ success: false, error }` for material write failures. Keep `getPackageMaterials` throwing clear read errors.

**Ask First:** Stop before changing inventory consumption math, booking/session completion, package schema, or Services page UI behavior.

**Never:** Do not silently ignore delete/insert/restore failures. Do not touch salary, financial reports, `supabase/.temp/*`, or `.claude/settings.local.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Replace materials succeeds | Existing rows and valid replacement rows | Old rows deleted, new typed rows inserted, path revalidated | Returns `{ success: true, inserted }` |
| Replacement empty | Existing rows and empty replacement | Old rows deleted and no new insert attempted | Returns `{ success: true, inserted: 0 }` |
| Delete fails | Existing rows and delete error | No insert attempted | Returns explicit delete error |
| Insert fails | Delete succeeds but replacement insert fails | Existing rows are restored | Returns insert error; includes rollback error if restore fails |
| Read fails | `getPackageMaterials` query fails | Throws clear package material read error | Existing behavior preserved |

</frozen-after-approval>

## Code Map

- `src/services/inventory-actions.ts` -- target server action file containing package material reads and upsert.
- `src/__tests__/inventory-actions.test.ts` -- existing inventory action tests; extend package material side-effect coverage.
- `src/types/database.types.ts` -- generated `package_materials` Insert/Row types.
- `src/app/dashboard/services/hooks/useServicesPageState.ts` -- caller that saves package material rows after package action success.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/inventory-actions.ts` -- snapshot existing package material rows before replacement and restore them if replacement insert fails.
- [x] `src/services/inventory-actions.ts` -- type package material row/payload helpers with generated Supabase types.
- [x] `src/__tests__/inventory-actions.test.ts` -- add side-effect tests for successful replace, empty replace, delete failure, insert failure rollback, and rollback failure reporting.
- [x] `docs/DEVELOPMENT_LOG.md` -- append concise entry with verification commands.

**Acceptance Criteria:**
- Given replacement insert fails, when old rows existed, then the action attempts to restore the previous package material rows.
- Given rollback restore fails, when action returns, then the returned error mentions both insert failure and rollback failure.
- Given delete fails, when action returns, then no replacement insert runs.
- Given tests run, when package material flows are exercised, then side-effect table operations are asserted.

## Spec Change Log

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- passed.
- `npx.cmd eslint src/services/inventory-actions.ts src/__tests__/inventory-actions.test.ts` -- passed.
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- passed.

## Suggested Review Order

**Material Replacement Safety**

- Snapshot existing package materials before destructive replacement.
  [`inventory-actions.ts:155`](../../src/services/inventory-actions.ts#L155)

- Insert failure restores the old package material rows.
  [`inventory-actions.ts:199`](../../src/services/inventory-actions.ts#L199)

- Rollback failure is surfaced with the insert failure.
  [`inventory-actions.ts:212`](../../src/services/inventory-actions.ts#L212)

**Side-Effect Tests**

- Scripted Supabase mock captures DB operations.
  [`inventory-actions.test.ts:49`](../../src/__tests__/inventory-actions.test.ts#L49)

- Successful replacement asserts delete and typed insert payloads.
  [`inventory-actions.test.ts:240`](../../src/__tests__/inventory-actions.test.ts#L240)

- Delete failure prevents replacement insert.
  [`inventory-actions.test.ts:289`](../../src/__tests__/inventory-actions.test.ts#L289)

- Insert failure restores prior rows.
  [`inventory-actions.test.ts:306`](../../src/__tests__/inventory-actions.test.ts#L306)

- Restore failure reports both errors.
  [`inventory-actions.test.ts:350`](../../src/__tests__/inventory-actions.test.ts#L350)

**Peripherals**

- Development log records the hardening slice and verification.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
