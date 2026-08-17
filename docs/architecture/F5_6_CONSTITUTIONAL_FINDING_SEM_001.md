# F5.6 Constitutional Finding SEM-001 — Vendor Prepayment Semantic

> **Finding ID:** F5.6-SEM-001  
> **Type:** Accounting Semantic Specification  
> **Status:** ✅ VERIFIED from TT99/2025  
> **Authority:** F5-S0 Constitutional Amendment  
> **Date:** 2026-08-16

---

## Constitutional Finding

### F5.6-SEM-001: Vendor Prepayment Accounting Semantic

**Vendor prepayments SHALL be modeled as the debit position of the vendor's 
TK 331 relationship.**

**TK 141 SHALL NOT be used for vendor prepayments.**

**A debit balance in TK 331 represents amounts advanced to the vendor and is 
presented as "Trả trước cho người bán" under current assets according to the 
applicable accounting presentation rules.**

**This semantic is derived from TT99/2025 official guidance and is NOT an 
AI-invented accounting policy.**

---

## Legal Basis

**Source:** Thông tư 99/2025/TT-BTC, Phụ lục — Nội dung và phương pháp kế toán TK 331

**TT99/2025 Official Text:**

> "Trong chi tiết từng đối tượng phải trả, TK 331 phản ánh cả số tiền đã ứng trước 
> cho người bán, người cung cấp, người nhận thầu nhưng chưa nhận được hàng hóa, 
> dịch vụ..."

> "TK 331 có thể có số dư bên Nợ. Số dư Nợ phản ánh: số tiền đã ứng trước 
> cho người bán hoặc số tiền đã trả nhiều hơn số phải trả cho người bán 
> theo từng đối tượng."

---

## Semantic Specification

### 1. Account Classification

**TK 331 — Phải trả cho người bán:**
- **Account Type:** Liability account (Nợ phải trả)
- **Normal Balance:** CREDIT (liability)
- **Can Have:** DEBIT balance (vendor advance)

**TK 141 — Tạm ứng:**
- **Account Type:** Asset account (Tài sản)
- **Purpose:** Employee/internal advances ONLY
- **NOT for:** Vendor prepayments

### 2. Vendor Prepayment Semantic

**Vendor prepayment is NOT a separate asset account.**

**Vendor prepayment IS the debit position of TK 331 vendor relationship:**

```
F5.6 PREPAYMENT_GL_BALANCE
≠
ASSET_ACCOUNT_BALANCE

F5.6 PREPAYMENT_GL_BALANCE
=
DEBIT POSITION OF VENDOR TK 331
```

### 3. Per-Vendor Balance Calculation

**For vendor V:**

```
331_debit_position(V) = debit_movements(V) - credit_movements(V)

unapplied_vendor_prepayment(V) = MAX(331_debit_position(V), 0)
```

**Example:**

**Vendor A:**
```
Debit  TK 331:  100M  (advance paid)
Credit TK 331:   70M  (invoice applied)
Net:             30M  DEBIT
→ Vendor prepayment = 30M
```

**Vendor B:**
```
Debit  TK 331:   50M  (advance paid)
Credit TK 331:  120M  (invoices received)
Net:             70M  CREDIT
→ Payable = 70M
→ Prepayment = 0
```

**Critical:** F5.6 MUST reconcile per vendor, NOT system-wide aggregate.

### 4. Financial Statement Presentation

**Balance Sheet:**
- **Line Item:** "Trả trước cho người bán ngắn hạn"
- **Location:** TÀI SẢN (Current Assets)
- **Source:** Số dư Nợ của TK 331 theo từng vendor

**Important Distinction:**
- TK 331 remains a **LIABILITY account**
- Debit balance of TK 331 is **presented as Current Asset**
- This does NOT make TK 331 an asset account

---

## Semantic Chain

```
F4 Vendor Prepayment
        ↓
Vendor Relationship
        ↓
TK 331 (Phải trả cho người bán)
        ↓
  ┌─────┴─────┐
  ▼           ▼
Debit       Credit
Balance     Balance
  │           │
  ▼           ▼
Vendor      Vendor
Advance     Payable
  │
  ↓
Current Asset Presentation
"Trả trước cho người bán"
```

---

## What This Finding DOES Confirm

✅ **Confirmed from TT99/2025:**
1. Vendor prepayment belongs to TK 331 (NOT TK 141)
2. TK 331 can have Debit balance (vendor advance)
3. Debit balance tracked per vendor
4. Balance Sheet presentation: "Trả trước cho người bán" (Current Asset)

---

## What This Finding DOES NOT Confirm

❌ **NOT yet verified:**
1. Specific accounting entries for each F4 fact type
2. Bella F1 actual posting to TK 331 (implementation verification)
3. F4 contract alignment with TT99/2025 debit/credit conventions
4. Reconstruction formula legal verification
5. Temporal boundary specification
6. VAS additional guidance

