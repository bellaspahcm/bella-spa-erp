# F5.6-A.3 Discovery — Accounting Regime Versioning Required

**Date:** 2026-08-16  
**Status:** 🔴 **CRITICAL — BLOCKS ALL C.2+ RESEARCH**  
**Constitutional Authority:** F5-S0.2 Amendment  
**Triggered By:** einvoice.vn article on TT133/2016 vs TT99/2025 applicability

---

## Executive Summary

**F5-S0.1 assumed TT99/2025 as universal baseline for all Vietnamese tenants. This is INCORRECT.**

Vietnamese SMEs (doanh nghiệp nhỏ và vừa) can **choose between TT133/2016 OR TT99/2025** effective 01/01/2026.

**Implication:** Bella Finance OS must support **multi-regime architecture**, not hard-code TT99/2025.

---

## Discovery Source

**URL:** https://einvoice.vn/tin-tuc/ap-dung-che-do-ke-toan-moi  
**Title:** "Doanh nghiệp vừa và nhỏ được áp dụng chế độ kế toán mới từ năm 2026"  
**Authority:** Vietnamese Ministry of Finance guidance

**Key Finding:**

From 01/01/2026, Vietnamese SMEs have **TWO options:**

```
Vietnamese SME Tenant
        │
        ├── Option 1: TT133/2016 (Thông tư 133/2016/TT-BTC)
        │              Continue existing accounting regime
        │
        └── Option 2: TT99/2025 (Thông tư 99/2025/TT-BTC)
                       Elect new accounting regime
```

**Transition Rules (TT99/2025 Điều 31 Khoản 2):**
- Must apply consistently for **minimum one fiscal year**
- Must **restate comparative information**
- Must **disclose transition** in financial statement notes

---

## Why F5-S0.1 Is Wrong

### F5-S0.1 Said (INCORRECT):

```
Authority Hierarchy:
Vietnamese Law → VAS → TT99/2025 → Enterprise Policy → F1 COA → F2/F4 → F5

Effective Regime: Thông tư 99/2025/TT-BTC (effective 01/01/2026)
```

**Assumption:** TT99/2025 is the ONLY applicable regime from 2026.

**Reality:** SMEs can continue TT133/2016 OR elect TT99/2025.

### What This Breaks:

**Scenario: SME Tenant Using TT133/2016**

```
Bella (assumes TT99 universally)
    ↓
Applies TK 331 semantic per TT99
    ↓
❌ WRONG if TK 331 semantic differs in TT133/2016
    ↓
Reconciliation produces incorrect results
```

**Result:** Bella becomes **regime-specific**, not a platform supporting multiple Vietnamese tenants.

---

## Architectural Solution: Regime Versioning

### Core Principle

**Separate "Ledger" from "Accounting Rules":**

```
┌─────────────────────────────────────┐
│ F1 Ledger (Regime-Agnostic)        │
│                                     │
│ - Transactions, Accounts, Amounts  │
│ - Does NOT know TK 331 semantics   │
│ - Does NOT know regime rules       │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ Accounting Semantic Layer           │
│                                     │
│ ├── VN-TT133-2016 (SME option)    │
│ ├── VN-TT99-2025 (new regime)     │
│ └── VN-TTxxx-20xx (future-proof)  │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│ F5 Reconciliation (Regime-Aware)   │
│                                     │
│ - Resolves tenant regime at as_of  │
│ - Applies correct semantic adapter │
└─────────────────────────────────────┘
```

---

## F5-S0.2: Accounting Regime Independence Law

**Enacted:** 2026-08-16  
**Document:** `F5_0_2_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_REGIME_VERSIONING.md`

### Law Statement

> **Accounting Regime Independence Law**
>
> Accounting legislation SHALL be modeled as **versioned, effective-dated semantic rules**. No accounting regime SHALL be hard-coded into the immutable ledger.

### Five Constitutional Invariants

1. **AR-001: Regime Versioning**  
   Every accounting regime has **immutable version identity**.

2. **AR-002: Effective Dating**  
   A regime applies only within its **effective period**.

3. **AR-003: Historical Immutability**  
   Historical transactions **retain their original regime**.

4. **AR-004: Semantic Isolation**  
   New accounting legislation SHALL NOT **mutate old semantics**.

5. **AR-005: Controlled Transition**  
   Regime changes require **explicit transition rules and approval**.

---

## Impact on F5.6 Research

### Previous Roadmap (OBSOLETE):

```
Part C: Vendor Prepayment
├── C.1 — TT99/2025 vendor prepayment ✅
├── C.2 — TT99/2025 accounting entries ❌
└── C.3 — Bella F1 implementation 🟡
```

**Problem:** Only researched TT99/2025. What about tenants using TT133/2016?

### New Roadmap (CORRECTED):

