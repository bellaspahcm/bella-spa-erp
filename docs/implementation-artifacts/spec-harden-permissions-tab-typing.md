---
title: 'Harden Permissions Tab Typing'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
---

# Harden Permissions Tab Typing

## Intent

**Problem:** `PermissionsTab` still used loose `any` state and updater callbacks for tenant role permissions, despite the server action now accepting typed JSON payloads.

**Approach:** Derive role/module literal types from the UI catalogs, move default permissions into a typed constant, guard JSON loaded from tenant settings, and keep permission updates typed end to end.

## Suggested Review Order

- [../../src/app/dashboard/settings/PermissionsTab.tsx](../../src/app/dashboard/settings/PermissionsTab.tsx) - confirm the permission matrix uses typed role/module ids and safely merges persisted JSON.
- [spec-harden-tenant-actions-typing.md](spec-harden-tenant-actions-typing.md) - prior boundary change that made `role_permissions` a generated `Json` payload.

## Verification

- `npm.cmd run lint -- src/app/dashboard/settings/PermissionsTab.tsx` - passed, 0 warnings.
- `npx.cmd tsc --noEmit --pretty false` - passed.

## Review Notes

- No new database operation was added.
- The save path still calls `saveTenantSettings({ role_permissions: permissions })`.
- Unknown role/module keys or non-boolean values from persisted JSON are ignored instead of merged into UI state.
