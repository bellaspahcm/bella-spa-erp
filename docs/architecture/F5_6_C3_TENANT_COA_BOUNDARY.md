# F5.6 C.3 Tenant COA Boundary — Realization Layer Proof

> **Document Type:** Architecture Proof — Tenant COA Design  
> **Date:** 2026-08-16  
> **Status:** DRAFT  
> **Purpose:** Prove Tenant COA is realization layer (semantic → account mapping), tenant-isolated, historically-immutable

---

## Executive Summary

**Phase 2 Status:** 🟢 **OPEN** (architecture/design only)

**C.3 Mission:**
> "Prove Tenant COA is a realization layer - canonical semantic → account mapping, independent and tenant-isolated."

**Critical Question:**
> **"Intent được hiện thực thành account nào cho từng tenant, và tenant isolation + historical integrity được bảo đảm như thế nào?"**

**Five Proof Tests:**
1. C3-T1: Same Semantic, Different COA (multi-tenant independence)
2. C3-T2: Account Code ≠ Semantic Identity (AR-012 validation)
3. C3-T3: Tenant Isolation (no cross-tenant leakage)
4. C3-T4: Historical COA Integrity ⭐ (COA changes don't rewrite history)
5. C3-T5: Kernel Independence (Kernel account-agnostic)

**AR Validation:**
- AR-012: Tenant COA Customization Boundary (testable boundary)

---

## Strategic Context

**C.2 Achievement:**
- ✅ Accounting Intent defined (Decision layer, pre-realization)
- ✅ Intent ≠ Semantic, ≠ Policy, ≠ Posting Instruction
- ✅ Bella's authority boundary: Execute policy (NOT interpret law)

**C.3 Mission:**
> "Answer: Intent được hiện thực thành account nào?"

**Architecture Position:**
```
C.2: Accounting Intent
    "RECOGNIZE_PREPAID_EXPENSE (100M)"
            ↓
C.3: Tenant COA Realization ← NEW
    Tenant A: Account 242
    Tenant B: Account 2421
    Tenant C: Account 242.01
            ↓
Posting Instruction
    Dr [resolved account], Cr 111
            ↓
F1-F4 Kernel
    Persist immutable truth
```

**NOT Building:**
- ❌ Full accounting system
- ❌ Universal COA engine
- ❌ Accounting regime interpreter

**Building:**
- ✅ Semantic → Account mapping layer
- ✅ Tenant-isolated COA
- ✅ Historical COA integrity
- ✅ Kernel-independent realization

---

## Part 1: COA as Realization Layer

### What Is Tenant COA?

**Definition:**
> **"Tenant COA is the mapping layer that realizes canonical semantics into tenant-specific account codes, within regulatory bounds."**

**Key Characteristics:**

**1. COA = Realization (NOT definition):**
```
WRONG (COA defines semantic):
    Account 242 = PREPAID_EXPENSE  ❌
    (Account code defines meaning)

CORRECT (COA realizes semantic):
    PREPAID_EXPENSE → Account 242 (Tenant A)  ✅
    PREPAID_EXPENSE → Account 2421 (Tenant B)  ✅
    (Semantic independent, COA tenant-specific)
```

**2. COA = Tenant-Specific (NOT universal):**
```
                 CANONICAL SEMANTIC
                 PREPAID_EXPENSE
                        │
              ┌─────────┼─────────┐
              ↓         ↓         ↓
           Tenant A  Tenant B  Tenant C
              │         │         │
             242      2421/22   242.01/02
              │         │         │
              └─────────┼─────────┘
                        ↓
                Posting Instruction
```

**3. COA = Customizable (Within Regulatory Bounds):**
```
TT99/2025 Điều 11:
"Doanh nghiệp được điều chỉnh tên, số hiệu, cấu trúc và nội dung tài khoản..."

ALLOWED:
    242 → 2421, 2422 (subdivision) ✅
    242 → 242.01, 242.02 (multi-level) ✅
    242 → 242-A, 242-B (naming) ✅

PROHIBITED:
    Omit required account ❌
    Mix semantics in single account ❌
    Violate regulatory structure ❌
```

**4. COA = Versioned (Historical Integrity):**
```
2026: Tenant A uses Account 242
    ↓
2028: Tenant A changes to 2421
    ↓
2031: Query 2026 transaction → Still 242 (historical)
```

---

### COA Architecture Layers

**Complete Flow:**
```
CANONICAL SEMANTIC (Layer 2)
PREPAID_EXPENSE
    ↓
ACCOUNTING INTENT (Layer 3.5 — C.2)
RECOGNIZE_PREPAID_EXPENSE
    ↓
TENANT COA MAPPING (Layer 4 — C.3)  ← NEW
Tenant A: PREPAID_EXPENSE → 242
    ↓
POSTING INSTRUCTION (Layer 5)
Dr 242: 100,000,000
Cr 111: 100,000,000
    ↓
FINANCE KERNEL (F1-F4)
Persist with account_id = 242
```

---

## Part 2: Five Proof Tests

### Test C3-T1: Same Semantic, Different COA ✅

**Claim:**
> "Same canonical semantic can map to different account codes across tenants without semantic change."

**Proof:**

**Scenario: Three Tenants, Same Semantic**
```
Semantic: PREPAID_EXPENSE
Business Event: Pay annual insurance 12M VND

Tenant A (Spa SME - Standard COA):
    COA Mapping: PREPAID_EXPENSE → 242
    Posting: Dr 242, Cr 111

Tenant B (Manufacturing - Subdivided COA):
    COA Mapping: PREPAID_EXPENSE → 2421 (materials), 2422 (services)
    Business Context: Insurance = service
    Posting: Dr 2422, Cr 111

Tenant C (Conglomerate - Multi-Entity COA):
    COA Mapping: PREPAID_EXPENSE → 242.01 (parent), 242.02 (subsidiary A)
    Entity Context: Parent company
    Posting: Dr 242.01, Cr 111.01
```

**Verification:**

| Tenant | Account Code | Semantic | Intent | Amount |
|--------|--------------|----------|--------|--------|
| A | 242 | PREPAID_EXPENSE | RECOGNIZE | 12M |
| B | 2422 | PREPAID_EXPENSE | RECOGNIZE | 12M |
| C | 242.01 | PREPAID_EXPENSE | RECOGNIZE | 12M |

**Query by Semantic (Consolidated):**
```sql
SELECT * FROM transactions 
WHERE semantic = 'PREPAID_EXPENSE'
AND transaction_date = '2026-08-16';

Results:
    Tenant A: Account 242, 12M
    Tenant B: Account 2422, 12M
    Tenant C: Account 242.01, 12M

Consolidated: 36M total PREPAID_EXPENSE (semantic unchanged)
```

**Query by Account Code (Tenant-Specific):**
```sql
-- Tenant A
SELECT * FROM transactions 
WHERE tenant_id = 'tenant_a' 
AND account_code = '242';

Results: 12M in account 242

-- Tenant B
SELECT * FROM transactions 
WHERE tenant_id = 'tenant_b' 
AND account_code = '242';

Results: 0 (Tenant B uses 2422, not 242)
```

**✅ PROVEN: Same semantic → different COA per tenant, semantic stable**

---

### Test C3-T2: Account Code ≠ Semantic Identity (AR-012) ✅

**Claim (AR-012):**
> "Changing account code does NOT change semantic identity. COA mapping is data layer, NOT semantic definition."

**Proof:**

**Scenario: Tenant Changes COA**
```
2026-01-01: Tenant A configuration
    PREPAID_EXPENSE → 242

2027-06-01: Tenant A reconfigures COA (subdivision for better reporting)
    PREPAID_EXPENSE → 2421 (materials)
    PREPAID_EXPENSE → 2422 (services)
    (Old 242 no longer used for new transactions)
```

**Transaction Timeline:**
```
T1 (2026-05-15, before change):
    Semantic: PREPAID_EXPENSE
    COA Mapping: 242
    Account: 242
    
T2 (2027-08-10, after change):
    Semantic: PREPAID_EXPENSE (SAME semantic)
    COA Mapping: 2422 (new mapping)
    Account: 2422
```

**Semantic Query (2031):**
```sql
SELECT * FROM transactions 
WHERE tenant_id = 'tenant_a'
AND semantic = 'PREPAID_EXPENSE';

Results:
    T1: Account 242, PREPAID_EXPENSE (unchanged)
    T2: Account 2422, PREPAID_EXPENSE (unchanged)

Semantic identity: STABLE across COA change
```

**Account Code Change Does NOT:**
- ❌ Change semantic (PREPAID_EXPENSE still PREPAID_EXPENSE)
- ❌ Change historical transactions (T1 still 242)
- ❌ Rewrite financial meaning (prepaid expense still prepaid expense)

**Account Code Change DOES:**
- ✅ Change realization for NEW transactions (T2 uses 2422)
- ✅ Improve tenant reporting (materials vs services breakdown)
- ✅ Preserve historical accuracy (T1 unchanged at 242)

**✅ PROVEN: Account Code ≠ Semantic Identity (AR-012 validated)**

---

### Test C3-T3: Tenant Isolation ✅

**Claim:**
> "Tenant A cannot resolve Tenant B's account codes. COA mapping is tenant-isolated."

**Proof:**

**Scenario: Two Tenants, Same Semantic**
```
Tenant A:
    PREPAID_EXPENSE → 242
    
Tenant B:
    PREPAID_EXPENSE → 2421
```

**Test 1: Tenant A Transaction**
```
Business Event (Tenant A): Pay insurance 10M
    ↓
Semantic: PREPAID_EXPENSE
    ↓
COA Lookup: tenant_id = 'tenant_a'
    PREPAID_EXPENSE → 242 (Tenant A mapping)
    ↓
Posting: Dr 242, Cr 111
    ↓
Kernel: Persist with tenant_id = 'tenant_a'
```

**Test 2: Tenant B Transaction**
```
Business Event (Tenant B): Pay insurance 10M
    ↓
Semantic: PREPAID_EXPENSE (same)
    ↓
COA Lookup: tenant_id = 'tenant_b'
    PREPAID_EXPENSE → 2421 (Tenant B mapping, NOT 242)
    ↓
Posting: Dr 2421, Cr 111
    ↓
Kernel: Persist with tenant_id = 'tenant_b'
```

**Test 3: Cross-Tenant Query Prevention**
```
Tenant A queries:
    SELECT * FROM transactions 
    WHERE tenant_id = 'tenant_a';
    
    Results: Only Tenant A transactions (242)
    Does NOT see: Tenant B transactions (2421)

Tenant B queries:
    SELECT * FROM transactions 
    WHERE tenant_id = 'tenant_b';
    
    Results: Only Tenant B transactions (2421)
    Does NOT see: Tenant A transactions (242)
```

**Test 4: COA Mapping Isolation**
```
Tenant A COA resolver:
    Input: PREPAID_EXPENSE
    Lookup: coa_mappings WHERE tenant_id = 'tenant_a'
    Output: Account 242 (ONLY Tenant A mapping)
    
    Does NOT return: Tenant B's 2421 ❌
    Does NOT merge: Multiple tenants ❌
    Does NOT default: Cross-tenant fallback ❌
```

**Isolation Enforcement:**

| Layer | Isolation Mechanism | Test Result |
|-------|---------------------|-------------|
| COA Mapping | tenant_id filter | ✅ Isolated |
| Transaction Query | tenant_id filter | ✅ Isolated |
| Posting Instruction | tenant_id validation | ✅ Isolated |
| Kernel Persistence | tenant_id column | ✅ Isolated |

**✅ PROVEN: Tenant isolation enforced, no cross-tenant leakage**

---

### Test C3-T4: Historical COA Integrity ⭐ ✅

**Claim:**
> "COA changes do NOT rewrite historical transactions. Historical queries reconstruct original account codes."

**Proof:**

**Timeline Scenario (2026-2031):**

**2026-01-01: Tenant A Initial COA**
```
COA Configuration v1.0:
    PREPAID_EXPENSE → 242
    CASH → 111
```

**2026-05-15: Transaction T1**
```
Business Event: Pay insurance 12M
    ↓
Semantic: PREPAID_EXPENSE
    ↓
COA Mapping (v1.0): PREPAID_EXPENSE → 242
    ↓
Transaction T1:
    account_code: 242
    semantic: PREPAID_EXPENSE
    coa_version: v1.0
    ↓
Kernel Persist:
    {
        "transaction_id": "T1",
        "tenant_id": "tenant_a",
        "lines": [
            {"account_id": 242, "account_code": "242", "debit": 12000000},
            {"account_id": 111, "account_code": "111", "credit": 12000000}
        ],
        "context": {
            "semantic": "PREPAID_EXPENSE",
            "coa_version": "v1.0",
            "coa_mapping": "PREPAID_EXPENSE → 242"
        }
    }
```

**2028-06-01: Tenant A COA Change**
```
COA Configuration v2.0:
    PREPAID_EXPENSE → 2421 (materials)
    PREPAID_EXPENSE → 2422 (services)
    (Account 242 phased out for new transactions)
    
COA v1.0: Status = HISTORICAL (immutable)
COA v2.0: Status = ACTIVE
```

**2028-08-10: Transaction T2**
```
Business Event: Pay insurance 15M (service)
    ↓
Semantic: PREPAID_EXPENSE
    ↓
COA Mapping (v2.0): PREPAID_EXPENSE → 2422 (service)
    ↓
Transaction T2:
    account_code: 2422 (NEW COA)
    semantic: PREPAID_EXPENSE
    coa_version: v2.0
    ↓
Kernel Persist: Account 2422 (NOT 242)
```

**2031-08-16: Query T1 (Historical)**
```
Query: Retrieve T1

Expected Result:
    {
        "transaction_id": "T1",
        "transaction_date": "2026-05-15",
        "lines": [
            {"account_code": "242", "debit": 12000000},  ← NOT 2422
            {"account_code": "111", "credit": 12000000}
        ],
        "context": {
            "semantic": "PREPAID_EXPENSE",
            "coa_version": "v1.0",  ← NOT v2.0
            "coa_mapping": "242"  ← Original mapping
        }
    }

NOT:
    account_code: "2422"  ❌ (current COA)
    coa_version: "v2.0"  ❌ (current version)
```

**2031-08-16: Financial Statement Reconstruction (2026)**
```
Query: Generate Balance Sheet for 2026-12-31

Expected:
    Assets (TT133 format, 2026):
        142 - Chi phí trả trước ngắn hạn: X VND
        242 - Chi phí trả trước: 12,000,000 VND  ← T1 (original account)
        
NOT:
    2422 - Chi phí trả trước dịch vụ: 12,000,000 VND  ❌ (current COA)
```

**Historical Reconstruction Mechanism:**
```
Query historical transaction T1:
    ↓
Load T1 context:
    coa_version = v1.0
    semantic = PREPAID_EXPENSE
    original_account = 242
    ↓
Resolve using HISTORICAL COA v1.0:
    PREPAID_EXPENSE → 242 (as recorded in 2026)
    ↓
Display/Report:
    Account 242 (NOT current 2422)
    COA version v1.0 (NOT current v2.0)
```

**COA Change Impact Matrix:**

| Aspect | T1 (2026, pre-change) | T2 (2028, post-change) |
|--------|------------------------|------------------------|
| Account Code | 242 (unchanged) | 2422 (new COA) |
| Semantic | PREPAID_EXPENSE | PREPAID_EXPENSE |
| COA Version | v1.0 (immutable) | v2.0 (current) |
| Query in 2031 | Still 242 ✅ | Still 2422 ✅ |
| FS Reconstruction 2026 | 242 ✅ | N/A (not in 2026) |
| FS Reconstruction 2028 | 242 (if querying 2026 period) ✅ | 2422 (if querying 2028 period) ✅ |

**✅ PROVEN: COA changes do NOT rewrite history, reconstruction accurate**

---

### Test C3-T5: Kernel Independence ✅

**Claim:**
> "Finance Kernel does NOT interpret account codes, semantics, or COA mappings. Kernel is account-agnostic."

**Proof:**

**Kernel Input (Posting Instruction):**
```json
{
    "tenant_id": "tenant_a",
    "lines": [
        {
            "account_id": 242,
            "account_code": "242",
            "debit": 12000000,
            "credit": 0
        },
        {
            "account_id": 111,
            "account_code": "111",
            "debit": 0,
            "credit": 12000000
        }
    ],
    "context": {
        "semantic": "PREPAID_EXPENSE",
        "coa_version": "v1.0",
        "intent_id": "INT-001"
    }
}
```

**Kernel Validation (Account-Agnostic):**
```
Validation 1: Balanced?
    Σ Debit = Σ Credit?
    12,000,000 = 12,000,000 ✅
    
    Kernel does NOT check:
        "242 là chi phí trả trước?" ❌
        "242 có đúng semantic PREPAID_EXPENSE?" ❌

Validation 2: Accounts exist?
    account_id 242 in tenant_accounts? ✅
    account_id 111 in tenant_accounts? ✅
    
    Kernel does NOT check:
        "242 mapped to semantic nào?" ❌
        "COA v1.0 có hợp lệ?" ❌

Validation 3: Tenant valid?
    tenant_id 'tenant_a' exists? ✅
    tenant_id active? ✅
    
    Kernel does NOT check:
        "Tenant A dùng TT99 hay TT133?" ❌
        "COA của Tenant A có đúng chuẩn?" ❌

Validation 4: Period open?
    period '2026-08' status = OPEN? ✅
    
    Kernel does NOT check:
        "Policy v1.0 có áp dụng cho period này?" ❌
```

**Kernel Persistence (Context Pass-Through):**
```sql
INSERT INTO journal_entries (
    transaction_id,
    tenant_id,
    account_id,
    debit,
    credit,
    context_metadata  -- JSON blob, immutable
);

Kernel stores context AS-IS:
    {
        "semantic": "PREPAID_EXPENSE",  ← Stored, NOT interpreted
        "coa_version": "v1.0",  ← Stored, NOT validated
        "intent_id": "INT-001"  ← Stored, NOT resolved
    }

Kernel does NOT:
    Validate semantic correctness ❌
    Check COA version validity ❌
    Resolve intent to semantic ❌
    Enforce policy rules ❌
```

**Kernel Responsibilities (FROZEN):**

| Responsibility | Kernel Role | NOT Kernel Role |
|----------------|-------------|-----------------|
| **Balanced entry** | ✅ Enforce | ❌ Interpret semantic |
| **Account existence** | ✅ Validate account_id | ❌ Validate semantic mapping |
| **Tenant isolation** | ✅ Enforce tenant_id | ❌ Validate tenant COA |
| **Immutability** | ✅ Persist immutable | ❌ Reconstruct COA history |
| **Audit trail** | ✅ Log all changes | ❌ Interpret policy context |
| **Context metadata** | ✅ Store as-is | ❌ Parse/validate context |

**Kernel Independence Test:**
```
Scenario: Change semantic PREPAID_EXPENSE → OTHER_SEMANTIC

Layer 4 (COA Mapping):
    PREPAID_EXPENSE → 242 (before)
    OTHER_SEMANTIC → 242 (after)
    
Kernel:
    Receives: account_id = 242 (same)
    Validates: Balanced? ✅ Account exists? ✅
    Persists: account_id = 242 (unchanged)
    
Kernel does NOT:
    Detect semantic change ❌
    Reject due to semantic mismatch ❌
    Require semantic validation ❌

Result: Kernel unaffected by semantic change (account-agnostic) ✅
```

**✅ PROVEN: Kernel account-agnostic, does NOT interpret COA/semantic**

---

## Part 3: COA Architecture Design

### Layer 4 Architecture (Tenant COA)

**Complete Flow:**
```
ACCOUNTING INTENT (C.2)
RECOGNIZE_PREPAID_EXPENSE
    Amount: 100M
    ↓
TENANT COA RESOLVER (C.3)  ← NEW
    ↓
    tenant_id: tenant_a
    semantic: PREPAID_EXPENSE
    ↓
    COA Lookup:
        tenant_a.coa_mappings
        WHERE semantic = 'PREPAID_EXPENSE'
        AND status = 'ACTIVE'
    ↓
    Result: account_code = 242
    ↓
POSTING INSTRUCTION GENERATOR (C.2 + C.3)
    Dr 242: 100,000,000
    Cr 111: 100,000,000
    ↓
FINANCE KERNEL (F1-F4)
    Validate + Persist
```

---

### COA Mapping Components

**Component 1: Tenant COA Registry**
```
Tenant Chart of Accounts:
    tenant_id
    coa_version
    regime_code (TT99, TT133)
    effective_date
    status (ACTIVE, HISTORICAL)
    approved_by
```

**Component 2: Semantic-to-Account Mapping**
```
COA Mapping:
    mapping_id
    tenant_id
    coa_version
    semantic_id (PREPAID_EXPENSE)
    account_id (242)
    account_code ("242")
    account_name ("Chi phí trả trước")
    effective_date
    deactivated_date
    status (ACTIVE, HISTORICAL)
```

**Component 3: Account Registry**
```
Tenant Accounts:
    account_id
    tenant_id
    account_code ("242")
    account_name ("Chi phí trả trước")
    account_type (ASSET, LIABILITY, etc.)
    parent_account_id (for hierarchy)
    is_active
    created_date
    deactivated_date
```

---

### COA Versioning Model

**Version Evolution:**
```
COA v1.0 (2026-01-01):
    PREPAID_EXPENSE → 242
    Status: ACTIVE
    Transactions: T1, T2, T3 (242 transactions)
    
COA v2.0 (2028-06-01):
    PREPAID_EXPENSE → 2421 (materials)
    PREPAID_EXPENSE → 2422 (services)
    Status: ACTIVE
    Transactions: T4, T5, T6 (2421/2422 transactions)
    
COA v1.0 (after v2.0 published):
    Status: HISTORICAL (immutable)
    Transactions: T1, T2, T3 (unchanged at 242)
    Used for: Historical queries, reconstruction
```

**COA Mutation Prevention:**
```
Attempt to modify COA v1.0:
    UPDATE coa_mappings 
    SET account_code = '2421' 
    WHERE coa_version = 'v1.0' 
    AND semantic_id = 'PREPAID_EXPENSE';

Result: ❌ REJECTED
    Error: "Cannot modify published COA with transactions. Create new version."
    
Correct approach:
    Create COA v2.0 (new version)
    v1.0 remains unchanged (historical)
```

---

### COA Customization Boundaries (TT99 Điều 11)

**Regulatory Compliance:**
```
TT99/2025 Điều 11 ALLOWS:
    ✅ Account code customization (242 → 2421, 2422)
    ✅ Account name customization
    ✅ Account subdivision (242 → 242.01, 242.02)
    ✅ Additional hierarchy levels
    ✅ Industry-specific accounts
    
TT99/2025 Điều 11 REQUIRES:
    ✅ Maintain regulatory structure
    ✅ Include all required accounts
    ✅ Financial statement mapping
    ✅ Documentation of changes
```

**Validation Rules:**
```
Rule 1: Required accounts present
    Check: All TT99 Phụ lục II accounts configured
    
Rule 2: No semantic mixing
    Check: One account → one semantic (or semantic group)
    
Rule 3: Regulatory structure maintained
    Check: 3-digit base preserved (e.g., 242, not XYZ)
    
Rule 4: Parent-child relationships valid
    Check: 2421, 2422 → parent 242 exists
```

---

## Part 4: NOT Production Schema (Conceptual Only)

**Status:** 🔴 **SCHEMA DEFERRED** (pending PRIMARY verification)

**Why Conceptual Only:**
- C.3 = Architecture/design proof
- Production schema requires PRIMARY verification complete
- COA regulatory compliance requires legal counsel review

**Conceptual COA Structure (Illustrative):**
```typescript
interface TenantCOA {
    // Identity
    coa_id: string;
    tenant_id: string;
    coa_version: string;
    
    // Regulatory
    regime_code: string;  // "TT99", "TT133"
    effective_date: Date;
    supersedes_coa_id?: string;
    
    // Status
    status: "DRAFT" | "ACTIVE" | "HISTORICAL";
    approved_by: string;
    approved_at: Date;
    
    // Compliance
    regulatory_compliance_verified: boolean;
    verification_date?: Date;
}

interface SemanticAccountMapping {
    // Identity
    mapping_id: string;
    tenant_id: string;
    coa_version: string;
    
    // Mapping
    semantic_id: string;  // "PREPAID_EXPENSE"
    account_id: number;
    account_code: string;  // "242", "2421", etc.
    
    // Context
    mapping_rule?: string;  // e.g., "materials", "services"
    conditions?: object;  // JSON conditions for resolution
    
    // Lifecycle
    effective_date: Date;
    deactivated_date?: Date;
    status: "ACTIVE" | "HISTORICAL";
}

interface TenantAccount {
    // Identity
    account_id: number;
    tenant_id: string;
    account_code: string;  // "242"
    
    // Metadata
    account_name: string;
    account_name_en?: string;
    account_type: AccountType;  // ASSET, LIABILITY, etc.
    
    // Hierarchy
    parent_account_id?: number;
    level: number;  // 1 = top level, 2 = sub-account, etc.
    
    // Regulatory
    regime_account_code?: string;  // TT99 standard code
    required_by_regime: boolean;
    
    // Status
    is_active: boolean;
    created_date: Date;
    deactivated_date?: Date;
}
```

**NOT Implemented Yet:**
- ❌ Production database tables
- ❌ COA versioning schema
- ❌ Semantic mapping schema
- ❌ COA resolver implementation
- ❌ Regulatory compliance validator

**Design Only:**
- ✅ Conceptual data structures
- ✅ COA versioning model
- ✅ Mapping architecture
- ✅ Five proof tests

---

## Part 5: AR-012 Validation

**AR-012 Candidate (from A.3):**
> **"Tenant COA Customization Boundary"**

**Claim:**
> "Account code is NOT semantic identity. Tenant COA customization (TT99 Điều 11) does NOT change canonical semantics."

**Evidence from C.3:**

**Test C3-T1:**
- ✅ Same semantic → different COA per tenant
- ✅ Semantic stable across tenant customization

**Test C3-T2:**
- ✅ Account code change (242 → 2421) does NOT change semantic
- ✅ COA = realization layer (NOT definition layer)

**Test C3-T3:**
- ✅ Tenant COA isolated (no cross-tenant leakage)

**Test C3-T4:**
- ✅ COA changes do NOT rewrite historical transactions
- ✅ Historical reconstruction uses original account codes

**Test C3-T5:**
- ✅ Kernel account-agnostic (does NOT interpret COA)

**AR-012 Status:** ✅ **VALIDATED** (testable boundary proven)

**Production Impact:**
- Semantic layer (Layer 2) independent of COA (Layer 4)
- Multi-tenant COA support proven
- Historical integrity mechanism validated
- Kernel-COA independence enforced

---

## Part 6: Three Invariants Protection

**Invariant 1: Semantic Independence**
- ✅ Protected: Semantic ≠ Account Code (C3-T2)
- ✅ Protected: Same semantic, different COA per tenant (C3-T1)
- ✅ Protected: Kernel account-agnostic (C3-T5)

**Invariant 2: Policy Independence**
- ✅ Protected: COA changes do NOT require Kernel rewrites
- ✅ Protected: COA = data layer (versioned, configurable)
- ✅ Protected: Kernel does NOT interpret COA policy

**Invariant 3: Historical Integrity**
- ✅ Protected: COA changes do NOT rewrite history (C3-T4)
- ✅ Protected: Historical queries use original COA version
- ✅ Protected: Transaction bound to original COA context

---

## Conclusion

**C.3 Status:** ✅ **ARCHITECTURE PROOF COMPLETE**

**Five Proof Tests:**
1. ✅ C3-T1: Same Semantic, Different COA (PROVEN)
2. ✅ C3-T2: Account Code ≠ Semantic Identity (AR-012 validated)
3. ✅ C3-T3: Tenant Isolation (PROVEN)
4. ✅ C3-T4: Historical COA Integrity ⭐ (PROVEN)
5. ✅ C3-T5: Kernel Independence (PROVEN)

**Key Achievement:**
> **"Tenant COA proven as realization layer - semantic → account mapping, tenant-isolated, historically-immutable."**

**AR Validation:**
- ✅ AR-012: Tenant COA Customization Boundary (testable boundary proven)

**Three Invariants Protected:**
1. ✅ Semantic Independence (COA ≠ Semantic definition)
2. ✅ Policy Independence (COA = data, Kernel unchanged)
3. ✅ Historical Integrity (COA changes don't rewrite history)

**Phase 2 Status:**
- ✅ C.2 Architecture: PROVEN
- ✅ C.3 Architecture: PROVEN
- 🔴 C.3 Production Schema: DEFERRED (pending PRIMARY)
- 🔴 C.3 Implementation: DEFERRED (post-PRIMARY)

**Next:**
- C.5: Accounting Adapter Boundary (MISA/SAP/FAST interoperability)
- Then C.4: Reconciliation (after adapter contract proven)
- Then C.6: Financial Intelligence (foundation)

---

**Document Status:** C.3 Tenant COA Boundary PROVEN ✅  
**AR-012:** Tenant COA Customization Boundary VALIDATED ✅  
**COA = Realization Layer:** Semantic → Account mapping proven ✅  
**Historical COA Integrity:** COA changes don't rewrite history ✅  
**Production Status:** Architecture proven, schema/code deferred (PROVISIONAL) 🔴