```
Part A: Legal Framework
├── A.1 — Vietnamese Accounting Law ✅
├── A.2 — VAS applicability ❌
└── A.3 — Regime Versioning & Applicability 🔴 NEW (BLOCKS C.2)
    ├── TT133/2016 applicability
    ├── TT99/2025 applicability
    ├── SME transition rules
    ├── Bella tenant regime model
    └── F5 regime resolution logic

Part C: Vendor Prepayment
├── C.1 — TT99/2025 vendor prepayment ✅
├── C.1b — TT133/2016 vendor prepayment ❌ NEW
├── C.2 — Accounting entries (BOTH REGIMES) 🔴 BLOCKED
├── C.3 — Bella F1 implementation 🟡
└── C.4 — Regime semantic equivalence ❌ NEW
    └── Is TK 331 semantic IDENTICAL in TT133 vs TT99?
```

---

## Critical Question: TT133 vs TT99 Semantic Equivalence

**Question:**
> Is TK 331 vendor prepayment semantic **identical** in TT133/2016 and TT99/2025?

**If YES (Semantic Equivalence):**
```
TT133/2016: TK 331 = Phải trả cho người bán (Debit balance = vendor advance)
TT99/2025:  TK 331 = Phải trả cho người bán (Debit balance = vendor advance)

Result: F5.6 can use UNIFIED semantic
        (simpler — one semantic adapter)
```

**If NO (Semantic Difference):**
```
TT133/2016: TK 331 = [Different semantic]
TT99/2025:  TK 331 = Phải trả cho người bán (Debit balance = vendor advance)

Result: F5.6 needs REGIME-SPECIFIC adapters
        (more complex — two semantic adapters)
```

**Evidence Required:**
- Access TT133/2016 Phụ lục (Chart of Accounts)
- Extract TK 331 definition, normal balance, debit/credit semantics
- Compare with TT99/2025 TK 331 semantic
- Document equivalence or differences

---

## Immediate Actions Required

### 1. STOP C.2 Research

**Reason:** C.2 was scoped as "TT99/2025 accounting entries verification only". Insufficient.

**New Requirement:** Must verify accounting entries for **BOTH TT133/2016 AND TT99/2025**.

### 2. CREATE Part A.3 — Regime Versioning (Priority 1)

**Tasks:**
- [ ] A.3.1 — Document TT133/2016 applicability (SME criteria, scope)
- [ ] A.3.2 — Document TT99/2025 applicability (all enterprises + SME option)
- [ ] A.3.3 — Document transition rules (TT99 Điều 30-31)
- [ ] A.3.4 — Design `tenant_accounting_regimes` schema
- [ ] A.3.5 — Design `accounting_semantic_registry` schema
- [ ] A.3.6 — Define F5 regime resolution algorithm
- [ ] A.3.7 — Define regime change governance
- [ ] A.3.8 — Human Architect approval

**Deliverable:** `F5_6_A3_ACCOUNTING_REGIME_VERSIONING.md` (50+ pages)

### 3. EXPAND C.1 to Multi-Regime

**C.1 Current:** ✅ TT99/2025 vendor prepayment verified

**C.1b NEW:** ❌ Verify TT133/2016 vendor prepayment semantic

**C.4 NEW:** ❌ Verify TT133 vs TT99 semantic equivalence

### 4. RESOLVE C.3 with Regime Context

**C.3 Current Gap:** Bella uses `'PREPAYMENT_ASSET'` symbolic code.

**New Question:** Does `'PREPAYMENT_ASSET'` map to:
- TK 331 (TT99) for TT99 tenants?
- TK 331 (TT133) for TT133 tenants?
- Single account code regardless of regime?

**Requires:** Verify if `finance_accounts` has regime context.

---

## Future-Proofing: When Ministry Issues TT103/2030 (Hypothetical)

**Scenario:** Ministry of Finance issues TT103/2030 replacing TT99/2025 in 5 years.

**Bella Response (CORRECT):**

```
Step 1: Create VN-TT103-2030 semantic registry (NEW version)
Step 2: VN-TT99-2025 semantic REMAINS UNCHANGED (immutable)
Step 3: Tenant transitions to TT103 effective 2030-01-01
Step 4: F5 reconciliation:
        - 2029 data → Uses VN-TT99-2025 semantic
        - 2030 data → Uses VN-TT103-2030 semantic
```

**Bella Response (INCORRECT — PROHIBITED):**

```
❌ Update VN-TT99-2025 semantic to TT103 rules
   (Violates AR-003 Historical Immutability)
   (Violates AR-004 Semantic Isolation)
```

---

## Tenant Accounting Regime Model (Proposed)

### Schema: `tenant_accounting_regimes`

