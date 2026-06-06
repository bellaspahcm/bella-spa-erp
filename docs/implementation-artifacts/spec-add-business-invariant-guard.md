---
status: done
date: 2026-06-06
---

# Add Business Invariant Guard

## Intent

Add an automated read-only guard that checks real Supabase business data after the existing access and RPC smoke checks. The goal is to catch data states that are technically reachable but operationally wrong, such as a paid deposit booking still asking for deposit, unbalanced posted journals, salary draft session drift, or invalid inventory consumption.

## Scope

- Added `scripts/check-business-invariants.cjs`.
- Added `npm run db:business:check`.
- Added the guard to `.github/workflows/quality-security.yml`.
- Added focused Jest coverage in `src/__tests__/business-invariants-check.test.ts`.
- Updated booking creation so a confirmed up-front deposit creates a `booked` booking instead of leaving it in `deposit_pending`.
- Added migration `20260606133000_backfill_paid_deposit_bookings.sql` to repair existing bookings where confirmed deposit already covers the configured deposit target.
- Added migration `20260606134000_backfill_completed_session_business_events.sql` to classify historical completed sessions with `SESSION_REVENUE_RECOGNIZED` metadata.

## Guard Groups

- Payment, booking, and revenue:
  - confirmed package revenue must point to a booking.
  - revenue tenant must match booking tenant.
  - a booking with enough confirmed deposit must not remain `deposit_pending`.
  - overpayment is reported as a non-blocking warning.
- Accounting ledger:
  - posted journals must have at least two lines.
  - posted debit and credit totals must balance.
  - invalid line amounts and exhausted/dead outbox events are critical.
- Salary:
  - one salary record per tenant, KTV, and month.
  - no negative salary components.
  - stored total salary must match stored components.
  - current-month draft session count must match completed sessions with package multipliers.
- Inventory:
  - stock cannot be negative.
  - session consumption logs must reduce stock.
  - consumption logs must point to completed sessions.
  - completed sessions with material rules must have consumption logs.
- Accounting metadata:
  - `POSTING_FAILED` is critical.
  - missing business event type or `NEEDS_REVIEW` is reported as warning.

## CI Behavior

The check is optional when Supabase credentials are missing, matching the existing Supabase smoke checks. With secrets configured, CI runs the guard against live data and fails on critical findings. Warnings are printed but do not fail by default.
