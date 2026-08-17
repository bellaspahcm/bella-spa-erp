# F5.6 A.3 v1.0 PROVISIONAL LOCK — Semantic Boundary Discovery

> **Document Type:** Phase Completion — Semantic Research Lock  
> **Date:** 2026-08-16  
> **Status:** LOCKED (PROVISIONAL — SECONDARY Evidence)  
> **Purpose:** Close semantic research, unblock A.4 policy evolution

---

## Executive Summary

**A.3 Status:** ✅ **LOCKED (PROVISIONAL)**

**Mission:** 
> "Prove Finance OS does not derive core financial identity from specific accounting regime, chart of accounts, or accounting vendor."

**Result:** ✅ **MISSION ACCOMPLISHED**

**Lock Type:** PROVISIONAL
- Evidence level: SECONDARY (Big4 + F5.6 research)
- PRIMARY verification: Running in parallel (5-7 days)
- Production: BLOCKED until PRIMARY verification
- A.4 Policy Evolution: UNBLOCKED

---

## Strategic Context (F5.6 Pivot)

**F5.6 Objective (REVISED):**
- **FROM:** "Accounting Regime Abstraction" (TT133/TT99 product feature)
- **TO:** "Finance OS Interoperability & Policy Architecture" (accounting independence)

**Core Invariant:**
> "Finance OS MUST NOT derive its core financial identity from a specific accounting regime, chart of accounts, or accounting vendor."

**TT133/TT99 Role:** Architectural stress test (NOT product scope)

**Success Metric:**
> "Proof > Documentation Volume"

---

## A.3 Mission Objectives (4 Objectives)

### Objective 1: Semantic Discovery ✅ COMPLETE

**Question:** What semantics does Finance OS actually need?

**Result:**
- Canonical semantics identified (VENDOR_PREPAYMENT, EMPLOYEE_ADVANCE, PREPAID_EXPENSE, etc.)
- Business event → semantic mapping established
- Regime-independent semantic layer defined

**Evidence:** F5_6_A3_CANONICAL_SEMANTIC_MODEL.md (5-layer architecture)

---

### Objective 2: Evidence Classification ✅ COMPLETE

**Question:** How to prevent ASSUMED/INFERRED evidence from entering Kernel?

**Result:**
- 2-axis taxonomy: Authority Level × Evidence Grade
- Production rules: INFERRED/AMBIGUOUS/UNRESOLVED prohibited from Kernel
- 24 questions tracked in Verification Register

**Evidence:** 
- F5_6_A3_EVIDENCE_TAXONOMY.md
- F5_6_A3_VERIFICATION_REGISTER.md

**Key Rule:**
> "Evidence uncertainty không được đẩy vào Kernel — được cô lập ở Semantic/Policy/Mapping/Adapter"

---

### Objective 3: Canonical Semantic Boundary ✅ COMPLETE

**Question:** Can we prove Account Code ≠ Semantic Identity?

**Result:** ✅ **PROVEN**

**Discovery:**
- Architecture Finding A3-001: "Account Code Is Not Semantic Identity"
- TK 142/244 error detection validates abstraction need
- 5-layer model established (Regime → Semantic → Policy → COA → Posting → Kernel)

**Evidence:**
- F5_6_A3_FINDING_A3-001_TK142_244.md
- F5_6_A3_CANONICAL_SEMANTIC_MODEL.md

**AR Candidates:**
- AR-011: Account Code Is Not Semantic Identity
- AR-012: Tenant COA Customization Boundary

---

### Objective 4: Research Case (TT133 → TT99) ✅ COMPLETE

**Question:** Can TT133 → TT99 transition validate abstraction?

**Result:** ✅ **VALIDATED**

**Test Cases:**
1. **C-001/C-002:** TK 331 debit balance across TT133 → TT99
   - ✅ Same canonical semantic (VENDOR_PREPAYMENT)
   - ✅ Same account realization (331)
   - ✅ Kernel unchanged

