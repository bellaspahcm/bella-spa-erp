# ADR-006: Temporal Platform Layer for Cross-Vertical Capabilities

**Status:** APPROVED  
**Date:** 2026-09-15  
**Deciders:** Bella Haircut H2 Architecture Team  
**Baseline:** d02b4fbb

---

## Context

During H2 Contract #1 (IWaitlistEngine) extraction, discovered architectural issue:

**Problem:**
- Contract extracted to `src/platform/healthcare/contracts/waitlist-engine.contract.ts`
- Contract serves cross-vertical consumers: Healthcare (Medical) + Beauty (Spa, Haircut, Nail)
- Creates vertical coupling: Beauty products depend on Healthcare vertical
- Contract has NO Healthcare-specific semantics (generic time-based queue)

**Evidence:**
- Contract methods are generic: addToWaitlist, processSlotAvailable, recalculatePositions
- Business rules (priority calculation) are **consumer responsibility**, not baked into contract
- Applicable to any vertical with time-sensitive queuing (Auto, Education, Real Estate)
- Current consumers: Spa (Beauty), Haircut (Beauty), Medical (Healthcare - future)

**Risk if not fixed:**
- Technical debt: Beauty products import `@/platform/healthcare`
- Semantic confusion: Healthcare vertical contains non-Healthcare capabilities
- Future verticals (Auto, Education) forced to depend on Healthcare
- High resolution cost: Moving contract after multiple consumer integrations

---

## Decision

**Create Platform Contracts Layer for cross-vertical generic capabilities.**

**Structure:**

```
src/platform/
├─ healthcare/              # Healthcare vertical kernel (H1-H12)
│  ├─ engines/
│  └─ contracts/            # Healthcare-SPECIFIC contracts only
│
├─ logistics/               # Logistics kernel (E7.1-E7.3)
│  └─ domain/
│
├─ education/               # Education vertical kernel
│  └─ contracts/
│
├─ real-estate/             # Real Estate vertical kernel
│  └─ contracts/
│
├─ contracts/               # PLATFORM contracts (cross-vertical)
│  └─ v1/
│     ├─ InboxReceiver.ts                    # Existing
│     └─ waitlist-engine.contract.ts         # NEW (moved from healthcare)
│
└─ [other platform capabilities]
```

**Rationale:**
1. **Semantic Clarity:** Platform contracts = cross-vertical generic capabilities
2. **Vertical Independence:** No cross-vertical dependencies (Beauty ↛ Healthcare)
3. **Extensibility:** Any vertical can use platform contracts without coupling
4. **Existing Precedent:** `src/platform/contracts/v1/` already exists (InboxReceiver)

---

## Classification: Platform vs Vertical Contract

### Platform Contract Criteria

A contract belongs in `src/platform/contracts/` IF:

1. ✅ **Semantically generic:** No vertical-specific domain concepts (no clinical, beauty-specific, auto-specific semantics)
2. ✅ **Cross-vertical consumers:** Used by multiple verticals (Healthcare + Beauty + Education)
3. ✅ **Business rules external:** Contract defines capability interface, consumers implement business rules
4. ✅ **Applicable broadly:** Can be reused by any vertical with similar capability needs

### Vertical Contract Criteria

A contract belongs in `src/platform/{vertical}/contracts/` IF:

1. ✅ **Vertical-specific semantics:** Contains domain concepts unique to that vertical (clinical protocols, beauty techniques, automotive systems)
2. ✅ **Single vertical consumers:** Only used within that vertical
3. ✅ **Business rules embedded:** Contract enforces vertical-specific invariants
4. ✅ **Not generalizable:** Cannot be reused by other verticals without semantic mismatch

---

## IWaitlistEngine Classification

### Semantic Analysis

**Contract characteristics:**
- Priority score (generic number, no vertical semantics)
- Position management (sequential ordering)
- Status lifecycle (active → notified → converted)
- Slot availability processing (time-based matching)
- **NO** clinical semantics (no diagnosis, treatment, patient records)
- **NO** beauty semantics (no stylist skills, product inventory)
- **NO** vertical-specific invariants

**Business rules (consumer responsibility):**
- Healthcare: Priority by triage/urgency (clinical decision)
- Beauty: Priority by FIFO + customer tier
- Auto: Priority by arrival time + service type
- Education: Priority by registration date + student status

**Verdict:** ✅ **PLATFORM CONTRACT** — Generic time-based queue, vertically agnostic

