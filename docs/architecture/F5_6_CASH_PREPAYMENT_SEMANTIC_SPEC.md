# F5.6 Cash + Prepayment GL Balance — Semantic Specification

> **Status:** 🔴 INCOMPLETE — Requires Human Architect decisions on 4 open items  
> **Phase:** F5.6 Pre-Coding Semantic Design Gate  
> **Dependency:** F5.5 AR_GL_BALANCE FROZEN ✅  
> **Purpose:** Define financial semantics BEFORE AI coding begins

---

## Document Purpose

This document establishes the **authoritative financial semantics** for F5.6 Cash + Prepayment reconciliation domains.

**Core Principle:**
```
Code can be AI-generated.
Financial semantics cannot be AI-invented.
```

This specification MUST be complete and approved by Human Architect before any F5.6 implementation code is written.

---

## Specification Status Summary

| Item | Cash Domain | Prepayment Domain | Status |
|------|-------------|-------------------|--------|
| **Public Contract** | F2_CONTRACT.md | F4_CONTRACT.md | ✅ FOUND |
| **Source Facts Table** | `finance_cash_movements` | `finance_vendor_prepayments` | ✅ IDENTIFIED |
| **GL Account Mapping** | ❌ UNDEFINED | ❌ UNDEFINED | 🔴 BLOCKED |
| **Reconstruction Formula** | ❌ UNDEFINED | ❌ UNDEFINED | 🔴 BLOCKED |
| **Temporal Boundary** | ❌ NOT VERIFIED | ❌ NOT VERIFIED | 🔴 BLOCKED |
| **Normal Balance Type** | ❌ UNDEFINED | ❌ UNDEFINED | 🔴 BLOCKED |

**Overall Status:** 🔴 **BLOCKED** — 4/6 items incomplete

---

## Part A: CASH_GL_BALANCE Domain Specification

### A.1 Source Contract ✅ FOUND

**Contract:** F2 Cash & Treasury Engine  
**Document:** `docs/architecture/frozen/F2_CONTRACT.md`  
**Version:** `F2.5.0`  
**Frozen:** 2026-08-15

**Public Read API:**
```typescript
interface ICashReportingEngine {
  getCashPosition(tenantId: string, bankAccountId: string): Promise<CashPosition>;
  getCashMovements(req: QueryMovementsRequest): Promise<CashMovement[]>;
}
```

**Key Contract Commitments:**
- Cash movements are immutable (F2-I-2)
- Position = Σ movements (F2-I-3)
- Tenant isolation enforced (F2-I-4)
- Idempotent projection (F2-I-5)

### A.2 Source Facts Table ✅ IDENTIFIED

**Table:** `finance_cash_movements`  
**Schema:** `supabase/migrations/20260816000000_finance_cash_engine_v1.sql`

**Key Fields:**
```sql
CREATE TABLE finance_cash_movements (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    bank_account_id UUID NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('INFLOW', 'OUTFLOW')),
    amount_minor NUMERIC(20,0) CHECK (amount_minor > 0),
    currency VARCHAR(10),
    functional_amount_minor NUMERIC(20,0),
    functional_currency VARCHAR(10),
    f1_transaction_id UUID NOT NULL,
    cash_leg_reference VARCHAR(100),
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    ...
);
```

**Immutability:** Protected by `finance_cash_mutation_guard` trigger (F2-I-2)

### A.3 GL Account Mapping 🔴 UNDEFINED

**Question:** How does F5.6 determine which F1 GL account to reconcile against for a given bank account?

**Known Relationship:**
```
finance_bank_accounts.linked_finance_account_id → finance_accounts.id (F1)
```

**Options:**

**Option 1:** Use `linked_finance_account_id` directly
```sql
-- Bank account → GL account mapping
SELECT fa.id, fa.account_code
FROM finance_bank_accounts ba
JOIN finance_accounts fa ON fa.id = ba.linked_finance_account_id
WHERE ba.id = <bank_account_id>;
```

