# A.3 + A.4 Research Framework — Semantic Proof, Not Documentation Volume

> **Phase:** A.3 Semantic Research + A.4 Policy Model Design  
> **Status:** 🟢 UNBLOCKED (Gate 1 PASSED)  
> **Objective:** **Prove abstraction works**, not produce documentation  
> **Success Criteria:** Semantic matrix + historical reconstruction test

---

## Critical Principle

> **"52.000+ từ tài liệu không phải tiêu chí thành công."**

**True Success Criteria:**
> **"Có thể chứng minh bằng semantic matrix + historical reconstruction test rằng abstraction hoạt động đúng."**

---

## A.3 True Objective: Build Accounting Semantic Registry

### NOT Just "Read TT133 and TT99"

**Wrong Objective:**
```
❌ "Đọc TT133 và TT99 rồi tạo bảng mapping."
```

**Correct Objective:**
```
✅ "Xây Accounting Semantic Registry với semantic classification."
```

---

### Semantic Classification Framework

**For Each Account (e.g., TK 331):**

```
TT133
  Account 331
      ↓
  Semantic S1 (definition, normal balance, debit/credit meaning, recognition, presentation)

TT99
  Account 331
      ↓
  Semantic S1 / S2 / S3 ?
```

**Then Classify:**

| Classification | Definition | Example | Impact |
|----------------|------------|---------|--------|
| **IDENTICAL** | Semantic unchanged | TT133 TK 331 = TT99 TK 331 | Unified adapter |
| **EQUIVALENT** | Different wording, same meaning | Different description, same rule | Unified adapter, note variance |
| **MODIFIED** | Subtle semantic change | Recognition criteria slightly different | Regime-specific adapter |
| **SPLIT** | One account → multiple accounts | TK 111 → TK 111a, 111b | Complex mapping |
| **MERGED** | Multiple accounts → one account | TK 141a, 141b → TK 141 | Complex mapping |
| **NEW** | Account exists only in new regime | TK 999 (TT99 only) | New semantic entry |
| **DEPRECATED** | Account removed in new regime | TK 888 (TT133 only, removed in TT99) | Sunset strategy |

**This Classification → Regime Transition Engine Design**

---

## A.3 Deliverable: Semantic Matrix (NOT Prose Document)

### Semantic Matrix Format

**File:** `F5_6_A3_SEMANTIC_MATRIX.csv` (or structured format)

| Business Event | Regime | Account Code | Account Name | Semantic Class | Normal Balance | Debit Meaning | Credit Meaning | Recognition | Presentation | Effective From | Effective To | Source Authority |
|----------------|--------|--------------|--------------|----------------|----------------|---------------|----------------|-------------|--------------|----------------|--------------|------------------|
| Vendor prepayment | TT133-2016 | 331 | [TT133 name] | [Class] | CREDIT | Vendor advance | Vendor payable | [Rule] | [Line item] | 2016-01-01 | 2025-12-31 | TT133 Phụ lục II |
| Vendor prepayment | TT99-2025 | 331 | Phải trả cho người bán | IDENTICAL | CREDIT | Vendor advance | Vendor payable | [Rule] | Trả trước cho người bán | 2026-01-01 | NULL | TT99 Phụ lục II |
| Revenue recognition | TT133-2016 | 511 | [TT133 name] | [Class] | CREDIT | Revenue reduction | Revenue | [Rule] | [Line item] | 2016-01-01 | 2025-12-31 | TT133 Phụ lục II |
| Revenue recognition | TT99-2025 | 511 | [TT99 name] | [Class] | CREDIT | Revenue reduction | Revenue | [Rule] | [Line item] | 2026-01-01 | NULL | TT99 Phụ lục II |

**Critical Columns:**
- **Semantic Class:** IDENTICAL, EQUIVALENT, MODIFIED, SPLIT, MERGED, NEW, DEPRECATED
- **Effective From / To:** Regime effective dates
- **Source Authority:** Legal citation (TT133 Phụ lục II, TT99 Phụ lục II)

---

### Semantic Matrix → Schema Design

**Sequence:**

```
Step 1: Build Semantic Matrix (CSV/structured)
    ↓
Step 2: Analyze semantic classes
    ↓
Step 3: Design accounting_semantic_registry schema
    ↓
Step 4: Design Semantic Resolver logic
    ↓
Step 5: Design Posting Engine
```

