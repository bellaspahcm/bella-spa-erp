# F5.6 A.3 Canonical Semantic Model

> **Document Type:** Core Architecture — Semantic Foundation  
> **Date:** 2026-08-16  
> **Status:** PROVISIONAL (pending PRIMARY verification)  
> **Purpose:** Define regime-independent semantic layer for multi-tenant Finance OS

---

## Executive Summary

**Core Principle:**
> **Account code is NOT semantic identity. Semantic identity must exist independently of regulatory regime, tenant, tenant COA, account number, and account name.**

**Discovered From:**
- Architecture Finding A3-001
- TK 142/244 conflict (C-004)
- TT99/2025 Điều 11 (COA customization allowance)

**Impact:**
- Enables multi-regime support (TT133 → TT99 → future)
- Enables multi-tenant COA customization
- Enables historical reconstruction across regime changes
- Prevents semantic ambiguity

**AR Candidates:**
- AR-011: Account Code Is Not Semantic Identity
- AR-012: Tenant COA Customization Boundary

---

## Five-Layer Architecture

### Overview

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: REGULATORY REGIME                              │
│ Legal requirements, circulars, VAS                      │
│ TT133/2016, TT99/2025, VAS 01-03, future circulars     │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: CANONICAL ACCOUNTING SEMANTIC                  │
│ Regime-independent semantic identifiers                 │
│ PREPAID_EXPENSE, EMPLOYEE_ADVANCE, CASH_ON_HAND, ...   │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: ENTERPRISE ACCOUNTING POLICY                   │
│ Recognition, measurement, posting rules                 │
│ Policy versioning (v1.0, v1.1, v2.0)                   │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: TENANT CHART OF ACCOUNTS                       │
│ Customizable within regulatory bounds                   │
│ Tenant A: PREPAID_EXPENSE → 242                        │
│ Tenant B: PREPAID_EXPENSE → 2421, 2422                 │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 5: POSTING RULES ENGINE                           │
│ Resolve semantic → account → posting instruction        │
│ Generate balanced journal entries                        │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ FINANCE KERNEL (F1-F4)                                  │
│ Receives: account_id, debit, credit                    │
│ Does NOT interpret: semantic, regime, policy            │
│ Enforces: balanced entries, immutability, audit trail   │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Regulatory Regime

**Purpose:** Define legal requirements and standards

**Scope:**
- Vietnamese Ministry of Finance circulars (TT133, TT99, future)
- Vietnamese Accounting Standards (VAS 01-03, etc.)
- Legal definitions of accounting semantics
- Standard Chart of Accounts structure
- Financial statement presentation requirements

**Characteristics:**
- ✅ Changes over time (TT133 → TT99 → future)
- ✅ Prescriptive (legal requirements)
- ✅ Authoritative (PRIMARY source)
- ❌ Not customizable by enterprises

**Examples:**
```
TT133/2016:
- Effective: 2017-01-01 to 2025-12-31
- COA: 3-digit base, short/long-term split
- Standard accounts defined in Phụ lục 1

TT99/2025:
- Effective: 2026-01-01 onwards
- COA: 3-digit base, simplified structure
- COA customization allowed (Điều 11)
- Standard accounts defined in Phụ lục II

Future (hypothetical TT-XXX/2030):
- Effective: 2031-01-01 onwards
- May change COA structure
- May change recognition/measurement rules
```

**Regime Evolution:**
- Finance OS must support multiple regimes simultaneously
- Transactions recorded under old regime must be reconstructable
- Regime metadata stored immutably with each transaction

---

## Layer 2: Canonical Accounting Semantic

**Purpose:** Define regime-independent semantic identifiers

**Principle:**
> **Semantic identity is stable across regulatory changes and tenant customizations.**

### Core Semantics (Provisional List)

**Asset Semantics:**
```
CASH_ON_HAND              — Physical cash (VND/foreign currency)
CASH_IN_BANK              — Bank deposits
CASH_IN_TRANSIT           — Uncleared deposits/transfers
EMPLOYEE_ADVANCE          — Employee temporary advances
VENDOR_PREPAYMENT         — Advances paid to suppliers
PREPAID_EXPENSE           — Payments for future services/goods
LONG_TERM_DEPOSIT         — Refundable deposits/pledges (≠ prepaid)
TRADE_RECEIVABLE          — Customer invoices unpaid
MERCHANDISE_INVENTORY     — Goods held for sale
FIXED_ASSET               — Tangible long-term assets
```

