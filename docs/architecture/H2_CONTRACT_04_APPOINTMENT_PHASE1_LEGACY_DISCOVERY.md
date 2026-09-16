# H2 Contract #4 — IAppointmentEngine Phase 1: Legacy Discovery

**Date:** 2026-09-15  
**Status:** 🔍 **LEGACY DISCOVERY IN PROGRESS**  
**Method:** ADR-007 3-Phase Extraction

---

## Purpose

Audit Bella Spa legacy booking implementation to understand:
1. **Booking entity** (schema, lifecycle, operations)
2. **Professional assignment** (how `assigned_ktv_id` works)
3. **Resource assignment** (rooms/beds allocation)
4. **Recommendation logic** (AutoAssignmentProvider)
5. **State machine** (booking lifecycle states)
6. **Dependencies** (what Booking consumes/provides)

**Goal:** Extract evidence for domain reconciliation (Phase 2), NOT copy Spa architecture.

---

## 1. Booking Entity Schema

### Core Table: `bookings`

**Initial Schema** (`20260511000000_initial_schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number TEXT UNIQUE NOT NULL,
    
    -- Customer & Service
    customer_id UUID REFERENCES customers(id) NOT NULL,
    package_id UUID,
    
    -- Lifecycle State
    status TEXT CHECK (status IN (
        'inquiry',
        'deposit_pending',
        'booked',
        'in_progress',
        'completed',
        'cancelled'
    )) DEFAULT 'inquiry',
    
    -- Financials
    deposit_amount DECIMAL DEFAULT 0,
    full_price DECIMAL DEFAULT 0,
    
    -- Temporal
    start_date DATE,
    end_date DATE,
    expected_birth_date DATE,  -- Spa-specific (maternity care)
    
    -- Session Tracking
    total_sessions INTEGER DEFAULT 21,
    completed_sessions INTEGER DEFAULT 0,
    
    -- Contract
    contract_signed BOOLEAN DEFAULT FALSE,
    contract_url TEXT,
    
    -- Professional Assignment
    assigned_ktv_id UUID REFERENCES users(id),
    
    -- Tenant Isolation (Gate 0)
    tenant_id UUID REFERENCES tenants(id),
    
    -- Audit Trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Additional Columns** (`20260515050000_fix_bookings_missing_columns.sql`):

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS ktv_commission BIGINT DEFAULT 150000,
  ADD COLUMN IF NOT EXISTS last_updated_date DATE,
  ADD COLUMN IF NOT EXISTS is_in_care BOOLEAN DEFAULT false;
```

**Resource Assignment** (`20260716120000_add_beauty_spa_resources.sql`):

```sql
-- Resource allocation columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS assigned_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL;

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS assigned_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS required_equipment_ids JSONB DEFAULT '[]'::jsonb;

-- Conflict detection indexes
CREATE INDEX IF NOT EXISTS idx_bookings_bed 
ON bookings(assigned_bed_id, start_date, status);

CREATE INDEX IF NOT EXISTS idx_bookings_room 
ON bookings(assigned_room_id, start_date, status);

CREATE INDEX IF NOT EXISTS idx_bookings_equipment 
ON bookings USING gin(required_equipment_ids);
```

---

### Complete Booking Schema (Current State)

```typescript
interface BookingEntity {
  // Identity
  id: UUID;
  booking_number: string; // Unique identifier (user-facing)
  tenant_id: UUID; // Tenant isolation (Gate 0)
  
  // Customer & Service
  customer_id: UUID;
  package_id: UUID | null;
  package_name?: string; // Denormalized for display
  
  // Lifecycle State
  status: 'inquiry' | 'deposit_pending' | 'booked' | 'in_progress' | 'completed' | 'cancelled';
  
  // Financials
  deposit_amount: Decimal;
  full_price: Decimal;
  ktv_commission: number; // Commission per session
  
  // Temporal
  start_date: Date | null;
  end_date: Date | null;
  preferred_time?: string; // HH:MM format
  expected_birth_date: Date | null; // Spa-specific
  
  // Session Tracking
  total_sessions: number;
  completed_sessions: number;
  
  // Contract
  contract_signed: boolean;
  contract_url: string | null;
  
  // Professional Assignment
  assigned_ktv_id: UUID | null; // NULLABLE (can be unassigned)
  
  // Resource Assignment (Beauty Spa)
  assigned_bed_id: UUID | null; // NULLABLE (may not need bed)
  assigned_room_id: UUID | null; // NULLABLE (may not need room)
  required_equipment_ids: UUID[]; // JSONB array
  
  // Care Status
  is_in_care: boolean; // Spa-specific (ongoing maternity care)
  last_updated_date: Date | null;
  
  // Metadata
  metadata?: Record<string, unknown>; // JSONB for extensibility
  
  // Audit Trail
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

---

## 2. Professional Assignment Capability

### 2.1. Assignment Field: `assigned_ktv_id`

**Ownership:** Booking entity (simple nullable foreign key)

**Characteristics:**
- ✅ Nullable (booking can exist without assigned KTV)
- ✅ No separate assignment table
- ✅ No assignment lifecycle states
- ✅ No assignment history tracking
- ✅ Updated via `updateBooking()` action

**Write Operations:**
```typescript
// Update assignment (src/core/services/order/update-booking-action.ts)
await supabase
  .from('bookings')
  .update({ assigned_ktv_id: ktvId })
  .eq('id', bookingId)
  .eq('tenant_id', tenantId);
```

**Evidence:** Assignment is **booking attribute**, NOT standalone entity.

---

### 2.2. Assignment Recommendation: `AutoAssignmentProvider`

**Location:** `src/lib/decision-engine/providers/booking/auto-assignment-provider.ts`

**Type:** Decision Engine Provider (recommendation service)

**Responsibilities:**
1. ✅ Filter eligible KTV candidates (skills, availability)
2. ✅ Score candidates (skill match, workload, performance, preference)
3. ✅ Rank candidates by score
4. ✅ Return recommended KTV + alternatives

**Key Characteristics:**
- ✅ **Stateless** (no instance state)
- ✅ **Read-only** (does NOT persist assignment)
- ✅ **Recommendation** (returns `assignedKtvId`, caller persists)
- ✅ **Business logic** (skill matching, workload balancing, VIP rules)

**Input:**
```typescript
interface AutoAssignmentInput {
  tenantId: string;
  booking: {
    customerId: string;
    serviceId: string;
    serviceType: string;
    requestedDate: string;
    requestedStartTime: string;
    durationMinutes: number;
  };
  customer: {
    tier: 'vip' | 'loyal' | 'new';
    preferredKtvId?: string;
    ktvHistory: Record<string, number>; // KTV booking counts
  };
  constraints: {
    minRating?: number;
  };
}
```

**Output:**
```typescript
interface AutoAssignmentOutput {
  success: boolean;
  assignedKtvId: string | null; // Recommended KTV (NOT persisted)
  confidence: number; // 0-100
  reason: string;
  matchedRules: string[]; // Decision Engine rules applied
  score: AssignmentScoreBreakdown;
  evaluationMetadata: {
    totalCandidates: number;
    eligibleCandidates: number;
    executionTime: number;
  };
  alternatives?: Array<{
    ktvId: string;
    score: number;
    reason: string;
  }>;
}
```

**Scoring Algorithm:**
```typescript
// Scoring breakdown (100 points total)
interface AssignmentScoreBreakdown {
  skillMatch: number;        // 25 points max
  availability: number;      // 20 points max
  workload: number;          // 15 points max
  performance: number;       // 20 points max
  preference: number;        // 10 points max
  specialization: number;    // 10 points max
  total: number;             // Sum of above
}
```

**Skill Matching Logic:**
```typescript
// calculateSkillMatchPercentage() - Line 352
// Required skills: 100% match required (hard filter)
// Specializations: Bonus for matching service category
// Example: VIP customer → requires senior KTV (rule-based)
```

**Key Methods:**
1. `filterEligibleCandidates()` — Hard filters (required skills, availability)
2. `scoreCandidate()` — Scoring logic (6 dimensions)
3. `evaluate()` — Main entry point (orchestrates filtering + scoring + ranking)

---

### 2.3. Assignment Caller: `autoAssignKtv()`

**Location:** `src/services/booking-decision.service.ts` (Line 511)

**Type:** Service function (orchestrates provider + persistence)

**Flow:**
```typescript
1. Fetch KTV candidates from DB (users table, role=ktv, status=active)
2. Fetch customer booking history (previous KTV assignments)
3. Fetch today's workloads (session_logs count per KTV)
4. Build candidate objects (availability, skills, workload)
5. Call AutoAssignmentProvider.evaluate()
6. Return recommended KTV (does NOT persist to DB)
```

**Evidence:** `autoAssignKtv()` returns recommendation, caller persists via `updateBooking()`.

---

### 2.4. Assignment Persistence

**Persistence Point:** `updateBooking()` action

**Callers:**
- `src/modules/bookings/actions/ktv-suggestion-actions.ts` (applyKtvSuggestion)
- `src/app/dashboard/customers/[id]/useCustomerDetailController.ts` (UI controller)
- `src/app/dashboard/bookings/hooks/useBookingsPageActions.ts` (UI hook)

**Pattern:**
```typescript
// 1. Get recommendation
const recommendation = await autoAssignKtv({ ... });

// 2. Persist via updateBooking
const result = await updateBooking(bookingId, {
  assigned_ktv_id: recommendation.assignedKtvId
});
```

**Evidence:** Two-step process (recommendation → persistence), NOT atomic assignment.

---

## 3. Resource Assignment Capability

### 3.1. Resource Fields

**Spa Resources:**
- `assigned_bed_id` (UUID, nullable)
- `assigned_room_id` (UUID, nullable)
- `required_equipment_ids` (JSONB array)

**Resource Tables:**
```sql
-- Beds (giường)
CREATE TABLE beds (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  bed_number VARCHAR(50) NOT NULL, -- "G01", "G02"
  bed_name VARCHAR(255),
  room_id UUID REFERENCES rooms(id), -- Bed may belong to room
  status VARCHAR(50) DEFAULT 'active', -- active | maintenance | inactive
  UNIQUE(tenant_id, bed_number)
);

-- Rooms (phòng)
CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  room_number VARCHAR(50) NOT NULL, -- "P01", "VIP01"
  room_name VARCHAR(255),
  capacity INT DEFAULT 1,
  room_type VARCHAR(50), -- single | double | vip | group
  status VARCHAR(50) DEFAULT 'active',
  UNIQUE(tenant_id, room_number)
);

