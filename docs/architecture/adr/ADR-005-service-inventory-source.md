# ADR-005: Service Inventory Source Decision

**Status:** ✅ **RESOLVED — BUILD DEDICATED ISERVICEINVENTORYENGINE**  
**Investigation Date:** 2026-09-15  
**Decision Date:** 2026-09-15  
**Decision:** Build dedicated service catalog contract (DO NOT reuse E7 Logistics)  
**Rationale:** 7-gate investigation confirmed semantic mismatch, E7 frozen, dedicated contract cheaper/faster

**Investigation:** `H2_CONTRACT_02_OWNERSHIP_INVESTIGATION.md`

---

## Context

### Background

**H0 Finding:** Service Inventory is **NOT must-build** (Bella Spa has `packages.product_usage` JSONB column).

**Current Implementation:**
- **Database:** `packages` table has `product_usage` JSONB column
- **Migration:** 20260716000000_add_product_usage_to_packages.sql
- **Structure:** Product usage tracked per service package (basic tracking)
- **Limitation:** No dedicated inventory tables, no stock levels, no reorder alerts

**Haircut Requirement:** Track service-level inventory:
- Shampoo per haircut (30ml per service)
- Gel per styling (15ml per service)
- Towels per service (1 towel per service)
- Stock levels, reorder thresholds, deduction tracking

**Strategic Question:** Should Haircut:
- **Option A:** Integrate Logistics Kernel E7 (Domain, Operational, Rules & Traceability)?
- **Option B:** Extend `packages.product_usage` (product-level inventory)?
- **Option C:** Investigate E7 applicability first, then decide?

---

## Decision

**We adopt INVESTIGATE-FIRST STRATEGY with PRODUCT-LEVEL FALLBACK:**

### Phase 1: Logistics E7 Investigation (Week 1, 2-3 days)

**Investigate E7 Applicability:**
1. Can E7 Domain Kernel (E7.1) handle service-level inventory?
2. Does E7 support fractional units (30ml shampoo vs 1 bottle)?
3. Can E7 Movement tracking handle per-service deductions?
4. Is E7 Operational Kernel (E7.2) flexible for beauty service alerts?

**Timeline:** 2-3 days (Week 1, parallel with contract extraction)

---

### Phase 2: Decision Based on Investigation

**IF E7 Applicable (Service-Level Inventory Supported):**
- **Decision:** Integrate Logistics Kernel E7
- **Implementation:** Week 3 (2-3 days integration)
- **Effort:** 10% new code (contract integration + configuration)
- **Benefit:** Mature kernel (547 tests), full inventory features (stock levels, traceability, audit)

**IF E7 Not Applicable (Warehouse-Only, Not Service-Level):**
- **Decision:** Extend `packages.product_usage` (product-level inventory)
- **Implementation:** Week 3 (2-3 days extension)
- **Effort:** 50% new code (service_inventory table + deduction logic)
- **Benefit:** Simple, Haircut-specific, full control

**Fallback:** If investigation inconclusive or takes > 3 days, default to product-level extension.

---

## Rationale

### Why Investigate E7 First?

#### 1. Validate Cross-Vertical Kernel Reuse

**Platform-of-Platforms Architecture (ADR-001):**
> Products consume Kernels via contracts. Logistics Kernel E7 serves logistics domain across verticals.

**Question:** Can Logistics Kernel (warehouse inventory) serve Beauty Services (service-level inventory)?

**Strategic Value:**
- ✅ **IF YES:** Validates cross-vertical kernel reuse (Logistics → Beauty)
- ✅ **IF YES:** Reduces code volume (10% integration vs 50% custom build)
- ✅ **IF YES:** Leverages mature kernel (547 regression tests, frozen, production-grade)
- ⚠️ **IF NO:** Learn E7 limitations (document what E7 cannot do)

**Investigation Cost:** 2-3 days (low cost for high-value learning)

---

#### 2. Logistics Kernel E7 is Production-Grade

**E7 Maturity:**
- **E7.1 Domain Kernel:** 12 artifacts, 366 regression tests ✅
- **E7.2 Operational Kernel:** 4 artifacts, 73 regression tests ✅
- **E7.3 Rules & Traceability:** 9 artifacts, 108 regression tests ✅
- **Total:** 25 artifacts, 547 tests, **FROZEN** (stable, no breaking changes)

**E7 Capabilities (from freeze documentation):**
- InventoryItem (SKU, units, stock tracking)
- Movement (stock in, stock out, adjustments, transfers)
- Stock levels (current stock, reserved stock, available stock)
- Reorder management (thresholds, alerts, purchase orders)
- Audit trail (every movement tracked, traceability)

**IF E7 fits:** Haircut gets enterprise-grade inventory system with 10% integration effort.

---

#### 3. E7 Investigation Informs Future Verticals

**Future Beauty Verticals:**
- Nail Shop (Q1 2027): Needs inventory (nail polish, acetone, files)
- Massage (Q2 2027): Needs inventory (oils, lotions, towels)
- Spa extensions: Already has product_usage, may need full inventory

**Learning from E7 Investigation:**
- IF E7 fits: All beauty verticals integrate E7 (enterprise inventory)
- IF E7 doesn't fit: All beauty verticals use product-level inventory (consistent pattern)
- Document E7 applicability: "E7 for warehouse, not service-level" (architectural knowledge)

**Investment:** 3-day investigation benefits 4+ verticals (high ROI).

---

#### 4. Low Investigation Cost

**Investigation Scope (2-3 days):**

**Day 1: E7 Contract Review**
- Read: `platform/logistics/contracts/inventory-domain.contract.ts`
- Read: `platform/logistics/contracts/movement.contract.ts`
- Read: `platform/logistics/contracts/operational.contract.ts`
- Question: Does E7 support fractional units (30ml vs 1 bottle)?
- Question: Can Movement handle per-service deductions (vs warehouse movements)?

**Day 2: E7 Schema Analysis**
- Read: E7.1 Domain Kernel entities (InventoryItem, SKU, UnitOfMeasure)
- Read: E7.2 Operational Kernel (stock levels, alerts, reorder)
- Read: E7.3 Traceability (movement audit, transaction logs)
- Question: Is E7 flexible for service-level inventory semantics?

