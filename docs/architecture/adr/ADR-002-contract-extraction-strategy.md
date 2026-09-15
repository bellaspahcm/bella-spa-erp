# ADR-002: Beauty Capability Contract Extraction Strategy

**Status:** ✅ **APPROVED**  
**Date:** 2026-09-15  
**Approved:** 2026-09-15 (H1 Final Gate Review)  
**Decision Makers:** Architecture Council, Platform Team, Product Team  
**Context:** H1 Architecture Gate - Bella Haircut Shop requires 8 contract extractions from Bella Spa

---

## Context

### Background

**H0 Assessment Finding:** Bella Haircut Shop requires **8 contract extractions** (53.3% of work) from existing Bella Spa implementations, not 15 greenfield capabilities.

**Strategic Discovery:** Bella Spa contains a **Beauty-domain capability base** with 93.3% coverage for Haircut requirements, but implementations are trapped in product layer without platform contracts.

**The 8 Capabilities Requiring Contract Extraction:**

1. **Appointment Booking** - `bookings` table → `IAppointmentEngine` contract
2. **Service Catalog** - `packages` table → `IServiceCatalog` contract
3. **Service Execution** - `session_logs` table → `ISessionTracking` contract
4. **Service History** - Query pattern → `IServiceHistory` API
5. **Waitlist Management** - Full system → `IWaitlistEngine` contract (STRONGEST CANDIDATE)
6. **Provider/Stylist Assignment** - `auto-assignment-provider.ts` → `IStaffAssignment` contract
7. **Resource Allocation** - `booking_resources/beds/rooms/equipment` → `IResourceAllocation` contract
8. **Lifecycle Events** - `booking_events` table → `IDomainEvents` contract

**Problem:** Should we extract contracts BEFORE Haircut (8 weeks, clean architecture) or AFTER Haircut launch (4 weeks MVP, technical debt)?

---

## Decision

**We adopt a HYBRID PHASED CONTRACT EXTRACTION STRATEGY:**

### Phase 1: Extract Critical 4 Contracts (Week 1-2)

**Extract NOW before Haircut MVP:**
1. **Waitlist Management** → `IWaitlistEngine` (Strongest platform candidate)
2. **Staff Assignment** → `IStaffAssignment` (Core booking logic)
3. **Appointment Booking** → `IAppointmentEngine` (Foundation capability)
4. **Resource Allocation** → `IResourceAllocation` (Multi-resource pattern)

**Timeline:** 2 weeks  
**Deliverable:** 4 contracts in `src/contracts/beauty/`, Spa migrated to contracts

---

### Phase 2: Haircut MVP with Mixed Approach (Week 3-4)

**Haircut consumes:**
- ✅ 4 extracted contracts (Waitlist, Assignment, Appointment, Resource)
- ⚠️ 4 Spa tables directly (packages, session_logs, booking_events, service history queries)

**Timeline:** 2 weeks  
**Deliverable:** 🚀 Haircut MVP Launch (4 weeks from H1 approval)

---

### Phase 3: Extract Remaining 4 Contracts (Week 5-6)

**Extract AFTER Haircut MVP validates critical contracts:**
5. **Service Catalog** → `IServiceCatalog`
6. **Service Execution** → `ISessionTracking`
7. **Lifecycle Events** → `IDomainEvents`
8. **Service History** → `IServiceHistory` API

**Timeline:** 2 weeks  
**Deliverable:** ✅ 8 contracts complete, Haircut migrated from Spa tables to contracts

---

### Total Timeline

- **4 weeks to Haircut MVP** (Phase 1 + Phase 2)
- **6 weeks to full contract formalization** (Phase 1 + Phase 2 + Phase 3)

---

## Rationale

### Why Hybrid Over Full Extraction NOW?

**Option A (Full Extraction NOW) Rejected:**
- ⚠️ 8 weeks to MVP (business pressure)
- ⚠️ Higher risk to Spa (8 contracts extracted simultaneously)
- ⚠️ Unvalidated contracts (no real use case before full extraction)

