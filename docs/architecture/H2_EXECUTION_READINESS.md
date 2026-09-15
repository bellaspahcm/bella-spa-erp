# H2 Execution Readiness Checklist

**Date:** 2026-09-15  
**Status:** ✅ **READY TO EXECUTE**  
**Authorization:** H1 APPROVED + CLOSED

---

## Execution Authorization

```
PLANNING / ARCHITECTURE
H0 — Capability Reuse Assessment        🔒 SEALED
H1 — Architecture Gate                  🔒 APPROVED + CLOSED

EXECUTION
H2 — Contract Extraction & Skeleton     🟢 AUTHORIZED TO START
```

---

## Pre-Execution Checklist

### Documentation Readiness

- ✅ H0 FINAL SEALED (3.75× leverage, 73.33% reuse, 8 contracts)
- ✅ H1 Architecture Gate APPROVED + CLOSED
- ✅ H1 Final Gate Review: 5/5 PASS
- ✅ ADR-002 APPROVED (Contract extraction strategy)
- ✅ ADR-003 APPROVED (Beauty Services platform formalization, terminology corrected)
- ✅ ADR-004 APPROVED (Walk-in Queue scope)
- ✅ ADR-005 APPROVED — INVESTIGATION FIRST (Service Inventory source, investigation enhanced)
- ✅ H2 Phase Document ready
- ✅ H2 Baseline Template ready
- ✅ H2 Execution Readiness Checklist (this document)
- ✅ Pre-H2 Canonicalization Checklist ready

### Canonical Checkpoint Readiness

**⚠️ CRITICAL:** H2 baseline MUST be locked from `origin/main` (canonical remote), NOT local uncommitted state.

**Pre-H2 Canonicalization Protocol:**
- ⏳ Execute `PRE_H2_CANONICALIZATION_CHECKLIST.md` (Steps 1-11)
- ⏳ Canonical SHA locked from `origin/main`
- ⏳ H2 branch created: `feat/haircut-h2-contract-extraction`

**Reference:** See `docs/architecture/PRE_H2_CANONICALIZATION_CHECKLIST.md` for detailed protocol.

### Technical Readiness

- ⏳ Working tree clean (verify at canonicalization)
- ⏳ Spa regression GREEN (verify at canonicalization)
- ⏳ Architecture guard GREEN (verify at canonicalization)
- ⏳ Canonical commit SHA locked from `origin/main` (canonicalization Step 10)
- ⏳ H2 timer started (canonicalization Step 10)
- ⏳ H2 development branch created (canonicalization Step 11)

---

## H2 Day 1 — Execution Order

### Pre-Day-1: Canonicalize H1 Checkpoint (MANDATORY)

**⚠️ MUST complete BEFORE Day 1 Morning:**

Execute `PRE_H2_CANONICALIZATION_CHECKLIST.md` protocol (Steps 1-11):
1. Verify working tree state
2. Fetch remote state
3. Compare local vs remote
4. Verify H0/H1 documents committed
5. Run architecture guard (MUST be GREEN)
6. Run Spa regression (MUST be GREEN)
7. Commit checkpoint if needed
8. Push canonical main
9. Fetch and confirm canonical SHA
10. Lock H2 baseline from `origin/main` SHA
11. Create H2 development branch

**Result:** 
- Canonical SHA locked from `origin/main`
- H2 baseline recorded in `H2_BASELINE_COMMIT.txt`
- H2 timer started
- H2 branch `feat/haircut-h2-contract-extraction` created

**BLOCKER:** IF canonicalization fails (RED tests, diverged state) → Fix BEFORE Day 1.

---

### Morning: Verify H2 Baseline Locked

**⚠️ Baseline MUST be locked from canonicalization protocol BEFORE starting Contract #1**

**Verification:**
```bash
# Verify canonical SHA recorded
cat docs/architecture/H2_BASELINE_COMMIT.txt

# Verify on H2 branch
git branch --show-current
# Expected: feat/haircut-h2-contract-extraction

# Verify branch points to canonical SHA
git rev-parse HEAD
# Expected: <canonical SHA from H2_BASELINE_COMMIT.txt>

# Verify working tree clean
git status
# Expected: working tree clean
```

