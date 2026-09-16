# ADR-007: Platform Contract Extraction Principles

**Status:** ✅ **APPROVED**  
**Date:** 2026-09-15  
**Decision Maker:** Architecture Council  
**Trigger:** H2 Contract Extraction — Mid-stream correction after Contract #3

---

## Context

### Problem Statement

During H2 contract extraction (Bella Haircut capability reuse), we discovered a critical risk:

**Risk:** Extracting contracts directly from Spa legacy implementation may **"platform-ify" Spa architecture** rather than create truly reusable abstractions.

**Example Pattern (WRONG):**
```
Spa Implementation
     ↓
  Interface wrapper
     ↓
  Platform Contract
```

**Result:** Haircut/Nail become **dependent on Spa legacy architecture**, not true platform reuse.

---

### Discovery Context

**Contract #3 Reconciliation revealed:**
- `bookings.assigned_ktv_id` field exists in Spa
- Initial reaction: "Staff Assignment = booking attribute (include in IAppointmentEngine)"
- **Critical Question:** Does Spa schema dictate Platform architecture?

**Answer:** **NO**

**Rationale:**
```
Spa legacy implementation
booking owns assigned_ktv_id
             ≠
Platform architecture
Appointment must own StaffAssignment
```

**Spa schema tells us HOW Spa organized data (legacy evidence).**  
**It does NOT tell us HOW Platform should organize capabilities (target architecture).**

---

## Decision

### Platform Contract Extraction Must Follow 3-Phase Process

**Phase 1: Legacy Discovery** (What Spa does)  
**Phase 2: Domain Reconciliation** (What Spa + Haircut + Nail need)  
**Phase 3: Target Contract Design** (Neutral abstraction)

**NOT:**
```
Spa code → interface → Platform
```

**BUT:**
```
             Spa evidence
                  ↓
Haircut needs → DOMAIN MODEL ← Nail needs
                  ↓
           Contract trung lập
                  ↓
        ┌─────────┼─────────┐
        ↓         ↓         ↓
    Spa Adapter  Haircut   Nail
```

---

## Principles

### Principle 1: Spa = Reference Implementation (NOT Dependency)

**Role of Bella Spa:**
- ✅ **Evidence source:** Business logic, invariants, algorithms proven in production
- ✅ **Reference implementation:** Demonstrates capability requirements
- ✅ **Test knowledge:** Edge cases, failure modes, validation rules
- ❌ **NOT dependency target:** Haircut/Nail should NOT depend on Spa architecture

**Pattern:**
```
Spa = Legacy implementation (proven business logic)
      ↓
   Evidence for contract design
      ↓
Platform Contract (neutral abstraction)
      ↓
   ┌──────┼──────┐
   ↓      ↓      ↓
  Spa  Haircut  Nail
   │      │      │
Adapter  Impl.  Impl.
```

---

### Principle 2: Domain Reconciliation (NOT Direct Extraction)

**Wrong Approach:** Extract Spa schema → Platform contract

**Correct Approach:** Reconcile domain concepts across products

**Example: Service Professional Assignment**

**Spa has:**
```
bookings.assigned_ktv_id (KTV = staff role in Spa)
```

**Haircut needs:**
```
assigned_stylist_id or assigned_barber_id
```

**Nail needs:**
```
assigned_technician_id
```

**Domain reconciliation:**
```
Common concept: "Service Professional"
- Spa: KTV
- Haircut: Stylist/Barber
- Nail: Nail Technician

Platform abstraction:
appointment.assigned_professional_id (generic)
```

**Product-specific mapping:**
```
Spa Adapter:
  professional_id → ktv_id (maps to users.role='ktv')

Haircut Impl:
  professional_id → stylist_id (maps to users.role='stylist')

Nail Impl:
  professional_id → technician_id (maps to users.role='nail_tech')
```

---

### Principle 3: Multi-Product Validation (NOT Single-Product Design)

**Contract design MUST consider:**
1. ✅ Spa actual implementation (legacy evidence)
2. ✅ Haircut requirements (new product needs)
3. ✅ Nail projected requirements (future consumer)

**Design Process:**
```
1. Spa evidence: What does Spa do today?
2. Haircut needs: What does Haircut require?
3. Nail projection: What will Nail likely need?
4. Common abstraction: What concept spans all three?
5. Contract design: Generic boundary fitting all
```

