# Architecture Gate Result: Order Engine Real DB Patient Linkage Persistence Fix

Date: 2026-10-08

## Status

```text
ORDER_ENGINE_REAL_DB_PATIENT_LINKAGE_PERSISTENCE_DECISION = APPROVED
ORDER_ENGINE_REAL_DB_PATIENT_LINKAGE_PERSISTENCE_MINIMAL_FIX = PASS
ORDER_ENGINE_REAL_DB_PATIENT_LINKAGE_REAL_DB_PROOF = PASS
HC_IDEMPOTENCY_KEYS_SCHEMA_ALIGNMENT = PASS
HOSPITAL_REAL_DB_RLS_PROOF = RESUMED
GO_LIVE_DECISION = NO
```

## Problem

Hospital Real DB / RLS proof reached the public Order Engine runtime path and failed while persisting a clinical order:

```text
ORDER_PERSIST_FAILED:
null value in column "patient_party_id" of relation "hc_clinical_orders" violates not-null constraint
```

## Truth / Source Of Truth

Canonical evidence:

```text
CreateOrderRequest.patientId = PRESENT
hc_clinical_orders.patient_party_id = NOT NULL
fk_hc_clinical_orders_encounter_patient = (encounter_id, patient_party_id)
SupabaseOrderRepository.toInsert() = maps ClinicalOrder.patientId -> patient_party_id
```

## Ownership Map

```text
Patient identity = Healthcare / Patient-MPI + Encounter patient linkage
Clinical Order public contract = Healthcare / Order Engine
Clinical Order persistence = Healthcare / Order Engine
Hospital product = Consumer only
```

## Contract Dependency Map

```text
Hospital Product
  -> public OrderEngineContract.createOrder()
  -> OrderEngineService
  -> hc_clinical_orders
```

Hospital already passes `patientId` through the public contract.

## Root Cause

```text
ORDER_ENGINE_CREATE_ORDER_DOES_NOT_PERSIST_PATIENT_PARTY_ID
```

The default `OrderEngineService.createOrder()` write path inserts into `hc_clinical_orders` without `patient_party_id`, while the canonical Real DB schema requires it.

This is a stale runtime write consumer of the canonical persistence contract.

## Change Authority

Approved scope:

```text
ORDER_ENGINE_REAL_DB_PATIENT_LINKAGE_PERSISTENCE_MINIMAL_FIX
```

Allowed:

- persist `CreateOrderRequest.patientId` into `hc_clinical_orders.patient_party_id`
- keep public Order Engine contract unchanged
- keep Hospital product unchanged
- keep schema unchanged
- verify Real DB persistence/read-back
- verify tenant/RLS behavior

Not allowed:

- Hospital workaround
- schema expansion
- duplicate patient fields
- new abstraction
- unrelated Order Engine refactor
- CDS, Laboratory, Finance, H9, or H11 changes

## Minimal Implementation Plan

```text
OrderEngineService.createOrder()
  -> include patient_party_id from request.patientId in the clinical order insert row
  -> fallback to encounter patient linkage only when request.patientId is absent
  -> persist request_id for create-order idempotency read-back
  -> preserve existing order lifecycle semantics
  -> preserve existing CDS behavior
  -> align idempotency behavior with the live hc_idempotency_keys schema
```

No public contract change is required.

No schema migration is required.

No Hospital code change is required.

## Minimal Fix Applied

```text
CreateOrderRequest.patientId
  -> ClinicalOrder.patientId
  -> hc_clinical_orders.patient_party_id
```

The Order Engine runtime write path now persists the canonical patient linkage expected by the Real DB schema.

The idempotency path was also aligned to the current schema:

```text
create-order idempotency
  -> hc_clinical_orders.request_id

operation idempotency
  -> hc_idempotency_keys(tenant_id, request_id, operation)
```

This avoids relying on stale `hc_idempotency_keys.id` or `response_data` fields that are not present in the generated/live schema.

## Verification Plan

```text
focused Order Engine Real DB patient-linkage test
Hospital Real DB / RLS proof resume
Laboratory patient-linkage + RLS focused regression
npm run typecheck:changed
npm run healthcare:guard
changed-file no-any/no-suppression scan
git diff --check
```

`npm run healthcare:verify` remains known to fail on the out-of-scope performance SLO benchmark unless separately addressed.

## Verification Evidence

```text
npx jest src/platform/healthcare/__tests__/order-engine-real-db-patient-linkage.test.ts --runInBand
= PASS

npx jest \
  src/platform/healthcare/__tests__/order-engine-real-db-patient-linkage.test.ts \
  src/platform/healthcare/__tests__/laboratory-real-db-patient-linkage.test.ts \
  src/platform/healthcare/__tests__/hc-lab-orders-rls-policy-configuration.test.ts \
  src/products/bella-hospital/services/__tests__/hospital-real-db-rls-proof.test.ts \
  --runInBand
= PASS
```

## Canonical Result

```text
ORDER_ENGINE_REAL_DB_PATIENT_LINKAGE_PERSISTENCE_MINIMAL_FIX = PASS
ORDER_ENGINE_REAL_DB_PATIENT_LINKAGE_REAL_DB_PROOF = PASS
HC_IDEMPOTENCY_KEYS_SCHEMA_ALIGNMENT = PASS

PUBLIC_ORDER_ENGINE_CONTRACT_CHANGED = NO
HOSPITAL_CODE_WORKAROUND = NO
SCHEMA_CHANGE = NO

HOSPITAL_REAL_DB_RLS_PROOF = RESUMED
GO_LIVE_DECISION = NO
```
