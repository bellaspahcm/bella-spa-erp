# F5.6 A.3 Conflict Register

> **Document Type:** Evidence Conflict Registry  
> **Date:** 2026-08-16  
> **Status:** Active  
> **Purpose:** Track and resolve conflicting evidence during semantic verification

---

## Purpose

**This register tracks evidence conflicts that require resolution before production.**

**Conflict = Different sources provide incompatible interpretations of the same semantic.**

**Critical Rule:**
> "CONFLICTING evidence MUST NOT become production rule until resolved."

**Resolution Paths:**
1. Obtain PRIMARY source to settle dispute
2. Determine which source is authoritative
3. Document resolution rationale
4. Update semantic matrix with verified interpretation

---

## Conflict Priority Matrix

| Priority | Criteria | Timeline | Blocks |
|----------|----------|----------|--------|
| **CRITICAL** | Affects posting rules, financial statement classification | Immediate | Gate 2, Production |
| **HIGH** | Affects account mapping, presentation | 3-5 days | Production schema |
| **MEDIUM** | Affects documentation, edge cases | 7-10 days | Implementation details |
| **LOW** | Affects terminology only | As available | None |

---

## Active Conflicts

### C-004: TK 142/244 → TK 242 Semantic Conflict

**Conflict ID:** C-004  
**Priority:** 🔴 **CRITICAL**  
**Date Identified:** 2026-08-16  
**Status:** 🔴 **UNRESOLVED**  
**Blocks:** Production schema, posting rules, C.2-C.6 implementation

---

#### Assertion Under Dispute

**Claim:**
> TT133/2016 accounts TK 142 (short-term prepaid expenses) and TK 244 (long-term prepaid expenses) were merged into TT99/2025 account TK 242 (prepaid expenses).

**Classification:** MERGED

**Business Events Affected:**
- Prepaid expense recording
- Long-term prepaid amortization
- Deposit/pledge recording (if TK 244 ≠ prepaid)

---

#### Source A: Crowe Vietnam 2016 (SECONDARY)

**Authority Level:** SECONDARY (Big4 interpretation)  
**Publication Date:** August 2016  
**Source Type:** Professional accounting guidance

**Interpretation:**
```
TT133/2016:
- TK 142 = Short-term prepaid expenses
- TK 244 = Long-term prepaid expenses

TT99/2025:
- TK 242 = Prepaid expenses (merged from 142 + 244)
```

**Quote (paraphrased from research):**
> "Merge short-term and long-term prepaid expenses into account 242"

**Confidence:** HIGH (Big4 typically reliable)

**Supporting Evidence:**
- Crowe is established Big4 firm in Vietnam
- Published shortly after TT133/2016 effective date
- Matches pattern: TT133 split short/long term, TT99 simplified

**Weaknesses:**
- No direct TT133/2016 Phụ lục citation
- No TT99/2025 Phụ lục citation
- Interpretation, not primary legal text

---

#### Source B: Thư Viện Pháp Luật — TT133/2016 Điều 38 (PRIMARY)

**Authority Level:** PRIMARY (Legal database citing official circular)  
**Source Type:** Legal reference database  
**Document:** TT133/2016 Điều 38

**Interpretation:**
```
TT133/2016:
- TK 142 = Chi phí trả trước (Prepaid expenses)
- TK 244 = Ký quỹ, ký cược dài hạn (Long-term deposits, pledges, collateral)
```

**Key Finding:**
> TK 244 ≠ "Long-term prepaid expenses"  
> TK 244 = "Deposits and pledges"

**Confidence:** VERY HIGH (Primary legal source)

**Supporting Evidence:**
- Thư Viện Pháp Luật is authoritative legal database in Vietnam
- Cites TT133/2016 Điều 38 directly
- Specific terminology: "Ký quỹ, ký cược" (deposits/pledges), not "Chi phí trả trước dài hạn"

**Weaknesses:**
- Full TT133/2016 Phụ lục 1 not yet accessed (only Điều 38 reference)
- Need to verify TT99/2025 treatment of deposits/pledges

---

#### Conflict Analysis

**Type of Conflict:** SEMANTIC DEFINITION

**Core Disagreement:**
```
Crowe:    TK 244 = Long-term prepaid expenses
TT133:    TK 244 = Long-term deposits/pledges

These are DIFFERENT accounting semantics.
```

**Impact Level:** 🔴 **CRITICAL**

**Why Critical:**
1. **Different business events:**
   - Prepaid expense = payment for future service/goods
   - Deposit/pledge = refundable security/collateral
   
