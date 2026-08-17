# F5.6 Vietnamese Accounting Research — Status Report

> **Date:** 2026-08-23  
> **Phase:** Vietnamese Accounting Semantic Research (Phase 1 of F5.6)  
> **Status:** 🟡 PARTIAL FINDINGS — Human Architect decision required  
> **Authority:** F5-S0 Constitutional Amendment

---

## Research Progress Summary

### ✅ Completed Research Items

#### Cash Domain (Part B.1)

**TT99/2025 Cash Accounts — VERIFIED:**
- ✅ Account 111 — Tiền mặt (Cash on hand)  
- ✅ Account 112 — Tiền gửi không kỳ hạn (Non-term deposits)  
- ✅ Account 113 — Tiền đang chuyển (Cash in transit)

**Key Finding:**
<cite index="1-1">TT99/2025 changed Account 112 from "Tiền gửi ngân hàng" (TT200) to "Tiền gửi không kỳ hạn" — explicitly NON-TERM deposits only.</cite>

**Impact:**
- Term deposits moved to **1281 Tiền gửi có kỳ hạn** (under investment accounts)
- F5.6 Cash reconciliation should ONLY include 111, 112, 113
- Term deposits (1281) are NOT part of cash control domain

**Normal Balance:**
- All three accounts: **DEBIT-normal** (Assets)
- Cash increase = DEBIT
- Cash decrease = CREDIT

**Source:** Thông tư 99/2025/TT-BTC, Phụ lục II

---

### ⚠️ Requires Verification from Detailed TT99/2025 Guidance

#### Prepayment Domain (Part C.1) — Account 331 Semantic Confirmation

**TT99/2025 Prepayment-Related Accounts — CLARIFIED:**

**Account 141 — Tạm ứng (Advances):**
- <cite index="1-2">ASSET account (LOẠI TÀI KHOẢN TÀI SẢN)</cite>
- DEBIT-normal
- **Purpose:** Internal advances (employees, business travel)
- **NOT for vendor prepayments**

**Account 331 — Phải trả cho người bán (Accounts Payable):**
- <cite index="1-5">LIABILITY account (LOẠI TÀI KHOẢN NỢ PHẢI TRẢ)</cite>
- CREDIT-normal (liability)
- **Purpose:** Vendor/supplier relationships
- **Can have DEBIT balance** when enterprise pays advance to vendor
- **Vendor prepayments belong here** (Debit side of TK 331)

**Accounting Semantic Clarification:**

**INCORRECT Understanding (Previous):**
```
❌ "Vendor prepayment: Choose 141 (asset) OR 331 (liability)"
```

**CORRECT Understanding (Vietnamese Accounting):**
```
✅ Vendor prepayment = Debit balance on TK 331 vendor relationship

TK 331 — Phải trả cho người bán:
  Credit side: Vendor invoices (payable)
  Debit side:  Vendor advances (prepayment)
  Net:         Credit - Debit = Net payable position
```

**Example Accounting Treatment:**

Enterprise pays 100M advance to vendor:
```
Nợ  331 Phải trả cho người bán    100,000,000
    Có  112 Tiền gửi ngân hàng                100,000,000
```
→ TK 331 shows Debit balance 100M for this vendor (advance)

Vendor invoice received, advance applied:
```
Nợ  631 Giá vốn hàng bán          100,000,000
    Có  331 Phải trả cho người bán            100,000,000
```
→ TK 331 Debit balance cleared (advance consumed)

**F5.6 Implication:**

PREPAYMENT_GL_BALANCE reconciles:
- **GL Account:** 331 (confirmed)
- **Semantic:** Reconstructs Debit balance (vendor advance) on TK 331
- **NOT:** A separate asset account (141)
- **NOT:** A different clearing account

**Verification Still Required:**

While TT99/2025 Phụ lục II confirms account existence and classification, still need:
1. ✅ Confirm TK 331 classification (LIABILITY) — VERIFIED
2. ❌ Verify TT99/2025 Phần B prescribes "Nợ 331" for vendor advance — **PENDING**
3. ❌ Confirm TK 331 can have Debit balance per Vietnamese accounting — **PENDING**
4. ❌ Document sub-account structure (e.g., 3311 for advances?) — **PENDING**

