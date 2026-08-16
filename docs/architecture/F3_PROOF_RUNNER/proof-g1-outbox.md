# Proof G1-05: Outbox Event Atomicity

## Preconditions
- Standard invoice ready in DRAFT.

## Action
- Invoke public.tmp_f3_proof_finalize_invoice wrapper.

## Expected
- F1 transaction is successfully committed.
- F1 outbox event (finance.transaction.posted.v2 or v1) is inserted into public.finance_outbox_events inside the exact same database transaction block.

## Observed
- F1 Transaction ID: 646a729f-82cf-435a-93b4-b1c8019193e2
- Associated Outbox Event Count: 2
- First Event Type: finance.transaction.posted.v1

## Verdict: PASS