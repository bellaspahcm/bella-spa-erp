# F5.6 Critical Checkpoint — Regulatory Agility Foundation Required

> **Checkpoint Date:** 2026-08-16  
> **Status:** 🔴 **BLOCKED — Implementation MUST NOT Proceed**  
> **Reason:** Architectural foundation incomplete  
> **Authority:** Human Architect approval required

---

## Executive Summary

**F5.6 implementation is BLOCKED** pending completion of **Regulatory Agility Architecture** (F5-S0.2 + F5-S0.3).

This is **NOT scope creep**. This is **architectural foundation** that must be established before semantic research can proceed safely.

**Key Discovery:** Vietnamese SMEs can choose TT133/2016 OR TT99/2025, and posting rules can change WITHIN a regime. F5.6 cannot hard-code TT99/2025 semantic.

---

## Why BLOCKED Is Correct Decision

### Good Sign: Block Now, Not Migrate Later

> **"Với Finance OS, thà block implementation vài ngày để khóa semantic còn hơn code vài nghìn dòng rồi phát hiện abstraction sai."**

**If we proceed to C.2 without A.3 + A.4:**
- ❌ Hard-code TT99/2025 semantic assumptions
- ❌ Implement posting rules that cannot version
- ❌ Create reconciliation engine tied to single regime
- ❌ Discover abstraction error after thousands of lines of code
- ❌ Require ledger migration to fix

**Correct approach (current BLOCKED status):**
- ✅ Establish constitutional foundation first (F5-S0.2, F5-S0.3)
- ✅ Research semantic with multi-regime awareness (A.3)
- ✅ Design policy versioning framework (A.4)
- ✅ Verify TT133 vs TT99 semantic equivalence
- ✅ THEN implement C.2-C.6 with correct abstraction

**This is architectural discipline, not delay.**

---

## Three Critical Architectural Amendments

### F5-S0.1: Vietnamese Accounting Authority ✅

**Enacted:** 2026-08-16  
**Document:** `F5_0_1_CONSTITUTIONAL_AMENDMENT_VIETNAMESE_ACCOUNTING.md`

**Established:**
- Authority hierarchy: Vietnamese Law → VAS → Thông tư → Enterprise Policy → F1 COA → F2/F4 → F5
- AI cannot invent accounting semantics
- Legal framework must be researched before coding

**Status:** ✅ COMPLETE (but needs update for multi-regime)

---

### F5-S0.2: Accounting Regime Versioning 🔴 NEW

**Enacted:** 2026-08-16  
**Document:** `F5_0_2_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_REGIME_VERSIONING.md`

**Discovery:** Vietnamese SMEs can choose **TT133/2016 OR TT99/2025** from 01/01/2026.

**Five Constitutional Invariants:**
- **AR-001:** Regime Versioning — Immutable version identity
- **AR-002:** Effective Dating — Regime applies within period
- **AR-003:** Historical Immutability — Transactions retain original regime
- **AR-004:** Semantic Isolation — New law doesn't mutate old semantic
- **AR-005:** Controlled Transition — Regime change requires approval

**Key Principle:**
> "F1 Ledger SHALL be regime-agnostic. F5 Reconciliation SHALL be regime-aware."

**Status:** 🔴 NEEDS HUMAN ARCHITECT APPROVAL

---

### F5-S0.3: Accounting Policy Versioning 🔴 NEW

**Enacted:** 2026-08-16  
**Document:** `F5_0_3_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_POLICY_VERSIONING.md`

**Discovery:** Even when regime unchanged (e.g., TT99/2025 continues), **posting rules can change** (TK 331 → TK 142).

**Five Constitutional Invariants:**
- **AR-006:** Policy Versioning — Immutable version within regime
- **AR-007:** Rule Effective Dating — Historical transactions use historical rules
- **AR-008:** Policy Change Independence — No regime migration for policy change
- **AR-009:** Granular Policy Domains — Domain-specific versioning
- **AR-010:** Finance Kernel Abstraction — Kernel doesn't know accounting rules

**Key Principle:**
> "Finance Kernel processes financial essence. Accounting Policy decides regulatory application. Posting Rules decide how business events become journal entries."

**Status:** 🔴 NEEDS HUMAN ARCHITECT APPROVAL

---

## Correct Abstraction Hierarchy

