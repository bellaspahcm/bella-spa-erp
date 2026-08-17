# F5.6 C.2 Accounting Intent Boundary — What Bella Decides vs Executes

> **Document Type:** Architecture Proof — Intent Layer Design  
> **Date:** 2026-08-16  
> **Status:** DRAFT  
> **Purpose:** Define Accounting Intent boundary and decision authority limits

---

## Executive Summary

**Phase 2 Status:** 🟢 **OPEN** (architecture/design only)

**C.2 Mission:**
> "Define Accounting Intent boundary - what it is, what it is NOT, and where Bella's decision authority stops."

**Critical Question:**
> **"Intent ≠ Semantic, ≠ Policy, ≠ Posting Instruction. Vậy Intent là gì?"**

**Five Proof Tests:**
1. Intent ≠ Semantic (prove difference)
2. Intent ≠ Policy (prove difference)
3. Intent ≠ Posting Instruction (prove difference)
4. Intent does NOT bypass Kernel (prove boundary)
5. Intent does NOT contain legal interpretation (prove limit)

---

## Strategic Context

**Phase 1 Achievement:**
- ✅ Semantic Independence proven (Account Code ≠ Semantic Identity)
- ✅ Policy Independence proven (Policy = data, Kernel = stable)
- ✅ Historical Integrity proven (Transaction bound to original context)

**Phase 2 Constraint:**
> **"Kernel không được 'thông minh hơn' trong Phase 2."**

**Architectural Protection:**
```
                 BELLA FINANCE OS
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
   SEMANTIC         POLICY         ADAPTER
   meaning         context        interoperability
        │              │              │
        └──────────────┼──────────────┘
                       ↓
              POSTING INSTRUCTION
                       ↓
                FINANCE KERNEL (F1-F4)
                       ↓
              IMMUTABLE TRUTH
```

**Phase 2 Intelligence Layers (ALLOWED):**
- C.2: Understand financial intent ✅
- C.3: Understand tenant COA ✅
- C.5: Understand MISA/SAP/FAST mapping ✅
- C.6: Understand financial context/intelligence ✅

**Kernel Boundary (FROZEN):**
- F1-F4: Receives posting instruction only ✅
- F1-F4: Does NOT interpret semantic/policy/intent ✅

---

## Part 1: Intent Definition

### What Is Accounting Intent?

**Definition:**
> **"Accounting Intent is the DECISION to recognize a financial event with specific accounting treatment, informed by business semantics and accounting policy, but NOT YET resolved to account codes."**

**Key Characteristics:**

**1. Intent Is a Decision (NOT passive observation):**
```
Business Event: "Customer pays 50M deposit"
    ↓
Bella DECIDES: Recognize as CUSTOMER_ADVANCE (liability)
    NOT: Recognize as REVENUE (premature)
    NOT: Do nothing (cash received but not recognized)
```

**2. Intent Is Informed by Policy (NOT policy itself):**
```
Policy says: "Recognize customer advances upon receipt"
    ↓
Intent: RECOGNIZE_CUSTOMER_ADVANCE
    (Bella executes policy decision)
    
Policy says: "Recognize revenue upon delivery"
    ↓
Intent: DO_NOT_RECOGNIZE_REVENUE_YET
    (Bella defers revenue recognition)
```

**3. Intent Is Semantic-Aware (NOT just semantic identity):**
```
Semantic: CUSTOMER_ADVANCE
    ↓
Intent: RECOGNIZE_CUSTOMER_ADVANCE + INCREASE_LIABILITY
    (Decision includes treatment direction: increase vs decrease)
```

**4. Intent Is Pre-Realization (NOT account-specific):**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
    ↓
Realization (C.3): Tenant COA → Account 331
    ↓
Posting Instruction: Dr 331, Cr 111
```

---

### Intent Lifecycle

**Complete Flow:**
```
BUSINESS EVENT
"Thanh toán trước cho nhà cung cấp 100 triệu"
    ↓
