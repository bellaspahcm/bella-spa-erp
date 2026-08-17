# F5-S0.3 Constitutional Amendment — Accounting Policy & Posting Rule Versioning

> **Amendment ID:** F5-S0.3  
> **Enacted:** 2026-08-16  
> **Authority:** Bella Finance OS Constitutional Council  
> **Extends:** F5-S0.2 (Accounting Regime Versioning)  
> **Triggered By:** Discovery that accounting rules can change WITHOUT regime change

---

## Executive Summary

F5-S0.2 established **Accounting Regime Versioning** (TT133/2016 vs TT99/2025). However, this is insufficient.

**New Discovery:**
> Even when the accounting regime remains unchanged (e.g., TT99/2025 continues), **posting rules, recognition criteria, account mappings, and reporting presentations can still change**.

**Example:**
```
TT99/2025 (regime unchanged)
    ↓
2026: Vendor prepayment → Nợ 331 / Có 111,112,113
    ↓
2027: Ministry issues guidance → Vendor prepayment → Nợ 142 / Có 111,112,113
    (Rule changed, regime unchanged)
```

**Current Architecture Problem:**
```
Tenant → Accounting Regime → Semantic Rules (static)
```

**Correct Architecture:**
```
Tenant → Accounting Regime → Accounting Policy Version → Posting Rules Version → Finance Kernel
```

**Key Principle:**
> "**Finance Kernel processes financial essence. Accounting Policy decides regulatory application. Posting Rules decide how business events become journal entries.**"

---

## The Problem: Rule Changes Within Regime

### Scenario 1: Posting Rule Change (Account Code Change)

**Year 2026 — TT99/2025 Rule v1.0:**
```
Business Event: Vendor prepayment recorded
Posting Rule:   Nợ 331 / Có 111,112,113
```

**Year 2027 — TT99/2025 Rule v1.1 (guidance issued):**
```
Business Event: Vendor prepayment recorded
Posting Rule:   Nợ 142 / Có 111,112,113  ← Account changed
```

**F5-S0.2 Architecture Cannot Handle This:**
```
Accounting Regime: VN-TT99-2025 (unchanged)
Semantic Rules:    {...} (static)

Problem: How to version posting rules WITHIN the same regime?
```

---

### Scenario 2: Recognition Criteria Change

**Year 2026 — TT99/2025 Recognition v1.0:**
```
Revenue Recognition: Recognize when goods delivered
```

**Year 2027 — TT99/2025 Recognition v1.1 (new guidance):**
```
Revenue Recognition: Recognize when customer accepts goods (stricter)
```

**F5-S0.2 Cannot Version Recognition Rules Independently.**

---

### Scenario 3: Reporting Presentation Change

**Year 2026 — TT99/2025 Presentation v1.0:**
```
Balance Sheet: "Trả trước cho người bán" (Short-term prepayment)
```

**Year 2027 — TT99/2025 Presentation v1.1 (clarification):**
```
Balance Sheet: "Trả trước cho người bán" (split Short-term vs Long-term)
```

**F5-S0.2 Cannot Version Presentation Rules Independently.**

---

## Architectural Solution: Multi-Layer Versioning

### Abstraction Hierarchy

```
┌─────────────────────────────────────────────────────┐
│ REGULATORY FRAMEWORK (Country-level)                │
│ - Vietnamese Accounting Law                         │
│ - Ministry of Finance regulations                   │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING REGIME (Tenant-level, effective-dated)  │
│ - VN-TT133-2016                                     │
│ - VN-TT99-2025                                      │
│ - VN-TTxxx-20xx (future)                            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING POLICY (Tenant-level, versioned)        │
│ - Revenue recognition policy v1.0, v1.1, ...       │
│ - Expense recognition policy v1.0, v1.1, ...       │
│ - Inventory valuation policy v1.0, v1.1, ...       │
│ - Fixed asset depreciation policy v1.0, v1.1, ...  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ POSTING RULES (Effective-dated, immutable history) │
│ - Vendor prepayment → Nợ 331 / Có 111 (v1.0)       │
│ - Vendor prepayment → Nợ 142 / Có 111 (v1.1)       │
│ - Inventory purchase → Nợ 156 / Có 331 (v1.0)      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ FINANCE KERNEL (Regime-agnostic, rule-agnostic)    │
│ - Transaction                                       │
│ - Journal Entry                                     │
│ - Debit / Credit                                    │
│ - Account                                           │
│ - Amount                                            │
│ - Posted At                                         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ LEDGER (Immutable event log)                        │
└─────────────────────────────────────────────────────┘
```

