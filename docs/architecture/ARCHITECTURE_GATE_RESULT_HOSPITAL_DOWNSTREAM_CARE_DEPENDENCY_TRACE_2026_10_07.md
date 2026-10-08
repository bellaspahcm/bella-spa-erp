# ARCHITECTURE GATE RESULT - HOSPITAL DOWNSTREAM CARE DEPENDENCY TRACE

Date: 2026-10-07
Scope: Bella Hospital Go-Live business-chain trace
Slice: Downstream Care dependency trace after Clinical Orders and CDS medication gate
Status: PASS

## Canonical Baseline

```makefile
HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
```

Already sealed upstream scope:

```text
Patient/MPI
  -> Admission
  -> Encounter
  -> Bed / Transfer
  -> Clinical Orders
  -> Medication Order CDS Gate
```

This trace does not reopen upstream code or runtime evidence.

## Development Process Gate

Result: PASS_FOR_TRACE_ONLY

This is a read-only architecture trace. It does not authorize runtime implementation, UI work, schema work, Real DB/RLS proof, Browser E2E, Finance implementation, or production mutation.

## Product Manifest

Product: `bella_hospital`

Current Go-Live chain under trace:

```text
Clinical Orders
  -> Medication / Pharmacy / MAR
  -> Laboratory workflow / result
  -> Imaging workflow / result
  -> Nursing workflow / instructions
  -> Discharge readiness
  -> H9 Temporal + H11 Audit/Evidence
  -> Billing / Payment / Ledger / Reconciliation
```

## Ownership Map

| Capability | Canonical Owner | Hospital Ownership | Trace Result |
| --- | --- | --- | --- |
| Medication / Pharmacy / MAR | Healthcare Pharmacy Engine | Product consumer only | REQUIRED_FOR_GO_LIVE, REUSE_PUBLIC_CONTRACT, RUNTIME_MISSING |
| Laboratory workflow / result | Healthcare Laboratory Engine | Product consumer only | REQUIRED_FOR_GO_LIVE, REUSE_PUBLIC_CONTRACT, RUNTIME_MISSING, SEMANTICS_NOT_PROVEN |
| Imaging workflow / result | No public Healthcare Imaging contract found | Product must not use legacy direct tables | REQUIRED_FOR_GO_LIVE, PUBLIC_CONTRACT_MISSING, LEGACY/MOCK_ONLY |
| Nursing workflow / instructions | Healthcare Nursing Engine | Product consumer only | REQUIRED_FOR_GO_LIVE, REUSE_PUBLIC_CONTRACT, RUNTIME_PARTIAL, SEMANTICS_NOT_PROVEN |
| Downstream billing activation | Healthcare Order / Finance integration | Product consumer only | CONTRACT_EVENTS_PRESENT, RUNTIME_NOT_PROVEN |
| H9 Temporal timeline | Healthcare Temporal Engine | Product consumer only | CONTRACT_PRESENT, DOWNSTREAM_RUNTIME_NOT_PROVEN |
| H11 Audit/Evidence | Healthcare Audit/Evidence capabilities | Product consumer only | CONTRACT_PRESENT, DOWNSTREAM_RUNTIME_NOT_PROVEN |

## Contract Dependency Map

```text
Bella Hospital
  -> Healthcare OrderEngineContract
      -> OrderApproved event
      -> OrderCompleted event
  -> Healthcare PharmacyEngineContract
      -> getMedicationOrders
      -> recordMedicationAdministration
      -> dispenseMedication
      -> MedicationAdministered event
  -> Healthcare LaboratoryEngineContract
      -> collectSpecimen
      -> recordResult
      -> verifyResult
      -> ResultVerified event
  -> Healthcare NursingEngineContract
      -> recordVitalSigns
      -> createNursingNote
      -> VitalsRecorded event
  -> Healthcare TemporalEngineContract
      -> MEDICATIONS / LAB_RESULTS / VITAL_SIGNS / ORDERS / DECISIONS
  -> Healthcare Finance adapter events
      -> LAB / IMAGING / PHARMACY service types
```

No Hospital product code is authorized to call `hc_*` tables directly.

## Branch Trace

### 1. Medication Orders -> Pharmacy / MAR

Classification:

```makefile
MEDICATION_PHARMACY_MAR = REQUIRED_FOR_GO_LIVE
PUBLIC_HEALTHCARE_PHARMACY_CONTRACT = PRESENT
PHARMACY_ENGINE = PRESENT
HOSPITAL_CONSUMER = UI_HOOK_ONLY
ORDER_APPROVED_TO_PHARMACY = CONTRACT_PRESENT
PHARMACY_MAR_RUNTIME = NOT_PROVEN
PHARMACY_MAR_SEMANTICS = NOT_PROVEN
```

Evidence:

- `OrderType` includes `MEDICATION`.
- `OrderApproved` declares downstream pharmacy subscribers.
- `PharmacyEngineContract` exposes medication order read, dispense, and MAR administration APIs.
- Pharmacy engine has an `OrderApproved` subscriber that filters `MEDICATION` orders and bootstraps prescriptions.
- Hospital has a public-contract hook for Pharmacy/MAR consumption.

Boundary:

- A hook or contract consumer is not Go-Live runtime proof.
- Medication administration, dispense, inventory, audit, temporal, and finance effects are not proven for Hospital Go-Live scope.

Conclusion: first downstream runtime candidate. Start with `MEDICATION_PHARMACY_MAR_CONTRACT_TRACE`, not implementation.

### 2. Laboratory Orders -> Laboratory Workflow / Result

Classification:

```makefile
LABORATORY_WORKFLOW_RESULT = REQUIRED_FOR_GO_LIVE
PUBLIC_HEALTHCARE_LABORATORY_CONTRACT = PRESENT
LABORATORY_ENGINE = PRESENT
HOSPITAL_CONSUMER = NOT_FOUND
LAB_RUNTIME = NOT_PROVEN
LAB_SEMANTICS = NOT_PROVEN
```

Evidence:

- `OrderType` includes `LAB`.
- `OrderApproved` declares downstream laboratory subscribers.
- `ILaboratoryEngine` exposes specimen, result recording, verification, and critical result escalation.
- Laboratory service publishes `ResultVerified` and `CriticalResultEscalated`.

Trace findings:

- Laboratory event subscriber filters `snapshot.orderType !== 'laboratory'`, while the public order contract uses uppercase `LAB`.
- The service locator path constructs `LaboratoryEngineService(supabase)`, while the service constructor expects an `ILaboratoryRepository`.
- The clinical order reader maps order rows into laboratory snapshots, but patient/encounter semantics are not proven for Hospital Go-Live.

Boundary:

- This trace does not fix laboratory wiring.
- Existing engine unit evidence is not Hospital end-to-end downstream-care proof.

Conclusion: required, but after Medication/MAR unless the Go-Live scope explicitly prioritizes diagnostic results first.

### 3. Imaging Orders -> Imaging Workflow / Result

Classification:

```makefile
IMAGING_WORKFLOW_RESULT = REQUIRED_FOR_GO_LIVE
PUBLIC_HEALTHCARE_IMAGING_CONTRACT = MISSING
IMAGING_ENGINE = NOT_FOUND_AS_PUBLIC_CONTRACT
HOSPITAL_CONSUMER = NOT_PROVEN
IMAGING_RUNTIME = NOT_PROVEN
IMAGING_LEGACY_DIRECT_ACCESS = PRESENT
```

Evidence:

- `OrderType` includes `IMAGING`.
- Healthcare finance adapter recognizes `IMAGING` as a service type.
- Legacy healthcare actions and LIS/RIS actions access `hc_imaging_orders` directly.

Boundary:

- Legacy/direct `hc_imaging_orders` access is not a public Product -> Contract -> Kernel path.
- No public Imaging Engine contract was found in `src/platform/healthcare/contracts`.
- Hospital must not implement Imaging by consuming legacy `src/services/healthcare*` direct table paths.

Conclusion: required for full Go-Live chain if Hospital includes imaging services, but blocked for public contract before runtime.

### 4. Nursing Orders / Instructions -> Nursing Workflow

Classification:

```makefile
NURSING_WORKFLOW = REQUIRED_FOR_GO_LIVE
PUBLIC_HEALTHCARE_NURSING_CONTRACT = PRESENT
NURSING_ENGINE = PRESENT_PARTIAL
HOSPITAL_CONSUMER = UI_HOOK_ONLY
NURSING_ORDER_RUNTIME = NOT_PROVEN
NURSING_SEMANTICS = NOT_PROVEN
```

Evidence:

- `OrderType` includes `NURSING`.
- `NursingEngineContract` exposes vital signs and nursing notes.
- Nursing engine publishes `VitalsRecorded`.
- Hospital has a public-contract hook for nursing vitals.

Trace findings:

- Nursing engine declares placeholder status in implementation comments.
- No proven OrderApproved or OrderCreated subscriber for `NURSING` orders was found.
- Vitals/notes contract does not prove nursing order fulfillment semantics.

Boundary:

- Nursing vitals capture is not equivalent to nursing workflow completion.
- Hospital UI hook evidence is not Go-Live runtime proof.

Conclusion: required, but not the immediate next node while Medication/MAR is closer to the proven Clinical Orders -> CDS path.

## Downstream Effects Trace

### Discharge

```makefile
DOWNSTREAM_CARE_TO_DISCHARGE = NOT_PROVEN
```

Clinical order completion declares an encounter-engine subscriber, but Hospital discharge readiness from medication administration, lab result verification, imaging result completion, and nursing documentation is not proven.

### H9 Temporal

```makefile
DOWNSTREAM_CARE_TO_H9_TEMPORAL = PARTIAL_CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
```

