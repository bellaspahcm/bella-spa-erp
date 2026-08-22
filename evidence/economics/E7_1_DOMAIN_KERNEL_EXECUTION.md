# E7.1: Domain Kernel Execution Plan

**Phase:** E7.1 (Logistics OS Domain Kernel)  
**Start Date:** 2026-08-22  
**Status:** Ready to Execute  
**Scope:** Build independent OS layer (NOT refactor Warehouse)

---

## Strategic Context

> **"E7.1 xây Logistics OS độc lập, dùng Warehouse làm consumer đầu tiên."**

**E6 proved:** Bella can build Products fast  
**E7.1 must prove:** Bella can build OS that Products consume

**Critical question E7.1 answers:**
> "Bella có thể xây một capability layer độc lập mà Product không cần tự sở hữu domain logic nữa hay không?"

---

## E7.1 Scope (Domain Kernel Only)

### ✅ In Scope (P0 Domain Kernel)

**4 Core Entities:**
1. **Item / SKU** — Master data for all Logistics Products
2. **Inventory** — Balance (on-hand, reserved, available) by location
3. **InventoryMovement** — Transaction log (immutable, audit trail)
4. **Traceability** — Lot/serial tracking, chain of custody

**2 Supporting Primitives:**
5. **Generic Location** — Abstract location (not bin-specific)
6. **UOM** — Unit of measure (basic support)

**Total:** ~1,500-2,000 LOC (domain + persistence + tests)

---

### ❌ Out of Scope (Deferred to E7.2/E7.3/E7.4)

**E7.2 (Operational Kernel):**
- State machine primitives
- Transition validation
- Event publishing

**E7.3 (Rules & Traceability):**
- Validation framework
- Business rules engine
- Aggregation queries

**E7.4 (Finance Integration):**
- FinanceEventPublisher
- Outbox implementation
- LogisticsContext extension

**E7.5 (Warehouse Integration):**
- Warehouse refactor to consume OS
- LOC reduction measurement

**Reason:** Keep E7.1 focused on domain kernel. Avoid "big bang" implementation.

---

## E7.1 Execution Steps

### E7.1.1: Freeze E6 Baseline

**Action:** Mark E6 as immutable control group

**Evidence:**
- E6 baseline: 2,700 LOC, 0% code reuse
- T₆ = 0.452d, C₆ = 0.0114d
- 15/15 requirements PASS

**Status:** ✅ DONE (locked in E6_FINAL_LOCK.md)

---

### E7.1.2: Define OS Domain Contracts

**Action:** Create TypeScript interfaces for domain models

**Deliverable:**
```
src/platform/logistics/domain/
├── item.types.ts          // Item, SKU, ItemType
├── inventory.types.ts     // Inventory, InventoryBalance
├── movement.types.ts      // InventoryMovement, MovementType
├── traceability.types.ts  // Traceability, LotSerial
├── location.types.ts      // Location, LocationType
└── uom.types.ts           // UnitOfMeasure, UOMType
```

**Key principles:**
- Pure TypeScript interfaces (no implementation)
- Domain-driven design (not database-first)
- Warehouse-agnostic (no Receipt, Bin, Putaway concepts)
- Finance-agnostic (no Debit/Credit, no accounting)

**Acceptance criteria:**
- ✅ Interfaces compile without errors
- ✅ Zero Warehouse dependencies
- ✅ Zero Finance dependencies
- ✅ Can be understood without E6 context

---

### E7.1.3: Define Persistence Model

**Action:** Create database schema for Logistics OS

**Deliverable:**
```
migrations/logistics/
└── 20260822_logistics_os_domain_kernel.sql
```

