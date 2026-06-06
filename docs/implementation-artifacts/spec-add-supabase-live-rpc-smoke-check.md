---
status: done
date: 2026-06-06
owner: Codex
---

# Supabase Live RPC Smoke Check

## Intent

Verify that critical Supabase reporting RPCs can execute against the real database in CI, not just that their tables and grants exist.

This catches production-only failures such as:

- wrong SQL after a migration,
- missing column/type drift,
- PostgREST schema-cache incompatibility,
- tenant-context failures,
- authorization branches that block service-role operational checks.

## Change

- Added `scripts/check-supabase-rpc-smoke.cjs`.
- Added `npm run db:rpc-smoke:check`.
- Added CI step `Supabase live RPC smoke`.
- Added unit coverage in `src/__tests__/supabase-rpc-smoke-check.test.ts`.

## Covered RPCs

The smoke check uses the service key, picks one active tenant, and calls read-only/reporting RPCs:

- `get_accounting_readiness`
- `preview_legacy_ledger_sync`
- `get_reconciliation_report`
- `get_salary_reconciliation_report`
- `get_ktv_leaderboard`
- `get_trial_balance`
- `get_income_statement`
- `get_cash_flow_statement`
- `get_consolidated_pnl`

## Safety

The script intentionally avoids mutating RPCs such as `sync_legacy_to_ledger_atomic`, `record_remaining_payment_atomic`, `close_accounting_period`, `reopen_accounting_period`, and outbox worker state transitions.

`get_salary_reconciliation_report` exercises the central salary calculation RPC internally while setting tenant context inside one database call, avoiding a separate session-context dependency in PostgREST.
