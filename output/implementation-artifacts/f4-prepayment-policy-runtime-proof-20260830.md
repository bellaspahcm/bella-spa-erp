# F4 Prepayment Posting Policy Runtime Proof

Date: 2026-08-30 UTC
Environment: `lvnvkpyxtuilhrabtlwv.supabase.co` test/pre-prod
Scope: F4 prepayment posting policy boundary, F1 GL posting, F5.6 prepayment reconciliation

## Status

`F4 Prepayment Posting Policy`: VERIFIED on DB-backed test/pre-prod proof.

`F4 Freeze`: not declared by this proof alone; still requires the agreed regression/guard pass before push/freeze.

## Deployment Step

Applied additive migration:

- `supabase/migrations/20260831000000_f4_prepayment_policy_resolution_runtime.sql`

Reason: the test/pre-prod DB had already applied the original AP migration and did not contain the new policy mapping table/resolver. Replaying the old migration was avoided.

The migration replaced only F4 policy/support functions needed for the boundary:

- `finance_validate_account_code`
- `finance_validate_account_id`
- `finance_get_account_code_by_id`
- `finance_prepayment_posting_policy_mappings`
- `finance_resolve_prepayment_posting_accounts`
- `finance_record_prepayment`
- `finance_apply_prepayment`

## Runtime Proof Tenants

Created dedicated test tenants only:

- Tenant A: `619f4c7c-8b60-481e-906b-28eb9cdcf999`
- Tenant B: `8af9a4b5-5000-46a6-bd34-72737d44e18a`
- Tenant C: `70423651-0752-44ad-9b27-d5b749c10bfe`

No Bella Spa tenant mapping or business data was modified.

## Evidence

Tenant A mapping:

- Policy prepayment account: `242A_PROOF`
- Record prepayment posted:
  - debit `242A_PROOF` = `1200000`
  - credit `BANK_A` = `1200000`
- Apply prepayment posted:
  - debit `AP_A` = `500000`
  - credit `242A_PROOF` = `500000`
- F4 position:
  - `position_amount_minor = 700000`
  - `fact_count = 2`
- F5.6 reconciliation:
  - `matched = 1`
  - `variances = 0`
  - `quarantined = 0`
  - result row: expected `700000`, actual `700000`, variance `0`, `MATCHED`

Tenant B mapping:

- Policy prepayment account: `242B_PROOF`
- Record prepayment posted:
  - debit `242B_PROOF` = `1200000`
  - credit `BANK_B` = `1200000`
- Apply prepayment posted:
  - debit `AP_B` = `500000`
  - credit `242B_PROOF` = `500000`
- F4 position:
  - `position_amount_minor = 700000`
  - `fact_count = 2`
- F5.6 reconciliation:
  - `matched = 1`
  - `variances = 0`
  - `quarantined = 0`
  - result row: expected `700000`, actual `700000`, variance `0`, `MATCHED`

Missing mapping:

- Tenant C called `finance_resolve_prepayment_posting_accounts`
- Result: rejected with `F4072`
- Message: `F4_PREPAYMENT_POLICY_MAPPING_NOT_FOUND`

Reversal:

- F1 reversal of the Tenant A apply transaction posted successfully.
- Reversal lines:
  - debit `242A_PROOF` = `500000`
  - credit `AP_A` = `500000`
- Double-entry check passed.

Tenant isolation:

- Tenant A postings used `242A_PROOF`.
- Tenant B postings used `242B_PROOF`.
- Tenant A did not post with Tenant B account code.
- Tenant B did not post with Tenant A account code.

## Cleanup / Retention

Attempted cleanup only by proof `tenant_id`.

Physical deletion of immutable evidence rows was blocked by expected finance immutability:

- `F5_RESULT_IMMUTABLE`
- `TRANSACTION_IMMUTABLE`

Deletion of proof tenant shell rows was also blocked by remote tenant FK behavior:

- `timeline_events_tenant_id_fkey`

All `F4-PREPAYMENT-PROOF-%` tenants were marked:

- `status = suspended`
- `metadata.f4_proof_retained_evidence = true`

## Conclusion

The DB-backed proof demonstrates:

- account code is resolved from tenant policy;
- Tenant A and Tenant B resolve to different configured accounts;
- missing mapping fails closed;
- F4 record/apply lifecycle posts to F1 GL;
- double-entry holds for record, apply, and F1 reversal;
- F5.6 reconciles the F4 position to F1 GL as `MATCHED`;
- no Bella Spa tenant data was used as fixture.

Checkpoint may move from `Implemented / Runtime Proof Pending` to `Verified`, subject to the separately agreed regression/Architecture Guard/build sequence before freeze/push.
