# Contract #3 Source Audit — auto-assignment-provider.ts

**Date:** 2026-09-15  
**Source:** `src/lib/decision-engine/providers/booking/auto-assignment-provider.ts`  
**Status:** ✅ **AUDIT COMPLETE**

---

## 6-Question Source Audit

### 1. INPUT — What does it receive?

```typescript
async evaluate(
  input: AutoAssignmentInput,      // Booking request
  candidates: KtvCandidate[],      // Available staff list
  options?: AssignmentEvaluationOptions
): Promise<AutoAssignmentOutput>
```

**Input Structure:**
- `AutoAssignmentInput`: Booking details (customerId, serviceId, serviceType, date, time, duration)
- `KtvCandidate[]`: **Pre-fetched candidate list** (availability, skills, workload already populated)
- Customer constraints (tier, preferredKtvId, minRating, requiredSkills, excludeKtvIds)

**Key Observation:** Candidates are **passed IN**, not fetched by provider.

---

### 2. OUTPUT — What does it return?

```typescript
return {
  success: true,
  assignedKtvId: bestCandidate.candidate.id,  // ✅ Returns SELECTED staff ID
  confidence: 0.9,
  reason: "Assigned to KTV-123 (score: 85/100): excellent skill match, high rating",
  matchedRules: ['booking-assignment-vip-seniority', ...],
  score: { total: 85, components: {...}, penalties: {...} },
  alternatives: [
    { ktvId: 'KTV-456', score: 78, reason: '...' },
    { ktvId: 'KTV-789', score: 72, reason: '...' }
  ],
  executionTime: 12.5,
  provider: 'AutoAssignmentProvider'
}
```

**Output Type:** **RECOMMENDATION**, not assignment record

**Returns:** Staff ID of best candidate + confidence + alternatives

---

### 3. DECISION LOGIC — Does it actually "assign"?

**❌ NO** — It **recommends**, it does NOT assign.

**Actual Behavior:**
```
1. Filter eligible candidates (skills, availability, workload)
2. Score each candidate (skill, performance, workload, preference)
3. Sort by score (descending)
4. Return best candidate ID + alternatives
```

**No WRITE operation** — Pure read-only recommendation engine.

**Evidence:**
```typescript
// Step 4: Select best candidate
const bestCandidate = scoredCandidates[0];

// Step 7: Build result
return {
  success: true,
  assignedKtvId: bestCandidate.candidate.id,  // ← returns ID, does NOT persist
  confidence: this.calculateConfidence(bestCandidate.score.total),
  ...
}
```

**Name is misleading:** `assignedKtvId` field name implies assignment, but it's just recommendation.

---

### 4. FILTERS — What filters/ranking does it apply?

**Filtering (Eligibility):**
- ✅ Has required skills (all must match)
- ✅ Available at requested time (no conflicts)
- ✅ Below daily booking limit (not overloaded)
- ✅ Not in exclusion list
- ✅ Meets minimum rating threshold

**Scoring Components (100 points total):**
1. **Skill Match:** 25 points (required skills coverage %)
2. **Availability:** 20 points (already filtered, full points)
3. **Workload Balance:** 20 points (inverse: lower workload = higher score)
4. **Performance:** 15 points (rating 0-5 scale)
5. **Customer Preference:** 10 points (preferred KTV or booking history)
6. **Specialization:** 10 points (service type match)

**Rule-Based Bonuses:**
- VIP Seniority: +15 points (VIP customer + senior KTV ≥3 years)

**Penalties:**
- Low Rating (<3.5): -10 points
- Overloaded (>80% capacity): -5 points
- No History (new customer): -2 points

**Final:** Sort by score, return top candidate + alternatives (top 3)

---

### 5. SIDE EFFECT — Does it WRITE assignment to DB?

**❌ NO SIDE EFFECTS**

**Evidence:**
- No database imports (no supabase, no ORM)
- No `INSERT`, `UPDATE`, or `DELETE` operations
- Pure function: `input → output` (stateless)
- Class is stateless (only policy/reasoner state)

**Actual Behavior:** **READ-ONLY RECOMMENDATION**

**Downstream Assignment:** Caller (Booking Engine) must persist assignment after receiving recommendation.

---

### 6. OWNED DATA — Does it own assignment lifecycle?

**❌ NO DATA OWNERSHIP**

**Does NOT own:**
- Staff-to-booking assignment records
- Assignment history
- Assignment state (pending, confirmed, cancelled)
- Assignment persistence

**Does own:**
- Assignment rules (rule definitions)
- Scoring logic (algorithm)
- Recommendation computation (ephemeral)

**Authority:** Provides **recommendation**, does NOT manage assignment lifecycle.

---

## Semantic Classification

### What Source ACTUALLY Is

**Name:** Auto-Assignment **Provider** (not Engine, not Manager)

**Bounded Context:** **Staff Recommendation** (NOT Staff Assignment)

**Actual Capability:**
- ✅ Filter eligible staff (availability, skills, workload)
- ✅ Rank staff by score (multi-criteria scoring)
- ✅ Recommend best staff (+ alternatives)
- ❌ Persist assignment (no DB write)
- ❌ Manage assignment lifecycle (no CRUD)
- ❌ Own assignment data (stateless recommendation)

