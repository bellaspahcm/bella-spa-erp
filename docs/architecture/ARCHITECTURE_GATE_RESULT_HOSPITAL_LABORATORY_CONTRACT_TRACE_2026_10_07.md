# ARCHITECTURE GATE RESULT - HOSPITAL LABORATORY CONTRACT TRACE

Date: 2026-10-07
Scope: Bella Hospital Go-Live business-chain trace
Slice: Laboratory Order -> Laboratory Workflow -> Laboratory Result
Status: PASS

## Canonical Baseline

```makefile
HOSPITAL_FOUNDATION = SEALED
HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN_FOR_FOUNDATION_GO_LIVE_CHAIN_SCOPE
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE
HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE
HOSPITAL_DOWNSTREAM_CARE_DEPENDENCY_TRACE = PASS

LABORATORY = REQUIRED_FOR_HOSPITAL_GO_LIVE
LABORATORY_RUNTIME = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
```

This slice is trace-only. It does not implement Laboratory runtime or reopen Clinical Orders, CDS, or Medication/Pharmacy/MAR.

## Development Process Gate

Result: PASS_FOR_TRACE_ONLY

Authorized changes:

- Add architecture evidence artifact.
- Add focused static architecture test.

Not authorized:

- Runtime implementation.
- Healthcare Kernel H1-H12 modification.
- Public contract creation or expansion.
- DB/schema migration.
- UI, Real DB/RLS, Browser E2E, Finance, Discharge, Imaging, Nursing.

## Product Manifest

Product: `bella_hospital`

Branch under trace:

```text
Hospital Clinical Orders
  -> LAB Order
  -> Laboratory Workflow
  -> Specimen / Processing
  -> Laboratory Result
  -> Verification / Critical Escalation
  -> Downstream Clinical / Discharge / Audit / Temporal / Billing
```

## Ownership Map

| Capability | Owner | Hospital Role | Trace Result |
| --- | --- | --- | --- |
| LAB clinical order | Healthcare Order Engine | Product consumer through sealed Clinical Orders service | REUSE_PUBLIC_CONTRACT |
| Laboratory workflow | Healthcare Laboratory Engine | Product consumer only | CONTRACT_FILE_PRESENT, PUBLIC_EXPOSURE_PARTIAL |
| Specimen/result/verification | Healthcare Laboratory Engine | Product consumer only | CONTRACT_PRESENT, RUNTIME_NOT_PROVEN |
| Result temporal timeline | H9 Temporal | Product consumer only | CONTRACT_PRESENT, RUNTIME_NOT_PROVEN |
| Audit/evidence | H11 Audit/Evidence | Product consumer only | NOT_PROVEN |
| Billing/payment/ledger | Finance OS / Healthcare finance integration | Product consumer only | CONTRACT_CATEGORY_PRESENT, RUNTIME_NOT_PROVEN |

Hospital must not consume `src/services/healthcare*` direct table paths or `hc_lab_orders` / `hc_clinical_orders` directly.

## Contract Dependency Map

```text
Bella Hospital
  -> HospitalClinicalOrdersProductService
      -> OrderEngineContract
          -> OrderType = LAB
          -> OrderCreated / OrderApproved subscribers include laboratory-engine
  -> Laboratory public contract file
      -> ILaboratoryEngine
          -> collectSpecimen
          -> receiveSpecimen
          -> startProcessing
          -> recordResult
          -> verifyResult
          -> acknowledgeCritical
```

Important boundary finding:

```makefile
PUBLIC_LAB_CONTRACT_FILE = PRESENT
CONTRACT_EXPORT_FROM_INDEX = MISSING
HEALTHCARE_ENGINE_CONTRACTS_METADATA = MISSING
SERVICE_LOCATOR_TYPE = unknown
SERVICE_LOCATOR_CONSTRUCTION = MISMATCHED
```

## Phase 1 - Public Laboratory Contract

```makefile
LABORATORY_CONTRACT = REUSE_PUBLIC_CONTRACT_PARTIAL
PUBLIC_LAB_CONTRACT = PRESENT_AS_FILE
CONTRACT_OWNER = HEALTHCARE_LABORATORY_ENGINE
CONTRACT_METHODS = PRESENT
CONTRACT_EVENTS = PRESENT_AS_ENGINE_EVENTS_NOT_CONTRACT_METADATA
NEW_PUBLIC_CONTRACT_REQUIRED = NO
```

Evidence:

- `src/platform/healthcare/contracts/laboratory-engine.contract.ts` defines `ILaboratoryEngine`.
- The interface covers specimen collection, specimen receipt, processing, raw result recording, result verification, and critical acknowledgment.
- Laboratory engine publishes `SpecimenCollected`, `ResultVerified`, and `CriticalResultEscalated` events from implementation/event files.

Gap:

- The laboratory contract is not exported from `src/platform/healthcare/contracts/index.ts`.
- Laboratory contract metadata is not present in `HEALTHCARE_ENGINE_CONTRACTS`.
- Service locator marks `laboratory-engine` as `unknown`.

Conclusion:

```makefile
PUBLIC_CONTRACT_MISSING = []
PUBLIC_CONTRACT_EXPOSURE_MISSING = [
  LABORATORY_CONTRACT_INDEX_EXPORT,
  LABORATORY_CONTRACT_METADATA_REGISTRATION
]
```

## Phase 2 - Hospital -> Lab

```makefile
HOSPITAL_TO_LAB = PARTIAL_CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
ORDER_ENGINE_LAB_CONTRACT = PROVEN
LABORATORY_CONSUMER_IN_HOSPITAL = NOT_FOUND
```

Evidence:

- `OrderEngineContract` supports `OrderType = LAB`.
- `LabOrderDetails` exists.
- `OrderCreated` and `OrderApproved` describe lab notification/collection workflow.
- `OrderCreated`, `OrderApproved`, and `OrderActivated` list `laboratory-engine` as subscriber.

Root cause / gap:

```makefile
SERVICE_LOCATOR_NAMING_GAP = PRESENT
ORDER_CONTRACT_LAB_VALUE = LAB
LAB_SUBSCRIBER_EXPECTED_VALUE = laboratory
LEGACY_SERVICE_ORDER_VALUE = laboratory
```

The current lab subscriber filters on `snapshot.orderType !== 'laboratory'`, while the public Order Engine contract uses uppercase `LAB`.

Service locator gap:

```makefile
SERVICE_LOCATOR_CONSTRUCTION_GAP = PRESENT
SERVICE_LOCATOR_CURRENT = new LaboratoryEngineService(supabase)
LAB_SERVICE_EXPECTS = ILaboratoryRepository
```

The service locator constructs `LaboratoryEngineService` with `supabase`, but the service constructor expects an `ILaboratoryRepository`.

Hospital boundary:

```makefile
HOSPITAL_DIRECT_LAB_ACCESS = NOT_FOUND_IN_PRODUCT_CODE
HOSPITAL_PUBLIC_LAB_CONSUMER = NOT_FOUND
```

## Phase 3 - Lab -> Result

```makefile
LAB_TO_RESULT = CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
```

Existing states:

```text
ORDERED
  -> COLLECTED
  -> RECEIVED
  -> PROCESSING
  -> RESULTED
  -> VERIFIED
```

Existing safety state:

```text
NORMAL
  -> ESCALATION_REQUIRED
  -> ACKNOWLEDGED
```

Linkage:

```makefile
ORDER_LINKAGE = PRESENT_AS_clinicalOrderId
ENCOUNTER_LINKAGE = PRESENT
PATIENT_LINKAGE = PRESENT_IN_DOMAIN_BUT_REPOSITORY_MAPPING_NOT_PROVEN
```

Evidence:

- `LabOrder` domain requires `tenantId`, `encounterId`, `clinicalOrderId`, and `patientId`.
- `ResultVerified` and `CriticalResultEscalated` include `labOrderId`, `encounterId`, and `tenantId`.

Gap:

- `SupabaseClinicalOrderReader` maps `patientId: data.encounter_id`.
- `SupabaseLaboratoryRepository.mapToDomain` maps `patientId: row.encounter_id`.
- This keeps a non-null patient field but does not prove correct Patient/MPI linkage.

## Phase 4 - Downstream Dependency

```makefile
DOWNSTREAM_DISCHARGE = NOT_PROVEN
DOWNSTREAM_AUDIT_EVIDENCE = NOT_PROVEN
DOWNSTREAM_TEMPORAL = CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
DOWNSTREAM_BILLING = CONTRACT_CATEGORY_PRESENT_RUNTIME_NOT_PROVEN
```

Evidence:

- H9 Temporal supports `LAB_RESULTS`.
- Temporal event handler has a Laboratory event mapping for finalized lab result style events.
- Finance adapter recognizes `LAB` service type.
- Order completion contract includes billing and encounter subscribers.

Gap:

- Laboratory result verification is not proven to update Hospital discharge readiness.
- H11 evidence package generation is not proven for laboratory results.
- H9 runtime propagation from Laboratory result events is not proven.
- Billing/payment/ledger/reconciliation are not proven.

