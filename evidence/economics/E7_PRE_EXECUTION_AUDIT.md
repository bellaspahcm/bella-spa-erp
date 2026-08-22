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

## Warehouse Domain Audit

### Audit Methodology

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
- [ ] Read all E6 implementation files
- [ ] Classify each file/function (Platform / OS / Product)
- [ ] Document boundary violations (if any)
- [ ] Create classification matrix

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
