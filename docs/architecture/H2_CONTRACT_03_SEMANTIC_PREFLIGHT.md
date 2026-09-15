# H2 Contract #3 Semantic Preflight — Provider vs Staff Assignment

**Date:** 2026-09-15  
**Status:** ⏳ **SEMANTIC AUDIT IN PROGRESS**

---

## Problem Statement

**H1 Contract List identified:**
- Contract #6: "Provider/Stylist Assignment" (from `auto-assignment-provider.ts`)

**Proposed Contract Name (from H1):** `IProviderEngine` ❓

**Semantic Risk:** "Provider" has multiple meanings across Bella verticals:
- **Healthcare:** Provider = Doctor/Nurse (medical service provider)
- **Beauty:** Provider = Staff/Stylist/Barber (service professional)
- **Platform:** Provider = Generic service performer?

**Critical Question:** Does source implementation semantics match "Provider" or "Staff Assignment"?

---

## Semantic Preflight Checklist

### 1. Source Implementation

**H1 Reference:** `auto-assignment-provider.ts`

**Location:** TBD (need to find in codebase)

**Audit Questions:**
- What does source actually DO? (assign staff, schedule shifts, match skills, auto-assign?)
- What entities does source work with? (Staff, Employee, Provider, Professional?)
- What operations does source provide? (CRUD staff, assign to booking, skill matching, availability check?)

**Status:** ⏳ PENDING (need to audit source)

---

### 2. Actual Semantics

**Possible Interpretations:**

**A. Staff Directory/Management**
- Manage staff records (create, update, delete staff)
- Staff profiles (name, skills, certifications, photo)
- Staff employment lifecycle (hire, fire, transfer)

**B. Staff Scheduling**
- Staff shift schedules (Monday 9am-5pm, Tuesday off, etc.)
- Staff availability (vacation, sick leave, time off)
- Shift planning, roster generation

**C. Staff Assignment**
- Assign staff to bookings/appointments
- Assign staff to services (which staff performs which service)
- One-time assignment (this booking → this staff member)

**D. Skill Matching**
- Match staff skills to service requirements
- Find eligible staff for service (who CAN perform haircut advanced?)
- Skill-based filtering

**E. Auto-Assignment**
- Automatically assign best staff to booking
- Auto-assignment rules (round-robin, load balancing, skill-based, preference-based)
- Assignment automation logic

**Status:** ⏳ PENDING (need source audit to determine actual semantics)

---

### 3. Target Haircut Need

**H0 Assessment:** Haircut needs staff assignment capability

**Haircut Use Case:**
- Customer books "Haircut Premium" appointment
- System needs to assign stylist/barber to appointment
- Assignment criteria: staff availability, skill level (can perform Premium haircut), customer preference

**Haircut Does NOT need (probably):**
- ❌ Staff payroll
- ❌ Staff HR lifecycle (hire/fire)
- ❌ Staff shift scheduling (roster generation)
- ❌ Staff commission calculation

**Haircut Core Need:** **Assign stylist to appointment** (one-time assignment)

---

### 4. Candidate Contract Names

**Option A: `IProviderEngine`** ⚠️

**Semantics:** "Provider" = medical service provider (Healthcare semantics)

**Pros:**
- Generic term (provider = anyone who provides service)
- Could work cross-vertical (Healthcare provider, Beauty provider, Auto mechanic)

**Cons:**
- ❌ Healthcare semantic collision (Provider = Doctor/Nurse in Healthcare vertical)
- ❌ Ambiguous scope (Provider directory? Provider assignment? Provider scheduling?)
- ❌ Not aligned with H1 contract list ("Provider/Stylist **Assignment**" not "Provider Management")

**Risk:** HIGH (semantic confusion with Healthcare vertical)

---

**Option B: `IStaffAssignment`** ✅

**Semantics:** "Staff Assignment" = assign staff member to work unit (booking, service, shift)

**Pros:**
- ✅ Clear bounded context (assignment, not directory/scheduling/payroll)
- ✅ Matches H1 contract list ("Provider/Stylist **Assignment**")
- ✅ No semantic collision with other verticals
- ✅ Scope is narrow (assignment only, not full staff management)

**Cons:**
- ⚠️ "Staff" might be too Beauty-specific (is it "Staff" or "Employee" or "Professional"?)

**Risk:** LOW (clear semantics, aligned with H1)

---

**Option C: `IServiceProfessionalAssignment`** 🤔

**Semantics:** "Service Professional Assignment" = assign service performer to service/booking

**Pros:**
- ✅ Cross-vertical generic (Healthcare → assign doctor, Beauty → assign stylist, Auto → assign mechanic)
- ✅ Clear bounded context (assignment only)
- ✅ No semantic collision

