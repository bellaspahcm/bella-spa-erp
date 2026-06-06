---
title: Fix Inter-branch Clearing Table Grants
type: bugfix
created: 2026-06-06
status: done
area: finance-reconciliation
---

# Intent

Stop the Finance Reconciliation page from showing `permission denied for table inter_branch_clearing_records` when loading inter-branch clearing data.

# Root Cause

`inter_branch_clearing_records` had RLS policies, but the `authenticated` role did not have table-level privileges. PostgreSQL checks table privileges before evaluating RLS policies, so branch admins and accountants could be blocked before tenant-scoped policies had a chance to apply.

# Change

- Add migration `20260606113000_grant_inter_branch_clearing_records_access.sql`.
- Revoke all access from `anon`.
- Grant `SELECT, INSERT, UPDATE` to `authenticated`.
- Grant `SELECT, INSERT, UPDATE, DELETE` to `service_role`.
- Keep existing RLS policies as the real tenant/HQ boundary.

# Verification

- Add SQL regression coverage in `src/__tests__/inter-branch-clearing.test.ts` so future changes cannot leave the table with RLS policies but no table grants.
