# E7: Logistics OS Construction Plan

**Date:** 2026-08-22  
**Status:** Ready to Execute  
**Purpose:** Build Logistics OS Core + Integrate Warehouse

---

## Strategic Context

> **"Không xây Product để chứng minh OS. Xây OS để Product có thể hưởng lợi từ nó."**

**E6 proved:** Bella can build Products fast  
**Architecture locked:** OS boundary defined  
**E7 goal:** Build the missing OS layer

```
BEFORE E7:
Bella Platform
      │
      └── Warehouse Product (2,700 LOC, 0% code reuse)

AFTER E7:
Bella Platform
      │
      ▼
┌──────────────┐
│ LOGISTICS OS │  ← E7 builds this
└──────┬───────┘
       │
       ▼
 Warehouse Product (consumes OS)
```

---

## Critical Principles

### 1. E6 is Frozen (Control Group)

**DO NOT modify E6 baseline:**
- ✅ 2,700 LOC (immutable)
- ✅ T₆ = 0.452d (immutable)
- ✅ C₆ = 0.0114d (immutable)
- ✅ 100% pattern reuse, 0% code reuse (immutable)

**E6 = measurement #1, control group for E7/E8/E9 comparison.**

---

### 2. Design OS by Domain, Not by Extraction

**WRONG:**
```
Warehouse code → copy → call it "Logistics OS"
```

**RIGHT:**
```
Domain reasoning → OS primitives → Warehouse consumes OS
```

**Classification test:**
- **Platform:** Cross-industry capability (Tenant, Auth, Audit)
- **Logistics OS:** Cross-logistics-product primitive (Inventory, Movement, Traceability)
- **Warehouse Product:** Warehouse-specific capability (Receipt, Bin, Putaway)

---

### 3. E7 May Be More Expensive Than E6

**This is EXPECTED and ACCEPTABLE.**

E7 pays the cost of building OS infrastructure:

```
E6: 2,700 LOC total

E7: Logistics OS (2,000 LOC)
    + Warehouse integration (1,000 LOC)
    = 3,000 LOC total
```

**Looks worse than E6 in isolation.**

But E7 is NOT the final measurement. E8/E9 will test leverage:

```
E6 → 2,700 LOC (no OS)
E7 → OS built (one-time cost)
E8 → Product #2: 1,500 LOC? (reuses OS)
E9 → Product #3: 900 LOC? (reuses OS)
```

**If marginal cost decreases → OS leverage proven.**

---

### 4. Finance Integration Comes After Core

**Phase sequence:**
1. ✅ Domain Kernel (Item, Inventory, Movement)
2. ✅ Operational Kernel (State, Events)
3. ✅ Rules & Traceability
4. ⏳ Finance Integration Adapter
5. ⏳ Warehouse integration

**Don't connect everything immediately.** Build stable OS core first.

---

## E7 Phase Breakdown

### E7.1: Domain Kernel (P0)

**Goal:** Core Logistics domain entities

**Scope:**
- `LogisticsEntity` (base entity with audit, tenant)
- `Item` / `SKU` master data
- `Inventory` (balance, location)
- `InventoryMovement` (transactions)
- `Traceability` (lot, serial, chain of custody)

**Deliverable:**
- TypeScript implementation of domain models
- Database schema (migrations)
- Unit tests (isolated, no Products)

**Anti-pattern to avoid:**
- ❌ Including Receipt, Bin, Putaway in OS (Warehouse-specific)
- ❌ Including accounting logic (Finance OS responsibility)

**Success criteria:**
- Domain models exist independently
- Can create/query inventory without Warehouse Product
- Tests pass without Product dependencies

---

### E7.2: Operational Kernel (P1)

**Goal:** State machine, transitions, events

**Scope:**
- State machine primitives
- Transition validation
- Preconditions / postconditions
- Idempotency guarantees
- Operational event publishing

**Deliverable:**
- State transition framework
- Event emitter infrastructure
- Transaction boundary enforcement
- Tests for state invariants

**Example:**
```typescript
// Logistics OS provides state primitive
class InventoryState {
  current: 'PENDING' | 'AVAILABLE' | 'RESERVED' | 'ALLOCATED' | 'SHIPPED';
  
  canTransitionTo(next: State): boolean {
    // OS enforces valid transitions
  }
  
  transitionTo(next: State, context: TransitionContext): Result {
    // Validates + publishes event
  }
}
```

