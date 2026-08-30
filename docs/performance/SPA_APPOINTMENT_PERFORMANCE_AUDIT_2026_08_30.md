# Spa Appointment Performance Audit — 2026-08-30

> Status: Initial measurement checkpoint
>
> Scope: Audit user-perceived latency for Spa appointment/calendar operations. No product runtime code was changed in this checkpoint.

## Executive Result

The first measured UI run shows that the core appointment mutation itself is not the only source of user wait time. The stronger signal is post-mutation refresh fan-out on `/dashboard/bookings`: several server actions run after page/detail interactions, and some analytics refresh calls take close to or above one second each.

This is an audit baseline, not a completed optimization.

```text
Booking page warm navigation       196-236ms
Calendar session refresh           277-405ms action time
Booking list refresh               251-259ms action time
User/resource supporting reads      257-313ms action time
Important alerts refresh            761-1,019ms action time
Measured session update mutation    267ms action time
```

## Measurement Run

Command:

```bash
npx playwright test e2e/tests/14-beauty-resource-booking-smoke.spec.ts --reporter=list,json
```

Environment:

- Local Next.js dev server on `http://localhost:3000`.
- E2E mock-user flow with Supabase service-role seed data.
- Cold start was present, so `/` compile latency is excluded from product latency conclusions.

Result:

- The UI journey reached `/dashboard/bookings`, opened the booking detail, attempted resource assignment, and waited for the server-action POST.
- The test failed during cleanup, not during the measured UI operation.
- Cleanup failure: temporary E2E tenant could not be deleted because `timeline_events_tenant_id_fkey` retained side-effect rows.

## Observed Latency

| Operation | Observed Timing | Evidence |
|---|---:|---|
| Root cold compile | 10.1s | Excluded from product latency; dev cold start |
| Dashboard warm navigation | 619ms | includes proxy 303ms, application 187ms |
| Bookings page warm navigation | 196-236ms | GET `/dashboard/bookings` |
| Tenant context API | 396-482ms | GET `/api/tenant/context` |
| Tenant settings read | 181-352ms | server action |
| Current user read | 180-197ms | server action |
| Calendar sessions read | 277-405ms | `getCalendarSessions()` |
| Booking list read | 251-259ms | `getBookings()` |
| Users read | 257-313ms | `getUsers()` |
| Booking resources read | 267-280ms | `getBookingResources()` |
| Important alerts read | 761-1,019ms | `getImportantAlerts()` |
| Conflict check before save | 7ms action time | `checkBookingConflicts()` returned early in mock-auth path |
| Session update mutation | 267ms action time | `updateSessionLog(...)` |

## Static Flow Findings

### 1. Create Appointment

Entry point: `createBooking()`.

Observed static chain:

```text
rate limit
  -> auth / tenant resolution
  -> package scope validation
  -> customer create or existing customer
  -> pending booking lookup
  -> tenant context
  -> package price lookup / adapter pricing
  -> adapter validation
  -> booking upsert
  -> deposit revenue
  -> initial session logs
  -> optional service items
  -> cache invalidation
  -> six path revalidations
```

Likely risk: multiple sequential DB round-trips before response, plus broad revalidation fan-out after write.

### 2. Edit Appointment

Entry point: `updateBooking()`.

Observed static chain for time/date/KTV edits:

```text
auth / tenant resolution
  -> fetch old booking
  -> package scope check if changed
  -> tenant context
  -> adapter validation
  -> fetch scheduled sessions
  -> conflict check per scheduled session
  -> update booking
  -> audit log
  -> optional notifications
  -> session time/status/date sync
  -> booking progress sync
  -> customer lookup
  -> path revalidation
```

Likely risk: validation and synchronization are bundled into one user-blocking action. Conflict checks may scale with the number of scheduled sessions.

### 3. Assign KTV

Entry points:

- Detail/calendar flow calls `updateBooking(bookingId, { assigned_ktv_id })`.
- Suggestion flow has `applyKtvSuggestion()` with a much narrower DB path.

Observed static risk: the detail/calendar path uses the heavy `updateBooking()` path even for a simple KTV assignment, so it can trigger decision validation, session conflict loops, audit, notifications, and revalidation.

### 4. Reschedule

Entry point: `rescheduleSession()`.

Observed static chain:

```text
auth / tenant resolution
  -> fetch target session
  -> maybe fetch parent booking
  -> fetch all future scheduled sessions
  -> validate resource schedule per future session
  -> update each future session sequentially
  -> audit log
  -> notification lookup/send
  -> customer lookup
  -> revalidate bookings/sessions/customer
```

Likely risk: per-session validation and per-session update loops. The user waits for all future-session changes and audit/notification work.

## Current Common Bottleneck Hypothesis

The most likely common bottleneck is not a single slow insert/update. It is the combination of:

1. many independent server actions after the page opens or refreshes;
2. heavy analytics refresh on the bookings route, especially `getImportantAlerts()`;
3. broad post-write revalidation and client refetches after mutation;
4. update/reschedule actions doing validation, audit, notifications, synchronization, and refresh work synchronously.

This needs a second measurement pass before product code optimization.

## Data Quality / E2E Finding

The resource-booking E2E cleanup does not delete `timeline_events` before deleting the temporary tenant. The measured test therefore failed after the UI operation with:

```text
referential integrity query on "tenants" from constraint "timeline_events_tenant_id_fkey" on "timeline_events" gave unexpected result
```

This should be treated as an E2E cleanup hardening issue, not as evidence that the appointment UI operation failed.

## Recommended Next Measurement

Do not optimize yet. Add or run a dedicated measurement harness that records:

```text
click submit timestamp
  -> server action POST duration
  -> named action duration from Next logs
  -> response returned
  -> client refetch fan-out
  -> UI stable / toast visible
```

Required flows:

1. Create appointment.
2. Edit appointment time/date.
3. Assign KTV.
4. Reschedule future sessions.

Only after those four timings are captured should the team choose the first code change.

## Candidate Fixes To Evaluate After Measurement

- Split narrow KTV assignment away from the full `updateBooking()` path if measurement confirms it pays the heavy edit cost.
- Batch reschedule validation/update into one RPC or one bulk update if future-session loops dominate latency.
- Reduce post-mutation refresh fan-out; refresh the affected calendar range and booking detail instead of broad dashboard paths where safe.
- Move non-critical notifications and cache invalidation fully out of the blocking response path.
- Review why `getImportantAlerts()` is called repeatedly on `/dashboard/bookings` and takes 761-1,019ms.

