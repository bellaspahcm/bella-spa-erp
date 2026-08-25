# PHASE 3.1 — `posted_at` FORENSIC INVESTIGATION

**Date:** 2026-08-24  
**Status:** ✅ COMPLETE  
**Mode:** READ-ONLY EVIDENCE GATHERING

---

## EXECUTIVE SUMMARY

**Objective:** Understand current `posted_at` semantic in F1 transactions through evidence, not inference.

**Key Finding:** `posted_at` has **ambiguous semantic** — no formal contract definition exists. Current usage mixes multiple temporal concepts without clear boundaries.

**Evidence Classification:**
- ✅ Schema definition: CLEAR
- ✅ Lifecycle pattern: CLEAR
- ⚠️ Semantic meaning: AMBIGUOUS
- ⚠️ Business authority: INCONSISTENT
- ❌ Contract documentation: MISSING

---

## INVESTIGATION FINDINGS

### 1. Schema Definition

**Source:** `supabase/migrations/20260815000000_finance_kernel_v1.sql`

```sql
CREATE TABLE public.finance_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL,
    source_type VARCHAR(255) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'VOIDED')),
    transaction_type VARCHAR(20) NOT NULL,
    accounting_period_id UUID NOT NULL,
    posted_at TIMESTAMPTZ,  -- ← NULLABLE, no constraints, no comments
    -- ...
);
```

**Facts:**
- **Type:** `TIMESTAMPTZ` (timestamp with timezone)
- **Nullability:** `NULL` allowed
- **Constraints:** NONE (no immutability trigger, no CHECK constraints)
- **Comments:** NONE (no semantic documentation in schema)
- **Indexes:** NONE (not indexed separately)

**Interpretation:**
- Can be NULL (likely when status = 'DRAFT')
- Can be updated after initial INSERT
- No database-level protection against modification
- No formal semantic definition in DDL

---

### 2. Lifecycle Pattern

**Evidence:** Test code analysis (`src/__tests__/f5-*.test.ts`)

**Pattern A: DRAFT → POSTED Workflow (Most Common)**

```typescript
// Step 1: INSERT as DRAFT with posted_at = null
const { error: txErr } = await supabase.from('finance_transactions').insert({
  id: txId,
  tenant_id: testTenantId,
  status: 'DRAFT',
  posted_at: null,  // ← NULL when DRAFT
  // ... other fields
});

// Step 2: INSERT transaction lines
await supabase.from('finance_transaction_lines').insert([...]);

// Step 3: UPDATE to POSTED with posted_at = timestamp
await supabase.from('finance_transactions')
  .update({ 
    status: 'POSTED', 
    posted_at: '2026-08-15T12:00:00Z'  // ← Set when POSTED
  })
  .eq('id', txId);
```

**Pattern B: Direct POSTED Creation (Less Common)**

```typescript
// Single INSERT with status='POSTED' and posted_at set
await supabase.from('finance_transactions').insert({
  status: 'POSTED',
  posted_at: new Date('2026-08-18T00:00:00Z'),
  // ...
});
```

**Facts:**
- **DRAFT status:** `posted_at = null`
- **POSTED status:** `posted_at = <timestamp>`
- **State transition:** DRAFT → (add lines) → POSTED (set posted_at)
- **Authority:** Application code (no database trigger manages this)

**Interpretation:**
- `posted_at` represents "when transaction became POSTED in the ledger"
- NOT necessarily the business event date
- NOT necessarily the accounting recognition date
- Possibly system posting timestamp

---

### 3. Contract Interface

**Source:** `src/platform/finance/contracts/ledger-engine.contract.ts`

```typescript
export interface PostTransactionRequest {
  tenant_id: string;
  idempotency_key: string;
  source_type: string;
  source_id: string;
  transaction_type: TransactionType;
  posted_at: Date;  // ← REQUIRED, but NO COMMENT explaining semantic
  transaction_currency: CurrencyCode;
  functional_currency: CurrencyCode;
  // ...
}
```

