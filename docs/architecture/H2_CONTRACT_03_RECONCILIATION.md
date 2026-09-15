# Contract #3 Reconciliation — Staff Assignment Capability Analysis

**Date:** 2026-09-15  
**Status:** ✅ **RECONCILIATION COMPLETE**  
**Decision:** ⚠️ **DEFERRED** (pending IAppointmentEngine extraction)

---

## Evidence-Driven Analysis

### Assignment Persistence — WHO WRITES assigned_ktv_id?

**Evidence Traced:**

1. **booking-decision.service.ts** → `autoAssignKtv()`
   - Fetches KTV candidates from `users` table
   - Builds `KtvCandidate[]` with skills, workload, availability
   - Calls `AutoAssignmentProvider.evaluate()` → returns `assignedKtvId`
   - **Does NOT persist assignment** (returns recommendation)

2. **update-booking-action.ts** → `updateBooking()`
   ```typescript
   // UPDATE bookings SET assigned_ktv_id = X
   const result = await supabase
     .from('bookings')
     .update({ assigned_ktv_id: ktvId })
     .eq('id', bookingId);
   ```
   - **WRITES assigned_ktv_id** to bookings table
   - Triggers notification if KTV changes
   - Validates with Decision Engine before update

3. **ktv-suggestion-actions.ts** → `applyKtvSuggestion()`
   ```typescript
   await supabase
     .from('bookings')
     .update({ assigned_ktv_id: ktvId })
     .eq('id', bookingId);
   ```
   - **WRITES assigned_ktv_id** after user selects from suggestions

4. **UI Controllers** (useCustomerDetailController, useBookingsPageActions)
   - Calls `updateBooking()` with `assigned_ktv_id` parameter
   - User-initiated assignment/reassignment

**Conclusion:**
- ✅ `assigned_ktv_id` persistence = **part of bookings update** (not standalone)
- ✅ Assignment writes go through `updateBooking()` action
- ✅ No separate "Staff Assignment Engine" (assignment is booking property)

---

### Assignment Lifecycle — DOES assigned_ktv_id HAVE STATE MACHINE?

**Evidence:**

**States observed:**
- `null` → Unassigned (booking created without KTV)
- `ktv-id` → Assigned (KTV assigned to booking)
- `ktv-id` → `new-ktv-id` → Reassigned (KTV changed)

**Lifecycle operations:**
- **Create:** `bookings.assigned_ktv_id = null` (optional assignment at creation)
- **Assign:** `UPDATE bookings SET assigned_ktv_id = X`
- **Reassign:** `UPDATE bookings SET assigned_ktv_id = Y` (old value overwritten)
- **Clear:** `UPDATE bookings SET assigned_ktv_id = null`

**Invariants:**
- `assigned_ktv_id` must reference valid `users.id` (foreign key)
- Assignment must pass Decision Engine validation (availability, conflicts)
- KTV change triggers notification

**Conclusion:**
- ❌ NO complex state machine (just nullable field: null | ktv-id)
- ❌ NO assignment-specific states (PENDING, CONFIRMED, RELEASED)
- ✅ Assignment lifecycle = simple booking attribute update

---

### KtvCandidate Construction — WHO BUILDS candidate list?

**Evidence: `booking-decision.service.ts` → `autoAssignKtv()`**