**Option B (Extract LATER) Rejected:**
- ⚠️ 4 weeks MVP but accumulates technical debt
- ⚠️ Nail Shop will duplicate effort (no reusable contracts)
- ⚠️ May never extract (pressure to ship next product)
- ⚠️ Breaking changes when extracting (2 products to migrate)

**Option C (HYBRID) Selected:**
- ✅ **Balanced timeline:** 4 weeks to MVP, 6 weeks to full formalization
- ✅ **Validates extraction:** Tests contract pattern with real Haircut use case
- ✅ **Prioritizes high-value:** Waitlist (strongest candidate) extracted first
- ✅ **Reduces risk:** Smaller blast radius per extraction phase (4 contracts vs 8)
- ✅ **Enables Nail Shop:** 4 critical contracts reusable immediately (50% coverage)
- ✅ **Evidence-based:** Phase 3 informed by Phase 1-2 learnings

---

### Why These 4 Critical Contracts?

#### 1. Waitlist Management (IWaitlistEngine) - STRONGEST CANDIDATE

**Evidence:**
- **Complete implementation:** `waitlist_entries` table, `waitlist-service.ts`, `waitlist-management-provider.ts`, notification system
- **Platform-ready design:** Priority scoring (tier + value + wait_time), position tracking, status lifecycle
- **Mature logic:** 547 lines of business logic, decision engine integrated
- **Reusability:** 95% of logic is domain-agnostic (only 5% Spa-specific configuration)

**Why extract NOW:**
- Strongest platform candidate (highest reuse potential)
- Nail Shop will need waitlist (proven demand)
- Complex implementation (better to extract early, validate with Haircut)
- Foundation for booking flow (Appointment depends on Waitlist)

---

#### 2. Staff Assignment (IStaffAssignment) - CORE BOOKING LOGIC

**Evidence:**
- **Decision engine:** `auto-assignment-provider.ts` (200 lines)
- **Scoring algorithm:** workload + rating + availability + skill_match
- **Filtering logic:** eligible, available, capacity checks
- **Integration:** `booking-decision.service.ts` uses AutoAssignmentProvider

**Why extract NOW:**
- Core booking capability (Appointment Booking depends on this)
- Generic pattern (KTV → Stylist, workload scoring universal)
- Haircut needs skill-based assignment (extension of existing logic)
- Decision engine framework is platform-ready

---

#### 3. Appointment Booking (IAppointmentEngine) - FOUNDATION CAPABILITY

**Evidence:**
- **Database:** `bookings` table (20+ columns, mature schema)
- **State machine:** inquiry → deposit_pending → booked → in_progress → completed → cancelled
- **Audit trail:** `booking_events` table tracks all state transitions
- **Integration:** Connects Waitlist, Assignment, Resource, Execution

**Why extract NOW:**
- Foundation capability (many other contracts depend on this)
- Complex state machine (better to extract early)
- Haircut's core functionality (appointment = booking)
- Nail Shop will reuse immediately (high-value extraction)

---

#### 4. Resource Allocation (IResourceAllocation) - MULTI-RESOURCE PATTERN

**Evidence:**
- **Database:** `booking_resources` (generic), `beds`, `rooms`, `equipment` (specific)
- **Pattern:** Generic resource type + specific resource tables
- **Integration:** `bookings.assigned_bed_id`, `assigned_room_id`, `required_equipment_ids` (JSONB)
- **Conflict detection:** Indexes for resource conflict detection

**Why extract NOW:**
- Multi-resource pattern reusable (bed → station, room → floor section, equipment → tools)
- Haircut needs station allocation (core requirement)
- Generic abstraction exists (70% reusable, 30% Haircut-specific config)
- Nail Shop will need resource allocation (stations, equipment)

---

### Why Defer These 4 Contracts to Phase 3?

#### 5. Service Catalog (IServiceCatalog) - SIMPLER EXTRACTION

