# F5.6 A.4.2 Policy Boundary — Data vs Execution Logic

> **Document Type:** Policy Architecture — Boundary Proof  
> **Date:** 2026-08-16  
> **Status:** DRAFT  
> **Purpose:** Prove policy = data, execution = stable logic, truth = immutable

---

## Strategic Context

**A4 Mission:**
> "Prove policy evolution doesn't break Finance Kernel or historical truth"

**A4.2 Objective:**
> "Prove: Policy = versioned data; Finance Engine = stable execution logic"

**Why This Matters:**
- Prevents Finance Kernel from becoming "accounting rules engine khổng lồ"
- Enables policy changes without Kernel rewrites
- Supports 10-20 year architecture stability

---

## Core Invariants (NEW)

### Invariant 1: Policy Independence

**Statement:**
> **"Policy changes MUST NOT require rewriting Finance Kernel execution logic."**

**Rationale:**
- Policy changes frequently (regime updates, business changes)
- Kernel rewrites = high risk, high cost
- Stable engine + configurable policy = sustainable architecture

**Enforcement:**
- Policy represented as data/configuration
- Engine interprets policy data generically
- No `if (TT99) { ... } else if (TT133) { ... }` in Kernel

---

### Invariant 2: Policy as Data

**Statement:**
> **"Accounting/legal policy MUST be represented as versioned data/configuration wherever reasonably possible, not hard-coded into Finance Kernel."**

**Rationale:**
- Hard-coded policy = brittle architecture
- Data-driven policy = flexible, auditable, versionable
- Separation enables vendor/regime independence

**Enforcement:**
- Policy stored in versioned configuration
- Execution logic reads policy data
- Policy changes = data update, NOT code deploy

---

## Three-Layer Separation

### Layer 1: Policy Data (Configuration)

**What It Is:**
- Configuration representing accounting policy
- Versioned and immutable once published
- Tenant-specific or regime-specific

**Example:**
```json
{
    "policy_id": "bella_tt99_v1.0",
    "effective_date": "2026-01-01",
    "regime": "TT99",
    "version": "v1.0",
    "policies": {
        "VENDOR_PREPAYMENT": {
            "recognition": {
                "trigger": "PAYMENT_COMPLETED",
                "conditions": ["payment_approved", "vendor_verified"]
            },
            "measurement": {
                "basis": "HISTORICAL_COST"
            },
            "posting": {
                "debit_semantic": "VENDOR_PREPAYMENT",
                "credit_semantic": "CASH"
            }
        },
        "TRADE_RECEIVABLE": {
            "recognition": {
                "trigger": "INVOICE_ISSUED",
                "conditions": ["goods_delivered", "invoice_approved"]
            },
            "measurement": {
                "basis": "INVOICE_AMOUNT"
            },
            "posting": {
                "debit_semantic": "TRADE_RECEIVABLE",
                "credit_semantic": "REVENUE"
            }
        }
    }
}
```

**Characteristics:**
- ✅ Versionable
- ✅ Tenant-overridable
- ✅ Regime-specific
- ✅ Auditable
- ❌ NOT executable code
- ❌ NOT hard-coded in Kernel

---

### Layer 2: Execution Logic (Engine)

**What It Is:**
- Generic policy resolution and execution engine
- Reads policy data
- Generates financial intents and posting instructions
- Stable across policy changes

**Example (Pseudocode):**
```typescript
class PolicyEngine {
    
    // Generic recognition engine
    evaluateRecognition(
        businessEvent: BusinessEvent,
        semantic: Semantic,
        policy: PolicyData  // Data input, not hard-coded
    ): RecognitionResult {
        
        const recognitionPolicy = policy.policies[semantic].recognition;
        
        // Generic trigger evaluation
        if (businessEvent.type !== recognitionPolicy.trigger) {
            return { recognized: false, reason: "Trigger not met" };
        }
        
        // Generic condition evaluation
        for (const condition of recognitionPolicy.conditions) {
            if (!this.evaluateCondition(businessEvent, condition)) {
                return { recognized: false, reason: `Condition not met: ${condition}` };
            }
        }
        
        return { recognized: true };
    }
    
    // Generic posting instruction generator
    generatePostingInstruction(
        semantic: Semantic,
        amount: number,
        policy: PolicyData,  // Data input
        tenantCOA: TenantCOA  // Data input
    ): PostingInstruction {
        
        const postingPolicy = policy.policies[semantic].posting;
        
        // Resolve semantic → account via Tenant COA
        const debitAccount = tenantCOA.resolve(postingPolicy.debit_semantic);
        const creditAccount = tenantCOA.resolve(postingPolicy.credit_semantic);
        
        return {
            lines: [
                { account_id: debitAccount.id, debit: amount, credit: 0 },
                { account_id: creditAccount.id, debit: 0, credit: amount }
            ]
        };
    }
}
```