**Schema structure:**
```sql
-- New schema for Logistics OS
CREATE SCHEMA IF NOT EXISTS logistics;

-- Item / SKU master data
CREATE TABLE logistics.items (...);

-- Inventory balance
CREATE TABLE logistics.inventory (...);

-- Movement transaction log (immutable)
CREATE TABLE logistics.inventory_movements (...);

-- Traceability (lot/serial)
CREATE TABLE logistics.traceability (...);

-- Generic location
CREATE TABLE logistics.locations (...);

-- UOM (optional, may defer to E7.2)
CREATE TABLE logistics.uom (...);
```

**Key principles:**
- Separate `logistics.*` schema (not `logistics_warehouse_*`)
- RLS policies for tenant isolation (P0 Gate)
- Audit triggers (reuse Platform pattern)
- Generic naming (not warehouse-specific)

**Acceptance criteria:**
- ✅ Schema migration runs without errors
- ✅ RLS policies enforce tenant isolation
- ✅ Foreign keys reference Platform tables (tenants)
- ✅ Audit triggers work
- ✅ No references to Warehouse tables

---

### E7.1.4: Implement Pure Domain Kernel

**Action:** Implement domain logic (business rules, invariants)

**Deliverable:**
```
src/platform/logistics/domain/
├── item.domain.ts
├── inventory.domain.ts
├── movement.domain.ts
├── traceability.domain.ts
├── location.domain.ts
└── uom.domain.ts
```

**Example (Item domain):**
```typescript
export class ItemDomain {
  static create(props: CreateItemProps): Result<Item> {
    // Validation
    if (!props.skuCode) return Result.fail('SKU code required');
    if (!props.name) return Result.fail('Item name required');
    
    // Domain invariants
    if (props.serialTracked && !props.lotTracked) {
      return Result.fail('Serial tracking requires lot tracking');
    }
    
    // Create entity
    return Result.ok({ ... });
  }
  
  static canDeactivate(item: Item): Result<void> {
    // Check no active inventory (future)
    return Result.ok();
  }
}
```

**Key principles:**
- Pure domain logic (no database, no HTTP)
- Result<T> pattern for error handling
- Domain invariants enforced
- Testable without infrastructure

**Acceptance criteria:**
- ✅ Domain logic compiles
- ✅ Zero dependencies on Warehouse
- ✅ Zero dependencies on Finance
- ✅ Zero dependencies on database
- ✅ Can run in Node.js without Supabase

---

### E7.1.5: Implement Repository Boundary

**Action:** Create repository interfaces + implementations

**Deliverable:**
```
src/platform/logistics/repositories/
├── item.repository.interface.ts
├── item.repository.ts
├── inventory.repository.interface.ts
├── inventory.repository.ts
├── movement.repository.interface.ts
├── movement.repository.ts
└── (similar for traceability, location)
```

**Example (Item repository):**
```typescript
// Interface
export interface IItemRepository {
  findById(tenantId: string, itemId: string): Promise<Item | null>;
  findBySkuCode(tenantId: string, skuCode: string): Promise<Item | null>;
  save(item: Item): Promise<void>;
  list(tenantId: string, filters?: ItemFilters): Promise<Item[]>;
}

// Implementation
export class ItemRepository implements IItemRepository {
  constructor(private db: Database) {}
  
  async findById(tenantId: string, itemId: string): Promise<Item | null> {
    // Query logistics.items table
    // Map database row → domain entity
  }
  
  // ...
}
```

**Key principles:**
- Interface-first (dependency inversion)
- Repository pattern (not active record)
- Tenant isolation enforced
- Map database ↔ domain entities

**Acceptance criteria:**
- ✅ Repositories compile
- ✅ Interfaces define contracts
- ✅ Implementations use `logistics.*` schema
- ✅ Tenant isolation enforced
- ✅ No Warehouse table references

---

### E7.1.6: Domain Tests

**Action:** Write unit tests for domain logic

**Deliverable:**
```
src/platform/logistics/domain/__tests__/
├── item.domain.test.ts
├── inventory.domain.test.ts
├── movement.domain.test.ts
└── (similar for traceability, location)
```

