# Architecture Gate Result - Hospital Go-Live Full Business Chain Trace - 2026-10-07

## Status

```text
HOSPITAL_GO_LIVE_FULL_BUSINESS_CHAIN_TRACE = PASS
HOSPITAL_FOUNDATION = SEALED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
HOSPITAL_OPERATIONAL_PROOF = NOT_PROVEN

BACKUP_RESTORE_READINESS = PLATFORM_CONCERN_NOT_BUSINESS_CHAIN_SCOPE
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
GO_LIVE_DECISION = NO
```

This is a trace-only slice. It does not implement runtime, UI, DB, Real DB,
Browser E2E, Finance, or new Healthcare contracts.

## Scope

Question:

```text
What Hospital business capabilities are still required to prove a Go-Live
business chain after the Foundation chain has been sealed?
```

Non-goals:

```text
Do not reopen Patient/MPI, Admission, Encounter, Bed/Transfer, or Discharge
contract traces already sealed.

Do not implement Nursing, Pharmacy, CDS, Clinical Orders, Lab/Imaging,
Billing, Finance, UI, DB, Real DB, or Browser E2E in this slice.

Do not include Backup/Restore in Hospital business-chain scope.
```

## Source Evidence

| Evidence | Result |
| --- | --- |
| `src/products/bella-hospital/index.ts` | Hospital product currently exports Admission, Clinical Alert, Encounter, and Patient/MPI product services. |
| `src/products/bella-hospital/services/hospital-patient-mpi.service.ts` | Patient/MPI runtime consumes `PatientMpiContract`; sealed for foundation scope. |
| `src/products/bella-hospital/services/hospital-encounter.service.ts` | Encounter runtime consumes public `IEncounterEngine`; sealed for foundation scope and explicitly excludes Bed, Nursing, Pharmacy, CDS, Temporal/Audit, Billing, and Finance. |
| `src/products/bella-hospital/services/hospital-admission.service.ts` | Existing consumer covers admission, bed transfer, discharge via Admission, H9 temporal for transfer, and H11 audit/evidence for discharge. |
| `src/products/bella-hospital/services/hospital-clinical-alert.service.ts` | Existing consumer routes medication-order safety to H8 CDS, but does not create clinical orders or medication administration records. |
| `src/products/bella-hospital/hooks/use-order-engine.ts` | UI hook consumes public `OrderEngineContract`; no Hospital product runtime service currently seals order lifecycle. |
| `src/products/bella-hospital/hooks/use-nursing-engine.ts` | UI hook consumes public `NursingEngineContract`; no Hospital product runtime service currently seals nursing workflow. |
| `src/products/bella-hospital/hooks/use-pharmacy-engine.ts` | UI hook consumes public `PharmacyEngineContract`; no Hospital product runtime service currently seals pharmacy / MAR workflow. |
| `src/products/bella-hospital/hooks/use-cds-engine.ts` | UI hook consumes public `CdsEngineContract`; H8 exists, but Go-Live clinical-order safety semantics are not sealed. |
| `src/products/bella-hospital/hooks/use-bed-engine.ts` | UI hook consumes public `BedEngineContract`; bed transfer contract trace is sealed, discharge bed-release semantics remain not proven. |
| `src/app/dashboard/hospital/*` | Hospital has dashboard surfaces for admissions, beds, nursing vitals, MAR, pharmacy, ancillary, billing, BHYT, incidents, ICU dispatch, reports, and workforce. Many rely on mock data or legacy services and are not operational proof. |
| `src/services/healthcare-hospital-services.ts` | Legacy bridge still contains direct `hc_*` table access and mock fallback paths for wards, beds, admissions, vitals, MAR, and break-glass. This is evidence of legacy surface behavior, not canonical Go-Live proof. |
| `src/services/healthcare/clinical-alerts-service.ts` | Legacy clinical alert service directly reads/writes `hc_clinical_alerts` and uses a mock CDS contract for `evaluateOrderSafetyWithCds(...)`. Not sufficient for Go-Live clinical safety proof. |
| `src/services/healthcare/lis-ris-actions.ts` | Lab/imaging actions directly write `hc_clinical_orders`, `hc_lab_orders`, `hc_imaging_orders`, and `hc_encounters`; this is not contract-first Hospital product runtime proof. |
| `src/services/healthcare/billing-actions.ts` | Medical billing/payment/reconciliation actions exist, but include direct table access and embedded accounting account-code assumptions; Finance Go-Live proof is not established here. |
| `src/services/healthcare/bhyt-actions.ts` | BHYT claim export exists and reads `hc_encounters` / `hc_master_patient_index`; useful surface evidence, not sealed Go-Live contract/runtime proof. |
| `src/platform/healthcare/contracts/order-engine.contract.ts` | Public Order contract exists and defines CPOE lifecycle with CDS mandatory at `createOrder(...)`. |
| `src/platform/healthcare/contracts/nursing-engine.contract.ts` | Public Nursing contract exists for vital signs and nursing notes. |
| `src/platform/healthcare/contracts/pharmacy-engine.contract.ts` | Public Pharmacy/MAR contract exists for medication orders, verification, dispensing, and administration. |
| `src/platform/healthcare/contracts/cds-engine.contract.ts` | Public CDS contract exists for drug interactions, allergy/protocol checks, CDS summary, and allergy recording. |
| `src/platform/healthcare/contracts/laboratory-engine.contract.ts` | Public Laboratory contract exists for specimen collection, receive, processing, result recording, verification, and critical acknowledgement. |
| `src/platform/healthcare/contracts/bed-engine.contract.ts` | Public Bed contract includes `releaseBed(...)`, but current discharge consumer does not call it. |
| `src/platform/healthcare/contracts/temporal-engine.contract.ts` | Public H9 contract exists; discharge temporal semantics remain not proven. |
| `src/platform/healthcare/contracts/clinical-audit.contract.ts` | Public H11 clinical audit/evidence contract exists and is used by current discharge consumer. |