-- Equipment (thiết bị)
CREATE TABLE equipment (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  equipment_code VARCHAR(50) NOT NULL, -- "TB01", "MAY-LASER-01"
  equipment_name VARCHAR(255) NOT NULL,
  equipment_type VARCHAR(100), -- machine | tool | consumable
  quantity INT DEFAULT 1, -- Available quantity
  status VARCHAR(50) DEFAULT 'active',
  UNIQUE(tenant_id, equipment_code)
);
```

---

### 3.2. Resource Assignment Pattern

**Observation:** Resource assignment follows SAME pattern as professional assignment:
- ✅ Nullable FK fields in `bookings` table
- ✅ No separate allocation table
- ✅ No allocation lifecycle
- ✅ Updated via `updateBooking()` action

**Conflict Detection:**
```typescript
// checkBookingConflicts() — Decision Engine service
// Checks: same resource + overlapping time = conflict
// Inputs: bookingResourceId, assignedDate, assignedTime, durationMinutes
// Output: APPROVE | REJECT (with conflict reason)
```

**Evidence:** Resource allocation is **booking attribute**, NOT standalone capability.

---

## 4. Booking Lifecycle State Machine

### 4.1. States

```typescript
type BookingStatus = 
  | 'inquiry'          // Initial inquiry (no commitment)
  | 'deposit_pending'  // Awaiting deposit payment
  | 'booked'           // Confirmed (deposit paid)
  | 'in_progress'      // Service delivery started
  | 'completed'        // Service delivery finished
  | 'cancelled';       // Booking cancelled