**Test categories:**
1. **Happy path** — Valid operations succeed
2. **Validation** — Invalid inputs rejected
3. **Domain invariants** — Business rules enforced
4. **Edge cases** — Boundary conditions handled

**Example tests:**
```typescript
describe('ItemDomain', () => {
  describe('create', () => {
    it('creates valid item', () => {
      const result = ItemDomain.create({
        tenantId: 'tenant-1',
        skuCode: 'SKU-001',
        name: 'Test Item',
        baseUom: 'EA',
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('ACTIVE');
    });
    
    it('fails if SKU code empty', () => {
      const result = ItemDomain.create({
        tenantId: 'tenant-1',
        skuCode: '',
        name: 'Test Item',
        baseUom: 'EA',
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('SKU code required');
    });
    
    it('fails if serial tracking without lot tracking', () => {
      const result = ItemDomain.create({
        tenantId: 'tenant-1',
        skuCode: 'SKU-001',
        name: 'Test Item',
        baseUom: 'EA',
        lotTracked: false,
        serialTracked: true, // Invalid
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Serial tracking requires lot tracking');
    });
  });
});
```

**Acceptance criteria:**
- ✅ All domain tests pass
- ✅ Tests run in isolation (no database)
- ✅ Zero Warehouse dependencies
- ✅ Coverage > 80% for domain logic

---

### E7.1.7: Verify OS Independence

**Action:** Confirm Logistics OS has ZERO Warehouse dependencies

**Verification checklist:**

**✅ Import Analysis:**
```bash
# Search for Warehouse imports in Logistics OS
grep -r "warehouse" src/platform/logistics/
# Expected: 0 results
```

**✅ Database Schema:**
```sql
-- Check foreign keys
SELECT * FROM information_schema.table_constraints 
WHERE constraint_schema = 'logistics'
  AND constraint_type = 'FOREIGN KEY';
-- Expected: Only references to Platform tables (tenants)
```

**✅ Domain Logic:**
- No Receipt concepts in Logistics OS
- No Bin concepts in Logistics OS
- No Putaway concepts in Logistics OS
- No Vendor concepts in Logistics OS

**✅ Can Run Independently:**
```typescript
// Logistics OS should work without Warehouse
import { ItemDomain } from '@platform/logistics/domain/item';

const result = ItemDomain.create({ ... });
// Should compile and run
```

**Acceptance criteria:**
- ✅ Zero imports from Warehouse
- ✅ Zero references to Warehouse tables
- ✅ Zero Warehouse-specific concepts
- ✅ Can compile without Warehouse code
- ✅ Tests pass without Warehouse

---

### E7.1.8: E7.1 Lock & Measurement

**Action:** Lock E7.1 deliverables + measure

**Deliverable:** `E7_1_DOMAIN_KERNEL_LOCK.md`

**Metrics to measure:**

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Time (T₇₁)** | 3-5 days | ? | ⏳ |
| **Rework (C₇₁)** | < 0.5 day | ? | ⏳ |
| **LOC (OS)** | 1,500-2,000 | ? | ⏳ |
| **Domain tests** | > 30 | ? | ⏳ |
| **Test pass rate** | 100% | ? | ⏳ |
| **Warehouse imports** | 0 | ? | ⏳ |
| **Finance imports** | 0 | ? | ⏳ |
| **RLS policies** | 6 (one per table) | ? | ⏳ |

**Evidence to capture:**
- Start timestamp (E7.1.2 begins)
- End timestamp (E7.1.7 verified)
- Bug count during E7.1
- Rework time (fixing bugs, redesign)
- LOC breakdown (domain, persistence, tests)
- Test results (pass/fail count)

**Acceptance criteria:**
- ✅ All E7.1.2-E7.1.7 steps complete
- ✅ Metrics documented
- ✅ Evidence captured
- ✅ OS runs independently

---

## Anti-Patterns to Avoid

