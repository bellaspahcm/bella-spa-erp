# H1 Architecture Gate — Bella Haircut Shop

**Date:** 2026-09-15  
**Status:** 🔒 **APPROVED + CLOSED**  
**Approved:** 2026-09-15 (H1 Final Gate Review - 5/5 PASS)  
**Gate Type:** Architecture Decision Gate  
**Trigger:** H0 Assessment Complete (3.75× leverage, 73.33% reuse)  
**Decision Authority:** Architecture Council

---

## Executive Summary

**H0 Finding:** Bella Haircut Shop requires **8 contract extractions, 5 extensions, 1 build-new** (not 15 greenfield capabilities).

**Strategic Discovery:** Bella Spa contains a **Beauty-domain capability base** (93.3% coverage) trapped in product layer without platform contracts.

**H1 Purpose:** Decide architecture strategy BEFORE Haircut implementation:
1. Extract contracts NOW (8 weeks, clean architecture) vs LATER (4 weeks MVP, technical debt)?
2. Formalize Beauty Services Platform (multi-product reuse) vs keep product-level?
3. Walk-in Queue as platform primitive (cross-vertical) vs product feature?
4. Service Inventory via Logistics Kernel E7 (integrate kernel) vs custom (extend packages)?

**Decision Impact:**
- **Timeline:** 4 weeks (fast MVP) vs 8 weeks (formalized contracts)
- **Platform Maturity:** Formalize 8 reusable contracts vs accumulate technical debt
- **Future Products:** Nail Shop 50% faster launch vs duplicate effort

---

## H1 Decision Points

### Decision 1: Contract Extraction Timing
**Question:** Extract 8 contracts NOW or AFTER Haircut launch?

**Status:** ✅ **APPROVED** (ADR-002)  
**Decision:** Hybrid extraction (4 critical NOW + 4 deferred)  
**ADR:** ADR-002 (Contract Extraction Strategy)  
**Impact:** Timeline, architecture quality, Nail Shop velocity

---

### Decision 2: Beauty Services Platform Formalization
**Question:** Formalize Beauty-domain capability base as platform layer?

**Status:** ✅ **APPROVED** (ADR-003)  
**Decision:** 3-phase strategy (Contracts NOW, Validate with Nail, Platform if validated)  
**ADR:** ADR-003 (Beauty Services Platform)  
**Impact:** Ownership boundaries, contract governance, vertical reusability

---

### Decision 3: Walk-in Queue Scope
**Question:** Build as platform primitive or Haircut product feature?

**Status:** ✅ **APPROVED** (ADR-004)  
**Decision:** Build as product feature (Week 3), extract to contract IF Nail Shop needs (Q1 2027)  
**ADR:** ADR-004 (Walk-in Queue Scope)  
**Impact:** Cross-vertical reuse, queue complexity, extraction timeline

---

### Decision 4: Service Inventory Source
**Question:** Use Logistics Kernel E7 or extend packages.product_usage?

**Status:** ✅ **APPROVED — INVESTIGATION FIRST** (ADR-005)  
**Decision:** Investigate E7 (Week 1, 2-3 days), then decide (E7 integration vs product-level extension)  
**ADR:** ADR-005 (Service Inventory Source)  
**Impact:** Kernel reuse validation, inventory maturity, code volume

---

## H0 Context (Evidence-Based Metrics)

### Final H0 Assessment Results

| Metric | Result | Status |
|--------|--------|--------|
| **Reuse Leverage** | 3.75× | ⚠️ Below 8× target, but evidence-based |
| **Code Reuse %** | 73.33% | ✅ Above 70% target |
| **Must Build** | 1 capability | ✅ 6.7% (Walk-in Queue only) |
| **Contract Extraction** | 8 capabilities | ⚙️ Primary work (53.3%) |
| **Extend** | 5 capabilities | 🔧 Enhancement work (33.3%) |
| **Direct Reuse** | 1 capability | ✅ Service Notes (6.7%) |

### The 8 Capabilities Requiring Contract Extraction

