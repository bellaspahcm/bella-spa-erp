# ARCHITECTURE GATE RESULT - WAREHOUSE CANONICAL CONTRACT TRACE AND DESIGN

Date: 2026-10-07
Scope: WAREHOUSE_CANONICAL_CONTRACT_TRACE_AND_DESIGN
Mode: CONTRACT TRACE / DESIGN ONLY

## Gate Result

WAREHOUSE_CANONICAL_CONTRACT_TRACE_AND_DESIGN = PASS

This is a design-boundary PASS. It is not runtime implementation proof, Real DB proof, RLS proof, browser E2E proof, Finance proof, or production proof.

## Non-Negotiable Scope

NO UI.
NO DB.
NO RLS CHANGE.
NO REAL DB.
NO BROWSER E2E.
NO FINANCE IMPLEMENTATION.
NO LOGISTICS KERNEL CHANGE.

No sealed E7.1/E7.2/E7.3 artifacts are modified or proposed for modification in this slice.

## Prior Sealed Boundary

Input trace:
- ARCHITECTURE_GATE_RESULT_WAREHOUSE_FULL_DEPENDENCY_TRACE_2026_10_07.md

Accepted current status:

```text
WAREHOUSE
Architecture Trace = PASS
Runtime = PARTIAL_SPLIT_RUNTIME
Logistics Kernel = SEALED
Real DB / RLS = NOT_PROVEN
Browser E2E = NOT_PROVEN
Production = NOT_PROVEN
NEXT = CONTRACT_TRACE / CONTRACT_DESIGN
```

## Source Of Truth

Governance:
- docs/governance/BELLA_AI_CODING_CONSTITUTION.md
- docs/architecture/FREEZE_POLICY.md
- docs/LOGISTICS_OS_BOUNDARY_DEFINITION.md
- docs/LOGISTICS_KERNEL_QUICK_REFERENCE.md
- docs/implementation/LOGISTICS_OS_KERNEL_COMPLETE.md

Public Logistics contracts:
- src/platform/logistics/contracts/item.contract.ts
- src/platform/logistics/contracts/inventory.contract.ts
- src/platform/logistics/contracts/traceability.contract.ts
- src/platform/logistics/contracts/events.contract.ts
- src/platform/logistics/contracts/warehouse.contract.ts

Design constraint:
- No `src/platform/logistics/contracts/location.contract.ts` exists in the current tree.
- Location currently exists as Logistics OS domain/repository surface:
  - src/platform/logistics/domain/location.types.ts
  - src/platform/logistics/domain/location.domain.ts
  - src/platform/logistics/repositories/location.repository.interface.ts
- EventsContract includes `LocationCreatedEvent`, but that does not equal a product-facing LocationContract.

Warehouse Product runtime sources:
- src/platform/logistics/warehouse/receipt.service.ts
- src/platform/logistics/warehouse/receipt.validation.ts
- src/platform/logistics/shared-kernel/types/warehouse.types.ts
- migrations/logistics/20260821_warehouse_schema.sql

Legacy inventory runtime sources:
- src/services/inventory-actions.ts
- src/services/inventory-transfer-actions.ts
- supabase/migrations/20260511500000_create_inventory_items.sql
- supabase/migrations/20260522030000_inventory_transfer_orders.sql

Generated DB evidence:
- src/types/database.types.ts

## Product Manifest

Capability being designed:
- Canonical Warehouse Product Facade / Adapter + Mapping Contract.

Purpose:
- Define exactly how a future Warehouse transaction crosses product boundary into Logistics OS contracts without modifying sealed Logistics Kernel and without treating legacy inventory tables as canonical Warehouse truth.

Non-purpose:
- Do not implement the facade.
- Do not migrate legacy data.
- Do not create DB mapping tables.
- Do not introduce Finance accounting policy.
- Do not execute runtime tests.

## Ownership Map