**Day 3: Prototype Integration (if applicable)**
- Create proof-of-concept: Haircut service → E7 inventory deduction
- Test: Can E7 handle "30ml shampoo per haircut" deduction?
- Decision: E7 applicable? YES/NO

**Fallback:** If Day 1-2 reveals E7 incompatible, skip Day 3 (decision made early).

---

### Why NOT Decide Now (Without Investigation)?

**Assumption Risk:**
- ❌ Assuming E7 fits → Integrate E7 → Discover incompatibility → Wasted 2 weeks
- ❌ Assuming E7 doesn't fit → Build custom → Discover E7 could work → Wasted opportunity

**Evidence-Based Decision:**
- ✅ Investigate E7 (3 days) → Know actual applicability → Make informed decision
- ✅ Low cost (3 days) for high-value information (E7 reusability validated or rejected)

---

## Investigation Plan

### Week 1, Day 1: E7 Contract Review + Ownership Analysis

**Objective:** Understand E7 Domain Kernel contracts AND validate ownership boundaries.

**Tasks:**

1. **Read E7 Contract Interfaces:**
```bash
# Locate E7 contracts
ls platform/logistics/contracts/

# Read Domain Kernel contract
cat platform/logistics/contracts/inventory-domain.contract.ts

# Read Movement contract
cat platform/logistics/contracts/movement.contract.ts

# Read Operational Kernel contract
cat platform/logistics/contracts/operational.contract.ts
```

2. **Analyze Contract Methods:**
```typescript
// Example: IInventoryDomain (hypothetical)
interface IInventoryDomain {
  // Inventory item management
  createItem(item: InventoryItemInput): Promise<InventoryItem>;
  getItem(sku: string): Promise<InventoryItem>;
  updateStock(sku: string, quantity: number, reason: string): Promise<Movement>;
  
  // Stock queries
  getCurrentStock(sku: string): Promise<StockLevel>;
  getAvailableStock(sku: string): Promise<number>;
  
  // Question: Does this support fractional units (30ml vs 1 bottle)?
  // Question: Can "quantity" be 0.03 (30ml from 1000ml bottle)?
}

// Example: IMovement (hypothetical)
interface IMovement {
  // Movement tracking
  recordMovement(movement: MovementInput): Promise<Movement>;
  getMovements(filter: MovementFilter): Promise<Movement[]>;
  
  // Question: Can "movementType" include 'service_deduction'?
  // Question: Does Movement support "reference" to link service execution?
}
```

3. **Document Key Questions (Contract Applicability):**
- Does E7 support **fractional units** (30ml shampoo)?
- Does E7 support **service-level deductions** (per-service usage)?
- Does E7 support **virtual inventory** (estimated usage vs actual stock)?
- Can E7 **reference** link to service execution (session_id)?

4. **🔴 OWNERSHIP ANALYSIS (MANDATORY):**

**Question:** WHO OWNS Service Inventory data?

**Analysis Framework:**
```
A. Domain Ownership
   - Is "service inventory" a LOGISTICS concern (warehouse, stock management)?
   - OR is it a BEAUTY SERVICES concern (service execution, customer experience)?
   
B. Business Context
   - Who decides "shampoo per haircut" quantity? → Product team (Beauty Services)
   - Who manages stock levels? → Salon manager (Beauty Services)
   - Who handles reorder? → Beauty Services purchasing (NOT central warehouse)
   
C. Data Authority
   - Does E7 own "SKU definition" for beauty products? → NO (Beauty Services owns)
   - Does E7 own "stock levels" for salon inventory? → UNCLEAR (investigate)
   - Does E7 own "deduction rules" per service? → NO (Beauty Services owns)
```

**Expected Ownership Verdict:**
- **IF E7 owns data:** Service inventory is a logistics artifact → E7 integration valid
- **IF Beauty Services owns data:** Service inventory is a product artifact → E7 integration invalid (semantic mismatch)
- **IF shared ownership:** Requires clear boundary → Investigate further in Day 2

**5. Semantic Fit Assessment:**

**Question:** Does E7's semantic model match Beauty Services domain?

**Semantic Mismatch Indicators:**
- E7 uses "warehouse" terminology (locations, bins, shelves) → Beauty uses "salon, station"
- E7 tracks "purchase orders, suppliers" → Beauty may not need supplier management
- E7 designed for "physical inventory movement" (transfers, shipments) → Beauty tracks "consumption, usage"
- E7 assumes "discrete items" (SKUs, barcodes) → Beauty may use "virtual inventory" (estimated usage)

**Semantic Fit Test:**
```typescript
// E7 Vocabulary
const warehouseMovement = {
  type: 'transfer',
  fromLocation: 'warehouse-A',
  toLocation: 'warehouse-B',
  sku: 'ITEM-001',
  quantity: 100
};

// Beauty Services Vocabulary
const serviceConsumption = {
  type: 'service_deduction',
  session: 'session-12345',
  service: 'haircut-premium',
  product: 'shampoo',
  quantityUsed: 30  // ml
};

// Question: Can E7 model translate to Beauty Services model?
// If translation requires excessive adapters → semantic mismatch
```

**Deliverable:** 
- E7 contract analysis document (key questions answered or flagged)
- **OWNERSHIP MAP:** Who owns service inventory data? (E7 vs Beauty Services)
- **SEMANTIC FIT REPORT:** Does E7 vocabulary match Beauty Services? (YES/NO with evidence)

---

### Week 1, Day 2: E7 Schema Analysis + Invariants Validation

**Objective:** Understand E7 data model AND validate domain invariants compatibility.

**Tasks:**

1. **Read E7.1 Domain Kernel Entities:**
```bash
# Locate E7 domain entities
ls platform/logistics/engines/domain/

# Read InventoryItem entity
cat platform/logistics/engines/domain/inventory-item.entity.ts

# Read Movement entity
cat platform/logistics/engines/domain/movement.entity.ts
```

2. **Analyze Entity Schema:**
```typescript
// Example: InventoryItem (hypothetical)
class InventoryItem {
  sku: string;
  name: string;
  category: string;
  unitOfMeasure: 'piece' | 'kg' | 'liter' | 'meter';  // Question: Does this support 'ml'?
  currentStock: number;  // Question: Can this be fractional (30.5 ml)?
  reservedStock: number;
  availableStock: number;  // Computed: currentStock - reservedStock
  reorderThreshold: number;
  reorderQuantity: number;
}

// Example: Movement (hypothetical)
class Movement {
  id: string;
  sku: string;
  movementType: 'stock_in' | 'stock_out' | 'adjustment' | 'transfer';  // Question: Can add 'service_deduction'?
  quantity: number;  // Question: Can be fractional (0.03 = 30ml)?
  reason: string;
  reference?: string;  // Question: Can reference service execution (session_id)?
  createdAt: Date;
  createdBy: string;
}
```

