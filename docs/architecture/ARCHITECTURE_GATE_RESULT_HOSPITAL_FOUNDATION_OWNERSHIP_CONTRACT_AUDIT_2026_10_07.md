# ARCHITECTURE GATE RESULT - Hospital Foundation Ownership + Canonical Contract Audit

Date: 2026-10-07

Status: **FOUNDATION_OWNERSHIP_MAP_PASS__FOUNDATION_IMPLEMENTATION_BLOCKED**

Parent baselines:

- `docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_FOUNDATION_CHAIN_2026_10_07.md`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_PRODUCT_IDENTITY_FOUNDATION_2026_10_07.md`

## Scope

This gate audits ownership and canonical contract paths for the next Hospital Foundation slice.

It does not authorize runtime/UI/DB changes.

Target entities/actions:

```text
Patient
Department
Doctor / Staff
Admission
Bed
Transfer
Discharge
Tenant / RBAC
```

## Decision Summary

```text
Product Identity        = SEALED
Foundation Map          = PASS
Foundation Runtime      = BLOCKED_FOR_CONTRACT_TRACE
Real DB / RLS           = NOT_PROVEN
Browser E2E             = NOT_PROVEN
Finance                 = NOT_PROVEN
Full Chain              = NOT_PROVEN
```

The map is sufficient to prevent wrong implementation. It is not sufficient to begin broad runtime/DB work.

## Ownership / Contract Map

| Entity / Action | Owner | Canonical Evidence | Hospital Decision | Status |
| --- | --- | --- | --- | --- |
| Product Identity | Platform Product Registry | `productRegistry.get('bella_hospital')` | Consume | SEALED |
| Tenant product resolution | Platform Product Resolver | `Tenant.product_key -> ProductRegistry` | Consume | SEALED for mocked resolver path |
| Patient identity | Platform Party/Person and Healthcare patient role | `HealthcarePartyEngine.registerPatient(...)`, `PersonService.createPerson(...)` | Contract trace required before Product consumption | BLOCKED_FOR_CONTRACT_TRACE |
| Patient profile / MPI | Healthcare patient profile/MPI model | `PatientProfile`, `MasterPatientIndex` are type models, not public Product contract | Do not build Product runtime on raw type/direct table path | BLOCKED_FOR_PUBLIC_CONTRACT |
| Department | Encounter context / healthcare location context TBD | Encounter request carries `admittingDepartmentId`, transfer carries `toDepartmentId` | Can pass IDs through Encounter only; cannot manage departments yet | PARTIAL_ID_REFERENCE_ONLY |
| Facility / Ward / Room | Healthcare Bed/facility context TBD | `Ward`/`Bed` types exist; Bed contract accepts `wardId` and queries beds | Bed operations reusable; facility/ward/room management not sealed | PARTIAL |
| Doctor / Staff | Platform identity/RBAC and Healthcare provider context TBD | Encounter contract supports `assignProvider(providerId, role)` | Can assign provider to encounter; cannot create/manage staff/doctor registry yet | PARTIAL_ASSIGNMENT_ONLY |
| Encounter | Healthcare Encounter Engine | `IEncounterEngine.createEncounter`, `assignProvider`, `transferEncounter` | Reuse public interface/contract | REUSE_PARTIAL |
| Admission | Healthcare Admission Engine | `AdmissionEngineContract.createAdmission`, `dischargeAdmission` | Reuse public contract | REUSE_PARTIAL |
| Bed allocation/transfer/release | Healthcare Bed Engine | `BedEngineContract.allocateBed`, `releaseBed`, `transferBed`, `queryBeds`, `getBedById` | Reuse public contract | REUSE_PARTIAL |
| Discharge | Admission + Bed + Audit/Temporal boundaries | Admission has `dischargeAdmission`; Bed has `releaseBed`; Hospital service already issues H11 evidence | Discharge chain must include bed-release decision in next slice; not proven runtime | PARTIAL |
| RBAC / permissions | Contract metadata + Platform auth/RBAC | Encounter/Bed metadata list bearer roles | Runtime authorization not proven | BLOCKED_FOR_RUNTIME_PROOF |
| Legacy Hospital UI/actions | None as canonical for new chain | `src/app/dashboard/hospital/admissions/page.tsx` imports `@/services/healthcare-hospital-services` and hard-codes `bella_healthcare` | Audit target only; do not extend as canonical path | BLOCKED_AS_LEGACY |

## Canonical Paths For Next Slice

Allowed reuse paths:

```text
Hospital Product
  -> src/platform/healthcare/contracts/encounter-engine.contract.ts
  -> src/platform/healthcare/engines/encounter-engine/encounter-engine.interface.ts
  -> src/platform/healthcare/contracts/admission-engine.contract.ts
  -> src/platform/healthcare/contracts/bed-engine.contract.ts
  -> src/platform/healthcare/contracts/clinical-audit.contract.ts
  -> src/platform/healthcare/contracts/temporal-engine.contract.ts