2. **Different recognition rules:**
   - Prepaid expense → amortize over benefit period
   - Deposit/pledge → recognize on return/forfeiture
   
3. **Different financial statement classification:**
   - Prepaid expense → current/non-current asset (based on term)
   - Deposit/pledge → current/non-current asset (based on expected return date)
   
4. **Different posting patterns:**
   - Prepaid expense application: Debit expense account, Credit prepaid
   - Deposit return: Debit cash, Credit deposit

**Architectural Consequence:**
> If TK 244 ≠ prepaid expenses, then MERGED classification is INVALID.

---

#### Root Cause

**Why Conflict Arose:**

1. **Secondary source accepted as fact**
   - Crowe interpretation not verified against TT133 primary text
   - Big4 reliability assumed 100%

2. **Account name similarity misleading**
   - Both TK 142 and TK 244 sound "prepaid-related"
   - Actual definition: TK 244 = deposits (different semantic)

3. **Pattern matching bias**
   - TT133 pattern: split short/long term
   - TT99 pattern: simplify accounts
   - Assumed: 142 + 244 → 242 (merge pattern)
   - Reality: May be 142 → 242, 244 → ??? (different paths)

**Lesson:**
> "Account code proximity ≠ semantic similarity"

---

#### Resolution Required

**Questions to Answer:**

1. **TT133/2016 Verification:**
   - Access Phụ lục 1, Phần B - Tài khoản 142
   - Access Phụ lục 1, Phần B - Tài khoản 244
   - Confirm exact definitions from primary source

2. **TT99/2025 Verification:**
   - Access Phụ lục II, Phần B - Tài khoản 242
   - Verify if 242 = prepaid expenses only OR includes deposits
   - Identify TT99 account for deposits/pledges (if 242 excludes them)

3. **Semantic Mapping:**
   - Determine correct classification:
     - If TK 244 = deposits → Find TT99 deposit account
     - If TK 244 = prepaid → Validate Crowe interpretation
   - Update business event mapping
   - Correct affected unresolved questions

**Primary Sources Needed:**
- ✅ TT133/2016 Điều 38 (partial - from Thư Viện)
- ❌ TT133/2016 Phụ lục 1 full text (REQUIRED)
- ❌ TT99/2025 Phụ lục II full text (REQUIRED)

---

#### Impact Assessment

**Semantic Matrix Impact:**
- Row 8: TK 142 → TK 242 (may remain valid if 1-to-1)
- Row 9: TK 244 → TK 242 (**LIKELY INVALID** if TK 244 = deposits)
- Row 10: TK 242 definition (needs verification)
- New Row: TK 244 → TK ??? (deposits in TT99, if different account)

**Business Events Impact:**
- "Record prepaid expense" — may be unaffected (TK 142 → 242)
- "Record long-term prepaid" — **SEMANTIC ERROR** if TK 244 ≠ prepaid
- "Record deposit/pledge" — **MISSING EVENT** if TK 244 = deposits

**Unresolved Questions Impact:**
- A-009: Short-term prepaid recognition (TK 142/242) — may be valid
- A-010: Long-term prepaid recognition (TK 244/242) — **INVALID SEMANTIC**
- U-XXX: NEW question needed for deposit/pledge recognition

**Posting Rules Impact:**
- Prepaid expense posting — needs verification
- Deposit/pledge posting — needs new rule if separate semantic

**Financial Statement Impact:**
- Prepaid expense presentation — TT133 vs TT99 classification
- Deposit/pledge presentation — may be different line item

---

#### Recommended Resolution Path

**Option 1: PRIMARY Source Verification** ✅ RECOMMENDED

**Steps:**
1. Procure TT133/2016 Phụ lục 1 full text (Vietnamese MOF or legal service)
2. Procure TT99/2025 Phụ lục II full text
3. Verify exact definitions:
   - TK 142 = ?
   - TK 244 = ?
   - TK 242 = ?
4. Determine correct mapping
5. Update semantic matrix
6. Resolve C-004 as VERIFIED_PRIMARY

**Timeline:** 5-7 days (parallel to A.4 research)

**Pros:**
- Authoritative resolution
- No ambiguity
- Production-ready evidence

**Cons:**
- Requires document procurement
- May need Vietnamese legal expert
- Delays A.3 v1.0 final lock (but NOT provisional lock)

---

**Option 2: Hybrid Approach** ⚠️ FALLBACK