1. **Appointment Booking** - bookings table → IAppointmentEngine contract
2. **Service Catalog** - packages table → IServiceCatalog contract
3. **Service Execution** - session_logs table → ISessionTracking contract
4. **Service History** - Query pattern → IServiceHistory API
5. **Waitlist Management** - Full system → IWaitlistEngine contract (STRONGEST CANDIDATE)
6. **Provider/Stylist Assignment** - auto-assignment-provider.ts → IStaffAssignment contract
7. **Resource Allocation** - booking_resources/beds/rooms → IResourceAllocation contract
8. **Lifecycle Events** - booking_events table → IDomainEvents contract

**Estimated Effort per Contract:** 1 week (interface definition + adapter layer + migration)  
**Total Sequential:** 8 weeks  
**Total Parallelized:** 4-6 weeks (with team capacity)

---

## Decision 1: Contract Extraction Timing

### Option A: Extract NOW (Before Haircut)

**Approach:**
- Week 1-2: Extract 4 high-priority contracts (Waitlist, Assignment, Resource, Appointment)
- Week 3: Extract 4 medium-priority contracts (Catalog, Execution, Events, History)
- Week 4: Build Walk-in Queue Engine
- Week 5-6: Haircut MVP consumes extracted contracts
- Week 7-8: Extend capabilities for Haircut-specific features

**Timeline:** 8 weeks to Haircut MVP

**Pros:**
- ✅ Clean platform contracts from day 1
- ✅ Nail Shop can reuse immediately (no duplicate effort)
- ✅ Forces ownership clarification (Spa vs Beauty Platform)
- ✅ Validates contracts with 2 use cases (Spa + Haircut)
- ✅ Zero technical debt
- ✅ Follows Platform-of-Platforms architecture (ADR-001)

**Cons:**
- ⚠️ Longer time-to-market (8 weeks vs 4 weeks)
- ⚠️ Risk of breaking Spa during extraction (requires careful refactoring)
- ⚠️ Requires Architecture Council approval (contracts = platform change)
- ⚠️ Engineering capacity required (4-6 engineers for parallelization)

**Risks:**
- 🔴 **HIGH:** Breaking Spa during extraction (Mitigation: Feature flags, rigorous testing, rollback plan)
- 🟡 **MEDIUM:** Timeline delay pressure from business (Mitigation: Communicate value, parallelize work)
- 🟢 **LOW:** Contracts need rework after extraction (Mitigation: Validate with 2 use cases)

---

### Option B: Extract LATER (After Haircut Launch)

**Approach:**
- Week 1-2: Haircut MVP uses Spa tables directly (bookings, packages, session_logs, etc.)
- Week 3-4: Build Walk-in Queue Engine, extend capabilities
- **Launch Haircut MVP** (4 weeks)
- Week 5-12: Extract contracts as technical debt remediation (if ever)

**Timeline:** 4 weeks to Haircut MVP

**Pros:**
- ✅ Faster time-to-market (4 weeks vs 8 weeks)
- ✅ Lower risk to Spa (no refactoring during Haircut development)
- ✅ Business value delivered sooner
- ✅ Validates capability reuse before extraction investment

**Cons:**
- ⚠️ Technical debt accumulation (Haircut tightly coupled to Spa tables)
- ⚠️ Nail Shop will duplicate effort (no reusable contracts)
- ⚠️ May never extract (pressure to ship next product)
- ⚠️ Ownership boundaries unclear (Spa owns data, Haircut consumes)
- ⚠️ Contract extraction later = more breaking changes (2 products to migrate)

**Risks:**
- 🔴 **HIGH:** Never extract contracts (Mitigation: Architecture Council mandate)
- 🟡 **MEDIUM:** Nail Shop duplicates work (Mitigation: Reserve extraction time)
- 🟡 **MEDIUM:** Breaking changes when extracting (Mitigation: Versioned contracts)

---

### Option C: Hybrid - Extract Critical 4, Defer 4

**Approach:**
- Week 1-2: Extract **4 critical contracts** (Waitlist, Assignment, Appointment, Resource)
- Week 3-4: Haircut MVP consumes 4 contracts, uses Spa tables for remaining 4
- **Launch Haircut MVP** (4 weeks)
- Week 5-6: Extract remaining 4 contracts (Catalog, Execution, Events, History)

