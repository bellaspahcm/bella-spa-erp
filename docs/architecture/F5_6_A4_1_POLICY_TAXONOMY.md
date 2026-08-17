# F5.6 A.4.1 Policy Taxonomy — What Bella Manages

> **Document Type:** Policy Architecture — Domain Definition  
> **Date:** 2026-08-16  
> **Status:** DRAFT  
> **Purpose:** Define which policy domains Bella Finance OS manages and where responsibility stops

---

## Strategic Context

**F5.6 Core Invariant:**
> "Finance OS MUST NOT derive its core financial identity from a specific accounting regime, chart of accounts, or accounting vendor."

**A.4 Mission:**
> "Prove policy evolution doesn't break Finance Kernel or historical truth"

**A4.1 Objective:**
> "Define what policy domains Bella manages and where Bella's responsibility stops"

---

## Critical Boundary

**Bella Manages:**
✅ "Khi nào một khoản phải thu được ghi nhận" (When to recognize receivable)

**Bella Does NOT:**
❌ "Pháp luật Việt Nam quy định X" (Legal interpretation)

**Why This Boundary Matters:**
- Bella = Financial Control & Intelligence Layer
- NOT = Legal compliance engine
- NOT = Accounting standard authority

---

## Policy Domain Taxonomy

### Domain 1: Recognition Policy

**Question:** When does a financial event become a ledger entry?

**Bella's Role:**
- Apply recognition criteria from configured policy
- Generate recognition event when criteria met
- Track recognition timing

**Bella Does NOT:**
- Interpret VAS standards directly
- Make legal judgments on revenue recognition edge cases
- Override tenant's configured recognition policy

**Example:**
```
Business Event: Customer invoice issued
    ↓
Recognition Policy (configured): UPON_INVOICE_ISSUE
    ↓
Finance OS: Generate receivable recognition event
    ↓
Posting Instruction: Dr AR, Cr Revenue
    ↓
Finance Kernel: Persist
```

**Configuration Example:**
```json
{
    "semantic": "TRADE_RECEIVABLE",
    "recognition_trigger": "INVOICE_ISSUED",
    "recognition_conditions": [
        "goods_delivered_or_service_completed",
        "invoice_approved",
        "amount_determinable"
    ],
    "policy_version": "v1.0",
    "effective_date": "2026-01-01"
}
```

---

### Domain 2: Measurement Policy

**Question:** How is a financial item valued?

**Bella's Role:**
- Apply measurement basis from configured policy
- Calculate amounts using configured method
- Track measurement changes

**Bella Does NOT:**
- Determine fair value independently
- Make impairment judgments
- Override configured measurement basis

**Example:**
```
Business Event: Prepaid expense amortization
    ↓
Measurement Policy (configured): STRAIGHT_LINE_AMORTIZATION
    ↓
Finance OS: Calculate amortization amount
    ↓
Posting Instruction: Dr Expense, Cr Prepaid Asset
    ↓
Finance Kernel: Persist
```

**Configuration Example:**
```json
{
    "semantic": "PREPAID_EXPENSE",
    "measurement_basis": "HISTORICAL_COST",
    "subsequent_measurement": "AMORTIZATION",
    "amortization_method": "STRAIGHT_LINE",
    "policy_version": "v1.0"
}
```

---

### Domain 3: Classification Policy

**Question:** Where does a financial item belong?

**Bella's Role:**
- Apply classification rules from configured policy
- Assign to current/non-current, asset/liability
- Generate financial statement line items

**Bella Does NOT:**
- Interpret financial statement presentation standards
- Make materiality judgments
- Override configured classification

**Example:**
```
Business Event: Vendor prepayment
    ↓
Classification Policy (configured): CURRENT_ASSET (if < 1 year)
    ↓
Finance OS: Classify as current asset
    ↓
Financial Statement: "Trả trước cho người bán" line item
```

---

### Domain 4: Posting Policy

**Question:** What are the debit/credit instructions?

