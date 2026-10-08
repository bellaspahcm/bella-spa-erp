# ARCHITECTURE GATE RESULT: HOSPITAL CLINICAL ORDERS CONTRACT TRACE

Date: 2026-10-07
Scope: Hospital Go-Live business chain, Clinical Orders / CPOE contract trace only
Mode: Read-only architecture trace

## Canonical Decision

```text
HOSPITAL_CLINICAL_ORDERS_CONTRACT_TRACE = PASS

CLINICAL_ORDERS = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_CLINICAL_ORDERS_CONTRACT = PRESENT
NEW_PUBLIC_CONTRACT_REQUIRED = NO

HOSPITAL_CLINICAL_ORDERS_RUNTIME = NOT_STARTED

ENCOUNTER_TO_ORDERS_CONTRACT = PROVEN_AT_HEALTHCARE_CONTRACT_ENGINE_BOUNDARY
HOSPITAL_ENCOUNTER_TO_ORDERS_RUNTIME = NOT_PROVEN

ORDERS_TO_CDS_CONTRACT = PROVEN_AT_CONTRACT_INVARIANT
HOSPITAL_ORDERS_TO_CDS_RUNTIME = NOT_PROVEN

ORDERS_TO_DOWNSTREAM_CARE = PARTIAL_CONTRACT_EVENTS_PRESENT
HOSPITAL_ORDERS_TO_DOWNSTREAM_CARE_RUNTIME = NOT_PROVEN

NEXT_REQUIRED_ACTION = HOSPITAL_CLINICAL_ORDERS_MINIMAL_RUNTIME
```

This trace proves that Bella Hospital should consume Clinical Orders through the existing public Healthcare Order Engine contract. It does not prove Hospital runtime behavior, Real DB behavior, Browser E2E behavior, downstream care semantics, Billing, Finance, or Go-Live readiness.

## Bella OS / Product Development Process Gate

Status: PASS_FOR_TRACE_ONLY

The requested slice authorizes only a read-only contract trace for Hospital Clinical Orders / CPOE. It does not authorize runtime implementation, UI changes, schema changes, migrations, kernel changes, or downstream capability implementation.

Healthcare Kernel H1-H12 remains frozen. No kernel artifact was modified. No new H13 or new Healthcare core engine was created. No Product Vertical direct `hc_*` access was introduced.

## Product Manifest

Product: Bella Hospital

Current Go-Live chain:

```text
Patient/MPI
  -> Admission
  -> Encounter
  -> Bed Assignment / Transfer
  -> Clinical Orders / CPOE
  -> CDS Gate
  -> Nursing / Medication-MAR / Lab-Imaging
  -> Discharge
  -> Bed Release
  -> H9 Temporal + H11 Audit Evidence
  -> Billing / Payment / Ledger / Reconciliation
```

Current slice capability:

```text
Clinical Orders / CPOE
```

Out of scope for this slice:

```text
CDS runtime implementation
Nursing runtime
Medication / MAR runtime
Pharmacy runtime
Lab / Imaging runtime
Billing / Finance runtime
Hospital UI
Hospital DB/schema
Real DB E2E
Browser E2E
```

## Ownership Map

| Capability | Owner | Evidence | Decision |
| --- | --- | --- | --- |
| Clinical Orders / CPOE public API | Healthcare OS Order Engine public contract | `src/platform/healthcare/contracts/order-engine.contract.ts` | Reuse |
| Contract export boundary | Healthcare public contracts index | `src/platform/healthcare/contracts/index.ts` | Present |
| Order runtime implementation | Healthcare OS Order Engine | `src/platform/healthcare/engines/order-engine/order-engine.service.ts`, `src/platform/healthcare/engines/order-engine/services/clinical-order.service.ts` | Existing implementation |
| Encounter eligibility for orders | Healthcare Order Engine internal encounter reader boundary | `src/platform/healthcare/engines/order-engine/contracts/encounter-reader.interface.ts` | Engine boundary present |
| Hospital product runtime | Bella Hospital Product Vertical | No sealed Hospital clinical orders runtime service found | Not started |
| CDS gate | Healthcare CDS/Decision contract boundary | `src/platform/healthcare/contracts/order-engine.contract.ts`, `src/platform/healthcare/contracts/cds-engine.contract.ts` | Contract invariant present |
| Downstream care | Healthcare event subscribers and future product runtime slices | Pharmacy/Lab subscribers exist, semantics not proven for Hospital | Partial, not proven |

## Contract Dependency Map

Canonical direction:

```text
Bella Hospital
  -> Healthcare public OrderEngineContract
  -> Healthcare Order Engine
  -> Healthcare Encounter validation boundary
  -> Healthcare CDS / Decision boundary
  -> Healthcare events for downstream consumers
```

Required Product rule:

```text
Hospital Clinical Orders runtime MUST consume OrderEngineContract.
Hospital Clinical Orders runtime MUST NOT direct-query hc_clinical_orders.
Hospital Clinical Orders runtime MUST NOT bypass Encounter, CDS, event, or tenant boundaries.
```

