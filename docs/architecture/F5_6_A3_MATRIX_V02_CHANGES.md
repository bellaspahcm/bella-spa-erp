# F5.6 A.3 Semantic Matrix v0.1 → v0.2 Changes

> **Document Type:** Version Comparison  
> **Date:** 2026-08-16  
> **Status:** v0.2 NORMALIZED, NOT YET VERIFIED  
> **Purpose:** Document methodology improvements from v0.1 to v0.2

---

## Executive Summary

**Key Achievement:**
> v0.1 discovered critical semantics (TK 331 vendor prepayment, TK 141 boundary, TK 142/244 merge). v0.2 normalizes structure and flags unverified assumptions.

**Critical Changes:**
1. **Separated 4 layers:** Semantic, Regime, Accounting Treatment, Presentation
2. **Added lifecycle tracking:** Account lifecycle vs semantic transition
3. **Flagged ambiguity:** [AMBIGUOUS], [UNRESOLVED], [CRITICAL] markers
4. **Added confidence:** CONFIRMED, PROBABLE, AMBIGUOUS, UNRESOLVED
5. **Distinguished authority:** PRIMARY vs SECONDARY vs TERTIARY
6. **Prevented inference:** Business modeling ≠ Legal recognition rule

---

## Structural Changes

### Change 1: Four-Layer Normalization

**v0.1 Structure (Flat):**
```
Business Event | Regime | Account | Semantic | Recognition | Measurement | Posting | FS Classification
```

**Problem:**
- Mixed semantic layer with treatment layer
- Cannot distinguish account lifecycle from semantic transition
- Difficult to query by layer

**v0.2 Structure (Layered):**
```
Layer 1 — Semantic
├── Semantic_ID (e.g., SEM-001)
├── Business_Event
├── Accounting_Semantic
└── Semantic_Change_Type

Layer 2 — Regime
├── Regime_Code
├── Regime_Version
├── Effective_From
└── Effective_To

Layer 3 — Accounting Treatment
├── Account_Code
├── Account_Lifecycle (ACTIVE, DEPRECATED)
├── Recognition_Trigger
├── Recognition_Timing
├── Measurement_Basis
├── Posting_Context
├── Posting_Rule_Debit
└── Posting_Rule_Credit

Layer 4 — Presentation
├── FS_Section
├── FS_Subsection
├── FS_Line_Item
└── Presentation_Rule
```

**Benefit:**
- Clear separation of concerns
- Can query by semantic ID across regimes
- Can track account lifecycle separately from semantic transition

---

### Change 2: Account Lifecycle vs Semantic Transition

**v0.1 Problem:**
```
TK 142 → DEPRECATED
TK 244 → DEPRECATED
TK 242 → MERGED
```

Mixing lifecycle (DEPRECATED) with transition (MERGED).

**v0.2 Solution:**
```
TK 142
├── Account_Lifecycle: DEPRECATED (in TT99)
└── Semantic_Change_Type: MERGED (into TK 242)

TK 244
├── Account_Lifecycle: DEPRECATED (in TT99)
└── Semantic_Change_Type: MERGED (into TK 242)

TK 242
├── Account_Lifecycle: ACTIVE (in TT99)
└── Semantic_Change_Type: MERGED (from TK 142 + TK 244)
```

**Benefit:**
- Lifecycle tracks account existence (ACTIVE, DEPRECATED, NEW)
- Semantic transition tracks meaning change (IDENTICAL, EQUIVALENT, MERGED, SPLIT)
- No confusion between "account doesn't exist" vs "semantic changed"

---

### Change 3: Ambiguity Flagging

**v0.1 Problem:**
```
Recognition: Upon physical receipt
Measurement: Historical cost (VND face value)
```

These look like facts, but they're **unverified assumptions**.

