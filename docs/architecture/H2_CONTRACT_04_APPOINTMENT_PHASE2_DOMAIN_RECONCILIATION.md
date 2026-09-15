# H2 Contract #4 — IAppointmentEngine Phase 2: Domain Reconciliation

**Date:** 2026-09-15  
**Status:** 🔍 **DOMAIN RECONCILIATION IN PROGRESS**  
**Method:** ADR-007 3-Phase Extraction

---

## Purpose

Phase 1 answered: **"How does Spa implement booking?"**

Phase 2 must answer: **"What are the true domain capabilities across Spa + Haircut + Nail?"**

**Critical Distinction:**
- ❌ Phase 1 evidence does NOT dictate target architecture
- ✅ Phase 2 determines actual capability boundaries from domain requirements
- ✅ Spa = reference evidence, NOT architectural blueprint

---

## Phase 1 Evidence Summary

**What Spa Does (Legacy Implementation):**

```
Booking Entity (bookings table)
├─ Lifecycle (inquiry → deposit_pending → booked → in_progress → completed | cancelled)
├─ Professional assignment (assigned_ktv_id FK)
├─ Resource assignment (assigned_bed_id, assigned_room_id FKs)
├─ Equipment (required_equipment_ids JSONB)
└─ Service association (package_id FK)

Helper Services
├─ AutoAssignmentProvider (professional recommendation)
└─ checkBookingConflicts() (resource conflict detection)
```

**Key Pattern:** Simple nullable FK fields, no separate allocation tables, helper services for recommendation/validation.

**What Phase 1 Does NOT Prove:**
- ❌ Professional assignment MUST be appointment attribute
- ❌ Resource allocation MUST be appointment attribute
- ❌ Recommendation MUST be helper service (not contract)
- ❌ Platform MUST follow Spa architecture

---

## Phase 2 Objective: Test 4 Capability Boundaries

| Capability                   | Spa Evidence         | Haircut Requirements | Nail Projection | Architecture Question                                      |
| ---------------------------- | -------------------- | -------------------- | --------------- | ---------------------------------------------------------- |
| **Appointment Lifecycle**    | Booking states       | Appointment states   | Appointment     | Independent capability? Core aggregate?                    |
| **Professional Assignment**  | `assigned_ktv_id` FK | Stylist assignment   | Technician      | Lifecycle/rules rich enough to separate?                   |
| **Professional Recommendation** | AutoAssignmentProvider | Stylist matching  | Technician      | Helper service, policy engine, or capability?              |
| **Resource Allocation**      | Room/Bed FKs         | Chair allocation     | Station/Table   | Lifecycle/conflict model rich enough to separate contract? |

---

## Boundary Question 1: Appointment Lifecycle

### Spa Evidence (Phase 1)

**States:**
```
inquiry → deposit_pending → booked → in_progress → completed | cancelled
```

**Responsibilities:**
- Customer association (`customer_id`)
- Service selection (`package_id`)
- Temporal scheduling (`start_date`, `preferred_time`)
- Financial tracking (`deposit_amount`, `full_price`)
- Status transitions (state machine)
- Session tracking (`total_sessions`, `completed_sessions`)

**Dependencies:**
- Consumes: IServiceCatalog (package definition)
- Consumes: Customer context (tier, preferences)
- Provides: Aggregate root for service delivery

---

### Haircut Requirements (H0 Analysis)

**From H0 Quick Win #1: Appointment Booking**

**Expected Haircut Flow:**
```
inquiry/walk-in → confirmed → checked-in → in-service → completed | cancelled
```

**Key Differences from Spa:**
1. **Single-visit service** (NOT multi-session packages)
   - Spa: 21 sessions over 3 months
   - Haircut: 1 visit, immediate service delivery
   
2. **Walk-in heavy** (NOT deposit-first)
   - Spa: Deposit → contract → sessions
   - Haircut: Walk-in → queue → immediate service
   
3. **Simpler lifecycle**
   - Spa: Complex (inquiry, deposit, contract, sessions)
   - Haircut: Linear (arrive → service → pay → leave)

**Haircut Temporal:**
- Appointment time (scheduled bookings)
- Walk-in queue (IWaitlistEngine)
- Service duration (30-60 minutes typical)
- NO multi-session tracking

