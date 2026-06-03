---
title: 'Normalize Finance Refund Outbox Split'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: 'c906a49949b0b556ce45102285f9155bbf151cf2'
context:
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/implementation-artifacts/spec-tt133-refund-mapping.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `recordTransaction` currently stores revenue with `Math.abs(data.amount)` and only allows positive revenue types, so a negative finance transaction used as refund can lose its refund meaning before accounting outbox processing. After the TT133 refund runtime fix, the source payload should explicitly send the split between unearned revenue `3387` and recognized service revenue `5113` when the source transaction is a refund.

**Approach:** Detect finance revenue refunds at the transaction source, persist them as `revenue_type = 'refund'` with positive stored amount for SIMPLE reporting compatibility, and enqueue `REFUND_ISSUED` with deterministic split fields. Keep legacy non-refund revenue and expense flows unchanged.

## Boundaries & Constraints

**Always:** Keep SIMPLE mode working. Preserve positive stored `revenue.amount` convention unless existing schema/tests prove negative values are first-class. Use explicit failures for DB/outbox errors and rollback inserted rows on outbox failure. Keep generated payload field names aligned with `RevenueRecognitionService.handleRefundIssued`.

**Ask First:** If exact business split cannot be derived from available source data and would require accountant judgment, default only within the known operational context and document the limitation. Ask before adding new UI controls or schema columns.

**Never:** Do not remove legacy `521` report compatibility. Do not rewrite accounting reports in this slice. Do not change professional-mode guards. Do not silently swallow outbox failure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Finance refund recorded confirmed | `recordTransaction({ type:'revenue', amount:-300000, category:'refund', status:'confirmed', booking_id })` | Insert `revenue` with positive `amount=300000`, `revenue_type='refund'`, accounting metadata marking refund, and enqueue `REFUND_ISSUED` | If outbox enqueue fails, delete inserted revenue and throw explicit rollback-aware error |
| Legacy positive revenue | `amount > 0`, package/deposit/remaining category | Existing `PACKAGE_SALE` behavior remains unchanged | Existing rollback behavior remains |
| Pending refund | `amount < 0`, `status` not confirmed | Insert refund metadata but do not enqueue outbox until confirmed | Existing confirm flow should enqueue on confirmation |
| Confirm existing refund | existing `revenue_type='refund'` row moves to confirmed | Enqueue `REFUND_ISSUED` with split payload | Roll back confirmation if outbox enqueue fails |

</frozen-after-approval>

## Code Map

- `src/services/finance/transaction-mutations.ts` -- Source of manual finance transaction recording and confirmation; currently maps revenue category and enqueues accounting events.
- `src/lib/accounting-outbox.ts` -- Outbox event type contracts already include `REFUND_ISSUED`.
- `src/services/revenue-recognition.ts` -- Runtime consumer of refund split payload; already supports `deferredRefundAmount` and `revenueReductionAmount`.
- `supabase/migrations/20260603030000_allow_revenue_refund_type.sql` -- Keeps the database CHECK constraint aligned with app-level revenue/refund types.
- `src/__tests__/finance-transaction-mutations.test.ts` or nearest existing finance mutation test -- Add regression coverage for refund record/confirm outbox side effects.
- `docs/implementation-artifacts/spec-tt133-refund-mapping.md` -- Prior decision: TT133 refund runtime posts `3387`/`5113`, not `521`.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/finance/transaction-mutations.ts` -- Add a small helper to classify revenue refunds and build refund accounting payload consistently -- prevents `Math.abs` from erasing refund semantics.
- [x] `src/services/finance/transaction-mutations.ts` -- In confirmed `recordTransaction` refund path, enqueue `REFUND_ISSUED` with `amount`, `deferredRefundAmount`, `revenueReductionAmount`, `paymentMethod`, `description`, `branchId`.
- [x] `src/services/finance/transaction-mutations.ts` -- In `confirmTransaction` revenue path, enqueue `REFUND_ISSUED` for existing refund rows and roll back confirmation on outbox failure.
- [x] `supabase/migrations/20260603030000_allow_revenue_refund_type.sql` -- Allow `refund` in the existing `revenue_type` CHECK constraint while preserving current app revenue types.
- [x] `src/__tests__/*finance*transaction*.test.ts` -- Cover confirmed refund insertion, pending refund confirmation, and legacy positive package sale unaffected.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add a concise entry linking this source-payload fix to the prior TT133 refund runtime fix.

**Acceptance Criteria:**
- Given a confirmed manual finance refund, when `recordTransaction` succeeds, then a `REFUND_ISSUED` outbox event is created with split fields and no `PACKAGE_SALE` event is created.
- Given a pending refund row, when it is confirmed, then confirmation enqueues `REFUND_ISSUED` and rolls back status if enqueue fails.
- Given a normal deposit/package payment, when it is recorded or confirmed, then existing `PACKAGE_SALE` payload behavior is unchanged.

## Spec Change Log

## Design Notes

Because historical refund input is a negative finance transaction rather than a rich refund form, source-level split cannot always be known exactly. For this slice, use the conservative operational default already accepted by runtime compatibility: if no finer-grained source split is available, set `revenueReductionAmount = amount` and `deferredRefundAmount = 0`. Future UI/accountant review can provide explicit split controls without changing the outbox contract.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/finance-transaction-mutations.test.ts src/__tests__/accounting-outbox.test.ts --runInBand` -- pass, 2 suites / 21 tests.
- `npm.cmd run build` -- pass.