**Option 2:** Hardcoded account code pattern
```sql
-- Match by account code pattern (e.g., 111x series)
WHERE account_code LIKE '111%'
```

**Option 3:** Configurable mapping table
```sql
-- Separate mapping table
finance_cash_gl_mappings (bank_account_id → gl_account_id)
```

**⚠️ DECISION REQUIRED:**
- [ ] Which mapping strategy is authoritative?
- [ ] Is `linked_finance_account_id` always populated?
- [ ] What if `linked_finance_account_id` is NULL?
- [ ] Can one bank account map to multiple GL accounts?

**Current Status:** 🔴 **BLOCKED** — Human Architect must specify mapping strategy

### A.4 Reconstruction Formula 🔴 UNDEFINED

**Question:** How does F5.6 compute expected cash position from F2 movements?

**Proposed Formula (from F2-I-3 invariant):**
```sql
cash_position.balance_minor = 
    SUM(CASE 
        WHEN direction = 'INFLOW' THEN amount_minor 
        WHEN direction = 'OUTFLOW' THEN -amount_minor 
    END)
FROM finance_cash_movements
WHERE tenant_id = ? 
  AND bank_account_id = ?
```

**Questions:**
- [ ] Does F5.6 use `amount_minor` or `functional_amount_minor`?
- [ ] Should reconstruction filter by `recorded_at <= reconciliation_as_of`?
- [ ] Are there any movement `source_type` values to exclude (e.g., reversals)?
- [ ] Should reconstruction match `f5_reconstruct_cash_positions` RPC logic exactly?

**Reference Implementation:** 
- F2 has `finance_reconstruct_cash_positions` RPC
- Should F5.6 call this RPC or reimplement logic?

**⚠️ DECISION REQUIRED:**
- [ ] Confirm reconstruction formula
- [ ] Specify currency handling (local vs functional)
- [ ] Define temporal filtering rules

**Current Status:** 🔴 **BLOCKED** — Formula needs Human Architect approval

### A.5 GL Normal Balance Type 🔴 UNDEFINED

**Question:** Is cash account DEBIT-normal or CREDIT-normal?

**Expected:** Cash is an ASSET account → DEBIT-normal

**GL Reconciliation Formula (if DEBIT-normal):**
```sql
gl_balance = SUM(debit_amount) - SUM(credit_amount)
FROM finance_journal_entries_as_of(...)
WHERE account_code = <cash_account_code>
```

**Variance Detection:**
```sql
variance = gl_balance - f2_cash_position.balance_minor
```

**Questions:**
- [ ] Confirm cash accounts are DEBIT-normal (like AR account 131)
- [ ] Are there any CREDIT-normal cash accounts (e.g., overdraft facilities)?
- [ ] How to handle negative balances (overdraft)?

**⚠️ DECISION REQUIRED:**
- [ ] Confirm normal balance type
- [ ] Define sign convention for GL reconciliation

**Current Status:** 🔴 **BLOCKED** — Normal balance type must be confirmed

### A.6 Temporal Boundary 🔴 NOT VERIFIED

**Question:** Which timestamp column determines `as_of` boundary for cash movements?

**Candidate Columns:**
- `recorded_at` — When movement was recorded in F2
- `created_at` — Row creation timestamp
- `f1_transaction.posted_at` — When source F1 transaction posted

**Proposed Rule:**
```sql
-- Cash movements visible in as_of snapshot
SELECT * FROM finance_cash_movements
WHERE recorded_at <= <reconciliation_as_of>
```

**Questions:**
- [ ] Is `recorded_at` the authoritative temporal column?
- [ ] Should F5.6 use `recorded_at` or `f1_transaction.posted_at`?
- [ ] How to handle clock skew between F1 and F2?
- [ ] Does F2 guarantee `recorded_at >= f1_transaction.posted_at`?

**F2 Contract Reference:**
- F2 events are `posted_at` based
- F2 movements use `recorded_at` for indexing

**⚠️ DECISION REQUIRED:**
- [ ] Confirm temporal boundary column
- [ ] Verify temporal ordering guarantees
- [ ] Define edge case handling (same millisecond events)