**Validation Threshold:**
- ✅ Contract must fit Spa (legacy adapter can implement)
- ✅ Contract must fit Haircut (new implementation satisfies)
- ✅ Contract must fit Nail (projected needs covered)

**If contract only fits Spa:** NOT Platform contract, keep as Spa-specific.

---

### Principle 4: Adapter Pattern (NOT Rewrite Requirement)

**Spa does NOT need rewrite to adopt Platform contracts.**

**Pattern:**
```
           Platform Contract
                  │
                  ↓
             Spa Adapter
                  │
      ┌───────────┴──────────┐
      ↓                      ↓
  Spa Service (unchanged)  Spa DB (unchanged)
```

**Adapter responsibilities:**
- Translate Platform concepts → Spa legacy concepts
- Implement Platform contract methods → Spa service calls
- Map data types (Platform types ↔ Spa types)

**Example: Service Catalog**
```typescript
// Platform Contract
interface IServiceCatalog {
  getService(serviceId): Promise<Service>;
  // ... generic methods
}

// Spa Adapter (NEW)
class SpaServiceCatalogAdapter implements IServiceCatalog {
  async getService(serviceId: string): Promise<Service> {
    // Call legacy Spa service
    const spaPackage = await getPackage(serviceId);
    
    // Map Spa types → Platform types
    return {
      id: spaPackage.id,
      name: spaPackage.name,
      price: spaPackage.price,
      duration_minutes: spaPackage.default_duration_minutes,
      // ... map all fields
    };
  }
}

// Spa services (UNCHANGED)
async function getPackage(id: string) {
  // Original Spa logic, unchanged
  return supabase.from('packages').select('*').eq('id', id).single();
}
```

**Benefit:**
- ✅ Spa continues working (no breaking changes)
- ✅ Haircut/Nail consume Platform contract (not Spa legacy)
- ✅ Spa can migrate incrementally (adapter → native implementation)

---

### Principle 5: Evidence-Driven, Not Schema-Driven

**Wrong:**
```
Spa DB schema → Platform contract
(platformify Spa architecture)
```

**Correct:**
```
Spa business logic + Haircut needs + Nail needs
              ↓
      Domain reconciliation
              ↓
   Platform contract (neutral)
```

**Evidence types:**
- ✅ Business logic (algorithms, rules, invariants)
- ✅ API contracts (method signatures, parameters)
- ✅ Use cases (workflows, state machines)
- ✅ Test knowledge (edge cases, failure modes)
- ❌ **NOT** DB schema (implementation detail, not contract)

**Example: Staff Assignment**

**Schema evidence (Spa):**
```sql
bookings.assigned_ktv_id UUID
```

**Business logic evidence (Spa):**
```typescript
// Recommendation algorithm
const provider = new AutoAssignmentProvider();
const result = provider.evaluate(input, candidates);

// Assignment persistence
await updateBooking(bookingId, { assigned_ktv_id: result.ktvId });
```

**Contract decision:**
```
Schema says: "Assignment is booking attribute"
Business logic says: "Recommendation + persistence are separate concerns"

Platform contract:
- IStaffRecommendation (recommendation algorithm)
- IAppointmentEngine.assignProfessional() (assignment method)
```

**NOT direct schema mapping:**
```
IAppointmentEngine {
  assigned_ktv_id: string  ❌ (leaks Spa terminology)
}
```

**But domain abstraction:**
```
IAppointmentEngine {
  assigned_professional_id: string  ✅ (generic concept)
  
  assignProfessional(appointmentId, professionalId)
  recommendProfessional(appointmentId): ProfessionalRecommendation
}
```

---

## Architectural Pattern

### Target Architecture

```
                    BELLA PLATFORM
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
     Capability Contracts     Shared Services
              │                     │
    ┌─────────┼─────────┐          │
    ↓         ↓         ↓          ↓
  Bella     Haircut    Nail     Logistics
   Spa       (new)    (new)     Kernel E7
    │          │        │
 Adapter    Native   Native
    │       Impl.    Impl.
    ↓
 Legacy
  Code
```

**Layers:**
1. **Platform Contracts:** Generic, cross-product abstractions
2. **Product Implementations:** Product-specific implementations
3. **Adapters:** Bridge legacy code → Platform contracts
4. **Legacy Code:** Spa existing services (unchanged)

