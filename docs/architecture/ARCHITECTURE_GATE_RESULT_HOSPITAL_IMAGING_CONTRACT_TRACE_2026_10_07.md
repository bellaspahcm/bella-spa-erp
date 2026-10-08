# ARCHITECTURE GATE RESULT - HOSPITAL IMAGING CONTRACT TRACE - 2026-10-07

## Status

```text
HOSPITAL_IMAGING_CONTRACT_TRACE = PASS
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
```

## Scope

```text
TRACE ONLY
NO IMAGING RUNTIME
NO NURSING
NO DISCHARGE
NO H9 TEMPORAL
NO H11 AUDIT
NO BILLING / FINANCE
NO REAL DB / RLS
NO BROWSER E2E
```

## Canonical Context

```text
HOSPITAL_FOUNDATION = SEALED
HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN_FOR_FOUNDATION_GO_LIVE_CHAIN_SCOPE
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE
HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME = PROVEN_FOR_GO_LIVE_CHAIN_SCOPE
HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME = PASS
```

## Business Chain Position

```text
Clinical Orders
    ↓
Laboratory = PROVEN_FOR_MINIMAL_GO_LIVE_CHAIN_SCOPE
    ↓
Imaging = REQUIRED_FOR_GO_LIVE
    ↓
Nursing / Discharge / H9 / H11 / Billing
```

## Trace Findings

### Order Engine Imaging Support

```text
ORDER_ENGINE_IMAGING_ORDER_TYPE = PRESENT
ORDER_ENGINE_IMAGING_DETAILS = PRESENT
```

Evidence:

```text
src/platform/healthcare/contracts/order-engine.contract.ts
  OrderType includes IMAGING
  ImagingOrderDetails includes modalityCode, bodyRegion, withContrast, clinicalIndication
  CreateOrderRequest accepts ImagingOrderDetails
```

Classification:

```text
ORDER_TO_IMAGING_CONTRACT = PARTIAL
```

Reason:

```text
The public Order Engine can create a clinical order of type IMAGING,
but it does not expose Imaging/RIS workflow, PACS study, report, or
verification semantics.
```

### Public Imaging / RIS Contract

```text
PUBLIC_HEALTHCARE_IMAGING_CONTRACT = MISSING
PUBLIC_HEALTHCARE_RADIOLOGY_CONTRACT = MISSING
PUBLIC_HEALTHCARE_RIS_CONTRACT = MISSING
```

Evidence checked:

```text
src/platform/healthcare/contracts/index.ts
src/platform/healthcare/service-locator.ts
src/platform/healthcare/contracts/imaging-engine.contract.ts
src/platform/healthcare/contracts/radiology-engine.contract.ts
src/platform/healthcare/contracts/ris-engine.contract.ts
src/platform/healthcare/engines/imaging-engine
src/platform/healthcare/engines/radiology-engine
src/platform/healthcare/engines/ris-engine
```

Result:

```text
No public Imaging/Radiology/RIS engine contract found.
No service-locator key found for imaging-engine, radiology-engine, or ris-engine.
No registered contract metadata found for Imaging/Radiology/RIS.
```

### Existing RIS Implementation

```text
EXISTING_RIS_RUNTIME = LEGACY_DIRECT_PERSISTENCE
PUBLIC_CONTRACT_PROOF = NO
```

Evidence:

```text
src/services/healthcare/lis-ris-actions.ts
  createImagingOrderAction
  updateImagingReportAction
  direct hc_clinical_orders insert
  direct hc_imaging_orders insert/update

src/services/healthcare/healthcare-actions.ts
  createImagingOrderAction
  verifyImagingResultAction
  direct hc_imaging_orders access
```

Classification:

```text
LEGACY_MOCK_ONLY = [
  "src/services/healthcare/lis-ris-actions.ts",
  "src/services/healthcare/healthcare-actions.ts"
]
```

### Hospital UI Surface

```text
HOSPITAL_IMAGING_UI_SURFACE = LEGACY_MOCK_ONLY
HOSPITAL_IMAGING_RUNTIME = NOT_PROVEN
```

Evidence:

```text
src/app/dashboard/hospital/ancillary/page.tsx
  imports services/healthcare/lis-ris-actions
  uses MOCK_IMAGING_ORDERS
  calls createImagingOrderAction / updateImagingReportAction
```

This is not proof of a Hospital product runtime through a public Healthcare contract.

### Hospital Product Boundary

