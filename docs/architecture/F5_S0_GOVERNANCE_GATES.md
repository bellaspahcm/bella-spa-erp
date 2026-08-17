# F5-S0 Governance Gates — Architectural Gate Protocol

> **Document ID:** F5-S0-GOV  
> **Date:** 2026-08-16  
> **Status:** 🔴 **ARCHITECTURAL GATE — Implementation BLOCKED**  
> **Authority:** Human Architect

---

## Executive Summary

F5-S0 Regulatory Agility Architecture establishes **Architectural Gate Protocol** before implementation.

**Key Principle:**
> **"Xác định Accounting Semantic Boundary trước, rồi mới implement Posting Engine."**

**Current Status:**
- F1-F4: 🔒 **FROZEN** (no changes)
- F5-S0.2 + F5-S0.3: 🟠 **Awaiting Architect Approval**
- A.3 + A.4: 🔴 **BLOCKED**
- C.2-C.6: 🔴 **BLOCKED**

**Red Line for Codex:**
> **"Không được tạo bất kỳ Posting Rule implementation nào dựa trên giả định TT99/TT133 trước khi A.3 + A.4 hoàn tất."**

---

## Four Governance Principles

### Principle 1: F1-F4 FROZEN ✅

**Statement:**
> **"F1–F4: giữ nguyên Freeze. Không quay lại sửa Ledger, Cash, AR, AP chỉ vì phát hiện Regulatory Agility."**

**Reasoning:**
- Regulatory Agility abstraction sits **ABOVE Finance Kernel**
- Kernel remains regime-agnostic (AR-010)
- No need to modify frozen F1-F4 contracts

**Frozen Components:**
```
F1 Accounting Engine ✅ FROZEN
    - Ledger, transactions, journal entries
    - Chart of accounts
    - Double-entry validation
    - No changes required

F2 Cash & Treasury ✅ FROZEN
    - Cash movements, bank accounts
    - F2 contract v2.5.0
    - No changes required

F3 Inventory & Procurement ✅ FROZEN
    - Inventory movements
    - No changes required

F4 Accounts Payable ✅ FROZEN
    - Vendor invoices, payments, prepayments
    - F4 contract v4.1.0
    - No changes required
```

**Prohibition:**
- ❌ No retroactive changes to F1-F4 schemas
- ❌ No modification of F1-F4 public contracts
- ❌ No changes to F1-F4 test suites

**Why This Works:**
> **"Đây là dấu hiệu abstraction mới nằm phía trên Kernel, không phá Kernel."**

---

### Principle 2: F5-S0 Is Architectural Gate, Not Implementation 🟠

**Statement:**
> **"F5-S0.2 + F5-S0.3 nên được xem là 'Architectural Gate', chưa phải implementation."**

**Correct Sequence:**
```
F5-S0 Constitutional Foundation
    ↓
Regime Versioning (F5-S0.2)
    ↓
Policy Versioning (F5-S0.3)
    ↓
Semantic Research (A.3)
    ↓
Posting Rule Model (A.4)
    ↓
Implementation (C.2-C.6)
```

**Prohibition:**
> **"Không đảo thứ tự."**

**Why Gate-First:**
- ✅ Establishes abstraction hierarchy before coding
- ✅ Prevents hard-coded assumptions
- ✅ Minimizes future migration risk
- ✅ Ensures Finance Kernel remains rule-agnostic

**Current Gate Status:**
- F5-S0.1: 🟡 Needs update (date, multi-regime authority)
- F5-S0.2: 🟠 **Awaiting Human Architect Approval**
- F5-S0.3: 🟠 **Awaiting Human Architect Approval**

---

### Principle 3: Three Critical Questions Are Most Important 🔴

**Statement:**
> **"Ba câu hỏi đỏ hiện tại chính là ba câu hỏi quan trọng nhất."**

**Why These Three:**
> **"Nếu trả lời được ba câu này, phần còn lại sẽ dễ hơn rất nhiều."**

---

#### Question 1: Semantic Equivalence 🔴

