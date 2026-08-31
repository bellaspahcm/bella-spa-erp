# Finance Production Hardening Tenant Isolation Audit

Generated at: 2026-08-31T00:25:26.432Z
Environment host: db.lvnvkpyxtuilhrabtlwv.supabase.co

## Summary

- Total checks: 12
- PASS: 7
- WARN: 5
- FAIL: 0
- SKIPPED: 0
- Green: true

## Checks

### SI-001 - PASS

Category: RLS Coverage
Severity: P0
Description: Finance/F5 tenant-scoped tables must have RLS enabled and at least one policy.
Rows: 0

### SI-002 - WARN

Category: RLS Policy Shape
Severity: P1
Description: RLS policies using get_auth_tenant_id() IS NULL are HQ-admin bypass candidates and require explicit review.
Rows: 13

Sample:

```json
[
  {
    "tablename": "f5_control_cases",
    "policyname": "f5_control_cases_tenant_isolation",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": null
  },
  {
    "tablename": "f5_control_results",
    "policyname": "f5_control_results_tenant_isolation",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": null
  },
  {
    "tablename": "finance_accounting_periods",
    "policyname": "Tenant isolation for finance_accounting_periods",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))"
  },
  {
    "tablename": "finance_accounts",
    "policyname": "Tenant isolation for finance_accounts",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))"
  },
  {
    "tablename": "finance_cash_movements",
    "policyname": "Tenant isolation for finance_cash_movements",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))"
  },
  {
    "tablename": "finance_invoices",
    "policyname": "Tenant isolation for finance_invoices",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": null
  },
  {
    "tablename": "finance_payable_allocations",
    "policyname": "Tenant isolation for finance_payable_allocations",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))"
  },
  {
    "tablename": "finance_payable_ledger",
    "policyname": "Tenant isolation for finance_payable_ledger",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))"
  },
  {
    "tablename": "finance_receivable_allocations",
    "policyname": "Tenant isolation for finance_receivable_allocations",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": null
  },
  {
    "tablename": "finance_transaction_lines",
    "policyname": "Tenant isolation for finance_transaction_lines",
    "roles": "{authenticated}",
    "cmd": "ALL",
    "qual": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))",
    "with_check": "((get_auth_tenant_id() IS NULL) OR (tenant_id = get_auth_tenant_id()))"
  }
]
```

### SI-003 - WARN

Category: Accounting Config Isolation
Severity: P0
Description: Control account mappings must resolve to an active same-tenant account.
Rows: 50
Production-risk rows: 0

Sample:

```json
[
  {
    "tenant_id": "db6a900a-eb73-4ead-87fb-2a4c80c3a925",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "10613ae3-c923-46ba-9445-f47af353ccfc",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "038c2206-bffe-4f79-9a3d-570bd08a1452",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "272fd1a7-bee6-4518-9e49-632462361548",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "1de94773-2f55-46a3-8d29-08fd7fb3c70a",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "9b510b42-fcdc-4318-954a-a610aff8da03",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "64fb008e-853f-4cde-9c26-75a1f1300a9a",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "e770a8b1-d6d8-43a2-a576-b77c394f02f9",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "d7a76f49-e90c-4918-a4e7-ca675cd471a1",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  },
  {
    "tenant_id": "f597058d-c5d3-41a2-825f-8ebf107af7ae",
    "tenant_name": null,
    "tenant_status": null,
    "production_risk": false,
    "control_type": "AR_CONTROL",
    "account_code": "131"
  }
]
```

### SI-004 - PASS

Category: Accounting Config Isolation
Severity: P0
Description: Prepayment posting policy mappings must resolve debit/credit accounts within the same tenant only.
Rows: 0

### SI-005 - PASS

Category: F1 Tenant Isolation
Severity: P0
Description: F1 transaction lines must point to same-tenant accounts.
Rows: 0

### SI-006 - PASS

Category: F2 Tenant Isolation
Severity: P0
Description: F2 cash movements must point to same-tenant bank accounts.
Rows: 0

### SI-007 - WARN

Category: F3 Tenant Isolation
Severity: P0
Description: F3 receivable allocations must link invoice and cash movement inside the same tenant.
Rows: 24
Production-risk rows: 0

Sample:

```json
[
  {
    "tenant_id": "931019e3-287a-46e1-b1fe-648205b920c7",
    "tenant_name": "F3-DB-A-MSUZXWSS",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "e62f26d8-6246-4cfd-8721-f9415bacdf31",
    "invoice_tenant_id": "931019e3-287a-46e1-b1fe-648205b920c7",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "931019e3-287a-46e1-b1fe-648205b920c7",
    "tenant_name": "F3-DB-A-MSUZXWSS",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "44f5fe03-8b3d-4f36-89b5-2e6bde26f07e",
    "invoice_tenant_id": "931019e3-287a-46e1-b1fe-648205b920c7",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "931019e3-287a-46e1-b1fe-648205b920c7",
    "tenant_name": "F3-DB-A-MSUZXWSS",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "a4f588e8-0466-4741-8bec-b76156666581",
    "invoice_tenant_id": "931019e3-287a-46e1-b1fe-648205b920c7",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "fe7fd017-3f00-4a93-ad5f-1e822fb0c696",
    "tenant_name": "F3-DB-A-MSV012ON",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "b06b8f79-5c3f-4956-80cd-8d7dc9bf8559",
    "invoice_tenant_id": "fe7fd017-3f00-4a93-ad5f-1e822fb0c696",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "fe7fd017-3f00-4a93-ad5f-1e822fb0c696",
    "tenant_name": "F3-DB-A-MSV012ON",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "8daef2ff-b1c6-4d40-9fbe-aba239acd186",
    "invoice_tenant_id": "fe7fd017-3f00-4a93-ad5f-1e822fb0c696",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "fe7fd017-3f00-4a93-ad5f-1e822fb0c696",
    "tenant_name": "F3-DB-A-MSV012ON",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "b3549570-e4bf-4bdd-bf43-9710f7441f81",
    "invoice_tenant_id": "fe7fd017-3f00-4a93-ad5f-1e822fb0c696",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "f1c8b285-6dbf-49b1-828a-f160ee47eec1",
    "tenant_name": "F3-DB-A-MSV2RGZ7",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "578bfee5-457c-4266-9b4b-18ff33a57b4b",
    "invoice_tenant_id": "f1c8b285-6dbf-49b1-828a-f160ee47eec1",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "f1c8b285-6dbf-49b1-828a-f160ee47eec1",
    "tenant_name": "F3-DB-A-MSV2RGZ7",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "9eab9b60-24d6-4357-8106-0eff7ba2085d",
    "invoice_tenant_id": "f1c8b285-6dbf-49b1-828a-f160ee47eec1",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "f1c8b285-6dbf-49b1-828a-f160ee47eec1",
    "tenant_name": "F3-DB-A-MSV2RGZ7",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "7e375bc3-98cf-49ec-8728-6661c2089abb",
    "invoice_tenant_id": "f1c8b285-6dbf-49b1-828a-f160ee47eec1",
    "cash_movement_tenant_id": null
  },
  {
    "tenant_id": "5e17c7e2-cbbb-4961-9eb4-989eefbf87a9",
    "tenant_name": "F3-DB-A-MSVEUYRV",
    "tenant_status": "active",
    "production_risk": false,
    "allocation_id": "39254000-8a81-428f-9a76-4cd1d953d8de",
    "invoice_tenant_id": "5e17c7e2-cbbb-4961-9eb4-989eefbf87a9",
    "cash_movement_tenant_id": null
  }
]
```

### SI-008 - PASS

Category: F4 Tenant Isolation
Severity: P0
Description: F4 payable allocations must link vendor bills and cash movements inside the same tenant.
Rows: 0

### SI-009 - PASS

Category: F4 Tenant Isolation
Severity: P0
Description: F4 prepayment facts matched to bills must reference same-tenant bills.
Rows: 0

### SI-010 - PASS

Category: F5 Tenant Isolation
Severity: P0
Description: F5 control cases must reference same-tenant F5 control results.
Rows: 0

### SI-011 - WARN

Category: RPC Boundary
Severity: P1
Description: Finance SECURITY DEFINER RPCs executable by anon/public/authenticated should be reviewed for explicit tenant and role guards.
Rows: 23

Sample:

```json
[
  {
    "schema_name": "public",
    "function_signature": "finance_add_invoice_line(uuid,uuid,uuid,text,numeric,bigint,numeric,character varying)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_allocate_payment(uuid,uuid,uuid,bigint,numeric,character varying,timestamp with time zone)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_apply_prepayment(uuid,uuid,uuid,bigint,uuid)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_approve_vendor_bill(uuid,uuid,uuid,uuid)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_calculate_payable_position(uuid,uuid,uuid)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_create_draft_invoice(uuid,uuid,character varying,character varying,date,date)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_disburse_payment(uuid,uuid,uuid,bigint,bigint,numeric,character varying,timestamp with time zone,uuid)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_finalize_invoice(uuid,uuid,character varying,character varying,jsonb)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_get_account_code_by_id(uuid,uuid,character varying)",
    "security_definer": true,
    "granted_role": "authenticated"
  },
  {
    "schema_name": "public",
    "function_signature": "finance_get_cash_movement(uuid,uuid)",
    "security_definer": true,
    "granted_role": "authenticated"
  }
]
```

### SI-012 - WARN

Category: Retained Evidence Boundary
Severity: INFO
Description: Active test/proof Finance tenants should be marked as retained evidence or suspended to avoid production confusion.
Rows: 100
Production-risk rows: 100

Sample:

```json
[
  {
    "id": "aa8b50ff-88a1-4330-a2a1-f725052da83e",
    "name": "authority3-bypass-test",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "e14dcf2a-71ed-4f2c-a9ee-4624bdbd6899",
    "name": "authority3-bypass-test",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "94e179de-4ab3-4807-8f7d-58a196e75e15",
    "name": "Beauty Spa Franchise Demo - TEST",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "aec31443-4d27-4138-8353-a4222acdec07",
    "name": "Bella Real Estate Development [DEMO]",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "2eb42ea0-913e-47dc-8f16-49b9f11d88ac",
    "name": "Bella Real Estate Development [DEMO]",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "896d68b0-eb3a-47b2-a2fe-ff1176df9abf",
    "name": "Bella Real Estate Development [DEMO]",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "d4710089-f0bc-4cca-bde4-3904c17c2782",
    "name": "Bella Real Estate Development [DEMO]",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "f926c69d-45a6-4d57-a197-354ab8c9da33",
    "name": "Bella Real Estate Development [DEMO]",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "5e289cb5-bf8d-4348-9bc2-27d36c349491",
    "name": "Bella Real Estate Development [DEMO]",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  },
  {
    "id": "a322ec09-6134-4a7b-8013-fc7f8b31eaee",
    "name": "Bella Real Estate Development [DEMO]",
    "status": "active",
    "f4_proof_retained_evidence": null,
    "production_risk": true
  }
]
```