**IF baseline NOT locked:**
- ❌ DO NOT proceed to Contract #1
- Execute Pre-H2 Canonicalization Checklist FIRST
- Lock baseline from `origin/main`
- THEN proceed to Contract #1

---

### Afternoon: Extract IWaitlistEngine (Contract #1)

**Step 1: Read Existing Spa Implementation**
```bash
# Locate waitlist engine
ls -la src/products/bella-spa/engines/waitlist-engine/

# Read implementation
cat src/products/bella-spa/engines/waitlist-engine/waitlist-engine.service.ts
cat src/products/bella-spa/engines/waitlist-engine/waitlist-engine.module.ts
```

**Step 2: Define Contract Interface**
```typescript
// Create: src/contracts/beauty/IWaitlistEngine.ts
// Principle: Extract AROUND existing implementation
// Do NOT rewrite Spa engine to fit contract
// Extract methods Spa already provides

export interface IWaitlistEngine {
  // Define methods based on existing Spa implementation
  // Example (adjust to actual Spa API):
  addToWaitlist(request: WaitlistRequest): Promise<WaitlistEntry>;
  getWaitlistPosition(entryId: string): Promise<number>;
  removeFromWaitlist(entryId: string): Promise<void>;
  // ... other methods Spa already has
}
```

**Step 3: Create Spa Adapter**
```typescript
// Create: src/products/bella-spa/adapters/waitlist.adapter.ts
// Purpose: Spa continues using waitlist-engine via contract

import { IWaitlistEngine } from 'src/contracts/beauty/IWaitlistEngine';
import { WaitlistEngineService } from '../engines/waitlist-engine/waitlist-engine.service';

export class SpaWaitlistAdapter implements IWaitlistEngine {
  constructor(private waitlistEngine: WaitlistEngineService) {}
  
  // Delegate to existing Spa engine (minimal translation)
  async addToWaitlist(request: WaitlistRequest): Promise<WaitlistEntry> {
    return this.waitlistEngine.addToWaitlist(request);
  }
  
  // ... implement other methods
}
```

**Step 4: Validation Loop**
```bash
# Run Spa regression (waitlist features MUST work unchanged)
npm run test:spa -- --grep waitlist

# IF RED → Rollback contract + adapter, fix interface, retry
# IF GREEN → Continue to architecture guard

# Run architecture guard
npm run healthcare:verify

# IF RED → Check for frozen kernel violation, fix, retry
# IF GREEN → Continue to evidence documentation
```

**Step 5: Document Extraction Cost**
```
Contract: IWaitlistEngine
Extraction date: <YYYY-MM-DD>

EXTRACTION COST:
Files touched:
- Contract: 1 file (IWaitlistEngine.ts)
- Adapter: 1 file (waitlist.adapter.ts)
- Spa modified: <X> files (if any refactoring needed)
- Tests: <Y> files (if new tests added)

Lines of code:
- Contract interface: <X> LOC
- Adapter implementation: <Y> LOC
- Spa modified: <Z> LOC (refactor to support contract)
- Test added: <W> LOC

Time cost:
- Extraction time: <X> hours
- Debugging time: <Y> hours (if any regression failures)
- Total: <Z> hours

Test impact:
- Existing tests affected: <X> tests
- New tests required: <Y> tests
- Regression failures: <Z> (if any, with root cause)

Complexity:
- Adapter complexity: Simple/Medium/Complex
- Abstraction quality: Clean/Needs refinement/Too complex
- Spa-specific assumptions: None/Minor/Major

Validation:
- Spa regression: PASS
- Architecture guard: PASS
```

**Step 6: Commit with Evidence**
```bash
git add src/contracts/beauty/IWaitlistEngine.ts
git add src/products/bella-spa/adapters/waitlist.adapter.ts
git commit -m "feat(H2): Extract IWaitlistEngine contract (Contract #1)

Evidence:
- Spa regression: PASS
- Architecture guard: PASS
- Extraction cost: <X> hours
- Files: 1 contract + 1 adapter + <Y> Spa modified
- LOC: <X> contract + <Y> adapter + <Z> Spa modified
- Complexity: Simple/Medium/Complex

Closes: H2 Contract #1"
```

