# E7 Pre-Execution Audit: Warehouse Domain Analysis

**Date:** 2026-08-22  
**Status:** In Progress  
**Purpose:** Verify OS boundary BEFORE writing code

---

## Strategic Context

> **"E7 không phải xây OS bằng cách chuyển 5 capability từ Warehouse lên. E7 là lần đầu tiên Bella thực sự xây OS đứng giữa Platform và Product."**

**E6 proved:** Bella can build Products fast  
**E7 must prove:** Bella can build an OS that Products actually benefit from

---

## Critical Questions E7 Must Answer

### E6 Asked:
> **"Bella build Warehouse nhanh đến đâu?"**

**Answer:** 15 requirements in 0.452 days, 2,700 LOC, 0% code reuse

---

### E7 Asks:
> **"Bella có thể xây một Logistics OS mà Warehouse thực sự trở thành một Product sử dụng OS hay không?"**

**This is fundamentally different.**

E7 is NOT "add 5 more requirements to Warehouse."  
E7 IS "build OS layer, then verify Product adoption."

---

### E8/E9 Will Ask:
> **"Product thứ hai/thứ ba có thực sự rẻ hơn nhờ OS không?"**

**Cannot answer until E7 proves OS works for Product #1.**

---

## The Three Prerequisites (Before Code)

### 1. ✅ Freeze E6 (DONE)

**E6 is now immutable control group:**
- 2,700 LOC baseline
- T₆ = 0.452d
- C₆ = 0.0114d
- 15/15 requirements
- 0% code reuse

**DO NOT:**
- ❌ Refactor Warehouse to "prepare for OS"
- ❌ Clean up Warehouse code to make E7 easier
- ❌ Modify E6 baseline to make reuse % look better

**IF Warehouse drops to 1,600 LOC after E7:**
→ This MUST be result of OS built correctly
→ NOT result of adjusting baseline

---

### 2. ⏳ Audit Warehouse Domain (THIS DOCUMENT)

**Goal:** Classify every capability by boundary

**NOT asking:**
> "Code nào có thể reuse?"

**ASKING:**
> "Capability nào thuộc bản chất của Logistics và sẽ tồn tại dù Product là Warehouse, Fulfillment, 3PL hay Transportation?"

---

### 3. ⏳ Verify Finance OS Boundary (BEFORE E7.4)

**Healthcare → Finance pattern is proven.**

**Logistics MUST follow same principle:**
- Logistics OS emits business events
- Finance OS interprets financial meaning
- Logistics OS does NOT know Debit/Credit

**This is OS-to-OS architecture, not Product-to-Product integration.**

---

## Warehouse Domain Audit — COMPLETE

**Audit Date:** 2026-08-22  
**Files Audited:**
- `migrations/logistics/20260821_warehouse_schema.sql` (6 tables)
- `migrations/logistics/20260822_add_vendors_table.sql` (vendors)
- `scripts/e6/test-r*.mjs` (15 test files, R1-R15)

**Method:** Domain reasoning (not code similarity)

---

### Audit Findings: Table Classification

| Table | Platform | Logistics OS | Warehouse Product | Rationale |
|-------|----------|--------------|-------------------|-----------|
| **logistics_warehouse_skus** | | ✅ Item/SKU | | Every Logistics Product needs Item master → Extract to `logistics.items` |
| **logistics_warehouse_bins** | | | ✅ Bin | Warehouse-specific storage hierarchy (Zone/Aisle/Rack/Bin) → Keep in Product |
| **logistics_warehouse_receipts** | | | ✅ Receipt (GRN) | Warehouse-specific inbound document → Keep in Product |
| **logistics_warehouse_receipt_line_items** | | | ✅ Receipt Lines | Warehouse-specific discrepancy tracking → Keep in Product |
| **logistics_warehouse_inventory_on_hand** | | ⚠️ Inventory Balance | | Core Logistics primitive (on-hand, location) → Extract to `logistics.inventory` |
| **logistics_warehouse_movements** | | ✅ Movement Log | | Transaction log for all inventory operations → Extract to `logistics.inventory_movements` |
| **logistics_warehouse_vendors** | | | ⚠️ Vendor | Procurement-specific (NOT core Logistics) → Keep in Product (or future Procurement OS) |

**Key Finding:** ~40% of Warehouse tables contain OS-level primitives embedded in Product schema.

---

### Audit Findings: Capability Classification

#### ✅ Platform Capabilities (Already Correct)

| Capability | Current Location | Status | Notes |
|-----------|------------------|--------|-------|
| **Tenant isolation** | Platform (RLS policies) | ✅ Correct | All tables have `tenant_id` + RLS |
| **Audit trail** | Platform (`created_at`, `updated_at`) | ✅ Correct | Trigger pattern reused |
| **RBAC** | Platform | ✅ Correct | Not implemented in E6 (experiment scope) |

