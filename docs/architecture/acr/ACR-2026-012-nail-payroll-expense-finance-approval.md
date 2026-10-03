# ACR-2026-012: Payroll Expense Finance Approval for Finalized Salary

Status: APPROVED
Date: 2026-10-01
Approver: User explicit approval in Codex thread for Nail Shop full UI E2E Go-Live evidence

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-012",
  "status": "APPROVED",
  "pr": "181",
  "approvedCoreFiles": [
    "src/core/services/finance/transaction-mutations.ts"
  ],
  "approver": "User explicit approval in Codex thread for Nail Shop full UI E2E Go-Live evidence",
  "approvedDate": "2026-10-01",
  "purpose": "Allow Finance approval of payroll-generated salary expenses when the related salary record is already finalized or paid, without mutating immutable salary_records.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

## Problem

Nail Shop full UI E2E reaches the real operator workflow:

```text
Salary publish
  -> admin confirm
  -> finalize salary
  -> salary expense appears in Finance
  -> Finance approves expense
```

The Finance approval path updates `expenses.status` to `approved`, then tries to mutate the related `salary_records` row to `paid`. For payroll records that are already `finalized`, the salary lock guard correctly rejects the update:

```text
Cannot edit a locked record. Contact Admin to unlock.
```

That rollback leaves the Finance salary expense stuck in `submitted`, blocking the full Nail UI E2E.

## Change Authority

This ACR authorizes one controlled Core fix:

```text
Finance confirmTransaction(expense)
  -> salary expense
  -> salary record finalized/paid
  -> approve expense and enqueue SALARY_PAID
  -> do not mutate immutable salary_records
```

## Approved Scope

- Modify only `src/core/services/finance/transaction-mutations.ts`.
- Preserve the existing salary record update for mutable salary states.
- Skip the salary record update only when the salary record status is already `finalized` or `paid`.
- Preserve expense rollback if outbox enqueue fails.
- Add focused regression coverage for finalized salary expense approval.

## Out Of Scope

- Payroll engine redesign.
- Salary lifecycle redesign.
- Finance schema changes.
- Accounting RPC changes.
- Product-specific Nail branch.
- Haircut, Preschool, Healthcare, Education, or Logistics changes.

## Expected Effect

```text
Mutable salary record
  -> approve expense
  -> update salary_records to paid
  -> enqueue SALARY_PAID

Finalized/paid salary record
  -> approve expense
  -> do not mutate immutable salary_records
  -> enqueue SALARY_PAID
```

## Verification Plan

- Focused Jest regression for finalized salary expense approval.
- Targeted ESLint on touched Core/test/E2E files.
- Nail full UI E2E rerun against E2E environment.
- `git diff --check`.
- Architecture guard / Core freeze guard.
