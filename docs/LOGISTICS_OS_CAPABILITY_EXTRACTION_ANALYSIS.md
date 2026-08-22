# Logistics OS Capability Extraction Analysis — Evidence-Based

**Date:** 2026-08-22  
**Purpose:** Identify which E6 patterns should be extracted to OS vs remain Product-specific  
**Principle:** Extract only with evidence of cross-product reuse, not pattern similarity

---

## Extraction Criteria

### DO Extract If
✅ **Cross-Product Evidence:** Used across 2+ Product verticals (not just 2+ requirements)  
✅ **OS-Level Primitive:** Fundamental capability for Logistics domain  
✅ **Clear Contract:** Well-defined interface independent of specific Product  
✅ **Reduces E7 LOC:** E7 can import instead of rewrite  

### DO NOT Extract If
❌ **Pattern Similarity Only:** Looks similar but domain-specific  
❌ **Single Product:** Only Warehouse needs it  
❌ **Premature Abstraction:** No evidence of reuse yet  
❌ **Forced Optimization:** Extracting to hit LOC target  

---

## E6 Pattern Audit

### 🟢 **Platform-Level** (Already Exists, Not E6-Specific)

| Capability | Location | Reuse Evidence | Action |
|-----------|----------|----------------|---------|
| Tenant Isolation | Platform RLS | All products | ✅ Already shared |
| RBAC/Authorization | Platform auth | All products | ✅ Already shared |
| Audit Trail | Platform audit | All products | ✅ Already shared |

**Analysis:** These are Platform capabilities, not extracted from E6.

---

### 🟡 **Logistics OS Candidates** (Extract Only With Evidence)

#### 1. State Machine Transitions

**E6 Usage:**
- R6: Submit for Putaway (draft → submitted)
- R7: Complete Putaway (submitted → completed)
- R8: Hold/Release (any → on_hold → previous)

**Pattern:**
```typescript
// E6 Pattern (R6-R8)
currentStatus → validate transition → newStatus → persist → emit event
```

**Cross-Product Evidence:**
- ✅ Order Fulfillment: order status transitions (pending → picking → packed → shipped)
- ✅ Transportation: shipment status (scheduled → in_transit → delivered)
- ✅ Returns: return status (requested → approved → received)

**Extraction Decision:** 🟢 **EXTRACT**

**Rationale:**
- Status transitions are fundamental to ALL Logistics Products
- Pattern is domain-agnostic (not Warehouse-specific)
- Clear contract: `transition(entity, from, to, rules)`
- E7/E8/E9 will all need this

**Target Location:** `src/platform/logistics/shared-kernel/state-machine/`

**Expected LOC Reduction:** ~200-300 per vertical

---

#### 2. Validation Framework

**E6 Usage:**
- R2: SKU validation (exists, active, tenant-bound)
- R3: Location hierarchy validation (warehouse → zone → aisle → bin)
- R4: Unique constraint validation
- R5: Quantity reconciliation validation

**Pattern:**
```typescript
// E6 Pattern (R2-R5)
validate(input) → check rules → return errors | success
```

**Cross-Product Evidence:**
- ✅ Order Fulfillment: customer validation, address validation, credit check
- ⚠️ Transportation: carrier validation, route validation
- ⚠️ Returns: return reason validation, eligibility validation

**Extraction Decision:** 🟡 **EXTRACT PARTIALLY**

**Rationale:**
- Generic validator pattern is OS-level
- But specific validators (SKU, Location) might be Warehouse-specific
- Need to separate: validation engine (extract) vs validation rules (Product-specific)

**Target Location:** `src/platform/logistics/shared-kernel/validation/`

**What to Extract:**
- ✅ Validation engine/framework
- ✅ Common rules: `exists()`, `isActive()`, `belongsToTenant()`
- ❌ SKU-specific validators (stay in Warehouse)
- ❌ Location hierarchy (might be Warehouse-specific, evaluate in E7)

**Expected LOC Reduction:** ~80-120 per vertical (framework only, not rules)

---

#### 3. Bulk Operation Pattern

**E6 Usage:**
- R13: Bulk inventory movements (process array of items)

**Pattern:**
```typescript
// E6 Pattern (R13)
bulkOperation(items[]) → validate each → execute in transaction → rollback on error
```

