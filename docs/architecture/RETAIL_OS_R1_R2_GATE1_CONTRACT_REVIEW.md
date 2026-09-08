# Retail OS R1 + R2 Extraction - Gate 1: Contract Review

**Date:** 2026-09-06  
**Phase:** Phase 1 - Contract Definition  
**Status:** ✅ COMPLETE - Ready for approval

---

## Contracts Defined

### R1: Product Catalog Contract ✅

**File:** `src/platform/retail/contracts/product-catalog.contract.ts`

**Operations:**
- `createProduct()` - Create new product with SKU, pricing, inventory settings
- `updateProductPrice()` - Update base price
- `updateProductStatus()` - Manage status lifecycle (ACTIVE/DISCONTINUED/OUT_OF_STOCK)
- `getProductById()` - Retrieve product by ID
- `getProductBySku()` - Retrieve product by SKU

**Evidence Source:** Product #1 `product-catalog.service.ts` (all operations observed)

**Semantic Ownership:** Retail OS owns product lifecycle, SKU identity, status transitions

**OUT OF SCOPE (Correctly excluded):**
- Product variants / SKU generation logic (Product-specific)
- Category taxonomy rules (business-specific)
- Pricing strategies (business-specific)
- UI/presentation logic (Product layer)

---

### R2: Inventory Movement Contract ✅

**File:** `src/platform/retail/contracts/inventory-movement.contract.ts`

**Operations:**
- `recordMovement()` - Record stock movement with audit trail
- `getMovementHistory()` - Query movement history for product
- `getCurrentStock()` - Get real-time stock level
- `detectReorderNeeds()` - Detect products below reorder point

**Evidence Source:** Product #1 `inventory-movement.service.ts` (all operations observed)

**Semantic Ownership:** Retail OS owns inventory movement audit, stock transitions

**OUT OF SCOPE (Correctly excluded):**
- Multi-location inventory (deferred until evidence)
- Reserved/allocated stock (e-commerce-specific)
- Backorder logic (B2B-specific)
- Reorder automation (Product orchestration)
- Stock forecasting (advanced feature, not MVP)

---

## Gate 1 Checklist

### ✅ Contract Completeness

**R1 Product Catalog:**
- [x] Covers all Product #1 product operations
- [x] createProduct() - W1.1 (observed)
- [x] updateProductPrice() - W1.2 (observed)
- [x] updateProductStatus() - W1.3 (observed)
- [x] getProductById() - (observed in tests)
- [x] getProductBySku() - (observed in tests)
- [x] No operations missing from Product #1 evidence

**R2 Inventory Movement:**
- [x] Covers all Product #1 inventory operations
- [x] recordMovement() - W4, W5 (observed)
- [x] getMovementHistory() - (observed in tests)
- [x] getCurrentStock() - (observed, used in availability check)
- [x] detectReorderNeeds() - W1.4, W4 (observed)
- [x] No operations missing from Product #1 evidence

**Assessment:** ✅ Contracts complete for Product #1 needs

---

### ✅ No Product-Specific Leakage

**R1 Product Catalog:**
- [x] No POS-specific logic (checkout, cashier, receipt)
- [x] No UI/UX dependencies
- [x] No workflow orchestration
- [x] Pure domain operations (CRUD + status lifecycle)

**R2 Inventory Movement:**
- [x] No Product-specific workflows (sale processing kept in Product)
- [x] No orchestration logic (Product calls contract, not embedded)
- [x] Pure domain operations (movement recording + audit)
- [x] Reorder detection is query, not action (Product decides what to do)

**Assessment:** ✅ No leakage detected

---

### ✅ Semantic Ownership Clear

**R1 owns:**
- ✅ Product identity (SKU-based, unique per tenant)
- ✅ Product lifecycle (ACTIVE → DISCONTINUED final, ACTIVE ↔ OUT_OF_STOCK allowed)
- ✅ Pricing attributes (base_price, cost_price canonical)
- ✅ Product CRUD operations

**R2 owns:**
- ✅ Inventory movement audit trail (immutable once recorded)
- ✅ Stock transitions (previous → new stock atomicity)
- ✅ Movement types (SALE, RESTOCK, ADJUSTMENT, RETURN, DAMAGE, TRANSFER)
- ✅ Reorder detection logic (current_stock <= reorder_point)

**What Retail OS does NOT own (correctly deferred):**
- ❌ Sale transaction lifecycle (deferred to Product or future R3)
- ❌ Customer management (Product-specific)
- ❌ Pricing strategies (business rules, Product layer)
- ❌ Checkout workflows (Product orchestration)

**Assessment:** ✅ Ownership boundaries clear

---

### ✅ Minimal Surface

**R1 operations count:** 5 (create, updatePrice, updateStatus, getById, getBySku)

**R2 operations count:** 4 (recordMovement, getHistory, getCurrentStock, detectReorderNeeds)

**Total contract surface:** 9 operations

**Comparison to Product #1 implementation:**
- Product Catalog Service: 6 operations (5 in contract + 1 checkAvailability kept in Product)
- Inventory Movement Service: 6 operations (4 in contract + 2 orchestrations kept in Product)

