# Haircut Minimum Domain Requirements — Boundary Decision Evidence

**Date:** 2026-09-15  
**Status:** 📋 **PROPOSED REQUIREMENTS** (NOT YET VALIDATED)  
**Purpose:** Unblock H2 Phase 2 domain reconciliation with minimum viable requirements

---

## Purpose

H2 Phase 2 is BLOCKED waiting for Haircut requirements.

**Goal:** Define **minimum domain requirements** for Haircut to resolve 3 boundary questions:
1. Professional Assignment (separate contract or appointment attribute?)
2. Professional Recommendation (capability, policy, or helper?)
3. Resource Allocation (separate contract or appointment attribute?)

**Non-Goal:** Full Haircut product specification (out of scope for H2)

---

## Status: PROPOSED (Not Validated)

**⚠️ CRITICAL:**
- These are **proposed requirements** based on typical haircut salon operations
- **NOT yet validated** with Product/UX/Business stakeholders
- **NOT proven** by actual Haircut implementation
- Used to **unblock** Phase 2 domain reconciliation
- Must be **validated** before Phase 3 contract design

**Evidence Level:** PROPOSED (hypothetical business scenarios)

---

## Proposed Haircut Minimum Requirements

### Requirement 1: Professional Assignment

**Business Context:** Haircut salon with multiple stylists/barbers

**Proposed Requirements:**

**R1.1: Customer Stylist Selection**
- Customer CAN choose specific stylist when booking
- Customer CAN leave stylist unassigned (system assigns)
- Customer preference is OPTIONAL (not mandatory)

**R1.2: Stylist Reassignment**
- Customer CAN change stylist before appointment starts
- Stylist CAN be reassigned by manager (sick leave, no-show, etc.)
- Reassignment is business-critical capability (not exceptional case)

**R1.3: Stylist Availability**
- System MUST check stylist availability before assignment
- Stylist unavailability (day off, full capacity) BLOCKS assignment
- Conflict detection required (same stylist + overlapping time)

**Implication:** Assignment may need lifecycle (requested → assigned → reassigned) OR history tracking.

---

### Requirement 2: Professional Recommendation

**Business Context:** Walk-in customers or customers without preference

**Proposed Requirements:**

**R2.1: Automatic Recommendation**
- System SHOULD recommend stylist when customer has no preference
- Walk-in customers REQUIRE auto-assignment (no time for manual selection)

**R2.2: Recommendation Criteria**
- Service compatibility (stylist can perform requested service)
- Availability (stylist not at capacity, not on break)
- Workload balancing (distribute appointments evenly)
- Customer preference history (previous stylist if available)
- OPTIONAL: Skill level, rating, seniority

**R2.3: Recommendation vs Assignment**
- Recommendation DOES NOT persist assignment
- Recommendation returns candidate list (system or user persists)
- Multiple recommendations possible (top 3 candidates)

**Implication:** Recommendation is stateless business logic (helper service or policy), NOT persistence capability.

---

### Requirement 3: Resource Allocation

**Business Context:** Haircut salon with physical chairs/stations

**Proposed Requirements:**

