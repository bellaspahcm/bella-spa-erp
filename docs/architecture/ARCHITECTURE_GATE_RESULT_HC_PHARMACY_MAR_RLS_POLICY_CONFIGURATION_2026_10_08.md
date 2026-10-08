# Architecture Gate Result: Healthcare Pharmacy / MAR RLS Policy Configuration

Date: 2026-10-08

## Status

```text
HC_PHARMACY_MAR_RLS_POLICY_CONFIGURATION = PASS
HC_PRESCRIPTIONS_RLS_REAL_DB_PROOF = PASS
HC_MEDICATION_ADMINISTRATION_RECORDS_RLS_REAL_DB_PROOF = PASS
HOSPITAL_REAL_DB_RLS_PROOF = PASS
```

## Root Cause

Medication / Pharmacy / MAR persisted correctly after Order Approved to Pharmacy wiring, but same-tenant authenticated read returned no prescription row.

```text
Admin read-back = PASS
same-tenant RLS read hc_prescriptions = []
cross-tenant RLS denial = required
```

This was a Healthcare RLS policy configuration issue, not a Hospital product code issue.

## Minimal Fix

Created and applied:

```text
supabase/migrations/20261008012000_repair_healthcare_pharmacy_mar_rls_policies.sql
```

Scope:

```text
No schema changes
No Pharmacy public contract changes
No Hospital workaround
No direct product access to hc_* tables
```

Policy shape:

```text
hc_prescriptions:
  SELECT USING tenant_id = auth.jwt()->>tenant_id
  ALL USING/WITH CHECK tenant_id = auth.jwt()->>tenant_id

hc_medication_administration_records:
  SELECT USING tenant_id = auth.jwt()->>tenant_id
  ALL USING/WITH CHECK tenant_id = auth.jwt()->>tenant_id
```

The migration was applied to Supabase project:

```text
lvnvkpyxtuilhrabtlwv
```

## Verification

Focused proof:

```text
npx jest src/products/bella-hospital/services/__tests__/hospital-real-db-rls-proof.test.ts --runInBand
= PASS

Test Suites: 1 passed
Tests: 1 passed
```

The proof covers:

```text
Clinical Order persisted/read back
Laboratory persisted/read back
Imaging persisted/read back
Nursing persisted/read back
Medication order persisted/read back
Pharmacy prescription persisted/read back
MAR persisted/read back
same-tenant RLS read = PASS
cross-tenant RLS denial = PASS
```

## Canonical Output

```text
HC_PHARMACY_MAR_RLS_POLICY_CONFIGURATION = PASS
HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = PASS
HOSPITAL_REAL_DB_RLS_PROOF = PASS
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN_FOR_BROWSER_E2E_OR_PRODUCTION
GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
HOSPITAL_BROWSER_E2E_PROOF
```
