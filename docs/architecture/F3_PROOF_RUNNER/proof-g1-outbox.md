# Proof G1-05: Outbox Event Atomicity

## Preconditions
- Standard invoice ready in DRAFT.

## Action
- Invoke public.tmp_f3_proof_finalize_invoice wrapper.

## Expected
- F1 transaction is successfully committed.
- F1 outbox event (finance.transaction.posted.v2 or v1) is inserted into public.finance_outbox_events inside the exact same database transaction block.

## Observed
- F1 Transaction ID: 66ba694c-cb4c-4ccf-8cba-6944703b03a6
- Associated Outbox Event Count: 2
- First Event Type: finance.transaction.posted.v1

## Verdict: PASS