# Logistics Reset Inventory

**Status:** 🔍 CLASSIFICATION IN PROGRESS  
**Date:** 2026-09-03  
**Scope:** Complete asset classification before controlled reset

---

## Inventory Overview

**Total files:** 78 TypeScript files  
**Migrations:** 9 SQL files (1,075 total lines)  
**Tests:** 18 test files (various coverage)  
**Directories:**
- `contracts/`: 9 files (Public API surface)
- `domain/`: 39 files (Core business logic + tests)
- `repositories/`: 11 files (Data access layer)
- `engines/`: 5 files (Engine implementations)
- `warehouse/`: 5 files (E6 Warehouse-specific)
- `shared-kernel/`: 4 files (Cross-Product types)
- `__tests__/`: 3 files (Integration tests)

---

## Four Questions Framework

### 1. What is Canonical Truth? (PRESERVE)

Assets that represent verified architectural decisions, proven domain semantics, or compliant schema.

### 2. What is Implementation Drift? (RESET)

Code that works but drifted from canonical surface through reactive fixes, workarounds, or schema misalignment.

### 3. What is Obsolete? (DELETE)

E6 legacy superseded by E7, experimental code without evidence, unnecessary abstractions.

### 4. What Needs Review? (REVIEW)

Assets with unclear status, vocabulary conflicts, or mixed canonical/drift characteristics.

---

## PRESERVE: Canonical Truth

### ✅ E7 Canonical Schema (PRESERVE - Verified)

**File:** `migrations/logistics/20260822_logistics_os_domain_kernel.sql`

**Lines:** 455  
**Status:** ✅ **CANONICAL** (E7.1, E7.2, E7.3)

**Tables:**
1. `logistics.items` - SKU master data
2. `logistics.locations` - Generic location abstraction
3. `logistics.inventory` - Balance by item/location
4. `logistics.inventory_movements` - Transaction log
5. `logistics.traceability` - Lot/serial tracking, custody chain
6. `logistics.uom` - Unit of measure (future enhancement)

**Evidence:**
- ✅ Consistent vocabulary: `base_uom CHECK ... IN ('PLT', ...)`
- ✅ RLS policies: Tenant isolation for all tables
- ✅ Domain invariants: `serial_tracked` requires `lot_tracked`
- ✅ Zero Product dependencies (no warehouse/finance FK)
- ✅ Documented design principles (OS layer, not Product layer)
- ✅ CHECK constraints enforce valid states
- ✅ Generated columns (`quantity_available`)
- ✅ Proper indexing strategy

**Classification:** **PRESERVE** (this is canonical source of truth)

---

### ✅ Domain Semantics (PRESERVE - After Audit)

**Location:** `src/platform/logistics/domain/`

**Files to preserve (39 total, audit for drift):**

#### Core Domain Logic (PRESERVE - Verified)

**Domain services:**
- `item.domain.ts` - Item/SKU creation, validation, invariants
- `inventory.domain.ts` - Inventory balance, reservation, release
- `movement.domain.ts` - Movement creation, transaction semantics
- `traceability.domain.ts` - Lot/serial tracking, custody events
- `location.domain.ts` - Location management
- `uom.domain.ts` - Unit of measure logic
- `inventory-operations.domain.ts` - Cross-entity coordination ✅ (M1.1 fixed)

**Evidence:**
- ✅ Pure TypeScript (no infrastructure dependencies)
- ✅ Result<T> pattern for errors
- ✅ Domain invariants enforced (e.g., serial requires lot)
- ✅ Zero Product knowledge (no warehouse/finance coupling)
- ✅ Test coverage exists

**Classification:** **PRESERVE** (core business logic, architecture-aligned)

#### Domain Types (PRESERVE - After Vocabulary Audit)

**Type files:**
- `item.types.ts`
- `inventory.types.ts`
- `movement.types.ts`
- `traceability.types.ts`
- `location.types.ts` ✅ (M1.3 LocationStatus extracted)
- `uom.types.ts` ⚠️ (vocabulary: `StandardUOM = 'PLT'`)

**Evidence:**
- ✅ Aligned with E7 schema
- ✅ Domain-centric (not DB-centric)
- ⚠️ UOM vocabulary needs reconciliation with contracts

