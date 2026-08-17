# F5.6 A.4 Policy Evolution Proof

> **Document Type:** A.4 Deliverable — Policy Model Design  
> **Date:** 2026-08-16  
> **Status:** Framework Established, Proof Pending  
> **Purpose:** Prove policy can evolve without breaking Finance Kernel or historical reconstruction

---

## Objective (Single Statement)

**Prove:**
> "Bella có thể thay đổi cách hạch toán cho giao dịch mới mà không thay đổi Finance Kernel và không làm thay đổi cách tái dựng giao dịch lịch sử."

**If Proven:**
- ✅ Gate 2 Question 2: Policy evolution safe? → **YES**
- ✅ Gate 2 Question 3: Historical reconstruction passes? → **YES**
- ✅ C.2 UNBLOCKED

**If NOT Proven:**
- ❌ Iterate abstraction (do NOT patch code)
- ❌ C.2 remains BLOCKED

---

## A.4 Four-Step Framework

### Step 1: Lock Policy Taxonomy

**Objective:** Identify policy domains and their independence characteristics.

**Domains to Examine:**
1. **Recognition** — When to record transaction
2. **Measurement** — How to value transaction
3. **Classification** — Which account to use
4. **Posting** — Debit/credit instruction
5. **Presentation** — Financial statement line item
6. **Closing** — Period-end adjustments
7. **Transition** — Regime/policy change handling

**Questions for Each Domain:**
- Can this domain version independently?
- Does this domain depend on regime?
- Is this domain presentation-only (no journal impact)?
- Does this domain affect journal directly?
- Must this domain snapshot into transaction?

**Deliverable:** Policy Taxonomy Matrix (1-2 pages)

---

### Step 2: Lock JSONB Boundary

**Objective:** Define what JSONB can and cannot contain.

**Critical Rule:**
> **"JSONB chứa policy data/configuration, không chứa executable business logic."**

**ALLOWED in JSONB:**
- ✅ Trigger (e.g., `"trigger": "invoice_received"`)
- ✅ Timing (e.g., `"timing": "upon_goods_receipt"`)
- ✅ Account mapping (e.g., `"account": "331"`)
- ✅ Classification (e.g., `"fs_section": "current_assets"`)
- ✅ Threshold (e.g., `"threshold": 1000000`)
- ✅ Effective date (e.g., `"effective_from": "2026-01-01"`)
- ✅ Presentation mapping (e.g., `"fs_line_item": "Trả trước cho người bán"`)

**PROHIBITED in JSONB:**
- ❌ IF/ELSE logic
- ❌ LOOP constructs
- ❌ EXECUTE statements
- ❌ Complex business logic
- ❌ Procedural code

**Why Critical:**
> "Nếu không khóa boundary này, vài năm sau Bella sẽ có một 'ngôn ngữ lập trình kế toán' nằm trong database 😂."

**Examples:**

**GOOD JSONB (Policy Data):**
```json
{
  "recognition_trigger": "invoice_received",
  "recognition_timing": "upon_goods_receipt",
  "measurement_basis": "historical_cost",
  "account_debit": "331",
  "account_credit": "111",
  "fs_classification": {
    "section": "current_assets",
    "line_item": "Trả trước cho người bán"
  }
}
```

**BAD JSONB (Executable Logic):**
```json
{
  "logic": "IF amount > 1000000 THEN account = '331' ELSE account = '141' END",
  "loop": "FOR EACH line IN invoice DO ...",
  "execute": "CALL calculate_tax()"
}
```

**Resolution:**
- Policy data → JSONB
- Policy logic → Application code (Resolver layer)

**Deliverable:** JSONB Boundary Specification (1-2 pages)

---

### Step 3: Historical Reconstruction Proof

**Objective:** Prove policy evolution doesn't affect historical transactions.

**Timeline Test:**

```
2025-05-15: Transaction T1
    Regime: TT133-2016
    Policy: v1.0
    Rule: R1 (vendor prepayment posts to TK 331 debit, FS line "Phải thu ngắn hạn")
    
2026-05-15: Transaction T2
    Regime: TT99-2025
    Policy: v1.0
    Rule: R2 (vendor prepayment posts to TK 331 debit, FS line "Trả trước cho người bán")
    
2027-05-15: Transaction T3
    Regime: TT99-2025
    Policy: v1.1 (hypothetical change: vendor prepayment >1M requires manager approval)
    Rule: R3 (vendor prepayment posts to TK 331 debit, FS line "Trả trước cho người bán", approval required)
    
2030-05-15: Transaction T4
    Regime: TTXXX-2030 (hypothetical future regime)
    Policy: v1.0
    Rule: R4 (new regime with different rules)
```

**Reconstruction Test (2031-01-01):**

**Query T1:**
```
Expected Result:
├── Transaction Date: 2025-05-15
├── Regime: TT133-2016
├── Policy: v1.0
├── Rule: R1
├── Journal Lines: Debit 331, Credit 111
├── FS Presentation: "Phải thu ngắn hạn" (TT133 style)
└── Accounting Context: ORIGINAL (not affected by 2027 or 2030 changes)
```

