# E6 ECONOMICS EXPERIMENT — DEFINITION & HYPOTHESES

**Document Type:** Experiment Definition  
**Status:** 🔒 DEFINITION PHASE  
**Date:** 2026-08-21  
**Vertical:** Warehouse Management  
**Experiment Series:** E6 (Second Vertical Validation)

---

## 🎯 RESEARCH QUESTION

### Primary Question

> **Does Bella AI Platform create repeatable cost leverage across different logistics verticals, independent of domain contract layer optimization?**

### Context

E3 (Freight Audit) demonstrated 78% cost reduction (C₂ = 6.05d vs C₁ = 27.5d), validating H1 hypothesis for a single vertical (n=1).

E6 tests whether this leverage pattern is:
- **Repeatable** across different verticals
- **Systematic** rather than vertical-specific
- **Attributable** to platform primitives alone (without Contract Layer)

### Strategic Importance

E6 is more strategically valuable than E3 because:
- n=1 → n=2 enables pattern validation
- Tests platform at realistic domain boundaries
- Isolates platform leverage from Contract Layer benefit
- Provides confidence for multi-vertical strategy investment

---

## 📊 EXPERIMENT DESIGN

### Vertical Selection: Warehouse Management

**Domain:** Logistics (same as Route Management E2 and Freight Audit E3)

**Rationale:**
- Same domain space but different domain contracts
- Tests platform leverage at different boundary conditions
- Realistic overlap scenario (not artificially distant)
- Challenges "easy reuse" assumptions

**Domain Contract Differences from E3:**

| Aspect | E3 (Freight Audit) | E6 (Warehouse) |
|--------|-------------------|----------------|
| Core Entity | Invoice, Shipment, Carrier | Inventory, Location, Movement |
| Primary Flow | Audit → Discrepancy → Resolution | Receive → Store → Pick → Ship |
| Rates/Pricing | Freight rates, accessorials | Storage costs, handling fees |
| Compliance | Carrier contract validation | Inventory accuracy, cycle count |

**Expected Overlap with Platform:**
- RLS tenant isolation (H1-H2)
- Workflow state machines (H4-H5)
- Audit trails (H8)
- Temporal data (H9)
- Math/aggregation (H6)

**Expected New Contracts:**
- Warehouse-specific entities (bin, zone, SKU)
- Movement tracking schemas
- Inventory valuation patterns

---

## 🔬 HYPOTHESES

### H1: Cost Leverage (Primary)

**Hypothesis:**
> Platform implementation cost C₆ will be less than 30% of equivalent baseline cost C₁

**Threshold:**
```
C₁ = baseline cost (to be established in E6_BASELINE.md)
Target: C₆ < 0.30 × C₁
```

**Measurement:**
```
C₆ = Implementation + Testing + Rework
```

**Success Criteria:**
- C₆ < threshold (validate H1)
- Compare to E3: Is C₆/C₁ ratio similar to C₂/C₁ (22%)?

**If H1 fails:** Platform leverage not repeatable, strategic reassessment required

---

### H2: Time-to-Market (Secondary)

**Hypothesis:**
> Calendar time-to-market T₆ will be less than 50% of baseline time T₁

**Threshold:**
```
T₁ = baseline calendar time (to be established)
Target: T₆ < 0.50 × T₁
```

**NEW in E6:** Calendar time measurement (was INCONCLUSIVE in E3)

**Measurement Protocol:**
```
T₁ = Baseline start date → 15/15 requirements complete
T₆ = E6 start date → 15/15 requirements verified

Exclude:
- Planning/definition time
- Blocked time (environment issues, dependencies)

Include:
- Implementation time
- Testing time
- Rework time
- Context switching overhead
```

**Success Criteria:**
- T₆ < 0.50 × T₁
- Establish T₂ retroactively from E3 logs for comparison

---

### H3: Architectural Leverage (Tertiary)

**Hypothesis:**
> Platform architectural leverage (reuse ratio) will exceed 70%

**Threshold:**
```
Reuse Ratio = (A + B + C) / (A + B + C + D) > 70%
```

**NEW in E6:** LOC classification (was INCONCLUSIVE in E3)

**LOC Classification:**

**Category A: Unchanged Platform Code**
- Existing platform files used without modification
- RLS policies, audit triggers, workflow state machines
- Example: `src/platform/core/audit.ts` (no changes)

**Category B: Configured Platform Code**
- Platform code with parameter/config changes only
- Schema templates, validation rules
- Example: RLS policy with new table name

**Category C: Extended Platform Code**
- New methods added to platform classes
- Subclasses of platform types
- Example: New contract method in `logistics.contract.ts`

**Category D: Net-New Vertical Code**
- Code written specifically for Warehouse vertical
- No platform inheritance or reuse
- Example: `warehouse-inventory-valuation.ts`

**Measurement Protocol:**
```
1. Tag each file/module as A, B, C, or D
2. Count lines of code (LOC) per category
3. Calculate: Reuse% = (A+B+C) / Total
4. Lock classification before implementation
```

**Success Criteria:**
- Reuse% > 70%
- Compare to E3 retroactive classification

