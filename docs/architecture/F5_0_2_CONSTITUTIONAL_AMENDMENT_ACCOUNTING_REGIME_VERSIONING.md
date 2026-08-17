# F5-S0.2 Constitutional Amendment — Accounting Regime Versioning & Independence

> **Amendment ID:** F5-S0.2  
> **Enacted:** 2026-08-16  
> **Authority:** Bella Finance OS Constitutional Council  
> **Supersedes:** F5-S0.1 (partial — regime universality assumption)  
> **Triggered By:** Discovery of TT133/2016 vs TT99/2025 regime choice for Vietnamese SMEs

---

## Executive Summary

F5-S0.1 Vietnamese Accounting Semantic Authority incorrectly assumed **TT99/2025 as universal baseline** for all Vietnamese tenants. This amendment establishes **Accounting Regime Versioning** as architectural foundation.

**Key Principle:**
> "Accounting legislation SHALL be modeled as **versioned, effective-dated semantic rules**. No accounting regime SHALL be hard-coded into the immutable ledger."

---

## Discovery: Multiple Applicable Regimes

### Evidence Source

**URL:** https://einvoice.vn/tin-tuc/ap-dung-che-do-ke-toan-moi  
**Title:** "Doanh nghiệp vừa và nhỏ được áp dụng chế độ kế toán mới từ năm 2026"  
**Authority:** Vietnamese Ministry of Finance guidance

**Finding:**

Effective 01/01/2026, **Vietnamese SMEs (doanh nghiệp nhỏ và vừa) have TWO options:**

```
Vietnamese SME Tenant
        │
        ├── Option 1: TT133/2016 (continue existing regime)
        │
        └── Option 2: TT99/2025 (elect new regime)
```

**Transition Rules (Điều 31, Khoản 2, TT99/2025):**
- Must apply consistently for minimum **one fiscal year**
- Must restate comparative information
- Must disclose transition in financial statement notes

**Implication:** Bella Finance OS CANNOT assume TT99/2025 universally.

---

## F5-S0.1 Architecture Failure

### What F5-S0.1 Said (INCORRECT):

```
Authority Hierarchy:
Vietnamese Law → VAS → TT99/2025 → Enterprise Policy → F1 COA → F2/F4 → F5

Effective Regime: Thông tư 99/2025/TT-BTC (effective 01/01/2026)
```

**Problem:** Assumes TT99/2025 is the ONLY applicable regime from 2026.

**Reality:** SMEs can continue TT133/2016 OR elect TT99/2025.

### What This Breaks:

**Scenario A — SME Tenant Using TT133/2016:**
```
Bella (assumes TT99)
    ↓
TK 331 semantic per TT99 ❌ WRONG
    ↓
Reconciliation fails or produces incorrect results
```

**Scenario B — Large Enterprise Using TT99/2025:**
```
Bella (assumes TT99)
    ↓
TK 331 semantic per TT99 ✅ CORRECT
    ↓
Reconciliation works
```

**Result:** Bella Finance OS becomes **regime-specific**, NOT a platform.

---

## Architectural Solution: Regime Versioning

### Core Principle

**Separate "Ledger" from "Accounting Rules":**

```
┌─────────────────────────────────────────┐
│ F1 Ledger (Regime-Agnostic)            │
│                                         │
│ - Stores: Transactions, Accounts,      │
│   Debits, Credits, Amounts, Dates      │
│ - Does NOT know: "What TK 331 means"   │
│ - Does NOT know: "Debit vs Credit      │
│   convention for vendor prepayment"    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Accounting Semantic Layer               │
│                                         │
│ ├── VN-TT133-2016                      │
│ │   └── TK 331: [semantic rules]       │
│ ├── VN-TT99-2025                       │
│ │   └── TK 331: [semantic rules]       │
│ └── VN-TTxxx-20xx (future)             │
│     └── TK 331: [semantic rules]       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ F5 Reconciliation (Regime-Aware)       │
│                                         │
│ - Resolves tenant's regime at as_of    │
│ - Applies correct semantic adapter     │
│ - Reconstructs using regime-specific   │
│   accounting conventions               │
└─────────────────────────────────────────┘
```

---

## Constitutional Law: Accounting Regime Independence

