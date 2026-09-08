# RETAIL OS — PHASE 3 STEP 1 ANALYSIS

**Date:** 2026-09-06  
**Objective:** Analyze bella-retail-store current state and map to R1/R2 contracts  
**Status:** 🔍 IN PROGRESS

---

## Current bella-retail-store Implementation

**Product:** `bella-retail-store` (General Merchandise POS)

**Services identified:**
1. `product-catalog.service.ts` — Product Catalog operations
2. `inventory-movement.service.ts` — Inventory Movement operations
3. `customer-purchase.service.ts` — Customer/Cart operations (out of scope)
4. `sale-completion.service.ts` — Sale Transaction operations (out of scope)

---

## R1 Product Catalog Mapping

### Current Implementation

**File:** `src/products/bella-retail-store/services/product-catalog.service.ts`

**Operations:**
1. ✅ `createProduct()` — Create product with pricing/inventory
2. ✅ `updateProductPrice()` — Update product base price
3. ✅ `updateProductStatus()` — Update product status
4. ✅ `getProductById()` — Query product by ID
5. ✅ `getProductBySku()` — Query product by SKU
6. 🟡 `checkAvailability()` — Check stock availability + reorder status

**Architecture:**
```
ProductCatalogService
        ↓
SupabaseClient
        ↓
retail_products table (direct DB access)
```

---

### Mapping to R1 Contract

| bella-retail-store Operation | R1 Contract Operation | Mapping Type |
|------------------------------|----------------------|--------------|
| `createProduct()` | `R1.createProduct()` | ✅ Direct replacement |
| `updateProductPrice()` | `R1.updateProductPrice()` | ✅ Direct replacement |
| `updateProductStatus()` | `R1.updateProductStatus()` | ✅ Direct replacement |
| `getProductById()` | `R1.getProductById()` | ✅ Direct replacement |
| `getProductBySku()` | `R1.getProductBySku()` | ✅ Direct replacement |
| `checkAvailability()` | ❌ NOT IN R1 | 🟡 Product-specific orchestration |

---

### R1 Semantic Gap Analysis

**Operation:** `checkAvailability()`

**Current implementation:**
```typescript
async checkAvailability(request: CheckAvailabilityRequest): Promise<AvailabilityResult> {
  // 1. Get product (current_stock, reorder_point, track_inventory, status)
  // 2. Check: currentStock >= requestedQuantity && status === 'ACTIVE'
  // 3. Check: currentStock <= reorder_point (needs reorder?)
  // 4. Return: { available, currentStock, needsReorder }
}
```

**R1 contract does NOT have `checkAvailability()`.**

**Options:**

**Option A:** Keep `checkAvailability()` in bella-retail-store (Product orchestration)
- ✅ Availability check = Product-specific business logic
- ✅ Composes R1.getProductById() + R2.getCurrentStock() + status check
- ✅ No R1 contract expansion needed

**Option B:** Add `checkAvailability()` to R1 contract
- ❌ Availability semantics = orchestration, not canonical Product Core
- ❌ Mixes Product query with Inventory query
- ❌ Expands frozen R1 contract

**Option C:** Add to R2 contract
- ❌ Availability check includes product status (not Inventory concern)
- ❌ Doesn't belong in Inventory Movement contract

**Recommendation:** **Option A** — Keep `checkAvailability()` in bella-retail-store as Product orchestration.

**Evidence:** Coverage Study identified availability check as Product workflow, not Retail OS Core.

**Migration impact:** bella-retail-store can call `R1.getProductById()` + `R2.getCurrentStock()` internally, then apply availability logic.

**Status:** ✅ NO R1 CONTRACT GAP (Product orchestration acceptable)

---

## R2 Inventory Movement Mapping

### Current Implementation

**File:** `src/products/bella-retail-store/services/inventory-movement.service.ts`

