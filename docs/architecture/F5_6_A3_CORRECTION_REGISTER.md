# F5.6 A.3 Correction Register

> **Document Type:** Controlled Correction Registry  
> **Date:** 2026-08-16  
> **Status:** Active  
> **Purpose:** Record all semantic corrections discovered during A.3 research phase

---

## Purpose

**This register records semantic corrections BEFORE they become production architecture.**

**Critical Principle:**
> "Research may infer. Architecture may provisionalize. Production may only rely on verified semantics."

**Why This Matters:**
- Corrections caught in research = **ZERO production impact**
- Corrections caught in schema = migration required
- Corrections caught in production = data integrity risk

**Audit Trail:**
> "Nó vừa chứng minh A.3 đang làm đúng vai trò của nó: bắt một assumption sai trước khi assumption đó trở thành database architecture."

---

## Correction A3-COR-001: TK 142/244 Invalid Merge

**Correction ID:** A3-COR-001  
**Date Discovered:** 2026-08-16  
**Discovered By:** A.3 Semantic Research (primary source verification attempt)  
**Severity:** HIGH  
**Status:** CORRECTIVE ACTION IN PROGRESS

---

### Original Assertion (v0.1)

**Claim:**
```
TT133/2016:
- TK 142 = Chi phí trả trước ngắn hạn (short-term prepaid expenses)
- TK 244 = Chi phí trả trước dài hạn (long-term prepaid expenses)

TT99/2025:
- TK 242 = Chi phí trả trước (prepaid expenses)

Classification: MERGED
```

**Source:** Crowe Vietnam 2016 secondary interpretation

**Used In:**
- F5_6_A3_SEMANTIC_MATRIX.csv (v0.1, row 8-10)
- F5_6_A3_SEMANTIC_ANALYSIS.md (Section 2.3)
- F5_6_A3_UNRESOLVED_QUESTIONS.md (Questions 9-10)

---

### Evidence of Error

**Source A: Crowe Vietnam 2016** (SECONDARY)
- Claim: "Merge short-term and long-term prepaid expenses into account 242"
- Authority: Big4 interpretation
- Date: August 2016

**Source B: Thư Viện Pháp Luật — TT133/2016 Điều 38** (PRIMARY)
- TK 142 = Chi phí trả trước (Prepaid expenses)
- TK 244 = Ký quỹ, ký cược dài hạn (Long-term deposits/pledges/collateral)
- Authority: Primary legal source

**Conflict:**
- Crowe interpretation: TK 244 = long-term prepaid expenses
- TT133 Điều 38: TK 244 = deposits/pledges (NOT prepaid expenses)

**Conclusion:** **CONFLICTING EVIDENCE DETECTED**

---

### Classification

**Original:** MERGED  
**Revised:** **INVALID MERGE** (pending primary source verification)

**Reason:**
- TK 244 ≠ prepaid expenses (per TT133 Điều 38)
- TK 244 = deposits/pledges (different semantic)
- Cannot classify as MERGED if semantic is different

---

### Root Cause Analysis

**Why Error Occurred:**
1. **Secondary source accepted without primary verification**
   - Crowe 2016 interpretation treated as fact
   - TT133/2016 Điều 38 not verified at v0.1
   
2. **Account code similarity assumed semantic similarity**
   - TK 142, TK 244 both "prepaid" category assumed
   - Primary source shows TK 244 = deposits (different category)

3. **Big4 interpretation reliability assumed 100%**
   - Big4 typically accurate, but not infallible
   - Legal definitions must come from primary sources

**Lesson:**
> "Secondary-source interpretation was accepted before primary semantic verification."

---

### Architectural Consequence

**Discovery Impact:**

**CRITICAL FINDING:**
> **Account code mapping cannot be treated as semantic equivalence.**

**Why This Matters:**
- If TK 244 ≠ prepaid expenses
- Then account-code-based registry is insufficient
- Semantic identity must exist independently of account code