## Evidence

### Public Clinical Orders contract

Evidence:

- `src/platform/healthcare/contracts/order-engine.contract.ts`
- `src/platform/healthcare/contracts/index.ts`

Findings:

- `OrderEngineContract` exists and exposes `createOrder`, `validateOrder`, `approveOrder`, `discontinueOrder`, `getActiveOrders`, `overrideCdsWarning`, and `healthCheck`.
- `CreateOrderRequest` requires `requestId`, `tenantId`, `encounterId`, `orderType`, `priority`, `orderedBy`, and `orderDetails`.
- `OrderType` covers `MEDICATION`, `LAB`, `IMAGING`, `PROCEDURE`, `DIET`, and `NURSING`.
- `order-engine.contract` is exported from the public Healthcare contracts index.
- `ORDER_ENGINE_CONTRACT` is included in the Healthcare engine contract registry.

Decision:

```text
PUBLIC_HEALTHCARE_CLINICAL_ORDERS_CONTRACT = PRESENT
CLINICAL_ORDERS = REUSE_PUBLIC_CONTRACT
NEW_PUBLIC_CONTRACT_REQUIRED = NO
```

### Existing runtime implementation

Evidence:

- `src/platform/healthcare/engines/order-engine/order-engine.service.ts`
- `src/platform/healthcare/engines/order-engine/services/clinical-order.service.ts`
- `src/platform/healthcare/engines/order-engine/order-engine.factory.ts`
- `src/platform/healthcare/engines/order-engine/order-engine.registration.ts`

Findings:

- Healthcare Order Engine implementation exists.
- Engine-level Clinical Order service validates encounter eligibility, patient-to-encounter ownership, persistence, and event-after-persistence.
- This is Healthcare Kernel/engine runtime, not Hospital Product runtime.

Decision:

```text
HEALTHCARE_CLINICAL_ORDERS_RUNTIME = PRESENT
HOSPITAL_CLINICAL_ORDERS_RUNTIME = NOT_STARTED
```

### Hospital consumer trace

Evidence:

- `src/products/bella-hospital/hooks/use-order-engine.ts`
- Legacy healthcare services under `src/services/healthcare/*`

Findings:

- Hospital has a hook that resolves `getHealthcareService<OrderEngineContract>('order-engine', supabase)`.
- This is a public-contract consumer, but it is not a sealed Hospital Go-Live runtime service.
- Legacy healthcare services still contain direct `hc_clinical_orders` access. Existing legacy direct access is evidence of old surfaces, not authorization for new Hospital runtime.
- No new direct `hc_*` access was introduced in this slice.

Decision:

```text
HOSPITAL_ORDER_CONSUMER = UI_HOOK_PRESENT
HOSPITAL_CLINICAL_ORDERS_RUNTIME = NOT_STARTED
LEGACY_DIRECT_HC_ACCESS = EXISTING_LEGACY_ONLY
NEW_LEGACY_DEPENDENCY_INTRODUCED = NO
```

### Encounter -> Orders boundary

Evidence:

- `src/platform/healthcare/contracts/order-engine.contract.ts`
- `src/platform/healthcare/engines/order-engine/services/clinical-order.service.ts`
- `src/platform/healthcare/engines/order-engine/contracts/encounter-reader.interface.ts`
- `src/platform/healthcare/engines/order-engine/repositories/supabase-encounter-reader.ts`

Findings:

- Public `CreateOrderRequest` requires `encounterId`.
- Order Engine service validates that the encounter exists, belongs to the tenant, permits order creation, and matches the patient.
- The engine internal reader prevents the Order service from duplicating Encounter business logic.
- Hospital has not yet proven an end-to-end Hospital runtime path from Encounter to Order.

Decision:

```text
ENCOUNTER_TO_ORDERS_CONTRACT = PROVEN_AT_HEALTHCARE_CONTRACT_ENGINE_BOUNDARY
HOSPITAL_ENCOUNTER_TO_ORDERS_RUNTIME = NOT_PROVEN
```

### Orders -> CDS boundary

Evidence:

- `src/platform/healthcare/contracts/order-engine.contract.ts`
- `src/platform/healthcare/contracts/cds-engine.contract.ts`
- `src/platform/healthcare/engines/order-engine/order-engine.service.ts`

Findings:

- The Order contract documents CDS as a mandatory gate at `createOrder`.
- Medication orders require patient context for CDS checks.
- Order Engine implementation uses a decision/CDS dependency for medication order validation and can reject/block orders.
- Hospital has not yet proven this gate through Hospital runtime.

Decision:

```text
ORDERS_TO_CDS_CONTRACT = PROVEN_AT_CONTRACT_INVARIANT
HOSPITAL_ORDERS_TO_CDS_RUNTIME = NOT_PROVEN
```

### Orders -> downstream care

Evidence:

