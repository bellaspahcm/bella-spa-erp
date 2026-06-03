# Fix Supabase RPC Binding Errors

## Status
- Implemented on branch `codex/month-close-ux-guard`.
- Trigger: production accounting tab error on `/dashboard/accounting/salary-reconciliation`.

## Root Cause
Vercel production logs showed:

`TypeError: Cannot read properties of undefined (reading 'rest')`

The salary reconciliation server action detached `client.rpc` into a standalone variable before calling it. Supabase's `rpc` implementation uses `this.rest` internally, so calling the detached function loses the required receiver.

## Scope
- Preserve Supabase client binding in `getSalaryReconciliationReport`.
- Remove the same detached `.rpc` pattern from payment helper, accounting worker, onboarding, and pending RPC helper.
- Add regression coverage that mocks Supabase `rpc` as a method requiring `this.rest`.

## Non-Goals
- No database migration.
- No change to TT133 salary reconciliation business logic.
- No change to Supabase auth/session policy in this slice; the Vercel `getSession()` warning is a separate hardening task.

## Verification
- `npm.cmd test -- src/__tests__/salary-reconciliation.test.ts --runInBand` passed.
- `npm.cmd test -- src/__tests__/rate-limit.test.ts src/__tests__/onboarding.test.ts --runInBand` passed.
- `npm.cmd test -- src/__tests__/transaction-safety.test.ts src/__tests__/e2e-pipeline.test.ts src/__tests__/accounting-outbox.test.ts --runInBand` passed.
- `npm.cmd run build` passed.
- `npm.cmd test -- --runInBand` passed, 75 suites / 823 tests.
- `git diff --check` passed with Windows LF/CRLF warnings only.
