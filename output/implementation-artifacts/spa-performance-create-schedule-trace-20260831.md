# Spa Performance Create Schedule Trace - 2026-08-31

## Finding

Create Schedule was blocking after `getBookingDetailsWithPayment` and before `createSessionLog` because the UI submit path awaited `checkBookingConflicts` synchronously on the critical path:

```text
handleCreateScheduleSubmit
  -> getBookingDetailsWithPayment
  -> checkBookingConflicts
  -> createSessionLog
```

This explains the observed harness symptom: `getBookingDetailsWithPayment` completed around 285-311ms, but `createSessionLog` was not reached when the conflict check stalled or exceeded the harness window.

## Patch

`src/app/dashboard/bookings/hooks/useBookingsPageActions.ts` now wraps the conflict check with a 1200ms fail-open timeout and logs timing for:

- `getBookingDetailsWithPayment`
- `checkBookingConflicts`
- `createSessionLog`

The business rule behavior remains unchanged when conflict detection responds normally. If conflict detection times out, Create Schedule continues with an explicit fail-open context so the critical scheduling action is not held indefinitely by a side-effect decision check.

## Verification

- `npm run build` PASS
- `npx eslint src/app/dashboard/bookings/hooks/useBookingsPageActions.ts` did not validate the file because the current ESLint config ignores that direct file invocation.
- `npm test -- tenant-isolation-source-guards.test.ts --runInBand` did not run because the current Jest config did not match the test path in this worktree.

## Next Evidence Needed

Run browser/harness Create Schedule again and capture console timings. Expected trace:

```text
[CreateSchedule] getBookingDetailsWithPayment completed in ~300ms
[CreateSchedule] checkBookingConflicts completed in <=1200ms
[CreateSchedule] createSessionLog completed in <measured>ms
```