**Liability Semantics:**
```
TRADE_PAYABLE             — Vendor invoices unpaid
CUSTOMER_ADVANCE          — Advances received from customers
SHORT_TERM_LOAN           — Borrowings < 1 year
LONG_TERM_LOAN            — Borrowings ≥ 1 year
ACCRUED_EXPENSE           — Expenses incurred, not yet paid
TAX_PAYABLE               — Tax obligations
```

**Equity Semantics:**
```
SHARE_CAPITAL             — Contributed capital
RETAINED_EARNINGS         — Accumulated profits
```

**Revenue/Expense Semantics:**
```
SALES_REVENUE             — Revenue from goods/services sold
COST_OF_GOODS_SOLD        — Direct costs of goods sold
OPERATING_EXPENSE         — Operating costs
FINANCIAL_EXPENSE         — Interest and financial costs
```

**Note:** This is a provisional list based on F5.6 research scope (cash + prepayments). Full Finance OS will have 50-100+ canonical semantics.

---

### Semantic Characteristics

**1. Regime-Independent:**
```
Same semantic across regimes:
PREPAID_EXPENSE = PREPAID_EXPENSE (TT133) = PREPAID_EXPENSE (TT99)

Different account realization:
TT133: Account 142 (short-term)
TT99:  Account 242 (combined)
```

**2. Tenant-Independent:**
```
Same semantic across tenants:
PREPAID_EXPENSE = PREPAID_EXPENSE (Tenant A) = PREPAID_EXPENSE (Tenant B)

Different account codes:
Tenant A: Account 242
Tenant B: Account 2421, 2422 (subdivided)
```

**3. Business-Event-Aligned:**
```
Business Event → Canonical Semantic
"Pay vendor before goods received" → VENDOR_PREPAYMENT
"Pay for annual insurance policy" → PREPAID_EXPENSE
"Pay security deposit for office lease" → LONG_TERM_DEPOSIT
```

**4. Accounting-Treatment-Agnostic:**
```
Semantic defines WHAT, not HOW:
PREPAID_EXPENSE = semantic (WHAT)

Policy defines HOW:
Recognition: Upon payment or goods receipt?
Measurement: Historical cost or fair value?
Amortization: Straight-line or pattern-based?
```

---

### Semantic Metadata

**Each Canonical Semantic Has:**

```typescript
interface CanonicalSemantic {
    id: string;                    // e.g., "PREPAID_EXPENSE"
    name: string;                  // e.g., "Prepaid Expenses"
    name_vi: string;               // e.g., "Chi phí trả trước"
    category: SemanticCategory;    // ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
    description: string;           // Business meaning
    typical_business_events: string[];  // Common triggers
    recognition_principles: string;     // General guidance
    measurement_principles: string;     // General guidance
    evidence_authority: AuthorityLevel; // PRIMARY | SECONDARY | TERTIARY
    evidence_grade: EvidenceGrade;      // CONFIRMED | CORROBORATED | ...
    source_citations: Citation[];       // VAS, TT references
    created_at: timestamp;
    version: string;                    // Semantic evolution tracking
}
```

**Example:**
```json
{
    "id": "PREPAID_EXPENSE",
    "name": "Prepaid Expenses",
    "name_vi": "Chi phí trả trước",
    "category": "ASSET",
    "description": "Payments made for goods or services to be received in future periods. Represents future economic benefits.",
    "typical_business_events": [
        "Pay annual insurance premium",
        "Pay rent in advance",
        "Pay subscription fees upfront"
    ],
    "recognition_principles": "Recognized upon payment if goods/services not yet received. Amortized over benefit period.",
    "measurement_principles": "Historical cost at payment. Subsequent amortization reduces carrying amount.",
    "evidence_authority": "SECONDARY",
    "evidence_grade": "CORROBORATED",
    "source_citations": [
        {"source": "VAS 01", "section": "Recognition", "status": "PRIMARY_PENDING"},
        {"source": "Crowe 2016", "section": "Prepaid Expenses", "status": "SECONDARY_CONFIRMED"}
    ],
    "created_at": "2026-08-16",
    "version": "1.0"
}
```

---

## Layer 3: Enterprise Accounting Policy

**Purpose:** Define HOW canonical semantics are treated

**Scope:**
- Recognition criteria
- Measurement basis
- Classification rules
- Posting instructions
- Presentation format
- Closing procedures
- Transition rules

**Characteristics:**
- ✅ Versioned (v1.0, v1.1, v2.0)
- ✅ Regime-constrained (must comply with Layer 1)
- ✅ Enterprise-specific (within legal bounds)
- ✅ Immutable once published
- ❌ Cannot change historical transactions

### Policy Domains (from A.4)