## Canonical Go-Live Business Chain

The minimum Hospital Go-Live business chain inferred from current code and
Healthcare contracts is:

```text
Patient Registration / MPI
  -> Admission
  -> Encounter
  -> Bed Assignment
  -> Bed Transfer when needed
  -> Clinical Orders / CPOE
  -> CDS / Safety Gate for clinical decisions
  -> Nursing Vitals / Nursing Notes
  -> Medication / Pharmacy / MAR when medication is ordered
  -> Lab / Imaging when diagnostic orders are created
  -> Clinical Timeline / H9 Temporal
  -> Discharge
  -> Bed Release
  -> H11 Audit / Evidence
  -> Billing / BHYT / Payment / Ledger for charged services
```

This is not yet proven end to end.

## Classification

| Capability | Classification | Public Contract | Runtime Status | Semantics Status | Decision |
| --- | --- | --- | --- | --- | --- |
| Product Identity | ALREADY_PROVEN | ProductRegistry sealed | PROVEN for identity | Product identity only | Do not reopen. |
| Patient Registration / MPI | ALREADY_PROVEN | `PatientMpiContract` present | PROVEN_FOR_FOUNDATION_SCOPE | Go-Live E2E not proven | Do not reopen before chain E2E. |
| Admission | ALREADY_PROVEN / REUSE_PUBLIC_CONTRACT | Admission contract present | EXISTING_CONSUMER_NOT_REOPENED | Real DB / browser not proven | Do not reopen. |
| Encounter | ALREADY_PROVEN / REUSE_PUBLIC_CONTRACT | Encounter contract present | PROVEN_FOR_FOUNDATION_SCOPE | Clinical chain not proven | Do not reopen; use as aggregate root. |
| Bed Assignment | REQUIRED_FOR_HOSPITAL_GO_LIVE | `BedEngineContract.allocateBed(...)` present | UI hook and legacy bridge exist | Bed assignment semantics not sealed in Go-Live chain | Required after Orders trace or as part of discharge/bed semantics slice. |
| Bed Transfer | ALREADY_TRACED / REUSE_PUBLIC_CONTRACT | `BedEngineContract.transferBed(...)` present | Existing consumer | H9 transfer event proven only in unit/mock scope | Do not reopen contract; later operational proof needed. |
| Clinical Orders / CPOE | REQUIRED_FOR_HOSPITAL_GO_LIVE | `OrderEngineContract` present | UI hook only; no sealed Hospital product runtime service | NOT_PROVEN | Next required capability. |
| CDS / Clinical Safety | REQUIRED_FOR_HOSPITAL_GO_LIVE | `CdsEngineContract` present | Existing Hospital clinical-alert service + hook | Medication safety is bounded/mock/unit-level, not Go-Live chain proof | Trace with Clinical Orders; do not treat standalone alerts as full clinical workflow. |
| Nursing Vitals / Notes | REQUIRED_FOR_HOSPITAL_GO_LIVE | `NursingEngineContract` present | UI hook + legacy direct `hc_nursing_vital_signs` bridge | NOT_PROVEN | Required after Orders/CDS boundary because inpatient care needs recorded observations. |
| Medication / Pharmacy / MAR | REQUIRED_FOR_HOSPITAL_GO_LIVE_WHEN_MEDICATION_ORDER_EXISTS | `PharmacyEngineContract` present | UI hook + legacy direct MAR bridge | NOT_PROVEN | Required after Clinical Orders for medication path. |
| Lab / Imaging | REQUIRED_FOR_HOSPITAL_GO_LIVE_WHEN_DIAGNOSTIC_ORDER_EXISTS | `ILaboratoryEngine` present; imaging public contract not found in this trace | Legacy direct `hc_clinical_orders`, `hc_lab_orders`, `hc_imaging_orders` actions | NOT_PROVEN | Required for diagnostic order path; imaging contract gap needs later trace. |
| Discharge | ALREADY_TRACED / REUSE_PUBLIC_ADMISSION_CONTRACT | Admission discharge present | Existing consumer | Bed release and H9 discharge temporal semantics NOT_PROVEN | Later runtime semantics slice required. |
| Bed Release | REQUIRED_FOR_HOSPITAL_GO_LIVE | `BedEngineContract.releaseBed(...)` present | Current discharge consumer does not call releaseBed | NOT_PROVEN | Required before Go-Live chain can be proven. |
| H9 Temporal Timeline | REQUIRED_FOR_HOSPITAL_GO_LIVE | `ITemporalContract` present | Transfer event consumer exists | Full encounter timeline / discharge timeline NOT_PROVEN | Required as chain invariant. |
| H11 Audit / Evidence | REQUIRED_FOR_HOSPITAL_GO_LIVE | `IClinicalAuditContract` present | Discharge evidence consumer exists | Full clinical actions audit coverage NOT_PROVEN | Required as chain invariant. |
| Billing / BHYT / Payment | REQUIRED_FOR_HOSPITAL_GO_LIVE_IF_CHARGED_SERVICES_ARE_IN_SCOPE | Healthcare billing/BHYT actions exist; Finance contract boundary not sealed here | Legacy actions only | Finance / ledger / reconciliation NOT_PROVEN | Do not open in this trace; classify for later Finance chain. |
| Finance / Ledger / Reconciliation | REQUIRED_FOR_GO_LIVE_FINANCIAL_CHAIN | Existing Finance infrastructure not traced in this slice | NOT_PROVEN | NOT_PROVEN | Later phase after clinical chain semantics. |
| ICU / OR / Emergency / Blood Bank / PACU / CSSD | OPTIONAL / FUTURE_FOR_GENERAL_HOSPITAL_GO_LIVE | Public contracts exist for some capabilities | UI/services exist in repo | NOT_PROVEN | Not required for minimum inpatient Go-Live chain unless MVP scope expands. |
| Workforce / Staff CRUD | OPTIONAL / FUTURE | Provider assignment via Encounter exists | Dashboard surface exists | Staff registry semantics NOT_PROVEN | Not first chain blocker. |
| Reports / Revenue Dashboards | OPTIONAL / FUTURE | N/A | Mostly UI/read-model surfaces | NOT_PROVEN | Not first chain blocker. |