**Rationale:**
- Simpler schema (`packages` table, straightforward CRUD)
- Haircut can use `packages` table directly (low coupling risk)
- Less critical for MVP (catalog can be managed via Spa initially)
- Extraction is fast (1 day) - can defer without major cost

---

#### 6. Service Execution (ISessionTracking) - LOW HAIRCUT COUPLING

**Rationale:**
- `session_logs` table is simple (session tracking)
- Haircut can write to `session_logs` directly (minimal logic)
- No complex business rules (just status tracking)
- Fast extraction (1 day) - defer to Phase 3 without risk

---

#### 7. Lifecycle Events (IDomainEvents) - CROSS-CUTTING CONCERN

**Rationale:**
- `booking_events` is audit trail (not core business logic)
- Haircut can write events to `booking_events` directly
- Event schema formalization can happen after MVP
- Platform-wide event system may be needed (defer decision)

---

#### 8. Service History (IServiceHistory) - QUERY PATTERN ONLY

**Rationale:**
- Not a separate capability (query pattern over bookings + session_logs)
- Haircut can use same query pattern (no extraction needed initially)
- API formalization is documentation work (minimal code)
- Defer to Phase 3 as documentation task

---

## Contract Structure

### Location: `src/contracts/beauty/`

**NOT `platform/beauty-services/` yet** - See ADR-003 for platform formalization decision (Rule of Three: wait for Nail Shop).

```
src/contracts/beauty/
├── IAppointmentEngine.ts
├── IWaitlistEngine.ts
├── IStaffAssignment.ts
├── IResourceAllocation.ts
├── IServiceCatalog.ts           (Phase 3)
├── ISessionTracking.ts          (Phase 3)
├── IDomainEvents.ts             (Phase 3)
├── IServiceHistory.ts           (Phase 3)
├── types/
│   ├── appointment.types.ts
│   ├── waitlist.types.ts
│   ├── assignment.types.ts
│   └── resource.types.ts
└── README.md
```

**Implementations remain in Bella Spa** (engines in product layer):

```
src/products/bella-spa/
├── engines/
│   ├── appointment-engine/      (implements IAppointmentEngine)
│   ├── waitlist-engine/         (implements IWaitlistEngine)
│   ├── staff-assignment-engine/ (implements IStaffAssignment)
│   └── resource-allocation-engine/ (implements IResourceAllocation)
└── services/
    └── booking.service.ts       (consumes contracts)
```

**Haircut consumes contracts:**

```
src/products/bella-haircut/
└── services/
    ├── haircut-booking.service.ts    (uses IAppointmentEngine)
    ├── walkin-queue.service.ts       (uses IWaitlistEngine)
    ├── stylist-assignment.service.ts (uses IStaffAssignment)
    └── station-allocation.service.ts (uses IResourceAllocation)
```

---

## Implementation Plan

### Phase 1: Week 1-2 (Extract Critical 4)

#### Week 1: Waitlist + Assignment

**Day 1-2: Extract Waitlist Contract**
1. Define `IWaitlistEngine` interface (15 methods)
2. Define types: `WaitlistEntry`, `WaitlistPriority`, `WaitlistStatus`, `NotificationPreference`
3. Move `waitlist-service.ts` → `bella-spa/engines/waitlist-engine/`
4. Implement adapter: `WaitlistEngineAdapter implements IWaitlistEngine`
5. Register contract in Contract Registry (version 1.0.0)

**Day 3-4: Extract Assignment Contract**
1. Define `IStaffAssignment` interface (10 methods)
2. Define types: `AssignmentCriteria`, `StaffAvailability`, `AssignmentScore`, `AssignmentResult`
3. Move `auto-assignment-provider.ts` → `bella-spa/engines/staff-assignment-engine/`
4. Implement adapter: `StaffAssignmentEngineAdapter implements IStaffAssignment`
5. Register contract in Contract Registry (version 1.0.0)

