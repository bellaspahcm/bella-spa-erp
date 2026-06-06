---
status: done
date: 2026-06-06
owner: Codex
---

# Supabase RPC Grant Policy

## Intent

Prevent production-only Supabase RPC failures caused by missing function execution grants after a migration creates or replaces a critical function.

This complements the table access smoke check. Table grants catch errors like `permission denied for table ...`; RPC grants catch missing `GRANT EXECUTE ON FUNCTION ...` before deployment.

## Change

- Added `scripts/check-supabase-rpc-grants.cjs`.
- Added `npm run db:rpc-grants:check`.
- Added CI step `Supabase RPC grant policy`.
- Added migration `20260606124500_grant_critical_rpc_execute.sql`.
- Added unit coverage in `src/__tests__/supabase-rpc-grants-check.test.ts`.

## Covered RPC Groups

- Customer chat and reconciliation lookups.
- Finance and TT133 accounting reports.
- Accounting outbox worker functions.
- Accounting period close/reopen functions.
- Salary and attendance calculation reports.
- Subscription quota and renewal functions.
- Portal remaining-payment recording.

## Rule

Any critical Supabase RPC called by app code must have an explicit migration-level grant for the expected roles, usually `authenticated` and `service_role`. Internal worker functions can be limited to `service_role`.
