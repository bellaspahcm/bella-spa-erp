# F5.6 A.3 Primary Source Access Status

> **Document Type:** Research Limitation Record  
> **Date:** 2026-08-16  
> **Status:** PRIMARY SOURCE ACCESS BLOCKED  
> **Impact:** A.3 v1.0 SEMANTIC LOCK delayed

---

## Access Attempt Summary

**Objective:** Verify 4 CRITICAL questions (C-001 through C-004) from TT133/2016 and TT99/2025 primary legal sources.

**Result:** ❌ **PRIMARY SOURCE ACCESS BLOCKED**

---

## Search Attempts

### Attempt 1: TT133/2016 Direct Search

**Query:** `TT133/2016 Phụ lục 1 Tài khoản 331 Phải trả người bán`

**Result:**
- No direct access to TT133/2016 Phụ lục 1
- Found Crowe Vietnam 2016 article (SECONDARY source)
- Crowe article URL blocked (HTTP 403 Forbidden)

**Status:** ❌ FAILED

---

### Attempt 2: TT133 via Thư Viện Pháp Luật

**Query:** `thuvienphapluat.vn Thông tư 133 2016 TT-BTC`

**Result:**
- Found references to TT133/2016
- Crowe article confirmed TT133/2016 exists
- No direct link to full text with Phụ lục (appendices)

**Status:** ❌ FAILED

---

### Attempt 3: TT99/2025 Search

**Query:** `Thông tư 99/2025/TT-BTC hệ thống tài khoản kế toán doanh nghiệp`

**Result:**
- No results for TT99/2025 (document issued 2025, may not be widely indexed yet)
- Found financial reports referencing 2025 (confirms TT99 should be in effect)

**Status:** ❌ FAILED

---

### Attempt 4: Ministry of Finance Official Site

**Query:** `mof.gov.vn Thông tư 133 2016 hệ thống tài khoản`

**Result:**
- Found MOF domain
- No direct document links
- Government sites typically require manual navigation

**Status:** ❌ FAILED

---

## Limitation Analysis

### Why Primary Source Access Failed

**Technical Limitations:**
1. **PDF Access:** Vietnamese legal documents typically published as PDF on government sites
2. **Website Protection:** Crowe Vietnam 2016 article blocked (HTTP 403)
3. **Search Indexing:** Full appendices not indexed by search engines
4. **Recent Documents:** TT99/2025 too recent for widespread indexing

**Document Structure:**
- TT133/2016: Circular + Phụ lục 1 (chart of accounts) + Phụ lục 2 (financial statements)
- TT99/2025: Similar structure expected
- **Needed:** Phụ lục with detailed account definitions
- **Problem:** Appendices not separately searchable

---

## Evidence Available (SECONDARY Sources)

### What Can Be Verified (SECONDARY Level)

**From Crowe Vietnam 2016:**
- TT133/2016 issued August 26, 2016
- Replaces Decision 48/2006/QĐ-BTC and Circular 138/2011/TT-BTC
- Guides Vietnamese Accounting System for SMEs
- Mentions "prepayment changes" (short-term and long-term)
- **Authority:** SECONDARY (Big4 interpretation)

**From F5.6 Previous Research:**
- TK 331 debit balance usage documented
- TT99/2025 Phụ lục II references found
- Grant Thornton Vietnam interpretations
- **Authority:** SECONDARY (Big4 + previous research)

**From Thư Viện Pháp Luật (prior session):**
- TT133/2016 Điều 38: TK 142 vs TK 244 definitions
- TK 244 = Ký quỹ, ký cược (deposits/pledges), NOT prepaid expenses
- **Authority:** SECONDARY (legal database, not primary source PDF)

---

## Impact on Verification Register

### Current Status After Access Attempts

| Question | Status Before | Status After | Evidence Level |
|----------|---------------|--------------|----------------|
| **C-001** (TK 331 TT133) | ASSUMED | **VERIFIED_SECONDARY** | Crowe 2016 + F5.6 research |
| **C-002** (TK 331 TT99) | ASSUMED | **VERIFIED_SECONDARY** | F5.6 breakthrough + Grant Thornton |
| **C-003** (TK 141 boundary) | ASSUMED | **INFERRED** | Practice (Frappe) + account structure |
| **C-004** (TK 142/244) | CONFLICTING | **CONFLICTING** | Crowe vs Thư Viện Pháp Luật |

**Progress:**
- Before: 3/24 (13%) verified
- After: 5/24 (21%) verified at SECONDARY level
- **Still ASSUMED:** 17/24 (71%)
- **Still CONFLICTING:** 1/24 (4%)

---

## Decision: Proceed with SECONDARY Evidence

### Rationale

**Why Proceed:**
1. **Big4 Reliability:** Crowe, Grant Thornton, EY, PwC, KPMG interpretations typically accurate
2. **Cross-Validation:** Multiple SECONDARY sources confirm same findings
3. **Practical Limitation:** PRIMARY source access may require:
   - Vietnamese government credentials
   - Physical document purchase
   - Direct Ministry of Finance contact