**Timeline:** 4 weeks to MVP, 6 weeks to full formalization

**Pros:**
- ✅ Balanced timeline (4 weeks MVP)
- ✅ Most reusable contracts extracted early (Waitlist is strongest candidate)
- ✅ Validates contract extraction with real use case
- ✅ Reduces technical debt (only 4 capabilities deferred)
- ✅ Nail Shop gets 4 reusable contracts immediately

**Cons:**
- ⚠️ Partial technical debt (4 capabilities still coupled)
- ⚠️ Two-phase migration (complexity)
- ⚠️ Haircut uses mixed approach (contracts + direct tables)

**Risks:**
- 🟡 **MEDIUM:** Phase 2 extraction delayed (Mitigation: Reserve capacity)
- 🟢 **LOW:** Mixed approach causes confusion (Mitigation: Clear documentation)

---

### Recommendation (Decision 1)

**RECOMMENDED: Option C (Hybrid Approach)**

**Rationale:**
1. **Balances Speed + Quality:** 4-week MVP with critical contracts extracted
2. **Validates Extraction:** Tests contract pattern with real use case before full commitment
3. **Prioritizes High-Value:** Waitlist (strongest candidate) extracted first
4. **Reduces Risk:** Smaller blast radius per extraction phase
5. **Enables Nail Shop:** 4 critical contracts reusable immediately (50% coverage)

**Critical Contracts (Extract NOW):**
1. **Waitlist Management** (IWaitlistEngine) - Strongest platform candidate
2. **Staff Assignment** (IStaffAssignment) - Core booking logic
3. **Appointment Booking** (IAppointmentEngine) - Foundation capability
4. **Resource Allocation** (IResourceAllocation) - Multi-resource pattern

**Deferred Contracts (Extract Week 5-6):**
5. Service Catalog (IServiceCatalog)
6. Service Execution (ISessionTracking)
7. Lifecycle Events (IDomainEvents)
8. Service History (IServiceHistory API)

**Timeline:**
- Week 1: Extract Waitlist + Assignment
- Week 2: Extract Appointment + Resource
- Week 3: Build Walk-in Queue
- Week 4: Haircut MVP (consumes 4 contracts + Spa tables)
- **LAUNCH HAIRCUT MVP**
- Week 5-6: Extract remaining 4 contracts
- **COMPLETE FORMALIZATION**

---

## Decision 2: Beauty Services Platform Formalization

### Option A: Formalize NOW as Beauty Services Platform

**Approach:**
- Create `platform/beauty-services/` directory structure
- Extract 8 contracts to `platform/beauty-services/contracts/`
- Move implementation to `platform/beauty-services/engines/`
- Migrate Spa to consume Beauty Services Platform
- Haircut consumes Beauty Services Platform

**Structure:**
```
platform/beauty-services/
├── engines/
│   ├── appointment-engine/
│   ├── waitlist-engine/
│   ├── staff-assignment-engine/
│   ├── resource-allocation-engine/
│   ├── service-catalog-engine/
│   ├── service-execution-engine/
│   └── lifecycle-events-engine/
├── contracts/
│   ├── IAppointmentEngine.ts
│   ├── IWaitlistEngine.ts
│   ├── IStaffAssignment.ts
│   ├── IResourceAllocation.ts
│   └── ...
├── shared-kernel/
│   └── types.ts
└── README.md
```

**Pros:**
- ✅ Clear ownership (Beauty Services Platform team)
- ✅ Formal governance (contract versioning, breaking change process)
- ✅ Multi-product reuse (Spa, Haircut, Nail, Massage)
- ✅ Platform-of-Platforms architecture (ADR-001 pattern)
- ✅ Follows Healthcare Kernel precedent (H1-H12)

**Cons:**
- ⚠️ Only 1 vertical proven (Spa), Haircut not launched yet
- ⚠️ Premature formalization risk (may not fit all beauty verticals)
- ⚠️ Organizational complexity (new platform team required?)
- ⚠️ Migration cost (Spa must migrate to platform contracts)

---

### Option B: Defer Formalization Until Nail Shop (Rule of Three)

