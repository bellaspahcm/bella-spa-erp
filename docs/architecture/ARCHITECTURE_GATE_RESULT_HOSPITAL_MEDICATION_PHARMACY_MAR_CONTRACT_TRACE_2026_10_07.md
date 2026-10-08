# ARCHITECTURE GATE RESULT - HOSPITAL MEDICATION / PHARMACY / MAR CONTRACT TRACE

Date: 2026-10-07
Scope: Bella Hospital Go-Live business-chain trace
Slice: Medication Order -> Pharmacy -> MAR -> downstream evidence
Status: PASS

## Canonical Baseline

```makefile
HOSPITAL_FOUNDATION = SEALED

HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN_FOR_FOUNDATION_GO_LIVE_CHAIN_SCOPE
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE
HOSPITAL_DOWNSTREAM_CARE_DEPENDENCY_TRACE = PASS

MEDICATION_PHARMACY_MAR = REQUIRED_FOR_HOSPITAL_GO_LIVE
PUBLIC_CONTRACT = PRESENT
ENGINE_SUBSCRIBER = PRESENT
HOSPITAL_RUNTIME_SEMANTICS = NOT_PROVEN
```

This slice does not reopen Clinical Orders, CDS wiring, Admission, Encounter, Bed/Transfer, or Discharge.

## Development Process Gate

Result: PASS_FOR_TRACE_ONLY

This is a trace-only architecture gate. It authorizes an architecture artifact and focused static boundary test only. It does not authorize runtime implementation, UI work, DB/schema work, Real DB/RLS, Browser E2E, Finance implementation, or production mutation.

## Product Manifest

Product: `bella_hospital`

Capability under trace:

```text
Hospital Clinical Orders
  -> Medication Order
  -> Pharmacy verification / dispense
  -> Medication Administration Record (MAR)
  -> Downstream Care Evidence
  -> Discharge / Audit / Temporal / Billing
```

Non-goals:

- No Pharmacy/MAR runtime adapter implementation.
- No CDS changes.
- No Lab, Imaging, Nursing implementation.
- No Billing/Finance implementation.
- No direct persistence access from Hospital Product.

## Ownership Map

| Capability | Owner | Hospital Authority | Trace Result |
| --- | --- | --- | --- |
| Medication order type and order lifecycle events | Healthcare Order Engine public contract | Product consumer only | REUSE_PUBLIC_CONTRACT |
| Pharmacy verification / dispense | Healthcare Pharmacy Engine public contract | Product consumer only | REUSE_PUBLIC_CONTRACT |
| MAR administration | Healthcare Pharmacy Engine public contract | Product consumer only | REUSE_PUBLIC_CONTRACT |
| Medication administration event | Healthcare Pharmacy Engine public contract | Product consumer only | CONTRACT_PRESENT |
| Medication temporal timeline | H9 Temporal public contract | Product consumer only | CONTRACT_PRESENT, RUNTIME_NOT_PROVEN |
| Medication audit/evidence | H11 Audit/Evidence capability | Product consumer only | CONTRACT_PRESENT, RUNTIME_NOT_PROVEN |
| Medication billing/ledger | Healthcare finance integration / Finance OS | Product consumer only | CONTRACT_PRESENT, RUNTIME_NOT_PROVEN |

Hospital must consume public Healthcare contracts. Hospital must not import Pharmacy internals or query `hc_prescriptions` / `hc_medication_administration_records` directly.

## Contract Dependency Map

```text
Bella Hospital
  -> Healthcare OrderEngineContract
      -> OrderType = MEDICATION
      -> OrderApproved
      -> OrderCompleted
      -> OrderDiscontinued
  -> Healthcare PharmacyEngineContract
      -> verifyPrescription
      -> dispenseMedication
      -> getMedicationOrders
      -> recordMedicationAdministration
      -> MedicationAdministered
  -> H9 Temporal Contract
      -> MEDICATIONS / ORDERS / DECISIONS fields present
  -> H11 Audit/Evidence
      -> required for production semantics, not proven in this slice
  -> Healthcare Finance Adapter
      -> publishMedicationDispensed exists
```

Public exports are present through `src/platform/healthcare/contracts/index.ts`.

## Phase 1 - Medication Contract Trace

```makefile
MEDICATION_CONTRACT = REUSE_ORDER_ENGINE_PUBLIC_CONTRACT
PUBLIC_CONTRACT_PRESENT = YES
CONTRACT_OWNER = HEALTHCARE_ORDER_ENGINE
CONTRACT_EXPORT = PRESENT
CONTRACT_CONSUMER = HOSPITAL_CLINICAL_ORDERS_RUNTIME_ALREADY_SEALED
```

Evidence:

- `OrderType` includes `MEDICATION`.
- `OrderApprovedPayload`, `OrderCompletedPayload`, and `OrderDiscontinuedPayload` carry `orderId`, `tenantId`, and `encounterId`.
- `OrderApproved` contract says medication orders trigger pharmacy dispensing workflow and includes `pharmacy-engine` as subscriber.
- `OrderCompleted` includes `billing-engine` and `encounter-engine` subscribers.
- `OrderDiscontinued` includes `pharmacy-engine` and `billing-engine` subscribers.

