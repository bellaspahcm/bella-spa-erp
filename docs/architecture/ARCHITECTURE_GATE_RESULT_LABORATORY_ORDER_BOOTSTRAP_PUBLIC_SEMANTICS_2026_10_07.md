# ARCHITECTURE GATE RESULT - LABORATORY ORDER BOOTSTRAP PUBLIC SEMANTICS

Date: 2026-10-07

## Scope

```makefile
TASK = LABORATORY_ORDER_BOOTSTRAP_PUBLIC_SEMANTICS
STATUS = PASS

TRACE_AND_MINIMAL_CONTRACT_SEMANTIC = YES
HOSPITAL_LABORATORY_RUNTIME = NO
LAB_RESULT_RUNTIME = NO
H9_TEMPORAL_ALIGNMENT_FIX = NO
```

This slice closes the public semantic gap between a Hospital Clinical Order and
the Laboratory `LabOrder` identity needed by the existing Laboratory workflow.

It does not implement Hospital Laboratory runtime, specimen/result workflow
runtime, H9 Temporal alignment, Imaging, Nursing, Discharge, Billing/Finance,
Real DB/RLS, Browser E2E, or production configuration.

## Root Cause

```makefile
PUBLIC_LAB_ORDER_BOOTSTRAP_SEMANTICS = MISSING
```

Confirmed gap before this slice:

```text
Clinical Order / orderId
        ↓
        X
LabOrder / labOrderId
```

The Laboratory domain already supported the workflow:

```text
ORDERED -> COLLECTED -> RECEIVED -> PROCESSING -> RESULTED -> VERIFIED
```

But the public `ILaboratoryEngine` contract did not expose a product-safe way to
bootstrap a `LabOrder` from an approved Clinical Order and return the linkage
identifiers.

## Existing Public Semantics Search

```makefile
EXISTING_EQUIVALENT_PUBLIC_SEMANTIC = NOT_FOUND
```

Searched semantics:

```text
createLabOrder
bootstrapLabOrder
createLaboratoryOrder
submitLabOrder
initializeLabOrder
registerLabOrder
```

Result:

1. Repository-level `findByClinicalOrderId` existed.
2. `LabOrderApprovedSubscriber` had internal bootstrap logic.
3. No product-facing public contract semantic existed.

## Minimal Public Semantic

```makefile
PUBLIC_BOOTSTRAP_SEMANTICS = bootstrapLabOrder
NEW_PUBLIC_CONTRACT = NO
NEW_PUBLIC_SEMANTIC = YES
PUBLIC_LAB_CONTRACT_REUSED = YES
```

Added to existing `ILaboratoryEngine`:

```text
bootstrapLabOrder(request: BootstrapLabOrderRequest): Promise<BootstrapLabOrderResult>
```

Minimum request fields:

```text
tenantId
patientId
encounterId
orderId
testCode
testName
```

`testCode` and `testName` are included because the existing `LabOrder` domain
requires them to create a valid aggregate.

## Linkage Semantics

```makefile
ORDER_TO_LAB_ORDER_LINKAGE = PROVEN_AT_PUBLIC_CONTRACT_SEMANTIC
PATIENT_LINKAGE = SUPPORTED_AT_PUBLIC_BOOTSTRAP_SEMANTIC
ENCOUNTER_LINKAGE = SUPPORTED_AT_PUBLIC_BOOTSTRAP_SEMANTIC
```

Public result returns:

```text
tenantId
patientId
encounterId
orderId
labOrderId
testCode
testName
status
reusedExisting
```

Hospital can now call the public Laboratory contract and receive the `labOrderId`
needed for subsequent public Laboratory workflow calls without importing
Laboratory repositories or direct `hc_*` persistence.

## Idempotency / Duplicate Semantics

```makefile
IDEMPOTENCY_SEMANTICS = MINIMAL_PUBLIC_SEMANTIC_ADDED
IDEMPOTENCY_KEY = tenantId + orderId + testCode
```

Behavior:

1. `bootstrapLabOrder` checks existing LabOrders for the same tenant and
   clinical order.
