# Logistics OS Boundary Definition

**Date:** 2026-08-22  
**Status:** Design (No Code)  
**Purpose:** Define three-layer architecture boundary: Platform / Logistics OS / Product

---

## Design Principle

> **"Define OS by domain reasoning, not by code extraction."**

**NOT:** Extract capabilities from Warehouse → call it OS  
**YES:** Define Logistics domain primitives → build OS → integrate Products

---

## Three-Layer Architecture

### Layer 1: Bella Platform (Cross-Industry)

**Scope:** Capabilities used by **all verticals** (Healthcare, Logistics, Education, etc.)

**Responsibilities:**
- Multi-tenancy
- Authentication & Authorization (RBAC)
- Audit trail foundation
- Subscription & billing
- Security primitives
- User management
- Organization structure
- Common data types (Address, Contact, Money)

**NOT Logistics-Specific.**

**Location:** `src/platform/` (already exists)

---

### Layer 2: Logistics OS (Logistics Domain)

**Scope:** Capabilities used by **multiple Logistics Products**

**Criteria for Inclusion:**
1. ✅ **Domain-Essential:** Core to Logistics domain, not specific to one Product
2. ✅ **Multi-Product:** Used by 2+ Products (Warehouse, Fulfillment, Transport, etc.)
3. ✅ **Primitive:** Foundational capability, not business logic
4. ✅ **Reusable Contract:** Clean interface that Products can consume

**NOT:**
- ❌ Warehouse-specific workflows
- ❌ Single-product features
- ❌ Platform-level capabilities (already in Layer 1)

**Location:** `src/platform/logistics/` (shared kernel, not product-specific)

---

### Layer 3: Product (Product-Specific)

**Scope:** Features specific to individual Logistics Product

**Examples:**
- **Warehouse Product:** Bin management, putaway, receiving
- **Fulfillment Product:** Pick/pack/ship, order processing
- **Transportation Product:** Route planning, carrier management
- **Returns Product:** RMA, restocking

**Location:** `src/products/warehouse/`, `src/products/fulfillment/`, etc.

---

## Logistics OS Capability Candidates

### Evaluation Method

For each candidate, answer:
1. **Is this Logistics domain-essential?** (not Platform, not Product-specific)
2. **Do 2+ Products need this?** (evidence or strong domain reasoning)
3. **Can this be a primitive?** (clean interface, reusable)
4. **Does this belong to OS layer?** (not too high, not too low)

---

## Candidate 1: Inventory Domain Model

### Definition
**Core concepts:** Item, Location, Quantity, Movement, Transaction

**Logistics OS Primitive:**
- Item/SKU entity (master data)
- Inventory on-hand (quantity at location)
- Inventory movement (transfer between locations)
- Inventory transaction (audit trail)
- Allocation (reserve for purpose)

### Domain Reasoning

**Why Logistics OS:**
- Inventory is **fundamental to Logistics domain**
- All Logistics Products deal with items moving through locations:
  - **Warehouse:** Receive, store, putaway inventory
  - **Fulfillment:** Allocate, pick, pack inventory
  - **Transportation:** Move inventory between facilities
  - **Returns:** Receive back, restock inventory
  - **3PL:** Manage client inventory

**Why NOT Platform:**
- Inventory is Logistics-specific (Healthcare has patients, not inventory)

**Why NOT Product:**
- Not specific to Warehouse or Fulfillment
- Core domain model shared across Products

### OS Boundary

**Logistics OS Provides:**
```typescript
// Inventory Movement Primitive
interface InventoryMovement {
  moveInventory(params: {
    item_id: string;
    from_location_id: string;
    to_location_id: string;
    quantity: number;
    reason: MovementReason;
    actor_id: string;
    metadata?: Record<string, any>;
  }): Promise<MovementResult>;

  allocateInventory(params: {
    item_id: string;
    location_id: string;
    quantity: number;
    purpose: AllocationPurpose;
    reference_id: string;
  }): Promise<AllocationResult>;

  releaseAllocation(allocation_id: string): Promise<void>;
}

// Inventory Query
interface InventoryQuery {
  getOnHand(item_id: string, location_id: string): Promise<number>;
  getAvailable(item_id: string, location_id: string): Promise<number>;
  getMovementHistory(item_id: string, filter?: Filter): Promise<Movement[]>;
}
```

