# Architecture Gate Result - Hospital Discharge Contract Trace - 2026-10-07

## Status

```text
DISCHARGE_CONTRACT_TRACE = PASS
DISCHARGE = REUSE_PUBLIC_ADMISSION_CONTRACT
PUBLIC_HEALTHCARE_DISCHARGE_CONTRACT = PRESENT_VIA_ADMISSION_ENGINE
H11_AUDIT_EVIDENCE_CONTRACT = PRESENT
BED_RELEASE_CONTRACT = PRESENT
H9_TEMPORAL_CONTRACT = PRESENT
HOSPITAL_DISCHARGE_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED
```

This is a trace-only slice. It does not authorize Discharge runtime
implementation, Bed release wiring, H9 temporal discharge wiring, UI, DB/schema,
Real DB/RLS, Browser E2E, Finance, Nursing, Pharmacy, CDS, or full Hospital
chain work.

## Baseline

```text
PATIENT_MPI_PUBLIC_CONTRACT = PASS
HOSPITAL_PATIENT_MPI_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE

ADMISSION_CONTRACT_TRACE = PASS
ADMISSION = REUSE_PUBLIC_CONTRACT
HOSPITAL_ADMISSION_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED

ENCOUNTER_CONTRACT_TRACE = PASS
ENCOUNTER = REUSE_PUBLIC_CONTRACT
HOSPITAL_ENCOUNTER_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE

BED_TRANSFER_CONTRACT_TRACE = PASS
BED_TRANSFER = REUSE_PUBLIC_CONTRACT
H9_TEMPORAL_CONTRACT = PRESENT
H11_AUDIT_EVIDENCE_CONTRACT = PRESENT

DISCHARGE_BED_RELEASE_SEMANTICS = NOT_PROVEN
```

## Question

```text
Bella Hospital
  -> Discharge
  -> which public Healthcare discharge contract?
  -> where do Bed release semantics live?
  -> is H9 Temporal needed and publicly available?
  -> is H11 Audit/Evidence needed and publicly available?
  -> does Hospital need new runtime or already have a consumer?
```

## Evidence Map

| Capability | Source Of Truth | Result |
| --- | --- | --- |
| Public discharge contract | `src/platform/healthcare/contracts/admission-engine.contract.ts` -> canonical Admission contract | Public re-export includes `DischargeAdmissionRequest`; canonical `AdmissionEngineContract` exposes `dischargeAdmission(...)`. |
| Discharge request shape | `src/platform/healthcare/engines/admission-engine/contracts/admission-engine.contract.ts` | `DischargeAdmissionRequest` requires `tenantId`, `admissionId`, `dischargeSummary`, optional `userId`. |
| Current Hospital discharge consumer | `src/products/bella-hospital/services/hospital-admission.service.ts` | `dischargeInpatient(...)` calls `this.admissionContract.dischargeAdmission(...)`. |
| H11 audit/evidence | `src/platform/healthcare/contracts/clinical-audit.contract.ts` | `IClinicalAuditContract.recordAuditEntry(...)` and `issueEvidencePackage(...)` are public and consumed by Hospital discharge. |
| Bed release contract | `src/platform/healthcare/contracts/bed-engine.contract.ts` | `BedEngineContract.releaseBed(...)` and `BedReleaseRequest` are public. |
| H9 Temporal contract | `src/platform/healthcare/contracts/temporal-engine.contract.ts` | `ITemporalContract.recordTemporalEvent(...)` is public. |

## Ownership Map

| Data / Action | Owner | Hospital Authority |
| --- | --- | --- |
| Admission discharge state | Healthcare Admission Engine | Consume `AdmissionEngineContract.dischargeAdmission(...)`. |
| Bed release state | Healthcare Bed Engine | Contract exists; discharge consumer semantics are not yet proven. |
| Discharge audit/evidence package | Healthcare H11 Clinical Audit / Audit Compliance | Consume public `IClinicalAuditContract` only. |
| Temporal discharge provenance | Healthcare H9 Temporal Engine | Contract exists; discharge temporal consumer semantics are not yet proven. |
| Encounter aggregate boundary | Healthcare Encounter Engine | Discharge audit and future bed release must carry `encounterId`; no duplicate Hospital encounter state. |

## Contract Dependency Map

Allowed path:

```text
Hospital Product
  -> src/platform/healthcare/contracts/admission-engine.contract.ts
  -> src/platform/healthcare/contracts/bed-engine.contract.ts
  -> src/platform/healthcare/contracts/temporal-engine.contract.ts
  -> src/platform/healthcare/contracts/clinical-audit.contract.ts
```

Forbidden path:

```text
Hospital Product
  -> src/platform/healthcare/engines/admission-engine/* directly
  -> src/platform/healthcare/engines/bed-engine/* directly
  -> src/platform/healthcare/engines/temporal-engine/* directly
  -> src/platform/healthcare/engines/audit-compliance-engine/* directly
  -> direct hc_admissions / hc_beds / hc_temporal_events / hc_clinical_audit_ledger
  -> duplicate hospital_discharges table/entity
```

## Trace Decision

```text
DISCHARGE_CONTRACT_TRACE = PASS
DISCHARGE = REUSE_PUBLIC_ADMISSION_CONTRACT
PUBLIC_HEALTHCARE_DISCHARGE_CONTRACT = PRESENT_VIA_ADMISSION_ENGINE
H11_AUDIT_EVIDENCE_CONTRACT = PRESENT
BED_RELEASE_CONTRACT = PRESENT
H9_TEMPORAL_CONTRACT = PRESENT
```

No new Discharge public contract is required before a minimal runtime proof.

## Existing Runtime Consumer

```text
HOSPITAL_DISCHARGE_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED
```

Current consumer behavior:

```text
HospitalAdmissionProductService.dischargeInpatient(...)
  -> AdmissionEngineContract.dischargeAdmission(...)
  -> IClinicalAuditContract.recordAuditEntry(...)
  -> IClinicalAuditContract.issueEvidencePackage(...)
```

This proves an existing consumer path, not Real DB/RLS, Browser E2E, or full
clinical discharge semantics.

## Explicit NOT_PROVEN Boundaries

```text
DISCHARGE_BED_RELEASE_SEMANTICS = NOT_PROVEN
DISCHARGE_H9_TEMPORAL_SEMANTICS = NOT_PROVEN
DISCHARGE_REAL_DB_RLS = NOT_PROVEN
DISCHARGE_BROWSER_E2E = NOT_PROVEN
```

Reason:

```text
BedEngineContract.releaseBed(...) exists, and ITemporalContract.recordTemporalEvent(...)
exists, but the current Hospital discharge consumer does not call releaseBed or
record a discharge temporal event.
```

These are runtime semantics for a later slice. They are not contract gaps.

## Non-Goals Confirmed

```text
Discharge runtime = NOT_OPENED
Bed release runtime wiring = NOT_OPENED
H9 discharge temporal wiring = NOT_OPENED
Nursing = NOT_OPENED
Pharmacy / MAR = NOT_OPENED
Clinical Orders = NOT_OPENED
Clinical Alert / CDS = NOT_OPENED
Finance = NOT_OPENED
UI = NOT_OPENED
DB/schema = NOT_OPENED
Real DB/RLS = NOT_PROVEN
Browser E2E = NOT_PROVEN
Full Hospital Chain = NOT_PROVEN
```

## Verification

```text
npx jest src/products/bella-hospital/__tests__/hospital-discharge-contract-trace.test.ts --runInBand
PASS: 1 suite, 5 tests

npx jest src/products/bella-hospital/__tests__/hospital-foundation-contract-boundary.test.ts --runInBand
PASS: 1 suite, 6 tests
```

Required final check:

```text
git diff --check
```

Final checks:

```text
rg "\bany\b|as any|@ts-ignore|@ts-expect-error" changed Discharge trace files
PASS: no matches

git diff --check
PASS: exit code 0
```

## Canonical Closure

```text
HOSPITAL_FOUNDATION_BOUNDARY = PASS
PATIENT_MPI_PUBLIC_CONTRACT = PASS
HOSPITAL_PATIENT_MPI_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE

ADMISSION_CONTRACT_TRACE = PASS
ADMISSION = REUSE_PUBLIC_CONTRACT
HOSPITAL_ADMISSION_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED

ENCOUNTER_CONTRACT_TRACE = PASS
ENCOUNTER = REUSE_PUBLIC_CONTRACT
HOSPITAL_ENCOUNTER_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE

BED_TRANSFER_CONTRACT_TRACE = PASS
BED_TRANSFER = REUSE_PUBLIC_CONTRACT

DISCHARGE_CONTRACT_TRACE = PASS
DISCHARGE = REUSE_PUBLIC_ADMISSION_CONTRACT
HOSPITAL_DISCHARGE_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED

DISCHARGE_BED_RELEASE_SEMANTICS = NOT_PROVEN
DISCHARGE_H9_TEMPORAL_SEMANTICS = NOT_PROVEN

NEXT_ALLOWED_SLICE = DISCHARGE_RUNTIME_SEMANTICS_TRACE_OR_MINIMAL_RUNTIME

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
FULL_HOSPITAL_CHAIN = NOT_PROVEN
```

## Stop Condition

Stop at Discharge contract trace. Do not continue to Discharge runtime, Bed
release wiring, H9 temporal discharge wiring, Nursing, Pharmacy, CDS, Finance,
UI, DB/schema, Browser E2E, Real DB/RLS, or full Hospital chain in this slice.