**Day 5: Testing + Spa Migration**
1. Unit tests: Contract interfaces + adapters
2. Integration tests: Spa services consume contracts (not direct tables)
3. Migration: Update Spa services to use `IWaitlistEngine`, `IStaffAssignment`
4. Regression tests: Spa functionality unchanged (contract abstraction only)

---

#### Week 2: Appointment + Resource

**Day 1-2: Extract Appointment Contract**
1. Define `IAppointmentEngine` interface (20 methods - complex state machine)
2. Define types: `Appointment`, `AppointmentStatus`, `StatusTransition`, `AppointmentEvent`
3. Move `booking-decision.service.ts` → `bella-spa/engines/appointment-engine/`
4. Implement adapter: `AppointmentEngineAdapter implements IAppointmentEngine`
5. Register contract in Contract Registry (version 1.0.0)

**Day 3-4: Extract Resource Contract**
1. Define `IResourceAllocation` interface (12 methods)
2. Define types: `Resource`, `ResourceType`, `AllocationRequest`, `AllocationResult`, `ConflictCheck`
3. Move resource logic → `bella-spa/engines/resource-allocation-engine/`
4. Implement adapter: `ResourceAllocationEngineAdapter implements IResourceAllocation`
5. Register contract in Contract Registry (version 1.0.0)

**Day 5: Testing + Spa Migration**
1. Unit tests: Appointment + Resource contracts
2. Integration tests: End-to-end booking flow (Waitlist → Assignment → Appointment → Resource)
3. Migration: Update Spa services to use all 4 contracts
4. Regression tests: 547 Spa tests pass (no functionality change)

---

### Phase 2: Week 3-4 (Haircut MVP)

#### Week 3: Walk-in Queue + Inventory + Core Services

**Day 1-3: Build Walk-in Queue Engine** (NEW capability - see ADR-004)
- Haircut product feature (not platform, per ADR-004)
- Database: `walkin_queue` table
- Logic: FIFO + VIP priority, position tracking, real-time updates

**Day 4-5: Service Inventory** (see ADR-005)
- IF E7 applicable: Integrate Logistics Kernel E7
- ELSE: Extend `packages.product_usage`

**Parallel: Haircut Core Services**
- `haircut-booking.service.ts` consumes `IAppointmentEngine`
- `walkin-queue.service.ts` consumes `IWaitlistEngine`
- `stylist-assignment.service.ts` consumes `IStaffAssignment`
- `station-allocation.service.ts` consumes `IResourceAllocation`

---

#### Week 4: Extensions + Integration + Launch

**Day 1-2: Capability Extensions**
- Appointment Status: Haircut states (scheduled → arrived → in_progress → completed)
- Capacity Management: Real-time capacity (walk-in queue integration)
- Conflict Detection: Station-specific rules
- Voucher/Promo: Redemption tracking (extend promotions table)

**Day 3-4: Integration + Testing**
- End-to-end flows: Walk-in → Queue → Assignment → Station → Execution
- Appointment flows: Book → Assign → Arrive → Complete
- Waitlist flows: Add → Notify → Convert
- Integration tests: 4 contracts + Walk-in Queue + Extensions

**Day 5: Haircut MVP Launch Preparation**
- Documentation: API docs, user guides
- Deployment: Feature flags, rollout plan
- Monitoring: Contract usage metrics, error tracking

**🚀 HAIRCUT MVP LAUNCH** (End of Week 4)

---

### Phase 3: Week 5-6 (Extract Remaining 4)

#### Week 5: Catalog + Execution

**Day 1-2: Extract Service Catalog Contract**
1. Define `IServiceCatalog` interface (8 methods - CRUD + query)
2. Define types: `Service`, `ServiceCategory`, `ServicePricing`, `ServiceAvailability`
3. Move packages logic → `bella-spa/engines/service-catalog-engine/`
4. Migrate Haircut from `packages` table to `IServiceCatalog` contract