---

### Consumer Analysis

**Known consumers:**
- Bella Spa (Beauty vertical) — Existing implementation
- Bella Haircut (Beauty vertical) — H2 extraction
- Bella Nail (Beauty vertical) — Future
- Bella Medical (Healthcare vertical) — Future

**Potential consumers:**
- Bella Auto (Auto vertical) — Service bay queue
- Bella Education (Education vertical) — Class enrollment waitlist
- Bella Real Estate (Real Estate vertical) — Property viewing queue

**Verdict:** ✅ **CROSS-VERTICAL** — Serves multiple verticals

---

## Implementation

### Step 1: Move Contract File

**From:**
```
src/platform/healthcare/contracts/waitlist-engine.contract.ts
```

**To:**
```
src/platform/contracts/v1/waitlist-engine.contract.ts
```

**Command:**
```bash
git mv \
  src/platform/healthcare/contracts/waitlist-engine.contract.ts \
  src/platform/contracts/v1/waitlist-engine.contract.ts
```

---

### Step 2: Update Contract Metadata

**Before:**
```typescript
WAITLIST_ENGINE_CONTRACT_METADATA = {
  name: 'IWaitlistEngine',
  version: '1.0.0',
  kernel: 'H2 Temporal (Healthcare Platform)',  // ❌ WRONG
  // ...
}
```

**After:**
```typescript
WAITLIST_ENGINE_CONTRACT_METADATA = {
  name: 'IWaitlistEngine',
  version: '1.0.0',
  kernel: 'Platform Contracts',                 // ✅ CORRECT
  platform_layer: 'temporal',                   // ✅ Capability classification
  // ...
}
```

---

### Step 3: Update Exports

**Remove from Healthcare:**

`src/platform/healthcare/contracts/index.ts`:
```typescript
// Remove:
export * from './waitlist-engine.contract';
```

**Add to Platform:**

Create/update `src/platform/contracts/v1/index.ts`:
```typescript
export * from './InboxReceiver';
export * from './waitlist-engine.contract';
```

---

### Step 4: Create Platform Contracts Index

`src/platform/contracts/index.ts`:
```typescript
/**
 * Platform Contracts
 * 
 * Cross-vertical generic capability contracts.
 * 
 * **Classification:**
 * - Semantically generic (no vertical-specific domain concepts)
 * - Cross-vertical consumers (multiple verticals use same contract)
 * - Business rules external (consumers implement, not contract)
 * - Broadly applicable (any vertical can reuse)
 * 
 * **Vertical-specific contracts belong in:**
 * - src/platform/healthcare/contracts/ (Healthcare vertical)
 * - src/platform/logistics/contracts/ (Logistics vertical)
 * - src/platform/education/contracts/ (Education vertical)
 * - etc.
 * 
 * @module platform/contracts
 */

export * from './v1';
```

---

## Consequences

### Positive

1. **✅ Clean vertical independence:**
   - Beauty products: `import { IWaitlistEngine } from '@/platform/contracts'`
   - Healthcare products: `import { IWaitlistEngine } from '@/platform/contracts'`
   - No cross-vertical dependencies

2. **✅ Semantic clarity:**
   - Platform contracts = generic capabilities
   - Vertical contracts = vertical-specific capabilities
   - Clear ownership boundary

3. **✅ Extensibility:**
   - Future verticals (Auto, Education) can use platform contracts without Healthcare dependency
   - New platform contracts can be added without affecting verticals

4. **✅ Correct-by-design:**
   - Fixed before any consumer integration (low cost)
   - Prevents technical debt

---

### Negative

1. **⚠️ Additional platform layer:**
   - Need to maintain platform contracts separately from vertical contracts
   - Developers must understand platform vs vertical classification

2. **⚠️ Naming ambiguity:**
   - `src/platform/contracts/` could be confused with `src/platform/contract/` (singular)
   - `src/platform/contracts/` vs `src/platform/healthcare/contracts/` - similar names, different purposes

**Mitigation:**
- Document classification criteria clearly (this ADR)
- Add README.md in each contracts directory explaining scope
- Code review checklist: "Is this contract platform or vertical?"

---

## Alternatives Considered

### Alternative 1: Keep in Healthcare, Accept Coupling

**Decision:** ❌ REJECTED

