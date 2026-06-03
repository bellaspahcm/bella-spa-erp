---
title: Align Lab Runtime Schema
type: one-shot
created: 2026-06-03
status: done
route: one-shot
---

# Align Lab Runtime Schema

## Intent

Problem: The lab Vercel deployment authenticated successfully, but runtime routes failed when Supabase/PostgREST could not resolve relationships or columns used by the current application code.

Approach: Add idempotent Supabase compatibility migrations for the missing booking/package relationship, booking/session UI columns, HR user fields, session confirmation flag, and salary record workflow columns/statuses. Keep changes schema-only so the deployed app can recover without changing customer-facing application logic.

## Evidence

- Supabase lab project only; production project was not targeted.
- Applied migrations with `supabase db push`.
- Playwright smoke passed against `https://bella-erp-core-platform.vercel.app` for:
  - `/dashboard`
  - `/dashboard/bookings`
  - `/dashboard/finance`
  - `/dashboard/salary`
  - `/dashboard/services`
  - `/dashboard/accounting/readiness`
  - `/hq`
  - `/hq/financial-overview`
- Verification passed:
  - `git diff --check`
  - `npx.cmd tsc --noEmit --incremental false`

## Suggested Review Order

1. `supabase/migrations/20260603090000_add_bookings_package_fk.sql` - confirm PostgREST relationship fix is scoped to `bookings.package_id -> packages.id`.
2. `supabase/migrations/20260603091000_add_booking_session_ui_columns.sql` - confirm booking/session UI columns match generated types and active selects.
3. `supabase/migrations/20260603092000_add_user_hr_profile_columns.sql` - confirm HR salary fields are nullable/defaulted safely for existing users.
4. `supabase/migrations/20260603093000_add_session_confirmation_flag.sql` - confirm session confirmation defaults to false until salary workflows confirm/finalize.
5. `supabase/migrations/20260603094000_align_salary_records_runtime_columns.sql` - confirm salary workflow columns and allowed statuses match current salary actions.
