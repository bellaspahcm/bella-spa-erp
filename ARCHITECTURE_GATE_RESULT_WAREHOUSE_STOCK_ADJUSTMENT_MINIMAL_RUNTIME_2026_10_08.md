# ARCHITECTURE GATE RESULT - WAREHOUSE STOCK ADJUSTMENT MINIMAL RUNTIME

Date: 2026-10-08
Scope: WAREHOUSE_STOCK_ADJUSTMENT_MINIMAL_RUNTIME
Mode: MINIMAL RUNTIME + REAL DB / RLS PROOF

## Gate Status

```text
WAREHOUSE_STOCK_ADJUSTMENT_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_ADJUSTMENT_REAL_DB = PASS
REAL_DB_RLS = PASS
TENANT_ISOLATION = PASS
ARCHITECTURAL_GAP_DETECTED = NO
LOGISTICS_KERNEL = SEALED_UNCHANGED
```

This slice implements and proves the next required Warehouse mutation after
Stock Transfer: same-tenant canonical Stock Adjustment.

No Stock-In runtime, Stock Transfer runtime, Platform runtime privilege model,
Logistics Kernel E7.x, UI, Finance, Reporting, Purchase, Sales/POS, Production,
Stock Out, or Reconciliation capability was modified.

## Prior Sealed Boundary

Accepted input status:

```text
STOCK_IN = PASS / REAL DB / RLS / SEALED
STOCK_TRANSFER = PASS / REAL DB / RLS / TENANT ISOLATION / SEALED
LOGISTICS_KERNEL = SEALED
ARCHITECTURAL_GAP = NO
NEXT_REQUIRED_CAPABILITY = WAREHOUSE_STOCK_ADJUSTMENT_MINIMAL_RUNTIME
```

## Adjustment Mutation Boundary

Stock Adjustment in this slice means:

```text
same tenant
same canonical item
single canonical Logistics location
non-zero quantityDelta
positive delta increases on-hand balance
negative delta decreases on-hand balance
negative delta must not make on-hand balance negative
canonical movement / ledger evidence
traceability adjustment evidence
InventoryAdjustedEvent publish path
canonical read-back
```

It does not mean:

```text
Finance/COGS posting
variance accounting policy
cross-tenant adjustment
Stock Out
Reconciliation workflow
UI flow
advanced cycle-count approval workflow
```

Canonical movement persistence uses existing Logistics movement semantics:

```text
positive delta -> ADJUSTMENT_INCREASE / INBOUND
negative delta -> ADJUSTMENT_DECREASE / OUTBOUND
```

The product-facing event contract uses:

```text
InventoryAdjustedEvent
reason = AdjustmentReason
financial_posting_status = not_posted
```

Finance context remains event metadata only. No Finance OS posting or accounting
policy is implemented.

## Required Adjustment Input Contract

The minimal facade input is defined in:

```text
src/platform/logistics/warehouse/stock-adjustment-canonical.facade.ts
```

Required command fields:

```text
tenantId
actorId
adjustmentDocument.id
adjustmentDocument.type
lines[]
```

Required line fields:

```text
warehouseSkuId
warehouseBinId
itemId
locationId
quantityDelta
unitOfMeasure
reason
```

Optional line fields:

```text
lotNumber
serialNumbers
sourceLineId
notes
unitCost
currency
valuationMethod
metadata
```

Fail-fast rules:

```text
missing tenant / actor / document = reject before mutation
missing canonical itemId = reject before mutation
missing canonical locationId = reject before mutation
quantityDelta = 0 = reject before mutation
unsupported reason = reject before mutation
serial numbers without lot number = reject before mutation
balance + negative quantityDelta < 0 = reject before mutation
```

## Runtime Implementation

Implemented:

```text
src/platform/logistics/warehouse/stock-adjustment-canonical.facade.ts
src/platform/logistics/warehouse/__tests__/stock-adjustment-canonical.facade.test.ts
```

Operational order:

```text
validate command / canonical mapping
  -> read current balance
  -> validate non-negative balance after adjustment
  -> apply canonical balance delta
  -> write movement / ledger evidence
  -> record traceability adjustment
  -> publish InventoryAdjustedEvent
  -> read back balance, movement, traceability
```

The facade is port-based like the sealed Stock-In and Stock Transfer facades. It
does not introduce a new framework, runtime role, DB schema, RLS policy, or
Logistics Kernel contract.

## Focused Runtime Proof

Focused Jest test was added for:

