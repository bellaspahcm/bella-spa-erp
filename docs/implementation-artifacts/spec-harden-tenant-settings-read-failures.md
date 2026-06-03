---
title: 'Harden tenant settings read failures'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '33886a2af3cd6564a9d8780f5f45e0cdbf614199'
context:
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-tenant-settings-audit-rollback.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `getTenantSettings` still logs database read errors and returns `null`, so callers can mistake a failed tenant settings load for an empty or missing settings state. This violates the project rule that database failures must not be silent.

**Approach:** Keep `null` only for the valid "current user has no tenantId" case, and make actual tenant lookup failures throw explicit errors. Reuse the existing tenant snapshot helper so auth-client reads and service-role fallback behave the same as the hardened save path.

## Boundaries & Constraints

**Always:** Preserve the public `getTenantSettings` call shape for current UI callers. Keep service-role fallback for tenant reads. Use generated tenant row typing through the existing snapshot helper. Keep caller-level `try/catch` behavior responsible for UI notifications.

**Ask First:** Changing tenant schema, changing role-permission UX, changing sidebar permission fallback rules, or replacing Supabase read helpers with a new repository layer.

**Never:** Do not swallow tenant query errors with `console.error` and `return null`. Do not turn a real missing tenant row into a successful empty settings state when a tenantId exists. Do not broaden this slice into settings writes or HQ quota actions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No tenantId | Current user exists but has no `tenant_id` | Return `null` | No DB query required |
| Auth read success | Auth Supabase client returns tenant row | Return tenant row | No error |
| Auth read failure without service role | Auth read returns DB/RLS error and no admin key exists | Reject with explicit `getTenantSettings` error | Caller catch shows existing UI error |
| Auth read failure with admin success | Auth read fails, service-role fallback returns row | Return tenant row | Auth error is recovered by fallback |
| Admin fallback failure | Auth read fails and admin fallback fails | Reject with fallback error | No silent null |

</frozen-after-approval>

## Code Map

- `src/services/tenant-actions.ts` -- tenant settings server action; contains `getTenantSettings`, `fetchTenantSnapshot`, and service-role fallback.
- `src/app/dashboard/settings/page.tsx` -- settings page caller; already catches settings load failures and shows toast.
- `src/app/dashboard/settings/PermissionsTab.tsx` -- permissions caller; already catches settings load failures and shows toast.
- `src/components/layout/sidebar.tsx` -- sidebar caller; already catches permission load failures and falls back to static role rules.
- `src/__tests__/tenant-actions.test.ts` -- focused Jest coverage for tenant settings read/write behavior.
- `docs/DEVELOPMENT_LOG.md` -- implementation handoff log.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/tenant-actions.ts` -- replace silent read error handling in `getTenantSettings` with explicit throw semantics while preserving no-tenant null.
- [x] `src/__tests__/tenant-actions.test.ts` -- add read-path tests for no tenantId, auth success, auth failure, admin fallback success, and admin fallback failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- append dated note with behavior and verification evidence.
- [x] `docs/implementation-artifacts/spec-harden-tenant-settings-read-failures.md` -- mark completed after verification.

**Acceptance Criteria:**
- Given no current `tenant_id`, when `getTenantSettings` runs, then it returns `null` and does not issue a tenant query.
- Given a tenant read error and no service role fallback, when `getTenantSettings` runs, then it rejects with an explicit error instead of returning `null`.
- Given auth read fails but admin fallback succeeds, when `getTenantSettings` runs, then it returns the tenant row.
- Given auth read and admin fallback both fail, when `getTenantSettings` runs, then it rejects and callers can surface the failure.

## Spec Change Log

## Design Notes

`fetchTenantSnapshot` is intentionally shared between read and write paths. The helper already encodes the tenant lookup contract: auth client first, service-role fallback when configured, explicit error text when no row exists. This keeps future tenant action changes from drifting between read and write semantics.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/tenant-actions.test.ts --runInBand` -- expected: tenant action tests pass.
- `npx.cmd tsc --noEmit --incremental false` -- expected: no TypeScript errors.
- `npx.cmd eslint src/services/tenant-actions.ts src/__tests__/tenant-actions.test.ts` -- expected: no ESLint errors.
- `npm.cmd test -- --runInBand` -- expected: full Jest suite passes.
- `npm.cmd run build` -- expected: production build succeeds.
