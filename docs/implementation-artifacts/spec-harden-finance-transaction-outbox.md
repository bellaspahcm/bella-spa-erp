---
title: 'Harden Finance Transaction Outbox'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'b9c719d6ce4ef17afba3ef8b63c0b45b4d54eeba'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Finance transaction actions can change `revenue` or `expenses` into accounting-recognized states before the accounting outbox enqueue finishes. If outbox enqueue fails, reports can see a confirmed/approved transaction while accounting automation has no corresponding event.

**Approach:** Keep public Finance action APIs stable, add focused side-effect tests for outbox failures, and harden rollback behavior around confirmed/approved legacy finance writes.

## Boundaries & Constraints

**Always:** Preserve `recordTransaction(data)` and `confirmTransaction(id, type)` external behavior. Continue enforcing legacy/professional accounting mode and open accounting period checks before DB writes. If a confirmed/approved transaction write succeeds but accounting outbox enqueue fails, rollback the DB mutation before throwing an explicit failure. Use typed Supabase payloads for rollback updates/deletes.

**Ask First:** Stop before changing Finance UI, accounting schema, outbox schema, P&L report logic, salary recalculation rules, or professional ledger posting behavior.

**Never:** Do not silently ignore insert, update, rollback, salary-record, period guard, or outbox failures. Do not touch `supabase/.temp/*` or `.claude/settings.local.json`. Do not broaden this slice into a full financial transaction engine rewrite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Confirm revenue outbox fails | Pending package revenue is updated to `confirmed`; `PACKAGE_SALE` enqueue throws | Revenue is restored to its previous mutable fields before the action throws | Error includes outbox failure and rollback failure if rollback fails |
| Confirm expense outbox fails | Submitted operating expense is updated to `approved`; `EXPENSE_RECORDED` enqueue throws | Expense is restored to its previous mutable fields before the action throws | Error includes outbox failure and rollback failure if rollback fails |
| Record confirmed revenue outbox fails | New confirmed package revenue is inserted; `PACKAGE_SALE` enqueue throws | Inserted revenue row is deleted before the action throws | Error includes outbox failure and rollback failure if rollback fails |
| Record approved expense outbox fails | New approved expense is inserted; `EXPENSE_RECORDED` enqueue throws | Inserted expense row is deleted before the action throws | Error includes outbox failure and rollback failure if rollback fails |

</frozen-after-approval>

## Code Map

- `src/services/finance/transaction-mutations.ts` -- Server Action implementation for legacy Finance record/confirm mutations and accounting outbox enqueue.
- `src/services/finance/transactions.ts` -- public wrapper re-export used by `finance-actions`.
- `src/__tests__/dual-mode-accounting.test.ts` -- existing coverage for professional-mode and closed-period blocking.
- `src/__tests__/finance-transaction-mutations.test.ts` -- new focused side-effect tests for outbox rollback behavior.

## Tasks & Acceptance

**Execution:**
- [x] `src/__tests__/finance-transaction-mutations.test.ts` -- add focused scripted Supabase tests for outbox-failure rollback paths in `recordTransaction` and `confirmTransaction`.
- [x] `src/services/finance/transaction-mutations.ts` -- add narrow rollback helpers for confirmed/approved outbox failures without changing public APIs.
- [x] `docs/DEVELOPMENT_LOG.md` -- append concise BMAD entry with verification commands.

**Acceptance Criteria:**
- Given a revenue/expense confirmation update succeeds and outbox enqueue fails, when the action throws, then the original row state is restored.
- Given a confirmed/approved transaction insert succeeds and outbox enqueue fails, when the action throws, then the inserted row is deleted.
- Given rollback also fails, when the action throws, then the error message includes both the outbox failure and rollback failure.

## Spec Change Log

- 2026-06-01 -- Added rollback helpers and tests for outbox-failure paths after revenue/expense confirm, confirmed/approved transaction insert, and salary payment outbox enqueue.

## Design Notes

For confirmation rollback, snapshot only the mutable columns changed by `confirmTransaction`: status/date/business-event/review/metadata fields. For record rollback, delete only the newly inserted row by returned `id`. This keeps the slice small and avoids changing the wider legacy Finance contract.

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/services/finance/transaction-mutations.ts src/__tests__/finance-transaction-mutations.test.ts` -- pass.
- `npm.cmd test -- src/__tests__/finance-transaction-mutations.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/dual-mode-accounting.test.ts --runInBand` -- pass.

## Suggested Review Order

1. `src/services/finance/transaction-mutations.ts` -- review rollback helpers and outbox catch blocks.
2. `src/__tests__/finance-transaction-mutations.test.ts` -- review scripted Supabase assertions for rollback side effects.
3. `docs/DEVELOPMENT_LOG.md` -- confirm the entry matches implemented behavior.