SEMANTIC IDENTIFICATION (Layer 2)
VENDOR_PREPAYMENT
    ↓
POLICY RESOLUTION (Layer 3)
TT99 / Policy v1.0
Recognition: UPON_PAYMENT
Measurement: HISTORICAL_COST
    ↓
ACCOUNTING INTENT (Layer 3.5 — NEW)
RECOGNIZE_VENDOR_PREPAYMENT
Amount: 100,000,000 VND
Direction: INCREASE_ASSET
Counter: DECREASE_CASH
    ↓
TENANT COA MAPPING (Layer 4)
VENDOR_PREPAYMENT → Account 3311 (Tenant B custom)
CASH → Account 1111
    ↓
POSTING INSTRUCTION (Layer 5)
Dr 3311: 100,000,000
Cr 1111: 100,000,000
    ↓
FINANCE KERNEL (F1-F4)
Validate: Balanced? ✅
Validate: Accounts exist? ✅
Validate: Tenant valid? ✅
Persist: Immutable ledger entry + context
```

---

## Part 2: Five Proof Tests

### Test 1: Intent ≠ Semantic ✅

**Claim:**
> "Accounting Intent is NOT the same as Canonical Semantic."

**Proof:**

**Semantic = WHAT (identity):**
```
Semantic: VENDOR_PREPAYMENT
Meaning: "Advance payment to supplier"
Stable: Regime-independent, vendor-independent
```

**Intent = HOW + WHEN (treatment decision):**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
Meaning: "Decide to record this as asset now"
Context-specific: Policy-dependent, timing-dependent
```

**Example 1: Same Semantic, Different Intent**
```
Business Event 1: Pay vendor 100M (goods not yet received)
    Semantic: VENDOR_PREPAYMENT
    Intent: RECOGNIZE_VENDOR_PREPAYMENT (now)
    
Business Event 2: Pay vendor 100M (goods received same day)
    Semantic: VENDOR_PREPAYMENT (technically)
    Intent: RECOGNIZE_INVENTORY + RECOGNIZE_PAYABLE_CLEARANCE
    (Different treatment: immediate expense/inventory, not prepayment asset)
```

**Example 2: Same Intent, Different Semantic**
```
Intent: RECOGNIZE_PREPAYMENT_ASSET

Can apply to:
    Semantic 1: VENDOR_PREPAYMENT (supplier advance)
    Semantic 2: PREPAID_EXPENSE (insurance prepayment)
    Semantic 3: LONG_TERM_DEPOSIT (refundable deposit)
    
Same intent (recognize as asset), different business meaning.
```

**Difference Table:**

| Aspect | Semantic | Intent |
|--------|----------|--------|
| **Nature** | Identity (WHAT) | Decision (HOW/WHEN) |
| **Stability** | Regime-independent | Policy-dependent |
| **Scope** | Business meaning | Accounting treatment |
| **Example** | VENDOR_PREPAYMENT | RECOGNIZE_VENDOR_PREPAYMENT |
| **Layer** | Layer 2 (Canonical) | Layer 3.5 (Intent) |

**✅ PROVEN: Intent ≠ Semantic**

---

### Test 2: Intent ≠ Policy ✅

**Claim:**
> "Accounting Intent is NOT the same as Accounting Policy."

**Proof:**

**Policy = RULES (configuration):**
```json
{
    "semantic": "VENDOR_PREPAYMENT",
    "recognition": {
        "trigger": "PAYMENT_COMPLETED",
        "timing": "UPON_PAYMENT"
    },
    "measurement": {
        "basis": "HISTORICAL_COST"
    }
}
```

**Intent = DECISION (execution of rules):**
```
Business Event: Payment completed (100M VND)
    ↓
Policy Evaluation:
    trigger = PAYMENT_COMPLETED? ✅
    timing = UPON_PAYMENT? ✅
    basis = HISTORICAL_COST? ✅
    ↓
Intent Generated:
    RECOGNIZE_VENDOR_PREPAYMENT
    amount = 100,000,000
    measurement = HISTORICAL_COST
    timestamp = 2026-08-16T10:30:00Z
```