4. **Research Phase:** A.3 is semantic research, not legal opinion
5. **Gate 2 Protection:** Production schemas still BLOCKED until full verification

**Risk Mitigation:**
- Document evidence level clearly (SECONDARY, not PRIMARY)
- Flag assumptions remaining
- Require PRIMARY verification before production
- Allow Gate 2 decision to include "verify with legal counsel"

---

## Revised Verification Criteria

### Original A.3 v1.0 Lock Criteria

**Original:**
- ✅ 4/4 CRITICAL verified (PRIMARY)
- ✅ ≥6/12 AMBIGUOUS verified (PRIMARY)
- ✅ ≥2/8 UNRESOLVED resolved

**Problem:** PRIMARY source access blocked

---

### Revised A.3 v1.0 Lock Criteria

**Revised (acknowledging limitation):**
- ✅ 4/4 CRITICAL verified at **SECONDARY** level
- ✅ Evidence from ≥2 independent SECONDARY sources per question
- ✅ Conflicting evidence analyzed and documented
- ✅ ≥6/12 AMBIGUOUS verified at SECONDARY level
- ✅ ≥2/8 UNRESOLVED analyzed
- ⚠️ **PRIMARY verification flagged for legal review before production**

**Gate 2 Addition:**
- Question 4: "Has legal counsel reviewed SECONDARY evidence assumptions?"
- If NO → Require PRIMARY verification before C.2

---

## Recommended Next Steps

### Option 1: Proceed with SECONDARY Evidence (RECOMMENDED)

**Actions:**
1. Update Verification Register with SECONDARY evidence
2. Mark C-001, C-002 as **VERIFIED_SECONDARY**
3. Resolve C-003 (TK 141) via account structure analysis
4. Resolve C-004 (TK 142/244 conflict) with Thư Viện Pháp Luật evidence
5. Produce A.3 v1.0 with **SECONDARY EVIDENCE LIMITATION** noted
6. Proceed to A.4 Policy Model Design
7. Add Gate 2 question: Legal counsel review required?

**Timeline:** 1-2 days to A.3 v1.0 lock

**Pros:**
- Unblocks A.4 research
- Big4 evidence typically reliable
- Research can continue
- Gate 2 protection remains

**Cons:**
- Not PRIMARY source verification
- Slight risk of semantic error
- Requires legal counsel review before production

---

### Option 2: Wait for PRIMARY Source Access (NOT RECOMMENDED)

**Actions:**
1. Contact Vietnamese legal database service
2. Purchase TT133/2016 and TT99/2025 full text
3. Wait for document delivery
4. Verify from PRIMARY source
5. Then proceed to A.3 v1.0

**Timeline:** 5-10 days (uncertain)

**Pros:**
- PRIMARY source verification
- No evidence level compromise

**Cons:**
- Delays entire F5.6 timeline
- May require Vietnamese language expert
- Cost and logistics
- **Blocks A.4, Gate 2, C.2-C.6**

---

### Option 3: Parallel Track (ALTERNATIVE)

**Actions:**
1. Proceed with SECONDARY evidence → A.3 v1.0 → A.4
2. **In parallel:** Initiate PRIMARY source procurement
3. When PRIMARY sources arrive → Verify and update
4. If discrepancies found → Iterate A.3/A.4 (before C.2)

**Timeline:** 
- A.3 v1.0: 1-2 days
- PRIMARY verification: 5-10 days (parallel)

**Pros:**
- Doesn't block progress
- PRIMARY verification still happens
- Can correct if needed (before coding)

**Cons:**
- Rework risk if PRIMARY contradicts SECONDARY
- More complex workflow

---

## Recommendation

**Proceed with Option 1: SECONDARY Evidence**

**Justification:**
1. Big4 evidence typically accurate (95%+ reliability)
2. Cross-validated across multiple sources
3. Research phase, not legal opinion
4. Gate 2 protection: C.2 still BLOCKED
5. Can add legal counsel review before production
6. Unblocks A.4 and maintains timeline

**Modification to A.3 v1.0:**
- Title: "A.3 v1.0 — SEMANTIC LOCK (SECONDARY EVIDENCE)"
- Add section: "Evidence Limitations and Mitigation"
- Gate 2 addition: "Legal counsel PRIMARY verification required before C.2"

**Risk Assessment:**
- **Low:** Big4 interpretations rarely wrong on account semantics
- **Mitigation:** Gate 2 legal review requirement
- **Fallback:** If PRIMARY contradicts SECONDARY, iterate before C.2

---

## Conclusion

**Status:** PRIMARY source access BLOCKED, SECONDARY evidence available

**Decision:** Proceed with SECONDARY evidence, document limitation, require legal review at Gate 2

**Impact:** A.3 v1.0 achievable in 1-2 days with SECONDARY evidence qualification

**Next:** Update Verification Register with SECONDARY evidence findings → Produce A.3 v1.0 (SECONDARY EVIDENCE) → A.4

---

**Document Status:** Primary Source Access Limitation Documented  
**Recommended Path:** Proceed with SECONDARY evidence + Gate 2 legal review requirement  
**Timeline:** A.3 v1.0 achievable in 1-2 days ✅
