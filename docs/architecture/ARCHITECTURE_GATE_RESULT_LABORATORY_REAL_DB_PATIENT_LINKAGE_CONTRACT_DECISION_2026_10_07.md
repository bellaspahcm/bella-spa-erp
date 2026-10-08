# Architecture Gate Result: Laboratory Real DB Patient Linkage Contract Decision Trace

Date: 2026-10-07

## Status

```text
LABORATORY_REAL_DB_PATIENT_LINKAGE_CONTRACT_DECISION_TRACE = PASS
LABORATORY_REAL_DB_PATIENT_LINKAGE_DECISION = BLOCKED_FOR_HUMAN_ARCHITECT_REVIEW
HOSPITAL_REAL_DB_RLS_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = PROVEN_FOR_CODE_RUNTIME_SCOPE
GO_LIVE_DECISION = NO
```

## Problem

Hospital Real DB/RLS proof stopped because the Laboratory branch cannot prove verified Lab result patient linkage from Real DB.

Hospital Go-Live requires the verified Laboratory branch to preserve:

```text
tenantId
patientId
encounterId
orderId
labOrderId
```

The previous Real DB preflight confirmed:

```text
select id,patient_id from hc_lab_orders
  ok = false
  errorCode = 42703
  errorMessage = column hc_lab_orders.patient_id does not exist

select id,clinical_order_id,encounter_id,tenant_id from hc_lab_orders
  ok = true
```

## Ownership

```text
Patient identity canonical source = Healthcare Kernel / Encounter + Clinical Order
Laboratory aggregate = Healthcare Laboratory Engine
Hospital product = Consumer only

Hospital code fix = NOT_INDICATED
Hospital direct hc_lab_orders access = FORBIDDEN
```

## Evidence

### Public Laboratory Contract

The public Laboratory contract requires patient linkage at bootstrap and returns patient linkage:

```text
BootstrapLabOrderRequest.patientId
BootstrapLabOrderResult.patientId
```

Evidence:

```text
src/platform/healthcare/contracts/laboratory-engine.contract.ts
  BootstrapLabOrderRequest.patientId
  BootstrapLabOrderResult.patientId
```

### Laboratory Domain

The Laboratory aggregate owns `patientId` as part of `LabOrderProps`.

Evidence:

```text
src/platform/healthcare/engines/laboratory-engine/domain/lab-order.entity.ts
  LabOrderProps.patientId
  LabOrder.patientId getter
```

### Laboratory Persistence

The Real DB table `hc_lab_orders` persists:

```text
tenant_id
clinical_order_id
encounter_id
test_code
test_name
result fields
verification fields
```

It does not persist:

```text
patient_id
patient_party_id
```

Evidence:

```text
supabase/migrations/20260806050000_healthcare_platform_extended_schema.sql
src/types/database.types.ts
live Supabase REST preflight
```

### Stale Repository Mapping

The current Laboratory repository rehydrates `LabOrder.patientId` from `row.encounter_id`.

```text
patientId: row.encounter_id
```

This is not semantically valid patient identity.

Evidence:

```text
src/platform/healthcare/engines/laboratory-engine/repositories/supabase-laboratory.repository.ts
```

The Laboratory clinical order reader contains the same stale mapping:

```text
patientId: data.encounter_id
```

Evidence:

```text
src/platform/healthcare/engines/laboratory-engine/repositories/supabase-clinical-order-reader.ts
```

### Existing Canonical Patient Linkage

Clinical Orders already persist canonical patient linkage:

```text
hc_clinical_orders.patient_party_id
```

and the canonical migrations enforce:

```text
(encounter_id, patient_party_id)
  -> hc_encounters(id, patient_party_id)
```

Evidence:

```text
supabase/migrations/20260812030000_extend_clinical_orders_table.sql
supabase/migrations/20260812040000_recreate_clinical_orders_table.sql
src/types/database.types.ts
```

## Decision Analysis

### Option A: Reuse Existing Canonical Linkage

