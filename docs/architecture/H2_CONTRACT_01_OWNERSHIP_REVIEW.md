# H2 Contract #1 Ownership Review: IWaitlistEngine

**Date:** 2026-09-15  
**Status:** ⚠️ **OWNERSHIP VALIDATION REQUIRED**

---

## Problem Statement

**IWaitlistEngine** extracted to `src/platform/healthcare/contracts/waitlist-engine.contract.ts` with metadata declaring:

```typescript
kernel: 'H2 Temporal (Healthcare Platform)'
consumers: ['Bella Spa', 'Bella Haircut', 'Bella Nail', 'Bella Medical']
```

**Issue:** Contract serves **cross-vertical consumers** (Healthcare + Beauty Services) but placed under Healthcare ownership.

**Risk:** 
- Beauty products (Spa, Haircut, Nail) depend on Healthcare contract
- Creates vertical coupling (Beauty → Healthcare)
- Violates domain boundaries if waitlist is generic capability, not Healthcare-specific

---

## Ownership Analysis

### Current Placement

**Path:** `src/platform/healthcare/contracts/waitlist-engine.contract.ts`  
**Declared Kernel:** H2 Temporal (Healthcare Platform)  
**Metadata Consumers:** Healthcare + Beauty

**Implication:** Healthcare owns contract, Beauty consumes via cross-vertical dependency

---

## Domain Classification

### Option 1: Healthcare Kernel Ownership (Current)

**Rationale:** Waitlist originated from Healthcare temporal/scheduling domain

**Pros:**
- Follows extraction source (Spa uses Healthcare patterns)
- H2 Temporal kernel already exists in Healthcare
- Medical use cases clearly fit Healthcare

**Cons:**
- ❌ Beauty products depend on Healthcare vertical
- ❌ Violates vertical independence (Beauty should not import `@/platform/healthcare`)
- ❌ Semantic mismatch: "Healthcare" ≠ "Beauty Services"
- ❌ Forces Beauty to depend on Healthcare even when no clinical features needed

**Verdict:** ❌ **INCORRECT** — Creates vertical coupling

---

### Option 2: Shared Platform Capability

**Rationale:** Waitlist is generic time-based resource allocation, not Healthcare-specific

**Evidence:**
- Business rules are **consumer-specific** (Healthcare: triage, Beauty: FIFO)
- No clinical/medical semantics in contract (no diagnosis, treatment, patient records)
- Contract methods are generic: addToWaitlist, processSlotAvailable, recalculatePositions
- Applicable to any vertical with time-sensitive queuing (Auto, Education, etc.)

**Ownership Models:**

#### 2A. Platform Shared Kernel

**Path:** `src/platform/shared/contracts/waitlist-engine.contract.ts`

**Pros:**
- ✅ Vertical-independent (no Healthcare/Beauty coupling)
- ✅ Semantic clarity: Shared capability, not vertical-specific
- ✅ Reusable by any vertical (Auto service queue, Education class waitlist)

**Cons:**
- Requires `src/platform/shared/` structure (may not exist yet)
- Slightly more abstract (no vertical context)

---

#### 2B. Temporal Platform Capability

**Path:** `src/platform/temporal/contracts/waitlist-engine.contract.ts`

**Pros:**
- ✅ Semantically accurate: Temporal = time-based resource allocation
- ✅ Aligns with H2 Temporal kernel concept (time, schedule, queue)
- ✅ Clear separation: Temporal platform capabilities vs vertical-specific kernels
- ✅ Beauty/Healthcare/Auto/Education all use temporal platform without cross-vertical dependency

**Cons:**
- Requires `src/platform/temporal/` structure
- Need to define platform vs vertical kernel boundaries

---

### Option 3: Beauty Services Kernel

**Path:** `src/platform/beauty/contracts/waitlist-engine.contract.ts`

**Rationale:** Extracted from Spa (Beauty product), used by Haircut/Nail

**Pros:**
- Follows extraction source (Spa implementation)
- Beauty vertical owns Beauty contracts

**Cons:**
- ❌ Healthcare (Medical) cannot depend on Beauty vertical
- ❌ Same vertical coupling problem, just reversed direction
- ❌ Semantic mismatch: Medical waitlist ≠ Beauty waitlist

**Verdict:** ❌ **INCORRECT** — Still creates vertical coupling

---

## Kernel Boundary Investigation

### Existing Platform Structure

Let me check current platform structure:

**Expected paths:**
- `src/platform/healthcare/` — Healthcare vertical kernel (H1-H12)
- `src/platform/logistics/` — Logistics kernel (E7.1-E7.3)
- `src/platform/education/` — Education kernel (if exists)
- `src/platform/real-estate/` — Real Estate kernel (if exists)
- `src/platform/shared/` or `src/platform/temporal/` — Shared/temporal capabilities (if exists)

