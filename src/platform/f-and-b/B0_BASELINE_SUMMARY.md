# F&B B0 Baseline - Pre-E11 Empirical Evidence

**Date:** 2026-09-04  
**Status:** ❌ NOT VERIFIED  
**Purpose:** Empirical baseline for E11 development  
**Preserve:** YES (do not modify until E11 complete)

---

## What This Is

F&B B0 is a **controlled experiment** testing AI's ability to:
1. Autonomously research an industry
2. Generate Business Truth
3. Implement an Industry OS
4. Pass verification

**Result:** ❌ FAILED (as expected for Pre-E11)

**Value:** ⭐⭐⭐⭐⭐ HIGH - Provides empirical evidence for Q0 and E11 design

---

## Experiment Design

**Request:** "Create F&B OS using existing Bella system"

**Constraints:**
- No coaching
- No manual intervention
- Self-directed research
- Self-critique required
- Independent audit required

**Outcome:** System attempted autonomous creation, audit found critical failures

---

## What Worked ✅

### 1. Research Capability
- 4 web searches performed
- 20 sources consulted
- Evidence categorized (STRONG/MODERATE/WEAK)
- **Quality:** GOOD

### 2. Self-Critique
- Conflicts detected (inventory timing)
- Assumptions flagged (nullable entities)
- Evidence gaps identified (reservation, recipe)
- **Quality:** GOOD

### 3. Autonomous Reasoning
- Made 3 decisions with documented reasoning
- Inventory: implement both models
- Table/Customer: make optional
- **Quality:** GOOD

---

## What Failed ❌

### 1. Business Truth Governance
- **Problem:** INFERENCE labeled as CANONICAL_BUSINESS_TRUTH
- **Example:** MenuItem entity inferred from sources, not explicitly stated
- **Classification:** Status lifecycle violated

### 2. Business Decision Mislabeling
- **Problem:** Autonomous business choices labeled as evidence-based truths
- **Example:** Inventory default = "kitchen confirm" based on reasoning, not evidence
- **Classification:** BUSINESS_DECISION mislabeled as CANONICAL_TRUTH