**No changes needed for Platform layer.**

---

#### ✅ Logistics OS Capabilities (Extract from Product)

##### P0: Domain Kernel

**1. Item / SKU Master Data**

**Current:** `logistics_warehouse_skus`
- Columns: `id`, `tenant_id`, `sku_code`, `description`, `unit_cost`, `uom`, `status`

**Should be:** `logistics.items` (OS)

**Test:** 
- Fulfillment needs SKU? ✅ YES
- 3PL needs SKU? ✅ YES
- Returns needs SKU? ✅ YES

**Verdict:** ✅ **Extract to Logistics OS**

**Attributes to add in OS:**
- `lot_tracked` (boolean)
- `serial_tracked` (boolean)
- `expiry_tracked` (boolean)
- `item_type` (GOODS, SERVICE, KIT)
- `weight_kg`, `dimensions` (physical attributes)

---

**2. Inventory Balance**

**Current:** `logistics_warehouse_inventory_on_hand`
- Columns: `sku_id`, `bin_id`, `quantity`

**Should be:** `logistics.inventory` (OS)

**Test:**
- Fulfillment needs on-hand quantity? ✅ YES
- 3PL needs inventory balance? ✅ YES
- Returns needs inventory state? ✅ YES

**Verdict:** ✅ **Extract to Logistics OS**

**Changes needed:**
- Replace `bin_id` → `location_id` (generic)
- Add `location_type` (WAREHOUSE, STORE, 3PL, TRANSIT, etc.)
- Add `quantity_reserved` (allocation support)
- Add `quantity_available` (computed: on_hand - reserved)
- Add `status` (AVAILABLE, QUARANTINE, DAMAGED, EXPIRED)
- Add traceability fields (`lot_number`, `serial_number`, `expiry_date`)

**Key insight:** Warehouse Product will map `bin_id` → OS `location_id`.

---

**3. Inventory Movement (Transaction Log)**

**Current:** `logistics_warehouse_movements`
- Columns: `sku_id`, `from_bin_id`, `to_bin_id`, `quantity`, `movement_type`, `reason`, `batch_id`

**Should be:** `logistics.inventory_movements` (OS)

**Test:**
- Fulfillment needs movement history? ✅ YES
- 3PL needs audit trail? ✅ YES
- Returns needs reverse movement? ✅ YES

**Verdict:** ✅ **Extract to Logistics OS**

**Changes needed:**
- Replace `from_bin_id` / `to_bin_id` → `from_location_id` / `to_location_id` (generic)
- Add `movement_number` (unique identifier)
- Add `movement_date` (timestamp)
- Add `direction` (INBOUND, OUTBOUND)
- Add `source_document_type` / `source_document_id` (Receipt, Shipment, etc.)
- Add `unit_cost`, `total_cost`, `currency` (hints for Finance OS)
- Add `status` (PENDING, COMPLETED, CANCELLED)
- Make immutable (`updated_at` NOT NULL constraint removed)

---

**4. Traceability (Lot/Serial Tracking)**

**Current:** Embedded in Receipt line items (basic tracking only)
- Columns: None (missing in E6)

**Should be:** `logistics.traceability` (OS)

**Test:**
- Fulfillment needs lot tracking? ✅ YES (pharmacy, food)
- 3PL needs serial tracking? ✅ YES (electronics)
- Recalls need chain of custody? ✅ YES

**Verdict:** ✅ **Extract to Logistics OS** (NEW capability)

**Schema needed:**
- `item_id`, `lot_number`, `serial_number`
- `manufactured_date`, `expiry_date`, `received_date`
- `supplier_id`, `supplier_lot_number`
- `custody_events` (JSONB: timestamp, location, action, user)
- `compliance_status`, `recall_status`

**E6 gap:** Traceability not implemented in experiment scope.

---

**5. State Primitives**

**Current:** Embedded in Receipt workflow
- Receipt states: `pending_putaway`, `putaway_in_progress`, `completed`, `on_hold`

**Should be:** Logistics OS provides generic state + Warehouse adds Product-specific states

**Test:**
- Fulfillment needs ALLOCATED state? ✅ YES
- 3PL needs QUARANTINE state? ✅ YES
- Returns needs DAMAGED state? ✅ YES

**Verdict:** ✅ **Extract state primitives to Logistics OS**

**OS States (Generic):**
- PENDING (not yet available)
- AVAILABLE (ready for allocation)
- RESERVED (soft hold)
- ALLOCATED (hard commitment)
- SHIPPED (in transit)
- QUARANTINE (quality hold)
- DAMAGED (write-off candidate)

