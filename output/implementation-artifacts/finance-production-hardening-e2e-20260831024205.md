# Finance Production Hardening Production E2E Audit

Generated at: 2026-08-31T02:42:08.269Z
Environment host: lvnvkpyxtuilhrabtlwv.supabase.co
Retained evidence tenant: 2fc7812b-6263-49ca-b7d5-bfe3dcea91eb

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
  "tenantId": "2fc7812b-6263-49ca-b7d5-bfe3dcea91eb",
  "vendorId": "52df21f1-1737-4073-be4f-01efe1688910",
  "actorId": "5ee512a6-d039-4da0-af12-9eef01cff2fb",
  "bankAccountId": "34fca867-fb2a-4b78-a6bb-e17f03492aa7",
  "bankFinanceAccountId": "030763f9-b8fe-4d93-956e-41d6710464a6",
  "billId": "7a27252f-8142-4d89-b020-85f7791c763a"
}
```

### E2E-003 - PASS

Record vendor prepayment through F4 policy-resolution RPC.

Evidence:

```json
{
  "success": true,
  "is_duplicate": false,
  "transaction_id": "e8a4af90-0fb5-4aba-b9cb-793935da0d0f",
  "prepayment_fact_id": "3129cc2e-e0bb-4816-b92f-d1d7b918cb9c"
}
```

### E2E-004 - PASS

Approve AP vendor bill through F4 AP lifecycle RPC.

Evidence:

```json
{
  "status": "APPROVED",
  "bill_id": "7a27252f-8142-4d89-b020-85f7791c763a",
  "success": true,
  "is_duplicate": false,
  "transaction_id": "d44d5bc9-094a-43b1-b16a-66370881ed9d"
}
```

### E2E-005 - PASS

Apply prepayment to approved AP bill through F4 lifecycle RPC.

Evidence:

```json
{
  "success": true,
  "is_duplicate": false,
  "transaction_id": "513808ca-3e86-4c04-9b67-924b7023a8c1",
  "prepayment_fact_id": "ffa9692b-4e7d-4e4f-88ea-00547912d348"
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
  "transaction_id": "2344ff82-6b1f-440a-b7a6-894828de45ff"
}
```

### E2E-007 - PASS

Project the F1 cash leg into F2 cash movement.

Evidence:

```json
{
  "success": true,
  "movement_id": "eb31ffb8-0716-42c8-b82e-848d8256161f",
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
  "allocation_id": "e3f24004-fc37-40f2-9749-83bad571bb2b",
  "transaction_id": "ec5abefc-c7c1-4dc6-9ac5-5598e6357f22"
}
```

### E2E-009 - PASS

Reverse AP disbursement through append-only F4 reversal RPC.

Evidence:

```json
{
  "success": true,
  "is_duplicate": false,
  "transaction_id": "bd0faf09-a849-41ce-979e-1548f2421032",
  "reversal_allocation_id": "abf617a0-4506-4c77-8526-a0e557622d02"
}
```

### E2E-010 - PASS

Run F5.6 prepayment reconciliation for the E2E tenant.

Evidence:

```json
{
  "status": "PASS",
  "result": {
    "as_of": "2026-08-31T02:42:09.651185+00:00",
    "run_id": "19587384-0f52-4e6c-9ee4-480850adfa40",
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
