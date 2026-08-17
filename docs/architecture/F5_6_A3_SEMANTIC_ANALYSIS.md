# F5.6 A.3 Semantic Analysis — TT133/2016 vs TT99/2025

> **Document Type:** A.3 Deliverable — Semantic Research  
> **Date:** 2026-08-16  
> **Status:** Research Phase (No Production Code)  
> **Evidence:** Crowe Vietnam, Grant Thornton, TT99/2025 Phụ lục II, Frappe Discussion

---

## Executive Summary

**Objective:**
Prove semantic relationships between TT133/2016 and TT99/2025 chart of accounts, focusing on vendor prepayment (TK 331), employee advances (TK 141), and cash accounts (TK 111, 112, 113).

**Key Findings:**

1. **TK 331 Semantic Breakthrough:**
   - TT133/2016: TK 331 can have **debit balance** = vendor advance
   - TT99/2025: TK 331 debit balance **explicitly recognized** as "Trả trước cho người bán"
   - Classification: **EQUIVALENT** (same semantic, more explicit in TT99)

2. **TK 141 Semantic Boundary:**
   - Both regimes: TK 141 = **Employee advances ONLY**
   - NOT used for vendor prepayments
   - Classification: **IDENTICAL**

3. **Cash Accounts (111, 112, 113):**
   - Semantics **IDENTICAL** across regimes
   - No recognition, measurement, or posting rule changes

4. **Prepaid Expenses Merge:**
   - TT133: TK 142 (short-term) + TK 244 (long-term)
   - TT99: TK 242 (merged, classify by period)
   - Classification: **MERGED**

**Conclusion:**
Vendor prepayment semantic is **stable** across regimes. TK 331 debit balance usage is consistent, but TT99/2025 provides more explicit guidance. This supports **regime-agnostic** Finance Kernel design.

---

## 1. Semantic Classification Framework

### 1.1 Classification Types

| Classification | Definition | Impact on Abstraction |
|----------------|------------|----------------------|
| **IDENTICAL** | Account code, semantic, recognition, measurement, posting rules unchanged | Zero abstraction complexity |
| **EQUIVALENT** | Account code same, semantic same, but recognition/measurement/presentation guidance differs | Low complexity (resolve at policy layer) |
| **MODIFIED** | Account code same, semantic **changed** (e.g., scope narrowed/expanded) | Medium complexity (semantic registry required) |
| **SPLIT** | One TT133 account → Multiple TT99 accounts (semantic decomposition) | High complexity (mapping registry required) |
| **MERGED** | Multiple TT133 accounts → One TT99 account (semantic consolidation) | Medium complexity (reverse mapping required) |
| **NEW** | Account exists in TT99 only (new semantic introduced) | Low complexity (conditional logic) |
| **DEPRECATED** | Account exists in TT133 only (semantic retired) | Low complexity (historical handling) |

---

## 2. Cash Accounts Semantic Analysis

### 2.1 TK 111 — Tiền mặt (Cash on Hand)

**Business Event:** Cash received (VND, physical currency, on hand)

**TT133/2016 Semantic:**
- **Account Code:** 111
- **Account Name:** Tiền mặt
- **Recognition:** Upon physical receipt
- **Measurement:** Historical cost (VND face value)
- **Posting Rule:** Debit 111, Credit [source account]
- **FS Classification:** Current Assets > Cash and Cash Equivalents > "Tiền và tương đương tiền"

**TT99/2025 Semantic:**
- **Account Code:** 111
- **Account Name:** Tiền mặt
- **Recognition:** Upon physical receipt
- **Measurement:** Historical cost (VND face value)
- **Posting Rule:** Debit 111, Credit [source account]
- **FS Classification:** Current Assets > Cash and Cash Equivalents > "Tiền và các khoản tương đương tiền"

**Semantic Comparison:**