**Warehouse States (Product-Specific):**
- RECEIVED (receipt-specific)
- PUTAWAY_PENDING (warehouse workflow)
- PUTAWAY_IN_PROGRESS (warehouse workflow)
- PUTAWAY_COMPLETE (warehouse workflow)

**Key insight:** Receipt workflow states stay in Product. Inventory lifecycle states move to OS.

---

**6. Operational Events**

**Current:** NOT implemented in E6 (experiment scope)

**Should be:** `logistics.events` + Integration Hub (OS)

**Test:**
- Finance OS needs INVENTORY_RECEIVED? ✅ YES
- Finance OS needs INVENTORY_ISSUED? ✅ YES
- Analytics needs operational events? ✅ YES

**Verdict:** ✅ **Add to Logistics OS** (NEW capability)

**Event types needed:**
- INVENTORY_RECEIVED
- INVENTORY_ISSUED
- INVENTORY_TRANSFERRED
- INVENTORY_ADJUSTED
- INVENTORY_DAMAGED

**Pattern:** Reuse Healthcare → Finance integration (Outbox, Idempotency, FinanceEventEnvelope)

---

#### P1: Operational Kernel

**7. Location (Generic Concept)**

**Current:** Embedded in Bin structure
- `bin_code`, `warehouse_id`, `zone_id`, `aisle_id`

**Should be:** `logistics.locations` (generic) + Warehouse keeps Bin hierarchy

**Test:**
- Fulfillment has "fulfillment center"? ✅ YES
- 3PL has "3PL warehouse"? ✅ YES
- Store has "retail location"? ✅ YES

**Verdict:** ✅ **Extract generic location to OS, keep Bin hierarchy in Product**

**OS Schema:**
- `location_id` (UUID)
- `location_type` (WAREHOUSE, STORE, 3PL, TRANSIT, SUPPLIER, CUSTOMER, etc.)
- `location_code`, `location_name`

**Warehouse Product:**
- Keeps `logistics_warehouse_bins` table
- Maps `bin_id` → OS `location_id` for Inventory operations

---

**8. UOM (Unit of Measure)**

**Current:** String field in SKU + line items (`uom: 'EA'`)

**Should be:** Logistics OS provides UOM conversions

**Test:**
- Fulfillment needs EA/CS/KG? ✅ YES
- 3PL needs UOM conversion? ✅ YES

**Verdict:** ✅ **Extract to Logistics OS** (P1 priority)

**Future capability:** UOM conversion service (EA ↔ CS, KG ↔ LB, etc.)

---

**9. Quantity Validation**

**Current:** Implicit in test logic (quantities > 0, sufficient balance)

**Should be:** Logistics OS validation primitives

**Test:**
- Fulfillment needs quantity > 0? ✅ YES
- 3PL needs sufficient balance check? ✅ YES

**Verdict:** ✅ **Extract to Logistics OS**

**Validation rules:**
- Quantity must be positive
- Sufficient on-hand for outbound
- Reserved cannot exceed on-hand
- Balance cannot go negative

---

#### ✅ Warehouse Product Capabilities (Keep in Product)

**1. Receipt Entity (GRN)**

**Current:** `logistics_warehouse_receipts`

**Test:**
- Fulfillment uses Receipt? ❌ NO (uses Order)
- 3PL uses Receipt? ❌ NO (uses Inbound Shipment)

**Verdict:** ❌ **Keep in Warehouse Product**

**Rationale:** Receipt is warehouse-specific inbound document. Other Products have different inbound concepts (ASN, Order, Transfer, etc.)

**Stays:** `warehouse_receipts` (Product schema)

---

**2. Receipt Line Items**

**Current:** `logistics_warehouse_receipt_line_items`
- Discrepancy tracking (`expected_quantity`, `actual_quantity`, `discrepancy`)

**Test:**
- Fulfillment tracks discrepancies? ❌ NO (different concept)
- 3PL tracks discrepancies? ⚠️ MAYBE (ASN variance)

**Verdict:** ❌ **Keep in Warehouse Product**

**Rationale:** Discrepancy tracking is warehouse receiving workflow. Other Products may have different variance concepts.

**Stays:** `warehouse_receipt_line_items` (Product schema)

---

**3. Bin Entity**

**Current:** `logistics_warehouse_bins`
- Hierarchy: `warehouse_id`, `zone_id`, `aisle_id`, `bin_code`
- Capacity: `max_capacity`

**Test:**
- Fulfillment uses Bin? ❌ NO (uses Pick Location)
- 3PL uses Bin? ❌ NO (may use Slot, Pallet Position, etc.)

**Verdict:** ❌ **Keep in Warehouse Product**

**Rationale:** Bin hierarchy (Zone/Aisle/Rack/Bin) is warehouse-specific. Other Products have different location structures.

