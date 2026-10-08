# ARCHITECTURE GATE RESULT - HOSPITAL LABORATORY MINIMAL RUNTIME WIRING

Date: 2026-10-07

## Scope

```makefile
TASK = HOSPITAL_LABORATORY_MINIMAL_RUNTIME_WIRING
STATUS = PASS

HOSPITAL_LABORATORY_CONTRACT_TRACE = PASS
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
```

This slice fixes only the proven Laboratory composition and naming gaps.

It does not implement Laboratory workflow, Lab result semantics, Imaging,
Nursing, Discharge, Billing, Finance, Real DB/RLS, Browser E2E, or production
configuration.

## Root Cause

```makefile
ROOT_CAUSE = LABORATORY_PUBLIC_CONTRACT_PRESENT_BUT_RUNTIME_COMPOSITION_INCOMPLETE

SERVICE_LOCATOR_NAMING_GAP = PRESENT
SERVICE_LOCATOR_CONSTRUCTION_GAP = PRESENT
LAB_VALUE_ALIGNMENT_GAP = LAB_VS_laboratory
```

Evidence:

1. `ILaboratoryEngine` existed in `laboratory-engine.contract.ts`.
2. `contracts/index.ts` did not expose/register Laboratory metadata.
3. `HealthcareServiceMap` typed `laboratory-engine` as `unknown`.
4. `getHealthcareService('laboratory-engine')` passed Supabase directly into
   `LaboratoryEngineService`, but the service requires an `ILaboratoryRepository`.
5. Order Engine public contract uses `OrderType = 'LAB'`, while
   `LabOrderApprovedSubscriber` only accepted `laboratory`.

## Minimal Fix

```makefile
PUBLIC_LAB_CONTRACT_REUSED = YES
NEW_PUBLIC_CONTRACT_CREATED = NO
HOSPITAL_SPECIFIC_LAB_ENGINE_CREATED = NO
LABORATORY_BUSINESS_LOGIC_CHANGED = NO
```

Changes:

1. Exposed the existing `laboratory-engine.contract.ts` through the Healthcare
   contracts index.
2. Added `LABORATORY_ENGINE_CONTRACT` metadata for the existing public contract.
3. Typed `HealthcareServiceMap['laboratory-engine']` as `ILaboratoryEngine`.
4. Wired service locator construction through `SupabaseLaboratoryRepository`.
5. Preserved service locator caching behavior.
6. Aligned the Laboratory order subscriber to accept the canonical public
   `LAB` order type while preserving legacy `laboratory`.

## Runtime Wiring Proof

```makefile
HOSPITAL_LABORATORY_MINIMAL_RUNTIME_WIRING = PASS

SERVICE_LOCATOR_NAMING_GAP = RESOLVED
SERVICE_LOCATOR_CONSTRUCTION_GAP = RESOLVED
LAB_VALUE_ALIGNMENT_GAP = RESOLVED

HOSPITAL_LABORATORY_RUNTIME = PROVEN_FOR_GO_LIVE_CHAIN_WIRING_SCOPE
LABORATORY_WORKFLOW_RUNTIME = NOT_PROVEN
LAB_RESULT_RUNTIME = NOT_PROVEN
```

Proven:

1. `getHealthcareService('laboratory-engine')` returns the public
   `ILaboratoryEngine` contract.
2. Laboratory service construction receives `SupabaseLaboratoryRepository`,
   matching the existing engine constructor.
3. Laboratory service resolution is cached and reused.
4. Contract metadata includes `laboratory-engine`.
5. `OrderApproved` with canonical `LAB` reaches the Laboratory subscriber and
   can create a LabOrder with tenant, encounter, patient, and order linkage.

Not proven:

1. Specimen collection workflow semantics.
2. Result recording and verification workflow semantics.
3. Lab result propagation to Discharge readiness.
4. Lab result propagation to H9 Temporal and H11 Audit Evidence.
5. Lab result propagation to Billing/Payment/Ledger/Reconciliation.

## Patient / Encounter / Order Linkage

```makefile
PATIENT_LINKAGE = CONTRACT_ACCEPTS_CONTEXT_BUT_DB_RUNTIME_SEMANTICS_NOT_PROVEN
ENCOUNTER_LINKAGE = PROVEN_AT_WIRING_SCOPE
ORDER_LINKAGE = PROVEN_AT_WIRING_SCOPE
```

The subscriber wiring proof shows canonical `LAB` order events can carry
`patientId`, `encounterId`, and `orderId` into LabOrder creation.

Existing repository mapping still contains historical patient linkage ambiguity
for read-model/database hydration, so patient linkage is not promoted to full
runtime semantics proof in this slice.

## Boundaries Preserved

```makefile
DIRECT_HC_ACCESS_FROM_HOSPITAL = NO
ORDER_ENGINE_INTERNALS_MODIFIED = NO
LABORATORY_WORKFLOW_IMPLEMENTED = NO
CDS_REOPENED = NO
MEDICATION_PHARMACY_MAR_REOPENED = NO
```

This slice modifies only public contract exposure, service composition, and the
minimal order-type alignment needed for the existing Laboratory consumer.

## Verification Results

```text
npx jest src/platform/healthcare/__tests__/service-locator-laboratory-wiring.test.ts --runInBand
= PASS (4/4)

npx jest src/products/bella-hospital/__tests__/hospital-laboratory-contract-trace.test.ts --runInBand
= PASS (7/7)

npx jest src/platform/healthcare/__tests__/service-locator-cds-wiring.test.ts --runInBand
= PASS (3/3)

npx jest src/products/bella-hospital/services/__tests__/hospital-clinical-orders.service.test.ts --runInBand
= PASS (4/4)

npm run typecheck:changed
= PASS
TypeScript scope "full" passed with zero diagnostics.

npm run healthcare:guard
= PASS
ARCHITECTURE GUARD PASSED: ZERO VIOLATIONS DETECTED.

changed-file no-any/no-suppression scan
= PASS

git diff --check
= PASS
```

## Canonical Status After This Slice

```makefile
HOSPITAL_LABORATORY_MINIMAL_RUNTIME_WIRING = PROVEN_FOR_GO_LIVE_CHAIN_WIRING_SCOPE

PUBLIC_LAB_CONTRACT_REUSED = YES
NEW_PUBLIC_CONTRACT_CREATED = NO

LABORATORY_WORKFLOW_RUNTIME = NOT_PROVEN
LAB_RESULT_RUNTIME = NOT_PROVEN

PATIENT_LINKAGE = NOT_PROVEN_FOR_DB_RUNTIME_SEMANTICS
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN

HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = HOSPITAL_LABORATORY_WORKFLOW_RESULT_SEMANTICS_TRACE
```

## Stop

Do not continue to Lab result workflow, Imaging, Nursing, Discharge,
Billing/Finance, Real DB/RLS, Browser E2E, or production configuration in this
slice.