**NOT:**
```
❌ Code schema immediately → Fill with data later
```

**WHY:**
> **"Sau khi matrix này đủ chắc: Semantic Model → Schema → Resolver → Posting Engine. Không làm ngược lại."**

---

## A.4 True Objective: Policy Taxonomy + Historical Proof

### A.4.1: Policy Taxonomy (NOT Rule Guessing)

**Must Define:**

```
Accounting Policy
├── Recognition (When to record transaction)
├── Measurement (How to value transaction)
├── Classification (Which account to use)
├── Posting (Debit/credit instruction)
├── Presentation (Balance sheet / P&L line item)
├── Closing (Period-end adjustments)
└── Transition (Regime/policy change handling)
```

**Then:**

```
Policy Domain (e.g., VENDOR_PREPAYMENT_POSTING)
    ↓
Policy Version (v1.0, v1.1, v1.2)
    ↓
Rule Version (within policy version)
    ↓
Effective Date (when rule applies)
```

**Example:**

```
Policy Domain: VENDOR_PREPAYMENT_POSTING
├── Version 1.0 (2026-01-01 to 2026-12-31)
│   ├── Recognition Rule: "When payment made before goods received"
│   ├── Posting Rule: "Debit 331, Credit 111/112/113"
│   └── Presentation Rule: "Trả trước cho người bán (Current Assets)"
│
└── Version 1.1 (2027-01-01 to NULL)
    ├── Recognition Rule: "When payment made before goods received" (unchanged)
    ├── Posting Rule: "Debit 142, Credit 111/112/113" (CHANGED)
    └── Presentation Rule: "Trả trước cho người bán (Current Assets)" (unchanged)
```

---

### A.4.2: Historical Proof (Most Critical)

**Must Prove:**
> **"Một rule mới có thể thay đổi cách hạch toán tương lai mà không rewrite historical ledger."**

**Proof Mechanism:**

```
Transaction (2026-05-15)
    ↓
Regime: TT99-2025 (at 2026-05-15)
    ↓
Policy: v1.0 (at 2026-05-15)
    ↓
Rule: "Debit 331, Credit 111" (from v1.0)
    ↓
Resolved Instruction (immutable)
    ↓
Journal Entry (immutable)
    ↓
Ledger (immutable)

(Later, 2027-01-01)
Policy v1.1 issued (Rule changed: "Debit 142, Credit 111")

(Query 2026 transaction in year 2031)
Transaction #12345 (2026-05-15)
    ↓
Regime: TT99-2025 (at posting time)
    ↓
Policy: v1.0 (at posting time)
    ↓
Rule: "Debit 331, Credit 111" (immutable snapshot)

Result: Returns TK 331 (NOT TK 142 from v1.1)
```

**Schema Must Support:**

```sql
CREATE TABLE finance_transactions (
  id UUID,
  posted_at TIMESTAMPTZ,
  
  -- Accounting context at posting time (IMMUTABLE)
  accounting_regime_code TEXT NOT NULL,
  accounting_policy_version TEXT NOT NULL,
  posting_rule_snapshot JSONB NOT NULL,
  
  -- Posting rule snapshot stores RESOLVED instruction at posting time
  -- NOT reference to current policy
  
  ...
);
```

---

## Don't Code Production Schema Yet

### Correct Sequence

```
Phase 1: Semantic Matrix (CSV/structured format)
    ↓
Phase 2: Analyze matrix → Semantic Model
    ↓
Phase 3: Design schema (conceptual)
    ↓
Phase 4: Prove with test data
    ↓
Phase 5: Architecture Review #2
    ↓
Phase 6: Code production schema
```

**NOT:**
```
❌ Code schema immediately → Fill later
```

**WHY:**
> **"Sau khi matrix này đủ chắc: Semantic Model → Schema → Resolver → Posting Engine."**

---

## Architecture Review #2: Historical Reconstruction Test

### Test Scenario: Timeline Simulation

**Simulate Timeline:**