```

---

### 4.2. State Transitions (Inferred)

```
inquiry
  ↓ (deposit received)
deposit_pending
  ↓ (contract signed + deposit confirmed)
booked
  ↓ (first session starts)
in_progress
  ↓ (all sessions completed)
completed

(Any state except completed)
  ↓ (customer/business cancellation)
cancelled
```

**Evidence Source:** Schema constraints, status values, business logic in actions.

---

### 4.3. State Invariants

**Inferred Invariants:**
1. `status='booked'` → `contract_signed=true` (likely)
2. `status='in_progress'` → `completed_sessions > 0`
3. `status='completed'` → `completed_sessions = total_sessions`
4. `status='cancelled'` → Terminal state (no transitions out)
5. `assigned_ktv_id` can be NULL in any state (assignment optional)

**Validation:** Decision Engine validates state transitions (via `updateBooking()`)

---

## 5. Booking Dependencies

### 5.1. Consumes (Downstream Dependencies)

**IServiceCatalog (H2 Contract #2):**
- `package_id` → Service definition
- Service pricing, duration, required skills

**Decision Engine:**
- AutoAssignmentProvider → Professional recommendation
- `checkBookingConflicts()` → Conflict detection
- Break time buffer validation

**Customer Context:**
- `customer_id` → Customer entity
- Customer tier (VIP, loyal, new) → Assignment rules

**Tenant Context:**
- `tenant_id` → Tenant isolation (Gate 0)

---

### 5.2. Provides (Upstream Consumers)

**Session Logs:**
- `session_logs.booking_id` → Session belongs to booking
- Sessions track service delivery progress

**Revenue Tracking:**
- `revenue.booking_id` → Payment records

**Shifts:**
- `shifts.booking_id` → KTV shift schedule

**Chat Threads:**
- `chat_threads.booking_id` → Communication context

**Evidence:** Booking is **aggregate root** for service delivery lifecycle.

---

## 6. Assignment vs Recommendation Boundary

### 6.1. Clear Separation

**AutoAssignmentProvider (Recommendation):**
- ✅ Stateless business logic
- ✅ Evaluates candidates
- ✅ Returns recommendation
- ❌ Does NOT persist assignment

**Booking Entity (Assignment Persistence):**
- ✅ Owns `assigned_ktv_id` field
- ✅ Persists assignment via `updateBooking()`
- ✅ Validates conflicts via Decision Engine
- ❌ Does NOT contain recommendation logic

---

### 6.2. Evidence for Contract #3 Reconciliation

**Key Finding:** `IStaffAssignment` as standalone contract is NOT justified.

**Rationale:**
1. Assignment = simple nullable FK field (NOT separate entity)
2. AutoAssignmentProvider = recommendation service (NOT assignment engine)
3. No assignment table, no assignment states, no assignment history
4. Persistence via booking update (assignment is booking capability)

**Probable Outcome:** Staff assignment absorbed into `IAppointmentEngine.assignProfessional()`.

---

## 7. Spa-Specific vs Generic Capabilities

### 7.1. Spa-Specific (NOT Generic)

**Fields:**
- `expected_birth_date` — Maternity care specific
- `is_in_care` — Ongoing care tracking
- `total_sessions` / `completed_sessions` — Session-based services (may generalize)
- `ktv_commission` — Spa compensation model

**Entities:**
- `session_logs` — Spa service delivery model (multi-session packages)
- Beds/rooms — Beauty spa physical resources

---

### 7.2. Generic (Platform Candidate)

**Core Booking:**
- `id`, `booking_number`, `customer_id`, `status`
- `start_date`, `preferred_time`, `duration`
- `deposit_amount`, `full_price`
- `assigned_professional_id` (generic term for `assigned_ktv_id`)

**Professional Assignment:**
- Assignment field (nullable FK)
- Recommendation logic (skill matching, availability, workload)
- Conflict detection

**Resource Assignment:**
- Resource FK fields (generic pattern)
- Conflict detection (time-based allocation)

**Lifecycle:**
- State machine (inquiry → confirmed → in-progress → completed)
- Status transitions

---

## 8. Key Observations for Phase 2

### 8.1. Assignment is Booking Capability

**Evidence:**
- `assigned_ktv_id` = booking field (NOT separate table)
- AutoAssignmentProvider = helper service (recommendation only)
- Persistence via `updateBooking()` (booking owns assignment)

**Implication:** `IAppointmentEngine` should include `assignProfessional()` method.

---

### 8.2. Resource Assignment Mirrors Professional Assignment

**Pattern:**
- Professional: `assigned_ktv_id` (nullable FK)
- Resource: `assigned_bed_id`, `assigned_room_id` (nullable FKs)
- Equipment: `required_equipment_ids` (JSONB array)

**Implication:** Resource allocation may be `IAppointmentEngine` capability (NOT separate contract).

---

### 8.3. Recommendation Services Are NOT Contracts

**AutoAssignmentProvider:**
- Provider pattern (Decision Engine)
- Stateless business logic
- Returns recommendation (caller persists)

**Implication:** Recommendation services are helper services, NOT Platform contracts.

---

### 8.4. Booking is Aggregate Root

**Owned Capabilities:**
- Lifecycle state machine
- Professional assignment
- Resource assignment
- Financial tracking (deposit, full price)
- Service association (package_id)
- Session tracking (for multi-session services)

**Implication:** `IAppointmentEngine` is likely monolithic (owns assignment + resources + lifecycle).

---

## 9. Spa Legacy Architecture Summary

**Booking Entity:**
```
bookings table (aggregate root)
├─ Core lifecycle (status, dates, financials)
├─ Professional assignment (assigned_ktv_id FK)
├─ Resource assignment (assigned_bed_id, assigned_room_id FKs)
├─ Service association (package_id FK)
└─ Session tracking (total_sessions, completed_sessions)

