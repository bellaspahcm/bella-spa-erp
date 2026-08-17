# F5.6 A.3 Unresolved Questions Register

> **Document Type:** Research Gap Tracking  
> **Date:** 2026-08-16  
> **Status:** BLOCKING Gate 2 Approval  
> **Purpose:** Track every AMBIGUOUS, UNRESOLVED, or CRITICAL semantic that requires legal verification

---

## CRITICAL NOTICE

**This register tracks questions that CANNOT be answered by:**
- ❌ AI inference
- ❌ Big4 articles (unless citing primary authority)
- ❌ Business logic assumptions
- ❌ "Common practice" claims

**These questions MUST be answered by:**
- ✅ Primary legal authority (TT133/2016, TT99/2025, VAS)
- ✅ Official Ministry of Finance guidance
- ✅ Documented enterprise policy (when legal source permits choice)

---

## Question Categories

| Category | Count | Priority | Status |
|----------|-------|----------|--------|
| **CRITICAL** | 3 | BLOCKING | 1 VERIFIED, 2 UNRESOLVED |
| **AMBIGUOUS** | 12 | HIGH | 0 VERIFIED, 12 UNRESOLVED |
| **UNRESOLVED** | 8 | MEDIUM | 0 VERIFIED, 8 UNRESOLVED |
| **Total** | 23 | — | 1/23 (4%) VERIFIED |

---

## CRITICAL Questions (BLOCKING Gate 2)

### C-001: TK 331 Debit Balance Presentation (TT133)

**Question:**
> How should TK 331 debit balance (vendor prepayment) be presented in financial statements under TT133/2016?

**Current State:**
- **Finding:** TK 331 can have debit balance = vendor advance
- **TT133 Status:** IMPLICIT (no explicit FS line item guidance found)
- **Current Presentation:** "Phải thu ngắn hạn" (generic short-term receivables)
- **Confidence:** PROBABLE (Crowe 2016 + practice)

**Why CRITICAL:**
- Affects FS classification logic
- If TT133 requires different presentation than generic "receivables", current assumption breaks
- Need to verify from TT133 Phụ lục 1 or VAS guidance

**Required Evidence:**
- TT133/2016 Phụ lục 1 Phần B (Hướng dẫn sử dụng tài khoản kế toán)
- Section on TK 331 usage
- Any guidance on debit balance presentation

**Resolution Path:**
1. Access TT133/2016 official document
2. Locate TK 331 usage guidance
3. Check if debit balance presentation is specified
4. If NOT specified in TT133, check Decision 48/2006/QĐ-BTC (predecessor)

**Impact if UNRESOLVED:**
- Cannot prove EQUIVALENT classification for TK 331 vendor prepayment
- Historical reconstruction test for TT133 regime invalid
- C.2 implementation blocked

---

### C-002: TK 331 vs TK 141 Semantic Boundary (Legal Authority)

**Question:**
> Does Vietnamese accounting law EXPLICITLY prohibit using TK 141 for vendor prepayments, or is this just common practice?

**Current State:**
- **Finding:** TK 141 = Employee advances ONLY (verified from practice + Frappe ERP)
- **Legal Status:** NOT VERIFIED from primary authority
- **Assumption:** TK 141 scope excludes vendor prepayments
- **Confidence:** CONFIRMED (practice), UNVERIFIED (legal)

**Why CRITICAL:**
- If legal authority permits TK 141 for vendor prepayments, semantic model breaks
- Current matrix assumes strict boundary (TK 141 = employees, TK 331 = vendors)
- Need legal citation to prove boundary

**Required Evidence:**
- TT133/2016 Phụ lục 1 Phần B — TK 141 "Tạm ứng" usage guidance
- TT99/2025 Phụ lục II Phần B — TK 141 usage guidance
- Check if "tạm ứng" explicitly limited to employees or internal advances

**Resolution Path:**
1. Access TT133/2016 and TT99/2025 TK 141 guidance
2. Check definition of "tạm ứng" scope
3. Verify if vendor prepayments explicitly excluded
4. If ambiguous, check VAS guidance on prepayments

