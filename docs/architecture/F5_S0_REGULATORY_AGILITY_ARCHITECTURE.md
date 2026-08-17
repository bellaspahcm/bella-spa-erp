# F5-S0 Regulatory Agility Architecture — Complete Framework

> **Document ID:** F5-S0-ARCH  
> **Date:** 2026-08-16  
> **Status:** 🔒 CONSTITUTIONAL FOUNDATION  
> **Amendments:** F5-S0.1, F5-S0.2, F5-S0.3

---

## Executive Summary

Bella Finance OS architectural foundation for **regulatory agility** — the ability to adapt to accounting regulation changes without rewriting the Finance Kernel.

**Three Constitutional Amendments:**

| Amendment | Enacted | Title | Purpose |
|-----------|---------|-------|---------|
| **F5-S0.1** | 2026-08-16 | Vietnamese Accounting Authority | Legal framework hierarchy |
| **F5-S0.2** | 2026-08-16 | Accounting Regime Versioning | Multi-regime support (TT133, TT99, TTxxx) |
| **F5-S0.3** | 2026-08-16 | Accounting Policy Versioning | Policy/rule changes within regime |

**Key Architectural Principle:**
> "**Finance Kernel processes financial essence. Accounting Policy decides regulatory application. Posting Rules decide how business events become journal entries.**"

---

## Complete Abstraction Hierarchy

```
┌─────────────────────────────────────────────────────┐
│ REGULATORY FRAMEWORK                                │
│ - Vietnamese Accounting Law                         │
│ - Ministry of Finance regulations                   │
│ - VAS (Vietnamese Accounting Standards)             │
│                                                     │
│ Amendment: F5-S0.1                                  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING REGIME (Tenant-level, effective-dated)  │
│ - VN-TT133-2016 (SME option, can continue)         │
│ - VN-TT99-2025 (new regime, all enterprises + SME) │
│ - VN-TTxxx-20xx (future regimes)                   │
│                                                     │
│ Amendment: F5-S0.2                                  │
│ Invariants: AR-001 to AR-005                        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING POLICY (Domain-specific, versioned)     │
│ - Vendor prepayment posting v1.0, v1.1, ...        │
│ - Revenue recognition v1.0, v1.1, ...              │
│ - Inventory valuation v1.0, v1.1, ...              │
│ - Fixed asset depreciation v1.0, v1.1, ...         │
│                                                     │
│ Amendment: F5-S0.3                                  │
│ Invariants: AR-006 to AR-010                        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ POSTING RULES (Effective-dated, immutable)         │
│ - Account mapping (331 vs 142)                     │
│ - Recognition criteria (when to record)            │
│ - Reporting presentation (balance sheet line)      │
│                                                     │
│ Amendment: F5-S0.3                                  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ FINANCE KERNEL (Rule-agnostic, policy-agnostic)    │
│ - Transaction (event log)                          │
│ - Journal Entry (debit/credit)                     │
│ - Account (code, name)                             │
│ - Amount (minor units)                             │
│ - Posted At (timestamp)                            │
│                                                     │
│ Abstraction: AR-010 (F5-S0.3)                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ LEDGER (Immutable event log, append-only)          │
└─────────────────────────────────────────────────────┘
```

---

## Ten Constitutional Invariants

### F5-S0.2: Accounting Regime Versioning

**AR-001: Regime Versioning**
> Every accounting regime has **immutable version identity**.

**AR-002: Effective Dating**
> A regime applies only within its **effective period**.

**AR-003: Historical Immutability**
> Historical transactions **retain their original regime**.

**AR-004: Semantic Isolation**
> New accounting legislation SHALL NOT **mutate old semantics**.

**AR-005: Controlled Transition**
> Regime changes require **explicit transition rules and approval**.

---

### F5-S0.3: Accounting Policy Versioning

**AR-006: Policy Versioning**
> Every accounting policy has **immutable version identity** within a regime.

**AR-007: Rule Effective Dating**
> A posting rule applies only within its **effective period**. Historical transactions use **historical rules**.

**AR-008: Policy Change Independence**
> Policy changes SHALL NOT require **regime migration**.

**AR-009: Granular Policy Domains**
> Accounting policies SHALL be **domain-specific**, not monolithic.

