---
status: done
date: 2026-06-06
owner: Codex
---

# Supabase Data Access Smoke Check

## Intent

Catch production-only Supabase permission or grant regressions before deploy, especially errors like:

```text
permission denied for table inter_branch_clearing_records
```

## Change

- Added `scripts/check-supabase-data-access.cjs`.
- Added `npm run db:access:check`.
- Added CI step `Supabase data access smoke` after the migration drift check.
- Added unit coverage in `src/__tests__/supabase-data-access-check.test.ts`.

## Behavior

The script performs read-only `select=id&limit=1` checks through Supabase PostgREST for critical business tables:

- `customers`
- `bookings`
- `revenue`
- `expenses`
- `salary_records`
- `session_logs`
- `inventory_logs`
- `journal_entries`
- `journal_lines`
- `accounting_outbox`
- `accounting_review_queue`
- `inter_branch_clearing_records`

CI runs in optional mode. If Supabase credentials are not configured, the step skips. If credentials are configured, any table permission failure breaks the pipeline.

## Required CI Configuration

Set these GitHub values to make the smoke check active:

- `vars.NEXT_PUBLIC_SUPABASE_URL` or `secrets.SUPABASE_URL`
- `secrets.SUPABASE_SERVICE_ROLE_KEY` or `secrets.SUPABASE_SECRET_KEY`