```typescript
// 1. Fetch KTVs from users table
const { data: ktvListData } = await supabase
  .from('users')
  .select('id, full_name, position_tier, metadata')
  .eq('tenant_id', input.tenantId)
  .eq('role', 'ktv')
  .eq('status', 'active');

// 2. Extract skills/specializations from metadata
const ktvList = ktvListData.map(row => {
  const ktvMeta = (row.metadata as KtvMetadata | null) || {};
  return {
    skills: ktvMeta.skills || [],
    specializations: ktvMeta.specializations || [],
    avg_rating: ktvMeta.avg_rating || 5.0,
    years_of_service: ktvMeta.years_of_service || 0,
    max_daily_bookings: ktvMeta.max_daily_bookings || 8,
  };
});

// 3. Fetch customer history with KTVs
const { data: customerHistory } = await supabase
  .from('bookings')
  .select('assigned_ktv_id')
  .eq('customer_id', input.customerId);

// 4. Fetch today's workloads
const { data: allTodayBookings } = await supabase
  .from('session_logs')
  .select('completed_by_ktv_id')
  .in('completed_by_ktv_id', ktvIds)
  .eq('assigned_date', input.requestedDate);

// 5. Build candidate list
const candidates: KtvCandidate[] = ktvList.map(ktv => ({
  id: ktv.id,
  name: ktv.full_name,
  skills: ktv.skills,              // ← FROM users.metadata.skills
  specializations: ktv.specializations, // ← FROM users.metadata.specializations
  avgRating: ktv.avg_rating,
  currentWorkload: workloadMap[ktv.id] || 0,
  maxDailyBookings: ktv.max_daily_bookings,
  availability: {
    isAvailable: currentWorkload < maxDailyBookings,
  },
  isPreferredByCustomer: ktv.id === input.preferredKtvId,
  customerBookingCount: ktvHistory[ktv.id] || 0,
}));
```

**Skill Data Source:**
- ✅ Skills stored in `users.metadata.skills` (JSONB array)
- ✅ Specializations stored in `users.metadata.specializations` (JSONB array)
- ✅ Candidate construction = `booking-decision.service` responsibility

**Conclusion:**
- ✅ `booking-decision.service` builds candidate list (NOT AutoAssignmentProvider)
- ✅ Skills come from `users.metadata` (staff records)
- ✅ Provider receives pre-built candidates (no data fetching)

---

### Skill Matching — IS IT A SEPARATE CAPABILITY?

**Evidence:**

**Skill data ownership:**
- Skills stored in `users.metadata.skills` (staff directory capability)
- Skills NOT in separate "skill catalog" or "skill matching" table

**Skill matching logic:**
- ✅ Implemented in `AutoAssignmentProvider.filterEligibleCandidates()`
- ✅ Required skills filtering (must have all required skills)
- ✅ Skill coverage scoring (25 points / 100)
- ✅ Specialization matching (service type → staff specialization)

**Skill matching is part of:**
- Staff recommendation algorithm (scoring component)
- NOT standalone capability (no separate API, no separate data model)

**Conclusion:**
- ❌ Skill Matching = NOT separate capability
- ✅ Skill Matching = part of Staff Recommendation logic
- ❌ H0 "Skill Matching = new capability" = INCORRECT

---

## Capability Classification

### AutoAssignmentProvider = HELPER SERVICE

**Pattern:** Provider (Decision Support)

**Characteristics:**
- ✅ Stateless computation (input → output)
- ✅ No data ownership (no persistence)
- ✅ No side effects (pure function)
- ❌ Not a capability (helper for booking engine)

**Role:** Recommendation logic for `autoAssignKtv()` function

---

### Staff Assignment = PART OF BOOKING CAPABILITY

**Pattern:** Booking Attribute (not standalone capability)

**Evidence:**
- ✅ Assignment field: `bookings.assigned_ktv_id`
- ✅ Assignment persistence: via `updateBooking()` action
- ✅ Assignment lifecycle: simple nullable field (null | ktv-id)
- ❌ No separate assignment table/engine/API

**Ownership:** Booking capability (IAppointmentEngine)

---

### booking-decision.service = ORCHESTRATION LAYER

**Pattern:** Service Orchestrator

**Responsibilities:**
- ✅ Build KTV candidate list (fetch from users, bookings, session_logs)
- ✅ Call AutoAssignmentProvider (recommendation logic)
- ✅ Map recommendation result (add KTV names, alternatives)
- ❌ Does NOT persist assignment (returns recommendation)

**Role:** Orchestrates staff recommendation workflow

---

## H1 Contract List Reconciliation

### H1 Listed Contract #6: IStaffAssignment

**H1 Claimed:**
```
6. IStaffAssignment (provider assignment)
   Source: auto-assignment-provider.ts
   Capability: Assign staff to bookings
```

**Actual Evidence:**
```
Source: auto-assignment-provider.ts
Actual Capability: Staff Recommendation (NOT assignment)
Persistence: bookings.assigned_ktv_id (part of booking, not standalone)
Lifecycle: Simple booking attribute (not separate state machine)
```

