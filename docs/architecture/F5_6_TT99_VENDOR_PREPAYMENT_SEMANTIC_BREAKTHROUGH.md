# F5.6 TT99/2025 Breakthrough — Vendor Prepayment Semantic Confirmed

> **Date:** 2026-08-23  
> **Type:** TT99/2025 Direct Evidence Analysis  
> **Status:** ✅ C.1 VERIFIED — Account 331 semantic confirmed from TT99/2025 official guidance  
> **Source:** TT99/2025 Phụ lục — Nội dung và phương pháp kế toán TK 331

---

## Breakthrough Summary

**CONFIRMED FROM TT99/2025 OFFICIAL GUIDANCE:**

> **"Trong chi tiết từng đối tượng phải trả, TK 331 phản ánh cả số tiền đã ứng trước 
> cho người bán, người cung cấp, người nhận thầu nhưng chưa nhận được hàng hóa, dịch vụ..."**

> **"TK 331 có thể có số dư bên Nợ. Số dư Nợ phản ánh: số tiền đã ứng trước 
> cho người bán hoặc số tiền đã trả nhiều hơn số phải trả cho người bán 
> theo từng đối tượng."**

**Impact:** F5.6 Vendor Prepayment semantic is NOW VERIFIED from Vietnamese legal framework.

---

## TT99/2025 Evidence Analysis

### 1. Account 141 — Tạm ứng (Employee Advances ONLY)

**TT99/2025 Specification:**
- **Purpose:** Tạm ứng cho **người lao động** của doanh nghiệp
- **Scope:** Internal employee advance relationships
- **NOT** for vendor prepayments

**Accounting Treatment:**
```
Enterprise advances to employee:
Nợ  141 Tạm ứng
    Có  111, 112 Tiền mặt/Tiền gửi

Employee settles with receipts:
Nợ  152, 153, 156, 241, 331, 621, 623, 627, 642, ...
    Có  141 Tạm ứng
```

**F5.6 Implication:**
- ❌ TK 141 is NOT for vendor prepayments
- ❌ F5.6 does NOT use TK 141
- ✅ TK 141 is different domain (employee/internal advances)

---

### 2. Account 331 — Phải trả cho người bán (INCLUDING Vendor Advances)

**TT99/2025 Critical Specification:**

**Account Purpose:**
> "TK 331 phản ánh công nợ với người bán, nhà cung cấp, nhà thầu"

**Detailed Tracking:**
> "Trong chi tiết từng đối tượng phải trả, TK 331 phản ánh cả **số tiền đã ứng trước** 
> cho người bán, người cung cấp, người nhận thầu nhưng chưa nhận được hàng hóa, dịch vụ..."

**Debit Side of TK 331:**
1. Số tiền đã trả nợ cho người bán
2. **Số tiền ứng trước cho người bán, người cung cấp, người nhận thầu**

**Credit Side of TK 331:**
1. Giá mua hàng hóa, dịch vụ
2. Các khoản phải trả khác

**Balance Specification:**

**Credit balance (normal):**
> "Số tiền còn phải trả cho người bán, nhà cung cấp theo từng đối tượng"

**Debit balance (vendor advance):**
> "TK 331 có thể có số dư bên Nợ. Số dư Nợ phản ánh: **số tiền đã ứng trước 
> cho người bán** hoặc số tiền đã trả nhiều hơn số phải trả cho người bán 
> theo từng đối tượng."

**Detailed Ledger Requirement:**
> "TK 331 được theo dõi **chi tiết theo từng đối tượng người bán**"

---

### 3. Financial Statement Presentation (TT99/2025)

**Balance Sheet Specification:**

**Chỉ tiêu: "Trả trước cho người bán ngắn hạn"**
- **Location:** TÀI SẢN (Current Assets section)
- **Source:** **Tổng số dư Nợ chi tiết của TK 331** mở theo từng người bán

**Critical Insight:**
```
TK 331 = Liability account (Phải trả)
         │
         ├── Credit balance → Phía NỢ PHẢI TRẢ (Liabilities)
         │
         └── Debit balance  → Phía TÀI SẢN (Assets)
                                │
                                ▼
                   "Trả trước cho người bán ngắn hạn"
```

**This confirms:**
- Vendor prepayment (số dư Nợ của TK 331) appears as **Current Asset**
- NOT a separate account 141 (employee advances)
- Presentation: "Trả trước cho người bán" line item

---

### 4. Detailed Vendor Ledger (TT99/2025 Requirement)

**TT99/2025 Requirement:**
Sổ chi tiết thanh toán với người bán (per TK 331)