---

## 📏 SCOPE & ACCEPTANCE CRITERIA

### Requirements Count: 15

**Match E3 structure for direct comparison:**

| Category | E3 (Freight Audit) | E6 (Warehouse) |
|----------|-------------------|----------------|
| CRUD | R1 (Create Invoice) | R1 (Receive Inventory) |
| Validation | R2-R5 | R2-R5 |
| Workflow | R6-R9 | R6-R9 |
| Query | R10-R11 | R10-R11 |
| Metrics | R12-R14 | R12-R14 |
| Constraints | R15 | R15 |

**Detailed requirements:** See `E6_REQUIREMENTS_INVENTORY.md`

### Acceptance Criteria

**E6 is considered successful if:**

1. ✅ All 15 requirements verified (15/15)
2. ✅ H1 validated: C₆ < 30% of C₁
3. ✅ H2 measured: T₆ data collected (pass/fail determined)
4. ✅ H3 measured: LOC classified (pass/fail determined)
5. ✅ Honest measurement: all bugs/rework counted
6. ✅ Protocol maintained: one-at-a-time verification
7. ✅ No retroactive optimization based on E3

**E6 provides valuable data regardless of H1/H2/H3 outcome.**

---

## 🔒 ANTI-OPTIMIZATION PROTOCOL

### Prohibited Actions

To maintain experimental integrity, the following are **STRICTLY PROHIBITED:**

❌ **Pre-Optimization Based on E3:**
- Modifying platform to fix R2/R3-style bugs before E6 starts
- Adding schema validation specifically to avoid E6 bugs
- Adjusting platform contracts based on E3 friction points

❌ **Selective Requirements:**
- Cherry-picking "easy" requirements to ensure H1 passes
- Avoiding complex requirements that failed in E3
- Adjusting requirement difficulty mid-experiment

❌ **Measurement Gaming:**
- Excluding rework from C₆ calculation
- Counting only "clean" implementation time
- Hiding bugs as "test infrastructure issues"
- Adjusting acceptance criteria after implementation starts

❌ **Retroactive Changes:**
- Modifying E6 definition after implementation starts
- Changing H1/H2/H3 thresholds mid-experiment
- Re-baselining C₁ to make C₆ look better

### Permitted Actions

✅ **Protocol Improvements:**
- Adding H2/H3 measurements that E3 lacked
- Using same 15-requirement structure for comparison
- Improving measurement precision based on E3 lessons

✅ **Learning (Not Optimization):**
- Understanding E3 findings to design better experiment
- Documenting expected friction points in advance
- Predicting where bugs may occur (but not pre-fixing)

### Key Principle

> **"If E6 discovers 2-3 schema contract bugs like E3, that's VALUABLE DATA—not a failure to be hidden."**

This validates E5's Contract Layer recommendation empirically.

---

## 🧪 EXPERIMENTAL CONTROL

### Contract Layer Treatment: Design B (Baseline → Delta)

**Phase 1: E6 Baseline (Current)**
- Implement Warehouse vertical using **existing platform only**
- No Contract Layer infrastructure
- Measure C₆, T₆, LOC, bugs, rework

**Phase 2: E6+CL (Future, Optional)**
- Add Contract Layer to E6 implementation
- Re-measure: C₆₊CL, bugs, rework
- Calculate delta: CL benefit = (C₆ - C₆₊CL)

**Rationale:**
- Isolates platform leverage from Contract Layer leverage
- Allows answering: "Is CL necessary or nice-to-have?"
- If E6 succeeds without CL → CL is optimization
- If E6 struggles without CL → CL is systematic need

**Alternative Designs (Rejected):**

❌ **Design A (CL + E6):** Cannot separate CL value from platform value  
❌ **Design C (Skip CL):** Misses opportunity to measure CL benefit

---

## 📐 MEASUREMENT PROTOCOL

### Cost Measurement (C₆)

**Components:**
```
C₆ = Implementation + Testing + Rework

Implementation = timestamp(first code) → timestamp(last requirement implemented)
Testing = sum(R1 testing + R2 testing + ... + R15 testing)
Rework = sum(bug fix time for all Bella bugs)
```

**Exclusions:**
- Planning/definition time (this document)
- Environment setup (database, keys)
- Blocked time (external dependencies)

**Recording:**
- Timestamp start/end of implementation
- Timestamp each requirement test execution
- Timestamp bug discovery → fix → retest for each bug

### Calendar Time Measurement (T₆)

**NEW Protocol for H2:**

```
T₁ = Baseline calendar days (from requirement lock → 15/15 complete)
T₆ = E6 calendar days (from requirement lock → 15/15 verified)

Measurement:
- Start: Date/time of E6_REQUIREMENTS_INVENTORY.md lock
- End: Date/time of R15 verification PASS
- Exclude: Multi-day gaps with zero work (weekends if not worked)
- Include: All working days including context switching
```

**Comparison:**
- Calculate T₂ retroactively from E3 logs
- Compare: T₆ vs T₂ (same vertical sample size)
- Target: T₆ < 50% of T₁

### LOC Classification (H3)