Related Entities (NOT owned by booking):
├─ session_logs (service delivery tracking)
├─ revenue (payment tracking)
├─ shifts (KTV schedule)
└─ chat_threads (communication)

Helper Services (NOT engines):
├─ AutoAssignmentProvider (professional recommendation)
├─ checkBookingConflicts() (resource conflict detection)
└─ Decision Engine (validation, conflict detection)
```

**Assignment Pattern:**
- Simple nullable FK fields (NOT separate allocation tables)
- Recommendation services provide candidates
- Booking update persists assignment
- Conflict detection via Decision Engine

---

## 10. Next Steps (Phase 2: Domain Reconciliation)

### 10.1. Map Spa → Domain Concepts

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
- Spa: Package (multi-session)
- Haircut: Service (single service)
- Nail: Service (single service)
- **Domain:** Service (`service_id`)

**Appointment/Booking:**
- Spa: Booking (with sessions)
- Haircut: Appointment (single visit)
- Nail: Appointment (single visit)
- **Domain:** Appointment (neutral term)

---

### 10.2. Validate Haircut Requirements

**Questions:**
1. Haircut assignment = simple FK like Spa? (YES/NO)
2. Haircut chair allocation = nullable FK like Spa beds? (YES/NO)
3. Haircut uses recommendation service? (YES/NO)
4. Haircut lifecycle states match Spa pattern? (YES/NO)

---

### 10.3. Validate Nail Projection

**Questions:**
1. Nail technician assignment = same pattern? (PROJECTED)
2. Nail station allocation = same pattern? (PROJECTED)
3. Nail services = single-session (NOT multi-session packages)? (PROJECTED)

---

### 10.4. Determine Contract Boundaries

**Option A: Monolithic Appointment**
```typescript
interface IAppointmentEngine {
  // Lifecycle
  createAppointment()
  confirmAppointment()
  cancelAppointment()
  