**Haircut Financials:**
- Simpler (service price, NO deposit required)
- Pay after service (NOT upfront deposit)
- NO contract signing

---

### Nail Requirements (Projected)

**Projected Nail Flow:**
```
walk-in/appointment → confirmed → in-service → completed | cancelled
```

**Expected Similarities to Haircut:**
- Single-visit service
- Walk-in or appointment
- Pay after service
- Simpler lifecycle than Spa

**Expected Differences:**
- Longer service duration (60-120 minutes for nail art)
- May require deposit for complex nail art (projected)
- Equipment/supply tracking (nail polish, tools)

---

### Domain Reconciliation

**Common Capability: Appointment Lifecycle**

```typescript
// Domain concept (generic)
interface AppointmentLifecycle {
  // States
  status: 'pending' | 'confirmed' | 'in-service' | 'completed' | 'cancelled';
  
  // Temporal
  scheduledDate: Date;
  scheduledTime: string;
  estimatedDuration: number; // minutes
  actualStartTime?: Timestamp;
  actualEndTime?: Timestamp;
  
  // Parties
  customerId: UUID;
  serviceId: UUID;
  
  // Financials (optional)
  estimatedPrice?: Decimal;
  actualPrice?: Decimal;
  depositAmount?: Decimal; // Spa/Nail may require
  
  // Metadata
  appointmentType: 'scheduled' | 'walk-in';
  metadata?: Record<string, unknown>;
}
```

**Mapping:**

| Domain Concept     | Spa Implementation       | Haircut Implementation | Nail Projection     |
| ------------------ | ------------------------ | ---------------------- | ------------------- |
| Appointment        | Booking                  | Appointment            | Appointment         |
| Status             | inquiry/booked/completed | pending/confirmed/done | pending/done        |
| Temporal           | start_date + preferred_time | appointmentDateTime | appointmentDateTime |
| Service            | package_id (multi-session) | service_id (single)  | service_id (single) |
| Financial          | deposit + full_price     | service_price          | service_price       |
| Multi-session      | ✅ (total/completed)     | ❌ (single visit)      | ❌ (single visit)   |

**Key Abstraction:**
- ✅ Core appointment lifecycle is generic (schedule → service → complete)
- ✅ Multi-session tracking is Spa-specific extension (NOT core capability)
- ✅ Deposit requirement is optional (Spa requires, Haircut may not)
- ✅ State complexity varies (Spa complex, Haircut simple)

**Conclusion for Boundary 1:**
**Appointment Lifecycle = Core capability (independent contract candidate)**

---

## Boundary Question 2: Professional Assignment

### Spa Evidence (Phase 1)

**Implementation:**
- `assigned_ktv_id` (nullable FK in bookings table)
- Updated via `updateBooking()` action
- NO separate assignment table
- NO assignment lifecycle states
- NO assignment history

**Business Logic:**
- Customer can prefer specific KTV
- VIP customers require senior KTVs
- Workload balancing across KTVs
- Skill matching (required skills check)

---

### Haircut Requirements (Domain Analysis Needed)

**Questions to Answer:**

**Q1: Assignment Persistence**
- Haircut stores `assigned_stylist_id` in appointments table? (Same as Spa)
- OR separate `stylist_assignments` table with lifecycle?

**Q2: Assignment Lifecycle**
- Simple nullable FK (assign once, clear once)?
- OR stateful (requested → assigned → accepted → rejected → reassigned)?

**Q3: Assignment Rules**
- Customer preference (same as Spa)?
- Stylist skill matching (same as Spa)?
- Stylist availability (same as Spa)?
- Workload balancing (same as Spa)?

**Q4: Reassignment**
- Can customer request different stylist mid-service?
- Can stylist reject assignment?
- Can manager reassign due to no-show?

**Q5: Assignment History**
- Track assignment changes over time?
- Audit trail for reassignments?

---

### Expected Haircut Pattern (Hypothesis)

**Hypothesis A: Simple FK (Same as Spa)**
```typescript
interface HaircutAppointment {
  assigned_stylist_id: UUID | null; // Nullable FK
  // Assignment via updateAppointment()
}
```

**Evidence Needed:**
- Haircut stylist assignment process
- Reassignment scenarios
- Customer stylist preference handling

**If Hypothesis A true:**
- Professional assignment = appointment attribute
- NO separate contract needed