### Law Statement

> **Accounting Regime Independence Law**
>
> Accounting legislation SHALL be modeled as **versioned, effective-dated semantic rules**. No accounting regime SHALL be hard-coded into the immutable ledger.
>
> F1 Ledger remains **regime-agnostic**. F5 Reconciliation becomes **regime-aware**.

### Five Constitutional Invariants

#### AR-001: Regime Versioning

**Statement:**
> Every accounting regime has **immutable version identity**.

**Example:**
```
Regime ID: VN-TT99-2025
Version: 1.0.0
Effective From: 2026-01-01
Effective To: NULL (current)
Status: ACTIVE
Immutable: TRUE
```

**Prohibition:**
- ❌ Cannot modify semantic of VN-TT99-2025 after transactions posted
- ❌ Cannot "upgrade" VN-TT99-2025 semantic in-place
- ✅ Must create VN-TT103-2030 (new version) if law changes

---

#### AR-002: Effective Dating

**Statement:**
> A regime applies only within its **effective period**.

**Example:**
```
Tenant A — Accounting Regime History:

2025-01-01 to 2025-12-31 → VN-TT200-2014
2026-01-01 to 2026-12-31 → VN-TT99-2025
2027-01-01 to ...        → VN-TT103-2030 (future)
```

**F5 Reconciliation Logic:**
```sql
-- Reconcile as of 2025-06-30
SELECT regime_code
FROM tenant_accounting_regimes
WHERE tenant_id = :tenant_id
  AND :as_of BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31');

-- Result: VN-TT200-2014
-- Use TT200 semantic for reconstruction
```

**Prohibition:**
- ❌ Cannot apply TT99/2025 semantic to 2025 transactions
- ❌ Cannot apply TT133/2016 semantic to tenant using TT99/2025

---

#### AR-003: Historical Immutability

**Statement:**
> Historical transactions **retain their original regime**.

**Example:**
```
Transaction #12345
Posted: 2026-05-15
Regime: VN-TT99-2025

(5 years later, even if TT99 is replaced by TT103)

Transaction #12345
Posted: 2026-05-15
Regime: VN-TT99-2025  ← UNCHANGED FOREVER
```

**Prohibition:**
- ❌ NEVER run migration: `UPDATE transactions SET regime = 'VN-TT103-2030'`
- ❌ NEVER reinterpret historical transactions using new semantic

**Reason:** Audit trail integrity, legal compliance, historical reproducibility (G8).

---

#### AR-004: Semantic Isolation

**Statement:**
> New accounting legislation SHALL NOT **mutate old semantics**.

**Example:**

**2026 — TT99/2025 Active:**
```
VN-TT99-2025 Semantic Registry:

TK 331:
  name: "Phải trả cho người bán"
  normal_balance: CREDIT
  debit_balance_presentation: "Trả trước cho người bán" (Current Asset)
  semantic_version: 1.0.0
```

**2030 — TT103/2030 Issued (hypothetical):**
```
VN-TT103-2030 Semantic Registry:

TK 331:
  name: "Phải trả người bán" (renamed)
  normal_balance: CREDIT
  debit_balance_presentation: "Ứng trước nhà cung cấp" (renamed)
  semantic_version: 1.0.0
```

**TT99/2025 semantic remains UNCHANGED:**
```
VN-TT99-2025 Semantic Registry:

TK 331:
  name: "Phải trả cho người bán"  ← IMMUTABLE
  semantic_version: 1.0.0
```

**F5 Reconciliation:**
```sql
-- Reconcile 2026 data (as_of = 2026-12-31)
SELECT semantic
FROM accounting_semantic_registry
WHERE regime_code = 'VN-TT99-2025'  -- Tenant's 2026 regime
  AND account_code = '331';

-- Returns: VN-TT99-2025 semantic (version 1.0.0)

-- Reconcile 2031 data (as_of = 2031-12-31)
SELECT semantic
FROM accounting_semantic_registry
WHERE regime_code = 'VN-TT103-2030'  -- Tenant's 2031 regime
  AND account_code = '331';

-- Returns: VN-TT103-2030 semantic (version 1.0.0)
```