**Warehouse Product consumes:**
```typescript
// Warehouse uses OS primitive, doesn't reimplement
receipt.inventory.transitionTo('AVAILABLE', context);
```

---

### E7.3: Rules & Traceability (P2)

**Goal:** Validation, business rules, constraints

**Scope:**
- Validation primitives (quantity > 0, location valid, etc.)
- Business rules engine
- Constraint enforcement
- Aggregation queries (balance by location, item, tenant)
- Traceability service (lot/serial tracking)

**Deliverable:**
- Rule engine implementation
- Aggregation query service
- Traceability API
- Tests for rule enforcement

**Example:**
```typescript
// Logistics OS provides validation
class InventoryRules {
  validateMovement(movement: InventoryMovement): ValidationResult {
    // Check quantity > 0
    // Check location exists
    // Check tenant isolation
    // Check sufficient balance (for outbound)
  }
}
```

---

### E7.4: Finance Integration Adapter (P3)

**Goal:** Connect Logistics OS to Finance OS

**Scope:**
- `FinanceEventEnvelope` extension (LogisticsContext, InventoryContext)
- Event publisher (reuse Healthcare pattern)
- Outbox implementation
- Idempotency store
- Correlation / traceability

**Deliverable:**
- Finance event publisher service
- Outbox table + background worker
- Idempotency guarantees
- Tests for event publishing

**Reference:** `src/platform/integration-hub/finance-event-publisher.ts` (Healthcare pattern)

**Example:**
```typescript
// Logistics OS publishes finance event
await financeEventPublisher.publish({
  event_type: 'INVENTORY_RECEIVED',
  amount: (quantity * unitCost).toString(),
  currency: 'VND',
  business_context: {
    logistics: { operation_type: 'RECEIVING', facility_id, ... },
    inventory: { item_id, quantity, unit_cost, ... },
  },
});
```

**Finance OS consumes (existing handler):**
- Semantic resolution
- Intent generation
- COA resolution
- Journal entry creation

---

### E7.5: Warehouse → Logistics OS Integration

**Goal:** Refactor Warehouse to consume OS

**Scope:**
- Warehouse imports Logistics OS contracts
- Replace Warehouse inventory logic → OS calls
- Replace Warehouse SKU entity → OS entity
- Replace Warehouse state management → OS primitives
- Replace Warehouse traceability → OS service
- Publish finance events via OS event bus

**Deliverable:**
- Warehouse code refactored
- E6 tests still pass (60/60)
- Warehouse LOC reduced
- OS adoption metrics

**Measurement:**
```
Metric                          E6        E7
─────────────────────────────────────────────
Warehouse LOC                   2,700     ~1,500-1,800?
Logistics OS LOC                0         ~2,000?
% Warehouse consuming OS        0%        40-50%?
Number of OS primitives used    0         5-10?
Integration friction            N/A       measure bugs
```

**Anti-pattern to avoid:**
- ❌ Warehouse directly queries Logistics OS database (use contracts)
- ❌ Logistics OS imports Warehouse code (strict boundary)
- ❌ Copying code from Warehouse to OS (redesign for reuse)

---

### E7.6: E7 Measurement & Lock

**Goal:** Measure E7 with same rigor as E6

**Scope:**
- Time to build Logistics OS (T₇₁)
- Time to integrate Warehouse (T₇₂)
- Rework / bugs during E7 (C₇)
- LOC breakdown (OS vs Product)
- Pattern reuse (B%)
- Code reuse (C%)
- OS adoption metrics

**Deliverable:**
- `E7_FINAL_ANALYSIS.md` (like E6)
- `E7_WORK_LOG.md` (timeline)
- `E7_MEASUREMENT.md` (metrics)
- `E7_FINAL_LOCK.md` (closure)

**Key metrics:**

| Metric | E6 | E7 | Delta |
|--------|----|----|-------|
| **Time** | 0.452d | ? | ? |
| **Rework** | 0.0114d | ? | ? |
| **Total LOC** | 2,700 | ? | ? |
| **Warehouse LOC** | 2,700 | ? | -40-50%? |
| **OS LOC** | 0 | ? | +2,000? |
| **Pattern reuse** | 100% | ? | ? |
| **Code reuse (C%)** | 0% | ? | +30-40%? |
| **Bugs** | 4 | ? | ? |

**Don't expect E7 to be "cheaper" than E6.** E7 pays OS investment cost.

---

## Capability Classification

### Platform (Cross-Industry)

**Keep in Platform, DO NOT move to Logistics OS:**

