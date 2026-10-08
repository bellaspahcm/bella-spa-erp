# Architecture Gate Result: HC Imaging Orders RLS Policy Configuration

Date: 2026-10-08

## Scope

Hospital Real DB / RLS proof reached the Imaging branch after the Order Engine patient-linkage fix.

This slice is limited to Healthcare Imaging Real DB RLS policy configuration for:

```text
hc_imaging_orders
```

No Hospital product workaround, Imaging contract change, Imaging runtime refactor, schema expansion, Browser E2E, Finance, or production backup/restore work is included.

## Root Cause

Live Supabase policy introspection showed:

```text
hc_imaging_orders.relrowsecurity = true
hc_imaging_orders policies = []
```

Canonical root cause:

```text
RLS_ENABLED_BUT_POLICY_MISSING_FOR_HC_IMAGING_ORDERS
```

## Minimal Fix

Added migration:

```text
supabase/migrations/20261008011000_repair_healthcare_imaging_order_rls_policies.sql
```

The migration:

- enables RLS on `public.hc_imaging_orders`
- creates tenant `SELECT` policy
- creates tenant write policy with matching `WITH CHECK`
- uses authenticated JWT `tenant_id` boundary

No schema columns were added.

No public contract was changed.

No Hospital code workaround was added.

## Canonical Status

```text
HC_IMAGING_ORDERS_RLS_POLICY_CONFIGURATION_TRACE = PASS
HC_IMAGING_ORDERS_RLS_POLICY_CONFIGURATION_FIX = PASS
HC_IMAGING_ORDERS_RLS_REAL_DB_PROOF = PASS
HOSPITAL_REAL_DB_RLS_PROOF = RESUMED
GO_LIVE_DECISION = NO
```

## Required Verification

```text
HC_IMAGING_ORDERS_RLS_OWN_TENANT_READ
HC_IMAGING_ORDERS_RLS_CROSS_TENANT_DENIAL
Hospital Imaging Real DB read-back
```

## Verification Evidence

```text
Live Supabase migration apply
= PASS

npx jest src/products/bella-hospital/services/__tests__/hospital-real-db-rls-proof.test.ts --runInBand
= PASS

Combined focused Real DB/RLS proof:
  order-engine-real-db-patient-linkage.test.ts
  laboratory-real-db-patient-linkage.test.ts
  hc-lab-orders-rls-policy-configuration.test.ts
  hospital-real-db-rls-proof.test.ts
= PASS
```

## Canonical Result

```text
HC_IMAGING_ORDERS_RLS_POLICY_CONFIGURATION_TRACE = PASS
HC_IMAGING_ORDERS_RLS_POLICY_CONFIGURATION_FIX = PASS
HC_IMAGING_ORDERS_RLS_OWN_TENANT_READ = PASS
HC_IMAGING_ORDERS_RLS_CROSS_TENANT_DENIAL = PASS

SCHEMA_COLUMN_CHANGE = NO
PUBLIC_IMAGING_CONTRACT_CHANGE = NO
HOSPITAL_CODE_WORKAROUND = NO

HOSPITAL_REAL_DB_RLS_PROOF = RESUMED
GO_LIVE_DECISION = NO
```
