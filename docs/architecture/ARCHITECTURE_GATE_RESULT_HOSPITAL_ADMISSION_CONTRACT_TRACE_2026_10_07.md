# Architecture Gate Result - Hospital Admission Contract Trace - 2026-10-07

## Status

```text
ADMISSION_CONTRACT_TRACE = PASS
ADMISSION = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_ADMISSION_CONTRACT = PRESENT
HOSPITAL_ADMISSION_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
```

This is a trace-only slice. It does not authorize new Admission runtime,
Encounter, UI, DB/schema, Real DB E2E, Browser E2E, Billing, or Finance work.

## Baseline

```text
PATIENT_MPI_PUBLIC_CONTRACT = PASS
PATIENT_MPI = REUSE_PARTIAL_WITH_PUBLIC_CONTRACT
HOSPITAL_PATIENT_MPI_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE
```

## Trace Scope

Question:

```text
Does Bella Hospital Foundation need Admission capability, and if yes, can it
reuse an existing Healthcare public contract?
```

Non-goals:

- Do not implement or modify Admission runtime.
- Do not implement Encounter.
- Do not modify UI, DB/schema, RLS, Finance, Billing, or Browser E2E.
- Do not refactor Healthcare Kernel.
- Do not migrate legacy healthcare dashboard/actions.

## Truth And Source Of Truth

| Question | Source | Result |
| --- | --- | --- |
| Is Admission a Hospital Foundation dependency? | `src/products/bella-hospital/services/hospital-admission.service.ts`, Hospital foundation audit artifacts | Yes. Existing Hospital Product service models inpatient admission, transfer, and discharge. |
| Does Healthcare Kernel have Admission capability? | `src/platform/healthcare/engines/admission-engine/*` | Yes. Admission engine contract, service, aggregate, repository, events, and tests exist. |
| Is there a public Admission contract? | `src/platform/healthcare/contracts/admission-engine.contract.ts`, `src/platform/healthcare/contracts/index.ts` | Yes. Public contract re-export exists and is exported from the Healthcare contracts index. |
| Does Hospital Product consume the public contract? | `src/products/bella-hospital/services/hospital-admission.service.ts` | Yes. It imports from `platform/healthcare/contracts/admission-engine.contract`. |
| Is legacy Admission code still present? | `src/services/healthcare-hospital-services.ts`, legacy dashboard paths | Yes. It remains audit target only and is not canonical for new Hospital work. |

## Ownership Map

| Capability | Owner | Evidence | Decision |
| --- | --- | --- | --- |
| Admission lifecycle | Healthcare Admission Engine | `AdmissionEngineContract`, `AdmissionEngineService`, `InpatientAdmission` aggregate | REUSE_PUBLIC_CONTRACT |
| Hospital Admission orchestration | Bella Hospital Product | Existing `HospitalAdmissionProductService` consumes Admission/Bed/Temporal/Audit contracts | EXISTING_CONSUMER_NOT_REOPENED |
| Encounter existence and tenant boundary | Healthcare Encounter boundary via Admission engine reader | `AdmissionEngineService` optionally uses `IEncounterReader` | Runtime proof deferred. |
| Admission persistence/RLS | Healthcare Kernel/DB boundary | Repository exists, but Real DB/RLS not run in this slice | NOT_PROVEN |

## Contract Dependency Map

Canonical path:

```text
Bella Hospital Product
  -> src/platform/healthcare/contracts/admission-engine.contract.ts
  -> src/platform/healthcare/engines/admission-engine/contracts/admission-engine.contract.ts
  -> AdmissionEngineService / InpatientAdmission aggregate
```

Forbidden for new Hospital Product code:

```text
Hospital Product
  -> src/platform/healthcare/engines/admission-engine/* directly
  -> direct hc_inpatient_admissions / inpatient_admissions tables
  -> legacy src/services/healthcare-hospital-services as canonical runtime
```

## Existing Public Contract Surface

```text
AdmissionEngineContract
  createAdmission(request)
  dischargeAdmission(request)
  getAdmissionById(tenantId, admissionId)
  getAdmissionByEncounterId(tenantId, encounterId)
```

Minimum Hospital Foundation operations (`createAdmission`, `dischargeAdmission`)
are already covered by the public contract.

## Legacy Boundary

Legacy `src/services/healthcare-hospital-services.ts` and dashboard paths still
contain dev fallback/mock and direct healthcare table behavior. This slice does
not migrate them. The relevant sealed rule is:

```text
New Hospital Product code must consume Admission through the public Healthcare
contract and must not use legacy services or direct admission tables.
```

## Verification Plan

```text
npx jest src/products/bella-hospital/__tests__/hospital-admission-contract-trace.test.ts --runInBand
npx jest src/products/bella-hospital/__tests__/hospital-foundation-contract-boundary.test.ts src/products/bella-hospital/__tests__/hospital-admission-contract-trace.test.ts --runInBand
git diff --check
```

No source runtime code is changed in this trace slice; Healthcare full verify,
Real DB, Browser E2E, and Finance are intentionally not run.

## Evidence

```text
npx jest src/products/bella-hospital/__tests__/hospital-admission-contract-trace.test.ts --runInBand
PASS - 1 suite, 4 tests

npx jest src/products/bella-hospital/__tests__/hospital-foundation-contract-boundary.test.ts src/products/bella-hospital/__tests__/hospital-admission-contract-trace.test.ts --runInBand
PASS - 2 suites, 10 tests

git diff --check
PASS
```

No runtime/source implementation was modified by this Admission trace slice, so
changed-file typecheck and Healthcare full verification are not required for
this slice.

## Conclusion

```text
ADMISSION_CONTRACT_TRACE = PASS
ADMISSION = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_ADMISSION_CONTRACT = PRESENT
HOSPITAL_ADMISSION_RUNTIME = EXISTING_CONSUMER_NOT_REOPENED
```

Next boundary, only if explicitly opened:

```text
Hospital Admission Runtime Proof
  -> consume existing Admission public contract
  -> prove runtime behavior for Foundation scope
  -> keep Real DB/RLS separate unless required by that slice
```
