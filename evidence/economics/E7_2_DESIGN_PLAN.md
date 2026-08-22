# E7.2 Operational Kernel — Design Plan

**Design Date:** 2026-08-22  
**Status:** 📋 DESIGN PHASE (not locked yet)  
**Purpose:** Define scope, architecture, and success criteria for E7.2 before implementation

---

## Context: What E7.1 Delivered vs What E7.2 Must Add

### E7.1 Domain Kernel (Frozen ✅)

**Capabilities:**
- Pure domain logic: `Item.create()`, `Inventory.reserve()`, `Movement.create()`
- 42/42 invariants verified
- 366/366 tests PASS
- Zero external dependencies
- Clean FK boundary

**Gaps:**
- ❌ State machines not enforced (states defined, transitions not integrated)
- ❌ No multi-entity operation patterns
- ❌ No operational invariants ("cannot reserve > available")
- ❌ No guidance on transaction orchestration

### E7.2 Operational Kernel (This Plan)

**Must Add:**
- ✅ State machine enforcement for Inventory + Location
- ✅ Operational invariants (quantity checks, state-based rules)
- ✅ Multi-entity operation pattern (reserve + movement atomicity)
- ✅ Transaction boundary guidance

**Must NOT Add:**
- ❌ External dependencies (events, infrastructure)
- ❌ Opinionated orchestration (Products must have flexibility)
- ❌ Authorization logic (Product responsibility)

---

## Core Design Decisions

### Decision 1: State Machine Architecture

**Question:** Should state machines be generic or domain-specific?

#### Option A: Generic State Machine Class

```typescript
class StateMachine<TState, TEvent> {
  constructor(
    private transitions: Map<TState, Map<TEvent, TState>>,
    private preconditions: Map<[TState, TEvent], () => boolean>
  ) {}

  canTransition(from: TState, event: TEvent): boolean {
    // Check if transition exists + precondition met
  }

  transition(from: TState, event: TEvent): Result<TState> {
    // Execute transition if valid
  }
}

// Usage:
const inventoryStateMachine = new StateMachine<InventoryStatus, InventoryEvent>({
  transitions: {
    AVAILABLE: { RESERVE: 'RESERVED', EXPIRE: 'EXPIRED' },
    RESERVED: { SHIP: 'IN_TRANSIT', CANCEL: 'AVAILABLE' },
    // ...
  },
  preconditions: {
    [AVAILABLE, RESERVE]: (inventory) => inventory.quantity > 0,
    // ...
  }
});
```

**Pros:**
- ✅ Reusable across domains
- ✅ Testable independently
- ✅ Easy to visualize (can generate state diagrams)

**Cons:**
- ❌ Separation between state machine and domain entity
- ❌ Preconditions need domain entity context
- ❌ May be over-engineered for simple toggles (Item: ACTIVE ↔ INACTIVE)

#### Option B: Domain-Specific State Methods

```typescript
class Inventory {
  // E7.1 already has this
  static canTransitionTo(
    inventory: Inventory,
    newStatus: InventoryStatus
  ): Result<void> {
    // Check valid transitions
  }

  // E7.2 adds this
  static reserve(
    inventory: Inventory,
    quantity: number,
    requestedBy: string
  ): Result<Inventory> {
    // Check preconditions
    if (inventory.status !== 'AVAILABLE') {
      return Result.fail('Cannot reserve non-AVAILABLE inventory');
    }
    if (inventory.quantity < quantity) {
      return Result.fail('Insufficient quantity');
    }

    // Execute state transition
    const transitionCheck = Inventory.canTransitionTo(inventory, 'RESERVED');
    if (transitionCheck.isFailure) return transitionCheck;

    // Update state
    return Result.ok({
      ...inventory,
      status: 'RESERVED',
      reservedQuantity: inventory.reservedQuantity + quantity,
      quantity: inventory.quantity - quantity,
      updatedAt: new Date()
    });
  }
}
```