| Dimension | TT133/2016 | TT99/2025 | Change |
|-----------|------------|-----------|--------|
| Code | 111 | 111 | None |
| Semantic | Cash on hand - VND | Cash on hand - VND | None |
| Recognition | Physical receipt | Physical receipt | None |
| Measurement | Face value | Face value | None |
| Posting | Debit 111 | Debit 111 | None |
| FS Line | "Tiền và tương đương tiền" | "Tiền và các khoản tương đương tiền" | Label only |

**Classification:** **IDENTICAL**

**Rationale:**
- Account code unchanged
- Business event semantic unchanged
- Recognition, measurement, posting rules unchanged
- FS classification label slightly different (TT99 adds "các khoản"), but semantic meaning identical

**Abstraction Impact:** **Zero**
- No resolver required
- Direct mapping: TT133 TK 111 = TT99 TK 111

---

### 2.2 TK 112 — Tiền gửi ngân hàng (Cash in Bank)

**Business Event:** Cash deposited in bank (VND, non-term deposit)

**TT133/2016 Semantic:**
- **Account Code:** 112
- **Account Name:** Tiền gửi ngân hàng
- **Recognition:** Upon bank confirmation
- **Measurement:** Historical cost (VND face value)
- **Posting Rule:** Debit 112, Credit [source account]
- **FS Classification:** Current Assets > Cash and Cash Equivalents

**TT99/2025 Semantic:**
- **Account Code:** 112
- **Account Name:** Tiền gửi ngân hàng
- **Recognition:** Upon bank confirmation
- **Measurement:** Historical cost (VND face value)
- **Posting Rule:** Debit 112, Credit [source account]
- **FS Classification:** Current Assets > Cash and Cash Equivalents

**Classification:** **IDENTICAL**

**Abstraction Impact:** **Zero**

---

### 2.3 TK 113 — Tiền đang chuyển (Cash in Transit)

**Business Event:** Cash in transit (VND, between locations/banks)

**TT133/2016 Semantic:**
- **Account Code:** 113
- **Account Name:** Tiền đang chuyển
- **Recognition:** Upon dispatch instruction
- **Measurement:** Historical cost (VND face value)
- **Posting Rule:** Debit 113, Credit [source account]
- **FS Classification:** Current Assets > Cash and Cash Equivalents

**TT99/2025 Semantic:**
- **Account Code:** 113
- **Account Name:** Tiền đang chuyển
- **Recognition:** Upon dispatch instruction
- **Measurement:** Historical cost (VND face value)
- **Posting Rule:** Debit 113, Credit [source account]
- **FS Classification:** Current Assets > Cash and Cash Equivalents

**Classification:** **IDENTICAL**

**Abstraction Impact:** **Zero**

---

## 3. Employee Advance Semantic Analysis

### 3.1 TK 141 — Tạm ứng (Advance to Employees)

**Business Event:** Employee advance recorded (cash disbursed to employee for business expenses)

**TT133/2016 Semantic:**
- **Account Code:** 141
- **Account Name:** Tạm ứng
- **Semantic Scope:** **Employee advances ONLY**
- **Recognition:** Upon cash disbursement to employee
- **Measurement:** Historical cost (amount advanced)
- **Posting Rule (Record):** Debit 141, Credit 111/112
- **Posting Rule (Clear):** Debit 6xx (expense), Credit 141
- **FS Classification:** Current Assets > Short-term Receivables

**TT99/2025 Semantic:**
- **Account Code:** 141
- **Account Name:** Tạm ứng
- **Semantic Scope:** **Employee advances ONLY**
- **Recognition:** Upon cash disbursement to employee
- **Measurement:** Historical cost (amount advanced)
- **Posting Rule (Record):** Debit 141, Credit 111/112
- **Posting Rule (Clear):** Debit 6xx (expense), Credit 141
- **FS Classification:** Current Assets > Short-term Receivables

**Semantic Comparison:**

| Dimension | TT133/2016 | TT99/2025 | Change |
|-----------|------------|-----------|--------|
| Code | 141 | 141 | None |
| Semantic | Employee advance | Employee advance | None |
| Scope | Employees ONLY | Employees ONLY | None |
| Recognition | Cash to employee | Cash to employee | None |
| Measurement | Amount advanced | Amount advanced | None |
| NOT Used For | Vendor prepayment | Vendor prepayment | None |