---

## Constitutional Law: Accounting Policy Independence

### Law Statement

> **Accounting Policy Independence Law**
>
> Accounting policies and posting rules SHALL be **versioned independently** from accounting regimes. Rule changes within a regime SHALL NOT require regime migration. Historical transactions retain their **original posting rules**, not current rules.

---

## Extended Constitutional Invariants

### AR-006: Policy Versioning

**Statement:**
> Every accounting policy has **immutable version identity** within a regime.

**Example:**
```
Regime:   VN-TT99-2025
Policy:   Vendor Prepayment Posting
Version:  1.0.0 (2026-01-01 to 2026-12-31)
Version:  1.1.0 (2027-01-01 to ∞)
```

**Schema:**
```sql
CREATE TABLE accounting_policies (
  id UUID PRIMARY KEY,
  regime_code TEXT NOT NULL,  -- 'VN-TT99-2025'
  policy_domain TEXT NOT NULL,  -- 'VENDOR_PREPAYMENT_POSTING'
  policy_version TEXT NOT NULL,  -- '1.0.0', '1.1.0', ...
  
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current
  
  policy_rules JSONB NOT NULL,
  /*
  {
    "recognition_criteria": {...},
    "posting_rules": {
      "prepayment_recorded": {
        "debit_account": "331",
        "credit_account": "111|112|113",
        "description": "Ứng trước cho người bán"
      },
      "prepayment_applied": {
        "debit_account": "156",
        "credit_account": "331",
        "description": "Cấn trừ khoản ứng trước"
      }
    },
    "reporting_presentation": {...}
  }
  */
  
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  source_authority TEXT NOT NULL,
  
  UNIQUE (regime_code, policy_domain, policy_version)
);
```

---

### AR-007: Rule Effective Dating

**Statement:**
> A posting rule applies only within its **effective period**. Historical transactions use **historical rules**, not current rules.

**Example:**

**Transaction Posted 2026-05-15:**
```sql
INSERT INTO finance_transactions (
  tenant_id,
  posted_at,
  regime_code,
  policy_version,
  business_event_type,
  ...
) VALUES (
  :tenant_id,
  '2026-05-15',
  'VN-TT99-2025',
  '1.0.0',  -- Policy version at posting time
  'VENDOR_PREPAYMENT_RECORDED',
  ...
);
```

**5 Years Later (2031), Rule Changed to v1.1:**

**Reconciliation as_of 2026-12-31:**
```sql
-- Resolve policy version at 2026-12-31
SELECT policy_version, policy_rules
FROM accounting_policies
WHERE regime_code = 'VN-TT99-2025'
  AND policy_domain = 'VENDOR_PREPAYMENT_POSTING'
  AND '2026-12-31' BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31');

-- Result: policy_version = '1.0.0'
-- Use posting rules from v1.0.0 (Nợ 331 / Có 111)
```

**Reconciliation as_of 2031-12-31:**
```sql
-- Resolve policy version at 2031-12-31
SELECT policy_version, policy_rules
FROM accounting_policies
WHERE regime_code = 'VN-TT99-2025'
  AND policy_domain = 'VENDOR_PREPAYMENT_POSTING'
  AND '2031-12-31' BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31');

-- Result: policy_version = '1.1.0'
-- Use posting rules from v1.1.0 (Nợ 142 / Có 111)
```

**Prohibition:**
- ❌ Cannot apply v1.1.0 rules to 2026 transactions
- ❌ Cannot "update" historical transactions to use new rules

---

### AR-008: Policy Change Independence

**Statement:**
> Policy changes SHALL NOT require **regime migration**. A tenant can update policies while remaining in the same regime.

**Example:**

**Scenario: Ministry issues guidance on vendor prepayment (2027)**

**WRONG Approach (Regime Migration):**
```sql
-- ❌ Create new regime just for rule change
INSERT INTO tenant_accounting_regimes (
  tenant_id,
  regime_code,
  effective_from
) VALUES (
  :tenant_id,
  'VN-TT99-2025-R2',  -- ❌ Wrong: New regime for rule change
  '2027-01-01'
);
```

