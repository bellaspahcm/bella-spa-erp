# RETAIL OS EXTENSION — R3 Variant Management + R4 Batch/Lot Tracking

**Date:** 2026-09-06  
**Trigger:** Real customer demand (Kids Clothing + Fresh Food products)  
**Status:** 🔍 DESIGN

---

## Business Demand

**Product #2: Kids Clothing Store**
- Needs: Size/color variants, variant-level stock tracking
- Example: T-Shirt has sizes (2T, 3T, 4T) × colors (red, blue, pink) = 12 variants
- Each variant has independent stock level

**Product #3: Fresh Food & Grocery Store**
- Needs: Batch/lot tracking, expiry dates, FEFO inventory
- Example: Milk batch#20240906 expires 2024-09-13, stock 50 units
- Multiple batches of same product with different expiry dates

---

## Gap Analysis

**Current Retail Core (R1+R2):**
```
retail_products
├─ sku (TEXT) — single SKU per product
├─ current_stock (INTEGER) — aggregate stock
└─ NO variant/batch support
```

**Needed:**
```
Product Variants (R3)
├─ variant_attributes (size, color, etc.)
├─ variant SKU generation
└─ stock per variant

Batch/Lot Tracking (R4)
├─ batch/lot number
├─ expiry date
├─ stock per batch
└─ FEFO logic
```

---

## Architecture Decision

**Extend Retail OS with:**
- **R3: Product Variant Contract** (for Kids Clothing + future Fashion/Electronics)
- **R4: Batch/Lot Contract** (for Fresh Food + future Pharmacy/Perishables)

**Justification:**
1. ✅ Real demand (2 products need it now)
2. ✅ Reusable (Fashion, Pharmacy, Electronics will need same)
3. ✅ Industry OS responsibility (NOT product-specific logic)
4. ✅ Evidence-based (not hypothetical extension)

**NOT extending:**
- ❌ E-commerce specific (reserved stock, cart logic)
- ❌ B2B specific (backorder, purchase orders)
- ❌ Multi-location (warehouse vs store inventory)

---

## R3: Product Variant Contract Design

**Scope:**
- Variant definition (size, color, style, etc.)
- Variant SKU generation (parent SKU + attributes)
- Stock tracking per variant
- Variant lifecycle (ACTIVE, DISCONTINUED)

**Schema:**
```sql
CREATE TABLE retail_product_variants (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES retail_products(id),
  
  -- Variant Identity
  variant_sku TEXT NOT NULL, -- Auto-generated or manual
  variant_attributes JSONB NOT NULL, -- {size: '4T', color: 'red'}
  
  -- Inventory
  current_stock INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DISCONTINUED')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, variant_sku)
);
```

**Contract Operations:**
- `createVariant(productId, attributes, initialStock)`
- `getVariantsBySku(productId)`
- `updateVariantStock(variantId, stock)`
- `getVariantStock(variantId)`

---

## R4: Batch/Lot Tracking Contract Design

**Scope:**
- Batch/lot definition per product
- Expiry date management
- Stock tracking per batch
- FEFO query (First Expire, First Out)

**Schema:**
```sql
CREATE TABLE retail_product_batches (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES retail_products(id),
  
  -- Batch Identity
  batch_number TEXT NOT NULL,
  lot_number TEXT, -- Optional secondary identifier
  
  -- Expiry
  manufactured_date DATE,
  expiry_date DATE NOT NULL,
  
  -- Inventory
  current_stock INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'RECALLED')),
  
  -- Metadata
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, product_id, batch_number)
);
```

**Contract Operations:**
- `createBatch(productId, batchNumber, expiryDate, initialStock)`
- `getBatchesByProduct(productId, includeExpired?)`
- `getNextBatchFEFO(productId)` — Returns batch expiring soonest
- `updateBatchStock(batchId, stock)`
- `detectExpiredBatches(tenantId, daysThreshold?)`

---

## Implementation Strategy

**Approach: Minimal Viable Extension**

1. **R3 Variant (Kids Clothing need):**
   - Contract definition
   - Schema migration
   - Engine implementation
   - Tests (create variant, stock tracking, variant query)

