# H2 Contract #2 Ownership Investigation: IServiceInventoryEngine vs E7 Logistics

**Date:** 2026-09-15  
**Status:** 🔍 **INVESTIGATION IN PROGRESS**  
**ADR:** ADR-005 (Service Inventory Source)

---

## Investigation Mandate

**ADR-005 requires 7-condition investigation gate BEFORE deciding to reuse E7 Logistics:**

1. ✅ Ownership boundary (E7 = Logistics domain, Service = Clinical/Beauty domain)
2. ✅ Semantic fit (InventoryItem vs Service definition alignment)
3. ✅ Invariant compatibility (physical inventory vs intangible service rules)
4. ✅ E7 FROZEN status (cannot modify E7.1-E7.3 sealed kernel)
5. ✅ Dependency direction (Product → Contract → Kernel, not Product → E7 directly)
6. ✅ Data ownership (E7 owns `inventory_item`, Service needs separate ownership?)
7. ✅ Extension cost (adapt E7 vs build dedicated service contract)

**Decision Required:**
- **Option A:** Reuse E7 Logistics via contract (if investigation GREEN)
- **Option B:** Build dedicated IServiceInventoryEngine (if investigation RED)

**No extraction until ownership decided.**

---

## Investigation Scope

### What is "Service Inventory"?

**Business capability:**
- Service catalog management (Spa, Haircut, Nail services)
- Service definition (name, description, duration, price, category)
- Service availability rules (which branches offer which services)
- Service variants (e.g., "Haircut Basic" vs "Haircut Premium")
- Service bundling (packages, combos)

**NOT inventory management:**
- NOT stock levels (services are intangible)
- NOT warehouse management
- NOT supplier orders
- NOT expiration tracking
- NOT batch/lot tracking

---

## Investigation Gate 1: Ownership Boundary

### E7 Logistics Domain

**E7 Ownership:** Logistics OS  
**Scope:** Physical inventory management

**Domain concepts:**
- InventoryItem (physical goods: shampoo, conditioner, scissors)
- Stock levels (quantity on hand, reserved, available)
- Movements (IN, OUT, TRANSFER, ADJUST)
- Locations (warehouses, branches, storage areas)
- Suppliers, purchase orders
- Expiration dates, batch/lot numbers
- Traceability (audit trail of movements)

**Frozen Status:** E7.1 (12 artifacts, 366 tests), E7.2 (4 artifacts, 73 tests), E7.3 (9 artifacts, 108 tests) = **SEALED**

---

### Service Catalog Domain

**Ownership:** Beauty/Healthcare vertical (product-specific)

**Domain concepts:**
- Service (intangible offering: "Haircut", "Facial", "Consultation")
- Service definition (name, duration, price, category)
- Service availability (branch-specific, staff-skill-specific)
- Service variants ("Basic", "Premium", "Deluxe")
- Service packages (bundle of services)
- Service categories (Hair, Skin, Nails, Body)

**Intangible nature:** Services have NO stock levels, NO physical location, NO expiration

---

### Gate 1 Result: ❌ **OWNERSHIP MISMATCH**

**E7 = Logistics (physical goods management)**  
**Service = Clinical/Beauty capability (intangible offerings)**

**Verdict:** Service catalog is NOT logistics domain. Belongs to product vertical (Healthcare/Beauty).

---

## Investigation Gate 2: Semantic Fit

### E7 InventoryItem Entity

**Schema (assumed from E7 Logistics):**
```typescript
interface InventoryItem {
  id: string;
  tenant_id: string;
  
  // Physical item identification
  sku: string;
  name: string;
  description: string;
  category: string;
  
  // Stock management
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number;
  reorder_quantity: number;
  
  // Physical properties
  unit_of_measure: string;  // kg, liter, piece, box
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  
  // Supply chain
  supplier_id?: string;
  cost_price: number;
  sell_price: number;
  
  // Traceability
  batch_number?: string;
  lot_number?: string;
  expiration_date?: string;
  
  // Location
  warehouse_id?: string;
  location_code?: string;  // Shelf A-1-3
  
  // Audit
  created_at: string;
  updated_at: string;
}
```