3. **Read E7.2 Operational Kernel:**
```bash
# Read stock level management
cat platform/logistics/engines/operational/stock-manager.ts

# Read reorder management
cat platform/logistics/engines/operational/reorder-manager.ts
```

4. **Analyze Operational Logic:**
- Stock deduction algorithm: Does it support per-service deductions?
- Reorder alerts: Can thresholds work for service-level inventory?
- Stock reservations: Can Haircut reserve stock for booked appointments?

5. **🔴 INVARIANTS CHECK (MANDATORY):**

**Question:** Do E7's domain invariants match Beauty Services requirements?

**E7 Invariants to Validate:**

**A. Stock Consistency Invariant:**
```typescript
// E7 Invariant (hypothetical)
INVARIANT: availableStock = currentStock - reservedStock
INVARIANT: currentStock >= 0 (no negative stock)
INVARIANT: reservedStock >= 0

// Beauty Services Requirement
REQUIREMENT: Service can be booked even if stock temporarily negative (backorder)
REQUIREMENT: Virtual inventory (estimated usage, not exact stock count)

// Question: Does E7 allow temporary negative stock? → If NO, incompatible
```

**B. Movement Atomicity Invariant:**
```typescript
// E7 Invariant (hypothetical)
INVARIANT: Every stock change MUST create a Movement record (audit trail)
INVARIANT: Movement quantity MUST match stock delta exactly

// Beauty Services Requirement
REQUIREMENT: Bulk deductions (multiple products per service, atomic transaction)
REQUIREMENT: Estimated deductions (30ml ± 5ml tolerance, not exact)

// Question: Does E7 support bulk movements? → If NO, performance issue
// Question: Does E7 require exact quantities? → If YES, incompatible with estimates
```

**C. Tenant Isolation Invariant:**
```typescript
// E7 Invariant (hypothetical)
INVARIANT: Inventory MUST be tenant-isolated (no cross-tenant stock access)
INVARIANT: Movement MUST be tenant-scoped

// Beauty Services Requirement
REQUIREMENT: Multi-location salons (same tenant, different stock locations)
REQUIREMENT: Central inventory + per-salon inventory (hierarchy)

// Question: Does E7 support location hierarchy within tenant? → If NO, architectural gap
```

**D. Reorder Threshold Invariant:**
```typescript
// E7 Invariant (hypothetical)
INVARIANT: Reorder alert fires when currentStock < reorderThreshold
INVARIANT: Only one active reorder per SKU (no duplicate purchase orders)

// Beauty Services Requirement
REQUIREMENT: Predictive reorder (based on booking forecast, not just current stock)
REQUIREMENT: Multiple suppliers per product (price comparison)

// Question: Does E7 support predictive thresholds? → If NO, feature gap
```

**6. 🔴 E7 FROZEN Constraint Validation:**

**Question:** Can Beauty Services use E7 WITHOUT modifying frozen code?

**E7 FROZEN Status:**
- **E7.1:** 12 artifacts, 366 tests → SEALED (no modifications allowed)
- **E7.2:** 4 artifacts, 73 tests → SEALED
- **E7.3:** 9 artifacts, 108 tests → SEALED

**Validation Checks:**
```
1. Can Beauty Services extend E7 via PUBLIC CONTRACTS only?
   → Check: All required methods in IInventoryDomain contract?
   → Check: No need to modify E7 internals?

2. If E7 lacks feature, can Beauty Services add it in PRODUCT LAYER?
   → Example: Predictive reorder → Build in Haircut, call E7 for actual stock
   → Question: Is workaround clean OR does it violate E7's design?

3. If E7 invariant incompatible, can it be bypassed?
   → Example: Negative stock not allowed → Can Haircut handle "insufficient stock" gracefully?
   → Question: Does rejection break Beauty Services UX?
```

**E7 FROZEN Violation Indicators:**
- ❌ Need to add `service_deduction` movement type → Requires E7 modification → **BLOCKED**
- ❌ Need to support negative stock → Requires E7 invariant change → **BLOCKED**
- ❌ Need location hierarchy → Requires E7 schema change → **BLOCKED**
- ✅ Need predictive reorder → Build in Haircut layer, use E7 for stock → **OK**

**If ANY frozen violation detected → E7 integration INVALID**

**7. Dependency Direction Check:**

**Question:** Does integration respect dependency flow?

**Valid Dependency:**
```
Beauty Services Product → E7 Public Contract → E7 Kernel
(Product depends on Platform, NOT Platform depends on Product)
```

**Invalid Dependency:**
```
E7 Kernel → Beauty Services data model
(Platform should NOT know about Beauty Services domain)
```

**Check:**
- Does E7 need to know "haircut", "shampoo", "service" concepts? → If YES, **INVALID**
- Can E7 treat Beauty Services as generic "inventory consumer"? → If YES, **VALID**

**8. Data Ownership Validation:**

**Question:** Who writes/reads service inventory data?

**E7 Ownership Model:**
```
E7 owns: InventoryItem, Movement, StockLevel entities
E7 writes: Stock changes, movements, alerts
Products read: Current stock, availability
```

**Beauty Services Requirement:**
```
Beauty Services needs: Write "service deduction" movements
Beauty Services needs: Define product SKUs (shampoo, gel)
Beauty Services needs: Configure reorder thresholds per salon
```

**Ownership Conflict Check:**
- Can Beauty Services CREATE InventoryItem (SKU definition)? → If NO, who owns SKU registry?
- Can Beauty Services WRITE Movement (service deduction)? → If NO, how to track usage?
- Can Beauty Services UPDATE reorderThreshold (per salon)? → If NO, governance bottleneck?

**If ownership conflicts detected → Escalate to Architecture Council**

**9. Extension Cost Assessment:**

**Question:** If E7 needs changes, what's the cost?