**v0.2 Solution:**
```
Recognition_Trigger: Physical receipt
Recognition_Timing: [AMBIGUOUS] Timing rule not verified from TT133
Measurement_Basis: Historical cost (VND face value)
Confidence: PROBABLE
Research_Status: NEEDS_VERIFICATION
Notes: "Account code verified. Recognition timing NOT verified from legal source. Do not confuse business-event modeling with legal recognition rule."
```

**Benefit:**
- Clear distinction between verified vs assumed
- Forces research to verify every claim
- Prevents "business logic" from becoming "legal rule"

---

### Change 4: Confidence Levels

**v0.1:** No confidence tracking

**v0.2 Confidence Scale:**
- **CONFIRMED:** Verified from primary legal authority
- **PROBABLE:** Strong evidence (Crowe + practice), not yet verified from primary
- **AMBIGUOUS:** Conflicting evidence or unclear from sources
- **UNRESOLVED:** No evidence, requires research

**Example:**

| Semantic | v0.1 | v0.2 | Confidence | Why |
|----------|------|------|------------|-----|
| TK 141 = Employee advances ONLY | "IDENTICAL" | "IDENTICAL" | CONFIRMED | Verified from TT133 + TT99 + practice |
| TK 331 debit = Vendor advance (TT133) | "EQUIVALENT" | "EQUIVALENT" | CONFIRMED | Verified from Crowe 2016 + F5.6 breakthrough |
| TK 111 recognition timing | "Upon physical receipt" | "[AMBIGUOUS] Not verified" | PROBABLE | Assumed from practice, NOT verified from TT133 |
| TK 156 recognition trigger | "Upon goods receipt" | "[AMBIGUOUS] Goods receipt or invoice?" | AMBIGUOUS | Requires VAS 02 verification |

**Benefit:**
- Production schema CANNOT use AMBIGUOUS or UNRESOLVED semantics
- Clear roadmap: PROBABLE → verify → CONFIRMED

---

### Change 5: Source Authority Hierarchy

**v0.1 Problem:**
```
Source_Authority: "TT133/2016 Appendix 1, Crowe 2016"
```

Mixing primary (TT133) with secondary (Crowe) without hierarchy.

**v0.2 Solution:**
```
Source_Authority_Primary: TT133/2016
Source_Location_Primary: Phụ lục 1 - Hệ thống tài khoản
Source_Authority_Secondary: Crowe Vietnam 2016
Authority_Level: PRIMARY
```

**Authority Hierarchy:**
1. **PRIMARY:** Official legal documents (TT133, TT99, VAS)
2. **SECONDARY:** Big4 interpretations (Crowe, Deloitte, EY, PwC, KPMG)
3. **TERTIARY:** Blog posts, articles, implementation notes

**v0.2 Rule:**
- Crowe/Big4 useful for **discovery** and **cross-check**
- NOT primary authority for **semantic registry**
- Must cite PRIMARY source for production schema

**Benefit:**
- Clear audit trail
- Can challenge secondary interpretations with primary source
- Reduces legal risk

---

### Change 6: Business Modeling vs Legal Recognition

**v0.1 Problem:**
```
Cash deposited in bank → Upon bank confirmation → Historical cost (VND face value)
```

This looks like a legal rule, but it's actually **business-event modeling**.

**v0.2 Clarification:**
```
Recognition_Trigger: [AMBIGUOUS] Bank confirmation or deposit instruction?
Recognition_Timing: [AMBIGUOUS] Not verified from TT133
Notes: "Account code verified. Recognition trigger AMBIGUOUS - need to verify from VAS or TT133 guidance."
```

**Why This Matters:**

**Business Event Model (Bella):**
> "When user clicks 'Deposit Cash', system creates transaction with TK 112 debit."

**Legal Recognition Rule (VAS/TT133):**
> "Cash in bank SHALL be recognized when [legal condition X] is met."

**These are NOT the same.**

Bella's business model can trigger BEFORE legal recognition (early) or AFTER legal recognition (late).

**v0.2 Rule:**
- Do NOT infer legal recognition rule from Bella's business logic
- Flag every timing assumption as [AMBIGUOUS] until verified from VAS/TT133/TT99
- Separate "when Bella creates transaction" from "when Vietnamese law requires recognition"