```

Blocked paths for new canonical implementation:

```text
src/services/healthcare*
src/services/healthcare-hospital-services.ts
src/app/dashboard/healthcare*
legacy direct hc_* access
hard-coded tenant "bella_healthcare"
mock-only Hospital conformance assertions
```

## Entity Detail

### Patient

Evidence:

- `src/modules/bella-healthcare/kernel/party-engine.ts` exposes `HealthcarePartyEngine.registerPatient(...)`.
- `src/platform/host/person/person.service.ts` exposes `PersonService.createPerson(...)`.
- `src/types/healthcare.ts` defines `PatientProfile` and `MasterPatientIndex`.

Decision:

```text
Patient = BLOCKED_FOR_CONTRACT_TRACE
```

Reason: there is patient/person capability evidence, but no sealed Product-facing public Healthcare patient contract was found in `src/platform/healthcare/contracts`. Hospital must not create duplicate patient tables or directly use profile/MPI persistence.

### Department / Facility

Evidence:

- Encounter create/search/transfer DTOs include `departmentId`, `admittingDepartmentId`, `currentDepartmentId`, and `toDepartmentId`.
- Bed contract includes `wardId`, bed query, and bed allocation/transfer/release.
- `src/types/healthcare.ts` defines `Building`, `Ward`, `Room`, and `Bed`.

Decision:

```text
Department = PARTIAL_ID_REFERENCE_ONLY
Facility/Ward/Room management = BLOCKED_FOR_PUBLIC_CONTRACT
Bed operations = REUSE_PARTIAL
```

Reason: Hospital can pass canonical IDs through Encounter/Bed operations, but cannot yet own CRUD or management workflows for departments/facility/wards/rooms.

### Doctor / Staff

Evidence:

- Encounter contract supports provider assignment through `AssignProviderRequest`.
- Contract metadata restricts Encounter/Bed operations to roles such as `doctor`, `nurse`, `admin`, and `receptionist`.

Decision:

```text
Doctor/Staff identity = BLOCKED_FOR_CONTRACT_TRACE
Encounter provider assignment = REUSE_PARTIAL
```

Reason: provider assignment is available, but staff/doctor source-of-truth and RBAC runtime enforcement are not proven for Hospital.

### Admission / Bed / Transfer / Discharge

Evidence:

- Admission public re-export exists at `src/platform/healthcare/contracts/admission-engine.contract.ts`.
- Canonical Admission contract has `createAdmission`, `dischargeAdmission`, `getAdmissionById`, and `getAdmissionByEncounterId`.
- Bed contract has `allocateBed`, `releaseBed`, `transferBed`, `queryBeds`, and `getBedById`.
- Existing Hospital service consumes Admission/Bed/Temporal/Audit contracts.

Decision:

```text
Admission = REUSE_PARTIAL
Bed = REUSE_PARTIAL
Transfer = REUSE_PARTIAL
Discharge = PARTIAL_CHAIN_ONLY
```

Reason: contracts exist, but runtime Real DB/RLS and full discharge side effects are not proven. A next implementation slice must prove whether discharge requires BedEngine `releaseBed` in addition to AdmissionEngine `dischargeAdmission` and H11 audit evidence.

## UI / Action Reconciliation

| Existing UI / Action | Current Path | Conclusion |
| --- | --- | --- |
| `/dashboard/hospital/admissions` | Imports `@/services/healthcare-hospital-services`; hard-codes `bella_healthcare`; uses mock fallback | STALE UI / LEGACY PATH |
| `/dashboard/healthcare/*` | Uses `src/services/healthcare*` and direct `hc_*` subscriptions/actions | LEGACY HEALTHCARE SURFACE |
| `src/products/bella-hospital/services/*` | Constructor-injected public contracts | CANONICAL PRODUCT SERVICE SHAPE |

Hospital UI implementation must start from product services/public contracts, not by extending current legacy dashboard/actions.

## Additive Migration Plan

Current status: **DEFER**

No migration is authorized by this audit. Foundation ownership map does not prove a product-owned table requirement.

## Verification Plan For Next Slice

Before any runtime/DB implementation:

```text
1. Contract-boundary test for Patient/Profile source path
2. Contract-boundary test for Department/Provider ID-only semantics
3. Contract-boundary test for Admission + Bed + Discharge orchestration
4. No direct `hc_*` access from new Hospital Product code
5. No Healthcare Kernel H1-H12 edits
```

Only after those pass should Real DB/RLS tests be introduced.

## Final Decision

```text
FOUNDATION_OWNERSHIP_MAP = PASS
FOUNDATION_IMPLEMENTATION = BLOCKED_FOR_CONTRACT_TRACE
```

Next minimal implementation-safe action:

```text
Hospital Foundation Contract Boundary Tests
  -> prove allowed public contracts for Admission/Bed/Encounter
  -> prove Patient/Profile/Department/Staff remain blocked unless public contract is identified
  -> prevent new Product code from importing legacy direct `hc_*` paths
```

Do not begin runtime UI/DB implementation until this boundary test slice is green.