**Scenario A: E7 Perfect Fit (0% modification)**
- Beauty Services uses E7 as-is → **COST: 0 person-days**

**Scenario B: E7 Minor Gap (contract extension)**
- Add method to IInventoryDomain → **COST: 2-3 person-days (Architecture Council approval)**
- Backward-compatible contract addition (v1.1.0) → No breaking changes

**Scenario C: E7 Major Gap (invariant violation)**
- Need to change E7 frozen logic (negative stock, location hierarchy) → **COST: 10-15 person-days**
- Requires Architecture Change Request (ACR) → Architecture Council + Logistics team approval
- Requires E7 regression test update (547 tests) → High risk
- **DECISION: Reject E7 integration (too expensive)**

**Scenario D: E7 Incompatible (architectural mismatch)**
- Ownership conflict, semantic mismatch, dependency violation → **COST: N/A (not feasible)**
- **DECISION: Reject E7 integration (use product-level solution)**

**Deliverable:** 
- E7 schema compatibility assessment (fits service-level inventory? YES/NO)
- **INVARIANTS REPORT:** Do E7 invariants match Beauty Services? (Compatible/Incompatible with evidence)
- **E7 FROZEN VALIDATION:** Can Beauty Services use E7 without modifying frozen code? (YES/NO)
- **DEPENDENCY DIRECTION CHECK:** Does integration flow Product → Contract → Kernel? (Valid/Invalid)
- **DATA OWNERSHIP MAP:** Who owns InventoryItem, Movement, SKU registry? (Clear/Conflicted)
- **EXTENSION COST ESTIMATE:** If E7 needs changes, what's the effort? (0-15 person-days)

---

### Week 1, Day 3: Prototype Integration (Conditional)

**Objective:** Validate E7 integration with Haircut use case (if Day 1-2 indicates compatibility).

**Prerequisite:** Day 1-2 investigation suggests E7 is applicable.

**Tasks:**

1. **Create Haircut Service Inventory Items in E7:**
```typescript
// Register haircut products in E7
await inventoryDomain.createItem({
  sku: 'SHAMPOO-001',
  name: 'Professional Shampoo',
  category: 'haircare',
  unitOfMeasure: 'ml',  // milliliters
  currentStock: 5000,  // 5000ml (5 bottles × 1000ml)
  reorderThreshold: 1000,  // reorder when < 1L
  reorderQuantity: 5000  // reorder 5L
});

await inventoryDomain.createItem({
  sku: 'GEL-002',
  name: 'Styling Gel',
  category: 'haircare',
  unitOfMeasure: 'ml',
  currentStock: 3000,  // 3000ml
  reorderThreshold: 500,
  reorderQuantity: 2000
});

await inventoryDomain.createItem({
  sku: 'TOWEL-003',
  name: 'Service Towel',
  category: 'supplies',
  unitOfMeasure: 'piece',
  currentStock: 50,  // 50 towels
  reorderThreshold: 10,
  reorderQuantity: 30
});
```

2. **Integrate with Haircut Service Execution:**
```typescript
// src/products/bella-haircut/services/haircut-execution.service.ts

export class HaircutExecutionService {
  constructor(
    private inventoryDomain: IInventoryDomain,  // E7 contract
    private sessionTracking: ISessionTracking
  ) {}
  
  async completeHaircut(sessionId: string): Promise<void> {
    const session = await this.sessionTracking.getSession(sessionId);
    const service = await this.getService(session.serviceId);
    
    // Deduct inventory via E7
    for (const product of service.product_usage.products) {
      await this.inventoryDomain.updateStock(
        product.sku,
        -product.quantity_per_service,  // Negative = deduction (e.g., -30 for 30ml)
        'service_execution',
        { reference: sessionId }
      );
    }
    
    // Mark session complete
    await this.sessionTracking.markCompleted(sessionId);
  }
  
  async checkInventoryAvailability(serviceId: string): Promise<boolean> {
    const service = await this.getService(serviceId);
    
    // Check if sufficient inventory via E7
    for (const product of service.product_usage.products) {
      const available = await this.inventoryDomain.getAvailableStock(product.sku);
      
      if (available < product.quantity_per_service) {
        return false;  // Insufficient inventory
      }
    }
    
    return true;
  }
}
```

3. **Test Prototype:**
```typescript
// Test: Complete haircut → inventory deducted
const session = await createTestSession('haircut-basic');
await haircutService.completeHaircut(session.id);

// Verify: Stock reduced
const shampooStock = await inventoryDomain.getCurrentStock('SHAMPOO-001');
expect(shampooStock).toBe(4970);  // 5000 - 30 = 4970ml

// Test: Check availability before service
const canServe = await haircutService.checkInventoryAvailability('haircut-premium');
expect(canServe).toBe(true);
```

4. **Evaluate Integration:**
- ✅ Does E7 support fractional units (30ml deductions)?
- ✅ Does Movement tracking link to service execution?
- ✅ Do reorder alerts work for service inventory?
- ✅ Is integration straightforward (< 1 day)?

**Deliverable:** Prototype validation report (E7 applicable? YES/NO with evidence).

---

### Decision Point: End of Week 1, Day 3

**IF E7 Investigation → APPLICABLE:**
- ✅ E7 supports service-level inventory (fractional units, per-service deductions)
- ✅ Prototype validated (Haircut can integrate E7)
- ✅ Decision: **INTEGRATE LOGISTICS KERNEL E7**
- Timeline: Week 3 implementation (2-3 days integration)

**IF E7 Investigation → NOT APPLICABLE:**
- ❌ E7 is warehouse-only (no fractional units OR no service-level semantics)
- ❌ Prototype failed (E7 cannot handle service inventory)
- ❌ Decision: **EXTEND packages.product_usage (Product-Level Inventory)**
- Timeline: Week 3 implementation (2-3 days extension)

**IF E7 Investigation → INCONCLUSIVE (Day 3):**
- ⚠️ Cannot determine applicability in 3 days
- ⚠️ Fallback Decision: **EXTEND packages.product_usage (Product-Level)**
- Rationale: Risk mitigation (known solution vs uncertain E7 integration)

---

## Option A: Integrate Logistics Kernel E7

**Approach:** Haircut consumes E7 Domain Kernel (IInventoryDomain) via contract.

**Implementation (Week 3, 2-3 days):**

### Day 1: E7 Contract Integration