**Abstraction Implication:**
```
WRONG MODEL:
regime × account_code × business_event → semantic

RIGHT MODEL:
Regulatory Regime
    ↓
Canonical Accounting Semantic (independent of account code)
    ↓
Enterprise Accounting Policy
    ↓
Tenant Chart of Accounts (customizable within legal bounds)
    ↓
Posting Rules
    ↓
Account Realization
```

**AR-011 Candidate:**
> "Account Code Is Not Semantic Identity. Semantic identity must exist independently of regulatory regime, tenant, tenant COA, account number, and account name."

---

### Impact Analysis

**Business Events Affected:**
- Long-term prepaid expense recording
- Deposit/pledge recording
- Collateral accounting
- Financial statement presentation (current vs non-current classification)

**Classifications Affected:**
- TK 142 → TK 242: May still be valid (1-to-1 or account realization change)
- TK 244 → TK 242: **INVALID** (different semantics)
- TK 244 → ???: Requires research (deposits/pledges in TT99)

**Semantic Matrix Rows Affected:**
- Row 8: TK 142 short-term prepaid (needs verification)
- Row 9: TK 244 long-term prepaid (**INCORRECT SEMANTIC**)
- Row 10: TK 242 prepaid expenses (needs verification)

**Unresolved Questions Affected:**
- A-009: Short-term prepaid expense recognition timing
- A-010: Long-term prepaid expense recognition timing (semantic may be wrong)
- U-XXX: New question needed for deposits/pledges

---

### Production Impact

**Status:** ✅ **ZERO PRODUCTION IMPACT**

**Why:**
- No production schemas created
- No posting rules implemented
- No Finance Kernel modifications
- No C.2-C.6 code written

**Reason:**
> "Detection occurred during research phase, before architecture commitment."

**If Error Reached Production:**
- ❌ Incorrect account mapping in schema
- ❌ Wrong posting rules for deposits/pledges
- ❌ Financial statement misclassification
- ❌ Data migration required to correct
- ❌ Historical transactions potentially affected

**Protection Mechanism:**
- Gate 1: PASSED (blocked premature implementation)
- A.3: Semantic research BEFORE schema design
- Primary verification: Caught conflicting evidence
- C.2-C.6: BLOCKED (correctly)

---

### Corrective Action Plan

**Immediate Actions:**