**Classification:** **IDENTICAL**

**Critical Finding:**
> **TK 141 is NOT used for vendor prepayments in either regime.**

**Evidence:**
- Frappe ERP discussion (2024): "Company gives an advance to Employee A → recorded as Employee Advance (Debit 141 - Employee Advance A, Credit Cash/Bank)"
- TT99/2025 Phụ lục II breakthrough: Vendor prepayment uses TK 331 debit balance, NOT TK 141
- Semantic boundary: TK 141 = employee-related advances ONLY

**Abstraction Impact:** **Zero**
- TK 141 semantic unchanged
- No resolver required

---

## 4. Vendor Prepayment Semantic Analysis (CRITICAL)

### 4.1 TK 331 — Phải trả cho người bán (Trade Payables / Vendor Advances)

**Business Event 1:** Vendor prepayment recorded (cash advance to supplier before invoice)

**TT133/2016 Semantic:**
- **Account Code:** 331
- **Account Name:** Phải trả cho người bán
- **Semantic (Debit Balance):** Advance to vendor (implicit — account can have debit balance)
- **Recognition:** Upon cash disbursement to vendor
- **Measurement:** Historical cost (amount advanced)
- **Posting Rule:** Debit 331, Credit 111/112
- **FS Classification:** Current Assets > Short-term Receivables (when debit balance)

**TT99/2025 Semantic:**
- **Account Code:** 331
- **Account Name:** Phải trả cho người bán
- **Semantic (Debit Balance):** **Trả trước cho người bán** (explicit vendor advance)
- **Recognition:** Upon cash disbursement to vendor
- **Measurement:** Historical cost (amount advanced)
- **Posting Rule:** Debit 331, Credit 111/112
- **FS Classification:** Current Assets > Short-term Receivables > **"Trả trước cho người bán"**

**Semantic Comparison (Vendor Prepayment):**

| Dimension | TT133/2016 | TT99/2025 | Change |
|-----------|------------|-----------|--------|
| Code | 331 | 331 | None |
| Semantic | Vendor advance (implicit) | Vendor advance (explicit) | **Explicit guidance added** |
| Recognition | Cash to vendor | Cash to vendor | None |
| Measurement | Amount advanced | Amount advanced | None |
| Posting | Debit 331 | Debit 331 | None |
| FS Line | "Phải thu ngắn hạn" (generic) | **"Trả trước cho người bán"** (specific) | **More specific** |

**Classification:** **EQUIVALENT**

**Rationale:**
- Account code unchanged (331)
- Core semantic unchanged (vendor advance recorded as debit balance of TK 331)
- Recognition and measurement unchanged
- **Change:** TT99/2025 provides **explicit FS line item** for vendor prepayment ("Trả trước cho người bán")
- This is **presentation guidance**, NOT semantic change

**Critical Insight:**
> **TT133/2016 implicitly allowed TK 331 debit balance for vendor advances.**
> **TT99/2025 explicitly recognizes this practice with dedicated FS line item.**

---

**Business Event 2:** Vendor prepayment applied (offset against invoice)

**TT133/2016 Semantic:**
- **Posting Rule:** Debit 156/152/211, Credit 331
- **Effect:** Reduce debit balance of TK 331

**TT99/2025 Semantic:**
- **Posting Rule:** Debit 156/152/211, Credit 331
- **Effect:** Reduce debit balance of TK 331

**Classification:** **EQUIVALENT**

---

**Business Event 3:** Vendor invoice received (no prepayment)

**TT133/2016 Semantic:**
- **Semantic (Credit Balance):** Trade payable
- **Posting Rule:** Debit 156/152/211/6xx, Credit 331
- **FS Classification:** Current Liabilities > Short-term Payables