---

### What Source IS NOT

**❌ NOT Staff Assignment:**
- Does NOT persist assignment record
- Does NOT own assignment lifecycle
- Does NOT manage assignment state

**❌ NOT Staff Directory:**
- Does NOT manage staff records (CRUD staff)
- Does NOT own staff profiles
- Receives pre-fetched candidate list (staff data owned elsewhere)

**❌ NOT Staff Scheduling:**
- Does NOT manage staff shifts
- Does NOT handle vacation/leave
- Only checks availability (availability owned elsewhere)

---

## Contract Name Decision

### H1 Claimed: `IStaffAssignment`

**Semantic Audit Result:** ❌ **INCORRECT**

**Reason:** Source does NOT assign (no persistence, no lifecycle management). It **recommends** staff.

---

### Correct Contract Name: `IStaffRecommendation` ✅

**Alternative Names:**
- `IStaffMatcher` (matches staff to booking)
- `IStaffAutoAssignment` (auto-assignment logic)
- `IStaffSelector` (selects best staff)

**Recommended:** `IStaffRecommendation`

**Rationale:**
- Matches actual behavior (recommend, not assign)
- Clear bounded context (recommendation, not persistence)
- No semantic overreach (doesn't claim assignment authority)

---

### Comparison to H1 Expectation

**H1 Expected:** `IStaffAssignment` (assign staff to booking, persist assignment)

**Source Provides:** `IStaffRecommendation` (rank staff, return best candidate)

**Gap:** **Assignment persistence/lifecycle missing**

**Implication:** Haircut will need BOTH:
1. ✅ `IStaffRecommendation` (reuse from Spa) — rank/filter staff
2. ⏳ `IStaffAssignment` (build new) — persist assignment, manage lifecycle

**OR:** `IStaffRecommendation` is PART OF `IStaffAssignment`, not the whole thing.

---

## Architecture Pattern Recognition

### Provider Pattern (Not Capability)

**Source is a "Provider":**
```typescript
export class AutoAssignmentProvider {
  async evaluate(input, candidates, options) {
    // ... scoring logic ...
    return { assignedKtvId, confidence, alternatives };
  }
}
```

**Provider Characteristics:**
- Stateless computation
- No data ownership
- No side effects
- Pure input → output transformation

**Provider Role:** **Decision support**, not capability implementation.

---

### Decision Engine Architecture

**Location:** `src/lib/decision-engine/providers/booking/`

**Pattern:** Decision Engine with multiple Providers

**Architecture:**
```
Booking Engine (orchestrator)
  ↓
  ├─ Auto-Assignment Provider (staff recommendation)
  ├─ Resource Allocation Provider (room/bed recommendation)
  ├─ Pricing Provider (dynamic pricing)
  └─ ... (other decision providers)
```

**Provider outputs recommendation → Engine persists decision.**

---

## H0 Validation — Skill Matching Capability

**H0 Assessment:** "Skill Matching" = capability Haircut needs to build (NEW)

**Audit Result:** ❌ **H0 INCORRECT**

**Evidence:** `auto-assignment-provider.ts` ALREADY implements skill matching:

```typescript
// Component 1: Skill Match (25 points)
const skillMatchPercentage = this.calculateSkillMatchPercentage(
  candidate.skills,
  requiredSkills
);
score.components.skillMatch = (skillMatchPercentage / 100) * 25;

// Filter: Required skills must match
const hasAllSkills = requiredSkills.every(skill =>
  candidate.skills.includes(skill)
);
```

**Skill Matching Features:**
- ✅ Required skills filtering (must have all required skills)
- ✅ Skill coverage scoring (% of required skills matched)
- ✅ Specialization matching (service type → staff specialization)

**H0 Correction:** Skill Matching is **NOT new capability**. It's part of existing Staff Recommendation.

**Impact:** Haircut does NOT need to build Skill Matching from scratch. Can reuse from Spa.

---

## Additional Features Discovered

**Features NOT mentioned in H0/H1:**

1. **Workload Balancing**
   - Distributes bookings evenly across staff
   - Penalizes overloaded staff (>80% capacity)
   - Scores inversely to current workload

2. **Customer Preference**
   - Honors customer's preferred KTV
   - Boosts score for repeat bookings
   - Penalizes unknown staff (encourage loyalty)

3. **VIP Rules**
   - Senior staff (≥3 years) for VIP customers
   - +15 bonus points for VIP-senior pairing

4. **Alternatives Recommendation**
   - Returns top N alternatives (default 3)
   - Provides fallback options if best candidate unavailable

5. **Confidence Scoring**
   - Rates recommendation confidence (0.0-1.0)
   - Based on total score (90+ = 1.0 very confident)

6. **Performance Tracking**
   - Execution time measurement
   - Algorithm version tracking
   - Candidate count metrics

**H0 Gap:** These features exist but were NOT assessed in H0 reuse analysis.

---

## Contract Extraction Decision

### Option A: Extract as `IStaffRecommendation` (Narrow Scope)

**Contract:** `IStaffRecommendation`

**Scope:** Recommendation only (no persistence)

**Capabilities:**
- Rank staff candidates by score
- Filter eligible staff (skills, availability, workload)
- Return best candidate + alternatives + confidence

**Pros:**
- ✅ Matches source semantics (recommendation, not assignment)
- ✅ No semantic overreach
- ✅ Clear bounded context

**Cons:**
- ⚠️ Haircut still needs to build assignment persistence separately
- ⚠️ H1 expected `IStaffAssignment` (capability gap)

---

### Option B: Build `IStaffAssignment` (Include Persistence)

**Contract:** `IStaffAssignment`

**Scope:** Recommendation + Assignment persistence + Lifecycle

**Capabilities:**
- ✅ Recommend staff (reuse from Spa `AutoAssignmentProvider`)
- ⏳ Persist assignment (build new: bookings.assigned_ktv_id)
- ⏳ Manage assignment lifecycle (reassign, unassign, confirm)
- ⏳ Track assignment history

**Pros:**
- ✅ Matches H1 expectation (`IStaffAssignment`)
- ✅ Complete capability (recommendation + persistence)
- ✅ Haircut gets full assignment solution

**Cons:**
- ⚠️ Larger scope (not just extraction, requires new code)
- ⚠️ Assignment persistence may already exist in bookings table (need audit)

---

### Option C: Defer Contract #3 (Assignment Already Exists?)

**Hypothesis:** Staff assignment might already be implemented in Spa bookings.

**Check:** Does `bookings` table have `assigned_ktv_id` field?

**If YES:**
- Staff assignment lifecycle already exists (bookings table owns assignment)
- `AutoAssignmentProvider` is helper/service (not contract-worthy capability)
- Contract #3 might NOT need extraction (already part of IAppointmentEngine)

**If NO:**
- Assignment persistence missing (provider only recommends)
- Need to build assignment persistence as NEW capability

**Action:** Audit `bookings` table schema before deciding on Contract #3.

---

## Recommended Next Steps

### 1. Audit Bookings Table Schema

**Check for:**
- `bookings.assigned_ktv_id` (staff assignment field)
- `bookings.assigned_at` (assignment timestamp)
- Assignment history tracking

**Purpose:** Determine if assignment persistence already exists.

---

### 2. Decision Tree

**IF bookings table HAS assigned_ktv_id:**
- ✅ Staff assignment already implemented (part of bookings capability)
- ✅ `AutoAssignmentProvider` is helper service (not separate contract)
- ❌ **DO NOT extract Contract #3** (already part of Contract #1 IAppointmentEngine)
- ✅ Haircut reuses bookings assignment (no extraction needed)

**IF bookings table DOES NOT have assigned_ktv_id:**
- ❌ Staff assignment persistence missing
- ✅ Extract `IStaffRecommendation` (narrow scope: recommendation only)
- ⏳ Build assignment persistence separately (extend bookings table)

---

### 3. H1 Contract List Correction

**H1 Listed:**
1. IAppointmentEngine (booking)
2. IServiceCatalog (packages table)
3. ISessionTracking (service execution)
4. IServiceHistory (query pattern)
5. IWaitlistEngine (queue)
6. **IStaffAssignment (provider assignment)** ← AUDIT PENDING
7. IResourceAllocation (booking resources)
8. IDomainEvents (lifecycle events)

**Possible H1 Error:**
- **IStaffAssignment** might already be PART OF **IAppointmentEngine** (bookings table)
- Provider is helper, not standalone contract

**Validation Needed:** Audit bookings table schema + assignment implementation.

---

## Source Audit Summary

```
SOURCE: auto-assignment-provider.ts

Actual Capability:        Staff Recommendation (NOT Assignment)
Bounded Context:          Recommendation (score, rank, filter)
Data Ownership:           NONE (stateless provider)
Side Effects:             NONE (no DB writes)
Input:                    AutoAssignmentInput + KtvCandidate[]
Output:                   Recommendation (ktvId + confidence + alternatives)

Contract Name:
├─ H1 Expected:           IStaffAssignment ❌ (implies persistence)
├─ Source Provides:       IStaffRecommendation ✅ (recommendation only)
└─ Gap:                   Assignment persistence missing (need separate implementation)

H0 Validation:
├─ Skill Matching:        ✅ ALREADY EXISTS (not new capability)
├─ Workload Balancing:    ✅ EXISTS (not mentioned in H0)
├─ Customer Preference:   ✅ EXISTS (not mentioned in H0)
└─ VIP Rules:             ✅ EXISTS (not mentioned in H0)

Contract Decision:        ⏳ PENDING bookings table audit
├─ Option A:              Extract IStaffRecommendation (narrow)
├─ Option B:              Build IStaffAssignment (recommendation + persistence)
└─ Option C:              Defer (assignment might already exist in bookings)

Next Action:              Audit bookings table schema for assigned_ktv_id field
```

---

**Audit Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ✅ **SOURCE AUDIT COMPLETE**  
**Next:** Audit bookings table schema before Contract #3 extraction decision
