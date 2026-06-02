---
title: 'Harden Tenant Actions Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Tenant Actions Typing

## Intent

**Problem:** `src/services/tenant-actions.ts` still used loose `any` typing for tenant JSON config, tenant update payloads, and caught errors.

**Approach:** Type the Supabase update payload with the generated tenant `Update` schema, type JSON config inputs with the generated `Json` type, and handle caught exceptions as `unknown`.

## Changed Files

- `src/services/tenant-actions.ts` - replaced loose action types with `Database['public']['Tables']['tenants']['Update']`, `Json`, and a safe error message helper.
- `src/types/domain.ts` - marked `TenantSalaryConfig` as JSON-compatible so settings callers can pass the existing domain object into the server action without casts.

## Review Notes

- Database update payload now fails at compile time if an invalid tenant column is added.
- No database execution error was swallowed or converted to success.
- `recordAuditLog` and `revalidatePath('/dashboard/settings')` behavior is unchanged.
- Boundary still accepts the existing settings page object shape; no UI behavior changed.

## Verification

- `npm.cmd run lint -- src/services/tenant-actions.ts` - passed.
- `npx.cmd tsc --noEmit --pretty false` - passed.

## Residual Risk

No direct Jest suite exists for `tenant-actions`; this refactor is covered by lint and full TypeScript validation only.