**Facts:**
- `posted_at` is **REQUIRED** parameter (not optional)
- **NO comment** explaining what it represents
- **NO validation** on value (can be past, present, future)
- Caller must supply the value (no default)

**Interpretation:**
- Caller decides posted_at value
- No guidance on semantic ("business date? accounting date? system time?")
- Contract assumes caller knows the meaning (dangerous assumption)

---

### 4. F5 Contract Usage

**Source:** `supabase/migrations/20260819010000_f5_read_contracts.sql`

```sql
CREATE OR REPLACE FUNCTION public.finance_journal_entries_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT
)
-- ...
-- Comment: "Effective date basis: posting_date = finance_transactions.posted_at (F1 canonical)"
-- ...
BEGIN
    -- Return journal lines from POSTED transactions only
    -- Effective date basis: finance_transactions.posted_at (= posting_date)
    -- Filter: posted_at <= p_as_of (records effective BEFORE or AT the boundary)
    RETURN QUERY
    SELECT
        ft.id                   AS transaction_id,
        ftl.id                  AS journal_line_id,
        ftl.account_id          AS account_id,
        fa.code                 AS account_code,
        -- ...
        ft.posted_at            AS posting_date,  -- ← Used as temporal filter
        -- ...
    FROM finance_transactions ft
    -- ...
    WHERE ft.tenant_id = p_tenant_id
      AND ft.status = 'POSTED'
      AND ft.posted_at <= p_as_of  -- ← Temporal boundary
    -- ...
END;
```

**Facts:**
- F5 uses `posted_at` as "effective date" for temporal queries
- Filter: `posted_at <= as_of` determines which transactions are visible
- Called "posting_date" in F5 contract
- Described as "F1 canonical" temporal authority

**Interpretation:**
- F5 treats `posted_at` as **accounting effective date**
- Transactions with `posted_at > as_of` are "future" and not included
- This semantic implies `posted_at` should be **business/accounting date**, not system timestamp
- Critical for financial reporting: "Show me books as of 2026-08-31"

---

### 5. F2 Cash Temporal Authority

**Source:** `supabase/migrations/20260824000000_f2_cash_effective_date.sql`

```sql
-- Backfill effective_date from finance_transactions.posted_at
-- This establishes the F1 → F2 temporal lineage (INV-F2-T1)
-- Authority: F1.posted_at (business/accounting date)
UPDATE public.finance_cash_movements fcm
SET effective_date = ft.posted_at
FROM public.finance_transactions ft
WHERE fcm.f1_transaction_id = ft.id
  AND fcm.tenant_id = ft.tenant_id;
```

**Comment in Code:**
```sql
COMMENT ON COLUMN public.finance_cash_movements.effective_date IS
    'F2 Cash Temporal Contract v1.2: Business effective date (accounting date / Vietnamese "ngày hạch toán"). '
    'Sourced from f1_transaction.posted_at. Immutable after INSERT. Used for temporal as_of queries. '
    'INV-F2-T1: effective_date = f1_transaction.posted_at at projection time.';
```

**Facts:**
- Migration claims: `posted_at` = "business/accounting date"
- F2 `effective_date` is copied from F1 `posted_at`
- Comment explicitly mentions Vietnamese "ngày hạch toán" (accounting date)
- F2 uses this for temporal queries

**Interpretation:**
- **Critical claim:** `posted_at` represents **accounting date**
- This is the ONLY place in codebase that documents this semantic
- If true, `posted_at` should NOT be system timestamp
- If false, F2 temporal authority is based on wrong semantic

---

### 6. Source Event Timestamp Mapping

**Evidence:** Test code analysis

**Pattern 1: Invoice → F1 Mapping**

```typescript
// Source: src/__tests__/f5-ar-reconciliation.integration.test.ts
async function seedFinalizedInvoiceWithGl(opts: {
  issuedAt: string;  // ISO date string, used as posting_date
  // ...
}) {
  // Step 1: Create invoice with issue_date
  await supabase.from('finance_invoices').insert({
    issue_date: opts.issuedAt.split('T')[0],  // DATE field
    // ...
  });
  
  // Step 2: Create F1 transaction
  await supabase.from('finance_transactions').insert({
    status: 'DRAFT',
    posted_at: null,
    // ...
  });
  
  // Step 3: Mark as POSTED with issuedAt
  await supabase.from('finance_transactions')
    .update({ 
      status: 'POSTED', 
      posted_at: opts.issuedAt  // ← invoice.issue_date becomes F1.posted_at
    });
}
```