**Product Uses:**
- Warehouse: Calls `moveInventory()` for receiving, putaway
- Fulfillment: Calls `allocateInventory()` for orders, `moveInventory()` for picking
- Returns: Calls `moveInventory()` for restocking

### Decision: ✅ **INCLUDE in Logistics OS**

**Rationale:** Core domain primitive, multi-product evidence, clean interface

---

## Candidate 2: Item/SKU Master Data

### Definition
**Core concept:** Item/Product/SKU entity shared across Logistics Products

**Logistics OS Entity:**
- Item ID (unique identifier)
- Item code (SKU, UPC, etc.)
- Description
- Category/classification
- Physical attributes (weight, dimensions)
- Tenant ownership

### Domain Reasoning

**Why Logistics OS:**
- Item/SKU is **fundamental Logistics entity**
- All Products reference same items:
  - **Warehouse:** Receive SKU, store SKU
  - **Fulfillment:** Pick SKU, ship SKU
  - **Transportation:** Track SKU in transit
  - **Returns:** Return SKU

**Why NOT Platform:**
- Item/SKU is Logistics-specific (other verticals have different entities)

**Why NOT Product:**
- Not specific to Warehouse or Fulfillment
- Shared master data across Products

### OS Boundary

**Logistics OS Provides:**
```typescript
// Item Master Data
interface Item {
  id: string;
  tenant_id: string;
  code: string; // SKU, UPC, etc.
  description: string;
  category?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  is_active: boolean;
  metadata?: Record<string, any>;
}

interface ItemService {
  getItem(item_id: string): Promise<Item>;
  findByCode(code: string): Promise<Item | null>;
  validateItem(item_id: string): Promise<ValidationResult>;
}
```

**Product Uses:**
- All Products reference Item entity
- Warehouse might extend with warehouse-specific attributes
- Fulfillment might extend with fulfillment-specific attributes

### Decision: ✅ **INCLUDE in Logistics OS**

**Rationale:** Shared master data, multi-product evidence

---

## Candidate 3: State Machine Primitive

### Definition
**Core concept:** Generic state transition framework for Logistics entities

**Logistics OS Primitive:**
- State definition
- Transition rules
- Validation
- Audit trail

### Domain Reasoning

**Why Logistics OS:**
- State transitions are **common pattern** in Logistics:
  - **Warehouse:** Receipt status (draft → submitted → completed)
  - **Fulfillment:** Order status (pending → picking → packed → shipped)
  - **Transportation:** Shipment status (scheduled → in_transit → delivered)
  - **Returns:** RMA status (requested → approved → received)

**Why NOT Platform:**
- State machine is programming primitive, could be Platform
- **BUT:** Logistics has domain-specific state semantics (location-aware, actor-aware, reversibility)

**Why NOT Product:**
- Pattern is cross-product
- Each Product defines its own states, but shares transition logic

### OS Boundary

**Logistics OS Provides:**
```typescript
// Generic State Machine Primitive
interface StateMachine<TState, TEntity> {
  transition(params: {
    entity: TEntity;
    from: TState;
    to: TState;
    actor_id: string;
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<TransitionResult>;

  canTransition(
    entity: TEntity,
    from: TState,
    to: TState
  ): Promise<boolean>;

  getHistory(entity_id: string): Promise<StateHistory[]>;
}

// Products define states
type ReceiptStatus = 'draft' | 'submitted' | 'completed' | 'on_hold';
type OrderStatus = 'pending' | 'picking' | 'packed' | 'shipped';
```

**Product Uses:**
- Warehouse: Defines `ReceiptStatus` states, uses state machine for transitions
- Fulfillment: Defines `OrderStatus` states, uses state machine for transitions