**Benefit:**
- Prevents Bella's implementation from dictating accounting law
- Forces verification of every recognition trigger
- Enables correct period-end adjustments

---

## Critical Findings Preserved from v0.1

### Finding 1: TK 331 Vendor Prepayment (EQUIVALENT)

**v0.1 Discovery:**
> TK 331 can have debit balance = vendor advance.

**v0.2 Enhancement:**
```
SEM-006: Vendor prepayment recorded
├── TT133: TK 331 debit = vendor advance (IMPLICIT)
│   └── FS_Line_Item: "Phải thu ngắn hạn" (generic)
└── TT99: TK 331 debit = vendor advance (EXPLICIT)
    └── FS_Line_Item: "Trả trước cho người bán" (specific)

Semantic_Change_Type: EQUIVALENT
Confidence: CONFIRMED
Research_Status: VERIFIED
Notes: "CRITICAL FINDING: TT99 provides EXPLICIT FS line item for vendor prepayment. This is key difference from TT133."
```

**Why Preserved:**
- This is the KEY semantic discovery of A.3
- Proves why "331 → 331" is NOT IDENTICAL
- Justifies EQUIVALENT classification

---

### Finding 2: TK 141 Semantic Boundary (IDENTICAL)

**v0.1 Discovery:**
> TK 141 = Employee advances ONLY. NOT for vendor prepayments.

**v0.2 Enhancement:**
```
SEM-004: Employee advance recorded
├── TT133: TK 141 = Employee advance
└── TT99: TK 141 = Employee advance

Semantic_Change_Type: IDENTICAL
Confidence: CONFIRMED
Research_Status: VERIFIED
Notes: "Account code CONFIRMED. Semantic boundary: TK 141 = EMPLOYEE ONLY. NOT for vendor prepayment. Source: TT133 Phụ lục 1 + TT99 Phụ lục II + Frappe implementation pattern."
```

**Why Preserved:**
- Confirms semantic boundary between TK 141 and TK 331
- Prevents future confusion about vendor prepayment account
- Critical for Bella F1 gap analysis (C.3)

---

### Finding 3: TK 142/244 → TK 242 Merge (MERGED)

**v0.1 Discovery:**
> TT133 TK 142 (short-term) + TK 244 (long-term) → TT99 TK 242 (merged, classify at FS prep).

**v0.2 Enhancement:**
```
SEM-010: Short-term prepaid expense
├── TT133: TK 142 (DEPRECATED)
└── TT99: TK 242 (MERGED from TK 142 + TK 244)

SEM-011: Long-term prepaid expense
├── TT133: TK 244 (DEPRECATED)
└── TT99: TK 242 (MERGED from TK 142 + TK 244)

Semantic_Change_Type: MERGED
Confidence: CONFIRMED
Research_Status: VERIFIED
Notes: "SEMANTIC TRANSITION: TT133 TK 142 + TK 244 merged into TT99 TK 242. Presentation rule changed: period classification moved from account to FS prep."
Source_Authority_Primary: TT99/2025 Phụ lục II
Source_Authority_Secondary: Crowe Vietnam 2016
```

**Why Preserved:**
- Proves MERGED classification correct
- Documents presentation rule change (account-level → FS-level)
- Critical for historical conversion (TT133 → TT99)

---

## New Capabilities in v0.2

### Capability 1: Query by Semantic ID

**v0.1:** Cannot link same semantic across regimes

**v0.2:** Can query all regimes for same semantic

```sql
-- Find all regimes for "Vendor prepayment recorded"
SELECT *
FROM semantic_matrix_v02
WHERE Semantic_ID = 'SEM-006';

-- Result: TT133-2016 + TT99-2025 rows with EQUIVALENT classification
```

---

### Capability 2: Track Account Lifecycle

**v0.1:** Cannot distinguish "account deprecated" from "semantic changed"