**Operations:**
1. 🔴 `processSaleInventoryMovement()` — Process inventory for completed sale
2. 🔴 `restockProduct()` — Restock product (receive inventory)
3. 🔴 `adjustStock()` — Adjust stock (ADJUSTMENT, RETURN, DAMAGE, TRANSFER)
4. ✅ `getProductMovements()` — Get movement history
5. ✅ `getProductsNeedingReorder()` — Get products needing reorder

**Architecture:**
```
InventoryMovementService
        ↓
SupabaseClient
        ↓
retail_inventory_movements + retail_products (direct DB access, manual transaction)
```

---

### Mapping to R2 Contract

| bella-retail-store Operation | R2 Contract Operation | Mapping Type |
|------------------------------|----------------------|--------------|
| `processSaleInventoryMovement()` | `R2.recordMovement()` | 🔴 Orchestration (multi-product, sale-triggered) |
| `restockProduct()` | `R2.recordMovement()` | ✅ Direct replacement (movementType='RESTOCK') |
| `adjustStock()` | `R2.recordMovement()` | ✅ Direct replacement (movementType per request) |
| `getProductMovements()` | `R2.getMovementHistory()` | ✅ Direct replacement |
| `getProductsNeedingReorder()` | `R2.detectReorderNeeds()` | ✅ Direct replacement |

---

### R2 Semantic Gap Analysis

**Operation 1:** `processSaleInventoryMovement()`

**Current implementation:**
```typescript
async processSaleInventoryMovement(saleId) {
  // 1. Verify sale is COMPLETED
  // 2. Get sale items (multiple products)
  // 3. For each item:
  //    - Get product
  //    - Calculate previousStock, newStock
  //    - Update product stock (decrement)
  //    - Create inventory movement record (type='SALE', reference=saleId)
  //    - Check if reorder needed
  // 4. Return { movements[], productsNeedingReorder[] }
}
```

**R2 contract has `recordMovement()` for SINGLE product.**

**Semantic:** `processSaleInventoryMovement()` = orchestration across multiple products triggered by Sale completion.

**Options:**

**Option A:** Keep `processSaleInventoryMovement()` in bella-retail-store (Product orchestration)
- ✅ Sale-triggered workflow = Product-specific business logic
- ✅ Loops through sale items, calls R2.recordMovement() per product
- ✅ No R2 contract expansion needed

**Option B:** Add `processSaleInventoryMovement()` to R2 contract
- ❌ Sale-specific orchestration, not canonical Inventory Movement
- ❌ Mixes Sale domain with Inventory domain
- ❌ Expands frozen R2 contract

**Recommendation:** **Option A** — Keep `processSaleInventoryMovement()` in bella-retail-store as Sale workflow orchestration.

**Migration:** bella-retail-store calls `R2.recordMovement()` per sale item, handles Sale-specific logic internally.

**Status:** ✅ NO R2 CONTRACT GAP (Product orchestration acceptable)

---

**Operation 2:** `restockProduct()`

**Current implementation:**
```typescript
async restockProduct({ productId, quantity, reason }) {
  // 1. Get product
  // 2. Calculate previousStock, newStock
  // 3. Update product stock (increment)
  // 4. Create inventory movement (type='RESTOCK')
}
```

**R2 contract has `recordMovement({ movementType: 'RESTOCK', quantityChange: +quantity })`.**

**Mapping:** ✅ **Direct replacement** — bella-retail-store calls `R2.recordMovement()` with movementType='RESTOCK'.

**Status:** ✅ NO GAP

---

**Operation 3:** `adjustStock()`

**Current implementation:**
```typescript
async adjustStock({ productId, quantityChange, movementType, reason }) {
  // 1. Get product
  // 2. Calculate previousStock, newStock
  // 3. Validate no negative stock
  // 4. Update product stock
  // 5. Create inventory movement (type=ADJUSTMENT/RETURN/DAMAGE/TRANSFER)
}
```

**R2 contract has `recordMovement({ movementType, quantityChange })`.**

