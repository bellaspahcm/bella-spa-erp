# H2 Ready for IAppointmentEngine Audit

**Date:** 2026-09-15  
**Status:** ✅ **METHODOLOGY FINALIZED — READY FOR DEPENDENCY ANCHOR AUDIT**

---

## H2 Methodology — SEALED

### ADR-007: 3-Phase Extraction Process

**Phase 1: Legacy Discovery** (What Spa does)  
**Phase 2: Domain Reconciliation** (Spa + Haircut + Nail common concepts)  
**Phase 3: Target Contract** (Validated neutral abstraction)

**Status:** ✅ APPROVED

---

### ADR-007 Clarifications: 3 Critical Distinctions

**1. Beauty-Shared ≠ Platform**
- Spa + Haircut + Nail = Beauty domain (NOT cross-vertical)
- Need actual cross-vertical consumer for Platform CONFIRMED

**2. Projected ≠ Validated**
- Spa: PROVEN | Haircut: ACTIVE | Nail: PROJECTED

**3. Example ≠ Decision**
- ADR examples = illustrations | Actual boundaries = code evidence

**Status:** ✅ APPROVED

---

## Current Contract Status — CORRECTED

### IWaitlistEngine

**Classification:** ⏳ **Platform Contract CANDIDATE**

**Rationale:**
- ✅ Domain-neutral semantics (temporal queue, no Beauty coupling)
- ✅ Cross-vertical applicability (Healthcare clinic queue, Auto service queue, Education enrollment)
- ❌ **Actual cross-vertical consumer: NOT YET PROVEN**

**Evidence:**
- Spa: PROVEN (walk-in queue implementation)
- Haircut: ACTIVE (walk-in queue requirement)
- Nail: PROJECTED (walk-in queue likely needed)
- Healthcare/Auto/Education: Use cases identified (NOT implemented/validated)

**Promotion Path:**
- Add Healthcare clinic queue consumer, OR
- Add Auto service queue consumer, OR
- Add Education enrollment queue consumer
- **THEN:** Platform Contract CONFIRMED

**Current Status:** ✅ Extraction complete, ownership = Platform CANDIDATE

---

### IServiceCatalog

**Classification:** ⏳ **Platform Contract CANDIDATE**

**Rationale:**
- ✅ Domain-neutral semantics (Service, price, duration — no Beauty coupling)
- ✅ Cross-vertical applicability (Healthcare treatment catalog, Auto service catalog, Education course catalog)
- ❌ **Actual cross-vertical consumer: NOT YET PROVEN**

**Evidence:**
- Spa: PROVEN (packages table catalog)
- Haircut: ACTIVE (service catalog requirement)
- Nail: PROJECTED (service catalog likely needed)
- Healthcare/Auto/Education: Use cases identified (NOT implemented/validated)

**Promotion Path:**
- Add Healthcare treatment catalog consumer, OR
- Add Auto service catalog consumer, OR
- Add Education course catalog consumer
- **THEN:** Platform Contract CONFIRMED

**Current Status:** ✅ Extraction complete, ownership = Platform CANDIDATE

---

### IStaffAssignment (H1 Contract #6)

**Classification:** ⏸️ **DEFERRED** (probable absorption into IAppointmentEngine)

**Rationale:**
- ❌ Standalone contract NOT justified (assignment = booking attribute in Spa)
- ⏳ Pending IAppointmentEngine audit (determine if absorbed or separate)

**Evidence:**
- `bookings.assigned_ktv_id` field (booking-owned)
- `AutoAssignmentProvider` = recommendation service (NOT assignment engine)
- Assignment persistence via `updateBooking()` (booking capability)

**Current Status:** ⏸️ DEFERRED pending IAppointmentEngine audit

---

## H2 Contract Inventory — CURRENT STATE

**Canonical Baseline:** 8 contracts (H0/H1) — **DO NOT CHANGE until IAppointmentEngine audit**

**Extracted:** 2 contracts
- IWaitlistEngine: Platform CANDIDATE ⏳
- IServiceCatalog: Platform CANDIDATE ⏳

**Under Reconciliation:** 1 contract
- IStaffAssignment: DEFERRED ⏸️

**Remaining:** 5 contracts unaudited

**Effective Count:** TBD (pending IAppointmentEngine audit — may absorb Staff + Resource + Events)

---

## Success Metrics — REVISED

### Quality Over Count

**Primary Measure:**
- Clean capability boundaries (no Spa coupling)
- Haircut can consume without Spa dependency
- Nail reuse path validated (when implemented)

**NOT Measured By:**
- Exact contract count (8 vs 6 vs 7)
- Reuse percentage (73% vs 90%)
- Platform classification speed (Candidate → Confirmed takes time)

---

