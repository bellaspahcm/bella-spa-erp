# Architecture Gate Result: CDS Calculation Persistence Minimal Fix

Date: 2026-10-08

## Status

```text
CDS_CALCULATION_PERSISTENCE_MINIMAL_FIX = PASS
CDS_CALCULATION_PERSISTENCE_REAL_DB_PROOF = PASS
HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
GO_LIVE_DECISION = NO
```

## Approved Scope

Human Architect approved `CDS_CALCULATION_PERSISTENCE_MINIMAL_FIX / OPTION_A`.

Allowed:

```text
Align CdsEngineService.writeCalculationRecord()
  with live/generated hc_clinical_calculations schema:
  id, tenant_id, algorithm_id, input_data, output_data, created_at

Propagate insert failure:
  INSERT FAIL -> operation FAIL
  INSERT SUCCESS -> return valid calculationId

Preserve public CDS contract, CDS business semantics, and
hc_clinical_orders.cds_check_id FK.
```

Not allowed:

```text
Hospital workaround
bypass CDS
drop or weaken FK
public CDS contract change
CDS calculation semantics change
schema expansion
H8 refactor
unrelated Kernel changes
```

## Root Cause

```text
CDS_CALCULATION_PERSISTENCE_SCHEMA_ALIGNMENT = MISMATCH
CDS_CALCULATION_INSERT_ERROR_PROPAGATION = MISSING
```

The public CDS result exposes `calculationId` as a persisted calculation reference, while the previous write path attempted the historical expanded H8 insert payload against the current compact live/generated schema and returned the generated id without checking the insert error.

## Minimal Fix

`CdsEngineService.writeCalculationRecord()` now writes:

```text
hc_clinical_calculations.id
hc_clinical_calculations.tenant_id
hc_clinical_calculations.algorithm_id
hc_clinical_calculations.input_data
hc_clinical_calculations.output_data
hc_clinical_calculations.created_at
```

Expanded provenance is preserved inside JSON:

```text
input_data:
  encounterId
  patientId
  inputSnapshot
  sourceObservationReferences
  correlationId
  causationId

output_data:
  output
  decision
  enforcement
  algorithmCategory
  algorithmVersion
  engineVersion
  knowledgeBaseVersion
  policyVersion
  calculationStatus
```

The operation now throws if persistence fails and returns `calculationId` only after the insert succeeds.

## Verification

Focused proof:

```text
npx jest src/platform/healthcare/__tests__/cds-calculation-persistence-contract.test.ts --runInBand
= PASS

Test Suites: 1 passed
Tests: 2 passed
```

The focused regression proves:

```text
VALID PATH
CDS calculation
  -> persisted hc_clinical_calculations
  -> valid calculationId returned

FAILURE PATH
calculation INSERT fails
  -> writeCalculationRecord() fails
  -> no unusable calculationId returned
```

## Medication Real DB Resume Result

After this fix, Hospital Medication / Pharmacy / MAR Real DB proof no longer fails at `hc_clinical_orders.cds_check_id` FK.

The resumed proof reaches the next boundary:

```text
PRESCRIPTION_NOT_FOUND: Prescription not found for order <orderId>
```

Event evidence:

```text
[EventBus] No handlers for event: hos.order.approved.v1
```

This means CDS persistence is no longer the active blocker.

## Canonical Output

```text
CDS_CALCULATION_PERSISTENCE_MINIMAL_FIX = PASS
CDS_CALCULATION_PERSISTENCE_REAL_DB_PROOF = PASS
PUBLIC_CDS_CONTRACT_CHANGE_REQUIRED = NO
NEW_SCHEMA = NO
HOSPITAL_WORKAROUND = NO

CURRENT_BLOCKER =
ORDER_APPROVED_TO_PHARMACY_PRESCRIPTION_BOOTSTRAP_HOST_EVENT_WIRING

HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
ORDER_APPROVED_TO_PHARMACY_BOOTSTRAP_WIRING_DECISION
```