Classification:

```makefile
MEDICATION_ORDER_CONTRACT = REUSE_PUBLIC_CONTRACT
NEW_PUBLIC_CONTRACT_REQUIRED = NO
MEDICATION_ORDER_RUNTIME = ALREADY_PROVEN_UPSTREAM_ONLY
```

## Phase 2 - Order -> Pharmacy Trace

```makefile
MEDICATION_ORDER_TO_PHARMACY = PARTIAL
ORDER_APPROVED_TO_PHARMACY_CONTRACT = PRESENT
PHARMACY_SUBSCRIBER = PRESENT
PHARMACY_RUNTIME_FOR_HOSPITAL = NOT_PROVEN
```

Evidence:

- Pharmacy `OrderApprovedSubscriber` reads an approved order snapshot, filters `snapshot.orderType !== 'MEDICATION'`, performs an idempotency check by clinical order id, creates a `Prescription`, and persists it.
- The created prescription carries `tenantId`, `encounterId`, `patientPartyId`, `doctorPartyId`, and `clinicalOrderId`.
- Pharmacy repository persists prescriptions to the engine-owned `hc_prescriptions` table and preserves `encounter_id`, `patient_party_id`, and `clinical_order_id`.

Boundary:

- The subscriber is Healthcare engine implementation evidence, not Hospital runtime proof.
- Hospital must not instantiate the subscriber or repository directly.
- Existing Hospital consumer surface is a hook that calls `getHealthcareService<PharmacyEngineContract>('pharmacy-engine', supabase)`, which is contract-aligned but UI/hook evidence only.

Classification:

```makefile
ORDER_TO_PHARMACY_CONTRACT = PROVEN
ORDER_TO_PHARMACY_RUNTIME = RUNTIME_EXISTING_NOT_PROVEN_FOR_HOSPITAL
ORDER_TO_PHARMACY_SEMANTICS = SEMANTICS_NOT_PROVEN_FOR_GO_LIVE
```

## Phase 3 - Pharmacy -> MAR Trace

```makefile
PHARMACY_CONTRACT = REUSE_PUBLIC_CONTRACT
MAR_CONTRACT = REUSE_PUBLIC_CONTRACT
PHARMACY_TO_MAR = PARTIAL
```

Evidence:

- `PharmacyEngineContract` exposes:
  - `verifyPrescription`
  - `dispenseMedication`
  - `getMedicationOrders`
  - `recordMedicationAdministration`
- Pharmacy domain status flow includes `PENDING_VERIFICATION -> VERIFIED -> DISPENSED -> MAR_READY`.
- `dispenseMedication` saves the prescription before publishing `MedicationDispensed`.
- `recordMedicationAdministration` looks up a prescription by clinical order id, creates a MAR entry, saves MAR, then publishes `MedicationAdministered`.
- `MedicationAdministered` payload includes `patientId`, `encounterId`, `medicationId`, `drugName`, `dosage`, `route`, `administeredAt`, and `practitionerId`.
- MAR domain supports `scheduled`, `administered`, `refused`, `held`, and `missed` states.

Boundary:

- `ORDERED -> DISPENSED -> ADMINISTERED` has contract and engine-level code evidence.
- Hospital Go-Live runtime path through the product service layer is not proven in this slice.
- Refused/held/missed semantics exist in MAR domain status, but Hospital workflow semantics are not proven.
- Pharmacy service locator currently constructs `PharmacyEngineService(supabase)`; whether Hospital runtime requires CDS injection into Pharmacy dispense is not proven here and must not be changed in this trace.

Classification:

```makefile
PHARMACY_TO_MAR_CONTRACT = PROVEN
PHARMACY_TO_MAR_RUNTIME = RUNTIME_EXISTING_NOT_PROVEN_FOR_HOSPITAL
PHARMACY_TO_MAR_SEMANTICS = SEMANTICS_NOT_PROVEN_FOR_GO_LIVE
```

## Phase 4 - Downstream Evidence

### Discharge

```makefile
DOWNSTREAM_DISCHARGE = NOT_PROVEN
```

`OrderCompleted` has an `encounter-engine` subscriber by contract, but medication dispense/MAR completion has not been proven as a Hospital discharge readiness input.

### Audit / Evidence

```makefile
DOWNSTREAM_AUDIT_EVIDENCE = CONTRACT_REQUIRED_RUNTIME_NOT_PROVEN
```

Medication events are published after persistence in the observed engine methods, but this slice does not prove H11 evidence package generation for Hospital medication administration.

### H9 Temporal

```makefile
DOWNSTREAM_TEMPORAL = CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
```

Temporal contract supports medication/order/decision fields, but runtime propagation from Pharmacy/MAR to H9 is not proven.

### Billing / Payment / Ledger

```makefile
DOWNSTREAM_BILLING = CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
```