**Cross-Product Evidence:**
- ⚠️ Order Fulfillment: bulk allocation? (need to verify in E7)
- ⚠️ Transportation: bulk shipment creation? (need to verify in E8)
- ❌ No clear evidence yet

**Extraction Decision:** 🔴 **WAIT FOR E7**

**Rationale:**
- Only 1 use case in E6 (R13 bulk movements)
- No evidence yet that E7/E8 need bulk operations
- Premature to extract without cross-product proof
- **Re-evaluate after E7:** If E7 also needs bulk pattern → extract before E8

**Expected LOC Reduction:** Unknown (need E7 evidence)

---

#### 4. Aggregation Queries

**E6 Usage:**
- R12: Count receipts by status (`COUNT(*) GROUP BY status`)
- R14: Sum inventory value (`SUM(quantity * unit_price)`)

**Pattern:**
```typescript
// E6 Pattern (R12, R14)
aggregate(entity, metric, groupBy?, filter?)
```

**Cross-Product Evidence:**
- ✅ Order Fulfillment: count orders by status, sum order value
- ✅ Transportation: count shipments by carrier, sum freight cost
- ✅ Returns: count returns by reason, sum refund amount

**Extraction Decision:** 🟢 **EXTRACT**

**Rationale:**
- Aggregation is fundamental to all Products
- Pattern is domain-agnostic (COUNT, SUM, AVG, GROUP BY)
- Clear contract: query builder for common aggregations
- Every Product needs reporting/metrics

**Target Location:** `src/platform/logistics/shared-kernel/queries/`

**Expected LOC Reduction:** ~100-150 per vertical

---

#### 5. Constraint Checking

**E6 Usage:**
- R15: Bin capacity constraint (current + new ≤ max)

**Pattern:**
```typescript
// E6 Pattern (R15)
checkConstraint(entity, constraint) → validate → return pass/fail + reason
```

**Cross-Product Evidence:**
- ⚠️ Order Fulfillment: inventory availability constraint?
- ⚠️ Transportation: vehicle capacity constraint?
- ❌ No clear evidence yet

**Extraction Decision:** 🔴 **WAIT FOR E7**

**Rationale:**
- Only 1 constraint in E6 (bin capacity)
- Bin capacity is potentially Warehouse-specific
- Need to see if E7 has similar constraints
- **Re-evaluate after E7:** If E7 needs constraint framework → extract before E8

**Expected LOC Reduction:** Unknown (need E7 evidence)

---

### 🟢 **Logistics OS Domain Capabilities** (Inventory-Specific)

#### 6. Inventory Movement

**E6 Usage:**
- R1: Receive inventory (create inventory_on_hand record)
- R7: Complete putaway (update bin location)
- R13: Bulk movements (transfer between bins)

**Pattern:**
```typescript
// E6 Pattern (R1, R7, R13)
moveInventory(from, to, quantity, reason) → validate → update → audit
```

**Cross-Product Evidence:**
- ✅ Order Fulfillment: allocate inventory (reserve for order)
- ✅ Order Fulfillment: pick inventory (move from bin to staging)
- ⚠️ Returns: receive return (add back to inventory)

**Extraction Decision:** 🟢 **EXTRACT AS LOGISTICS OS CAPABILITY**

**Rationale:**
- Inventory movement is core to Logistics domain
- Multiple Products (Warehouse, Fulfillment, Returns) need this
- Clear domain capability (not Platform, not Product-specific)

**Target Location:** `src/platform/logistics/inventory/` (OS-level, not shared-kernel)

**Expected LOC Reduction:** ~150-200 per vertical

---

#### 7. SKU Management

**E6 Usage:**
- R2: SKU validation (check SKU exists, active, tenant-bound)
- Schema: `logistics_warehouse_skus` table

**Pattern:**
```typescript
// E6 Pattern (R2)
validateSKU(sku_id) → query → check exists + active + tenant
```

**Cross-Product Evidence:**
- ✅ Order Fulfillment: validate SKU in order line items
- ✅ Inventory Optimization: SKU-level forecasting
- ⚠️ Transportation: SKU-level weight/dimensions?

**Extraction Decision:** 🟡 **EXTRACT SKU AS OS ENTITY**