**Cons:**
- ⚠️ Verbose name (long to type/read)
- ⚠️ May be overengineering (is "Service Professional" better than "Staff"?)

**Risk:** LOW (clear, generic, but verbose)

---

**Option D: `IResourceAssignment`** ❌

**Semantics:** "Resource Assignment" = assign resource (staff, room, equipment) to work unit

**Pros:**
- ✅ Very generic (resource = any assignable entity)

**Cons:**
- ❌ Too generic (resource includes rooms, equipment, beds, not just staff)
- ❌ H1 already has separate "IResourceAllocation" contract (rooms/beds/equipment)
- ❌ Semantic collision with Contract #7 (IResourceAllocation)

**Risk:** HIGH (semantic overlap with Contract #7)

---

### 5. Must NOT Accidentally Own

**Capabilities OUT OF SCOPE for Staff Assignment:**

**❌ Payroll**
- Staff salary, hourly rate
- Commission calculation
- Payment disbursement

**❌ HR Lifecycle**
- Hire, fire, transfer staff
- Employment contracts
- Onboarding, offboarding

**❌ Shift Scheduling**
- Shift roster generation (Monday 9am-5pm, Tuesday off, etc.)
- Vacation/leave management
- Shift swap, shift coverage

**❌ Commission**
- Commission rules (% of service price)
- Commission tracking
- Commission payout

**❌ Healthcare Provider Semantics**
- Doctor/Nurse directory
- Medical license, credentials
- Provider specialization (cardiologist, pediatrician, etc.)

**❌ Skill Matching (unless actually implemented)**
- Find eligible staff for service
- Skill-based filtering
- If source does NOT implement skill matching, do NOT add to contract

---

## H1 Contract Reference

**H1 8-Contract List:**
1. IAppointmentEngine (booking)
2. IServiceCatalog (packages table)
3. ISessionTracking (service execution)
4. IServiceHistory (query pattern)
5. IWaitlistEngine (queue)
6. **IStaffAssignment** (provider assignment) ← H1 EXACT NAME
7. IResourceAllocation (booking resources)
8. IDomainEvents (lifecycle events)

**H1 Contract #6 Name:** `IStaffAssignment` (NOT `IProviderEngine`)

**H1 Evidence:** Contract list explicitly uses "IStaffAssignment" name

**Question:** Why was `IProviderEngine` proposed instead of H1's `IStaffAssignment`?

**Answer:** Possible semantic drift during H2 planning. Need to validate with source audit.

---

## Semantic Preflight Decision

**Pending Source Audit:**

**IF source is staff assignment implementation (assign staff to booking):**
- ✅ **Contract Name:** `IStaffAssignment` (matches H1)
- ✅ **Scope:** Staff assignment only (not directory, not scheduling, not payroll)
- ✅ **Bounded Context:** Assignment (who performs which service)

**IF source is staff directory/management (CRUD staff, staff profiles):**
- ✅ **Contract Name:** `IStaffDirectory` (different capability)
- ✅ **Scope:** Staff records management (not assignment)

**IF source is skill matching (find eligible staff for service):**
- ✅ **Contract Name:** `IStaffSkillMatching` (different capability)
- ✅ **Scope:** Skill-based filtering (not assignment)

**IF source is auto-assignment engine (automatic assignment logic):**
- ✅ **Contract Name:** `IStaffAutoAssignment` (specific variant)
- ✅ **Scope:** Auto-assignment logic (rules, algorithms)

---

## Next Steps

1. ⏭️ **Locate source:** Find `auto-assignment-provider.ts` in Bella Spa codebase
2. ⏭️ **Audit source semantics:** What does it actually DO? (operations, entities, scope)
3. ⏭️ **Determine bounded context:** Assignment? Directory? Scheduling? Skill matching?
4. ⏭️ **Select contract name:** Based on actual source semantics (likely `IStaffAssignment` per H1)
5. ⏭️ **Scope definition:** What capabilities IN scope, what OUT of scope
6. ⏭️ **Extract contract:** Only AFTER semantic clarity

---

## Lessons from Contract #2

**Contract #2 Semantic Drift:**
- Proposed: `IServiceInventoryEngine` (implied inventory management)
- Actual: Service catalog (name, price, duration)
- Corrected: `IServiceCatalog` (matches bounded context)

**Lesson:** **Audit source semantics BEFORE naming contract**

**Contract #3 Risk:**
- Proposed: `IProviderEngine` (implies Healthcare provider semantics)
- H1 Said: `IStaffAssignment` (Beauty staff assignment)
- Need Audit: What does source actually implement?

**Mitigation:** Run semantic preflight BEFORE extraction

---

**Preflight Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ⏳ **PENDING SOURCE AUDIT**  
**Next:** Locate and audit `auto-assignment-provider.ts` source implementation
