# E7.3 Design — Capability Inventory

**Purpose:** Map E7.1/E7.2 existing capabilities before defining E7.3 scope  
**Date:** 2026-08-22  
**Status:** DRAFT

---

## 1. E7.1 Domain Primitives (FROZEN 🔒)

### 1.1 Core Entities

| Entity | Status | Primitives | Traceability Support |
|--------|--------|------------|---------------------|
| **Item** | FROZEN | id, sku_code, name, type, base_uom, status | lot_tracked, serial_tracked, expiry_tracked (boolean flags) |
| **Inventory** | FROZEN | id, item_id, location_id, quantity_on_hand, quantity_reserved, quantity_available | lot_number, serial_number, expiry_date (optional fields) |
| **Location** | FROZEN | code, name, type, status, parent_location_id | (no traceability fields) |
| **Movement** | FROZEN | movement_number, type, direction, quantity, from/to locations, status | lot_number, serial_number, expiry_date (optional fields) |
| **TraceabilityRecord** | FROZEN | lot_number, serial_number, custody_events, compliance_status, recall_status | Full traceability entity |
| **UOM** | FROZEN | code, name, base_unit, conversion_factor | (no traceability fields) |

**Key Finding:**
- ✅ E7.1 **already has** traceability primitives (lot, serial, expiry) in Inventory and Movement
- ✅ E7.1 **already has** TraceabilityRecord entity with custody events
- ✅ E7.1 **already has** compliance_status and recall_status enums
- ⚠️ **Gap:** No explicit "rule" or "constraint" representation yet

### 1.2 Status Enums (State Machines)

**InventoryStatus (E7.1 FROZEN):**
```typescript
'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'QUARANTINE' | 
'DAMAGED' | 'EXPIRED' | 'TRANSIT' | 'BLOCKED'
```

**ItemStatus (E7.1 FROZEN):**
```typescript
'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'PENDING'
```

**LocationStatus (E7.1 FROZEN):**
```typescript
'ACTIVE' | 'INACTIVE' | 'CLOSED'
```

**MovementStatus (E7.1 FROZEN):**
```typescript
'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
```

**Key Finding:**
- ✅ E7.1 has status enums for all core entities
- ✅ Status transitions exist (canTransitionTo methods)
- ⚠️ **Gap:** No generic "precondition" or "business rule" abstraction

### 1.3 Traceability Support (Already Present!)

**From inventory.types.ts:**
- `lot_number?: LotNumber` (optional)
- `serial_number?: SerialNumber` (optional)
- `expiry_date?: Date` (optional)

**From item.types.ts (tracking flags):**
- `lot_tracked: boolean`
- `serial_tracked: boolean`
- `expiry_tracked: boolean`

**From traceability.types.ts (Full entity):**
```typescript
interface TraceabilityRecord {
  id: TraceabilityId;
  tenant_id: string;
  item_id: ItemId;
  lot_number?: LotNumber;
  serial_number?: SerialNumber;
  manufactured_date?: Date;
  expiry_date?: Date;
  received_date: Date;
  supplier?: SupplierReference;
  custody_events: CustodyEvent[];  // Chain of custody
  compliance_status: ComplianceStatus;
  recall_status: RecallStatus;
  recall_reason?: string;
  recall_date?: Date;
}
```

**CustodyEvent:**
```typescript
interface CustodyEvent {
  timestamp: Date;
  location_id: string;
  location_type: LocationType;
  action: 'RECEIVED' | 'MOVED' | 'QUARANTINED' | 'RELEASED' | 
          'SHIPPED' | 'DAMAGED' | 'DESTROYED';
  user_id?: string;
  notes?: string;
}
```

**Key Finding:**
- ✅ **E7.1 already has comprehensive traceability primitives**
- ✅ Lot/serial/expiry tracking is **already domain-level**
- ✅ Chain of custody (custody_events) already exists
- ✅ Compliance status and recall status already defined
- ⚠️ **Gap:** No automatic custody event generation from movements yet

---

## 2. E7.2 Operational Capabilities (FROZEN 🔒)

### 2.1 State Machine Operations

**Inventory Operations (E7.2):**
```typescript
reserveOperation(inventory, quantity, context)  // AVAILABLE → RESERVED
shipOperation(inventory, context)               // RESERVED → TRANSIT
cancelOperation(inventory, quantity, context)   // RESERVED → AVAILABLE
expireOperation(inventory, context)             // QUARANTINE → EXPIRED
```

**Location Operations (E7.2):**
```typescript
deactivateOperation(location, context)      // ACTIVE → INACTIVE
closeOperation(location, context)           // ACTIVE/INACTIVE → CLOSED
reactivateOperation(location, context)      // INACTIVE → ACTIVE
```

**Operational Context (E7.2 pattern):**
```typescript
interface OperationContext {
  reason: string;        // Why this operation?
  actor: string;         // Who performed it?
  timestamp?: Date;      // When?
}
```