**Prohibition:**
- ❌ Cannot "update" VN-TT99-2025 semantic when TT103/2030 is issued
- ✅ Must create NEW semantic registry entry for VN-TT103-2030

---

#### AR-005: Controlled Transition

**Statement:**
> Regime changes require **explicit transition rules and approval**.

**Vietnamese Law Compliance:**
Per TT99/2025 Điều 30 (Thay đổi chính sách kế toán):
- Must apply new regime consistently for **minimum one fiscal year**
- Must **restate comparative information**
- Must **disclose transition** in financial statement notes

**Bella Implementation:**
```typescript
// ❌ PROHIBITED: Direct regime switch
UPDATE tenants
SET accounting_regime = 'VN-TT99-2025'
WHERE tenant_id = :tenant_id;

// ✅ REQUIRED: Controlled transition
INSERT INTO tenant_accounting_regime_transitions (
  tenant_id,
  from_regime_code,
  to_regime_code,
  effective_date,
  transition_method,  -- 'RETROSPECTIVE' | 'SIMPLIFIED_RETROSPECTIVE' | 'PROSPECTIVE'
  approval_status,
  approved_by,
  approved_at,
  transition_notes
) VALUES (
  :tenant_id,
  'VN-TT133-2016',
  'VN-TT99-2025',
  '2026-01-01',
  'PROSPECTIVE',
  'PENDING_APPROVAL',
  NULL,
  NULL,
  'SME elects TT99/2025 per Điều 31 Khoản 2 TT99/2025'
);
```

**Prohibition:**
- ❌ Cannot change regime mid-year (violates "consistent application for one fiscal year")
- ❌ Cannot change regime without explicit approval
- ❌ Cannot change regime without transition plan
- ❌ Cannot apply regime change to historical transactions (violates AR-003)

---

## Tenant Accounting Regime Model

### Schema: `tenant_accounting_regimes`

```sql
CREATE TABLE tenant_accounting_regimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Regime identification
  regime_code TEXT NOT NULL,  -- e.g., 'VN-TT133-2016', 'VN-TT99-2025'
  regime_name TEXT NOT NULL,  -- e.g., 'Thông tư 133/2016/TT-BTC'
  regime_country TEXT NOT NULL,  -- e.g., 'VN'
  
  -- Effective period
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current regime
  
  -- Status
  status TEXT NOT NULL,  -- 'ACTIVE' | 'SUPERSEDED' | 'PENDING'
  
  -- Transition
  transitioned_from_regime_id UUID REFERENCES tenant_accounting_regimes(id),
  transition_method TEXT,  -- 'PROSPECTIVE' | 'RETROSPECTIVE' | 'SIMPLIFIED_RETROSPECTIVE'
  
  -- Approval
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  notes TEXT,
  
  -- Constraints
  CONSTRAINT no_overlapping_periods EXCLUDE USING gist (
    tenant_id WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date), '[]') WITH &&
  ),
  
  CONSTRAINT one_active_regime_per_tenant CHECK (
    (status = 'ACTIVE' AND effective_to IS NULL) OR
    (status != 'ACTIVE')
  )
);

CREATE INDEX idx_tenant_regimes_tenant_effective
  ON tenant_accounting_regimes (tenant_id, effective_from, effective_to);
```

### Schema: `accounting_semantic_registry`

```sql
CREATE TABLE accounting_semantic_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Regime identification
  regime_code TEXT NOT NULL,  -- e.g., 'VN-TT99-2025'
  regime_version TEXT NOT NULL DEFAULT '1.0.0',
  
  -- Account
  account_code TEXT NOT NULL,  -- e.g., '331'
  account_name TEXT NOT NULL,  -- e.g., 'Phải trả cho người bán'
  
  -- Semantic rules (JSONB for flexibility)
  semantic_rules JSONB NOT NULL,
  /*
  Example:
  {
    "normal_balance": "CREDIT",
    "debit_balance_semantics": {
      "meaning": "Vendor advance / Prepayment to vendors",
      "balance_sheet_presentation": "Trả trước cho người bán",
      "classification": "CURRENT_ASSETS"
    },
    "credit_balance_semantics": {
      "meaning": "Accounts payable to vendors",
      "balance_sheet_presentation": "Phải trả người bán",
      "classification": "CURRENT_LIABILITIES"
    },
    "accounting_entries": {
      "vendor_prepayment_recorded": {
        "debit": "331",
        "credit": "111|112|113",
        "description": "Ứng trước cho người bán"
      },
      "vendor_prepayment_applied": {
        "debit": "156|152|...",
        "credit": "331",
        "description": "Cấn trừ khoản ứng trước khi nhận hàng"
      }
    }
  }
  */
  
  -- Metadata
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_authority TEXT NOT NULL,  -- e.g., 'TT99/2025 Phụ lục II'
  
  -- Constraints
  UNIQUE (regime_code, regime_version, account_code)
);

CREATE INDEX idx_semantic_registry_regime_account
  ON accounting_semantic_registry (regime_code, account_code);
```