**Question:**
> **"Cùng 331 có thật sự cùng ý nghĩa giữa các regime không?"**

**Why Critical:**
```
If TT133 TK 331 = TT99 TK 331 (semantic equivalent):
    → F5.6 uses UNIFIED semantic adapter
    → Simpler implementation
    → Single accounting_semantic_registry entry

If TT133 TK 331 ≠ TT99 TK 331 (semantic different):
    → F5.6 needs REGIME-SPECIFIC adapters
    → More complex implementation
    → Separate accounting_semantic_registry entries per regime
```

**Evidence Required:**
- Access TT133/2016 Phụ lục II (Chart of Accounts)
- Extract TK 331: definition, normal balance, debit/credit semantics, reporting presentation
- Compare line-by-line with TT99/2025 TK 331
- Document equivalence or differences with legal citations

**Prohibition:**
> **"Không được giả định: same account code = same semantic."**

**Blocked:** Part A.3 research

---

#### Question 2: JSONB Boundary 🔴

**Question:**
> **"JSONB chỉ cấu hình hay được phép biểu đạt logic?"**

**Why Critical:**
> **"Nếu nhét toàn bộ logic kế toán vào JSONB thì vài năm sau nó có thể biến thành một 'mini programming language' không kiểm soát."**

**Must Define:**

| Category | Where Stored | Example |
|----------|--------------|---------|
| **Configuration Data** | JSONB | Account codes (331, 142, 111) |
| **Declarative Rules** | JSONB | "If inventory purchase → TK 156" |
| **Simple Conditions** | JSONB | "If prepayment > 0 → Current Asset" |
| **Complex Algorithms** | Application Code | Reconciliation, FX conversion |
| **Invariants** | DB Constraints | "Debit = Credit" |
| **Validation Logic** | Application Code | Vendor validation, amount validation |

**Prohibition: Cannot Store in JSONB**
- ❌ Complex reconciliation algorithms
- ❌ Temporal query logic (as_of resolution)
- ❌ Double-entry validation
- ❌ Foreign exchange conversion
- ❌ Multi-step workflows

**Allowed: Can Store in JSONB**
- ✅ Account code mappings
- ✅ Recognition criteria (textual description)
- ✅ Reporting presentation (balance sheet line)
- ✅ Conditional account selection (if-then rules)

**Design Principle:**
> **"JSONB stores data and declarative rules. Application code executes algorithms and invariants."**

**Blocked:** Part A.4 design

---

#### Question 3: Historical Transaction Context 🔴

**Question:**
> **"Transaction lưu regime + policy + rule snapshot thế nào để tái dựng lịch sử?"**

**Why Critical:**
```
Historical Reproducibility (G8 Requirement):
    Reconcile 2026 data in year 2031
    ↓
    MUST use 2026 regime + 2026 policy
    NOT 2031 current regime/policy
```

**Required Schema:**
```sql
ALTER TABLE finance_transactions
ADD COLUMN accounting_regime_code TEXT NOT NULL,
ADD COLUMN accounting_policy_version TEXT NOT NULL,
ADD COLUMN posting_rule_snapshot JSONB;  -- Immutable copy
```

**Prohibition:**
> **"Không được xảy ra: 2027 transaction → re-run bằng policy 2030 → ra kết quả khác."**

**Audit-Grade Test:**
```sql
-- Query: What regime/policy was used for this 2026 transaction?
SELECT
  ft.posted_at,
  ft.accounting_regime_code,
  ft.accounting_policy_version,
  ft.posting_rule_snapshot
FROM finance_transactions ft
WHERE ft.id = :transaction_id;

-- Must return:
-- regime: VN-TT99-2025
-- policy: 1.0.0
-- rules:  {"prepayment_recorded": {"debit_account": "331", ...}}

-- Even if current date is 2031 and policy is now v1.2.0
```

**Blocked:** Part A.4 design

---

### Principle 4: Avoid "Zero Migration Risk" Claims ⚠️