**GATE:** Contract #1 evidence MUST be documented + GREEN before starting Contract #2.

---

### Parallel: E7 Investigation (Research Track, No Code)

**Day 1 Tasks (Research Only):**
- Read E7 contracts: IInventoryDomain, IMovement, IOperational
- Ownership analysis: WHO owns service inventory? (E7 vs Beauty Services)
- Semantic fit assessment: warehouse vocabulary → salon vocabulary translation
- Document findings in research notes (no code changes)

**Key Questions:**
1. Does E7 support fractional units (30ml shampoo)?
2. Does E7 support service-level deductions?
3. WHO owns service inventory data? (ownership validation)
4. Does E7 vocabulary map to Beauty Services? (semantic fit)

**Output:** Research notes only (no code dependency on E7 yet)

**Day 2-3 Tasks:** Continue investigation (invariants, frozen constraint, dependency direction, data ownership, extension cost)

**Decision Point:** End of Day 3 → E7 Applicable (YES/NO/INCONCLUSIVE → fallback to product-level)

---

## Next Mandatory Evidence

**Before starting Contract #2 (IStaffAssignment), MUST have:**

1. ✅ Canonical SHA locked
2. ✅ Clean working tree confirmed
3. ✅ Spa regression GREEN (baseline)
4. ✅ Architecture guard GREEN (baseline)
5. ✅ H2 timer started
6. ✅ Contract #1 (IWaitlistEngine) evidence documented:
   - Spa regression: PASS
   - Architecture guard: PASS
   - Extraction cost: <documented>
   - Committed with evidence

7. ✅ E7 investigation Day 1 findings documented (research only, no blocker)

**IF any evidence missing → PAUSE H2, complete evidence closure before proceeding.**

---

## Execution Principles

### 1. Incremental Validation (MANDATORY)

**NOT ALLOWED:**
- Extract 4 contracts → Test Spa (batch extraction)
- "We'll fix tests later" (deferred validation)
- Spa regression RED → Continue to next contract

**REQUIRED:**
- Extract Contract #1 → Spa regression → Architecture guard → Evidence → Contract #2
- IF Spa regression RED after 3 retries → PAUSE H2, escalate to Architecture Council
- IF abstraction wrong → Detect at Contract #1 (NOT after Contract #4)

---

### 2. Extract Around Implementation (MANDATORY)

**NOT ALLOWED:**
- Rewrite Spa engine to fit "ideal" contract interface
- Force abstraction Spa doesn't support
- Break Spa functionality to make contract "cleaner"

**REQUIRED:**
- Read existing Spa implementation FIRST
- Define contract interface based on what Spa ALREADY provides
- Adapter delegates to existing Spa engine (minimal translation)
- Spa continues working EXACTLY as before (zero disruption)

---

### 3. Evidence Before Progress (MANDATORY)

**NOT ALLOWED:**
- "Tests passed on my machine" (no documented evidence)
- Skip extraction cost tracking ("we'll estimate later")
- Move to Contract #2 before Contract #1 evidence documented

**REQUIRED:**
- Document extraction cost (files, LOC, time, tests)
- Commit with evidence (Spa regression, architecture guard, extraction cost)
- Evidence closure: Contract #1 GREEN + documented → Contract #2 authorized

---

### 4. No Code Dependency Until Verdict (E7 Investigation)

**NOT ALLOWED:**
- Start E7 integration before investigation completes
- Create code dependency on E7 during research phase
- Assume E7 applicable before 7-condition validation

**REQUIRED:**
- E7 investigation = research only (Day 1-3)
- No code imports from E7 during investigation
- Decision made at Day 3: E7 Applicable (YES/NO) OR fallback to product-level
- Code dependency ONLY after verdict (Week 3)

---

## Measurement Discipline

### H0 vs H2 Measurements