```
┌─────────────────────────────────────────────────────┐
│ REGULATORY FRAMEWORK (Vietnamese Law, MOF, VAS)    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING REGIME (Tenant-level, effective-dated)  │
│ - VN-TT133-2016 (SME option)                       │
│ - VN-TT99-2025 (all enterprises + SME option)      │
│ - VN-TTxxx-20xx (future-proof)                     │
│                                                     │
│ Governed by: F5-S0.2 (AR-001 to AR-005)            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ ACCOUNTING POLICY (Domain-specific, versioned)     │
│ - Vendor prepayment posting v1.0, v1.1, ...        │
│ - Revenue recognition v1.0, v1.1, ...              │
│ - Inventory valuation v1.0, v1.1, ...              │
│                                                     │
│ Governed by: F5-S0.3 (AR-006 to AR-010)            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ POSTING RULES (Effective-dated, immutable)         │
│ - Account mapping (331 vs 142)                     │
│ - Recognition criteria                              │
│ - Reporting presentation                            │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ FINANCE KERNEL (Rule-agnostic, policy-agnostic)    │
│ - Transaction, Journal, Debit/Credit, Ledger       │
│ - Does NOT know: regime, policy, account semantic  │
│                                                     │
│ Governed by: AR-010 (Finance Kernel Abstraction)   │
└─────────────────────────────────────────────────────┘
```

---

## Three Critical Questions (UNANSWERED)

### 1. TT133 vs TT99 Semantic Equivalence 🔴 CRITICAL

**Question:**
> Is TK 331 vendor prepayment semantic **IDENTICAL** in TT133/2016 and TT99/2025?

**Why Critical:**
```
If YES (semantic equivalent):
    F5.6 can use UNIFIED semantic adapter
    (Simpler implementation)

If NO (semantic different):
    F5.6 needs REGIME-SPECIFIC adapters
    (More complex, but correct)
```

**Prohibition:**
> **"Không được giả định: same account code = same accounting semantic."**

**Evidence Required:**
- Access TT133/2016 Phụ lục II (Chart of Accounts)
- Extract TK 331 definition, normal balance, debit/credit semantic
- Compare with TT99/2025 TK 331 semantic (already verified)
- Document equivalence or differences with legal citations

**Status:** 🔴 BLOCKED (Part A.3 research)

---

### 2. Policy Rules JSONB Design Boundary 🔴 CRITICAL

**Warning:**
> **"Nếu nhét toàn bộ logic kế toán vào JSONB thì vài năm sau nó có thể biến thành một 'mini programming language' không kiểm soát."**

**F5.6 MUST Define:**

| Category | Definition | Example | Location |
|----------|------------|---------|----------|
| **Configuration Data** | Declarative settings | Account codes, descriptions | JSONB |
| **Business Rule** | Conditional logic | "If inventory purchase → TK 156" | JSONB |
| **Invariant** | Must never change | "Debit = Credit" | Database constraint |
| **Executable Engine** | Complex algorithms | Reconciliation, FX conversion | Application code |
| **Approval-Required** | Needs governance | Regime transition, policy change | Workflow |
| **Backward-Compatible** | Can change without migration | Reporting format | Versioned config |

**F5.6 Cannot Store in JSONB:**
- ❌ Complex reconciliation algorithms
- ❌ Temporal query logic
- ❌ Double-entry validation
- ❌ Foreign exchange conversion formulas

**F5.6 Can Store in JSONB:**
- ✅ Account code mappings (331, 142, 111, 112, 113)
- ✅ Recognition criteria (textual rules)
- ✅ Reporting presentation (balance sheet line items)
- ✅ Conditional account selection (if inventory → 156, if expense → 642)

**Design Principle:**
> "JSONB stores **data and declarative rules**. Application code executes **algorithms and invariants**."

**Status:** 🔴 NEEDS DESIGN (Part A.4)

---

### 3. Transaction Accounting Context Immutability 🔴 CRITICAL

**Principle:**
> **"Một financial transaction sau khi posted phải giữ được accounting context đã dùng để tạo ra nó."**

**Required Schema:**
```sql
ALTER TABLE finance_transactions
ADD COLUMN accounting_regime_code TEXT NOT NULL,
ADD COLUMN accounting_policy_version TEXT NOT NULL,
ADD COLUMN posting_rule_snapshot JSONB;  -- Immutable copy of rules used
```

**Prohibition:**
> **"Không được xảy ra: 2027 transaction → re-run bằng policy 2030 → ra kết quả khác."**