Temporal contract supports `MEDICATIONS`, `LAB_RESULTS`, `VITAL_SIGNS`, `ORDERS`, and `DECISIONS`. Runtime propagation from Hospital downstream care is not proven in this slice.

### H11 Audit / Evidence

```makefile
DOWNSTREAM_CARE_TO_H11_AUDIT_EVIDENCE = NOT_PROVEN
```

Some engines publish domain events after persistence. This trace does not prove H11 evidence package generation or immutable audit coverage for downstream care.

### Billing / Payment / Ledger / Reconciliation

```makefile
DOWNSTREAM_CARE_TO_BILLING_FINANCE = PARTIAL_CONTRACT_EVENTS_PRESENT_RUNTIME_NOT_PROVEN
```

Order events and the healthcare finance adapter include downstream billing/service categories. Hospital Billing, Payment, Ledger, AR, and Reconciliation remain out of scope and not proven.

## Classification Summary

```makefile
HOSPITAL_DOWNSTREAM_CARE_DEPENDENCY_TRACE = PASS

REQUIRED_DOWNSTREAM_CAPABILITIES = [
  MEDICATION_PHARMACY_MAR,
  LABORATORY_WORKFLOW_RESULT,
  IMAGING_WORKFLOW_RESULT,
  NURSING_WORKFLOW
]

OPTIONAL_DOWNSTREAM_CAPABILITIES = [
  PROCEDURE,
  DIET
]

ALREADY_PROVEN = [
  HOSPITAL_CLINICAL_ORDERS_RUNTIME,
  HOSPITAL_ORDERS_TO_CDS_RUNTIME_FOR_MEDICATION_ORDER_SCOPE
]

MISSING_PUBLIC_CONTRACTS = [
  PUBLIC_HEALTHCARE_IMAGING_CONTRACT
]

MISSING_RUNTIME = [
  HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME,
  HOSPITAL_LABORATORY_RUNTIME,
  HOSPITAL_IMAGING_RUNTIME,
  HOSPITAL_NURSING_ORDER_RUNTIME
]

MISSING_SEMANTICS = [
  ORDER_APPROVED_TO_PHARMACY_TO_MAR_SEMANTICS,
  MEDICATION_ADMINISTRATION_TO_TEMPORAL_AUDIT_BILLING,
  ORDER_APPROVED_TO_LAB_SEMANTICS,
  LAB_ORDER_TYPE_CASE_ALIGNMENT,
  LAB_SERVICE_LOCATOR_REPOSITORY_WIRING,
  LAB_RESULT_TO_DISCHARGE_TEMPORAL_AUDIT_BILLING,
  IMAGING_PUBLIC_CONTRACT_AND_RUNTIME,
  NURSING_ORDER_FULFILLMENT,
  DOWNSTREAM_CARE_TO_DISCHARGE_READINESS,
  DOWNSTREAM_CARE_TO_H9_TEMPORAL_RUNTIME,
  DOWNSTREAM_CARE_TO_H11_AUDIT_EVIDENCE_RUNTIME,
  DOWNSTREAM_CARE_TO_FINANCE_RUNTIME
]
```

## Next Required Capability

```makefile
NEXT_REQUIRED_CAPABILITY = MEDICATION_PHARMACY_MAR_CONTRACT_TRACE
```

Reason:

1. Medication Orders are already connected to the sealed Clinical Orders and CDS medication gate path.
2. Public Pharmacy/MAR contract exists.
3. Pharmacy engine and an OrderApproved subscriber exist.
4. Hospital has a consumer surface, but only UI hook evidence so far.
5. Medication administration is a required inpatient downstream-care proof before claiming discharge readiness or medication-related billing.

The next slice must still be trace-first:

```text
Medication Order
  -> Pharmacy Contract
  -> Prescription / Dispense
  -> MAR Administration
  -> Temporal / Audit / Billing dependency trace
```

No runtime implementation is authorized by this artifact.

## Out Of Scope

- No Pharmacy/MAR runtime implementation.
- No Laboratory runtime implementation.
- No Imaging contract creation or runtime implementation.
- No Nursing runtime implementation.
- No UI.
- No DB/schema migration.
- No Real DB/RLS.
- No Browser E2E.
- No Billing/Finance implementation.
- No production mutation.
- No changes to frozen Healthcare Kernel H1-H12.

## Canonical Status After This Slice

```makefile
HOSPITAL_DOWNSTREAM_CARE_DEPENDENCY_TRACE = PASS

HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE

MEDICATION_PHARMACY_MAR = REQUIRED_FOR_GO_LIVE
LABORATORY_WORKFLOW_RESULT = REQUIRED_FOR_GO_LIVE
IMAGING_WORKFLOW_RESULT = REQUIRED_FOR_GO_LIVE
NURSING_WORKFLOW = REQUIRED_FOR_GO_LIVE

HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
```

## Verification Plan

Required for this trace:

```text
1. Source trace of public contracts and engine consumers.
2. Architecture artifact.
3. git diff --check.
```

No runtime tests are required because this slice does not implement runtime behavior.
