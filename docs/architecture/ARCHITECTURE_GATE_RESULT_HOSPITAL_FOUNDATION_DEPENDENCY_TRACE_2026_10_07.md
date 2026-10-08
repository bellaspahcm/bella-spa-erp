# Architecture Gate Result - Hospital Foundation Dependency Trace - 2026-10-07

## Status

```text
HOSPITAL_FOUNDATION_DEPENDENCY_TRACE = PASS
PATIENT_MPI_PUBLIC_CONTRACT = PASS
HOSPITAL_PATIENT_MPI_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE
ADMISSION = REUSE_PUBLIC_CONTRACT
HOSPITAL_ADMISSION_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED
ENCOUNTER = REUSE_PUBLIC_CONTRACT
HOSPITAL_ENCOUNTER_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE
```

This is a trace-only gate. It does not authorize runtime, UI, DB, Real DB,
Browser E2E, Finance, Billing, or new contract implementation.

## Scope

Question:

```text
After Patient/MPI -> Admission -> Encounter, which Hospital Foundation MVP
dependencies are still required by existing code evidence?
```

This trace classifies existing Hospital dependencies only. It does not assume
that a capability is required merely because a Healthcare Kernel contract exists
or a dashboard page imports a hook.

## Source Evidence

| Evidence | Result |
| --- | --- |
| `src/products/bella-hospital/services/hospital-admission.service.ts` | Existing Product service consumes Admission, Bed transfer, H9 Temporal, and H11 Clinical Audit contracts. |
| `src/products/bella-hospital/services/hospital-clinical-alert.service.ts` | Separate Product service consumes H8 CDS for medication order safety. |
| `src/products/bella-hospital/services/hospital-encounter.service.ts` | Encounter Foundation runtime is minimal and sealed; it excludes Bed, Nursing, Pharmacy, CDS, Temporal/Audit. |
| `src/products/bella-hospital/hooks/use-bed-engine.ts` | UI hook consumes public Bed contract for query/allocate/release/transfer. |
| `src/products/bella-hospital/hooks/use-nursing-engine.ts` | UI hook consumes Nursing contract for vitals; no Foundation Product service dependency found. |
| `src/products/bella-hospital/hooks/use-pharmacy-engine.ts` | UI hook consumes Pharmacy contract for MAR; no Foundation Product service dependency found. |
| `src/products/bella-hospital/hooks/use-order-engine.ts` | UI hook consumes Order contract; no Foundation Product service dependency found. |
| `src/app/dashboard/hospital/beds/page.tsx` | Browser surface uses `useBedEngine`, but contains hard-coded tenant/temp encounter/admission IDs; not Real DB/RLS proof. |
| `src/app/dashboard/hospital/nursing-vitals/page.tsx` | Browser surface uses `useNursingEngine`; not Foundation runtime proof. |
| `src/app/dashboard/hospital/mar/page.tsx` | Browser surface uses `usePharmacyEngine`; not Foundation runtime proof. |
| `src/services/healthcare-hospital-services.ts` | Legacy bridge delegates to `HospitalAdmissionProductService`; audit target, not a new canonical path. |
| `src/services/healthcare/clinical-alerts-service.ts` | Legacy bridge delegates to `HospitalClinicalAlertProductService`; audit target, not a new canonical path. |

## Dependency Classification

