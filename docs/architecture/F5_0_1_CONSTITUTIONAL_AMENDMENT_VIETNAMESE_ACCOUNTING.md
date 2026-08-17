# F5.0.1 Constitutional Amendment — Vietnamese Accounting Semantic Authority

> **Status:** 🟢 APPROVED — Effective immediately for F5.6+  
> **Amends:** F5.0 Constitution v1.2-Final  
> **Authority:** Human Architect  
> **Date:** 2026-08-23  
> **Rationale:** Establish accounting semantic baseline for Vietnamese enterprises

---

## Amendment Purpose

F5.0 Constitution established 8 gates (G1–G8) for reconciliation architecture but did not specify **where financial semantics originate**.

This amendment adds **F5-S0 (Semantic Authority)** to ensure F5 reconciliation logic derives from Vietnamese accounting legal framework, not AI invention.

---

## F5-S0: Vietnamese Accounting Semantic Authority (P0)

### Constitutional Rule

**F5 reconciliation semantics SHALL be derived from the applicable Vietnamese accounting legal framework and the enterprise's approved accounting policy/Chart of Accounts.**

**AI SHALL NOT invent:**
- Accounting treatment
- Account mapping
- Debit/credit convention  
- Recognition timing
- Reconstruction formulas

### Authority Hierarchy

F5 semantic decisions MUST follow this authority chain (in order):

```
1. Pháp luật kế toán Việt Nam (Vietnamese Accounting Law)
            ↓
2. Chuẩn mực kế toán Việt Nam (VAS — Vietnamese Accounting Standards)
            ↓
3. Thông tư / Chế độ kế toán hiện hành (Current Circular / Accounting Regime)
            ↓
4. Chính sách kế toán được doanh nghiệp phê duyệt (Enterprise Approved Policy)
            ↓
5. Bella F1 Chart of Accounts / Accounting Configuration
            ↓
6. F2/F3/F4 Public Contracts
            ↓
7. F5 Reconciliation Formulas
```

**Do NOT reverse this hierarchy.**

### Current Legal Framework

**Effective Regime:** Thông tư 99/2025/TT-BTC

**Effective Date:** 01/01/2026 (for fiscal years beginning on or after 2026-01-01)

**Replaces:** Thông tư 200/2014/TT-BTC

**Source:** Ministry of Finance Vietnam Official Announcements

**Key Coverage:**
- Accounting vouchers
- Chart of Accounts
- Ledger books and recording methods
- Financial statement preparation and presentation
- Foreign exchange difference treatment

**Transition Rule:** 
- Fiscal year 01/10/2025–30/09/2026 → Apply old regime (TT200)
- Fiscal year starting on/after 01/01/2026 → Apply TT99

**Bella Finance OS Baseline:** TT99/2025 (current regime)

---

## Implications for F5 Implementation

### Before F5-S0 (Incorrect Approach)

```
AI: "I think cash should map to account 111..."
AI: "Prepayment is probably account 141..."
AI: "Let's use DEBIT-normal for cash because it's an asset..."
```

**Problem:** AI invents accounting semantics based on assumptions, not legal framework.

### After F5-S0 (Correct Approach)

```
Step 1: Research Vietnamese accounting regime
        "According to TT99/2025, cash accounts are..."
        
Step 2: Verify Bella F1 COA mapping
        "Bella F1 maps tiền gửi ngân hàng to account..."
        
Step 3: Document canonical mapping
        "F5 CASH_GL_BALANCE SHALL reconcile against..."
        
Step 4: Get Human Architect approval
        "Semantic specification approved by..."
        
Step 5: AI implements approved semantics
        "Implementation follows approved spec..."
```

### Specific Examples

**Example 1: Cash → GL Mapping**

❌ **Wrong:**
```typescript
// AI invention
const CASH_ACCOUNT = "111"; // Assumed without legal basis
```

✅ **Right:**
```typescript
// Derived from TT99/2025 + Bella COA
// According to TT99/2025 Chart of Accounts:
// - Tiền mặt: Account 111
// - Tiền gửi ngân hàng: Account 112
// Bella F1 COA maps bank_accounts.linked_finance_account_id → 112
const cashGLAccount = bankAccount.linked_finance_account_id; // Canonical
```

**Example 2: Prepayment Clearing Account**

❌ **Wrong:**
```sql
-- AI guess
WHERE account_code LIKE '331%' -- "Probably AP-related..."
```

