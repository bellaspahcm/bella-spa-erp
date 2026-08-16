# Proof G1-04: Nested Crash/Retry Idempotency

## Preconditions
- Invoice created in DRAFT state.
- Stable, persistent idempotency key generated for the transaction.

## Action
- Invoke public.tmp_f3_proof_finalize_invoice once.
- Re-invoke public.tmp_f3_proof_finalize_invoice representing a crash retry.

## Expected
- F1 idempotency detects duplicate key and returns canonical transaction ID.
- F3 wrapper checks duplicate status and bypasses duplicate writes safely.
- Exactly 1 F1 transaction exists.
- Exactly 1 F3 subledger accrual record exists.
- Receivable position outstanding is correctly 1,000,000 (no doubled values).

## Observed
- F1 Transaction count: 1 (Canonical ID: 7ea3ae12-7910-469b-b45a-497d35be0692)
- F3 Subledger count: 1
- Outstanding position: 1000000 minor units

## Verdict: PASS