## Missing Public Contract

```text
IMAGING_PUBLIC_CONTRACT = NOT_FOUND_IN_THIS_TRACE
```

Rationale:

`src/services/healthcare/lis-ris-actions.ts` directly writes `hc_imaging_orders`.
`src/platform/healthcare/contracts/laboratory-engine.contract.ts` exists for lab
workflow, but this trace did not find a comparable public imaging contract.

This does not authorize creating an imaging contract now. It records a future
contract trace requirement only if diagnostic imaging is selected for the
Go-Live chain.

## Missing Runtime

```text
HOSPITAL_CLINICAL_ORDER_RUNTIME = MISSING
HOSPITAL_NURSING_RUNTIME = MISSING
HOSPITAL_PHARMACY_MAR_RUNTIME = MISSING
HOSPITAL_LAB_RUNTIME = MISSING
HOSPITAL_IMAGING_RUNTIME = MISSING
HOSPITAL_BILLING_FINANCE_RUNTIME = MISSING / NOT_TRACED
```

Notes:

- UI hooks are not runtime proof.
- Legacy `src/services/healthcare*` actions are not automatically canonical
  because several paths access `hc_*` tables directly or use mock fallbacks.
- Existing public contracts should be reused before any new contract is proposed.

## Missing Semantics

```text
CLINICAL_ORDER_LIFECYCLE_SEMANTICS = NOT_PROVEN
ORDER_TO_CDS_GATE_SEMANTICS = NOT_PROVEN_FOR_HOSPITAL_CHAIN
ORDER_TO_MEDICATION_MAR_SEMANTICS = NOT_PROVEN
ORDER_TO_LAB_IMAGING_SEMANTICS = NOT_PROVEN
NURSING_VITALS_TO_TEMPORAL_AUDIT_SEMANTICS = NOT_PROVEN
DISCHARGE_BED_RELEASE_SEMANTICS = NOT_PROVEN
DISCHARGE_H9_TEMPORAL_SEMANTICS = NOT_PROVEN
BILLING_PAYMENT_LEDGER_RECONCILIATION = NOT_PROVEN
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
```