**Impact if UNRESOLVED:**
- Cannot prove TK 141 boundary
- Bella F1 implementation gap (C.3) may reopen
- Abstraction may fail if enterprises use TK 141 for vendor prepayments

---

### C-003: TK 142/244 → TK 242 Merge Semantics

**Question:**
> When TT99 merged TK 142 + TK 244 → TK 242, did the SEMANTIC of "prepaid expense" change, or only the account structure?

**Current State:**
- **Finding:** Account merge confirmed (Crowe 2016)
- **Semantic Status:** AMBIGUOUS
- **Current Classification:** MERGED
- **Open Question:** Does TK 242 have same semantic as (TK 142 + TK 244), or new semantic?

**Why CRITICAL:**
- Affects historical conversion logic
- If semantic changed, cannot simply map TK 142 → TK 242
- Need to verify if recognition/measurement/presentation rules changed

**Required Evidence:**
- TT99/2025 Phụ lục II Phần B — TK 242 usage guidance
- Compare with TT133/2016 TK 142 and TK 244 guidance
- Check if amortization rules, recognition timing, or presentation changed

**Resolution Path:**
1. Access TT99/2025 TK 242 guidance
2. Compare semantic scope with TT133 TK 142/244
3. Identify any semantic differences (not just account code)
4. Document merge rules (1-to-1, many-to-1, semantic shift)

**Impact if UNRESOLVED:**
- Cannot prove MERGED classification correct
- Historical conversion (TT133 → TT99) may fail
- Prepaid expense reconciliation (F5.6) blocked

---

## AMBIGUOUS Questions (HIGH Priority)

### A-001: Cash Recognition Timing (TK 111)

**Question:**
> When is cash recognized in TK 111 — upon physical receipt, upon custody transfer, or upon counting/verification?

**Current State:**
- **Matrix Claims:** "Upon physical receipt"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- "Physical receipt" is business modeling, not legal recognition rule
- Vietnamese accounting law may specify different timing
- Affects cash reconciliation timing in F5.6

**Required Evidence:**
- VAS 01 (General Standard) — recognition criteria
- TT133/2016 or TT99/2025 guidance on cash recognition
- Check if "received" means physical custody or accounting verification

**Impact if UNRESOLVED:**
- Cash reconciliation timing may be incorrect
- F5.6 reconstruction formula may use wrong temporal boundary

---

### A-002: Cash in Bank Recognition (TK 112)

**Question:**
> When is cash in bank recognized — upon deposit instruction, bank confirmation, or account statement?

**Current State:**
- **Matrix Claims:** "Upon bank confirmation"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- Bank confirmation timing varies (real-time, daily, monthly statement)
- Vietnamese accounting law may specify different trigger
- Affects uncleared deposits treatment

**Required Evidence:**
- VAS 01 — recognition criteria
- TT133/2016 or TT99/2025 guidance on bank deposits
- Check if uncleared deposits use TK 113 or TK 112

**Impact if UNRESOLVED:**
- Bank reconciliation timing incorrect
- Uncleared deposits may be misclassified

---

### A-003: Cash in Transit Recognition (TK 113)

**Question:**
> When is cash in transit recognized — upon dispatch, upon arrival, or upon bank confirmation?

**Current State:**
- **Matrix Claims:** "Upon dispatch instruction issued"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- Dispatch vs arrival timing creates dual-ledger risk
- Vietnamese accounting law may require specific treatment
- Affects cash reconciliation for in-transit amounts

**Required Evidence:**
- VAS 01 — recognition criteria
- TT133/2016 or TT99/2025 guidance on cash in transit
- Check if TK 113 requires bank confirmation to clear

**Impact if UNRESOLVED:**
- Cash in transit reconciliation timing incorrect
- Risk of double-counting or omission

---

### A-004: Employee Advance Clearing Timing (TK 141)

**Question:**
> When is employee advance cleared — upon expense report submission, approval, or final audit?

**Current State:**
- **Matrix Claims:** "Upon expense report approved"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- Approval vs audit timing affects period-end treatment
- Vietnamese accounting law may specify different timing
- Affects employee advance reconciliation

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on TK 141 clearing
- Check if approval sufficient or requires additional verification