**Stays:** `warehouse_bins` (Product schema)

---

**4. Bin Capacity Logic**

**Current:** Implicit in Putaway workflow
- `max_capacity` constraint
- Bin selection based on capacity

**Test:**
- Fulfillment uses Bin capacity? ❌ NO
- 3PL uses Bin capacity? ❌ NO (different rules)

**Verdict:** ❌ **Keep in Warehouse Product**

**Rationale:** Capacity rules are warehouse-specific operational constraints.

**Stays:** Warehouse Product logic

---

**5. Vendor Entity**

**Current:** `logistics_warehouse_vendors`

**Test:**
- Fulfillment needs Vendor? ❌ NO (customer-facing)
- 3PL needs Vendor? ⚠️ MAYBE (depends on 3PL model)

**Verdict:** ⚠️ **Keep in Warehouse Product** (or extract to future Procurement OS)

**Rationale:** Vendor is procurement-specific, NOT core Logistics. Could be extracted to Procurement OS in future, but NOT Logistics OS.

**Stays:** `warehouse_vendors` (Product schema)

**Note:** If Procurement becomes separate Product, Vendor could move to Procurement OS.

---

**6. Receipt Workflow States**

**Current:** Receipt status machine
- `pending_putaway` → `putaway_in_progress` → `completed`
- `on_hold` (quality hold)

**Test:**
- Fulfillment uses Receipt workflow? ❌ NO
- 3PL uses Receipt workflow? ❌ NO

**Verdict:** ❌ **Keep in Warehouse Product**

**Rationale:** Receipt workflow is warehouse-specific operation. Other Products have different workflows (Pick/Pack/Ship, Cross-Dock, etc.)

**Stays:** `warehouse_receipts.status` (Product schema)

**Note:** Underlying Inventory uses OS states (AVAILABLE, RESERVED, etc.). Receipt workflow is Product layer.

---

**7. Putaway Workflow**

**Current:** Implicit in Receipt → Line Item → Bin assignment
- R6: Submit for Putaway
- R7: Complete Putaway

**Test:**
- Fulfillment does Putaway? ❌ NO (different flow)
- 3PL does Putaway? ❌ NO (may use Directed Put-Away, Cross-Dock, etc.)

**Verdict:** ❌ **Keep in Warehouse Product**

**Rationale:** Putaway is warehouse-specific operation.

**Stays:** Warehouse Product logic

---

### Summary: Extraction Candidates

| Capability | Current Location | Target | Priority | LOC Impact |
|-----------|------------------|--------|----------|------------|
| **Item / SKU** | `warehouse_skus` | `logistics.items` | P0 | ~300 LOC |
| **Inventory Balance** | `warehouse_inventory_on_hand` | `logistics.inventory` | P0 | ~400 LOC |
| **Movement Log** | `warehouse_movements` | `logistics.inventory_movements` | P0 | ~350 LOC |
| **Traceability** | (missing in E6) | `logistics.traceability` | P0 | ~200 LOC (new) |
| **State Primitives** | (implicit) | `logistics.state` | P0 | ~150 LOC |
| **Operational Events** | (missing in E6) | `logistics.events` + Integration Hub | P0 | ~300 LOC (new) |
| **Location (generic)** | (embedded in Bin) | `logistics.locations` | P1 | ~100 LOC |
| **UOM conversions** | (string field) | `logistics.uom` | P1 | ~100 LOC |
| **Validation** | (implicit) | `logistics.validation` | P1 | ~100 LOC |

**Total OS LOC:** ~2,000 LOC (new Logistics OS code)

**Warehouse LOC reduction:** ~1,200 LOC removed (44% of 2,700 LOC baseline)

**Warehouse after E7:** ~1,500 LOC (Warehouse-specific capabilities only)

---

### Boundary Verification

**✅ No boundary violations found in E6:**
- Platform capabilities correctly in Platform (Tenant, RLS, Audit)
- No accounting logic in Warehouse (Finance boundary clean)
- No cross-tenant data leakage (RLS enforced)

**⚠️ Missing OS layer:**
- Warehouse contains OS primitives (Item, Inventory, Movement)
- No explicit OS boundary → Direct Product implementation

**This is NOT a bug. This is the architectural gap E7 will fill.**

---

**For each capability in E6 Warehouse, classify:**

| Category | Test | Example |
|----------|------|---------|
| **Platform** | Cross-industry? Tenant/Auth/Audit | Tenant isolation, RBAC |
| **Logistics OS** | Cross-logistics-product? Inventory/Movement | SKU, Inventory balance |
| **Warehouse Product** | Warehouse-specific? Receipt/Bin/Putaway | GRN, Bin capacity |

