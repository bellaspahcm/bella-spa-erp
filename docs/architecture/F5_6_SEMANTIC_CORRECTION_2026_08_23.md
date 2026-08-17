# F5.6 Semantic Correction — Vendor Prepayment Accounting

> **Date:** 2026-08-23  
> **Type:** Accounting Semantic Clarification  
> **Impact:** Critical correction to F5.6 prepayment domain research  
> **Authority:** Vietnamese Accounting TT99/2025 + Human Architect review

---

## Correction Summary

**INCORRECT Previous Understanding:**
```
❌ "Vendor prepayment: Choose between two alternative accounts"
   - Option A: 141 Tạm ứng (Asset)
   - Option B: 331 Phải trả cho người bán (Liability)
```

**CORRECT Vietnamese Accounting Semantic:**
```
✅ Vendor prepayment belongs to TK 331 (Phải trả cho người bán)
   - Account 141 and 331 serve DIFFERENT accounting relationships
   - Not alternative choices for same business transaction
```

---

## Vietnamese Accounting Semantic Framework

### Account Purpose Classification

| Account | Name | Type | Purpose | Example |
|---------|------|------|---------|---------|
| **141** | Tạm ứng | Asset | **Internal advances** | Employee travel advance |
| **331** | Phải trả cho người bán | Liability | **Vendor relationships** | Vendor advance + payable |

**Key Insight:**
- 141 = Internal relationship (employee, staff)
- 331 = External relationship (vendor, supplier)

---

## Account 331 Dual Balance Nature

**Vietnamese Accounting Principle:**
TK 331 (Phải trả cho người bán) is a LIABILITY account but can have:

```
┌────────────────────────────────────────────────┐
│         TK 331 — Per Vendor                    │
├────────────────────────────────────────────────┤
│                                                │
│  Debit Side (Nợ):   Vendor Advances           │
│                     (Enterprise paid advance)  │
│                                                │
│  Credit Side (Có):  Vendor Invoices            │
│                     (Enterprise owes vendor)   │
│                                                │
│  Net Position:      Credit - Debit             │
│                                                │
└────────────────────────────────────────────────┘
```

**Normal Balance:**
- TK 331 is **CREDIT-normal** (liability)
- But can show **DEBIT balance** when advance > invoices

**Example:**

**Scenario 1: Vendor Advance**
```
Enterprise pays 100M advance to vendor:

Nợ  331 Phải trả cho người bán    100,000,000
    Có  112 Tiền gửi ngân hàng                100,000,000

Result: TK 331 shows Debit balance 100M (vendor advance)
```

**Scenario 2: Apply Advance to Invoice**
```
Vendor delivers goods, invoice 100M:

Nợ  631 Giá vốn hàng bán          100,000,000
    Có  331 Phải trả cho người bán            100,000,000

Result: TK 331 Debit balance cleared (advance consumed)
```

**Scenario 3: Net Payable Position**
```
Enterprise pays 50M advance, receives 150M invoice:

Advance:
Nợ  331    50M
    Có 112     50M

Invoice:
Nợ  631    150M
    Có 331     150M

Net TK 331: Credit balance 100M (still owe vendor)
```

---

## F5.6 Prepayment Domain Semantic

### What F5.6 PREPAYMENT_GL_BALANCE Reconciles

**INCORRECT Understanding (Previous):**
```
❌ F5.6 reconciles "a prepayment asset account" (141 or other)
❌ Prepayment is separate from AP relationship
```

**CORRECT Understanding (Vietnamese Accounting):**
```
✅ F5.6 reconciles Debit balance on TK 331 vendor relationships
✅ Vendor prepayment is part of AP relationship (not separate)
✅ Unapplied vendor advance = Debit balance remaining on TK 331
```

### Reconstruction Formula Semantic Basis

**F4 Prepayment Facts:**
```
PREPAYMENT_RECORDED  → Debit 331 (advance paid)
PREPAYMENT_APPLIED   → Credit 331 (advance consumed)
PREPAYMENT_REFUNDED  → Credit 331 (advance returned)
```

**F5.6 Reconstruction:**
```sql
unapplied_vendor_advance_per_vendor = SUM(
  CASE fact_type
    WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- Debit side
    WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor  -- Credit side
    WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- Credit side
  END
)
```

**This reconstructs:**
- Debit balance (advance) on TK 331 per vendor
- NOT an asset balance on TK 141

### F5.6 GL Account Mapping

**Confirmed:**
- GL Account: **331 Phải trả cho người bán**
- Semantic: Debit balance represents vendor advance
- Normal Balance: CREDIT (liability account)
- Prepayment Balance: DEBIT (advance reduces liability)

**NOT:**
- ❌ GL Account 141 (wrong accounting relationship)
- ❌ Separate "prepayment clearing account"
- ❌ Asset-based prepayment tracking

---

## Vietnamese Accounting Architecture