**Pros:**
- ✅ State logic coupled with domain entity (cohesive)
- ✅ Type-safe (inventory context always available)
- ✅ Simple for domains without complex state machines

**Cons:**
- ❌ Less reusable (each domain implements separately)
- ❌ Harder to visualize state machine structure
- ❌ Tests must verify each domain's state logic

#### **DECISION: Option B (Domain-Specific State Methods)**

**Rationale:**

1. **Only 2 domains have complex state machines:** Inventory (4 states, ~8 transitions), Location (3 states, ~4 transitions)
2. **Type safety matters more than abstraction:** Domain-specific methods have full type context
3. **E7.1 pattern already exists:** `canTransitionTo()` is domain-specific, E7.2 continues this pattern
4. **YAGNI:** Generic state machine is over-engineering until we have 5+ domains with state machines

**Implementation:**
- Add operational methods to existing domain classes: `Inventory.reserve()`, `Inventory.ship()`, `Location.deactivate()`
- Each method checks preconditions + calls `canTransitionTo()` + updates state
- Tests verify preconditions, transitions, and postconditions

**ADR:** `ADR-006-domain-specific-state-methods.md`

---

### Decision 2: Multi-Entity Operations Pattern

**Question:** How should OS coordinate operations across multiple entities?

#### Scenario: Reserve Inventory + Create Movement

When a Product reserves inventory, it typically needs to:
1. Update Inventory (AVAILABLE → RESERVED)
2. Create Movement record (OUTBOUND movement)
3. Ensure both succeed or both fail (atomicity)

#### Option A: Application Service Layer

```typescript
// src/platform/logistics/application/inventory-operations.service.ts
class InventoryOperationsService {
  constructor(
    private inventoryRepo: IInventoryRepository,
    private movementRepo: IMovementRepository
  ) {}

  async reserveWithMovement(params: {
    tenantId: string;
    inventoryId: string;
    quantity: number;
    reason: string;
  }): Promise<Result<{ inventory: Inventory; movement: Movement }>> {
    // Start transaction (in-memory for E7.2)
    const tx = await this.startTransaction();

    try {
      // Load inventory
      const inventoryResult = await this.inventoryRepo.findById(params.inventoryId, tx);
      if (inventoryResult.isFailure) return inventoryResult;

      // Reserve domain operation
      const reserveResult = Inventory.reserve(inventoryResult.value, params.quantity);
      if (reserveResult.isFailure) return reserveResult;

      // Save updated inventory
      const saveResult = await this.inventoryRepo.update(reserveResult.value, tx);
      if (saveResult.isFailure) return saveResult;

      // Create movement
      const movementResult = Movement.create({
        tenantId: params.tenantId,
        itemId: inventoryResult.value.itemId,
        direction: 'OUTBOUND',
        quantity: params.quantity,
        reason: params.reason,
        // ...
      });
      if (movementResult.isFailure) return movementResult;

      await this.movementRepo.create(movementResult.value, tx);

      // Commit
      await tx.commit();
      return Result.ok({ inventory: saveResult.value, movement: movementResult.value });
    } catch (error) {
      await tx.rollback();
      return Result.fail('Transaction failed', 'TRANSACTION_ERROR');
    }
  }
}
```

**Pros:**
- ✅ Clear orchestration layer (separates coordination from domain)
- ✅ Testable with in-memory repositories
- ✅ Transaction boundary explicit
- ✅ Domain entities remain pure