**Approach:**
- Extract contracts as "Beauty Capability Contracts" (lightweight, no platform layer)
- Keep implementation in Bella Spa codebase
- Haircut consumes contracts from Spa
- **After Nail Shop validates contracts (3rd vertical):** Formalize as Beauty Services Platform

**Timeline:**
- Now: Extract contracts (lightweight)
- Haircut: Validates contracts (2nd use case)
- Nail Shop: Validates contracts (3rd use case)
- **After Nail Shop:** Formalize platform if contracts stable

**Pros:**
- ✅ Follows Rule of Three (wait for 3 use cases before extracting)
- ✅ Validates contracts with 3 verticals before platform investment
- ✅ Avoids premature abstraction
- ✅ Lower organizational overhead (no new team yet)
- ✅ Easier to iterate on contracts (not formalized)

**Cons:**
- ⚠️ Ownership ambiguous (Spa owns, but Haircut + Nail consume)
- ⚠️ Contract governance unclear (who approves breaking changes?)
- ⚠️ May accumulate technical debt (if never formalized)

---

### Option C: "Beauty Capability Contracts" (Intermediate Layer)

**Approach:**
- Extract contracts to `src/contracts/beauty/` (shared layer, not platform)
- Keep engines in Bella Spa (`src/products/bella-spa/engines/`)
- Haircut + Nail consume shared contracts
- **Future:** Promote to platform if contracts stable and team capacity available

**Structure:**
```
src/contracts/beauty/
├── IAppointmentEngine.ts
├── IWaitlistEngine.ts
├── IStaffAssignment.ts
└── ...

src/products/bella-spa/
├── engines/
│   ├── appointment-engine/  (implements IAppointmentEngine)
│   ├── waitlist-engine/     (implements IWaitlistEngine)
│   └── ...
└── services/

src/products/bella-haircut/
└── services/  (consumes IAppointmentEngine from contracts)
```

**Pros:**
- ✅ Clear contract definition (shared contracts layer)
- ✅ Lightweight governance (contract registry + versioning)
- ✅ Enables reuse without platform overhead
- ✅ Easy to promote to platform later (move engines, not contracts)
- ✅ Follows existing pattern (contracts exist, implementation location flexible)

**Cons:**
- ⚠️ Ownership still ambiguous (Spa owns engines, all consume contracts)
- ⚠️ Not true platform (engines in product layer)
- ⚠️ May delay proper formalization

---

### Recommendation (Decision 2)

**RECOMMENDED: Option C (Beauty Capability Contracts - Intermediate Layer)**

**Rationale:**
1. **Balances Formalization + Flexibility:** Contracts defined, implementation location deferred
2. **Follows Rule of Three:** Wait for 3 verticals (Spa, Haircut, Nail) before platform
3. **Enables Reuse:** Haircut + Nail can consume contracts immediately
4. **Reduces Risk:** Avoid premature platform investment
5. **Easy Migration Path:** Promote to `platform/beauty-services/` when ready

**Timeline:**
- **Now (H1):** Extract contracts to `src/contracts/beauty/`
- **Haircut (Week 4):** Validates contracts (2nd use case)
- **Nail Shop (Quarter 2):** Validates contracts (3rd use case)
- **H2 Gate (After Nail):** Decide platform formalization

**Governance:**
- Contract Registry: Register beauty contracts with versioning
- Breaking Change Process: Require 2+ vertical approval for breaking changes
- Ownership: Architecture Council (interim), Beauty Platform Team (future)

**Promotion Criteria (for H2 decision):**
- ✅ 3+ verticals consuming contracts (Rule of Three)
- ✅ Contracts stable (no breaking changes in 2 quarters)
- ✅ Team capacity for platform governance
- ✅ Organizational need (dedicated Beauty Platform team)

---

## Decision 3: Walk-in Queue Scope

### Context

**H0 Finding:** Walk-in Queue is the **only genuine gap** (0% reuse).

**Requirement:** Real-time queue management for walk-in customers (not appointment-based).

**Question:** Build as platform primitive (reusable across verticals) or Haircut product feature?

---

### Option A: Platform Primitive (Cross-Vertical Queue Engine)