**Statement:**
> **"Đừng vội tuyên bố 'Zero migration risk'."**

**Correct Phrasing:**
> **"Designed to minimize future ledger migration risk."**

**Why:**
- TT133/TT99 semantic research incomplete
- Semantic model not yet locked
- Cannot commit "absolute zero" migration risk until research complete

**Honest Assessment:**
```
Current Status:
- Constitutional principles established ✅
- Abstraction hierarchy designed ✅
- Semantic research incomplete ❌
- Policy model incomplete ❌

Result:
- "Designed to minimize migration risk" ✅ HONEST
- "Zero migration risk" ❌ PREMATURE
```

**After A.3 + A.4 Complete:**
- Re-assess migration risk
- If semantic model locked correctly → Can claim "minimal migration risk"
- If issues discovered → Document migration scenarios

---

## Gate 1: Human Architect Review (CURRENT GATE)

### Gate 1 Status: 🟠 Awaiting Approval

**Documents to Review:**
1. `F5_0_2_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_REGIME_VERSIONING.md` (10,000 words)
2. `F5_0_3_CONSTITUTIONAL_AMENDMENT_ACCOUNTING_POLICY_VERSIONING.md` (9,000 words)
3. `F5_S0_REGULATORY_AGILITY_ARCHITECTURE.md` (5,000 words)
4. `F5_6_CRITICAL_CHECKPOINT_2026_08_16.md` (5,000 words)

**Review Focus:**
- AR-001 to AR-010 constitutional invariants
- Abstraction hierarchy (Regime → Policy → Rules → Kernel)
- Finance Kernel abstraction boundary (AR-010)

---

### Gate 1 Key Question (NOT Just "Is This Correct?")

**Standard Question (Insufficient):**
> "F5-S0.2 và F5-S0.3 có đúng không?"

**Correct Question (Architectural Depth):**
> **"Abstraction này có đủ để một thay đổi quy định kế toán trong tương lai được xử lý mà không thay đổi Finance Kernel và không làm mất khả năng tái dựng lịch sử hay không?"**

**If YES:**
- ✅ Approve F5-S0.2 + F5-S0.3
- ✅ Proceed to A.3 + A.4 research

**If NO:**
- ❌ Do NOT approve
- ❌ Document architectural concerns
- ❌ Iterate Constitution before coding
- ❌ Do NOT proceed to A.3 + A.4

---

### Gate 1 Pass Criteria

**Must Answer YES to ALL:**

1. **Historical Reproducibility:**
   - ✅ Can reconstruct 2026 transactions in year 2031?
   - ✅ Transaction stores regime + policy at posting time?
   - ✅ F5 reconciliation uses historical context, not current?

2. **Finance Kernel Isolation:**
   - ✅ Kernel does NOT know regime/policy rules?
   - ✅ Posting rules resolved BEFORE kernel?
   - ✅ No `if regime === 'TT99'` in kernel code?

3. **Future Regulation Changes:**
   - ✅ New regime (TT103/2030) → Add semantic registry, no kernel change?
   - ✅ Policy change within regime → New policy version, no kernel change?
   - ✅ Posting rule change → New rule version, no kernel change?

4. **Tenant Flexibility:**
   - ✅ Tenant A uses TT133, Tenant B uses TT99 → Both work?
   - ✅ Tenant switches TT133 → TT99 → Controlled transition + audit trail?

5. **Audit Compliance:**
   - ✅ Auditor can trace accounting context for any transaction?
   - ✅ Historical transactions immutable (AR-003, AR-007)?
   - ✅ Policy changes documented with authority + approval?

**If ANY answer is NO:**
- ❌ Gate 1 FAILED
- ❌ Fix Constitution before proceeding

---

## Red Line for Codex (Architectural Violation)

### Prohibition: Regime Logic in Finance Kernel ❌

**Red Line:**
> **"Không được tạo bất kỳ Posting Rule implementation nào dựa trên giả định TT99/TT133 trước khi A.3 + A.4 hoàn tất."**