**Rationale:**
- SKU is fundamental to Logistics domain
- Multiple Products reference SKU
- But: E6 schema is `logistics_warehouse_skus` (Product-specific naming)
- **Action:** Create `logistics_skus` (OS-level) for E7 to use

**Target Location:** `src/platform/logistics/master-data/sku/`

**Expected LOC Reduction:** ~50-100 per vertical (from shared SKU entity)

---

### 🔴 **Warehouse-Specific** (Do NOT Extract)

#### 8. Bin Management

**E6 Usage:**
- R3: Location hierarchy validation (warehouse → zone → aisle → bin)
- R15: Bin capacity constraint
- Schema: `logistics_warehouse_bins`

**Pattern:**
```typescript
// E6 Pattern (R3, R15)
Warehouse-specific location hierarchy
```

**Cross-Product Evidence:**
- ❌ Order Fulfillment: might use "pick location" but not necessarily bins
- ❌ Transportation: no bin concept
- ❌ Returns: might reuse bins, but from Warehouse Product

**Extraction Decision:** 🔴 **DO NOT EXTRACT**

**Rationale:**
- Bin is Warehouse-specific concept
- Location hierarchy (warehouse/zone/aisle/bin) is Warehouse domain
- Other Products may have different location concepts
- Keep in Warehouse Product

**Expected LOC Reduction:** 0 (stays in Product)

---

#### 9. Receipt Workflow

**E6 Usage:**
- R1-R9: Receipt entity + workflow (receive → validate → putaway)
- Schema: `logistics_warehouse_receipts`

**Pattern:**
```typescript
// E6 Pattern (R1-R9)
Receipt-specific workflow
```

**Cross-Product Evidence:**
- ❌ Order Fulfillment: has "orders", not "receipts"
- ❌ Transportation: has "shipments", not "receipts"
- ❌ Receipt is Warehouse domain concept

**Extraction Decision:** 🔴 **DO NOT EXTRACT**

**Rationale:**
- Receipt is Warehouse Product entity
- Other Products have different root entities (Order, Shipment, Return)
- State machine pattern can be extracted, but not Receipt itself

**Expected LOC Reduction:** 0 (stays in Product)

---

#### 10. Vendor Management

**E6 Usage:**
- R8: Vendor entity (added in B8 bug fix)
- Schema: `logistics_warehouse_vendors`

**Pattern:**
```typescript
// E6 Pattern (R8)
Vendor reference for receipt
```

**Cross-Product Evidence:**
- ⚠️ Procurement: might need vendors
- ⚠️ Transportation: might need carriers (similar to vendors)
- ❌ Not clear if same "Vendor" concept

**Extraction Decision:** 🔴 **WAIT FOR E7**

**Rationale:**
- Vendor only used in Warehouse (receipts from vendors)
- Transportation might need "Carrier" (different from Vendor)
- Procurement might need "Supplier" (different from Vendor)
- **Re-evaluate after E7/E8:** Might extract as "Partner" (generic) if evidence emerges

**Expected LOC Reduction:** Unknown (need more verticals)

---

## Extraction Summary

### 🟢 Extract NOW (Before E7)

| Capability | Type | Evidence | Target Location | LOC Saved |
|-----------|------|----------|-----------------|-----------|
| **State Machine** | OS Shared Kernel | 3+ Products | `shared-kernel/state-machine/` | ~200-300 |
| **Aggregation Queries** | OS Shared Kernel | 3+ Products | `shared-kernel/queries/` | ~100-150 |
| **Validation Engine** | OS Shared Kernel | All Products | `shared-kernel/validation/` | ~80-120 |
| **Inventory Movement** | OS Domain | 2+ Products | `inventory/movement.service.ts` | ~150-200 |
| **SKU Entity** | OS Master Data | 2+ Products | `master-data/sku/` | ~50-100 |

**Total Expected LOC Reduction in E7:** ~580-870 LOC (21-32% of E6 baseline)

### 🟡 Re-Evaluate After E7

| Capability | Reason | Decision Point |
|-----------|--------|----------------|
| **Bulk Operations** | Only 1 use case in E6 | If E7 needs bulk → extract before E8 |
| **Constraint Framework** | Only 1 constraint in E6 | If E7 needs constraints → extract before E8 |
| **Vendor/Partner** | Unclear if shared concept | If E8 needs partner → extract before E9 |