**Critical test for OS:**
> "Would Order Fulfillment, 3PL, Transportation, Returns need this capability?"

**If YES → Logistics OS**  
**If NO → Keep in Warehouse Product**

---

### Capability Classification Matrix

| Capability | Platform | Logistics OS | Warehouse Product | Rationale |
|-----------|----------|--------------|-------------------|-----------|
| **Tenant isolation** | ✅ | | | Cross-industry primitive |
| **RBAC / permissions** | ✅ | | | Cross-industry primitive |
| **Audit trail (created_at, etc.)** | ✅ | | | Cross-industry primitive |
| **RLS policies** | ✅ | | | Security primitive |
| | | | | |
| **Item / SKU entity** | | ✅ | | Every Logistics Product needs Item master |
| **Inventory balance** | | ✅ | | Core Logistics primitive (on-hand, reserved, available) |
| **Inventory movement** | | ✅ | | Transaction log (inbound, outbound, transfer) |
| **Traceability (lot/serial)** | | ✅ | | Regulated Logistics requirement |
| **State primitives** | | ✅ | | PENDING, AVAILABLE, RESERVED, ALLOCATED, etc. |
| **Operational events** | | ✅ | | INVENTORY_RECEIVED, INVENTORY_ISSUED, etc. |
| **Location (generic)** | | ✅ | | Not bin-specific, applies to Fulfillment/3PL/etc. |
| **UOM (unit of measure)** | | ✅ | | Cross-product measurement standard |
| **Quantity validation** | | ✅ | | Positive quantity, sufficient balance, etc. |
| | | | | |
| **Receipt entity (GRN)** | | | ✅ | Warehouse-specific inbound document |
| **Bin entity** | | | ✅ | Warehouse-specific storage location |
| **Putaway workflow** | | | ✅ | Warehouse-specific operation |
| **Bin capacity logic** | | | ✅ | Warehouse-specific constraint |
| **Vendor entity** | | | ✅ | Procurement-specific (could be separate Product) |
| **Receipt state (RECEIVED, PUTAWAY_PENDING)** | | | ✅ | Warehouse-specific workflow state |
| **Warehouse location hierarchy** | | | ✅ | Warehouse-specific structure (Zone > Aisle > Rack > Bin) |

---

## Detailed Capability Analysis

### Platform Capabilities (Cross-Industry)

**Stay in Platform, DO NOT move to Logistics OS:**

#### 1. Tenant Isolation (P0 Gate)
- **Scope:** tenant_id in all tables, RLS policies
- **Rationale:** Every industry needs tenant isolation
- **Location:** `src/platform/core/tenant/`
- **Status:** Already in Platform ✅

#### 2. RBAC / Authorization
- **Scope:** Role-based access control, permissions
- **Rationale:** Cross-industry security primitive
- **Location:** `src/platform/core/auth/`
- **Status:** Already in Platform ✅

#### 3. Audit Foundation
- **Scope:** created_at, updated_at, created_by, audit log
- **Rationale:** Compliance requirement across all industries
- **Location:** `src/platform/core/audit/`
- **Status:** Already in Platform ✅

---

### Logistics OS Capabilities (Cross-Logistics-Product)

**Move to Logistics OS if truly cross-product primitive:**

#### P0 (Must Have) — Domain Kernel

##### 1. Item / SKU Master Data
- **Test:** Order Fulfillment needs SKU? ✅ YES
- **Test:** 3PL needs SKU? ✅ YES
- **Test:** Transportation needs SKU? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Every Logistics Product operates on Items/SKUs
- **Current location:** `warehouse_items` table
- **Target:** `logistics.items` (OS schema)

##### 2. Inventory Balance
- **Test:** Fulfillment needs on-hand quantity? ✅ YES
- **Test:** 3PL needs available/reserved? ✅ YES
- **Test:** Returns needs inventory state? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Inventory balance is core Logistics primitive
- **Attributes:**
  - quantity_on_hand
  - quantity_reserved
  - quantity_available (computed)
  - location_id (generic, not bin-specific)
- **Current location:** Embedded in Receipt logic
- **Target:** `logistics.inventory` (OS schema)

##### 3. Inventory Movement (Transaction Log)
- **Test:** Fulfillment needs movement history? ✅ YES
- **Test:** 3PL needs audit trail? ✅ YES
- **Test:** Returns needs reverse movement? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Immutable transaction log for all inventory operations
- **Movement types:**
  - RECEIPT (inbound)
  - ISSUE (outbound)
  - TRANSFER (location-to-location)
  - ADJUSTMENT (variance)
  - RETURN
  - DAMAGE
- **Current location:** Implicit in Receipt operations
- **Target:** `logistics.inventory_movements` (OS schema)