**Approach:**
- Build generic `QueueEngine` in Platform Core
- Support multiple queue types (walk-in, ER triage, retail checkout, restaurant waiting)
- Haircut consumes QueueEngine with beauty-specific configuration

**Structure:**
```
platform/core/queue-engine/
├── engines/
│   ├── queue-manager.ts       (FIFO, priority, time-based)
│   ├── position-tracker.ts    (real-time position updates)
│   └── notification.ts        (notify when ready)
├── contracts/
│   └── IQueueEngine.ts
└── README.md

products/bella-haircut/
└── services/
    └── walkin-queue.service.ts  (configures QueueEngine for haircut)
```

**Pros:**
- ✅ Cross-vertical reuse (Healthcare ER, Retail Checkout, Restaurant)
- ✅ Platform primitive (generic queue capability)
- ✅ Mature queue algorithms (FIFO, priority, time-weighted)
- ✅ Future-proof (any vertical needing queue reuses)

**Cons:**
- ⚠️ No other vertical currently needs queue (premature extraction)
- ⚠️ Generic queue may not fit all use cases (ER triage ≠ haircut walk-in)
- ⚠️ Longer implementation (generic + configurable)
- ⚠️ Platform Core Freeze may block (if Core frozen)

---

### Option B: Haircut Product Feature (Extract Later if Reused)

**Approach:**
- Build Walk-in Queue as Haircut product feature
- Haircut-specific implementation (stylist availability, station allocation)
- **If Nail Shop needs queue:** Extract to platform then

**Structure:**
```
products/bella-haircut/
├── engines/
│   └── walkin-queue-engine/
│       ├── queue-manager.ts       (haircut-specific)
│       ├── position-tracker.ts    (stylist + station)
│       └── notification.ts        (SMS/app notification)
└── services/
    └── walkin-queue.service.ts
```

**Timeline:**
- Week 3: Build Walk-in Queue (Haircut-specific)
- Week 4: Integrate with Haircut MVP
- **Nail Shop:** Check if queue needed
- **If YES:** Extract to platform (Week 8+)

**Pros:**
- ✅ Faster implementation (no generic abstraction)
- ✅ Haircut-specific optimization (stylist skills, station availability)
- ✅ Follows Rule of Three (wait for 2nd use case before extracting)
- ✅ No Platform Core dependency (Haircut owns queue)

**Cons:**
- ⚠️ Duplication risk (if Nail Shop builds own queue)
- ⚠️ Extraction cost later (if promoted to platform)

---

### Option C: Investigate Healthcare ER Queue First

**Approach:**
- **Before building:** Check if Healthcare Kernel has ER patient queue
- **If YES:** Evaluate reusability for Haircut walk-in queue
- **If NO or incompatible:** Build Haircut product feature (Option B)

**Investigation Required:**
- Search Healthcare Kernel for `patient_queue`, `triage_queue`, `waiting_queue`
- Analyze: Does ER queue pattern fit haircut walk-in use case?
- Decision: Reuse Healthcare queue abstraction vs build new

**Pros:**
- ✅ Leverage existing queue implementation (if available)
- ✅ Validate cross-vertical queue reuse (Healthcare → Beauty)
- ✅ Test Platform-of-Platforms pattern

**Cons:**
- ⚠️ Investigation delay (1-2 days)
- ⚠️ Healthcare queue may be too medical-specific (triage severity ≠ stylist availability)

---

### Recommendation (Decision 3)

**RECOMMENDED: Option B (Haircut Product Feature, Extract If Reused)**

**Rationale:**
1. **Follows Rule of Three:** No other vertical currently needs walk-in queue
2. **Faster Implementation:** No generic abstraction overhead (2 weeks vs 3 weeks)
3. **Optimized for Haircut:** Stylist skills, station allocation, real-time capacity
4. **Low Duplication Risk:** Healthcare has ER queue (different domain), Retail/Restaurant not in scope
5. **Easy Extraction Path:** If Nail Shop needs queue, extract then (2nd use case)