**Mapping:** ✅ **Direct replacement** — bella-retail-store calls `R2.recordMovement()` with appropriate movementType.

**Status:** ✅ NO GAP

---

**Operation 4:** `getProductMovements()`

**R2 contract has `getMovementHistory(tenantId, productId)`.**

**Mapping:** ✅ **Direct replacement**

**Status:** ✅ NO GAP

---

**Operation 5:** `getProductsNeedingReorder()`

**R2 contract has `detectReorderNeeds(tenantId)`.**

**Mapping:** ✅ **Direct replacement**

**Status:** ✅ NO GAP

---

## Duplicate Semantic Detection

### R1 Product Catalog

**Duplicate logic in bella-retail-store:**

| Semantic | Current Location | After Migration |
|----------|------------------|-----------------|
| Product creation | ProductCatalogService | ❌ REMOVED → R1.createProduct() |
| Price update | ProductCatalogService | ❌ REMOVED → R1.updateProductPrice() |
| Status update | ProductCatalogService | ❌ REMOVED → R1.updateProductStatus() |
| Product queries | ProductCatalogService | ❌ REMOVED → R1.getProductById/BySku() |
| SKU uniqueness | DB constraint + service | ✅ KEPT → R1 enforces |
| Price positivity | ProductCatalogService | ✅ KEPT → R1 enforces |
| DISCONTINUED finality | NOT ENFORCED | ✅ NEW → R1 enforces |
| Tenant isolation | RLS + service | ✅ KEPT → R1 enforces |

**Duplicate LOC:** ~180 lines (createProduct, updateProductPrice, updateProductStatus, getProductById, getProductBySku)

---

### R2 Inventory Movement

**Duplicate logic in bella-retail-store:**

| Semantic | Current Location | After Migration |
|----------|------------------|-----------------|
| Movement recording | InventoryMovementService | ❌ REMOVED → R2.recordMovement() |
| Stock update (atomic) | InventoryMovementService (manual) | ✅ IMPROVED → R2 handles atomically |
| No negative stock | InventoryMovementService | ✅ KEPT → R2 enforces |
| Movement history | InventoryMovementService | ❌ REMOVED → R2.getMovementHistory() |
| Reorder detection | InventoryMovementService | ❌ REMOVED → R2.detectReorderNeeds() |
| Tenant isolation | RLS + service | ✅ KEPT → R2 enforces |

**Duplicate LOC:** ~140 lines (restockProduct, adjustStock, getProductMovements, getProductsNeedingReorder core logic)

**Total duplicate semantic:** ~320 lines canonical logic to be removed from bella-retail-store.

---

## Product-Specific Orchestrations (Keep in bella-retail-store)

**NOT duplicate, NOT canonical Retail Core:**

| Operation | Why Product-Specific |
|-----------|---------------------|
| `checkAvailability()` | Composes Product status + Inventory stock + availability logic (POS workflow) |
| `processSaleInventoryMovement()` | Sale-triggered multi-product workflow (orchestrates R2.recordMovement per item) |

**LOC to keep:** ~100 lines orchestration logic

---

## Migration Plan

### R1 Product Catalog Migration

**Steps:**

1. **Update bella-retail-store to import R1 contract**
   ```typescript
   import { IProductCatalogContract } from '@/platform/retail/contracts/product-catalog.contract';
   ```

2. **Inject R1 engine into ProductCatalogService**
   ```typescript
   constructor(
     private readonly productCatalogEngine: IProductCatalogContract,
     private readonly supabase: SupabaseClient // Keep for orchestration
   ) {}
   ```

3. **Replace operations with R1 contract calls**
   - `createProduct()` → `productCatalogEngine.createProduct()`
   - `updateProductPrice()` → `productCatalogEngine.updateProductPrice()`
   - `updateProductStatus()` → `productCatalogEngine.updateProductStatus()`
   - `getProductById()` → `productCatalogEngine.getProductById()`
   - `getProductBySku()` → `productCatalogEngine.getProductBySku()`