##### 4. Traceability (Lot/Serial Tracking)
- **Test:** Fulfillment needs lot tracking? ✅ YES (pharmacy, food)
- **Test:** 3PL needs serial tracking? ✅ YES (electronics)
- **Test:** Recalls need chain of custody? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Regulatory requirement across Logistics Products
- **Attributes:**
  - lot_number
  - serial_number
  - expiry_date
  - chain_of_custody
  - recall_status
- **Current location:** Basic tracking in Receipts
- **Target:** `logistics.traceability` (OS schema)

##### 5. State Primitives
- **Test:** Fulfillment needs ALLOCATED state? ✅ YES
- **Test:** 3PL needs QUARANTINE state? ✅ YES
- **Test:** Returns needs DAMAGED state? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Common inventory lifecycle states
- **States:**
  - PENDING (not yet available)
  - AVAILABLE (ready for allocation)
  - RESERVED (soft hold)
  - ALLOCATED (hard commitment)
  - SHIPPED (in transit)
  - QUARANTINE (quality hold)
  - DAMAGED (write-off candidate)
- **Current location:** Receipt state machine
- **Target:** `logistics.state` primitives (OS code)

##### 6. Operational Events
- **Test:** Finance OS needs INVENTORY_RECEIVED? ✅ YES
- **Test:** Finance OS needs INVENTORY_ISSUED? ✅ YES
- **Test:** Analytics needs operational events? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** OS emits business events for downstream consumers
- **Event types:**
  - INVENTORY_RECEIVED
  - INVENTORY_ISSUED
  - INVENTORY_TRANSFERRED
  - INVENTORY_ADJUSTED
  - INVENTORY_DAMAGED
- **Current location:** Not implemented in E6
- **Target:** `logistics.events` + Integration Hub (OS)

---

#### P1 (Should Have) — Operational Kernel

##### 7. Location (Generic Concept)
- **Test:** Fulfillment has "fulfillment center"? ✅ YES
- **Test:** 3PL has "3PL warehouse"? ✅ YES
- **Test:** Store has "retail location"? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Location is generic primitive (not bin-specific)
- **Attributes:**
  - location_id
  - location_type (WAREHOUSE, STORE, 3PL, TRANSIT, etc.)
  - location_name
- **Current location:** Warehouse-specific bin hierarchy
- **Target:** `logistics.locations` (generic, OS)
- **Note:** Bin hierarchy stays in Warehouse Product

##### 8. UOM (Unit of Measure)
- **Test:** Fulfillment needs EA/CS/KG? ✅ YES
- **Test:** 3PL needs UOM conversion? ✅ YES
- **Test:** Billing needs UOM? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Standard measurement across Logistics
- **Current location:** Item attribute
- **Target:** `logistics.uom` conversions (OS)

##### 9. Quantity Validation
- **Test:** Fulfillment needs quantity > 0? ✅ YES
- **Test:** 3PL needs sufficient balance? ✅ YES
- **Test:** Returns needs quantity validation? ✅ YES
- **Verdict:** ✅ **Logistics OS**
- **Rationale:** Common validation logic
- **Rules:**
  - Quantity must be positive
  - Sufficient on-hand for outbound
  - Reserved cannot exceed on-hand
- **Current location:** Implicit in Receipt logic
- **Target:** `logistics.validation` (OS code)

---

### Warehouse Product Capabilities (Warehouse-Specific)

**Keep in Product, DO NOT move to OS:**

#### 1. Receipt Entity (GRN)
- **Test:** Fulfillment uses Receipt? ❌ NO (uses Order)
- **Test:** 3PL uses Receipt? ❌ NO (uses Inbound Shipment)
- **Verdict:** ❌ **Warehouse Product**
- **Rationale:** Receipt is warehouse-specific inbound document
- **Stay in:** `warehouse_receipts` table
- **Note:** Receipt triggers OS Inventory Movement

#### 2. Bin Entity
- **Test:** Fulfillment uses Bin? ❌ NO (uses Pick Location)
- **Test:** 3PL uses Bin? ❌ NO (may use different structure)
- **Verdict:** ❌ **Warehouse Product**
- **Rationale:** Bin is warehouse-specific storage location
- **Stay in:** `warehouse_bins` table

#### 3. Putaway Workflow
- **Test:** Fulfillment does Putaway? ❌ NO (different flow)
- **Test:** 3PL does Putaway? ❌ NO (may use ASN)
- **Verdict:** ❌ **Warehouse Product**
- **Rationale:** Putaway is warehouse-specific operation
- **Stay in:** Warehouse Product logic

#### 4. Bin Capacity Logic
- **Test:** Fulfillment uses Bin capacity? ❌ NO
- **Test:** 3PL uses Bin capacity? ❌ NO (different rules)
- **Verdict:** ❌ **Warehouse Product**
- **Rationale:** Capacity rules are warehouse-specific
- **Stay in:** Warehouse Product logic