✅ **Right:**
```sql
-- Derived from TT99/2025 + enterprise accounting policy
-- According to TT99/2025:
-- - Ứng trước cho người bán: Account 331 (if short-term)
-- - Chi phí trả trước: Account 142 (if prepaid expense)
-- Bella enterprise accounting policy designates: 331 for vendor advances
WHERE account_code = '331' -- Documented in accounting policy
```

**Example 3: Reconstruction Formula**

❌ **Wrong:**
```sql
-- AI assumption
unapplied = RECORDED - APPLIED -- "Seems logical..."
```

✅ **Right:**
```sql
-- Derived from VAS + enterprise policy
-- Per VAS and TT99/2025 treatment of vendor advances:
-- - Ghi tăng (debit) when advance paid: PREPAYMENT_RECORDED
-- - Ghi giảm (credit) when applied to invoice: PREPAYMENT_APPLIED  
-- - Ghi giảm (credit) when refunded: PREPAYMENT_REFUNDED
-- Net unapplied = remaining debit balance
unapplied_prepayment = 
    SUM(CASE fact_type
        WHEN 'PREPAYMENT_RECORDED' THEN amount_minor  -- Debit
        WHEN 'PREPAYMENT_APPLIED' THEN -amount_minor  -- Credit
        WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor -- Credit
    END)
```

---

## Vietnamese Accounting vs IFRS Positioning

### Accounting Framework Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  Bella Finance OS Accounting Framework                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRIMARY BASELINE                                           │
│  ┌───────────────────────────────────────────────┐         │
│  │  VAS / TT99 (Vietnamese Current Regime)       │         │
│  │  - Chart of Accounts (TT99/2025)              │         │
│  │  - VAS 01–26 (Vietnamese Accounting Standards)│         │
│  │  - Ministry of Finance guidance               │         │
│  └───────────────────────────────────────────────┘         │
│                          ↓                                   │
│              Vietnamese Accounting Native                   │
│                                                             │
│  OPTIONAL COMPATIBILITY LAYER                               │
│  ┌───────────────────────────────────────────────┐         │
│  │  IFRS Extension Layer                         │         │
│  │  - Activated per-enterprise basis             │         │
│  │  - Dual reporting capability                  │         │
│  │  - Not default for all enterprises            │         │
│  └───────────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Rationale

**Bella Finance OS serves Vietnamese enterprises first.**

Vietnamese accounting regime is the **primary baseline**, not IFRS.

**IFRS is:**
- An optional compatibility/extension layer
- Activated when enterprise requires dual reporting
- Not the default accounting truth

**This aligns with Vietnam reality:**
- MOF maintains Vietnamese accounting framework
- IFRS adoption follows specific roadmap/guidance
- Most SMEs follow Vietnamese regime, not IFRS

**References:**
- Ministry of Finance official announcements on Vietnamese standards
- MOF activities on international standards adoption roadmap

---

## Impact on F5.6 Cash + Prepayment

### Previous Approach (Pre-S0)

F5_6_CASH_PREPAYMENT_SEMANTIC_SPEC.md had 4 blocked items:
- ❌ GL account mapping undefined
- ❌ Reconstruction formula unapproved
- ❌ Normal balance type unconfirmed
- ❌ Temporal boundary unverified

**Approach:** "Human Architect decides these items"

**Problem:** No framework for HOW to decide.

### New Approach (Post-S0)

**Step 1:** Research Vietnamese accounting semantics
- TT99/2025 Chart of Accounts
- VAS relevant to Cash/AP/Prepayments
- Enterprise accounting policy

**Step 2:** Document findings in:
```
F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md
```

**Step 3:** Derive F5.6 semantics from research:
```
F5_6_CASH_PREPAYMENT_SEMANTIC_SPEC.md (updated)
```

**Step 4:** Human Architect approves based on legal framework

**Step 5:** AI implements approved semantics

**Step 6:** Verify G1–G8 compliance

---

## Enforcement Mechanism

### Pre-Coding Gate Protocol (Updated)

F5 Pre-Coding Gate Protocol (docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md) is amended to require:

**Before F5.X implementation:**
1. ✅ F5-S0 compliance check
2. ✅ Vietnamese accounting research document
3. ✅ Semantic specification derived from legal framework
4. ✅ Human Architect approval with legal citation
5. ✅ Only then → AI coding

### Quality Gate Questions

For each F5 semantic decision, answer:

1. **Legal Basis:** Which Vietnamese accounting law/standard supports this?
2. **COA Mapping:** How does Bella F1 COA reflect this?
3. **Contract Alignment:** Do F2/F3/F4 contracts support this?
4. **Accounting Policy:** Is this consistent with enterprise policy?
5. **Audit Trail:** Can this be verified against legal framework?