**Key Characteristics:**
- ✅ Generic (works with any policy data)
- ✅ Stable (doesn't change when policy changes)
- ✅ Data-driven (reads policy configuration)
- ❌ Does NOT contain regime-specific `if/else`
- ❌ Does NOT contain hard-coded account numbers
- ❌ Does NOT make legal interpretations

---

### Layer 3: Financial Truth (Immutable Ledger)

**What It Is:**
- Immutable journal entries
- Balanced debit/credit lines
- Context metadata (policy version, regime, semantic)
- Audit trail

**Example:**
```json
{
    "transaction_id": "T-2026-001",
    "transaction_date": "2026-01-15",
    "tenant_id": "tenant_abc",
    "lines": [
        {
            "line_id": 1,
            "account_id": 331,
            "debit": 10000000,
            "credit": 0
        },
        {
            "line_id": 2,
            "account_id": 111,
            "debit": 0,
            "credit": 10000000
        }
    ],
    "context": {
        "semantic_event": "VENDOR_PREPAYMENT",
        "policy_id": "bella_tt99_v1.0",
        "policy_version": "v1.0",
        "regime": "TT99",
        "business_event_id": "payment_001",
        "recorded_at": "2026-01-15T10:30:00Z"
    }
}
```

**Key Characteristics:**
- ✅ Immutable (never changes)
- ✅ Context-rich (policy version captured)
- ✅ Auditable
- ❌ Does NOT interpret policy
- ❌ Does NOT execute logic
- ❌ Does NOT know semantic meaning

---

## Four Architectural Tests

### Test A: Policy Change Doesn't Break Engine ✅

**Scenario:**
```
Policy v1.0 (2026-01-01):
VENDOR_PREPAYMENT.recognition.trigger = "PAYMENT_COMPLETED"

Policy v1.1 (2027-06-01):
VENDOR_PREPAYMENT.recognition.trigger = "PAYMENT_APPROVED"
                                         (different trigger)
```

**Expected Results:**

**1. Engine Unchanged:**
```typescript
// Engine code (SAME before and after policy change)
evaluateRecognition(event, semantic, policy) {
    if (event.type !== policy.recognition.trigger) {  // Generic
        return false;
    }
    // ... continue
}
```

**2. Transaction T1 (2026-05-15) with v1.0:**
```json
{
    "context": {
        "policy_version": "v1.0",
        "recognition_trigger": "PAYMENT_COMPLETED"
    }
}
```

**3. Transaction T2 (2027-08-10) with v1.1:**
```json
{
    "context": {
        "policy_version": "v1.1",
        "recognition_trigger": "PAYMENT_APPROVED"
    }
}
```

**4. Query T1 in 2031:**
```
Returns: T1 with v1.0 context (trigger = PAYMENT_COMPLETED)
Engine: Uses v1.0 policy data for interpretation
Result: Historical meaning preserved
```

**✅ PROOF: Engine stable, policy change = data update only**

---

### Test B: Data Change, No Code Deploy ✅

**Scenario:**
```
Tenant wants to change:
TRADE_RECEIVABLE.recognition.trigger
FROM: "INVOICE_ISSUED"
TO:   "GOODS_DELIVERED"
```

**Change Required:**
```json
// Policy Data Update (NO code change)
{
    "policy_id": "bella_tenant_abc_v2.0",
    "version": "v2.0",
    "effective_date": "2027-01-01",
    "policies": {
        "TRADE_RECEIVABLE": {
            "recognition": {
                "trigger": "GOODS_DELIVERED"  // Changed from INVOICE_ISSUED
            }
        }
    }
}
```

**Expected Results:**

**1. NO Code Deploy:**
- Policy Engine unchanged
- Finance Kernel unchanged
- Only policy data updated

**2. Old Transactions:**
```
T1 (2026-12-15, v1.0) → trigger = INVOICE_ISSUED (unchanged)
```

**3. New Transactions:**
```
T2 (2027-02-01, v2.0) → trigger = GOODS_DELIVERED (new policy)
```

**4. Historical Query:**
```
Query T1 → Uses v1.0 (INVOICE_ISSUED)
Query T2 → Uses v2.0 (GOODS_DELIVERED)
```

**✅ PROOF: Policy change = configuration update, not deployment**

---

### Test C: Unresolved Policy = Block Posting ✅

**Scenario:**
```
New semantic introduced: LONG_TERM_DEPOSIT
Policy status: UNRESOLVED (not yet configured)
```

**Business Event:**
```
Event: Record long-term deposit (10M VND)
Semantic: LONG_TERM_DEPOSIT
Policy: NOT CONFIGURED
```

**Expected Results:**

**1. Policy Engine Check:**
```typescript
const policy = policyData.policies["LONG_TERM_DEPOSIT"];

if (!policy || policy.evidence_grade === "UNRESOLVED") {
    throw new PolicyUnresolvedException(
        "LONG_TERM_DEPOSIT policy not configured. Cannot generate posting instruction."
    );
}
```

**2. Transaction:**
```
Status: BLOCKED
Reason: "Policy unresolved for semantic LONG_TERM_DEPOSIT"
Action Required: Configure policy or mark exception
```

**3. NO Automatic Posting:**
```
❌ Do NOT guess posting pattern
❌ Do NOT use default fallback (dangerous)
✅ BLOCK until policy configured or exception approved
```

**Link to A.3 Evidence Taxonomy:**
```
Evidence Grade = UNRESOLVED
    ↓
Production Use = PROHIBITED
    ↓
Posting = BLOCKED
```

**✅ PROOF: Unverified policy cannot enter ledger**

---

### Test D: Published Policy = Immutable ✅

**Scenario:**
```
Policy v1.0 published 2026-01-01
Transaction T1 recorded 2026-05-15 using v1.0

2027-01-01:
Someone attempts to modify v1.0 definition
(change trigger from PAYMENT_COMPLETED to PAYMENT_APPROVED)
```

**Expected Results:**

**1. Policy Modification Rejected:**
```typescript
updatePolicy(policyId: "bella_tt99_v1.0", changes: {...}) {
    if (policy.status === "PUBLISHED" && policy.has_transactions) {
        throw new ImmutablePolicyException(
            "Cannot modify published policy with existing transactions. Create new version instead."
        );
    }
}
```

**2. Correct Approach:**
```
Create Policy v1.1 with new definition
Effective date: 2027-01-01
v1.0 remains unchanged
```

**3. Historical Transaction:**
```
T1 (2026-05-15):
    policy_version: "v1.0"
    trigger: "PAYMENT_COMPLETED"
    
Query T1 in 2031:
    Still references v1.0
    Still shows PAYMENT_COMPLETED (unchanged)
```

**4. Audit Trail:**
```
Policy v1.0:
    Created: 2026-01-01
    Status: PUBLISHED
    Transactions: 1,247 transactions
    Modification attempts: 1 (rejected)
    
Policy v1.1:
    Created: 2027-01-01
    Supersedes: v1.0
    Transactions: 832 transactions
```

**✅ PROOF: Policy versioning prevents historical mutation**

---

## JSONB Boundary (NOT Production Schema Yet)

**Current Objective:** Establish principle, NOT design production schema

**Principle:**
> "JSONB stores policy data/configuration. JSONB does NOT store executable logic."

**ALLOWED in JSONB:**
```json
{
    "recognition_trigger": "PAYMENT_COMPLETED",
    "measurement_basis": "HISTORICAL_COST",
    "conditions": ["payment_approved", "vendor_verified"]
}
```
(Data/configuration)

**PROHIBITED in JSONB:**
```json
{
    "if": "regime == TT99",
    "then": { "execute": "..." },
    "else": { "execute": "..." },
    "loop": "for each transaction ...",
    "sql": "UPDATE ledger SET ..."
}
```
(Executable logic)

**Why This Boundary Matters:**
> "Nếu không khóa boundary này, vài năm sau Bella sẽ có một 'ngôn ngữ lập trình kế toán' nằm trong database 😂."

**Production Schema:** Defer to post-Gate 2 (C.2 phase)

---

## Architecture Flow (Proven)

**Complete Flow:**
```
BUSINESS EVENT (e.g., vendor payment)
    ↓
TRANSACTION DATA (amount, date, parties)
    ↓
CANONICAL SEMANTIC (VENDOR_PREPAYMENT)
    ↓
POLICY DATA (v1.0: recognition, measurement, posting rules)
    ↓
POLICY RESOLUTION (engine reads policy data)
    ↓
FINANCIAL INTENT (recognize prepayment)
    ↓
POSTING INSTRUCTION (Dr 331, Cr 111 via Tenant COA)
    ↓
FINANCE KERNEL (validate balanced entry, persist with context)
    ↓
IMMUTABLE LEDGER (transaction + policy version metadata)
```

**Layer Responsibilities:**

| Layer | Responsibility | Changes When | Stable? |
|-------|----------------|--------------|---------|
| Business Event | Domain logic | Business changes | Varies |
| Transaction Data | Event details | Per transaction | N/A |
| Canonical Semantic | Financial meaning | Rarely (architecture) | Very stable |
| Policy Data | Rules/config | Policy updates | Data only |
| Policy Resolution | Generic engine | Never (architecture stable) | ✅ Very stable |
| Financial Intent | What to post | Policy-driven | Derived |
| Posting Instruction | Dr/Cr commands | COA changes (data) | Instruction format stable |
| Finance Kernel | Validate + persist | Never (frozen) | ✅ Frozen |
| Immutable Ledger | Financial truth | Never | ✅ Immutable |

**Key Insight:**
- Policy Data changes frequently (business/regime changes)
- Policy Resolution Engine changes never (generic logic)
- Finance Kernel changes never (frozen)

---

## Gate 2 Contribution (A4.2)

**Question 1: Independence**
> Đổi accounting regime → Kernel đổi?

**A4.2 Proof:**
- Policy data regime-specific, Kernel regime-agnostic ✅
- Test A: Policy v1.0 → v1.1, Kernel unchanged ✅
- No `if (TT99)` in Kernel ✅

**Question 2: Interoperability**
> Đổi MISA/SAP/FAST → semantics đổi?

**A4.2 Proof:**
- Semantics in Layer 3 (canonical), not Kernel ✅
- Posting instructions resolved via Tenant COA (data) ✅
- Adapter layer handles vendor differences ✅

**Question 3: Historical Integrity**
> Đổi policy → historical transaction đổi meaning?

**A4.2 Proof:**
- Test B: Policy change = data update, old transactions unchanged ✅
- Test D: Published policy immutable ✅
- A4.3 will prove with timeline test ⏳ (next deliverable)

---

## Conclusion

**A4.2 Status:** ✅ COMPLETE

**Deliverable:**
- Three-layer separation proven (Data / Execution / Truth)
- Two core invariants established
- Four architectural tests designed (engine stability, data-driven changes, unresolved blocking, policy immutability)
- JSONB boundary principle locked (data, not executable logic)

**Key Proofs:**
- ✅ Policy changes = data updates, NOT code deploys
- ✅ Engine remains stable across policy evolution
- ✅ Unresolved policy blocks posting (connects to A.3 Evidence Taxonomy)
- ✅ Published policy immutable (historical integrity)

**NOT Done (Correctly):**
- ❌ Production JSONB schema (deferred to C.2 post-Gate 2)
- ❌ Complete policy engine implementation (architecture proof only)

**Next:**
- A4.3: Historical Reconstruction Proof (timeline test 2026→2031)
- This will prove Q3: "Đổi policy → historical transaction đổi meaning?" = NO

---

**Document Status:** A4.2 Policy Boundary COMPLETE ✅  
**Core Invariant:** Policy changes MUST NOT rewrite Finance Kernel ✅  
**Architecture Proof:** 4 tests designed (engine stability proven) ✅  
**Q3 Status:** Still DESIGNED (A4.3 will prove with timeline test) ⏳