**Ledger Structure:**
```
┌────────────────────────────────────┐
│  Sổ Chi Tiết TK 331 — Per Vendor  │
├────────────────────────────────────┤
│                                    │
│  Vendor ID: [Vendor Name]          │
│                                    │
│  Số phát sinh Nợ:                  │
│    - Tiền ứng trước                │
│    - Tiền trả nợ                   │
│                                    │
│  Số phát sinh Có:                  │
│    - Giá mua hàng hóa              │
│    - Các khoản phải trả khác       │
│                                    │
│  Số dư:                            │
│    - Số dư Nợ (advance)            │
│    - Số dư Có (payable)            │
│                                    │
└────────────────────────────────────┘
```

**F4 Architecture Alignment:**
```
F4 finance_vendor_prepayments:
    vendor_id + fact_type + amount_minor
              ↓
TK 331 movements (Nợ/Có) per vendor
              ↓
Số dư Nợ/Có per vendor
              ↓
F5 reconciliation
```

---

## F5.6 Semantic Confirmation

### GL Account Mapping

**VERIFIED:**
- **GL Account:** 331 Phải trả cho người bán
- **Semantic:** Debit balance per vendor = vendor advance
- **Source:** TT99/2025 Phụ lục — Nội dung và phương pháp kế toán TK 331

### Reconstruction Formula

**Formula:**
```sql
vendor_prepayment_balance_per_vendor = SUM(
  CASE fact_type
    WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- Nợ 331
    WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor  -- Có 331
    WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- Có 331
  END
)
```

**What This Reconstructs:**
- **Số dư Nợ của TK 331** (Debit balance of TK 331)
- Per vendor (theo từng đối tượng người bán)
- Matches TT99/2025 semantic exactly

**Example (Per TT99/2025):**

**Day 1: Enterprise pays 100M advance**
```
Nợ  331    100,000,000
    Có 112             100,000,000
```
F4: `PREPAYMENT_RECORDED +100M`  
TK 331 Debit balance: **100M** (vendor advance)

**Day 10: Vendor delivers, invoice received**
```
Nợ  156    100,000,000
    Có 331             100,000,000
```
F4: `PREPAYMENT_APPLIED -100M`  
TK 331 Debit balance: **0** (advance cleared)

**Refund scenario:**
```
Nợ  112     30,000,000
    Có 331              30,000,000
```
F4: `PREPAYMENT_REFUNDED -30M`  
TK 331 Debit balance reduced

---

## 141 vs 331 Distinction (TT99/2025 Confirmed)

| Aspect | TK 141 (Tạm ứng) | TK 331 (Phải trả NB) |
|--------|------------------|----------------------|
| **Purpose** | Tạm ứng người lao động | Công nợ + ứng trước vendor |
| **Counterparty** | Internal employee | External vendor |
| **Debit Entry** | Employee advance | Vendor advance + payment |
| **Credit Entry** | Settlement with receipts | Vendor invoice |
| **Balance Type** | Asset (Debit-normal) | Liability (Credit-normal)<br>with possible Debit balance |
| **F5.6 Scope** | ❌ NOT in F5.6 | ✅ F5.6 Prepayment |
| **TT99 Source** | Phụ lục — TK 141 | Phụ lục — TK 331 |

---

## Research Progress Update

### Part C.1 — VERIFIED ✅

**Question:** Which GL account for vendor prepayments?

**Answer:** **TK 331 Phải trả cho người bán** (VERIFIED from TT99/2025)

**Evidence:**
1. ✅ TT99/2025 explicitly states TK 331 tracks vendor advances
2. ✅ TT99/2025 confirms TK 331 can have Debit balance (vendor advance)
3. ✅ TT99/2025 requires detailed tracking per vendor
4. ✅ TT99/2025 Balance Sheet presentation: "Trả trước cho người bán" from TK 331 Debit balance
5. ✅ TK 141 confirmed as employee advances ONLY (NOT vendor)

**Status:** ✅ **GREEN** — C.1 verified with TT99/2025 legal basis

### Parts C.2-C.6 — Still Pending

**C.2: VAS Treatment**
- ❌ Still requires VAS access for debit/credit conventions
- ⚠️ TT99/2025 provides accounting treatment, but VAS may have additional guidance

**C.3: Bella F1 COA Mapping**
- ❌ Requires Bella code review
- ⚠️ Need to verify `finance_vendor_prepayments` → F1 posts to TK 331

**C.4: F4 Contract Alignment**
- ❌ Requires F4 contract + TT99 semantic comparison
- ⚠️ Verify F4 fact types align with TT99 Nợ/Có conventions

**C.5: Reconstruction Formula**
- ✅ Formula logic confirmed (reconstructs Debit balance)
- ⚠️ Still need VAS verification of debit/credit semantics

