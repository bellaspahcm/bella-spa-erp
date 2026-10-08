# Architecture Gate Result - Hospital Patient/MPI Contract Trace - 2026-10-07

## Status

```text
PATIENT_MPI_CONTRACT_TRACE = PASS
PATIENT_MPI = REUSE_PARTIAL
PUBLIC_HEALTHCARE_PATIENT_MPI_CONTRACT = NOT_FOUND
FOUNDATION_RUNTIME_IMPLEMENTATION = BLOCKED_FOR_PATIENT_MPI_PUBLIC_CONTRACT
```

This is a contract trace seal only. It does not authorize Hospital runtime, UI,
database, Real DB/RLS, Browser E2E, or Finance implementation.

## Scope

Trace the canonical Patient/MPI ownership and consumption boundary for Bella
Hospital Foundation.

Non-goals:

- No new database table.
- No Patient UI change.
- No Hospital Patient service.
- No Real DB execution.
- No legacy healthcare migration campaign.
- No Healthcare Kernel H1-H12 modification.

## Governance Inputs

- `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_PRODUCT_IDENTITY_FOUNDATION_2026_10_07.md`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_FOUNDATION_OWNERSHIP_CONTRACT_AUDIT_2026_10_07.md`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_FOUNDATION_CONTRACT_BOUNDARY_TESTS_2026_10_07.md`

## Product Manifest

```text
productKey: bella_hospital
requiredModules: healthcare
defaultRoute: /dashboard/hospital
navigationProfile: hospital
serviceProfile: hospital
```

Finance remains out of `requiredModules` until the Hospital Finance chain is
proven.

## Truth And Source Of Truth

| Question | Source | Result |
| --- | --- | --- |
| Who owns Patient / Person Profile? | Healthcare Vertical Coding Constitution | Person Engine / Kernel owns Patient / Person Profile. |
| Is there a Platform identity primitive? | `src/platform/host/person/*`, `src/platform/party/index.ts` | Yes. Person and Party provide reusable identity primitives. |
| Is there Healthcare patient role logic? | `src/modules/bella-healthcare/kernel/party-engine.ts` | Yes. `HealthcarePartyEngine` wraps Party for patient registration and identifier lookup. |
| Is there Patient/MPI schema/type evidence? | `src/types/healthcare.ts`, generated DB types | Yes. `PatientProfile` and `MasterPatientIndex` models exist, and DB types include `patient_profiles` and `hc_master_patient_index`. |
| Is there a public Healthcare Patient/MPI Product contract? | `src/platform/healthcare/contracts/*`, `src/platform/healthcare/contracts/index.ts` | Not found. No patient/MPI/person/party contract is exported from the Healthcare public contract surface. |

## Ownership Map

| Capability | Owner | Current evidence | Hospital action |
| --- | --- | --- | --- |
| Person identity | Platform / Person capability | `PersonService`, `Person`, `CreatePersonRequest` | Reuse only through approved Healthcare patient/MPI contract, not directly from Hospital Product in this slice. |
| Generic party identity | Platform / Party capability | `partyEngine`, `Party`, `PartyRole` | Reuse partial evidence only; Hospital Product must not directly consume Party for Patient/MPI until contract is approved. |
| Healthcare patient role | Healthcare OS | `HealthcarePartyEngine.registerPatient`, `findPatientByBhyt`, `findPatientByNationalId` | Existing logic is internal/kernel-adjacent, not a Product public contract. |
| Patient profile / MPI | Healthcare OS | `PatientProfile`, `MasterPatientIndex`, DB type evidence | Product runtime blocked until public contract is defined or an existing public contract is proven sufficient. |
| Hospital Patient workflow | Hospital Product | Not implemented | Blocked. |

## Contract Dependency Map

Expected canonical flow:

```text
Bella Hospital Product
  -> Public Healthcare Patient/MPI Contract
  -> Healthcare Patient/MPI capability
  -> Platform Person/Party identity primitive as needed
  -> Persistence/RLS under the owning layer
```

Current proven reusable pieces:

```text
Platform Person / Party identity = REUSE_PARTIAL
HealthcarePartyEngine patient wrapper = REUSE_PARTIAL_INTERNAL
PatientProfile / MasterPatientIndex type/schema evidence = REUSE_PARTIAL_MODEL_ONLY
Public Healthcare Patient/MPI contract = NOT_FOUND
```

## Legacy Boundary

Legacy code exists and is not changed by this slice:

- `src/services/healthcare/healthcare-service.ts` directly uses `patient_profiles`.
- `src/services/healthcare/healthcare-actions.ts` directly uses `patient_profiles`.
- `src/services/healthcare/billing-actions.ts` directly uses `patient_profiles`.
- `src/services/healthcare/bhyt-actions.ts` references `hc_master_patient_index`.
- Legacy healthcare dashboard paths consume `@/services/healthcare/healthcare-actions`.

This is not a legacy migration authorization. The sealed rule is narrower:

```text
New Hospital Product implementation must not introduce direct dependency on
legacy healthcare services, direct patient_profiles/hc_master_patient_index
table access, internal Healthcare kernel party engine, or raw Platform
Person/Party as a substitute for a Healthcare Patient/MPI public contract.
```

## Change Authority

Authorized in this slice:

- Audit and document Patient/MPI contract trace.
- Add static contract boundary test for Hospital Product Patient/MPI usage.

Not authorized:

- Healthcare Kernel modification.
- New Patient/MPI public contract implementation.
- Hospital Patient runtime service.
- DB/RLS implementation.
- UI/E2E/Finance.

## Additive Migration Plan

```text
NONE
```

No database migration is authorized by this slice.

## Verification Plan

| Gate | Status | Notes |
| --- | --- | --- |
| Source trace | PASS | Patient/MPI ownership and surfaces traced. |
| Contract boundary test | PASS | Hospital Product implementation is guarded from Patient/MPI bypass paths. |
| Real DB/RLS | NOT_RUN | Out of scope. |
| Browser E2E | NOT_RUN | Out of scope. |
| Healthcare verify | NOT_RUN | No runtime/Healthcare Kernel code changed in this slice. |
| Finance | NOT_RUN | Out of scope. |

## Conclusion

```text
PATIENT/MPI = REUSE_PARTIAL
```

Bella Hospital may reuse existing Person/Party identity and Healthcare patient
role evidence only after a public Healthcare Patient/MPI Product contract is
identified or implemented in its own approved slice.

```text
CONTRACT GAP = YES
```

The gap is specifically the missing public Healthcare Patient/MPI contract for
Product consumption. This trace does not prove a need to modify frozen H1-H12
Kernel internals, so it is not escalated as a Kernel architecture change in
this slice.

Next allowed slice:

```text
Patient/MPI Public Contract
  -> implementation
  -> unit/type/security
  -> Real DB/RLS
  -> seal
```

Until then:

```text
HOSPITAL FOUNDATION RUNTIME IMPLEMENTATION = BLOCKED
```