**Policy vs Intent:**

| Aspect | Policy | Intent |
|--------|--------|--------|
| **Nature** | Rules/Configuration | Decision/Execution |
| **When** | Defined once | Generated per transaction |
| **Data** | JSONB/config data | Transaction-specific |
| **Example** | "Recognize upon payment" | "Recognize this payment now" |
| **Mutability** | Versioned, immutable after publish | Per-transaction, immutable after persist |

**Example: Policy Changes, Intent Execution Unchanged**
```
Policy v1.0 (2026):
    Recognition trigger: PAYMENT_COMPLETED
    
Transaction T1 (2026-05-15):
    Business Event: Payment completed
    Policy: v1.0
    Intent: RECOGNIZE_VENDOR_PREPAYMENT (v1.0 rule applied)

Policy v2.0 (2028):
    Recognition trigger: PAYMENT_APPROVED (changed)
    
Transaction T2 (2028-03-10):
    Business Event: Payment approved
    Policy: v2.0
    Intent: RECOGNIZE_VENDOR_PREPAYMENT (v2.0 rule applied)

Query T1 in 2030:
    Intent: Still RECOGNIZE_VENDOR_PREPAYMENT (v1.0 context)
    Policy: Still v1.0 (immutable)
```

**✅ PROVEN: Intent ≠ Policy (Intent = execution of policy rules)**

---

### Test 3: Intent ≠ Posting Instruction ✅

**Claim:**
> "Accounting Intent is NOT the same as Posting Instruction."

**Proof:**

**Intent = Pre-Realization (semantic-level):**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
    Amount: 100,000,000 VND
    Direction: INCREASE_ASSET
    Counter: DECREASE_CASH
```

**Posting Instruction = Post-Realization (account-level):**
```
Posting Instruction:
    Dr Account 3311: 100,000,000
    Cr Account 1111: 100,000,000
```

**Resolution Process:**
```
Intent (semantic)
    ↓
Tenant COA Mapping (C.3)
    VENDOR_PREPAYMENT → Account 3311
    CASH → Account 1111
    ↓
Posting Instruction (account codes)
```

**Why This Separation Matters:**

**Scenario 1: Same Intent, Different Tenant COA**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT (100M)

Tenant A (standard COA):
    Posting: Dr 331, Cr 111

Tenant B (custom COA):
    Posting: Dr 3311, Cr 1111

Tenant C (multi-entity):
    Posting: Dr 331.01, Cr 111.01

Same intent, different posting instructions.
```

**Scenario 2: Intent Rejected, No Posting**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
    ↓
Tenant COA Check: Account 331 NOT configured
    ↓
Result: Intent REJECTED (no posting instruction generated)
    ↓
User Notification: "Configure account for VENDOR_PREPAYMENT"
```

**Difference Table:**

| Aspect | Intent | Posting Instruction |
|--------|--------|---------------------|
| **Level** | Semantic-level | Account-level |
| **Tenant-specific** | No | Yes |
| **Account codes** | No | Yes (Dr/Cr) |
| **Resolution** | Before COA mapping | After COA mapping |
| **Example** | RECOGNIZE_VENDOR_PREPAYMENT | Dr 331, Cr 111 |

**✅ PROVEN: Intent ≠ Posting Instruction (Intent resolves TO posting via COA)**

---

### Test 4: Intent Does NOT Bypass Kernel ✅

**Claim:**
> "Accounting Intent cannot bypass Finance Kernel validation."

**Proof:**

**WRONG Architecture (Intent bypasses Kernel):**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
    ↓
Posting Instruction: Dr 331, Cr 111
    ↓
DIRECT WRITE to ledger ❌
    (bypasses Kernel validation)
```