**Prohibited Pattern (Architectural Violation):**

```typescript
// ❌ WRONG: Finance Kernel knows about regimes
class FinanceKernel {
  async postTransaction(event: BusinessEvent) {
    if (tenant.regime === 'TT99') {
      // TT99 posting logic
      await this.debitAccount('331', amount);
    } else if (tenant.regime === 'TT133') {
      // TT133 posting logic
      await this.debitAccount('142', amount);  // Different account
    }
  }
}
```

**Why WRONG:**
- ❌ Violates AR-010 (Finance Kernel Abstraction)
- ❌ Kernel knows regime-specific rules
- ❌ Regime change requires kernel modification
- ❌ Cannot add TT103/2030 without kernel change

---

### Correct Pattern (Architectural Compliance)

```typescript
// ✅ CORRECT: Posting Rule Resolver sits ABOVE kernel

class PostingRuleResolver {
  async resolve(event: BusinessEvent, tenant: Tenant, asOf: Date) {
    // Step 1: Resolve tenant regime at asOf
    const regime = await this.resolveRegime(tenant, asOf);
    
    // Step 2: Resolve policy at asOf
    const policy = await this.resolvePolicy(regime, 'VENDOR_PREPAYMENT_POSTING', asOf);
    
    // Step 3: Extract posting rule from policy
    const rule = policy.rules.prepayment_recorded;
    
    // Step 4: Return resolved instruction
    return {
      debitAccount: rule.debit_account,  // '331' or '142' from policy
      creditAccount: rule.credit_account,
      description: rule.description
    };
  }
}

class FinanceKernel {
  async postTransaction(instruction: PostingInstruction) {
    // Kernel receives RESOLVED instruction
    // Does NOT know: regime, policy, business logic
    // Only knows: debit this account, credit that account
    
    await this.debitAccount(instruction.debitAccount, instruction.amount);
    await this.creditAccount(instruction.creditAccount, instruction.amount);
  }
}

// Usage:
const event = { type: 'VENDOR_PREPAYMENT_RECORDED', amount: 100000000 };
const instruction = await postingRuleResolver.resolve(event, tenant, new Date());
await financeKernel.postTransaction(instruction);
```

**Why CORRECT:**
- ✅ Complies with AR-010
- ✅ Kernel does NOT know regime/policy
- ✅ Posting rules resolved BEFORE kernel
- ✅ Adding TT103/2030 → Only update resolver, kernel unchanged

---

### Red Line Enforcement

**If Codex generates code with prohibited pattern:**
- ❌ Reject immediately
- ❌ Label as "Architectural Violation"
- ❌ Do NOT merge to codebase
- ❌ Document violation for review

**Pattern Detection:**
```typescript
// Red flags in Finance Kernel:
- if (regime === ...)
- switch (regime) { ... }
- if (tenant.accountingRegime === ...)
- getRegimeSpecificRule()
- applyTT99Logic()
- applyTT133Logic()
```

**If ANY detected:**
- ❌ ARCHITECTURAL VIOLATION
- ❌ Rewrite using Posting Rule Resolver pattern

---

## Sequencing After Gate 1 Approval

### DO NOT Jump to C.2 Immediately ❌

**Wrong Sequence:**
```
Gate 1 Approval
    ↓
C.2 Posting Rules (immediate coding)  ❌ WRONG
```

**Correct Sequence:**
```
Gate 1 Approval ✅
    ↓
A.3 Semantic Research (TT133 vs TT99)
    ↓
A.4 Policy Model Design (JSONB boundary, transaction context)
    ↓
Architecture Review #2 (verify A.3 + A.4 conclusions)
    ↓
C.2 Posting Rules (with semantic model locked)
    ↓
Implementation (C.3-C.6)
```

**Why This Sequence:**
> **"Đây là kiểu 'chậm' rất đáng giá. Với Finance OS, một tuần khóa đúng semantic có thể tiết kiệm hàng tháng migration về sau."**

---

## Current Governance Status

### Component Status Matrix

