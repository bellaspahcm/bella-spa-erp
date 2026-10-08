# ARCHITECTURE GATE RESULT - WAREHOUSE CANONICAL UI/API ADAPTER DECISION

Date: 2026-10-08
Scope: WAREHOUSE_CANONICAL_UI_API_ADAPTER_DECISION
Mode: DECISION / ADAPTER BOUNDARY TRACE

## Gate Status

```text
WAREHOUSE_CANONICAL_UI_API_ADAPTER_DECISION = PASS

WAREHOUSE_CANONICAL_UI_API_PATH = NOT_AVAILABLE
DIRECT_FACADE_REUSE = NO
THIN_ADAPTER_REQUIRED = YES
ADAPTER_SCOPE = SERVER_ACTION_OR_API_ADAPTER + CANONICAL_POSTGRES_PORT_BINDING
LEGACY_UI_MIGRATION_REQUIRED = NO
ARCHITECTURAL_GAP_DETECTED = NO
IMPLEMENTATION_AUTHORIZED = YES_FOR_NEXT_THIN_ADAPTER_SLICE
```

This decision answers one question:

```text
Can the current Warehouse UI/API call the sealed canonical Warehouse facades directly?
```

Answer:

```text
NO.
```

The canonical Warehouse facades are proven runtime units, but they require
explicit ports for balance, movement/ledger, traceability, event publish, and
read-back. The existing browser-facing inventory actions do not provide those
ports and still mutate legacy public inventory tables.

## Prior Sealed Boundary

```text
STOCK_IN = SEALED / REAL DB / RLS
STOCK_TRANSFER = SEALED / REAL DB / RLS
STOCK_ADJUSTMENT = SEALED / REAL DB / RLS
STOCK_OUT = SEALED / REAL DB / RLS
OPERATIONAL_CHAIN_BALANCE_LEDGER_AUDIT_READBACK = SEALED
BROWSER_E2E = BLOCKED_NOT_PROVEN
REASON = NO_CANONICAL_WAREHOUSE_UI_OR_API_ADAPTER
```

Do not reopen these sealed runtime nodes.

## Non-Goals

```text
NO Warehouse UI rebuild
NO legacy Inventory UI migration
NO DB schema change
NO RLS change
NO Logistics Kernel change
NO Finance / COGS
NO Sales / POS
NO Reporting
NO Reconciliation business feature
NO Browser E2E claim before a canonical UI/API path exists
```

## Existing UI/API Entry Points

### Legacy Inventory Server Actions

Files:

```text
src/services/inventory-actions.ts
src/services/inventory-transfer-actions.ts
src/app/dashboard/inventory/hooks/useInventoryPageState.ts
```

Evidence:

```text
src/services/inventory-actions.ts:
  public.inventory_items
  public.inventory_logs
  public.package_materials
  restockItem(...)
  saveMonthlyReconciliation(...)

src/services/inventory-transfer-actions.ts:
  public.inventory_transfer_orders
  public.inventory_items
  public.inventory_logs
  createInventoryRequest(...)
  approveAndShipTransfer(...)
  confirmTransferReceipt(...)

src/app/dashboard/inventory/hooks/useInventoryPageState.ts:
  calls legacy inventory actions above
```

Decision:

```text
REUSE_AS_CANONICAL_WAREHOUSE_PATH = NO
```

Reason: these actions bypass sealed canonical Warehouse facades and do not write
`logistics.inventory`, `logistics.inventory_movements`, or
`logistics.traceability`.

### Operations Inventory Dashboard

File:

```text
src/app/dashboard/operations/inventory/page.tsx
```

Evidence:

```text
fetches /api/intelligence/operational/inventory-status
read-only operational analytics
no canonical Warehouse mutation path
```

Decision:

```text
REUSE_AS_CANONICAL_WAREHOUSE_MUTATION_PATH = NO
```

## Existing Canonical Runtime Entry Points

Files:

```text
src/platform/logistics/warehouse/stock-in-canonical.facade.ts
src/platform/logistics/warehouse/stock-transfer-canonical.facade.ts
src/platform/logistics/warehouse/stock-adjustment-canonical.facade.ts
src/platform/logistics/warehouse/stock-out-canonical.facade.ts
```

These are the correct runtime entry points, but they are not directly callable
from UI/API without ports:

```text
balance
movementLedger
traceability
events
readBack
```

Therefore direct reuse is possible only after a thin adapter binds these ports
to the canonical database/runtime context.

## Data Access Constraint

Canonical persistence path already proven:

```text
direct PostgreSQL
  -> SET LOCAL role = authenticated
  -> SET LOCAL request.jwt.claims with authenticated user context
  -> public.get_auth_tenant_id()
  -> logistics.items
  -> logistics.locations
  -> logistics.inventory
  -> logistics.inventory_movements
  -> logistics.traceability
```

PostgREST/Supabase REST evidence:

```text
REST logistics.items = PGRST106 Invalid schema: logistics
REST logistics.locations = PGRST106 Invalid schema: logistics
REST logistics.inventory = PGRST106 Invalid schema: logistics
REST logistics.inventory_movements = PGRST106 Invalid schema: logistics
```

Decision:

```text
SUPABASE_REST_DIRECT_ADAPTER = NO
DIRECT_POSTGRES_PORT_BINDING_REQUIRED = YES
```

This does not require exposing `logistics` through REST and does not require a
new RPC/service layer. It requires a small server-side adapter that reuses the
already proven direct PostgreSQL RLS pattern.

## Mutation Decision Matrix

### Stock-In

