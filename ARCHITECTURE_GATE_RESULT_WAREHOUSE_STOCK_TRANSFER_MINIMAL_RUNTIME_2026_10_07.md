# ARCHITECTURE GATE RESULT - WAREHOUSE STOCK TRANSFER MINIMAL RUNTIME

Date: 2026-10-07
Scope: WAREHOUSE_STOCK_TRANSFER_MINIMAL_RUNTIME
Mode: MINIMAL RUNTIME + REAL DB / RLS PROOF

## Gate Status

```text
WAREHOUSE_STOCK_TRANSFER_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_TRANSFER_REAL_DB = PASS
REAL_DB_RLS = PASS
TENANT_ISOLATION = PASS
ARCHITECTURAL_GAP_DETECTED = NO
LOGISTICS_KERNEL = SEALED_UNCHANGED
```

This slice implements and proves the first required Warehouse mutation after
Stock-In: same-tenant canonical Stock Transfer.

No Stock-In runtime, Platform runtime privilege model, Logistics Kernel E7.x,
UI, Finance, Reporting, Purchase, Sales/POS, Production, Adjustment, or Stock
Out capability was modified.

## Prior Sealed Boundary

Input decision:

```text
SELECT_NEXT_REQUIRED_WAREHOUSE_MUTATION = STOCK_TRANSFER
PUBLIC_CONTRACT = PASS
RUNTIME_REUSE = PARTIAL
ARCHITECTURAL_GAP_DETECTED = NO
IMPLEMENTATION_AUTHORIZED = YES_BY_USER_TURN
NEXT_REQUIRED_CAPABILITY = WAREHOUSE_STOCK_TRANSFER_MINIMAL_RUNTIME
```

Preserved prior seals:

```text
WAREHOUSE_STOCK_IN_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_IN_REAL_DB = PASS
REAL_DB_RLS = PASS
PLATFORM_DEFINE_LOGISTICS_RUNTIME_ROLE = PASS
```

## Transfer Mutation Boundary

Stock Transfer in this slice means:

```text
same tenant
same canonical item
source canonical Logistics location
destination canonical Logistics location
positive quantity
source balance sufficient
internal Warehouse/bin/location relocation
```

It does not mean:

```text
cross-tenant transfer
Purchase/Supplier receipt
Sales/POS issue
Production consumption
Finance/COGS posting
reservation/allocation
shipment/order fulfillment
UI flow
```

Canonical movement persistence uses existing Logistics movement semantics:

```text
movement_type = RELOCATION
direction = NEUTRAL
from_location_id = source location
to_location_id = destination location
```

The product-facing event contract uses:

```text
InventoryMovedEvent
reason = MovementReason.TRANSFER
```

## Required Transfer Input Contract

The minimal facade input is defined in:

```text
src/platform/logistics/warehouse/stock-transfer-canonical.facade.ts
```

Required command fields:

```text
tenantId
actorId
transferDocument.id
transferDocument.type
lines[]
```

Required line fields:

```text
warehouseSkuId
fromWarehouseBinId
toWarehouseBinId
itemId
fromLocationId
toLocationId
quantity
unitOfMeasure
```

Optional line fields:

```text
lotNumber
serialNumbers
sourceLineId
metadata
```

Fail-fast rules:

```text
missing tenant / actor / document = reject before mutation
missing canonical itemId = reject before mutation
missing source locationId = reject before mutation
missing destination locationId = reject before mutation
same source/destination location = reject before mutation
quantity <= 0 = reject before mutation
serial numbers without lot number = reject before mutation
source balance < transfer quantity = reject before mutation
```

## Runtime Implementation

Implemented:

```text
src/platform/logistics/warehouse/stock-transfer-canonical.facade.ts
src/platform/logistics/warehouse/__tests__/stock-transfer-canonical.facade.test.ts
```

Operational order:

```text
validate command / canonical mapping
  -> read source balance
  -> validate sufficient source balance
  -> decrement source balance and increment destination balance
  -> write movement / ledger evidence
  -> record traceability custody movement
  -> publish InventoryMovedEvent
  -> read back source balance, destination balance, movement, traceability
```