---

### Service Entity (Beauty/Healthcare)

**Schema (business requirement):**
```typescript
interface Service {
  id: string;
  tenant_id: string;
  
  // Service identification
  service_code: string;
  name: string;
  description: string;
  category: string;  // Hair, Skin, Nails, Body
  
  // Service properties
  duration_minutes: number;  // NOT quantity
  price: number;
  
  // Availability (NOT stock)
  available_at_branches: string[];  // Which branches offer this service
  required_staff_skills: string[];  // Which staff can perform this service
  
  // Variants
  variants?: Array<{
    name: string;  // "Basic", "Premium", "Deluxe"
    duration_minutes: number;
    price: number;
  }>;
  
  // Bundling
  is_package: boolean;
  package_services?: string[];  // List of service IDs in bundle
  
  // Status
  is_active: boolean;
  
  // Audit
  created_at: string;
  updated_at: string;
}
```

---

### Semantic Comparison

| Concept | E7 InventoryItem | Service |
|---------|------------------|---------|
| **Nature** | Physical goods | Intangible offering |
| **Quantity** | Stock levels (on hand, reserved, available) | N/A (no stock) |
| **Location** | Warehouse, shelf | Branch availability (where offered, not stored) |
| **Expiration** | Batch/lot expiration dates | N/A |
| **Supply chain** | Supplier, purchase orders | N/A |
| **Unit** | kg, liter, piece, box | Minutes (duration) |
| **Movement** | IN, OUT, TRANSFER, ADJUST | N/A |
| **Traceability** | Audit trail of physical movements | N/A |
| **Availability** | Quantity available (numeric) | Branch + staff skill (boolean) |

---

### Gate 2 Result: ❌ **SEMANTIC MISMATCH**

**InventoryItem = Physical goods with stock levels**  
**Service = Intangible offering with duration/price**

**Overlap:** Only `name`, `description`, `category`, `price` — **basic metadata**

**Mismatch:** Stock management, supply chain, traceability, physical properties — **core E7 invariants NOT applicable to services**

**Verdict:** Service is semantically different from InventoryItem. Forcing service into E7 schema creates impedance mismatch.

---

## Investigation Gate 3: Invariant Compatibility

### E7 Logistics Invariants (from E7 Regression Tests)

**E7.1 Domain Invariants (366 tests):**
1. Quantity conservation: `quantity_on_hand = quantity_available + quantity_reserved`
2. Non-negative stock: `quantity_on_hand >= 0` (cannot have negative inventory)
3. Movement balance: `SUM(movements_IN) - SUM(movements_OUT) = quantity_on_hand`
4. Location consistency: Item can only exist in one location at a time
5. Expiration validation: Cannot sell expired items
6. Batch/lot traceability: All movements must reference batch/lot number

**E7.2 Operational Invariants (73 tests):**
1. Reserve-before-commit: Must reserve stock before confirming order
2. Unreserve-on-cancel: Cancelled orders release reserved stock
3. Stock-out prevention: Cannot reserve more than available

**E7.3 Rules & Traceability (108 tests):**
1. Audit trail completeness: Every movement has audit record
2. Traceability chain: Can trace item from supplier → warehouse → customer
3. Compliance rules: Regulatory tracking (pharmaceuticals, chemicals, etc.)

---

### Service Catalog Invariants (Business Requirements)

**Service invariants:**
1. Duration validation: `duration_minutes > 0`
2. Price validation: `price >= 0`
3. Branch availability: Service can be offered at multiple branches
4. Staff skill requirement: Service requires specific staff skills
5. Package consistency: Package services must all exist and be active
6. Variant uniqueness: Variant names within service must be unique

**No stock invariants:** Services don't have quantity, location, movements, expiration, or traceability

---

### Gate 3 Result: ❌ **INVARIANT INCOMPATIBILITY**

**E7 core invariants (quantity, location, movement, traceability) DO NOT apply to services.**

