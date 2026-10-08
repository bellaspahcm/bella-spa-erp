# ARCHITECTURE GATE RESULT: HOSPITAL CDS GATE MINIMAL RUNTIME WIRING PROOF

Date: 2026-10-07
Scope: Minimal runtime wiring proof for Hospital Medication Order -> CDS Gate
Status: PASS_FOR_MINIMAL_WIRING_IMPLEMENTATION

## 1. Bella OS / Product Development Process Gate

```text
TRUTH = Medication orders require CDS Gate at OrderEngineContract.createOrder
SOURCE_OF_TRUTH = CDS Gate contract trace + OrderEngineService constructor and createOrder path
CANONICAL_CONTRACT = OrderEngineContract + IDecisionContract / CDS Engine contract
OWNERSHIP = Healthcare composition root wires Healthcare engines
BOUNDARY = Product still consumes getHealthcareService('order-engine') / public OrderEngineContract
CHANGE_AUTHORITY = Minimal Healthcare service-locator composition wiring + focused tests
MINIMAL_IMPLEMENTATION = Inject existing CdsEngineService as IDecisionContract into OrderEngineService
```

Decision:

```text
ARCHITECTURE_GATE = PASS
IMPLEMENTATION_ALLOWED = YES_FOR_SERVICE_LOCATOR_WIRING_ONLY
```

## 2. Product Manifest

Product: Bella Hospital

Capability in scope:

```text
Medication Order -> Order Engine -> CDS / Decision Contract runtime wiring proof
```

Capability out of scope:

```text
New CDS contract
New CDS engine
Order Engine business logic changes
CDS Engine business logic changes
Nursing
Pharmacy / MAR
Lab / Imaging
Billing / Payment / Ledger / Reconciliation
Finance
UI
DB/schema migration
Real DB/RLS
Browser E2E
```

## 3. Ownership Map

| Capability | Owner | Change Authority |
| --- | --- | --- |
| Clinical Orders semantics | Healthcare Order Engine | No behavior change |
| CDS decisions | Healthcare CDS Engine / Decision contract | No behavior change |
| Runtime dependency composition | Healthcare service locator | Minimal wiring authorized |
| Hospital Clinical Orders runtime | Bella Hospital Product Vertical | No change required |

## 4. Contract Dependency Map

Target runtime path:

```text
Bella Hospital Clinical Orders Product Service
  -> public OrderEngineContract
  -> getHealthcareService('order-engine')
  -> OrderEngineService(supabase, IDecisionContract)
  -> CdsEngineService.evaluate(...)
```

Product rule preserved:

```text
Hospital does not import Order Engine internals.
Hospital does not import CDS Engine internals.
Hospital does not direct-query hc_* tables.
```

## 5. Change Authority

Authorized:

```text
src/platform/healthcare/service-locator.ts
focused service-locator wiring tests
architecture evidence artifact
```

Not authorized:

```text
src/platform/healthcare/engines/order-engine/*
src/platform/healthcare/engines/cds-engine/*
src/platform/healthcare/contracts/*
src/products/bella-hospital/services/hospital-clinical-orders.service.ts
UI
DB migrations
downstream care runtime
```

## 6. UI -> Contract Reconciliation

No UI work is authorized or needed.

Existing Hospital consumers continue to resolve Order Engine through public service locator and `OrderEngineContract`.

## 7. Additive Migration Plan

```text
DB_SCHEMA_CHANGE_REQUIRED = NO
MIGRATION_PLAN = NOT_APPLICABLE
```

## 8. Verification Gates Plan

Focused gates for this slice:

```text
Gate 1 Architecture Compliance = healthcare guard
Gate 2 Contract Boundary = Hospital keeps public OrderEngineContract path
Gate 3 Tenant Isolation = unchanged, delegated to existing engines
Gate 4 Authorization = unchanged, delegated to Hospital Clinical Orders service
Gate 5 Migration Safety = no migration
Gate 6 Event-After-Persistence = unchanged Order Engine behavior
Gate 7 Clinical Safety Routing = medication order receives CDS/Decision dependency
Gate 8 Temporal Provenance = not in this slice
Gate 9 Rule Governance = not in this slice
Gate 10 Audit/Evidence Integrity = not in this slice
Gate 11 Kernel Regression = healthcare guard + focused tests
```

Required verification:

```text
focused Healthcare service-locator CDS wiring tests
Hospital Clinical Orders runtime tests
Hospital foundation boundary tests
healthcare guard
typecheck changed
changed-file no-any
git diff --check
```