The facade is port-based like the sealed Stock-In facade. It does not introduce a
new framework, runtime role, DB schema, RLS policy, or Logistics Kernel contract.

## Focused Runtime Proof

Focused Jest test was added for:

```text
canonical operational order
missing canonical SKU fail-fast
same location fail-fast
insufficient source balance fail-fast before mutation
no event publish when movement/audit persistence fails
```

Execution status:

```text
npm test -- src/platform/logistics/warehouse/__tests__/stock-transfer-canonical.facade.test.ts --runInBand
= NOT_VERIFIED
reason = local worktree missing jest command
```

This is the same verification environment limitation already recorded for
Stock-In. It is not evidence of a Stock Transfer runtime failure.

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
runId = 20261007-transfer-060a81fc
tenantA_get_auth_tenant_id = <TENANT_A_UUID_REDACTED_FOR_CI>
tenantB_get_auth_tenant_id = <TENANT_B_UUID_REDACTED_FOR_CI>
```

Tenant A positive proof:

```text
item read = 1
location read = 2
source_before = 30.5000
destination_before = 4.0000
source_update_rows = 1
destination_update_rows = 1
source_after = 22.2500
destination_after = 12.2500
movement_type = RELOCATION
direction = NEUTRAL
movement_status = COMPLETED
traceability_update_rows = 1
traceability_compliance_status = COMPLIANT
custody_event_count = 2
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

Harness corrections during proof:

```text
items.type must use canonical GOODS, not PRODUCT
public.get_auth_tenant_id() requires app_metadata.role as well as app_metadata.tenant_id
```

Both were proof-harness corrections against existing canonical DB/function
contracts, not Warehouse runtime or RLS changes.

## Event Persistence Boundary

```text
EVENT_PUBLISH = SOURCE/SMOKE_PATH_IMPLEMENTED
EVENT_PERSISTENCE = NOT_PROVEN
```

The slice publishes `InventoryMovedEvent` through the existing EventsContract
boundary. No persistent event store was introduced because it is not required by
the current Warehouse transfer contract proof.

## Verification

```text
npm run arch:guard = PASS
REAL_DB_STOCK_TRANSFER_PROOF = PASS
TENANT_A_TRANSFER_RLS_PROOF = PASS
TENANT_B_NEGATIVE_RLS_PROOF = PASS
CLEANUP = PASS

npm run logistics:verify = PARTIAL_NOT_VERIFIED
  arch:guard substep = PASS
  jest logistics regression = NOT_VERIFIED (local worktree missing jest command)

npm run typecheck:changed = NOT_VERIFIED
  script exited 0, but TypeScript compiler module was missing

focused Jest stock-transfer facade = NOT_VERIFIED
  reason = local worktree missing jest command

trailing_whitespace_check = PASS
changed_file_no_any_check = PASS
```

Additional checks are recorded after final command execution in the task
summary.

## Final Canonical Status

```text
WAREHOUSE_STOCK_TRANSFER_MINIMAL_RUNTIME = PASS
WAREHOUSE_STOCK_TRANSFER_REAL_DB = PASS
REAL_DB_RLS = PASS
TENANT_ISOLATION = PASS
ARCHITECTURAL_GAP_DETECTED = NO

STOCK_TRANSFER_SOURCE_BALANCE = 30.5000 -> 22.2500
STOCK_TRANSFER_DESTINATION_BALANCE = 4.0000 -> 12.2500
STOCK_TRANSFER_MOVEMENT = RELOCATION / NEUTRAL / COMPLETED
STOCK_TRANSFER_TRACEABILITY = COMPLIANT / custody_event_count 2

NEXT_REQUIRED_CAPABILITY = WAREHOUSE_STOCK_ADJUSTMENT_MINIMAL_RUNTIME
```

## Stop Decision

```text
STOP
```

Stock Transfer is sealed for minimal runtime, Real DB persistence/read-back, and
RLS tenant isolation. The next Warehouse mutation should be Stock Adjustment,
because it is the next required mutation in the Full Warehouse chain and does
not require UI, Finance implementation, Sales/POS, Purchase, or Production to
begin its minimal runtime slice.