| Domain | Canonical Owner | Current Evidence | Design Conclusion |
| --- | --- | --- | --- |
| Warehouse identity | Warehouse Product | Boundary docs classify receipt/bin/putaway as Warehouse-specific | Warehouse facade owns transaction vocabulary and product workflow |
| SKU | Logistics OS Item/SKU | `ItemContract` defines SKU item master data | Canonical SKU key is Logistics Item/skuCode; legacy SKU is input/mapping candidate only |
| Location | Logistics OS generic Location | Location domain/repository exists; no public `location.contract.ts` file | Use Logistics location as canonical concept; facade must not invent a new OS contract in this task |
| Bin | Warehouse Product | Warehouse bin validation/runtime exists | Bin is product-owned and maps to a Logistics LocationId when runtime is implemented |
| Balance | Logistics OS Inventory | `InventoryContract` defines balance/query/movement/adjustment/allocation/ledger | Canonical balance authority is Logistics InventoryContract |
| Stock mutation | Logistics OS Inventory | `MoveInventoryRequest`, adjustment/allocation contracts, domain operations | Stock mutation must go through Logistics inventory contract/operation boundary |
| Movement / Ledger | Logistics OS Inventory/Movement | `InventoryContract` ledger; movement domain/migration; movement repository | Canonical stock history is Logistics movement/ledger, not legacy `inventory_logs` |
| Audit / Traceability | Logistics OS Traceability | `TraceabilityContract` defines chain of custody/compliance/audit trail | Canonical audit/traceability authority is TraceabilityContract |
| Domain Event | Logistics OS Events | `EventsContract` defines received/moved/allocated/released/issued/adjusted events | Future runtime emits Logistics event after persistence; Finance consumes events separately |
| Receipt / Putaway | Warehouse Product / WarehouseContract | `WarehouseContract` and receipt service exist | Product workflow owns receipt/putaway and delegates stock facts to Logistics OS |
| Finance / COGS | Finance OS | Constitution legal-source rule and EventsContract finance note | Warehouse emits facts only; no COGS implementation in Warehouse design |

## Canonical Facade Boundary

Proposed product boundary name for future work:

```text
WarehouseCanonicalFacade
```

This is a design name only. No code is created in this task.

Boundary responsibility:
- Accept Warehouse Product commands in product language: receipt, putaway, bin, warehouse actor, warehouse document reference.
- Resolve product-owned entities: receipt, receipt line, bin, warehouse-specific validation.
- Resolve Logistics-owned entities: item/SKU, generic location, inventory balance, movement, traceability, events.
- Enforce mapping before mutation: no stock mutation without canonical item id and canonical location id.
- Call existing public Logistics contracts where they exist.
- Use product-owned mapping/adaptation for Warehouse-specific fields.
- Never mutate sealed kernel internals.

Dependency direction:

```text
Warehouse Product
  -> WarehouseCanonicalFacade
  -> Logistics public contracts / existing domain boundary
  -> Logistics OS Kernel
```

Forbidden direction:

```text
Logistics OS Kernel -> Warehouse Product
```

## Required Mapping Design

### 1. SKU Mapping

Canonical owner:
- Logistics `ItemContract`.

Canonical key:
- `Item.id` / `ItemId` and `Item.identifiers.sku` or `Item.skuCode` depending on the contract surface used.

Current non-canonical input surfaces:
- `inventory_items.sku`
- `logistics_warehouse_skus.sku_code`
- UI/request SKU strings

Design rule:
- A Warehouse transaction must resolve every line item to a canonical Logistics Item before stock mutation.
- Legacy `inventory_items.sku` and `logistics_warehouse_skus.sku_code` are not authoritative by themselves.
- If the SKU cannot be resolved unambiguously to Logistics Item, the transaction must stop before mutation.

Read-back:
- Future read model should display Warehouse SKU by joining/adapting from canonical Item plus Warehouse-specific SKU presentation if needed.
- It must not infer canonical item identity from a legacy SKU string alone.

Status:
- DESIGN_PASS.
- Runtime mapping implementation: NOT_IMPLEMENTED.

### 2. Location / Bin Mapping

Canonical owner:
- Generic location semantics: Logistics OS.
- Bin semantics: Warehouse Product.

Important constraint:
- A separate product-facing `LocationContract` file does not currently exist under `src/platform/logistics/contracts/`.
- Existing location evidence is domain/repository-level, not a top-level public contract file like `ItemContract` or `InventoryContract`.

Canonical keys:
- Logistics `LocationId` for inventory balance/movement.
- Warehouse `bin_id` remains product-owned and must map to one Logistics `LocationId` before stock mutation.

Design rule:
- Warehouse bin is not the canonical inventory location by itself.
- Warehouse bin is a product-specific address that must map to a Logistics Location record/concept.
- For first minimal runtime, do not require a new kernel LocationContract. Use the existing allowed Logistics location surface only if architecture confirms it is public enough; otherwise create the mapping in Warehouse Product without changing sealed E7 files.

Read-back:
- Balance and movement history read by Logistics LocationId.
- Warehouse UI/API can adapt LocationId back to bin code/aisle/zone by Warehouse Product-owned data.