### Evidence Rigor

**Spa:** PROVEN (legacy implementation exists)  
**Haircut:** ACTIVE (H2 implementation in progress)  
**Nail:** PROJECTED (future product, requirements analyzed)

**Cross-Vertical:** Use cases identified (NOT yet implemented/validated)

**Valid Claims:**
- "2 contracts extracted (Platform Candidates)"
- "Validated with Spa (proven), Haircut (active)"
- "No contradiction with Nail projection"
- "Cross-vertical applicability identified (Healthcare, Auto, Education)"

**Invalid Claims:**
- ❌ "Platform Contracts confirmed" (Candidates only, pending cross-vertical consumer)
- ❌ "Validated with 3 products" (Nail is projected, not validated)
- ❌ "8 contracts extracted" (only 2 extracted so far)

---

## Architecture Pattern — ESTABLISHED

```
                    BELLA PLATFORM
                         │
                 Platform Primitives
                    (CANDIDATES)
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
       BEAUTY SERVICES          Other Verticals
          (Spa + Haircut + Nail)   (Healthcare, Auto, Education)
              │                     │
      Shared Capabilities      Cross-Vertical
        (Beauty Contracts)      Validation
              │                     │
      ┌───────┼────────┐           │
      ↓       ↓        ↓           │
    Spa    Haircut   Nail          │
  Legacy     │        │            │
    ↓        │        │            │
 Adapter     │        │            │
    └────────┴────────┴────────────┘
           Contracts
```

**Key Principles:**
1. Spa = Reference implementation (NOT dependency)
2. Haircut/Nail consume Platform contracts (NOT Spa architecture)
3. Spa Adapter bridges legacy → Platform (NO Spa rewrite required)
4. Platform Candidate → Confirmed requires cross-vertical consumer

---

## Next Action: IAppointmentEngine 3-Phase Audit

### Why This Is Critical

**IAppointmentEngine = Dependency Anchor**

**Reason 1:** Contract #3 deferred (needs Appointment scope definition)

**Reason 2:** Potential cascade absorption
- Staff assignment (`bookings.assigned_ktv_id`)
- Resource assignment (`bookings.assigned_room_id`, `assigned_bed_id`)
- Booking lifecycle events

**Reason 3:** Inventory impact
- May absorb 2-3 H1 contracts (Staff, Resource, Events)
- Canonical inventory may change 8 → 6 or 7
- First real test of ADR-007 methodology on complex capability

---

### Phase 1: Legacy Discovery (Spa Booking Implementation)

**Audit Scope:**

**1. Booking Entity**
- Schema: `bookings` table (fields, relationships, constraints)
- Types: Booking entity types
- Operations: CRUD, lifecycle transitions

**2. Professional Assignment**
- Field: `bookings.assigned_ktv_id`
- Operations: assign, reassign, clear
- Recommendation: `AutoAssignmentProvider` (helper service)
- Persistence: via `updateBooking()` action

**3. Resource Assignment**
- Fields: `bookings.assigned_room_id`, `assigned_bed_id`
- Operations: allocate, deallocate
- Conflict detection: Decision Engine

**4. Lifecycle State Machine**
- States: created → confirmed → checked-in → in-progress → completed → cancelled
- Transitions: valid state changes
- Invariants: state transition rules

**5. Temporal**
- Fields: `start_date`, `preferred_time`, `duration`
- Operations: schedule, reschedule
- Conflicts: overlapping bookings

**6. Service/Package**
- Fields: `package_id`, `service_id`
- Operations: service selection
- Dependencies: IServiceCatalog

**7. Customer**
- Fields: `customer_id`, tier
- Operations: customer context

**8. Events**
- Booking lifecycle events: created, confirmed, completed, cancelled
- Event ownership: booking-specific or platform event bus?

**9. Invariants**
- Overlapping booking prevention
- Tenant isolation
- State transition validation
- Conflict detection rules

**10. Dependencies**
- Consumes: IServiceCatalog, Decision Engine
- Provides: Booking lifecycle, assignments?, events?

**Output:** Legacy evidence document (HOW Spa organizes booking capability)

---

### Phase 2: Domain Reconciliation

**Map Spa concepts → Domain concepts:**

**Professional Assignment:**
- Spa: KTV (`assigned_ktv_id`)
- Haircut: Stylist/Barber
- Nail: Nail Technician
- **Domain:** Professional (`assigned_professional_id`)

**Resource Assignment:**
- Spa: Room/Bed (`assigned_room_id`, `assigned_bed_id`)
- Haircut: Chair/Station
- Nail: Nail Table/Station
- **Domain:** Resource (`assigned_resource_ids[]`)