**Excluded from contracts (correctly):**
- checkAvailability() - Product-specific (decision: keep in Product per assessment)
- processSaleInventoryMovement() - orchestration (Product calls recordMovement per item)
- restockProduct() - orchestration (Product calls recordMovement with RESTOCK type)
- adjustStock() - orchestration (Product calls recordMovement with ADJUSTMENT type)

**Assessment:** ✅ Minimal surface, no speculation

---

### ✅ No Future-Proofing

**Not included (good):**
- ❌ Product variants / SKU hierarchy (not observed in Product #1)
- ❌ Multi-location inventory (not observed)
- ❌ Reserved stock tracking (not observed)
- ❌ Batch/serial number tracking (not observed)
- ❌ Stock forecasting (advanced, not observed)
- ❌ Automatic reorder triggering (orchestration, not primitive)

**Contracts define ONLY operations observed in Product #1**

**Assessment:** ✅ No speculative features

---

## Invariants Documented

### R1 Product Catalog Invariants

1. **SKU uniqueness:** SKU must be unique per tenant
2. **Price positivity:** basePrice must be > 0
3. **Status transition:** DISCONTINUED is final (no reversal to ACTIVE)
4. **Status transition:** ACTIVE ↔ OUT_OF_STOCK allowed (restock)
5. **Inventory tracking:** If trackInventory=false, stock fields ignored

---

### R2 Inventory Movement Invariants

1. **Audit immutability:** Movement records immutable once created
2. **Stock atomicity:** Product current_stock updated atomically with movement creation
3. **No negative stock:** Movement rejected if would cause negative stock
4. **Stock transitions:** previous_stock + quantity_change = new_stock (enforced)
5. **Movement types:** Canonical types (SALE, RESTOCK, ADJUSTMENT, RETURN, DAMAGE, TRANSFER)

---

## Contract-to-Evidence Mapping

### R1: Product Catalog

| Contract Operation | Product #1 Evidence | Test Coverage |
|--------------------|---------------------|---------------|
| createProduct() | W1.1: Create product with pricing/inventory | ✅ W1.1 test |
| updateProductPrice() | W1.2: Update product price | ✅ W1.2 test |
| updateProductStatus() | W1.3: Update product status | ✅ W1.3 test |
| getProductById() | Used in all workflows | ✅ Implicit in tests |
| getProductBySku() | Used in sale item creation | ✅ W2.3 test |

**Coverage:** 5/5 operations have Product #1 evidence ✅

---

### R2: Inventory Movement

| Contract Operation | Product #1 Evidence | Test Coverage |
|--------------------|---------------------|---------------|
| recordMovement() | W4: Sale→Inventory, W5: Restock/Adjust | ✅ W4.1, W5.1, W5.2 tests |
| getMovementHistory() | Movement queries in tests | ✅ W4.1 test |
| getCurrentStock() | W1.4: Availability check | ✅ W1.4 test |
| detectReorderNeeds() | W1.4: Reorder detection, W4.2 | ✅ W1.4, W4.2 tests |

**Coverage:** 4/4 operations have Product #1 evidence ✅

---

## Risks & Mitigations

### Risk #1: Contract Missing Operation Product Needs

**Likelihood:** LOW  
**Impact:** MEDIUM (would require contract revision)

**Mitigation:**
- All Product #1 operations mapped to contracts
- Contracts derived from observed usage, not speculation
- If gap found during Phase 3 refactor → Assess if Retail-wide or Product-specific

**Status:** Mitigated ✅

---

### Risk #2: Semantic Leakage into Contracts

**Likelihood:** LOW  
**Impact:** HIGH (would compromise boundary)

**Mitigation:**
- Contracts reviewed for Product-specific logic
- Orchestration operations excluded (kept in Product)
- Pure domain primitives only

**Status:** Mitigated ✅

---

### Risk #3: Over-Engineering / Speculation

**Likelihood:** LOW  
**Impact:** MEDIUM (unnecessary complexity)

**Mitigation:**
- Only Product #1 observed operations included
- No multi-location, reserved stock, or advanced features
- Minimal surface (9 operations total)

**Status:** Mitigated ✅

---

## Gate 1 Decision

**Checklist:**
- [x] R1 contract complete (covers Product #1 usage)
- [x] R2 contract complete (covers Product #1 usage)
- [x] No Product-specific leakage
- [x] Semantic ownership clear
- [x] Minimal surface (no speculation)
- [x] Invariants documented
- [x] Evidence mapping complete

**Approval Status:** ⏸️ **AWAITING HUMAN ARCHITECT REVIEW**

**Recommendation:** ✅ **APPROVE - Proceed to Phase 2 (Engine Implementation)**

**Rationale:**
- Contracts derived from Product #1 evidence (not speculation)
- All observed operations covered
- Boundaries clean (no leakage)
- Minimal surface (9 operations, no future-proofing)
- Invariants documented

---

**Gate Status:** ✅ COMPLETE  
**Next Phase:** Phase 2 - Engine Implementation  
**Blocking:** Human architect approval  
**Date:** 2026-09-06