**Key Finding:**
- ✅ E7.2 enforces **context** (reason + actor) for all operations
- ✅ E7.2 validates **preconditions** (status, quantity) before state change
- ✅ E7.2 provides **typed errors** for violations
- ✅ E7.2 guarantees **atomic failure** (no partial mutation)
- ⚠️ **Gap:** Context validation is per-operation, not generic/reusable

### 2.2 Operational Invariants (E7.2)

**7 Invariant Types Enforced:**
1. Quantity constraints (positive, not exceeding limits)
2. Status-based preconditions
3. Context requirements (reason + actor)
4. Atomic failure (no partial mutation)
5. Typed errors for all failures
6. Reservation consistency
7. Cancel quantity ≤ reserved

**Key Finding:**
- ✅ E7.2 enforces invariants **per operation**
- ⚠️ **Gap:** No declarative way to define invariants separately from code
- ⚠️ **Gap:** No generic "rule evaluation" pattern

### 2.3 Multi-Entity Coordination (E7.2)

**InventoryOperationsDomain Service:**
```typescript
reserveWithMovement(inventory, quantity, movementProps, context)
  → Result<{ inventory: Inventory, movement: InventoryMovement }>

shipWithMovement(inventory, movementProps, context)
  → Result<{ inventory: Inventory, movement: InventoryMovement }>

cancelWithMovement(inventory, quantity, movementProps, context)
  → Result<{ inventory: Inventory, movement: InventoryMovement }>
```

**Pattern:** Domain Service returns entity tuples, Products orchestrate persistence.

**Key Finding:**
- ✅ E7.2 coordinates Inventory + Movement operations
- ✅ E7.2 maintains domain purity (no persistence in service)
- ⚠️ **Gap:** No automatic traceability event creation from coordination

### 2.4 Movement Repository (E7.2)

**MovementRepository Interface:**
```typescript
findById(tenantId, movementId): Result<InventoryMovement>
findByMovementNumber(tenantId, movementNumber): Result<InventoryMovement>
list(tenantId, filters?): Result<InventoryMovement[]>
save(movement): Result<InventoryMovement>
saveBatch(movements[]): Result<InventoryMovement[]>
```

**Key Finding:**
- ✅ E7.2 provides persistence boundary for Movement
- ✅ Tenant isolation enforced
- ⚠️ **Gap:** No TraceabilityRecord repository yet

---

## 3. What E7.1/E7.2 Already Has (Do NOT Rebuild)

### ✅ Already Present in E7.1/E7.2:

1. **Traceability Primitives:**
   - Lot, serial, expiry fields on Inventory and Movement
   - TraceabilityRecord entity with custody events
   - Compliance status, recall status enums

2. **State Management:**
   - Status enums for all entities
   - Status transition validation (canTransitionTo)
   - Lifecycle state protection

3. **Operation Context:**
   - Reason + actor pattern (E7.2)
   - Audit metadata (created_at, updated_at, created_by)

4. **Movement Tracking:**
   - Immutable movement log
   - Source document references
   - Direction (inbound/outbound/neutral)

5. **Invariant Enforcement:**
   - Quantity constraints
   - Status preconditions
   - Atomic failure semantics

6. **Domain Service Pattern:**
   - Multi-entity coordination
   - Pure functions (no side effects)
   - Entity tuples return pattern

---

## 4. What E7.3 MUST Add (Gaps)

### 4.1 Generic Rule Representation

**Current State:**
- Rules are **embedded in code** (e.g., `if (quantity <= 0)`)
- No way to define rules separately from domain logic
- No way for Products to add rules without modifying kernel

**E7.3 Gap:**
> **Need:** Generic rule definition + evaluation primitives
> **NOT:** Full workflow engine or Product-specific rules

**Example Boundary:**
```typescript
// ✅ E7.3 should provide:
interface Rule<T> {
  name: string;
  evaluate(input: T): Result<void>;
  violation_code: string;
}

// ❌ E7.3 should NOT provide:
interface WarehouseReceivingRule {
  checkQAApproval(): boolean;
  routeToBin(): string;
}
```

### 4.2 Automatic Traceability Event Generation

**Current State:**
- TraceabilityRecord exists (E7.1)
- CustodyEvent structure defined (E7.1)
- **Gap:** No automatic event creation from movements

**E7.3 Gap:**
> **Need:** Movement → Custody Event mapping
> **Boundary:** E7.3 generates events; Products decide when to record them

**Example:**
```typescript
// ✅ E7.3 could provide:
function generateCustodyEvent(
  movement: InventoryMovement
): CustodyEvent {
  // Map movement_type → custody action
  // Extract location, timestamp, user
}

// ❌ E7.3 should NOT:
function executeWarehouseReceivingWorkflow() {
  // Business workflow logic
}
```

### 4.3 Rule Violation Tracking

**Current State:**
- Typed errors exist (InventoryDomainError, etc.)
- Error codes defined per domain
- **Gap:** No violation history/audit

**E7.3 Gap:**
> **Need:** Violation log for compliance reporting
> **Boundary:** E7.3 records violations; Products interpret them

### 4.4 Expiry/Compliance Enforcement

**Current State:**
- expiry_date field exists
- compliance_status enum exists
- **Gap:** No automatic expiry checking or compliance rule evaluation