**Register Haircut Products in E7:**
```typescript
// src/products/bella-haircut/services/inventory-setup.service.ts

export class InventorySetupService {
  constructor(private inventoryDomain: IInventoryDomain) {}
  
  async setupHaircutInventory(): Promise<void> {
    // Define haircut products
    const products = [
      { sku: 'SHAMPOO-BASIC-001', name: 'Basic Shampoo', unit: 'ml', stock: 10000, reorder: 2000, perService: 30 },
      { sku: 'SHAMPOO-PREMIUM-002', name: 'Premium Shampoo', unit: 'ml', stock: 5000, reorder: 1000, perService: 50 },
      { sku: 'GEL-LIGHT-003', name: 'Light Styling Gel', unit: 'ml', stock: 3000, reorder: 500, perService: 15 },
      { sku: 'GEL-STRONG-004', name: 'Strong Styling Gel', unit: 'ml', stock: 3000, reorder: 500, perService: 20 },
      { sku: 'TOWEL-STANDARD-005', name: 'Service Towel', unit: 'piece', stock: 100, reorder: 20, perService: 1 },
      { sku: 'CAPE-006', name: 'Haircut Cape', unit: 'piece', stock: 50, reorder: 10, perService: 1 },
    ];
    
    // Register in E7
    for (const product of products) {
      await this.inventoryDomain.createItem({
        sku: product.sku,
        name: product.name,
        category: 'haircut_supplies',
        unitOfMeasure: product.unit,
        currentStock: product.stock,
        reorderThreshold: product.reorder,
        reorderQuantity: product.reorder * 2
      });
    }
  }
}
```

**Link Products to Services:**
```typescript
// Update packages table: product_usage references E7 SKUs
UPDATE packages SET product_usage = jsonb_build_object(
  'products', jsonb_build_array(
    jsonb_build_object('sku', 'SHAMPOO-BASIC-001', 'quantity_per_service', 30, 'unit', 'ml'),
    jsonb_build_object('sku', 'GEL-LIGHT-003', 'quantity_per_service', 15, 'unit', 'ml'),
    jsonb_build_object('sku', 'TOWEL-STANDARD-005', 'quantity_per_service', 1, 'unit', 'piece')
  )
)
WHERE module_key = 'haircut' AND name = 'Basic Haircut';
```

---

### Day 2: Service Execution Integration

**Deduct Inventory on Service Completion:**
```typescript
// src/products/bella-haircut/services/haircut-execution.service.ts

export class HaircutExecutionService {
  constructor(
    private inventoryDomain: IInventoryDomain,  // E7 contract
    private sessionTracking: ISessionTracking,
    private packageService: PackageService
  ) {}
  
  async completeHaircut(sessionId: string): Promise<void> {
    const session = await this.sessionTracking.getSession(sessionId);
    const service = await this.packageService.findById(session.serviceId);
    
    // Deduct inventory for each product
    const movements: Movement[] = [];
    for (const product of service.product_usage.products) {
      const movement = await this.inventoryDomain.updateStock(
        product.sku,
        -product.quantity_per_service,  // Negative = deduction
        'service_execution',
        {
          reference: sessionId,
          referenceType: 'session',
          notes: `Haircut service: ${service.name}`
        }
      );
      movements.push(movement);
    }
    
    // Link movements to session (for audit)
    await this.sessionTracking.updateSession(sessionId, {
      inventoryMovements: movements.map(m => m.id)
    });
    
    // Mark session complete
    await this.sessionTracking.markCompleted(sessionId);
  }
}
```

**Check Inventory Before Booking:**
```typescript
export class HaircutBookingService {
  constructor(
    private inventoryDomain: IInventoryDomain,
    private appointmentEngine: IAppointmentEngine,
    private packageService: PackageService
  ) {}
  
  async createAppointment(request: AppointmentRequest): Promise<Appointment> {
    // Check inventory availability
    const hasInventory = await this.checkInventoryAvailability(request.serviceId);
    
    if (!hasInventory) {
      throw new Error('Insufficient inventory for this service. Please contact staff.');
    }
    
    // Create appointment
    return this.appointmentEngine.createAppointment(request);
  }
  
  private async checkInventoryAvailability(serviceId: string): Promise<boolean> {
    const service = await this.packageService.findById(serviceId);
    
    for (const product of service.product_usage.products) {
      const available = await this.inventoryDomain.getAvailableStock(product.sku);
      
      if (available < product.quantity_per_service) {
        return false;  // Insufficient stock
      }
    }
    
    return true;
  }
}
```

---

### Day 3: Reorder Alerts Integration

**Listen to E7 Reorder Alerts:**
```typescript
// src/products/bella-haircut/services/inventory-alert.service.ts

export class InventoryAlertService {
  constructor(
    private eventBus: EventBus,
    private notificationService: NotificationService
  ) {}
  
  async subscribeToReorderAlerts(): Promise<void> {
    // Subscribe to E7 reorder events
    this.eventBus.subscribe('inventory.reorder_needed', async (event) => {
      const { sku, currentStock, reorderThreshold, item } = event.data;
      
      // Notify salon manager
      await this.notificationService.send({
        recipientRole: 'salon_manager',
        type: 'inventory_reorder',
        priority: 'high',
        data: {
          productName: item.name,
          sku,
          currentStock,
          reorderThreshold,
          message: `Low stock alert: ${item.name} (${currentStock} ${item.unitOfMeasure} remaining)`
        }
      });
    });
  }
}
```

**Testing:**
```typescript
// Test: Complete multiple haircuts → trigger reorder alert
for (let i = 0; i < 30; i++) {
  await haircutService.completeHaircut(testSessions[i].id);
}

// After 30 haircuts × 30ml = 900ml deducted
// If reorderThreshold = 1000ml, alert should fire when stock < 1000ml
```

---

### Pros (E7 Integration)

1. ✅ **Mature Kernel:** 547 regression tests, frozen, production-grade
2. ✅ **Full Features:** Stock levels, reorder alerts, audit trail (E7.3 traceability)
3. ✅ **Minimal Code:** 10% new code (integration only, E7 handles logic)
4. ✅ **Cross-Vertical Reuse:** Validates Logistics → Beauty kernel reuse
5. ✅ **Audit Trail:** Every movement tracked (compliance, reporting)
6. ✅ **Scalable:** E7 handles enterprise inventory (multi-location, transfers, etc.)