**AR-010: Finance Kernel Abstraction**
> Finance Kernel processes **financial essence**, not accounting rules.

---

## Two Types of Changes Bella Handles

### Type 1: Accounting Regime Change

**Trigger:** Ministry of Finance issues new accounting circular.

**Example:**
```
2025: TT200/2014 (old regime)
    ↓
2026: TT99/2025 (new regime)
    ↓
2030: TT103/2030 (hypothetical future regime)
```

**Bella Response:**
- Create new regime entry in `tenant_accounting_regimes`
- Tenant transition requires approval (AR-005)
- Historical transactions retain original regime (AR-003)
- New semantic registry for new regime (AR-004)

**Governed By:** F5-S0.2 (AR-001 to AR-005)

---

### Type 2: Accounting Policy/Rule Change (Within Same Regime)

**Trigger:** Ministry guidance, clarification, or policy update within existing regime.

**Example:**
```
TT99/2025 (regime unchanged)
    ↓
2026: Vendor prepayment → Nợ 331 / Có 111 (Policy v1.0)
    ↓
2027: Ministry guidance → Nợ 142 / Có 111 (Policy v1.1)
    (Rule changed, regime unchanged)
```

**Bella Response:**
- Create new policy version in `accounting_policies`
- No regime migration required (AR-008)
- Historical transactions use historical rules (AR-007)
- Granular domain versioning (AR-009)

**Governed By:** F5-S0.3 (AR-006 to AR-010)

---

## Real-World Scenarios

### Scenario 1: SME Continues TT133, Then Switches to TT99

**Timeline:**
```
2025: SME Tenant A uses TT133-2016
2026: SME Tenant A continues TT133-2016 (allowed per Điều 31 TT99)
2027: SME Tenant A switches to TT99-2025 (regime transition)
```

**Bella Handling:**
```sql
-- 2025-2026: TT133-2016
INSERT INTO tenant_accounting_regimes VALUES (
  :tenant_id, 'VN-TT133-2016', '2025-01-01', '2026-12-31', 'SUPERSEDED'
);

-- 2027+: TT99-2025 (transition)
INSERT INTO tenant_accounting_regimes VALUES (
  :tenant_id, 'VN-TT99-2025', '2027-01-01', NULL, 'ACTIVE'
);
```

**F5 Reconciliation:**
- Reconcile as_of 2026-12-31 → Uses TT133-2016 semantic
- Reconcile as_of 2027-12-31 → Uses TT99-2025 semantic

---

### Scenario 2: Ministry Issues Posting Rule Clarification

**Timeline:**
```
2026: TT99-2025 baseline — Vendor prepayment → Nợ 331
2027: Ministry Circular 123/2027 — Vendor prepayment → Nợ 142
```

**Bella Handling:**
```sql
-- 2026: Policy v1.0 (TK 331)
INSERT INTO accounting_policies VALUES (
  'VN-TT99-2025',
  'VENDOR_PREPAYMENT_POSTING',
  '1.0.0',
  '2026-01-01',
  '2026-12-31',
  '{"posting_rules": {"prepayment_recorded": {"debit_account": "331", ...}}}'
);

-- 2027: Policy v1.1 (TK 142)
INSERT INTO accounting_policies VALUES (
  'VN-TT99-2025',  -- Same regime
  'VENDOR_PREPAYMENT_POSTING',
  '1.1.0',
  '2027-01-01',
  NULL,
  '{"posting_rules": {"prepayment_recorded": {"debit_account": "142", ...}}}'
);
```

**F5 Reconciliation:**
- Reconcile as_of 2026-12-31 → Uses Policy v1.0 (TK 331)
- Reconcile as_of 2027-12-31 → Uses Policy v1.1 (TK 142)

---

### Scenario 3: SME on TT133, Ministry Issues TT133 Guidance (2027)

**Timeline:**
```
2026: SME uses TT133-2016, Policy v1.0
2027: Ministry guidance on TT133 → Rule change
```

**Bella Handling:**
```sql
-- TT133-2016 continues as regime
-- But policy version updated

INSERT INTO accounting_policies VALUES (
  'VN-TT133-2016',  -- Regime unchanged
  'VENDOR_PREPAYMENT_POSTING',
  '1.1.0',  -- New policy version
  '2027-01-01',
  NULL,
  '{"posting_rules": {...}}'  -- Updated rules per guidance
);
```