**Bella's Role:**
- Resolve semantic → account (via Tenant COA)
- Generate balanced posting instructions
- Apply posting patterns from configured policy

**Bella Does NOT:**
- Hard-code account numbers
- Assume universal posting patterns
- Override Tenant COA mappings

**Example:**
```
Business Event: Vendor prepayment
    ↓
Semantic: VENDOR_PREPAYMENT
    ↓
Posting Policy (configured): Dr VENDOR_PREPAYMENT, Cr CASH
    ↓
Tenant COA: VENDOR_PREPAYMENT → Account 331
    ↓
Posting Instruction: Dr 331, Cr 111
    ↓
Finance Kernel: Persist (doesn't interpret semantic)
```

---

### Domain 5: Period Policy

**Question:** Which accounting period does this belong to?

**Bella's Role:**
- Apply period assignment rules
- Handle period closing
- Prevent posting to closed periods

**Bella Does NOT:**
- Determine fiscal year definitions (configured by tenant)
- Make period-end adjustment decisions
- Override period closing approvals

**Example:**
```
Business Event: Transaction dated 2026-01-15
    ↓
Period Policy (configured): Monthly periods, Jan 2026 open
    ↓
Finance OS: Assign to 2026-01 period
    ↓
Finance Kernel: Persist with period metadata
```

---

### Domain 6: Approval Policy

**Question:** What approvals are required before posting?

**Bella's Role:**
- Enforce configured approval workflows
- Track approval status
- Block posting until approvals met

**Bella Does NOT:**
- Define organizational approval hierarchy
- Make approval decisions
- Override configured approval rules

**Example:**
```
Business Event: Large payment (> 100M VND)
    ↓
Approval Policy (configured): Requires CFO approval
    ↓
Finance OS: Hold posting until CFO approves
    ↓
After approval: Generate posting instruction
```

---

### Domain 7: Reconciliation Policy

**Question:** How are discrepancies detected and resolved?

**Bella's Role:**
- Compare Bella position vs External system
- Detect discrepancies
- Track reconciliation status

**Bella Does NOT:**
- Automatically resolve discrepancies
- Choose which system is "correct"
- Override manual reconciliation decisions

**Example:**
```
Bella AR: 2.15B
MISA AR: 2.08B
    ↓
Reconciliation Policy (configured): Flag difference > 1%
    ↓
Finance OS: Create reconciliation task (70M difference)
    ↓
Finance Controller: Investigates and resolves
```

---

## What Bella DOES NOT Manage

### ❌ Out of Scope

**Legal Interpretation:**
- VAS standard compliance decisions
- Tax regulation interpretation
- Legal opinion on edge cases

**Business Judgment:**
- Materiality thresholds
- Impairment indicators
- Going concern assessments

**Organizational Policy:**
- Approval hierarchies
- Segregation of duties
- Internal control design

**Accounting Standard Authority:**
- "VAS 01 says X" → Bella doesn't make this claim
- "TT99 requires Y" → Configuration says this, not Bella

**Strategic Decision:**
- Which accounting software to use
- Which COA structure to adopt
- Which accounting policies to choose

---

## Policy Configuration vs Policy Execution

**Critical Separation:**

