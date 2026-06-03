# Month-Close UX Guard

## Status
- Implemented on branch `codex/month-close-ux-guard`.
- Builds on `spec-accounting-health-preflight.md`.

## Goal
Surface accounting preflight in the Finance P&L screen before an admin attempts to lock a month.

## Scope
- Load `getMonthClosePreflight(selectedMonth)` in `FinancePnLSummary` for unlocked months.
- Show blocker/warning counts and direct links to Accounting Health, Outbox, and Journals.
- Disable the month-close button when preflight has blockers or cannot be loaded.
- Re-run preflight immediately before calling `lockMonth`.
- Allow month close with warnings only after admin confirmation.
- Add jsdom component coverage for blocker, warning, and preflight-load failure paths.

## Business Rules
- UI is fail-closed: no preflight result means the lock button is disabled.
- Blockers prevent `lockMonth` from being called.
- Warnings are advisory only; the admin can proceed after seeing them in the confirmation text.
- Backend `lockMonth` preflight remains the source of truth and final enforcement point.

## Verification
- `npm.cmd test -- src/__tests__/finance-pnl-preflight.test.tsx --runInBand` passed, 3 tests.
- `npm.cmd test -- src/__tests__/finance-pnl-preflight.test.tsx src/__tests__/finance.lockMonth.test.ts --runInBand` passed, 2 suites / 19 tests.
- `npm.cmd run build` passed.
- `npm.cmd test -- --runInBand` passed, 75 suites / 823 tests.
- `git diff --check` passed with Windows LF/CRLF warnings only.
