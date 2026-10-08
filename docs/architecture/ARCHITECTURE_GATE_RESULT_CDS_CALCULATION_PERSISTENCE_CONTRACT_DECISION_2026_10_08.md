# Architecture Gate Result: CDS Calculation Persistence Contract Decision

Date: 2026-10-08

## Status

```text
CDS_CALCULATION_PERSISTENCE_CONTRACT_DECISION_TRACE = PASS
CDS_CALCULATION_PERSISTENCE_IMPLEMENTATION = BLOCKED_FOR_HUMAN_ARCHITECT_APPROVAL
HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
GO_LIVE_DECISION = NO
```

## Scope

This is a decision trace only for the blocker discovered while extending Hospital Real DB / RLS proof into the Medication / Pharmacy / MAR branch.

Allowed:

```text
trace public CDS contract
trace H8 CDS service persistence semantics
compare migrations / generated DB types / live-proof failure
identify canonical calculation record shape
identify error propagation invariant
recommend minimal persistence alignment
```

Not authorized in this slice:

```text
modify H8 CDS Kernel code
change public CDS contract
change schema
change Order Engine business semantics
work around from Hospital
bypass CDS / cds_check_id FK
continue Pharmacy/MAR Real DB proof
```

## Triggering Evidence

Hospital Medication Real DB proof failed while creating a medication clinical order:

```text
ORDER_PERSIST_FAILED:
insert or update on table "hc_clinical_orders" violates foreign key constraint
"hc_clinical_orders_cds_check_id_fkey"
```

The failure happens before Pharmacy prescription bootstrap, dispense, or MAR can be reached.

## Ownership Map

```text
Medication clinical safety decision = Healthcare OS / H8 CDS
CDS calculation provenance = Healthcare OS / H8 CDS persistence
Clinical order cds_check_id = Healthcare OS / Order Engine consumer of CDS result
Medication / Pharmacy / MAR = Healthcare OS / Pharmacy Engine consumer after order approval
Hospital product = consumer only
```

## Contract Dependency Map

```text
Hospital Product
  -> public OrderEngineContract.createOrder(MEDICATION)
  -> public IDecisionContract.evaluate()
  -> CdsCheckResult.calculationId
  -> OrderEngine persists hc_clinical_orders.cds_check_id
  -> DB FK requires hc_clinical_calculations(id)
```

## Public Contract Trace

Public CDS contract states:

```text
CdsCheckResult.calculationId
= Reference ID in hc_clinical_calculations
```

Therefore this invariant must hold:

```text
DB INSERT SUCCESS
  -> return valid calculationId

DB INSERT FAILURE
  -> return EngineResponse error / throw to caller
  -> never return a fabricated or unusable calculationId
```

## Schema / Migration Trace

The repository contains two competing historical shapes for `hc_clinical_calculations`.

Earlier H8-oriented shape:

```text
id
tenant_id
encounter_id
algorithm_id
algorithm_version
calculation_timestamp
calculation_status
input_snapshot
source_observation_references
output
engine_version
...
```

Later recreate migration shape:

```text
id
tenant_id
algorithm_id
input_data
output_data
created_at
```

Generated database types currently expose the later compact shape:

```text
hc_clinical_calculations.Row =
  id
  tenant_id
  algorithm_id
  input_data
  output_data
  created_at
```

`hc_clinical_orders.cds_check_id` still references:

```text
hc_clinical_calculations.id
```

## Runtime Trace

`CdsEngineService.evaluate()` calls:

```text
writeCalculationRecord({ id: decisionId, ...expanded H8 calculation shape })
```

and returns:

```text
calculationId: decisionId
```

`writeCalculationRecord()` currently inserts the expanded shape into `hc_clinical_calculations`, but does not inspect or propagate the Supabase insert error before returning the id.

Result:

```text
CDS insert fails due schema mismatch
  -> writeCalculationRecord still returns id
  -> OrderEngine persists cds_check_id = id
  -> hc_clinical_orders_cds_check_id_fkey fails
```

## Root Cause