**CORRECT Approach (Policy Versioning):**
```sql
-- ✅ Same regime, new policy version
INSERT INTO accounting_policies (
  regime_code,
  policy_domain,
  policy_version,
  effective_from,
  policy_rules
) VALUES (
  'VN-TT99-2025',  -- ✅ Same regime
  'VENDOR_PREPAYMENT_POSTING',
  '1.1.0',  -- ✅ New policy version
  '2027-01-01',
  '{"posting_rules": {"prepayment_recorded": {"debit_account": "142", ...}}}'
);

-- ✅ v1.0.0 remains immutable
UPDATE accounting_policies
SET effective_to = '2026-12-31'
WHERE regime_code = 'VN-TT99-2025'
  AND policy_domain = 'VENDOR_PREPAYMENT_POSTING'
  AND policy_version = '1.0.0';
```

---

### AR-009: Granular Policy Domains

**Statement:**
> Accounting policies SHALL be **domain-specific**, not monolithic. Policy changes affect only relevant domains.

**Policy Domains (Examples):**
```
VENDOR_PREPAYMENT_POSTING
CUSTOMER_ADVANCE_POSTING
REVENUE_RECOGNITION
EXPENSE_RECOGNITION
INVENTORY_VALUATION
FIXED_ASSET_DEPRECIATION
FOREIGN_EXCHANGE_TREATMENT
CASH_FLOW_CLASSIFICATION
```

**Benefit:**
```
2027: Only VENDOR_PREPAYMENT_POSTING changes (v1.0 → v1.1)
      All other domains remain v1.0
      
No need to version entire accounting policy when only one domain changes.
```

---

### AR-010: Finance Kernel Abstraction

**Statement:**
> Finance Kernel processes **financial essence**, not accounting rules. Accounting policies and posting rules are **external to the kernel**.

**Finance Kernel Responsibility:**
- Store transactions (events)
- Store journal entries (debits/credits)
- Store ledger (account balances)
- Provide temporal queries (as_of)

**Finance Kernel Does NOT Know:**
- Which account code to use for vendor prepayment (331 vs 142)
- Recognition criteria (when to record revenue)
- Reporting presentation (how to classify on balance sheet)

**Posting Rules Responsibility:**
- Map business events → journal entries
- Determine account codes
- Apply recognition criteria
- Format reporting presentation

**Separation:**
```
Business Event: "Vendor prepayment recorded"
        ↓
Posting Rule Resolver (regime + policy version)
        ↓
Posting Rule v1.0: "Nợ 331 / Có 111"
        ↓
Finance Kernel: Create journal entry (account_id, debit, credit)
        ↓
Ledger: Store immutable transaction
```

---

## Tenant Accounting Policy Model

### Schema: `accounting_policies`

```sql
CREATE TABLE accounting_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Regime context
  regime_code TEXT NOT NULL,  -- 'VN-TT99-2025'
  
  -- Policy identification
  policy_domain TEXT NOT NULL,  -- 'VENDOR_PREPAYMENT_POSTING'
  policy_name TEXT NOT NULL,  -- 'Vendor Prepayment Posting Rules'
  policy_version TEXT NOT NULL,  -- '1.0.0', '1.1.0', ...
  
  -- Effective period
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current
  
  -- Status
  status TEXT NOT NULL,  -- 'ACTIVE' | 'SUPERSEDED' | 'PENDING'
  
  -- Policy rules (JSONB for flexibility)
  policy_rules JSONB NOT NULL,
  /*
  {
    "recognition_criteria": {
      "prepayment_recorded": {
        "when": "Payment made before goods/services received",
        "conditions": ["Valid vendor", "Valid payment method"]
      },
      "prepayment_applied": {
        "when": "Goods/services received and invoiced",
        "conditions": ["Invoice matches prepayment", "Same vendor"]
      }
    },
    "posting_rules": {
      "prepayment_recorded": {
        "debit_account": "331",
        "credit_account": "111|112|113",
        "description": "Ứng trước cho người bán",
        "notes": "TT99/2025 Phụ lục II"
      },
      "prepayment_applied": {
        "debit_account": "156|152|...",
        "credit_account": "331",
        "description": "Cấn trừ khoản ứng trước",
        "notes": "Inventory/expense account depends on purchase type"
      },
      "prepayment_refunded": {
        "debit_account": "111|112|113",
        "credit_account": "331",
        "description": "Hoàn lại khoản ứng trước"
      }
    },
    "reporting_presentation": {
      "balance_sheet_line_item": "Trả trước cho người bán",
      "classification": "CURRENT_ASSETS",
      "aggregation": "Sum of debit balances per vendor",
      "disclosure_required": true
    }
  }
  */
  
  -- Version control
  superseded_by_policy_id UUID REFERENCES accounting_policies(id),
  change_reason TEXT,
  change_authority TEXT,  -- e.g., "Ministry Guidance 123/2027"
  
  -- Metadata
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE (regime_code, policy_domain, policy_version),
  
  CONSTRAINT no_overlapping_policy_periods EXCLUDE USING gist (
    regime_code WITH =,
    policy_domain WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date), '[]') WITH &&
  )
);

CREATE INDEX idx_accounting_policies_regime_domain
  ON accounting_policies (regime_code, policy_domain, effective_from, effective_to);
```