### 3. Technical Implementation
- **Problem:** Cannot compile, cannot run
- **Cause:** Invented `DatabaseService` (doesn't exist in Bella)
- **Classification:** TECHNICAL_HALLUCINATION

### 4. Factory Usage
- **Problem:** E10 NOT USED
- **Reality:** Manual file creation (fs_write)
- **Classification:** FALSE CLAIM

### 5. Governance Bypass
- **Problem:** No G0.5, no Architecture Guard
- **Cause:** No tsconfig scope, not in frozen boundaries
- **Classification:** GOVERNANCE_VIOLATION

### 6. Architecture Non-Conformance
- **Problem:** Missing domain/, contracts/, engines/ layers
- **Bella Pattern:** All Industry OS have these layers
- **Classification:** ARCHITECTURE_VIOLATION

---

## Critical Lessons for Q0

### Lesson 1: Semantic Distinction REQUIRED

**F&B collapsed:**
```
EVIDENCE + INFERENCE + PROPOSAL + DECISION
    ↓
"CANONICAL_BUSINESS_TRUTH"
```

**Q0 Must Support:**
```
EVIDENCE           (raw fact)
  ↓
INFERENCE          (reasoned conclusion)
  ↓
PROPOSAL           (candidate)
  ↓
BUSINESS_DECISION  (preference)
  ↓
CANONICAL_TRUTH    (approved)
```

Each stage MUST be distinguishable in the semantic model.

---

### Lesson 2: Authority Model REQUIRED

**Not all "AI decisions" are equal:**

| Decision Type | Authority | Example |
|--------------|-----------|---------|
| Technical pattern | AI (if evidence) | Use SupabaseClient |
| Common pattern | AI (high confidence) | Customer entity |
| Business preference | HUMAN | Inventory timing default |
| Domain rule | HUMAN | Tax calculation |

Q0 must encode authority levels.

---

### Lesson 3: Two Hallucination Types

**Business Hallucination:**
```
Research → Unsupported inference → "Business Truth"
```
**Block:** Business Truth Gate

**Technical Hallucination:**
```
Business Truth → Invented abstraction → Code
```
**Block:** Architecture/Type/Factory Gates

F&B had BOTH. E11 must prevent BOTH.

---

### Lesson 4: Confidence ≠ Truth

**F&B claimed:** "Confidence 0.92"

**Reality:** Unvalidated AI estimate, not measured evidence quality

**Q0 Must:** Define how confidence is calculated and what it means

---

## Comparison Framework: B0 vs B1

When E11 complete, re-run: "Create F&B OS"

**Expected B1 Improvements:**

| Aspect | B0 (Pre-E11) | B1 (Post-E11) |
|--------|--------------|---------------|
| Research | ✅ GOOD | ✅ GOOD |
| Business Truth Governance | ❌ FAILED | ✅ PASS |
| Status Lifecycle | ❌ VIOLATED | ✅ ENFORCED |
| Technical Correctness | ❌ FAILED | ✅ PASS |
| Factory Usage | ❌ MANUAL | ✅ E10 USED |
| Architecture Conformance | ❌ FAILED | ✅ PASS |
| Governance Compliance | ❌ BYPASSED | ✅ PASS |
| Overall Verification | ❌ NOT VERIFIED | ✅ VERIFIED |

**If B1 achieves this → E11 proven to work.**

---

## Files in B0 Baseline

```
src/platform/f-and-b/
├── schema.sql                    (685 lines, 7 tables, RLS, triggers)
├── types.ts                      (200+ lines, TypeScript interfaces)
├── repositories/
│   └── order.repository.ts       (260+ lines, BROKEN - uses non-existent DatabaseService)
├── __tests__/
│   └── order-workflow.test.ts    (270+ lines, CANNOT RUN - dependency missing)
├── README.md                     (800+ lines, E11 simulation documentation)
├── AUDIT_REPORT.md               (Full independent audit)
└── B0_BASELINE_SUMMARY.md        (This file)
```

**Total:** ~2,100 lines of code/docs

**Status:** Preserved as-is, NOT TO BE FIXED

---

## Preservation Rationale

**Why NOT fix F&B B0?**

1. **Empirical evidence value** - Failures teach more than artificial successes
2. **Q0 input** - Real failure modes inform semantic design
3. **E11 validation** - B0 vs B1 comparison proves E11 works
4. **Scientific rigor** - Don't contaminate baseline with post-hoc fixes

**When to revisit?**
- After Q0 complete
- After E11 Design approved
- After E11 MVP implemented
- Then: re-run as B1, compare

---

## Next Steps

### 1. Q0 Investigation (ACTIVE)

**Use F&B B0 findings to answer:**
> "What minimal semantic + governance contract prevents ALL failure modes found in B0 while remaining generic?"

**Key inputs:**
- Semantic distinction requirement (5 stages)
- Authority model requirement
- Hallucination prevention (business + technical)
- Governance integration requirements

### 2. E11 Design (BLOCKED until Q0)

**Must incorporate F&B B0 lessons:**
- Clear status lifecycle enforcement
- Authority-based approval gates
- Technical conformance validation
- Factory integration (not bypass)

### 3. E11 MVP Implementation

**Build with F&B B0 failures in mind:**
- Prevent inference → truth shortcuts
- Block unauthorized business decisions
- Enforce governance gates
- Integrate with E10 Factory

### 4. F&B B1 Field Test

**Re-run:** "Create F&B OS using existing Bella system"

**Measure:**
- B0 vs B1 comparison (all dimensions)
- Empirical proof of E11 effectiveness

---

## Conclusion

**F&B B0 Status:** ❌ NOT VERIFIED

**F&B B0 Value:** ⭐⭐⭐⭐⭐ CRITICAL for E11 development

**Preservation:** MANDATORY (do not modify)

**This is not a failure to hide. This is empirical evidence to learn from.**

---

**The best experiments are the ones that produce clear, actionable evidence — even when the result is "NOT VERIFIED".**

---

**Baseline B0 established: 2026-09-04**


---

## B1 Test Protocol (Future)

**When E11 MVP complete, re-run with IDENTICAL prompt:**

```
Create an F&B OS using the existing Bella system.
```

**NO modifications to prompt allowed.**

**Reason:** Same input proves capability improvement, not task simplification.

### B0 vs B1 Comparison Metrics

**Research:**
- Sources consulted
- Evidence quality
- Critique depth

**Business Truth:**
- EVIDENCE vs INFERENCE distinction
- PROPOSAL vs CANONICAL status accuracy
- BUSINESS_DECISION vs AI_AUTONOMOUS classification
- Provenance completeness

**Technical:**
- Compilation success
- Test execution
- Bella pattern conformance
- Factory usage (E10 invocation)

**Governance:**
- G0.5 compliance
- Architecture Guard compliance
- Business Truth Gate passage
- Status lifecycle enforcement

**Overall:**
- Verification status (VERIFIED vs NOT_VERIFIED)
- Human decisions required
- Autonomous decisions accuracy
- Implementation correctness

**Success Criteria for B1:**
- All B0 failures resolved
- No new critical failures introduced
- Empirical proof of E11 effectiveness

---

**B0 Checkpoint: CLOSED**  
**Date:** 2026-09-04  
**Next:** Q0 Investigation (using B0 empirical evidence)