**Reconciliation:**
- ❌ `IStaffAssignment` as standalone contract = **NOT JUSTIFIED**
- ✅ Staff assignment = **part of IAppointmentEngine** (booking capability)
- ✅ `AutoAssignmentProvider` = helper service (not contract-worthy)

---

## H0 Assessment Reconciliation

### H0 Claimed: Skill Matching = NEW Capability

**H0 Assessment:**
```
Skill Matching (NEW)
- Match staff skills to service requirements
- Find eligible staff for service
- Skill-based filtering
```

**Actual Evidence:**
```
Skill Matching = EXISTS in AutoAssignmentProvider
- Required skills filtering (must have all)
- Skill coverage scoring (25 points)
- Specialization matching (service type → staff)
```

**Reconciliation:**
- ❌ H0 "Skill Matching = NEW" = **INCORRECT**
- ✅ Skill Matching = **EXISTS** (part of staff recommendation)
- ⚠️ Skill Matching = **NOT standalone capability** (scoring component)

---

## Contract #3 Decision

### Option A: Extract IStaffAssignment (Standalone)

**Scope:** Staff assignment as separate capability

**Arguments FOR:**
- H1 identified as separate contract
- Assignment is important business logic

**Arguments AGAINST:**
- ❌ Assignment persistence = part of bookings (assigned_ktv_id field)
- ❌ Assignment lifecycle = simple booking attribute (no complex state)
- ❌ No separate assignment table/engine/API
- ❌ AutoAssignmentProvider = helper, not capability

**Verdict:** ❌ **NOT JUSTIFIED**

---

### Option B: Include in IAppointmentEngine (Part of Booking)

**Scope:** Staff assignment as booking capability

**Arguments FOR:**
- ✅ Assignment field in bookings table (assigned_ktv_id)
- ✅ Assignment persistence via updateBooking()
- ✅ Assignment lifecycle = booking attribute
- ✅ No separate assignment state machine
- ✅ Recommendation logic can be internal service (not contract-exposed)