- `src/platform/healthcare/contracts/order-engine.contract.ts`
- `src/platform/healthcare/engines/pharmacy-engine/events/order-approved-subscriber.ts`
- `src/platform/healthcare/engines/laboratory-engine/events/order-approved-subscriber.ts`

Findings:

- Contract metadata declares Order event subscribers for pharmacy, laboratory, billing, notification, analytics, and encounter workflows.
- Pharmacy has an `OrderApproved` subscriber that filters `MEDICATION` and bootstraps prescription workflow.
- Laboratory has an `OrderApproved` subscriber, but the trace found a potential order-type semantic mismatch: the public Order contract uses `LAB`, while the lab subscriber filters `laboratory`.
- Imaging, Billing, Nursing, and MAR downstream runtime are not proven by this trace.

Decision:

```text
ORDERS_TO_DOWNSTREAM_CARE = PARTIAL_CONTRACT_EVENTS_PRESENT
ORDER_TO_PHARMACY = CONTRACT_EVENT_AND_SUBSCRIBER_PRESENT_NOT_HOSPITAL_PROVEN
ORDER_TO_LAB = NOT_PROVEN_POTENTIAL_ORDER_TYPE_SEMANTIC_MISMATCH
ORDER_TO_IMAGING = NOT_PROVEN
ORDER_TO_BILLING = NOT_PROVEN
ORDER_TO_NURSING_MAR = NOT_PROVEN
```

## Change Authority

Authorized in this slice:

```text
Read/trace Healthcare public contracts
Read/trace Healthcare Order implementation
Read/trace Hospital existing consumers
Write architecture evidence artifact
Run lightweight verification
```

Not authorized in this slice:

```text
Modify Healthcare Kernel H1-H12
Create new Healthcare contract
Modify Order Engine implementation
Implement Hospital Clinical Orders runtime
Modify Hospital UI
Modify DB/schema/migrations
Implement CDS/Nursing/Pharmacy/MAR/Lab/Imaging/Billing/Finance
Run Real DB or Browser E2E as proof
Declare Go-Live business chain proven
```

## UI -> Contract Reconciliation

No UI change was authorized or performed.

Existing Hospital UI/hook evidence is not enough to prove Hospital Clinical Orders runtime. The next runtime slice must map Hospital use cases to `OrderEngineContract` explicitly instead of depending on legacy direct `hc_*` service paths.

## Additive Migration Plan

No migration is authorized or indicated by this trace.

```text
DB_SCHEMA_CHANGE_REQUIRED = NO_FOR_TRACE
ADDITIVE_MIGRATION_PLAN = NOT_APPLICABLE
```

## Verification Plan And Result

Executed verification:

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
HOSPITAL_CLINICAL_ORDERS_MINIMAL_RUNTIME
```

Minimum runtime acceptance for the next slice:

```text
Hospital runtime calls OrderEngineContract.
Hospital runtime does not direct-query hc_clinical_orders.
Hospital maps Patient/MPI + Encounter context into CreateOrderRequest.
Hospital preserves tenant and authorization boundaries.
Hospital proves create order behavior for foundation/go-live scope with focused tests.
Hospital does not implement downstream Nursing/Pharmacy/Lab/Billing in the same slice.
```

Do not proceed to CDS runtime, Nursing, Pharmacy/MAR, Lab/Imaging, Billing, Finance, Real DB, or Browser E2E until Hospital Clinical Orders runtime is proven or explicitly blocked.

## Final Canonical Status

```text
HOSPITAL_GO_LIVE_FULL_BUSINESS_CHAIN_TRACE = PASS
NEXT_REQUIRED_CAPABILITY = HOSPITAL_CLINICAL_ORDERS_CONTRACT_TRACE

HOSPITAL_CLINICAL_ORDERS_CONTRACT_TRACE = PASS
CLINICAL_ORDERS = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_CLINICAL_ORDERS_CONTRACT = PRESENT
NEW_PUBLIC_CONTRACT_REQUIRED = NO

HOSPITAL_CLINICAL_ORDERS_RUNTIME = NOT_STARTED

ENCOUNTER_TO_ORDERS_CONTRACT = PROVEN_AT_HEALTHCARE_CONTRACT_ENGINE_BOUNDARY
HOSPITAL_ENCOUNTER_TO_ORDERS_RUNTIME = NOT_PROVEN

ORDERS_TO_CDS_CONTRACT = PROVEN_AT_CONTRACT_INVARIANT
HOSPITAL_ORDERS_TO_CDS_RUNTIME = NOT_PROVEN

ORDERS_TO_DOWNSTREAM_CARE = PARTIAL_CONTRACT_EVENTS_PRESENT
HOSPITAL_ORDERS_TO_DOWNSTREAM_CARE_RUNTIME = NOT_PROVEN

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_ACTION = HOSPITAL_CLINICAL_ORDERS_MINIMAL_RUNTIME
```

## Stop Condition

This slice stops at Clinical Orders contract trace. No runtime, UI, DB, CDS, Nursing, Pharmacy, Lab, Imaging, Billing, Finance, Real DB, or Browser E2E work is included.