---

**Hypothesis B: Stateful Assignment (Richer than Spa)**
```typescript
interface StylistAssignment {
  id: UUID;
  appointment_id: UUID;
  stylist_id: UUID;
  status: 'requested' | 'assigned' | 'accepted' | 'rejected' | 'reassigned';
  requested_at: Timestamp;
  assigned_at: Timestamp;
  accepted_at?: Timestamp;
  rejected_reason?: string;
}
```

**Evidence Needed:**
- Does Haircut need stylist acceptance?
- Does stylist have autonomy to reject?
- Is assignment history business-critical?

**If Hypothesis B true:**
- Professional assignment = separate capability
- Separate contract justified

---

### Nail Requirements (Projected)

**Expected Pattern:** Similar to Haircut (technician instead of stylist)

**Projected Questions:**
- Nail technician assignment = simple FK?
- Technician specialization (nail art, manicure, pedicure)?
- Customer preference for technician?
- Reassignment scenarios?

---

### Domain Reconciliation (Pending Evidence)

**Cannot Reconcile Without Haircut Requirements**

**Decision Tree:**
```
IF Haircut = simple FK (no lifecycle, no history)
  AND Nail = simple FK (projected)
  THEN Professional Assignment = Appointment attribute
       → IAppointmentEngine.assignProfessional() method
       → NO separate IProfessionalAssignment contract

ELSE IF Haircut = stateful lifecycle OR needs history
  OR Nail = different pattern
  THEN Professional Assignment = separate capability
       → IProfessionalAssignment contract
       → IAppointmentEngine references assignment
```

**Current Status: PENDING HAIRCUT EVIDENCE**

---

## Boundary Question 3: Professional Recommendation

### Spa Evidence (Phase 1)

**Implementation:**
- AutoAssignmentProvider (Decision Engine provider)
- Stateless scoring/ranking service
- Returns recommendation (does NOT persist)
- Scoring: skill match + availability + workload + performance + preference + specialization

**Architecture:**
- Provider pattern (Decision Engine)
- Business logic encapsulation
- Recommendation ≠ Assignment

---

### Haircut Requirements (Domain Analysis Needed)

**Questions to Answer:**

**Q1: Recommendation Necessity**
- Does Haircut need automatic stylist recommendation?
- OR customer always chooses stylist manually?
- OR walk-ins auto-assigned to available stylist?

**Q2: Recommendation Complexity**
- Simple (next available stylist)?
- OR complex (skill matching, workload, performance)?

**Q3: Recommendation Rules**
- Similar to Spa (skill, availability, workload)?
- OR different factors (stylist portfolio, customer history)?

---

### Expected Haircut Pattern (Hypothesis)

**Hypothesis A: No Recommendation Needed**
- Customer chooses stylist from available list
- Walk-ins assigned to next available stylist (simple queue)

**If Hypothesis A true:**
- NO recommendation service needed
- Simple availability query

---

**Hypothesis B: Recommendation Needed (Similar to Spa)**
- Customer without preference → recommend stylist
- Walk-ins → auto-assign based on skill + workload

**If Hypothesis B true:**
- Recommendation service needed
- Helper service pattern (same as Spa)
- NOT a Platform contract (service, not capability)

---

### Domain Reconciliation (Pending Evidence)

**Pattern Options:**

**Option A: Recommendation as Helper Service**
```typescript
// Helper service (NOT contract)
class ProfessionalRecommendationService {
  recommendProfessional(
    criteria: RecommendationCriteria
  ): RecommendedProfessional[];
}
```

**Option B: Recommendation as Policy/Rules**
```typescript
// Decision Engine policy
interface ProfessionalMatchingPolicy {
  rules: AssignmentRule[];
  evaluate(context: AssignmentContext): ScoredCandidate[];
}
```

**Option C: No Recommendation (Manual Selection)**
```typescript
// Simple availability query
interface IAppointmentEngine {
  getAvailableProfessionals(
    date: Date,
    time: string,
    serviceId: UUID
  ): Professional[];
}
```

**Current Status: PENDING HAIRCUT EVIDENCE**

**Preliminary Assessment:**
- Recommendation likely remains helper service (NOT contract)
- Reasoning: Business logic, NOT capability ownership
- Domain primitives: Professional, Availability (separate concerns)

