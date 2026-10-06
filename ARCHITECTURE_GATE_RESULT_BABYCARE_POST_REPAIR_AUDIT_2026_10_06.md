# ARCHITECTURE GATE RESULT - BabyCare Post-Repair Regression Audit
Date: 2026-10-06
Scope: BabyCare customer, booking, appointment/calendar presentation and mapping only
Status: PASS

## Process Gate

Problem: BabyCare DB evidence is correct for 2026-10-06, but Timeline KTV displayed the monthly range as today's appointments and treated assigned bookings as unassigned.

Truth / Source of Truth: `tenants.product_key = 'bella_babycare'`; appointment truth for booking calendar is `session_logs.assigned_date` joined to `bookings.assigned_ktv_id`, `customers`, packages, and KTV user. Verified read-only DB evidence: 2026-10-06 has 3 session logs, 3 assigned, 0 unassigned, 2 active KTV users.

Canonical Contract: `/dashboard/bookings` consumes `getCalendarSessions(...)`, which returns `TimelineSession` rows shaped as `session_logs` with nested `bookings`. `/dashboard/sessions` consumes `getSessionsWithDetails(...)`, which returns booking-level `SessionBooking`.

Ownership: Order/session services own booking and appointment reads. Customer services own customer detail/list reads. UI components own derived presentation counts, filters, labels, and selected-date display.

Boundary: No schema, migration, Core kernel, Healthcare, Education, Logistics, Finance, or sealed product change. Fix only stale UI consumer mapping and hard-coded UI counts.

Change Authority: User requested post-repair regression audit and confirmed fixing newly found bugs by root cause. Authorized layer is presentation/mapping for Customer, Booking, Calendar/Timeline.

## Product Manifest

Product: Bella Mommy Baby Care (`bella_babycare`)

Capabilities in scope:
- Customer list and customer detail
- Booking list/detail and KTV assignment
- Calendar appointments and Timeline KTV
- Cross-page record consistency

Out of scope:
- Schema migrations
- New APIs/RPCs
- Kernel/OS refactor
- Production data mutation
- Broader performance redesign

## Ownership Map

| Data / capability | Owner | UI consumer |
|---|---|---|
| Customers | Customer service / `customers` | `/dashboard/customers`, customer detail |
| Bookings | Order service / `bookings` | booking page, customer detail |
| Appointment sessions | Order service / `session_logs` | booking calendar, POS, timeline |
| KTV assignment | `bookings.assigned_ktv_id` | Timeline KTV, booking modal, customer detail |
| Session performer | `session_logs.completed_by_ktv_id` | history/performance display |

## Contract Dependency Map

`Product UI -> useBookingsPageData -> getCalendarSessions -> session_logs + bookings + customers + users`

`Product UI -> useCustomerDetailController -> getCustomerById/getBookingsByCustomerId -> customers + bookings + session_logs + revenue`

## UI -> Contract Reconciliation

| UI element | Expected contract | Backend reality | Conclusion |
|---|---|---|---|
| Timeline total today | Count rows where `assigned_date = selectedDate` | `getCalendarSessions` returns range rows | MAPPING BUG |
| Timeline unassigned | Missing `bookings.assigned_ktv_id` | KTV ID is nested under `bookings` | MAPPING BUG |
| Timeline KTV lanes | KTV IDs from props and nested booking assignment | Page had KTV list but did not pass it to timeline | MAPPING BUG |
| Month calendar appointments | `TimelineSession[]` rows | Component expected booking-level `session_logs[]` | MAPPING BUG |
| Customer detail tab counts | Derived from loaded customer/bookings/sessions/revenue | Several labels are hard-coded | UX BUG |

## Additive Migration Plan

None. No database changes authorized or required.

## Verification Gates Plan

1. Read-only DB evidence for BabyCare tenant
2. Static route/service census
3. Type contract audit for `as unknown as` / `as any`
4. Patch only stale UI mapping
5. Remove unsafe casts in affected call sites
6. Typecheck affected files if feasible
7. Targeted unit/static tests where available
8. Build/lint affected area if feasible
9. Browser/E2E smoke if environment permits
10. Re-run read-only DB evidence after fix for expected record
11. Final report with PASS/FAIL/NOT_PROVEN/BLOCKED distinctions