#### 5. Vendor Entity
- **Test:** Fulfillment needs Vendor? ❌ NO (customer-facing)
- **Test:** 3PL needs Vendor? ⚠️ MAYBE (depends on 3PL model)
- **Verdict:** ❌ **Warehouse Product** (or separate Procurement Product)
- **Rationale:** Vendor is procurement-specific, not core Logistics
- **Stay in:** `warehouse_vendors` table
- **Note:** Could be extracted to Procurement OS in future

#### 6. Receipt-Specific State
- **Test:** Fulfillment uses RECEIVED/PUTAWAY_PENDING? ❌ NO
- **Verdict:** ❌ **Warehouse Product**
- **Rationale:** Warehouse workflow state, not Logistics primitive
- **States:**
  - RECEIVED (warehouse-specific)
  - PUTAWAY_PENDING (warehouse-specific)
  - PUTAWAY_COMPLETE (warehouse-specific)
- **Stay in:** `warehouse_receipts.status`
- **Note:** Underlying Inventory uses OS state (AVAILABLE, RESERVED, etc.)

#### 7. Warehouse Location Hierarchy
- **Test:** Fulfillment uses Zone/Aisle/Rack/Bin? ❌ NO
- **Verdict:** ❌ **Warehouse Product**
- **Rationale:** Hierarchical structure is warehouse-specific
- **Stay in:** `warehouse_bins` + `warehouse_locations`
- **Note:** OS has generic `location_id`, Warehouse maps Bin → location_id

---

## Boundary Verification

### Anti-Pattern Detection

#### ❌ Warehouse 2.0 Disguised as OS
**Symptom:** OS contains Receipt, Bin, Putaway logic  
**Fix:** Keep Product-specific capabilities in Product

#### ❌ God OS (Everything Reusable)
**Symptom:** OS boundary loses meaning  
**Fix:** Test: "Would Fulfillment/3PL/Returns need this?"

#### ❌ Logistics OS Knows Accounting
**Symptom:** OS calculates COGS, creates journal entries  
**Fix:** OS emits events, Finance OS interprets

#### ❌ Direct Database Access
**Symptom:** Warehouse queries `logistics.*` tables directly  
**Fix:** Warehouse imports OS contracts, calls OS services

---

### Correct Boundary Pattern

```
┌─────────────────────────────────────┐
│         BELLA PLATFORM              │
│  (Tenant, Auth, Audit, Security)    │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│       LOGISTICS OS                  │
│                                     │
│  • Item / SKU                       │
│  • Inventory (balance, state)       │
│  • Movement (transaction log)       │
│  • Traceability (lot/serial)        │
│  • Location (generic)               │
│  • Events (operational)             │
│                                     │
│  PUBLIC CONTRACTS:                  │
│  • IItemRepository                  │
│  • IInventoryService                │
│  • IMovementService                 │
│  • ITraceabilityService             │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│      WAREHOUSE PRODUCT              │
│                                     │
│  • Receipt (GRN) ← uses OS          │
│  • Bin ← Warehouse-specific         │
│  • Putaway ← uses OS Location       │
│  • Vendor ← Procurement-specific    │
│                                     │
│  CONSUMES OS:                       │
│  • Inventory operations via OS      │
│  • Movement publishing via OS       │
│  • State transitions via OS         │
└─────────────────────────────────────┘
```

---

## E7 Measurement Framework (3-Layer)

### Don't Only Measure:
> "Warehouse còn bao nhiêu LOC?"

### Must Measure 3 Layers:

#### Layer 1: Logistics OS
- **LOC created**
- **Capabilities provided**
- **Test coverage**
- **Zero Product dependencies** (must be true)
- **Zero accounting logic** (must be true)

#### Layer 2: Warehouse Product
- **LOC before E7:** 2,700
- **LOC after E7:** ?
- **LOC removed:** ?
- **OS capabilities consumed:** ?
- **% adoption:** (capabilities using OS) / (total capabilities)

#### Layer 3: Integration
- **Integration adapter LOC**
- **Friction (bugs during integration)**
- **Contract violations detected**
- **OS ← Product dependency** (must be zero)

---

### Key Metrics

| Metric | Target | Anti-Pattern |
|--------|--------|--------------|
| **OS runs without Product** | ✅ YES | ❌ OS depends on Warehouse |
| **Product imports OS contracts** | ✅ YES | ❌ Product queries OS DB directly |
| **Warehouse LOC reduction** | 40-50% | < 20% (OS not providing value) |
| **OS capability count** | 8-12 primitives | < 5 (too thin) or > 20 (too fat) |
| **Product adoption %** | 40-50% | < 20% (low adoption) |
| **OS accounting logic** | 0 LOC | > 0 (boundary violation) |