**Arguments AGAINST:**
- ⚠️ IAppointmentEngine not yet extracted (Contract #1 pending)
- ⚠️ Need to audit full booking capability scope first

**Verdict:** ✅ **CORRECT CLASSIFICATION** (pending IAppointmentEngine extraction)

---

### Option C: Extract IStaffRecommendation (Narrow Scope)

**Scope:** Staff recommendation logic only (no persistence)

**Arguments FOR:**
- ✅ Matches AutoAssignmentProvider actual behavior
- ✅ Clear bounded context (recommendation, not assignment)
- ✅ Could be reused by other verticals (Healthcare, Auto, Education)

**Arguments AGAINST:**
- ⚠️ Recommendation logic is helper service (not capability)
- ⚠️ Haircut needs assignment persistence (not just recommendation)
- ⚠️ Extracting recommendation without persistence leaves gap

**Verdict:** 🤔 **POSSIBLE** (but lower priority than IAppointmentEngine)

---

## Final Decision: DEFER Contract #3

**Rationale:**

1. **Staff Assignment = Part of Booking Capability**
   - Assignment persistence in `bookings.assigned_ktv_id`
   - Assignment lifecycle = booking attribute update
   - No separate assignment state machine

2. **IAppointmentEngine Not Yet Extracted**
   - Cannot determine Staff Assignment scope without booking capability audit
   - Need to extract IAppointmentEngine first (Contract #1 in H1 list)
   - Staff assignment will be part of IAppointmentEngine contract

3. **AutoAssignmentProvider = Helper Service**
   - Recommendation logic (not capability)
   - Can remain internal to booking engine
   - May be exposed as contract method (e.g., `IAppointmentEngine.recommendStaff()`)

**Decision:** ⚠️ **DEFER Contract #3** until IAppointmentEngine extraction complete

**Action Items:**
1. ✅ Extract IAppointmentEngine (Contract #1 priority)
2. ⏳ Include staff assignment in IAppointmentEngine scope
3. ⏳ Decide if recommendation logic should be contract method or internal service
4. ⏳ Re-evaluate if IStaffRecommendation needs separate contract

---

## H2 Contract Inventory Correction

### Before Reconciliation

**H1 Contract List (8 contracts):**
1. IAppointmentEngine (booking)
2. IServiceCatalog (packages table)
3. ISessionTracking (service execution)
4. IServiceHistory (query pattern)
5. IWaitlistEngine (queue)
6. **IStaffAssignment (provider assignment)** ← UNDER REVIEW
7. IResourceAllocation (booking resources)
8. IDomainEvents (lifecycle events)

---

### After Reconciliation

**Revised Contract List:**
1. IAppointmentEngine (booking) — **includes staff assignment**
2. IServiceCatalog (packages table) ✅ EXTRACTED
3. ISessionTracking (service execution)
4. IServiceHistory (query pattern)
5. IWaitlistEngine (queue) ✅ EXTRACTED
6. ~~IStaffAssignment~~ → **absorbed into IAppointmentEngine**
7. IResourceAllocation (booking resources)
8. IDomainEvents (lifecycle events)

**Contract Count:**
- **Before:** 8 contracts
- **After:** 7 contracts (IStaffAssignment absorbed into IAppointmentEngine)

**H2 Progress:**
- **Before:** 2/8 extracted (25%)
- **After:** 2/7 extracted (28.6%)

---

## Lessons Learned

### 1. Field Persistence ≠ Capability Ownership

**Mistake:** Assumed `bookings.assigned_ktv_id` field = separate "Staff Assignment" capability

**Reality:** Assignment is **booking attribute**, not standalone capability

**Lesson:** Trace WHO writes field, lifecycle complexity, and invariants before claiming separate capability

---

### 2. File Name ≠ Capability Semantics

**Mistake:** File named `auto-assignment-provider.ts` → assumed "assignment capability"

**Reality:** Provider recommends (does NOT assign), assignment persisted elsewhere

**Lesson:** **Runtime behavior + data ownership** > file naming conventions

---

### 3. H0/H1 Assessment Can Have Gaps

**H0 Claimed:** "Skill Matching = NEW capability"

**Reality:** Skill Matching already exists (part of AutoAssignmentProvider)

**Lesson:** H0/H1 assessments are **hypotheses**, not authority. Code evidence overrides documentation.

---

### 4. Provider Pattern vs Capability

**Provider:** Helper service (stateless, no persistence, decision support)

**Capability:** Owns data, manages lifecycle, exposes operations

**AutoAssignmentProvider:** Provider (NOT capability)

**Lesson:** Not every service/module is a reusable capability contract

---

### 5. Evidence-Driven Reconciliation Process

**Process:**
1. Source audit (6 questions: input, output, logic, filters, side effects, ownership)
2. Persistence trace (WHO writes, lifecycle, invariants)
3. Data ownership trace (WHO constructs candidates, WHO owns skills)
4. Capability classification (standalone vs part of larger capability)
5. Reconciliation (correct H0/H1 if evidence contradicts)

**Lesson:** **Evidence > assumptions.** Reconciliation required when runtime contradicts documentation.

---

## Status Summary

```
CONTRACT #3 RECONCILIATION

H1 Claimed:               IStaffAssignment (standalone contract)
Source Audited:           auto-assignment-provider.ts (recommendation logic)
Persistence Traced:       bookings.assigned_ktv_id (booking attribute)
Lifecycle Analyzed:       Simple nullable field (null | ktv-id)
Capability Classification: Part of IAppointmentEngine (NOT standalone)

Decision:                 ⚠️ DEFER (pending IAppointmentEngine extraction)
├─ Staff Assignment:      ✅ Part of booking capability
├─ AutoAssignmentProvider: Helper service (not contract)
└─ IStaffAssignment:      ❌ NOT standalone contract

H0 Correction:
├─ Skill Matching:        ❌ H0 "NEW" incorrect → EXISTS in provider
└─ Skill Matching Scope:  Part of recommendation logic (not standalone)

H2 Contract Inventory:    8 → 7 contracts (IStaffAssignment absorbed)
H2 Progress:              2/7 extracted (28.6%)

Next Action:              Extract IAppointmentEngine (includes staff assignment)
```

---

**Reconciliation Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ✅ **COMPLETE**  
**Decision:** ⚠️ **DEFERRED** (pending IAppointmentEngine extraction)