---

## Boundary Question 4: Resource Allocation

### Spa Evidence (Phase 1)

**Implementation:**
- `assigned_bed_id`, `assigned_room_id` (nullable FKs in bookings table)
- `required_equipment_ids` (JSONB array in bookings table)
- Conflict detection via `checkBookingConflicts()` helper
- NO separate allocation table
- NO allocation lifecycle

**Resources:**
- Beds (`beds` table): bed_number, room_id, status
- Rooms (`rooms` table): room_number, capacity, room_type, status
- Equipment (`equipment` table): equipment_code, quantity, status

**Conflict Rules:**
- Same bed + overlapping time = conflict
- Same room + overlapping time = conflict
- Equipment quantity exhausted = conflict

---

### Haircut Requirements (Domain Analysis Needed)

**Questions to Answer:**

**Q1: Resource Types**
- Chair/station allocation required?
- Equipment tracking (clippers, scissors, dryers)?
- Room allocation (private rooms for VIP)?

**Q2: Allocation Persistence**
- Simple FK in appointments table (same as Spa)?
- OR separate `resource_allocations` table with lifecycle?

**Q3: Allocation Lifecycle**
- Assign → release (simple)?
- OR reserved → allocated → in-use → released (stateful)?

**Q4: Allocation Rules**
- Conflict detection (same time + same resource)?
- Capacity management (multiple chairs per station)?
- Maintenance windows (chair unavailable)?
- Reassignment scenarios (chair broken mid-service)?

**Q5: Allocation Complexity**
- Single resource per appointment (1 chair)?
- OR multiple resources (chair + tools)?
- Resource pooling (shared equipment)?

---

### Expected Haircut Pattern (Hypothesis)

**Hypothesis A: Simple FK (Same as Spa)**
```typescript
interface HaircutAppointment {
  assigned_chair_id: UUID | null; // Nullable FK
  // No separate allocation lifecycle
}
```

**If Hypothesis A true:**
- Resource allocation = appointment attribute
- NO separate contract needed

---

**Hypothesis B: Stateful Allocation (Richer than Spa)**
```typescript
interface ResourceAllocation {
  id: UUID;
  appointment_id: UUID;
  resource_id: UUID;
  resource_type: 'chair' | 'station' | 'equipment';
  status: 'reserved' | 'allocated' | 'in-use' | 'released';
  allocated_at: Timestamp;
  released_at?: Timestamp;
  conflict_checked: boolean;
}
```

**If Hypothesis B true:**
- Resource allocation = separate capability
- Separate contract justified
- Lifecycle: reserve → allocate → release
- Conflict detection embedded in allocation

---

**Hypothesis C: Complex Resource Management**

**Scenarios Suggesting Complexity:**
1. **Capacity Management**
   - Multiple stylists share equipment
   - Equipment quantity tracking (5 clippers, 2 in use)
   - Reservation windows (reserve 15 min before appointment)

2. **Maintenance/Availability**
   - Chair unavailable due to maintenance
   - Equipment repair tracking
   - Status transitions (available → maintenance → broken → available)

3. **Reassignment**
   - Chair broken mid-service → reallocate
   - Equipment not available → substitute

4. **Cross-Appointment Dependencies**
   - Equipment shared across appointments
   - Conflict resolution beyond simple time overlap

**If Hypothesis C true:**
- Resource allocation = rich capability
- Separate `IResourceAllocation` contract justified
- Operations: reserve(), allocate(), release(), checkConflicts(), substituteResource()

---

### Nail Requirements (Projected)

**Expected Resources:**
- Nail stations/tables (similar to Haircut chairs)
- Equipment (UV lamps, tools, polish)
- Potentially more complex than Haircut (supply tracking)

**Projected Pattern:**
- Station allocation (simple FK likely)
- Equipment tracking (quantity-based, similar to Spa)

---

### Domain Reconciliation (Pending Evidence)

**Decision Tree:**
```
IF Haircut = simple FK (no lifecycle, no capacity)
  AND Nail = simple FK (projected)
  AND NO maintenance/reassignment requirements
  THEN Resource Allocation = Appointment attribute
       → IAppointmentEngine.assignResources() method
       → NO separate IResourceAllocation contract

ELSE IF Haircut = stateful lifecycle
  OR capacity management needed
  OR maintenance/reassignment scenarios exist
  OR cross-appointment dependencies
  THEN Resource Allocation = separate capability
       → IResourceAllocation contract
       → IAppointmentEngine references allocations
```