**Audit-Grade Requirement:**
```sql
-- Historical reproducibility test
SELECT
  ft.id,
  ft.posted_at,
  ft.accounting_regime_code,
  ft.accounting_policy_version,
  ft.posting_rule_snapshot
FROM finance_transactions ft
WHERE ft.posted_at = '2026-05-15';

-- Result MUST show:
-- regime: VN-TT99-2025
-- policy: 1.0.0
-- rules:  {"prepayment_recorded": {"debit_account": "331", ...}}

-- Even if current policy is v1.1.0 (account changed to 142)
```

**Status:** 🔴 NEEDS SCHEMA DESIGN (Part A.4)

---

## Updated F5.6 Critical Path

### Previous Critical Path (INCORRECT):

```
F5.5 Complete
    ↓
C.2 Posting Rules (TT99 only)
    ↓
C.3 Implementation
    ↓
F5.6 Complete
```

**Problem:** Hard-codes TT99, ignores TT133, cannot handle policy versioning.

---

### Correct Critical Path (CURRENT):

```
F5.5 Complete ✅
    ↓
F5-S0 Regulatory Agility Foundation 🔴 IN PROGRESS
    │
    ├── F5-S0.2: Accounting Regime Versioning
    │       ├── AR-001 to AR-005 established ✅
    │       ├── Constitutional principles documented ✅
    │       └── Human Architect approval ❌ PENDING
    │
    ├── F5-S0.3: Accounting Policy Versioning
    │       ├── AR-006 to AR-010 established ✅
    │       ├── Constitutional principles documented ✅
    │       └── Human Architect approval ❌ PENDING
    │
    ├── A.3: Regime Semantic Research 🔴 BLOCKED
    │       ├── TT133/2016 applicability ❌
    │       ├── TT99/2025 applicability ✅
    │       ├── TT133 vs TT99 semantic equivalence ❌ CRITICAL
    │       ├── tenant_accounting_regimes schema ❌
    │       └── accounting_semantic_registry schema ❌
    │
    └── A.4: Policy Versioning Framework 🔴 BLOCKED
            ├── Policy domain taxonomy ❌
            ├── JSONB boundary definition ❌ CRITICAL
            ├── accounting_policies schema ❌
            ├── Transaction context immutability ❌ CRITICAL
            └── Finance Kernel abstraction boundary ❌
    ↓
Semantic Model Complete
    ↓
C.2: Posting Rules (BOTH TT133 + TT99, versioned)
    ↓
C.3: Implementation (regime-aware, policy-aware)
    ↓
C.4-C.6: Complete
    ↓
F5.6 Complete
```

**Key Change:** A.3 + A.4 MUST complete before C.2.

---

## Approval Gates

### Gate 1: Human Architect Reviews F5-S0.2 + F5-S0.3 ❌ PENDING

**Review Checklist:**
- [ ] Ten constitutional invariants (AR-001 to AR-010) approved
- [ ] Abstraction hierarchy correct (Regime → Policy → Rules → Kernel)
- [ ] Finance Kernel abstraction boundary acceptable (AR-010)
- [ ] Regime versioning approach approved (AR-001 to AR-005)
- [ ] Policy versioning approach approved (AR-006 to AR-010)
- [ ] Historical immutability principles approved (AR-003, AR-007)
- [ ] Semantic isolation principles approved (AR-004)

**Documents to Review:**
1. `F5_0_2_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_REGIME_VERSIONING.md` (10,000 words)
2. `F5_0_3_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_POLICY_VERSIONING.md` (9,000 words)
3. `F5_S0_REGULATORY_AGILITY_ARCHITECTURE.md` (5,000 words)

**Approval:** ❌ REQUIRED before proceeding to A.3

---

### Gate 2: A.3 Regime Semantic Research ❌ BLOCKED

**Dependencies:**
- Requires: Gate 1 approval ✅
- Requires: TT133/2016 full document access ❌

**Research Tasks:**
- [ ] TT133/2016 applicability (SME criteria, scope, effective dates)
- [ ] TT99/2025 applicability (mandatory vs optional)
- [ ] TT133 TK 331 semantic extraction (normal balance, debit/credit meaning)
- [ ] TT99 TK 331 semantic (already verified ✅)
- [ ] **CRITICAL:** TT133 vs TT99 semantic equivalence check
- [ ] Design `tenant_accounting_regimes` schema
- [ ] Design `accounting_semantic_registry` schema
- [ ] Human Architect approval

**Deliverable:** `F5_6_A3_ACCOUNTING_REGIME_VERSIONING.md` (estimated 50+ pages)