4. **Keep `checkAvailability()` as orchestration**
   - Calls `productCatalogEngine.getProductById()` internally
   - Applies Product-specific availability logic

5. **Remove duplicate canonical logic**
   - Delete direct DB access for Product CRUD
   - Keep orchestration logic

**Estimated LOC change:** -180 lines (duplicate removed), +50 lines (contract integration), net -130 lines

---

### R2 Inventory Movement Migration

**Steps:**

1. **Update bella-retail-store to import R2 contract**
   ```typescript
   import { IInventoryMovementContract } from '@/platform/retail/contracts/inventory-movement.contract';
   ```

2. **Inject R2 engine into InventoryMovementService**
   ```typescript
   constructor(
     private readonly inventoryEngine: IInventoryMovementContract,
     private readonly supabase: SupabaseClient // Keep for Sale orchestration
   ) {}
   ```

3. **Replace operations with R2 contract calls**
   - `restockProduct()` → `inventoryEngine.recordMovement({ movementType: 'RESTOCK' })`
   - `adjustStock()` → `inventoryEngine.recordMovement({ movementType per request })`
   - `getProductMovements()` → `inventoryEngine.getMovementHistory()`
   - `getProductsNeedingReorder()` → `inventoryEngine.detectReorderNeeds()`

4. **Refactor `processSaleInventoryMovement()` as orchestration**
   - Keep Sale verification logic
   - Keep multi-product loop
   - Replace manual stock update + movement creation with `inventoryEngine.recordMovement()` per item

5. **Remove duplicate canonical logic**
   - Delete manual stock update + movement creation
   - Delete manual atomic transaction handling
   - Keep Sale-specific orchestration

**Estimated LOC change:** -140 lines (duplicate removed), +60 lines (contract integration), net -80 lines

---

## Integration Risks

### Risk 1: Request/Response Type Mismatch

**Current:** bella-retail-store uses `RetailProduct`, `RetailInventoryMovement` (DB types)

**R1/R2:** Use domain types (`Product`, `InventoryMovement`)

**Mitigation:**
- Map domain types → DB types in bella-retail-store adapters
- OR update bella-retail-store to use domain types directly

**Impact:** LOW (types are semantically equivalent, just different names)

---

### Risk 2: Error Handling Differences

**Current:** bella-retail-store throws errors with specific messages (e.g., `PRODUCT_CREATE_FAILED`)

**R1/R2:** Throw errors with contract-defined codes

**Mitigation:**
- Keep bella-retail-store error wrapping layer
- Map R1/R2 errors → Product-specific error messages

**Impact:** LOW (error messages can be wrapped)

---

### Risk 3: Tenant Context Setting

**Current:** bella-retail-store calls `supabase.rpc('set_tenant_context')` before every operation

**R1/R2:** Engines call `set_tenant_context` internally

**Mitigation:**
- Remove duplicate `set_tenant_context` calls from bella-retail-store
- Rely on R1/R2 engines to handle tenant isolation

**Impact:** LOW (simplifies bella-retail-store code)

---

### Risk 4: Transaction Atomicity (Sale → Inventory)

**Current:** `processSaleInventoryMovement()` manually handles multi-product loop, no DB-level transaction

**R2:** `recordMovement()` is atomic per product

**Mitigation:**
- Keep Sale-level orchestration in bella-retail-store
- Call `R2.recordMovement()` per sale item
- If one item fails, handle compensation in Product orchestration layer

**Impact:** MEDIUM (same atomicity model as current, but now explicit)

**Note:** R2 atomic transaction limitation (from Gate 2) still applies. If Product → R2 call fails mid-loop, bella-retail-store must handle compensation.

---

### Risk 5: Regression in checkAvailability()

**Current:** `checkAvailability()` queries product directly

**After migration:** Must call `R1.getProductById()` → map result → apply logic