**1. Recognition Policy:**
```
PREPAID_EXPENSE:
  regime: TT99
  policy_version: v1.0
  recognition_trigger: PAYMENT_COMPLETED
  recognition_timing: UPON_PAYMENT
  recognition_condition: "Goods/services not yet received"
```

**2. Measurement Policy:**
```
PREPAID_EXPENSE:
  regime: TT99
  policy_version: v1.0
  measurement_basis: HISTORICAL_COST
  subsequent_measurement: AMORTIZATION
  amortization_method: STRAIGHT_LINE
```

**3. Classification Policy:**
```
PREPAID_EXPENSE:
  regime: TT99
  policy_version: v1.0
  fs_section: CURRENT_ASSETS  # if benefit < 1 year
  fs_section: NON_CURRENT_ASSETS  # if benefit ≥ 1 year
  fs_line_item: "Chi phí trả trước"
```

**4. Posting Policy:**
```
PREPAID_EXPENSE:
  regime: TT99
  policy_version: v1.0
  posting_pattern:
    on_payment:
      debit: PREPAID_EXPENSE
      credit: CASH
    on_amortization:
      debit: EXPENSE_ACCOUNT
      credit: PREPAID_EXPENSE
```

### Policy Versioning

**Version Evolution:**
```
Policy v1.0 (2026-01-01):
PREPAID_EXPENSE recognition = UPON_PAYMENT
    ↓
Policy v1.1 (2027-06-01):
PREPAID_EXPENSE recognition = UPON_PAYMENT
PREPAID_EXPENSE amortization = NEW_PATTERN_METHOD
    ↓
Policy v2.0 (2030-01-01):
PREPAID_EXPENSE recognition = UPON_GOODS_RECEIPT
PREPAID_EXPENSE amortization = NEW_PATTERN_METHOD
```

**Immutability Principle:**
```
Transaction T1 (2026-05-01) using Policy v1.0:
  ✅ Forever tied to v1.0
  ❌ Cannot be retroactively changed to v1.1 or v2.0

Transaction T2 (2027-08-01) using Policy v1.1:
  ✅ Forever tied to v1.1
  ❌ Not affected by T1 or v2.0

Transaction T3 (2030-03-01) using Policy v2.0:
  ✅ Forever tied to v2.0
  ❌ Not affected by T1, T2, or v1.0, v1.1
```

---

## Layer 4: Tenant Chart of Accounts

**Purpose:** Provide tenant-specific account structure

**Principle (TT99/2025 Điều 11):**
> "Doanh nghiệp được điều chỉnh tên, số hiệu, cấu trúc và nội dung tài khoản để phù hợp với đặc điểm hoạt động và yêu cầu quản lý của doanh nghiệp."

**Translation:**
> "Enterprises may modify account names, numbers, structure, and content to match operational characteristics and management requirements."

### Customization Boundary

**ALLOWED:**
- ✅ Account code customization (242 → 2421, 2422)
- ✅ Account name customization
- ✅ Account subdivision (242 → 2421 materials, 2422 services)
- ✅ Additional levels (242 → 242.01.001)
- ✅ Industry-specific accounts

**PROHIBITED:**
- ❌ Violate regulatory requirements
- ❌ Change canonical semantic meaning
- ❌ Mix semantics in single account
- ❌ Omit required accounts

### Example: Tenant COA Variants

**Standard COA (TT99 Phụ lục II):**
```
242 - Chi phí trả trước
```

**Tenant A (Wholesale SME):**
```
242 - Chi phí trả trước
```
(Uses standard, no customization)

**Tenant B (Manufacturing):**
```
2421 - Chi phí trả trước nguyên vật liệu
2422 - Chi phí trả trước dịch vụ
2423 - Chi phí trả trước khác
```
(Subdivided for operational detail)

**Tenant C (Conglomerate):**
```
242.01 - Chi phí trả trước - Công ty mẹ
242.02 - Chi phí trả trước - Công ty con A
242.03 - Chi phí trả trước - Công ty con B
```
(Multi-entity structure)

**Semantic Mapping:**
```
All map to: PREPAID_EXPENSE (canonical semantic)
Different account realizations per tenant
```

### Tenant COA Schema (Conceptual)

```typescript
interface TenantChartOfAccounts {
    tenant_id: string;
    regime_code: string;              // e.g., "TT99"
    effective_date: Date;
    accounts: TenantAccount[];
    approved_by: string;
    regulatory_compliance_verified: boolean;
}

interface TenantAccount {
    account_code: string;             // e.g., "2421"
    account_name: string;             // e.g., "Chi phí trả trước NVL"
    canonical_semantic_id: string;    // e.g., "PREPAID_EXPENSE"
    parent_account_code?: string;     // For hierarchy
    is_active: boolean;
    created_at: timestamp;
    deactivated_at?: timestamp;
}
```