**These require separate verification per F5-S0.**

---

## Implementation Implications

### F5.6 PREPAYMENT_GL_BALANCE Specification

**What F5.6 Reconciles:**
```
F5.6 reconstructs the DEBIT POSITION of TK 331 
arising from vendor advances, per vendor.
```

**NOT:**
- ❌ A separate "prepayment asset account"
- ❌ TK 141 (employee advances)
- ❌ TK 142 (does not exist in TT99/2025)
- ❌ System-wide aggregate (must be per vendor)

### Reconstruction Formula (Derived, Pending Verification)

**Status:** 🟡 DERIVED (logic sound, but NOT yet legally verified)

```sql
vendor_prepayment_balance_per_vendor = SUM(
  CASE fact_type
    WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- Debit TK 331
    WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor  -- Credit TK 331
    WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- Credit TK 331
  END
)
```

**Why Derived:**
- C.1 confirms vendor advance → Debit balance TK 331
- Formula logic reconstructs Debit balance
- BUT: Each fact type mapping to Debit/Credit still needs verification from TT99 Phần B or VAS

**Remaining Verification:**
- Confirm `PREPAYMENT_RECORDED` → Debit TK 331 (per TT99 accounting entries)
- Confirm `PREPAYMENT_APPLIED` → Credit TK 331 (per TT99 accounting entries)
- Confirm `PREPAYMENT_REFUNDED` → Credit TK 331 (per TT99 accounting entries)

---

## F5-S0 Constitutional Compliance

**F5-S0 Principle:**
> "Financial semantics cannot be AI-invented."

**This Finding Demonstrates:**
- ✅ Semantic derived from **TT99/2025 official text** (not AI assumption)
- ✅ Direct quotes from legal framework provided
- ✅ Human Architect supplied evidence and interpretation
- ✅ AI analyzed evidence, did NOT invent semantic
- ✅ Distinction maintained between:
  - What is legally verified (C.1 TK 331 semantic)
  - What is logically derived (reconstruction formula)
  - What remains unverified (C.2-C.6)

---

## Research Status Update

**Item C.1 — GL Account Semantic:**
- Status: 🟢 **GREEN** (VERIFIED from TT99/2025)
- Finding: Vendor prepayment → TK 331 Debit balance
- Source: TT99/2025 Phụ lục official text

**Item C.5 — Reconstruction Formula:**
- Status: 🟡 **DERIVED** (logic sound, pending verification)
- Formula: RECORDED (+) - APPLIED (-) - REFUNDED (-)
- Needs: TT99 Phần B or VAS verification of fact type mappings

**Overall F5.6 Implementation Gate:**
- Status: 🔴 **BLOCKED**
- Blocker: C.2, C.3, C.4, C.6 remain unverified
- Blocker: Part B (Cash) incomplete
- Blocker: Part D (Cross-domain) incomplete

**Fundamental Semantic Blocker:**
- Status: 🟢 **RESOLVED**
- Resolution: Vendor prepayment semantic confirmed (TK 331, NOT TK 141)

---

## Next Steps (Human Architect Required)

**Priority 1 — Complete Part C:**
1. ✅ C.1 — TK 331 semantic (DONE)
2. ❌ C.2 — TT99 Phần B or VAS accounting entries verification
3. ❌ C.3 — Bella F1 actual posting verification (implementation check)
4. ❌ C.4 — F4 contract alignment verification
5. ⚠️ C.5 — Formula legal verification (derived, needs confirmation)
6. ❌ C.6 — Temporal boundary specification

**Critical:** C.3 is essential — TT99 may specify TK 331, but F5.6 MUST verify 
Bella F1 actually posts to TK 331. Cannot assume legal framework → implementation.

**Priority 2 — Complete Part B (Cash):**
7. ❌ B.2-B.5 verification

**Priority 3 — Complete Part D (Cross-domain):**
8. ❌ D.1-D.2 verification

**Only then:**
9. Semantic specification update
10. Human Architect approval
11. Temporal contracts creation
12. **AI coding begins**

---

## Constitutional Principle Established

**Boundary Between Legal Semantic and Implementation:**

```
TT99/2025 Legal Framework
        ↓
Vietnamese Accounting Semantic
        ↓
(BOUNDARY — F5-S0 verification required)
        ↓
Bella Implementation
        ↓
F5 Reconciliation Logic
```

**This finding closes the legal semantic for C.1.**

**It does NOT close the implementation verification (C.3).**

**This boundary is essential to F5-S0 compliance.**

---

**Finding Status:** ✅ VERIFIED (C.1 TK 331 semantic)  
**Implementation Gate:** 🔴 BLOCKED (C.2-C.6, Part B, Part D remain)  
**Fundamental Blocker:** 🟢 RESOLVED (vendor prepayment semantic confirmed)