- Tenant isolation (P0 Gate)
- RBAC / Authorization
- Authentication
- Audit foundation (created_at, updated_at, created_by)
- Security (encryption, masking)
- Billing primitives

---

### Logistics OS (Cross-Logistics-Product)

**Move to OS if serves multiple Logistics Products:**

✅ **P0 (Must Have):**
- Item / SKU master data
- Inventory domain model
- Inventory movement (transactions)
- Traceability (lot, serial)
- Operational events

✅ **P1 (Should Have):**
- State machine primitives
- Transition validation
- Location (generic concept)
- Balance aggregation queries

✅ **P2 (Nice to Have):**
- Validation rules
- Business rule engine
- Workflow primitives

✅ **P3 (Integration):**
- Finance event envelope
- Outbox pattern
- Idempotency

---

### Warehouse Product (Warehouse-Specific)

**Keep in Product, DO NOT move to OS:**

✅ **Warehouse-specific entities:**
- Receipt (GRN)
- Bin / Location hierarchy
- Putaway workflow
- Bin capacity management
- Warehouse-specific state (RECEIVED, PUTAWAY_PENDING, etc.)

✅ **Warehouse-specific business logic:**
- Receipt validation rules
- Putaway strategy
- Bin selection algorithm
- Warehouse-specific constraints

---

## Anti-Patterns (DO NOT DO)

### ❌ 1. Warehouse 2.0 Disguised as OS

**Wrong:**
```
Copy all Warehouse code → rename to "Logistics OS"
```

**Result:** Logistics OS becomes bloated with Warehouse-specific logic.

**Right:**
```
Design OS primitives → Warehouse consumes primitives
```

---

### ❌ 2. God OS (Everything Reusable Goes to OS)

**Wrong:**
```
If any code COULD be reused → move to OS
```

**Result:** OS boundary loses meaning, becomes dumping ground.

**Right:**
```
Only move capability if it's truly a Logistics primitive
Test: Would Order Fulfillment, 3PL, Returns need this?
```

---

### ❌ 3. Extracting Code Without Redesign

**Wrong:**
```
Warehouse code works → copy to OS → done
```

**Result:** OS contains Product-specific assumptions.

**Right:**
```
Warehouse code as reference → redesign for generality → OS implements
```

---

### ❌ 4. Direct Database Access

**Wrong:**
```
Warehouse queries Logistics OS database directly
```

**Result:** Tight coupling, boundary violated.

**Right:**
```
Warehouse imports OS contracts → calls OS services
```

---

### ❌ 5. Logistics OS Performs Accounting

**Wrong:**
```
Logistics OS calculates COGS, creates journal entries
```

**Result:** Violates Finance OS boundary.

**Right:**
```
Logistics OS emits business events → Finance OS interprets
```

---

## Success Criteria

### E7.1-E7.4 (OS Construction) Success

- ✅ Logistics OS runs independently (no Product dependencies)
- ✅ Domain models tested in isolation
- ✅ State machine enforces invariants
- ✅ Events published to outbox
- ✅ Finance integration tested (event envelope)
- ✅ Zero accounting logic in Logistics OS

---

### E7.5 (Warehouse Integration) Success

