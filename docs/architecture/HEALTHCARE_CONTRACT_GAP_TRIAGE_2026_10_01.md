# Healthcare Contract Gap Triage - 2026-10-01

## Status

HOLD / GOVERNANCE REQUIRED

## Scope

Investigate the 37 Healthcare residual scanner violations from the broader type-safety boundary without modifying Healthcare runtime, Healthcare kernel, product services, or tests.

## Current Evidence

```text
Targeted Healthcare product Jest
PASS: 4 suites / 33 tests

Residual scanner group
37 Healthcare product/kernel contract gaps
```

Passing Jest is runtime smoke evidence only. It is not type-contract proof because these suites can pass while TypeScript-only contract drift remains.

## Inventory

```text
src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts        3
src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts    4
src/products/bella-hospital/services/__tests__/hospital-services.test.ts                4
src/products/bella-hospital/services/hospital-admission.service.ts                      2
src/products/bella-medical/__tests__/bella-medical-conformance.integration.test.ts      6
src/services/healthcare/clinical-alerts-service.ts                                     2
src/services/healthcare/healthcare-actions.ts                                          2
src/services/healthcare-chairs-actions.ts                                              4
src/services/healthcare-hospital-services.ts                                           8
```

## Root Cause Classification

### 1. Bella Hospital Public Contract Drift

`src/products/bella-hospital/services/hospital-admission.service.ts` imports:

```text
../../../platform/healthcare/contracts/admission-engine.contract
../../../platform/healthcare/contracts/audit-compliance.contract
```

Current filesystem evidence:

```text
src/platform/healthcare/contracts/admission-engine.contract.ts      MISSING
src/platform/healthcare/contracts/audit-compliance.contract.ts      MISSING
```

The canonical admission contract currently exists under:

```text
src/platform/healthcare/engines/admission-engine/contracts/admission-engine.contract.ts
```

That contract exposes `AdmissionEngineContract`, `CreateAdmissionRequest`, and `DischargeAdmissionRequest`, not the product-facing symbols currently consumed by Bella Hospital:

```text
IAdmissionContract
InpatientAdmissionDTO
BedTransferDTO
```

The canonical audit contract currently exists as:

```text
src/platform/healthcare/contracts/clinical-audit.contract.ts
```

It exposes `IClinicalAuditContract` and `IRecordAuditInput`, not:

```text
IAuditComplianceContract
AuditEntryInputDTO
```

Conclusion: this is not local mock typing debt. It is public contract drift between product-level names and canonical Healthcare contract exports.

### 2. CDS Contract Naming Drift

`src/products/bella-hospital/services/hospital-clinical-alert.service.ts` imports:

```text
ICdsContract
OrderSafetyCheckInputDTO
SafetyEvaluationResultDTO
```

The current canonical file exists:

```text
src/platform/healthcare/contracts/cds-engine.contract.ts
```

But current exports include `CdsEngineContract` and `IDecisionContract`, not the product-facing symbols above. The product method also expects `evaluateOrderSafety`, while canonical H8 exposes `generateCdsSummary`, detailed CDS checks, and `IDecisionContract.evaluate`.

Conclusion: this is a naming/API shape drift requiring contract decision, not a safe `any` replacement.

### 3. Medical / Dental / Hospital Test Mocks

The remaining conformance test violations use `any` to mock Kernel-facing contracts:

```text
Encounter / Order / Laboratory
Temporal H9
Audit H11
CDS H8
Revenue
Admission
```

Some canonical contracts exist, but direct replacement is not uniformly safe because product test mocks reference product-facing symbols and payload shapes that do not consistently match current canonical contract names or return envelopes.

Conclusion: converting these mocks without first deciding canonical product-facing contract aliases would risk fake compliance.

### 4. Runtime Fallback Services

`src/services/healthcare/clinical-alerts-service.ts`, `src/services/healthcare-chairs-actions.ts`, and `src/services/healthcare-hospital-services.ts` instantiate dev fallback mocks using `any`. These are product/runtime boundary adapters, not pure tests.

Conclusion: these need an approved adapter contract or removal/replacement strategy before typing. Do not patch them with local fake interfaces.

## Governance Boundary

Healthcare Constitution applies:

```text
Product -> Public Contract -> Frozen Kernel
H1-H12 Kernel = FROZEN
No fake public contracts
No direct Kernel modification without ACR
No duplicate Kernel capability
```

## Decision Needed

Choose the canonical Healthcare product-facing contract model:

```text
Option A
Create approved compatibility aliases / adapter contracts in the public contract layer.

Option B
Refactor product services/tests to current canonical Kernel contracts and method names.

Option C
Declare current product-facing contract names intentional, then add the missing public contract files through approved governance.
```

## Recommendation

Do not clean these 37 scanner violations as an `any` batch.

Open a Healthcare contract repair workstream with explicit approval, starting with Bella Hospital because it has the clearest drift:

```text
HospitalAdmissionProductService
HospitalClinicalAlertProductService
```

Only after the canonical contract decision is approved should the test mocks and runtime fallback adapters be typed.

## Verification To Run After Approved Repair

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-services.test.ts --runInBand
npx jest src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts --runInBand
npx eslint src/products/bella-hospital src/services/healthcare-hospital-services.ts
npm run healthcare:verify
npm run check:any-types
```

## Conclusion

HOLD. The Healthcare residual is a contract governance boundary, not a type-local cleanup opportunity.