**Implementation Plan:**
- Week 3: Build `walkin-queue-engine/` in Haircut product
- Features: FIFO + VIP priority, position tracking, real-time updates, notification system
- Integration: Capacity Management (slot availability), Staff Assignment (stylist availability)
- Database: `walkin_queue` table (customer_id, arrival_time, position, estimated_wait, status)

**Extraction Trigger (for future H2 decision):**
- IF Nail Shop needs walk-in queue (2nd use case)
- OR Restaurant/Retail vertical needs customer queue (different domain, needs investigation)
- THEN extract to platform as generic QueueEngine

**Alternative Investigation (Optional, Week 1):**
- Quick search Healthcare Kernel for existing queue implementation
- If reusable pattern found → leverage abstraction
- If not → proceed with Haircut product feature

---

## Decision 4: Service Inventory Source

### Context

**H0 Finding:** Service Inventory is **NOT must-build** (Spa has `packages.product_usage` JSONB).

**Question:** Should Haircut:
- A) Use Logistics Kernel E7 (Domain, Operational, Rules & Traceability)?
- B) Extend `packages.product_usage` (product-level inventory)?

**Use Case:** Track service-level inventory (shampoo per haircut, gel per styling, towels, etc.).

---

### Option A: Integrate Logistics Kernel E7

**Approach:**
- Haircut consumes Logistics Kernel E7 (frozen, mature kernel)
- E7.1 Domain Kernel: InventoryItem, Movement (366 tests)
- E7.2 Operational Kernel: Stock levels, alerts (73 tests)
- E7.3 Rules & Traceability: Deduction rules, audit trail (108 tests)

**Implementation:**
```typescript
// Haircut service consumes E7 contracts
import { IInventoryDomain } from 'platform/logistics/contracts';

export class HaircutExecutionService {
  constructor(private inventory: IInventoryDomain) {}
  
  async completeHaircut(sessionId: string) {
    // Deduct inventory via E7
    await this.inventory.deductInventory({
      items: [
        { sku: 'SHAMPOO-001', quantity: 30 },  // 30ml shampoo
        { sku: 'GEL-002', quantity: 15 },      // 15ml gel
        { sku: 'TOWEL-003', quantity: 1 }      // 1 towel
      ],
      reason: 'Service Execution',
      reference: sessionId
    });
  }
}
```

**Pros:**
- ✅ Mature kernel (547 regression tests pass)
- ✅ Full inventory features (stock levels, reorder, alerts, traceability)
- ✅ Audit trail built-in (Rules & Traceability E7.3)
- ✅ Cross-vertical reuse validation (Logistics → Beauty)
- ✅ Zero new inventory code (10% integration only)

**Cons:**
- ⚠️ Logistics E7 is FROZEN (requires Architecture Change Request to modify)
- ⚠️ E7 designed for warehouse inventory (InventoryItem, Movement) - may be over-engineered for service inventory
- ⚠️ Service inventory semantics may not fit E7 (shampoo bottle vs per-service usage)
- ⚠️ Investigation required: Does E7 support service-level deductions (30ml per service vs whole bottle)?

---

### Option B: Extend packages.product_usage (Product-Level)

**Approach:**
- Extend existing `packages.product_usage` JSONB column
- Add inventory deduction logic in Haircut service layer
- Track stock levels in new `service_inventory` table (simple)

**Implementation:**
```typescript
// Extend packages table
ALTER TABLE packages 
ADD COLUMN product_usage JSONB DEFAULT '[]';

// Example product_usage structure
{
  "products": [
    {"sku": "SHAMPOO-001", "quantity_per_service": 30, "unit": "ml"},
    {"sku": "GEL-002", "quantity_per_service": 15, "unit": "ml"}
  ]
}

// New service_inventory table
CREATE TABLE service_inventory (
  id UUID PRIMARY KEY,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  current_stock NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  reorder_threshold NUMERIC,
  last_restock_date TIMESTAMPTZ
);

// Haircut service
export class HaircutExecutionService {
  async completeHaircut(sessionId: string, packageId: string) {
    const pkg = await this.packages.findById(packageId);
    const products = pkg.product_usage.products;
    
    // Deduct inventory
    for (const product of products) {
      await this.inventory.deduct(product.sku, product.quantity_per_service);
    }
  }
}
```