**Key:** Policy versioning works for **any regime** (TT133, TT99, TTxxx).

---

## Finance Kernel Abstraction (AR-010)

### What Finance Kernel Knows

```
Finance Kernel Responsibility:
- Store transactions (events)
- Store journal entries (debits/credits)
- Store ledger (account balances)
- Provide temporal queries (as_of)
- Enforce double-entry integrity (Σ debit = Σ credit)
```

### What Finance Kernel Does NOT Know

```
Finance Kernel Does NOT Know:
- Which account code to use (331 vs 142)
- When to recognize revenue/expense
- How to classify on balance sheet
- Which regime/policy applies
- Recognition criteria
- Reporting presentation rules
```

### Separation of Concerns

```
Business Event: "Vendor prepayment recorded"
        ↓
Posting Rule Resolver (regime + policy + as_of)
        ↓
Resolved Rule: "Nợ 331 / Có 111" (from policy v1.0)
        ↓
Finance Kernel: Create journal entry
        INSERT INTO finance_transaction_lines (
          account_id = (SELECT id WHERE account_code = '331'),
          debit = 100000000,
          credit = 0
        )
        ↓
Ledger: Store immutable transaction
```

**Benefit:** Finance Kernel never changes when accounting rules change.

---

## F5 Reconciliation: Regime + Policy Aware

### F5 Reconciliation Logic (Pseudocode)

```sql
-- Step 1: Resolve tenant's regime at as_of date
WITH tenant_regime AS (
  SELECT regime_code
  FROM tenant_accounting_regimes
  WHERE tenant_id = :tenant_id
    AND :as_of BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31')
),

-- Step 2: Resolve policy version at as_of date
policy_at_date AS (
  SELECT policy_version, policy_rules
  FROM accounting_policies
  WHERE regime_code = (SELECT regime_code FROM tenant_regime)
    AND policy_domain = :policy_domain  -- e.g., 'VENDOR_PREPAYMENT_POSTING'
    AND :as_of BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31')
),

-- Step 3: Extract posting rules from policy
posting_rules AS (
  SELECT
    policy_rules->'posting_rules'->'prepayment_recorded'->>'debit_account' AS debit_account,
    policy_rules->'posting_rules'->'prepayment_recorded'->>'credit_account' AS credit_account
  FROM policy_at_date
),

-- Step 4: Reconcile using resolved posting rules
reconciliation_result AS (
  SELECT
    vendor_id,
    SUM(
      CASE 
        WHEN fa.account_code = (SELECT debit_account FROM posting_rules)
             AND ftl.debit > 0 THEN ftl.debit
        WHEN fa.account_code = (SELECT debit_account FROM posting_rules)
             AND ftl.credit > 0 THEN -ftl.credit
      END
    ) AS balance
  FROM finance_transaction_lines ftl
  JOIN finance_accounts fa ON ftl.account_id = fa.id
  WHERE ftl.posted_at <= :as_of
  GROUP BY vendor_id
)

SELECT * FROM reconciliation_result;
```

**Key:** Posting rules are **resolved at as_of date**, not hard-coded or using current rules.

---

## Schema Design

### `tenant_accounting_regimes`

```sql
CREATE TABLE tenant_accounting_regimes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  regime_code TEXT NOT NULL,  -- 'VN-TT133-2016', 'VN-TT99-2025'
  regime_name TEXT NOT NULL,  -- 'Thông tư 133/2016/TT-BTC'
  
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current
  status TEXT NOT NULL,  -- 'ACTIVE' | 'SUPERSEDED'
  
  transitioned_from_regime_id UUID REFERENCES tenant_accounting_regimes(id),
  transition_method TEXT,  -- 'PROSPECTIVE' | 'RETROSPECTIVE'
  
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  CONSTRAINT no_overlapping_periods EXCLUDE USING gist (
    tenant_id WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date)) WITH &&
  )
);
```

---

### `accounting_policies`