---

## F5 Reconciliation: Policy-Aware Logic

### Current F5.6 Approach (INSUFFICIENT):

```sql
-- Hardcoded posting rule assumption
SELECT 
  vendor_id,
  SUM(CASE 
    WHEN account_code = '331' AND debit > 0 THEN debit
    WHEN account_code = '331' AND credit > 0 THEN -credit
  END) AS vendor_prepayment_balance
FROM finance_transaction_lines
WHERE posted_at <= :as_of
GROUP BY vendor_id;
```

**Problem:** What if posting rule changed from 331 → 142 in 2027?

---

### Correct F5.6 Approach (Policy-Aware):

```sql
-- Step 1: Resolve tenant's regime at as_of
WITH tenant_regime AS (
  SELECT regime_code
  FROM tenant_accounting_regimes
  WHERE tenant_id = :tenant_id
    AND :as_of BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31')
),

-- Step 2: Resolve policy version at as_of
policy_at_date AS (
  SELECT policy_version, policy_rules
  FROM accounting_policies
  WHERE regime_code = (SELECT regime_code FROM tenant_regime)
    AND policy_domain = 'VENDOR_PREPAYMENT_POSTING'
    AND :as_of BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31')
),

-- Step 3: Extract account codes from policy rules
policy_accounts AS (
  SELECT
    policy_rules->'posting_rules'->'prepayment_recorded'->>'debit_account' AS prepayment_account,
    policy_rules->'posting_rules'->'prepayment_applied'->>'credit_account' AS applied_account
  FROM policy_at_date
),

-- Step 4: Reconcile using policy-determined accounts
vendor_prepayment_balance AS (
  SELECT
    vendor_id,
    SUM(
      CASE 
        WHEN fa.account_code = (SELECT prepayment_account FROM policy_accounts)
             AND ftl.debit > 0 THEN ftl.debit
        WHEN fa.account_code = (SELECT prepayment_account FROM policy_accounts)
             AND ftl.credit > 0 THEN -ftl.credit
      END
    ) AS balance
  FROM finance_transaction_lines ftl
  JOIN finance_accounts fa ON ftl.account_id = fa.id
  WHERE ftl.posted_at <= :as_of
  GROUP BY vendor_id
)

SELECT * FROM vendor_prepayment_balance;
```

**Key Difference:** Account codes come from **policy rules at as_of date**, NOT hard-coded assumptions.

---

## Example: Posting Rule Change Scenario

### Initial State (2026)

**Regime:** VN-TT99-2025  
**Policy:** Vendor Prepayment Posting v1.0.0 (2026-01-01 to 2026-12-31)  
**Rule:** Nợ 331 / Có 111,112,113

**Transaction #1 (2026-05-15):**
```sql
INSERT INTO finance_transactions VALUES (
  '2026-05-15',
  'VN-TT99-2025',
  '1.0.0',  -- Policy version at posting
  'VENDOR_PREPAYMENT_RECORDED',
  ...
);

INSERT INTO finance_transaction_lines VALUES (
  (SELECT id FROM finance_accounts WHERE account_code = '331'),  -- Debit
  100000000,  -- 100m
  0
);
```

---

### Rule Change (2027)

**Ministry Guidance:** Vendor prepayment should use TK 142 instead of TK 331 (hypothetical).