| Capability | Classification | Current Consumer Evidence | Owner | Public Contract | Runtime Evidence | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Bed / Transfer | REQUIRED_FOR_CURRENT_FOUNDATION_SCOPE | `HospitalAdmissionProductService.transferBed(...)` and `useBedEngine` | Healthcare Bed Engine | `BedEngineContract` present | Existing Product consumer and unit tests exist; not Real DB/RLS | Next required capability trace. |
| H9 Temporal | REQUIRED_AS_SUPPORTING_INVARIANT_FOR_BED_TRANSFER | `HospitalAdmissionProductService.transferBed(...)` records `BED_TRANSFERRED` | Healthcare Temporal Engine | `ITemporalContract` present | Existing Product consumer and unit tests exist; not Real DB/RLS | Trace with Bed/Transfer, not as standalone MVP capability. |
| H11 Clinical Audit / Evidence | REQUIRED_AS_SUPPORTING_INVARIANT_FOR_DISCHARGE | `HospitalAdmissionProductService.dischargeInpatient(...)` records audit and evidence package | Healthcare Clinical Audit / Audit Compliance | `IClinicalAuditContract` and `IAuditComplianceContract` present | Existing Product consumer and unit tests exist; not Real DB/RLS | Trace with Discharge after Bed/Transfer boundary is sealed. |
| Discharge | REQUIRED_AFTER_BED_TRANSFER | `HospitalAdmissionProductService.dischargeInpatient(...)` | Admission + Audit boundary | Admission and Clinical Audit contracts present | Existing Product consumer; no Bed release evidence in Product service | Defer until Bed/Transfer trace clarifies release/discharge side effects. |
| Bed Occupancy Read Model | OPTIONAL / FUTURE | `BedOccupancyReadModelProjection` and conformance test | Hospital Product projection | Product-owned projection, no Kernel ownership | Mock/in-memory projection only | Not required before Bed/Transfer proof. |
| Clinical Alert / CDS | OPTIONAL / FUTURE_FOR_FOUNDATION_MVP | `HospitalClinicalAlertProductService.evaluateOrderSafety(...)` | Healthcare CDS Engine | `CdsEngineContract` present | Existing Product consumer and unit tests exist; not tied to Foundation MVP after Encounter | Do not open before Bed/Transfer unless clinical-order slice is selected. |
| Nursing | OPTIONAL / FUTURE | `useNursingEngine` and `/dashboard/hospital/nursing-vitals` | Healthcare Nursing Engine | `NursingEngineContract` present | UI hook only; no Foundation Product runtime service found | Not required for current Foundation MVP. |
| Pharmacy / MAR | OPTIONAL / FUTURE | `usePharmacyEngine` and `/dashboard/hospital/mar` | Healthcare Pharmacy Engine | `PharmacyEngineContract` present | UI hook only; no Foundation Product runtime service found | Not required for current Foundation MVP. |
| Clinical Orders | OPTIONAL / FUTURE | `useOrderEngine` | Healthcare Order Engine | `OrderEngineContract` present | UI hook only; no Foundation Product runtime service found | Not required before Bed/Transfer. |
| Facility / Ward / Room management | BLOCKED / MISSING_PUBLIC_PRODUCT_CONTRACT_FOR_MANAGEMENT | Bed/Admission DTOs pass `wardId` and `bedId`; UI has ward IDs | Healthcare facility/location ownership not sealed for CRUD | Bed contract accepts IDs; management contract not proven | ID reference only | Do not build CRUD. Use IDs only until a public management contract is traced. |
| Department management | NOT_REQUIRED_FOR_CURRENT_FOUNDATION_SCOPE | Encounter/Admission carry department IDs | Encounter/context owner TBD | ID fields exist in Encounter contract | ID reference only | Not required before Bed/Transfer. |
| Staff / Doctor management | NOT_REQUIRED_FOR_CURRENT_FOUNDATION_SCOPE | Encounter can assign provider; Admission DTO carries doctor IDs | Platform identity/RBAC + Healthcare provider context TBD | Encounter provider assignment present | Assignment only | Do not build staff registry in Foundation slice. |
| Finance / Billing | NOT_REQUIRED_FOR_CURRENT_FOUNDATION_SCOPE | No Foundation service dependency in current Hospital runtime | Finance OS | Existing Finance infrastructure not traced here | NOT_PROVEN | Keep out of Foundation dependency chain. |

## Required Dependency Map

The minimum remaining dependency chain with current code evidence is:

```text
Patient/MPI Runtime
  -> Encounter Runtime
  -> Admission Existing Consumer
  -> Bed / Transfer Public Contract
  -> H9 Temporal side-effect for transfer
  -> Discharge / H11 Audit after Bed/Transfer boundary is sealed
```

This does not prove Real DB/RLS, Browser E2E, Finance, or production readiness.

## Next Capability

The next capability should be:

```text
HOSPITAL BED / TRANSFER CONTRACT TRACE
```

Reason:

```text
Bed / Transfer is the only remaining required dependency directly invoked by
the existing Hospital Foundation Product service after Admission and Encounter.
```

The next slice should determine:

```text
1. Whether BedEngineContract is sufficient for Hospital Foundation.
2. Whether Hospital's existing transfer consumer is canonical enough to reuse.
3. Whether Bed release is required for Discharge Foundation semantics.
4. Whether H9 Temporal should remain a side-effect in Bed/Transfer runtime or
   be traced separately before discharge.
```

Do not implement Bed runtime inside the contract trace slice.

## Explicit Non-Requirements For Current Foundation Scope

```text
Nursing = OPTIONAL / FUTURE
Pharmacy / MAR = OPTIONAL / FUTURE
Clinical Orders = OPTIONAL / FUTURE
Clinical Alert / CDS = OPTIONAL / FUTURE_FOR_FOUNDATION_MVP
Department CRUD = NOT_REQUIRED_FOR_CURRENT_FOUNDATION_SCOPE
Staff / Doctor CRUD = NOT_REQUIRED_FOR_CURRENT_FOUNDATION_SCOPE
Finance / Billing = NOT_REQUIRED_FOR_CURRENT_FOUNDATION_SCOPE
Browser E2E = NOT_PROVEN
Real DB / RLS = NOT_PROVEN
```

## Boundary Notes

- UI hooks and dashboards are evidence of existing surfaces, not runtime proof.
- Legacy bridges in `src/services/healthcare*` are audit targets, not canonical
  paths for new Hospital implementation.
- Hard-coded tenant IDs, temp encounter IDs, and mock fallback paths must not be
  treated as Real DB/RLS or Browser E2E proof.
- No `hc_*` direct access is authorized by this trace.
- No Healthcare Kernel H1-H12 modification is authorized by this trace.

## Verification

```text
Trace source reads:
- src/products/bella-hospital/services/hospital-admission.service.ts
- src/products/bella-hospital/services/hospital-clinical-alert.service.ts
- src/products/bella-hospital/services/hospital-encounter.service.ts
- src/products/bella-hospital/hooks/use-bed-engine.ts
- src/products/bella-hospital/hooks/use-nursing-engine.ts
- src/products/bella-hospital/hooks/use-pharmacy-engine.ts
- src/products/bella-hospital/hooks/use-order-engine.ts
- src/products/bella-hospital/projections/bed-occupancy.projection.ts
- src/platform/healthcare/contracts/bed-engine.contract.ts
- src/platform/healthcare/contracts/temporal-engine.contract.ts
- src/platform/healthcare/contracts/clinical-audit.contract.ts
- src/platform/healthcare/contracts/cds-engine.contract.ts
- src/platform/healthcare/contracts/nursing-engine.contract.ts
- src/platform/healthcare/contracts/pharmacy-engine.contract.ts
```

Required command verification for this docs-only trace:

```text
git diff --check
```

Executed verification:

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-services.test.ts --runInBand
PASS: 1 suite, 4 tests

npx jest src/products/bella-hospital/__tests__/hospital-foundation-contract-boundary.test.ts --runInBand
PASS: 1 suite, 6 tests

git diff --check
PASS: exit code 0
```

## Canonical Closure

```text
HOSPITAL_FOUNDATION_DEPENDENCY_TRACE = PASS

PATIENT_MPI_PUBLIC_CONTRACT = PASS
HOSPITAL_PATIENT_MPI_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE

ADMISSION_CONTRACT_TRACE = PASS
ADMISSION = REUSE_PUBLIC_CONTRACT
HOSPITAL_ADMISSION_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED

ENCOUNTER_CONTRACT_TRACE = PASS
ENCOUNTER = REUSE_PUBLIC_CONTRACT
HOSPITAL_ENCOUNTER_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE

NEXT_REQUIRED_CAPABILITY = BED_TRANSFER_CONTRACT_TRACE

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
FULL_HOSPITAL_CHAIN = NOT_PROVEN
```

## Stop Condition

Stop after this dependency trace. Do not implement Bed/Transfer, Nursing,
Pharmacy, CDS, Temporal/Audit, Finance, DB, UI, Browser E2E, Real DB/RLS, or
full Hospital chain in this slice.
