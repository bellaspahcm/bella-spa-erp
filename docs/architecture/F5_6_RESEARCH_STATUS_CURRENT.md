# F5.6 Vietnamese Accounting Research — Current Status

> **Last Updated:** 2026-08-16  
> **Phase:** Vietnamese Accounting Semantic Research (Phase 1 of F5.6)  
> **Overall Status:** 🟡 IN PROGRESS — Fundamental semantic resolved, implementation verification pending  
> **Authority:** F5-S0 Constitutional Amendment

---

## Executive Summary

**Fundamental Semantic Blocker:** 🟢 **RESOLVED**
- Vendor prepayment semantic confirmed from TT99/2025
- TK 331 (NOT TK 141) verified as correct GL account

**F5.6 Implementation Gate:** 🔴 **BLOCKED**
- C.2-C.6 verification pending
- Part B (Cash) incomplete
- Part D (Cross-domain) incomplete

**Progress:** ~25% (2/12 research items complete)

---

## Research Progress Matrix

| Part | Item | Description | Status | Source |
|------|------|-------------|--------|--------|
| **A** | A.1 | Legal framework | 🟡 Partial | TT99/2025 Phụ lục II |
| | A.2 | VAS applicability | 🔴 Pending | VAS 01, 24 |
| | **A.3** | **Regime Versioning** | 🔴 **CRITICAL** | einvoice.vn + F5-S0.2 |
| **B** | B.1 | Cash accounts COA | 🟢 **GREEN** | TT99/2025 |
| | B.2 | Bella F1 cash mapping | 🔴 Pending | Code review |
| | B.3 | F2 contract alignment | 🔴 Pending | F2 + TT99 |
| | B.4 | Cash formula | 🔴 Pending | VAS |
| | B.5 | Cash temporal | 🔴 Pending | TT99 + F2 |
| **C** | C.1 | Vendor prepayment semantic | 🟢 **GREEN** | TT99/2025 Phụ lục |
| | **C.1b** | **TT133/2016 vendor prepayment** | 🔴 **NEW** | TT133/2016 |
| | C.2 | VAS treatment | 🔴 **BLOCKED (A.3)** | TT99 + TT133 Phần B |
| | C.3 | Bella F1 prepayment mapping | 🟡 **GAP DETECTED** | Code review |
| | **C.4** | **Regime semantic equivalence** | 🔴 **NEW (A.3)** | TT133 vs TT99 |
| | C.5 | Prepayment formula | 🟡 **DERIVED** | Logic + VAS |
| | C.6 | Prepayment temporal | 🔴 Pending | TT99 + F4 |
| **D** | D.1 | Temporal consistency | 🔴 Pending | Cross-domain |
| | D.2 | Period closing | 🔴 Pending | TT99 |

**Legend:**
- 🟢 GREEN = Legally verified from TT99/2025
- 🟡 DERIVED = Logic sound, pending legal verification
- 🔴 BLOCKED = Not started or incomplete

---

## Completed Items (2/12)

### B.1 — Cash Accounts (TT99/2025) ✅

**Verified:**
- 111 Tiền mặt (Cash on hand)
- 112 Tiền gửi không kỳ hạn (Non-term deposits)
- 113 Tiền đang chuyển (Cash in transit)

**Status:** 🟢 **GREEN** — Confirmed from TT99/2025 Phụ lục II

---

### C.1 — Vendor Prepayment Semantic (TT99/2025) ✅

**Verified:**
- Vendor prepayment belongs to **TK 331** (Phải trả cho người bán)
- TK 331 can have **Debit balance** (vendor advance)
- Tracked **per vendor** (theo từng đối tượng người bán)
- Balance Sheet: "Trả trước cho người bán" (Current Asset)
- TK 141 is for **employee advances ONLY** (NOT vendor)

**Status:** 🟢 **GREEN** — Confirmed from TT99/2025 Phụ lục

**Constitutional Finding:** F5.6-SEM-001

**TT99/2025 Evidence:**
> "TK 331 phản ánh cả số tiền đã ứng trước cho người bán... 
> TK 331 có thể có số dư bên Nợ. Số dư Nợ phản ánh: 
> số tiền đã ứng trước cho người bán..."

---

## Derived Items (1/12)

### C.5 — Prepayment Reconstruction Formula 🟡