**Policy Update:**
```sql
-- Close v1.0.0
UPDATE accounting_policies
SET effective_to = '2026-12-31', status = 'SUPERSEDED'
WHERE regime_code = 'VN-TT99-2025'
  AND policy_domain = 'VENDOR_PREPAYMENT_POSTING'
  AND policy_version = '1.0.0';

-- Create v1.1.0
INSERT INTO accounting_policies (
  regime_code,
  policy_domain,
  policy_name,
  policy_version,
  effective_from,
  policy_rules,
  change_reason,
  change_authority
) VALUES (
  'VN-TT99-2025',  -- Same regime
  'VENDOR_PREPAYMENT_POSTING',
  'Vendor Prepayment Posting Rules',
  '1.1.0',  -- New version
  '2027-01-01',
  '{
    "posting_rules": {
      "prepayment_recorded": {
        "debit_account": "142",  -- Changed from 331
        "credit_account": "111|112|113"
      }
    }
  }',
  'Ministry guidance on vendor prepayment account classification',
  'Ministry Circular 123/2027'
);
```

**Transaction #2 (2027-03-20):**
```sql
INSERT INTO finance_transactions VALUES (
  '2027-03-20',
  'VN-TT99-2025',  -- Same regime
  '1.1.0',  -- New policy version
  'VENDOR_PREPAYMENT_RECORDED',
  ...
);

INSERT INTO finance_transaction_lines VALUES (
  (SELECT id FROM finance_accounts WHERE account_code = '142'),  -- Debit (new rule)
  50000000,  -- 50m
  0
);
```

---

### F5 Reconciliation (2031)

**Reconcile as_of 2026-12-31:**
```sql
-- Uses policy v1.0.0 (effective at 2026-12-31)
-- Account: 331
-- Result: 100m vendor prepayment balance
```

**Reconcile as_of 2027-12-31:**
```sql
-- Uses policy v1.1.0 (effective at 2027-12-31)
-- Account: 142
-- Result: 50m vendor prepayment balance (from 2027 transaction)
```

**Key:** Historical 2026 transaction uses TK 331 (policy v1.0.0). New 2027 transaction uses TK 142 (policy v1.1.0). F5 reconciliation uses **policy at as_of date**, not current policy.

---

## Storage: Transaction Policy Context

### Extend `finance_transactions` Schema

```sql
ALTER TABLE finance_transactions
ADD COLUMN accounting_regime_code TEXT,
ADD COLUMN accounting_policy_version TEXT,
ADD COLUMN posting_rule_version TEXT;

CREATE INDEX idx_finance_transactions_regime_policy
  ON finance_transactions (accounting_regime_code, accounting_policy_version);
```

**Purpose:** Every transaction records its **accounting context at posting time**.

**Benefit:**
- Historical reproducibility (G8)
- Policy change audit trail
- F5 reconciliation can trace policy used for each transaction

---

## Regulatory Agility

### Two Types of Changes Bella Can Handle

**Type 1: Regime Change**
```
TT133/2016 → TT99/2025 → TTxxx/20xx
(F5-S0.2 handles this)
```

**Type 2: Policy/Rule Change (Within Same Regime)**
```
TT99/2025 Policy v1.0 → v1.1 → v1.2 → ...
(F5-S0.3 handles this)
```

**Combined Example:**
```
2025: Tenant A uses TT133-2016, Policy v1.0
2026: Tenant A switches to TT99-2025, Policy v1.0  (Regime change)
2027: Tenant A continues TT99-2025, Policy v1.1    (Policy change)
2028: Tenant A continues TT99-2025, Policy v1.2    (Policy change)
2030: Tenant A switches to TT103-2030, Policy v1.0 (Regime change)
```

**Bella Handles All Transitions:**
- Regime migration (AR-005 + transition approval)
- Policy versioning (AR-006 + effective dating)
- Historical immutability (AR-003 + AR-007)

---

## Impact on F5.6 Research

### Previous Scope (INSUFFICIENT):

```
Part C: Vendor Prepayment
├── C.1 — TT99/2025 vendor prepayment semantic ✅
├── C.2 — TT99/2025 accounting entries ❌
└── C.3 — Bella F1 implementation 🟡
```

**Problem:** Assumes TT99 semantic is static. What if posting rules change in 2027?

---

### New Scope (CORRECTED):