```text
HOSPITAL_DIRECT_IMAGING_REPOSITORY_ACCESS = NO
HOSPITAL_DIRECT_HC_IMAGING_ACCESS = NO
HOSPITAL_PUBLIC_IMAGING_CONTRACT_CONSUMER = NOT_STARTED
```

Evidence:

```text
src/products/bella-hospital/services
  does not import imaging-engine, radiology-engine, ris-engine
  does not import services/healthcare/lis-ris-actions
  does not access hc_imaging_orders directly
```

### Downstream Evidence

```text
DOWNSTREAM_DISCHARGE = NOT_PROVEN
DOWNSTREAM_AUDIT_EVIDENCE = NOT_PROVEN
DOWNSTREAM_TEMPORAL = NOT_PROVEN
DOWNSTREAM_BILLING = NOT_PROVEN
```

Evidence:

```text
Finance adapter recognizes IMAGING as a service type.
Temporal contract has LAB_RESULTS but no Imaging/Radiology result timeline category.
```

Classification:

```text
CONTRACT_PRESENT_FOR_BILLING_CATEGORY = PARTIAL
RUNTIME_PRESENT_FOR_BILLING = NOT_PROVEN
TEMPORAL_ALIGNMENT = NOT_PROVEN
```

## Classification

```text
IMAGING = REQUIRED_FOR_HOSPITAL_GO_LIVE
ORDER_ENGINE_IMAGING_SUPPORT = PRESENT
PUBLIC_HEALTHCARE_IMAGING_CONTRACT = MISSING
IMAGING_RUNTIME = NOT_PROVEN
HOSPITAL_IMAGING_CONSUMER = NOT_STARTED
LEGACY_DIRECT_PERSISTENCE = PRESENT
UI_MOCK_SURFACE = PRESENT
NEW_PUBLIC_CONTRACT = NOT_CREATED_IN_THIS_TRACE
NEW_PUBLIC_SEMANTIC = NOT_CREATED_IN_THIS_TRACE
```

## Root Cause

```text
PUBLIC_IMAGING_RIS_CONTRACT = MISSING
```

Hospital cannot prove the Imaging branch of the Go-Live chain through the required Product → Public Contract → Healthcare Kernel boundary. The existing RIS actions prove legacy/direct persistence behavior, not a reusable public Imaging/RIS contract.

## Required Next Capability

```text
NEXT_REQUIRED_CAPABILITY = IMAGING_PUBLIC_CONTRACT_MINIMAL_SEMANTICS
```

Minimum future scope should define only the public semantics needed to connect:

```text
Clinical Order / orderId
    ↓
Imaging Order / imagingOrderId
    ↓
Study / PACS metadata
    ↓
Radiology report
    ↓
Verified result
```

Required linkage:

```text
tenantId
patientId
encounterId
orderId
imagingOrderId
```

Do not implement runtime before this public contract semantic exists.

## Verification Plan

```text
focused Hospital Imaging contract trace test
npm run typecheck:changed
npm run healthcare:guard
changed-file no-any/no-suppression scan
git diff --check
```

## Verification Results

```text
focused Hospital Imaging contract trace test = PASS
  npx jest src/products/bella-hospital/__tests__/hospital-imaging-contract-trace.test.ts --runInBand
  Test Suites: 1 passed
  Tests: 6 passed

npm run typecheck:changed = PASS
  TypeScript scope "full" passed with zero diagnostics.

npm run healthcare:guard = PASS
  ARCHITECTURE GUARD PASSED: ZERO VIOLATIONS DETECTED.

changed-file no-any/no-suppression scan = PASS_FOR_CURRENT_SLICE
  src/products/bella-hospital/__tests__/hospital-imaging-contract-trace.test.ts = CLEAN
  Broader changed-file scan still sees pre-existing product-resolver baseline wording outside this slice.

git diff --check = PASS
  CRLF warnings only for previously changed files.
```

## Canonical Output

```text
HOSPITAL_IMAGING_CONTRACT_TRACE = PASS

ORDER_ENGINE_IMAGING_CONTRACT = PARTIAL
PUBLIC_HEALTHCARE_IMAGING_CONTRACT = MISSING
IMAGING_RUNTIME = NOT_PROVEN
HOSPITAL_IMAGING_CONSUMER = NOT_STARTED
LEGACY_MOCK_ONLY = PRESENT

HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_CAPABILITY = IMAGING_PUBLIC_CONTRACT_MINIMAL_SEMANTICS
```