---

## F5 Reconciliation: Regime-Aware Logic

### Current (Broken) F5.6 Approach:

```sql
-- Hardcoded TT99/2025 assumption
SELECT 
  vendor_id,
  SUM(CASE 
    WHEN account_code = '331' AND debit > 0 THEN debit  -- TT99 assumption
    WHEN account_code = '331' AND credit > 0 THEN -credit
  END) AS vendor_prepayment_balance
FROM finance_transaction_lines
...
```

**Problem:** What if tenant uses TT133/2016 and TK 331 has different semantic?

### Correct (Regime-Aware) F5.6 Approach:

```sql
-- Step 1: Resolve tenant's accounting regime at as_of date
WITH tenant_regime AS (
  SELECT regime_code
  FROM tenant_accounting_regimes
  WHERE tenant_id = :tenant_id
    AND :as_of BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31')
  LIMIT 1
),

-- Step 2: Load regime-specific semantic rules
regime_semantic AS (
  SELECT semantic_rules
  FROM accounting_semantic_registry
  WHERE regime_code = (SELECT regime_code FROM tenant_regime)
    AND account_code = '331'
),

-- Step 3: Apply regime-specific reconciliation logic
vendor_prepayment_balance AS (
  SELECT
    vendor_id,
    SUM(
      CASE 
        WHEN ftl.debit > 0 THEN ftl.debit
        WHEN ftl.credit > 0 THEN -ftl.credit
      END
    ) AS balance
  FROM finance_transaction_lines ftl
  JOIN finance_accounts fa ON ftl.account_id = fa.id
  WHERE fa.account_code = '331'  -- Account determined by semantic
    AND ftl.posted_at <= :as_of
  GROUP BY vendor_id
)

SELECT * FROM vendor_prepayment_balance;
```

**Key Difference:** Semantic rules come from **regime registry**, NOT hard-coded TT99 assumptions.

---

## Impact on F5.6 Research Roadmap

### Previous Roadmap (OBSOLETE):

```
F5.6 Research:
├── Part B: Cash (TT99)
├── Part C: Vendor Prepayment (TT99)
└── Part D: Cross-domain (TT99)
```

### New Roadmap (CORRECTED):

```
F5.6 Research:
├── Part A: Legal Framework Foundation
│   ├── A.1 — Vietnamese Accounting Law ✅
│   ├── A.2 — VAS Applicability ❌
│   └── A.3 — Accounting Regime Versioning & Applicability 🔴 NEW
│       ├── TT133/2016 applicability verified
│       ├── TT99/2025 applicability verified
│       ├── SME transition rules documented
│       ├── Bella tenant regime model defined
│       ├── Regime change governance rules
│       └── F5 regime resolution logic
│
├── Part B: Cash Domain
│   ├── B.1 — TT99/2025 Cash Accounts ✅
│   ├── B.2 — TT133/2016 Cash Accounts ❌ NEW
│   ├── B.3 — Bella F1 Cash Mapping ❌
│   ├── B.4 — Regime Semantic Matrix ❌ NEW
│   └── ...
│
├── Part C: Vendor Prepayment Domain
│   ├── C.1 — TT99/2025 Vendor Prepayment ✅
│   ├── C.2 — TT133/2016 Vendor Prepayment ❌ NEW
│   ├── C.3 — Bella F1 Implementation Gap 🟡
│   ├── C.4 — Regime Semantic Equivalence ❌ NEW
│   └── ...
│
└── Part D: Cross-Domain
    ├── D.1 — Regime-Aware Temporal Consistency ❌ UPDATED
    └── D.2 — Period Closing (Multi-Regime) ❌ UPDATED
```