**CORRECT Architecture (Intent goes through Kernel):**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
    ↓
Posting Instruction: Dr 331, Cr 111
    ↓
Submit to Finance Kernel
    ↓
Kernel Validation:
    Balanced? ✅
    Accounts exist? ✅
    Tenant valid? ✅
    Period open? ✅
    ↓
Kernel Persistence:
    Immutable ledger entry
    Context metadata
    Audit trail
```

**Test Case: Intent with Unbalanced Instruction**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
    ↓
Posting Instruction (BUG):
    Dr 331: 100,000,000
    Cr 111: 90,000,000  ❌ (unbalanced)
    ↓
Submit to Kernel
    ↓
Kernel Validation: FAILED (Σ Debit ≠ Σ Credit)
    ↓
Result: Transaction REJECTED
```

**Test Case: Intent for Non-Existent Account**
```
Intent: RECOGNIZE_VENDOR_PREPAYMENT
    ↓
Tenant COA Mapping:
    VENDOR_PREPAYMENT → Account 331 (NOT configured) ❌
    ↓
Posting Instruction: CANNOT GENERATE
    ↓
Result: Intent execution BLOCKED
```

**Kernel Boundary (Enforced):**
```
Intent Layer (C.2):
    Decides: What to recognize, when, how much
    Generates: Posting instruction (if COA configured)
    
Finance Kernel (F1-F4):
    Validates: Balanced entry, account existence, tenant validity
    Enforces: Immutability, audit trail, ledger invariants
    Does NOT: Know about intent, semantic, policy
```

**✅ PROVEN: Intent MUST go through Kernel (no bypass)**

---

### Test 5: Intent Does NOT Contain Legal Interpretation ✅

**Claim:**
> "Accounting Intent does not contain legal interpretation or accounting standard authority claims."

**Proof:**

**Intent = Execution of Configured Policy (NOT legal reasoning):**

**WRONG (Intent contains legal interpretation):**
```
Intent: {
    "action": "RECOGNIZE_VENDOR_PREPAYMENT",
    "legal_basis": "Theo TT99/2025 Điều 15, khoản này thuộc tài khoản 331",  ❌
    "vas_compliance": "VAS 01 paragraph 23 requires recognition",  ❌
    "reasoning": "Legal analysis shows this is prepayment"  ❌
}
```

**CORRECT (Intent executes policy, references context):**
```
Intent: {
    "action": "RECOGNIZE_VENDOR_PREPAYMENT",
    "amount": 100000000,
    "semantic": "VENDOR_PREPAYMENT",
    "policy_version": "v1.0",
    "policy_decision": "RECOGNIZE_UPON_PAYMENT",  ✅
    "tenant_id": "tenant_b"
}

Context (immutable):
    policy_id: "bella_tt99_v1.0"
    regime: "TT99"
    
Policy Configuration (data, external to Intent):
    {
        "semantic": "VENDOR_PREPAYMENT",
        "recognition": {"trigger": "PAYMENT_COMPLETED"},
        "authority_citation": "TT99/2025 Phụ lục II, TK 331"  ← Policy data, NOT Intent
    }
```

**Bella's Boundary:**

| Bella Decides | Bella Does NOT Decide |
|---------------|----------------------|
| ✅ Execute configured policy | ❌ Interpret VAS standards |
| ✅ Recognize financial event | ❌ Make legal judgments |
| ✅ Apply tenant-configured rules | ❌ Override tenant policy |
| ✅ Generate posting instruction | ❌ Claim "TT99 requires X" |
| ✅ Validate accounting structure | ❌ Replace legal counsel |

**Example: Edge Case Handling**
```
Business Event: Complex prepayment scenario (unclear classification)
    ↓
Semantic Resolution: AMBIGUOUS
    ↓
Policy Lookup: NO RULE CONFIGURED
    ↓
Intent Generation: BLOCKED
    ↓
User Notification:
    "Cannot generate accounting intent. 
     Reason: Policy not configured for this scenario.
     Action: Configure policy or seek accounting counsel."
    ↓
Result: NO INTENT GENERATED (Bella does not guess)
```