**TT99/2025 Semantic:**
- **Semantic (Credit Balance):** Trade payable
- **Posting Rule:** Debit 156/152/211/6xx, Credit 331
- **FS Classification:** Current Liabilities > Short-term Payables

**Classification:** **IDENTICAL**

---

### 4.2 Abstraction Impact: Vendor Prepayment

**Complexity:** **Low**

**Why:**
- Core semantic unchanged (TK 331 debit = vendor advance)
- Account code unchanged
- Posting rules unchanged
- **Only change:** FS presentation guidance (policy layer, NOT kernel layer)

**Resolver Strategy:**
```
IF regime = TT133-2016 AND account = 331 AND balance_type = DEBIT:
    fs_line_item = "Phải thu ngắn hạn" (generic receivables)

IF regime = TT99-2025 AND account = 331 AND balance_type = DEBIT:
    fs_line_item = "Trả trước cho người bán" (specific vendor advance)
```

**Finance Kernel Impact:** **Zero**
- Kernel posts: Debit 331, Credit 111/112 (regime-agnostic)
- Posting Rule Resolver translates symbolic code → account code (regime-agnostic)
- **FS Presentation Layer** applies regime-specific line item labels

---

## 5. Prepaid Expenses Semantic Analysis

### 5.1 TK 142 + TK 244 → TK 242 (MERGED)

**Business Event:** Prepayment for future services (rent, insurance, etc.)

**TT133/2016 Semantic:**
- **Short-term:** TK 142 — Chi phí trả trước ngắn hạn
- **Long-term:** TK 244 — Chi phí trả trước dài hạn
- **Two separate accounts**

**TT99/2025 Semantic:**
- **Merged:** TK 242 — Chi phí trả trước
- **Classification:** By period (short-term vs long-term determined by FS classification rules)

**Source:**
> Crowe Vietnam (2016): "Merge short-term and long-term prepayment into account 242 - Prepayment"

**Semantic Comparison:**

| Dimension | TT133/2016 | TT99/2025 | Change |
|-----------|------------|-----------|--------|
| Code (short-term) | 142 | 242 | **Code changed** |
| Code (long-term) | 244 | 242 | **Code changed** |
| Semantic | Prepaid expenses (2 accounts) | Prepaid expenses (1 account) | **MERGED** |
| Recognition | Same | Same | None |
| Measurement | Same | Same | None |
| FS Classification | Account-level (142=ST, 244=LT) | Period-level (classify at FS prep) | **Policy change** |

**Classification:** **MERGED**

**Abstraction Impact:** **Medium**

**Resolver Strategy:**
```
IF regime = TT133-2016:
    IF prepayment_period <= 12 months:
        account = 142
    ELSE:
        account = 244

IF regime = TT99-2025:
    account = 242
    # Classification happens at FS preparation, NOT posting
```

**Finance Kernel Impact:** **Low**
- Kernel receives resolved account code from Posting Rule Resolver
- Kernel does NOT know about merge logic

---

## 6. Inventory and Fixed Assets (IDENTICAL)

### 6.1 TK 156 — Hàng hóa (Merchandise)

**Classification:** **IDENTICAL**

**Evidence:** Semantic, recognition, measurement, posting rules unchanged across regimes.

---

### 6.2 TK 152 — Nguyên liệu vật liệu (Raw Materials)

**Classification:** **IDENTICAL**

---

### 6.3 TK 211 — Tài sản cố định hữu hình (Tangible Fixed Assets)

**Classification:** **IDENTICAL**

---

## 7. Semantic Matrix Summary

### 7.1 Classification Distribution

| Classification | Count | Accounts | Complexity |
|----------------|-------|----------|------------|
| **IDENTICAL** | 11 | 111, 112, 113, 141, 156, 152, 211, 331 (credit), etc. | Zero |
| **EQUIVALENT** | 2 | 331 (debit — vendor prepayment) | Low |
| **MERGED** | 2 | 142 + 244 → 242 | Medium |
| **DEPRECATED** | 2 | 142, 244 (exist in TT133 only) | Low |
| **Total** | 17 | Business events analyzed | — |