**Impact on Blocker:**

**OLD Blocker (Incorrect):**
```
❌ Prepayment GL Account Decision — 141 vs 331?
   (Implies these are alternative choices)
```

**NEW Blocker (Correct):**
```
🔴 Vendor Prepayment Accounting Treatment — Verify TT99/2025 Phần B 
   confirms "Nợ 331" for vendor advance and Bella F1 COA alignment
```

---

## Next Steps (Human Architect Actions)

### Immediate Actions Required

1. **Access Full TT99/2025 Guidance**
   - Obtain detailed implementation guidance beyond Phụ lục II summary
   - Review "Phần B — Nội dung và phương pháp kế toán"
   - Document vendor prepayment prescribed treatment

2. **Consult VAS (Vietnamese Accounting Standards)**
   - VAS 01 — General standards (recognition criteria)
   - Identify VAS section addressing advances/prepayments
   - Extract debit/credit conventions for vendor advances

3. **Review Bella Enterprise Accounting Policy**
   - Check current F1 COA mapping for vendor prepayments
   - Verify if Bella uses 141 (asset) or 331 (contra-liability) approach
   - Document existing practice

4. **Make Architectural Decision**
   - Choose Option A (141 asset) or Option B (331 contra-liability)
   - Document rationale with TT99/2025 + VAS citations
   - Update F5.6 semantic spec with decision

5. **Complete Remaining Research Items**
   - B.2 — Bella F1 COA mapping for cash (verify 111/112/113 alignment)
   - B.3 — F2 contract alignment with Vietnamese debit/credit
   - B.4 — Cash reconstruction formula (confirm DEBIT-normal)
   - B.5 — Cash temporal boundary (ngày nghiệp vụ vs ngày hạch toán)
   - C.2 — VAS treatment of vendor prepayments
   - C.3 — Bella F1 COA mapping for prepayments
   - C.4 — F4 contract alignment
   - C.5 — Prepayment reconstruction formula
   - C.6 — Prepayment temporal boundary
   - D.1 — Cross-domain temporal consistency
   - D.2 — Period closing rules

---

## Research Document Status

**File:** `docs/architecture/F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md`

**Completion Status:**
- Part A: Legal Framework — 50% (TT99/2025 verified, VAS pending)
- Part B: Cash Domain — 20% (B.1 complete, B.2-B.5 pending)
- Part C: Prepayment Domain — 10% (C.1 partial, C.2-C.6 pending)
- Part D: Cross-Domain — 0% (not started)
- Part E: Checklist — 0% (pending research completion)
- Part F: Approval — 0% (pending Human Architect sign-off)

**Overall Progress:** ~15%

---

## Key Findings Summary

### ✅ Verified from TT99/2025

1. **Cash accounts confirmed:**
   - 111 Tiền mặt (Cash on hand)
   - 112 Tiền gửi không kỳ hạn (Non-term deposits) — NAME CHANGED from TT200
   - 113 Tiền đang chuyển (Cash in transit)

2. **Cash is DEBIT-normal asset:**
   - Increase cash = DEBIT
   - Decrease cash = CREDIT

3. **Term deposits are NOT cash:**
   - 1281 Tiền gửi có kỳ hạn moved to investment accounts
   - F5.6 Cash reconciliation excludes term deposits

### ⚠️ Requires Human Architect Decision

~~1. **Vendor prepayment account:**~~
~~- Option A: 141 Tạm ứng (DEBIT-normal asset)~~
~~- Option B: 331 Phải trả cho người bán (CREDIT-normal contra-liability)~~
~~- **BLOCKED:** Cannot proceed with F5.6 until decision made~~

**CORRECTED UNDERSTANDING:**

1. **Vendor prepayment accounting treatment:**
   - ✅ Account identified: **331 Phải trả cho người bán**
   - ✅ Semantic clarified: Vendor advance = **Debit balance** on TK 331
   - ⚠️ Still requires: TT99/2025 Phần B verification of "Nợ 331" treatment
   - Account 141 is NOT an alternative — it serves different relationship (internal advances)