### Decision: 🟡 **MAYBE (Design as primitive, evaluate in E7)**

**Rationale:**
- Strong domain pattern
- But need to validate: does generic state machine fit all Products?
- Risk: Over-abstraction (Products might need different transition semantics)
- **Decision:** Design interface, test with Warehouse integration, finalize before E8

---

## Candidate 4: Validation Framework

### Definition
**Core concept:** Generic validation engine for business rules

### Domain Reasoning

**Why Logistics OS:**
- Validation is common pattern across Products

**Why NOT Logistics OS:**
- Validation is **programming primitive**, not Logistics-specific
- Could be Platform-level capability

**Why NOT Product:**
- Pattern is cross-product

### OS Boundary

**Platform vs OS Decision:**
- If validation is generic (exists, active, tenant), → **Platform**
- If validation has Logistics semantics (location hierarchy, inventory availability), → **Logistics OS**

### Decision: 🟡 **SPLIT: Generic → Platform, Logistics-Specific → OS**

**Platform Provides:**
- Generic validator engine
- Common rules (exists, active, tenant, required, format)

**Logistics OS Provides:**
- Logistics-specific validators (inventory availability, location valid, item active)

---

## Candidate 5: Query/Aggregation Primitives

### Definition
**Core concept:** Query builders for common aggregations (COUNT, SUM, AVG, GROUP BY)

### Domain Reasoning

**Why NOT Logistics OS:**
- Aggregation is **database primitive**, not Logistics-specific
- All verticals need queries/aggregations

### Decision: ❌ **EXCLUDE (Platform or ORM layer)**

**Rationale:**
- Not Logistics domain concept
- Should be Platform capability or ORM/query library

---

## Candidate 6: Workflow Primitives

### Definition
**Core concepts:** Actor, Precondition, Effect, Compensation for workflows

### Domain Reasoning

**Why Logistics OS:**
- Workflows are common in Logistics (receiving, putaway, picking, shipping)

**Why NOT Logistics OS:**
- Workflow is **programming pattern**, not Logistics-specific

### Decision: 🔴 **WAIT (Need more evidence)**

**Rationale:**
- Need to see multiple Product workflows before abstracting
- Risk: Premature abstraction
- **Re-evaluate after E8/E9:** If workflow pattern appears consistently, extract

---

## Candidate 7: Location Model

### Definition
**Core concept:** Location entity (facility, zone, bin, etc.)

### Domain Reasoning

**Why Logistics OS:**
- Location is fundamental to Logistics (items are at locations)

**Why NOT Logistics OS:**
- Each Product might have **different location models**:
  - **Warehouse:** Warehouse → Zone → Aisle → Bin
  - **Fulfillment:** Facility → Pick Zone → Staging Area
  - **Transportation:** Origin → Transit Hub → Destination
  - **3PL:** Client Facility → Storage Area

**Abstraction Challenge:**
- Hard to define generic "Location" that fits all Products

### Decision: 🟡 **PARTIAL: Generic Location → OS, Specific Hierarchy → Product**

**Logistics OS Provides:**
```typescript
// Generic Location Entity
interface Location {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: LocationType; // facility, zone, bin, etc.
  parent_id?: string; // for hierarchy
  is_active: boolean;
  metadata?: Record<string, any>;
}
```

**Product Defines:**
- Warehouse: Bin-specific attributes (capacity, type, etc.)
- Fulfillment: Pick zone attributes
- Transportation: Hub attributes

**Rationale:** Balance between shared primitive and Product flexibility

---

## Candidate 8: Traceability/Audit

### Definition
**Core concept:** Track movements, changes, actors for compliance

### Domain Reasoning

**Why Logistics OS:**
- Traceability is **critical to Logistics domain**
- Regulatory requirements (FDA, customs, etc.)
- All Products need audit trail

**Why NOT Platform:**
- Platform has generic audit
- Logistics needs **domain-specific traceability** (lot numbers, serial numbers, chain of custody)

### Decision: ✅ **INCLUDE in Logistics OS**

