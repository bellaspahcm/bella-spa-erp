# Accounting Health And Month-Close Preflight

## Status
- Implemented on branch `codex/accounting-health-preflight`.
- Baseline: TT133 accounting full audit release on `main`.

## Goal
Give admins one operational view for accounting health and prevent month close from running while the ledger has unresolved blockers.

## Scope
- Add an accounting health service that checks:
  - `accounting_outbox` status counts, especially `FAILED` and `DEAD`.
  - `journal_entries` DRAFT rows in the selected month.
  - duplicate active business references in `journal_entries`.
  - TT133 readiness RPC and legacy ledger sync preview as advisory checks.
- Add `/dashboard/accounting/health`.
- Add a tab in the accounting module navigation.
- Wire `lockMonth` to run month-close preflight before `lock_monthly_records`.
- Add Jest coverage for health summary, DB error propagation, and preflight blocking before the lock RPC.

## Non-Goals
- No new database schema.
- No accounting mapping changes.
- No production deployment in this change set.

## Business Rules
- `FAILED` or `DEAD` outbox events are blockers.
- DRAFT journals in the target month are blockers.
- Duplicate active journal references are blockers.
- PENDING/PROCESSING outbox events, readiness gaps, and legacy sync backlog are warnings.
- Database failures must throw or return explicit failure; no silent healthy fallback.

## Verification
- `npm.cmd test -- src/__tests__/accounting-health.test.ts src/__tests__/finance.lockMonth.test.ts --runInBand` passed.
- `npm.cmd test -- src/__tests__/franchise-royalty.test.ts src/__tests__/inter-branch-clearing.test.ts src/__tests__/security-hardening.test.ts --runInBand` passed.
- `npm.cmd run build` passed.
- `git diff --check` passed with Windows LF/CRLF warnings only.
- Full `npm.cmd test -- --runInBand` result: 72/74 suites passed; existing unrelated failures remain in `src/__tests__/idempotency.test.ts` and `src/__tests__/subscription.test.ts`.
