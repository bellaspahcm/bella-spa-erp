# F5.6 Vietnamese Accounting Semantic Research

> **Status:** 🔴 IN PROGRESS — Research required before F5.6 implementation  
> **Authority:** F5-S0 Constitutional Amendment  
> **Purpose:** Establish Vietnamese accounting semantic baseline for Cash + Prepayment reconciliation  
> **Effective Regime:** Thông tư 99/2025/TT-BTC (effective 01/01/2026)

---

## Research Purpose

Per F5-S0 Constitutional Amendment, F5 reconciliation semantics MUST be derived from Vietnamese accounting legal framework.

This document researches TT99/2025 + VAS to answer 4 blocked items in F5.6:
1. Cash → GL account mapping
2. Prepayment → GL clearing account  
3. Reconstruction formulas (debit/credit conventions)
4. Temporal boundary semantics

**DO NOT proceed with F5.6 coding until this research is complete and approved.**

---

## Part A: Legal Framework Foundation

### A.1 Applicable Vietnamese Accounting Regime

**Current Regime:** Thông tư 99/2025/TT-BTC

**Issued By:** Bộ Tài chính (Ministry of Finance)  
**Effective Date:** 01/01/2026 (for fiscal years beginning on or after this date)  
**Replaces:** Thông tư 200/2014/TT-BTC  

**Coverage:**
- Accounting vouchers (chứng từ kế toán)
- Chart of Accounts (hệ thống tài khoản kế toán)
- Ledger books and recording methods (sổ kế toán và phương pháp ghi sổ)
- Financial statement preparation and presentation (lập và trình bày báo cáo tài chính)
- Foreign exchange difference treatment (xử lý chênh lệch tỷ giá)

**Transition Rule:**
- Fiscal year 01/10/2025–30/09/2026 → Apply TT200 (old regime)
- Fiscal year starting on/after 01/01/2026 → Apply TT99 (new regime)