```
2025
├── Regime: TT133-2016
├── Policy: v1.0
├── Rule: "Vendor prepayment → Debit TK 331 (TT133)"
└── Transaction T1 (2025-03-15)

2026
├── Regime: TT99-2025 (regime change)
├── Policy: v1.0
├── Rule: "Vendor prepayment → Debit TK 331 (TT99)"
└── Transaction T2 (2026-07-20)

2027
├── Regime: TT99-2025 (unchanged)
├── Policy: v1.1 (policy change)
├── Rule: "Vendor prepayment → Debit TK 142" (rule changed)
└── Transaction T3 (2027-11-10)

2030
├── Regime: TTXXX-2030 (hypothetical future regime)
├── Policy: v1.0
├── Rule: "Vendor prepayment → Debit TK 999" (new account)
└── Transaction T4 (2030-05-25)
```

---

### Test Question (CRITICAL)

**Question:**
> **"Transaction phát sinh năm 2025, 2026, 2027 có thể được reconstruct chính xác theo accounting context tại từng thời điểm không?"**

**Bella Must Answer:**

```sql
-- Query: Reconstruct accounting context for each transaction

SELECT
  t.id,
  t.posted_at,
  t.accounting_regime_code,
  t.accounting_policy_version,
  t.posting_rule_snapshot
FROM finance_transactions t
WHERE t.id IN ('T1', 'T2', 'T3', 'T4');

-- Expected Result:
-- T1 (2025-03-15) → TT133-2016 / v1.0 / Rule: Debit 331 (TT133)
-- T2 (2026-07-20) → TT99-2025  / v1.0 / Rule: Debit 331 (TT99)
-- T3 (2027-11-10) → TT99-2025  / v1.1 / Rule: Debit 142
-- T4 (2030-05-25) → TTXXX-2030 / v1.0 / Rule: Debit 999
```

**If Bella Can Answer Correctly:**
```
✅ WITHOUT modifying Ledger
✅ WITHOUT re-running with current policy
✅ Using historical accounting context
```

**Then:**
> **"Mình sẽ xem đây là bằng chứng rất mạnh rằng abstraction đã đúng."**

---

### Test Question #2: Policy Change Impact

**Question:**
> **"When policy changes from v1.0 → v1.1 in 2027, do historical transactions (2025, 2026) change their accounting context?"**

**Expected Answer:**
```
❌ NO

T1 (2025-03-15) → Still uses v1.0 / Debit 331 (TT133)
T2 (2026-07-20) → Still uses v1.0 / Debit 331 (TT99)
```

**If Historical Transactions Change:**
```
❌ ARCHITECTURAL FAILURE
```

**Why:**
> **"Một thay đổi rule trong tương lai không được làm thay đổi journal lịch sử."**

---

## A.3 Deliverables (NOT 50+ Pages of Prose)

### Required Deliverables

1. **`F5_6_A3_SEMANTIC_MATRIX.csv`** (or structured format)
   - Business events × Regimes × Accounts × Semantics
   - Semantic classification (IDENTICAL, EQUIVALENT, MODIFIED, etc.)
   - Effective dates
   - Source authorities

2. **`F5_6_A3_SEMANTIC_ANALYSIS.md`** (10-15 pages MAX)
   - Summary of semantic classifications
   - Key findings (IDENTICAL vs MODIFIED)
   - Regime transition implications
   - Schema design recommendations

3. **`F5_6_A3_SCHEMA_DESIGN.md`** (10-15 pages MAX)
   - `tenant_accounting_regimes` schema (detailed)
   - `accounting_semantic_registry` schema (detailed)
   - Regime resolution algorithm (pseudocode)

**Total:** 20-30 pages + semantic matrix

**NOT:**
```
❌ 50+ pages of prose repeating constitutional principles
```

---

## A.4 Deliverables (NOT 40+ Pages of Prose)

### Required Deliverables

1. **`F5_6_A4_POLICY_TAXONOMY.md`** (10-15 pages MAX)
   - Policy domain definitions
   - Policy vs Rule distinction
   - JSONB boundary specification
   - Policy version workflow

2. **`F5_6_A4_HISTORICAL_PROOF.md`** (10-15 pages MAX)
   - Transaction context schema design
   - Historical reconstruction algorithm (pseudocode)
   - Test scenario (timeline simulation)
   - Proof that rule change doesn't affect historical ledger

3. **`F5_6_A4_SCHEMA_DESIGN.md`** (10-15 pages MAX)
   - `accounting_policies` schema (detailed)
   - `finance_transactions` extensions (regime_code, policy_version, rule_snapshot)
   - Policy resolution algorithm (pseudocode)

