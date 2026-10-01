# Real Estate Kernel Jest Blocker Result

Date: 2026-09-30

Status: SEALED

## Scope

This mini-campaign addressed the verification blocker found while sealing Real Estate Any-Type Batch RE1:

```text
src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts
Property Contract & Ledger Posting Integration
```

Failure:

```text
TypeError: Cannot read properties of undefined (reading 'debit')
```

## Root Cause

The test harness was stale against the canonical Accounting contract.

Canonical Accounting shape:

```text
accounting_accounts.account_code
journal_lines.debit_amount
journal_lines.credit_amount
```

Stale Real Estate test shape:

```text
accounting_accounts.code
journal_lines.debit
journal_lines.credit
```

## Fix

Updated only the Real Estate integration test harness:

- `mockAccountsDb` now uses `account_code`, `account_name`, and `account_type`.
- Accounting account filter now reads `filters.account_code`.
- Journal line assertions now read `debit_amount` and `credit_amount`.

No production Real Estate or Accounting behavior was changed.

## Verification

```text
npx jest src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts --runInBand
PASS
5 passed / 5 total

npm run lint -- src/platform/real-estate/__tests__/real-estate-kernel.integration.test.ts
PASS

git diff --check
PASS
```

## Decision

The blocker was a stale test/mock contract, not a Real Estate Batch RE1 runtime regression.

RE1 may be sealed after this blocker fix.