**Day 3-4: Extract Session Tracking Contract**
1. Define `ISessionTracking` interface (10 methods)
2. Define types: `Session`, `SessionStatus`, `SessionCompletion`, `SessionNote`
3. Move session_logs logic → `bella-spa/engines/session-tracking-engine/`
4. Migrate Haircut from `session_logs` table to `ISessionTracking` contract

**Day 5: Testing**
- Unit tests: Catalog + Execution contracts
- Integration tests: Haircut uses 6 contracts (4 critical + 2 new)
- Regression tests: Spa + Haircut functionality unchanged

---

#### Week 6: Events + History + Documentation

**Day 1-2: Extract Lifecycle Events Contract**
1. Define `IDomainEvents` interface (5 methods - publish, subscribe, query)
2. Define types: `DomainEvent`, `EventType`, `EventPayload`, `EventMetadata`
3. Formalize event schema registry (booking events, waitlist events, etc.)
4. Migrate Haircut from `booking_events` table to `IDomainEvents` contract

**Day 3: Extract Service History API**
1. Define `IServiceHistory` interface (6 methods - query patterns)
2. Document query patterns (customer history, session history, appointment history)
3. Create API endpoints (REST/GraphQL) for service history
4. Migrate Haircut to use `IServiceHistory` API (not raw SQL queries)

**Day 4-5: Documentation + Contract Governance**
- Contract documentation: Usage examples, migration guides, versioning rules
- Contract Registry: 8 contracts registered, versioned (v1.0.0)
- Governance: Breaking change process, deprecation policy, approval workflow
- Metrics: Contract usage tracking, performance baselines

**✅ 8 CONTRACTS COMPLETE** (End of Week 6)

---

## Migration Strategy

### Spa Migration (Phase 1, Week 1-2)

**Goal:** Spa consumes contracts instead of direct database access.

**Approach:**
1. **Preserve existing tests:** 547 Spa regression tests must pass after migration
2. **Feature flags:** Gradual rollout (contract implementation vs old implementation)
3. **Adapter pattern:** Minimal changes to existing services (inject contract interface)
4. **Rollback plan:** Keep old implementation active during migration (feature flag)

**Example Migration:**

```typescript
// BEFORE (Spa service uses direct database access)
export class BookingService {
  constructor(private db: Database) {}
  
  async createBooking(data: BookingData) {
    return this.db.bookings.insert(data);  // Direct DB access
  }
}

// AFTER (Spa service uses contract)
export class BookingService {
  constructor(private appointmentEngine: IAppointmentEngine) {}
  
  async createBooking(data: BookingData) {
    return this.appointmentEngine.createAppointment(data);  // Via contract
  }
}
```

**Rollback:** If contract migration breaks Spa, flip feature flag to use old implementation.

---

### Haircut Consumption (Phase 2, Week 3-4)

**Goal:** Haircut consumes 4 critical contracts + 4 Spa tables directly.

**Mixed Approach:**
- ✅ Uses contracts: Waitlist, Assignment, Appointment, Resource
- ⚠️ Uses Spa tables: packages, session_logs, booking_events, service history queries

**Example:**

```typescript
export class HaircutBookingService {
  constructor(
    // Via contracts (Phase 1 extracted)
    private appointmentEngine: IAppointmentEngine,
    private waitlistEngine: IWaitlistEngine,
    private assignmentEngine: IStaffAssignment,
    private resourceEngine: IResourceAllocation,
    
    // Direct DB access (Phase 3 not yet extracted)
    private db: Database
  ) {}
  
  async bookHaircut(customerId: string, serviceId: string) {
    // Via contract
    const appointment = await this.appointmentEngine.createAppointment({
      customerId,
      serviceId,
      status: 'scheduled'
    });
    
    // Direct DB (not yet extracted)
    const service = await this.db.packages.findById(serviceId);
    
    return { appointment, service };
  }
}
```

---

### Full Contract Migration (Phase 3, Week 5-6)

**Goal:** Haircut migrates from Spa tables to remaining 4 contracts.