**Current Status:** 🔴 **BLOCKED** — Temporal semantics must be verified

---

## Part B: PREPAYMENT_GL_BALANCE Domain Specification

### B.1 Source Contract ✅ FOUND

**Contract:** F4 Accounts Payable Engine  
**Document:** `docs/architecture/frozen/F4_CONTRACT.md`  
**Version:** `F4.1.0`  
**Frozen:** 2026-08-16

**Public RPC Contracts:**
```sql
finance_record_prepayment(...)    -- Creates PREPAYMENT_RECORDED
finance_apply_prepayment(...)     -- Creates PREPAYMENT_APPLIED
-- PREPAYMENT_REFUNDED also exists (from schema)
```

**Public Read API:**
```sql
finance_calculate_payable_position(...)
-- Returns: {gross_payable, unapplied_prepayment, net_vendor_exposure}
```

### B.2 Source Facts Table ✅ IDENTIFIED

**Table:** `finance_vendor_prepayments`  
**Schema:** `supabase/migrations/20260818000000_finance_ap_engine_v1.sql`

**Key Fields:**
```sql
CREATE TABLE finance_vendor_prepayments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    fact_type VARCHAR(30) CHECK (fact_type IN (
        'PREPAYMENT_RECORDED',
        'PREPAYMENT_APPLIED',
        'PREPAYMENT_REFUNDED'
    )),
    amount_minor BIGINT CHECK (amount_minor > 0),
    posting_attempt_id UUID NOT NULL,
    f1_transaction_id UUID NOT NULL,
    matched_vendor_bill_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL,
    ...
);
```

**Idempotency:** `UNIQUE (tenant_id, posting_attempt_id)`

### B.3 GL Clearing Account 🔴 UNDEFINED

**Question:** Which F1 GL account holds vendor prepayment balances?

**Context:**
- Vendor prepayment is typically an ASSET (advance payment to vendor)
- When applied to bill, reduces AP liability

**Possible GL Accounts:**
- `141` — Prepaid Expenses (asset)
- `132` — Vendor Deposits (asset)
- `331PP` — AP Prepayment Clearing (contra-liability)
- Other?

**Questions:**
- [ ] Which GL account code is authoritative for prepayments?
- [ ] Is it an ASSET (debit-normal) or CONTRA-LIABILITY (credit-normal)?
- [ ] Can prepayments span multiple GL accounts?
- [ ] Is mapping per-tenant or system-wide?

**⚠️ DECISION REQUIRED:**
- [ ] Specify GL clearing account code
- [ ] Confirm account normal balance type
- [ ] Define mapping mechanism

**Current Status:** 🔴 **BLOCKED** — GL account must be specified

### B.4 Reconstruction Formula 🔴 UNDEFINED

**Question:** How does F5.6 compute net unapplied prepayment from F4 facts?

**Proposed Formula (from F4 semantics):**
```sql
net_unapplied_prepayment = 
    SUM(CASE fact_type
        WHEN 'PREPAYMENT_RECORDED' THEN amount_minor
        WHEN 'PREPAYMENT_APPLIED' THEN -amount_minor
        WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor
    END)
FROM finance_vendor_prepayments
WHERE tenant_id = ?
  AND vendor_id = ?  -- Per vendor or aggregate?
```

**Questions:**
- [ ] Should F5.6 reconcile per-vendor or aggregate all vendors?
- [ ] Does formula match `finance_calculate_payable_position` RPC?
- [ ] Should F5.6 call F4 RPC or reimplement logic?
- [ ] Are there any `fact_type` values to exclude?
- [ ] How to handle partially applied prepayments?

**Reference Implementation:**
- F4 has `finance_calculate_payable_position` RPC
- Returns `unapplied_prepayment_minor` field

**⚠️ DECISION REQUIRED:**
- [ ] Confirm reconstruction formula
- [ ] Specify aggregation level (per-vendor vs total)
- [ ] Define matching GL aggregation