**Classification:** **PRESERVE** (after UOM vocabulary audit)

#### Domain Utilities (PRESERVE)

**Files:**
- `core/result.ts` - Result<T> monad for error handling

**Classification:** **PRESERVE** (proven utility pattern)

#### Domain Tests (PRESERVE - Evidence Value)

**Test files (14 domain tests):**
- `item.domain.test.ts`
- `inventory.domain.test.ts`
- `movement.domain.test.ts`
- `traceability.domain.test.ts`
- `location.domain.test.ts`
- `uom.domain.test.ts`
- `inventory-operations.test.ts`
- `inventory-coordination.test.ts`
- `location-operations.test.ts`
- `operational-invariants.test.ts`
- `rules/*.test.ts` (5 files)

**Evidence value:**
- ✅ Tests document E7 semantics
- ✅ Cover domain invariants
- ✅ Independent of infrastructure

**Classification:** **PRESERVE** (evidence of correct domain behavior)

---

### ⚠️ Canonical Contracts (REVIEW - Vocabulary Drift)

**Location:** `src/platform/logistics/contracts/`

**Files (9 contracts):**

#### E7 Contracts (REVIEW for Vocabulary)

**Item Contract:**
- `item.contract.ts` ⚠️ **VOCABULARY CONFLICT**
  - Contains: `UnitOfMeasure.PALLET = 'PL'`
  - E7 schema: `'PLT'`
  - Domain: `StandardUOM = 'PLT'`
  - **Decision needed:** Is `'PL'` intentional public vocabulary?

**Inventory/Movement Contracts:**
- `inventory.contract.ts` - Balance/reservation operations
- `traceability.contract.ts` - Lot/serial/custody operations
- `events.contract.ts` - Domain events

**Classification:** **REVIEW** → Audit for vocabulary alignment, then PRESERVE or RECONCILE

#### E3 Contracts (PRESERVE - If Still Valid)

**Freight Audit:**
- `freight-audit.contract.ts` - E3 Economics (invoice processing)

**Classification:** **PRESERVE** (E3 is separate from E7, unless superseded)

#### Route/Shipment Contracts (REVIEW - Product vs OS)

**Files:**
- `shipment-management.contract.ts` - Shipment operations
- `route-management.contract.ts` - Route planning/optimization

**Question:** Are these OS-level or Product-level contracts?

**Classification:** **REVIEW** → Determine if E7 OS or Product layer

#### E6 Contracts (DELETE if Superseded)

**Warehouse Contract:**
- `warehouse.contract.ts` - E6 Warehouse operations

**Question:** Does E7 supersede E6 Warehouse contract?

**Classification:** **REVIEW** → DELETE if E7 canonical, PRESERVE if still needed

---

### ✅ RLS Policies (PRESERVE)

**Evidence:** All E7 tables have tenant isolation policies

**Policies (from E7 schema):**
- `items_tenant_isolation`
- `locations_tenant_isolation`
- `inventory_tenant_isolation`
- `movements_tenant_isolation`
- `traceability_tenant_isolation`
- `uom_tenant_isolation`

**Classification:** **PRESERVE** (security boundary, P0 requirement)

---

### ✅ Architecture Decisions (PRESERVE)

**Documented principles:**
1. ✅ Separate `logistics` schema (not `logistics_warehouse_*`)
2. ✅ Zero Warehouse dependencies
3. ✅ Zero Finance dependencies
4. ✅ Products reference OS, not reverse
5. ✅ RLS tenant isolation
6. ✅ Domain invariants at DB level
7. ✅ Layer boundaries: Contract → Domain → Repository → Schema
8. ✅ Domain does NOT import Contracts

**Classification:** **PRESERVE** (proven architectural boundaries)

---

## RESET: Implementation Drift

### 🔄 Repository Layer (RESET - Rebuild from Schema)

**Location:** `src/platform/logistics/repositories/`

**Files (11 repositories):**
- `item.repository.ts`
- `item.repository.interface.ts`
- `inventory.repository.ts`
- `inventory.repository.interface.ts`
- `movement.repository.ts`
- `movement.repository.interface.ts`
- `movement.repository.test.ts`
- `location.repository.interface.ts`
- `traceability.repository.interface.ts`
- `uom.repository.interface.ts`
- `index.ts`