**Question:** Is there a shared/temporal platform layer, or are all capabilities vertical-specific?

---

## Semantic Analysis: Is Waitlist Healthcare-Specific?

### Healthcare-Specific Semantics

**Clinical waitlist characteristics:**
- Priority by triage/urgency (clinical decision)
- Integration with EMR/EHR (patient records)
- Regulatory compliance (HIPAA, patient safety)
- Clinical protocols (admission criteria, medical necessity)

**Contract supports these?** NO — Priority calculation is **consumer responsibility**, contract is generic

---

### Generic Time-Based Queue Semantics

**Contract characteristics:**
- Priority score (generic number, business rule agnostic)
- Position management (sequential ordering)
- Status lifecycle (active → notified → converted)
- Slot availability processing (time-based matching)
- No clinical/medical semantics in contract

**Applicable to:**
- Healthcare: Medical appointment waitlist (triage priority)
- Beauty: Service waitlist (FIFO or tier-based)
- Auto: Service bay queue (arrival time priority)
- Education: Class enrollment waitlist (registration date priority)
- Real Estate: Property viewing queue (inquiry date priority)

**Verdict:** Contract is **generic temporal capability**, not Healthcare-specific

---

## Recommended Architecture

### Proposal: Temporal Platform Layer

**Structure:**

```
src/platform/
├─ healthcare/          # Healthcare vertical kernel (H1-H12)
│  ├─ engines/
│  └─ contracts/        # Healthcare-specific contracts only
│
├─ logistics/           # Logistics kernel (E7.1-E7.3)
│  └─ domain/
│
├─ temporal/            # Temporal platform capabilities
│  ├─ engines/
│  │  └─ waitlist-engine/
│  └─ contracts/
│     └─ waitlist-engine.contract.ts  ← MOVE HERE
│
├─ education/
├─ real-estate/
└─ shared/              # Other shared capabilities
```

**Rationale:**
- Temporal = time-based resource allocation (schedule, queue, reservation)
- Vertical-independent (no Healthcare/Beauty coupling)
- Extensible (Auto, Education, Real Estate can use)
- Clear semantic boundary: Temporal platform vs vertical kernels

---

### Alternative: If No Temporal Layer Exists

**Option A:** Create `src/platform/shared/contracts/`

**Option B:** Keep in Healthcare temporarily, document as "platform candidate"

**Option C:** Create Beauty Services platform (but same coupling issue for Medical)

---

## Decision Criteria

### Keep in Healthcare IF:

1. ✅ Contract has Healthcare-specific semantics (clinical, regulatory)
2. ✅ Only Healthcare products will use this contract
3. ✅ Beauty/Auto/Education have different waitlist contracts
4. ✅ Medical use cases drive contract design

**Current reality:** ❌ NONE of these are true

---

### Move to Temporal/Shared Platform IF:

1. ✅ Contract is semantically generic (time-based queue, no vertical semantics)
2. ✅ Multiple verticals will consume (Healthcare + Beauty confirmed)
3. ✅ Business rules are consumer-specific (not baked into contract)
4. ✅ Applicable to any time-sensitive resource allocation

**Current reality:** ✅ ALL of these are true

---

## Recommendation

### Immediate Action: Move Contract to Platform Layer

**From:** `src/platform/healthcare/contracts/waitlist-engine.contract.ts`  
**To:** `src/platform/temporal/contracts/waitlist-engine.contract.ts` (preferred)  
**Or:** `src/platform/shared/contracts/waitlist-engine.contract.ts` (if no temporal layer)

**Update metadata:**

```typescript
WAITLIST_ENGINE_CONTRACT_METADATA = {
  name: 'IWaitlistEngine',
  version: '1.0.0',
  kernel: 'Temporal Platform',  // NOT 'H2 Temporal (Healthcare Platform)'
  platform_layer: 'temporal',    // NEW: Clarify platform vs vertical
  kernel_responsibility: [
    'Position calculation and uniqueness',
    'Status lifecycle enforcement',
    'Queue invariant validation',
    'Slot availability processing',
    'Expiration management',
  ],
  consumer_responsibility: [
    'Priority score calculation (business rules)',
    'Notification delivery',
    'Booking creation',
    'Business rule enforcement (FIFO, triage, etc.)',
  ],
  consumers: [
    'Healthcare vertical (Medical services)',
    'Beauty vertical (Spa, Haircut, Nail)',
    'Auto vertical (future)',
    'Education vertical (future)',
  ],
  // ...
}
```

---

## H2 Impact