```text
EXISTING_UI_ENTRY = /dashboard/inventory restock/add item legacy path
EXISTING_API/ACTION = src/services/inventory-actions.ts
CAN_CALL_CANONICAL_FACADE_DIRECTLY = NO
THIN_ADAPTER_REQUIRED = YES
MINIMAL_ADAPTER_LOCATION = src/services/warehouse-canonical-actions.ts or focused /api/warehouse/stock-in route
LEGACY_DEPENDENCY = public.inventory_items + public.inventory_logs
IMPLEMENTATION_REQUIRED = YES
```

### Stock-Transfer

```text
EXISTING_UI_ENTRY = /dashboard/inventory transfer request/receipt legacy path
EXISTING_API/ACTION = src/services/inventory-transfer-actions.ts
CAN_CALL_CANONICAL_FACADE_DIRECTLY = NO
THIN_ADAPTER_REQUIRED = YES
MINIMAL_ADAPTER_LOCATION = src/services/warehouse-canonical-actions.ts or focused /api/warehouse/stock-transfer route
LEGACY_DEPENDENCY = public.inventory_transfer_orders + public.inventory_items + public.inventory_logs
IMPLEMENTATION_REQUIRED = YES
```

### Stock-Adjustment

```text
EXISTING_UI_ENTRY = /dashboard/inventory restock/adjustment-style legacy action
EXISTING_API/ACTION = src/services/inventory-actions.ts
CAN_CALL_CANONICAL_FACADE_DIRECTLY = NO
THIN_ADAPTER_REQUIRED = YES
MINIMAL_ADAPTER_LOCATION = src/services/warehouse-canonical-actions.ts or focused /api/warehouse/stock-adjustment route
LEGACY_DEPENDENCY = public.inventory_items + public.inventory_logs
IMPLEMENTATION_REQUIRED = YES
```

### Stock-Out

```text
EXISTING_UI_ENTRY = NOT_FOUND for canonical generic stock-out
EXISTING_API/ACTION = NOT_FOUND for canonical generic stock-out
CAN_CALL_CANONICAL_FACADE_DIRECTLY = NO
THIN_ADAPTER_REQUIRED = YES
MINIMAL_ADAPTER_LOCATION = src/services/warehouse-canonical-actions.ts or focused /api/warehouse/stock-out route
LEGACY_DEPENDENCY = NONE_PROVEN_FOR_CANONICAL_STOCK_OUT
IMPLEMENTATION_REQUIRED = YES
```

## Minimal Adapter Shape

The minimum sufficient adapter is:

```text
Browser/UI
  -> thin server action or route handler
  -> authenticate current user
  -> resolve trusted user id and tenant context from server-side auth
  -> open direct PostgreSQL transaction
  -> SET LOCAL role = authenticated
  -> SET LOCAL request.jwt.claims from trusted authenticated user context
  -> instantiate sealed Warehouse facade with Postgres ports
  -> execute one mutation command
  -> commit only on ok result
  -> rollback on failure
  -> return small action result
```

Required properties:

```text
NO client-supplied tenant trust
NO legacy public.inventory_* writes
NO service role bypass claim
NO direct Logistics Kernel modification
NO new framework
NO UI rebuild
```

## Adapter Location Decision

Preferred location:

```text
src/services/warehouse-canonical-actions.ts
```

Reason:

```text
Existing product-facing action boundary lives in src/services/*-actions.ts.
Server Actions can be consumed by the current UI or by a small future UI slice
without introducing a new route tree.
```

Allowed alternative if Browser E2E needs HTTP-level interaction first:

```text
src/app/api/warehouse/<mutation>/route.ts
```

But an API route is not required for the first adapter slice if Server Actions
are enough for the UI surface.

## Implementation Boundary

The next implementation must not start by migrating `/dashboard/inventory`.

Correct order:

```text
1. Create the thin canonical action/adapter boundary.
2. Bind one mutation first through direct PostgreSQL ports.
3. Prove action -> facade -> Real DB/RLS -> read-back.
4. Only then wire a minimal browser surface or Playwright flow.
```

Because all four mutations are already sealed at facade/runtime level, the first
adapter slice should choose the lowest-risk mutation:

```text
FIRST_ADAPTER_MUTATION = STOCK_IN
```

Reason:

```text
Stock-In has the simplest balance mutation, prior Real DB/RLS proof, and does
not require source balance sufficiency checks across two locations.
```

After Stock-In adapter proof passes, reuse the same adapter/port pattern for:

```text
Stock-Transfer
Stock-Adjustment
Stock-Out
```

## Architectural Gap Check

```text
ARCHITECTURAL_GAP_DETECTED = NO
```

Reason:

```text
The gap is not in Logistics Kernel or Warehouse runtime. It is an adoption
boundary: UI/API has not yet been wired to the sealed canonical facades.
```

## Final Canonical Output

```text
WAREHOUSE_CANONICAL_UI_API_PATH = NOT_AVAILABLE
DIRECT_FACADE_REUSE = NO
THIN_ADAPTER_REQUIRED = YES
ADAPTER_SCOPE = MINIMAL_CANONICAL_SERVER_ACTION_ADAPTER_WITH_POSTGRES_PORTS
LEGACY_UI_MIGRATION_REQUIRED = NO
ARCHITECTURAL_GAP_DETECTED = NO
IMPLEMENTATION_AUTHORIZED = YES_FOR_NEXT_THIN_ADAPTER_SLICE

NEXT_REQUIRED_CAPABILITY =
  WAREHOUSE_STOCK_IN_CANONICAL_ACTION_ADAPTER
```

## Stop Decision

```text
STOP_AT_DECISION_BOUNDARY
```

Do not claim Browser E2E yet. The next slice is implementation of the smallest
canonical action adapter, starting with Stock-In, followed by Real DB/RLS
read-back proof through that adapter.
