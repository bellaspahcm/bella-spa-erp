# ARCHITECTURE_GATE_RESULT_WAREHOUSE_CANONICAL_BROWSER_E2E_STOCK_IN_ENTRY_2026_10_08

## Scope

Canonical Browser E2E entry for Warehouse Stock-In only.

## Authorized Chain

Browser
  -> canonical Warehouse Stock-In page
  -> canonical Stock-In Server Action adapter
  -> WarehouseStockInCanonicalFacade
  -> Logistics OS
  -> PostgreSQL + authenticated RLS
  -> read-back evidence

## Sealed Inputs

STOCK_IN_RUNTIME = SEALED
STOCK_IN_REAL_DB_RLS = PASS
STOCK_IN_ACTION_ADAPTER_REAL_DB_RLS = PASS
LOGISTICS_KERNEL = SEALED

## Boundary

NO legacy `/dashboard/inventory` proof.
NO `public.inventory_items`.
NO `public.inventory_logs`.
NO `public.inventory_transfer_orders`.
NO Transfer UI.
NO Adjustment UI.
NO Stock-Out UI.
NO Finance / COGS.
NO Logistics Kernel change.
NO DB/RLS/schema change.

## Product Manifest

Capability:

- Browser entry for canonical Warehouse Stock-In.

Out of scope:

- Full Warehouse UI rebuild.
- Legacy Inventory migration.
- Other Warehouse mutations.

## Ownership Map

Warehouse Product owns:

- Browser entry form.
- Warehouse SKU/bin UI identifiers.

Logistics OS owns:

- canonical item identity.
- canonical location identity.
- inventory balance.
- inventory movement / ledger.
- traceability.
- event contract boundary.

Platform owns:

- authenticated runtime role.
- tenant context.
- RLS.

## Contract Dependency Map

Browser page
  -> `executeCanonicalWarehouseStockInAction`
  -> `WarehouseStockInCanonicalFacade`
  -> Logistics Inventory / Traceability / Events contracts
  -> PostgreSQL canonical Logistics tables

## Change Authority

Authorized:

- minimal canonical Stock-In browser page.
- dev/E2E auth alignment for the existing action adapter.
- focused Browser E2E test and proof setup/cleanup.

Not authorized:

- Logistics Kernel edits.
- RLS/model edits.
- legacy inventory rewrite.
- broad UI framework or service layer.

## Pre-Implementation Decision

WAREHOUSE_CANONICAL_BROWSER_E2E_STOCK_IN_ENTRY = AUTHORIZED
DIRECT_LEGACY_UI_REUSE = NO
THIN_CANONICAL_BROWSER_ENTRY_REQUIRED = YES
ARCHITECTURAL_GAP_DETECTED = NO

## Expected Verification

Browser E2E must prove:

- authenticated tenant reaches canonical Stock-In page.
- form submits through action adapter.
- Stock-In returns success.
- canonical balance is shown/read back.
- movement is shown/read back.
- traceability is shown/read back.
- tenant B cannot read/update/write Tenant A evidence through authenticated RLS.
- cleanup removes proof tenants.

## Implementation Result

WAREHOUSE_CANONICAL_BROWSER_E2E_STOCK_IN_ENTRY = PASS
BROWSER_E2E_STOCK_IN = PASS_LOCAL_DEV_BROWSER_FORM_REAL_DB_RLS
AUTH_BROWSER_SESSION = LOCAL_DEV_MOCK_USER_EMAIL
CANONICAL_BROWSER_ENTRY = `/warehouse/stock-in`
DASHBOARD_ALIAS = `/dashboard/warehouse/stock-in`
LEGACY_UI_USED = NO
ACTION_ADAPTER_USED = YES
REAL_DB_RLS = PASS
TENANT_ISOLATION = PASS
ARCHITECTURAL_GAP_DETECTED = NO

Evidence:

- Browser loaded canonical Stock-In entry.
- Browser submitted a real HTML form to the Stock-In Server Action adapter.
- Server log recorded `POST /warehouse/stock-in 303`.
- Redirected success read-back:
  - `onHand = 14.75`
  - `movement = RECEIPT:COMPLETED`
  - `traceability = COMPLIANT`
- Focused Playwright proof passed:
  - `e2e/tests/33-warehouse-canonical-stock-in-browser-e2e.spec.ts`
  - `1 passed`
- Test direct-read verified authenticated non-bypass RLS:
  - `current_user = authenticated`
  - `rolbypassrls = false`
  - Tenant A read-back balance/movement/traceability PASS
  - Tenant B read Tenant A inventory = 0 rows
  - Tenant B update Tenant A inventory = 0 rows
  - Tenant B insert Tenant A movement = DENIED `42501`
  - cleanup = PASS

Notes:

- The canonical entry bypasses the legacy dashboard shell at `/warehouse/stock-in` because the current dashboard/root client shell can trigger a Next.js dev overlay invariant before form interaction.
- This does not bypass Warehouse authorization or DB/RLS: authentication is still enforced by `executeCanonicalWarehouseStockInAction`, and the E2E proof verifies the database runtime role is `authenticated` with RLS enforced.

## Status

SEALED

NEXT_REQUIRED_CAPABILITY = SELECT_CANONICAL_BROWSER_ENTRY_FOR_REMAINING_MUTATIONS