2. **R4 Batch/Lot (Fresh Food need):**
   - Contract definition
   - Schema migration
   - Engine implementation
   - Tests (batch creation, FEFO query, expiry detection)

3. **Product #2 Integration (Kids Clothing):**
   - Product service uses R1 + R3
   - Variant creation on product setup
   - Stock operations on variants (not parent product)

4. **Product #3 Integration (Fresh Food):**
   - Product service uses R1 + R4
   - Batch creation on receiving inventory
   - Stock operations on batches (FEFO logic)

**NOT building:**
- ❌ Combined variant + batch (edge case: variant batches)
- ❌ Multi-location batch tracking
- ❌ Automatic reorder from batch expiry
- ❌ Batch transfer between warehouses

---

## Compatibility with R1+R2

**R1 Product Catalog:**
- ✅ Parent product remains in `retail_products`
- ✅ Variants/batches are children (1:N relationship)
- ✅ Parent product `track_inventory` flag determines if variants/batches needed

**R2 Inventory Movement:**
- ✅ Movements can reference variant_id or batch_id (optional)
- ✅ Parent product `current_stock` = SUM(variant stocks) OR SUM(batch stocks)
- ✅ Backward compatible (products without variants/batches work as before)

---

## Validation Criteria

**R3 Variant Success:**
- ✅ Kids Clothing can create product with 12 variants (4 sizes × 3 colors)
- ✅ Stock tracking per variant works
- ✅ Variant SKU generation consistent
- ✅ Tests pass (5+ test cases)

**R4 Batch Success:**
- ✅ Fresh Food can create product with multiple batches
- ✅ FEFO query returns batch expiring soonest
- ✅ Expiry detection works (batches expiring in N days)
- ✅ Tests pass (5+ test cases)

**Product Integration Success:**
- ✅ bella-kids-clothing uses R1+R3, operational
- ✅ bella-fresh-food uses R1+R4, operational
- ✅ bella-retail-store (R1+R2 only) still works (backward compatible)

---

## Effort Estimate

**R3 Variant:**
- Contract definition: 1h
- Schema migration: 0.5h
- Engine implementation: 3h
- Tests: 2h
- **Total:** 6.5h

**R4 Batch/Lot:**
- Contract definition: 1h
- Schema migration: 0.5h
- Engine implementation: 3h
- Tests: 2h
- **Total:** 6.5h

**Product #2 (Kids Clothing):**
- Product service (integrate R3): 2h
- Variant setup logic: 1h
- Tests: 1.5h
- **Total:** 4.5h

**Product #3 (Fresh Food):**
- Product service (integrate R4): 2h
- Batch management logic: 1.5h
- FEFO integration: 1h
- Tests: 1.5h
- **Total:** 6h

**Grand Total:** 23.5h (estimated autonomous construction time)

Compare to baseline: 600h standalone (Kids 280h + Fresh 320h)

**Potential Leverage:** 600h / 23.5h = **25.5×** (if estimate accurate)

---

## Risks & Mitigations

**Risk 1: Variant + Batch combination (e.g., Fresh Milk with size variants)**
- Mitigation: DEFER until real demand appears. Current design treats as separate (either variants OR batches, not both)

**Risk 2: R3/R4 schema changes break R1/R2**
- Mitigation: Backward compatibility enforced (parent product logic unchanged)

**Risk 3: Over-engineering for 2 products**
- Mitigation: Minimal viable design, no speculative features

---

## Next Actions

1. ✅ Design complete (this document)
2. Implement R3 contract + engine + tests
3. Implement R4 contract + engine + tests
4. Validate R3+R4 with Architecture Guard
5. Build Product #2 (Kids Clothing) using R1+R3
6. Build Product #3 (Fresh Food) using R1+R4
7. Run integration tests
8. Collect evidence

**STOP conditions:**
- R3/R4 design conflicts with R1/R2 semantics (escalate)
- Backward compatibility cannot be maintained (escalate)
- Tests fail repeatedly (investigate root cause)

**Autonomous execution:** Proceed without human gates unless STOP condition hit

---

**Status:** 🟢 DESIGN APPROVED (self-determined, evidence-based)  
**Next:** Implementation (R3 → R4 → Products)