**Logistics OS Provides:**
```typescript
// Logistics Traceability
interface Traceability {
  recordMovement(params: {
    item_id: string;
    from_location: string;
    to_location: string;
    quantity: number;
    lot_number?: string;
    serial_numbers?: string[];
    actor_id: string;
    timestamp: Date;
  }): Promise<void>;

  getChainOfCustody(item_id: string): Promise<CustodyChain[]>;
  getItemHistory(item_id: string, lot_number?: string): Promise<History[]>;
}
```

**Rationale:** Logistics domain requirement, multi-product, compliance-critical

---

## Candidate 9: Operational Events

### Definition
**Core concept:** Domain events for Logistics operations

### Domain Reasoning

**Why Logistics OS:**
- Events are integration mechanism between Products
- Example: Warehouse receives → triggers Fulfillment allocation

**Why NOT Platform:**
- Platform might have generic event bus
- But Logistics needs **domain-specific events** (InventoryReceived, OrderAllocated, ShipmentDispatched)

### Decision: ✅ **INCLUDE in Logistics OS**

**Logistics OS Provides:**
```typescript
// Logistics Domain Events
type LogisticsEvent =
  | InventoryReceivedEvent
  | InventoryMovedEvent
  | InventoryAllocatedEvent
  | OrderCreatedEvent
  | OrderFulfilledEvent
  | ShipmentDispatchedEvent
  | ShipmentDeliveredEvent;

interface EventBus {
  publish(event: LogisticsEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
}
```

**Rationale:** Integration across Products, domain-specific semantics

---

## Logistics OS Boundary Summary

### ✅ INCLUDE in Logistics OS

| Capability | Rationale | Priority |
|-----------|-----------|----------|
| **Inventory Domain Model** | Core domain primitive, multi-product | P0 |
| **Item/SKU Master Data** | Shared entity, multi-product | P0 |
| **Traceability/Audit** | Compliance, domain-specific | P0 |
| **Operational Events** | Integration, domain-specific | P1 |
| **Location (Generic)** | Fundamental concept, with Product flexibility | P1 |

### 🟡 EVALUATE (Design, validate in E7/E8)

| Capability | Reason | Decision Point |
|-----------|--------|----------------|
| **State Machine Primitive** | Strong pattern, but validate fit | After Warehouse integration |
| **Validation (Logistics-Specific)** | Split Platform vs OS | During OS construction |

### ❌ EXCLUDE from Logistics OS

| Capability | Reason | Alternative |
|-----------|--------|-------------|
| **Query/Aggregation** | Database primitive, not domain-specific | Platform or ORM |
| **Generic Validation** | Programming primitive | Platform |
| **Workflow Framework** | Premature, need more evidence | Re-evaluate after E8/E9 |

---

## Product Boundary Summary

### ✅ STAYS in Product (Warehouse-Specific)

| Capability | Rationale |
|-----------|-----------|
| **Receipt Entity** | Warehouse domain model |
| **Bin Management** | Warehouse-specific location type |
| **Putaway Workflow** | Warehouse-specific process |
| **Location Hierarchy** | Warehouse-specific (warehouse/zone/aisle/bin) |
| **Bin Capacity Constraint** | Warehouse-specific business rule |
| **Vendor** | Might be Warehouse-specific (evaluate in E7) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         BELLA PLATFORM                  │
│                                         │
│  • Tenant, Auth, RBAC                   │
│  • Audit Foundation                     │
│  • Subscription, Billing                │
│  • Generic Validation Engine            │
│  • Common Data Types                    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│         LOGISTICS OS                     │
│                                          │
│  P0 Capabilities:                        │
│  • Inventory Domain Model                │
│    - Movement, Allocation, Transaction   │
│  • Item/SKU Master Data                  │
│  • Traceability/Audit                    │
│                                          │
│  P1 Capabilities:                        │
│  • Operational Events                    │
│  • Location (Generic)                    │
│  • State Machine Primitive (validate)    │
└──────────────────┬───────────────────────┘
                   │
        ┌──────────┼───────────┐
        ▼          ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │Warehouse│ │Fulfill- │ │  3PL    │
   │         │ │  ment   │ │         │
   │• Receipt│ │• Order  │ │• Client │
   │• Bin    │ │• Pick   │ │• Cross  │
   │• Putaway│ │• Pack   │ │  Dock   │
   └─────────┘ └─────────┘ └─────────┘