**Current Status:** 🔴 **BLOCKED** — Formula needs Human Architect approval

### B.5 GL Normal Balance Type 🔴 UNDEFINED

**Question:** Is prepayment clearing account DEBIT-normal or CREDIT-normal?

**Expected (if prepayment is ASSET):**
- ASSET account → DEBIT-normal
- GL balance = SUM(debit) - SUM(credit)

**Expected (if prepayment is CONTRA-LIABILITY):**
- CONTRA-LIABILITY → CREDIT-normal?
- GL balance = SUM(credit) - SUM(debit)

**Variance Detection:**
```sql
-- If DEBIT-normal (asset)
variance = gl_balance - net_unapplied_prepayment

-- If CREDIT-normal (contra-liability)
variance = net_unapplied_prepayment - gl_balance
```

**Questions:**
- [ ] Confirm prepayment account normal balance type
- [ ] Is it consistent with AP account 331 (CREDIT-normal)?
- [ ] How does prepayment application affect GL entries?

**⚠️ DECISION REQUIRED:**
- [ ] Confirm normal balance type
- [ ] Define sign convention for GL reconciliation

**Current Status:** 🔴 **BLOCKED** — Normal balance type must be confirmed

### B.6 Temporal Boundary 🔴 NOT VERIFIED

**Question:** Which timestamp column determines `as_of` boundary for prepayment facts?

**Candidate Columns:**
- `created_at` — Fact creation timestamp
- `f1_transaction.posted_at` — When prepayment posted to GL

**Proposed Rule:**
```sql
-- Prepayment facts visible in as_of snapshot
SELECT * FROM finance_vendor_prepayments
WHERE created_at <= <reconciliation_as_of>
```

**Questions:**
- [ ] Is `created_at` the authoritative temporal column?
- [ ] Should F5.6 use `created_at` or `f1_transaction.posted_at`?
- [ ] How to handle clock skew between F4 and F1?
- [ ] Does F4 guarantee `created_at >= f1_transaction.posted_at`?

**⚠️ DECISION REQUIRED:**
- [ ] Confirm temporal boundary column
- [ ] Verify temporal ordering guarantees

**Current Status:** 🔴 **BLOCKED** — Temporal semantics must be verified

---

## Part C: Cross-Cutting Concerns

### C.1 F4 Permission Discrepancy 🟡 NEEDS AUDIT

**Issue Found:** F4_CONTRACT.md shows conflicting permission information.

**Contract Document States:**
| Function | authenticated | service_role |
|----------|---------------|--------------|
| `finance_record_prepayment` | EXECUTE | EXECUTE |
| `finance_apply_prepayment` | EXECUTE | EXECUTE |

**But Freeze Description Says:**
> "Restricted to `service_role` and admin users"

**Questions:**
- [ ] Is `authenticated` role actually granted EXECUTE?
- [ ] Is this a documentation error or actual permission grant?
- [ ] Should F5.6 enforce stricter permission checks?

**Security Implication:**
If `authenticated` can call `finance_record_prepayment`, any logged-in user can create prepayment facts. This may be intentional (e.g., vendor portal) or a security gap.

**⚠️ AUDIT REQUIRED:**
- [ ] Verify actual database grants
- [ ] Resolve documentation vs implementation discrepancy
- [ ] Document intended permission model for F5.6

**Current Status:** 🟡 **NEEDS AUDIT** — Not blocking F5.6 but should be resolved

### C.2 Temporal Contract Alignment

**Question:** Do F2/F4 temporal contracts align with F1 temporal contract?

**F1 Contract (from F5.5):**
- `finance_journal_entries_as_of(p_tenant_id, p_as_of, 'F1_GL:v1')`
- Uses `posted_at` for temporal filtering

**F2 Contract:**
- Cash movements indexed by `recorded_at`
- Events delivered with `posted_at` from F1

**F4 Contract:**
- Prepayment facts use `created_at`
- Linked to F1 transaction via `f1_transaction_id`

