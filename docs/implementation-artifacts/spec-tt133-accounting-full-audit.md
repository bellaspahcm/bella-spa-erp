---
title: 'TT133 Accounting Full Audit And Fix'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'e9429aa6e64ec7858053af60b44de65adc9ff407'
context:
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/AI_AGENT_ONBOARDING.md'
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/KNOWLEDGE_STORAGE_PROCESS.md'
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/implementation-artifacts/spec-tt133-refund-mapping.md'
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/implementation-artifacts/spec-branch-legacy-revenue-sync-by-type.md'
---

<frozen-after-approval reason="human requested one-pass TT133 audit/fix; keep scope stable">

## Intent

**Problem:** Recent fixes corrected major TT133 issues, but the system still needs a one-pass audit across every existing accounting event, legacy sync path, report, and reconciliation query before we can responsibly say the implemented accounting logic is aligned with Bella's current TT133 model.

**Approach:** Audit the implemented accounting surface as one release: runtime journal mappings, accounting templates, legacy sync SQL, report filters/calculations, reconciliation summaries, and edge-case tests. Fix any drift found in the existing model, add regression tests with side-effect assertions, and document any remaining non-code accounting policy gaps separately instead of silently treating them as done.

## Boundaries & Constraints

**Always:** Preserve TT133 model already established by recent fixes: prepaid package/deposit/remaining payment credits `3387`; completed service revenue credits `5113`; refunds debit `3387` and/or `5113`; cash/bank uses `111/112`; salaries/expenses/inventory remain expense-side events; reports only recognize confirmed/approved/paid statuses per AGENTS rules.

**Ask First:** If a required fix needs a new accounting policy not present in the codebase, such as tax/VAT payable treatment, cost of goods accounting by inventory valuation method, or a new chart-of-accounts hierarchy, record it as deferred policy rather than inventing a rule.

**Never:** Do not weaken idempotency/side-effect failure handling, do not hide DB errors, do not rewrite generated database types manually, and do not change core business flows outside accounting correctness.

## I/O & Edge-Case Matrix

| Area | Expected TT133 Behavior | Failure Handling |
|------|--------------------------|------------------|
| `PACKAGE_SALE` | Debit cash/bank/receivable, credit `3387` | Outbox/worker fails explicitly |
| `SESSION_DONE` | Recognize earned service revenue to `5113`, reduce `3387` when applicable, accrue KTV commission | Invalid source/deferred split fails explicitly |
| `REFUND_ISSUED` | Debit `3387` and/or `5113`, credit cash/bank | No `521` for runtime refund |
| Expenses/salary/inventory | Debit appropriate expense/COGS-like account, credit cash/payable/inventory | Missing account/template fails explicitly |
| Legacy sync | Branch by source type; do not double count existing journals | Duplicate references skipped by reference type/id |
| Reports/reconciliation | Respect confirmed/approved/paid status constraints and saved salary records | Query errors surface |

</frozen-after-approval>

## Code Map

- `src/services/revenue-recognition.ts` -- Runtime event-to-journal mapping.
- `src/services/accounting-engine.ts` -- Journal posting/template/account resolution.
- `src/services/accounting/template-rules.ts` -- Business event inference and required fields.
- `src/services/finance/reports.ts` -- P&L and finance report status/calculation rules.
- `src/services/accounting/reconciliation*.ts` -- Accounting reconciliation summary/drift detection.
- `src/app/api/cron/accounting-worker/route.ts` -- Worker payload routing to runtime handlers.
- `supabase/migrations/*.sql` -- TT133 template, legacy sync, RPC/report SQL invariants.
- `src/__tests__/*accounting*.test.ts`, `*finance*.test.ts`, `*reconciliation*.test.ts` -- Regression surface.
- `docs/DEVELOPMENT_LOG.md` -- Handoff summary.

## Tasks & Acceptance