**v0.2:** Can query account lifecycle separately

```sql
-- Find all DEPRECATED accounts in TT99
SELECT Account_Code, Business_Event
FROM semantic_matrix_v02
WHERE Regime_Code = 'TT99-2025'
  AND Account_Lifecycle = 'DEPRECATED';

-- Result: Empty (TT99 has no deprecated accounts from TT133 perspective)
```

```sql
-- Find all DEPRECATED accounts in TT133 (from TT99 perspective)
SELECT Account_Code, Business_Event
FROM semantic_matrix_v02
WHERE Regime_Code = 'TT133-2016'
  AND Account_Code IN (SELECT Account_Code
                       FROM semantic_matrix_v02
                       WHERE Regime_Code = 'TT99-2025'
                         AND Account_Lifecycle = 'DEPRECATED');

-- Result: TK 142, TK 244
```

---

### Capability 3: Filter by Confidence

**v0.1:** Cannot distinguish verified from assumed semantics

**v0.2:** Can filter by confidence level

```sql
-- Find all CONFIRMED semantics (safe for production)
SELECT Semantic_ID, Business_Event, Accounting_Semantic
FROM semantic_matrix_v02
WHERE Confidence = 'CONFIRMED';

-- Result: SEM-004 (TK 141), SEM-006 (TK 331), SEM-010/011 (TK 142/244/242)
```

```sql
-- Find all AMBIGUOUS semantics (requires verification)
SELECT DISTINCT Semantic_ID, Business_Event, Recognition_Timing, Measurement_Basis
FROM semantic_matrix_v02
WHERE Confidence IN ('AMBIGUOUS', 'UNRESOLVED');

-- Result: Cash accounts, inventory, fixed assets (recognition timing unverified)
```

---

### Capability 4: Track Unresolved Questions

**v0.1:** No mechanism to track what needs research

**v0.2:** Research_Status field + Unresolved Questions Register

```sql
-- Find all semantics needing verification
SELECT Semantic_ID, Business_Event, Research_Status, Notes
FROM semantic_matrix_v02
WHERE Research_Status IN ('NEEDS_VERIFICATION', 'UNRESOLVED');

-- Result: 12 AMBIGUOUS + 8 UNRESOLVED = 20 questions
```

---

## Prohibitions Enforced

### Prohibition 1: No Production Schema from v0.2

**v0.2 is RESEARCH artifact, NOT production schema.**

**Allowed:**
- ✅ Use v0.2 for research planning
- ✅ Track unresolved questions
- ✅ Guide legal research (which VAS to access)
- ✅ Inform A.4 policy model design

**Prohibited:**
- ❌ Generate production SQL from v0.2
- ❌ Use AMBIGUOUS semantics in code
- ❌ Assume PROBABLE = CONFIRMED
- ❌ Skip verification because "Crowe said so"

---

### Prohibition 2: No Inference as Legal Rule

**v0.2 flags every unverified assumption.**

**v0.1 Problem:**
> "Cash deposited in bank → Upon bank confirmation"

Looks like a legal rule, but it's an **assumption**.

**v0.2 Solution:**
> "Recognition_Timing: [AMBIGUOUS] Not verified from TT133"

**Rule:**
- If timing/trigger/rule not verified from PRIMARY authority → Flag [AMBIGUOUS]
- If conflicting evidence → Flag [AMBIGUOUS]
- If no evidence → Flag [UNRESOLVED]
- NEVER infer legal rule from business logic

---

### Prohibition 3: No Crowe as Final Authority

**v0.2 separates PRIMARY from SECONDARY authority.**

**Crowe Vietnam (2016) is:**
- ✅ Excellent for discovery (found TK 142/244 merge)
- ✅ Useful for cross-check
- ❌ NOT final authority for semantic registry

**v0.2 Rule:**
- Crowe → **Discovery**
- TT133/TT99/VAS → **Verification**
- Production schema uses PRIMARY source only

---

