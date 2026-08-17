# F5.6 Cash + Prepayment — Pre-Implementation Checklist

> **Status:** 🔴 BLOCKED — Vietnamese accounting semantic research required
> **Phase:** F5.6 Cash + Prepayment GL Balance control domains
> **Dependency:** F5.5 AR_GL_BALANCE must be FROZEN (✅ complete)
> **Constitution:** F5.0 Constitution v1.2-Final + Amendment S0 (v1.2.1)
> **Semantic Authority:** F5-S0 Vietnamese Accounting Semantic Authority

---

## Purpose

This checklist ensures F5.6 implementation does NOT begin until:
1. Vietnamese accounting semantic research is complete (TT99/2025 + VAS)
2. All semantic boundaries derived from legal framework
3. Contract dependencies explicitly specified
4. Human Architect approves semantic specification

**No AI coding until all items are GREEN.**

**Per F5-S0 Constitutional Amendment:**
> "F5 reconciliation semantics SHALL be derived from Vietnamese accounting legal framework.
> AI SHALL NOT invent accounting treatment, account mapping, debit/credit convention,
> recognition timing, or reconstruction formulas."

---

## 🔴 F5-S0 Compliance: Vietnamese Accounting Research

### ❌ Legal Framework Research

- [ ] **TT99/2025 Access:** Official Circular 99/2025/TT-BTC obtained and reviewed
- [ ] **VAS Review:** Relevant Vietnamese Accounting Standards (VAS 01, VAS 24) reviewed
- [ ] **Chart of Accounts:** TT99/2025 COA for Cash (111, 112, 113) and Prepayment (331, 142) verified
- [ ] **Authority Hierarchy:** Vietnamese Law → VAS → TT99/2025 → Enterprise Policy → F1 COA → F2/F4 → F5

**Status:** ❌ **PENDING** — Research required  
**Document:** `docs/architecture/F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md`  
**Blocker:** Cannot proceed with F5.6 until research complete per F5-S0 Amendment

### ❌ Cash Domain Research (Part B)

- [ ] **B.1:** TT99/2025 cash accounts (111, 112, 113) confirmed with official source
- [ ] **B.2:** Bella F1 COA mapping verified (bank_accounts.linked_finance_account_id)
- [ ] **B.3:** F2 contract alignment with Vietnamese debit/credit convention verified
- [ ] **B.4:** Cash reconstruction formula derived from Vietnamese accounting semantics
- [ ] **B.5:** Cash temporal boundary aligned with Vietnamese accounting period concepts

**Status:** ❌ **PENDING** — Research in progress  
**Blocker:** 5/5 research sections incomplete

### ❌ Prepayment Domain Research (Part C)

- [ ] **C.1:** TT99/2025 prepayment accounts (331/142/other) confirmed with official source
- [ ] **C.2:** VAS treatment of vendor advances documented
- [ ] **C.3:** Bella F1 COA prepayment mapping verified
- [ ] **C.4:** F4 contract alignment with Vietnamese prepayment semantics verified
- [ ] **C.5:** Prepayment reconstruction formula derived from Vietnamese accounting
- [ ] **C.6:** Prepayment temporal boundary aligned with Vietnamese accounting period

**Status:** ❌ **PENDING** — Research in progress  
**Blocker:** 6/6 research sections incomplete

### ❌ Cross-Domain Research (Part D)

- [ ] **D.1:** F1/F2/F4 temporal contract consistency verified
- [ ] **D.2:** Vietnamese accounting period closing rules documented

**Status:** ❌ **PENDING** — Research in progress  
**Blocker:** 2/2 research sections incomplete

### ❌ Human Architect Research Approval

- [ ] **Research Document:** All sections in `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` completed
- [ ] **Legal Citations:** All findings cite TT99/2025, VAS, or official MOF sources
- [ ] **Bella Alignment:** F1 COA alignment with Vietnamese COA verified
- [ ] **Human Sign-Off:** Human Architect certifies research complete and accurate

**Status:** ❌ **PENDING** — Awaiting Human Architect  
**Blocker:** Research document incomplete

---

## CASH_GL_BALANCE Semantic Specification

### ✅ F2 Public Temporal Contract (Source Identified)

- [x] **Contract Document:** `docs/architecture/frozen/F2_CONTRACT.md` (F2.5.0) — FOUND
- [x] **Contract Owner:** F2 Cash & Treasury module
- [x] **Source Table:** `finance_cash_movements` (confirmed in F2 contract)
- [x] **Existing API:** F2 has `getCashMovements()` public API

**Status:** ✅ **CONTRACT FOUND**  
**Note:** Temporal `as_of` version needs creation based on Vietnamese accounting research

### ❌ Cash → GL Account Mapping (TT99/2025 Research Required)

**Vietnamese Accounting Question:**
- According to TT99/2025 Chart of Accounts, which accounts represent cash?
  - 111 Tiền mặt (Cash on hand)?
  - 112 Tiền gửi ngân hàng (Cash in bank)?
  - 113 Tiền đang chuyển (Cash in transit)?