**Why RESET:**
- Implementation written before E7 schema applied
- May reference old schema (`logistics_warehouse_*`)
- 609 diagnostics suggest type/schema drift
- Database types not regenerated after E7 migration

**Approach:**
- DELETE current implementations
- PRESERVE interfaces (domain contracts)
- REBUILD from:
  1. E7 schema (canonical)
  2. Regenerated `database.types.ts`
  3. Domain interfaces
  4. RLS-aware queries

**Classification:** **RESET** (rebuild from verified canonical surface)

---

### 🔄 Engine Layer (RESET - Rebuild from Contracts)

**Location:** `src/platform/logistics/engines/`

**Files (5 engines):**
- `freight-audit-engine.ts` - E3 (may be separate)
- `warehouse-engine.ts` - E6 (likely superseded)
- `shipment-engine.ts`
- `route-engine.ts`
- `index.ts`

**Why RESET:**
- Engines implement contracts
- If contracts have vocabulary drift, engines inherit it
- May couple to drifted repositories

**Approach:**
- PRESERVE: E3 freight-audit (if still canonical)
- REVIEW: Shipment/route engines (OS vs Product)
- DELETE: E6 warehouse engine (if E7 supersedes)
- REBUILD: From reconciled contracts + clean repositories

**Classification:** **RESET** (after contract vocabulary reconciliation)

---

### ❌ Type Import Workarounds (DELETE)

**Evidence from Phase 1L, 1M:**
- Import corrections (Batches A-D)
- `Movement` → `InventoryMovement` fix
- `CustodyEvent` import from wrong module
- `LocationStatus` inline type extraction

**Why DELETE:**
- These are symptoms of drift, not architecture
- Will disappear when rebuilt from canonical surface
- No value in preserving reactive fixes

**Classification:** **DELETE** (let clean rebuild eliminate these)

---

### ❌ Generated Types (REGENERATE)

**File:** `src/platform/logistics/types/database.types.ts` (inferred location)

**Why REGENERATE:**
- Likely reflects old schema (`logistics_warehouse_*`)
- E7 schema applied 2026-08-22
- Types must reflect `logistics.*` tables

**Action:**
```bash
npm run db:types
```

**Classification:** **REGENERATE** (not PRESERVE or DELETE - replace with current)

---

## DELETE: Obsolete Assets

### ❌ E6 Legacy (DELETE if E7 Supersedes)

**Location:** `src/platform/logistics/warehouse/`

**Files (5 E6 warehouse-specific):**
- `receipt.service.ts` - E6 receipt implementation
- `receipt.validation.ts` - E6 receipt validation
- `service-path.test.ts`
- `state-machine.test.ts`
- `workflow-integration.test.ts`

**Evidence:**
- All marked: `E6 Economics Experiment - R1: Receive Inventory`
- Warehouse-specific (not OS-level)
- May reference old schema

**Question:** Does E7 OS supersede E6 Warehouse Product?

**Decision criteria:**
- If E7 is canonical path → DELETE E6
- If E6 still needed for specific Product → PRESERVE (but separate)

**Classification:** **DELETE** (conditional on E7 supersession confirmation)

---

### ❌ E6 Migrations (DELETE if Superseded)

**Files:**
- `20260821_warehouse_schema.sql` (208 lines) - E6 Warehouse schema
- `20260821_create_freight_audit_tables.sql` - E3 Freight (may keep)
- `20260821_create_discrepancies_table.sql`
- `20260821_create_carrier_rates_table.sql`
- `20260821_create_accessorial_rates_table.sql`
- `20260822_add_vendors_table.sql`
- `20260822_add_receipt_unique_constraint.sql`
- `20260821_add_accessorial_subtype.sql`

**Tables created (E6):**
- `logistics_warehouse_skus`
- `logistics_warehouse_bins`
- `logistics_warehouse_receipts`
- `logistics_warehouse_receipt_line_items`
- `logistics_warehouse_inventory_on_hand`
- `logistics_warehouse_movements`
- `logistics_warehouse_vendors`

