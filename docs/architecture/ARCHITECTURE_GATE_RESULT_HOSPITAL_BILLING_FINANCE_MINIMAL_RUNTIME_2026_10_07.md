# Architecture Gate Result - Hospital Billing Finance Minimal Runtime

Date: 2026-10-07

## Gate

HOSPITAL_BILLING_FINANCE_MINIMAL_RUNTIME = PASS_FOR_FINANCE_OUTBOX_SCOPE
HOSPITAL_FINANCE_DOWNSTREAM_LEDGER_PROOF = PASS_FOR_HANDLER_INSTRUCTION_SCOPE

## Canonical Context

- HOSPITAL_FOUNDATION = SEALED
- HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN
- HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME = PROVEN
- HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME = PASS
- HOSPITAL_IMAGING_MINIMAL_RUNTIME = PROVEN_FOR_SUPPORTED_GO_LIVE_CHAIN_SCOPE
- HOSPITAL_NURSING_CONTRACT_RUNTIME = PASS_FOR_VITAL_SIGNS_SCOPE
- HOSPITAL_DISCHARGE_BED_RELEASE_TEMPORAL_RUNTIME = PASS

## Root Cause

Hospital had existing Finance OS integration capability through
`HospitalFinanceAdapter`, `FinanceOutboxWriter`, and Finance OS semantic
resolver mappings. The missing Go-Live product proof was a thin Hospital
runtime path that turns service charges and patient payments into Finance OS
events without embedding accounting policy or ledger logic in Hospital.

## Minimal Fix

- Added `HospitalBillingFinanceProductService`.
- Reused `HospitalFinanceAdapter.publishPatientServiceCompleted(...)`.
- Reused `HospitalFinanceAdapter.publishPatientPaymentReceived(...)`.
- Preserved idempotency key, tenant, patient, encounter, service, and bill
  linkage.
- Kept ledger/reconciliation downstream in Finance OS.
- Did not hardcode account codes, debit/credit entries, accounting policy, or
  direct Finance persistence inside Hospital.

## Contract Dependency Map

```text
Hospital Product
  -> HospitalFinanceAdapter
  -> FinanceOutboxWriter
  -> finance_outbox_events
  -> Finance OS Semantic Resolver
  -> Finance OS policy / COA / Ledger downstream
```

Forbidden path remains blocked:

```text
Hospital Product
  -> accounting policy / debit-credit / account codes / direct ledger tables
```

## Canonical Result

```text
HOSPITAL_BILLING_FINANCE_CONTRACT_TRACE = PASS
HOSPITAL_BILLING_FINANCE_MINIMAL_RUNTIME = PASS_FOR_FINANCE_OUTBOX_SCOPE

PATIENT_SERVICE_COMPLETED_EVENT = PROVEN
PATIENT_PAYMENT_RECEIVED_EVENT = PROVEN
FINANCE_OUTBOX_HANDOFF = PROVEN
FINANCE_SEMANTIC_RESOLUTION_SUPPORT = PROVEN
PATIENT_SERVICE_REVENUE_POSTING_INSTRUCTION = PROVEN
CASH_RECEIPT_SETTLEMENT_POSTING_INSTRUCTION = PROVEN
FINANCE_HANDLER_IDEMPOTENCY = PROVEN

LEDGER_POSTING_RUNTIME = PROVEN_AT_FINANCE_HANDLER_INSTRUCTION_SCOPE
RECONCILIATION_RUNTIME = PROVEN_AS_RECEIVABLE_SETTLEMENT_INTENT_ONLY
REAL_DB_LEDGER_PERSISTENCE = NOT_PROVEN

HOSPITAL_ACCOUNT_CODE_LOGIC = NO
HOSPITAL_DEBIT_CREDIT_LOGIC = NO
HOSPITAL_DIRECT_FINANCE_PERSISTENCE = NO

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = HOSPITAL_FULL_GO_LIVE_BUSINESS_CHAIN_PROOF
```

## Evidence

- `src/products/bella-hospital/services/hospital-billing-finance.service.ts`
- `src/products/bella-hospital/services/__tests__/hospital-billing-finance-minimal-runtime.test.ts`
- `src/products/bella-hospital/__tests__/hospital-billing-finance-contract-trace.test.ts`
- `src/platform/healthcare/finance-integration/hospital-finance-adapter.ts`
- `src/platform/finance/resolvers/semantic-resolver.service.ts`
- `src/products/bella-hospital/__tests__/hospital-finance-downstream-ledger-proof.test.ts`

## Boundary

This slice proves Hospital-to-Finance outbox handoff and Finance OS handler
posting-instruction generation. It does not prove Finance worker execution,
Real DB ledger persistence, reconciliation read-back, Real DB/RLS, Browser E2E,
or production readiness.