**Bella F1 COA Question:**
- How does `finance_bank_accounts.linked_finance_account_id` map to TT99/2025 accounts?
- Is mapping configurable per account or hardcoded?

**Status:** ❌ **BLOCKED** — Requires Vietnamese accounting research (Part B.1, B.2)  
**Document:** `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` Section B.1, B.2  
**Blocker:** Cannot specify GL account without TT99/2025 legal basis

### ❌ Cash Reconstruction Formula (Vietnamese Semantics Required)

**Vietnamese Accounting Question:**
- Per TT99/2025 and VAS, what is normal balance for cash accounts?
  - DEBIT-normal (asset)?
- What is debit/credit convention?
  - Cash increase = DEBIT (Nợ)?
  - Cash decrease = CREDIT (Có)?

**F2 Contract Alignment:**
- Does F2 `INFLOW` = Vietnamese debit (cash increase)?
- Does F2 `OUTFLOW` = Vietnamese credit (cash decrease)?

**Formula:**
```sql
-- PENDING Vietnamese accounting verification
cash_balance = SUM(
  CASE direction
    WHEN 'INFLOW' THEN amount_minor   -- Debit (TBD)
    WHEN 'OUTFLOW' THEN -amount_minor -- Credit (TBD)
  END
)
```

**Status:** ❌ **BLOCKED** — Requires Vietnamese accounting research (Part B.3, B.4)  
**Document:** `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` Section B.3, B.4  
**Blocker:** Cannot define formula without Vietnamese debit/credit convention

### ❌ Cash Temporal Boundary (Vietnamese Accounting Period)

**Vietnamese Accounting Question:**
- Per TT99/2025, which date determines accounting period inclusion?
  - Ngày nghiệp vụ (transaction date)?
  - Ngày hạch toán (posting date)?

**F2 Contract Temporal Column:**
- `finance_cash_movements.recorded_at` — Is this canonical?
- Or should use `f1_transaction.posted_at`?

**Status:** ❌ **BLOCKED** — Requires Vietnamese accounting research (Part B.5, D.1)  
**Document:** `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` Section B.5, D.1  
**Blocker:** Cannot satisfy G8 temporal determinism without Vietnamese accounting basis

---

## PREPAYMENT_GL_BALANCE Semantic Specification

### ✅ F4 Public Temporal Contract (Source Identified)

- [x] **Contract Document:** `docs/architecture/frozen/F4_CONTRACT.md` (F4.1.0) — FOUND
- [x] **Contract Owner:** F4 Accounts Payable module
- [x] **Source Table:** `finance_vendor_prepayments` (confirmed in F4 contract)
- [x] **Existing RPC:** F4 has `finance_calculate_payable_position()` RPC

**Status:** ✅ **CONTRACT FOUND**  
**Note:** Temporal `as_of` version needs creation based on Vietnamese accounting research

### ❌ Prepayment → GL Clearing Account (TT99/2025 Research Required)

**Vietnamese Accounting Question:**
- According to TT99/2025, which account represents vendor advances/prepayments?
  - 331 Phải trả cho người bán (sub-account 3311 for advances)?
  - 142 Chi phí trả trước (prepaid expenses)?
  - Other account?

**Accounting Treatment:**
- Is vendor prepayment an ASSET (debit-normal) or CONTRA-LIABILITY (credit-normal)?
- What is normal balance direction?

**Bella F1 COA Question:**
- Which account does F4 post prepayments to?
- Is it configurable or hardcoded?

**Status:** ❌ **BLOCKED** — Requires Vietnamese accounting research (Part C.1, C.3)  
**Document:** `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` Section C.1, C.3  
**Blocker:** Cannot specify GL account without TT99/2025 legal basis

### ❌ Prepayment Reconstruction Formula (Vietnamese Semantics Required)

**Vietnamese Accounting Question:**
- Per TT99/2025 and VAS, what are debit/credit conventions for:
  - Recording prepayment (advance paid)?
  - Applying prepayment (to invoice)?
  - Refunding prepayment?

**F4 Contract Fact Types:**
- `PREPAYMENT_RECORDED` — Maps to which accounting entry?
- `PREPAYMENT_APPLIED` — Maps to which accounting entry?
- `PREPAYMENT_REFUNDED` — Maps to which accounting entry?

**Formula:**
```sql
-- PENDING Vietnamese accounting verification
unapplied_prepayment = SUM(
  CASE fact_type
    WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- Debit? (TBD)
    WHEN 'PREPAYMENT_APPLIED' THEN -amount_minor   -- Credit? (TBD)
    WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- Credit? (TBD)
  END
)
```

**Status:** ❌ **BLOCKED** — Requires Vietnamese accounting research (Part C.2, C.4, C.5)  
**Document:** `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` Section C.2, C.4, C.5  
**Blocker:** Cannot define formula without Vietnamese debit/credit convention

