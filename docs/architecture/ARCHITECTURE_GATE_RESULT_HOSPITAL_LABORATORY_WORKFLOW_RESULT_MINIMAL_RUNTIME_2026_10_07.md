# ARCHITECTURE GATE RESULT - HOSPITAL LABORATORY WORKFLOW RESULT MINIMAL RUNTIME

Date: 2026-10-07

## Scope

```makefile
TASK = HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME
STATUS = PASS

HOSPITAL_LABORATORY_RUNTIME_IMPLEMENTED = MINIMAL
H9_TEMPORAL_ALIGNMENT = NOT_OPENED
H11_AUDIT_RUNTIME = NOT_OPENED
BILLING_FINANCE = NOT_OPENED
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
```

This slice proves the minimal Hospital runtime path from Clinical Order to
Laboratory workflow/result verification through public contracts only.

It does not implement H9 Temporal alignment, H11 Audit Evidence, Imaging,
Nursing, Discharge, Billing/Finance, Real DB/RLS, Browser E2E, or production
configuration.

## Canonical Prerequisites

```makefile
LABORATORY_ORDER_BOOTSTRAP_PUBLIC_SEMANTICS = PASS
PUBLIC_BOOTSTRAP_SEMANTICS = bootstrapLabOrder
ORDER_TO_LAB_ORDER_LINKAGE = PROVEN_AT_PUBLIC_CONTRACT_SEMANTIC
PATIENT_LINKAGE = SUPPORTED_AT_PUBLIC_BOOTSTRAP_SEMANTIC
ENCOUNTER_LINKAGE = SUPPORTED_AT_PUBLIC_BOOTSTRAP_SEMANTIC
HOSPITAL_DIRECT_REPOSITORY_ACCESS = NO
```

## Root Cause

```makefile
ROOT_CAUSE = HOSPITAL_LABORATORY_RUNTIME_PATH_NOT_IMPLEMENTED_AFTER_PUBLIC_BOOTSTRAP_SEMANTIC
```

The Laboratory contract, service locator wiring, workflow semantics, and public
bootstrap semantics were already proven. The remaining gap was a Hospital
product service that uses those public contracts to drive the minimum
Laboratory branch runtime.

## Minimal Fix

```makefile
MINIMAL_FIX = HOSPITAL_LABORATORY_PRODUCT_SERVICE

PUBLIC_LAB_CONTRACT_REUSED = YES
NEW_PUBLIC_CONTRACT = NO
NEW_PUBLIC_SEMANTIC = NO
```

Added `HospitalLaboratoryProductService`, which depends only on:

```text
HospitalClinicalOrdersProductService
ILaboratoryEngine
```

Runtime path:

```text
Hospital Clinical Orders
  -> create LAB order
  -> approve LAB order
  -> ILaboratoryEngine.bootstrapLabOrder()
  -> collectSpecimen()
  -> receiveSpecimen()
  -> startProcessing()
  -> recordResult()
  -> verifyResult()
```

## Runtime Proof

```makefile
HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME = PASS

CLINICAL_ORDER_TO_LAB_ORDER_RUNTIME = PROVEN
LAB_WORKFLOW_RUNTIME = PROVEN_FOR_MINIMAL_GO_LIVE_CHAIN_SCOPE
LAB_RESULT_RUNTIME = PROVEN_FOR_MINIMAL_GO_LIVE_CHAIN_SCOPE
LAB_RESULT_VERIFICATION_RUNTIME = PROVEN_FOR_MINIMAL_GO_LIVE_CHAIN_SCOPE
```

The focused test uses the real `LaboratoryEngineService` and an in-memory
`ILaboratoryRepository` test double, so the Hospital product runtime is tested
against the existing Laboratory domain/service behavior without mocking away the
engine workflow.

## Linkage

```makefile
ORDER_TO_LAB_ORDER_LINKAGE = PROVEN
PATIENT_LINKAGE = PROVEN_AT_PRODUCT_RUNTIME_SCOPE
ENCOUNTER_LINKAGE = PROVEN_AT_PRODUCT_RUNTIME_SCOPE
TENANT_LINKAGE = PROVEN_AT_PRODUCT_RUNTIME_SCOPE
LAB_ORDER_LINKAGE = PROVEN
```

The runtime preserves:

```text
tenantId
patientId
encounterId
orderId
labOrderId
testCode
testName
```

## Idempotency

```makefile
IDEMPOTENCY_RUNTIME = PROVEN_FOR_TENANT_ORDER_TEST_CODE
```

The runtime reuses existing `bootstrapLabOrder()` semantics:

```text
tenantId + orderId + testCode
```

When a matching LabOrder exists, the runtime receives the existing `labOrderId`
with `reusedExisting = true` and does not create a duplicate LabOrder.

## Architecture Boundary

```makefile
HOSPITAL_DIRECT_REPOSITORY_ACCESS = NO
DIRECT_HC_ACCESS_FROM_HOSPITAL = NO
LABORATORY_INTERNAL_ENGINE_IMPORT_FROM_HOSPITAL = NO
```

Allowed path:

```text
Hospital Product Service
  -> Public Laboratory Contract
  -> Laboratory Engine / Domain Service
  -> Existing Repository / Persistence
```

The Hospital implementation does not import Laboratory repository, private
Laboratory engine implementation, persistence adapter, or direct `hc_*` tables.

## Out Of Scope Preserved

```makefile
H9_TEMPORAL_ALIGNMENT = NOT_PROVEN
H11_AUDIT_RUNTIME = NOT_PROVEN

IMAGING = NOT_OPENED
NURSING = NOT_OPENED
DISCHARGE = NOT_OPENED
BILLING_FINANCE = NOT_OPENED
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN

HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
```

Known H9 gap remains unchanged:

```text
H9 Temporal subscriber = hos.lab.result_finalized.v1
Laboratory publisher   = ResultVerified
```

## Verification Results

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-laboratory-workflow-result-minimal-runtime.test.ts --runInBand
= PASS (5/5)

npx jest src/platform/healthcare/contracts/__tests__/laboratory-order-bootstrap-public-semantics.test.ts --runInBand
= PASS (5/5)

npx jest src/products/bella-hospital/__tests__/hospital-laboratory-workflow-result-semantics-trace.test.ts --runInBand
= PASS (7/7)

npx jest src/platform/healthcare/__tests__/service-locator-laboratory-wiring.test.ts --runInBand
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
HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME = PASS

CLINICAL_ORDER_TO_LAB_ORDER_RUNTIME = PROVEN
LAB_WORKFLOW_RUNTIME = PROVEN_FOR_MINIMAL_GO_LIVE_CHAIN_SCOPE
LAB_RESULT_RUNTIME = PROVEN_FOR_MINIMAL_GO_LIVE_CHAIN_SCOPE
LAB_RESULT_VERIFICATION_RUNTIME = PROVEN_FOR_MINIMAL_GO_LIVE_CHAIN_SCOPE

H9_TEMPORAL_ALIGNMENT = NOT_PROVEN
H11_AUDIT_RUNTIME = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = HOSPITAL_IMAGING_CONTRACT_TRACE
```

## Stop

Do not continue to H9 Temporal, H11 Audit, Imaging, Nursing, Discharge,
Billing/Finance, Real DB/RLS, Browser E2E, or production configuration in this
slice.
