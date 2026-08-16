# Proof G1-01: Nested Call Compile & Execution

## Preconditions
- Tenant created.
- F1 accounts 131, 5111, 3331 exist.
- Accounting period open.
- Temporary F3 invoice in DRAFT.

## Action
- Invoke public.tmp_f3_proof_finalize_invoice wrapper function passing F1 journal parameters nested.

## Expected
- F1 transaction is successfully posted.
- F3 subledger logs the accrual debit entry.
- F3 position cache is initialized with original invoice amount.
- Invoice status transitions to FINALIZED.

## Observed
- F1 Transaction ID: 268c59fa-15ed-4bc3-a81a-b1d77f02f410 (Status: POSTED)
- F3 Subledger records: 1 row
- F3 Position outstanding: 1000000 minor units
- Invoice final status: FINALIZED

## Verdict: PASS