---

## Layer 5: Posting Rules Engine

**Purpose:** Resolve semantic → account → posting instruction

**Inputs:**
1. Business event
2. Tenant ID
3. Current regime
4. Current policy version
5. Transaction data

**Outputs:**
- Balanced journal entry (debit/credit lines)
- Account IDs (from Tenant COA)
- Immutable context metadata

### Resolution Flow

```
Business Event: "Pay vendor prepayment"
Transaction: 1,000,000 VND
Tenant: Tenant B
Regime: TT99
Policy: v1.0
    ↓
Step 1: Identify Canonical Semantic
    Business Event → VENDOR_PREPAYMENT
    ↓
Step 2: Resolve Policy
    Regime (TT99) + Policy (v1.0) + Semantic (VENDOR_PREPAYMENT)
    → Recognition: UPON_PAYMENT
    → Posting pattern: Debit VENDOR_PREPAYMENT, Credit CASH
    ↓
Step 3: Resolve Tenant Accounts
    Tenant B + VENDOR_PREPAYMENT → Account 3311 (custom subdivision)
    Tenant B + CASH → Account 1111
    ↓
Step 4: Generate Posting Instruction
    {
        "lines": [
            {"account_id": 3311, "debit": 1000000, "credit": 0},
            {"account_id": 1111, "debit": 0, "credit": 1000000}
        ],
        "context": {
            "semantic_event": "VENDOR_PREPAYMENT",
            "regime_code": "TT99",
            "policy_version": "v1.0",
            "business_event": "Pay vendor prepayment"
        }
    }
    ↓
Step 5: Submit to Finance Kernel
    Kernel validates balanced entry
    Kernel persists journal + context
    Kernel does NOT interpret semantic/regime/policy
```

---

## Finance Kernel (F1-F4) Interface

**Kernel Responsibilities:**
- ✅ Validate balanced entries (Σ Debit = Σ Credit)
- ✅ Validate account existence
- ✅ Persist journal entries
- ✅ Persist immutable context metadata
- ✅ Enforce audit trail
- ✅ Enforce ledger invariants

**Kernel Does NOT:**
- ❌ Interpret semantic meaning
- ❌ Resolve regime/policy
- ❌ Generate posting instructions
- ❌ Know about account codes' business meaning

**Posting Instruction Format:**
```json
{
    "transaction_id": "T-2026-08-16-001",
    "transaction_date": "2026-08-16",
    "tenant_id": "tenant_b",
    "lines": [
        {
            "line_id": 1,
            "account_id": 3311,
            "debit": 1000000,
            "credit": 0,
            "memo": "Vendor prepayment - ABC Supplier"
        },
        {
            "line_id": 2,
            "account_id": 1111,
            "debit": 0,
            "credit": 1000000,
            "memo": "Cash payment"
        }
    ],
    "context": {
        "semantic_event": "VENDOR_PREPAYMENT",
        "regime_code": "TT99",
        "policy_version": "v1.0",
        "business_event": "Pay vendor prepayment",
        "recorded_by": "user_123",
        "recorded_at": "2026-08-16T10:30:00Z"
    }
}
```

**Kernel Storage:**
```sql
-- Kernel persists, but does NOT interpret
INSERT INTO journal_entries (
    transaction_id,
    transaction_date,
    tenant_id,
    account_id,
    debit,
    credit,
    context_metadata  -- JSON blob, immutable
);
```

---

## Benefits of 5-Layer Model

### 1. Regime Agility
```
New Regulatory Circular Published:
    ↓
Layer 1: Add new regime definition
    ↓
Layer 2: No changes (semantic stable)
    ↓
Layer 3: Add new policy version
    ↓
Layer 4: No changes (or tenant opts to update COA)
    ↓
Layer 5: Update resolution rules
    ↓
Finance Kernel: No changes
```

**Historical Transactions:** Unaffected (context preserved)

---

### 2. Multi-Tenant Scalability
```
Tenant A (Standard COA):
PREPAID_EXPENSE → Account 242

Tenant B (Custom COA):
PREPAID_EXPENSE → Account 2421, 2422

Tenant C (Multi-Entity):
PREPAID_EXPENSE → Account 242.01, 242.02
```

**Consolidated Reporting:**
- Query by canonical semantic
- Aggregate across tenants
- Translate to standard presentation

---

