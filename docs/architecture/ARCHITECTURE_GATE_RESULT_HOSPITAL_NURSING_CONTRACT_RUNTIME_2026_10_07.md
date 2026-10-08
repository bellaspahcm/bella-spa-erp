# Architecture Gate Result - Hospital Nursing Contract Runtime

Date: 2026-10-07

## Gate

HOSPITAL_NURSING_CONTRACT_RUNTIME = PASS_FOR_VITAL_SIGNS_SCOPE

## Canonical Context

- HOSPITAL_FOUNDATION = SEALED
- HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN_FOR_FOUNDATION_GO_LIVE_CHAIN_SCOPE
- HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE
- HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE
- HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME = PASS
- HOSPITAL_IMAGING_MINIMAL_RUNTIME = PROVEN_FOR_SUPPORTED_GO_LIVE_CHAIN_SCOPE

## Root Cause

Nursing public contract was present, but the Nursing engine runtime still targeted
a stale `hc_vital_signs` table path. Generated schema proves canonical vitals
persistence is `hc_nursing_vital_signs`.

## Minimal Fix

- Reused `NursingEngineContract`.
- Aligned `NursingEngineService.recordVitalSigns`, `getVitalSigns`, and
  `healthCheck` to `hc_nursing_vital_signs`.
- Added thin Hospital Nursing product service that records vital signs only
  through the public Nursing contract.
- Did not expose Nursing repository or direct persistence to Hospital.

## Ownership Map

| Capability | Owner | Product Access |
| --- | --- | --- |
| Nursing vital signs | Healthcare Nursing Engine | Public `NursingEngineContract` |
| Nursing note persistence | Healthcare Nursing Engine | NOT_PROVEN |
| H9 Temporal | Healthcare Temporal Engine | NOT_OPENED |
| H11 Audit Evidence | Healthcare Audit/Evidence Engine | NOT_OPENED |

## Contract Dependency Map

```text
Hospital Product
  -> NursingEngineContract
  -> NursingEngineService
  -> hc_nursing_vital_signs
```

Forbidden path remains blocked:

```text
Hospital Product
  -> Nursing repository / hc_nursing_vital_signs / direct DB
```

## Canonical Result

```text
HOSPITAL_NURSING_CONTRACT_TRACE = PASS
PUBLIC_HEALTHCARE_NURSING_CONTRACT = PRESENT
NURSING_VITAL_SIGNS_RUNTIME = PROVEN_FOR_SUPPORTED_GO_LIVE_SCOPE
NURSING_NOTES_RUNTIME = NOT_PROVEN
NURSING_MAR_RUNTIME = OUT_OF_SCOPE_ALREADY_PROVEN_UNDER_PHARMACY_MAR

TENANT_LINKAGE = PROVEN
PATIENT_LINKAGE = PROVEN
ENCOUNTER_LINKAGE = PROVEN
NURSE_LINKAGE = PROVEN

HOSPITAL_DIRECT_REPOSITORY_ACCESS = NO
DIRECT_HC_NURSING_VITAL_SIGNS_ACCESS = NO
DIRECT_HC_VITAL_SIGNS_ACCESS = NO

H9_TEMPORAL_ALIGNMENT = NOT_PROVEN
H11_AUDIT_RUNTIME = NOT_PROVEN
DISCHARGE = NOT_OPENED
BILLING_FINANCE = NOT_OPENED
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN

HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
NEXT_REQUIRED_CAPABILITY = DISCHARGE_CONTRACT_TRACE
```

## Evidence

- `src/products/bella-hospital/__tests__/hospital-nursing-contract-runtime.test.ts`
- `src/products/bella-hospital/services/__tests__/hospital-nursing-minimal-runtime.test.ts`
- `src/platform/healthcare/engines/nursing-engine/nursing-engine.service.ts`
- `src/products/bella-hospital/services/hospital-nursing.service.ts`

## Boundary

This slice does not prove Real DB/RLS, Browser E2E, H9 Temporal, H11 Audit,
Discharge, Billing, Finance, or production readiness.
