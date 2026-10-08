# ARCHITECTURE GATE RESULT: HOSPITAL CDS GATE CONTRACT TRACE

Date: 2026-10-07
Scope: Hospital Go-Live business chain, CDS Gate contract trace only
Mode: Read-only architecture trace

## Canonical Decision

```text
HOSPITAL_CDS_GATE_CONTRACT_TRACE = PASS

CDS = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_CDS_CONTRACT = PRESENT
NEW_PUBLIC_CONTRACT_REQUIRED = NO

CDS_GATE_REQUIRED_FOR_HOSPITAL_GO_LIVE = YES_FOR_MEDICATION_ORDERS
CDS_GATE_REQUIRED_FOR_ALL_ORDER_TYPES = NO

ORDERS_TO_CDS_CONTRACT = PROVEN
HOSPITAL_ORDERS_TO_CDS_RUNTIME = NOT_PROVEN

HOSPITAL_CDS_RUNTIME = EXISTING_CONSUMER_PARTIAL
CDS_TO_DOWNSTREAM_CARE = PARTIAL

NEXT_REQUIRED_ACTION = HOSPITAL_CDS_GATE_MINIMAL_RUNTIME_WIRING_PROOF
```

This trace proves that Bella Hospital should reuse the existing public CDS contracts. It does not prove a Real DB CDS run, Browser E2E, downstream Nursing/MAR/Lab/Imaging semantics, Billing, Finance, or Hospital Go-Live readiness.

## Bella OS / Product Development Process Gate

Status: PASS_FOR_TRACE_ONLY

Truth:

```text
Hospital Go-Live Clinical Orders require a CDS Gate before downstream care.
The existing public Healthcare CDS contracts own CDS semantics.
Medication orders require CDS at createOrder.
Non-medication orders do not require CDS at createOrder by current Order Engine semantics.
```

Canonical contract:

```text
src/platform/healthcare/contracts/cds-engine.contract.ts
```

Change authority:

```text
Read/trace only.
No runtime implementation.
No Order Engine modification.
No CDS Engine modification.
No UI/DB/Real DB/Browser E2E/Finance.
```

## Product Manifest

Product: Bella Hospital

Go-Live chain node:

```text
Clinical Orders / CPOE
  -> CDS Gate
  -> Nursing / Medication-MAR / Lab-Imaging
```

Current slice capability:

```text
CDS Gate contract trace
```

Out of scope:

```text
CDS runtime implementation
Order Engine implementation changes
Clinical Orders runtime changes
Nursing
Pharmacy / MAR
Lab / Imaging
Discharge
Billing / Finance
UI
DB/schema
Real DB/RLS
Browser E2E
```

## Ownership Map

| Capability | Owner | Evidence | Decision |
| --- | --- | --- | --- |
| CDS public API | Healthcare OS CDS Engine | `src/platform/healthcare/contracts/cds-engine.contract.ts` | Reuse |
| Order prescribing safety gate | Healthcare Order Engine via Decision/CDS contract | `src/platform/healthcare/engines/order-engine/order-engine.service.ts` | Present for medication orders |
| Hospital clinical safety alert adapter | Bella Hospital Product Vertical | `src/products/bella-hospital/services/hospital-clinical-alert.service.ts` | Existing consumer, partial |
| Default healthcare service wiring | Healthcare service locator | `src/platform/healthcare/service-locator.ts` | CDS engine present, Order engine CDS wiring not proven |
| Pharmacy dispense safety gate | Healthcare Pharmacy Engine via Decision contract or fallback | `src/platform/healthcare/engines/pharmacy-engine/pharmacy-engine.service.ts` | Downstream partial, not Hospital proven |

## Contract Dependency Map

Canonical paths:

```text
Hospital Clinical Orders
  -> OrderEngineContract.createOrder
  -> Order Engine
  -> IDecisionContract.evaluate
  -> CDS Engine

Hospital Clinical Alert Product Service
  -> CdsEngineContract.generateCdsSummary
  -> CDS Engine
```

Public CDS contract surfaces:

```text
CdsEngineContract
ICdsContract
IDecisionContract
OrderSafetyCheckInputDTO
SafetyEvaluationResultDTO
```

## Evidence

### Public CDS contract

Evidence:

- `src/platform/healthcare/contracts/cds-engine.contract.ts`
- `src/platform/healthcare/contracts/index.ts`

Findings:

