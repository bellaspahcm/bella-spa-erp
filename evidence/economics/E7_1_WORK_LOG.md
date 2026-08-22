# E7.1 Domain Kernel — Work Log

**Phase:** E7.1 (Logistics OS Domain Kernel)  
**Start:** 2026-08-22  
**Status:** In Progress

---

## Measurement Protocol

**Track from E7.1.2 onwards:**
- ✅ Contract LOC
- ✅ Domain model LOC
- ✅ Persistence LOC (schema + repositories)
- ✅ Test LOC
- ✅ Design time (contracts, schema design)
- ✅ Implementation time (coding)
- ✅ Test time (writing + debugging)
- ✅ Boundary decisions (what stayed IN vs OUT of OS)
- ✅ Rejected capabilities (considered but excluded)
- ✅ Bug count & rework time

**Evidence Quality:**
> **"Không chỉ ghi những gì đưa vào OS. Những thứ đã xem xét nhưng quyết định không đưa vào cũng là evidence rất giá trị."**

---

## Timeline

### E7.1.1: Freeze E6 Baseline

**Date:** 2026-08-22  
**Status:** ✅ COMPLETE  
**Duration:** N/A (already locked in E6_FINAL_LOCK.md)

**Evidence:**
- E6 baseline: 2,700 LOC, 0% code reuse
- T₆ = 0.452d, C₆ = 0.0114d
- 15/15 requirements PASS
- E6 schema frozen at `migrations/logistics/20260821_warehouse_schema.sql`

**Decision:** E6 is immutable control group. Do NOT modify.

---

### E7.1.2: Define OS Domain Contracts

**Date:** 2026-08-22  
**Status:** ✅ COMPLETE  
**Start Time:** 2026-08-22 10:45:00  
**End Time:** 2026-08-22 11:30:00  
**Duration:** 0.03 days (~45 minutes)

**Deliverables:**
- ✅ `src/platform/logistics/domain/item.types.ts` (283 LOC)
- ✅ `src/platform/logistics/domain/inventory.types.ts` (306 LOC)
- ✅ `src/platform/logistics/domain/movement.types.ts` (384 LOC)
- ✅ `src/platform/logistics/domain/traceability.types.ts` (138 LOC)
- ✅ `src/platform/logistics/domain/location.types.ts` (97 LOC)
- ✅ `src/platform/logistics/domain/uom.types.ts` (71 LOC)
- ✅ `src/platform/logistics/domain/index.ts` (25 LOC)

**Total Contract LOC:** 1,304 LOC

**Design Decisions:**
1. ✅ Item includes traceability flags (lot_tracked, serial_tracked, expiry_tracked)
2. ✅ Inventory uses generic LocationId (not bin-specific)
3. ✅ Movement is immutable (audit trail)
4. ✅ Traceability supports custody chain
5. ✅ Location is generic abstraction (Products extend with bins, slots, etc.)
6. ✅ UOM is basic (full conversion system deferred to future)

**Boundary Verification:**
- ✅ Zero Warehouse concepts (no Receipt, Bin, Putaway, Vendor)
- ✅ Zero Finance concepts (only cost hints, no accounting)
- ✅ Zero Product-specific logic
- ✅ All types compile without errors

**Key Insight:**
Contract design took ~45 minutes. Most time spent on Movement types (384 LOC) due to comprehensive direction/type taxonomy. Inventory types (306 LOC) second-largest due to reservation/allocation support.

**Scope:**
- Item / SKU contracts
- Inventory contracts
- Movement contracts
- Traceability contracts
- Location contracts
- UOM contracts

**Deliverable:**
```
src/platform/logistics/domain/
├── item.types.ts
├── inventory.types.ts
├── movement.types.ts
├── traceability.types.ts
├── location.types.ts
└── uom.types.ts
```

**Measurement to capture:**
- [ ] Start timestamp
- [ ] Contract LOC (per file)
- [ ] Total contract LOC
- [ ] Design decisions (what to include/exclude)
- [ ] Rejected concepts (and why)
- [ ] End timestamp
- [ ] Duration (design time)

---

## Boundary Decisions Log

**Purpose:** Document what went INTO OS vs what STAYED in Warehouse/Platform

### ✅ Included in Logistics OS

| Capability | Rationale | Decision Date |
|-----------|-----------|---------------|
| Item / SKU | Cross-product primitive | 2026-08-22 (audit) |
| Inventory Balance | Core Logistics primitive | 2026-08-22 (audit) |
| Movement Log | Transaction audit trail | 2026-08-22 (audit) |
| Traceability | Regulatory requirement | 2026-08-22 (audit) |
| Generic Location | Abstract location concept | 2026-08-22 (audit) |
| UOM | Measurement standard | 2026-08-22 (audit) |

---

### ❌ Excluded from Logistics OS