2. If one already exists for the same `testCode`, it returns the existing
   `labOrderId`.
3. If none exists, it creates one `LabOrder` in `ORDERED` state.
4. The result marks whether the existing LabOrder was reused.

No generic idempotency framework was created.

## Event Semantics

```makefile
EVENT_SEMANTICS = NO_NEW_EVENT
```

Reason:

1. Existing Clinical Order approval event semantics remain the trigger context.
2. Existing Laboratory domain events begin at specimen/result milestones.
3. No downstream requirement in this slice proved that a new
   `LabOrderBootstrapped` event is needed.

## H9 Temporal Gap

```makefile
H9_TEMPORAL_ALIGNMENT = NOT_PROVEN
LAB_RESULT_TEMPORAL_ALIGNMENT = NOT_PROVEN
```

Preserved gap:

```text
H9 Temporal subscriber = hos.lab.result_finalized.v1
Laboratory publisher   = ResultVerified
```

This slice intentionally does not rename events, add H9 subscribers, or modify
Temporal runtime.

## Boundary

```makefile
HOSPITAL_DIRECT_REPOSITORY_ACCESS = NO
LABORATORY_REPOSITORY_EXPOSED_TO_PRODUCT = NO
DIRECT_HC_ACCESS_FROM_HOSPITAL = NO
```

Allowed path:

```text
Hospital
  -> PUBLIC LABORATORY CONTRACT
  -> Laboratory domain/service
  -> existing persistence
```

Disallowed path remains blocked:

```text
Hospital
  -> Laboratory repository
  -> database
```

## Classification

```makefile
LABORATORY_ORDER_BOOTSTRAP_PUBLIC_SEMANTICS = PASS

PUBLIC_BOOTSTRAP_SEMANTICS = PRESENT
ORDER_TO_LAB_ORDER_LINKAGE = PROVEN_AT_PUBLIC_CONTRACT_SEMANTIC
PATIENT_LINKAGE = SUPPORTED_AT_PUBLIC_BOOTSTRAP_SEMANTIC
ENCOUNTER_LINKAGE = SUPPORTED_AT_PUBLIC_BOOTSTRAP_SEMANTIC

IDEMPOTENCY_SEMANTICS = PRESENT_FOR_TENANT_ORDER_TEST_CODE
EVENT_SEMANTICS = NO_NEW_EVENT

NEW_PUBLIC_CONTRACT = NO
NEW_PUBLIC_SEMANTIC = YES

H9_TEMPORAL_ALIGNMENT = NOT_PROVEN

HOSPITAL_LABORATORY_WORKFLOW_RUNTIME = NOT_PROVEN
HOSPITAL_LABORATORY_RESULT_RUNTIME = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
```

## Verification Results

```text
npx jest src/platform/healthcare/contracts/__tests__/laboratory-order-bootstrap-public-semantics.test.ts --runInBand
= PASS (5/5)

npx jest src/products/bella-hospital/__tests__/hospital-laboratory-contract-trace.test.ts --runInBand
= PASS (7/7)

npx jest src/platform/healthcare/__tests__/service-locator-laboratory-wiring.test.ts --runInBand
= PASS (4/4)

npx jest src/products/bella-hospital/__tests__/hospital-laboratory-workflow-result-semantics-trace.test.ts --runInBand
= PASS (7/7)

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

## Next Required Capability

```makefile
NEXT_REQUIRED_CAPABILITY = HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME
```

Reason:

1. Laboratory public contract is present.
2. Service locator Laboratory wiring is proven.
3. Workflow/result domain semantics are present.
4. Public Clinical Order to LabOrder bootstrap semantics are now present.

The next slice may implement the minimal Hospital Laboratory workflow/runtime
adapter through public contracts only. It must still not implement H9 Temporal
alignment, Discharge, Billing/Finance, Real DB/RLS, or Browser E2E in the same
slice.

## Stop

Do not continue to Hospital Laboratory runtime, Lab result runtime, H9 Temporal
alignment, Imaging, Nursing, Discharge, Billing/Finance, Real DB/RLS, Browser
E2E, or production configuration in this slice.