**Query T2:**
```
Expected Result:
├── Transaction Date: 2026-05-15
├── Regime: TT99-2025
├── Policy: v1.0
├── Rule: R2
├── Journal Lines: Debit 331, Credit 111
├── FS Presentation: "Trả trước cho người bán" (TT99 style)
└── Accounting Context: ORIGINAL (not affected by 2027 Policy v1.1)
```

**Query T3:**
```
Expected Result:
├── Transaction Date: 2027-05-15
├── Regime: TT99-2025
├── Policy: v1.1
├── Rule: R3
├── Journal Lines: Debit 331, Credit 111
├── FS Presentation: "Trả trước cho người bán" (TT99 style)
├── Approval: Required (Policy v1.1 rule)
└── Accounting Context: ORIGINAL (Policy v1.1 context preserved)
```

**Query T4:**
```
Expected Result:
├── Transaction Date: 2030-05-15
├── Regime: TTXXX-2030
├── Policy: v1.0
├── Rule: R4
├── Journal Lines: [NEW REGIME RULES]
├── FS Presentation: [NEW REGIME STYLE]
└── Accounting Context: ORIGINAL (2030 regime context)
```

**Critical Test:**
> **"Nếu Policy v1.1 được tạo năm 2027 mà transaction năm 2025 thay đổi → kiến trúc sai."**

**Pass Criteria:**
- ✅ T1 context = TT133 / v1.0 / R1 (in 2031 query)
- ✅ T2 context = TT99 / v1.0 / R2 (in 2031 query)
- ✅ T3 context = TT99 / v1.1 / R3 (in 2031 query)
- ✅ T4 context = TTXXX / v1.0 / R4 (in 2031 query)
- ✅ T1 FS presentation = "Phải thu ngắn hạn" (NOT "Trả trước cho người bán")
- ✅ T2 FS presentation = "Trả trước cho người bán" (TT99 v1.0 style)
- ✅ T3 FS presentation = "Trả trước cho người bán" (TT99 v1.1 style, approval preserved)

**Fail Criteria:**
- ❌ T1 context changed to v1.1 or TT99 or TTXXX
- ❌ T1 FS presentation changed to "Trả trước cho người bán"
- ❌ T2 affected by Policy v1.1 changes
- ❌ T3 approval requirement lost

**Deliverable:** Historical Reconstruction Test (2-3 pages with concrete examples)

---

### Step 4: Architecture Review #2

**Objective:** Three-question gate to UNBLOCK C.2.

**Gate 2 Questions:**

| Question | Evidence Source | Status |
|----------|----------------|--------|
| **Q1: Semantic của Regime có đúng không?** | A.3 Semantic Research | ✅ A.3 |
| **Q2: Policy có thể evolve mà không phá lịch sử không?** | A.4 Policy Evolution Proof | ⏳ A.4 |
| **Q3: Transaction 2025-2030 có reconstruct chính xác không?** | A.4 Historical Reconstruction Test | ⏳ A.4 |

**Decision Matrix:**

| Q1 | Q2 | Q3 | Decision |
|----|----|----|----------|
| ✅ | ✅ | ✅ | **C.2 UNBLOCKED** |
| ✅ | ✅ | ❌ | Iterate A.4 (historical reconstruction) |
| ✅ | ❌ | — | Iterate A.4 (policy model) |
| ❌ | — | — | Iterate A.3 (semantic research) |

**Pass Condition:**
```
IF Q1 = YES AND Q2 = YES AND Q3 = YES:
    UNBLOCK C.2
    APPROVE production schema design
    PROCEED to Posting Rules implementation
ELSE:
    BLOCK C.2
    ITERATE A.3/A.4 (fix abstraction, NOT patch code)
```

**Deliverable:** Gate 2 Review Report (1-2 pages)

---

## Corrected Conclusions (from A.3 Review)

### Correction 1: Migration Risk

**v0.1 Claimed:**
> "Zero migration risk"

**Corrected (v0.2):**
> "Architecture is designed to minimize migration risk and preserve historical accounting semantics."

**Why:**
- A.3 proved abstraction on **limited semantic set**
- Cannot claim "zero risk" for entire Finance OS
- More accurate: "designed to minimize" (provable claim)

---

### Correction 2: Finance Kernel Regime-Agnostic

**v0.1 Claimed:**
> "Finance Kernel remains regime-agnostic"

**Corrected (v0.2):**
> "Finance Kernel remains regime-agnostic in business logic. Transaction metadata includes `regime_code`, `policy_version`, `rule_snapshot` for historical context preservation."

**Why:**
- Kernel logic = regime-agnostic ✅
- Transaction metadata = regime-aware ✅
- These are NOT contradictory