**✅ PROVEN: Intent does NOT contain legal interpretation**

---

## Part 3: Flow Architecture

### Complete Flow (Business Event → Kernel)

**Layer 1: Business Event**
```
Event: "Thanh toán trước cho nhà cung cấp 100M"
Data: {
    type: "vendor_payment",
    vendor_id: "V123",
    amount: 100000000,
    payment_date: "2026-08-16",
    goods_received: false
}
```

**Layer 2: Semantic Identification**
```
Business Event Analysis:
    Payment to vendor? ✅
    Goods received? ❌
    Future benefit? ✅
    ↓
Canonical Semantic: VENDOR_PREPAYMENT
```

**Layer 3: Policy Resolution**
```
Policy Lookup:
    Tenant: tenant_b
    Regime: TT99
    Policy Version: v1.0
    Semantic: VENDOR_PREPAYMENT
    ↓
Policy Rules:
    recognition.trigger: "PAYMENT_COMPLETED"
    recognition.timing: "UPON_PAYMENT"
    measurement.basis: "HISTORICAL_COST"
```

**Layer 3.5: Accounting Intent (NEW — C.2)**
```
Policy Evaluation:
    Payment completed? ✅
    Timing = UPON_PAYMENT? ✅
    Amount determinable? ✅
    ↓
Intent Generated:
    {
        "intent_id": "INT-2026-001",
        "action": "RECOGNIZE_VENDOR_PREPAYMENT",
        "semantic": "VENDOR_PREPAYMENT",
        "amount": 100000000,
        "currency": "VND",
        "direction": "INCREASE_ASSET",
        "counter_direction": "DECREASE_CASH",
        "policy_version": "v1.0",
        "regime": "TT99",
        "business_event_id": "BE-2026-001",
        "timestamp": "2026-08-16T10:30:00Z"
    }
```

**Layer 4: Tenant COA Mapping (C.3)**
```
COA Lookup:
    Tenant: tenant_b
    Semantic: VENDOR_PREPAYMENT → Account 3311 (custom)
    Semantic: CASH → Account 1111
    ↓
Realization:
    VENDOR_PREPAYMENT → 3311
    CASH → 1111
```

**Layer 5: Posting Instruction (C.2 generates)**
```
Posting Instruction:
    {
        "instruction_id": "POST-2026-001",
        "intent_id": "INT-2026-001",
        "lines": [
            {
                "account_id": 3311,
                "account_code": "3311",
                "debit": 100000000,
                "credit": 0,
                "memo": "Vendor prepayment - V123"
            },
            {
                "account_id": 1111,
                "account_code": "1111",
                "debit": 0,
                "credit": 100000000,
                "memo": "Cash payment"
            }
        ],
        "context": {
            "intent_id": "INT-2026-001",
            "semantic": "VENDOR_PREPAYMENT",
            "policy_version": "v1.0",
            "regime": "TT99"
        }
    }
```

**Layer 6: Finance Kernel (F1-F4)**
```
Kernel Validation:
    Σ Debit = Σ Credit? ✅ (100M = 100M)
    Accounts exist? ✅ (3311, 1111 configured)
    Tenant valid? ✅ (tenant_b)
    Period open? ✅ (2026-08)
    ↓
Kernel Persistence:
    INSERT INTO journal_entries (...)
    Context metadata stored
    Audit trail logged
    ↓
Result: Transaction T-2026-001 created ✅
```

---

### Decision Points in Flow

**Decision Point 1: Semantic Identification**
- **Who Decides:** Business Domain Logic (F2-F5 Product Verticals)
- **What Decided:** VENDOR_PREPAYMENT (vs INVENTORY, vs EXPENSE)
- **Bella's Role:** Receive semantic from business event