**Execution:**
- [x] Audit runtime mappings for `PACKAGE_SALE`, `SESSION_DONE`, `REFUND_ISSUED`, `EXPENSE_RECORDED`, `SALARY_PAID`, `INVENTORY_CONSUMED`, `MANUAL_ENTRY`/reversal.
- [x] Audit accounting templates and template inference for TT133 account drift.
- [x] Audit legacy sync SQL and preview/RPC functions for revenue/refund/status drift.
- [x] Audit P&L/report/reconciliation queries for status constraints and salary fund rules.
- [x] Implement all safe fixes found inside the current accounting policy boundary.
- [x] Add or update regression tests that assert journal lines/report side effects, not just success flags.
- [x] Update development log and spec with findings, fixes, verification, and deferred policy items.

**Acceptance Criteria:**
- Given each supported automatic accounting event, when its handler posts a journal, then the debit/credit lines match the TT133 model above.
- Given legacy revenue/refund data is synced, when preview/sync runs, then deposits/packages use `3387`, completed/additional revenue uses `5113`, refunds reduce `3387`/`5113`, and existing synced rows are not double counted.
- Given finance reports calculate P&L, then only confirmed revenue and approved/paid expenses are included, and KTV salary fund respects saved salary records and pro-rata unsaved records.
- Given any side-effect write fails in the audited flows, then the caller/test sees an explicit failure rather than a silent success.

## Findings

- Runtime journal mappings for package sale/session done/refund were already aligned with the current TT133 model after the recent fixes; no new account-policy invention was needed.
- `AccountingEngineService.postJournalEntry` could leave a DRAFT header and lines behind if the final POST update failed. It now deletes inserted lines and header before surfacing the failure.
- `RevenueRecognitionService.handleExpenseRecorded` mapped salary expenses to generic `642`; it now uses TT133 salary/admin expense account `6421`.
- Legacy SIMPLE -> PROFESSIONAL sync and preview only included `expenses.status = 'approved'`; migration `20260603070000_tt133_legacy_expense_paid_status.sql` updates both RPCs to include `approved` and `paid`.
- Several accounting outbox callers treated a returned `false` as success. Finance mutations, booking deposit revenue, single-session revenue, session done, and inventory consumption now rollback/return explicit failures on `false`.
- Session completion review placeholder insert was a silent side-effect. It now returns explicit lookup/insert errors and triggers completion rollback.
- Completion rollback now checks session rollback errors and recalculates salary after the session status rollback, preventing draft salary drift after a failed `SESSION_DONE` side effect.
- P&L/report/reconciliation paths already respected confirmed revenue, approved/paid expense filters, saved salary records, and pro-rata unsaved salary behavior in the audited code/tests.

## Deferred Policy Items

- VAT payable treatment remains only as supported by existing `vatRate` payloads; no new tax policy was added.
- Detailed inventory valuation policy beyond current `INVENTORY_CONSUMED` cost payload remains outside this pass.

## Spec Change Log

- 2026-06-03: Completed one-pass TT133 audit/fix across runtime mappings, legacy sync, outbox side effects, session completion rollback, tests, and verification.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/accounting-engine.test.ts src/__tests__/dual-mode-accounting.test.ts src/__tests__/finance-transaction-mutations.test.ts src/__tests__/inventory-actions.test.ts src/__tests__/session-completion-accounting.test.ts --runInBand` -- pass, 5 suites / 69 tests.
- `npm.cmd test -- src/__tests__/accounting-engine.test.ts src/__tests__/accounting-outbox.test.ts src/__tests__/dual-mode-accounting.test.ts src/__tests__/finance-transaction-mutations.test.ts src/__tests__/inventory-actions.test.ts src/__tests__/session-completion-accounting.test.ts src/__tests__/accounting-reports.test.ts src/__tests__/reconciliation.test.ts src/__tests__/salary-reconciliation.test.ts --runInBand` -- pass, 9 suites / 106 tests.
- `npm.cmd run build` -- pass.
- `git diff --check` -- pass; Windows LF/CRLF warnings only.

**Review:**
- Sub-agent review was not launched because available sub-agent tooling is restricted to explicit user delegation requests. Local fallback review covered blind diff sanity, edge cases around false-return/rollback, and acceptance criteria against this spec.
