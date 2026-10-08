# Architecture Gate Result — Laboratory Real DB Patient Linkage Fix

Date: 2026-10-08

## Canonical Status

```text
LABORATORY_REAL_DB_PATIENT_LINKAGE_MINIMAL_FIX = PASS

LABORATORY_REAL_DB_PATIENT_LINKAGE_DECISION_TRACE = PASS
LABORATORY_REAL_DB_PATIENT_LINKAGE_DECISION = APPROVED_FOR_MINIMAL_FIX

HOSPITAL_REAL_DB_RLS_PROOF = BLOCKED_NOT_VERIFIED
GO_LIVE_DECISION = NO
```

## Approved Scope

```text
APPROVED:
- Fix Laboratory repository patient-linkage mapping.
- Hydrate patientId from the canonical clinical-order patient identity chain.
- Do not add hc_lab_orders.patient_id / patient_party_id unless new evidence requires it.
- Do not change Hospital contract.
- Do not change Laboratory public contract.
- Do not change Laboratory workflow semantics.
- Do not change H9/H11/Finance/Hospital code to work around the persistence boundary.
```

## Root Cause

```text
Public Lab Contract.patientId = PRESENT
LabOrder Domain.patientId = PRESENT
hc_lab_orders.patient_id / patient_party_id = NOT_PRESENT
Repository previous mapping = patientId <- encounter_id

ROOT_CAUSE = LAB_ORDER_PATIENT_LINKAGE_HYDRATED_FROM_WRONG_IDENTIFIER
```

Canonical source:

```text
LabOrder.clinical_order_id
  -> hc_clinical_orders.id
  -> hc_clinical_orders.patient_party_id
  -> hc_encounters.patient_party_id
```

## Minimal Fix

```text
SupabaseLaboratoryRepository.findById / findByClinicalOrderId
  -> load hc_lab_orders row
  -> resolve patient_party_id from hc_clinical_orders by tenant_id + clinical_order_id
  -> hydrate LabOrder.patientId from patient_party_id

SupabaseClinicalOrderReader.getOrderSnapshot
  -> patientId = hc_clinical_orders.patient_party_id
```

No schema column was added.

No Laboratory public contract changed.

No Hospital workaround was introduced.

## Files Changed In This Slice

```text
src/platform/healthcare/engines/laboratory-engine/repositories/supabase-laboratory.repository.ts
src/platform/healthcare/engines/laboratory-engine/repositories/supabase-clinical-order-reader.ts
src/platform/healthcare/__tests__/laboratory-engine.integration.test.ts
src/platform/healthcare/__tests__/laboratory-real-db-patient-linkage.test.ts
```

## Real DB Evidence

Command:

```text
node -e "dotenv .env.local + npx jest src/platform/healthcare/__tests__/laboratory-real-db-patient-linkage.test.ts --runInBand"
```

Result:

```text
PASS
Test Suites: 1 passed
Tests: 1 passed
```

Proven:

```text
Clinical Order
  -> bootstrapLabOrder()
  -> LabOrder
  -> COLLECTED
  -> RECEIVED
  -> PROCESSING
  -> RESULTED
  -> VERIFIED

ORDER_TO_LAB_ORDER_LINKAGE = PROVEN_REAL_DB
PATIENT_LINKAGE = PROVEN_REAL_DB
ENCOUNTER_LINKAGE = PROVEN_REAL_DB
TENANT_LINKAGE = PROVEN_REAL_DB
IDEMPOTENCY_RUNTIME = PROVEN_REAL_DB
```

Assertion preserved:

```text
LabOrder.patientId = hc_clinical_orders.patient_party_id
LabOrder.patientId != hc_lab_orders.encounter_id
```

## Regression Evidence

Focused Laboratory regression:

```text
npx jest src/platform/healthcare/__tests__/laboratory-engine.integration.test.ts --runInBand

PASS
Test Suites: 1 passed
Tests: 6 passed
```

Hospital/Lab contract and runtime proof:

```text
npx jest \
  src/products/bella-hospital/services/__tests__/hospital-laboratory-workflow-result-minimal-runtime.test.ts \
  src/platform/healthcare/contracts/__tests__/laboratory-order-bootstrap-public-semantics.test.ts \
  --runInBand

PASS
Test Suites: 2 passed
Tests: 10 passed
```

Static and architecture gates:

```text
npm run typecheck:changed = PASS
npm run healthcare:guard = PASS
changed-file no-any / suppression scan = PASS
git diff --check = PASS
```

## Full Healthcare Verification

Command:

```text
npm run healthcare:verify
```

Result:

```text
FAILED
Test Suites: 1 failed, 57 passed, 58 total
Tests: 1 failed, 525 passed, 526 total
```

Failure:

```text
src/platform/healthcare/__tests__/performance-slo-benchmark.test.ts
Benchmark 3: Audit Recording & Evidence Package Generation P95 latency

Expected: < 2000ms
Received: 2476.0446999999986ms
```

Classification:

```text
HEALTHCARE_VERIFY = BLOCKED_BY_EXISTING_PERFORMANCE_SLO
LABORATORY_PATIENT_LINKAGE_REGRESSION = NOT_INDICATED
```

This SLO failure is outside the approved Laboratory patient-linkage mapping scope and was not modified in this slice.

## RLS Evidence

Read-only RLS probe:

```text
Authenticated tenant JWT:
  rpc(get_auth_tenant_id) = correct tenant_id

Authenticated same-tenant read:
  from hc_lab_orders
  select id, tenant_id
  eq id = existing lab order id
```

Observed:

```text
get_auth_tenant_id = correct tenant_id
own-tenant hc_lab_orders read = []
error = null
```

Classification:

```text
HC_LAB_ORDERS_REAL_DB_RLS_OWN_TENANT_READ = BLOCKED_NOT_VERIFIED
HC_LAB_ORDERS_REAL_DB_RLS_CROSS_TENANT_DENIAL = NOT_PROVEN
HOSPITAL_REAL_DB_RLS_PROOF = BLOCKED_NOT_VERIFIED
```

Root cause is not yet proven from repository code. The next boundary is RLS policy/configuration evidence for `hc_lab_orders`.

## Boundary

```text
HOSPITAL_CODE_FIX = NOT_INDICATED
LAB_PUBLIC_CONTRACT_CHANGE = NO
LAB_WORKFLOW_CHANGE = NO
SCHEMA_COLUMN_ADDED = NO
H9_TEMPORAL_ALIGNMENT = NOT_OPENED
H11_AUDIT_RUNTIME = NOT_OPENED
FINANCE = NOT_OPENED
BROWSER_E2E = NOT_OPENED
PRODUCTION_MUTATION = NOT_AUTHORIZED
```

## Next Required Capability

```text
NEXT_REQUIRED_CAPABILITY =
HC_LAB_ORDERS_RLS_POLICY_CONFIGURATION_TRACE
```

Do not reopen Hospital business-chain code for this blocker.

Do not declare Hospital Real DB/RLS proof until own-tenant RLS read and cross-tenant denial are both proven.