## Legacy / Non-Canonical Surfaces

The following are evidence of existing functionality pressure, not Go-Live proof:

```text
src/services/healthcare-hospital-services.ts
  -> direct hc_wards / hc_beds / hc_nursing_vital_signs /
     hc_medication_administration_records access
  -> mock fallback paths

src/services/healthcare/clinical-alerts-service.ts
  -> direct hc_clinical_alerts access
  -> mock CDS contract for order safety

src/services/healthcare/lis-ris-actions.ts
  -> direct hc_clinical_orders / hc_lab_orders / hc_imaging_orders /
     hc_encounters access

src/services/healthcare/billing-actions.ts
  -> direct billing/accounting table access and accounting mapping assumptions

src/app/dashboard/hospital/*
  -> many rich UI surfaces with mock data, hard-coded tenant ids, or legacy bridge calls
```

These should not be bulk-refactored in this slice. They identify future
contract/runtime slices.

## Next Required Capability

```text
NEXT_REQUIRED_CAPABILITY = HOSPITAL_CLINICAL_ORDERS_CONTRACT_TRACE
```

Reason:

```text
Clinical Orders / CPOE is the first unsealed capability that connects Encounter
to real clinical care. It is also the branching point for CDS, medication/MAR,
lab/imaging, nursing instructions, and later billable service events.
```

Expected next trace questions:

```text
1. Does Hospital need Clinical Orders for minimum Go-Live?
2. Is `OrderEngineContract` sufficient for Hospital inpatient orders?
3. Is H8 CDS already mandatory in the public order lifecycle?
4. Does the current Hospital code consume the order contract only through public boundaries?
5. Which legacy direct `hc_clinical_orders` paths are consumers to classify, not bulk migrate?
6. What exact minimum runtime behavior is required after the trace?
```

Do not implement Orders runtime in the same trace slice.

## Business Chain Status