**Alignment Check:**
```
F1 posted_at → F2 recorded_at → Same snapshot?
F1 posted_at → F4 created_at → Same snapshot?
```

**Questions:**
- [ ] Is `recorded_at` always >= `posted_at`?
- [ ] Is `created_at` always >= `posted_at`?
- [ ] What is maximum clock skew tolerance?
- [ ] How to handle edge cases (same millisecond)?

**⚠️ DECISION REQUIRED:**
- [ ] Document temporal ordering guarantees
- [ ] Define reconciliation `as_of` semantics across F1/F2/F4

---

## Part D: F5.6 Implementation Roadmap (Conditional on Spec Completion)

**⚠️ This section is INFORMATIONAL ONLY. No implementation may begin until Parts A-C are 100% complete.**

### D.1 CASH_GL_BALANCE Implementation Sequence

**Prerequisites:**
- ✅ A.3 GL account mapping strategy approved
- ✅ A.4 Reconstruction formula approved
- ✅ A.5 Normal balance type confirmed
- ✅ A.6 Temporal boundary verified

**Implementation Steps:**
1. Create `finance_cash_facts_as_of()` temporal contract (F2 extension)
2. Create `f5_reconstruct_cash_position()` function
3. Add CASH_GL_BALANCE branch to `f5_run_reconciliation()`
4. Write integration tests (G1–G8)
5. Create proof docs (`proof-cash-g1` through `proof-cash-g8`)
6. Verify AP + AR regression (16/16 tests remain green)

### D.2 PREPAYMENT_GL_BALANCE Implementation Sequence

**Prerequisites:**
- ✅ B.3 GL clearing account specified
- ✅ B.4 Reconstruction formula approved
- ✅ B.5 Normal balance type confirmed
- ✅ B.6 Temporal boundary verified

**Implementation Steps:**
1. Create `finance_prepayment_facts_as_of()` temporal contract (F4 extension)
2. Create `f5_reconstruct_prepayment_position()` function
3. Add PREPAYMENT_GL_BALANCE branch to `f5_run_reconciliation()`
4. Write integration tests (G1–G8)
5. Create proof docs (`proof-pp-g1` through `proof-pp-g8`)
6. Verify AP + AR + Cash regression (24/24 tests remain green)

### D.3 Gate Verification Requirements

Each domain MUST pass all 8 constitutional gates:

| Gate | Cash | Prepayment |
|------|------|------------|
| **G1** Namespace Boundary | ❌ PENDING | ❌ PENDING |
| **G2** Determinism | ❌ PENDING | ❌ PENDING |
| **G3** Bidirectional Trace | ❌ PENDING | ❌ PENDING |
| **G4** Reconstruction | ❌ PENDING | ❌ PENDING |
| **G5** Immutability | ❌ PENDING | ❌ PENDING |
| **G6** Idempotency | ❌ PENDING | ❌ PENDING |
| **G7** Read Boundary | ❌ PENDING | ❌ PENDING |
| **G8** Temporal Determinism | ❌ PENDING | ❌ PENDING |

**F5.6 cannot be declared complete until:**
- Cash: 8/8 gates PASS
- Prepayment: 8/8 gates PASS
- AP regression: 8/8 PASS (F5.1–F5.4)
- AR regression: 8/8 PASS (F5.5)
- Total: 32/32 tests PASS

---

## Part E: Approval Workflow

### E.1 Specification Completion Checklist

**Before F5.6 coding may begin, Human Architect must complete:**

**Cash Domain:**
- [ ] A.3: Define GL account mapping strategy
- [ ] A.4: Approve reconstruction formula
- [ ] A.5: Confirm normal balance type (DEBIT/CREDIT)
- [ ] A.6: Verify temporal boundary column

**Prepayment Domain:**
- [ ] B.3: Specify GL clearing account code
- [ ] B.4: Approve reconstruction formula
- [ ] B.5: Confirm normal balance type (DEBIT/CREDIT)
- [ ] B.6: Verify temporal boundary column