```

---

## E6 as Baseline Evidence

**E6 Warehouse contains (~2,700 LOC):**

| Component | Current Location | Should Be | LOC |
|-----------|------------------|-----------|-----|
| Receipt entity | Warehouse | Warehouse Product | ~400 |
| Bin management | Warehouse | Warehouse Product | ~300 |
| Putaway workflow | Warehouse | Warehouse Product | ~350 |
| Location hierarchy | Warehouse | Warehouse Product | ~150 |
| **Inventory movement** | Warehouse | **→ Logistics OS** | ~400 |
| **SKU entity** | Warehouse | **→ Logistics OS** | ~150 |
| **State transitions** | Warehouse | **→ Logistics OS** | ~250 |
| **Validation logic** | Warehouse | **→ Platform/OS** | ~200 |
| **Aggregation queries** | Warehouse | **→ Platform** | ~150 |
| Bulk operations | Warehouse | TBD (evaluate) | ~200 |
| Constraints | Warehouse | Warehouse Product | ~150 |

**Expected Migration:**
- Warehouse-specific: ~1,350 LOC (stays in Product)
- Logistics OS: ~800 LOC (moves to OS)
- Platform: ~350 LOC (moves to Platform or stays generic)
- Evaluate: ~200 LOC (wait for E7 evidence)

**After E7 Integration:**
- Warehouse Product: ~1,350-1,500 LOC (50% reduction)
- Logistics OS: ~800 LOC (new layer)
- Category C: ~50% (from imported OS capabilities)

---

## Next Steps

### Step 1: Lock This Boundary Definition (Design Only)
- Review Logistics OS capabilities
- Confirm Platform vs OS vs Product boundaries
- No code yet, design only

### Step 2: Define OS Contracts/Interfaces
- Design TypeScript interfaces for P0 capabilities
- Inventory domain model
- Item/SKU master data
- Traceability

### Step 3: Build Logistics OS (E7 Phase 1)
- Implement P0 capabilities
- Unit tests
- No Product integration yet

### Step 4: Integrate Warehouse (E7 Phase 2)
- Refactor Warehouse to consume Logistics OS
- Measure LOC reduction
- Verify E6 tests still pass (60/60)

### Step 5: Build Second Product (E8)
- Build Fulfillment on Logistics OS
- Compare E8 vs E7 (speed, LOC, reuse)
- Test marginal cost hypothesis

---

## Success Criteria

### Boundary Definition Success
- ✅ Clear distinction: Platform / OS / Product
- ✅ Each capability assigned to correct layer
- ✅ Rationale documented (domain reasoning, not code similarity)
- ✅ No premature abstraction

### E7 Integration Success
- ✅ Warehouse LOC reduced by 40-50%
- ✅ Category C > 0% (Warehouse imports OS)
- ✅ All E6 tests pass (60/60)
- ✅ Logistics OS layer proven useful

### E8 Success
- ✅ Fulfillment LOC < Warehouse refactored LOC
- ✅ E8 faster than E7
- ✅ OS leverage confirmed

---

## Key Principles

> **"Không optimize % reuse. Optimize đúng boundary."**

> **"Define OS by domain reasoning, not by code extraction."**

> **"Nếu một capability chỉ có ý nghĩa với Warehouse, để nó ở Warehouse."**

> **"Nếu một capability thực sự là primitive của Logistics và có thể phục vụ nhiều Products, đưa nó vào Logistics OS."**

> **"Nếu nó dùng cho mọi ngành, đưa lên Platform."**

---

**STATUS:** Boundary defined (design phase, no code)  
**Next Action:** Review and lock boundary, then define OS contracts  
**Date:** 2026-08-22  
**Principle:** Domain reasoning > Code extraction