- `CdsEngineContract` exposes `checkDrugInteractions`, `checkAllergyContraindications`, `checkProtocolAdherence`, `generateCdsSummary`, `recordAllergy`, and `getPatientAllergies`.
- `ICdsContract` exposes product-facing `evaluateOrderSafety(input: OrderSafetyCheckInputDTO)`.
- `IDecisionContract` exposes `evaluate(...)` for engines that need dependency-inverted clinical decisions.
- `CDS_ENGINE_CONTRACT` is exported through the public Healthcare contracts index and registered in the Healthcare engine contract list.

Decision:

```text
PUBLIC_HEALTHCARE_CDS_CONTRACT = PRESENT
CDS = REUSE_PUBLIC_CONTRACT
NEW_PUBLIC_CONTRACT_REQUIRED = NO
```

### Clinical Orders -> CDS boundary

Evidence:

- `src/platform/healthcare/contracts/order-engine.contract.ts`
- `src/platform/healthcare/engines/order-engine/order-engine.service.ts`
- `src/platform/healthcare/engines/order-engine/domain/clinical-order.entity.ts`

Findings:

- `OrderEngineContract.createOrder` documents CDS at prescribing gate.
- The Order Engine implementation calls `IDecisionContract.evaluate(...)` only when `request.orderType === 'MEDICATION'`.
- For medication orders, missing `patientId` fails before CDS.
- For medication orders, missing `IDecisionContract` returns `CDS_CONTRACT_MISSING`.
- Domain entity confirms `requiresCdsCheck()` is true only for `MEDICATION`.
- Non-medication orders do not go through CDS at createOrder by current semantics.

Decision:

```text
ORDERS_TO_CDS_CONTRACT = PROVEN
CDS_GATE_REQUIRED_FOR_HOSPITAL_GO_LIVE = YES_FOR_MEDICATION_ORDERS
CDS_GATE_REQUIRED_FOR_ALL_ORDER_TYPES = NO
```

### Hospital CDS consumer

Evidence:

- `src/products/bella-hospital/services/hospital-clinical-alert.service.ts`
- `src/products/bella-hospital/hooks/use-cds-engine.ts`
- `src/products/bella-hospital/services/__tests__/hospital-services.test.ts`
- `src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts`

Findings:

- Hospital has `HospitalClinicalAlertProductService` consuming `Pick<CdsEngineContract, 'generateCdsSummary'>`.
- Hospital has a UI hook resolving `getHealthcareService<CdsEngineContract>('cds-engine', supabase)`.
- Existing Hospital tests prove mocked CDS contract delegation for safety alert evaluation.
- This is an existing product consumer, but not a Real DB CDS runtime proof and not an Order Engine medication order wiring proof.

Decision:

```text
HOSPITAL_CDS_RUNTIME = EXISTING_CONSUMER_PARTIAL
HOSPITAL_ORDERS_TO_CDS_RUNTIME = NOT_PROVEN
```

### Runtime wiring risk

Evidence:

- `src/platform/healthcare/service-locator.ts`
- `src/platform/healthcare/engines/order-engine/order-engine.service.ts`
- `src/__tests__/phase_c_cds_order.test.ts`

Findings:

- `service-locator.ts` resolves `cds-engine` as `new CdsEngineService(supabase)`.
- `service-locator.ts` resolves `order-engine` as `new OrderEngineService(supabase)` without passing an `IDecisionContract`.
- `OrderEngineService.createOrder` returns `CDS_CONTRACT_MISSING` for medication orders when `decisionContract` is not supplied.
- A separate test path instantiates `OrderEngineService(mockSupabase, cdsEngine)`, proving the intended wiring shape exists in tests, but the default service-locator path is not proven wired.

Decision:

```text
ORDER_ENGINE_CDS_DEPENDENCY = IDecisionContract
DEFAULT_ORDER_ENGINE_CDS_WIRING = NOT_PROVEN
HOSPITAL_ORDERS_TO_CDS_RUNTIME = NOT_PROVEN
NEXT_REQUIRED_ACTION = HOSPITAL_CDS_GATE_MINIMAL_RUNTIME_WIRING_PROOF
```

### CDS downstream care

Evidence:

- `src/platform/healthcare/engines/pharmacy-engine/pharmacy-engine.service.ts`
- `src/platform/healthcare/contracts/temporal-engine.contract.ts`

Findings:

- Pharmacy Engine has a second safety barrier at dispense time through `IDecisionContract.evaluate(...)` when available.
- Pharmacy has fallback direct allergy lookup when decision contract is not injected; this is internal engine behavior, not Hospital product proof.
- Temporal contract can retrieve temporal audit context for CDS decisions.
- No Hospital Go-Live proof exists yet for CDS -> Nursing/MAR/Lab/Imaging.

Decision:

```text
CDS_TO_DOWNSTREAM_CARE = PARTIAL
CDS_TO_PHARMACY_DISPENSE = PARTIAL_ENGINE_EVIDENCE_NOT_HOSPITAL_PROVEN
CDS_TO_NURSING_MAR = NOT_PROVEN
CDS_TO_LAB_IMAGING = NOT_PROVEN
CDS_TO_BILLING_FINANCE = NOT_PROVEN
```

### Legacy / mock / direct access

Findings:

- Hospital product code has contract-first CDS consumers.
- Legacy `src/services/healthcare/*` contains older clinical alert/pharmacy paths and mock CDS contract use.
- Healthcare engine tests directly manipulate `hc_clinical_decisions`, `hc_cds_rules`, and related tables for engine verification; this is not Product Vertical runtime authorization.
- No new direct `hc_*` access was introduced by this trace.

Decision:

```text
LEGACY_CDS_SURFACES = PRESENT
NEW_LEGACY_DEPENDENCY_INTRODUCED = NO
DIRECT_PRODUCT_HC_CDS_ACCESS_REQUIRED = NO
```

## Change Authority

Authorized in this slice:

```text
Trace public CDS contracts.
Trace Order Engine -> CDS boundary.
Trace Hospital CDS consumers.
Trace downstream evidence.
Create architecture evidence artifact.
Run lightweight verification.
```

Not authorized:

```text
Implement CDS runtime.
Modify Order Engine.
Modify CDS Engine.
Modify service locator.
Modify Hospital Clinical Orders runtime.
Implement Nursing/MAR/Lab/Imaging/Billing/Finance.
Modify UI.
Modify DB/schema/migrations.
Run Real DB/RLS or Browser E2E as proof.
```

## UI -> Contract Reconciliation

No UI change was authorized or performed.

Existing `useCdsEngine` is a public-contract UI hook, but UI hook presence is not Go-Live runtime proof.

## Additive Migration Plan

```text
DB_SCHEMA_CHANGE_REQUIRED = NO_FOR_TRACE
ADDITIVE_MIGRATION_PLAN = NOT_APPLICABLE
```

## Verification

Executed:

```text
Manual source trace = PASS
Architecture evidence artifact = CREATED
Runtime implementation = NOT_EXECUTED_BY_SCOPE
Real DB E2E = NOT_EXECUTED_BY_SCOPE
Browser E2E = NOT_EXECUTED_BY_SCOPE
Finance E2E = NOT_EXECUTED_BY_SCOPE
```

Required after artifact creation:

```text
git diff --check
```

## Minimal Next Slice

Next required action:

```text
HOSPITAL_CDS_GATE_MINIMAL_RUNTIME_WIRING_PROOF
```

Minimum acceptance for the next slice:

```text
Medication order submitted through Hospital Clinical Orders reaches OrderEngineContract.createOrder.
Order Engine has a valid IDecisionContract/CDS dependency for medication orders.
CDS PASS/WARN/BLOCK/ABSOLUTE_BLOCK outcomes are surfaced through Hospital runtime without bypass.
Non-medication orders do not falsely require CDS.
No Order Engine or CDS Engine internals are modified unless a specific root cause proves unavoidable.
No Nursing/Pharmacy/Lab/Billing runtime is opened in the same slice.
```

If the default runtime wiring cannot be proven without platform mutation, the next slice must report `BLOCKED_FOR_CDS_WIRING_AUTHORITY` rather than modify Platform/Core silently.

## Final Canonical Status

```text
HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN_FOR_FOUNDATION_GO_LIVE_CHAIN_SCOPE

HOSPITAL_CDS_GATE_CONTRACT_TRACE = PASS
CDS = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_CDS_CONTRACT = PRESENT
NEW_PUBLIC_CONTRACT_REQUIRED = NO

ORDERS_TO_CDS_CONTRACT = PROVEN
CDS_GATE_REQUIRED_FOR_HOSPITAL_GO_LIVE = YES_FOR_MEDICATION_ORDERS
CDS_GATE_REQUIRED_FOR_ALL_ORDER_TYPES = NO

HOSPITAL_CDS_RUNTIME = EXISTING_CONSUMER_PARTIAL
HOSPITAL_ORDERS_TO_CDS_RUNTIME = NOT_PROVEN
CDS_TO_DOWNSTREAM_CARE = PARTIAL

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_ACTION = HOSPITAL_CDS_GATE_MINIMAL_RUNTIME_WIRING_PROOF
```

## Stop Condition

This slice stops at CDS Gate contract trace. It does not implement CDS runtime, service-locator wiring, Nursing, Pharmacy/MAR, Lab/Imaging, Billing, Finance, Real DB/RLS, Browser E2E, or production Go-Live.