**Pros:**
- ✅ Lightweight (50% new code, simple inventory tracking)
- ✅ Haircut-specific (no generic abstraction overhead)
- ✅ No frozen kernel dependency (full control)
- ✅ Quick implementation (1 week vs 2 weeks investigation + integration)

**Cons:**
- ⚠️ Duplicate inventory logic (if Nail Shop needs inventory, must build again)
- ⚠️ Missing features (no traceability, no audit trail, basic reorder alerts)
- ⚠️ Not reusable (Haircut-specific implementation)

---

### Option C: Investigate E7 Applicability First (Hybrid)

**Approach:**
1. **Week 1:** Investigate Logistics Kernel E7 applicability
   - Can E7 handle service-level deductions (30ml shampoo per service)?
   - Does E7 support "virtual inventory" (per-service usage vs physical stock)?
   - Is E7 contract flexible enough for beauty service inventory?

2. **Decision:**
   - **IF E7 fits:** Integrate E7 (Option A) - 10% new code
   - **IF E7 doesn't fit:** Extend packages.product_usage (Option B) - 50% new code

**Investigation Questions:**
- Does `InventoryItem` support fractional units (30ml vs 1 bottle)?
- Does `Movement` support service deductions (vs warehouse movements)?
- Can E7 handle virtual inventory (estimated usage vs actual stock)?
- Is E7.2 Operational Kernel flexible for service-level alerts?

**Pros:**
- ✅ Evidence-based decision (not assumption)
- ✅ Leverage mature kernel if applicable (547 tests)
- ✅ Fallback to simple solution if E7 doesn't fit

**Cons:**
- ⚠️ Investigation delay (2-3 days)
- ⚠️ May reveal E7 not applicable (wasted investigation time)

---

### Recommendation (Decision 4)

**RECOMMENDED: Option C (Investigate E7 First, Then Decide)**

**Rationale:**
1. **Validate Cross-Vertical Reuse:** Test if Logistics Kernel E7 can serve Beauty vertical (Platform-of-Platforms validation)
2. **Leverage Mature Kernel:** 547 tests, frozen, production-grade (if applicable)
3. **Evidence-Based Decision:** Don't assume E7 fits without investigation
4. **Low Investigation Cost:** 2-3 days to answer applicability questions
5. **Clear Fallback:** If E7 doesn't fit, extend packages.product_usage (well-understood option)

**Investigation Plan (Week 1, 2-3 days):**

**Step 1: E7 Code Inspection**
- Read E7.1 Domain Kernel contracts (IInventoryDomain, IMovement)
- Check: Fractional units, service-level deductions, virtual inventory support
- Evidence: Contract interfaces, entity schemas, test cases

**Step 2: Architecture Council Consultation**
- Present use case: Service inventory (30ml shampoo per haircut) vs warehouse inventory (bottles)
- Question: Is E7 designed for this? Or only physical inventory?
- Decision: Formal approval to integrate E7 OR recommendation to use product-level

**Step 3: Prototype Integration (if E7 applicable)**
- Create proof-of-concept: Haircut service → E7 inventory deduction
- Validate: Can E7 handle service semantics?
- Timeline: 1 day prototype

**Decision Point (End of Week 1):**
- **IF E7 applicable:** Proceed with E7 integration (Option A)
  - Timeline: Week 2-3 integration, 10% new code
- **IF E7 not applicable:** Proceed with packages.product_usage extension (Option B)
  - Timeline: Week 2 implementation, 50% new code

**Fallback (If Investigation Blocked):**
- Default to Option B (extend packages.product_usage)
- Document E7 investigation as future work

---

## Decision Timeline

### Week 1: Architecture Gate + Investigation

**Day 1-2: Architecture Council Review**
- Present H1 Architecture Gate document
- Review 4 decision points
- Approve/reject recommendations

**Day 3-5: Logistics E7 Investigation**
- Inspect E7 contracts + schemas
- Consult Architecture Council
- Prototype service inventory integration
- **Decision:** E7 applicable? YES/NO

**Output:**
- ✅ 4 decisions approved (or revised)
- ✅ E7 applicability determined
- ✅ Week 2-8 roadmap locked

