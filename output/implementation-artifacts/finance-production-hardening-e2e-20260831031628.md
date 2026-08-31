# Finance Production Hardening Production E2E Audit

Generated at: 2026-08-31T03:16:31.235Z
Environment host: lvnvkpyxtuilhrabtlwv.supabase.co
Retained evidence tenant: 85afb9ac-1bc3-4015-be15-ebfb01a7b21e

## Summary

- Total steps: 11
- PASS: 11
- WARN: 0
- FAIL: 0
- Green: true

## Steps

### E2E-001 - PASS

Preflight confirms active production E2E RPC signatures.

Evidence:

```json
{
  "signatures": {
    "finance_post_transaction": [
      "p_tenant_id uuid, p_idempotency_key character varying, p_request_hash character varying, p_source_type character varying, p_source_id character varying, p_transaction_type character varying, p_posted_at timestamp with time zone, p_transaction_currency character varying, p_functional_currency character varying, p_exchange_rate_rate numeric, p_exchange_rate_source character varying, p_exchange_rate_target character varying, p_exchange_rate_effective timestamp with time zone, p_description text, p_reference_type character varying, p_reference_id character varying, p_lines jsonb, p_document_date date",
      "p_tenant_id uuid, p_transaction_type character varying, p_posted_at timestamp with time zone, p_description text, p_idempotency_key character varying, p_legacy_lines jsonb"
    ],
    "finance_reverse_transaction": [
      "p_tenant_id uuid, p_transaction_id uuid, p_idempotency_key character varying",
      "p_tenant_id uuid, p_transaction_id uuid, p_idempotency_key character varying, p_reason text, p_reversal_date timestamp with time zone"
    ],
    "finance_approve_vendor_bill": [
      "p_tenant_id uuid, p_bill_id uuid, p_approved_by uuid, p_posting_attempt_id uuid"
    ],
    "finance_disburse_payment": [
      "p_tenant_id uuid, p_bill_id uuid, p_cash_outflow_id uuid, p_allocated_amount_minor bigint, p_cash_amount_minor bigint, p_exchange_rate numeric, p_rate_source character varying, p_rate_timestamp timestamp with time zone, p_posting_attempt_id uuid"
    ],
    "finance_record_prepayment": [
      "p_tenant_id uuid, p_vendor_id uuid, p_amount_minor bigint, p_bank_finance_account_id uuid, p_posting_attempt_id uuid, p_source_type character varying, p_source_id character varying"
    ],
    "finance_apply_prepayment": [
      "p_tenant_id uuid, p_bill_id uuid, p_prepayment_fact_id uuid, p_amount_minor bigint, p_posting_attempt_id uuid"
    ],
    "f5_run_reconciliation": [
      "p_tenant_id uuid, p_domain text, p_control_type text, p_basis_id uuid, p_basis_version text, p_reconciliation_as_of timestamp with time zone"
    ]
  }
}
```

### E2E-002 - PASS

Seed an isolated retained-evidence tenant and finance fixture.

Evidence:

```json
{
  "tenantId": "85afb9ac-1bc3-4015-be15-ebfb01a7b21e",
  "vendorId": "c3dfc7be-5220-4f3e-b0c7-e5ba6c4cace1",
  "actorId": "29f5a752-7990-47d6-9ec2-74484c372a55",
  "bankAccountId": "698418ee-4432-4b68-8631-65874edeb78f",
  "bankFinanceAccountId": "f0ecc03d-43db-4ada-a804-f7c18806a91e",
  "billId": "f3e9db50-2b7d-4de7-b2f6-8427f35d48a4"
}
```

### E2E-003 - PASS

Record vendor prepayment through F4 policy-resolution RPC.

Evidence:

```json
{
  "success": true,
  "is_duplicate": false,
  "transaction_id": "d357671c-2f6f-4887-9296-ef0047816ddd",
  "prepayment_fact_id": "24a5e926-1773-4ea5-a3b7-11f174a8e474"
}
```

### E2E-004 - PASS

Approve AP vendor bill through F4 AP lifecycle RPC.

Evidence:

```json
{
  "status": "APPROVED",
  "bill_id": "f3e9db50-2b7d-4de7-b2f6-8427f35d48a4",
  "success": true,
  "is_duplicate": false,
  "transaction_id": "3b1c9c56-2e3f-4e5a-afba-b0a681f88c7c"
}
```

### E2E-005 - PASS

Apply prepayment to approved AP bill through F4 lifecycle RPC.

Evidence:

```json
{
  "success": true,
  "is_duplicate": false,
  "transaction_id": "6d1778af-3c2b-417c-99ce-bcd2b4a915f6",
  "prepayment_fact_id": "31e5e945-1496-4223-9db1-b45eeadab7df"
}
```

### E2E-006 - PASS

Create F1 cash outflow transaction for AP disbursement setup.

Evidence:

```json
{
  "status": "POSTED",
  "success": true,
  "is_duplicate": false,
  "transaction_id": "045e33ed-eae2-4279-bec1-c30db4453bdd"
}
```

### E2E-007 - PASS

Project the F1 cash leg into F2 cash movement.

Evidence:

```json
{
  "success": true,
  "movement_id": "1edb5623-3de5-4a41-8fa5-82242f862545",
  "is_duplicate": false
}
```

### E2E-008 - PASS

Disburse AP payment by allocating F2 cash outflow to vendor bill.

Evidence:

```json
{
  "success": true,
  "is_duplicate": false,
  "allocation_id": "1783ed46-ab34-4dc8-9199-ccc50d9c2820",
  "transaction_id": "dbe139ae-9939-4074-977e-0434ef753342"
}
```

### E2E-009 - PASS

Reverse AP disbursement through append-only F4 reversal RPC.

Evidence:

```json
{
  "success": true,
  "is_duplicate": false,
  "transaction_id": "a69a2c5a-fc99-413f-9961-35a3c5dc4042",
  "reversal_allocation_id": "1cf1e66d-ab9c-4656-8b4b-ab76ceb2a9f9"
}
```

### E2E-010 - PASS

Run F5.6 prepayment reconciliation for the E2E tenant.

Evidence:

```json
{
  "status": "PASS",
  "result": {
    "as_of": "2026-08-31T03:16:32.567068+00:00",
    "run_id": "6f6b2855-a2b4-46ff-8425-cbe1cacae828",
    "matched": 1,
    "variances": 0,
    "quarantined": 0,
    "control_type": "PREPAYMENT_GL_BALANCE",
    "is_duplicate": false,
    "basis_version": "F4_PREPAYMENT_GL_MAP:v1",
    "total_checked": 1
  }
}
```

### E2E-011 - PASS

Verify E2E tenant remains isolated in generated financial evidence.

Evidence:

```json
{
  "status": "PASS",
  "same_tenant_transactions": 12,
  "orphan_transactions": 0,
  "cross_tenant_lines": 0
}
```