**Official Source:** [Ministry of Finance Vietnam](https://www.mof.gov.vn/)

### A.2 Vietnamese Accounting Standards (VAS) Relevant to F5.6

**Standards Applicable:**
- VAS 01 — General Standards
- VAS 02 — Inventories (if prepayment treated as inventory prepayment)
- VAS 03 — Tangible Fixed Assets (N/A for F5.6)
- VAS 04 — Intangible Fixed Assets (N/A for F5.6)
- VAS 05 — Investment Property (N/A for F5.6)
- VAS 06 — Leases (N/A for F5.6)
- VAS 07 — Accounting for investments in associates (N/A for F5.6)
- VAS 21 — Presentation of Financial Statements
- VAS 22 — Disclosure of accounting policies, accounting estimates and errors
- VAS 23 — Events after the balance sheet date
- VAS 24 — Cash flow statements

**Key VAS for F5.6:**
- **VAS 01** — Recognition criteria, measurement
- **VAS 24** — Cash and cash equivalents definition

**Research Required:** 
- [ ] Download/access official VAS 01 and VAS 24 documents
- [ ] Extract definitions relevant to cash and prepayments
- [ ] Document debit/credit conventions

---

### A.3 Accounting Regime Versioning & Applicability 🔴 PRIORITY 1

**Status:** 🔴 **BLOCKS ALL C.2+ RESEARCH**  
**Constitutional Authority:** F5-S0.2 Amendment (Accounting Regime Independence Law)  
**Document:** `F5_0_2_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_REGIME_VERSIONING.md`

**Discovery:** Vietnamese SMEs can choose **TT133/2016 OR TT99/2025** effective 01/01/2026.

**Source:** https://einvoice.vn/tin-tuc/ap-dung-che-do-ke-toan-moi

**Critical Finding:**
```
Vietnamese SME Tenant (01/01/2026+)
        │
        ├── Option 1: TT133/2016 (continue existing regime)
        │
        └── Option 2: TT99/2025 (elect new regime)
```

**F5-S0.1 Architecture Failure:**
> F5-S0.1 incorrectly assumed "TT99/2025 = universal baseline for all Vietnamese tenants". This is FALSE. Bella Finance OS must support **multi-regime architecture**.

**Research Tasks:**
- [ ] **A.3.1** — Document TT133/2016 applicability (SME criteria, scope, effective dates)
- [ ] **A.3.2** — Document TT99/2025 applicability (mandatory for enterprises, optional for SMEs)
- [ ] **A.3.3** — Document transition rules (TT99/2025 Điều 30-31: consistent application, restatement, disclosure)
- [ ] **A.3.4** — Design `tenant_accounting_regimes` schema (effective dating, versioning)
- [ ] **A.3.5** — Design `accounting_semantic_registry` schema (regime-specific semantic rules)
- [ ] **A.3.6** — Define F5 regime resolution algorithm (`as_of` → regime → semantic adapter)
- [ ] **A.3.7** — Define regime change governance (transition approval, historical immutability)
- [ ] **A.3.8** — Human Architect approval

**Five Constitutional Invariants (F5-S0.2):**
1. **AR-001:** Regime Versioning — Every regime has immutable version identity
2. **AR-002:** Effective Dating — Regime applies only within effective period
3. **AR-003:** Historical Immutability — Historical transactions retain original regime
4. **AR-004:** Semantic Isolation — New legislation SHALL NOT mutate old semantics
5. **AR-005:** Controlled Transition — Regime changes require explicit approval + transition rules

**Architectural Principle:**
> F1 Ledger = **regime-agnostic** (stores transactions, does NOT interpret semantic)  
> F5 Reconciliation = **regime-aware** (resolves tenant regime → applies semantic adapter)

**Impact on F5.6:**
- **Part B (Cash):** Must research BOTH TT133/2016 AND TT99/2025 cash accounts
- **Part C (Prepayment):** Must research BOTH TT133/2016 AND TT99/2025 vendor prepayment
- **C.2 BLOCKED:** Cannot verify "TT99 accounting entries only" — must verify BOTH regimes
- **C.4 NEW:** Must verify TT133 vs TT99 semantic equivalence for TK 331

**Critical Question:**
> Is TK 331 vendor prepayment semantic **identical** in TT133/2016 and TT99/2025?
>
> **If YES:** F5.6 can use unified semantic (simpler)  
> **If NO:** F5.6 needs regime-specific adapters (more complex)

**Deliverable:** `F5_6_A3_ACCOUNTING_REGIME_VERSIONING.md` (50+ pages expected)

**Approval Gate:** Human Architect MUST approve A.3 before C.2 can resume.

---

## Part B: Cash Domain Research

### B.1 TT99/2025 Chart of Accounts — Cash Accounts

**Research Question:** Which accounts in TT99/2025 COA represent cash and bank deposits?

**Expected Accounts (from TT200, pending TT99 verification):**
- **111 — Tiền mặt** (Cash on hand)
- **112 — Tiền gửi ngân hàng** (Cash in bank)
- **113 — Tiền đang chuyển** (Cash in transit)

**Research Tasks:**
- [ ] Access TT99/2025 official Chart of Accounts
- [ ] Confirm account codes 111, 112, 113 still apply
- [ ] Document any changes from TT200 to TT99
- [ ] Identify account normal balance (DEBIT or CREDIT)
- [ ] Document account structure (3-digit, 4-digit levels?)

**Findings:**

✅ **VERIFIED FROM TT99/2025 OFFICIAL DOCUMENT**

<cite index="1-1">**TT99/2025 Chart of Accounts — Cash Section (LOẠI TÀI KHOẢN TÀI SẢN):**

| Số TT | Account Code | Tên Tài Khoản | English |
|-------|--------------|---------------|---------|
| 01 | **111** | **Tiền mặt** | Cash on hand |
| 02 | **112** | **Tiền gửi không kỳ hạn** | Non-term deposits |
| 03 | **113** | **Tiền đang chuyển** | Cash in transit |</cite>

**Key Changes from TT200 → TT99/2025:**
- <cite index="1-1">Account 112 changed name:
  - **OLD (TT200):** "Tiền gửi ngân hàng" (Cash in bank)
  - **NEW (TT99):** "Tiền gửi không kỳ hạn" (Non-term deposits)</cite>
- <cite index="1-1">Term deposits moved to **128 Đầu tư nắm giữ đến ngày đáo hạn** → Sub-account **1281 Tiền gửi có kỳ hạn**</cite>
  
**Account Classification:**
- All three accounts (111, 112, 113) are under **"LOẠI TÀI KHOẢN TÀI SẢN"** (Asset accounts)
- Normal Balance: **DEBIT-normal** (as assets increase with debit)
- Structure: 3-digit level (111, 112, 113), sub-accounts may exist

**Source:** Thông tư 99/2025/TT-BTC, Phụ lục II — Hệ thống tài khoản kế toán doanh nghiệp
```

### B.2 Bella F1 COA Mapping for Cash

**Research Question:** How does Bella F1 COA map bank accounts to Vietnamese COA?

**Known Structure:**
```typescript
finance_bank_accounts {
  id: UUID,
  tenant_id: UUID,
  name: string,
  currency: string,
  linked_finance_account_id: UUID | null,  // ← Maps to F1 COA
  ...
}

finance_accounts {  // F1 Chart of Accounts
  id: UUID,
  account_code: string,  // e.g., "112"
  name: string,
  account_type: string,
  normal_balance: 'DEBIT' | 'CREDIT',
  ...
}
```

**Research Tasks:**
- [ ] Verify `linked_finance_account_id` is populated for all bank accounts
- [ ] Confirm typical account_code values (111, 112, 113?)
- [ ] Document Bella's COA setup for Vietnamese enterprises
- [ ] Identify edge cases (NULL linked_finance_account_id)

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

Bella F1 COA Mapping:
- Tiền mặt (111) → finance_accounts where account_code = '111'
- Tiền gửi ngân hàng (112) → finance_accounts where account_code = '112'
- Mapping mechanism: bank_accounts.linked_finance_account_id → finance_accounts.id
- Edge case handling: [Document NULL case]
```

### B.3 F2 Cash Contract Alignment

**Research Question:** Does F2 Cash contract align with Vietnamese cash accounting semantics?

**F2 Contract Review:**
- Movement types: `INFLOW` | `OUTFLOW`
- Amount convention: `amount_minor > 0` (always positive)
- Direction determines sign

**Vietnamese Accounting Convention:**
- Cash increase → Debit (Nợ)
- Cash decrease → Credit (Có)

**Alignment Check:**
```
F2 INFLOW → Debit (cash increase) ✅
F2 OUTFLOW → Credit (cash decrease) ✅
```

**Research Tasks:**
- [ ] Confirm F2 INFLOW = Vietnamese debit convention
- [ ] Confirm F2 OUTFLOW = Vietnamese credit convention
- [ ] Verify F2 `recorded_at` aligns with Vietnamese recognition timing

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

F2 Contract vs Vietnamese Accounting:
- INFLOW semantic: [Debit/Credit] per Vietnamese convention
- OUTFLOW semantic: [Debit/Credit] per Vietnamese convention
- Alignment status: [ALIGNED / MISALIGNED / NEEDS ADJUSTMENT]
```

### B.4 Cash Reconstruction Formula (Vietnamese Semantics)

**Research Question:** What is the correct formula to reconstruct cash position per Vietnamese accounting?

**Proposed Formula:**
```sql
cash_balance = 
    SUM(CASE 
        WHEN direction = 'INFLOW' THEN amount_minor  -- Debit
        WHEN direction = 'OUTFLOW' THEN -amount_minor -- Credit
    END)
```

**Vietnamese Accounting Basis:**
- Cash is ASSET account
- ASSET normal balance = DEBIT
- Balance = Debit side - Credit side

**Research Tasks:**
- [ ] Confirm cash is DEBIT-normal per TT99/2025
- [ ] Verify formula matches Vietnamese convention
- [ ] Document any special cases (foreign currency, restricted cash)

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

Vietnamese Cash Balance Formula:
- Normal balance: [DEBIT/CREDIT]
- Debit increases: [INFLOW/OUTFLOW]
- Credit decreases: [INFLOW/OUTFLOW]
- Formula approved: [YES/NO/NEEDS MODIFICATION]
- Special cases: [Document]
```

### B.5 Cash Temporal Boundary (Vietnamese Accounting Period)

**Research Question:** Which timestamp determines when cash movement belongs to an accounting period?

**Candidate Columns:**
- `recorded_at` — When F2 recorded the movement
- `f1_transaction.posted_at` — When F1 posted the transaction
- Business event date — Original transaction date

**Vietnamese Accounting Concepts:**
- **Ngày nghiệp vụ** (Transaction date) — Business event
- **Ngày hạch toán** (Posting date) — Ledger entry date
- **Kỳ kế toán** (Accounting period) — Fiscal period

**Research Tasks:**
- [ ] Identify authoritative date per TT99/2025
- [ ] Verify F2 `recorded_at` semantics
- [ ] Check if F1 `posted_at` is canonical
- [ ] Document period closing rules

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

Cash Temporal Boundary:
- Authoritative timestamp: [recorded_at / posted_at / other]
- Vietnamese accounting basis: [ngày nghiệp vụ / ngày hạch toán]
- Period inclusion rule: [Document]
- F5 reconciliation as_of semantics: [Document]
```

---

## Part C: Vendor Prepayment Domain Research

**Domain Verified:** ✅ F4 PREPAYMENT = Vendor prepayment (NOT employee advance)

**Evidence:**
- F4 table: `finance_vendor_prepayments` (explicit vendor domain)
- F4 RPC: `finance_record_prepayment(p_vendor_id, ...)` (vendor-scoped)
- F4 FK: Links to `finance_vendor_bills` (vendor relationships)
- Semantic: "Ứng trước cho nhà cung cấp" (advance to vendor)

**NOT in F5.6 Scope:**
- ❌ Employee advance (TK 141 — Tạm ứng)
- ❌ Internal advance relationships

**See:** `F5_6_DOMAIN_BOUNDARY_VERIFICATION.md` for full evidence

---

### C.1 TT99/2025 Chart of Accounts — Vendor Prepayment Treatment

**Research Question:** Which accounts in TT99/2025 COA represent vendor prepayments/advances?

**Expected Accounts (from TT200, pending TT99 verification):**
- **331 — Phải trả cho người bán** (Accounts Payable)
  - May include sub-account for advances: **3311 — Ứng trước cho người bán**
- **142 — Chi phí trả trước** (Prepaid Expenses)
  - Used if prepayment is for services/expenses

**Key Question:** Is vendor advance treated as:
1. **Contra-liability** (reduces AP) → Account 331x
2. **Prepaid expense** (asset) → Account 142
3. **Separate advance account** → Account 144 or other

**Research Tasks:**
- [ ] Access TT99/2025 COA for account 331 structure
- [ ] Identify if 3311 or similar sub-account exists
- [ ] Confirm if account 142 applies to vendor advances
- [ ] Determine normal balance (DEBIT or CREDIT)
- [ ] Document official account structure

**Findings:**

✅ **VERIFIED FROM TT99/2025 OFFICIAL DOCUMENT**

<cite index="1-5,1-6">**TT99/2025 Chart of Accounts — Accounts Payable & Prepayment (LOẠI TÀI KHOẢN NỢ PHẢI TRẢ):**

| Số TT | Account Code | Tên Tài Khoản | English |
|-------|--------------|---------------|---------|
| 34 | **331** | **Phải trả cho người bán** | Accounts Payable |</cite>

**Prepaid Expense Account:**
<cite index="1-2">| Số TT | Account Code | Tên Tài Khoản | English |
|-------|--------------|---------------|---------|
| 10 | **141** | **Tạm ứng** | Advances |</cite>

**Key Findings for Vendor Prepayments:**

1. **Account 331 — Phải trả cho người bán (Accounts Payable)**
   - Liability account, CREDIT-normal
   - Per TT99/2025 summary: No sub-accounts shown (may exist in detailed guidance)
   - Vendor prepayments may reduce this liability

2. **Account 141 — Tạm ứng (Advances)**
   - <cite index="1-2">Under **LOẠI TÀI KHOẢN TÀI SẢN** (Asset accounts)</cite>
   - DEBIT-normal asset account
   - May represent advances TO vendors (prepayments as asset)

**Critical Accounting Question:**
Per TT99/2025, vendor prepayment can be treated as:
- **Option A:** ASSET (141 Tạm ứng) — Debit-normal, advance to vendor
- **Option B:** CONTRA-LIABILITY (reduces 331) — Credit side reduction

**Sub-Account Structure:**
- TT99/2025 summary does NOT show sub-accounts 3311, 1411, etc.
- Detailed TT99/2025 guidance may specify sub-account structure
- **RESEARCH REQUIRED:** Access full TT99/2025 implementation guidance

**Account Classification:**
- **331:** Liability (CREDIT-normal)
- **141:** Asset (DEBIT-normal)

**Source:** Thông tư 99/2025/TT-BTC, Phụ lục II — Hệ thống tài khoản kế toán doanh nghiệp

**✅ VERIFIED FROM TT99/2025 PHẦN B — NỘI DUNG VÀ PHƯƠNG PHÁP KẾ TOÁN:**

### Account 141 — Tạm ứng (Employee/Internal Advances ONLY)

<cite index="1-2">**TK 141 — Tạm ứng:**
- Asset account (LOẠI TÀI KHOẢN TÀI SẢN)
- **Purpose:** Tạm ứng cho người lao động của doanh nghiệp (Employee advances)
- **Scope:** Internal advance relationships ONLY</cite>

**TT99/2025 Accounting Treatment:**

**When enterprise advances cash to employee:**
```
Nợ  141 Tạm ứng
    Có  111, 112 Tiền mặt/Tiền gửi
```

**When employee settles with receipts:**
```
Nợ  152, 153, 156, 241, 331, 621, 623, 627, 642, ...
    Có  141 Tạm ứng
```

**Critical:** TK 141 is for **người lao động** (employees), NOT vendors.

---

### Account 331 — Phải trả cho người bán (Vendor Relationships — INCLUDING Prepayments)

<cite index="1-5">**TK 331 — Phải trả cho người bán:**
- Liability account (LOẠI TÀI KHOẢN NỢ PHẢI TRẢ)
- **Purpose:** Công nợ với người bán, nhà cung cấp, nhà thầu</cite>

**TT99/2025 CRITICAL SPECIFICATION:**

> **"Trong chi tiết từng đối tượng phải trả, TK 331 phản ánh cả số tiền đã ứng trước 
> cho người bán, người cung cấp, người nhận thầu nhưng chưa nhận được hàng hóa, 
> dịch vụ..."**
> 
> — TT99/2025, Phụ lục — Nội dung và phương pháp kế toán TK 331

**Bên Nợ TK 331 (Debit Side) — Per TT99/2025:**
1. Số tiền đã trả nợ cho người bán
2. **Số tiền ứng trước cho người bán, người cung cấp, người nhận thầu**

**Bên Có TK 331 (Credit Side) — Per TT99/2025:**
1. Giá mua hàng hóa, dịch vụ (invoices)
2. Các khoản phải trả khác

**Số dư TK 331 — Per TT99/2025:**

**Credit balance (normal):**
- Số tiền còn phải trả cho người bán, nhà cung cấp theo từng đối tượng

**Debit balance (vendor advance):**
> **"TK 331 có thể có số dư bên Nợ. Số dư Nợ phản ánh: số tiền đã ứng trước 
> cho người bán hoặc số tiền đã trả nhiều hơn số phải trả cho người bán 
> theo từng đối tượng."**
> 
> — TT99/2025, Phụ lục — Nội dung và phương pháp kế toán TK 331

**TT99/2025 Requirement:** TK 331 được theo dõi **chi tiết theo từng đối tượng người bán**.

---

### F5.6 Vendor Prepayment Semantic (Confirmed by TT99/2025)

**Accounting Treatment for Vendor Advance:**

**Step 1: Enterprise pays advance to vendor**
```
Nợ  331 Phải trả cho người bán    100,000,000
    Có  112 Tiền gửi ngân hàng                100,000,000
```
**Result:** TK 331 cho vendor đó có **số dư Nợ 100M** (tiền ứng trước)

**Step 2: Vendor delivers, invoice received**
```
Nợ  156 Hàng hóa                  100,000,000
    Có  331 Phải trả cho người bán            100,000,000
```
**Result:** TK 331 số dư Nợ cleared (ứng trước đã cấn trừ)

---

### Financial Statement Presentation (TT99/2025 Confirmation)

**TT99/2025 Balance Sheet Specification:**

**Chỉ tiêu: "Trả trước cho người bán ngắn hạn"**
- Presented under: **TÀI SẢN** (Current Assets)
- Source: **Tổng số dư Nợ chi tiết của TK 331** mở theo từng người bán

**Critical Insight:**
- TK 331 là tài khoản **phải trả** (liability account)
- Nhưng **số dư Nợ của TK 331 theo từng vendor** → trình bày phía **TÀI SẢN**
- Chỉ tiêu: "Trả trước cho người bán ngắn hạn"

**This confirms:**
```
Vendor Prepayment Semantic Chain:
       Vendor advance
              │
              ▼
    TK 331 (Debit balance by vendor)
              │
              ▼
"Trả trước cho người bán" (Current Asset on Balance Sheet)
```

---

### F5.6 PREPAYMENT_GL_BALANCE Specification

**What F5.6 Reconciles:**
```
F5.6 PREPAYMENT_GL_BALANCE reconstructs the DEBIT BALANCE 
of TK 331 arising from vendor advances, by vendor.
```

**NOT:**
- ❌ A separate asset account (141)
- ❌ A "prepayment asset account"
- ❌ TK 142 (does not exist in TT99/2025 Phụ lục II)

**Reconstruction Formula:**
```sql
vendor_prepayment_balance_per_vendor = SUM(
  CASE fact_type
    WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- Nợ 331 (Debit)
    WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor  -- Có 331 (Credit)
    WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- Có 331 (Credit)
  END
)
```

**This reconstructs:**
- Debit balance of TK 331 per vendor
- NOT an asset account balance
- Matches TT99/2025 semantic: "số dư Nợ của TK 331 theo từng đối tượng người bán"

---

### Detailed Ledger Requirement (TT99/2025)

**TT99/2025 requires:** Sổ chi tiết thanh toán với người bán (Detailed vendor ledger)

**Structure:**
```
Vendor ID
    │
    ▼
TK 331 (per vendor)
    │
    ├── Số phát sinh Nợ (Debit movements)
    ├── Số phát sinh Có (Credit movements)
    │
    └── Số dư (Balance)
            ├── Số dư Nợ (Debit balance — vendor advance)
            └── Số dư Có (Credit balance — vendor payable)
```

**F4 Alignment:**
```
F4 finance_vendor_prepayments:
    vendor_id + fact_type + amount_minor
              ↓
TK 331 movements per vendor
              ↓
Debit/Credit balance per vendor
```

---

### Summary: 141 vs 331 (TT99/2025 Confirmed)

| Account | Purpose | Counterparty | F5.6 Scope |
|---------|---------|--------------|------------|
| **141** | Tạm ứng người lao động | **Internal employee** | ❌ NOT in F5.6 |
| **331** | Phải trả NB + Ứng trước NB | **External vendor** | ✅ F5.6 Prepayment |

**TT99/2025 Distinguishes:**
- 141 = Employee advances (internal)
- 331 = Vendor payables + vendor advances (external)

**F5.6 Conclusion:**
- GL Account: **331 Phải trả cho người bán** (VERIFIED)
- Semantic: **Debit balance per vendor** (VERIFIED)
- Presentation: "Trả trước cho người bán" — Current Asset (VERIFIED)
- Source: **TT99/2025 Phụ lục — Nội dung và phương pháp kế toán**

### C.2 VAS Treatment of Vendor Prepayments

**Research Question:** How does VAS define and prescribe treatment for vendor advances?

**Key VAS Sections:**
- Recognition criteria (when to recognize advance)
- Measurement (historical cost, fair value?)
- Application rules (how advance reduces payable)
- Disclosure requirements

**Research Tasks:**
- [ ] Review VAS 01 for prepayment recognition
- [ ] Identify any VAS specifically addressing advances
- [ ] Document debit/credit conventions for:
  - Recording prepayment (advance paid)
  - Applying prepayment (to invoice)
  - Refunding prepayment
- [ ] Verify alignment with TT99/2025

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

VAS Treatment of Vendor Prepayments:
- Recognition point: [When paid / When approved / Other]
- Measurement basis: [Cost / Fair value / Other]
- Debit/Credit convention:
  - PREPAYMENT_RECORDED: [Debit account X / Credit account Y]
  - PREPAYMENT_APPLIED: [Debit account X / Credit account Y]
  - PREPAYMENT_REFUNDED: [Debit account X / Credit account Y]
- Source: [VAS section reference]
```

### C.3 Bella F1 COA Mapping for Prepayments

**Status:** 🟡 GAP DETECTED — Awaiting Human Architect Decision  
**Document:** `F5_6_C3_BELLA_F1_IMPLEMENTATION_GAP.md`

**Research Question:** How does Bella F1 COA handle vendor prepayment accounts?

**Known Structure:**
```typescript
finance_vendor_prepayments {
  id: UUID,
  tenant_id: UUID,
  vendor_id: UUID,
  fact_type: 'PREPAYMENT_RECORDED' | 'PREPAYMENT_APPLIED' | 'PREPAYMENT_REFUNDED',
  amount_minor: BIGINT,
  f1_transaction_id: UUID,  // ← Links to F1 GL posting
  ...
}
```

**Research Tasks:**
- [x] Identify which F1 account F4 posts prepayments to
- [ ] Verify account code maps to TK 331
- [ ] Confirm normal balance matches Vietnamese convention
- [ ] Document GL entry patterns:
  - When recording prepayment
  - When applying to bill
  - When refunding

**ARCHITECTURAL GAP DETECTED:**

Bella F1 uses **symbolic account code `'PREPAYMENT_ASSET'`** instead of direct TK 331 posting:

```sql
-- finance_record_prepayment() line ~925
-- Recording prepayment
Debit:  'PREPAYMENT_ASSET' (symbolic code, NOT '331')
Credit: Bank account (111/112/113)

-- finance_apply_prepayment() line ~1060
-- Applying prepayment to invoice
Debit:  '331' (explicit TK 331)
Credit: 'PREPAYMENT_ASSET' (symbolic code)
```

**Two Hypotheses:**

**Gap Type A: Symbolic Account Mapping**
- `'PREPAYMENT_ASSET'` is a symbolic code that maps to TK 331 via `finance_accounts` table
- Bella uses dual-code system: symbolic (internal) + actual COA (Vietnamese standard)
- Implementation complies with TT99/2025 semantically

**Gap Type B: Architectural Mismatch**
- `'PREPAYMENT_ASSET'` is a separate account, NOT mapped to TK 331
- Bella introduces intermediate account not recognized by TT99/2025
- Violates Vietnamese accounting standard

**Evidence Required:**
```sql
-- Query 1: Check PREPAYMENT_ASSET definition
SELECT account_code, account_name, account_type
FROM finance_accounts
WHERE account_code = 'PREPAYMENT_ASSET';

-- Query 2: Check TK 331 definition
SELECT account_code, account_name, account_type
FROM finance_accounts
WHERE account_code = '331';

-- Query 3: Trace actual transaction
SELECT fa.account_code, fa.account_name, ftl.debit, ftl.credit
FROM finance_transaction_lines ftl
JOIN finance_accounts fa ON ftl.account_id = fa.id
WHERE transaction_id IN (
    SELECT f1_transaction_id FROM finance_vendor_prepayments LIMIT 1
);
```

**Architectural Decision Required:**
1. Does Bella use symbolic codes → Vietnamese COA mapping?
2. Should F4 contracts use symbolic or explicit TK codes?
3. Multi-country COA variance strategy?

**F5-S0 Boundary:** Legal semantic (C.1: TK 331 verified) ≠ Implementation (C.3: gap detected).

**See:** `F5_6_C3_BELLA_F1_IMPLEMENTATION_GAP.md` for full analysis.

### C.4 F4 AP Contract Alignment

**Research Question:** Does F4 AP contract align with Vietnamese prepayment accounting semantics?

**F4 Contract Review:**
- Fact types: `PREPAYMENT_RECORDED`, `PREPAYMENT_APPLIED`, `PREPAYMENT_REFUNDED`
- Amount convention: `amount_minor > 0` (always positive)
- Vendor validation: same-vendor constraint

**Vietnamese Accounting Convention:**
- Advance payment → [Debit/Credit which account?]
- Application to invoice → [Debit/Credit which accounts?]
- Refund → [Debit/Credit which accounts?]

**Research Tasks:**
- [ ] Map F4 fact types to Vietnamese accounting entries
- [ ] Verify F4 semantics match Vietnamese treatment
- [ ] Check if F4 `created_at` aligns with recognition timing
- [ ] Identify any semantic gaps

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

F4 Contract vs Vietnamese Accounting:
- PREPAYMENT_RECORDED semantic: [Describe Vietnamese equivalent]
- PREPAYMENT_APPLIED semantic: [Describe Vietnamese equivalent]
- PREPAYMENT_REFUNDED semantic: [Describe Vietnamese equivalent]
- Alignment status: [ALIGNED / MISALIGNED / NEEDS ADJUSTMENT]
- Gaps identified: [Document]
```

### C.5 Prepayment Reconstruction Formula (Vietnamese Semantics)

**Research Question:** What is the correct formula to reconstruct net unapplied prepayment per Vietnamese accounting?

**Proposed Formula:**
```sql
net_unapplied_prepayment = 
    SUM(CASE fact_type
        WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- [Debit/Credit?]
        WHEN 'PREPAYMENT_APPLIED' THEN -amount_minor   -- [Debit/Credit?]
        WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- [Debit/Credit?]
    END)
```

**Vietnamese Accounting Basis:**
- If prepayment is ASSET (account 142): DEBIT-normal
  - Balance = Debit side - Credit side
- If prepayment is CONTRA-LIABILITY (account 331x): CREDIT-normal?
  - Balance = Credit side - Debit side

**Research Tasks:**
- [ ] Confirm prepayment account normal balance
- [ ] Verify formula matches Vietnamese convention
- [ ] Document which fact type is debit vs credit
- [ ] Test formula against sample transactions

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

Vietnamese Prepayment Balance Formula:
- Account type: [ASSET / CONTRA-LIABILITY / OTHER]
- Normal balance: [DEBIT/CREDIT]
- PREPAYMENT_RECORDED: [Increases/Decreases balance]
- PREPAYMENT_APPLIED: [Increases/Decreases balance]
- PREPAYMENT_REFUNDED: [Increases/Decreases balance]
- Formula approved: [YES/NO/NEEDS MODIFICATION]
- Special cases: [Document]
```

### C.6 Prepayment Temporal Boundary (Vietnamese Accounting Period)

**Research Question:** Which timestamp determines when prepayment fact belongs to an accounting period?

**Candidate Columns:**
- `created_at` — When F4 recorded the fact
- `f1_transaction.posted_at` — When F1 posted the transaction
- Business event date — Original prepayment date

**Vietnamese Accounting Concepts:**
- **Ngày nghiệp vụ** (Transaction date) — Payment/application date
- **Ngày hạch toán** (Posting date) — Ledger entry date
- **Kỳ kế toán** (Accounting period) — Fiscal period

**Research Tasks:**
- [ ] Identify authoritative date per TT99/2025
- [ ] Verify F4 `created_at` semantics
- [ ] Check if F1 `posted_at` is canonical
- [ ] Document recognition timing rules

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

Prepayment Temporal Boundary:
- Authoritative timestamp: [created_at / posted_at / other]
- Vietnamese accounting basis: [ngày nghiệp vụ / ngày hạch toán]
- Period inclusion rule: [Document]
- F5 reconciliation as_of semantics: [Document]
```

---

## Part D: Cross-Domain Temporal Alignment

### D.1 F1/F2/F4 Temporal Contract Consistency

**Research Question:** Do F1, F2, and F4 use consistent temporal semantics?

**Known Timestamps:**
- F1: `finance_transactions.posted_at`
- F2: `finance_cash_movements.recorded_at`
- F4: `finance_vendor_prepayments.created_at`

**Temporal Ordering Guarantees:**
- Is `F2.recorded_at >= F1.posted_at` always true?
- Is `F4.created_at >= F1.posted_at` always true?
- What is maximum clock skew tolerance?

**Research Tasks:**
- [ ] Verify temporal ordering in F2 projection logic
- [ ] Verify temporal ordering in F4 recording logic
- [ ] Document clock skew handling
- [ ] Define edge case rules (same millisecond events)

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

F1/F2/F4 Temporal Alignment:
- F2.recorded_at vs F1.posted_at: [Relationship]
- F4.created_at vs F1.posted_at: [Relationship]
- Clock skew tolerance: [Duration]
- Edge case handling: [Document]
- F5 as_of interpretation: [Document]
```

### D.2 Vietnamese Accounting Period Closing

**Research Question:** How does Vietnamese accounting define period closing?

**TT99/2025 Rules:**
- Period closing procedures
- Book locking requirements
- Adjusting entry timing
- Prior period adjustment rules

**Research Tasks:**
- [ ] Document TT99/2025 period closing rules
- [ ] Identify when books are "locked"
- [ ] Define what "as of period end" means
- [ ] Document how F5 should handle closed periods

**Findings:**
```
[TO BE COMPLETED BY HUMAN ARCHITECT]

Vietnamese Accounting Period Closing:
- Period closing definition: [Document]
- Book locking rules: [Document]
- Reconciliation timing: [Before/After closing?]
- F5 closed period handling: [Document]
```

---

## Part E: Research Completion Checklist

### E.1 Cash Domain Research Status

**Section B.1:** TT99/2025 Cash Accounts
- [ ] Account codes confirmed (111, 112, 113)
- [ ] Account descriptions documented
- [ ] Normal balance confirmed (DEBIT/CREDIT)
- [ ] Official source cited

**Section B.2:** Bella F1 COA Mapping
- [ ] Mapping mechanism verified
- [ ] Typical account codes documented
- [ ] Edge cases identified
- [ ] NULL handling specified

**Section B.3:** F2 Contract Alignment
- [ ] INFLOW/OUTFLOW semantics verified
- [ ] Vietnamese convention alignment confirmed
- [ ] Temporal alignment checked

**Section B.4:** Reconstruction Formula
- [ ] Formula derived from Vietnamese convention
- [ ] Normal balance confirmed
- [ ] Formula approved by Human Architect

**Section B.5:** Temporal Boundary
- [ ] Authoritative timestamp identified
- [ ] Vietnamese accounting basis documented
- [ ] Period inclusion rule defined

### E.2 Prepayment Domain Research Status

**Section C.1:** TT99/2025 Prepayment Accounts
- [ ] Account code confirmed (331/142/other)
- [ ] Account name documented
- [ ] Normal balance confirmed (DEBIT/CREDIT)
- [ ] Treatment clarified (asset/contra-liability)

**Section C.2:** VAS Treatment
- [ ] Recognition criteria documented
- [ ] Debit/Credit conventions verified
- [ ] VAS reference cited

**Section C.3:** Bella F1 COA Mapping
- [ ] Prepayment clearing account identified
- [ ] GL entry patterns documented
- [ ] Vietnamese COA alignment verified

**Section C.4:** F4 Contract Alignment
- [ ] Fact type semantics mapped to Vietnamese entries
- [ ] Alignment status confirmed
- [ ] Gaps identified and documented

**Section C.5:** Reconstruction Formula
- [ ] Formula derived from Vietnamese convention
- [ ] Normal balance confirmed
- [ ] Formula approved by Human Architect

**Section C.6:** Temporal Boundary
- [ ] Authoritative timestamp identified
- [ ] Vietnamese accounting basis documented
- [ ] Period inclusion rule defined

### E.3 Cross-Domain Research Status

**Section D.1:** Temporal Contract Consistency
- [ ] F1/F2/F4 temporal ordering verified
- [ ] Clock skew tolerance documented
- [ ] Edge cases defined

**Section D.2:** Period Closing Rules
- [ ] TT99/2025 closing rules documented
- [ ] F5 closed period handling specified

---

## Part F: Approval and Next Steps

### F.1 Research Approval

**Status:** 🔴 **INCOMPLETE** — Research in progress

**Human Architect Sign-Off Required:**

```
I hereby certify that this Vietnamese accounting semantic research
is complete, accurate, and derived from authoritative legal sources.

All findings are based on TT99/2025, VAS, and Bella F1 COA configuration.

F5.6 semantic specification may proceed based on these findings.

Signed: ___________________________
Date: _____________________________
```

### F.2 Next Steps After Research Completion

Once research is complete and approved:

1. **Update F5_6_CASH_PREPAYMENT_SEMANTIC_SPEC.md**
   - Resolve 4 blocked items for Cash (A.3–A.6)
   - Resolve 4 blocked items for Prepayment (B.3–B.6)
   - Add legal citations for all decisions

2. **Update F5_6_CASH_PREPAYMENT_CHECKLIST.md**
   - Mark items GREEN with research references

3. **Get Human Architect approval on semantic spec**
   - Review research findings
   - Approve semantic decisions
   - Sign off on F5.6 implementation

4. **Only then → AI coding begins F5.6 implementation**

---

## Conclusion

```
┌──────────────────────────────────────────────────────────────┐
│  F5.6 VIETNAMESE ACCOUNTING SEMANTIC RESEARCH                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Status: 🔴 IN PROGRESS                                      │
│                                                              │
│  Research Required:                                          │
│  ❌ Cash domain (5 sections)                                │
│  ❌ Prepayment domain (6 sections)                          │
│  ❌ Cross-domain alignment (2 sections)                     │
│                                                              │
│  Legal Framework:                                            │
│  ✅ TT99/2025 identified as current regime                  │
│  ❌ TT99/2025 COA research incomplete                       │
│  ❌ VAS review incomplete                                   │
│                                                              │
│  🚫 NO CODING UNTIL RESEARCH 100% COMPLETE                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**This research enforces F5-S0 Constitutional Amendment:**

> "F5 reconciliation semantics SHALL be derived from Vietnamese accounting legal framework. AI SHALL NOT invent accounting treatment."

F5.6 implementation remains **correctly BLOCKED** pending research completion and Human Architect approval.