```text
LabOrder
  -> clinical_order_id
  -> hc_clinical_orders.patient_party_id
  -> hc_encounters.patient_party_id
```

Result:

```text
NEW_DB_COLUMN = NO
NEW_PUBLIC_CONTRACT = NO
NEW_PUBLIC_SEMANTIC = NO
```

This is the minimal semantic direction because patient identity is already persisted canonically on Clinical Order and enforced against Encounter.

Required implementation after approval:

```text
SupabaseLaboratoryRepository:
  rehydrate LabOrder.patientId from canonical clinical order linkage,
  not from encounter_id.

SupabaseClinicalOrderReader:
  return patientId from hc_clinical_orders.patient_party_id,
  not from encounter_id.

Regression tests:
  Real DB or repository-level proof that LabOrder.patientId equals
  ClinicalOrder.patient_party_id after bootstrap/result/verification.
```

### Option B: Add patient_id / patient_party_id to hc_lab_orders

Result:

```text
NEW_DB_COLUMN = YES
ADDITIVE_MIGRATION = YES
KERNEL_TABLE_CHANGE = YES
```

This is heavier and changes Healthcare Laboratory persistence schema. It should be considered only if the Healthcare architect decides LabOrder must physically persist patient identity rather than derive it from the canonical Clinical Order linkage.

### Option C: Hospital Workaround

Rejected.

```text
Hospital -> Laboratory repository
Hospital -> hc_lab_orders
Hospital -> direct DB join
```

This violates Healthcare vertical rules and would turn a Kernel persistence gap into Product technical debt.

## RLS Implications

Existing RLS policy for `hc_lab_orders` is tenant-scoped:

```text
tenant_id = public.get_auth_tenant_id()
```

If Option A is selected, the repository read must preserve tenant filters on both:

```text
hc_lab_orders.tenant_id
hc_clinical_orders.tenant_id
```

If Option B is selected, the additive migration must also preserve tenant-scoped RLS and backfill without cross-tenant leakage.

## Boundary

The preferred minimal technical direction is Option A, but it modifies Healthcare Laboratory Kernel repository behavior. The Healthcare OS Kernel H1-H12 is frozen, so this task cannot implement the fix without Human Architect approval / ACR.

```text
ARCHITECTURAL GAP DETECTED
```

## Canonical Decision Trace Output

```text
LABORATORY_REAL_DB_PATIENT_LINKAGE_CONTRACT_DECISION_TRACE = PASS

CANONICAL_PATIENT_SOURCE =
  hc_clinical_orders.patient_party_id
  enforced by (encounter_id, patient_party_id) -> hc_encounters

LABORATORY_PUBLIC_CONTRACT_PATIENT_LINKAGE = PRESENT
LABORATORY_DOMAIN_PATIENT_LINKAGE = PRESENT
LABORATORY_REAL_DB_DIRECT_PATIENT_COLUMN = NOT_PRESENT
LABORATORY_REPOSITORY_PATIENT_MAPPING = STALE

RECOMMENDED_MINIMAL_DIRECTION =
  Option A: derive LabOrder.patientId from canonical Clinical Order linkage

NEW_PUBLIC_CONTRACT = NO
NEW_PUBLIC_SEMANTIC = NO
NEW_DB_COLUMN = NOT_RECOMMENDED_FIRST

IMPLEMENTATION_STATUS =
  BLOCKED_FOR_HUMAN_ARCHITECT_REVIEW

HOSPITAL_CODE_FIX = NOT_INDICATED
HOSPITAL_REAL_DB_RLS_PROOF = BLOCKED_NOT_VERIFIED
```

## Next Required Capability

```text
NEXT_REQUIRED_CAPABILITY =
  ACR_OR_HUMAN_ARCHITECT_APPROVAL_FOR_LABORATORY_PATIENT_LINKAGE_FIX

After approval:
  LABORATORY_PATIENT_LINKAGE_MINIMAL_FIX
    -> focused repository/contract tests
    -> healthcare:verify
    -> rerun HOSPITAL_REAL_DB_RLS_PROOF
```