---

### Reuse Model

**What Haircut/Nail reuse from Spa:**
- ✅ Business logic patterns (algorithms, rules, invariants)
- ✅ Test knowledge (edge cases, failure scenarios)
- ✅ Domain concepts (appointment, service, professional, resource)
- ✅ Validation rules (conflict detection, capacity management)

**What Haircut/Nail do NOT reuse:**
- ❌ Spa DB schema (Haircut has own schema)
- ❌ Spa service layer (Haircut has own services)
- ❌ Spa terminology (KTV → Stylist, packages → services)

**Interface:**
```
Haircut ──────→ Platform Contract ←────── Spa Adapter
                                              │
                                              ↓
                                          Spa Legacy
```

**NOT:**
```
Haircut ──────→ Spa Services  ❌ (direct dependency)
```

---

## Contract Extraction Process (Revised)

### Phase 1: Legacy Discovery

**Purpose:** Understand what Spa does today (evidence gathering)

**Activities:**
1. Audit Spa implementation (code, DB, services, APIs)
2. Document business logic (algorithms, rules, invariants)
3. Extract test knowledge (edge cases, failure modes)
4. Identify proven patterns (conflict detection, auto-assignment, etc.)

**Output:** Legacy evidence document (HOW Spa does it)

---

### Phase 2: Domain Reconciliation

**Purpose:** Find common concepts across Spa + Haircut + Nail

**Activities:**
1. Map Spa concepts → generic domain concepts
2. Validate with Haircut requirements (does abstraction fit?)
3. Project Nail needs (will abstraction work for Nail?)
4. Identify semantic mismatches (e.g., KTV vs Stylist vs Technician)
5. Define neutral terminology (Professional, Resource, Service, Appointment)

**Output:** Domain model (WHAT concepts are common)

**Example:**
```
Spa Concept         Domain Concept       Haircut Concept
-----------         --------------       ---------------
KTV                 Professional         Stylist/Barber
Package             Service              Service
Booking             Appointment          Appointment
Room/Bed            Resource             Chair/Station
```

---

### Phase 3: Target Contract Design

**Purpose:** Design platform contract (neutral abstraction)

**Activities:**
1. Define contract interface (methods, types, invariants)
2. Validate against Spa adapter feasibility (can Spa implement?)
3. Validate against Haircut native implementation (can Haircut implement?)
4. Validate against Nail projected needs (will Nail be able to use?)
5. Document ownership (Platform, Beauty vertical, or Product-specific)

**Output:** Platform contract (WHY this boundary, WHO owns it)

**Validation Gates:**
- ✅ Spa adapter can implement (legacy feasibility)
- ✅ Haircut native impl can implement (new product feasibility)
- ✅ Nail projected needs fit (future consumer validation)
- ✅ Cross-vertical semantics (generic, not Spa-specific)

---

## Examples

### Example 1: IServiceCatalog

**Phase 1: Legacy Discovery (Spa)**
```
Spa packages table:
- name, price, duration, category
- service_kind (single, package, subscription)
- status, metadata, variants
```

**Phase 2: Domain Reconciliation**
```
Spa: Service packages (facial, massage, body treatment)
Haircut: Service catalog (haircut, styling, coloring)
Nail: Service catalog (manicure, pedicure, nail art)

Common: "Service Catalog" (what services offered, pricing, duration)
```

**Phase 3: Target Contract**
```typescript
interface IServiceCatalog {
  getService(serviceId, tenantId): Promise<Service>;
  listServices(filters): Promise<ServiceListResponse>;
  createService(input): Promise<CreateServiceOutput>;
  // ... generic CRUD + variants + packages
}
```

**Validation:**
- ✅ Spa adapter: Map `packages` table → `Service` type
- ✅ Haircut: Implement native service catalog (haircut services)
- ✅ Nail: Future service catalog (nail services)

---

### Example 2: IAppointmentEngine (Pending)

**Phase 1: Legacy Discovery (Spa)**
```
Spa bookings table:
- customer_id, package_id, assigned_ktv_id
- assigned_room_id, assigned_bed_id
- start_date, preferred_time, status
```