**Mitigation:**
- Keep `checkAvailability()` interface identical
- Internal implementation calls R1 contract
- Regression test verifies behavior unchanged

**Impact:** LOW (semantic equivalence, just different data source)

---

## Contract Gap Assessment

### R1 Product Catalog

**Operations needed by bella-retail-store:**
1. ✅ createProduct — **Covered by R1**
2. ✅ updateProductPrice — **Covered by R1**
3. ✅ updateProductStatus — **Covered by R1**
4. ✅ getProductById — **Covered by R1**
5. ✅ getProductBySku — **Covered by R1**
6. 🟡 checkAvailability — **Product orchestration (not R1 responsibility)**

**Gap:** ❌ NONE

**R1 contract sufficient:** ✅ YES

---

### R2 Inventory Movement

**Operations needed by bella-retail-store:**
1. ✅ recordMovement (SALE, RESTOCK, ADJUSTMENT, RETURN, DAMAGE) — **Covered by R2**
2. ✅ getMovementHistory — **Covered by R2**
3. ✅ getCurrentStock — **Covered by R2**
4. ✅ detectReorderNeeds — **Covered by R2**
5. 🟡 processSaleInventoryMovement (multi-product) — **Product orchestration (not R2 responsibility)**

**Gap:** ❌ NONE

**R2 contract sufficient:** ✅ YES

---

## STOP Condition Check

**STOP condition:** If R1/R2 contracts insufficient for migration → reopen Gate 2 architectural review.

**Status:** ❌ **NO STOP** — R1/R2 contracts are sufficient for bella-retail-store migration.

**Evidence:**
- All canonical Product operations covered by R1
- All canonical Inventory operations covered by R2
- Product-specific orchestrations (`checkAvailability`, `processSaleInventoryMovement`) correctly kept in Product layer
- No contract expansion needed

---

## Migration Metrics (Estimated)

| Metric | Before Migration | After Migration | Delta |
|--------|------------------|-----------------|-------|
| **Product Catalog LOC** | ~180 | ~50 | **-130** |
| **Inventory Movement LOC** | ~200 | ~120 | **-80** |
| **Orchestration LOC** | ~100 | ~100 | 0 (kept) |
| **Total bella-retail-store LOC** | ~480 | ~270 | **-210** |
| **Retail OS LOC (new)** | 0 | ~1,620 | +1,620 |
| **Duplicate eliminated** | - | - | **~320 lines** |
| **Reuse ratio** | - | - | **66% canonical logic extracted** |

**Net system LOC:** +1,410 (but 320 lines now canonical, reusable)

---

## Next Steps (Step 2: Refactor R1 Product Catalog)

**Objective:** Replace bella-retail-store Product Catalog with R1 contract

**Tasks:**
1. Update ProductCatalogService to inject R1 IProductCatalogContract
2. Replace createProduct/updateProductPrice/updateProductStatus/getProductById/getProductBySku with R1 calls
3. Refactor checkAvailability() to call R1.getProductById() internally
4. Remove duplicate Product CRUD logic
5. Run regression tests
6. Verify TypeScript check passes
7. Document migration evidence

**Estimated effort:** 2-3 days

**STOP condition:** If regression tests fail without justification → investigate semantic mismatch.

---

## Step 1 Analysis Complete

**Status:** ✅ **COMPLETE**

**Key findings:**

1. ✅ **R1 contract sufficient** — All canonical Product operations covered
2. ✅ **R2 contract sufficient** — All canonical Inventory operations covered
3. ✅ **No STOP condition** — Migration can proceed
4. 🟡 **Product orchestrations identified** — `checkAvailability`, `processSaleInventoryMovement` correctly kept in Product
5. 📊 **Reuse metrics estimated** — ~320 lines duplicate canonical logic to be removed

**Recommendation:** **PROCEED to Step 2 (R1 Product Catalog refactor)**

**Next checkpoint:** After Step 2 complete, verify regression tests pass before proceeding to Step 3.