**E7.3 Gap:**
> **Need:** Time-based rule evaluation (expiry checks)
> **Boundary:** E7.3 evaluates "is expired?"; Products decide action

### 4.5 Lineage/Chain of Custody Query

**Current State:**
- custody_events array exists
- Movement log is immutable
- **Gap:** No query primitive for "trace this lot upstream/downstream"

**E7.3 Gap:**
> **Need:** Lineage query primitives
> **Example:** "Find all movements for lot L123" or "Trace origin of serial S456"

---

## 5. E7.3 Scope Boundary (Proposed)

### ✅ E7.3 SHOULD Own:

1. **Generic Rule Primitives:**
   - Rule definition interface
   - Rule evaluation pattern
   - Precondition validation abstraction
   - Violation result types

2. **Traceability Operations:**
   - Generate custody events from movements
   - Query lineage (upstream/downstream)
   - Expiry checking primitive
   - Compliance evaluation primitive

3. **Rule Violation Log:**
   - Violation record entity
   - Violation persistence
   - Violation query

4. **Constraint Evaluation:**
   - Time-based constraints (expiry)
   - Quantity-based constraints (min/max stock)
   - Status-based constraints (preconditions)

### ❌ E7.3 MUST NOT Own:

1. **Product Workflows:**
   - Warehouse receiving workflow
   - QA approval process
   - Putaway strategy
   - Finance posting workflow

2. **Business Logic:**
   - "When Sales Order X, do Y"
   - Product-specific approval chains
   - Custom validation rules per Product

3. **Workflow Engine:**
   - Task orchestration
   - Approval routing
   - User assignment

---

## 6. Key Architecture Questions for E7.3

### Q1: Rule Definition Pattern

**Option A:** Code-based rules (functions)
```typescript
const mustBePositive: Rule<number> = {
  name: 'QUANTITY_POSITIVE',
  evaluate: (qty) => qty > 0 ? ok() : err('NEGATIVE_QUANTITY'),
};
```

**Option B:** Declarative rules (data-driven)
```typescript
const rules = [
  { field: 'quantity', constraint: 'gt', value: 0 },
];
```

**Question:** Which pattern maintains kernel independence better?

### Q2: Traceability Event Generation

**Option A:** Explicit (Products call `generateCustodyEvent`)
**Option B:** Automatic (E7.3 hooks into Movement creation)

**Question:** Which preserves Product control while reducing boilerplate?

### Q3: Rule Violation Storage

**Option A:** Store all violations (compliance log)
**Option B:** Store only Result<T> (ephemeral)

**Question:** Does E7.3 need persistent violation log, or is that Product concern?

### Q4: Lineage Query Complexity

**Option A:** Simple queries (find by lot/serial)
**Option B:** Graph traversal (full upstream/downstream chain)

**Question:** How deep should E7.3 go before it becomes Product-specific?

---

## 7. Dependencies on E7.1/E7.2 (Read-Only)

E7.3 will READ (not modify) these frozen contracts:

### E7.1 Contracts (Read-Only):
- ✅ `Inventory` entity + fields
- ✅ `Item` entity + tracking flags
- ✅ `Movement` entity + fields
- ✅ `TraceabilityRecord` entity + custody events
- ✅ Status enums (InventoryStatus, ItemStatus, etc.)
- ✅ `Result<T>` pattern

### E7.2 Contracts (Read-Only):
- ✅ `OperationContext` pattern (reason + actor)
- ✅ Operational invariants (precondition pattern)
- ✅ Domain Service pattern (entity tuple returns)
- ✅ MovementRepository interface

### No Modifications to E7.1/E7.2 Permitted

If E7.3 design reveals **E7.1/E7.2 defects**, process:
1. **STOP** implementation
2. Document defect
3. Create Architecture Change Request (ACR)
4. Architecture review
5. ADR if approved
6. Re-baseline E7.1/E7.2
7. Re-run 439 tests

**No silent modifications.**

---

## 8. Success Criteria for E7.3

E7.3 is successful if:

> **"A Product can define business rules and traceability requirements using E7.3 primitives WITHOUT modifying E7.1/E7.2 kernel AND WITHOUT embedding Product-specific workflow in E7.3."**

**Test Case:**
- Product "Warehouse" adds rule: "Cannot ship QUARANTINE inventory"
- Product uses E7.3 rule primitive
- E7.1/E7.2 unchanged
- E7.3 does not contain "Warehouse workflow logic"

If this test case fails → E7.3 boundary violated.

---

## 9. Next Steps

1. ✅ **E7.3.1 Complete** — Capability inventory created
2. ⏳ **E7.3.2 Next** — Define E7.3 boundary (scope document)
3. ⏳ **E7.3.3** — Design traceability operations
4. ⏳ **E7.3.4** — Design rule primitives
5. ⏳ **E7.3.5** — Define invariants + negative-path criteria
6. ⏳ **E7.3.6** — ADR + Design Lock

**No code yet.**

---

**END OF E7.3 CAPABILITY INVENTORY**