### 🔴 Do NOT Extract

| Capability | Reason |
|-----------|--------|
| **Bin Management** | Warehouse-specific location concept |
| **Receipt Entity** | Warehouse Product domain model |
| **Location Hierarchy** | Warehouse-specific, other Products may differ |

---

## Extraction Plan

### Phase 1: Shared Kernel (Priority)

**Timeline:** 2-3 days  
**Scope:** Extract 🟢 capabilities with cross-product evidence

**Tasks:**
1. **State Machine Framework**
   - Design: `Transition`, `StateRules`, `StateMachine` interfaces
   - Implement: Generic state transition validator
   - Test: Verify with E6 receipt transitions (backward compatible)

2. **Aggregation Query Builder**
   - Design: `AggregateQuery`, `GroupBy`, `Filter` interfaces
   - Implement: COUNT, SUM, AVG, GROUP BY helpers
   - Test: Verify with E6 metrics queries

3. **Validation Engine**
   - Design: `Validator`, `ValidationRule`, `ValidationResult` interfaces
   - Implement: Rule engine + common rules (exists, active, tenant)
   - Test: Verify with E6 SKU validation

**Deliverables:**
```
src/platform/logistics/shared-kernel/
├── state-machine/
│   ├── types.ts          (interfaces)
│   ├── state-machine.ts  (implementation)
│   └── index.ts
├── queries/
│   ├── types.ts
│   ├── aggregation.ts
│   └── index.ts
└── validation/
    ├── types.ts
    ├── validator.ts
    ├── rules.ts
    └── index.ts
```

### Phase 2: Domain Capabilities

**Timeline:** 1-2 days  
**Scope:** Extract Inventory + SKU (Logistics OS domain)

**Tasks:**
1. **Inventory Movement Service**
   - Design: `moveInventory()`, `allocateInventory()`, `releaseInventory()`
   - Implement: Movement logic with audit trail
   - Test: Verify with E6 receive/putaway

2. **SKU Master Data**
   - Migrate: `logistics_warehouse_skus` → `logistics_skus` (OS-level)
   - Design: SKU contract for cross-product use
   - Test: Verify E6 still works with OS-level SKU

**Deliverables:**
```
src/platform/logistics/
├── inventory/
│   ├── movement.service.ts
│   └── types.ts
└── master-data/
    └── sku/
        ├── sku.entity.ts
        ├── sku.service.ts
        └── types.ts
```

### Phase 3: E6 Backward Compatibility

**Timeline:** 1 day  
**Scope:** Ensure E6 still works after extraction (no refactor, just verify)

**Tasks:**
1. Run all E6 tests (R1-R15)
2. Verify 60/60 PASS unchanged
3. Document that E6 baseline unchanged (extraction happened after lock)

---

## Critical Rules

### ✅ DO
- Extract only 🟢 capabilities with cross-product evidence
- Design clean contracts/interfaces
- Test backward compatibility with E6
- Document extraction rationale

### ❌ DO NOT
- Refactor E6 to use extracted capabilities (baseline must stay immutable)
- Extract 🟡 or 🔴 capabilities without E7 evidence
- Force abstractions to hit LOC targets
- Change E6 LOC numbers or metrics

---

## E7 Hypothesis

**If extraction is correct, E7 should show:**
- Category C > 0% (imports state-machine, queries, validation)
- Total LOC < 2,700 (reuses extracted capabilities)
- Implementation focuses on Order Fulfillment domain logic

**If E7 shows C = 0% or LOC ≈ E6:**
- Extraction was wrong (capabilities not actually reusable)
- OR E7 vertical too different from E6
- OR Abstractions too complex to use

**This is the test.**

---

## Next Steps

1. ✅ **Lock E6** (complete, no changes)
2. ⏳ **Extract Phase 1** (state-machine, queries, validation)
3. ⏳ **Extract Phase 2** (inventory movement, SKU)
4. ⏳ **Verify E6** (backward compatibility check)
5. ⏳ **Plan E7** (Order Fulfillment requirements)
6. ⏳ **Execute E7** (measure with same protocol)

---

**STATUS:** Analysis complete, ready for extraction  
**Date:** 2026-08-22  
**Principle:** Evidence > Pattern Similarity