**Evidence:**
- Schema prefix: `logistics_warehouse_*` (Product layer, not OS)
- Created before E7 (`20260821` vs `20260822`)
- E7 schema has OS-level equivalents (`logistics.items`, `logistics.inventory`, etc.)

**Question:** Does E7 make E6 schema obsolete?

**Classification:** **DELETE** (conditional - if E7 canonical, E6 migrations should be rolled back or marked deprecated)

---

### ❌ E3 Tables (REVIEW - May Be Separate Concern)

**E3 Freight Audit tables:**
- `log_freight_invoices`
- `log_invoice_line_items`
- `log_discrepancies`
- `log_carrier_rates`
- `log_accessorial_rates`

**Question:** Is E3 Freight Audit separate from E7 Logistics OS?

**Classification:** **REVIEW** → If E3 is independent capability, PRESERVE; if superseded, DELETE

---

## REVIEW: Needs Audit

### ⚠️ Shared Kernel Types (REVIEW - Product vs OS)

**Location:** `src/platform/logistics/shared-kernel/types/`

**Files:**
- `types.ts` - Generic engine types
- `warehouse.types.ts` - E6 Warehouse-specific types
- `freight-audit.types.ts` - E3 Freight-specific types
- `index.ts`

**Question:**
- Are these "shared kernel" or Product-specific?
- Do they belong in E7 OS layer?

**Classification:** **REVIEW** → Audit for OS vs Product classification

---

### ⚠️ Integration Tests (REVIEW - Coupling)

**Location:** `src/platform/logistics/__tests__/`

**Files:**
- `shipment-engine.test.ts` (399 lines)
- `shipment-engine.integration.test.ts` (417 lines)
- `shipment-engine-diagnostic.test.ts` (127 lines)

**Question:**
- Do these tests couple to drifted implementation?
- Or do they verify E7 semantics?

**Classification:** **REVIEW** → Preserve if evidence-based, delete if coupling to drift

---

### ⚠️ UOM Vocabulary (REVIEW - BLOCKED)

**Conflict identified:**
- Contract: `UnitOfMeasure.PALLET = 'PL'`
- Schema: `base_uom ... IN ('PLT', ...)`
- Domain: `StandardUOM = 'PLT'`

**Investigation approved, remediation blocked:**
1. Who consumes contract `UnitOfMeasure`?
2. Is `'PL'` intentional public vocabulary?
3. Is this external API vs internal domain distinction?

**Classification:** **REVIEW** → Investigation in progress, decision pending

---

## Classification Summary

### By Action

| Action | Count | Assets |
|--------|-------|--------|
| **PRESERVE** | ~30 | E7 schema, domain logic, domain tests, RLS, architecture docs |
| **RESET** | ~25 | Repositories, engines, reactive import fixes |
| **DELETE** | ~15 | E6 legacy (if superseded), workarounds, obsolete migrations |
| **REVIEW** | ~10 | Contracts (vocabulary), shared-kernel, E3 tables, integration tests |

### By Category

| Category | PRESERVE | RESET | DELETE | REVIEW |
|----------|----------|-------|--------|--------|
| **Schema** | E7 (1 file) | - | E6 migrations (8 files) | - |
| **Domain** | Logic + Types + Tests (39 files) | - | - | - |
| **Contracts** | - | - | - | All 9 (vocabulary audit) |
| **Repositories** | Interfaces | Implementations (11 files) | - | - |
| **Engines** | - | All (5 files) | - | - |
| **Warehouse (E6)** | - | - | All (5 files) | - |
| **Tests** | Domain tests (14 files) | - | - | Integration (3 files) |

---

## Decision Points (USER DECISIONS RECEIVED)

### 1. E7 vs E6 Supersession - ✅ DECIDED

**Decision:** E7 is canonical Logistics OS direction. E6 is not continued implementation path.

**Classification:**
- ✅ E7 canonical implementation → **PRESERVE**
- 🔄 E6 implementation code → **RESET/DELETE** (after dependency verification)
- ✅ E6 migrations/schema → **PRESERVE AS LEGACY EVIDENCE** (do NOT destructively delete)
- ⚠️ E6 runtime registration/import → Verify, then remove from active path