**Decision Point 2: Policy Application**
- **Who Decides:** Policy Resolver (C.2 engine)
- **What Decided:** Recognize now (vs defer, vs reject)
- **Bella's Role:** Execute configured policy rules

**Decision Point 3: Accounting Intent**
- **Who Decides:** Intent Generator (C.2 engine)
- **What Decided:** RECOGNIZE_VENDOR_PREPAYMENT with 100M amount
- **Bella's Role:** Generate intent from policy decision

**Decision Point 4: COA Realization**
- **Who Decides:** Tenant COA Mapper (C.3)
- **What Decided:** Account 3311 (vs 331, vs custom codes)
- **Bella's Role:** Resolve semantic → account per tenant config

**Decision Point 5: Posting Generation**
- **Who Decides:** Posting Instruction Generator (C.2/C.3)
- **What Decided:** Dr 3311, Cr 1111
- **Bella's Role:** Generate balanced posting from intent + COA

**Decision Point 6: Kernel Validation**
- **Who Decides:** Finance Kernel (F1-F4)
- **What Decided:** Accept (valid) or Reject (invalid)
- **Bella's Role:** Enforce ledger invariants, immutability

---

## Part 4: Decision Authority Matrix

### What Bella Decides (Allowed)

| Decision | Layer | Authority | Example |
|----------|-------|-----------|---------|
| **Execute configured policy** | C.2 | Policy Resolver | "Policy says recognize upon payment → Execute" |
| **Generate accounting intent** | C.2 | Intent Generator | "RECOGNIZE_VENDOR_PREPAYMENT with 100M" |
| **Resolve semantic → account** | C.3 | COA Mapper | "VENDOR_PREPAYMENT → Account 3311 (tenant config)" |
| **Generate posting instruction** | C.2/C.3 | Posting Generator | "Dr 3311, Cr 1111" |
| **Validate ledger structure** | F1-F4 | Kernel | "Σ Debit = Σ Credit? Account exists?" |
| **Block unresolved policy** | C.2 | Policy Guard | "No policy configured → Block intent generation" |

---

### What Bella Does NOT Decide (Prohibited)

| Decision | Who Decides | Bella's Role | Example |
|----------|-------------|--------------|---------|
| **Interpret VAS standards** | Legal Counsel / Accountant | Execute configured policy | "VAS 01 says X" ❌ |
| **Choose accounting policy** | Tenant / Chief Accountant | Execute chosen policy | "You should recognize upon delivery" ❌ |
| **Override tenant COA** | Tenant | Use tenant configuration | "Use account 242 instead of 3311" ❌ |
| **Make materiality judgments** | Chief Accountant | Execute configured thresholds | "This is immaterial, ignore" ❌ |
| **Legal compliance certification** | Legal Counsel / Auditor | Provide audit trail | "This complies with TT99" ❌ |
| **Business event classification** | Business Domain (F2-F5) | Receive semantic from domain | "This is revenue, not deposit" ❌ |

---

### Edge Case: Unresolved Policy

**Scenario:**
```
Business Event: Complex vendor prepayment (multi-year, foreign currency, conditional)
    ↓
Semantic: VENDOR_PREPAYMENT (basic identification)
    ↓
Policy Lookup: NO RULE for "multi-year + foreign currency + conditional"
    ↓
Bella Decision:
    Status: POLICY_UNRESOLVED
    Action: BLOCK intent generation
    Notification: "Cannot generate accounting intent. Reason: Policy not configured for this scenario."
    ↓
Tenant Action Required:
    Option 1: Configure policy for this scenario
    Option 2: Seek accounting counsel for classification
    Option 3: Manual journal entry with documentation
```

**Bella Does NOT:**
- ❌ Guess policy treatment
- ❌ Use "default" policy without tenant approval
- ❌ Make legal interpretation

