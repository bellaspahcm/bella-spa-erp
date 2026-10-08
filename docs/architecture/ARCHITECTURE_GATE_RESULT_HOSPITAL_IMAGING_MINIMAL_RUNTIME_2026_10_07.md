# ARCHITECTURE GATE RESULT - HOSPITAL IMAGING MINIMAL RUNTIME - 2026-10-07

## Status

```text
HOSPITAL_IMAGING_MINIMAL_RUNTIME = PROVEN_FOR_SUPPORTED_GO_LIVE_CHAIN_SCOPE
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
```

## Canonical Prerequisite

```text
IMAGING_PUBLIC_CONTRACT_MINIMAL_SEMANTICS = PASS
PUBLIC_HEALTHCARE_IMAGING_CONTRACT = PRESENT
IMAGING_ORDER_BOOTSTRAP_SEMANTICS = bootstrapImagingOrder
ORDER_TO_IMAGING_ORDER_LINKAGE = SUPPORTED_AT_PUBLIC_CONTRACT_SEMANTIC
PATIENT_LINKAGE = SUPPORTED_AT_PUBLIC_CONTRACT_SEMANTIC
ENCOUNTER_LINKAGE = SUPPORTED_AT_PUBLIC_CONTRACT_SEMANTIC
TENANT_LINKAGE = SUPPORTED_AT_PUBLIC_CONTRACT_SEMANTIC
IDEMPOTENCY_SEMANTICS = PRESENT_AT_BOOTSTRAP_CONTRACT
```

## Root Cause

```text
HOSPITAL_IMAGING_RUNTIME = NOT_STARTED
IMAGING_ENGINE_SERVICE_LOCATOR_WIRING = MISSING
```

Existing RIS code directly accessed `hc_imaging_orders`; that legacy path is not accepted as Hospital runtime proof.

## Minimal Fix

```text
Public IImagingEngine contract
  -> ImagingEngineService
  -> SupabaseImagingRepository
  -> existing hc_imaging_orders persistence

HospitalImagingProductService
  -> HospitalClinicalOrdersProductService
  -> public IImagingEngine
```

No Hospital service imports the Imaging repository or accesses `hc_imaging_orders`.

## Actual Imaging Lifecycle Supported In Source

```text
PENDING
  -> VERIFIED
```

The existing RIS persistence supports `radiologist_report` and `verified_at`. There is no proven Scheduling/Capture/Finalization state machine in this slice.

## Scope

```text
IN_SCOPE:
  - minimal Imaging engine adapter
  - service-locator registration
  - Hospital product runtime service
  - focused runtime and wiring tests

OUT_OF_SCOPE:
  - Nursing
  - Discharge
  - H9 Temporal
  - H11 Audit
  - Billing / Finance
  - Real DB / RLS
  - Browser E2E
  - Production
```

## Verification Results

```text
focused Hospital Imaging minimal runtime test = PASS
  npx jest src/products/bella-hospital/services/__tests__/hospital-imaging-minimal-runtime.test.ts --runInBand
  Test Suites: 1 passed
  Tests: 5 passed

imaging-public-contract-minimal-semantics.test.ts = PASS
  npx jest src/platform/healthcare/contracts/__tests__/imaging-public-contract-minimal-semantics.test.ts --runInBand
  Test Suites: 1 passed
  Tests: 8 passed

hospital-imaging-contract-trace.test.ts = PASS
  npx jest src/products/bella-hospital/__tests__/hospital-imaging-contract-trace.test.ts --runInBand
  Test Suites: 1 passed
  Tests: 6 passed

service-locator-imaging-wiring.test.ts = PASS
  npx jest src/platform/healthcare/__tests__/service-locator-imaging-wiring.test.ts --runInBand
  Test Suites: 1 passed
  Tests: 1 passed

npm run typecheck:changed = PASS
  TypeScript scope "full" passed with zero diagnostics.

npm run healthcare:guard = PASS
  ARCHITECTURE GUARD PASSED: ZERO VIOLATIONS DETECTED.

changed-file no-any/no-suppression scan = PASS_FOR_CURRENT_SLICE

git diff --check = PASS
  CRLF warnings only for previously changed files.
```

## Canonical Output Target

```text
HOSPITAL_IMAGING_MINIMAL_RUNTIME = PROVEN_FOR_SUPPORTED_GO_LIVE_CHAIN_SCOPE

CLINICAL_ORDER_TO_IMAGING_ORDER_RUNTIME = PROVEN
IMAGING_WORKFLOW_RUNTIME = PROVEN_FOR_SUPPORTED_SCOPE
IMAGING_RESULT_RUNTIME = PROVEN
IMAGING_FINALIZATION_RUNTIME = VERIFIED_RESULT_ONLY

ORDER_TO_IMAGING_ORDER_LINKAGE = PROVEN
PATIENT_LINKAGE = PROVEN_AT_PRODUCT_CONTRACT_RUNTIME
ENCOUNTER_LINKAGE = PROVEN
TENANT_LINKAGE = PROVEN

IDEMPOTENCY_RUNTIME = PROVEN

PUBLIC_IMAGING_CONTRACT_REUSED = YES
HOSPITAL_DIRECT_REPOSITORY_ACCESS = NO
DIRECT_HC_IMAGING_ORDERS_ACCESS = NO

NEW_PUBLIC_CONTRACT = NO
NEW_PUBLIC_SEMANTIC = NO

EVENT_SEMANTICS = NO_NEW_EVENT
H9_TEMPORAL_ALIGNMENT = NOT_PROVEN

HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = NURSING_CONTRACT_TRACE
```
