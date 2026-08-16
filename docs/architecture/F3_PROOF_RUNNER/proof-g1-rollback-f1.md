# Proof G1-02: Full Rollback on F1 Failure

## Preconditions
- Target invoice created in DRAFT state.
- Imbalance posting payload constructed (1,000,000 DR vs 500,000 CR).

## Action
- Invoke public.tmp_f3_proof_finalize_invoice with invalid payload. F1 validation throws DOUBLE_ENTRY_IMBALANCE.

## Expected
- The entire PostgreSQL transaction rolls back.
- Invoice status remains DRAFT.
- No F1 transaction is committed.
- No subledger log entries are created.
- Outstanding position cache is uninitialized.

## Observed
- F1 Transaction count: 0
- F3 Subledger entries: 0
- F3 Positions created: 0
- Invoice status post-failure: DRAFT

## Verdict: PASS