```text
canonical operational order
positive adjustment
negative adjustment when balance remains non-negative
missing canonical SKU fail-fast
zero quantityDelta fail-fast
negative balance fail-fast before mutation
no event publish when movement/audit persistence fails
```

Execution status:

```text
npm test -- src/platform/logistics/warehouse/__tests__/stock-adjustment-canonical.facade.test.ts --runInBand
= NOT_VERIFIED
reason = local worktree missing jest command
```

This is the same verification environment limitation already recorded for
Stock-In and Stock Transfer. It is not evidence of a Stock Adjustment runtime
failure.

## Real DB / RLS Proof

Executed against canonical `.env.test` direct PostgreSQL path using:

```text
current_user = authenticated
rolbypassrls = false
JWT context = app_metadata.tenant_id + app_metadata.role
RLS input = public.get_auth_tenant_id()
```

Proof run:

```text
runId = 20261008-adjustment-3fe16902
tenantA_get_auth_tenant_id = <TENANT_A_UUID_REDACTED_FOR_CI>
tenantB_get_auth_tenant_id = <TENANT_B_UUID_REDACTED_FOR_CI>
```

Tenant A positive proof:

```text
item read = 1
location read = 1
balance_before = 20.0000
adjustment_increase_delta = 6.7500
adjustment_decrease_delta = -4.2500
increase_update_rows = 1
decrease_update_rows = 1
balance_after = 22.5000
increase_movement = ADJUSTMENT_INCREASE / INBOUND / COMPLETED
decrease_movement = ADJUSTMENT_DECREASE / OUTBOUND / COMPLETED
traceability_update_rows = 1
traceability_compliance_status = COMPLIANT
custody_event_count = 3
```

Tenant B negative proof:

```text
read Tenant A inventory rows = 0
update Tenant A inventory rows = 0
insert Tenant A inventory = DENIED 42501
```

Cleanup:

```text
cleanup = PASS
remaining proof tenants = 0
```

## Event Persistence Boundary

```text
EVENT_PUBLISH = SOURCE/SMOKE_PATH_IMPLEMENTED
EVENT_PERSISTENCE = NOT_PROVEN
```

The slice publishes `InventoryAdjustedEvent` through the existing EventsContract
boundary. No persistent event store was introduced because it is not required by
the current Warehouse adjustment contract proof.

## Verification

```text
npm run arch:guard = PASS
focused Jest stock-adjustment facade = NOT_VERIFIED
  reason = local worktree missing jest command

REAL_DB_STOCK_ADJUSTMENT_PROOF = PASS
TENANT_A_ADJUSTMENT_RLS_PROOF = PASS
TENANT_B_NEGATIVE_RLS_PROOF = PASS
CLEANUP = PASS

npm run logistics:verify = PARTIAL_NOT_VERIFIED
  arch:guard substep = PASS
  jest logistics regression = NOT_VERIFIED (local worktree missing jest command)

npm run typecheck:changed = NOT_VERIFIED
  script exited 0, but TypeScript compiler module was missing

trailing_whitespace_check = PASS
changed_file_no_any_check = PASS
```

Additional checks are recorded after final command execution in the task
summary.

## Final Canonical Status

```text
WAREHOUSE_STOCK_ADJUSTMENT_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_ADJUSTMENT_REAL_DB = PASS
REAL_DB_RLS = PASS
TENANT_ISOLATION = PASS
ARCHITECTURAL_GAP_DETECTED = NO

STOCK_ADJUSTMENT_BALANCE = 20.0000 -> +6.7500 -> -4.2500 -> 22.5000
STOCK_ADJUSTMENT_INCREASE_MOVEMENT = ADJUSTMENT_INCREASE / INBOUND / COMPLETED
STOCK_ADJUSTMENT_DECREASE_MOVEMENT = ADJUSTMENT_DECREASE / OUTBOUND / COMPLETED
STOCK_ADJUSTMENT_TRACEABILITY = COMPLIANT / custody_event_count 3

NEXT_REQUIRED_CAPABILITY = WAREHOUSE_STOCK_OUT_MINIMAL_RUNTIME
```

## Stop Decision

```text
STOP
```

Stock Adjustment is sealed for minimal runtime, Real DB persistence/read-back,
and RLS tenant isolation. The next Warehouse mutation should be Stock Out, but
Stock Out must first select its minimal consumer semantic without opening UI,
Finance, Sales/POS, Purchase, Production, or Reconciliation unless required by
evidence.