| Component | Status | Gate | Approval Required |
|-----------|--------|------|-------------------|
| **F1 Ledger** | 🔒 FROZEN | N/A | NO (baseline) |
| **F2 Cash** | 🔒 FROZEN | N/A | NO (baseline) |
| **F3 Inventory** | 🔒 FROZEN | N/A | NO (baseline) |
| **F4 AP** | 🔒 FROZEN | N/A | NO (baseline) |
| **F5-S0.1** | 🟡 Needs Update | Gate 0 | YES (minor update) |
| **F5-S0.2** | 🟠 Awaiting Review | Gate 1 | **YES (CRITICAL)** |
| **F5-S0.3** | 🟠 Awaiting Review | Gate 1 | **YES (CRITICAL)** |
| **A.3 Research** | 🔴 BLOCKED | Gate 2 | YES (after Gate 1) |
| **A.4 Design** | 🔴 BLOCKED | Gate 3 | YES (after Gate 1) |
| **C.2 Posting Rules** | 🔴 BLOCKED | Gate 4 | NO (after Gate 2+3) |
| **C.3-C.6 Implementation** | 🔴 BLOCKED | Gate 5 | NO (after Gate 4) |
| **Ledger Implementation** | ❌ NO TOUCH | N/A | N/A |

---

### Gate Sequence

```
Gate 0: F5-S0.1 Update (minor) 🟡
    ↓
Gate 1: F5-S0.2 + F5-S0.3 Approval 🟠 CURRENT
    ↓
Gate 2: A.3 Semantic Research Completion 🔴
    ↓
Gate 3: A.4 Policy Model Completion 🔴
    ↓
Gate 4: Architecture Review #2 🔴
    ↓
Gate 5: C.2-C.6 Implementation 🔴
```

**Current Gate:** Gate 1 (F5-S0.2 + F5-S0.3 Approval)

---

## Governance Checklist for Human Architect

### Pre-Approval Checklist

**Before approving F5-S0.2 + F5-S0.3, verify:**

- [ ] **Historical Reproducibility:** Can reconstruct 2026 transactions in 2031?
- [ ] **Finance Kernel Isolation:** Kernel does NOT know regime/policy?
- [ ] **Future Regulation:** New regime/policy → No kernel change?
- [ ] **Tenant Flexibility:** Multiple regimes supported per tenant history?
- [ ] **Audit Compliance:** Transaction context immutable?
- [ ] **Red Line:** No regime logic in Finance Kernel allowed?
- [ ] **Sequencing:** A.3 + A.4 MUST complete before C.2?
- [ ] **Risk Assessment:** "Designed to minimize" not "zero" migration risk?

**If ALL checked:**
- ✅ Approve Gate 1
- ✅ Proceed to A.3 + A.4

**If ANY unchecked:**
- ❌ Do NOT approve
- ❌ Document concerns
- ❌ Iterate Constitution

---

## Conclusion

**F5-S0 Governance Gates establish Architectural Gate Protocol** before F5.6 implementation.

**Four Governance Principles:**
1. F1-F4 FROZEN (abstraction above kernel)
2. F5-S0 is Architectural Gate, not implementation
3. Three critical questions most important
4. Avoid "zero migration risk" claims (honest assessment)

**Red Line for Codex:**
> No regime logic in Finance Kernel. Posting Rule Resolver pattern required.

**Current Status:**
- Gate 1: 🟠 Awaiting Human Architect Approval
- Implementation: 🔴 BLOCKED until Gate 1 + A.3 + A.4

**Key Quote:**
> **"Với Finance OS, một tuần khóa đúng semantic có thể tiết kiệm hàng tháng migration về sau."**

---

**Status:** 🟠 **GATE 1 PENDING — Awaiting Human Architect Review**

**Critical Question:** "Abstraction này có đủ để xử lý thay đổi quy định tương lai mà không thay đổi Finance Kernel và không làm mất khả năng tái dựng lịch sử không?"

**Approval Required:** YES (Gate 1)