**Approval:** ❌ REQUIRED before proceeding to C.2

---

### Gate 3: A.4 Policy Versioning Framework ❌ BLOCKED

**Dependencies:**
- Requires: Gate 1 approval ✅

**Design Tasks:**
- [ ] Define policy domain taxonomy (vendor prepayment, revenue recognition, etc.)
- [ ] **CRITICAL:** Define JSONB boundary (what can/cannot be stored in JSONB)
- [ ] Design `accounting_policies` schema
- [ ] Design transaction accounting context (regime_code, policy_version, rule_snapshot)
- [ ] Define policy change governance workflow
- [ ] Define Finance Kernel abstraction boundary (AR-010 implementation)
- [ ] Human Architect approval

**Deliverable:** `F5_6_A4_POLICY_VERSIONING_FRAMEWORK.md` (estimated 40+ pages)

**Approval:** ❌ REQUIRED before proceeding to C.2

---

### Gate 4: C.2-C.6 Implementation ❌ BLOCKED

**Dependencies:**
- Requires: Gate 2 (A.3) approved ✅
- Requires: Gate 3 (A.4) approved ✅

**Cannot proceed until:**
- Semantic equivalence question answered
- JSONB boundary defined
- Transaction context schema finalized
- Regime + policy resolution algorithm designed

---

## Why This Is Not Scope Creep

### Scope Creep (Bad):
```
Original scope: Cash + Prepayment reconciliation
New scope:      Cash + Prepayment + Inventory + Fixed Assets + Revenue
```

### Architectural Foundation (Good, Current Situation):
```
Original understanding: TT99/2025 is universal baseline
Discovered reality:     TT133/2016 OR TT99/2025 (choice)
                        Posting rules can change within regime

Implication: Need regime + policy versioning BEFORE implementation

This is NOT adding features.
This is CORRECTING architectural foundation.
```

**Quote:**
> **"Đây là một nâng cấp kiến trúc rất quan trọng, không phải scope creep."**

---

## What Remains Unchanged (F1-F4 FROZEN)

### F1 Accounting Engine ✅ FROZEN
- Ledger, transactions, journal entries
- Chart of accounts
- Double-entry validation
- No changes required

### F2 Cash & Treasury ✅ FROZEN
- Cash movements, bank accounts
- F2 contract v2.5.0
- No changes required

### F3 Inventory & Procurement ✅ FROZEN
- Inventory movements
- No changes required (not in F5.6 scope)

### F4 Accounts Payable ✅ FROZEN
- Vendor invoices, payments, prepayments
- F4 contract v4.1.0
- No changes required

**Key Principle:**
> **"Mình sẽ giữ nguyên F1–F4, không quay lại sửa Finance Kernel đã freeze."**

**What F5-S0.2 + F5-S0.3 Add:**
- Semantic layer ABOVE Finance Kernel (not modifying kernel)
- Regime + policy versioning (external to F1-F4)
- F5 reconciliation becomes regime-aware (F5 layer only)

---

## Timeline Impact

### If We Proceed Without A.3 + A.4 (WRONG):
```
Day 1-3:   Code C.2 posting rules (TT99 hard-coded)
Day 4-7:   Code C.3 implementation
Day 8:     Discover: What about TT133 tenants?
Day 9:     Discover: What if posting rules change in 2027?
Day 10-15: Rework C.2 + C.3 with regime/policy versioning
Day 16-20: Migration scripts for existing transactions
Day 21-25: Re-test everything

Total: 25 days + high risk of architectural error
```

### If We Complete A.3 + A.4 First (CORRECT, CURRENT):
```
Day 1-3:   Human Architect reviews F5-S0.2 + F5-S0.3
Day 4-7:   Research A.3 (TT133 vs TT99 semantic equivalence)
Day 8-10:  Design A.4 (Policy versioning, JSONB boundary)
Day 11:    Human Architect approves A.3 + A.4
Day 12-14: Code C.2 posting rules (regime-aware, policy-aware)
Day 15-18: Code C.3 implementation (correct abstraction)
Day 19-20: Test with BOTH TT133 + TT99 scenarios
Day 21:    Complete F5.6

Total: 21 days + correct architecture + no migration risk
```

**Net Savings:** 4 days + architectural correctness + zero migration risk

---

## Redefining F5 Scope

### Old Understanding:
> "F5 = Reconciliation & Financial Control"

