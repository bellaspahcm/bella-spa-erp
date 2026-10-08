# ARCHITECTURE GATE RESULT - HOSPITAL MEDICATION / PHARMACY / MAR RUNTIME

Date: 2026-10-07
Scope: Bella Hospital Go-Live business-chain runtime
Slice: Medication Order -> Pharmacy Fulfillment -> MAR Administration
Status: PASS_FOR_MINIMAL_IMPLEMENTATION

## Canonical Baseline

```makefile
HOSPITAL_FOUNDATION = SEALED

HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN_FOR_FOUNDATION_GO_LIVE_CHAIN_SCOPE
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE
HOSPITAL_DOWNSTREAM_CARE_DEPENDENCY_TRACE = PASS
HOSPITAL_MEDICATION_PHARMACY_MAR_CONTRACT_TRACE = PASS

MEDICATION_CONTRACT = REUSE_PUBLIC_CONTRACT
PHARMACY_CONTRACT = REUSE_PUBLIC_CONTRACT
MAR_CONTRACT = REUSE_PUBLIC_CONTRACT

PUBLIC_CONTRACT_MISSING = []
```

## Problem / Non-Goals

Problem:

```text
Hospital Go-Live chain needs runtime proof for:

Medication Order
  -> Pharmacy Fulfillment
  -> Medication Administration / MAR
  -> Evidence/Event
```

Non-goals:

- No new public contract.
- No Pharmacy engine clone.
- No MAR engine clone.
- No Healthcare Kernel H1-H12 modification.
- No Clinical Orders or CDS modification.
- No Laboratory, Imaging, Nursing, Finance, Billing, Real DB/RLS, Browser E2E, UI, or production configuration.

## Truth / Source Of Truth

| Truth | Source Of Truth | Status |
| --- | --- | --- |
| Medication order is a public Healthcare Order capability | `OrderEngineContract` | PRESENT |
| Pharmacy/MAR is a public Healthcare Pharmacy capability | `PharmacyEngineContract` | PRESENT |
| Hospital Clinical Orders runtime is already sealed | `HospitalClinicalOrdersProductService` and tests | PROVEN |
| Pharmacy/MAR Hospital runtime semantics | Current slice | TO_PROVE |

## Ownership Map

| Capability | Owner | Hospital Authority |
| --- | --- | --- |
| Medication order creation/approval | Healthcare Order Engine public contract | Consumer through sealed Hospital Clinical Orders service |
| Pharmacy verification/dispense | Healthcare Pharmacy Engine public contract | Consumer through public contract |
| MAR administration | Healthcare Pharmacy Engine public contract | Consumer through public contract |
| Events/evidence emitted by Pharmacy | Healthcare Pharmacy Engine / Event Bus | Observe public response and event semantics only |
| Discharge, Temporal, Audit, Billing | Healthcare OS / Finance OS | Out of scope for runtime proof |

## Contract Dependency Map

```text
HospitalMedicationPharmacyMarProductService
  -> HospitalClinicalOrdersProductService
      -> public OrderEngineContract
  -> public PharmacyEngineContract
      -> verifyPrescription
      -> dispenseMedication
      -> recordMedicationAdministration
```

This slice intentionally uses the sealed Hospital Clinical Orders product boundary for Medication Order creation/approval so it does not reopen CDS wiring or Order Engine composition.

## Change Authority

Authorized:

- Add a Hospital Product service under `src/products/bella-hospital/services`.
- Add focused Hospital Product service tests.
- Export the new service from `src/products/bella-hospital/index.ts`.

Not authorized:

- Modify Healthcare engine internals.
- Modify public Healthcare contracts.
- Modify schema/migrations.
- Modify UI.
- Add Finance/Billing runtime.

## Minimal Implementation Plan

1. Add `HospitalMedicationPharmacyMarProductService`.
2. Reuse sealed `HospitalClinicalOrdersProductService` for `MEDICATION` order creation and approval.
3. Reuse `PharmacyEngineContract` for pharmacy verification, dispense, and MAR administration.
4. Preserve `tenantId`, `patientId`, `encounterId`, and `orderId` through the runtime DTO.
5. Reject non-medication input before Pharmacy/MAR flow.
6. Add focused unit tests using public-contract fakes.
7. Keep downstream discharge, temporal, audit/evidence, billing, Real DB/RLS, and Browser E2E as `NOT_PROVEN`.

## Verification Plan

```text
focused Hospital Medication/Pharmacy/MAR tests
npm run typecheck:changed
npm run healthcare:guard
changed-file no-any/no-suppression scan
git diff --check
```

## Verification Results

```makefile
focused_runtime_tests = PASS
  command = npx jest src/products/bella-hospital/services/__tests__/hospital-medication-pharmacy-mar.service.test.ts --runInBand
  result = 1 suite / 5 tests PASS

focused_related_tests = PASS
  command = npx jest src/products/bella-hospital/__tests__/hospital-medication-pharmacy-mar-contract-trace.test.ts src/products/bella-hospital/services/__tests__/hospital-clinical-orders.service.test.ts src/products/bella-hospital/services/__tests__/hospital-medication-pharmacy-mar.service.test.ts --runInBand
  result = 3 suites / 15 tests PASS

typecheck_changed = PASS
  command = npm run typecheck:changed
  result = zero diagnostics

healthcare_guard = PASS
  command = npm run healthcare:guard
  result = zero violations

changed_ts_no_any_or_suppression = PASS
  scope = src/products/bella-hospital/services/hospital-medication-pharmacy-mar.service.ts, src/products/bella-hospital/services/__tests__/hospital-medication-pharmacy-mar.service.test.ts, src/products/bella-hospital/index.ts
  result = no any / as any / @ts-ignore / @ts-expect-error

git_diff_check = PASS
  note = existing CRLF warning remains on src/products/bella-hospital/index.ts
```

## Proven Runtime Behavior

```makefile
MEDICATION_ORDER_TO_PHARMACY = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE
PHARMACY_TO_MAR = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE

PUBLIC_CONTRACTS_CREATED = NONE
HEALTHCARE_ENGINE_INTERNALS_MODIFIED = NONE
DIRECT_HC_TABLE_ACCESS_FROM_HOSPITAL = NONE
```

Runtime proof:

```text
HospitalMedicationPharmacyMarProductService
  -> HospitalClinicalOrdersProductService.createClinicalOrder(MEDICATION)
  -> HospitalClinicalOrdersProductService.approveClinicalOrder
  -> PharmacyEngineContract.verifyPrescription
  -> PharmacyEngineContract.dispenseMedication
  -> PharmacyEngineContract.recordMedicationAdministration
```

Linkage proven:

```text
tenantId
patientId
encounterId
orderId
```

Non-medication guard proven:

```text
LAB order input -> rejected before Pharmacy/MAR calls
```

## Remaining Semantic Gaps

```makefile
SEMANTICS_NOT_PROVEN = [
  MEDICATION_TO_DISCHARGE_READINESS,
  MEDICATION_TO_H9_TEMPORAL_RUNTIME,
  MEDICATION_TO_H11_AUDIT_EVIDENCE_RUNTIME,
  MEDICATION_TO_BILLING_PAYMENT_LEDGER_RUNTIME,
  REAL_DB_RLS,
  BROWSER_E2E
]
```

## Final Canonical Status

```makefile
HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE

MEDICATION_ORDER_TO_PHARMACY = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE
PHARMACY_TO_MAR = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE

PUBLIC_CONTRACTS_CREATED = NONE

HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = LABORATORY_CONTRACT_TRACE
```