Status:
- DESIGN_PASS_WITH_CONSTRAINT.
- Public LocationContract: MISSING_AS_FILE.
- Not an architectural gap for this design task because no sealed kernel change is required to define the facade boundary.

### 3. Balance Authority

Canonical owner:
- Logistics `InventoryContract`.

Canonical write:
- Balance changes must be produced by Logistics inventory mutation semantics, not direct `stock_level` arithmetic in Warehouse Product code.

Non-canonical current surfaces:
- `inventory_items.stock_level`
- `logistics_warehouse_inventory_on_hand.quantity`

Design rule:
- Future Warehouse runtime must choose Logistics Inventory as source of truth for Warehouse canonical balance.
- Legacy balances may be read as migration/compatibility input only after an explicit mapping plan.
- Warehouse Product must not update both legacy and Logistics balances in parallel without a sealed reconciliation contract.

Read-back:
- Canonical read goes through Logistics balance query / inventory repository boundary.
- Legacy dashboard read-back remains legacy and cannot be called FULL WAREHOUSE proof.

Status:
- DESIGN_PASS.
- Runtime canonical balance write/read: NOT_IMPLEMENTED.

### 4. Movement / Ledger Authority

Canonical owner:
- Logistics inventory movement / ledger.

Canonical write:
- A stock mutation must create an immutable Logistics movement / ledger record with:
  - tenant id
  - item id
  - from/to location ids where applicable
  - quantity
  - movement type/reason
  - source document reference
  - actor/audit metadata

Non-canonical current surface:
- `inventory_logs`.

Design rule:
- `inventory_logs` is legacy operational evidence, not canonical FULL WAREHOUSE ledger.
- Warehouse Product must not claim movement history is proven until read-back comes from canonical Logistics movement/ledger.

Read-back:
- Use Logistics movement history / ledger query by tenant, item, location, source document, or movement id.

Status:
- DESIGN_PASS.
- Runtime ledger write/read: NOT_IMPLEMENTED.

### 5. Audit / Traceability Authority

Canonical owner:
- Logistics `TraceabilityContract`.

Canonical write:
- Traceability event / chain-of-custody evidence is created after successful stock persistence.
- Traceability captures item, lot/serial where applicable, location chain, actor, timestamp, reference document.

Design rule:
- Warehouse receipt/putaway can own product workflow audit, but chain-of-custody and compliance traceability belong to Logistics Traceability.
- Audit must not be treated as complete if only Warehouse comments or legacy inventory logs exist.

Read-back:
- Use TraceabilityContract for chain-of-custody/compliance report.
- Warehouse Product can adapt the traceability output into Warehouse vocabulary.

Status:
- DESIGN_PASS.
- Runtime traceability write/read: NOT_IMPLEMENTED.

### 6. Domain Event Authority

Canonical owner:
- Logistics `EventsContract`.

Canonical events for first slices:
- Stock In: `InventoryReceivedEvent`.
- Putaway/internal move: `InventoryMovedEvent`.
- Transfer: `InventoryMovedEvent` or transfer-specific movement reason through existing event shape.
- Adjustment: `InventoryAdjustedEvent`.
- Stock Out: `InventoryIssuedEvent`.
- Reservation/allocation if later required: `InventoryAllocatedEvent` / `InventoryReleasedEvent`.

Design rule:
- Events are emitted only after persistence succeeds.
- Warehouse emits Logistics facts; Finance consumes facts separately.
- Warehouse must not implement COGS, GL posting, valuation policy, or legal accounting mapping.

Read-back:
- Event history can be used for replay/reconciliation only after an event persistence/subscription path is proven.

Status:
- DESIGN_PASS.
- Runtime event publish/history: NOT_IMPLEMENTED.

## Future Warehouse Transaction Path

Canonical transaction order for future runtime:

```text
Warehouse command
  -> Resolve tenant / actor / product context
  -> Validate Warehouse-owned workflow state
  -> Resolve SKU to Logistics Item
  -> Resolve Bin to Logistics Location
  -> Authorize stock mutation
  -> Mutate Logistics Inventory balance
  -> Create Logistics Movement / Ledger entry
  -> Record Logistics Traceability / Audit evidence
  -> Emit Logistics Domain Event after persistence
  -> Return read-back from canonical balance + movement + traceability
```

For Stock In:

```text
Create/complete receipt line
  -> Warehouse validates receipt/bin/putaway
  -> SKU -> ItemContract
  -> Bin -> Logistics LocationId mapping
  -> InventoryContract increases balance at LocationId
  -> InventoryContract/Movement records RECEIPT
  -> TraceabilityContract records RECEIVED/chain evidence
  -> EventsContract emits InventoryReceivedEvent
  -> Read back InventoryBalance + movement by source receipt line
```

