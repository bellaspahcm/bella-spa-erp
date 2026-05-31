---
title: 'Refactor Services Page State'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '7643076be76c5bc3be3b888aa3784f0da8d9a152'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `src/app/dashboard/services/page.tsx` is a large client page that mixes UI rendering, form state, pagination, direct Supabase mutations, package material handling, and default package sync in one file. This makes the next inventory/service hardening work risky because small behavior changes are hard to review.

**Approach:** Extract service page types, constants, and state/action logic into local modules under `src/app/dashboard/services/`, following the existing inventory page refactor pattern. Keep the rendered UI and current user-facing behavior stable in this slice.

## Boundaries & Constraints

**Always:** Preserve the current Services UI behavior, modal fields, filters, pagination, package material rows, toast behavior, and Supabase write paths unless a compile/lint issue forces a narrow adjustment. Use Supabase generated `Database` table types for page-facing package and inventory item shapes. Keep the page as a Client Component because it still renders event handlers, state-driven controls, and modal interactions. Preserve the existing dirty local/temp worktree files outside this refactor.

**Ask First:** Stop before changing database schema, package pricing/session semantics, salary multiplier logic, financial reporting, or converting package CRUD to a new server-action contract. Stop before deleting the default package sync behavior or changing how package materials are saved.

**Never:** Do not introduce `any` for newly extracted DB payload/page types. Do not swallow new database errors silently. Do not refactor unrelated dashboard pages or inventory services in this slice. Do not touch `supabase/.temp/*` or `.claude/settings.local.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load services | User opens `/dashboard/services` | Packages are loaded, sorted by name, and rendered with current filters/pagination behavior | Fetch errors show toast and keep the page usable without pretending the request succeeded |
| Edit package materials | Existing package has package material rows | Modal opens with package fields and material rows populated; add/update/remove row behavior remains available | Material fetch failures show toast and reset only material loading state |
| Submit package | User creates or updates a package using current modal | Existing package insert/update and material upsert paths remain functionally equivalent | Supabase/action errors surface through current toast paths and do not create new silent success states |
| Filter and paginate | User changes search or status filter | Current page resets to page 1 and paginated list reflects filtered packages | No special error path |

</frozen-after-approval>

## Code Map

- `src/app/dashboard/services/page.tsx` -- current monolithic Services client page; target for removing state/actions/import clutter while keeping UI markup.
- `src/app/dashboard/services/types.ts` -- new local typed aliases for packages, inventory items, filters, modal mode, and material rows.
- `src/app/dashboard/services/constants.ts` -- new local constants for page size, initial form defaults, and default package seed data if extraction stays reviewable.
- `src/app/dashboard/services/hooks/useServicesPageState.ts` -- new local hook for loading packages/inventory items, modal state, material row handlers, CRUD handlers, filters, and pagination.
- `src/app/dashboard/inventory/hooks/useInventoryPageState.ts` -- reference pattern for page state extraction and typed DB interactions.
- `src/services/inventory-actions.ts` -- existing package material/inventory item functions used by Services page.
- `src/types/database.types.ts` -- generated Supabase table types for package and inventory item aliases.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/services/types.ts` -- add local exported types for service packages, inventory items, material rows, filters, modal mode, and form status -- removes loose page-level shapes.
- [x] `src/app/dashboard/services/constants.ts` -- add `PAGE_SIZE`, blank form factory/defaults, and any extracted seed constants that are safe to move without behavior changes -- reduces magic values in the page/hook.
- [x] `src/app/dashboard/services/hooks/useServicesPageState.ts` -- move current state, effects, load helpers, modal handlers, material row handlers, submit/delete/toggle/sync handlers, and derived pagination values into a hook -- isolates behavior from JSX.
- [x] `src/app/dashboard/services/page.tsx` -- replace local state/action logic with hook destructuring and remove unused imports -- leaves page focused on rendering.
- [x] `docs/DEVELOPMENT_LOG.md` -- append a concise entry documenting the Services page refactor slice and verification commands.

**Acceptance Criteria:**
- Given the current services page, when the refactor is complete, then `page.tsx` no longer owns data loading, mutation handlers, modal form state, or pagination derivation.
- Given an existing package, when edit modal opens, then package fields and material rows are still populated through the extracted hook.
- Given search/status filters change, when pagination was on another page, then the current page resets to 1.
- Given TypeScript compiles, when reviewing new Services modules, then new DB-facing aliases use generated `Database` types instead of `any`.

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- passed.
- `npx.cmd eslint src/app/dashboard/services/page.tsx src/app/dashboard/services/types.ts src/app/dashboard/services/constants.ts src/app/dashboard/services/hooks/useServicesPageState.ts` -- passed.

## Suggested Review Order

**Entry Point**

- Page now delegates behavior to the extracted hook.
  [`page.tsx:68`](../../src/app/dashboard/services/page.tsx#L68)

**State And Mutations**

- Hook owns service list state, modal state, and material row state.
  [`useServicesPageState.ts:114`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L114)

- Default package sync remains local but now uses typed seed payloads.
  [`useServicesPageState.ts:31`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L31)

- Shared tenant lookup avoids duplicated auth/profile fetch logic.
  [`useServicesPageState.ts:293`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L293)

- Submit flow keeps package save and material upsert behavior together.
  [`useServicesPageState.ts:348`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L348)

- Filter and pagination derivation moved out of JSX.
  [`useServicesPageState.ts:427`](../../src/app/dashboard/services/hooks/useServicesPageState.ts#L427)

**Supporting Types**

- Services page DB shapes now use generated Supabase types.
  [`types.ts:3`](../../src/app/dashboard/services/types.ts#L3)

- Page constants isolate pagination and blank form defaults.
  [`constants.ts:3`](../../src/app/dashboard/services/constants.ts#L3)

**Peripherals**

- Development log records the slice and verification commands.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