1. **Document Conflict** (Task #2)
   - Create F5_6_A3_CONFLICT_REGISTER.md
   - Log C-004: Crowe vs Thư Viện Pháp Luật conflict
   - Mark as HIGH priority for resolution

2. **Create Architecture Finding** (Task #3)
   - Create F5_6_A3_FINDING_A3-001_TK142_244.md
   - Document architectural implication
   - Propose AR-011: Account Code ≠ Semantic Identity

3. **Establish Evidence Taxonomy** (Task #4)
   - 2-axis model: Authority Level + Evidence Grade
   - Lock invariant: INFERRED/AMBIGUOUS → cannot become production
   - Apply to all 24 verification questions

4. **Build Canonical Semantic Model** (Task #5)
   - 5-layer abstraction
   - Semantic independent of account code
   - Support tenant COA customization

5. **Update Verification Register** (Task #6)
   - Apply evidence taxonomy
   - Mark C-004 as CONFLICTING
   - Re-assess all MERGED classifications

6. **Revise Semantic Matrix** (controlled, not bulk regeneration)
   - Correct TK 244 semantic definition
   - Re-evaluate MERGED classifications
   - Add evidence grade to each assertion

7. **Primary Source Procurement** (parallel track)
   - Obtain TT133/2016 Phụ lục 1 full text
   - Obtain TT99/2025 Phụ lục II full text
   - Verify all CRITICAL questions from primary sources

---

### Verification Status

**Before Correction:**
- C-004: TK 142/244 → 242 = MERGED (ASSUMED)
- Evidence: SECONDARY (Crowe 2016)
- Confidence: 75%

**After Correction:**
- C-004: TK 142/244 → 242 = **CONFLICTING**
- Evidence: SECONDARY (Crowe) vs PRIMARY (Thư Viện TT133 Điều 38)
- Confidence: 0% (requires resolution)

**Resolution Path:**
1. Access TT133/2016 Điều 38 full text (PRIMARY)
2. Verify TK 244 definition
3. Research TK 244 fate in TT99/2025
4. Determine correct classification:
   - If TK 244 = deposits → Find TT99 equivalent (not TK 242)
   - If TK 244 = prepaid → Validate Crowe interpretation
5. Update semantic matrix
6. Update affected business events
7. Mark C-004 as VERIFIED_PRIMARY

---

### Timeline

**Discovery:** 2026-08-16 (A.3 primary source verification attempt)  
**Documentation:** 2026-08-16 (this register)  
**Expected Resolution:** 2026-08-18 to 2026-08-23 (5-7 days, parallel to A.4)  
**Blocking:** Does NOT block A.4 framework research (semantic abstraction independent)  
**Blocks:** Production schema design, C.2 implementation (correctly)

---

### Lessons Learned

**What Worked:**
1. ✅ **Gate 1 discipline** — Blocked premature implementation
2. ✅ **A.3 methodology** — Semantic research before schema
3. ✅ **Primary verification process** — Caught conflicting evidence
4. ✅ **Evidence grading** — Identified SECONDARY source limitation
5. ✅ **C.2-C.6 blocking** — No production code written

**What Could Improve:**
1. ⚠️ **Earlier primary source access** — Reduce reliance on secondary interpretations
2. ⚠️ **Authority hierarchy enforcement** — Big4 = discovery, not verification
3. ⚠️ **Conflict detection tooling** — Flag when sources disagree

**Architectural Principle Validated:**
> "Research must be allowed to fail before architecture is allowed to commit."

**Vietnamese:**
> "Nghiên cứu phải được phép thất bại trước khi kiến trúc được phép cam kết."

**Why Critical:**
- Research failure in A.3 = documentation update (low cost)
- Architecture failure in C.2 = code refactor (medium cost)
- Production failure = data migration + audit risk (high cost)

---

### Related Documents

**Created/Updated:**
- F5_6_A3_CONFLICT_REGISTER.md (Task #2)
- F5_6_A3_FINDING_A3-001_TK142_244.md (Task #3)
- F5_6_A3_EVIDENCE_TAXONOMY.md (Task #4)
- F5_6_A3_CANONICAL_SEMANTIC_MODEL.md (Task #5)
- F5_6_A3_VERIFICATION_REGISTER.md (Task #6, updated)
- F5_6_A3_SEMANTIC_MATRIX_V03.csv (corrected, controlled changes only)

**Constitutional Impact:**
- AR-011 Candidate: Account Code Is Not Semantic Identity
- AR-012 Candidate: Tenant COA Customization Boundary
- F5-S0 Amendment Candidate: Evidence taxonomy invariant

---

## Correction Summary

| Correction ID | Assertion | Status | Impact | Production Impact | Resolution |
|---------------|-----------|--------|--------|-------------------|------------|
| **A3-COR-001** | TK 142/244 → 242 MERGED | INVALID | HIGH | ZERO | PRIMARY verification required |

**Total Corrections:** 1  
**Production Impact:** ZERO  
**Architectural Value:** HIGH (discovered Account Code ≠ Semantic Identity principle)

---

## Approval

**Correction Registered By:** A.3 Semantic Research Process  
**Date:** 2026-08-16  
**Status:** ✅ DOCUMENTED, CORRECTIVE ACTION IN PROGRESS  
**Gate 2 Status:** 🔴 BLOCKED (pending C-004 resolution)  
**C.2 Status:** 🔴 BLOCKED (correctly)

---

**Document Status:** Correction A3-COR-001 Registered  
**Next:** Document conflict (Task #2), create architecture finding (Task #3)  
**Architectural Impact:** Discovered AR-011 candidate principle ✅