**Approach:**
1. Extract contract (Catalog, Execution, Events, History)
2. Update Haircut services to use contract (remove direct DB access)
3. Test: Haircut functionality unchanged (contract abstraction only)

**Result:** Haircut fully decoupled from Spa database schema.

---

## Governance

### Contract Versioning

**Semantic Versioning:** `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes (signature change, removed method)
- **MINOR:** New methods (backward compatible)
- **PATCH:** Bug fixes (no API change)

**Example:**
- `IWaitlistEngine@1.0.0` - Initial version (Phase 1)
- `IWaitlistEngine@1.1.0` - Add `cancelWaitlistEntry()` method (backward compatible)
- `IWaitlistEngine@2.0.0` - Change `addToWaitlist()` signature (BREAKING - requires migration)

---

### Breaking Change Process

**Steps for Breaking Contract Change:**

1. **Proposal:** Create ADR for breaking change (justify need)
2. **Impact Analysis:** Identify all consumers (Spa, Haircut, Nail)
3. **Architecture Council Approval:** Requires 2+ vertical approval
4. **New Version:** Publish `v2.0.0` contract (keep `v1.0.0` active)
5. **Migration Period:** 2 quarters for consumers to migrate
6. **Deprecation:** Mark `v1.0.0` deprecated (warnings, docs)
7. **Removal:** Remove `v1.0.0` after migration period (if all consumers migrated)

**Example:**

```typescript
// v1.0.0 (deprecated)
interface IWaitlistEngineV1 {
  addToWaitlist(customerId: string): Promise<WaitlistEntry>;
}

