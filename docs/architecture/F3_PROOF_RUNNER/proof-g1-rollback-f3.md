# Proof G1-03: Full Rollback on F3 Failure after F1 Success

## Preconditions
- F1 accounts and accounting period set.
- Target invoice created in DRAFT.
- Pre-seeded subledger fact to force a unique constraint violation on F3 insert.

## Action
- Invoke public.tmp_f3_proof_finalize_invoice. F1 posting succeeds, but nested F3 subledger insert throws uq_tmp_f3_ledger_fact violation.

## Expected
- The entire PostgreSQL transaction rolls back.
- F1 transaction created during execution is completely rolled back (no orphan F1 entries).
- Invoice remains DRAFT.
- Subledger only retains the original pre-seeded conflict row.

## Observed
- F1 Transaction count (idempotency key matches): 0
- F3 Subledger entries: 1 (amount: 5000)
- Invoice status post-failure: DRAFT

## Verdict: PASS