| Capability | Rationale | Decision Date |
|-----------|-----------|---------------|
| Receipt (GRN) | Warehouse-specific inbound document | 2026-08-22 (audit) |
| Bin entity | Warehouse-specific location hierarchy | 2026-08-22 (audit) |
| Putaway workflow | Warehouse-specific operation | 2026-08-22 (audit) |
| Vendor | Procurement-specific (not core Logistics) | 2026-08-22 (audit) |
| Bin capacity logic | Warehouse-specific constraint | 2026-08-22 (audit) |
| Receipt workflow states | Warehouse-specific state machine | 2026-08-22 (audit) |
| Discrepancy tracking | Warehouse receiving workflow | 2026-08-22 (audit) |

---

### ⏳ Deferred (Not E7.1 Scope)

| Capability | Rationale | Deferred To |
|-----------|-----------|-------------|
| State machine | Operational kernel, not domain kernel | E7.2 |
| Event publishing | Integration layer, not domain kernel | E7.2 / E7.4 |
| Validation framework | Rules layer, not domain kernel | E7.3 |
| Aggregation queries | Rules layer, not domain kernel | E7.3 |
| Finance events | Finance integration, not domain kernel | E7.4 |
| Outbox pattern | Finance integration, not domain kernel | E7.4 |

---

## LOC Tracking

### Baseline (E6 Warehouse)

| Category | LOC | Notes |
|----------|-----|-------|
| **Total Warehouse** | 2,700 | Includes all E6 implementation |
| Schema | ~400 | 6 tables + indexes + RLS |
| Business logic | ~1,200 | Receipt, Putaway, Movement, etc. |
| Tests | ~1,100 | 15 requirements, 4 tests each |

**E6 Code Reuse:** 0%

---

### E7.1 Logistics OS (Target)

| Category | Target LOC | Actual LOC | Status |
|----------|------------|------------|--------|
| **Contracts** | 200-300 | **1,304** | ✅ **COMPLETE** |
| Item contracts | 50 | 283 | ✅ |
| Inventory contracts | 60 | 306 | ✅ |
| Movement contracts | 50 | 384 | ✅ |
| Traceability contracts | 40 | 138 | ✅ |
| Location contracts | 30 | 97 | ✅ |
| UOM contracts | 20 | 71 | ✅ |
| Index | - | 25 | ✅ |
| **Domain Logic** | 600-800 | TBD | ⏳ |
| Item domain | 150 | TBD | ⏳ |
| Inventory domain | 200 | TBD | ⏳ |
| Movement domain | 150 | TBD | ⏳ |
| Traceability domain | 100 | TBD | ⏳ |
| Location domain | 50 | TBD | ⏳ |
| UOM domain | 50 | TBD | ⏳ |
| **Persistence** | 400-500 | TBD | ⏳ |
| Schema migration | 150 | TBD | ⏳ |
| Repositories (interfaces) | 100 | TBD | ⏳ |
| Repositories (impl) | 200 | TBD | ⏳ |
| **Tests** | 400-600 | TBD | ⏳ |
| Domain tests | 300 | TBD | ⏳ |
| Repository tests | 150 | TBD | ⏳ |
| Integration tests | 100 | TBD | ⏳ |
| **TOTAL OS** | **1,600-2,200** | **TBD** | ⏳ |

**Note:** Actual LOC may differ from target. Evidence over target.

---

## Bug & Rework Log

**Purpose:** Track issues found during E7.1, categorize, measure rework

| Bug ID | Date | Category | Description | Time to Fix | Status |
|--------|------|----------|-------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | ⏳ |

**Bug Categories:**
- **Contract:** Interface design issue
- **Domain:** Business logic bug
- **Persistence:** Schema/repository bug
- **Test:** Test logic issue
- **Boundary:** OS/Product boundary violation

**Total Rework Time (C₇₁):** TBD

---

## Design Decisions Log

**Purpose:** Document key design choices made during E7.1

### Decision Log

#### D1: [Title TBD]

**Date:** TBD  
**Context:** TBD  
**Options Considered:**
1. TBD
2. TBD

**Decision:** TBD  
**Rationale:** TBD  
**Impact:** TBD

---

## Rejected Capabilities Log

**Purpose:** Document capabilities considered but explicitly rejected

**Format:**
```
Capability: [Name]
Considered for: [OS / Platform / Product]
Rejected because: [Reason]
Evidence: [Reference to analysis]
Date: [When decided]
```

### Rejected from OS

#### Vendor Entity

**Considered for:** Logistics OS  
**Rejected because:** Vendor is procurement-specific, not core Logistics primitive. Would Fulfillment/3PL/Returns need Vendor? NO.  
**Evidence:** E7 Pre-Execution Audit (capability classification matrix)  
**Date:** 2026-08-22  
**Alternative:** Keep in Warehouse Product, or extract to future Procurement OS

---

#### Receipt Entity (GRN)