### 3. Historical Reconstruction
```
Transaction T1 (2025-05-01):
  Regime: TT133
  Policy: v1.0
  Semantic: PREPAID_EXPENSE
  Account: 142 (TT133 short-term)

Query in 2030:
  SELECT * WHERE semantic = 'PREPAID_EXPENSE'
    AND regime = 'TT133'
    AND policy_version = 'v1.0';
  
  Returns: T1 with original context
  Account displayed: 142 (as it was in 2025)
  
  Current system uses: Account 242 (TT99)
  No confusion: semantic + context preserved
```

---

### 4. Audit Compliance
```
Auditor Question:
"Show me all vendor prepayments in 2025"

Query:
  SELECT * WHERE semantic = 'VENDOR_PREPAYMENT'
    AND transaction_date BETWEEN '2025-01-01' AND '2025-12-31';

Results:
  Unambiguous (semantic identity clear)
  Context preserved (regime/policy/account at transaction time)
  Reproducible (can reconstruct 2025 financial statements exactly)
```

---

## Validation Test Cases

### Test 1: Same Semantic, Different Regimes

**Scenario:**
```
2025 (TT133): PREPAID_EXPENSE → Account 142
2026 (TT99):  PREPAID_EXPENSE → Account 242
```

**Expected:**
- ✅ Query by semantic returns both
- ✅ 2025 transactions show Account 142
- ✅ 2026 transactions show Account 242
- ✅ Financial statements accurate for each period

---

### Test 2: Same Semantic, Different Tenants

**Scenario:**
```
Tenant A: PREPAID_EXPENSE → 242
Tenant B: PREPAID_EXPENSE → 2421, 2422
```

**Expected:**
- ✅ Both tenants record same business event
- ✅ Different account codes used
- ✅ Consolidated query by semantic works
- ✅ Tenant-specific reports show correct accounts

---

### Test 3: Policy Evolution

**Scenario:**
```
2026: Policy v1.0, Recognition = UPON_PAYMENT
2027: Policy v1.1, Recognition = UPON_PAYMENT (same)
2030: Policy v2.0, Recognition = UPON_GOODS_RECEIPT (changed)
```

**Expected:**
- ✅ Transactions in 2026 forever use v1.0
- ✅ Transactions in 2027 forever use v1.1
- ✅ Transactions in 2030 forever use v2.0
- ✅ Query in 2031 reconstructs each period correctly

---

## Implementation Phases

### Phase 1: Canonical Semantic Registry (A.3 v1.0)
- Define initial semantic set (50-100 semantics)
- Establish evidence taxonomy
- Map business events → semantics
- Document regime requirements per semantic

### Phase 2: Policy Evolution Model (A.4)
- Define policy domains
- Establish versioning rules
- Prove immutability
- Historical reconstruction tests

### Phase 3: Regime Layer (C.2 - post Gate 2)
- Schema: `regulatory_regimes`
- Schema: `regime_semantic_requirements`
- Validation rules

### Phase 4: Tenant COA Layer (C.3)
- Schema: `tenant_chart_of_accounts`
- Schema: `semantic_to_account_mapping`
- Regulatory compliance validator
- COA customization UI

### Phase 5: Posting Rules Engine (C.4)
- Semantic → Account resolver
- Policy resolver
- Posting instruction generator
- Integration with Finance Kernel

---

## Conclusion

**Status:** PROVISIONAL (SECONDARY evidence)

**Architectural Value:** 🟢 **CRITICAL**
- Enables multi-regime Finance OS
- Enables multi-tenant COA customization
- Preserves historical integrity
- Prevents semantic ambiguity

**Production Readiness:** 🔴 **BLOCKED**
- Requires PRIMARY source verification
- Requires full semantic set definition
- Requires policy model completion (A.4)
- Requires Gate 2 approval

**Next Steps:**
- Task #6: Apply evidence taxonomy to Verification Register
- Task #7: A.3 v1.0 PROVISIONAL LOCK
- Task #8-11: A.4 Policy Evolution Proof
- Task #12: Architecture Review #2

**AR Proposals:**
- AR-011: Account Code Is Not Semantic Identity
- AR-012: Tenant COA Customization Boundary

---

**Document Status:** Canonical Semantic Model ESTABLISHED (PROVISIONAL)  
**Evidence Level:** SECONDARY + CORROBORATED (based on A3-001 finding)  
**Production Use:** 🔴 BLOCKED (pending PRIMARY verification + A.4 completion)  
**Architectural Impact:** 🟢 CRITICAL (foundation for multi-regime, multi-tenant Finance OS) ✅