**If PRIMARY sources unavailable:**
1. Cross-validate with additional SECONDARY sources (EY, PwC, Deloitte, KPMG)
2. If 3+ Big4 agree with Crowe → Provisionally accept
3. If 3+ Big4 agree with Thư Viện → Reject Crowe, update matrix
4. Mark as VERIFIED_SECONDARY (multiple corroborating sources)
5. Require legal counsel review before production

**Timeline:** 2-3 days

**Pros:**
- Unblocks A.3 provisional lock
- Multiple independent sources

**Cons:**
- Still SECONDARY evidence
- May require correction later

---

#### Current Status

**Evidence Grade:**
- Source A (Crowe): SECONDARY + CORROBORATED (single source)
- Source B (Thư Viện): PRIMARY + CONFIRMED (TT133 Điều 38 cited)

**Authority Hierarchy:**
```
PRIMARY (Thư Viện TT133 Điều 38)
    >
SECONDARY (Crowe Big4 interpretation)
```

**Provisional Assessment:**
> Thư Viện Pháp Luật carries higher authority as PRIMARY legal source citing TT133 Điều 38 directly.

**Recommended Interim Classification:**
- TK 244 → TK 242 = **CONFLICTING** (pending PRIMARY full verification)
- Do NOT use in production rules
- Do NOT create schema based on this mapping
- Continue research in A.4 without assuming resolution

---

#### Timeline

**Discovery:** 2026-08-16 (A.3 primary source verification)  
**Documentation:** 2026-08-16 (this register)  
**Expected Resolution:** 2026-08-18 to 2026-08-23 (5-7 days via Option 1)  
**Blocking:** Production schema, posting rules, C.2-C.6  
**Not Blocking:** A.4 policy evolution research (abstraction independent of specific account mappings)

---

#### Related Documents

**References:**
- F5_6_A3_CORRECTION_REGISTER.md (A3-COR-001)
- F5_6_A3_VERIFICATION_REGISTER.md (Question C-004)
- F5_6_A3_SEMANTIC_MATRIX_V02.csv (rows 8-10)
- F5_6_A3_UNRESOLVED_QUESTIONS.md (A-009, A-010)

**Next Steps:**
- Task #3: Create F5_6_A3_FINDING_A3-001_TK142_244.md
- Task #4: Create F5_6_A3_EVIDENCE_TAXONOMY.md
- Task #5: Create F5_6_A3_CANONICAL_SEMANTIC_MODEL.md
- Parallel: PRIMARY source procurement (TT133 + TT99)

---

## Conflict Summary

| Conflict ID | Assertion | Source A | Source B | Priority | Status | Resolution |
|-------------|-----------|----------|----------|----------|--------|------------|
| **C-004** | TK 244 semantic | Crowe (prepaid) | TT133 (deposits) | CRITICAL | UNRESOLVED | PRIMARY verification required |

**Total Conflicts:** 1  
**Critical:** 1  
**Resolved:** 0  
**Blocking Production:** YES  
**Blocking A.4 Research:** NO

---

## Resolution Criteria

**Conflict is RESOLVED when:**
- ✅ PRIMARY source accessed and verified
- ✅ Semantic definition confirmed from authoritative legal text
- ✅ All affected semantic matrix rows corrected
- ✅ Business events re-mapped correctly
- ✅ Evidence grade updated to VERIFIED_PRIMARY or VERIFIED_SECONDARY (multi-source)

**Conflict remains UNRESOLVED if:**
- ❌ Only single SECONDARY source
- ❌ PRIMARY source not accessed
- ❌ Sources continue to disagree without resolution rationale

**Production Use:**
- ✅ VERIFIED_PRIMARY → Production allowed
- ⚠️ VERIFIED_SECONDARY (3+ independent sources) → Production with legal review
- ❌ CONFLICTING → Production BLOCKED

---

## Architectural Principle

**Derived from C-004:**

> **"When SECONDARY sources conflict with PRIMARY sources, PRIMARY authority prevails. When SECONDARY sources conflict with each other, obtain PRIMARY source or require 3+ independent SECONDARY corroboration."**

**Evidence Hierarchy:**
```
PRIMARY source (TT/VAS official text)
    ↓
SECONDARY source - multiple independent (3+ Big4 agreement)
    ↓
SECONDARY source - single (provisional research only)
    ↓
TERTIARY source (blog/ERP implementation)
```

---

**Document Status:** Conflict C-004 Registered  
**Resolution Status:** 🔴 UNRESOLVED (PRIMARY verification required)  
**Production Impact:** 🔴 BLOCKS production schema and posting rules  
**A.4 Impact:** 🟢 Does NOT block policy evolution research (abstraction independent)