**Total:** 30-45 pages + test scenarios

**NOT:**
```
❌ 40+ pages of prose repeating governance principles
```

---

## Success Criteria for Architecture Review #2

### NOT Documentation Volume

**Wrong Success Criteria:**
```
❌ A.3 document: 50+ pages ✓
❌ A.4 document: 40+ pages ✓
❌ Total: 90+ pages ✓
```

**Correct Success Criteria:**
```
✅ Semantic matrix complete (all business events classified)
✅ Historical reconstruction test PASSES
✅ Timeline simulation (2025 → 2030) correctly resolves accounting context
✅ Policy change v1.0 → v1.1 does NOT affect historical transactions
✅ Schema design supports immutable historical context
✅ JSONB boundary clearly defined
✅ Finance Kernel remains regime-agnostic
```

---

### Review #2 Test Checklist

**Human Architect Will Test:**

- [ ] **Semantic Matrix Complete:** All critical business events × regimes covered
- [ ] **Classification Valid:** IDENTICAL, EQUIVALENT, MODIFIED correctly assigned
- [ ] **Timeline Test:** 2025 → 2030 transactions resolve correctly
- [ ] **Historical Immutability:** Policy v1.1 does NOT change T1, T2 context
- [ ] **Schema Supports Proof:** `finance_transactions.posting_rule_snapshot` stores immutable context
- [ ] **JSONB Boundary Clear:** Configuration vs logic clearly separated
- [ ] **Finance Kernel Protected:** No regime/policy logic in kernel

**If ALL checked:**
- ✅ Approve A.3 + A.4
- ✅ UNBLOCK C.2

**If ANY unchecked:**
- ❌ Do NOT approve
- ❌ Iterate A.3 + A.4
- ❌ C.2 remains BLOCKED

---

## Status Matrix (Current)

| Component | Status | Gate | Next Action |
|-----------|--------|------|-------------|
| **F1-F4** | 🔒 FROZEN | N/A | None |
| **F5-S0.1** | 🟡 Needs Update | Minor | Fix date |
| **F5-S0.2** | ✅ APPROVED | Gate 1 ✅ | None |
| **F5-S0.3** | ✅ APPROVED | Gate 1 ✅ | None |
| **A.3** | 🟢 UNBLOCKED | Gate 2 🔴 | Build semantic matrix |
| **A.4** | 🟢 UNBLOCKED | Gate 2 🔴 | Design policy taxonomy + historical proof |
| **C.2-C.6** | 🔴 BLOCKED | Gate 2 🔴 | Await A.3 + A.4 + Review #2 |

---

## Final Assessment (Human Architect)

> **"Mình khá thích trạng thái hiện tại: F1–F4 đã đóng cửa. F5-S0 đã khóa kiến trúc. A.3/A.4 mở để nghiên cứu. C.2 vẫn bị khóa."**

> **"Đây là đúng kiểu 'architecture trước, code sau' mà một Finance OS dài hạn cần."**

---

## Key Principles for A.3 + A.4

### 1. Matrix > Prose
```
Semantic Matrix (structured data)
    >
50-page prose document
```

### 2. Proof > Description
```
Historical reconstruction test (passes)
    >
Describing how it "should" work
```

### 3. Classification > Assumption
```
Semantic Class: IDENTICAL / MODIFIED (proven)
    >
"They look similar" (assumed)
```

### 4. Schema Last, Not First
```
Semantic Model → Schema
    >
Schema → Fill with data
```

### 5. Test With Timeline
```
2025 → 2030 simulation (works)
    >
Single-point-in-time test
```

---

## Conclusion

**A.3 + A.4 Objective:**
> **Build Accounting Semantic Registry + Prove Historical Reproducibility**

**Success Criteria:**
> **Semantic matrix + Historical reconstruction test**

**NOT:**
> **52,000+ words of documentation**

**Why:**
> **"Nếu làm được điều đó, F5 mới thực sự có nền móng để đi vào C.2."**

---

**Next Phase:** A.3 + A.4 (5-10 days)  
**Deliverables:** Semantic matrix + Historical proof  
**Review #2:** Test with timeline simulation  
**Unblock C.2:** Only after Review #2 PASSES