If any answer is "AI assumption" or "seems logical" → **BLOCKED**.

---

## Temporal Semantics (Accounting Perspective)

### Vietnamese Accounting Period Concepts

F5 temporal boundary (`reconciliation_as_of`) must align with Vietnamese accounting concepts:

| Vietnamese Term | English | F5 Relevance |
|-----------------|---------|--------------|
| **Ngày nghiệp vụ** | Transaction date | Business event occurrence |
| **Ngày ghi nhận** | Recognition date | When accounting records event |
| **Ngày hạch toán** | Posting date | When posted to ledger |
| **Ngày chứng từ** | Voucher date | Document date |
| **Ngày khóa sổ** | Book closing date | Period closing |
| **Kỳ kế toán** | Accounting period | Fiscal period |

**F5 Rule:** Reconciliation as_of T MUST see only facts recognized/posted in periods ending <= T.

**Not arbitrary:** Must follow Vietnamese accounting period definition and book closing rules per TT99/2025.

---

## Example: Cash GL Mapping Decision Tree

```
Question: Which GL account does F5 reconcile against for cash?
                            ↓
Step 1: Check TT99/2025 Chart of Accounts
        - Tiền mặt: 111
        - Tiền gửi ngân hàng: 112
        - Tiền đang chuyển: 113
                            ↓
Step 2: Check Bella F1 COA configuration
        - finance_bank_accounts.linked_finance_account_id
        - Maps to: finance_accounts (F1 COA)
                            ↓
Step 3: Verify F2 contract alignment
        - finance_cash_movements linked to bank_account_id
        - bank_account_id → linked_finance_account_id → F1 account
                            ↓
Step 4: Document canonical mapping
        "F5 CASH_GL_BALANCE reconciles bank_account via
         linked_finance_account_id (per TT99/2025 account 112)"
                            ↓
Step 5: Get approval with legal citation
        ✅ Approved by Human Architect
                            ↓
Step 6: AI implements approved mapping
        ✅ Code generated with legal documentation
```

---

## Research Requirements for F5.6

Before F5.6 implementation, research and document:

### Cash Domain
- [ ] TT99/2025 accounts for cash and bank deposits (111, 112, 113)
- [ ] VAS treatment of cash recognition
- [ ] Bella F1 COA mapping for bank accounts
- [ ] F2 Cash contract alignment with Vietnamese regime

### Prepayment Domain
- [ ] TT99/2025 accounts for vendor advances (331 or 142?)
- [ ] VAS treatment of prepayment recognition and application
- [ ] Debit/credit convention for prepayment transactions
- [ ] Bella F1 COA mapping for prepayments
- [ ] F4 AP contract alignment with Vietnamese regime

### Temporal Semantics
- [ ] TT99/2025 accounting period definition
- [ ] Book closing rules
- [ ] Recognition timing (ngày ghi nhận vs ngày hạch toán)
- [ ] F1/F2/F4 posted_at / created_at alignment

---

## Amendment Status

**Amendment:** F5-S0 Vietnamese Accounting Semantic Authority  
**Status:** 🟢 **APPROVED** — Effective immediately  
**Applies To:** All F5 phases starting from F5.6  
**Retroactive:** F5.0–F5.5 are FROZEN, no retroactive changes

**Constitutional Version:**
- Before: F5.0 Constitution v1.2-Final
- After: F5.0 Constitution v1.2-Final + Amendment S0 (v1.2.1)

---

## Conclusion

```
┌──────────────────────────────────────────────────────────────┐
│  F5-S0 CONSTITUTIONAL RULE                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  F5 reconciliation semantics SHALL be derived from           │
│  Vietnamese accounting legal framework.                      │
│                                                              │
│  AI SHALL NOT invent accounting treatment, account           │
│  mapping, debit/credit convention, recognition timing,       │
│  or reconstruction formulas.                                 │
│                                                              │
│  Authority Hierarchy:                                        │
│  1. Vietnamese Accounting Law                                │
│  2. VAS (Vietnamese Accounting Standards)                   │
│  3. TT99/2025 (Current Regime)                              │
│  4. Enterprise Accounting Policy                             │
│  5. Bella F1 COA                                             │
│  6. F2/F3/F4 Contracts                                       │
│  7. F5 Reconciliation Logic                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**This amendment protects Bella Finance OS from becoming an accounting regime invented by AI assumptions.**

**Next Step:** Create `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md` to investigate TT99/2025 + VAS for Cash and Prepayment domains.