**Phase 2: Domain Reconciliation**
```
Spa: Booking (customer books package, assigned KTV, assigned room/bed)
Haircut: Appointment (customer books service, assigned stylist, assigned chair)
Nail: Appointment (customer books service, assigned technician, assigned station)

Common concepts:
- Customer → customer_id (same)
- Service → package_id (Spa), service_id (Haircut/Nail)
- Professional → assigned_ktv_id (Spa), assigned_stylist_id (Haircut), assigned_technician_id (Nail)
- Resource → assigned_room_id/bed_id (Spa), assigned_chair_id (Haircut), assigned_station_id (Nail)

Abstraction:
- Appointment (NOT Booking)
- Professional (NOT KTV/Stylist/Technician)
- Resource (NOT Room/Chair/Station)
```

**Phase 3: Target Contract**
```typescript
interface IAppointmentEngine {
  // Appointment lifecycle
  createAppointment(input): Promise<CreateAppointmentOutput>;
  confirmAppointment(appointmentId, tenantId): Promise<{ success: boolean }>;
  cancelAppointment(appointmentId, tenantId): Promise<{ success: boolean }>;
  
  // Professional assignment
  assignProfessional(appointmentId, professionalId, tenantId): Promise<{ success: boolean }>;
  recommendProfessional(appointmentId, tenantId): Promise<ProfessionalRecommendation>;
  
  // Resource assignment
  assignResource(appointmentId, resourceId, tenantId): Promise<{ success: boolean }>;
  checkResourceConflicts(resourceId, timeSlot, tenantId): Promise<ConflictCheckResult>;
  
  // Appointment queries
  getAppointment(appointmentId, tenantId): Promise<Appointment | null>;
  listAppointments(filters): Promise<AppointmentListResponse>;
}

// Generic types (NOT Spa-specific)
interface Appointment {
  id: string;
  tenant_id: string;
  customer_id: string;
  service_id: string;
  assigned_professional_id: string | null;  // Generic (NOT ktv_id)
  assigned_resource_ids: string[];          // Generic (NOT room_id/bed_id)
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  // ...
}
```

**Validation:**
- ✅ Spa adapter:
  ```
  professional_id → ktv_id (map to users.role='ktv')
  resource_ids → [room_id, bed_id] (map to rooms/beds tables)
  ```
- ✅ Haircut:
  ```
  professional_id → stylist_id (map to users.role='stylist')
  resource_ids → [chair_id] (map to chairs table)
  ```
- ✅ Nail:
  ```
  professional_id → technician_id (map to users.role='nail_tech')
  resource_ids → [station_id] (map to stations table)
  ```

---

## Impact on H2

### Revised H2 Process

**Before:**
```
1. Find Spa capability
2. Extract interface
3. Create adapter
4. Done
```

**After (3-Phase):**
```
1. LEGACY DISCOVERY
   - Audit Spa implementation
   - Document business logic
   - Extract test knowledge

2. DOMAIN RECONCILIATION
   - Map Spa concepts → domain concepts
   - Validate with Haircut needs
   - Project Nail requirements
   - Define neutral terminology

3. TARGET CONTRACT
   - Design platform contract
   - Validate multi-product fit
   - Document ownership
   - Create Spa adapter (NOT modify Spa)
```

---

### Contract Extraction Checklist (Updated)

**For each contract:**

**✅ Phase 1: Legacy Discovery**
- [ ] Spa implementation audited (code, DB, services)
- [ ] Business logic documented (algorithms, rules, invariants)
- [ ] Test knowledge extracted (edge cases, failure modes)

**✅ Phase 2: Domain Reconciliation**
- [ ] Spa concepts mapped to domain concepts
- [ ] Haircut requirements validated (does abstraction fit?)
- [ ] Nail needs projected (will abstraction work?)
- [ ] Semantic mismatches identified and resolved
- [ ] Neutral terminology defined

**✅ Phase 3: Target Contract**
- [ ] Contract interface designed (methods, types, invariants)
- [ ] Spa adapter feasibility validated (can implement?)
- [ ] Haircut native implementation validated (can implement?)
- [ ] Nail future needs validated (will be able to use?)
- [ ] Ownership classified (Platform, vertical, or product-specific)

**✅ Implementation**
- [ ] Spa adapter created (bridge legacy → contract)
- [ ] Haircut native implementation planned
- [ ] Architecture Guard passed
- [ ] ADR documented (if ownership/scope decisions made)

