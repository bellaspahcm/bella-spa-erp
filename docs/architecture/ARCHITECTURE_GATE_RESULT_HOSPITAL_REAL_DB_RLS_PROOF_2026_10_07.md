# Architecture Gate Result: Hospital Real DB / RLS Proof

Date: 2026-10-07

## Status

```text
HOSPITAL_REAL_DB_RLS_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = PROVEN_FOR_CODE_RUNTIME_SCOPE
REAL_DB_RLS = NOT_PROVEN
BROWSER_E2E = NOT_PROVEN
PRODUCTION_INTEGRITY = NOT_PROVEN
GO_LIVE_DECISION = NO
```

## Scope

This gate attempted to move Bella Hospital from code/runtime proof into Real DB/RLS proof for the already-sealed business chain:

```text
Patient/MPI
  -> Admission
  -> Encounter
  -> Bed/Transfer
  -> Clinical Orders
  -> CDS
  -> Medication/Pharmacy/MAR
  -> Laboratory
  -> Imaging
  -> Nursing
  -> Discharge
  -> Bed Release
  -> H9 Temporal
  -> H11 Audit
  -> Billing/Finance
```

This is not Browser E2E, not Production, and not Backup/Restore readiness.

## Root Cause

```text
ROOT_CAUSE = LAB_RESULT_PATIENT_LINKAGE_NOT_PERSISTABLE_IN_REAL_DB
OWNER = HEALTHCARE OS / LABORATORY PERSISTENCE CONTRACT
PRODUCT_CODE_FIX = NOT_INDICATED
KERNEL_MUTATION = NOT_AUTHORIZED
```

Hospital Laboratory runtime requires verified Lab result linkage to preserve:

```text
tenantId
patientId
encounterId
orderId
labOrderId
```

The public Laboratory runtime path can bootstrap from `patientId`, but the canonical Real DB table `hc_lab_orders` does not persist `patient_id` / `patient_party_id`. The current Supabase Laboratory repository rehydrates `LabOrder.patientId` from `encounter_id`, which cannot prove Real DB patient linkage.

## Evidence

Generated type evidence:

```text
src/types/database.types.ts
  hc_lab_orders.Row =
    clinical_order_id
    encounter_id
    tenant_id
    test_code
    test_name
    result fields
    verified fields

  patient_id / patient_party_id = NOT_PRESENT
```

Migration evidence:

```text
supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql
  CREATE TABLE public.hc_lab_orders (
    id
    tenant_id
    clinical_order_id
    encounter_id
    test_code
    test_name
    ...
  )

  patient_id / patient_party_id = NOT_PRESENT
```

Live DB read-only preflight via Supabase REST:

```text
select id,patient_id from hc_lab_orders
  ok = false
  errorCode = 42703
  errorMessage = column hc_lab_orders.patient_id does not exist

select id,clinical_order_id,encounter_id,tenant_id from hc_lab_orders
  ok = true
```

Environment preflight:

```text
NEXT_PUBLIC_SUPABASE_URL = PRESENT
SUPABASE_SERVICE_ROLE_KEY = PRESENT
NEXT_PUBLIC_SUPABASE_ANON_KEY = PRESENT
SUPABASE_JWT_SECRET = PRESENT
SUPABASE_DB_URL = PRESENT_BUT_NOT_CONNECTABLE_FOR_PG_INTROSPECTION
```

## Boundary Decision

This gate cannot honestly claim Real DB/RLS PASS because the Laboratory branch of the Hospital Go-Live chain cannot prove patient linkage after result verification through the current Real DB schema and repository mapping.

The minimal valid fix would be in the Healthcare Laboratory persistence/contract boundary, not Hospital product code. Because Healthcare Kernel H1-H12 is frozen and product code must not compensate by directly querying `hc_*` tables or weakening patient linkage assertions, this gate stops here.

## Not Done

```text
NO Hospital direct Laboratory repository access
NO Hospital direct hc_lab_orders access
NO schema migration
NO Browser E2E
NO production mutation
NO Go-Live claim
```

## Required Next Capability

```text
NEXT_REQUIRED_CAPABILITY =
  LABORATORY_REAL_DB_PATIENT_LINKAGE_CONTRACT_DECISION

Possible decision paths:
  A. Healthcare Kernel owner approves deriving patient linkage from Clinical Order / Encounter at repository read boundary.
  B. Healthcare Kernel owner approves additive patient linkage persistence for Lab Orders.
  C. Healthcare Kernel owner defines a different canonical Real DB linkage proof accepted for Hospital Go-Live.
```

Until that decision is made and verified:

```text
HOSPITAL_REAL_DB_RLS_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_DECISION = NO
```
