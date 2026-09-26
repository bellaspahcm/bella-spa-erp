# ARCHITECTURE GATE RESULT - BELLA HAIRCUT GO-LIVE

Status: PASS for minimum Haircut operational flow evidence.

## Problem / Non-Goals

Goal: begin Haircut Go-Live from `main@352b633` by reconnecting the minimum viable operational flow to existing canonical capabilities.

Current slice: real operational flow proof using existing Beauty OS capabilities.

Non-goals:
- Do not reopen PR #152 safety findings unless new regression evidence appears.
- Do not create schema, RPC, API, framework, or adapter.
- Do not restore Inventory, Executive, product_key, Finance Reconciliation, or nonessential presentation surfaces in this slice.
- Do not redesign Haircut UI.

## Truth And Source Of Truth

- Product identity: Product Registry resolves `bella_haircut` as Haircut product; tenant module remains `beauty_spa`.
- Booking runtime data: `getCalendarSessions`, `getCachedBookingsForPage`, `getSessionLogs`.
- Booking writes: `createSessionLog`, `updateSessionLog`, `rescheduleSession`, `updateBooking`, `checkBookingConflicts`.
- Customer writes: `createCustomer`.
- Session completion: `completeSession`.
- Remaining payment writes: `recordRemainingPayment` via `record_remaining_payment_atomic`.
- Payment snapshot / QR: `getBookingDetailsWithPayment` plus shared payment rules.

## Ownership

- Customer / booking / session lifecycle: Beauty OS / order services.
- Haircut product: presentation and product-specific packaging only.
- Finance Reconciliation and nonessential dashboard restoration: deferred until their canonical identity mapping is proven.

## Capability Map

Required for this slice:
- Create a real customer.
- Create a real booking/package relationship.
- Read real sessions/bookings.
- Create schedule for a real booking.
- Assign/reassign KTV.
- Update session status/resource/notes/date/time.
- Complete a real session with actual performer persisted.
- Consume package/session usage exactly once.
- Record remaining payment exactly once with retry-safe idempotency.
- Read back persisted state after writes.
- Reject cross-tenant write attempts.
- Open QR from real booking.

Deferred:
- Commission/payroll publication.
- Finance Reconciliation.
- Inventory and Executive dashboards.
- product_key contract repair.

## Reuse Analysis

Existing generic bookings, sessions, and salary pages already consume real `session_logs` / `bookings` / salary data and invoke canonical order/payroll actions. Haircut previously routed to protected static/read-only redesign surfaces from the safety checkpoint.

Minimum reuse path: route Haircut schedule/session/payroll views to the existing canonical Beauty OS surfaces, then prove one persisted operational flow using existing actions and database read-back.

## Boundary & Data Flow

UI -> hooks:
`BookingsPageHeader`, `BookingsTimelineGrid`, `BookingsDayTimelineList`, `BookingDayDetailModal`, `BookingCreateScheduleModal`

Hooks -> services:
`useBookingsPageData`, `useBookingsPageActions`

Services -> persistence:
`bookings`, `session_logs`, `booking_resources`, related customer/package/payment joins.

Operational flow proof:
`createCustomer` -> `createBooking` -> `updateSessionLog` -> `completeSession` -> `recordRemainingPayment` -> persisted read-back from `customers`, `bookings`, `session_logs`, `revenue`.

## Change Authority

Authorized layers:
- Haircut product routing/presentation consumer.
- Existing order payment idempotency handling for a proven retry blocker.
- Regression/source guard tests for Haircut Go-Live routing.
- Real database E2E test for the minimum operational flow.

Not authorized:
- Database schema.
- New canonical order/finance/payroll/package contracts.
- Cross-product architecture.

## UI -> Contract Reconciliation

- Static Haircut timeline cards: DEFERRED for Go-Live, because they are not canonical operational entities.
- Generic timeline sessions: MATCH, because every displayed card has `session_log.id` and `booking_id`.
- Detail modal actions: MATCH for this slice, because writes route through existing order actions and conflict checks.
- Create schedule modal: MATCH for this slice, because it requires a real booking id before session creation.
- Session completion: MATCH, because `completeSession` persists `completed_by_ktv_id`, updates booking usage, and rejects duplicate completion.
- Remaining payment: MATCH after minimal fix, because `recordRemainingPayment` now honors an existing tenant-scoped manual payment idempotency key before amount validation blocks a retry against a fully paid booking.
- Tenant isolation: MATCH for the tested flow, because tenant B action attempts cannot update tenant A booking/session/payment state.

## Minimal Implementation Plan

1. Remove Haircut-only static operational branches for schedule/session/payroll surfaces.
2. Let Haircut use existing real bookings/sessions/salary flows.
3. Add source guards proving Haircut no longer routes operational actions through static redesign components.
4. Add a real database E2E proof for customer -> booking -> assignment -> check-in -> completion -> payment -> reload -> tenant isolation.
5. Fix only the proven payment retry blocker by honoring existing tenant-scoped idempotency metadata before amount validation.
6. Run targeted tests, ESLint, affected typecheck, diff check, architecture guard.

## Verification Plan

- Targeted regression/source guard test.
- Real database Haircut operational flow test.
- Existing payment idempotency regression test.
- Changed-file ESLint.
- `npm run typecheck:affected`.
- `git diff --check`.
- `npm run arch:guard`.