### If Contract Stays in Healthcare

**Technical Debt:**
- Beauty products import `@/platform/healthcare/contracts`
- Vertical coupling: Beauty → Healthcare
- Future verticals (Auto, Education) also depend on Healthcare
- Semantic confusion: Healthcare contains non-Healthcare capabilities

**Resolution Cost:** High (requires ACR to move contract after multiple consumers exist)

---

### If Contract Moves to Platform Now

**Technical Debt:** None

**Benefits:**
- Clean vertical independence
- Semantic clarity (Temporal platform capability)
- Extensible to future verticals without Healthcare dependency
- Correct-by-design architecture

**Cost:** One-time path change (before any consumer integration)

---

## Validation Questions

**Before locking Contract #1, answer:**

1. **Does `src/platform/temporal/` exist?**
   - If YES: Move contract there
   - If NO: Create temporal layer OR use `src/platform/shared/`

2. **Are there other temporal capabilities?**
   - Schedule engine
   - Appointment engine
   - Reservation engine
   - Time slot management
   - If YES: Confirms need for temporal platform layer

3. **Does Healthcare Constitution allow non-Healthcare contracts in `src/platform/healthcare/contracts/`?**
   - Check: `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`

4. **Does Git Workflow allow cross-vertical contract extraction in single PR?**
   - Healthcare contract → Platform layer = 2 scopes?
   - Or: Platform contract extraction = single scope?

---

## Proposed Resolution Path

### Step 1: Investigate Platform Structure

Check if `src/platform/temporal/` or `src/platform/shared/` exists.

### Step 2: Create Platform Layer (If Needed)

If no temporal/shared layer:
```bash
mkdir -p src/platform/temporal/contracts
mkdir -p src/platform/temporal/engines
# Create index.ts, README.md
```

### Step 3: Move Contract

```bash
git mv \
  src/platform/healthcare/contracts/waitlist-engine.contract.ts \
  src/platform/temporal/contracts/waitlist-engine.contract.ts
```

### Step 4: Update Metadata

Change `kernel: 'H2 Temporal (Healthcare Platform)'` → `kernel: 'Temporal Platform'`

### Step 5: Update Imports

Update `src/platform/healthcare/contracts/index.ts` (remove export)  
Create/update `src/platform/temporal/contracts/index.ts` (add export)

### Step 6: Document Architecture Decision

Create ADR-006: Temporal Platform Layer for Cross-Vertical Capabilities

### Step 7: Validate Architecture Guard

Ensure no frozen file violations, platform layer allowed.

### Step 8: Commit

```
refactor(H2): move IWaitlistEngine to Temporal platform layer

Rationale:
- Contract serves cross-vertical consumers (Healthcare + Beauty)
- No Healthcare-specific semantics (generic time-based queue)
- Business rules are consumer-specific (not kernel responsibility)

From: src/platform/healthcare/contracts/waitlist-engine.contract.ts
To:   src/platform/temporal/contracts/waitlist-engine.contract.ts

Metadata updated:
- kernel: 'Temporal Platform' (was 'H2 Temporal (Healthcare Platform)')
- consumers: Healthcare + Beauty + Auto (future) + Education (future)

Prevents vertical coupling (Beauty → Healthcare dependency)
```

---

## Decision Required

**Before proceeding to Contract #2:**

1. ✅ Validate platform structure
2. ✅ Create temporal/shared layer if needed
3. ✅ Move IWaitlistEngine to correct platform layer
4. ✅ Update metadata + imports
5. ✅ Document ADR (if architectural change)
6. ✅ Verify Architecture Guard compliance
7. ✅ Lock Contract #1 ownership

**Only then:** Proceed to Contract #2 (IServiceInventoryEngine)

---

## Summary

```
OWNERSHIP REVIEW — Contract #1 (IWaitlistEngine)

Current Placement:    src/platform/healthcare/contracts/
Current Kernel:       H2 Temporal (Healthcare Platform)
Consumers:            Healthcare + Beauty (cross-vertical)

Issue:                Vertical coupling (Beauty → Healthcare)
Root Cause:           Generic capability placed in vertical kernel
Semantic Fit:         Contract has NO Healthcare-specific semantics

Recommendation:       🔄 MOVE to Temporal Platform Layer
Target Path:          src/platform/temporal/contracts/ (preferred)
Alternative Path:     src/platform/shared/contracts/ (if no temporal)

Impact if NOT fixed:  Technical debt, vertical coupling, semantic confusion
Impact if fixed:      Clean architecture, vertical independence, extensibility

Status:               ⚠️ BLOCKED — Ownership must be corrected before H2 continues
```

---

**Ownership Review Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ⚠️ **VALIDATION REQUIRED**