---

### Success Criteria (E7)

#### OS Construction Success
- ✅ Logistics OS runs independently
- ✅ Domain models tested in isolation
- ✅ Zero Product dependencies
- ✅ Zero accounting logic
- ✅ Events published to outbox

#### Product Adoption Success
- ✅ Warehouse imports OS contracts (not DB access)
- ✅ Warehouse LOC reduced 40-50%
- ✅ E6 tests still pass (60/60)
- ✅ 40-50% Warehouse capabilities consume OS
- ✅ Clear boundary (no reverse dependency)

#### Integration Success
- ✅ Finance events published via OS
- ✅ Healthcare → Finance pattern followed
- ✅ OS-to-OS boundary maintained
- ✅ Low integration friction (< 3 bugs)

---

## Revised E7 Roadmap

```
✅ E6
   Warehouse baseline (2,700 LOC, 0% reuse)
   
         ↓
         
✅ [FREEZE E6]
   Control group locked (immutable)
   
         ↓
         
🔵 Warehouse Domain Audit ← CURRENT
   Classify: Platform / OS / Product
   
         ↓
         
🔵 Platform / Logistics OS / Product
   Boundary Confirmation
   
         ↓
         
🔵 E7.1: Logistics OS Domain Kernel
   • Item / SKU
   • Inventory
   • Movement
   • Traceability
   
         ↓
         
🔵 E7.2: Operational Kernel
   • State machine
   • Transition validation
   • Event publishing
   • Idempotency
   
         ↓
         
🔵 E7.3: Rules & Traceability
   • Validation primitives
   • Aggregation queries
   • Traceability service
   
         ↓
         
🔵 E7.4: Finance OS Adapter
   • FinanceEventEnvelope
   • Outbox pattern
   • LogisticsContext / InventoryContext
   • Reuse Healthcare pattern
   
         ↓
         
🔵 E7.5: Warehouse Consumes Logistics OS
   • Import OS contracts
   • Replace inventory logic → OS calls
   • Verify E6 tests pass (60/60)
   • Measure LOC reduction
   
         ↓
         
🔵 E7.6: E7 Measurement & Lock
   • 3-layer metrics
   • OS adoption metrics
   • Evidence quality
   
         ↓
         
🟢 E8
   Product #2 (Order Fulfillment)
   Test: OS leverage for second Product?
   
         ↓
         
🟢 E9
   Product #3
   Test: Marginal cost continues decreasing?
   
         ↓
         
📈 Trend Analysis
   E6 → E7 → E8 → E9
   Marginal Cost ↓ = OS Leverage ✅
```

---

## Next Steps (Immediate)

### Step 1: Complete Warehouse Audit
- [x] Read all E6 implementation files
- [x] Classify each table/capability (Platform / OS / Product)
- [x] Document boundary (no violations found)
- [x] Create classification matrix

**AUDIT COMPLETE — 2026-08-22**

### Step 2: Verify Finance OS Boundary
- [ ] Re-read Healthcare → Finance integration
- [ ] Confirm event envelope contract
- [ ] Confirm semantic resolution pattern
- [ ] Design Logistics event types

### Step 3: Design OS Contracts (Before Implementation)
- [ ] Item contract
- [ ] Inventory contract
- [ ] Movement contract
- [ ] Traceability contract
- [ ] Event contract

### Step 4: Review with User (Before Code)
- [ ] Classification matrix confirmed
- [ ] OS boundary approved
- [ ] Finance integration pattern approved
- [ ] Measurement framework agreed

---

## Key Quotes (User Intent)

> **"E7 không phải xây OS bằng cách chuyển 5 capability từ Warehouse lên. E7 là lần đầu tiên Bella thực sự xây OS đứng giữa Platform và Product."**

> **"Không hỏi 'Code nào có thể reuse?' Mà hỏi 'Capability nào thuộc bản chất của Logistics?'"**

> **"Nếu OS được xây xong nhưng Warehouse vẫn phải tự implement gần như mọi thứ, thì E7 phải ghi nhận đó là thất bại về leverage."**

> **"E7 hỏi: Bella có thể xây một Logistics OS mà Warehouse thực sự trở thành một Product sử dụng OS hay không?"**

> **"E6 chứng minh khả năng xây Product. E7 phải chứng minh khả năng xây OS để sinh ra Product."**

---

**STATUS:** Audit in progress, classification matrix defined  
**NEXT:** Complete Warehouse file audit → Boundary confirmation → OS contracts design  
**PRINCIPLE:** Boundary before code, evidence before claims  
**DATE:** 2026-08-22