**Service:**
- Spa: Package (`package_id`)
- Haircut: Service (`service_id`)
- Nail: Service (`service_id`)
- **Domain:** Service (`service_id`)

**Appointment/Booking:**
- Spa: Booking
- Haircut: Appointment
- Nail: Appointment
- **Domain:** Appointment (neutral term)

**Validate:**
- ✅ Haircut requirements fit abstraction?
- ✅ Nail projection fit abstraction?
- ✅ No Beauty-specific semantics leaked?

**Output:** Domain model (WHAT concepts are common across Spa + Haircut + Nail)

---

### Phase 3: Target Contract Design

**Possible Outcomes:**

**Outcome A: Monolithic Appointment**
```typescript
interface IAppointmentEngine {
  // Lifecycle
  createAppointment()
  confirmAppointment()
  cancelAppointment()
  
  // Professional assignment (embedded)
  assignProfessional()
  clearProfessionalAssignment()
  
  // Resource assignment (embedded)
  assignResources()
  clearResourceAssignments()
  
  // Queries
  getAppointment()
  listAppointments()
}
```

**Outcome B: Appointment + Separate Capabilities**
```typescript
interface IAppointmentEngine {
  // Lifecycle only
  createAppointment()
  confirmAppointment()
  cancelAppointment()
  getAppointment()
  listAppointments()
}

interface IProfessionalAssignment {
  assignProfessional()
  recommendProfessional()
}

interface IResourceAllocation {
  assignResources()
  checkResourceConflicts()
}
```

**Outcome C: Appointment with Helper Services**
```typescript
interface IAppointmentEngine {
  // Lifecycle + assignment methods
  createAppointment()
  assignProfessional()
  assignResources()
}

// Helper services (NOT contracts)
class ProfessionalRecommendationService
class ResourceAllocationService
```

**Decision Authority:** Code evidence from Phase 1-2, NOT ADR-007 example

**Validation:**
- ✅ Spa adapter can implement?
- ✅ Haircut native implementation feasible?
- ✅ Nail projection fits?
- ✅ Clean boundaries (no Spa coupling)?

**Output:** Target contract design with validated boundaries

---

## Expected Outcomes

### Contract #3 (IStaffAssignment) Resolution

**If absorbed into IAppointmentEngine:**
- `IAppointmentEngine.assignProfessional()` method
- Professional recommendation as helper service (AutoAssignmentProvider)
- Canonical inventory: 8 → 7 contracts

**If separate contract:**
- `IProfessionalAssignment` standalone contract
- Canonical inventory: 8 contracts (unchanged)

---

### Contract #7 (IResourceAllocation) Resolution

**If absorbed into IAppointmentEngine:**
- `IAppointmentEngine.assignResources()` method
- Resource conflicts via Decision Engine
- Canonical inventory: 8 → 6 or 7 contracts (depending on Staff)

**If separate contract:**
- `IResourceAllocation` standalone contract
- Canonical inventory: remains higher

---

### Contract #8 (IDomainEvents) Resolution

**If booking events are booking-specific:**
- Events part of IAppointmentEngine (lifecycle events)
- IDomainEvents may be Platform event bus (separate concern)

**If events are platform-wide:**
- IDomainEvents remains separate contract
- Booking events published to platform event bus

---

## Blockers

**Current:** ✅ **NONE**

- Methodology finalized (ADR-007 + Clarifications)
- Contract status corrected (Platform Candidates)
- Evidence rigor established (Spa proven, Haircut active, Nail projected)

---

## Summary

```
H2 STATUS — READY FOR IAPPOINTMENTENGINE AUDIT

Methodology:             ✅ FINALIZED (ADR-007 + Clarifications)
Contracts Extracted:     2 (IWaitlistEngine, IServiceCatalog)
Contract Status:         Platform CANDIDATES (pending cross-vertical consumer)
Evidence Rigor:          Spa PROVEN, Haircut ACTIVE, Nail PROJECTED

Contract Inventory:      8 baseline (DO NOT CHANGE yet)
Under Reconciliation:    Contract #3 (IStaffAssignment DEFERRED)
Effective Count:         TBD (pending IAppointmentEngine audit)

Success Metric:          Quality > Count
                        Clean boundaries > Reuse %
                        No Spa coupling > Contract count

Next Action:            IAppointmentEngine 3-Phase Audit
Critical Test:          First ADR-007 application on complex capability
Expected Impact:        Resolve Contract #3, #7, #8 boundaries
                        Finalize canonical inventory (8 → actual count)

Blocker:                NONE
Status:                 ✅ READY TO PROCEED
```

---

**Document Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ✅ **METHODOLOGY FINALIZED — READY FOR DEPENDENCY ANCHOR AUDIT**  
**Next:** IAppointmentEngine Phase 1 (Legacy Discovery)
