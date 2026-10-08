# ARCHITECTURE_GATE_RESULT_WAREHOUSE_STOCK_IN_CANONICAL_ACTION_ADAPTER_2026_10_08

## Scope

Canonical Warehouse UI/API adapter slice.

This slice implements the minimum server-side entrypoint for Stock-In to call the already sealed
canonical Warehouse Stock-In facade through PostgreSQL ports.

## Boundary

WAREHOUSE_STOCK_IN = SEALED / REAL_DB_RLS_PROVEN
WAREHOUSE_STOCK_TRANSFER = SEALED / REAL_DB_RLS_PROVEN
WAREHOUSE_STOCK_ADJUSTMENT = SEALED / REAL_DB_RLS_PROVEN
WAREHOUSE_STOCK_OUT = SEALED / REAL_DB_RLS_PROVEN
OPERATIONAL_CHAIN_READBACK = SEALED

LOGISTICS_KERNEL = SEALED / UNCHANGED
LEGACY_INVENTORY_UI = NOT_CANONICAL_BROWSER_PROOF_PATH

## Root Cause

Canonical Warehouse runtime exists, but no canonical UI/API entrypoint existed.

Legacy `/dashboard/inventory` actions still use:

- `public.inventory_items`
- `public.inventory_logs`
- `public.inventory_transfer_orders`

Those legacy paths cannot be used to claim canonical Warehouse Browser E2E.

## Minimal Fix

Added a thin Server Action, explicit proofable action core, and PostgreSQL port
binding for Stock-In only:

- `src/services/warehouse-canonical-actions.ts`
- `src/platform/logistics/warehouse/postgres-stock-in-ports.ts`
- `scripts/warehouse-stock-in-action-adapter-real-db-proof.ts`

The adapter does only:

1. Resolve authenticated user.
2. Resolve tenant from `public.users`.
3. Open canonical direct PostgreSQL connection.
4. Bind runtime DB context:
   - `SET LOCAL role = 'authenticated'`
   - `request.jwt.claim.sub`
   - `request.jwt.claim.role`
   - `request.jwt.claims`
5. Call `WarehouseStockInCanonicalFacade`.
6. Commit or rollback transaction.

No UI rebuild was performed.

## Contract / Runtime Boundary

PUBLIC_CONTRACT = REUSED
CANONICAL_FACADE = REUSED
POSTGRES_PORT_BINDING = IMPLEMENTED_FOR_STOCK_IN
SERVICE_LAYER_CREATED = NO
LEGACY_UI_MIGRATION_REQUIRED = NO
LOGISTICS_KERNEL_CHANGE = NO
DB_SCHEMA_CHANGE = NO
RLS_CHANGE = NO
FINANCE_CHANGE = NO

## Evidence

WAREHOUSE_STOCK_IN_CANONICAL_ACTION_ADAPTER = PASS
DIRECT_FACADE_REUSE = YES_THROUGH_THIN_ADAPTER
THIN_ADAPTER_REQUIRED = YES
ADAPTER_SCOPE = STOCK_IN_ONLY

REAL_DB_RLS_THROUGH_ACTION_ADAPTER = PASS
BROWSER_E2E = NOT_VERIFIED
EVENT_PERSISTENCE = NOT_PROVEN

Proof command:

```text
WAREHOUSE_ENV_FILE=<original workspace .env.test>
NODE_PATH=<original workspace node_modules>
tsx scripts/warehouse-stock-in-action-adapter-real-db-proof.ts
```

Proof output:

```text
WAREHOUSE_STOCK_IN_CANONICAL_ACTION_ADAPTER_REAL_DB = PASS
runId = warehouse-action-adapter-20261007221646279
current_user = authenticated
rolbypassrls = false
Tenant A get_auth_tenant_id = <TENANT_A_UUID_REDACTED_FOR_CI>
quantity_on_hand = 11.2500
quantity_available = 11.2500
movement_type = RECEIPT
movement_direction = INBOUND
movement_status = COMPLETED
traceability_compliance_status = COMPLIANT
custody_event_count = 1
tenantB_action_result = WAREHOUSE_STOCK_IN_RUNTIME_FAILED
tenantB_read_tenantA_inventory_rows = 0
tenantB_update_tenantA_inventory_rows = 0
tenantB_insert_tenantA_movement = DENIED 42501
cleanup = PASS
remaining proof tenants = 0
```

## Verification

ARCHITECTURE_GUARD = PASS
DIFF_CHECK = PASS
CHANGED_FILE_NO_ANY = PASS

TYPECHECK_CHANGED = NOT_VERIFIED

Reason:

```text
Cannot find module '.../node_modules/typescript/bin/tsc'
```

LOGISTICS_VERIFY = PARTIAL_NOT_VERIFIED

Evidence:

```text
arch:guard = PASS
jest = not recognized
```

No runtime/browser proof is claimed from this slice.

## Canonical Output

WAREHOUSE_CANONICAL_UI_API_PATH = PARTIAL_STOCK_IN_ACTION_ADAPTER_REAL_DB_PROVEN
DIRECT_FACADE_REUSE = YES_THROUGH_THIN_ADAPTER
THIN_ADAPTER_REQUIRED = YES
ADAPTER_SCOPE = STOCK_IN_SERVER_ACTION_ONLY
LEGACY_UI_MIGRATION_REQUIRED = NO
ARCHITECTURAL_GAP_DETECTED = NO
IMPLEMENTATION_AUTHORIZED = NO_FURTHER_CODE_IN_THIS_SLICE

NEXT_REQUIRED_CAPABILITY = WAREHOUSE_CANONICAL_BROWSER_E2E_STOCK_IN_ENTRY

## Stop

STOP at Stock-In action adapter Real DB/RLS proof boundary.

Do not claim Browser E2E until a canonical UI/API entry invokes this adapter from
the browser path. Legacy Inventory UI remains outside the canonical proof path.
