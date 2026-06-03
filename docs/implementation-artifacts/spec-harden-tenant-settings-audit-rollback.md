---
title: 'Harden tenant settings audit rollback'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
context:
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-tenant-actions-typing.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `saveTenantSettings` updates the tenant row before writing the audit log. If audit logging fails, the setting change remains in the database without a required audit trail, and the failure currently depends on the outer catch instead of a compensating rollback contract.

**Approach:** Snapshot the tenant row before mutation, treat audit logging as a required side effect, and restore the settings-controlled tenant fields if audit fails. Fail closed when the snapshot cannot be loaded, and do not revalidate settings unless update and audit both succeed.

## Boundaries & Constraints

**Always:** Keep the public `saveTenantSettings` input/output shape stable. Use generated `Database['public']['Tables']['tenants']` types for tenant rows and update payloads. Return explicit failures for snapshot, update, audit, and rollback errors. Preserve current service-role fallback behavior for settings reads/updates where applicable.

**Ask First:** Changing tenant schema, changing settings UI fields, replacing `recordAuditLog`, introducing a database transaction/RPC, or broadening into HQ subscription/quota actions.

**Never:** Do not return success when audit logging fails. Do not revalidate `/dashboard/settings` after failed update/audit/rollback. Do not overwrite fields outside the settings surface during rollback.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Success | Snapshot succeeds, tenant update returns row, audit succeeds | Return success and revalidate `/dashboard/settings` | No error |
| Snapshot failure | Tenant snapshot query errors or returns no row | No update/audit/revalidate | Return explicit snapshot failure |
| Update failure | Snapshot succeeds, update returns DB error or no row | No audit/revalidate | Return update failure |
| Audit failure | Update succeeds, `recordAuditLog` throws | Restore settings-controlled fields from snapshot | Return audit failure; include rollback failure if restore fails |

</frozen-after-approval>

## Code Map

- `src/services/tenant-actions.ts` -- tenant settings read/write server actions and audit boundary.
- `src/__tests__/tenant-actions.test.ts` -- new focused service tests for snapshot, update, audit, rollback, and revalidation behavior.
- `src/services/audit-actions.ts` -- context only: `recordAuditLog` throws on audit insert failure.
- `docs/DEVELOPMENT_LOG.md` -- append dated implementation and verification evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/tenant-actions.ts` -- add tenant snapshot and settings-surface rollback helpers.
- [x] `src/services/tenant-actions.ts` -- wrap audit failure with rollback and no-revalidate failure response.
- [x] `src/__tests__/tenant-actions.test.ts` -- cover success, snapshot failure, update failure, audit rollback, and rollback failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- add hạng mục log cho future agent handoff.

**Acceptance Criteria:**
- Given tenant snapshot fails, when `saveTenantSettings` runs, then no update, audit, or revalidate call occurs.
- Given audit logging fails after update, when rollback succeeds, then the tenant is restored using the snapshot and the action returns failure.
- Given audit logging fails and rollback fails, when the action returns, then the error includes both the audit failure and rollback failure.
- Given update and audit succeed, when the action returns success, then revalidation happens after audit.

## Spec Change Log

## Design Notes

Rollback restores only the settings-controlled fields plus `updated_at`: `name`, contact/email/address, QR fields, salary config, and role permissions. Other tenant operational fields such as subscription tier, status, royalty configuration, Zalo credentials, and GPS threshold are outside this settings action and are intentionally not overwritten by this slice.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/tenant-actions.test.ts --runInBand` -- expected: tenant action tests pass.
- `npx.cmd tsc --noEmit --incremental false` -- expected: no TypeScript errors.
- `npx.cmd eslint src/services/tenant-actions.ts src/__tests__/tenant-actions.test.ts` -- expected: no ESLint errors.
- `npm.cmd test -- --runInBand` -- expected: full Jest suite passes.
- `npm.cmd run build` -- expected: production build succeeds.