**Impact if UNRESOLVED:**
- Employee advance clearing timing incorrect
- Period-end treatment may violate recognition rules

---

### A-005: Vendor Prepayment Recognition Timing (TK 331 debit)

**Question:**
> When is vendor prepayment recognized — upon payment instruction, bank debit, or vendor confirmation?

**Current State:**
- **Matrix Claims:** "Upon cash disbursement to vendor"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- Payment instruction vs bank debit timing varies
- Vietnamese accounting law may specify different trigger
- Affects vendor prepayment reconciliation timing

**Required Evidence:**
- VAS 01 — recognition criteria
- TT133/2016 or TT99/2025 guidance on advance payments
- Check if TK 331 debit recognized at payment or confirmation

**Impact if UNRESOLVED:**
- Vendor prepayment timing incorrect
- Prepayment reconciliation (F5.6) uses wrong boundary

---

### A-006: Vendor Prepayment Application Timing (TK 331 offset)

**Question:**
> When is vendor prepayment applied to invoice — upon invoice receipt, goods receipt, or matching completion?

**Current State:**
- **Matrix Claims:** "Upon invoice received from vendor"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- Invoice vs goods receipt timing affects matching
- Vietnamese accounting law may require specific matching rule
- Affects prepayment application logic

**Required Evidence:**
- VAS 01 or VAS 02 — matching principle
- TT133/2016 or TT99/2025 guidance on prepayment offset
- Check if prepayment application requires goods receipt

**Impact if UNRESOLVED:**
- Prepayment application timing incorrect
- Risk of mismatched prepayment vs invoice

---

### A-007: Vendor Invoice Recognition (TK 331 credit)

**Question:**
> When is vendor invoice recognized — upon invoice receipt, goods receipt, or matching of both?

**Current State:**
- **Matrix Claims:** "Invoice received + goods/services received"
- **Verification:** NOT VERIFIED from VAS
- **Confidence:** PROBABLE (assumed from matching principle)

**Why AMBIGUOUS:**
- Vietnamese VAS may specify different matching rule
- Affects treatment when invoice arrives before goods or vice versa
- Affects AP reconciliation logic

**Required Evidence:**
- VAS 01 or VAS 02 — recognition and matching
- Check if Vietnamese accounting requires both invoice + goods
- Verify treatment of invoice-only or goods-only scenarios

**Impact if UNRESOLVED:**
- Vendor invoice recognition timing incorrect
- AP reconciliation (F5.4) may violate recognition rules

---

### A-008: Vendor Payment Recognition (TK 331 payment)

**Question:**
> When is vendor payment recognized — upon payment instruction, bank debit, or vendor receipt confirmation?

**Current State:**
- **Matrix Claims:** "Upon payment confirmation"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- Payment confirmation timing varies by method
- Vietnamese accounting law may specify different trigger
- Affects payment in transit treatment

**Required Evidence:**
- VAS 01 — recognition criteria
- TT133/2016 or TT99/2025 guidance on payment recognition
- Check if payment in transit uses TK 113 or TK 331

**Impact if UNRESOLVED:**
- Payment recognition timing incorrect
- Payment in transit may be misclassified

---

### A-009: Short-term Prepaid Expense Recognition (TK 142/242)

**Question:**
> When is prepaid expense recognized — upon payment or upon service period start?

**Current State:**
- **Matrix Claims:** "Upon payment for future service"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from accrual principle)

**Why AMBIGUOUS:**
- Vietnamese accounting law may specify different timing
- Affects prepaid expense amortization start date
- Affects period-end treatment

**Required Evidence:**
- VAS 01 — accrual principle
- TT133/2016 or TT99/2025 guidance on prepaid expenses
- Check if recognition at payment or service start

**Impact if UNRESOLVED:**
- Prepaid expense recognition timing incorrect
- Amortization logic may be wrong

---

### A-010: Long-term Prepaid Expense Recognition (TK 244/242)