Healthcare finance adapter exposes `publishMedicationDispensed`, and order events include billing subscribers, but Hospital medication billing/payment/ledger/reconciliation is not proven.

## Classification

```makefile
HOSPITAL_MEDICATION_PHARMACY_MAR_CONTRACT_TRACE = PASS

MEDICATION_CONTRACT = REUSE_PUBLIC_CONTRACT
PHARMACY_CONTRACT = REUSE_PUBLIC_CONTRACT
MAR_CONTRACT = REUSE_PUBLIC_CONTRACT

MEDICATION_ORDER_TO_PHARMACY = PARTIAL
PHARMACY_TO_MAR = PARTIAL

DOWNSTREAM_DISCHARGE = NOT_PROVEN
DOWNSTREAM_AUDIT_EVIDENCE = CONTRACT_REQUIRED_RUNTIME_NOT_PROVEN
DOWNSTREAM_TEMPORAL = CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
DOWNSTREAM_BILLING = CONTRACT_PRESENT_RUNTIME_NOT_PROVEN

PUBLIC_CONTRACT_MISSING = []

RUNTIME_MISSING = [
  HOSPITAL_MEDICATION_PHARMACY_MAR_MINIMAL_RUNTIME
]

SEMANTICS_NOT_PROVEN = [
  HOSPITAL_ORDER_TO_PHARMACY_RUNTIME_SEMANTICS,
  HOSPITAL_DISPENSE_TO_MAR_RUNTIME_SEMANTICS,
  ADMINISTERED_REFUSED_HELD_MISSED_HOSPITAL_WORKFLOW_SEMANTICS,
  MEDICATION_TO_DISCHARGE_READINESS,
  MEDICATION_TO_H9_TEMPORAL_RUNTIME,
  MEDICATION_TO_H11_AUDIT_EVIDENCE_RUNTIME,
  MEDICATION_TO_BILLING_PAYMENT_LEDGER_RUNTIME
]

LEGACY_MOCK_ONLY = []

ALREADY_PROVEN = [
  HOSPITAL_CLINICAL_ORDERS_RUNTIME,
  HOSPITAL_ORDERS_TO_CDS_RUNTIME_FOR_MEDICATION_ORDER_SCOPE,
  PUBLIC_ORDER_ENGINE_CONTRACT,
  PUBLIC_PHARMACY_ENGINE_CONTRACT
]
```

## Next Required Capability

```makefile
NEXT_REQUIRED_CAPABILITY = HOSPITAL_MEDICATION_PHARMACY_MAR_MINIMAL_RUNTIME
```

Reason:

1. Public contracts exist and are exported.
2. Medication order, pharmacy subscriber, prescription, dispense, and MAR methods exist.
3. Hospital currently has only hook-level consumer evidence for Pharmacy/MAR.
4. Go-Live chain needs runtime proof that Hospital can drive the medication order to Pharmacy/MAR path through public contracts without touching internals.
5. Downstream discharge, temporal, audit/evidence, and billing remain not proven and must not be claimed in the next runtime slice unless explicitly tested.

## Out Of Scope

- No Pharmacy/MAR runtime implementation in this slice.
- No CDS modification.
- No Lab, Imaging, or Nursing.
- No Billing, Payment, Ledger, or Reconciliation.
- No Real DB/RLS.
- No Browser E2E.
- No production configuration.
- No Healthcare Kernel H1-H12 modification.

## Verification Plan

Required for this trace:

```text
1. Focused architecture test for Medication/Pharmacy/MAR contract trace.
2. npm run typecheck:changed.
3. Healthcare guard, because this slice touches Healthcare/Hospital architecture evidence.
4. Changed-file no-any / no suppression check.
5. git diff --check.
```

## Verification Results

```makefile
focused_architecture_test = PASS
  command = npx jest src/products/bella-hospital/__tests__/hospital-medication-pharmacy-mar-contract-trace.test.ts --runInBand
  result = 1 suite / 6 tests PASS

typecheck_changed = PASS
  command = npm run typecheck:changed
  result = zero diagnostics

healthcare_guard = PASS
  command = npm run healthcare:guard
  result = zero violations

changed_ts_no_any_or_suppression = PASS
  scope = src/products/bella-hospital/__tests__/hospital-medication-pharmacy-mar-contract-trace.test.ts
  result = no any / as any / @ts-ignore / @ts-expect-error

git_diff_check = PASS
  note = existing CRLF warning remains on src/products/bella-hospital/index.ts
```

## Canonical Status After This Slice

```makefile
HOSPITAL_MEDICATION_PHARMACY_MAR_CONTRACT_TRACE = PASS

MEDICATION_CONTRACT = REUSE_PUBLIC_CONTRACT
PHARMACY_CONTRACT = REUSE_PUBLIC_CONTRACT
MAR_CONTRACT = REUSE_PUBLIC_CONTRACT

HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = HOSPITAL_MEDICATION_PHARMACY_MAR_MINIMAL_RUNTIME
```