---

### Week 2-8: Implementation (If Hybrid Approach Approved)

**Week 2: Contract Extraction (Critical 4)**
- Day 1-2: Extract Waitlist (IWaitlistEngine) + Assignment (IStaffAssignment)
- Day 3-4: Extract Appointment (IAppointmentEngine) + Resource (IResourceAllocation)
- Day 5: Testing + migration (Spa consumes contracts)

**Week 3: Walk-in Queue + Inventory**
- Day 1-3: Build Walk-in Queue Engine (Haircut product feature)
- Day 4-5: Implement Service Inventory (E7 integration OR packages.product_usage extension)

**Week 4: Haircut MVP**
- Day 1-2: Haircut services consume 4 extracted contracts
- Day 3-4: Extend capabilities (Appointment Status, Promo, Capacity)
- Day 5: Integration testing
- **Output:** 🚀 Haircut MVP Launch

**Week 5-6: Remaining Contract Extraction**
- Extract 4 deferred contracts (Catalog, Execution, Events, History)
- Migrate Haircut from Spa tables to contracts
- **Output:** ✅ 8 contracts extracted, Beauty Capability Contracts complete

**Week 7-8: Polish + Documentation**
- Conflict Detection extension (haircut-specific rules)
- Resource Query feature taxonomy
- Contract documentation (usage examples, migration guides)
- **Output:** 📚 Beauty Capability Contracts formalized

---

## Success Criteria

**Architecture Council will approve H1 if:**

1. ✅ **Decision 1 (Contract Extraction):** Clear timeline + risk mitigation
2. ✅ **Decision 2 (Platform Formalization):** Governance model defined
3. ✅ **Decision 3 (Walk-in Queue):** Scope justified (platform vs product)
4. ✅ **Decision 4 (Service Inventory):** Investigation plan OR decision
5. ✅ **Roadmap:** Week 2-8 implementation plan locked
6. ✅ **Risks:** Identified + mitigated (Spa breakage, timeline, capacity)

**Post-H1 Deliverables:**
- 4 ADRs (ADR-002, ADR-003, ADR-004, ADR-005)
- Contract extraction roadmap (8 contracts, phased)
- Implementation plan (Week 2-8 detailed tasks)
- Risk register + mitigation plan

---

## Risk Register

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **Contract extraction breaks Spa** | 🔴 Critical | Medium | Feature flags, rigorous testing, rollback plan, phased extraction (4 critical first) |
| **Timeline delay (8 weeks → 10 weeks)** | 🟡 High | Medium | Parallelize extraction, prioritize critical 4, defer non-critical |
| **E7 investigation inconclusive** | 🟡 High | Low | Fallback to packages.product_usage (Option B), 3-day time limit |
| **Haircut MVP incomplete features** | 🟡 High | Low | MVP scope clear (walk-in queue + 4 contracts), defer polish |
| **Nail Shop timeline pressure** | 🟡 High | High | Communicate Beauty Capability Contracts value, reserve extraction time |
| **Platform formalization rejected** | 🟢 Medium | Low | Accept intermediate layer (Beauty Capability Contracts), defer platform decision |
| **Walk-in Queue complexity underestimated** | 🟢 Medium | Medium | Prototype in Week 1 (optional), timebox to 2 weeks |

---

## Approval

**Approval Required:**
- [ ] Architecture Council (4 decisions)
- [ ] Product Team (timeline acceptance)
- [ ] Engineering Team (capacity confirmation)

**Approval Date:** TBD  
**Next Review:** After Haircut MVP (Week 4) - validate contracts

---

**H1 Status:** 🟡 **AWAITING ARCHITECTURE COUNCIL DECISION**

**Next Steps:**
1. Architecture Council review (Week 1, Day 1-2)
2. Create 4 ADRs (ADR-002, ADR-003, ADR-004, ADR-005)
3. E7 investigation (Week 1, Day 3-5)
4. Lock implementation roadmap (Week 1, end)
5. Begin contract extraction (Week 2, if approved)

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-09-15  
**Related Documents:** H0_FINAL_SEAL.md, ADR-001-CORE-KERNEL-BOUNDARY.md