### ❌ 1. Extract Warehouse Code

**Wrong:**
```typescript
// Copy from Warehouse
cp src/products/warehouse/sku.ts src/platform/logistics/domain/item.ts
```

**Right:**
```typescript
// Design OS primitive independently
// Use E6 as reference, not source
```

---

### ❌ 2. Optimize for LOC Reduction

**Wrong:**
```
Goal: Warehouse must drop to exactly 1,500 LOC
Action: Remove code to hit target
```

**Right:**
```
Goal: Build good OS architecture
Measure: Actual LOC after integration (may be 1,200, 1,500, or 1,800)
Accept: Evidence over target
```

---

### ❌ 3. Warehouse-Specific Logic in OS

**Wrong:**
```typescript
// Logistics OS
class Inventory {
  putawayToBin(binId: string) { ... } // Warehouse concept
}
```

**Right:**
```typescript
// Logistics OS
class Inventory {
  moveToLocation(locationId: string) { ... } // Generic
}

// Warehouse Product
class WarehouseBin {
  assignInventory(inventory: Inventory) {
    inventory.moveToLocation(this.binId);
  }
}
```

---

### ❌ 4. Accounting Logic in OS

**Wrong:**
```typescript
// Logistics OS
class InventoryMovement {
  calculateCOGS() { ... } // Finance responsibility
  createJournalEntry() { ... } // Finance responsibility
}
```

**Right:**
```typescript
// Logistics OS
class InventoryMovement {
  // Just records the movement
}

// Finance OS (later)
class FinanceEventHandler {
  handleInventoryMovement(movement) {
    // Finance OS calculates COGS
    // Finance OS creates journal entries
  }
}
```

---

### ❌ 5. Big Bang Implementation

**Wrong:**
```
E7.1: Build everything (Domain + State + Events + Finance + Integration)
```

**Right:**
```
E7.1: Domain Kernel only
E7.2: Operational Kernel (State + Events)
E7.3: Rules & Traceability
E7.4: Finance Integration
E7.5: Warehouse Integration
```

---

## Success Criteria (E7.1)

### Technical Success

- ✅ **Logistics OS compiles and runs independently**
- ✅ **Zero Warehouse dependencies** (verified by import analysis)
- ✅ **Zero Finance dependencies** (no accounting logic)
- ✅ **Domain tests pass** (> 30 tests, 100% pass rate)
- ✅ **RLS policies enforce tenant isolation** (P0 Gate)
- ✅ **Schema migration successful** (`logistics.*` schema created)

---

### Architectural Success

- ✅ **OS boundary clean** (no Product concepts in OS)
- ✅ **Domain-driven design** (not database-first)
- ✅ **Repository pattern** (dependency inversion)
- ✅ **Pure domain logic** (testable without infrastructure)
- ✅ **Generic primitives** (reusable across Logistics Products)

---

### Evidence Success

- ✅ **Time tracked** (T₇₁ measured)
- ✅ **Rework tracked** (C₇₁ measured)
- ✅ **LOC measured** (domain, persistence, tests)
- ✅ **Bug count documented** (issues found & fixed)
- ✅ **Work log complete** (timeline, decisions, blockers)

---

## Timeline Estimate

**E7.1 Duration:** 3-5 days

**Breakdown:**
- E7.1.2 (Contracts): 0.5 day
- E7.1.3 (Schema): 0.5 day
- E7.1.4 (Domain): 1.5 days
- E7.1.5 (Repositories): 1 day
- E7.1.6 (Tests): 1 day
- E7.1.7 (Verification): 0.5 day
- E7.1.8 (Lock): 0.5 day

**Total:** ~5.5 days (with buffer)

---

## Key Quotes (Strategic Principles)

> **"E6 không thất bại. E6 phát hiện vấn đề kiến trúc: Warehouse đã được xây mà chưa có Logistics OS đứng bên dưới."**