**Pattern 2: Manual Test Data**

```typescript
// Hardcoded timestamps in tests
await supabase.from('finance_transactions')
  .update({ 
    status: 'POSTED', 
    posted_at: '2026-08-15T12:00:00Z'  // ← Arbitrary test timestamp
  });
```

**Facts:**
- **Invoice source:** `issue_date` (DATE) → `posted_at` (TIMESTAMPTZ)
- **Test data:** Hardcoded ISO timestamps
- **Production:** NO evidence found (no Workers/services creating F1 in production code)

**Interpretation:**
- Current mapping: `invoice.issue_date` → `F1.posted_at`
- This suggests `posted_at` = **document date** (when invoice was issued)
- Conflicting with F2 claim that `posted_at` = **accounting date**
- No evidence of "system posting timestamp" semantic

---

### 7. Schema: Business Documents

**Invoice Schema:**

```sql
-- Source: supabase/migrations/20260817000000_finance_ar_engine_v1.sql
CREATE TABLE public.finance_invoices (
    id                          UUID PRIMARY KEY,
    tenant_id                   UUID NOT NULL,
    invoice_number              VARCHAR(50) NOT NULL,
    status                      VARCHAR(20) NOT NULL,
    issue_date                  DATE NOT NULL,      -- ← Document date
    due_date                    DATE NOT NULL,      -- ← Payment deadline
    currency                    VARCHAR(10) NOT NULL,
    total_invoice_amount_minor  BIGINT NOT NULL,
    f1_transaction_id           UUID UNIQUE,        -- ← Link to F1
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Facts:**
- `issue_date`: **DATE** (no time component)
- `created_at`: **TIMESTAMPTZ** (system timestamp)
- `f1_transaction_id`: Links invoice to F1 transaction

**Interpretation:**
- **Document date:** `issue_date` (business event date)
- **System timestamp:** `created_at` (when record was created)
- F1 should ideally separate these concepts, but currently mixes them into single `posted_at`

---

### 8. Immutability Status

**Evidence:** Schema analysis + trigger search

**Findings:**
- ❌ NO immutability trigger on `finance_transactions`
- ❌ NO CHECK constraint on `posted_at`
- ❌ NO application-level validation preventing updates
- ✅ F2 `effective_date` HAS immutability trigger (cannot change after INSERT)

**Query Result:**
```sql
-- Searched for: CREATE TRIGGER.*finance_transactions.*immutability
-- Result: No matches found
```

**Facts:**
- `posted_at` can be updated via `UPDATE` statement
- No database protection against modification
- Application code could change `posted_at` after POSTED

**Interpretation:**
- **Current state:** `posted_at` is MUTABLE
- **Risk:** Temporal integrity can be violated (change posted_at → breaks F5 temporal queries)
- **Contrast:** F2 `effective_date` is IMMUTABLE (correctly protected)
- **Gap:** If `posted_at` = accounting date (per F2 claim), it should be immutable

---

## SEMANTIC AMBIGUITY ANALYSIS

### Current Usage Patterns

| Usage Context | Semantic Interpretation | Evidence |
|---------------|-------------------------|----------|
| **Schema DDL** | Undefined (no comment) | Migration file has no comment on `posted_at` |
| **Contract Interface** | Undefined (no comment) | `PostTransactionRequest.posted_at` has no documentation |
| **F5 Temporal Filter** | "Accounting effective date" | Used as temporal boundary: `posted_at <= as_of` |
| **F2 Migration** | "Business/accounting date" | Explicitly claims `posted_at` = "ngày hạch toán" |
| **Test Data** | "Document issue date" | Maps `invoice.issue_date` → `F1.posted_at` |
| **Lifecycle** | "Ledger posting timestamp" | Set when status changes DRAFT → POSTED |

**Conflicting Interpretations:**

1. **F5 + F2 Claim:** `posted_at` = **accounting date** (when transaction is recognized in books)
2. **Test Mapping:** `posted_at` = **document date** (when invoice was issued)
3. **Lifecycle Pattern:** `posted_at` = **system posting timestamp** (when ledger entry was created)

---

### The 3-Date Problem

**Vietnamese Accounting (TT99/VAS) Requires 3 Distinct Dates:**

```
Business Document
      ↓
