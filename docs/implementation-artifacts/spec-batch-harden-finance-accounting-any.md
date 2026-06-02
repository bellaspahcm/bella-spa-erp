# SPEC - Batch Harden Finance / Accounting Explicit Any

## Intent

Remove explicit `any` usage from the finance, accounting, reconciliation, transaction modal, and export surfaces selected for production refactor group 1.

## Scope

- Accounting dashboard pages:
  - overview
  - chart of accounts
  - journal list and journal detail
  - manual entry
  - outbox monitor
  - periods
  - reports
  - salary reconciliation
- Finance pages:
  - finance overview
  - reconciliation
- Shared finance UI:
  - transaction modal
- Export service:
  - salary export
  - session matrix export
  - accounting report export
- Full-test follow-up:
  - AI COO and AI action approval routes now propagate object-shaped DB error messages, matching Zero Silent Database Failures.

## Contract

- No explicit `any` remains in the selected group 1 paths.
- UI state and render loops use existing server-action return types or local DTOs.
- Error handlers accept `unknown` and extract a concrete message when available.
- Legacy `profiles` fallback in finance reconciliation remains supported through a narrow client interface instead of a loose Supabase cast.
- Excel export accepts typed report records and normalizes number-like cells at export boundaries.
- Full Jest suite must pass after the batch because user requested tests to be grouped.

## Verification

- `rg "\bany\b" src\app\dashboard\accounting src\app\dashboard\finance src\components\features\TransactionModal.tsx src\services\export-actions.ts`
- `npm.cmd run lint -- <group-1 changed files>`: completed with warnings only, no errors.
- `npx.cmd tsc --noEmit --pretty false`: passed.
- `git diff --check`: passed.
- `npm.cmd test -- --runInBand`: 65 suites passed, 706 tests passed.