**H0 Baseline (SEALED, cannot change):**
- 3.75× reuse leverage (H0 assessment)
- 73.33% capability reuse (H0 assessment)
- 8 contracts identified (H0 identification)

**H2 Measurements (TBD from implementation):**
- Actual reuse ratio (measure from H2 code, NOT inherit H0 73.33%)
- Actual new-code ratio (measure from H2 code)
- Actual duration (6 weeks forecast vs actual)
- Extraction cost (formalization overhead per contract)

**Platform Leverage (H2 → Nail Shop):**
- Haircut formalization cost: TBD (sum of 8 contracts extraction cost)
- Nail Shop consumption cost: TBD (Q1 2027, adapter creation only)
- Reuse Cost Advantage = Haircut formalization / Nail consumption
- Cost Reduction = 1 - (Nail consumption / Haircut formalization)

**Normalization:** Compare ONLY shared capabilities (8 contracts), NOT total product scope.

---

## Blocker Escalation

**PAUSE H2 if:**
1. Spa regression RED after 3 retry attempts (contract abstraction may be wrong)
2. Architecture guard RED (frozen kernel violation detected)
3. Working tree dirty at baseline lock (cannot establish clean baseline)
4. Contract extraction takes > 2× forecast (e.g., Contract #1 forecast 1 day, actual > 2 days)

**Escalate to Architecture Council:**
- Root cause analysis
- Pivot decision (continue H2? redesign contract? rollback?)
- Timeline re-forecast

**Do NOT:**
- Force contracts with inappropriate abstraction to meet timeline
- Skip validation to "catch up" schedule
- Accumulate technical debt to meet 6-week forecast

---

## Success Criteria (Evidence-Based)

**H2 Success = Evidence Quality, NOT Forecast Achievement**

**Primary Success:**
1. ✅ Platform-first development model validated (Haircut consumes contracts, NOT duplicate Spa code)
2. ✅ Extraction cost documented (formalization overhead measured)
3. ✅ Spa zero disruption (regression GREEN throughout H2)
4. ✅ Architecture guard GREEN (no frozen kernel violations)
5. ✅ Contract stability (v1.0.0, minimal breaking changes)

**Secondary Success:**
1. Actual reuse ≥ 80% (platform-first validated, contracts generic)
2. Adapter complexity < 20% (contracts do heavy lifting)
3. Actual duration ≤ 8 weeks (6-week forecast + 2-week buffer)

**IF Primary Success achieved but Secondary missed:**
- Result: VALID (architecture clean, measurements provide learning)
- Action: Refine contracts for Nail Shop (use H2 evidence to improve)

**IF Primary Success NOT achieved:**
- Result: INVESTIGATION REQUIRED (contracts may be wrong abstraction)
- Action: Postmortem, pivot decision (redesign vs abandon shared contracts)

---

## Authorization Confirmation

**H1 Status:** 🔒 APPROVED + CLOSED  
**H2 Status:** 🟢 AUTHORIZED TO START  
**Baseline Lock:** ⏳ PENDING (Week 1, Day 1 morning)

**Authorized By:** Architecture Council  
**Authorization Date:** 2026-09-15  
**Execution Start:** Week 1, Day 1 (immediately after baseline lock)

**Confirmation:** I confirm that:
- [ ] H1 Architecture Gate APPROVED + CLOSED
- [ ] 4 ADRs APPROVED (ADR-002, ADR-003, ADR-004, ADR-005)
- [ ] H2 Phase Document ready
- [ ] H2 Baseline Template ready
- [ ] Execution principles understood (incremental validation, extract around implementation, evidence before progress)
- [ ] Blocker escalation protocol understood
- [ ] Measurement discipline understood (H0 baseline ≠ H2 measurements)
- [ ] Ready to lock H2 baseline (Week 1, Day 1 morning)

**Execution Start Authorized:** ___________________________  
**Date:** ___________________________

---

**H2 Execution Readiness Version:** 1.0.0  
**Status:** ✅ **READY TO EXECUTE**  
**Next Action:** H2 Week 1, Day 1 Morning — Lock H2 Baseline
