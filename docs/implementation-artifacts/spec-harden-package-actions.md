---
title: 'Harden Package Actions'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '61b6810ac82681373abfb6e270b8056ff7ae60f7'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `src/services/package-actions.ts` still accepts loose `any` package payloads and has only partial transaction-safety coverage around package create/update/delete audit rollback. This is risky because packages feed booking, Services UI, inventory material configuration, and KTV session multiplier rules.

**Approach:** Harden the package Server Actions without changing their public names or broad return contract. Replace loose payload handling with explicit input and Supabase generated DB payload types, preserve existing audit rollback behavior, and extend Jest coverage for package CRUD side effects and failure propagation.

## Boundaries & Constraints

**Always:** Keep `getPackages`, `createPackage`, `updatePackage`, and `deletePackage` export names stable. Use `Database['public']['Tables']['packages']['Insert' | 'Update' | 'Row']` for DB payloads. Preserve package fields used today: `name`, `price`, `duration`, `total_sessions`, `details`, `offer`, `ktv_commission`, `status`, and any tenant/pass-through fields already accepted by callers. Return explicit `{ error }` or `{ data }`/`{ success }` statuses for mutation failures rather than pretending success. Tests must assert side effects including insert/update/delete and rollback writes when audit logging fails.

**Ask First:** Stop before changing package schema, introducing new required fields, changing session multiplier calculation rules, changing Services page client behavior, or moving package actions into a new DAL/module split. Stop before converting all callers to a new API shape.

**Never:** Do not use `any` for new package action input, DB payload, or test mock DB records. Do not silently swallow Supabase or audit errors. Do not modify salary, booking completion, inventory material consumption, or financial reporting in this slice. Do not touch `supabase/.temp/*` or `.claude/settings.local.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create package succeeds | Valid package input with numeric or formatted price/commission | Inserts typed package payload, records INSERT audit, revalidates Services path, returns inserted row | Insert/audit failures return explicit error |
| Create audit fails | Insert succeeds but audit throws | Deletes inserted package as rollback and returns audit error | Test asserts delete rollback side effect |
| Update package succeeds | Existing package row and update input | Fetches old package, updates typed payload, records UPDATE audit with old/new data, revalidates | Fetch/update/audit failures return explicit error |
| Update audit fails | Update succeeds but audit throws | Restores previous package row and returns audit error | Test asserts rollback update side effect |
| Delete audit fails | Delete succeeds but audit throws | Reinserts old package row and returns audit error | Test asserts rollback insert side effect |
| List packages fails | Supabase select returns error | Throws `Failed to fetch packages: ...` | Existing test remains valid |

</frozen-after-approval>

## Code Map

- `src/services/package-actions.ts` -- target Server Action file with loose `any` payloads, package CRUD, audit logging, rollback, and revalidation.
- `src/__tests__/package-actions.test.ts` -- existing transaction-safety tests for create rollback and get failure propagation; needs broader side-effect assertions.
- `src/types/database.types.ts` -- generated Supabase `packages` table row/insert/update types.
- `src/services/audit-actions.ts` -- existing `recordAuditLog` side effect used by package CRUD actions.
- `src/app/dashboard/services/hooks/useServicesPageState.ts` -- context: Services UI now has local browser CRUD, so this slice must not depend on caller migration.
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` -- relevant Next Server Actions guidance: actions are reachable by POST and must validate/auth inside server functions.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/package-actions.ts` -- define typed package action input helpers and typed DB payload normalization -- removes loose `any` while preserving current accepted field names.
- [x] `src/services/package-actions.ts` -- harden create/update/delete error paths and rollback checks -- ensures Supabase rollback failures are returned explicitly instead of silently ignored.
- [x] `src/__tests__/package-actions.test.ts` -- replace loose mock records with typed fixtures and chainable Supabase mocks -- enables side-effect assertions without `any`.
- [x] `src/__tests__/package-actions.test.ts` -- add tests for update audit rollback, delete audit rollback, and DB/audit failure propagation -- covers the edge-case matrix.
- [x] `docs/DEVELOPMENT_LOG.md` -- append the package-actions hardening entry and verification commands.

**Acceptance Criteria:**
- Given package CRUD actions, when DB insert/update/delete payloads are built, then TypeScript checks them against generated Supabase package types.
- Given audit logging fails after a create, update, or delete mutation, when the action returns, then the compensating rollback DB write has been attempted and the returned result contains the failure.
- Given rollback DB write fails, when the action returns, then the rollback failure is included in the explicit error rather than hidden.
- Given `getPackages` query fails, when called, then it still throws a clear fetch error.

## Spec Change Log

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- passed.
- `npx.cmd eslint src/services/package-actions.ts src/__tests__/package-actions.test.ts` -- passed.
- `npm.cmd test -- src/__tests__/package-actions.test.ts --runInBand` -- passed.

## Suggested Review Order

**Action Contract**

- Input contract replaces loose package payloads.
  [`package-actions.ts:11`](../../src/services/package-actions.ts#L11)

- Insert normalization builds typed DB payloads.
  [`package-actions.ts:58`](../../src/services/package-actions.ts#L58)

- Update normalization only includes provided fields.
  [`package-actions.ts:76`](../../src/services/package-actions.ts#L76)

**Rollback Safety**

- Create audit failure deletes the inserted package.
  [`package-actions.ts:117`](../../src/services/package-actions.ts#L117)

- Update audit failure restores the old package row.
  [`package-actions.ts:129`](../../src/services/package-actions.ts#L129)

- Delete audit failure reinserts the old package row.
  [`package-actions.ts:143`](../../src/services/package-actions.ts#L143)

**CRUD Flows**

- Create keeps insert, audit, rollback, and revalidate together.
  [`package-actions.ts:173`](../../src/services/package-actions.ts#L173)

- Update fetches old state before mutation for audit/rollback.
  [`package-actions.ts:206`](../../src/services/package-actions.ts#L206)

- Delete preserves old state before audit-sensitive removal.
  [`package-actions.ts:257`](../../src/services/package-actions.ts#L257)

**Tests**

- Chainable mock records DB side effects for assertions.
  [`package-actions.test.ts:42`](../../src/__tests__/package-actions.test.ts#L42)

- Create success asserts typed insert and audit side effects.
  [`package-actions.test.ts:154`](../../src/__tests__/package-actions.test.ts#L154)

- Rollback cases cover create, update, and delete audit failures.
  [`package-actions.test.ts:184`](../../src/__tests__/package-actions.test.ts#L184)

- Development log records the hardening slice and verification.
  [`DEVELOPMENT_LOG.md:10`](../DEVELOPMENT_LOG.md#L10)