**Question:**
> When is long-term prepaid expense recognized — upon payment or upon service period start? How is >1 year threshold determined?

**Current State:**
- **Matrix Claims:** "Upon payment for future service (>1 year)"
- **Verification:** NOT VERIFIED from TT133/TT99
- **Confidence:** PROBABLE (assumed from practice)

**Why AMBIGUOUS:**
- >1 year threshold may be from payment date or service start
- Vietnamese accounting law may specify different rule
- Affects current vs non-current classification

**Required Evidence:**
- VAS 01 — current vs non-current classification
- TT133/2016 or TT99/2025 guidance on long-term prepayments
- Check if >1 year from payment or from service start

**Impact if UNRESOLVED:**
- Long-term prepaid expense classification incorrect
- Current vs non-current boundary wrong

---

### A-011: Merchandise Inventory Recognition (TK 156)

**Question:**
> When is merchandise inventory recognized — upon goods receipt, upon invoice receipt, or upon both?

**Current State:**
- **Matrix Claims:** "[AMBIGUOUS] Goods receipt or invoice?"
- **Verification:** NOT VERIFIED from VAS 02
- **Confidence:** AMBIGUOUS

**Why AMBIGUOUS:**
- Vietnamese VAS 02 (Inventories) may specify different rule
- Affects inventory reconciliation timing
- Affects treatment when goods arrive before invoice

**Required Evidence:**
- VAS 02 (Inventories) — recognition criteria
- Check if inventory recognized at goods receipt or invoice
- Verify treatment of goods-in-transit

**Impact if UNRESOLVED:**
- Inventory recognition timing incorrect
- Inventory reconciliation may violate VAS 02

---

### A-012: Fixed Asset Recognition (TK 211)

**Question:**
> When is fixed asset recognized — upon purchase, upon installation, or upon ready for intended use?

**Current State:**
- **Matrix Claims:** "Asset ready for intended use"
- **Verification:** NOT VERIFIED from VAS 03
- **Confidence:** PROBABLE (assumed from IFRS-like rule)

**Why AMBIGUOUS:**
- Vietnamese VAS 03 (Tangible Fixed Assets) may specify different rule
- Affects capitalization timing
- Affects depreciation start date

**Required Evidence:**
- VAS 03 (Tangible Fixed Assets) — recognition criteria
- Check if recognition at purchase, installation, or ready-for-use
- Verify treatment of assets under installation

**Impact if UNRESOLVED:**
- Fixed asset recognition timing incorrect
- Capitalization and depreciation logic wrong

---

## UNRESOLVED Questions (MEDIUM Priority)

### U-001: Cash Shortage/Overage Presentation

**Question:**
> How should cash shortage/overage be presented in financial statements?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Presentation rule for cash shortage/overage"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on cash differences
- Check if cash shortage uses TK 138 (other receivables) or direct expense
- Verify presentation treatment

---

### U-002: Uncleared Deposits Treatment

**Question:**
> How should uncleared bank deposits be classified — TK 112 or TK 113?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Treatment of uncleared deposits"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on uncleared deposits
- Check if uncleared uses TK 113 (in transit) or remains TK 112

---

### U-003: Cash in Transit Reconciliation

**Question:**
> When should cash in transit (TK 113) be reconciled with bank confirmation?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Reconciliation with bank confirmation"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on TK 113 clearing
- Check if TK 113 requires daily, weekly, or monthly reconciliation

---

### U-004: Long-overdue Employee Advances

**Question:**
> How should long-overdue employee advances be treated — provision, write-off, or reclassification?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Treatment of long-overdue advances"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on overdue advances
- Check if provision required (TK 229) or direct write-off

---

### U-005: Uncleared Employee Advances at Period-end

**Question:**
> How should uncleared employee advances be treated at fiscal period-end?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Treatment of uncleared advances at period-end"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on period-end treatment
- Check if uncleared advances require disclosure or adjustment

---

### U-006: Partial Vendor Prepayment Application

**Question:**
> How should partial vendor prepayment application be handled when invoice > prepayment?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Treatment of partial application"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on partial prepayment offset
- Check if partial application requires specific posting rule

