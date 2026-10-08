# Architecture Gate Result - Hospital Patient/MPI Runtime - 2026-10-07

## Status

```text
HOSPITAL_PATIENT_MPI_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE
PATIENT_MPI_PUBLIC_CONTRACT = PASS
PATIENT_MPI = REUSE_PARTIAL_WITH_PUBLIC_CONTRACT
```

This gate authorizes only minimal Bella Hospital Product runtime integration
with the sealed public Patient/MPI contract.

## Scope

Implement the smallest Hospital Product service needed to consume the public
Patient/MPI contract for Foundation runtime proof.

Allowed:

- Product-layer service under `src/products/bella-hospital/services`.
- Product-layer unit tests with a fake `PatientMpiContract`.
- Product entrypoint export.
- Boundary test reuse.

Not allowed:

- Admission, Encounter, EMR, Appointment, Billing, Finance, Pharmacy, Inventory.
- UI changes.
- Real DB/RLS or Browser E2E.
- Database migrations.
- Healthcare Kernel H1-H12 internals.
- Direct `hc_*`, `patient_profiles`, `hc_master_patient_index`, Platform Party,
  Platform Person, or legacy `src/services/healthcare*` access from Hospital.

## Truth And Source Of Truth

| Question | Source | Result |
| --- | --- | --- |
| Product identity | ProductRegistry | `bella_hospital` sealed. |
| Patient/MPI public contract | `src/platform/healthcare/contracts/patient-mpi.contract.ts` | `PatientMpiContract` sealed for register/get/find/search. |
| Existing Patient/MPI implementation evidence | `src/modules/bella-healthcare/kernel/party-engine.ts` | Healthcare patient identity can reuse Party internally, but Hospital must not depend on it. |
| Hospital runtime authority | User request and prior sealed contract artifact | Product service may consume public contract only. |

## Minimum Runtime Requirement

Hospital Foundation runtime must prove:

```text
Hospital Product Service
  -> PatientMpiContract
  -> mapped Patient/MPI request DTO
  -> tenant and actor authorization checks
  -> mapped Hospital patient identity DTO
```

Minimum operations:

```text
registerFoundationPatient
getFoundationPatient
findFoundationPatientByIdentifier
searchFoundationPatients
```

## Ownership Map

| Capability | Owner | Runtime decision |
| --- | --- | --- |
| Patient/MPI identity contract | Healthcare OS | Consume through public `PatientMpiContract`. |
| Hospital Foundation patient integration | Bella Hospital Product | Product service maps Hospital DTO to contract DTO. |
| Patient/MPI persistence/RLS | Healthcare OS / Platform | Out of scope for this static/unit runtime slice. |
| UI/E2E/Finance | Product / other verticals | Out of scope. |

## Contract Dependency Map

```text
src/products/bella-hospital/services/hospital-patient-mpi.service.ts
  -> src/platform/healthcare/contracts/patient-mpi.contract.ts
```

Forbidden:

```text
Hospital Product
  -> src/modules/bella-healthcare/kernel/party-engine.ts
  -> src/platform/party
  -> src/platform/host/person
  -> src/services/healthcare*
  -> direct DB tables / hc_* / patient_profiles
```

## Verification Plan

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-patient-mpi.service.test.ts --runInBand
npx jest src/products/bella-hospital/__tests__/hospital-foundation-contract-boundary.test.ts src/products/bella-hospital/__tests__/hospital-patient-mpi-contract-trace.test.ts --runInBand
npm run healthcare:guard
npm run typecheck:changed
rg changed files for any/as any
git diff --check
```

No Real DB, Browser E2E, Finance, or full Healthcare verification is required
unless this slice crosses into runtime persistence or Healthcare Kernel code.

## Implementation Result

Implemented:

- `src/products/bella-hospital/services/hospital-patient-mpi.service.ts`
- `src/products/bella-hospital/services/__tests__/hospital-patient-mpi.service.test.ts`
- `src/products/bella-hospital/index.ts` export

Runtime proof:

- Hospital calls `PatientMpiContract` only.
- Hospital maps register/get/find/search DTOs to public contract requests.
- Tenant ID is required before contract calls.
- Actor ID and role are required before contract calls.
- Contract errors propagate without legacy/internal fallback.
- No Hospital Patient/MPI service imports legacy healthcare services, Platform
  Party, Platform Person, internal Healthcare party engine, direct `hc_*`, or
  direct Patient/MPI tables.

## Evidence

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-patient-mpi.service.test.ts --runInBand
PASS - 1 suite, 5 tests

npx jest src/products/bella-hospital/__tests__/hospital-foundation-contract-boundary.test.ts src/products/bella-hospital/__tests__/hospital-patient-mpi-contract-trace.test.ts --runInBand
PASS - 2 suites, 10 tests

npm run healthcare:guard
PASS - ARCHITECTURE GUARD PASSED: ZERO VIOLATIONS DETECTED

npm run typecheck:changed
PASS - TypeScript scope "full" passed with zero diagnostics

git diff --check
PASS
```

Changed source/test files were checked for explicit `any` and TypeScript
suppression patterns; no matches were found.

## Canonical Closure

```text
HOSPITAL_PATIENT_MPI_RUNTIME = PROVEN_FOR_FOUNDATION_SCOPE
PATIENT_MPI_PUBLIC_CONTRACT = PASS
PATIENT_MPI = REUSE_PARTIAL_WITH_PUBLIC_CONTRACT
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
FULL_HOSPITAL_CHAIN = NOT_PROVEN
```

Stop condition:

```text
Do not continue to Admission, Encounter, EMR, Billing, Finance, UI, Real DB,
or Browser E2E in this slice.
```