**C.6: Temporal Boundary**
- ❌ Requires TT99 period closing rules
- ❌ Requires F4 contract temporal column verification

---

## Impact on F5.6 Implementation

### Semantic Decisions NOW CLEAR

**GL Account:**
- ✅ Account: **331 Phải trả cho người bán**
- ✅ NOT 141 (employee advances)
- ✅ NOT 142 (does not exist in TT99/2025 Phụ lục II)

**Reconstruction Semantic:**
- ✅ Reconstruct: **Debit balance of TK 331 per vendor**
- ✅ Formula: RECORDED (+) - APPLIED (-) - REFUNDED (-)
- ✅ Matches: TT99/2025 "số dư Nợ của TK 331"

**Balance Sheet Presentation:**
- ✅ Line item: "Trả trước cho người bán ngắn hạn"
- ✅ Location: TÀI SẢN (Current Assets)
- ✅ Source: Số dư Nợ của TK 331 theo từng vendor

### Blockers Resolved

**BEFORE:**
```
❌ "Prepayment GL account decision — 141 vs 331?"
   (Treated as architectural choice)
```

**AFTER:**
```
✅ "Vendor prepayment uses TK 331" (VERIFIED from TT99/2025)
   (Not a choice, confirmed by Vietnamese legal framework)
```

### Remaining Verification

**Still need:**
1. VAS guidance on vendor advance conventions (C.2)
2. Bella F1 COA verification (C.3)
3. F4 contract alignment verification (C.4)
4. Temporal boundary specification (C.6)

**But fundamental semantic question is RESOLVED:**
- Account 331 (confirmed)
- Debit balance semantic (confirmed)
- Per-vendor tracking (confirmed)
- Balance Sheet presentation (confirmed)

---

## Architectural Significance

### Why This Matters

**If we had used TK 141:**
- ❌ Wrong account (employee advances, not vendor)
- ❌ Violates TT99/2025 accounting treatment
- ❌ Fails audit (vendor advances not properly tracked)
- ❌ Wrong Balance Sheet presentation

**With TK 331 (confirmed):**
- ✅ Correct account per TT99/2025
- ✅ Vendor prepayment integrated with vendor relationship
- ✅ Audit compliant (detailed vendor tracking)
- ✅ Correct Balance Sheet presentation

### F5-S0 Constitutional Compliance

**F5-S0 requires:**
> "F5 reconciliation semantics SHALL be derived from Vietnamese accounting 
> legal framework. AI SHALL NOT invent accounting treatment."

**This breakthrough demonstrates:**
- ✅ Semantic derived from **TT99/2025 official guidance** (not AI assumption)
- ✅ Account 331 confirmed with **direct quotes** from TT99/2025
- ✅ Debit balance semantic confirmed with **official text**
- ✅ Human Architect provided TT99/2025 document and interpretation
- ✅ F5-S0 authority hierarchy respected

---

## Vietnamese Accounting Architecture

```
              VIETNAMESE ACCOUNTING LAW
                       │
                       ▼
                  TT99/2025
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   TK 141 (Tạm ứng)           TK 331 (Phải trả NB)
   Employee advances          Vendor relationships
        │                             │
        │                    ┌────────┴────────┐
        │                    ▼                 ▼
        │              Credit balance     Debit balance
        │              (Payable)          (Advance)
        │                                      │
        │                                      ▼
        │                         "Trả trước cho người bán"
        │                          (Current Asset on BS)
        │                                      │
        ▼                                      ▼
  (NOT F5.6)                          F5.6 PREPAYMENT_GL_BALANCE
                                       (Reconstructs Debit balance
                                        of TK 331 per vendor)
```

---

## Conclusion

**F5.6 Vendor Prepayment Semantic is NOW VERIFIED:**

✅ **TT99/2025 Source:** Phụ lục — Nội dung và phương pháp kế toán TK 331

✅ **GL Account:** 331 Phải trả cho người bán

✅ **Semantic:** Debit balance per vendor (số dư Nợ theo từng đối tượng người bán)

✅ **Reconstruction:** F4 facts → Debit/Credit movements → Debit balance

✅ **Presentation:** "Trả trước cho người bán ngắn hạn" (Current Assets)

✅ **Detailed Tracking:** Per vendor (TT99/2025 requirement)

**Research Item C.1:** ✅ **GREEN** (TT99/2025 verified)

**Remaining Items:** C.2-C.6 (VAS, Bella, F4 alignment, temporal)

**Critical Path Unblocked:** Fundamental semantic question resolved from legal framework

---

**Verified By:** Human Architect (TT99/2025 official document analysis)  
**Date:** 2026-08-23  
**Status:** ✅ C.1 VERIFIED — Account 331 semantic confirmed

