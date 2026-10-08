# Architecture Gate Result: HC Lab Orders RLS Policy Configuration

Date: 2026-10-08

## Scope

Hospital Go-Live Real DB / RLS proof was blocked after Laboratory patient-linkage was corrected and proven against the real database.

This slice is limited to the Healthcare Laboratory Real DB RLS policy boundary:

- `hc_lab_orders`
- `hc_clinical_orders`
- same-tenant read
- cross-tenant denial

This slice does not modify Hospital product code, Laboratory public contract semantics, Laboratory workflow semantics, H9 Temporal, H11 Audit, Finance, Browser E2E, or production backup/restore.

## Root Cause

`HC_LAB_ORDERS_RLS_POLICY_CONFIGURATION_TRACE = PASS`

Live Supabase policy introspection showed:

- `get_auth_tenant_id()` returned the expected authenticated tenant.
- `hc_encounters` had live tenant isolation policies and same-tenant read worked.
- `hc_lab_orders` had RLS enabled but no live tenant isolation policy.
- `hc_clinical_orders` had RLS enabled but no live tenant isolation policy.
- Grants existed for the target roles, so the blocker was policy configuration rather than missing table privileges.

Canonical root cause:

```text
RLS_ENABLED_BUT_POLICY_MISSING_FOR_HC_LAB_ORDERS_AND_HC_CLINICAL_ORDERS
```

## Minimal Fix

`HC_LAB_ORDERS_RLS_POLICY_CONFIGURATION_FIX = PASS`

Added migration:

```text
supabase/migrations/20261008010000_repair_healthcare_lab_order_rls_policies.sql
```

The migration:

- enables RLS on `public.hc_clinical_orders`
- enables RLS on `public.hc_lab_orders`
- creates tenant `SELECT` policies
- creates tenant write policies with matching `WITH CHECK`
- uses the authenticated JWT `tenant_id` boundary

No schema columns were added.

No Hospital workaround was added.

No Laboratory public contract was changed.

No Laboratory workflow semantics were changed.

The migration was applied to the target Supabase project through the Supabase Management API after the read-only trace identified the policy configuration root cause.

## Real DB RLS Proof

Focused Real DB test:

```text
src/platform/healthcare/__tests__/hc-lab-orders-rls-policy-configuration.test.ts
```

Proof:

```text
HC_LAB_ORDERS_RLS_OWN_TENANT_READ = PASS
HC_LAB_ORDERS_RLS_CROSS_TENANT_DENIAL = PASS
HC_CLINICAL_ORDERS_RLS_OWN_TENANT_READ = PASS
HC_CLINICAL_ORDERS_RLS_CROSS_TENANT_DENIAL = PASS
GET_AUTH_TENANT_ID = PASS
```

The proof seeds a real clinical order and a real Laboratory order, then reads them through an authenticated tenant JWT client.

Same-tenant read returns the expected rows.

Cross-tenant read returns no rows.

## Laboratory Patient Linkage

Previous blocker remains sealed:

```text
LABORATORY_REAL_DB_PATIENT_LINKAGE_MINIMAL_FIX = PASS
LABORATORY_REAL_DB_PATIENT_LINKAGE_REAL_DB_PROOF = PASS
```

Patient identity source remains canonical:

```text
LabOrder
  -> clinical_order_id
  -> hc_clinical_orders.patient_party_id
  -> hc_encounters.patient_party_id
```

## Out Of Scope

`HEALTHCARE_VERIFY` previously reached the Healthcare suite and failed only on the out-of-scope performance SLO benchmark:

```text
performance-slo-benchmark.test.ts
Audit/Evidence P95 > 2000ms
```

This performance SLO is not part of the `hc_lab_orders` RLS policy configuration slice and was not modified.

## Canonical Status

```text
HC_LAB_ORDERS_RLS_POLICY_CONFIGURATION_TRACE = PASS
HC_LAB_ORDERS_RLS_POLICY_CONFIGURATION_FIX = PASS
HC_LAB_ORDERS_RLS_REAL_DB_PROOF = PASS

LABORATORY_REAL_DB_PATIENT_LINKAGE_MINIMAL_FIX = PASS
LABORATORY_REAL_DB_PATIENT_LINKAGE_REAL_DB_PROOF = PASS

HOSPITAL_REAL_DB_RLS_PROOF = READY_TO_RESUME
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = PROVEN_FOR_CODE_RUNTIME_SCOPE
HOSPITAL_GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
HOSPITAL_REAL_DB_RLS_PROOF
```

Resume the Hospital Real DB / RLS proof from the sealed business-chain runtime scope.

Do not reopen Hospital business-chain code unless the Real DB proof identifies a new root cause.