**Cross-Cutting:**
- [ ] C.1: Resolve F4 permission discrepancy
- [ ] C.2: Document temporal alignment across F1/F2/F4

### E.2 Approval Sign-Off

**Status:** 🔴 **NOT APPROVED** — Specification incomplete

**Human Architect Sign-Off Required:**

```
I hereby approve this F5.6 semantic specification as the authoritative
definition of Cash + Prepayment reconciliation financial semantics.

All open items (A.3, A.4, A.5, A.6, B.3, B.4, B.5, B.6, C.1, C.2) have
been resolved and documented in this specification.

AI coding may proceed with F5.6 implementation.

Signed: ___________________________
Date: _____________________________
```

---

## Part F: Known Risks & Mitigations

### F.1 Risk: Incorrect GL Account Mapping

**Risk:** F5.6 reconciles against wrong GL account → false MATCHED results

**Severity:** HIGH — Silent data quality failure

**Mitigation:**
- Require explicit Human Architect approval of mapping strategy
- Add runtime validation: verify GL account exists before reconciliation
- Include GL account code in proof documentation

### F.2 Risk: Sign Convention Error

**Risk:** Cash or prepayment uses wrong normal balance type (DEBIT vs CREDIT)

**Severity:** CRITICAL — Inverted variance signs

**Mitigation:**
- Add explicit sign convention proof test (like F5.5 test 5.2 for AR)
- Require test case showing actual=10M (not -10M) for DEBIT-normal
- Document expected sign in proof files

### F.3 Risk: Temporal Boundary Inconsistency

**Risk:** F2/F4 temporal filtering differs from F1 → time leakage

**Severity:** HIGH — G8 temporal determinism violation

**Mitigation:**
- Verify temporal ordering guarantees across F1/F2/F4
- Add adversarial test: reconcile as_of T0, insert fact at T1, verify not visible
- Document temporal alignment in specification

### F.4 Risk: F4 Permission Discrepancy

**Risk:** Unintended permission grant allows unauthorized prepayment creation

**Severity:** MEDIUM — Security boundary violation

**Mitigation:**
- Audit actual database grants vs documentation
- Document intended permission model
- Add RLS test for prepayment facts

---

## Part G: Next Steps

**Current State:** F5.6 semantic specification 40% complete (2/6 items defined)

**Immediate Actions:**
1. Human Architect reviews this specification
2. Human Architect resolves 4 open items (A.3, A.4, A.5, A.6 for Cash; B.3, B.4, B.5, B.6 for Prepayment)
3. Human Architect audits F4 permission discrepancy (C.1)
4. Human Architect documents temporal alignment (C.2)
5. Human Architect signs approval (E.2)
6. **Only then:** AI coding begins F5.6 implementation

**Blocked Until:** Human Architect completes specification

**Estimated Time:** Architecture review + decisions (4-8 hours of Human Architect time)

---

## Conclusion

```
┌──────────────────────────────────────────────────────────────┐
│  F5.6 CASH + PREPAYMENT SEMANTIC SPECIFICATION               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Status: 🔴 INCOMPLETE (40% complete)                        │
│                                                              │
│  Completed:                                                  │
│  ✅ Source contracts identified (F2 + F4)                   │
│  ✅ Source fact tables identified                           │
│                                                              │
│  Blocked:                                                    │
│  ❌ GL account mappings undefined                           │
│  ❌ Reconstruction formulas unapproved                      │
│  ❌ Normal balance types unconfirmed                        │
│  ❌ Temporal boundaries unverified                          │
│                                                              │
│  Audit Required:                                             │
│  🟡 F4 permission discrepancy                               │
│  🟡 Temporal alignment across F1/F2/F4                      │
│                                                              │
│  🚫 NO AI CODING UNTIL SPECIFICATION 100% COMPLETE          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**This specification enforces the F5 Pre-Coding Gate Protocol:**

> "Code can be AI-generated.  
>  Financial semantics cannot be AI-invented."

F5.6 implementation is **correctly BLOCKED** pending Human Architect decisions.