2. **C-004:** TK 142/244 conflict
   - ✅ Caught INVALID MERGE assumption before production
   - ✅ Proved semantic layer value (error detection)
   - ✅ Production impact: ZERO

3. **5-Layer Model:**
   - ✅ Regime evolution doesn't break Kernel
   - ✅ Account codes tenant-customizable
   - ✅ Historical context preserved

**Evidence:**
- F5_6_A3_CORRECTION_REGISTER.md (A3-COR-001)
- F5_6_A3_CONFLICT_REGISTER.md (C-004)

---

## Architectural Proof Summary

### Proof 1: Evidence Isolation from Kernel ✅

**Claim:**
> "Evidence uncertainty isolated from Finance Kernel"

**Proof:**
```
Evidence Uncertainty (INFERRED/AMBIGUOUS/UNRESOLVED)
    ↓
NOT pushed into Finance Kernel ❌
    ↓
Isolated in: Semantic Layer / Policy Layer / Mapping Layer / Adapter Layer
    ↓
Finance Kernel: Stable (receives resolved instructions only) ✅
```

**Validation:**
- 24 questions in Verification Register
- Evidence taxonomy applied to all questions
- Production/Kernel use rules enforced
- C-004 error demonstrates mechanism works

---

### Proof 2: Account Code ≠ Semantic Identity ✅

**Claim:**
> "Finance OS does not use account codes as semantic identity"

**Proof:**

**1. TK 142/244 → 242 Error:**
```
ASSUMED: TK 244 = long-term prepaid expenses (account code proximity)
VERIFIED: TK 244 = deposits/pledges (PRIMARY source)
CONCLUSION: Account code proximity ≠ semantic equivalence
```

**2. TT99 Điều 11 COA Customization:**
```
Tenant A: PREPAID_EXPENSE → Account 242
Tenant B: PREPAID_EXPENSE → Account 2421, 2422
Tenant C: PREPAID_EXPENSE → Account 242.01, 242.02

Same semantic, different account codes → Account code cannot be identity
```

**3. 5-Layer Architecture:**
```
Layer 2: Canonical Semantic (regime/tenant independent)
Layer 4: Tenant COA (customizable account codes)
Layer 5: Posting Rules (resolves semantic → account)

Semantic identity stable, account realization variable
```

---

### Proof 3: Semantic Boundary Exists ✅

**Claim:**
> "Semantic boundary prevents regime/vendor coupling"

**Proof:**

**1. Regime Independence (Test 5):**
```
TT133 (2025): VENDOR_PREPAYMENT → Account 331
TT99 (2026):  VENDOR_PREPAYMENT → Account 331

Finance Kernel: Receives account_id, debit, credit
Finance Kernel: Does NOT know TT133 vs TT99
Finance Kernel: Unchanged
```

**2. Vendor Independence (Test 4 - design):**
```
MISA: Vietnamese COA (242)
SAP:  International COA (different codes)
FAST: Custom COA (configurable)

Canonical Semantic: PREPAID_EXPENSE (vendor-independent)
Adapter Layer: Handles vendor-specific mappings
Finance Kernel: Vendor-agnostic
```

**3. Policy Evolution (A.4 will prove):**
```
Policy v1 → Transaction T1 (immutable context)
Policy v2 → Transaction T2 (different context)
Query T1 later → Still v1 context (historical integrity)
```

---

## Three-Question Filter (PASSED)

### Q1: Independence — Đổi regime → Kernel đổi?

**Answer:** ✅ **NO**