**Formula:**
```sql
vendor_prepayment_balance_per_vendor = SUM(
  CASE fact_type
    WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- Debit TK 331
    WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor  -- Credit TK 331
    WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- Credit TK 331
  END
)
```

**Status:** 🟡 **DERIVED** — Logic sound based on C.1, but NOT yet legally verified

**Why Derived:**
- C.1 confirms: vendor advance → Debit balance TK 331
- Formula logic reconstructs Debit balance
- BUT: Each fact type → Debit/Credit mapping needs TT99 Phần B or VAS verification

**Remaining Verification:**
- ❌ `PREPAYMENT_RECORDED` → Debit TK 331 (accounting entry)
- ❌ `PREPAYMENT_APPLIED` → Credit TK 331 (accounting entry)
- ❌ `PREPAYMENT_REFUNDED` → Credit TK 331 (accounting entry)

**Important:** C.1 semantic does NOT automatically verify entire formula.

---

## Pending Items (9/12)

### Critical Path Items

**C.3 — Bella F1 COA Prepayment Mapping 🟡 GAP DETECTED**
- **Status:** Architectural gap detected, awaiting Human Architect decision
- **Document:** `F5_6_C3_BELLA_F1_IMPLEMENTATION_GAP.md`
- **Gap:** Bella uses symbolic code `'PREPAYMENT_ASSET'` instead of direct TK 331
- **Hypotheses:**
  - Gap Type A: `'PREPAYMENT_ASSET'` maps to TK 331 (symbolic mapping strategy)
  - Gap Type B: Bella has architectural mismatch with TT99/2025
- **Evidence Required:** Query `finance_accounts` table to verify account mapping
- **Why Critical:** TT99 specifies TK 331, but Bella implementation uses different code
- **F5-S0 Principle:** Legal framework ≠ Implementation

**C.2 — VAS Treatment 🔴**
- Access VAS guidance on vendor advance debit/credit conventions
- Verify each F4 fact type → accounting entry mapping

**C.4 — F4 Contract Alignment 🔴**
- Compare F4 contract fact types with TT99 accounting entries
- Verify semantic alignment

**C.6 — Prepayment Temporal Boundary 🔴**
- TT99 period closing rules
- F4 contract temporal column verification

### Cash Domain Items

**B.2 — Bella F1 Cash Mapping 🔴**
- Verify `finance_bank_accounts` → TK 111/112/113 mapping

**B.3 — F2 Contract Alignment 🔴**
- F2 contract + TT99 debit/credit comparison

**B.4 — Cash Reconstruction Formula 🔴**
- VAS verification of cash debit/credit conventions

**B.5 — Cash Temporal Boundary 🔴**
- TT99 period rules + F2 contract verification

### Cross-Domain Items

**D.1 — Temporal Consistency 🔴**
- F1/F2/F4 temporal contract alignment

**D.2 — Period Closing Rules 🔴**
- TT99 period closing guidance

---

## Key Distinctions Established

### 1. TK 141 vs TK 331 (TT99/2025 Confirmed)

| Account | Purpose | Counterparty | F5.6 Scope |
|---------|---------|--------------|------------|
| **TK 141** | Tạm ứng nhân viên | **Internal employee** | ❌ NOT in F5.6 |
| **TK 331** | Phải trả NB + Ứng trước NB | **External vendor** | ✅ F5.6 Prepayment |

**No Longer a Choice:** TK 331 is confirmed (NOT "141 vs 331 decision").

### 2. TK 331 Semantic (TT99/2025 Confirmed)

```
TK 331 — Phải trả cho người bán:
  ├── Credit balance → Vendor payable (Liability side)
  └── Debit balance  → Vendor advance (Asset presentation)
```

**Important:** TK 331 remains a LIABILITY account.  
Debit balance is **presented** as Current Asset, but account type unchanged.

### 3. F5.6 Reconciliation Semantic

```
F5.6 PREPAYMENT_GL_BALANCE
≠
ASSET_ACCOUNT_BALANCE

F5.6 PREPAYMENT_GL_BALANCE
=
DEBIT POSITION OF VENDOR TK 331
```

**Must Reconcile:** Per vendor (NOT system-wide aggregate).

---

## What Is Verified vs What Remains

### ✅ Verified from TT99/2025

1. ✅ Cash accounts: 111, 112, 113
2. ✅ Vendor prepayment belongs to TK 331
3. ✅ TK 331 can have Debit balance (vendor advance)
4. ✅ Tracked per vendor
5. ✅ Balance Sheet presentation: "Trả trước cho người bán"
6. ✅ TK 141 is employee advances ONLY

