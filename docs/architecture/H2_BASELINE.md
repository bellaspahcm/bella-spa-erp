# H2 Baseline — Contract Extraction & Product Skeleton

**Date:** TBD (Lock at H2 Week 1, Day 1)  
**Status:** 🔒 **LOCKED** (Immutable after first commit)  
**Purpose:** Establish measurable baseline for H2 validation

---

## Baseline Commit

**Canonical Commit SHA:** `<TBD>`  
**Branch:** `main` (or feature branch)  
**Lock Date:** TBD  
**Lock Time:** TBD

```bash
# Command to lock baseline
git rev-parse HEAD > docs/architecture/H2_BASELINE_COMMIT.txt
git log -1 --format="%H %ai %s"
```

---

## Pre-H2 State Validation

### Spa Regression Test Results

**Command:**
```bash
npm run test:spa
```

**Result:** `<TBD: PASS/FAIL>`  
**Test Count:** `<X> tests`  
**Pass Rate:** `<Y>% (X/X tests passed)`  
**Duration:** `<Z> seconds`

**⚠️ GATE:** Spa regression MUST be GREEN before H2 starts. IF FAIL → Fix Spa first, then lock baseline.

---

### Architecture Guard Results

**Healthcare OS Verification:**
```bash
npm run healthcare:verify
```

**Result:** `<TBD: PASS/FAIL>`  
**Frozen Artifacts:** E7.1 (12), E7.2 (4), E7.3 (9)  
**Regression Tests:** 547/547 PASS

**Logistics OS Verification:**
```bash
npm run logistics:verify
```

**Result:** `<TBD: PASS/FAIL>`  
**Frozen Artifacts:** E7.1 (12), E7.2 (4), E7.3 (9)  
**Regression Tests:** 547/547 PASS

**⚠️ GATE:** Architecture guard MUST be GREEN before H2 starts. IF FAIL → Frozen kernel violation detected, BLOCK H2.

---

## H2 Starting State

### Beauty Contracts

**Extracted:** 0/8  
**Pending Extraction:**
1. IWaitlistEngine (Week 1, Day 1) — **Contract #1**
2. IStaffAssignment (Week 1, Day 2) — **Contract #2**
3. IAppointmentEngine (Week 1, Day 3) — **Contract #3**
4. IResourceAllocation (Week 1, Day 4-5) — **Contract #4**
5. IServiceCatalog (Week 5)
6. ISessionTracking (Week 5)
7. IDomainEvents (Week 5)
8. IServiceHistory (Week 6)

**Contract Location:** `src/contracts/beauty/` (does NOT exist yet)

**Extraction Discipline:** Incremental validation (NOT batch)
- Extract Contract #1 → Adapter → Spa regression → Architecture guard → Evidence → Contract #2
- IF abstraction wrong → Detect at Contract #1 (NOT after 4 contracts built)
- IF Spa regression fails 3 times → PAUSE H2, escalate to Architecture Council

**Extraction Cost Baseline:** TBD (measure per contract, sum at H2 completion)

---

### Haircut Product

**Status:** NOT CREATED  
**Product Shell:** `src/products/bella-haircut/` (does NOT exist yet)  
**Adapters:** 0/8 (pending creation)  
**Product Features:** Walk-in Queue (NOT built), Service Inventory (pending E7 decision)

---

### E7 Decision

**Status:** PENDING  
**Investigation:** Week 1 (2-3 days)  
**Decision:** TBD (E7 Applicable / NOT Applicable / Product-Level Fallback)

---

## H2 Forecast

### Timeline

**Forecast Duration:** 6 weeks  
**Actual Duration:** TBD (start timer at baseline lock)

**Phase Breakdown (Forecast):**
- Phase 1 (Week 1-2): Extract 4 critical contracts
- Phase 2 (Week 3-4): Build Haircut MVP
- Phase 3 (Week 5-6): Extract remaining 4 contracts

---

### Reuse Targets

**Reuse Target:** ≥90% (ASPIRATIONAL, not success gate)  
**Actual Reuse:** TBD (measure at H2 completion)

**New-Code Target:** <10% (ASPIRATIONAL, not success gate)  
**Actual New Code:** TBD (measure at H2 completion)

**Measurement Method:**
```
Reuse % = (Contract Consumption Code) / (Total Haircut Code) × 100%
New-Code % = (Product-Specific Features + UI) / (Total Haircut Code) × 100%
```

---

### Debt Constraints

**Cross-Vertical Debt:** 0 required (Haircut MUST NOT import from Healthcare/Education)  
**New Architecture Debt:** 0 required (No frozen kernel violations allowed)  
**Technical Debt:** 0 required (No temporary hacks, clean architecture only)

---

## H2 Evidence Tracking

### Contract Extraction Evidence

**Track per contract:**
- Extraction date
- Spa regression result (PASS/FAIL)
- Architecture guard result (PASS/FAIL)
- Adapter complexity (lines of code)
- Breaking changes (v1.0.0 → v1.1.0 → v2.0.0)
- **Extraction cost** (NEW: formalization overhead measurement)

**Extraction Cost Tracking (Per Contract):**
```
1. Files touched
   - Contract definition files: <X> files
   - Adapter files: <Y> files
   - Spa engine files modified: <Z> files
   - Test files: <W> files

2. Lines of code
   - Contract interface LOC: <X> lines
   - Adapter implementation LOC: <Y> lines
   - Spa engine LOC modified: <Z> lines (refactor to support contract)
   - Test LOC added: <W> lines

3. Time cost
   - Actual extraction time: <X> hours/days
   - Regression debugging time: <Y> hours (if any)
   - Total formalization cost: <Z> hours

4. Test impact
   - Existing tests affected: <X> tests
   - New tests required: <Y> tests
   - Regression failures: <Z> (if any, with root cause)

5. Complexity
   - Adapter complexity: Simple / Medium / Complex
   - Abstraction quality: Clean / Needs refinement / Too complex
   - Spa-specific assumptions: None / Minor / Major
```