```sql
CREATE TABLE accounting_policies (
  id UUID PRIMARY KEY,
  
  regime_code TEXT NOT NULL,  -- 'VN-TT99-2025'
  policy_domain TEXT NOT NULL,  -- 'VENDOR_PREPAYMENT_POSTING'
  policy_name TEXT NOT NULL,
  policy_version TEXT NOT NULL,  -- '1.0.0', '1.1.0'
  
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current
  status TEXT NOT NULL,  -- 'ACTIVE' | 'SUPERSEDED'
  
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
      ...
    },
    "reporting_presentation": {...}
  }
  */
  
  superseded_by_policy_id UUID REFERENCES accounting_policies(id),
  change_reason TEXT,
  change_authority TEXT,  -- e.g., "Ministry Circular 123/2027"
  
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  UNIQUE (regime_code, policy_domain, policy_version),
  
  CONSTRAINT no_overlapping_policy_periods EXCLUDE USING gist (
    regime_code WITH =,
    policy_domain WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date)) WITH &&
  )
);
```

---

### `accounting_semantic_registry` (from F5-S0.2)

```sql
CREATE TABLE accounting_semantic_registry (
  id UUID PRIMARY KEY,
  
  regime_code TEXT NOT NULL,  -- 'VN-TT99-2025'
  regime_version TEXT NOT NULL DEFAULT '1.0.0',
  account_code TEXT NOT NULL,  -- '331'
  account_name TEXT NOT NULL,  -- 'Phải trả cho người bán'
  
  semantic_rules JSONB NOT NULL,
  /*
  {
    "normal_balance": "CREDIT",
    "debit_balance_semantics": {...},
    "credit_balance_semantics": {...}
  }
  */
  
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  source_authority TEXT NOT NULL,  -- 'TT99/2025 Phụ lục II'
  
  UNIQUE (regime_code, regime_version, account_code)
);
```

---

### `finance_transactions` Extension

```sql
ALTER TABLE finance_transactions
ADD COLUMN accounting_regime_code TEXT,
ADD COLUMN accounting_policy_version TEXT;

-- Example transaction recording:
INSERT INTO finance_transactions (
  tenant_id,
  posted_at,
  accounting_regime_code,
  accounting_policy_version,
  business_event_type,
  ...
) VALUES (
  :tenant_id,
  '2026-05-15',
  'VN-TT99-2025',  -- Regime at posting time
  '1.0.0',  -- Policy version at posting time
  'VENDOR_PREPAYMENT_RECORDED',
  ...
);
```

**Purpose:** Every transaction records its **accounting context at posting time** for historical reproducibility.

---

## Impact on F5.6 Research

### Updated Research Roadmap

```
F5.6 Research:

Part A: Legal Framework Foundation
├── A.1 — Vietnamese Accounting Law ✅
├── A.2 — VAS Applicability ❌
├── A.3 — Regime Versioning (TT133 vs TT99) 🔴 F5-S0.2
│   ├── TT133/2016 applicability
│   ├── TT99/2025 applicability
│   ├── SME transition rules
│   ├── Regime versioning schemas
│   └── F5 regime resolution logic
│
└── A.4 — Policy Versioning Framework 🔴 F5-S0.3
    ├── Policy domain taxonomy
    ├── Policy version control
    ├── Posting rule effective dating
    ├── Change governance workflow
    └── Finance Kernel abstraction boundary

Part B: Cash Domain
├── B.1 — TT99/2025 Cash Accounts ✅
├── B.2 — TT133/2016 Cash Accounts ❌
├── B.3 — Cash Posting Rules (versioned) ❌
└── ...

Part C: Vendor Prepayment Domain
├── C.1 — TT99/2025 vendor prepayment ✅
├── C.1b — TT133/2016 vendor prepayment ❌
├── C.2 — Posting Rules (BOTH regimes, versioned) 🔴 UPDATED
│   ├── TT99 v1.0 posting rules
│   ├── TT133 v1.0 posting rules
│   └── Future rule change handling
├── C.3 — Bella F1 implementation 🟡
├── C.4 — Regime semantic equivalence ❌
└── C.5 — Policy versioning implementation ❌ NEW

Part D: Cross-Domain
├── D.1 — Regime-aware temporal consistency ❌
└── D.2 — Policy-aware period closing ❌
```

---

## Governance: Regime & Policy Change Workflow

### Regime Change Workflow