**Considered for:** Logistics OS  
**Rejected because:** Receipt is warehouse-specific inbound document. Fulfillment uses Order, 3PL uses Inbound Shipment, etc. Not generic.  
**Evidence:** E7 Pre-Execution Audit (capability classification matrix)  
**Date:** 2026-08-22  
**Alternative:** Keep in Warehouse Product

---

#### Bin Entity

**Considered for:** Logistics OS  
**Rejected because:** Bin hierarchy (Zone/Aisle/Rack/Bin) is warehouse-specific. Other Products have different location structures (Pick Location, Slot, Pallet Position, etc.)  
**Evidence:** E7 Pre-Execution Audit (capability classification matrix)  
**Date:** 2026-08-22  
**Alternative:** Keep in Warehouse Product. OS provides generic Location concept.

---

#### Putaway Workflow

**Considered for:** Logistics OS  
**Rejected because:** Putaway is warehouse-specific operation. Other Products have different workflows (Cross-Dock, Directed Put-Away, Drop Ship, etc.)  
**Evidence:** E7 Pre-Execution Audit (capability classification matrix)  
**Date:** 2026-08-22  
**Alternative:** Keep in Warehouse Product

---

#### Receipt Workflow States

**Considered for:** Logistics OS  
**Rejected because:** Receipt states (PENDING_PUTAWAY, PUTAWAY_IN_PROGRESS, COMPLETED) are warehouse-specific. Not applicable to Fulfillment/3PL/Returns.  
**Evidence:** E7 Pre-Execution Audit (capability classification matrix)  
**Date:** 2026-08-22  
**Alternative:** Keep in Warehouse Product. OS provides generic Inventory states (AVAILABLE, RESERVED, ALLOCATED, etc.)

---

#### Discrepancy Tracking (Expected vs Actual Quantity)

**Considered for:** Logistics OS  
**Rejected because:** Discrepancy tracking is warehouse receiving workflow. Other Products may have different variance concepts (ASN variance, cycle count variance, etc.)  
**Evidence:** E7 Pre-Execution Audit (capability classification matrix)  
**Date:** 2026-08-22  
**Alternative:** Keep in Warehouse Product

---

#### Bin Capacity Logic

**Considered for:** Logistics OS  
**Rejected because:** Capacity rules are warehouse-specific operational constraints. Other Products have different capacity concepts (weight limits, volume limits, slot types, etc.)  
**Evidence:** E7 Pre-Execution Audit (capability classification matrix)  
**Date:** 2026-08-22  
**Alternative:** Keep in Warehouse Product

---

### Deferred from E7.1 (Not Rejected, Just Later)

#### State Machine Primitives

**Considered for:** E7.1 (Domain Kernel)  
**Deferred to:** E7.2 (Operational Kernel)  
**Reason:** State machine is operational concern, not domain primitive. E7.1 focuses on domain entities only.  
**Date:** 2026-08-22

---

#### Operational Event Publishing

**Considered for:** E7.1 (Domain Kernel)  
**Deferred to:** E7.2 (Operational Kernel) / E7.4 (Finance Integration)  
**Reason:** Event publishing requires Integration Hub pattern. E7.1 focuses on domain entities only.  
**Date:** 2026-08-22

---

#### Validation Framework

**Considered for:** E7.1 (Domain Kernel)  
**Deferred to:** E7.3 (Rules & Traceability)  
**Reason:** Validation framework is rules layer. E7.1 includes basic domain validation only.  
**Date:** 2026-08-22

---

#### Aggregation Queries (Balance by Location, Item, Tenant)

**Considered for:** E7.1 (Domain Kernel)  
**Deferred to:** E7.3 (Rules & Traceability)  
**Reason:** Aggregation is query optimization, not domain primitive. E7.1 focuses on entity CRUD.  
**Date:** 2026-08-22

---

## Key Insights (Captured During E7.1)

**Purpose:** Document learnings, surprises, architectural insights

### Insight Log

#### I1: [Title TBD]

**Date:** TBD  
**Context:** TBD  
**Insight:** TBD  
**Implication:** TBD

---

## Next Steps Checklist

- [ ] E7.1.2: Start timestamp recorded
- [ ] E7.1.2: Define Item contracts
- [ ] E7.1.2: Define Inventory contracts
- [ ] E7.1.2: Define Movement contracts
- [ ] E7.1.2: Define Traceability contracts
- [ ] E7.1.2: Define Location contracts
- [ ] E7.1.2: Define UOM contracts
- [ ] E7.1.2: Contract LOC measured
- [ ] E7.1.2: Design decisions documented
- [ ] E7.1.2: End timestamp recorded
- [ ] E7.1.2: Duration calculated

---

**STATUS:** E7.1.1 complete, E7.1.2 ready to start  
**NEXT:** Begin contract definition (Item contracts first)  
**PRINCIPLE:** Evidence over targets, boundary before code  
**DATE:** 2026-08-22