**Rationale:**
- Creates technical debt (Beauty → Healthcare dependency)
- Semantic confusion (Healthcare contains non-Healthcare capability)
- High future resolution cost

---

### Alternative 2: Create Temporal Platform Layer

**Structure:**
```
src/platform/temporal/
├─ contracts/
│  └─ waitlist-engine.contract.ts
└─ engines/
   └─ waitlist-engine/
```

**Decision:** ❌ REJECTED (for now)

**Rationale:**
- More semantically accurate (temporal = time-based capabilities)
- But requires new platform layer infrastructure
- Overkill for single contract
- Can refactor later if more temporal contracts emerge

**Future:** If 3+ temporal contracts exist (schedule, appointment, reservation, time slot), consider creating `src/platform/temporal/` layer

---

### Alternative 3: Beauty Services Platform Layer

**Path:** `src/platform/beauty/contracts/waitlist-engine.contract.ts`

**Decision:** ❌ REJECTED

**Rationale:**
- Same coupling problem, reversed (Healthcare → Beauty)
- Beauty is a vertical, not a platform capability
- Medical waitlist ≠ Beauty waitlist semantically

---

## Validation

### Architecture Guard Compliance

**Check:**
- Platform contracts allowed: ✅ (not frozen)
- Healthcare contracts modification: N/A (removing export, not modifying frozen files)
- Git workflow: Single scope (platform contract extraction)

**Expected:** ✅ PASS

---

### Contract Import Paths

**Before (incorrect):**
```typescript
// Beauty product importing Healthcare contract
import { IWaitlistEngine } from '@/platform/healthcare/contracts';  // ❌ Vertical coupling
```

**After (correct):**
```typescript
// Any product importing platform contract
import { IWaitlistEngine } from '@/platform/contracts';  // ✅ Platform capability
```

---

## Migration Impact

### Existing Code

**Spa implementation:**
- Current: Uses direct service (`src/services/waitlist/waitlist-service.ts`)
- Impact: None (service not yet using contract)
- Future: Will implement IWaitlistEngine interface

**Haircut implementation:**
- Current: Not yet implemented (H2 in progress)
- Impact: None (will use platform contract path)

**No breaking changes** — Contract not yet consumed by any code

---

## Documentation Updates

1. ✅ This ADR documents platform vs vertical classification
2. ✅ Update H2_CONTRACT_01_IWAITLIST_ENGINE_EXTRACTION.md (new path)
3. ✅ Update H2_CONTRACT_01_OWNERSHIP_REVIEW.md (resolution)
4. ✅ Create README.md in `src/platform/contracts/` explaining scope
5. ✅ Update contract metadata (kernel: 'Platform Contracts')

---

## Related Decisions

- **ADR-002:** Contract Extraction Strategy — Establishes contract extraction protocol
- **ADR-003:** Beauty Services Platform Formalization — Defines vertical structure
- **ADR-004:** Walk-in Queue Scope — Confirms waitlist is product feature, not kernel engine
- **ADR-005:** Service Inventory Source — Pending investigation (E7 vs dedicated contract)

---

## Implementation Checklist

- [ ] Move contract file: healthcare/contracts → platform/contracts/v1
- [ ] Update contract metadata (kernel: 'Platform Contracts')
- [ ] Remove export from healthcare/contracts/index.ts
- [ ] Add export to platform/contracts/v1/index.ts
- [ ] Create platform/contracts/index.ts (root export)
- [ ] Create platform/contracts/README.md (scope documentation)
- [ ] Update H2 extraction evidence documents
- [ ] Verify Architecture Guard compliance
- [ ] Commit with refactor message
- [ ] Lock Contract #1 ownership

---

## Decision Outcome

**Status:** ✅ **APPROVED**

**Action:** Move IWaitlistEngine from Healthcare vertical to Platform contracts layer

**Reasoning:**
- Contract is semantically generic (time-based queue, no vertical semantics)
- Serves cross-vertical consumers (Healthcare + Beauty)
- Business rules are consumer-specific (not baked into contract)
- Prevents vertical coupling (Beauty → Healthcare dependency)
- Correct-by-design (fixed before consumer integration)

**Next:**
1. Execute implementation checklist
2. Lock Contract #1 ownership
3. Resume H2 Contract #2 extraction (IServiceInventoryEngine)

---

**ADR Version:** 1.0.0  
**Status:** APPROVED  
**Date:** 2026-09-15  
**Baseline:** d02b4fbb