**Current Status: PENDING HAIRCUT EVIDENCE**

**Critical Questions for Haircut:**
1. Is chair allocation time-critical (reserve vs allocate)?
2. Is equipment tracking needed (quantity, maintenance)?
3. Are reassignment scenarios business-critical?
4. Is conflict detection complex (beyond simple time overlap)?

---

## Phase 2 Status: BLOCKED — Haircut Requirements Needed

### What We Know (Spa Evidence)

**Appointment Lifecycle:**
- ✅ Core capability identified
- ✅ Generic abstraction exists
- ✅ Spa = complex, Haircut/Nail = simpler (projected)
- ✅ **Conclusion: Independent capability (contract candidate)**

---

### What We DON'T Know (Haircut Evidence Missing)

**Professional Assignment:**
- ❓ Simple FK or stateful lifecycle?
- ❓ Assignment history required?
- ❓ Reassignment scenarios exist?
- ⏸️ **Decision: CANNOT DETERMINE** (need Haircut requirements)

**Professional Recommendation:**
- ❓ Recommendation needed?
- ❓ Recommendation complexity?
- ❓ Manual selection or auto-assignment?
- ⏸️ **Decision: CANNOT DETERMINE** (need Haircut requirements)

**Resource Allocation:**
- ❓ Simple FK or stateful lifecycle?
- ❓ Capacity management needed?
- ❓ Maintenance/reassignment scenarios?
- ❓ Conflict detection complexity?
- ⏸️ **Decision: CANNOT DETERMINE** (need Haircut requirements)

---

## Critical Haircut Requirements to Gather

### 1. Professional Assignment Requirements

**Questions:**
- [ ] How does customer select stylist? (manual choice, preference, auto-assign)
- [ ] Can customer change stylist after booking?
- [ ] Can stylist reject assignment?
- [ ] Is assignment history tracked?
- [ ] Are reassignment scenarios common?

**Impact:** Determines if `IProfessionalAssignment` is separate contract or absorbed into `IAppointmentEngine`.

---

### 2. Resource Allocation Requirements