**Template:**
```
Contract: IWaitlistEngine
Extraction date: <YYYY-MM-DD>
Spa regression: PASS/FAIL
Architecture guard: PASS/FAIL

EXTRACTION COST:
Files touched: <X> contract + <Y> adapter + <Z> Spa modified + <W> tests
LOC: <X> contract + <Y> adapter + <Z> Spa modified + <W> tests
Time: <X> hours extraction + <Y> hours debugging = <Z> total
Tests: <X> affected, <Y> new, <Z> failures
Complexity: Simple/Medium/Complex
Adapter LOC: <X> lines
Breaking changes: None / v1.1.0 / v2.0.0

Notes: <observations>
```

**Formalization Cost Analysis:**
```
HAIRCUT (H2) — First Product Consuming Contracts
- Extraction cost: <sum of 8 contracts> hours (formalization overhead)
- Adapter implementation: <sum of 8 adapters> hours
- Total formalization cost: <X> hours (for shared capabilities only)

This is the "platform investment" — Haircut pays formalization cost.

NAIL SHOP (Q1 2027) — Second Product Consuming Contracts
- Contract consumption: <Y> hours (adapter creation only, for same 8 contracts)
- Formalization cost: 0 hours (contracts already exist)

Platform Leverage Metrics (Normalized to Shared Capabilities):
1. Reuse Cost Advantage = Haircut formalization / Nail consumption
   Example: 80 hours / 8 hours = 10× cost advantage

2. Cost Reduction = 1 - (Nail consumption / Haircut formalization)
   Example: 1 - (8/80) = 90% cost reduction

⚠️ CRITICAL: Compare ONLY shared capabilities (8 contracts).
   Do NOT include product-specific features in leverage calculation.
   Haircut Walk-in Queue ≠ Nail Shop features (different scope).

This proves: "Haircut trả chi phí formalization lần đầu, Nail hưởng đòn bẩy Platform lần thứ hai."
```

---

### Weekly Evidence Checkpoints

**Week 1 Evidence:**
- Contracts extracted: <X>/8
- Spa regression: PASS/FAIL
- E7 decision: TBD
- Blockers: <list>

**Week 2 Evidence:**
- Contracts extracted: <X>/8
- Spa regression: PASS/FAIL
- Haircut shell: Created / NOT created
- Blockers: <list>

**Week 3 Evidence:**
- Haircut MVP: In progress
- Walk-in Queue: Built / In progress
- Service Inventory: E7 integration / Product-level
- Blockers: <list>

**Week 4 Evidence:**
- Haircut MVP: Functional / NOT functional
- Integration tests: PASS/FAIL
- End-to-end tests: PASS/FAIL
- Blockers: <list>

**Week 5 Evidence:**
- Contracts extracted: <X>/8
- Spa regression: PASS/FAIL
- Blockers: <list>

**Week 6 Evidence:**
- Contracts extracted: 8/8
- Actual reuse: <Y>%
- Actual duration: <Z> weeks
- Success criteria: MET / NOT MET
- Blockers: <list>

---

## H2 Success Criteria (Evidence-Based)

### 1. Reuse Measurement

**Target:** ≥90% (aspirational)  
**Actual:** TBD  
**Interpretation:**
- ≥90% = EXCELLENT (platform-first model proven strongly)
- 80-89% = GOOD (platform-first model validated)
- 70-79% = ACCEPTABLE (platform-first works, contracts need refinement)
- <70% = INVESTIGATE (contracts may be too Spa-specific)

---

### 2. Contract Stability

**Target:** v1.0.0 (no breaking changes)  
**Actual:** TBD  
**Breaking Changes:** <list v2.0.0 if any>

---

### 3. Spa Disruption (HARD GATE)

**Target:** Zero Spa breakage  
**Actual:** TBD  
**Spa Regression:** GREEN throughout H2 (MANDATORY)

---

### 4. Adapter Complexity

**Target:** <20% of product code (aspirational)  
**Actual:** TBD  
**Measurement:** Adapter LOC / Total Haircut LOC

---

### 5. Timeline Accuracy

**Forecast:** 6 weeks  
**Actual:** TBD  
**Variance:** TBD (<forecast-actual> weeks)  
**Learning:** Use actual for Nail Shop forecast

---

## Baseline Lock Confirmation

**Baseline Locked By:** `<Name>`  
**Lock Date:** `<YYYY-MM-DD>`  
**Commit SHA:** `<SHA>`  
**Spa Regression:** `<PASS/FAIL>`  
**Architecture Guard:** `<PASS/FAIL>`

**Confirmation:** I confirm that:
- [ ] Spa regression tests are GREEN (100% pass)
- [ ] Architecture guard is GREEN (healthcare:verify + logistics:verify PASS)
- [ ] No frozen kernel violations detected
- [ ] Baseline commit recorded in `H2_BASELINE_COMMIT.txt`
- [ ] H1 Architecture Gate is APPROVED + CLOSED
- [ ] H2 ready to start (Week 1, Day 1)

**Signature:** `___________________________`  
**Date:** `___________________________`

---

**H2 Baseline Version:** 1.0.0  
**Lock Status:** 🔒 **IMMUTABLE** (after first commit)  
**Next Action:** Begin H2 Week 1, Day 1 — IWaitlistEngine contract extraction