// v2.0.0 (current)
interface IWaitlistEngineV2 {
  addToWaitlist(request: WaitlistRequest): Promise<WaitlistEntry>;  // Breaking: parameter change
}
```

---

### Contract Registry

**Location:** `src/contracts/registry.ts`

**Purpose:** Central registry of all contracts with versions, owners, consumers.

**Example:**

```typescript
export const CONTRACT_REGISTRY = {
  'IWaitlistEngine': {
    version: '1.0.0',
    location: 'src/contracts/beauty/IWaitlistEngine.ts',
    owner: 'Beauty Services Team (interim)',
    consumers: ['bella-spa', 'bella-haircut'],
    status: 'stable',
    breaking_changes: []
  },
  'IAppointmentEngine': {
    version: '1.0.0',
    location: 'src/contracts/beauty/IAppointmentEngine.ts',
    owner: 'Beauty Services Team (interim)',
    consumers: ['bella-spa', 'bella-haircut'],
    status: 'stable',
    breaking_changes: []
  }
  // ... 6 more contracts
};
```

**Validation:** CI pipeline checks contract imports match registry versions.

---

## Risk Mitigation

### Risk 1: Contract Extraction Breaks Spa

**Severity:** 🔴 Critical  
**Probability:** Medium  
**Impact:** Spa downtime, customer bookings fail

**Mitigation:**
1. **Feature flags:** Gradual rollout (contract vs old implementation)
2. **Rigorous testing:** 547 Spa regression tests must pass
3. **Rollback plan:** Keep old implementation active (feature flag flip)
4. **Phased extraction:** 4 contracts at a time (smaller blast radius)
5. **Staging environment:** Test extraction in staging before production

**Contingency:**
- IF Spa breaks: Flip feature flag to old implementation (< 5 min rollback)
- IF contract issues: Fix contract, re-test, gradual rollout
- IF unfixable: Rollback extraction, investigate root cause, re-plan

---

### Risk 2: Haircut MVP Delayed (Week 4 → Week 6)

**Severity:** 🟡 High  
**Probability:** Medium  
**Impact:** Business timeline pressure, revenue delay

**Mitigation:**
1. **Parallelize extraction:** 2 contracts per week (not sequential)
2. **Prioritize critical 4:** Defer non-critical 4 to Phase 3
3. **MVP scope clarity:** Walk-in Queue + 4 contracts = MVP (no extras)
4. **Engineering capacity:** 4-6 engineers for Phase 1 (not 1-2)

**Contingency:**
- IF Week 2 delayed: Reduce critical 4 to critical 2 (Waitlist + Appointment only)
- IF Week 4 delayed: Launch with 2 contracts + Spa tables (minimal viable extraction)
- IF severely delayed: Fallback to Option B (launch Haircut first, extract later)

---

### Risk 3: Contracts Require Rework After Haircut Validation

**Severity:** 🟡 High  
**Probability:** Low  
**Impact:** Phase 3 delayed, contract breaking changes

**Mitigation:**
1. **Phase 1 validation:** Spa uses contracts (smoke test contract design)
2. **Phase 2 validation:** Haircut uses contracts (real use case validation)
3. **Versioning:** Use v1.0.0 with flexibility for v1.1.0 additions (not breaking)
4. **Feedback loop:** Weekly contract review (Architecture Council + Product Teams)

**Contingency:**
- IF minor issues: Publish v1.1.0 with backward-compatible additions
- IF major issues: Publish v2.0.0 with breaking changes (requires migration)
- IF severe issues: Pause Phase 3, fix critical contracts, resume

---

### Risk 4: Nail Shop Timeline Pressure (Cannot Wait for Phase 3)

**Severity:** 🟡 High  
**Probability:** High  
**Impact:** Nail Shop launches with duplicate work (technical debt)

**Mitigation:**
1. **Communicate value:** 4 critical contracts reusable (50% coverage)
2. **Reserve extraction time:** Phase 3 scheduled (Week 5-6 locked)
3. **Nail Shop planning:** Start Nail Shop Week 5+ (not Week 3)
4. **Prioritize high-value:** Waitlist, Assignment, Appointment, Resource = core booking

**Contingency:**
- IF Nail Shop urgent: Launch with 4 critical contracts + Spa tables (same as Haircut Phase 2)
- IF Phase 3 delayed: Nail Shop duplicates 4 deferred contracts (technical debt, but scoped)
- IF unacceptable: Accelerate Phase 3 (4 weeks → 2 weeks, more engineers)

---

## Success Metrics

### Phase 1 Success (Week 2)

- ✅ 4 critical contracts extracted (`IWaitlistEngine`, `IStaffAssignment`, `IAppointmentEngine`, `IResourceAllocation`)
- ✅ Contracts registered in Contract Registry (version 1.0.0)
- ✅ Spa migrated to contracts (547 regression tests pass)
- ✅ Zero production issues (feature flags enabled, no rollback)

---

### Phase 2 Success (Week 4)

- ✅ Haircut MVP launched (walk-in queue + 4 contracts + extensions)
- ✅ Haircut consumes 4 contracts (no direct Spa engine imports)
- ✅ MVP features complete (booking, walk-in queue, stylist assignment, station allocation)
- ✅ Zero contract-related bugs (contract abstraction works)

---

### Phase 3 Success (Week 6)

- ✅ 8 contracts extracted (all capabilities formalized)
- ✅ Haircut fully decoupled from Spa database schema
- ✅ Contract documentation complete (usage examples, migration guides)
- ✅ Contract governance established (breaking change process, versioning)
- ✅ Nail Shop ready to consume contracts (reusable contracts validated)

---

### Long-Term Success (Post-Nail Shop)

- ✅ 3 verticals consume contracts (Spa, Haircut, Nail) - Rule of Three validated
- ✅ Zero contract breaking changes (stable contracts for 2+ quarters)
- ✅ Nail Shop launch 50% faster than Haircut (contract reuse proven)
- ✅ Platform formalization decision (promote to `platform/beauty-services/` if criteria met)

---

## Alternatives Considered

### Alternative 1: Extract All 8 Contracts NOW (Rejected)

**Approach:** Week 1-3 extract all 8, Week 4-8 build Haircut.

**Rejected Because:**
- ⚠️ 8 weeks to MVP (too long, business pressure)
- ⚠️ Higher risk (8 contracts extracted simultaneously)
- ⚠️ Unvalidated contracts (no real use case before full extraction)
- ⚠️ Over-engineering risk (may extract contracts that don't need extraction)

---

### Alternative 2: Extract Nothing, Haircut Uses Spa Tables (Rejected)

**Approach:** Week 1-4 build Haircut using Spa tables directly, extract later (if ever).

**Rejected Because:**
- ⚠️ Technical debt accumulation (Haircut tightly coupled to Spa)
- ⚠️ Nail Shop duplicates effort (no reusable contracts)
- ⚠️ May never extract (pressure to ship next product)
- ⚠️ Breaking changes when extracting later (2 products to migrate)
- ⚠️ Violates H0 mission (Product Reuse Proof requires contracts)

---

### Alternative 3: Extract All 8 After Haircut Launch (Rejected)

**Approach:** Week 1-4 build Haircut, Week 5-12 extract 8 contracts.

**Rejected Because:**
- ⚠️ 4 weeks MVP but defers all extraction (technical debt)
- ⚠️ Nail Shop cannot wait 12 weeks (duplicates work)
- ⚠️ Extraction more difficult (2 products to migrate, not 1)
- ⚠️ Lower priority after launch (may never extract)

---

## Related Decisions

- **ADR-001:** Core vs Kernel Boundary Definition (Platform-of-Platforms architecture)
- **ADR-003:** Beauty Services Platform Formalization (intermediate layer vs platform)
- **ADR-004:** Walk-in Queue Scope (platform primitive vs product feature)
- **ADR-005:** Service Inventory Source (Logistics Kernel E7 vs custom)
- **H0:** Bella Haircut Capability Reuse Assessment (8 contract extractions identified)
- **H1:** Architecture Gate (4 decision points, this is Decision 1)

---

## Approval

**Status:** 🟡 **PROPOSED** - Awaiting Architecture Council approval

**Approval Criteria:**
- [ ] Architecture Council approves hybrid phased approach
- [ ] Product Team accepts 4-week MVP timeline (not 8 weeks)
- [ ] Engineering Team confirms capacity (4-6 engineers for Phase 1)
- [ ] Spa Team accepts migration risk (with mitigation plan)

**If Approved:**
- Week 1: Begin Phase 1 (Waitlist + Assignment extraction)
- Week 2: Complete Phase 1 (Appointment + Resource extraction)
- Week 3-4: Phase 2 (Haircut MVP)
- Week 5-6: Phase 3 (Remaining 4 contracts)

**If Rejected:**
- Fallback to Alternative 2 (no extraction, Haircut uses Spa tables)
- OR Alternative 1 (extract all 8 NOW, 8-week timeline)
- Re-assess risk tolerance and timeline priorities

---

## Consequences

### Positive

1. **Balanced Timeline:** 4 weeks to MVP (business priority), 6 weeks to full formalization (architecture priority)
2. **Risk Mitigation:** Phased extraction reduces blast radius (4 contracts vs 8)
3. **Validated Contracts:** Haircut validates contracts before Phase 3 extraction
4. **Enables Nail Shop:** 4 critical contracts reusable immediately (50% coverage)
5. **Evidence-Based:** Phase 3 informed by Phase 1-2 learnings (not speculation)

### Negative

1. **Mixed Approach Complexity:** Haircut uses contracts + Spa tables (temporary technical debt)
2. **Two-Phase Migration:** Haircut migrates twice (Phase 2 Spa tables → Phase 3 contracts)
3. **Partial Technical Debt:** 4 capabilities deferred to Phase 3 (6-week window)

### Neutral

1. **Contract Ownership:** Spa owns engines (interim), Beauty Platform Team owns later (after formalization)
2. **Governance Overhead:** Contract Registry, versioning, breaking change process (necessary complexity)

---

**ADR-002 Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** 🟡 **PROPOSED**  
**Next Review:** After Architecture Council approval (H1 Gate)