### New Understanding:
> **"F5 = Financial Control + Regulatory Agility + Reconciliation"**

**F5 Phases:**

| Phase | Scope | Status |
|-------|-------|--------|
| **F5.0-F5.5** | AP/AR Reconciliation Baseline | 🔒 FROZEN |
| **F5-S0** | Regulatory Agility Constitution | 🔴 IN PROGRESS |
| **F5.6+** | Cash/Prepayment/FX Reconciliation | 🔴 BLOCKED |

**Quote:**
> **"F5 không chỉ là Reconciliation & Financial Control. F5 là giai đoạn xây lớp Financial Control + Regulatory Agility trước khi Finance OS đi vào implementation sâu."**

---

## Key Architectural Insight

### Most Important Discovery:
> **"Bella không chỉ cần 'Regime Versioning'. Bella cần 'Accounting Semantics + Policy + Posting Rule Versioning'."**

**Three Versioning Layers Required:**

1. **Accounting Regime Versioning** (F5-S0.2)
   - TT133-2016, TT99-2025, TTxxx-20xx
   - AR-001 to AR-005

2. **Accounting Policy Versioning** (F5-S0.3)
   - Policy v1.0, v1.1, v1.2 within regime
   - AR-006 to AR-010

3. **Semantic Registry Versioning** (F5-S0.2)
   - Account semantic per regime
   - Immutable semantic rules

**If Locked Correctly:**
> **"Bella mới thực sự có khả năng sống lâu với đa ngành, đa công ty, đa quy mô và thay đổi pháp lý trong 10–20 năm."**

---

## Next Actions

### Immediate (Human Architect) ❌ REQUIRED

**Action 1:** Review F5-S0.2 Constitutional Amendment
- Document: `F5_0_2_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_REGIME_VERSIONING.md`
- Focus: AR-001 to AR-005 (Regime versioning principles)

**Action 2:** Review F5-S0.3 Constitutional Amendment
- Document: `F5_0_3_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_POLICY_VERSIONING.md`
- Focus: AR-006 to AR-010 (Policy versioning principles)

**Action 3:** Approve or Reject F5-S0.2 + F5-S0.3
- If approved → Proceed to A.3 + A.4
- If rejected → Document concerns, iterate constitutional design

---

### After Approval (Research Team) 🔴 BLOCKED

**Action 4:** Complete A.3 Regime Semantic Research
- Access TT133/2016 full document
- Extract TK 331 semantic
- Compare with TT99/2025
- Design schemas
- Deliverable: `F5_6_A3_ACCOUNTING_REGIME_VERSIONING.md`

**Action 5:** Complete A.4 Policy Versioning Framework
- Define policy domain taxonomy
- Define JSONB boundary (CRITICAL)
- Design `accounting_policies` schema
- Design transaction context schema
- Deliverable: `F5_6_A4_POLICY_VERSIONING_FRAMEWORK.md`

---

### After A.3 + A.4 Complete (Implementation) 🔴 BLOCKED

**Action 6:** Implement C.2-C.6 with Regime + Policy Awareness
- Posting rules (BOTH TT133 + TT99)
- F5 reconciliation engine (regime-aware, policy-aware)
- Temporal contracts
- Tests
- Verification

---

## Conclusion

**F5.6 is correctly BLOCKED** pending completion of **Regulatory Agility Architecture** (F5-S0.2 + F5-S0.3).

**This is architectural discipline:**
- ✅ Block implementation until foundation complete
- ✅ Avoid hard-coding single-regime assumptions
- ✅ Design versioning layers correctly first
- ✅ Implement with correct abstraction
- ✅ Zero migration risk

**Critical architectural principle:**
> **"Finance Kernel processes financial essence. Accounting Policy decides regulatory application. Posting Rules decide how business events become journal entries."**

**Ten Constitutional Invariants (AR-001 to AR-010) govern:**
- Regime versioning
- Policy versioning
- Historical immutability
- Semantic isolation
- Finance Kernel abstraction

**F5.6 cannot proceed until Human Architect approves F5-S0.2 + F5-S0.3.**

---

**Status:** 🔴 **BLOCKED — Awaiting Human Architect Review**

**Critical Path:** Gate 1 (Review) → Gate 2 (A.3) → Gate 3 (A.4) → Gate 4 (C.2-C.6)

**Estimated Unblock:** 3-7 days (after Human Architect approval)

**Architectural Quality:** ✅ CORRECT FOUNDATION (block now, not migrate later)