**Bella DOES:**
- ✅ Block intent generation (safe)
- ✅ Notify user (transparent)
- ✅ Provide context for decision (auditable)

---

## Part 5: NOT Production Schema (Conceptual Only)

**Status:** 🔴 **SCHEMA DEFERRED** (pending PRIMARY verification)

**Why Conceptual Only:**
- Phase 2 = Architecture/design proof
- Production schema requires PRIMARY verification complete
- Accounting policy configuration requires legal counsel review

**Conceptual Intent Structure (Illustrative):**
```typescript
interface AccountingIntent {
    // Identity
    intent_id: string;
    tenant_id: string;
    business_event_id: string;
    
    // Decision
    action: IntentAction;  // RECOGNIZE_*, DERECOGNIZE_*, ADJUST_*, etc.
    semantic: CanonicalSemantic;
    amount: number;
    currency: string;
    direction: "INCREASE" | "DECREASE";
    
    // Context
    policy_version: string;
    regime_code: string;
    timestamp: DateTime;
    recorded_by: string;
    
    // Execution
    status: "PENDING" | "RESOLVED" | "POSTED" | "REJECTED";
    posting_instruction_id?: string;
    rejection_reason?: string;
}

interface PostingInstruction {
    instruction_id: string;
    intent_id: string;
    tenant_id: string;
    
    lines: PostingLine[];
    
    context: {
        intent_id: string;
        semantic: string;
        policy_version: string;
        regime: string;
    };
    
    status: "PENDING" | "VALIDATED" | "POSTED" | "REJECTED";
    kernel_transaction_id?: string;
}

interface PostingLine {
    account_id: number;
    account_code: string;
    debit: number;
    credit: number;
    memo: string;
}
```

**NOT Implemented Yet:**
- ❌ Production database tables
- ❌ JSONB schemas
- ❌ Posting Rules Engine code
- ❌ Intent Generator implementation

**Design Only:**
- ✅ Conceptual data structures
- ✅ Flow architecture
- ✅ Decision authority boundaries
- ✅ Five proof tests

---

## Conclusion

**C.2 Status:** ✅ **ARCHITECTURE PROOF COMPLETE**

**Five Proof Tests:**
1. ✅ Intent ≠ Semantic (PROVEN)
2. ✅ Intent ≠ Policy (PROVEN)
3. ✅ Intent ≠ Posting Instruction (PROVEN)
4. ✅ Intent does NOT bypass Kernel (PROVEN)
5. ✅ Intent does NOT contain legal interpretation (PROVEN)

**Key Definitions:**
- **Accounting Intent:** Decision to recognize financial event with specific treatment (pre-realization, post-policy)
- **Intent Layer:** Between Policy Resolution (Layer 3) and Posting Instruction (Layer 5)
- **Bella's Authority:** Execute configured policy, generate intent, resolve to posting (NOT interpret law)

**Three Invariants Protected:**
1. ✅ Semantic Independence (Intent ≠ Semantic, Kernel regime-agnostic)
2. ✅ Policy Independence (Intent executes policy data, Kernel unchanged)
3. ✅ Historical Integrity (Intent context immutable with transaction)

**Phase 2 Status:**
- ✅ C.2 Architecture: PROVEN
- 🔴 C.2 Production Schema: DEFERRED (pending PRIMARY)
- 🔴 C.2 Implementation: DEFERRED (post-PRIMARY)

**Next:**
- C.3: Tenant COA (schema design, pending PRIMARY for accounting policy)
- C.4: Reconciliation (can proceed, uses existing Kernel)
- C.5: Accounting Adapter (contract design)

---

**Document Status:** C.2 Accounting Intent Boundary PROVEN ✅  
**Decision Authority:** Execution (allowed), Interpretation (prohibited) ✅  
**Kernel Protection:** Intent MUST go through Kernel (no bypass) ✅  
**Production Status:** Architecture proven, schema/code deferred (PROVISIONAL) 🔴