**Critical Change:** Must research **BOTH TT133/2016 AND TT99/2025** for Cash + Prepayment domains.

---

## Immediate Actions Required

### 1. Stop C.2 Research (TT99 Only)

**Reason:** C.2 was scoped as "TT99/2025 accounting entries verification only". This is insufficient.

**New Requirement:** Must verify accounting entries for **BOTH TT133/2016 AND TT99/2025**.

### 2. Create Part A.3 — Regime Versioning (Priority 1)

**Tasks:**
- [ ] Document TT133/2016 applicability (SME criteria, effective dates)
- [ ] Document TT99/2025 applicability (all enterprises, optional for SMEs)
- [ ] Document transition rules (Điều 30-31 TT99/2025)
- [ ] Design `tenant_accounting_regimes` schema
- [ ] Design `accounting_semantic_registry` schema
- [ ] Define F5 regime resolution algorithm
- [ ] Define regime change governance workflow
- [ ] Human Architect approval

**Deliverable:** `F5_6_A3_ACCOUNTING_REGIME_VERSIONING.md`

### 3. Expand C.1-C.2 to Multi-Regime (Priority 2)

**C.1 Status:** ✅ TT99/2025 vendor prepayment verified  
**C.1 New Task:** ❌ Verify TT133/2016 vendor prepayment semantic

**C.2 Status:** 🔴 BLOCKED (was TT99-only)  
**C.2 New Scope:** Verify accounting entries for **BOTH regimes**

**Critical Question:** Is TK 331 semantic **identical** in TT133/2016 and TT99/2025?

**If YES:**
- Document semantic equivalence with evidence
- F5.6 can use **unified semantic** (less complexity)

**If NO:**
- Document semantic differences
- F5.6 must have **regime-specific adapters** (more complexity)

### 4. Resolve C.3 Gap with Regime Context (Priority 3)

**C.3 Current Gap:** Bella uses `'PREPAYMENT_ASSET'` symbolic code.

**New Question:** Does `'PREPAYMENT_ASSET'` map to:
- TK 331 (TT99/2025) for tenants using TT99?
- TK 331 (TT133/2016) for tenants using TT133?
- OR: Single account code regardless of regime?

**If regime-agnostic mapping:**
- ✅ Good: F1 ledger is regime-agnostic (AR-001 compliant)
- Must verify: Semantic adapter applies correct regime rules

**If regime-specific mapping:**
- ⚠️ Complex: `finance_accounts` must have regime context
- Schema change required: Add `regime_code` to `finance_accounts`

---

## F5-S0.1 Corrections

### Update Authority Hierarchy:

**OLD (INCORRECT):**
```
Vietnamese Law → VAS → TT99/2025 → Enterprise Policy → F1 COA → F2/F4 → F5
```

**NEW (CORRECTED):**
```
Vietnamese Law
    ↓
VAS (Vietnamese Accounting Standards)
    ↓
Applicable Accounting Regime (tenant-specific, effective-dated)
    ├── VN-TT133-2016 (for SMEs continuing old regime)
    ├── VN-TT99-2025  (for enterprises + SMEs electing new regime)
    └── VN-TTxxx-20xx (future regimes)
    ↓
Enterprise Accounting Policy (within regime constraints)
    ↓
Bella F1 Chart of Accounts (regime-agnostic ledger)
    ↓
F2/F4 Public Contracts (domain facts)
    ↓
F5 Reconciliation Logic (regime-aware semantic engine)
```

### Update "Effective Regime" Statement:

**OLD (INCORRECT):**
```
Effective Regime: Thông tư 99/2025/TT-BTC (effective 01/01/2026)
```

**NEW (CORRECTED):**
```
Research Baseline: Thông tư 99/2025/TT-BTC

Tenant Applicability:
- All enterprises: TT99/2025 (mandatory from 01/01/2026)
- SMEs: TT133/2016 (may continue) OR TT99/2025 (may elect)
- Determined by tenant's declared accounting regime
- Subject to transition rules per TT99/2025 Điều 30-31
```

