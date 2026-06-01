---
title: 'Batch Harden Promotion Actions Audit Rollback'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'c873f1c5'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `createPromotion`, `togglePromotionActive`, and `deletePromotion` mutated `promotions` before audit logging without compensating rollback. Update/delete also lacked consistent tenant scoping, so a failed audit could leave unaudited changes and a malformed request could affect records outside the current branch boundary.

**Approach:** Treat audit logging as a required side effect. Snapshot existing promotion rows before update/delete, scope all mutations by `tenant_id`, and compensate completed mutations when audit logging fails.

## Boundaries & Constraints

**Always:** Use generated Supabase table types for promotion insert/update payloads. Return explicit failures on DB/audit/rollback errors. Revalidate settings only after mutation and audit both succeed.

**Ask First:** Schema changes, database transaction/RPC rewrites, or changes to the settings UI behavior.

**Never:** Do not swallow audit failures, do not delete/update promotions without tenant filters, and do not return success if rollback is required but fails.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Create succeeds | Valid payload and tenant | Insert promotion, audit `INSERT`, revalidate settings | N/A |
| Create audit fails | Insert succeeds, audit throws | Delete inserted promotion and return failure | Include rollback failure if delete fails |
| Toggle succeeds | Existing promotion in current tenant | Snapshot old row, update status by id+tenant, audit old/new data, revalidate | N/A |
| Toggle snapshot missing | Promotion not in tenant | Return failure before mutation | No audit/revalidate |
| Toggle audit fails | Update succeeds, audit throws | Restore old `is_active` and `updated_at`, return failure | Include rollback failure if restore fails |
| Delete succeeds | Existing promotion in current tenant | Snapshot row, delete by id+tenant, audit old data, revalidate | N/A |
| Delete audit fails | Delete succeeds, audit throws | Reinsert deleted snapshot and return failure | Include rollback failure if reinsert fails |

</frozen-after-approval>

## Code Map

- `src/services/promotions-actions.ts` -- Promotion server actions, tenant scoping, audit payload mapping, and rollback helpers.
- `src/__tests__/promotions.test.ts` -- Scripted Supabase mock covering mutation order, audit payloads, tenant filters, and rollback side effects.
- `docs/DEVELOPMENT_LOG.md` -- Dated batch log and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/promotions-actions.ts` -- Add typed promotion row/insert/update helpers and audit JSON mapping.
- [x] `src/services/promotions-actions.ts` -- Add create/update/delete rollback handling for audit failures.
- [x] `src/services/promotions-actions.ts` -- Enforce tenant filters on update/delete and snapshot reads.
- [x] `src/__tests__/promotions.test.ts` -- Replace thin chain mock with scripted query mock and assert side effects.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add dated development log entry.

**Acceptance Criteria:**
- Given create audit logging fails, then the inserted promotion is deleted and no settings revalidation occurs.
- Given toggle audit logging fails, then the original status/timestamp are restored and no settings revalidation occurs.
- Given delete audit logging fails, then the deleted promotion snapshot is reinserted and no settings revalidation occurs.
- Given update/delete runs, then every mutation is filtered by both `id` and `tenant_id`.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/promotions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/services/promotions-actions.ts src/__tests__/promotions.test.ts` -- pass.

**Suggested Review Order:**
- `src/services/promotions-actions.ts:9` -- generated promotion types and rollback helpers.
- `src/services/promotions-actions.ts:161` -- create rollback on audit failure.
- `src/services/promotions-actions.ts:240` -- tenant-scoped toggle with snapshot/restore.
- `src/services/promotions-actions.ts:313` -- tenant-scoped delete with snapshot/reinsert.
- `src/__tests__/promotions.test.ts:36` -- scripted Supabase mock and rollback assertions.