### ❌ Prepayment Temporal Boundary (Vietnamese Accounting Period)

**Vietnamese Accounting Question:**
- Per TT99/2025, when is prepayment recognized in accounting period?
  - Ngày nghiệp vụ (payment date)?
  - Ngày hạch toán (posting date)?

**F4 Contract Temporal Column:**
- `finance_vendor_prepayments.created_at` — Is this canonical?
- Or should use `f1_transaction.posted_at`?

**Status:** ❌ **BLOCKED** — Requires Vietnamese accounting research (Part C.6, D.1)  
**Document:** `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` Section C.6, D.1  
**Blocker:** Cannot satisfy G8 temporal determinism without Vietnamese accounting basis

---

## Pre-Implementation Gate

**F5.6 implementation MUST NOT begin until:**

### Phase 1: Vietnamese Accounting Research (F5-S0 Compliance)
1. ❌ TT99/2025 + VAS research complete (`F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md`)
2. ❌ Cash domain research (Part B: 5 sections) — All GREEN
3. ❌ Prepayment domain research (Part C: 6 sections) — All GREEN
4. ❌ Cross-domain research (Part D: 2 sections) — All GREEN
5. ❌ Human Architect signs off on research findings

### Phase 2: Semantic Specification (Derived from Research)
6. ❌ `F5_6_CASH_PREPAYMENT_SEMANTIC_SPEC.md` updated with research findings
7. ❌ All semantic decisions cite Vietnamese accounting legal basis (TT99/2025, VAS)
8. ❌ Cash GL mapping derived from TT99/2025 COA + Bella F1 COA
9. ❌ Prepayment GL mapping derived from TT99/2025 COA + Bella F1 COA
10. ❌ Reconstruction formulas reflect Vietnamese debit/credit conventions
11. ❌ Temporal boundaries align with Vietnamese accounting period concepts
12. ❌ Human Architect approves semantic specification

### Phase 3: Contract Creation (Implementation Prerequisites)
13. ✅ F5.5 AR_GL_BALANCE FROZEN (COMPLETE — 8/8 tests pass)
14. ✅ F2 Cash source contract identified (`F2_CONTRACT.md` v2.5.0)
15. ✅ F4 Prepayment source contract identified (`F4_CONTRACT.md` v4.1.0)
16. ❌ F2 temporal contract `finance_cash_facts_as_of()` created
17. ❌ F4 temporal contract `finance_prepayment_facts_as_of()` created

### Phase 4: Only Then → AI Coding
18. ❌ F5.6 Cash implementation (migrations, engine, tests, G1-G8 proof)
19. ❌ F5.6 Prepayment implementation (migrations, engine, tests, G1-G8 proof)
20. ❌ F5.6 regression suite (verify F5.0-F5.5 still pass)

**Current Status:** 🔴 **BLOCKED at Phase 1** — Vietnamese accounting research required

**Progress:** 3/20 gates cleared (15%)
- ✅ F5.5 baseline frozen
- ✅ F2 contract found
- ✅ F4 contract found
- ❌ 17 gates remain (Vietnamese research → Semantic spec → Implementation)

---

## Next Steps (Human Architect Actions Required)

### Immediate (Phase 1: Research)

1. **Access TT99/2025 Official Documents**
   - Obtain Thông tư 99/2025/TT-BTC from Ministry of Finance
   - Review Chart of Accounts section
   - Document cash accounts (111, 112, 113)
   - Document prepayment accounts (331, 142, or other)

2. **Review Relevant VAS**
   - VAS 01 (General Standards) — Recognition and measurement
   - VAS 24 (Cash Flow Statements) — Cash equivalents definition
   - Extract debit/credit conventions
   - Document prepayment treatment

3. **Complete Research Document**
   - Fill in all `[TO BE COMPLETED BY HUMAN ARCHITECT]` sections
   - Cite official sources for all findings
   - Document Bella F1 COA alignment
   - Sign research approval (Part F.1)

### Then (Phase 2: Semantic Specification)

4. **Update Semantic Spec**
   - Transfer research findings to `F5_6_CASH_PREPAYMENT_SEMANTIC_SPEC.md`
   - Resolve 4 blocked items for Cash domain
   - Resolve 4 blocked items for Prepayment domain
   - Add legal citations for every semantic decision
   - Get Human Architect approval

### Then (Phase 3: Contract Creation)

5. **Create Temporal Contracts**
   - F2: Create `finance_cash_facts_as_of()` function
   - F4: Create `finance_prepayment_facts_as_of()` function
   - Update F2/F4 contract documents with version bump

### Finally (Phase 4: Implementation)

6. **AI Coding Begins** (only after gates 1-17 GREEN)
   - Generate F5.6 migrations
   - Implement cash reconciliation engine
   - Implement prepayment reconciliation engine
   - Write integration tests
   - Generate G1-G8 proof documents
   - Run regression suite

**No AI coding until gates 1-17 are GREEN.**