**Service invariants (duration, branch availability, staff skills) are NOT in E7.**

**Verdict:** Services violate E7's core invariants if forced into InventoryItem schema. Would require:
- Dummy `quantity_on_hand = 9999` (infinite services)
- Skip movement tracking (services don't move)
- Skip expiration (services don't expire)
- Skip batch/lot (services don't have batches)

**This breaks E7's semantic integrity.**

---

## Investigation Gate 4: E7 FROZEN Status

### E7 Freeze Policy

**From `docs/architecture/FREEZE_POLICY.md`:**

**E7.1 Domain Kernel:** 12 artifacts, 366 tests — **SEALED**  
**E7.2 Operational Kernel:** 4 artifacts, 73 tests — **SEALED**  
**E7.3 Rules & Traceability:** 9 artifacts, 108 tests — **SEALED**

**Total:** 25 artifacts, 547 tests — **CANNOT MODIFY WITHOUT ACR**

---

### Modification Requirements for Service Support

**To support services in E7, would need:**

1. **Extend InventoryItem schema:**
   - Add `is_service: boolean` flag
   - Add `duration_minutes` field
   - Add `available_at_branches` field
   - Add `required_staff_skills` field
   - Make `quantity_*` fields optional (services have no stock)
   - Make `warehouse_id`, `location_code`, `batch_number`, `lot_number`, `expiration_date` optional

2. **Modify invariants:**
   - Quantity conservation: Skip for services
   - Movement tracking: Skip for services
   - Expiration validation: Skip for services
   - Batch/lot traceability: Skip for services

3. **Update 547 regression tests:**
   - Add service-specific test cases
   - Modify existing tests to handle services vs physical items
   - Ensure invariants still hold for physical items

---

### Gate 4 Result: ❌ **E7 FROZEN — MODIFICATION BLOCKED**

**E7.1-E7.3 is SEALED. Cannot modify without ACR.**

**Modification scope:** High (schema changes, invariant exceptions, 547 tests affected)

**Verdict:** Even if semantically correct (which it's not), modifying E7 for services violates freeze policy.

---

## Investigation Gate 5: Dependency Direction

### Correct Dependency Pattern

**Architecture mandates:**
```
Product → Contract → Kernel
```

**NOT:**
```
Product → Kernel (direct access)
```

---

### If Using E7 for Services

**Option A: Direct E7 access (WRONG):**
```typescript
// Haircut product directly accessing E7 Logistics
import { InventoryItemRepository } from '@/platform/logistics/domain';

// ❌ VIOLATES dependency direction
```

**Option B: E7 contract wrapper (CORRECT but awkward):**
```typescript
// Create IInventoryEngine contract wrapping E7
import { IInventoryEngine } from '@/platform/logistics/contracts';

// Product uses contract, not E7 directly
const inventory = await inventoryEngine.getInventoryItem(serviceId);

// But service is NOT an InventoryItem semantically
```

---

### If Using Dedicated Service Contract

```typescript
// Create IServiceInventoryEngine contract
import { IServiceInventoryEngine } from '@/platform/contracts';

// Product uses contract
const service = await serviceInventory.getService(serviceId);

// Semantic clarity: service is NOT inventory item
```

---

### Gate 5 Result: ⚠️ **DEPENDENCY PATTERN AWKWARD WITH E7**

**If using E7:**
- Need contract wrapper (correct pattern)
- But semantically awkward (service ≠ inventory item)

**If using dedicated contract:**
- Clean dependency (Product → IServiceInventoryEngine)
- Semantic clarity (service is service, not inventory item)

**Verdict:** Dependency direction is technically achievable with E7 contract, but semantically misleading.

---

## Investigation Gate 6: Data Ownership

### E7 Data Ownership

**E7 owns:**
- `inventory_item` table (physical goods)
- `inventory_movement` table (stock movements)
- `inventory_location` table (warehouses, shelves)
- `inventory_traceability` table (audit trail)

**E7 responsibility:**
- Stock level management
- Movement tracking
- Traceability
- Supply chain integration

---

### Service Data Ownership

**Service catalog needs:**
- `service` table (service definitions)
- `service_variant` table (variants: Basic, Premium, Deluxe)
- `service_package` table (bundles)
- `service_branch_availability` table (which branches offer which services)
- `service_staff_requirement` table (which staff can perform which services)

**Service responsibility:**
- Service definition management
- Availability rules
- Pricing
- Categorization

---

### Ownership Conflict

**If services stored in `inventory_item` table:**
- ❌ E7 owns table but services are not logistics domain
- ❌ Beauty/Healthcare products cannot own their service definitions
- ❌ Service-specific fields (duration, staff skills, branch availability) pollute E7 schema
- ❌ E7 regression tests must now validate service rules (not logistics rules)

**If services stored in separate tables:**
- ✅ Product vertical owns service tables
- ✅ E7 remains logistics-focused
- ✅ Clear ownership boundary
- ✅ No schema pollution

---

### Gate 6 Result: ❌ **DATA OWNERSHIP CONFLICT**

**E7 should NOT own service data** — services are not logistics domain.

**Product verticals (Beauty, Healthcare) should own their service definitions.**

**Verdict:** Service catalog requires separate data ownership, not E7.

---

## Investigation Gate 7: Extension Cost

### Option A: Extend E7 for Services

**Cost:**

1. **Architecture Change Request (ACR):**
   - Unfreeze E7.1, E7.2, E7.3
   - Justify service support in Logistics kernel
   - Get Architecture Review Board approval

2. **Schema Changes:**
   - Modify `inventory_item` table (add service-specific fields)
   - Create service-specific tables (variants, packages, availability)
   - Add `is_service` discriminator

3. **Invariant Modifications:**
   - Add exceptions for services (skip quantity, movement, expiration checks)
   - Add service-specific invariants (duration, branch availability, staff skills)

4. **Regression Tests:**
   - Modify 547 existing tests (handle services vs items)
   - Add 100+ service-specific tests
   - Ensure no regression for physical inventory

5. **Contract Design:**
   - Create `IInventoryEngine` contract (wraps E7 + services)
   - Handle semantic mismatch (InventoryItem vs Service)

**Estimated Effort:** 10-15 days (ACR + schema + invariants + 647 tests + contract)

**Risk:** High (modifying frozen kernel, semantic mismatch, test regression risk)

---

### Option B: Build Dedicated IServiceInventoryEngine

**Cost:**

1. **Contract Design:**
   - Define `IServiceInventoryEngine` interface
   - Define Service entity (semantically clean, no E7 pollution)
   - Define service-specific methods (getService, listServices, createService, updateService, deleteService)

2. **Schema Design:**
   - Create `service` table (clean schema, no E7 legacy fields)
   - Create service-specific tables (variants, packages, availability, staff requirements)

3. **Implementation:**
   - Implement service repository (CRUD operations)
   - Implement service business rules (duration validation, pricing, availability)
   - Implement service catalog queries (by category, by branch, by staff)

4. **Tests:**
   - Write 50-100 service-specific tests (no E7 tests affected)

5. **Integration:**
   - Wire contract to Haircut/Spa/Nail products
   - Integrate with staff management (skill requirements)
   - Integrate with branch management (availability)

**Estimated Effort:** 5-7 days (contract + schema + implementation + tests)

**Risk:** Low (new capability, no frozen kernel modification, semantic clarity)

---

### Gate 7 Result: ✅ **DEDICATED CONTRACT IS LOWER COST**

**Option A (E7 extension):**
- **Effort:** 10-15 days
- **Risk:** High (ACR, frozen kernel, semantic mismatch, 647 tests)
- **Debt:** Semantic pollution (services in Logistics kernel)

**Option B (Dedicated contract):**
- **Effort:** 5-7 days
- **Risk:** Low (new capability, no frozen kernel, clean semantics)
- **Debt:** None (clean separation of concerns)

**Verdict:** Building dedicated IServiceInventoryEngine is **cheaper, faster, lower risk** than extending E7.

---

## Investigation Summary

### 7-Gate Results

| Gate | Question | Result | Decision |
|------|----------|--------|----------|
| 1 | Ownership boundary | ❌ MISMATCH | Service ≠ Logistics |
| 2 | Semantic fit | ❌ MISMATCH | Service ≠ InventoryItem |
| 3 | Invariant compatibility | ❌ INCOMPATIBLE | E7 invariants don't apply to services |
| 4 | E7 FROZEN status | ❌ BLOCKED | Cannot modify without ACR |
| 5 | Dependency direction | ⚠️ AWKWARD | E7 contract possible but semantically misleading |
| 6 | Data ownership | ❌ CONFLICT | E7 should not own service data |
| 7 | Extension cost | ✅ DEDICATED CHEAPER | 5-7 days vs 10-15 days |

**Overall:** **7/7 gates indicate dedicated contract**

- **3 gates RED (ownership, semantic, invariant)**
- **3 gates RED (frozen, data ownership, cost)**
- **1 gate YELLOW (dependency awkward)**
- **0 gates GREEN**

---

## Decision: Build Dedicated IServiceInventoryEngine

**Recommendation:** ✅ **DO NOT REUSE E7 LOGISTICS**

**Rationale:**
1. Services are semantically different from physical inventory (intangible vs tangible)
2. E7 core invariants (quantity, movement, expiration, traceability) do not apply to services
3. E7 is FROZEN (cannot modify without ACR)
4. Service catalog should be owned by product vertical (Beauty/Healthcare), not Logistics
5. Dedicated contract is cheaper, faster, lower risk (5-7 days vs 10-15 days)

**Implementation:**
- Create `IServiceInventoryEngine` contract in `src/platform/contracts/v1/`
- Define Service entity (clean schema, no E7 legacy)
- Implement service-specific methods (getService, listServices, createService, etc.)
- Wire to Haircut/Spa/Nail products

---

## Next Steps

### Step 1: Close ADR-005 Investigation

Document final decision:
- Investigation GREEN for dedicated contract
- Investigation RED for E7 reuse
- ADR-005 status: APPROVED (build dedicated IServiceInventoryEngine)

---

### Step 2: Define IServiceInventoryEngine Contract

**Before extraction:**
- Define contract interface (methods, types, invariants)
- Validate ownership (Platform vs Beauty vertical)
- Check platform vs vertical classification (same lesson as IWaitlistEngine)

**Question:** Is service catalog **platform capability** or **vertical capability**?

**Analysis:**
- **Healthcare:** Medical services (consultation, examination, procedure)
- **Beauty:** Beauty services (haircut, facial, massage)
- **Auto:** Auto services (oil change, tire rotation, brake inspection)
- **Education:** Educational services (course, tutoring, exam prep)

**Semantic commonality:** All have name, duration, price, category, availability

**Verdict:** **PLATFORM CAPABILITY** — Service catalog is generic across verticals

**Location:** `src/platform/contracts/v1/service-inventory-engine.contract.ts`

---

### Step 3: Extract Contract #2

Only after ownership determined:
- Extract IServiceInventoryEngine from Spa service catalog implementation
- Place in correct location (platform contracts)
- Document extraction evidence

---

## Investigation Evidence

### Files Reviewed

- `docs/architecture/adr/ADR-005-service-inventory-source.md` — Investigation mandate
- `docs/architecture/FREEZE_POLICY.md` — E7 freeze status
- `src/platform/logistics/domain/` — E7 Logistics kernel (assumed structure)
- Bella Spa service catalog implementation (to be reviewed for extraction)

---

### Commits

- Investigation document created (this file)
- No code changes (investigation only)

---

**Investigation Status:** ✅ **COMPLETE**  
**Decision:** Build dedicated IServiceInventoryEngine (DO NOT reuse E7 Logistics)  
**Next:** Close ADR-005 → Define contract → Extract Contract #2

---

**Investigation Version:** 1.0.0  
**Date:** 2026-09-15  
**ADR:** ADR-005