**Questions:**
- [ ] What resources need allocation? (chairs, stations, equipment)
- [ ] Is chair allocation persistent (stored) or transient (in-memory)?
- [ ] Are chairs numbered/identified (chair #1, #2)?
- [ ] Is equipment tracking needed (clippers, scissors quantities)?
- [ ] Are maintenance windows required (chair unavailable)?
- [ ] Can resources be reassigned mid-service?
- [ ] Is conflict detection beyond simple time overlap needed?

**Impact:** Determines if `IResourceAllocation` is separate contract or absorbed into `IAppointmentEngine`.

---

### 3. Recommendation Requirements

**Questions:**
- [ ] Is automatic stylist recommendation needed?
- [ ] What factors influence recommendation? (skill, availability, workload, rating)
- [ ] Do walk-ins require auto-assignment?
- [ ] Is recommendation different from assignment?

**Impact:** Determines if recommendation is helper service, policy engine, or embedded logic.

---

## Possible Phase 3 Outcomes (TBD)

### Outcome A: Monolithic Appointment

**If:** Haircut assignment/allocation = simple FKs (same as Spa)

```typescript
interface IAppointmentEngine {
  // Lifecycle
  createAppointment(input: CreateAppointmentInput): Appointment;
  confirmAppointment(id: UUID): Appointment;
  cancelAppointment(id: UUID): Appointment;
  
  // Professional assignment (embedded)
  assignProfessional(appointmentId: UUID, professionalId: UUID): void;
  clearProfessionalAssignment(appointmentId: UUID): void;
  
  // Resource assignment (embedded)
  assignResources(appointmentId: UUID, resourceIds: UUID[]): void;
  clearResourceAssignments(appointmentId: UUID): void;
  
  // Queries
  getAppointment(id: UUID): Appointment;
  listAppointments(filters: AppointmentFilters): Appointment[];
}

// Helper services (NOT contracts)
- ProfessionalRecommendationService
- ResourceConflictDetectionService
```

**Contract Inventory Impact:** 8 → 6 (IStaffAssignment + IResourceAllocation absorbed)

---

### Outcome B: Appointment + Separate Assignment

**If:** Haircut assignment = stateful lifecycle OR history required

```typescript
interface IAppointmentEngine {
  // Lifecycle only
  createAppointment(input: CreateAppointmentInput): Appointment;
  confirmAppointment(id: UUID): Appointment;
  cancelAppointment(id: UUID): Appointment;
  
  // References professional/resource contracts
  getAppointment(id: UUID): Appointment; // includes assignment references
}

interface IProfessionalAssignment {
  assignProfessional(appointmentId: UUID, professionalId: UUID): Assignment;
  reassignProfessional(assignmentId: UUID, newProfessionalId: UUID): Assignment;
  clearAssignment(assignmentId: UUID): void;
  getAssignmentHistory(appointmentId: UUID): Assignment[];
}

interface IResourceAllocation {
  allocateResources(appointmentId: UUID, resourceIds: UUID[]): Allocation;
  releaseResources(allocationId: UUID): void;
  checkConflicts(resourceId: UUID, timeRange: TimeRange): Conflict[];
}
```

**Contract Inventory Impact:** 8 contracts (no change)

---

### Outcome C: Appointment + Assignment + Recommendation

**If:** Recommendation is rich enough to be contract (unlikely)

```typescript
interface IAppointmentEngine {
  // Lifecycle
  createAppointment(): Appointment;
}

interface IProfessionalAssignment {
  // Assignment persistence + lifecycle
}

interface IProfessionalMatching {
  // Recommendation/matching capability
  matchProfessional(criteria: MatchingCriteria): ScoredProfessional[];
  evaluateCompatibility(professionalId: UUID, customerId: UUID): Score;
}
```

**Contract Inventory Impact:** 8 → 9 (new contract added)

---

## Next Steps

### 1. Gather Haircut Requirements

**Method:** Interview Product/UX, review Haircut PRD, analyze Haircut user stories

**Target Questions:** See "Critical Haircut Requirements to Gather" section above

**Output:** Haircut requirements document (professional assignment, resource allocation, recommendation)

---

### 2. Validate Nail Projection

**Method:** Compare Nail projected requirements with Haircut actual requirements

**Output:** Nail projection validation (assumptions confirmed or revised)

---

### 3. Complete Domain Reconciliation

**Method:** Map Spa + Haircut + Nail concepts → domain model

**Output:** Domain model with capability boundaries (4 boundaries resolved)

---

### 4. Design Target Contracts (Phase 3)

**Method:** Based on domain model, design contract interfaces

**Output:** Target contract design with validated boundaries

---

## Summary

**Phase 1 Complete:**
- ✅ Spa legacy implementation documented
- ✅ Assignment = booking attribute (Spa pattern identified)
- ✅ Recommendation = helper service (Spa pattern identified)
- ✅ Resource allocation = booking attribute (Spa pattern identified)

**Phase 2 Status:**
- ✅ Appointment lifecycle reconciled (core capability confirmed)
- ⏸️ Professional assignment boundary PENDING (Haircut requirements needed)
- ⏸️ Professional recommendation boundary PENDING (Haircut requirements needed)
- ⏸️ Resource allocation boundary PENDING (Haircut requirements needed)

**Key Insight:**
> **Spa evidence shows "how Spa did it", NOT "how Platform must do it".**
> 
> Domain reconciliation requires ACTUAL Haircut requirements, NOT assumptions based on Spa legacy.

**Contract Inventory Status:**
- IWaitlistEngine: EXTRACTED (Platform Candidate)
- IServiceCatalog: EXTRACTED (Platform Candidate)
- IStaffAssignment: **UNDER RECONCILIATION** (boundary decision pending)
- IAppointmentEngine: **UNDER RECONCILIATION** (Phase 2 incomplete)
- IResourceAllocation (H1 Contract #7): **UNDER RECONCILIATION** (boundary decision pending)
- Denominator: **8 (unchanged)** — do NOT change until Phase 3 complete

**Blocker:** Haircut requirements missing (professional assignment, resource allocation, recommendation)

---

**Document Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ⏸️ **BLOCKED — HAIRCUT REQUIREMENTS NEEDED**  
**Next:** Gather Haircut requirements → Complete domain reconciliation → Phase 3 target design
