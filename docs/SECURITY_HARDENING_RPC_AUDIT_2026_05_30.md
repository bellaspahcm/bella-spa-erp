# RPC Permission Audit - 2026-05-30

## Scope

This audit covers anonymous (`anon`) execution privileges found in Supabase migrations.
The first hardening migration is intentionally narrow: it only revokes `anon` execute
from accounting/reporting RPCs and keeps `authenticated` plus `service_role`.

## Revoked From `anon`

Migration: `supabase/migrations/20260530040000_revoke_anon_accounting_rpc.sql`

Functions:

- `get_reconciliation_report(UUID, DATE, DATE)`
- `get_consolidated_pnl(DATE, DATE)`
- `get_cash_flow_statement(UUID, DATE, DATE)`
- `preview_closing_entries(UUID)`
- `generate_closing_entries(UUID)`
- `close_accounting_period(UUID)`
- `reopen_accounting_period(UUID)`
- `acc_balance_at(UUID, TEXT, DATE)`
- `ensure_open_period(UUID, DATE)`

## Compatibility Check

Known application call sites use authenticated server actions or service-role server jobs:

- `src/services/accounting/reports.ts`
- `src/services/accounting/periods.ts`
- `src/services/hq-actions.ts`
- `src/services/accounting-engine.ts`
- `src/services/ai/agents/cfo.ts`
- `src/app/api/cron/ai-autopilot/route.ts`

No public booking, customer portal, or payment webhook flow calls these RPCs as `anon`.

## Deferred

Older migrations also grant broad `anon` privileges on tables/functions. Those should be
handled separately because public booking, promotions, chat, portal reviews, and webhook
flows may legitimately need anonymous access behind RLS or secret checks.

Do not revoke broad table privileges in the same change set as accounting RPC hardening.
