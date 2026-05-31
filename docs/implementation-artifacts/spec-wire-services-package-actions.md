---
title: 'Wire Services Page To Package Actions'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '75746eec311cedc28719688b0e2e05ddd9c88d28'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The Services page hook still reads and mutates `packages` directly through the browser Supabase client, while `src/services/package-actions.ts` is now typed, audited, and rollback-tested. That leaves two package write paths that can drift.

**Approach:** Route Services page package load/create/update/delete/status toggle through the hardened package Server Actions, while leaving package material upsert through `inventory-actions` unchanged.

## Boundaries & Constraints

**Always:** Preserve current Services UI behavior, modal fields, toasts, pagination, default-package sync intent, and package material save/delete behavior. Keep `package_materials` writes through `upsertPackageMaterials`. Keep tenant lookup if needed for package creation payloads. Surface package action errors in the existing toast paths.

**Ask First:** Stop before changing DB schema, changing package action return contracts, changing salary/session multiplier semantics, or rewriting the Services UI into new components.

**Never:** Do not reintroduce direct browser Supabase package CRUD from the Services hook. Do not touch salary, booking completion, financial reports, `supabase/.temp/*`, or `.claude/settings.local.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load services | Services page mounts | Hook uses `getPackages`, then renders existing filter/pagination behavior | Server action failure shows load toast and empties current list |
| Create/update service | User submits modal | Hook calls `createPackage` or `updatePackage`, then saves material rows as before | Action error stops material save and shows explicit toast |
| Delete service | User confirms delete | Hook calls `deletePackage`, reloads list on success | Action error shows delete toast |
| Toggle status | User clicks status toggle | Hook calls `updatePackage` with status, updates local list on success | Action error shows status toast |

</frozen-after-approval>

## Code Map

- `src/app/dashboard/services/hooks/useServicesPageState.ts` -- target hook currently owning browser package CRUD and material handling.
- `src/services/package-actions.ts` -- hardened package action boundary to use for package reads/writes.
- `src/app/dashboard/services/types.ts` -- Services page package/inventory type aliases.
- `docs/DEVELOPMENT_LOG.md` -- development log entry for the wiring slice.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/services/hooks/useServicesPageState.ts` -- import and use package actions for load/create/update/delete/toggle -- removes duplicate browser package CRUD.
- [x] `src/app/dashboard/services/hooks/useServicesPageState.ts` -- preserve material duplicate handling and `upsertPackageMaterials` flow after package action success.
- [x] `docs/DEVELOPMENT_LOG.md` -- append concise entry with verification commands.

**Acceptance Criteria:**
- Given Services page loads, when packages are fetched, then package data comes through `getPackages`.
- Given add/edit/delete/toggle actions succeed, when the hook completes, then existing success toasts and reload/local update behavior remain.
- Given package action returns `{ error }`, when the hook handles it, then material upsert does not run and an explicit toast is shown.

## Spec Change Log

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- passed.
- `npx.cmd eslint src/app/dashboard/services/hooks/useServicesPageState.ts src/services/package-actions.ts` -- passed.
- `npm.cmd test -- src/__tests__/package-actions.test.ts --runInBand` -- passed.

## Suggested Review Order

**Action Boundary**

- Services package reads now go through server action.
  [`useServicesPageState.ts:169`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L169)

- Delete calls the hardened package delete action.
  [`useServicesPageState.ts:249`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L249)

- Status toggle uses package update action.
  [`useServicesPageState.ts:265`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L265)

- Default package sync creates through audit-aware action path.
  [`useServicesPageState.ts:310`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L310)

- Modal submit uses create/update actions before material upsert.
  [`useServicesPageState.ts:345`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L345)

**Peripherals**

- Development log records the wiring slice and verification.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