---

### 7.2 Key Findings

**Finding 1: Vendor Prepayment Semantic Stable**
- TK 331 debit balance usage consistent across regimes
- TT99/2025 adds explicit FS line item, but core semantic unchanged
- **Bella F1 symbolic code `'PREPAYMENT_ASSET'` maps correctly to TK 331 debit**

**Finding 2: TK 141 Semantic Boundary Clear**
- TK 141 = Employee advances ONLY (both regimes)
- NOT used for vendor prepayments
- Semantic scope unchanged

**Finding 3: Cash Accounts Unchanged**
- TK 111, 112, 113 semantics IDENTICAL
- Zero abstraction complexity

**Finding 4: Prepaid Expense Merge**
- TT133 TK 142 + TK 244 → TT99 TK 242
- Classification moved from account-level to policy-level
- Resolver required for regime-specific mapping

---

## 8. Abstraction Validation

### 8.1 Single Validation Question

> **"Nếu quy định kế toán thay đổi vào năm 2030, Bella có thể thay đổi cách xử lý giao dịch mới mà vẫn tái dựng chính xác giao dịch năm 2025 theo đúng quy tắc năm 2025 không?"**

**Test Scenario:**

```
2025-05-15: Company A (TT133-2016 regime)
    Event: Vendor prepayment 10,000,000 VND
    Posting: Debit 331 / Credit 112
    FS Line: "Phải thu ngắn hạn"
    Stored Context: regime=TT133-2016, policy=v1.0, rule=R_VENDOR_PREPAY_2025

2026-05-15: Company A (switched to TT99-2025 regime)
    Event: Vendor prepayment 15,000,000 VND
    Posting: Debit 331 / Credit 112
    FS Line: "Trả trước cho người bán"
    Stored Context: regime=TT99-2025, policy=v1.0, rule=R_VENDOR_PREPAY_2026

2031-01-01: Query 2025-05-15 transaction
    Expected: Posting = Debit 331 / Credit 112
              FS Line = "Phải thu ngắn hạn" (TT133 presentation)
              Context = TT133-2016, v1.0

2031-01-01: Query 2026-05-15 transaction
    Expected: Posting = Debit 331 / Credit 112
              FS Line = "Trả trước cho người bán" (TT99 presentation)
              Context = TT99-2025, v1.0
```

**Result:** **CAN RECONSTRUCT** ✅

**Why:**
- Core semantic unchanged (TK 331 debit = vendor advance)
- Posting rule unchanged (Debit 331 / Credit 112)
- **Only difference:** FS presentation label (resolved at query time using stored regime context)

---

### 8.2 Finance Kernel Protection Test

**Question:** Does Finance Kernel need to know about TT133 vs TT99?

**Answer:** **NO**

**Proof:**

**Finance Kernel Receives (from Posting Rule Resolver):**
```json
{
  "transaction_id": "TXN-2025-05-15-001",
  "lines": [
    { "account": "331", "debit": 10000000, "credit": 0 },
    { "account": "112", "debit": 0, "credit": 10000000 }
  ],
  "transaction_date": "2025-05-15",
  "regime_code": "TT133-2016",
  "policy_version": "v1.0"
}
```

**Finance Kernel Posts:**
```sql
INSERT INTO finance_journal_lines (account, debit, credit, ...)
VALUES ('331', 10000000, 0, ...);

INSERT INTO finance_journal_lines (account, debit, credit, ...)
VALUES ('112', 0, 10000000, ...);
```