**R3.1: Chair/Station Allocation**
- Each appointment REQUIRES one chair/station
- Chair/station assignment is PERSISTENT (stored, not transient)
- Chair/station identifier exists (Chair #1, Station A, etc.)

**R3.2: Resource Conflict Detection**
- Same chair + overlapping time = CONFLICT (block appointment)
- Conflict check is MANDATORY before appointment confirmation

**R3.3: Resource Maintenance/Unavailability**
- Chair/station CAN be unavailable (maintenance, broken, cleaning)
- Unavailability is time-based (9:00-10:00 maintenance window)
- System MUST respect unavailability when allocating

**R3.4: Resource Reassignment**
- Chair/station CAN be changed before appointment starts
- Reassignment scenarios:
  - Original chair broken/unavailable
  - Customer preference (VIP requests specific area)
  - Manager optimization (move to larger/smaller station)

**Implication:** Resource allocation may have lifecycle (reserved → allocated → released) and availability state.

---

### Requirement 4: Appointment Lifecycle

**Business Context:** Customer booking and service delivery flow

**Proposed Lifecycle:**

```
pending (booking created, not confirmed)
    ↓
confirmed (customer/system confirmed, payment may be required)
    ↓
checked-in (customer arrived at salon)
    ↓
in-service (stylist started service)
    ↓
completed (service finished, payment done)

(Any non-terminal state)
    ↓
cancelled (customer cancelled) | no-show (customer didn't arrive)
```

**State Transitions:**
- `pending → confirmed` (confirmation action)
- `confirmed → checked-in` (customer arrival)
- `checked-in → in-service` (stylist starts work)
- `in-service → completed` (service delivery finished)
- `* → cancelled` (customer cancels)
- `confirmed → no-show` (customer didn't arrive)

**Implication:** Appointment has clear lifecycle independent of assignment/allocation.

---

## 6 Critical Use Cases for Boundary Decision

### Use Case 1: Customer Books Without Stylist Selection

**Scenario:**
```
1. Customer creates appointment (service: haircut, time: 2pm today)
2. Customer does NOT select stylist (leaves blank)
3. System needs to assign stylist
```

**Questions:**
- WHO assigns stylist? (Appointment engine? Assignment capability? Manager manually?)
- WHEN is stylist assigned? (immediately? at check-in? on demand?)
- HOW is stylist selected? (recommendation algorithm? first available? manual?)

**Proposed Answer:**
- System recommends stylist via **recommendation service**
- Appointment persists assignment via **assignment capability**
- Assignment happens at booking confirmation (not at check-in)

**Boundary Impact:**
- Recommendation = helper service (business logic, no persistence)
- Assignment = capability (owns persistence, may be appointment attribute or separate)

---

### Use Case 2: Customer Requests Busy Stylist

**Scenario:**
```
1. Customer requests Stylist A for 2pm today
2. Stylist A already has appointment at 2pm
3. System detects conflict
```

**Questions:**
- WHO detects conflict? (Appointment? Assignment? Recommendation?)
- WHAT happens? (reject booking? suggest alternative? override with manager approval?)
- WHERE is conflict rule? (appointment validation? assignment validation? recommendation filter?)

**Proposed Answer:**
- **Assignment capability** checks stylist availability
- Conflict detected at assignment persistence time
- System rejects assignment, suggests alternatives via recommendation

**Boundary Impact:**
- Assignment capability owns conflict detection (stylist availability check)
- Recommendation provides alternatives (filtered by availability)
- Appointment does NOT own stylist conflict logic

---

### Use Case 3: Stylist Sick Leave (Reassignment)

**Scenario:**
```
1. Stylist A has 5 appointments today (9am, 10am, 11am, 2pm, 3pm)
2. Stylist A calls in sick at 8:30am
3. Manager needs to reassign all appointments
```

**Questions:**
- WHO handles reassignment? (Appointment updates? Assignment capability? Manual?)
- HOW is reassignment logged? (history tracking? audit trail?)
- WHAT happens if no replacement available? (cancel appointments? waitlist?)

**Proposed Answer:**
- **Assignment capability** handles reassignment (separate operation)
- Assignment history tracked (original: Stylist A, reassigned: Stylist B, reason: sick leave)
- If no replacement: appointments moved to waitlist or cancelled

**Boundary Impact:**
- Assignment capability needs reassignment operation (NOT just update)
- Assignment history suggests separate capability (not simple FK)
- Appointment lifecycle independent of assignment (appointment exists, assignment changes)

---

### Use Case 4: Double Booking (Stylist Conflict)

**Scenario:**
```
1. Appointment X: Stylist A, 2:00pm-2:30pm
2. Appointment Y: Stylist A, 2:15pm-2:45pm (overlapping)
3. System must prevent double booking
```

**Questions:**
- WHO enforces conflict rule? (Appointment? Assignment?)
- WHEN is conflict checked? (at booking? at assignment? at confirmation?)
- HOW is conflict resolved? (reject second booking? suggest different time/stylist?)

**Proposed Answer:**
- **Assignment capability** enforces stylist conflict (availability check)
- Conflict checked at assignment persistence time
- System blocks assignment, triggers recommendation for alternatives

**Boundary Impact:**
- Stylist conflict = assignment concern (NOT appointment concern)
- Appointment does NOT own stylist scheduling rules
- Assignment capability has conflict detection responsibility

---

### Use Case 5: Chair Conflict (Resource Double Booking)

**Scenario:**
```
1. Appointment X: Chair #1, 2:00pm-2:30pm
2. Appointment Y: Chair #1, 2:15pm-2:45pm (overlapping)
3. System must prevent chair double booking
```

**Questions:**
- WHO enforces resource conflict? (Appointment? Resource Allocation? Assignment?)
- WHEN is conflict checked? (at booking? at allocation? at confirmation?)
- HOW is conflict different from stylist conflict? (same logic? separate rules?)

**Proposed Answer:**
- **Resource Allocation capability** enforces resource conflict
- Conflict checked at allocation persistence time
- Resource conflict rules MAY differ from stylist conflict (capacity, maintenance windows)

**Boundary Impact:**
- Resource conflict = allocation concern (NOT appointment concern)
- If resource allocation mirrors assignment pattern → suggests separate capability
- Appointment does NOT own resource scheduling rules

---

### Use Case 6: Chair Maintenance (Resource Unavailability)

**Scenario:**
```
1. Manager schedules Chair #1 maintenance (10:00am-11:00am today)
2. Customer tries to book appointment at 10:30am
3. Chair #1 is unavailable
```

**Questions:**
- WHO owns chair availability? (Resource entity? Allocation capability? Appointment?)
- HOW is unavailability represented? (status field? time-based reservation?)
- WHERE is unavailability checked? (allocation validation? appointment validation?)

**Proposed Answer:**
- **Resource entity** has availability state (active | maintenance | broken)
- **Resource Allocation capability** checks availability before allocation
- Unavailability blocks allocation (suggests alternative resources)

**Boundary Impact:**
- Resource has lifecycle independent of appointment
- Resource Allocation capability owns availability rules
- Strong signal for separate **IResourceAllocation** contract

---

## Boundary Decision Matrix

| Use Case | Appointment Owns? | Assignment Owns? | Allocation Owns? | Recommendation Owns? |
|----------|-------------------|------------------|------------------|---------------------|
| UC1: No stylist selected | ❌ No | ✅ Persist assignment | ❌ No | ✅ Recommend candidates |
| UC2: Busy stylist | ❌ No | ✅ Conflict detection | ❌ No | ✅ Filter available |
| UC3: Reassignment | ❌ No (lifecycle unaffected) | ✅ Reassign operation | ❌ No | ✅ Recommend replacement |
| UC4: Stylist conflict | ❌ No | ✅ Enforce conflict | ❌ No | ❌ No |
| UC5: Chair conflict | ❌ No | ❌ No | ✅ Enforce conflict | ❌ No |
| UC6: Chair unavailable | ❌ No | ❌ No | ✅ Check availability | ❌ No |

---

## Preliminary Boundary Assessment

### 1. Appointment Lifecycle

**Assessment:** ✅ **INDEPENDENT CAPABILITY**

**Evidence:**
- Appointment has clear lifecycle (pending → confirmed → in-service → completed)
- Lifecycle independent of assignment/allocation (appointment exists even if unassigned)
- Lifecycle operations: create, confirm, check-in, complete, cancel

**Conclusion:** **IAppointmentEngine** is core contract (confirmed).

---

### 2. Professional Assignment

**Assessment:** 🟡 **LIKELY SEPARATE CAPABILITY** (needs validation)

**Evidence FOR Separation:**
- Reassignment is business-critical (UC3: sick leave scenarios)
- Assignment history may be required (audit trail for reassignments)
- Conflict detection logic belongs to assignment (UC4: stylist availability)
- Assignment lifecycle suggested (requested → assigned → reassigned)

**Evidence AGAINST Separation:**
- Could be modeled as simple FK with reassignment = update operation
- Spa legacy uses simple FK (no separate table)

**Preliminary Conclusion:** **IProfessionalAssignment** separate contract (TENTATIVE).

**Validation Needed:**
- Is assignment history business-critical? (audit, compliance, analytics)
- Are reassignment scenarios frequent enough to justify separate capability?
- Does assignment have state beyond FK reference? (requested, accepted, rejected)

---

### 3. Professional Recommendation

**Assessment:** ✅ **HELPER SERVICE** (NOT contract)

**Evidence:**
- Stateless business logic (scoring, filtering, ranking)
- Does NOT own data (no recommendation entity persisted)
- Returns candidates (caller persists assignment)
- Similar to Spa AutoAssignmentProvider pattern

**Conclusion:** Recommendation is **helper service or policy engine** (NOT Platform contract).

**Pattern:**
```typescript
// Helper service (NOT contract)
class ProfessionalRecommendationService {
  recommendProfessionals(
    criteria: RecommendationCriteria,
    candidates: Professional[]
  ): ScoredProfessional[];
}
```

---

### 4. Resource Allocation

**Assessment:** 🟡 **LIKELY SEPARATE CAPABILITY** (needs validation)

**Evidence FOR Separation:**
- Resource has availability lifecycle (active | maintenance | broken)
- Resource conflict detection is distinct from stylist conflict (UC5 vs UC4)
- Resource unavailability is time-based (maintenance windows)
- Resource reassignment scenarios exist (chair broken mid-service)

**Evidence AGAINST Separation:**
- Could be modeled as simple FK (same as Spa beds/rooms)
- Conflict detection could be appointment validation rule

**Preliminary Conclusion:** **IResourceAllocation** separate contract (TENTATIVE).

**Validation Needed:**
- Are maintenance windows business-critical?
- Are resource reassignments frequent?
- Does resource have state beyond FK reference? (reserved, allocated, released)
- Is capacity management needed? (multiple stylists share tools)

---

## Proposed Architecture (TENTATIVE)

### Option A: Separate Capabilities (If UC3/UC5/UC6 Validated)

```
┌─────────────────────┐
│ IAppointmentEngine  │
│                     │
│ - Lifecycle         │
│ - Customer          │
│ - Service           │
│ - Temporal          │
│ - References:       │
│   - assignment_id   │
│   - allocation_id   │
└─────────────────────┘
         │
         ├─────────────┐
         ↓             ↓
┌──────────────────────┐  ┌──────────────────────┐
│ IProfessionalAssignment│  │ IResourceAllocation  │
│                      │  │                      │
│ - assign()           │  │ - allocate()         │
│ - reassign()         │  │ - release()          │
│ - checkConflicts()   │  │ - checkConflicts()   │
│ - getHistory()       │  │ - checkAvailability()│
└──────────────────────┘  └──────────────────────┘
         ↑                         ↑
         │                         │
         └─────────┬───────────────┘
                   ↓
      ┌────────────────────────┐
      │ Recommendation Service │
      │ (Helper, NOT contract) │
      └────────────────────────┘
```

**Contract Inventory Impact:** 8 contracts (no change from H1 baseline)

---

### Option B: Appointment-Owned (If UC3/UC5/UC6 NOT Critical)

```
┌─────────────────────────────────┐
│ IAppointmentEngine              │
│                                 │
│ - Lifecycle                     │
│ - assignProfessional()          │
│ - assignResource()              │
│ - checkProfessionalConflicts()  │
│ - checkResourceConflicts()      │
└─────────────────────────────────┘
         ↑
         │
         └─────────────────────────┐
                   ↓
      ┌────────────────────────┐
      │ Recommendation Service │
      │ (Helper, NOT contract) │
      └────────────────────────┘
```

**Contract Inventory Impact:** 8 → 6 contracts (IStaffAssignment + IResourceAllocation absorbed)

---

## Validation Required

### Critical Questions for Product/UX Stakeholders

**Professional Assignment:**
- [ ] Is stylist reassignment a frequent scenario? (daily? weekly? rare?)
- [ ] Is assignment history required for business/compliance? (audit trail)
- [ ] Can stylists reject assignments? (acceptance workflow)
- [ ] Are no-show scenarios tracked per stylist? (stylist accountability)

**Resource Allocation:**
- [ ] Are maintenance windows scheduled regularly? (weekly? monthly?)
- [ ] Are resource reassignments common? (chair broken scenarios)
- [ ] Is capacity management needed? (multiple stylists per chair? shared tools?)
- [ ] Are resource conflicts business-critical? (chairs more constrained than stylists?)

**Recommendation:**
- [ ] Is automatic recommendation required for walk-ins?
- [ ] What factors influence recommendation? (skill, rating, workload, preference)
- [ ] Are manual overrides allowed? (manager assigns specific stylist)

---

## Next Steps

### 1. Validate Requirements with Stakeholders

**Method:** Product/UX interview, review Haircut PRD, user story validation

**Target Questions:** See "Validation Required" section above

**Output:** Validated Haircut requirements (PROPOSED → VALIDATED)

---

### 2. Run 6 Use Cases Through Validated Requirements

**Method:** Trace each use case through validated requirements

**Output:** Boundary decision evidence (confirmed or revised)

---

### 3. Complete Phase 2 Domain Reconciliation

**Method:** Map validated Haircut requirements → domain model

**Output:** Final boundary decisions (3 boundaries resolved)

---

### 4. Proceed to Phase 3 Contract Design

**Method:** Design contract interfaces based on validated boundaries

**Output:** Target contracts with validated boundaries

---

## Summary

**Status:** PROPOSED REQUIREMENTS (not yet validated)

**Purpose:** Unblock H2 Phase 2 with minimum viable Haircut requirements

**Key Proposed Requirements:**
1. Stylist selection optional, reassignment supported
2. Automatic recommendation for walk-ins
3. Chair allocation with conflict detection
4. Maintenance/unavailability support

**Preliminary Assessment:**
- Appointment Lifecycle: ✅ Independent capability (IAppointmentEngine)
- Professional Assignment: 🟡 Likely separate (IProfessionalAssignment) — pending validation
- Professional Recommendation: ✅ Helper service (NOT contract)
- Resource Allocation: 🟡 Likely separate (IResourceAllocation) — pending validation

**6 Critical Use Cases:**
1. Customer books without stylist → tests recommendation + assignment boundary
2. Customer requests busy stylist → tests conflict detection ownership
3. Stylist sick leave → tests reassignment capability
4. Stylist double booking → tests assignment conflict rules
5. Chair double booking → tests allocation conflict rules
6. Chair maintenance → tests resource availability lifecycle

**Contract Inventory:** 8 (unchanged) — pending Phase 2 completion

**Validation Required:**
- Professional assignment: reassignment frequency, history requirement, acceptance workflow
- Resource allocation: maintenance windows, reassignment scenarios, capacity management
- Recommendation: walk-in auto-assignment, recommendation factors

**Next:** Validate requirements → Complete Phase 2 → Phase 3 design

---

**Document Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** 📋 **PROPOSED REQUIREMENTS** (NOT YET VALIDATED)  
**Next:** Stakeholder validation → Phase 2 completion