### Cons (E7 Integration)

1. ⚠️ **E7 Frozen:** Cannot modify E7 (SEALED kernel, requires ACR for changes)
2. ⚠️ **E7 Complexity:** Learning curve (E7 is warehouse inventory, may be over-engineered)
3. ⚠️ **Dependency Risk:** Haircut depends on Platform Kernel (not autonomous)
4. ⚠️ **Service Semantics:** E7 designed for warehouse, may not fit service-level perfectly

---

## Option B: Extend packages.product_usage (Product-Level Inventory)

**Approach:** Extend existing `packages.product_usage` JSONB, create simple inventory tracking.

**Implementation (Week 3, 2-3 days):**

### Day 1: Service Inventory Schema

**Create Service Inventory Table:**
```sql
-- Migration: 20260915000001_create_service_inventory.sql

CREATE TABLE service_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Product identification
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,  -- 'haircare', 'supplies', 'equipment'
  
  -- Stock tracking
  unit_of_measure TEXT NOT NULL,  -- 'ml', 'piece', 'kg'
  current_stock NUMERIC NOT NULL DEFAULT 0,
  reserved_stock NUMERIC NOT NULL DEFAULT 0,
  available_stock NUMERIC GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
  
  -- Reorder management
  reorder_threshold NUMERIC,
  reorder_quantity NUMERIC,
  last_reorder_date TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE UNIQUE INDEX idx_service_inventory_tenant_sku ON service_inventory(tenant_id, sku);
CREATE INDEX idx_service_inventory_low_stock ON service_inventory(tenant_id, available_stock) 
  WHERE available_stock < reorder_threshold;

-- RLS
ALTER TABLE service_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_inventory_tenant_isolation ON service_inventory
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Create Inventory Movement Log:**
```sql
CREATE TABLE service_inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  inventory_id UUID NOT NULL REFERENCES service_inventory(id),
  
  -- Movement details
  movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'stock_out', 'adjustment', 'service_deduction')),
  quantity NUMERIC NOT NULL,  -- Positive = stock in, Negative = stock out
  reason TEXT,
  
  -- Reference
  reference_type TEXT,  -- 'session', 'purchase_order', 'adjustment'
  reference_id UUID,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_inventory_movements_inventory ON service_inventory_movements(inventory_id, created_at DESC);
CREATE INDEX idx_inventory_movements_reference ON service_inventory_movements(reference_type, reference_id);
```

---

### Day 2: Inventory Service Implementation

**Inventory Service:**
```typescript
// src/products/bella-haircut/services/service-inventory.service.ts

export class ServiceInventoryService {
  constructor(private db: Database) {}
  
  async createInventoryItem(item: InventoryItemInput): Promise<InventoryItem> {
    return this.db.serviceInventory.insert({
      sku: item.sku,
      name: item.name,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      currentStock: item.initialStock || 0,
      reorderThreshold: item.reorderThreshold,
      reorderQuantity: item.reorderQuantity
    });
  }
  
  async deductStock(sku: string, quantity: number, reason: string, reference?: any): Promise<void> {
    const item = await this.db.serviceInventory.findOne({ sku });
    
    if (!item) {
      throw new Error(`Inventory item not found: ${sku}`);
    }
    
    if (item.availableStock < quantity) {
      throw new Error(`Insufficient stock: ${sku} (available: ${item.availableStock}, needed: ${quantity})`);
    }
    
    // Deduct stock
    await this.db.serviceInventory.update(item.id, {
      currentStock: item.currentStock - quantity
    });
    
    // Log movement
    await this.db.serviceInventoryMovements.insert({
      inventoryId: item.id,
      movementType: 'service_deduction',
      quantity: -quantity,
      reason,
      referenceType: reference?.type,
      referenceId: reference?.id
    });
    
    // Check reorder threshold
    if (item.currentStock - quantity < item.reorderThreshold) {
      await this.triggerReorderAlert(item);
    }
  }
  
  async addStock(sku: string, quantity: number, reason: string): Promise<void> {
    const item = await this.db.serviceInventory.findOne({ sku });
    
    await this.db.serviceInventory.update(item.id, {
      currentStock: item.currentStock + quantity,
      lastReorderDate: reason === 'restock' ? new Date() : item.lastReorderDate
    });
    
    await this.db.serviceInventoryMovements.insert({
      inventoryId: item.id,
      movementType: 'stock_in',
      quantity,
      reason
    });
  }
  
  async getAvailableStock(sku: string): Promise<number> {
    const item = await this.db.serviceInventory.findOne({ sku });
    return item?.availableStock || 0;
  }
  
  private async triggerReorderAlert(item: InventoryItem): Promise<void> {
    // Emit event for reorder alert
    await this.eventBus.publish('service_inventory.reorder_needed', {
      sku: item.sku,
      name: item.name,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold,
      reorderQuantity: item.reorderQuantity
    });
  }
}
```

---

### Day 3: Integration with Haircut Services

**Integrate with Service Execution:**
```typescript
export class HaircutExecutionService {
  constructor(
    private serviceInventory: ServiceInventoryService,
    private sessionTracking: ISessionTracking
  ) {}
  
  async completeHaircut(sessionId: string): Promise<void> {
    const session = await this.sessionTracking.getSession(sessionId);
    const service = await this.getService(session.serviceId);
    
    // Deduct inventory
    for (const product of service.product_usage.products) {
      await this.serviceInventory.deductStock(
        product.sku,
        product.quantity_per_service,
        'service_execution',
        { type: 'session', id: sessionId }
      );
    }
    
    await this.sessionTracking.markCompleted(sessionId);
  }
}
```

**Integrate with Booking:**
```typescript
export class HaircutBookingService {
  constructor(
    private serviceInventory: ServiceInventoryService,
    private appointmentEngine: IAppointmentEngine
  ) {}
  