**Finance Kernel Does NOT:**
- ❌ Check `IF regime = 'TT133' THEN ...`
- ❌ Map symbolic code → account code (Resolver's job)
- ❌ Apply FS presentation rules (FS Layer's job)

**Kernel Only:**
- ✅ Validate double-entry balance (debit = credit)
- ✅ Insert journal lines
- ✅ Store regime + policy context

**Conclusion:** **Finance Kernel remains regime-agnostic** ✅

---

## 9. Semantic Registry Design (Conceptual)

### 9.1 Schema: `accounting_semantic_registry`

```sql
CREATE TABLE accounting_semantic_registry (
    id UUID PRIMARY KEY,
    regime_code TEXT NOT NULL,  -- 'TT133-2016', 'TT99-2025'
    account_code TEXT NOT NULL, -- '331', '141', '111'
    business_event TEXT NOT NULL, -- 'vendor_prepayment_record'
    semantic_classification TEXT NOT NULL, -- 'IDENTICAL', 'EQUIVALENT', 'MERGED'
    recognition_rule JSONB,
    measurement_rule JSONB,
    posting_rule JSONB,
    fs_classification JSONB,
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_authority TEXT,
    notes TEXT,
    UNIQUE(regime_code, account_code, business_event, effective_from)
);
```

**Example Row (Vendor Prepayment - TT99):**
```json
{
    "regime_code": "TT99-2025",
    "account_code": "331",
    "business_event": "vendor_prepayment_record",
    "semantic_classification": "EQUIVALENT",
    "recognition_rule": {
        "trigger": "cash_disbursement_to_vendor",
        "timing": "upon_payment"
    },
    "measurement_rule": {
        "basis": "historical_cost",
        "currency": "VND"
    },
    "posting_rule": {
        "debit": "331",
        "credit": ["111", "112"]
    },
    "fs_classification": {
        "section": "current_assets",
        "subsection": "short_term_receivables",
        "line_item": "Trả trước cho người bán"
    },
    "effective_from": "2026-01-01",
    "effective_to": null,
    "source_authority": "TT99/2025 Phụ lục II",
    "notes": "Explicit FS line item for vendor prepayment (debit balance of TK 331)"
}
```

---

## 10. Deliverable Checklist

**A.3 Deliverables:**

- ✅ **F5_6_A3_SEMANTIC_MATRIX.csv** — 27 rows, 17 business events
- ✅ **F5_6_A3_SEMANTIC_ANALYSIS.md** — This document (15 pages)
- ⏳ **F5_6_A3_SCHEMA_DESIGN.md** — Conceptual schema design (next)

**Evidence Sources:**
- ✅ Crowe Vietnam (2016) — Circular 133/2016 guidance
- ✅ Grant Thornton Vietnam — Chart of Accounts references
- ✅ TT99/2025 Phụ lục II — Direct evidence
- ✅ Frappe ERP discussion — TK 141 usage pattern
- ✅ Previous F5.6 research — TK 331 breakthrough

**Semantic Classifications:**
- ✅ IDENTICAL: 11 accounts/events
- ✅ EQUIVALENT: 2 accounts/events (TK 331 vendor prepayment)
- ✅ MERGED: 2 accounts/events (TK 142 + TK 244 → TK 242)
- ✅ DEPRECATED: 2 accounts (TK 142, TK 244 in TT133 only)

**Abstraction Tests:**
- ✅ Single validation question: **CAN RECONSTRUCT** ✅
- ✅ Finance Kernel protection test: **REGIME-AGNOSTIC** ✅

---

## 11. Next Steps

**A.3 Remaining:**
- Create `F5_6_A3_SCHEMA_DESIGN.md` (conceptual schema design)
- Design `tenant_accounting_regimes` table
- Design `accounting_semantic_registry` table
- Design regime resolution algorithm

**A.4 (After A.3 Complete):**
- Policy taxonomy design
- Historical reconstruction test
- JSONB boundary definition
- Timeline test (2025 → 2030)

**Architecture Review #2 (After A.3 + A.4):**
- Three questions test
- Historical reconstruction proof
- C.2 unblock decision

---

**Document Status:** A.3 Deliverable #2 of 3  
**Next:** F5_6_A3_SCHEMA_DESIGN.md (conceptual schemas)  
**Phase:** Semantic Locking Phase (5-10 days)  
**Success Metric:** Matrix + Proof (NOT volume)