## First Minimal Runtime Slice Definition

FIRST_MINIMAL_RUNTIME_SLICE = STOCK_IN_CANONICAL_BALANCE_MOVEMENT_AUDIT

Why Stock In first:
- It is the earliest required business node after master data/location mapping.
- Existing Warehouse receipt source already models receipt/putaway.
- It can prove the minimal canonical chain without Finance, Sales/POS, Production, or Reservation/Allocation.

Minimal acceptance criteria for the future runtime slice:
- Given one tenant, one actor, one Warehouse receipt line, one SKU, one bin:
  - SKU resolves to canonical Logistics Item.
  - Bin resolves to canonical Logistics LocationId.
  - Stock-in mutation updates canonical Logistics Inventory balance.
  - Mutation creates canonical Logistics movement/ledger record.
  - Mutation creates traceability/audit evidence.
  - Domain event is emitted only after persistence.
  - Read-back proves balance + movement/ledger + traceability for the same tenant/source document.

Explicit non-goals for first runtime slice:
- No transfer.
- No adjustment.
- No stock out.
- No reservation/allocation.
- No Finance/COGS.
- No browser E2E until Real DB chain is proven.
- No production verification.

Verification required for that future runtime slice:
- Focused contract-boundary test.
- Focused tenant isolation test.
- Focused event-after-persistence test.
- Focused audit/traceability test.
- Real DB proof after local/unit semantics pass.
- Browser E2E only after Real DB proof and UI path are authorized.

## Architectural Gap Audit

Does this design require modifying E7.1?
- NO.

Does this design require modifying E7.2?
- NO.

Does this design require modifying E7.3?
- NO.

Does this design require creating a new Logistics kernel engine?
- NO.

Does this design require inventing Finance accounting treatment?
- NO.

Design caveat:
- Product-facing LocationContract is absent as a standalone contract file. This is a constraint for runtime planning, not a sealed-kernel architectural gap in this design slice.
- If the future runtime slice proves a public LocationContract is required and cannot be implemented outside sealed E7 artifacts, then status must become:

```text
ARCHITECTURAL GAP DETECTED
STOP
ACR / ADR
Human Architecture Review
```

Current gap status:
- ARCHITECTURAL_GAP_DETECTED = NO

## Required Output Summary

WAREHOUSE_CANONICAL_CONTRACT_TRACE_AND_DESIGN = PASS

SKU_MAPPING = Logistics ItemContract owns canonical SKU/item identity. Legacy SKU strings are inputs only.

LOCATION_BIN_MAPPING = Logistics Location owns generic location identity; Warehouse Product owns bin semantics. A standalone public LocationContract file is missing, so future runtime must use existing approved location surface or stop for architecture review.

BALANCE_AUTHORITY = Logistics InventoryContract.

MOVEMENT_LEDGER_AUTHORITY = Logistics InventoryContract / Logistics movement ledger.

AUDIT_TRACEABILITY_AUTHORITY = Logistics TraceabilityContract.

DOMAIN_EVENT_AUTHORITY = Logistics EventsContract.

WAREHOUSE_FACADE_BOUNDARY = Warehouse Product facade/adaptor translates receipt/bin/product workflow into Logistics OS item/location/inventory/movement/traceability/event contracts.

FIRST_MINIMAL_RUNTIME_SLICE = STOCK_IN_CANONICAL_BALANCE_MOVEMENT_AUDIT.

ARCHITECTURAL_GAP_DETECTED = NO.

REAL_DB_RLS = NOT_PROVEN.
BROWSER_E2E = NOT_PROVEN.
PRODUCTION = NOT_PROVEN.

NEXT_REQUIRED_CAPABILITY = MINIMAL_RUNTIME.

## Verification Results

Commands executed from worktree:
- `npm run arch:guard`: PASS.
- `git diff --check`: PASS.
- Changed/untracked TS no-any check: PASS / NOT_APPLICABLE. No `.ts` or `.tsx` files changed.

Not executed:
- Logistics Jest regression: NOT_VERIFIED in this design-only slice. Previous trace already recorded missing local Jest tooling in this worktree.
- `typecheck:changed`: NOT_VERIFIED in this design-only slice. Previous trace already recorded missing local TypeScript tooling in this worktree.

Runtime proof:
- Real DB / RLS: NOT_PROVEN.
- Browser E2E: NOT_PROVEN.
- Production: NOT_PROVEN.

STOP.