```text
BUSINESS_CHAIN:
Patient/MPI
  -> Admission
  -> Encounter
  -> Bed Assignment / Transfer
  -> Clinical Orders
  -> CDS Gate
  -> Nursing / Medication-MAR / Lab-Imaging as ordered
  -> Discharge
  -> Bed Release
  -> H9 Temporal + H11 Audit Evidence
  -> Billing / Payment / Ledger / Reconciliation

ALREADY_PROVEN:
- Product Identity
- Patient/MPI public contract
- Hospital Patient/MPI foundation runtime
- Admission public contract
- Encounter public contract
- Hospital Encounter foundation runtime
- Bed/Transfer public contract
- Discharge public contract via Admission
- H9 / H11 public contracts present

REQUIRED_CAPABILITIES:
- Clinical Orders / CPOE
- CDS safety gate for order lifecycle
- Nursing vitals/notes
- Pharmacy/MAR when medication orders exist
- Lab/Imaging when diagnostic orders exist
- Discharge bed release semantics
- Discharge H9 temporal semantics
- Billing/Payment/Finance chain for charged services

OPTIONAL_FUTURE:
- ICU advanced dispatch
- OR/PACU/CSSD
- Blood Bank
- Workforce registry CRUD
- Reporting dashboards
- Incident/CAPA system beyond minimum H11 evidence chain

MISSING_PUBLIC_CONTRACT:
- Imaging public contract not found in this trace

MISSING_RUNTIME:
- Hospital Clinical Orders runtime
- Hospital Nursing runtime
- Hospital Pharmacy/MAR runtime
- Hospital Lab/Imaging runtime
- Hospital Billing/Finance runtime

MISSING_SEMANTICS:
- Clinical order lifecycle semantics
- Order -> CDS gate semantics for Hospital chain
- Order -> Medication/MAR semantics
- Order -> Lab/Imaging semantics
- Nursing observations -> timeline/audit semantics
- Discharge -> bed release semantics
- Discharge -> H9 temporal semantics
- Billing -> payment -> ledger -> reconciliation semantics

NEXT_REQUIRED_CAPABILITY:
- HOSPITAL_CLINICAL_ORDERS_CONTRACT_TRACE
```

## Verification

Trace source reads:

```text
docs/governance/BELLA_AI_CODING_CONSTITUTION.md
docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md
src/products/bella-hospital/index.ts
src/products/bella-hospital/services/hospital-patient-mpi.service.ts
src/products/bella-hospital/services/hospital-encounter.service.ts
src/products/bella-hospital/services/hospital-admission.service.ts
src/products/bella-hospital/services/hospital-clinical-alert.service.ts
src/products/bella-hospital/hooks/use-order-engine.ts
src/products/bella-hospital/hooks/use-nursing-engine.ts
src/products/bella-hospital/hooks/use-pharmacy-engine.ts
src/products/bella-hospital/hooks/use-cds-engine.ts
src/products/bella-hospital/hooks/use-bed-engine.ts
src/platform/healthcare/contracts/order-engine.contract.ts
src/platform/healthcare/contracts/nursing-engine.contract.ts
src/platform/healthcare/contracts/pharmacy-engine.contract.ts
src/platform/healthcare/contracts/cds-engine.contract.ts
src/platform/healthcare/contracts/laboratory-engine.contract.ts
src/platform/healthcare/contracts/bed-engine.contract.ts
src/platform/healthcare/contracts/temporal-engine.contract.ts
src/platform/healthcare/contracts/clinical-audit.contract.ts
src/services/healthcare-hospital-services.ts
src/services/healthcare/clinical-alerts-service.ts
src/services/healthcare/lis-ris-actions.ts
src/services/healthcare/billing-actions.ts
src/services/healthcare/bhyt-actions.ts
src/app/dashboard/hospital/*
```

Required command verification for this docs-only trace:

```text
git diff --check
```

## Closure

```text
HOSPITAL_GO_LIVE_FULL_BUSINESS_CHAIN_TRACE = PASS
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
NEXT_REQUIRED_CAPABILITY = HOSPITAL_CLINICAL_ORDERS_CONTRACT_TRACE
```

Stop here. Do not continue into Clinical Orders runtime, Nursing, Pharmacy,
Lab/Imaging, Billing, Finance, Real DB, Browser E2E, or production Go-Live in
this slice.
