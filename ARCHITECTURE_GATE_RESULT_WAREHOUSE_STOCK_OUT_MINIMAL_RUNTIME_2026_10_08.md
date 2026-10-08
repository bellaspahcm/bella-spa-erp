# ARCHITECTURE GATE RESULT - WAREHOUSE STOCK OUT MINIMAL RUNTIME

Date: 2026-10-08
Scope: WAREHOUSE_STOCK_OUT_MINIMAL_RUNTIME
Mode: MINIMAL RUNTIME + REAL DB / RLS PROOF

## Gate Status

```text
WAREHOUSE_STOCK_OUT_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_OUT_REAL_DB = PASS
REAL_DB_RLS = PASS
TENANT_ISOLATION = PASS
ARCHITECTURAL_GAP_DETECTED = NO
LOGISTICS_KERNEL = SEALED_UNCHANGED
```

This slice implements and proves the next required Warehouse mutation after
Stock Adjustment: same-tenant generic Warehouse Stock Out.

No Stock-In runtime, Stock Transfer runtime, Stock Adjustment runtime, Platform
runtime privilege model, Logistics Kernel E7.x, UI, Finance, Reporting,
Purchase, Sales/POS, Production, or Reconciliation capability was modified.

## Prior Sealed Boundary

Accepted input status:

```text
STOCK_IN = PASS / REAL DB / RLS / SEALED
STOCK_TRANSFER = PASS / REAL DB / RLS / TENANT ISOLATION / SEALED
STOCK_ADJUSTMENT = PASS / REAL DB / RLS / TENANT ISOLATION / SEALED
LOGISTICS_KERNEL = SEALED
ARCHITECTURAL_GAP = NO
NEXT_REQUIRED_CAPABILITY = WAREHOUSE_STOCK_OUT_MINIMAL_RUNTIME
```

## Stock Out Mutation Boundary

Stock Out in this slice means:

```text
same tenant
single canonical item
single canonical Logistics source location
positive quantity
source balance sufficient
generic Warehouse issue / disposal
canonical balance decrement
canonical movement / ledger evidence
traceability outbound evidence
InventoryIssuedEvent publish path
canonical read-back
```

It does not mean:

```text
Sales/POS sale
Shipment fulfillment
Production consumption
Finance/COGS posting
customer delivery
reservation/allocation
UI flow
advanced disposal workflow
```

Canonical movement persistence uses existing Logistics movement semantics:

```text
movement_type = ISSUE
direction = OUTBOUND
from_location_id = source location
reason = disposal
```

The product-facing event contract uses:

```text
InventoryIssuedEvent
reason = disposal / damage / loss
financial_posting_status = not_posted
```

Finance context remains event metadata only. No Finance OS posting or accounting
policy is implemented.

## Required Stock Out Input Contract

The minimal facade input is defined in:

```text
src/platform/logistics/warehouse/stock-out-canonical.facade.ts
```

Required command fields:

```text
tenantId
actorId
issueDocument.id
issueDocument.type
lines[]
```

Required line fields:

```text
warehouseSkuId
warehouseBinId
itemId
locationId
quantity
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
quantity <= 0 = reject before mutation
unsupported reason = reject before mutation
serial numbers without lot number = reject before mutation
source balance < quantity = reject before mutation
```

## Runtime Implementation

Implemented:

```text
src/platform/logistics/warehouse/stock-out-canonical.facade.ts
src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts
```

Operational order:

```text
validate command / canonical mapping
  -> read source balance
  -> validate sufficient source balance
  -> decrement canonical source balance
  -> write movement / ledger evidence
  -> record traceability outbound evidence
  -> publish InventoryIssuedEvent
  -> read back balance, movement, traceability
```

The facade is port-based like the sealed Stock-In, Stock Transfer, and Stock
Adjustment facades. It does not introduce a new framework, runtime role, DB
schema, RLS policy, or Logistics Kernel contract.

## Focused Runtime Proof

Focused Jest test was added for:

```text
canonical operational order
generic disposal stock out
damage traceability event mapping
missing canonical SKU fail-fast
invalid quantity fail-fast
insufficient source balance fail-fast before mutation
no event publish when movement/audit persistence fails
```

Execution status:

```text
npm test -- src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts --runInBand
= NOT_VERIFIED
reason = local worktree missing jest command
```

This is the same verification environment limitation already recorded for prior
Warehouse slices. It is not evidence of a Stock Out runtime failure.

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
runId = 20261008-stockout-88a5ec83
tenantA_get_auth_tenant_id = <TENANT_A_UUID_REDACTED_FOR_CI>
tenantB_get_auth_tenant_id = <TENANT_B_UUID_REDACTED_FOR_CI>
```

Tenant A positive proof:

```text
item read = 1
location read = 1
balance_before = 18.0000
stock_out_quantity = 5.5000
balance_update_rows = 1
balance_after = 12.5000
movement = ISSUE / OUTBOUND / COMPLETED
movement_reason = disposal
traceability_update_rows = 1
traceability_compliance_status = COMPLIANT
custody_event_count = 2
```

Tenant B negative proof:

```text
read Tenant A inventory rows = 0
update Tenant A inventory rows = 0
insert Tenant A movement = DENIED 42501
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

The slice publishes `InventoryIssuedEvent` through the existing EventsContract
boundary. No persistent event store was introduced because it is not required by
the current Warehouse stock-out contract proof.

## Verification

```text
npm run arch:guard = PASS
focused Jest stock-out facade = NOT_VERIFIED
  reason = local worktree missing jest command

REAL_DB_STOCK_OUT_PROOF = PASS
TENANT_A_STOCK_OUT_RLS_PROOF = PASS
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
WAREHOUSE_STOCK_OUT_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_OUT_REAL_DB = PASS
REAL_DB_RLS = PASS
TENANT_ISOLATION = PASS
ARCHITECTURAL_GAP_DETECTED = NO

STOCK_OUT_BALANCE = 18.0000 -> -5.5000 -> 12.5000
STOCK_OUT_MOVEMENT = ISSUE / OUTBOUND / COMPLETED
STOCK_OUT_REASON = disposal
STOCK_OUT_TRACEABILITY = COMPLIANT / custody_event_count 2

NEXT_REQUIRED_CAPABILITY = WAREHOUSE_OPERATIONAL_CHAIN_BALANCE_LEDGER_AUDIT_READBACK
```

## Stop Decision

```text
STOP
```

Stock Out is sealed for minimal runtime, Real DB persistence/read-back, and RLS
tenant isolation. The next Warehouse node should be operational-chain read-back
for Balance + Ledger/Movement History + Audit evidence across the sealed
mutations, before opening Browser E2E or Production readiness work.