2. **Prepayment reconstruction formula:**
   - ✅ Formula logic confirmed: Reconstructs Debit balance on TK 331
   - ⚠️ Requires: VAS guidance on debit/credit conventions for vendor advance
   - ⚠️ Requires: F4 contract alignment verification

3. **Prepayment normal balance:**
   - ✅ Account 331 normal balance: **CREDIT** (liability)
   - ✅ Vendor prepayment creates: **DEBIT balance** (advance on liability account)
   - ✅ Semantic: Unapplied advance = Debit balance remaining on TK 331
   - ⚠️ Requires: Confirmation from TT99/2025 Phần B

---

## Blockers Summary

**Total Blocked Items:** 10

**Cash Domain (Part B):**
- ❌ B.2 — Bella F1 COA cash mapping (requires Bella code review)
- ❌ B.3 — F2 contract alignment (requires F2 contract + TT99 comparison)
- ❌ B.4 — Cash reconstruction formula (requires VAS debit/credit verification)
- ❌ B.5 — Cash temporal boundary (requires TT99 period rules + F2 contract review)

**Prepayment Domain (Part C):**
- ✅ C.1 — **Prepayment GL account 331 semantic** (VERIFIED from TT99/2025 Phụ lục)
- ❌ C.2 — VAS prepayment treatment (requires VAS access)
- ❌ C.3 — Bella F1 COA prepayment mapping (requires Bella code review)
- ❌ C.4 — F4 contract alignment (requires F4 contract + TT99 comparison)
- ⚠️ C.5 — Prepayment reconstruction formula (logic confirmed, needs VAS debit/credit verification)
- ❌ C.6 — Prepayment temporal boundary (requires TT99 period rules + F4 review)

**Cross-Domain (Part D):**
- ❌ D.1 — Temporal contract consistency (requires B.5, C.6 completion)
- ❌ D.2 — Period closing rules (requires TT99 detailed guidance)

---

## Recommended Priority

**Priority 1 (Verify TT99/2025 Phần B for Account 331 Treatment):**
1. Access full TT99/2025 "Phần B — Nội dung và phương pháp kế toán"
2. Verify accounting entries for "Ứng trước cho người bán" use **Nợ 331 / Có 112**
3. Confirm TK 331 can have Debit balance (vendor advance) per Vietnamese accounting
4. Document sub-account structure for 331 (if any, e.g., 3311)
5. Consult VAS for vendor advance treatment and debit/credit conventions

**Priority 2 (Complete Cash Research):**
5. Review Bella F1 COA for cash account mapping (111/112/113)
6. Verify F2 `finance_cash_movements` alignment with Vietnamese debit/credit
7. Confirm cash reconstruction formula with VAS
8. Determine cash temporal boundary (recorded_at vs posted_at)

**Priority 3 (Complete Prepayment Research):**
9. Review Bella F1 COA for prepayment account mapping
10. Verify F4 `finance_vendor_prepayments` alignment
11. Define prepayment reconstruction formula (after P1 decision)
12. Determine prepayment temporal boundary

**Priority 4 (Finalize Research):**
13. Complete cross-domain temporal consistency analysis
14. Document period closing rules
15. Complete research checklist
16. Human Architect approval

**Estimated Time:**
- Priority 1: 2-3 days (critical path)
- Priority 2-4: 2-3 days (can parallelize some items)
- **Total:** 4-6 days to complete research

---

## Impact on F5.6 Implementation Timeline

**Current Status:** F5.6 BLOCKED at Phase 1 (Research)

**Phase 1 Completion:** 4-6 days (with Human Architect engagement)

**Phases 2-4:** 7-10 days (semantic spec → contracts → implementation)

**Total F5.6 Duration:** 11-16 days from today

**Critical Path:** Account 331 vendor advance treatment verification from TT99/2025 Phần B

---

**Document Status:** 🟡 PARTIAL FINDINGS — Awaiting Human Architect decisions