**Cons:**
- ❌ New layer (Application Service) adds complexity
- ❌ Products must use Service layer (can't call domain directly)
- ❌ Opinionated (assumes all Products want same coordination)

#### Option B: Domain Service (within domain layer)

```typescript
// src/platform/logistics/domain/inventory-operations.domain.ts
class InventoryOperationsDomain {
  static reserveWithMovement(
    inventory: Inventory,
    quantity: number,
    reason: string
  ): Result<{ inventory: Inventory; movement: Movement }> {
    // Reserve
    const reserveResult = Inventory.reserve(inventory, quantity);
    if (reserveResult.isFailure) return reserveResult;

    // Create movement
    const movementResult = Movement.create({
      tenantId: inventory.tenantId,
      itemId: inventory.itemId,
      direction: 'OUTBOUND',
      quantity,
      reason,
      // ...
    });
    if (movementResult.isFailure) return movementResult;

    return Result.ok({ 
      inventory: reserveResult.value, 
      movement: movementResult.value 
    });
  }
}

// Product layer orchestrates persistence:
const result = InventoryOperationsDomain.reserveWithMovement(inventory, 10, 'Sale');
if (result.isSuccess) {
  await repo.saveInTransaction([
    inventoryRepo.update(result.value.inventory),
    movementRepo.create(result.value.movement)
  ]);
}
```

**Pros:**
- ✅ Stays in domain layer (no new Application layer)
- ✅ Pure functions (no infrastructure dependencies)
- ✅ Products have flexibility (orchestrate persistence their way)

**Cons:**
- ❌ Products must implement transaction orchestration
- ❌ Transaction boundary not enforced by OS
- ❌ Repeated orchestration code across Products

#### Option C: Products Orchestrate Directly (No OS Coordination)

```typescript
// Product code (Warehouse, Finance, etc.)
const tx = await db.transaction();
try {
  const reserveResult = Inventory.reserve(inventory, 10);
  await inventoryRepo.update(reserveResult.value, tx);

  const movementResult = Movement.create({ /* ... */ });
  await movementRepo.create(movementResult.value, tx);

  await tx.commit();
} catch {
  await tx.rollback();
}
```

**Pros:**
- ✅ Maximum flexibility for Products
- ✅ OS stays simple (primitives only)
- ✅ No opinionated coordination

**Cons:**
- ❌ Each Product implements orchestration separately
- ❌ High risk of bugs (forgot transaction, forgot error handling)
- ❌ No reuse across Products

#### **DECISION: Option B (Domain Service) + Guidance Document**

**Rationale:**

1. **OS provides coordination primitives, not enforcement:** Domain Service returns `{ inventory, movement }` tuple
2. **Products orchestrate persistence:** Products decide transaction strategy (single DB transaction, saga, etc.)
3. **Balance reusability + flexibility:** OS handles domain logic coordination, Products handle infrastructure
4. **E7.2 provides pattern, E7.3+ may add Application Service if evidence demands**

**Implementation:**
- Create `InventoryOperationsDomain` class with static methods
- Methods return tuples of domain entities (no persistence)
- Tests verify domain logic correctness (no database)
- Add guidance document: "Transaction Orchestration for Products" (defer to E7.5 when Warehouse integrates)

**ADR:** `ADR-007-domain-service-coordination.md`

---

### Decision 3: Operational Invariants

**Question:** Where should operational invariants be enforced?

#### Types of Invariants

**Type 1: Domain Invariants (E7.1 Scope)**
- "Item SKU must be unique per tenant"
- "Quantity cannot be negative"
- "UOM code required"

**Type 2: Operational Invariants (E7.2 Scope)**
- "Cannot reserve more than available quantity"
- "Cannot ship inventory not in RESERVED state"
- "Cannot move EXPIRED inventory"

#### Enforcement Strategy

**Option A: Enforce in Domain Methods**

```typescript
class Inventory {
  static reserve(inventory: Inventory, quantity: number): Result<Inventory> {
    // Operational invariant: sufficient quantity
    if (inventory.quantity < quantity) {
      return Result.fail(
        `Cannot reserve ${quantity}, only ${inventory.quantity} available`,
        'INSUFFICIENT_QUANTITY'
      );
    }

    // Operational invariant: valid status
    if (inventory.status !== 'AVAILABLE') {
      return Result.fail(
        `Cannot reserve inventory in ${inventory.status} state`,
        'INVALID_STATUS_FOR_RESERVE'
      );
    }

    // Execute transition
    return Result.ok({
      ...inventory,
      status: 'RESERVED',
      reservedQuantity: inventory.reservedQuantity + quantity,
      quantity: inventory.quantity - quantity,
      updatedAt: new Date()
    });
  }
}
```

**Option B: Enforce in Repository Layer**

```typescript
class InventoryRepository {
  async reserve(inventoryId: string, quantity: number): Promise<Result<Inventory>> {
    const inventory = await this.findById(inventoryId);
    
    if (inventory.quantity < quantity) {
      return Result.fail('INSUFFICIENT_QUANTITY');
    }

    // Update in database with optimistic locking
    return await this.update({ ...inventory, quantity: inventory.quantity - quantity });
  }
}
```

**Option C: Enforce in Application Service**

```typescript
class InventoryOperationsService {
  async reserve(inventoryId: string, quantity: number): Promise<Result<Inventory>> {
    const inventory = await this.inventoryRepo.findById(inventoryId);

    // Check operational invariants
    if (inventory.quantity < quantity) {
      return Result.fail('INSUFFICIENT_QUANTITY');
    }

    // Call domain method
    const result = Inventory.reserve(inventory, quantity);
    
    return await this.inventoryRepo.update(result.value);
  }
}
```

#### **DECISION: Option A (Enforce in Domain Methods)**

**Rationale:**

1. **Operational invariants are business rules:** They belong in domain, not infrastructure
2. **Testability:** Can test without database (pure functions)
3. **Consistency:** All callers (Application Service, Domain Service, Product) get same validation
4. **E7.1 pattern:** Domain methods already validate domain invariants

**Implementation:**
- Add operational invariant checks to domain methods: `reserve()`, `ship()`, `deactivate()`
- Each check returns typed error code
- Tests verify invariants hold across all scenarios

**ADR:** `ADR-008-operational-invariants-in-domain.md`

---

### Decision 4: Deferred Repositories — Implement or Continue Deferring?

**Question:** Does E7.2 need the 4 deferred repositories (Movement, Traceability, Location, UOM)?

#### E7.1 Status
- ✅ Implemented: Item, Inventory (needed for E7.1.5 repository tests)
- ⏳ Deferred: Movement, Traceability, Location, UOM (no evidence of need)

#### E7.2 Requirements

**Scenario Analysis:**

1. **Reserve + Movement coordination:**
   - Needs: Inventory repository ✅ (already implemented)
   - Needs: Movement repository ❓ (if we persist movements)
   - Question: Do E7.2 tests need to verify movement persistence?

2. **Location state transitions:**
   - Needs: Location repository ❓ (if we test `deactivate()` with persistence)
   - Question: Can we test Location state machine with in-memory entity?

3. **Traceability operations:**
   - E7.2 scope does not include traceability-specific operations
   - Defer to E7.3 or when Product demands

4. **UOM conversions:**
   - E7.1 already tests UOM conversion logic (no persistence needed)
   - Defer to E7.3 or when Product demands

#### **DECISION: Implement Movement Repository, Continue Deferring Others**

**Rationale:**

1. **Movement repository needed for coordination tests:** If `reserveWithMovement()` pattern is in scope, tests should verify movement creation succeeds
2. **Location/UOM can test with in-memory entities:** State machine tests don't need persistence
3. **Traceability not in E7.2 scope:** No operational invariants specific to traceability

**Implementation:**
- Create `MovementRepository` class (similar to Item/Inventory pattern)
- Basic CRUD: `create()`, `findById()`, `findByItem()`, `update()`
- No complex queries yet (defer until Product needs them)
- Estimate: 30-45 minutes (based on E7.1.5 experience)

**ADR:** `ADR-009-implement-movement-repository.md`

---

### Decision 5: Transaction Strategy for E7.2

**Question:** How should E7.2 tests handle multi-entity transactions?

#### Option A: In-Memory Transaction (Mock)

```typescript
class InMemoryTransaction {
  private changes: Array<() => void> = [];

  add(change: () => void) {
    this.changes.push(change);
  }

  commit() {
    this.changes.forEach(change => change());
  }

  rollback() {
    this.changes = [];
  }
}

// Test usage:
const tx = new InMemoryTransaction();
tx.add(() => inventoryRepo.update(updatedInventory));
tx.add(() => movementRepo.create(movement));
tx.commit();
```

**Pros:**
- ✅ Fast tests (no database)
- ✅ Simple implementation
- ✅ Verifies domain logic correctness

**Cons:**
- ❌ Does not verify real database transaction semantics
- ❌ Does not test rollback on database error

#### Option B: Database Transaction (Integration Test)

```typescript
// Test usage:
const tx = await db.beginTransaction();
try {
  await inventoryRepo.update(updatedInventory, tx);
  await movementRepo.create(movement, tx);
  await tx.commit();
} catch {
  await tx.rollback();
}
```

**Pros:**
- ✅ Tests real transaction semantics
- ✅ Catches database-level issues (constraints, deadlocks)

**Cons:**
- ❌ Slower tests (database roundtrips)
- ❌ Requires database setup for tests
- ❌ May hide domain logic errors (compensated by database constraints)

#### **DECISION: Option A (In-Memory) for E7.2, Database Integration Deferred to E7.3**

**Rationale:**

1. **E7.2 goal: verify domain logic, not database:** State machines, operational invariants, coordination patterns
2. **E7.1 pattern: domain tests don't need database:** All 366 tests are pure domain tests
3. **E7.3 or Product integration (E7.5) will add database integration tests:** When Warehouse consumes OS, we'll test with real database

**Implementation:**
- Create `InMemoryTransaction` class for test usage
- Repository methods accept optional `tx` parameter
- Tests verify domain logic correctness (entities returned, state updated)
- Add note: "Database integration deferred to E7.5 Product integration"

**ADR:** `ADR-010-in-memory-transactions-for-e7-2.md`

---

## E7.2 Scope Definition

### ✅ IN SCOPE

#### 1. State Machine Operations (HIGH PRIORITY)

**Deliverables:**
- `Inventory.reserve(inventory, quantity)` — AVAILABLE → RESERVED with quantity check
- `Inventory.ship(inventory)` — RESERVED → IN_TRANSIT with precondition check
- `Inventory.cancel(inventory)` — RESERVED → AVAILABLE (unreserve)
- `Inventory.expire(inventory)` — QUARANTINE → EXPIRED
- `Location.deactivate(location)` — ACTIVE → INACTIVE with safety check
- `Location.close(location)` — INACTIVE → CLOSED (permanent)
- `Location.reactivate(location)` — INACTIVE → ACTIVE

**Tests:**
- Valid transitions with preconditions/postconditions
- Invalid transitions rejected
- Operational invariants enforced (quantity, status)
- Edge cases: boundary values, concurrent state

**Estimate:** 90 minutes (domain methods + tests)

#### 2. Operational Invariants (HIGH PRIORITY)

**Invariants to Enforce:**
- "Cannot reserve quantity > available"
- "Cannot ship inventory not in RESERVED state"
- "Cannot move EXPIRED inventory"
- "Cannot deactivate location with active inventory" (if we add check)
- "Cannot reserve EXPIRED/QUARANTINE inventory"

**Tests:**
- Each invariant has 3-5 tests
- Error codes are typed and testable

**Estimate:** 45 minutes (add checks to domain methods + tests)

#### 3. Multi-Entity Coordination Pattern (HIGH PRIORITY)

**Deliverables:**
- `InventoryOperationsDomain.reserveWithMovement()`
- Returns `{ inventory: Inventory, movement: Movement }` tuple
- Pure function (no persistence)

**Tests:**
- Verify both entities created correctly
- Verify domain logic for both entities
- Verify failure in one prevents both (no partial success)

**Estimate:** 60 minutes (domain service + tests)

#### 4. Movement Repository (MEDIUM PRIORITY)

**Deliverables:**
- `IMovementRepository` interface
- `MovementRepository` implementation (Supabase)
- Basic CRUD: `create()`, `findById()`, `findByItem()`

**Tests:**
- Not in E7.2 scope (defer to E7.5 integration)
- Basic smoke test: create + findById

**Estimate:** 45 minutes (based on E7.1.5 experience)

#### 5. In-Memory Transaction Support (LOW PRIORITY)

**Deliverables:**
- `InMemoryTransaction` class for tests
- Repository methods accept optional `tx` parameter

**Tests:**
- Not needed (test utility)

**Estimate:** 15 minutes

### ⏳ OUT OF SCOPE (Deferred)

#### 1. Domain Events
- **Reason:** Adds infrastructure dependency
- **Defer to:** E7.5 (when Warehouse integration reveals need)

#### 2. Idempotency
- **Reason:** Product responsibility
- **Defer to:** E7.5 (guidance document for Products)

#### 3. Concurrency Control (Optimistic Locking)
- **Reason:** No evidence of concurrent conflicts yet
- **Defer to:** E7.3 or when Product load testing reveals need

#### 4. Database Integration Tests
- **Reason:** E7.2 focuses on domain logic
- **Defer to:** E7.5 (Product integration)

#### 5. Authorization Patterns
- **Reason:** Product responsibility
- **Defer to:** E7.5 (guidance document for Products)

#### 6. Cross-OS Operations
- **Reason:** Only 1 OS exists (Logistics)
- **Defer to:** E7.4 (when Finance OS exists)

#### 7. Traceability/Location/UOM Repositories
- **Reason:** No operational tests demand them
- **Defer to:** E7.3 or when evidence shows need

---

## E7.2 Implementation Plan

### Phase 1: Inventory State Machine (90 min)

**Tasks:**
1. Add `reserve()`, `ship()`, `cancel()`, `expire()` to `Inventory` domain class
2. Each method checks preconditions, calls `canTransitionTo()`, updates state
3. Return typed errors for invariant violations
4. Write tests (estimate: 40-50 tests for 4 operations × ~10-12 scenarios each)

**Files:**
- `src/platform/logistics/domain/inventory.domain.ts` (modify)
- `src/platform/logistics/domain/__tests__/inventory-operations.test.ts` (new)

**Success Criteria:**
- All transitions tested (valid + invalid)
- All operational invariants enforced
- 0 test failures

### Phase 2: Location State Machine (45 min)

**Tasks:**
1. Add `deactivate()`, `close()`, `reactivate()` to `Location` domain class
2. Each method checks preconditions, transitions state
3. Write tests (estimate: 15-20 tests for 3 operations × ~5-7 scenarios each)

**Files:**
- `src/platform/logistics/domain/location.domain.ts` (modify)
- `src/platform/logistics/domain/__tests__/location-operations.test.ts` (new)

**Success Criteria:**
- All transitions tested
- State transition rules enforced
- 0 test failures

### Phase 3: Operational Invariants (45 min)

**Tasks:**
1. Review all domain methods for missing operational checks
2. Add invariant enforcement (quantity, status, etc.)
3. Write tests for each invariant violation scenario

**Files:**
- `src/platform/logistics/domain/inventory.domain.ts` (modify)
- `src/platform/logistics/domain/movement.domain.ts` (modify if needed)

**Success Criteria:**
- 5+ operational invariants documented and tested
- Each invariant has typed error code
- Tests verify invariants cannot be bypassed

### Phase 4: Multi-Entity Coordination (60 min)

**Tasks:**
1. Create `InventoryOperationsDomain` class
2. Implement `reserveWithMovement()` method (pure function)
3. Write coordination tests
4. Add in-memory transaction support for tests

**Files:**
- `src/platform/logistics/domain/inventory-operations.domain.ts` (new)
- `src/platform/logistics/domain/__tests__/inventory-coordination.test.ts` (new)
- `src/platform/logistics/test-utils/in-memory-transaction.ts` (new)

**Success Criteria:**
- Coordination logic tested
- Both entities created correctly
- Failure in one prevents both

### Phase 5: Movement Repository (45 min)

**Tasks:**
1. Create `MovementRepository` class (Supabase implementation)
2. Implement basic CRUD: `create()`, `findById()`, `findByItem()`
3. Write smoke test (create + findById)

**Files:**
- `src/platform/logistics/repository/movement.repository.ts` (new)
- `src/platform/logistics/repository/__tests__/movement.repository.test.ts` (new, minimal)

**Success Criteria:**
- Repository implements `IMovementRepository` interface
- Basic CRUD works
- Smoke test passes

### Phase 6: Verification & Lock (30 min)

**Tasks:**
1. Run all E7.1 tests (366 must still PASS)
2. Run all E7.2 tests (estimate: 60-80 new tests)
3. Verify zero new external dependencies
4. Verify FK boundary still clean
5. Create evidence document: `E7_2_OPERATIONAL_KERNEL_EVIDENCE.md`
6. Update work log: `E7_2_WORK_LOG.md`
7. Lock E7.2

**Files:**
- `evidence/economics/E7_2_OPERATIONAL_KERNEL_EVIDENCE.md` (new)
- `evidence/economics/E7_2_WORK_LOG.md` (new)

**Success Criteria:**
- All E7.1 tests still PASS (no regression)
- All E7.2 tests PASS
- Evidence document complete
- E7.2 locked 🔒

---

## Time Estimates

| Phase | Estimate | Cumulative |
|-------|----------|------------|
| Phase 1: Inventory State Machine | 90 min | 90 min |
| Phase 2: Location State Machine | 45 min | 135 min |
| Phase 3: Operational Invariants | 45 min | 180 min |
| Phase 4: Multi-Entity Coordination | 60 min | 240 min |
| Phase 5: Movement Repository | 45 min | 285 min |
| Phase 6: Verification & Lock | 30 min | 315 min |
| **Total** | **315 min** | **5h 15m** |

**Comparison with E7.1:**
- E7.1 actual: 282 minutes (4h 42m)
- E7.2 estimate: 315 minutes (5h 15m)
- Delta: +33 minutes (+12%)

**Risk:** E7.1 overran estimate by 30%. E7.2 may also overrun.

**Contingency:** If Phase 1-2 take longer than estimate, defer Phase 5 (Movement Repository) to evidence-driven need.

---

## Success Criteria for E7.2

E7.2 will be considered COMPLETE when:

### Functional Criteria
- [ ] Inventory state machine operational: `reserve()`, `ship()`, `cancel()`, `expire()`
- [ ] Location state machine operational: `deactivate()`, `close()`, `reactivate()`
- [ ] All state transitions tested (valid + invalid paths)
- [ ] Operational invariants enforced and tested (quantity checks, status checks)
- [ ] Multi-entity coordination pattern demonstrated (`reserveWithMovement()`)
- [ ] Movement repository implemented (basic CRUD)

### Quality Criteria
- [ ] All E7.1 tests still PASS (366/366, zero regression)
- [ ] E7.2 tests achieve target coverage (estimate: 60-80 new tests)
- [ ] Test pass rate: 100%
- [ ] Zero new external dependencies added
- [ ] FK boundary remains clean (schema unchanged or additive only)

### Evidence Criteria
- [ ] Evidence document created: `E7_2_OPERATIONAL_KERNEL_EVIDENCE.md`
- [ ] Work log created: `E7_2_WORK_LOG.md`
- [ ] All ADRs documented (ADR-006 through ADR-010)
- [ ] Bugs found (if any) documented with rework time
- [ ] Baseline metrics recorded (time, LOC, tests, bugs)

### Lock Criteria
- [ ] Design plan reviewed and approved
- [ ] Implementation complete
- [ ] All tests passing
- [ ] Evidence package complete
- [ ] **E7.2 LOCKED 🔒**

---

## Architectural Decision Records (ADRs)

### ADR-006: Domain-Specific State Methods

**Decision:** Use domain-specific state methods instead of generic state machine class.

**Rationale:**
- Only 2 domains have complex state machines (Inventory, Location)
- Type safety matters more than abstraction
- E7.1 pattern already domain-specific (`canTransitionTo()`)
- YAGNI: Generic state machine is premature until 5+ domains

**Consequences:**
- Each domain implements state logic separately
- State machines less visible (no centralized graph)
- But: Better type safety, simpler implementation

### ADR-007: Domain Service Coordination

**Decision:** Use Domain Service for multi-entity coordination, Products orchestrate persistence.

**Rationale:**
- OS provides coordination primitives, not enforcement
- Products decide transaction strategy (single DB transaction, saga, etc.)
- Balance reusability + flexibility

**Consequences:**
- Domain Service returns tuples of entities (no persistence)
- Products must implement transaction orchestration
- Application Service layer may be added in E7.3+ if evidence demands

### ADR-008: Operational Invariants in Domain

**Decision:** Enforce operational invariants in domain methods, not repository or application layer.

**Rationale:**
- Operational invariants are business rules (belong in domain)
- Testable without database (pure functions)
- Consistent validation for all callers

**Consequences:**
- Domain methods have more responsibility (validation + state transition)
- Repository stays thin (persistence only)
- All callers get same validation automatically

### ADR-009: Implement Movement Repository

**Decision:** Implement Movement repository in E7.2, continue deferring Location/Traceability/UOM.

**Rationale:**
- Movement repository needed for coordination tests (`reserveWithMovement()`)
- Location/UOM can test with in-memory entities
- Traceability not in E7.2 operational scope

**Consequences:**
- 3/6 repositories implemented after E7.2
- 3/6 still deferred (will implement when evidence demands)

### ADR-010: In-Memory Transactions for E7.2

**Decision:** Use in-memory transactions for E7.2 tests, defer database integration to E7.5.

**Rationale:**
- E7.2 goal: verify domain logic, not database
- E7.1 pattern: domain tests don't need database
- Product integration (E7.5) will add database integration tests

**Consequences:**
- Fast tests (no database roundtrips)
- Does not verify real transaction semantics
- Database integration deferred to when Warehouse consumes OS

---

## Questions for Review Before Lock

Before locking this design and starting implementation:

### Question 1: Is E7.2 scope appropriate?

**Too small?**
- Missing: Domain events, idempotency, concurrency control
- Should we add any of these to E7.2?

**Too large?**
- Could we defer Location state machine to E7.3?
- Could we defer Movement repository to E7.3?

### Question 2: Are ADRs sound?

- ADR-006: Domain-specific state methods vs generic state machine
- ADR-007: Domain Service vs Application Service
- ADR-008: Operational invariants in domain
- ADR-009: Implement Movement repository
- ADR-010: In-memory transactions

Do any of these need reconsideration?

### Question 3: Is 5h15m estimate realistic?

- E7.1 overran by 30% (planned 315m → actual 411m)
- E7.2 estimate: 315m
- Should we add contingency buffer (e.g., plan for 400-420m)?

### Question 4: What is success criteria for "operational"?

E7.2 aims to make Logistics OS "operationally usable". What does that mean?

- Products CAN consume OS (but don't yet) ✅
- State machines enforce valid operations ✅
- Coordination patterns demonstrated ✅
- Transaction guidance provided ✅

Is this sufficient, or should E7.2 include actual Product integration?

---

## Next Action

**Review this design plan:**
1. Validate scope (in/out decisions)
2. Validate ADRs (architectural decisions)
3. Validate estimates (time, tests)
4. Validate success criteria

**Once locked:**
- Create ADR documents (ADR-006 through ADR-010)
- Start Phase 1 implementation
- Track time and progress in `E7_2_WORK_LOG.md`

**DO NOT start coding until design is locked.**