### ❌ NOT Yet Verified

1. ❌ Bella F1 actual posting to TK 331 (implementation check)
2. ❌ VAS debit/credit conventions for each fact type
3. ❌ F4 contract semantic alignment with TT99
4. ❌ Reconstruction formula legal verification
5. ❌ Temporal boundary specification
6. ❌ Cash domain remaining items (B.2-B.5)
7. ❌ Cross-domain items (D.1-D.2)

---

## F5-S0 Compliance Status

**Boundary Maintained:**

```
TT99/2025 Legal Semantic  ← VERIFIED (C.1)
        ↓
(F5-S0 BOUNDARY)
        ↓
Bella Implementation      ← NOT YET VERIFIED (C.3)
        ↓
F5 Reconciliation Logic
```

**C.1 closes legal semantic.**  
**C.3 must close implementation verification.**  
**This boundary is essential to F5-S0.**

---

## Implementation Gate Status

**Fundamental Semantic Blocker:**
- Status: 🟢 **RESOLVED**
- Resolution: Vendor prepayment → TK 331 (confirmed from TT99/2025)
- Finding: F5.6-SEM-001

**F5.6 Overall Implementation Gate:**
- Status: 🔴 **BLOCKED**
- Blockers:
  - C.2 — VAS treatment
  - C.3 — Bella F1 implementation (CRITICAL)
  - C.4 — F4 contract alignment
  - C.5 — Formula legal verification
  - C.6 — Temporal boundary
  - B.2-B.5 — Cash domain
  - D.1-D.2 — Cross-domain

**Cannot Proceed to Coding Until:**
- All research items (B, C, D) GREEN or DERIVED with clear documentation
- Human Architect approves semantic specification
- Temporal contracts created

---

## Next Steps (Priority Order)

### Priority 1 — Complete Part C (Vendor Prepayment)

1. ✅ C.1 — Semantic (DONE)
2. ❌ C.2 — Access TT99/2025 Phụ lục II Phần B, verify debit/credit conventions
3. 🟡 **C.3 — Bella F1 code review** (GAP DETECTED — awaiting Human Architect decision on account mapping)
4. ❌ C.4 — F4 contract alignment verification
5. ⚠️ C.5 — Formula legal verification (upgrade DERIVED → GREEN)
6. ❌ C.6 — Temporal boundary

### Priority 2 — Complete Part B (Cash)

7. ✅ B.1 — Cash accounts (DONE)
8. ❌ B.2 — Bella F1 cash mapping
9. ❌ B.3 — F2 contract alignment
10. ❌ B.4 — Cash formula verification
11. ❌ B.5 — Cash temporal boundary

### Priority 3 — Complete Part D (Cross-Domain)

12. ❌ D.1 — Temporal consistency
13. ❌ D.2 — Period closing rules

### Priority 4 — Finalize

14. Update semantic specification with findings
15. Human Architect approval
16. Create temporal contracts
17. **AI coding begins**

---

## Estimated Timeline

**Research Completion:** 4-6 days
- Part C completion: 2-3 days
- Part B completion: 1-2 days
- Part D completion: 1 day

**F5.6 Total:** 11-16 days (unchanged)

**Critical Path:** C.3 Bella F1 implementation verification

---

## Key Documents

**Constitutional:**
- `F5_0_1_CONSTITUTIONAL_AMENDMENT_VIETNAMESE_ACCOUNTING.md` — F5-S0
- `F5_6_CONSTITUTIONAL_FINDING_SEM_001.md` — Vendor prepayment semantic

**Research:**
- `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` — Main research document
- `F5_6_TT99_VENDOR_PREPAYMENT_SEMANTIC_BREAKTHROUGH.md` — C.1 evidence
- `F5_6_DOMAIN_BOUNDARY_VERIFICATION.md` — F4 contract analysis

**Status:**
- `F5_6_CASH_PREPAYMENT_CHECKLIST.md` — Implementation gate checklist
- `F5_STATUS_SUMMARY.md` — Overall F5 status

---

**Current Status:** 🟡 IN PROGRESS (25% complete, fundamental semantic resolved)  
**Implementation Gate:** 🔴 BLOCKED (C.2-C.6, Part B, Part D pending)  
**Critical Path:** C.3 Bella F1 implementation verification

