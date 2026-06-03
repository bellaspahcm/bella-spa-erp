---
title: 'Branch Legacy Revenue Sync By Type'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '553e3cd68f0c3dcf1a398f486c344a2a92b56694'
context:
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/implementation-artifacts/investigations/accounting-core-double-entry-investigation.md'
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/implementation-artifacts/spec-tt133-service-revenue-mapping.md'
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/implementation-artifacts/spec-tt133-refund-mapping.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Legacy SIMPLE to PROFESSIONAL sync currently posts every confirmed `revenue` row as `PACKAGE_SALE` directly to `5111`, which can overstate revenue for prepaid package/deposit rows and bypass the TT133 `3387`/`5113` mapping now used by runtime accounting.

**Approach:** Add a forward migration that replaces the legacy sync RPCs so revenue rows branch by `revenue_type`: package/deposit/remaining rows credit `3387`, direct service revenue credits `5113`, and refund rows debit `5113` while crediting cash/bank. Keep expenses, salary, readiness checks, authorization, and mode switch semantics unchanged.

## Boundaries & Constraints

**Always:** Do not edit already-applied migration files. Keep sync atomic. Preserve idempotency by checking the same reference type that each branch will insert. Keep preview counts aligned with the sync function.

**Ask First:** If historical package payment policy must distinguish `131` customer advances from `3387`, stop and ask for accounting policy before implementing that broader change.

**Never:** Do not rewrite accounting reports, remove legacy `521` compatibility, or create live data during verification.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Historical package/deposit payment | confirmed `revenue_type in ('deposit','remaining_payment','package_payment','package_sale')` | Journal `PACKAGE_SALE`: debit cash/bank, credit `3387` | Missing `3387` fails explicitly |
| Historical direct service revenue | confirmed `revenue_type in ('session_completed','additional')` | Journal `REVENUE`: debit cash/bank, credit `5113` | Missing `5113` fails explicitly |
| Historical refund row | confirmed `revenue_type='refund'`, positive stored amount | Journal `REFUND`: debit `5113`, credit cash/bank | Missing `5113` fails explicitly |
| Preview before sync | same data mix | Counts only rows missing their branch-specific reference type | Read-only |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260531010000_atomic_legacy_ledger_sync.sql` -- Existing RPC implementation; inspect only, do not edit.
- `supabase/migrations/20260531020000_add_legacy_ledger_sync_preview.sql` -- Existing preview RPC; inspect only, do not edit.
- `supabase/migrations/20260603040000_branch_legacy_revenue_sync_by_type.sql` -- New forward migration replacing both RPCs.
- `src/__tests__/dual-mode-accounting.test.ts` -- Add SQL regression assertions for branch-specific account/reference mappings.
- `docs/DEVELOPMENT_LOG.md` -- Add handoff entry for the accounting sync fix.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260603040000_branch_legacy_revenue_sync_by_type.sql` -- Override `sync_legacy_to_ledger_atomic` with revenue type branching and branch-specific idempotency.
- [x] `supabase/migrations/20260603040000_branch_legacy_revenue_sync_by_type.sql` -- Override `preview_legacy_ledger_sync` so preview uses the same branch-specific idempotency.
- [x] `src/__tests__/dual-mode-accounting.test.ts` -- Assert the new migration credits package rows to `3387`, direct revenue to `5113`, refund debits `5113`, and no longer requires `5111`.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record the legacy sync correction and verification.

**Acceptance Criteria:**
- Given historical package/deposit revenue, when legacy sync runs, then it creates a `PACKAGE_SALE` journal crediting `3387`, not `5111/5113`.
- Given historical direct service revenue, when legacy sync runs, then it creates a direct revenue journal crediting `5113`.
- Given historical refund revenue, when legacy sync runs, then it creates a refund journal debiting `5113` and crediting the payment account.
- Given preview is called before sync, when branch-specific journal entries already exist, then those rows are not counted again.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/dual-mode-accounting.test.ts --runInBand` -- pass, 1 suite / 16 tests.
- `npm.cmd run build` -- pass.