```
Step 1: Regime Change Proposal
        - New regime announced by Ministry
        - Tenant requests transition

Step 2: Eligibility Check
        - Verify tenant can transition
        - Check transition rules (mandatory vs optional)

Step 3: Transition Plan
        - Choose method: PROSPECTIVE | RETROSPECTIVE | SIMPLIFIED_RETROSPECTIVE
        - Define effective date
        - Prepare comparative information restatement

Step 4: Approval
        - Financial controller approval
        - External auditor review (if required)

Step 5: Execute Transition
        - Close old regime (set effective_to)
        - Create new regime (set effective_from)
        - Record transition in tenant_accounting_regimes

Step 6: Disclosure
        - Update financial statement notes
        - Document transition reason and impact
```

---

### Policy Change Workflow

```
Step 1: Policy Change Trigger
        - Ministry issues guidance/clarification
        - Internal policy update
        - Auditor recommendation

Step 2: Impact Assessment
        - Identify affected policy domains
        - Determine effective date
        - Assess impact on historical transactions (none per AR-007)

Step 3: Policy Version Creation
        - Close old policy version (set effective_to)
        - Create new policy version (set effective_from)
        - Document change reason and authority

Step 4: Approval
        - Financial controller approval
        - Internal audit review

Step 5: Execute Policy Change
        - Record in accounting_policies table
        - New transactions use new policy
        - Historical transactions unchanged

Step 6: Monitoring
        - Verify F5 reconciliation uses correct policy version
        - Audit trail review
```

---

## Benefits of Regulatory Agility Architecture

### 1. Future-Proof

**Scenario:** Ministry issues TT103/2030 in 5 years.

**Bella Response:**
- ✅ Create VN-TT103-2030 regime entry
- ✅ Create VN-TT103-2030 semantic registry
- ✅ VN-TT99-2025 semantic unchanged (immutable)
- ✅ Historical transactions retain TT99 semantic
- ✅ F5 reconciliation automatically uses correct regime per as_of

**No Finance Kernel changes required.**

---

### 2. Audit Compliance

**Auditor Question:** "What accounting rules were used for 2026 transactions?"

**Bella Answer:**
```sql
SELECT
  ft.id,
  ft.posted_at,
  ft.accounting_regime_code,
  ft.accounting_policy_version
FROM finance_transactions ft
WHERE ft.posted_at BETWEEN '2026-01-01' AND '2026-12-31'
LIMIT 10;

-- Result:
-- id | posted_at  | regime_code   | policy_version
-- 1  | 2026-05-15 | VN-TT99-2025 | 1.0.0
-- 2  | 2026-08-20 | VN-TT99-2025 | 1.0.0
```

**Every transaction has audit trail of accounting context.**

---

### 3. Historical Reproducibility (G8)

**Requirement:** Reconcile 2026 data in year 2031 (5 years later).

**Bella F5:**
```sql
-- Reconcile as_of 2026-12-31
-- Resolves:
--   Regime: VN-TT99-2025
--   Policy: v1.0.0 (effective at 2026-12-31)
-- Uses posting rules from 2026, NOT 2031 current rules
```

**G8 (Temporal Determinism) verified.**

---

### 4. Regulatory Agility

**Two types of changes handled:**
- Regime change (TT133 → TT99 → TTxxx)
- Policy change (v1.0 → v1.1 → v1.2)

**Finance Kernel unchanged.**

**Bella survives 10-20 years of regulatory evolution.**

---

## Conclusion

F5-S0 Regulatory Agility Architecture provides **constitutional foundation** for Bella Finance OS to adapt to accounting regulation changes without rewriting core systems.

**Three Amendments:**
- F5-S0.1: Vietnamese Accounting Authority
- F5-S0.2: Accounting Regime Versioning (AR-001 to AR-005)
- F5-S0.3: Accounting Policy Versioning (AR-006 to AR-010)

**Ten Constitutional Invariants** govern regime/policy versioning, effective dating, historical immutability, semantic isolation, and Finance Kernel abstraction.

**Key Architectural Principle:**
> "Finance Kernel processes financial essence. Accounting Policy decides regulatory application. Posting Rules decide how business events become journal entries."

**F5.6 Research** must now implement A.3 (Regime Versioning) and A.4 (Policy Versioning) before proceeding to domain-specific semantic research (Cash, Prepayment).

---

**Status:** 🔒 **CONSTITUTIONAL FOUNDATION ESTABLISHED**

**Next:** Human Architect reviews F5-S0.2 + F5-S0.3, approves research scope for A.3 + A.4