> **"E7.1 xây Logistics OS độc lập, dùng Warehouse làm consumer đầu tiên."**

> **"Không lấy 2,000 LOC từ Warehouse chuyển sang OS. Phải thiết kế lại OS primitive độc lập."**

> **"Không optimize code để đạt target. Optimize architecture để tạo ra evidence."**

> **"E7.1 trả lời: Bella có thể xây một capability layer độc lập mà Product không cần tự sở hữu domain logic nữa hay không?"**

---

## Next After E7.1

- ⏳ E7.2: Operational Kernel (State machine, Events)
- ⏳ E7.3: Rules & Traceability
- ⏳ E7.4: Finance Integration Adapter
- ⏳ E7.5: Warehouse Integration (consume OS)
- ⏳ E7.6: E7 Measurement & Lock

---

**STATUS:** Ready to execute E7.1.2 (Define OS Domain Contracts)  
**START:** 2026-08-22  
**PRINCIPLE:** Build OS independently, measure evidence, not targets  
**GOAL:** Prove Bella can build capability layer Products consume


---

## Execution Status

| Step | Description | Status | Completed | Duration | Notes |
|------|-------------|--------|-----------|----------|-------|
| **E7.1.1** | Freeze E6 baseline | ✅ DONE | 2026-08-22 | N/A | E6 locked (2,700 LOC, T₆=0.452d) |
| **E7.1.2** | Define OS domain contracts | ✅ DONE | 2026-08-22 | 45 min | 1,304 LOC (type defs, docs, error codes) |
| **E7.1.3** | Define persistence model | ✅ DONE | 2026-08-22 | 17 min | 455 LOC, 6 tables, 35 indexes, 6 RLS |
| **E7.1.4** | Implement pure domain kernel | 🟡 NEXT | TBD | TBD | item.domain.ts, inventory.domain.ts, movement.domain.ts |
| **E7.1.5** | Implement repository boundary | ⏳ PENDING | TBD | TBD | Repository interfaces + implementations |
| **E7.1.6** | Domain tests | ⏳ PENDING | TBD | TBD | Unit tests (target >30, 100% pass) |
| **E7.1.7** | Verify OS independence | ⏳ PENDING | TBD | TBD | Zero Warehouse/Finance imports |
| **E7.1.8** | E7.1 lock & measurement | ⏳ PENDING | TBD | TBD | Capture metrics (T₇₁, C₇₁, LOC) |

**Current Status:** ✅ E7.1.3 COMPLETE  
**Next:** E7.1.4 — Implement pure domain kernel  
**Progress:** 3/8 steps complete (37.5%)


---

## E7.1.5 COMPLETE — Repository Boundary

**Completed:** 2026-08-22 14:05  
**Duration:** 45 minutes

**Deliverable:** 1,073 LOC
- 6 repository interfaces (323 LOC)
- 2 implementations: ItemRepository (294 LOC), InventoryRepository (424 LOC)
- 4 deferred: Movement, Traceability, Location, UOM (contracts only)

**Strategy validation:** Interface-first + evidence-driven implementation ✅  
**Dependency inversion:** Domain → Interface (not implementation) ✅  
**Zero bugs:** 0 issues found during implementation ✅

---

## Cumulative Progress (E7.1.1-E7.1.5)

| Metric | Value |
|--------|-------|
| **Steps complete** | 5/8 (62.5%) |
| **Time** | 144 minutes (2.4 hours) |
| **LOC** | 4,680 |
| **Bugs** | 0 |
| **Rework** | 0 minutes |

**Breakdown:**
- E7.1.2 Contracts: 1,304 LOC (45 min)
- E7.1.3 Schema: 455 LOC (17 min)
- E7.1.4 Domain: 1,848 LOC (37 min)
- E7.1.5 Repositories: 1,073 LOC (45 min)

**Next:** E7.1.6 — Domain tests (target >30 tests, 100% pass)