## Classification

```makefile
HOSPITAL_LABORATORY_CONTRACT_TRACE = PASS

LABORATORY_CONTRACT = REUSE_PUBLIC_CONTRACT_PARTIAL
PUBLIC_LAB_CONTRACT = PRESENT_AS_FILE_NOT_FULLY_EXPOSED
NEW_PUBLIC_CONTRACT_REQUIRED = NO

HOSPITAL_TO_LAB = PARTIAL_CONTRACT_PRESENT_RUNTIME_NOT_PROVEN
LAB_TO_RESULT = CONTRACT_PRESENT_RUNTIME_NOT_PROVEN

PATIENT_LINKAGE = SEMANTICS_NOT_PROVEN
ENCOUNTER_LINKAGE = CONTRACT_PRESENT
ORDER_LINKAGE = CONTRACT_PRESENT

SERVICE_LOCATOR_NAMING_GAP = PRESENT
SERVICE_LOCATOR_CONSTRUCTION_GAP = PRESENT
LAB_VALUE_ALIGNMENT_GAP = LAB_VS_laboratory

PUBLIC_CONTRACT_MISSING = []

PUBLIC_CONTRACT_EXPOSURE_MISSING = [
  LABORATORY_CONTRACT_INDEX_EXPORT,
  LABORATORY_CONTRACT_METADATA_REGISTRATION,
  LABORATORY_SERVICE_LOCATOR_TYPED_MAPPING
]

RUNTIME_MISSING = [
  HOSPITAL_LABORATORY_MINIMAL_RUNTIME,
  LABORATORY_SERVICE_LOCATOR_REPOSITORY_WIRING
]

SEMANTICS_NOT_PROVEN = [
  LAB_ORDER_APPROVED_TO_LAB_ORDER_BOOTSTRAP,
  LAB_PATIENT_ID_LINKAGE,
  LAB_RESULT_TO_DISCHARGE_READINESS,
  LAB_RESULT_TO_H9_TEMPORAL_RUNTIME,
  LAB_RESULT_TO_H11_AUDIT_EVIDENCE_RUNTIME,
  LAB_RESULT_TO_BILLING_PAYMENT_LEDGER_RUNTIME
]

LEGACY_MOCK_ONLY = [
  src/services/healthcare/healthcare-actions.ts LAB direct table paths,
  src/services/healthcare/lis-ris-actions.ts LAB direct table paths
]

ALREADY_PROVEN = [
  HOSPITAL_CLINICAL_ORDERS_RUNTIME,
  HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME,
  ORDER_ENGINE_LAB_CONTRACT
]
```

## Next Required Capability

```makefile
NEXT_REQUIRED_CAPABILITY = HOSPITAL_LABORATORY_MINIMAL_RUNTIME_WIRING
```

Reason:

1. A Laboratory contract file exists and defines the minimum workflow methods.
2. A new public contract is not required.
3. The contract is not fully exposed through the central contracts index/metadata/service locator type map.
4. Current service locator construction does not match `LaboratoryEngineService` constructor requirements.
5. `LAB` vs `laboratory` value alignment must be handled before runtime can be proven.

The next slice must not implement Lab result/discharge/finance all at once. It should first prove the minimal Laboratory runtime wiring path through public contracts.

## Out Of Scope

- No Laboratory runtime implementation in this slice.
- No Imaging.
- No Nursing.
- No Finance/Billing.
- No Discharge.
- No Real DB/RLS.
- No Browser E2E.
- No production configuration.
- No Backup/Restore.
- No Clinical Orders, CDS, or Medication/Pharmacy/MAR changes.

## Verification Plan

```text
focused laboratory architecture test
npm run typecheck:changed
npm run healthcare:guard
changed-file no-any/no-suppression scan
git diff --check
```

## Verification Results

```text
npx jest src/products/bella-hospital/__tests__/hospital-laboratory-contract-trace.test.ts --runInBand
= PASS (7/7)

npm run typecheck:changed
= PASS
TypeScript scope "full" passed with zero diagnostics.

npm run healthcare:guard
= PASS
ARCHITECTURE GUARD PASSED: ZERO VIOLATIONS DETECTED.

rg "\bany\b|as any|@ts-ignore|@ts-expect-error" src/products/bella-hospital/__tests__/hospital-laboratory-contract-trace.test.ts
= PASS (no matches)

git diff --check
= PASS
```

## Canonical Status After This Slice

```makefile
HOSPITAL_LABORATORY_CONTRACT_TRACE = PASS

HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = HOSPITAL_LABORATORY_MINIMAL_RUNTIME_WIRING
```