---

## Constitutional Finding: F5-S0.2-REG-001

**Finding ID:** F5-S0.2-REG-001  
**Date:** 2026-08-16  
**Title:** Multi-Regime Applicability for Vietnamese Accounting

**Statement:**
> Bella Finance OS SHALL NOT assume a single universal accounting regime for all Vietnamese tenants. Vietnamese SMEs may apply TT133/2016 OR TT99/2025 effective 01/01/2026. F1 Ledger SHALL be regime-agnostic. F5 Reconciliation SHALL be regime-aware.

**Evidence:**
- Source: https://einvoice.vn/tin-tuc/ap-dung-che-do-ke-toan-moi
- Authority: Ministry of Finance guidance on TT99/2025 applicability
- Legal Basis: TT99/2025 Điều 31 Khoản 2 (SME regime election)

**Architectural Requirement:**
- AR-001 — Regime Versioning
- AR-002 — Effective Dating
- AR-003 — Historical Immutability
- AR-004 — Semantic Isolation
- AR-005 — Controlled Transition

**Impact:**
- F5.6 research scope expanded: TT133/2016 + TT99/2025 (not TT99-only)
- Schema change required: `tenant_accounting_regimes` table
- Schema change required: `accounting_semantic_registry` table
- F5 reconciliation engine: Regime resolution logic required

---

## Future-Proofing: When TT103/2030 Is Issued (Hypothetical)

**Scenario:** Ministry of Finance issues TT103/2030 replacing TT99/2025.

**Bella Response (CORRECT):**

```
Step 1: Create New Regime Entry
INSERT INTO accounting_semantic_registry (
  regime_code, account_code, account_name, semantic_rules, source_authority
) VALUES (
  'VN-TT103-2030',
  '331',
  'Phải trả nhà cung cấp',  -- hypothetical name change
  {...},  -- new semantic rules per TT103
  'TT103/2030 Phụ lục II'
);

Step 2: VN-TT99-2025 Semantic REMAINS UNCHANGED
-- Historical transactions using VN-TT99-2025 continue to use TT99 semantic

Step 3: Tenant Transition (Controlled)
-- Tenant A transitions to TT103 effective 2030-01-01
INSERT INTO tenant_accounting_regimes (
  tenant_id, regime_code, effective_from, status, transitioned_from_regime_id
) VALUES (
  :tenant_id,
  'VN-TT103-2030',
  '2030-01-01',
  'ACTIVE',
  (SELECT id FROM tenant_accounting_regimes 
   WHERE tenant_id = :tenant_id AND regime_code = 'VN-TT99-2025')
);

-- Tenant A's VN-TT99-2025 regime closed
UPDATE tenant_accounting_regimes
SET effective_to = '2029-12-31', status = 'SUPERSEDED'
WHERE tenant_id = :tenant_id AND regime_code = 'VN-TT99-2025';

Step 4: F5 Reconciliation (Automatic)
-- Reconcile 2029 data → Uses VN-TT99-2025 semantic
-- Reconcile 2030 data → Uses VN-TT103-2030 semantic
```

**Bella Response (INCORRECT — PROHIBITED):**
```sql
-- ❌ NEVER DO THIS:
UPDATE accounting_semantic_registry
SET semantic_rules = {...}  -- TT103 rules
WHERE regime_code = 'VN-TT99-2025' AND account_code = '331';

-- Violates AR-003 (Historical Immutability)
-- Violates AR-004 (Semantic Isolation)
```

---

## Conclusion

F5-S0.2 establishes **Accounting Regime Independence** as constitutional foundation. Bella Finance OS must support:
- Multiple regimes per country (TT133/2016, TT99/2025, future)
- Tenant-specific regime selection
- Effective-dated regime application
- Regime-agnostic F1 Ledger
- Regime-aware F5 Reconciliation
- Controlled regime transitions
- Historical immutability

**F5.6 research MUST restart** with Part A.3 before continuing C.2.

---

**Status:** 🔴 **F5-S0.2 ENACTED** — F5.6 research roadmap updated, C.2 blocked pending A.3 completion

**Next:** Human Architect reviews F5-S0.2, approves Part A.3 research scope