```text
CDS_CALCULATION_PERSISTENCE_SCHEMA_ALIGNMENT = MISMATCH
CDS_CALCULATION_INSERT_ERROR_PROPAGATION = MISSING
```

This is not a Hospital code issue.

## Architectural Gap

```text
ARCHITECTURAL_GAP_DETECTED = YES
GAP_OWNER = HEALTHCARE OS / H8 CDS PERSISTENCE
```

Reason:

```text
Public CDS contract promises a persisted calculation reference.
Current H8 runtime can return a calculationId without proven persistence.
Current generated DB type shape does not match the expanded insert payload.
```

## Minimal Decision Options

### Option A — Minimal runtime persistence alignment

Align `CdsEngineService.writeCalculationRecord()` to the current generated/live `hc_clinical_calculations` shape:

```text
id
tenant_id
algorithm_id
input_data
output_data
created_at
```

Map expanded provenance into JSON:

```text
input_data = {
  encounterId,
  patientId,
  inputSnapshot,
  sourceObservationReferences,
  correlationId,
  causationId
}

output_data = {
  output,
  decision,
  enforcement,
  algorithmCategory,
  algorithmVersion,
  engineVersion,
  knowledgeBaseVersion,
  policyVersion,
  calculationStatus
}
```

Also enforce:

```text
if insert error -> throw / return CDS_EVALUATE_ERROR
```

No public CDS contract change.

No schema migration.

No Hospital change.

### Option B — Additive H8 schema alignment migration

Add approved columns to `hc_clinical_calculations` so DB schema matches the expanded CDS runtime payload.

This preserves richer first-class query columns but requires a Kernel schema mutation and therefore a broader ACR.

### Option C — Remove clinical-order FK dependency

Do not choose this for the current blocker.

It would weaken clinical safety provenance and break the contract meaning of `calculationId`.

## Recommended Decision

```text
RECOMMENDED_MINIMAL_FIX = OPTION_A
```

Rationale:

```text
Generated DB type/source currently exposes compact calculation schema.
Public contract does not require first-class expanded columns.
Hospital proof only requires a valid persisted calculation reference.
Option A repairs false-success persistence semantics with the smallest surface.
```

Required invariant:

```text
writeCalculationRecord()
  MUST NOT return calculationId unless hc_clinical_calculations insert succeeds.
```

## Change Authority

Current approval covers decision trace only.

Implementation is still blocked because this modifies H8 CDS Kernel runtime semantics:

```text
CDS_CALCULATION_PERSISTENCE_IMPLEMENTATION = BLOCKED_FOR_HUMAN_ARCHITECT_APPROVAL
```

## Verification Plan If Option A Is Approved

```text
focused CDS calculation persistence test
focused medication clinical-order Real DB proof
Hospital Medication/Pharmacy/MAR Real DB proof resume
Hospital clinical-care Real DB/RLS regression
npm run typecheck:changed
npm run healthcare:guard
changed-file no-any/no-suppression scan
git diff --check
```

Do not run Browser E2E or Production gates until Medication/Pharmacy/MAR Real DB proof is sealed.

## Canonical Output

```text
CDS_CALCULATION_PERSISTENCE_CONTRACT_DECISION_TRACE = PASS
PUBLIC_CDS_CONTRACT = PRESENT
PUBLIC_CDS_CONTRACT_CHANGE_REQUIRED = NO
CURRENT_SCHEMA_SHAPE = COMPACT_INPUT_OUTPUT_DATA
CURRENT_CDS_RUNTIME_INSERT_SHAPE = EXPANDED_H8_PAYLOAD
SCHEMA_RUNTIME_ALIGNMENT = NOT_PROVEN
ERROR_PROPAGATION = NOT_PROVEN

RECOMMENDED_MINIMAL_FIX = OPTION_A
IMPLEMENTATION_APPROVAL_REQUIRED = YES

HOSPITAL_MEDICATION_PHARMACY_MAR_REAL_DB_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN
GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
CDS_CALCULATION_PERSISTENCE_MINIMAL_FIX_APPROVAL
```