- ✅ Warehouse imports OS contracts
- ✅ Warehouse LOC reduced by 40-50%
- ✅ All E6 tests still pass (60/60)
- ✅ Warehouse publishes finance events via OS
- ✅ No direct database access (uses contracts)
- ✅ Clear boundary (Warehouse doesn't modify OS data directly)

---

### E7.6 (Measurement) Success

- ✅ T₇, C₇, LOC measured with same rigor as E6
- ✅ OS adoption metrics documented
- ✅ Evidence quality maintained
- ✅ Work log complete (timeline, decisions, bugs)
- ✅ Gaps documented (not hidden)

---

## Measurement Protocol

### Time Tracking

**T₇₁ (OS Construction):**
- Start: When E7.1 begins
- End: When E7.4 complete (OS tests pass)

**T₇₂ (Warehouse Integration):**
- Start: When E7.5 begins
- End: When E6 tests pass again (60/60)

**T₇ Total:**
```
T₇ = T₇₁ + T₇₂
```

---

### Rework Tracking

**C₇ (Rework):**
- Count time spent fixing bugs
- Count time spent redesigning (if initial approach failed)
- Count time spent refactoring due to missed requirements

**Bug categories:**
- Architecture bugs (boundary violation, tight coupling)
- Domain bugs (state invariant violated)
- Integration bugs (Warehouse → OS contract issues)
- Data bugs (tenant isolation, RLS)

---

### LOC Breakdown

**Measure separately:**
- Logistics OS LOC (implementation)
- Warehouse LOC (after integration)
- Integration adapter LOC (glue code)
- Test LOC (separate from implementation)

**Calculate reuse:**
```
Before E7:
- Warehouse: 2,700 LOC
- OS: 0 LOC
- Total: 2,700 LOC
- Code reuse (C%): 0%

After E7:
- Logistics OS: X LOC
- Warehouse: Y LOC
- Total: X + Y LOC
- Code reuse (C%): X / (X + Y) * 100%
```

---

### OS Adoption Metrics

**% Warehouse Consuming OS:**
```
(Number of Warehouse capabilities using OS) / (Total Warehouse capabilities) * 100%
```

**Example:**
```
Warehouse capabilities: 10 total
  - Receipt: uses OS Inventory (✅)
  - Bin: Warehouse-specific (❌)
  - Putaway: uses OS Location + State (✅)
  - Inventory query: uses OS (✅)
  - Movement: uses OS (✅)
  - Traceability: uses OS (✅)
  
OS adoption: 5/10 = 50%
```

**Number of OS Primitives Used:**
- Item / SKU
- Inventory
- Movement
- State machine
- Traceability
- Events
- Validation

---

## Roadmap

```
✅ E6
   Warehouse baseline
   2,700 LOC, 0% code reuse
   
         ↓
         
✅ Architecture Lock
   Platform / OS / Product boundary
   P0 contracts defined
   Finance integration pattern
   
         ↓
         
🔵 E7.1 (3-5 days)
   Domain Kernel
   Item, Inventory, Movement, Traceability
   
         ↓
         
🔵 E7.2 (2-3 days)
   Operational Kernel
   State machine, Events
   
         ↓
         
🔵 E7.3 (2-3 days)
   Rules & Traceability
   Validation, Aggregation
   
         ↓
         
🔵 E7.4 (1-2 days)
   Finance Integration
   Event publisher, Outbox
   
         ↓
         
🔵 E7.5 (2-3 days)
   Warehouse Integration
   Refactor to consume OS
   
         ↓
         
🔵 E7.6 (1 day)
   E7 Measurement & Lock
   Metrics, Evidence, Closure
   
         ↓
         
🟢 E8
   Product #2 (Order Fulfillment)
   Test OS leverage
   
         ↓
         
🟢 E9
   Product #3
   
         ↓
         
📈 Trend Analysis
   E6 → E7 → E8 → E9
   Marginal cost curve
```

---

## Key Quotes (User Intent)

> **"E6 là control group. Đừng sửa nó."**

> **"Không phải extract code từ Warehouse. Phải design OS primitives rồi để Warehouse consume."**

> **"E7 có thể đắt hơn E6. Đó là chi phí xây OS. E8/E9 mới chứng minh leverage."**

> **"Logistics OS chỉ phát ra business events. Finance OS chịu trách nhiệm accounting."**

> **"Đo E7 với cùng độ nghiêm túc như E6. Không chỉ đo 'code chạy'."**

> **"Từ E6 sang E7: Bella chuyển từ 'có một Warehouse Product tốt' sang 'đang xây Logistics OS có khả năng sinh ra nhiều Products'."**

---

## Next Steps

### Immediate (E7.1 Start)

1. **Audit Warehouse Product:**
   - Read all E6 implementation files
   - Classify each capability (Platform / OS / Product)
   - Document boundary violations (if any)

2. **Design Domain Kernel:**
   - Item / SKU schema
   - Inventory schema
   - Movement transaction schema
   - Traceability schema

3. **Create Migrations:**
   - `src/platform/logistics/migrations/`
   - Separate OS tables from Product tables

4. **Implement Domain Models:**
   - `src/platform/logistics/domain/`
   - Pure business logic (no database, no HTTP)

5. **Write Tests:**
   - `src/platform/logistics/domain/__tests__/`
   - Test domain invariants

### After E7.1 Complete

- ⏳ E7.2: Operational Kernel
- ⏳ E7.3: Rules & Traceability
- ⏳ E7.4: Finance Integration
- ⏳ E7.5: Warehouse Integration
- ⏳ E7.6: Measurement & Lock

---

**STATUS:** Ready to execute E7.1 (Domain Kernel)  
**PRINCIPLE:** OS boundary before code, measurement before claims  
**DATE:** 2026-08-22