## Gate 2 Readiness

### v0.1 Status
- ✅ Discovered critical semantics
- ❌ Mixed verified with assumed
- ❌ No confidence tracking
- ❌ Cannot distinguish lifecycle from transition
- **Gate 2:** 🔴 **NOT READY** (unverified assumptions)

---

### v0.2 Status
- ✅ Discovered critical semantics (preserved)
- ✅ Flagged all unverified assumptions
- ✅ Added confidence tracking
- ✅ Separated lifecycle from transition
- ✅ Created Unresolved Questions Register
- **Gate 2:** 🟡 **PROMISING** — Needs verification (23 questions)

---

### Path to v1.0 (Gate 2 Ready)

**Requirements:**
1. Resolve 3 CRITICAL questions (C-001, C-002, C-003)
2. Resolve ≥50% AMBIGUOUS questions (6/12)
3. Resolve ≥25% UNRESOLVED questions (2/8)
4. Document mitigation for remaining questions

**Timeline:** 8-12 days (with primary authority access)

**Deliverable:** Semantic Matrix v1.0 with ≥75% CONFIRMED confidence

---

## Lessons Learned

### Lesson 1: Discovery ≠ Verification

**v0.1 Achievement:**
> Discovered that TK 331 debit = vendor advance. This is HUGE.

**v0.2 Discipline:**
> Even HUGE discoveries need PRIMARY source verification.

**Why:**
- Crowe 2016 may have interpreted TT133 correctly
- But only TT133 Phụ lục 1 Phần B can confirm
- Secondary source ≠ Primary authority

---

### Lesson 2: Business Logic ≠ Accounting Law

**v0.1 Problem:**
> "Cash received → Upon physical receipt" looks like accounting law.

**v0.2 Insight:**
> This is how Bella **models** the event, not how VAS **requires** recognition.

**Why Critical:**
- Bella's model can be WRONG
- Must verify every recognition trigger from VAS/TT133/TT99
- Period-end adjustments depend on LEGAL recognition, not Bella's logic

---

### Lesson 3: Account Code ≠ Account Semantic

**v0.1 Problem:**
> "TK 111 identical in both regimes" (confusing account code with semantic)

**v0.2 Distinction:**
> TK 111 (account code) IDENTICAL. Cash received (business event semantic) IDENTICAL. But recognition timing AMBIGUOUS.

**Why:**
- Account code can stay same while semantic changes
- Must analyze each business event × posting context separately
- Cannot assume "same account code = same semantic"

---

## Conclusion

**v0.1 Achievement:**
> Discovered 3 critical semantic patterns (TK 331 vendor prepayment, TK 141 boundary, TK 142/244 merge). This is the foundation.

**v0.2 Achievement:**
> Normalized structure, flagged 23 unverified assumptions, separated verified from assumed, created research roadmap.

**Status:**
- v0.1: 🟢 **VALUABLE** (discovery)
- v0.2: 🟡 **PROMISING** (normalized, not yet verified)
- v1.0: ⏳ **PENDING** (requires 8-12 days legal research)

**Next Steps:**
1. Access TT133/2016, TT99/2025, VAS 01/02/03 (primary authorities)
2. Resolve 3 CRITICAL questions (C-001, C-002, C-003)
3. Resolve ≥50% AMBIGUOUS questions
4. Produce Semantic Matrix v1.0
5. Submit to Gate 2

**Gate 2 Readiness:** 🔴 **BLOCKED** (CRITICAL questions unresolved)

**Assessment:**
> "v0.2 đã làm được điều quan trọng nhất: nó đang tìm ra những chỗ mà một abstraction 'đẹp trên giấy' có thể sai khi chạm vào kế toán thật. Đó chính xác là mục đích của A.3."

---

**Document Status:** Matrix v0.1 → v0.2 Comparison  
**Next:** Access primary legal authorities  
**Blocking:** Gate 2 approval  
**Success Metric:** Flag every assumption instead of inferring as fact ✅