Ngày chứng từ (Document Date)
   = When business event occurred
   = Invoice issue date, payment date, contract date
   = Immutable (printed on document)

      ↓
Ngày hạch toán (Accounting Date)
   = When transaction is recognized in accounting books
   = May differ from document date (accrual accounting)
   = Can be adjusted by accountant (period correction)

      ↓
Thời điểm ghi sổ (Posting Timestamp)
   = When entry was recorded in system
   = System audit timestamp
   = Immutable (audit trail)
```

**Current Finance OS:**

```
F1 Transaction
      ↓
posted_at (TIMESTAMPTZ)
   = ??? (undefined)
   = Used as "accounting effective date" by F5
   = Claimed as "business/accounting date" by F2
   = Mapped from "document date" in tests
   = Set as "posting timestamp" in lifecycle
```

**Problem:** **One field trying to serve three distinct purposes.**

---

## F1 PRODUCER INVENTORY

**Current F1 Transaction Creators:**

### Production Code
- **LedgerService.postTransaction()** — accepts `posted_at` from caller
- **NO Workers found** — no production code creating F1 autonomously
- **NO RPC direct calls found** — F1 creation goes through LedgerService

### Test Code (F1 Creation Patterns)
- `f5-ar-reconciliation.integration.test.ts` — maps `invoice.issue_date` → `posted_at`
- `f5-hardening.integration.test.ts` — uses `opts.postedAt` parameter
- `f5-reconciliation.integration.test.ts` — hardcoded timestamps
- `finance-f2-*.test.ts` — hardcoded timestamps
- `finance-f1-concurrency.test.ts` — hardcoded timestamps

**Key Observation:** 
- **ALL F1 creation goes through `PostTransactionRequest`**
- **Caller supplies `posted_at` value**
- **No business event → posted_at mapping logic exists**

**Implication:**
- Adding `document_date` and `accounting_date` requires:
  1. Extending `PostTransactionRequest` interface
  2. Updating all F1 producers (currently only test code)
  3. Mapping business events → 3 dates explicitly

---

## CURRENT SEMANTIC AUTHORITY: UNKNOWN

### What `posted_at` Currently Represents

**Evidence-Based Assessment:**

| Question | Answer | Confidence |
|----------|--------|------------|
| Is `posted_at` the document date? | UNCLEAR | LOW |
| Is `posted_at` the accounting date? | CLAIMED (F2 migration) | MEDIUM |
| Is `posted_at` the system posting timestamp? | POSSIBLE (lifecycle pattern) | MEDIUM |
| Can `posted_at` be in the past? | YES (test evidence) | HIGH |
| Can `posted_at` be in the future? | UNKNOWN (no validation) | N/A |
| Is `posted_at` immutable? | NO (no trigger) | HIGH |
| Who decides `posted_at` value? | CALLER (via PostTransactionRequest) | HIGH |

**Classification:** 🔴 **SEMANTIC AUTHORITY UNKNOWN**

**Risk Level:** 🔴 **HIGH**

**Impact:**
- F5 temporal queries may be using wrong date
- F2 cash movements inherit ambiguous temporal authority
- Accounting period determination is undefined
- TT99/VAS compliance cannot be verified

---

## CRITICAL GAPS IDENTIFIED

### Gap 1: No Formal Semantic Contract

**Issue:** `posted_at` has no documented meaning

**Evidence:**
- Schema: no column comment
- Contract: no interface comment
- Code: no constant/type defining semantic

**Impact:**
- Developers guess what `posted_at` means
- Inconsistent usage across modules
- Cannot verify correctness

### Gap 2: Conflicting Usage Patterns

**Issue:** Different modules interpret `posted_at` differently

**Evidence:**
- F5: treats as "accounting effective date"
- F2: claims as "business/accounting date"
- Tests: maps from "document issue date"
- Lifecycle: suggests "posting timestamp"

**Impact:**
- Temporal queries may be wrong
- Financial reports may be incorrect
- Cannot trust as_of filtering

### Gap 3: Missing Document Date

**Issue:** No field for "when business event occurred"

**Evidence:**
- Invoice has `issue_date` (DATE)
- F1 has only `posted_at` (TIMESTAMPTZ)
- No field for "document date" in F1

**Impact:**
- Cannot distinguish document date from accounting date
- Cannot handle accrual accounting properly
- Cannot satisfy TT99 "ngày chứng từ" requirement

### Gap 4: Missing Accounting Date

**Issue:** No explicit field for "which accounting period"

**Evidence:**
- F2 claims `posted_at` = accounting date
- No separate `accounting_date` field
- Accountant cannot adjust recognition period

**Impact:**
- Cannot handle period adjustments
- Cannot implement accrual/matching principle
- Cannot satisfy TT99 "ngày hạch toán" requirement

### Gap 5: Mutable Temporal Authority

**Issue:** `posted_at` can be changed after POSTED

**Evidence:**
- No immutability trigger
- No application validation
- F2 `effective_date` IS immutable (inconsistency)

**Impact:**
- Temporal integrity can be violated
- F5 queries can return inconsistent results
- Audit trail unreliable

---

## RECOMMENDATIONS FOR PHASE 3.2

### 1. Define 3-Date Semantic Contract

**Required:**
- `document_date`: When business event occurred (immutable)
- `accounting_date`: Which accounting period (adjustable by accountant?)
- `posted_at`: When ledger entry was created (immutable system timestamp)

### 2. Map TT99/VAS Requirements

**Required:**
- Verify which Finance OS date satisfies "ngày chứng từ"
- Verify which Finance OS date satisfies "ngày hạch toán"
- Verify if "thời điểm ghi sổ" is needed for audit

### 3. Design Nullability Strategy

**Options:**
- **Option A:** All 3 dates NOT NULL (simple, rigid)
- **Option B:** NULL allowed for DRAFT, required for POSTED (flexible)
- **Option C:** `document_date` NOT NULL, `accounting_date` NULL initially (hybrid)

### 4. Design Immutability Strategy

**Questions:**
- Should `posted_at` become immutable?
- Should `document_date` be immutable? (likely YES)
- Should `accounting_date` be immutable? (TBD — accountant adjustment?)

### 5. Design Backfill Policy

**Critical:** Current `posted_at` values are ambiguous

**Options:**
- **Provable:** If source event exists, map deterministically
- **Inferable:** If pattern matches, apply policy
- **Unknowable:** Leave NULL or flag as UNVERIFIED

---

## CONCLUSION

### Current State: AMBIGUOUS

`posted_at` in Finance OS F1 transactions has **no formal semantic definition** and is used inconsistently across modules:

- **F5** treats it as accounting effective date
- **F2** claims it as business/accounting date  
- **Tests** map it from document issue date
- **Lifecycle** suggests posting timestamp

This ambiguity creates **HIGH RISK** for:
- Incorrect financial reporting
- Invalid temporal queries
- TT99/VAS non-compliance
- Audit trail unreliability

### Required Action: PHASE 3.2

Design formal 3-date semantic contract:
1. `document_date` (business event date)
2. `accounting_date` (recognition period)
3. `posted_at` (system posting timestamp)

Map to TT99/VAS requirements, determine nullability, design immutability rules, and create evidence-based backfill policy.

**Gate:** Phase 3.2 cannot proceed without resolving this semantic ambiguity.

---

**Report Generated:** 2026-08-24  
**Investigation Phase:** 3.1 COMPLETE  
**Next Phase:** 3.2 — Design 3-Date Semantic Contract  
**Human Architect Review:** REQUIRED before Phase 3.2