**NEW Protocol for H3:**

**Pre-Implementation:**
1. Define classification rules (above) and lock
2. Estimate expected A/B/C/D distribution (prediction, not target)
3. Commit to counting methodology

**Post-Implementation:**
1. Classify each file/module as A, B, C, or D
2. Use `cloc` or similar tool for LOC count
3. Calculate Reuse% = (A+B+C) / (A+B+C+D)
4. Document classification in `E6_LOC_CLASSIFICATION.md`

**Edge Cases:**
- Mixed file (A+D): Split by function or classify as C
- Tooling/test code: Count in D unless reused from platform
- Migration SQL: Count as B (configured platform pattern)

---

## 🎯 SUCCESS METRICS SUMMARY

| Hypothesis | Metric | Threshold | Measurement Method |
|------------|--------|-----------|-------------------|
| **H1** | C₆ / C₁ | < 30% | Timestamped implementation + testing + rework |
| **H2** | T₆ / T₁ | < 50% | Calendar days from requirement lock → verification |
| **H3** | (A+B+C) / Total | > 70% | LOC classification post-implementation |

**Additional Metrics:**
- Bug count and distribution (R1-R15)
- Rework effort per bug
- Clean pass rate (requirements with zero rework)
- Contract friction concentration (which R1-R15 had bugs)

---

## 🔗 COMPARISON TO E3

### Expected Comparisons (Post-E6)

**Cost Leverage:**
```
E3: C₂ / C₁ = 6.05d / 27.5d = 22.0%
E6: C₆ / C₁ = TBD / TBD = ?%

Question: Is C₆/C₁ within range of C₂/C₁?
Pattern validated if: 15% < C₆/C₁ < 35%
```

**Bug Pattern:**
```
E3: 2 bugs, both at domain contract boundary (R2, R3)
E6: ? bugs, distributed where?

Question: Does E6 show same contract friction pattern?
```

**Clean Pass Rate:**
```
E3: 13/15 clean (86.7%)
E6: ?/15 clean

Question: Is clean rate similar or better?
```

**Rework Concentration:**
```
E3: Front-loaded (R2-R3: 100%, R4-R15: 0%)
E6: ?

Question: Is friction concentrated at discovery phase?
```

---

## 🚧 RISKS & LIMITATIONS

### Known Limitations

**Sample Size:**
- E6 brings n=1 → n=2
- Still insufficient for statistical significance
- Requires E7+ for generalization

**Vertical Selection:**
- Same domain (logistics) limits breadth test
- Different domain (e.g., HR) may show different pattern
- E7 should test orthogonal vertical

**Architect Familiarity:**
- Same architect built E2, E3, E6
- Learning curve not measured
- Third-party developer experience needed (E8)

### Threats to Validity

**Internal Validity:**
- E3 learnings may unconsciously influence E6 implementation
- Mitigation: Anti-optimization protocol + documentation

**External Validity:**
- Results may not generalize beyond logistics domain
- Mitigation: E7 in different domain

**Construct Validity:**
- LOC classification has subjective edge cases
- Mitigation: Pre-define rules and lock before implementation

---

## 📅 TIMELINE ESTIMATE

**Not a target—just planning guidance:**

| Phase | Estimated Duration | Notes |
|-------|-------------------|-------|
| Definition (E6_DEFINITION.md) | 1 day | Current |
| Requirements (E6_REQUIREMENTS_INVENTORY.md) | 1-2 days | Design 15 requirements |
| Baseline (E6_BASELINE.md) | 0.5 days | Research/estimate C₁, T₁ |
| Protocol (E6_PROTOCOL.md) | 0.5 days | Lock measurement rules |
| **Lock E6 Definition** | — | Commit to repository |
| Implementation | 4-8 days | Measured as C₆ |
| Verification | 0.5-1 day | R1-R15 one-at-a-time |
| Rework | TBD | Bug-dependent |
| Analysis (E6_ANALYSIS.md) | 1 day | H1/H2/H3 assessment |
| Assessment (E6_ASSESSMENT.md) | 1 day | Strategic conclusions |

**Total E6 experiment: 4-6 weeks** (including planning)

---

## ✅ NEXT STEPS

1. ✅ E6_DEFINITION.md (this document)
2. ⏳ E6_REQUIREMENTS_INVENTORY.md (15 requirements for Warehouse)
3. ⏳ E6_BASELINE.md (establish C₁, T₁)
4. ⏳ E6_PROTOCOL.md (lock measurement protocol, LOC rules, calendar time tracking)
5. ⏳ LOCK E6 Definition (commit to repository)
6. ⏳ Implementation (measure C₆, T₆, LOC)
7. ⏳ Verification (R1-R15)
8. ⏳ Analysis (E6_ANALYSIS.md)
9. ⏳ Assessment (E6_ASSESSMENT.md)
10. ⏳ Compare E3 ↔ E6 for pattern validation

---

**Document Owner:** Kiro AI  
**Status:** 🔒 DEFINITION PHASE  
**Lock Date:** TBD (after requirements + baseline + protocol)

---

**END OF E6 DEFINITION**