---

### U-007: Goods vs Invoice Timing Mismatch

**Question:**
> How should mismatch between goods receipt and invoice receipt be treated?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Treatment when goods arrive before invoice or vice versa"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- VAS 02 or TT133/2016/TT99/2025 guidance on goods-invoice mismatch
- Check if goods-only uses TK 152/156 or suspense account
- Verify invoice-only treatment

---

### U-008: Payment in Transit Treatment

**Question:**
> How should payment in transit be classified — TK 113 or TK 331 credit?

**Current State:**
- **Matrix Notes:** "[UNRESOLVED] Treatment of payment in transit"
- **Confidence:** UNRESOLVED

**Required Evidence:**
- TT133/2016 or TT99/2025 guidance on payment in transit
- Check if payment in transit uses TK 113 or remains TK 331

---

## Resolution Timeline

### Phase 1: Primary Authority Access (1-2 days)

**Objective:** Obtain official TT133/2016, TT99/2025, and relevant VAS documents

**Tasks:**
1. Access TT133/2016 Phụ lục 1 Phần B (Hướng dẫn sử dụng tài khoản)
2. Access TT99/2025 Phụ lục II Phần B (Hướng dẫn sử dụng tài khoản)
3. Access VAS 01 (General Standard)
4. Access VAS 02 (Inventories)
5. Access VAS 03 (Tangible Fixed Assets)

**Deliverable:** PDF/document library with primary sources

---

### Phase 2: CRITICAL Questions Resolution (2-3 days)

**Objective:** Resolve C-001, C-002, C-003 (BLOCKING questions)

**Tasks:**
1. Research TK 331 debit balance presentation (TT133)
2. Verify TK 141 vs TK 331 semantic boundary (legal citation)
3. Analyze TK 142/244 → TK 242 merge semantics

**Deliverable:** Updated Semantic Matrix v0.3 with CRITICAL questions resolved

---

### Phase 3: AMBIGUOUS Questions Resolution (3-4 days)

**Objective:** Resolve A-001 through A-012 (HIGH priority)

**Tasks:**
1. Research recognition timing for all accounts (TK 111, 112, 113, 141, 331, 142/244/242, 156, 152, 211)
2. Verify measurement basis from VAS
3. Document posting contexts with legal citations

**Deliverable:** Updated Semantic Matrix v0.4 with AMBIGUOUS questions resolved

---

### Phase 4: UNRESOLVED Questions Resolution (2-3 days)

**Objective:** Resolve U-001 through U-008 (MEDIUM priority)

**Tasks:**
1. Research presentation rules
2. Verify period-end treatments
3. Document exception handling rules

**Deliverable:** Updated Semantic Matrix v1.0 with all questions resolved

---

## Gate 2 Blocking Criteria

**Gate 2 CANNOT PASS if:**
- ❌ ANY CRITICAL question unresolved
- ❌ >50% AMBIGUOUS questions unresolved
- ❌ >75% UNRESOLVED questions unresolved

**Gate 2 CAN PASS if:**
- ✅ ALL CRITICAL questions resolved
- ✅ ≥50% AMBIGUOUS questions resolved
- ✅ ≥25% UNRESOLVED questions resolved
- ✅ Remaining questions documented with mitigation plan

---

## Current Status

**Overall Progress:** 1/23 (4%) VERIFIED

**By Category:**
- CRITICAL: 1/3 (33%) — C-002 partially verified (practice), C-001 + C-003 unresolved
- AMBIGUOUS: 0/12 (0%) — All unresolved
- UNRESOLVED: 0/8 (0%) — All unresolved

**Gate 2 Status:** 🔴 **BLOCKED** (CRITICAL questions unresolved)

**Estimated Resolution Time:** 8-12 days (with primary authority access)

---

**Document Status:** Unresolved Questions Register v0.1  
**Next:** Access primary legal authorities (TT133/2016, TT99/2025, VAS)  
**Blocking:** Gate 2 approval, C.2 implementation  
**Assessment:** "Every AMBIGUOUS or UNRESOLVED semantic must be flagged instead of guessed."