  async createAppointment(request: AppointmentRequest): Promise<Appointment> {
    const service = await this.getService(request.serviceId);
    
    // Check inventory
    for (const product of service.product_usage.products) {
      const available = await this.serviceInventory.getAvailableStock(product.sku);
      
      if (available < product.quantity_per_service) {
        throw new Error(`Insufficient inventory: ${product.sku}`);
      }
    }
    
    return this.appointmentEngine.createAppointment(request);
  }
}
```

---

### Pros (Product-Level Inventory)

1. ✅ **Simple:** Straightforward implementation, no E7 complexity
2. ✅ **Haircut-Specific:** Optimized for beauty service inventory (not over-engineered)
3. ✅ **Full Control:** Haircut team owns code, can modify freely
4. ✅ **Fast Implementation:** 50% new code, but simpler than E7 learning curve
5. ✅ **No Platform Dependency:** Haircut autonomous (not dependent on E7)

### Cons (Product-Level Inventory)

1. ⚠️ **Duplicate Logic:** If Nail Shop needs inventory, must build again (technical debt)
2. ⚠️ **Missing Features:** No advanced features (multi-location, transfers, etc.)
3. ⚠️ **No Audit Trail:** Basic movement log, not enterprise-grade traceability
4. ⚠️ **Maintenance Burden:** Haircut team maintains inventory code (not platform team)

---

## Decision Criteria

### E7 Applicable IF ALL conditions met:

**1. Contract Applicability:**
- ✅ E7 supports fractional units (30ml, 15ml deductions)
- ✅ E7 Movement supports service-level semantics (reference to session_id)
- ✅ E7 Operational Kernel flexible for beauty service alerts
- ✅ Integration straightforward (< 3 days effort)

**2. Ownership Validation:**
- ✅ E7 owns service inventory data (Beauty Services is "consumer", not "owner")
- ✅ Data authority clear (E7 manages stock, Beauty Services reads/writes via contract)
- ✅ No ownership conflicts (SKU registry, reorder management clearly assigned)

**3. Semantic Fit:**
- ✅ E7 vocabulary maps to Beauty Services domain (warehouse → salon translation clean)
- ✅ No excessive adapters required (< 20% translation code)
- ✅ Domain model alignment (logistics inventory → service inventory natural fit)

**4. Invariants Compatibility:**
- ✅ E7 stock invariants match Beauty Services (no negative stock OK, or graceful handling)
- ✅ E7 movement atomicity works for bulk service deductions
- ✅ E7 tenant isolation supports multi-location salons (or workaround exists)
- ✅ E7 reorder thresholds flexible (predictive reorder can be added in product layer)

**5. E7 FROZEN Constraint:**
- ✅ Beauty Services can use E7 via PUBLIC CONTRACTS only (no E7 code modification)
- ✅ No frozen invariant violations (negative stock, location hierarchy not required)
- ✅ Extension cost = 0 person-days (E7 perfect fit OR minor contract extension only)

**6. Dependency Direction:**
- ✅ Dependency flows Product → Contract → Kernel (valid direction)
- ✅ E7 does NOT depend on Beauty Services domain knowledge (platform agnostic)

**7. Data Ownership:**
- ✅ Clear write authority (Beauty Services writes via E7 contract, E7 enforces invariants)
- ✅ No data conflicts (InventoryItem, Movement ownership unambiguous)

**IF ALL 7 conditions met → Decision: INTEGRATE E7** (10% new code, mature kernel)

---

### E7 NOT Applicable IF ANY condition fails:

**1. Contract Gaps:**
- ❌ E7 only supports whole units (1 bottle, not 30ml)
- ❌ E7 Movement is warehouse-only (no service-level semantics)
- ❌ E7 Operational Kernel too rigid (cannot handle service alerts)
- ❌ Integration complex (> 5 days effort)

**2. Ownership Conflicts:**
- ❌ E7 does NOT own service inventory (Beauty Services should own data)
- ❌ Ambiguous authority (unclear who manages SKU registry, reorder)
- ❌ Governance bottleneck (E7 team must approve every Beauty Services SKU)

**3. Semantic Mismatch:**
- ❌ E7 vocabulary incompatible (warehouse concepts don't map to salon)
- ❌ Excessive adapters required (> 50% translation code)
- ❌ Domain model clash (logistics inventory ≠ service consumption)

**4. Invariants Violation:**
- ❌ E7 prohibits negative stock (Beauty Services needs backorder)
- ❌ E7 movement atomicity blocks bulk deductions (performance issue)
- ❌ E7 tenant isolation doesn't support multi-location (architectural gap)
- ❌ E7 reorder thresholds too rigid (predictive reorder impossible)

**5. E7 FROZEN Violation:**
- ❌ Beauty Services needs E7 code modification (frozen constraint blocks)
- ❌ Frozen invariant change required (ACR needed, 10-15 person-days cost)
- ❌ Extension cost > 5 person-days (not acceptable for investigation outcome)

**6. Dependency Violation:**
- ❌ E7 needs Beauty Services domain knowledge (platform depends on product)
- ❌ Circular dependency (E7 ← Beauty Services data model)

**7. Data Ownership Conflict:**
- ❌ Unclear write authority (both E7 and Beauty Services write InventoryItem)
- ❌ Data conflicts (movement semantics collision)

**IF ANY condition fails → Decision: EXTEND packages.product_usage** (50% new code, product-level)

---

### E7 Investigation Quality Gate

**Before declaring "E7 Applicable", MUST pass:**

1. **Ownership Test:** Can answer "Who owns service inventory?" unambiguously → E7 OR Beauty Services
2. **Semantic Fit Test:** Can translate E7 → Beauty Services vocabulary with < 20% adapter code
3. **Invariants Test:** E7 invariants + Beauty Services requirements = NO conflicts
4. **FROZEN Test:** E7 integration requires 0 person-days E7 modification
5. **Dependency Test:** Product → Contract → Kernel (no reverse dependency)
6. **Prototype Test:** Day 3 prototype demonstrates E7 integration works end-to-end

**IF quality gate fails → Reject E7 integration (evidence insufficient)**

---

## Related Decisions

- **ADR-001:** Core vs Kernel Boundary Definition (Platform-of-Platforms, cross-vertical reuse)
- **ADR-002:** Contract Extraction Strategy (Haircut product features allowed)
- **ADR-003:** Beauty Services Platform Formalization (inventory may join platform later)
- **ADR-004:** Walk-in Queue Scope (product feature with investigation pattern)
- **H0:** Bella Haircut Capability Reuse Assessment (Service Inventory = NOT must-build)
- **H1:** Architecture Gate (Decision 4: Service Inventory source)

---

## Approval

**Status:** 🟡 **PROPOSED** - Awaiting Architecture Council approval

**Approval Criteria:**
- [ ] Architecture Council approves investigate-first strategy
- [ ] Logistics team approves E7 investigation (3-day capacity)
- [ ] Product team accepts conditional decision (E7 vs product-level)
- [ ] Timeline approved (Week 1 investigation, Week 3 implementation)

**If Approved:**
- Week 1: E7 investigation (2-3 days, parallel with contract extraction)
- Week 1 End: Decision (E7 applicable? YES/NO)
- Week 3: Implementation (E7 integration OR product-level extension)

**If Rejected:**
- Fallback: Default to product-level extension (no E7 investigation)
- Timeline: Week 3 implementation (2-3 days)

---

## Consequences

### Positive

1. **Evidence-Based Decision:** 3-day investigation prevents wrong choice
2. **Cross-Vertical Validation:** Tests if Logistics Kernel serves Beauty Services
3. **Low Investigation Cost:** 3 days for high-value learning (E7 reusability)
4. **Clear Fallback:** If E7 doesn't fit, product-level extension is known solution
5. **Future Benefit:** E7 investigation informs Nail Shop, Massage inventory decisions

### Negative

1. **Investigation Delay:** 3 days before decision (could start implementation sooner)
2. **Uncertain Outcome:** E7 may not fit (investigation may conclude "not applicable")
3. **Resource Cost:** Logistics team capacity for 3-day consultation

### Neutral

1. **Conditional Implementation:** Week 3 implementation depends on Week 1 decision
2. **Two Implementation Plans:** Prepare both E7 integration + product-level extension

---

**ADR-005 Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** 🟡 **PROPOSED**  
**Next Review:** After E7 investigation (Week 1, Day 3) - final decision



---

## Investigation Results (2026-09-15)

### 7-Gate Investigation Summary

**Investigation Document:** `H2_CONTRACT_02_OWNERSHIP_INVESTIGATION.md`

**Gate Results:**

| Gate | Question | Result |
|------|----------|--------|
| 1 | Ownership boundary | ❌ Service ≠ Logistics |
| 2 | Semantic fit | ❌ Service ≠ InventoryItem |
| 3 | Invariant compatibility | ❌ E7 invariants don't apply to services |
| 4 | E7 FROZEN status | ❌ Cannot modify without ACR |
| 5 | Dependency direction | ⚠️ E7 contract possible but awkward |
| 6 | Data ownership | ❌ E7 should not own service data |
| 7 | Extension cost | ✅ Dedicated contract cheaper (5-7 days vs 10-15 days) |

**Overall:** **7/7 gates indicate DO NOT reuse E7 Logistics**

---

### Key Findings

**1. Semantic Mismatch:**
- E7 InventoryItem = Physical goods with stock levels (shampoo, scissors, towels)
- Service = Intangible offering with duration/price (haircut, facial, massage)
- Overlap: Only name, description, category (basic metadata)
- Mismatch: Stock levels, movements, expiration, traceability (E7 core invariants)

**2. Invariant Incompatibility:**
- E7 invariants: Quantity conservation, movement tracking, expiration, batch/lot traceability
- Service invariants: Duration validation, branch availability, staff skills, package consistency
- Services have NO stock levels, NO movements, NO expiration

**3. E7 Frozen Status:**
- E7.1, E7.2, E7.3 = SEALED (547 tests)
- Modification requires ACR + unfreeze + 547 test updates
- High risk, high cost

**4. Data Ownership Conflict:**
- E7 owns `inventory_item` table (physical goods domain)
- Services should be owned by product vertical (Beauty/Healthcare), not Logistics
- Storing services in E7 pollutes Logistics kernel with non-logistics data

**5. Extension Cost:**
- **Option A (E7 extension):** 10-15 days + ACR + high risk
- **Option B (Dedicated contract):** 5-7 days + low risk + semantic clarity
- **Verdict:** Dedicated contract is cheaper, faster, cleaner

---

### Final Decision

**✅ BUILD DEDICATED ISERVICEINVENTORYENGINE CONTRACT**

**Rationale:**
- Services are semantically different from physical inventory
- E7 core invariants do not apply to services
- E7 is FROZEN (cannot modify without ACR)
- Service catalog should be owned by product vertical, not Logistics
- Dedicated contract is lower cost, lower risk, cleaner architecture

**Implementation:**
- Create `IServiceInventoryEngine` contract in `src/platform/contracts/v1/`
- Define Service entity (name, duration, price, category, availability)
- Implement service-specific methods (getService, listServices, createService, etc.)
- Wire to Haircut/Spa/Nail products

**Ownership:** Platform Contracts (cross-vertical capability)

---

## Consequences

### Positive

1. **✅ Semantic clarity:** Service catalog is clean, no E7 inventory pollution
2. **✅ E7 integrity preserved:** Logistics kernel remains logistics-focused
3. **✅ Lower cost:** 5-7 days vs 10-15 days (E7 extension)
4. **✅ Lower risk:** No ACR, no frozen kernel modification, no 547 test regression
5. **✅ Data ownership correct:** Product verticals own service definitions
6. **✅ Extensibility:** Any vertical can use service catalog without Logistics dependency

### Negative

1. **⚠️ New capability implementation:** Need to build service catalog from scratch (not reuse E7)
2. **⚠️ Duplicate concepts:** Service catalog has some overlapping concepts with E7 (name, category, price)

**Mitigation:**
- Overlapping concepts are minimal (basic metadata only)
- Semantic clarity outweighs code reuse
- Service catalog is simpler than E7 (no stock, movements, traceability)

---

## Related Decisions

- **ADR-002:** Contract Extraction Strategy — Establishes incremental contract extraction
- **ADR-003:** Beauty Services Platform Formalization — Defines vertical structure
- **ADR-004:** Walk-in Queue Scope — Confirms product features vs kernel capabilities
- **ADR-006:** Temporal Platform Layer — Establishes platform vs vertical classification

---

## Implementation Status

**Investigation:** ✅ COMPLETE (2026-09-15)  
**Decision:** ✅ APPROVED (Build dedicated IServiceInventoryEngine)  
**Next:** Define contract interface → Extract Contract #2 → Wire to products

---

**ADR Version:** 2.0.0 (Investigation Results Added)  
**Status:** RESOLVED  
**Date:** 2026-09-15