```sql
CREATE TABLE tenant_accounting_regimes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  -- Regime
  regime_code TEXT NOT NULL,  -- 'VN-TT133-2016', 'VN-TT99-2025'
  regime_name TEXT NOT NULL,  -- 'Thông tư 133/2016/TT-BTC'
  
  -- Effective period
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = current
  
  -- Status
  status TEXT NOT NULL,  -- 'ACTIVE' | 'SUPERSEDED'
  
  -- Transition
  transitioned_from_regime_id UUID REFERENCES tenant_accounting_regimes(id),
  transition_method TEXT,  -- 'PROSPECTIVE' | 'RETROSPECTIVE'
  
  -- Approval
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  CONSTRAINT no_overlapping_periods EXCLUDE USING gist (
    tenant_id WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::date)) WITH &&
  )
);
```

### Schema: `accounting_semantic_registry`

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
    "debit_balance_semantics": {
      "meaning": "Vendor advance",
      "balance_sheet_presentation": "Trả trước cho người bán",
      "classification": "CURRENT_ASSETS"
    },
    "accounting_entries": {
      "vendor_prepayment_recorded": {
        "debit": "331",
        "credit": "111|112|113"
      }
    }
  }
  */
  
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  source_authority TEXT NOT NULL,  -- 'TT99/2025 Phụ lục II'
  
  UNIQUE (regime_code, regime_version, account_code)
);
```

---

## F5 Reconciliation: Regime Resolution Logic

### Regime-Aware Reconciliation (Pseudocode):

```sql
-- Step 1: Resolve tenant's regime at as_of date
WITH tenant_regime AS (
  SELECT regime_code
  FROM tenant_accounting_regimes
  WHERE tenant_id = :tenant_id
    AND :as_of BETWEEN effective_from AND COALESCE(effective_to, '9999-12-31')
),

-- Step 2: Load regime-specific semantic
regime_semantic AS (
  SELECT semantic_rules
  FROM accounting_semantic_registry
  WHERE regime_code = (SELECT regime_code FROM tenant_regime)
    AND account_code = '331'
),

-- Step 3: Apply regime-specific reconciliation
vendor_prepayment_balance AS (
  SELECT vendor_id, SUM(debit - credit) AS balance
  FROM finance_transaction_lines
  WHERE account_code = '331'  -- From semantic
    AND posted_at <= :as_of
  GROUP BY vendor_id
)

SELECT * FROM vendor_prepayment_balance;
```

**Key:** Semantic comes from **regime registry**, NOT hard-coded TT99 assumptions.

---

## Constitutional Finding: F5-S0.2-REG-001

**Finding ID:** F5-S0.2-REG-001  
**Date:** 2026-08-16  
**Title:** Multi-Regime Applicability for Vietnamese Accounting

**Statement:**
> Bella Finance OS SHALL NOT assume a single universal accounting regime for all Vietnamese tenants. Vietnamese SMEs may apply TT133/2016 OR TT99/2025 effective 01/01/2026. F1 Ledger SHALL be regime-agnostic. F5 Reconciliation SHALL be regime-aware.

**Evidence:**
- Source: https://einvoice.vn/tin-tuc/ap-dung-che-do-ke-toan-moi
- Authority: Ministry of Finance guidance
- Legal Basis: TT99/2025 Điều 31 Khoản 2

**Architectural Requirement:**
- AR-001 — Regime Versioning
- AR-002 — Effective Dating
- AR-003 — Historical Immutability
- AR-004 — Semantic Isolation
- AR-005 — Controlled Transition

---

## F5-S0.1 Corrections Required

### Update Authority Hierarchy:

**OLD (INCORRECT):**
```
Vietnamese Law → VAS → TT99/2025 → Enterprise Policy → F1 → F2/F4 → F5
```

**NEW (CORRECTED):**
```
Vietnamese Law
    ↓
VAS
    ↓
Applicable Accounting Regime (tenant-specific, effective-dated)
    ├── VN-TT133-2016 (SME option)
    ├── VN-TT99-2025 (all enterprises + SME option)
    └── VN-TTxxx-20xx (future)
    ↓
Enterprise Accounting Policy
    ↓
Bella F1 Ledger (regime-agnostic)
    ↓
F2/F4 Contracts
    ↓
F5 Reconciliation (regime-aware)
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
```

---

## Conclusion

F5.6 research MUST expand to support **multi-regime architecture**. Part A.3 (Regime Versioning) becomes **highest priority**, blocking all C.2+ research until complete.

**Next Steps:**
1. Human Architect reviews F5-S0.2 Constitutional Amendment
2. Human Architect approves Part A.3 research scope
3. Research TT133/2016 applicability, scope, TK 331 semantic
4. Compare TT133 vs TT99 semantic (equivalence check)
5. Design regime versioning schemas
6. Resume C.2 with BOTH regime verification

---

**Status:** 🔴 **CRITICAL — A.3 BLOCKS ALL C.2+ RESEARCH**

**Constitutional:** F5-S0.2 enacted, AR-001 through AR-005 established

**Approval Required:** Human Architect MUST approve before proceeding
