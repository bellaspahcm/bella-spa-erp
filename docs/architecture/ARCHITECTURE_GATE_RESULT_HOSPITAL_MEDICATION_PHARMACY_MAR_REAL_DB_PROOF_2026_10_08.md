# Architecture Gate Result: Hospital Medication / Pharmacy / MAR Real DB Proof

Date: 2026-10-08

## Status

```text
HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = PASS
HOSPITAL_REAL_DB_RLS_PROOF = PASS
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN_FOR_BROWSER_E2E_OR_PRODUCTION
GO_LIVE_DECISION = NO
```

## Scope

This gate extended Hospital Real DB / RLS proof from the already verified clinical-care branches into the medication chain:

```text
Hospital Clinical Order
  -> Medication Order
  -> CDS Gate
  -> Pharmacy prescription
  -> Dispense
  -> MAR
  -> Real DB read-back
  -> RLS same-tenant read / cross-tenant denial
```

This is not Browser E2E, not Production, not Finance, and not a Hospital product workaround.

## Sealed Prerequisites

```text
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = PROVEN_FOR_CODE_RUNTIME_SCOPE
ORDER_ENGINE_REAL_DB_PATIENT_LINKAGE_PERSISTENCE_MINIMAL_FIX = PASS
LABORATORY_REAL_DB_PATIENT_LINKAGE_REAL_DB_PROOF = PASS
HC_LAB_ORDERS_RLS_REAL_DB_PROOF = PASS
HC_IMAGING_ORDERS_RLS_REAL_DB_PROOF = PASS
CDS_CALCULATION_PERSISTENCE_MINIMAL_FIX = PASS
```

## Resolved Blockers

### CDS Persistence

```text
CDS_CALCULATION_PERSISTENCE_MINIMAL_FIX = PASS
CDS_CALCULATION_PERSISTENCE_REAL_DB_PROOF = PASS
```

`CdsEngineService.writeCalculationRecord()` now aligns to the live/generated compact `hc_clinical_calculations` shape and throws on insert failure before returning `calculationId`.

### Order Approved To Pharmacy Bootstrap

```text
ORDER_APPROVED_TO_PHARMACY_BOOTSTRAP_WIRING = PASS
```

Minimal wiring:

```text
hos.order.approved.v1
  -> existing Pharmacy OrderApprovedSubscriber
  -> existing Pharmacy repository / clinical order reader
  -> idempotent prescription creation for MEDICATION orders
```

No Hospital direct repository access was introduced.

### Pharmacy / MAR RLS

```text
HC_PHARMACY_MAR_RLS_POLICY_CONFIGURATION = PASS
```

Created and applied:

```text
supabase/migrations/20261008012000_repair_healthcare_pharmacy_mar_rls_policies.sql
```

No schema changes, no public contract changes.

## Runtime Path Proven

```text
Medication order persisted
  -> CDS calculation persisted
  -> Order approved
  -> hos.order.approved.v1
  -> Pharmacy prescription bootstrap
  -> Prescription verified
  -> Medication dispensed
  -> MAR administered
  -> admin read-back
  -> same-tenant RLS read-back
  -> cross-tenant denial
```

## Verification Evidence

Focused CDS proof:

```text
npx jest src/platform/healthcare/__tests__/cds-calculation-persistence-contract.test.ts --runInBand
= PASS
```

Hospital Real DB / RLS proof:

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-real-db-rls-proof.test.ts --runInBand
= PASS

Test Suites: 1 passed
Tests: 1 passed
```

## Canonical Status

```text
HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = PASS
PHARMACY_PRESCRIPTION_BOOTSTRAP_REAL_DB = PASS
PHARMACY_DISPENSE_REAL_DB = PASS
MAR_REAL_DB = PASS
SAME_TENANT_RLS = PASS
CROSS_TENANT_RLS = PASS

HOSPITAL_REAL_DB_RLS_PROOF = PASS
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN_FOR_BROWSER_E2E_OR_PRODUCTION
GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
HOSPITAL_BROWSER_E2E_PROOF
```