**Policy Configuration (Tenant's responsibility):**
```json
{
    "recognition": {
        "TRADE_RECEIVABLE": {
            "trigger": "INVOICE_ISSUED",
            "conditions": ["goods_delivered", "invoice_approved"],
            "authority": "VAS 14, Article X (tenant's interpretation)"
        }
    }
}
```

**Policy Execution (Bella's responsibility):**
```
IF business_event = "invoice_issued"
AND conditions_met(policy.recognition.TRADE_RECEIVABLE.conditions)
THEN generate_recognition_event(TRADE_RECEIVABLE)
```

**Bella executes policy, does NOT interpret legal source.**

---

## Representative Semantic Set (10-20 Semantics)

**Asset Semantics (8):**
1. CASH — Physical cash, petty cash
2. BANK_DEPOSIT — Bank accounts
3. TRADE_RECEIVABLE — Customer invoices
4. VENDOR_PREPAYMENT — Advances to suppliers
5. EMPLOYEE_ADVANCE — Employee temporary advances
6. PREPAID_EXPENSE — Prepaid insurance, rent, etc.
7. INVENTORY — Goods held for sale
8. FIXED_ASSET — Property, equipment

**Liability Semantics (4):**
9. TRADE_PAYABLE — Vendor invoices
10. CUSTOMER_ADVANCE — Customer deposits
11. TAX_PAYABLE — Tax obligations
12. LOAN — Short/long-term borrowings

**Equity Semantics (1):**
13. EQUITY — Owner's capital, retained earnings

**Revenue/Expense Semantics (2):**
14. REVENUE — Sales revenue
15. OPERATING_EXPENSE — Operating costs

**Scope:** 15 representative semantics (NOT 50-100)

**Rationale:**
- Sufficient to stress-test architecture
- Covers major financial statement categories
- Expandable after architecture proven

---

## Policy Versioning Model

**Version Structure:**
```
Policy v1.0 (2026-01-01 to 2027-05-31)
    ↓
Policy v1.1 (2027-06-01 to 2029-12-31)
    ↓
Policy v2.0 (2030-01-01 onwards)
```

**Immutability Principle:**
> "Published policy version is immutable. Changes = new version."

**Transaction Binding:**
```
Transaction T1 (2026-05-15)
    ↓
Bound to Policy v1.0 FOREVER
    ↓
Query T1 in 2031 → Still uses v1.0 context
```

---

## Policy Domain Priority

**Phase 1 (F5.6):**
1. ✅ Recognition (when to record)
2. ✅ Measurement (how to value)
3. ✅ Posting (debit/credit instructions)
4. ✅ Period (which period)

**Phase 2 (Post-Gate 2):**
5. ⏳ Classification (where on FS)
6. ⏳ Approval (workflow)

**Phase 3 (C.4-C.6):**
7. ⏳ Reconciliation (discrepancy detection)

---

## Policy Source Hierarchy

**Configuration Source:**
```
1. Tenant Policy Configuration (highest)
    ↓
2. Bella Default Policy Template
    ↓
3. Accounting Regime Requirements (reference)
    ↓
4. Industry Best Practices (reference)
```

**Tenant can override defaults within legal bounds.**

---

## Gate 2 Contribution (A4.1)

**Question 1: Independence**
> Đổi accounting regime → Kernel đổi?

**A4.1 Contribution:**
- Policy configuration separates regime-specific rules from Kernel ✅
- Tenant configures policy per regime ✅
- Kernel receives posting instructions (regime-agnostic) ✅

**Question 2: Interoperability**
> Đổi MISA/SAP/FAST → semantics đổi?

**A4.1 Contribution:**
- Semantic set defined (15 representative) ✅
- Semantic-to-account mapping in Tenant COA layer ✅
- Adapter layer handles vendor differences ✅

**Question 3: Historical Integrity**
> Đổi policy → historical transaction đổi meaning?

**A4.1 Contribution:**
- Policy versioning model defined ✅
- Transaction-to-policy binding designed ✅
- A4.3 will prove with timeline test ⏳

---

## Conclusion

**A4.1 Status:** ✅ COMPLETE

**Deliverable:**
- Policy taxonomy defined (7 domains)
- Bella's responsibility boundary clear
- Representative semantic set: 15 semantics
- Policy configuration vs execution separated
- Policy versioning model established

**Key Principle:**
> "Bella manages financial control, NOT legal interpretation"

**Next:**
- A4.2: Policy Boundary (data vs execution)
- A4.3: Historical Reconstruction Proof (timeline test)
- A4.4: Gate 2 Review

---

**Document Status:** A4.1 Policy Taxonomy COMPLETE ✅  
**Bella's Role:** Financial control & intelligence (configured policy execution)  
**Bella Does NOT:** Legal interpretation or accounting standard authority  
**Representative Semantics:** 15 (stress test sufficient, expandable later) ✅