  // Professional assignment (embedded)
  assignProfessional()
  
  // Resource assignment (embedded)
  assignResources()
  
  // Queries
  getAppointment()
  listAppointments()
}
```

**Option B: Appointment + Separate Capabilities**
```typescript
interface IAppointmentEngine {
  // Lifecycle only
  createAppointment()
  confirmAppointment()
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

**Decision Authority:** Evidence from Phase 1 + Haircut requirements + domain reconciliation.

---

## Phase 1 Status

**Completed:**
- ✅ Booking schema audited (complete)
- ✅ Professional assignment analyzed (field + recommendation service)
- ✅ Resource assignment analyzed (FK fields + conflict detection)
- ✅ Lifecycle state machine documented (6 states)
- ✅ Dependencies mapped (consumes/provides)
- ✅ Spa-specific vs generic separated

**Key Findings:**
1. Assignment = booking attribute (NOT standalone engine)
2. AutoAssignmentProvider = recommendation service (NOT assignment engine)
3. Resource assignment mirrors professional assignment (same pattern)
4. Booking = aggregate root (owns lifecycle + assignment + resources)

**Ready for Phase 2:** ✅ Domain Reconciliation (Spa + Haircut + Nail mapping)

---

**Document Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** 🔍 **LEGACY DISCOVERY COMPLETE**  
**Next:** Phase 2 — Domain Reconciliation