**Principle:** Reset implementation ≠ delete schema history

**Impact:** E6 warehouse code (5 files) excluded from rebuild; E6 schema preserved as documentation

---

### 2. UOM Vocabulary Reconciliation - ⏸️ DEFERRED TO G0.5

**Status:** Evidence collection in progress

**Question:** Is contract `'PL'` intentional public vocabulary separate from internal `'PLT'`?

**G0.5 will investigate:**
- Contract consumer boundary analysis
- Public API usage evidence
- Runtime vocabulary expectations
- External integration requirements

**No action until evidence gathered**

---

### 3. E3 Freight Audit Status - ⏸️ EXCLUDED FROM CORE RESET

**Decision:** E3 is separate from Logistics reset scope until ownership proven

**Classification:**
- If E3 is independent capability → Keep separate
- If ownership unclear → REVIEW (do not guess)

**Rationale:** Logistics reset should not accidentally reset unrelated experiments

**Impact:** E3 contracts/engines/tables excluded from controlled reset

---

### 4. Shipment/Route Contracts - ⏸️ REVIEW BEFORE REBUILD

**Decision:** Ownership evidence required before rebuild

**Questions:**
- Are these OS-level or Product-level?
- Do they belong in E7 Logistics OS?

**Approach:** Evidence collection, not assumption

**Impact:** Shipment/Route excluded from initial vertical slices

---

## Controlled Reset Workflow

**After inventory approval:**

### Phase 1: Canonical Surface Verification

**Actions:**
1. ✅ Confirm E7 schema is applied to database
2. 🔄 Regenerate `database.types.ts` from current schema
3. ⚠️ Audit contracts for vocabulary drift (UOM, others)
4. ✅ Reconcile vocabulary conflicts (user decision on PL/PLT)
5. ✅ Run G0.5 checks on canonical surface
6. 🟢 Achieve G0.5 GREEN before any rebuild

**Gates:** All G0.5 checks must pass

---

### Phase 2: Deletion (After User Approval)

**Actions:**
1. DELETE E6 warehouse code (if E7 supersedes)
2. DELETE E6 migrations (rollback or deprecate)
3. DELETE repository implementations (interfaces remain)
4. DELETE engine implementations (after contract reconciliation)
5. DELETE type import workarounds

**Evidence:** Inventory approval + supersession confirmation

---

### Phase 3: Vertical Slice Rebuild

**Order:**
1. **Slice 1:** Item/SKU Management
   - Rebuild: Item repository → Item engine → Tests
   - Verify: Gate B GREEN, no vocabulary drift
2. **Slice 2:** Location Management
   - Rebuild: Location repository → Tests
3. **Slice 3:** Inventory Balance
   - Rebuild: Inventory repository → Inventory operations → Tests
4. **Slice 4:** Movement/Traceability
   - Rebuild: Movement + Traceability repositories → Tests
5. **Slice 5:** UOM (after vocabulary reconciliation)
   - Rebuild: UOM repository → Tests

**Per-slice gates:**
- G0.5 GREEN (before coding)
- Gate B (TypeScript check)
- Architecture Guard
- Contract-Schema conformance
- Tests GREEN

---

## Preservation Strategy

### What to Keep Exactly As-Is

1. ✅ `migrations/logistics/20260822_logistics_os_domain_kernel.sql`
2. ✅ All domain logic files (`domain/*.domain.ts`)
3. ✅ All domain test files (`domain/**/*.test.ts`)
4. ✅ Domain type files (after UOM vocabulary audit)
5. ✅ RLS policies
6. ✅ Architecture documentation

### What to Preserve But Modify

1. ⚠️ Contracts: Preserve structure, reconcile vocabulary
2. ⚠️ Repository interfaces: Preserve, implementations rebuild

### What to Document Then Delete

1. ❌ E6 warehouse code: Document supersession, then delete
2. ❌ E6 migrations: Mark deprecated or rollback
3. ❌ Import workarounds: Document in forensics, then delete

---

## Risk Mitigation

### Risk 1: Accidentally Delete Domain Logic

**Mitigation:**
- ✅ PRESERVE classification for all `domain/*.domain.ts`
- ✅ PRESERVE all domain tests
- ⚠️ Only delete repositories/engines (infrastructure)