## Final Gate

```text
ARCHITECTURE_GATE_RESULT = PASS
IMPLEMENTATION_ALLOWED = YES_FOR_HOSPITAL_CDS_GATE_MINIMAL_RUNTIME_WIRING_PROOF_ONLY
```

## Implementation Result

```text
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE

ROOT_CAUSE = DEFAULT_ORDER_ENGINE_PATH_DID_NOT_INJECT_IDECISIONCONTRACT
MINIMAL_FIX = SERVICE_LOCATOR_ORDER_ENGINE_COMPOSITION_INJECTS_EXISTING_CDS_ENGINE

PUBLIC_CONTRACT_REUSED = OrderEngineContract + IDecisionContract
NEW_PUBLIC_CONTRACT_CREATED = NO
NEW_CDS_ENGINE_CREATED = NO
ORDER_ENGINE_BUSINESS_LOGIC_MODIFIED = NO
CDS_ENGINE_BUSINESS_LOGIC_MODIFIED = NO
DIRECT_HC_ACCESS_INTRODUCED = NO
NON_MEDICATION_ORDER_CDS_BEHAVIOR_CHANGED = NO
```

Runtime path proven by this slice:

```text
Bella Hospital Clinical Orders Product Service
  -> public OrderEngineContract
  -> getHealthcareService('order-engine')
  -> OrderEngineService(supabase, CdsEngineService)
  -> IDecisionContract.evaluate(...)
```

Changed files for this slice:

```text
src/platform/healthcare/service-locator.ts
src/platform/healthcare/__tests__/service-locator-cds-wiring.test.ts
docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_CDS_GATE_RUNTIME_WIRING_2026_10_07.md
```

Behavior proven:

```text
Medication order resolved through getHealthcareService('order-engine') receives a CDS/Decision dependency.
Medication order path calls decisionContract.evaluate(...).
The normal service-locator path no longer produces CDS_CONTRACT_MISSING solely because the dependency is absent.
Non-medication LAB order path does not call CDS evaluation.
If cds-engine is already cached, order-engine reuses that cached CDS service.
```

## Verification Evidence

Executed:

```text
npx jest src/platform/healthcare/__tests__/service-locator-cds-wiring.test.ts --runInBand
PASS: 1 suite, 3 tests

npx jest src/platform/healthcare/__tests__/service-locator-cds-wiring.test.ts src/products/bella-hospital/services/__tests__/hospital-clinical-orders.service.test.ts src/products/bella-hospital/__tests__/hospital-foundation-contract-boundary.test.ts --runInBand
PASS: 3 suites, 13 tests

npm run typecheck:changed
PASS: TypeScript scope "full" passed with zero diagnostics

npm run healthcare:guard
PASS: ARCHITECTURE GUARD PASSED: ZERO VIOLATIONS DETECTED

changed-file no-any / no suppressions / no direct hc_ scan
PASS

git diff --check
PASS
```

Note: `git diff --check` emitted only the existing line-ending warning for `src/products/bella-hospital/index.ts`; no whitespace error was reported.

## Sealed Canonical Status

```text
HOSPITAL_CDS_GATE_CONTRACT_TRACE = PASS
CDS = REUSE_PUBLIC_CONTRACT
PUBLIC_HEALTHCARE_CDS_CONTRACT = PRESENT

HOSPITAL_CLINICAL_ORDERS_RUNTIME = PROVEN_FOR_FOUNDATION_GO_LIVE_CHAIN_SCOPE
HOSPITAL_ORDERS_TO_CDS_RUNTIME = PROVEN_FOR_MEDICATION_ORDER_SCOPE

CDS_GATE_REQUIRED_FOR_HOSPITAL_GO_LIVE = YES_FOR_MEDICATION_ORDERS
CDS_GATE_REQUIRED_FOR_ALL_ORDER_TYPES = NO

HOSPITAL_CDS_RUNTIME = EXISTING_CONSUMER_PARTIAL
CDS_TO_DOWNSTREAM_CARE = PARTIAL

REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
FINANCE = NOT_PROVEN
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN

NEXT_REQUIRED_ACTION = HOSPITAL_DOWNSTREAM_CARE_DEPENDENCY_TRACE
```

## Stop Condition

This slice stops after proving medication-order CDS wiring. It does not continue into Nursing, Pharmacy/MAR, Lab/Imaging, Billing, Finance, Real DB/RLS, Browser E2E, or production Go-Live.