```
Part A: Legal Framework
├── A.1 — Vietnamese Accounting Law ✅
├── A.2 — VAS applicability ❌
├── A.3 — Regime Versioning (TT133 vs TT99) 🔴 F5-S0.2
└── A.4 — Policy Versioning Framework 🔴 F5-S0.3 (NEW)
    ├── Policy domain taxonomy
    ├── Version control mechanism
    ├── Effective dating rules
    ├── Change governance workflow
    └── Finance Kernel abstraction boundary

Part C: Vendor Prepayment
├── C.1 — TT99/2025 vendor prepayment semantic ✅
├── C.1b — TT133/2016 vendor prepayment semantic ❌
├── C.2 — Posting rules (VERSIONED) 🔴 UPDATED
│   ├── TT99 v1.0 posting rules (2026 baseline)
│   ├── TT133 v1.0 posting rules (2026 baseline)
│   └── Future rule change handling
├── C.3 — Bella F1 implementation 🟡
└── C.4 — Policy versioning implementation ❌ NEW
```

---

## Constitutional Finding: F5-S0.3-POL-001

**Finding ID:** F5-S0.3-POL-001  
**Date:** 2026-08-16  
**Title:** Accounting Policy Independence from Regime

**Statement:**
> Accounting policies and posting rules SHALL be versioned **independently** from accounting regimes. Rule changes within a regime SHALL NOT require regime migration. Finance Kernel SHALL be **rule-agnostic**. F5 Reconciliation SHALL resolve **policy at as_of date**, not current policy.

**Architectural Requirements:**
- AR-006 — Policy Versioning
- AR-007 — Rule Effective Dating
- AR-008 — Policy Change Independence
- AR-009 — Granular Policy Domains
- AR-010 — Finance Kernel Abstraction

**Impact:**
- `accounting_policies` table required
- `finance_transactions` must record policy version at posting
- F5 reconciliation must resolve policy at `as_of` date
- Posting rules become external to Finance Kernel

---

## F5-S0.2 + F5-S0.3 Combined Architecture

### Complete Abstraction Hierarchy:

```
┌─────────────────────────────────────────────────────┐
│ REGULATORY FRAMEWORK (Vietnamese Law, MOF)         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING REGIME (Tenant-level, effective-dated)  │
│ - F5-S0.2: AR-001 to AR-005                        │
│ - TT133-2016, TT99-2025, TTxxx-20xx                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING POLICY (Domain-specific, versioned)     │
│ - F5-S0.3: AR-006 to AR-010                        │
│ - Vendor prepayment v1.0, v1.1, ...                │
│ - Revenue recognition v1.0, v1.1, ...              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ POSTING RULES (Effective-dated, immutable)         │
│ - Account mapping                                   │
│ - Recognition criteria                              │
│ - Reporting presentation                            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ FINANCE KERNEL (Rule-agnostic, policy-agnostic)    │
│ - Transaction, Journal, Debit/Credit, Ledger       │
└─────────────────────────────────────────────────────┘
```

---

## Next Steps

### 1. Freeze F5-S0.3 Principles ✅

**Five New Invariants Established:**
- AR-006: Policy Versioning
- AR-007: Rule Effective Dating
- AR-008: Policy Change Independence
- AR-009: Granular Policy Domains
- AR-010: Finance Kernel Abstraction

### 2. Design Policy Versioning Schemas ❌

**Required:**
- `accounting_policies` table design
- `finance_transactions` policy context columns
- Policy change governance workflow

### 3. Update F5.6 Research Scope ❌

**New Items:**
- A.4 — Policy Versioning Framework
- C.4 — Policy versioning implementation

### 4. Finance Kernel Abstraction Boundary ❌

**Define:**
- What Finance Kernel knows (transactions, debits, credits)
- What Finance Kernel does NOT know (account codes, recognition rules)
- How Posting Rules layer interacts with Finance Kernel

---

## Conclusion

F5-S0.3 extends F5-S0.2 to handle **policy and rule changes within the same accounting regime**. This ensures Bella Finance OS can survive:
- Regime changes (TT133 → TT99 → TTxxx)
- Policy changes (v1.0 → v1.1 → v1.2)
- Posting rule changes (331 → 142, recognition criteria updates, presentation changes)

**True Regulatory Agility:** Bella adapts to regulatory evolution without rewriting Finance Kernel.

---

**Status:** 🔴 **F5-S0.3 ENACTED** — Policy versioning principles established

**Next:** Human Architect approves F5-S0.3, design policy versioning schemas, update F5.6 research scope