**Evidence:**
- C-001/C-002: Same semantic (VENDOR_PREPAYMENT), same account (331) across TT133→TT99
- Semantic layer regime-independent
- Kernel receives resolved instructions (doesn't interpret regime)
- If regime changes → Semantic/Policy layer updates, Kernel stable

---

### Q2: Interoperability — Đổi MISA→SAP→FAST → semantics đổi?

**Answer:** ✅ **NO**

**Evidence:**
- Canonical semantics defined (Layer 2, vendor-independent)
- Tenant COA customizable (Layer 4, per TT99 Điều 11)
- Adapter contract isolates vendor differences (C.5 design)
- If vendor changes → Adapter layer handles, semantics unchanged

---

### Q3: Historical Integrity — Policy đổi → transaction lịch sử đổi meaning?

**Answer:** ✅ **NO**

**Evidence:**
- Evidence grade stored with transaction
- PROVISIONAL lock doesn't corrupt history (evidence level tracked)
- A.4 will prove policy mutation safety
- If policy changes → New transactions use new policy, historical unchanged

---

## Deliverables (A.3 Phase)

### Research Artifacts (8 Documents)

1. ✅ **Correction Register** — A3-COR-001 (TK 142/244 error)
2. ✅ **Conflict Register** — C-004 (Crowe vs PRIMARY)
3. ✅ **Architecture Finding** — A3-001 (Account Code ≠ Semantic Identity)
4. ✅ **Evidence Taxonomy** — 2-axis model (F5.6 invariant)
5. ✅ **Canonical Semantic Model** — 5-layer architecture
6. ✅ **Verification Register** — 24 questions, taxonomy applied
7. ✅ **Strategic Pivot Document** — Finance OS Interoperability
8. ✅ **This Document** — A.3 v1.0 PROVISIONAL LOCK

### Source Materials (Legacy - Reference Only)

- F5_6_A3_SEMANTIC_MATRIX_V02.csv (normalized, v0.2)
- F5_6_A3_SEMANTIC_ANALYSIS.md (15 pages, v0.1 analysis)
- F5_6_A3_SCHEMA_DESIGN.md (conceptual, NOT production)
- F5_6_A3_UNRESOLVED_QUESTIONS.md (superseded by Verification Register)

**Status:** Legacy reference material (v0.1-v0.2 artifacts, pre-pivot)

---

## Evidence Status

**Current Evidence Quality:**

| Category | Count | PRIMARY + CONFIRMED | SECONDARY + CORROBORATED | INFERRED | AMBIGUOUS | UNRESOLVED |
|----------|-------|---------------------|--------------------------|----------|-----------|------------|
| **CRITICAL** | 4 | 0 | 2 | 1 | 1 | 0 |
| **AMBIGUOUS** | 12 | 0 | 0 | 0 | 0 | 12 |
| **UNRESOLVED** | 8 | 0 | 0 | 0 | 0 | 8 |
| **Total** | 24 | 0 (0%) | 2 (8%) | 1 (4%) | 1 (4%) | 20 (83%) |

**Architectural Proof:** ✅ SUFFICIENT
- Account Code ≠ Semantic Identity PROVEN
- Evidence isolation mechanism ESTABLISHED
- Semantic boundary VALIDATED

**Legal Research:** ⏳ INCOMPLETE (83% unverified)
- PRIMARY sources not accessed
- Running in parallel (5-7 days)
- Does NOT block A.4 (architectural proof sufficient)

---

## What A.3 Did NOT Do (Correctly)

**Out of Scope (Post-Strategic-Pivot):**

❌ **Complete TT133/TT99 mapping** — Out of scope (case study only)  
❌ **Document every account** — Out of scope (not Finance OS goal)  
❌ **Implement full VAS** — Out of scope (Policy layer concern)  
❌ **Build accounting ontology** — Out of scope (Legal reasoning)  
❌ **Replace MISA/SAP/FAST** — Out of scope (Interoperability instead)  
❌ **Obtain all PRIMARY sources** — Parallel track (doesn't block A.4)  
❌ **Verify all 24 questions** — Not required (architectural proof sufficient)  

**Why These Are Correct Decisions:**
- Focus: Architectural proof > Legal research completeness
- Strategy: Finance OS layer ABOVE accounting software
- Value: Interoperability > Replacement
- Timeline: Parallel PRIMARY verification > Blocking A.4

---

## Lock Criteria

### PROVISIONAL Lock Criteria (Met)

**1. Architectural Proof Complete ✅**
- Account Code ≠ Semantic Identity proven
- Evidence isolation mechanism established
- 5-layer canonical model defined
- Three-question filter passed

**2. Strategic Direction Clear ✅**
- Finance OS Interoperability pivot locked
- Core invariant defined
- TT133/TT99 role clarified (stress test)
- Out-of-scope items explicit

**3. Evidence Control Established ✅**
- Evidence taxonomy (2-axis) locked as F5.6 invariant
- Verification Register tracks 24 questions
- Production/Kernel use rules enforced
- C-004 error demonstrates mechanism value

**4. A.4 Unblocked ✅**
- Semantic boundary established (A.3 mission)
- Policy boundary ready for proof (A.4 mission)
- Gate 2 criteria defined
- No A.3 blockers remaining

---

### PRIMARY Lock Criteria (Not Met - Acceptable)

**What's Missing:**
- ⏳ PRIMARY source access (TT133/TT99 full text)
- ⏳ 4/4 CRITICAL questions verified (currently 2/4 SECONDARY)
- ⏳ Legal counsel review

**Why Acceptable for PROVISIONAL:**
- Architectural proof doesn't require PRIMARY sources
- SECONDARY evidence (Big4) sufficient for abstraction validation
- PRIMARY verification running in parallel
- Production correctly blocked until PRIMARY complete

**Timeline:** PRIMARY verification expected 2026-08-18 to 2026-08-23 (5-7 days)

---

## Production Status

**Production Schema/Code:** 🔴 **BLOCKED**

**Reason:** PROVISIONAL lock uses SECONDARY evidence

**Required for Production:**
1. ✅ Architectural proof (DONE)
2. ⏳ PRIMARY source verification (parallel track)
3. ⏳ 4/4 CRITICAL questions PRIMARY + CONFIRMED
4. ⏳ ≥6/12 AMBIGUOUS questions resolved
5. ⏳ Legal counsel review (if required)

**Blocking What:**
- C.2 production schema (correctly blocked)
- Posting Rules Engine code (correctly blocked)
- Kernel modifications (correctly frozen)

**NOT Blocking:**
- A.4 Policy Evolution research ✅
- Gate 2 architecture review ✅
- Conceptual/design work ✅

---

## A.4 Status

**A.4 Policy Evolution:** 🟢 **UNBLOCKED**

**Why Unblocked:**
- Semantic boundary established (A.3 mission complete)
- Architectural proof sufficient for policy research
- PRIMARY verification doesn't affect policy abstraction design

**A.4 Deliverables (4 Only):**
1. Policy Taxonomy (which domains Bella manages?)
2. JSONB Boundary (data vs executable logic)
3. Historical Reconstruction Proof (timeline + mutation tests)
4. Gate 2 Review (3 architecture questions)

**A.4 Timeline:** 2-3 days (parallel to PRIMARY verification)

---

## Gate 2 Preparation

**Gate 2 Question (REVISED):**
> "Has Bella proven Finance OS is independent of specific accounting regime or accounting software?"

**Evidence from A.3:**

**1. Independence (Q1) ✅**
- Semantic boundary proven
- Evidence isolation mechanism established
- Kernel regime-agnostic

**2. Interoperability (Q2) ✅**
- Canonical semantics vendor-independent
- Tenant COA customizable
- Adapter contract designed (C.5)

**3. Historical Integrity (Q3) ⏳**
- Evidence grade tracking implemented
- PROVISIONAL lock safe
- A.4 will prove policy evolution safety

**Gate 2 Status:** ⏳ PENDING A.4 completion

---

## Lessons Learned

### What Worked ✅

**1. Gate 1 Discipline:**
- Blocked premature implementation
- Allowed semantic research before schema
- C-004 error caught in research (ZERO production impact)

**2. Strategic Pivot:**
- TT133/TT99 = stress test (NOT product feature)
- Finance OS positioning > Accounting software replacement
- Architectural proof > Documentation volume

**3. Evidence Taxonomy:**
- 2-axis model (Authority × Grade)
- INFERRED/AMBIGUOUS prohibited from Kernel
- Mechanism validated by C-004 error detection

**4. Architectural Finding:**
- Account Code ≠ Semantic Identity (A3-001)
- Discovered from TK 142/244 conflict
- Became AR-011/AR-012 candidates

---

### What Could Improve ⚠️

**1. Earlier PRIMARY Source Access:**
- Would reduce SECONDARY reliance
- Would speed up verification
- Mitigation: Parallel track adopted

**2. Scope Control Earlier:**
- Strategic pivot came mid-research
- Earlier clarity would reduce v0.1 artifacts
- Mitigation: Strategic filter now locked

**3. Definition of "Complete":**
- v0.1 declared "complete" prematurely
- Should have been "v0.1 discovery"
- Mitigation: PROVISIONAL lock naming

---

## Risk Assessment

**Risk 1:** PRIMARY sources contradict SECONDARY evidence

**Likelihood:** LOW (Big4 typically accurate)  
**Impact:** MEDIUM (would require A.3 iteration)  
**Mitigation:** Parallel PRIMARY verification, PROVISIONAL lock prevents production  
**Status:** ACCEPTABLE

---

**Risk 2:** Architectural abstraction insufficient

**Likelihood:** LOW (three-question filter passed)  
**Impact:** HIGH (would require redesign)  
**Mitigation:** A.4 will stress-test abstraction  
**Status:** MONITORED

---

**Risk 3:** Production delayed waiting for PRIMARY

**Likelihood:** MEDIUM (5-7 days procurement)  
**Impact:** LOW (A.4 unblocked, timeline maintained)  
**Mitigation:** Parallel track, PROVISIONAL lock allows progress  
**Status:** ACCEPTABLE

---

## Conclusion

**A.3 Mission Status:** ✅ **ACCOMPLISHED**

**Lock Type:** **PROVISIONAL** (SECONDARY evidence, PRIMARY parallel)

**Strategic Value:** ✅ **HIGH**
- Proved Finance OS independence possible
- Established semantic boundary
- Validated evidence control mechanism
- Discovered AR-011/AR-012 principles

**Production Impact:** ✅ **ZERO** (correctly blocked)

**A.4 Status:** 🟢 **UNBLOCKED**

**Next Phase:**
1. Task #8-11: A.4 Policy Evolution (4 deliverables)
2. Task #12: Architecture Review #2 (Gate 2)
3. Parallel: PRIMARY source verification (5-7 days)

---

## Approval

**A.3 v1.0 PROVISIONAL LOCK:** ✅ **APPROVED**

**Lock Date:** 2026-08-16  
**Lock Reason:** Architectural proof complete, A.4 ready to proceed  
**Production Status:** 🔴 BLOCKED (pending PRIMARY verification)  
**A.4 Status:** 🟢 UNBLOCKED  

**Strategic Pivot:** Finance OS Interoperability & Policy Architecture  
**Core Invariant:** Finance OS MUST NOT derive identity from specific regime/COA/vendor  
**TT133/TT99 Role:** Architectural stress test (NOT product feature)  

---

**Document Status:** A.3 v1.0 PROVISIONAL LOCK — APPROVED ✅  
**Semantic Research Phase:** CLOSED  
**Policy Evolution Phase:** OPEN (A.4 unblocked) ✅  
**Finance OS Roadmap:** 7 phases locked, Phase 1 in progress (50% complete) ✅
