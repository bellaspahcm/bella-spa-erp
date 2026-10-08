# Architecture Gate Result - Hospital Bed / Transfer Contract Trace - 2026-10-07

## Status

```text
BED_TRANSFER_CONTRACT_TRACE = PASS
BED_TRANSFER = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_BED_TRANSFER_CONTRACT = PRESENT
H9_TEMPORAL_CONTRACT = PRESENT
H11_AUDIT_EVIDENCE_CONTRACT = PRESENT
HOSPITAL_BED_TRANSFER_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED
```

This is a trace-only slice. It does not authorize Bed/Transfer runtime
implementation, UI, DB/schema, Real DB/RLS, Browser E2E, Finance, Nursing,
Pharmacy, CDS, or full Hospital chain work.

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

HOSPITAL_FOUNDATION_DEPENDENCY_TRACE = PASS
NEXT_REQUIRED_CAPABILITY = BED_TRANSFER_CONTRACT_TRACE
```

## Question

```text
Bella Hospital
  -> Bed / Transfer
  -> which public Healthcare contract?
  -> contract present or missing?
  -> reuse or create?
  -> are H9 Temporal and H11 Audit/Evidence public APIs sufficient?
```

## Evidence Map

| Capability | Source Of Truth | Result |
| --- | --- | --- |
| Bed / Transfer public contract | `src/platform/healthcare/contracts/bed-engine.contract.ts` | `BedEngineContract` exposes `allocateBed`, `releaseBed`, `transferBed`, `queryBeds`, and `getBedById`. |
| Bed transfer request shape | `BedTransferRequest` | Includes `tenantId`, `fromBedId`, `toBedId`, `encounterId`, `patientId`, `admissionId`, `reason`, `transferredBy`, and optional `scheduledTime`. |
| Bed release request shape | `BedReleaseRequest` | Includes `tenantId`, `bedId`, `encounterId`, `patientId`, `admissionId`, `reason`, and `releasedBy`. |
| Bed contract ownership | `BED_ENGINE_CONTRACT` metadata | Owner is Healthcare Platform Team; status is active. |
| Existing Hospital consumer | `src/products/bella-hospital/services/hospital-admission.service.ts` | Constructor consumes `Pick<BedEngineContract, 'transferBed'>`; method `transferBed(...)` calls `this.bedContract.transferBed(...)`. |
| H9 Temporal support | `src/platform/healthcare/contracts/temporal-engine.contract.ts` | `ITemporalContract.recordTemporalEvent(...)` accepts `tenantId`, `encounterId`, `patientId`, `aggregateType`, `aggregateId`, `eventType`, `validTime`, and `deltaPayload`. |
| H11 Audit/Evidence support | `src/platform/healthcare/contracts/clinical-audit.contract.ts` | `IClinicalAuditContract.recordAuditEntry(...)` and `issueEvidencePackage(...)` are present. |
| Public contract export registry | `src/platform/healthcare/contracts/index.ts` | Bed, Temporal, Clinical Audit, and related contracts are public contract exports. |

## Ownership Map

| Data / Action | Owner | Hospital Authority |
| --- | --- | --- |
| Bed state and transfer operations | Healthcare Bed Engine | Consume via `BedEngineContract`; do not own or duplicate bed entity. |
| Encounter aggregate boundary | Healthcare Encounter Engine | Bed transfer/release must carry `encounterId`; Hospital must not create a separate encounter/bed aggregate. |
| Admission association | Healthcare Admission Engine | Bed transfer request carries `admissionId`; Hospital may orchestrate through public contracts. |
| Bitemporal transfer provenance | Healthcare H9 Temporal Engine | Consume `ITemporalContract.recordTemporalEvent(...)` only. |
| Discharge audit/evidence package | Healthcare H11 Clinical Audit / Audit Compliance | Consume public audit/evidence contract only. |

## Contract Dependency Map

Allowed path:

```text
Hospital Product
  -> src/platform/healthcare/contracts/bed-engine.contract.ts
  -> src/platform/healthcare/contracts/temporal-engine.contract.ts
  -> src/platform/healthcare/contracts/clinical-audit.contract.ts
```

Forbidden path:

```text
Hospital Product
  -> src/platform/healthcare/engines/bed-engine/*
  -> src/platform/healthcare/engines/temporal-engine/*
  -> src/platform/healthcare/engines/audit-compliance-engine/*
  -> direct hc_beds / hc_temporal_events / hc_clinical_audit_ledger
  -> legacy healthcare service dependency for new canonical implementation
```

## Trace Decision

```text
BED_TRANSFER_CONTRACT_TRACE = PASS
BED_TRANSFER = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_BED_TRANSFER_CONTRACT = PRESENT
H9_TEMPORAL_CONTRACT = PRESENT
H11_AUDIT_EVIDENCE_CONTRACT = PRESENT
```

No new Bed/Transfer public contract is required for the next runtime slice.

## Runtime Status

```text
HOSPITAL_BED_TRANSFER_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED
```

Reason:

```text
HospitalAdmissionProductService already has a public-contract consumer for
transferBed and H9 recordTemporalEvent. This trace does not reopen or rewrite
that runtime.
```

The next implementation slice may prove or minimally harden runtime behavior
only if explicitly opened.

## Discharge Boundary Note

`BedEngineContract.releaseBed(...)` exists and is public. However, the current
Hospital discharge consumer calls Admission discharge and H11 audit/evidence;
it does not prove Bed release semantics for discharge.

Therefore:

```text
DISCHARGE_BED_RELEASE_SEMANTICS = NOT_PROVEN
```

This is not a blocker for Bed/Transfer contract trace. It is a boundary for a
later Discharge trace/runtime slice after Bed/Transfer is sealed.

## Non-Goals Confirmed

```text
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
npx jest src/products/bella-hospital/__tests__/hospital-bed-transfer-contract-trace.test.ts --runInBand
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
rg "\bany\b|as any|@ts-ignore|@ts-expect-error" changed Bed/Transfer trace files
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

FOUNDATION_DEPENDENCY_TRACE = PASS

BED_TRANSFER_CONTRACT_TRACE = PASS
BED_TRANSFER = REUSE_PUBLIC_CONTRACT
H9_TEMPORAL_CONTRACT = PRESENT
H11_AUDIT_EVIDENCE_CONTRACT = PRESENT

NEXT_ALLOWED_SLICE = HOSPITAL_BED_TRANSFER_RUNTIME

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
FULL_HOSPITAL_CHAIN = NOT_PROVEN
```

## Stop Condition

Stop at Bed/Transfer contract trace. Do not continue to Bed/Transfer runtime,
Discharge, Nursing, Pharmacy, CDS, Finance, UI, DB/schema, Browser E2E, Real
DB/RLS, or full Hospital chain in this slice.