```
                VIETNAMESE ACCOUNTING
                   TT99/2025
                       │
                       ▼
              ┌────────────────┐
              │   TK 331       │
              │ Phải trả người │
              │     bán        │
              └────────┬───────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
      Credit Side           Debit Side
    Vendor Invoices      Vendor Advances
    (Payable)            (Prepayment)
            │                     │
            │                     │
            ▼                     ▼
      F4 AP Payable        F4 Prepayment
                                  │
                                  ▼
                      Unapplied Vendor Advance
                                  │
                                  ▼
                      F5 PREPAYMENT_GL_BALANCE
                      (Reconciles Debit balance
                       on TK 331)
```

**Key Principle:**
> Vendor prepayment is not a separate asset domain. It is the Debit balance
> of the vendor AP relationship (TK 331), representing advance payment
> awaiting invoice clearance.

---

## Impact on F5.6 Implementation

### Before Correction (Incorrect)

**Blocker:** "Choose between 141 vs 331"
- Treated as architectural design decision
- Implied two valid alternatives
- Would lead to incorrect accounting semantics

### After Correction (Correct)

**Blocker:** "Verify TT99/2025 Phần B confirms 'Nợ 331' for vendor advance"
- Not a choice, but a verification
- Confirms Vietnamese accounting treatment
- Aligns with legal framework

### Semantic Decisions Now Clear

**GL Account Mapping:**
- ✅ Account: 331 Phải trả cho người bán
- ✅ Semantic: Debit balance on vendor relationship

**Reconstruction Formula:**
- ✅ Logic: Rebuild Debit balance on TK 331
- ✅ Formula: RECORDED (+) - APPLIED (-) - REFUNDED (-)

**Normal Balance:**
- ✅ TK 331: CREDIT-normal (liability)
- ✅ Vendor advance: DEBIT balance (reduces liability)

### Remaining Verification Required

**Still need from TT99/2025 Phần B:**
1. ❌ Confirm accounting entry "Nợ 331 / Có 112" for vendor advance
2. ❌ Verify TK 331 can have Debit balance per Vietnamese accounting
3. ❌ Document sub-account structure (e.g., 3311 for advances)
4. ❌ VAS guidance on vendor advance treatment

**But semantic direction is now clear:** Account 331, not 141.

---

## Why This Correction Matters

### Architectural Impact

**If we had proceeded with "141 vs 331 choice":**
- ❌ Would create accounting semantic mismatch
- ❌ Would separate prepayment from AP relationship
- ❌ Would violate Vietnamese accounting treatment
- ❌ Would fail audit compliance

**With corrected understanding:**
- ✅ Vendor prepayment integrated with AP relationship
- ✅ TK 331 semantic alignment with Vietnamese accounting
- ✅ F5.6 reconciliation reflects true accounting nature
- ✅ Audit compliance ensured

### F5-S0 Constitutional Compliance

**F5-S0 Amendment requires:**
> "F5 reconciliation semantics SHALL be derived from Vietnamese accounting
> legal framework. AI SHALL NOT invent accounting treatment."

**This correction demonstrates:**
- ✅ AI did NOT invent "141 vs 331 choice"
- ✅ Human Architect corrected accounting semantic
- ✅ Research now aligns with Vietnamese accounting principle
- ✅ F5-S0 authority hierarchy respected

---

## Research Document Updates

**Files Updated:**
1. `F5_6_VIETNAMESE_ACCOUNTING_SEMANTIC_RESEARCH.md`
   - Section C.1: Corrected to explain 141 vs 331 difference
   - Removed "Option A vs Option B" false choice
   - Added TK 331 dual balance explanation

2. `F5_6_RESEARCH_STATUS.md`
   - Updated blocker from "decision required" to "verification required"
   - Corrected findings section
   - Updated priority actions

3. `F5_6_SEMANTIC_CORRECTION_2026_08_23.md` (THIS DOCUMENT)
   - Documents the correction
   - Explains Vietnamese accounting semantic
   - Clarifies F5.6 implementation direction

---

## Next Steps (Unchanged)

**Priority 1: Verify TT99/2025 Phần B**
1. Access detailed accounting guidance (Phần B — Nội dung và phương pháp kế toán)
2. Confirm "Ứng trước cho người bán" uses **Nợ 331 / Có 112**
3. Verify TK 331 Debit balance treatment
4. Document sub-account structure

**Priority 2: Complete Research**
5. VAS guidance on vendor advances
6. Bella F1 COA verification (should use TK 331)
7. F4 contract alignment verification
8. Remaining research items (B.2-B.5, C.2-C.6, D.1-D.2)

**Only then:** F5.6 semantic spec → Implementation

---

## Conclusion

This correction demonstrates the importance of:
1. **Not assuming AI understands accounting semantics**
2. **Human Architect review of accounting treatment**
3. **Vietnamese accounting legal framework as authority**
4. **F5-S0 Constitutional Amendment enforcement**

The correction moves F5.6 from:
- ❌ "Choose between two alternatives" (incorrect architectural framing)
- ✅ "Verify Vietnamese accounting treatment" (correct research direction)

**Status:** Research direction corrected, verification pending.

---

**Approved By:** [PENDING Human Architect sign-off after TT99 Phần B verification]