### Risk 2: Lose Valuable Evidence

**Mitigation:**
- ✅ PRESERVE all tests documenting E7 semantics
- ✅ Keep Phase 1K, 1L, 1M forensics
- ✅ Document supersession decisions before deletion

### Risk 3: Incomplete Inventory

**Mitigation:**
- ✅ Four-question framework applied to ALL 78 files
- ⚠️ REVIEW classification for ambiguous assets
- 🛑 User approval required before any deletion

---

## Next Steps (PHASE 1: G0.5 CANONICAL VERIFICATION)

### ✅ Immediate (AUTHORIZED)

**Phase 1: Canonical Surface Verification (G0.5 Field Test)**

**Objective:** Verify E7 canonical truth is production-ready before any rebuild

**G0.5 Check Sequence:**

1. **Schema Presence Verification**
   ```bash
   # Check E7 tables exist in database
   # Evidence: migrations/logistics/20260822_logistics_os_domain_kernel.sql
   ```
   - ✅ Expected: 6 tables (items, locations, inventory, inventory_movements, traceability, uom)
   - ✅ RLS policies present
   - ✅ Constraints enforced

2. **Generated Types Alignment**
   ```bash
   # Regenerate database types from current schema
   npm run db:types
   ```
   - ⚠️ Expected: `Database['logistics']['Tables']` reflects E7 schema
   - 🔴 Risk: May currently reflect old schema

3. **Vocabulary Conformance Investigation** (Evidence Collection)
   - Contract `UnitOfMeasure.PALLET = 'PL'` consumers
   - Public API surface analysis
   - Runtime vocabulary usage
   - External integration requirements
   - **Output:** Evidence report (not remediation)

4. **Dependency Direction Verification**
   - Confirm: Domain does NOT import Contracts
   - Verify: E6 not in active import path
   - Check: Repository → Domain boundaries

5. **E6/E7 Active Boundary Analysis** (Evidence Collection)
   - Search E6 warehouse code consumers
   - Search E6 registrations
   - Search E6 runtime references
   - **Output:** Dependency graph (safe deletion scope)

**If ANY check FAILS:** STOP, reconcile canonical surface before rebuild

**If ALL checks GREEN:** Authorize Phase 2 (Controlled Deletion)

---

### After G0.5 GREEN

**Phase 2: Controlled Deletion** (After user approval of evidence)
- DELETE E6 implementation code (after dependency verification)
- PRESERVE E6 schema as legacy evidence
- DELETE repository implementations (interfaces remain)
- Document deletion decisions

**Phase 3: Vertical Slice Rebuild** (One slice at a time)
1. Item/SKU Management
2. Location Management  
3. Inventory Balance
4. Movement/Traceability
5. UOM (after vocabulary evidence review)

**Each slice:** G0.5 → Implementation → Gates → Tests → Next slice

---

## Success Criteria

**Inventory is successful if:**
1. ✅ Every asset classified (PRESERVE/RESET/DELETE/REVIEW)
2. ✅ Canonical truth identified and protected
3. ✅ Decision points documented with evidence
4. ✅ Risk mitigation strategies defined
5. ✅ User approval obtained before any deletion/modification

**Controlled reset is successful if:**
1. ✅ All PRESERVE assets remain intact
2. ✅ All DELETE assets removed with documentation
3. ✅ All RESET assets rebuilt from canonical surface
4. ✅ G0.5 GREEN before and after each vertical slice
5. ✅ Gate B GREEN (no type errors) after rebuild
6. ✅ No E6/E7 mixing, no vocabulary drift, no architectural violations

---

**Status:** ✅ R0 INVENTORY COMPLETE → 🔍 G0.5 CANONICAL VERIFICATION (PHASE 1)  
**Classification:** 30 PRESERVE / 25 RESET / 15 DELETE (conditional) / 10 REVIEW  
**User Decisions:** E7 canonical (E6 legacy preserved), UOM/E3/Shipment deferred to evidence  
**Next action:** Execute Phase 1 G0.5 checks (schema, types, vocabulary, dependencies, E6 boundary)

**Last Updated:** 2026-09-03