**Clarification:**
- Kernel does NOT check `IF regime = 'TT133' THEN ...` (regime-agnostic)
- Kernel DOES store `regime_code` as metadata (regime-aware context)

---

## Architecture Sequence (DO NOT SKIP)

**Current Correct Sequence:**

```
F1-F4 (Finance Kernel)
    ↓
F5-S0 Constitution
    ↓
A.3 Semantic Research ✅
    ↓
A.4 Policy Model ← NOW
    ↓
Architecture Review #2
    ↓
Production Schema Design
    ↓
C.2 Posting Rules Implementation
```

**WRONG Sequence (PROHIBITED):**

```
A.3
 ↓
CREATE TABLE ❌
 ↓
PATCH ❌
 ↓
A.4 discovers abstraction error
 ↓
MIGRATE ❌
```

**Why Correct Sequence Matters:**
> "Đó chính xác là loại technical debt mà việc BLOCK C.2 hiện tại đang giúp Bella tránh."

---

## A.4 Deliverables (NOT Documentation Volume)

**Target:** Proof, NOT prose

**Deliverables:**

1. **Policy Taxonomy Matrix** (1-2 pages)
   - 7 domains
   - Independence characteristics
   - Regime dependency
   - Journal impact
   - Snapshot requirements

2. **JSONB Boundary Specification** (1-2 pages)
   - ALLOWED examples
   - PROHIBITED examples
   - Resolution strategy

3. **Historical Reconstruction Test** (2-3 pages)
   - Timeline (2025 → 2030)
   - Query results for T1, T2, T3, T4
   - Pass/Fail criteria
   - Actual test execution

4. **Gate 2 Review Report** (1-2 pages)
   - Three questions answered
   - Evidence summary
   - C.2 unblock decision

**Total:** 6-10 pages (proof-focused, NOT 50+ pages prose)

---

## Success Criteria

**A.4 Success = Prove One Statement:**
> "Bella có thể thay đổi cách hạch toán cho giao dịch mới mà không thay đổi Finance Kernel và không làm thay đổi cách tái dựng giao dịch lịch sử."

**Evidence Required:**
- ✅ Policy taxonomy locked
- ✅ JSONB boundary locked
- ✅ Timeline test PASSED (2025 → 2030)
- ✅ Historical reconstruction PASSED
- ✅ Finance Kernel untouched
- ✅ T1 (2025) context unchanged by T3 (2027) policy change

**If All Evidence Present:**
- Gate 2 → **PASS**
- C.2 → **UNBLOCKED**

**If Any Evidence Missing:**
- Gate 2 → **FAIL**
- Iterate A.4 (fix abstraction)
- C.2 → **REMAINS BLOCKED**

---

## Prohibitions (Enforced)

**A.4 Phase:**
- ❌ Do NOT create production schemas
- ❌ Do NOT code Posting Engine
- ❌ Do NOT modify Finance Kernel
- ❌ Do NOT start C.2 implementation
- ❌ Do NOT write 50+ pages of prose

**JSONB Usage:**
- ❌ Do NOT allow IF/ELSE in JSONB
- ❌ Do NOT allow LOOP in JSONB
- ❌ Do NOT allow EXECUTE in JSONB
- ❌ Do NOT create "accounting programming language in database"

**Architecture:**
- ❌ Do NOT skip A.4 → C.2
- ❌ Do NOT create schema before Gate 2
- ❌ Do NOT patch code when abstraction wrong

---

## Timeline

**A.4 Execution:** 3-5 days

**Day 1-2:**
- Step 1: Policy Taxonomy Matrix
- Step 2: JSONB Boundary Specification

**Day 3-4:**
- Step 3: Historical Reconstruction Test (design + execute)

**Day 5:**
- Step 4: Gate 2 Review Report

**After A.4:**
- Architecture Review #2 (1 day)
- If PASS → C.2 unblocked

---

## Architectural Significance

**What A.4 Proves:**
> "Finance OS của Bella từ một hệ thống 'có accounting module' tiến thành một financial architecture có khả năng sống qua nhiều chu kỳ thay đổi quy định."

**Why This Matters:**
- 2026: TT99/2025 effective
- 2030: Next circular may replace TT99
- 2035: Another regime change
- 2040: Another regime change

**Without A.4 Proof:**
- Each regime change → rewrite Finance Kernel ❌
- Historical transactions → broken reconstruction ❌
- Audit trail → compromised ❌

**With A.4 Proof:**
- New regime → new policy version only ✅
- Finance Kernel → untouched ✅
- Historical transactions → perfect reconstruction ✅
- Audit trail → preserved ✅

**This is the difference between:**
- "Accounting software" (breaks every 5 years)
- "Financial architecture" (survives 20+ years)

---

**Document Status:** A.4 Framework Established  
**Next:** Execute 4 steps → Produce proof  
**Blocking:** Gate 2 approval, C.2 implementation  
**Success Metric:** Prove policy evolution doesn't break Finance Kernel or historical reconstruction ✅