---

## Consequences

### Positive

1. **True Platform Reuse**
   - Haircut/Nail NOT dependent on Spa legacy architecture
   - Contracts are neutral abstractions (cross-product)

2. **Spa Migration Path**
   - Spa can adopt Platform contracts incrementally (via adapter)
   - No forced rewrite (adapter bridges legacy code)

3. **Future-Proof Architecture**
   - New products (Auto, Healthcare, Education) can consume contracts
   - Contracts designed for multi-vertical, not just Beauty

4. **Haircut = Architecture Transition**
   - Haircut becomes bridge from "Spa legacy" → "Bella Platform"
   - Validates contracts with real implementation (not just theory)

5. **Nail = Reuse Validation**
   - Nail proves contracts are truly reusable (3rd consumer)
   - Validates multi-product abstraction

---

### Negative

1. **Higher Upfront Design Cost**
   - 3-phase process slower than direct extraction
   - Domain reconciliation requires cross-product analysis

2. **Adapter Maintenance**
   - Spa adapter must be maintained (translation layer)
   - Performance overhead (adapter → legacy service)

3. **Risk of Over-Abstraction**
   - Generic contracts may be too abstract (miss product-specific needs)
   - Mitigation: Validate with 3 products (Spa, Haircut, Nail)

---

### Neutral

1. **Spa Schema Independence**
   - Contracts NOT tied to Spa DB schema
   - Haircut/Nail can have different schemas

2. **Terminology Neutralization**
   - "Professional" instead of KTV/Stylist/Technician
   - May feel abstract initially, becomes natural over time

---

## Alternatives Considered

### Alternative 1: Direct Spa Dependency

**Pattern:** Haircut/Nail depend directly on Spa services/DB

**Pros:**
- Faster development (no contract abstraction)
- Lower upfront cost (no adapter needed)

**Cons:**
- ❌ Haircut/Nail coupled to Spa legacy architecture
- ❌ Spa changes break Haircut/Nail
- ❌ Not true platform reuse
- ❌ Difficult to support non-Beauty verticals later

**Decision:** ❌ **REJECTED** (violates Platform architecture)

---

### Alternative 2: Rewrite Spa First

**Pattern:** Rewrite Spa to Platform architecture, then Haircut/Nail follow

**Pros:**
- Clean Platform architecture from start
- No adapter layer needed

**Cons:**
- ❌ High risk (rewrite production system)
- ❌ Long timeline (8-12 weeks Spa rewrite before Haircut)
- ❌ Business delay (Haircut launch blocked)

**Decision:** ❌ **REJECTED** (too risky, too slow)

---

### Alternative 3: Parallel Architectures

**Pattern:** Spa stays legacy, Haircut/Nail use new Platform architecture

**Pros:**
- No Spa risk (legacy unchanged)
- Clean Haircut/Nail architecture

**Cons:**
- ❌ Duplicate capabilities (Spa implementation + Platform implementation)
- ❌ No Spa business logic reuse (lose proven patterns)
- ❌ Maintenance burden (two architectures)

**Decision:** ❌ **REJECTED** (lose Spa business logic value)

---

### Alternative 4: 3-Phase Extraction + Adapter (APPROVED)

**Pattern:** Extract contracts with domain reconciliation, Spa adopts via adapter

**Pros:**
- ✅ Spa business logic reused (via adapter)
- ✅ Haircut/Nail use Platform contracts (not Spa legacy)
- ✅ Spa migration path (adapter → native)
- ✅ Cross-product validation (Spa, Haircut, Nail)

**Cons:**
- ⚠️ Higher upfront cost (3-phase process)
- ⚠️ Adapter maintenance (translation layer)

**Decision:** ✅ **APPROVED** (best balance of reuse + architecture)

---

## Related Decisions

- ADR-001: Platform-of-Platforms Architecture
- ADR-002: Contract Extraction Strategy (revised by this ADR)
- ADR-006: Temporal Platform Layer (example of cross-vertical contract)

---

## Revision History

**v1.0 (2026-09-15):** Initial decision after Contract #3 reconciliation mid-stream correction

---

**ADR Status:** ✅ **APPROVED**  
**Impact:** HIGH (changes H2 contract extraction methodology)  
**Affects:** All remaining H2 contract extractions, Haircut/Nail implementations
