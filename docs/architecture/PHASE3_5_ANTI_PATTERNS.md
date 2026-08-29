# Phase 3.5: Backfill Anti-Patterns

**Status:** ✅ COMPLETE  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Purpose:** Document FORBIDDEN backfill patterns to prevent semantic contamination

---

## Executive Summary

This document explicitly documents **FORBIDDEN backfill patterns** that violate the core principle **"Provenance Over Convenience"**.

**These patterns are architecturally prohibited** and must not be implemented, even if they simplify backfill execution or achieve NOT NULL constraints.

**Governance Principle:**
> Preserving semantic correctness > Achieving database completeness

**Core Rule:** If provenance is insufficient, **preserve NULL** or **require manual review**. Do NOT invent dates.

---

## Anti-Pattern Index

| ID | Anti-Pattern | Severity | Why Forbidden |
|----|--------------|----------|---------------|
| **AP-1** | posted_at as document_date fallback | 🔴 CRITICAL | Ambiguous semantic, violates provenance principle |
| **AP-2** | posted_at as accounting_date fallback | 🔴 CRITICAL | Ambiguous semantic, violates provenance principle |
| **AP-3** | COALESCE cascade for convenience | 🔴 CRITICAL | Invents dates without evidence |
| **AP-4** | F2.effective_date as provenance source | 🔴 CRITICAL | Circular logic (inherited from ambiguous posted_at) |
| **AP-5** | created_at as business date fallback | 🟡 HIGH | System metadata, not business event date |
| **AP-6** | Backfill without metadata flags | 🟡 HIGH | Loses audit trail of provenance strength |
| **AP-7** | Single universal backfill rule | 🟡 HIGH | Ignores source-type-specific semantics |
| **AP-8** | Blind INFERABLE without policy documentation | 🟠 MEDIUM | Loses reasoning for inference |
| **AP-9** | Test data treated as production | 🟠 MEDIUM | Contaminates semantic with arbitrary test values |
| **AP-10** | Backfill before NOT NULL constraint | 🟢 LOW | Creates temporal window for NULL insertion |

---

## AP-1: posted_at as document_date Fallback (🔴 CRITICAL)

### Anti-Pattern Code

```sql
-- ❌ FORBIDDEN
UPDATE finance_transactions
SET document_date = COALESCE(
    document_date,
    posted_at::date  -- Fallback to posted_at if document_date NULL
);
```

### Why Forbidden

**Reason 1: Ambiguous Semantic**

Task 5 forensic analysis found `posted_at` has **INCONSISTENT semantic**:
- Test code: Caller-provided business date (backdated)
- Migration M1: Assumed "business/accounting date"
- Phase 3.2 design: System timestamp (POSTED lifecycle transition)

**Using posted_at as document_date inherits this ambiguity.**

**Reason 2: Violates "Provenance Over Convenience"**

```
posted_at (ambiguous)
    ↓ Fallback (convenience)
document_date
    ↓ Result
FALSE PROVENANCE (appears provable, actually unknown)
```

**Reason 3: Test Data Contamination**

25% of F1 records are test data with **arbitrary backdated posted_at values** for test scenarios. Using these as document_date would corrupt backfill semantic.

### Evidence from Phase 3.5

From `PHASE3_5_POSTED_AT_SEMANTIC_FORENSIC.md`:

> **Verdict:** `posted_at` has **NO CONSISTENT SEMANTIC** across historical data.
>
> **Backfill Decision:** posted_at CANNOT be used as INFERABLE fallback for `document_date` or `accounting_date`.

### Correct Approach

```sql
-- ✅ CORRECT: Preserve NULL if no provenance
UPDATE finance_transactions
SET 
    document_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'No provenance source available'
WHERE document_date IS NULL
  AND source_type NOT IN (
      SELECT DISTINCT source_type 
      FROM provenance_mapping 
      WHERE document_date_source IS NOT NULL
  );
```

**Alternative:** Require manual review for records without provenance.

---

## AP-2: posted_at as accounting_date Fallback (🔴 CRITICAL)

### Anti-Pattern Code

```sql
-- ❌ FORBIDDEN
UPDATE finance_transactions
SET accounting_date = COALESCE(
    accounting_date,
    posted_at::date  -- Fallback to posted_at
);
```

### Why Forbidden

**Same reasons as AP-1**, PLUS:

**Reason 4: accounting_date Has Distinct Semantic**

Per Phase 3.2 3-date contract:
- `accounting_date`: **Recognition period date** (determines accounting period, affects P&L)
- `posted_at`: **System timestamp** (when lifecycle transitioned to POSTED)

**These are NOT equivalent.** Using posted_at as accounting_date violates TT99 "Ngày hạch toán" semantic.

**Reason 5: TT99 Compliance Risk**

From Phase 3.3 TT99 mapping:
- **Ngày hạch toán** (accounting_date) determines which accounting period the transaction belongs to
- Must respect period closing rules
- **Cannot be system timestamp** (must be business/accounting decision)

### Evidence from Phase 3.5

From `PHASE3_5_ACCOUNTING_DATE_PROVENANCE.md`:

> **accounting_date has ZERO PROVABLE sources** in current Finance OS. All 675 records require policy-based inference.
>
> **Classification:** 100% INFERABLE or UNKNOWABLE (no PROVABLE).

### Correct Approach

```sql
-- ✅ CORRECT: Use accounting policy (cash basis example)
UPDATE finance_transactions
SET 
    accounting_date = document_date,  -- Policy-based inference
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date'
WHERE accounting_date IS NULL
  AND document_date IS NOT NULL
  AND source_type IN ('F3_AR_INVOICE', 'SALES_ORDER');  -- Source-type-specific
```

**Prerequisite:** Human Architect confirms cash basis accounting policy.

---

## AP-3: COALESCE Cascade for Convenience (🔴 CRITICAL)

### Anti-Pattern Code

```sql
-- ❌ FORBIDDEN: Convenience fallback chain
UPDATE finance_transactions
SET document_date = COALESCE(
    document_date,
    accounting_date,
    posted_at::date,
    created_at::date,
    CURRENT_DATE  -- Ultimate fallback
);
```

### Why Forbidden

**Reason 1: Multi-Level Semantic Contamination**

Each fallback level introduces ambiguity:
1. `accounting_date` → May differ from document_date (accrual accounting)
2. `posted_at` → Ambiguous (AP-1)
3. `created_at` → System metadata, not business date (AP-5)
4. `CURRENT_DATE` → Migration date, not transaction date

**Result:** Invented date with NO connection to business event.

**Reason 2: Loses Provenance Classification**

After COALESCE cascade:
- Cannot distinguish PROVABLE from INFERABLE from INVENTED
- No audit trail of which fallback was used
- Impossible to validate semantic correctness

**Reason 3: Violates Core Principle**

From Phase 3.5 summary:

> "Không được backfill chỉ vì muốn làm đầy dữ liệu."
>
> **No provenance → No backfill.**

### Evidence from Phase 3.5

From user message (Phase 3.5 approval):

> Không được có policy kiểu:
>
> ```sql
> accounting_date = COALESCE(
>     accounting_date,
>     document_date,
>     posted_at,
>     created_at
> );
> ```
>
> chỉ để đạt NOT NULL. Đó sẽ đi ngược hoàn toàn nguyên tắc: **Provenance Over Convenience**.

### Correct Approach

```sql
-- ✅ CORRECT: Source-type-specific with explicit classification
UPDATE finance_transactions f1
SET 
    document_date = CASE 
        WHEN f1.source_type = 'F3_AR_INVOICE' THEN (
            SELECT fi.issue_date 
            FROM finance_invoices fi 
            WHERE fi.id = f1.source_id::uuid 
              AND fi.tenant_id = f1.tenant_id
        )
        -- Add other PROVABLE/INFERABLE sources explicitly
        ELSE NULL  -- Preserve NULL if no provenance
    END,
    backfill_classification = CASE 
        WHEN f1.source_type = 'F3_AR_INVOICE' THEN 'PROVABLE'
        ELSE 'UNKNOWABLE'
    END;
```

---

## AP-4: F2.effective_date as Provenance Source (🔴 CRITICAL)

### Anti-Pattern Code

```sql
-- ❌ FORBIDDEN: Use F2.effective_date for F1 backfill
UPDATE finance_transactions f1
SET 
    document_date = f2.effective_date::date,
    accounting_date = f2.effective_date::date
FROM finance_cash_movements f2
WHERE f1.source_type = 'F2_CASH'
  AND f2.transaction_id = f1.id;
```

### Why Forbidden

**Reason 1: Circular Provenance Logic**

Migration M1 backfilled `F2.effective_date` FROM `F1.posted_at`:

```sql
-- From 20260824000000_f2_cash_effective_date.sql
UPDATE public.finance_cash_movements fcm
SET effective_date = ft.posted_at  -- ❌ F2 inherited from F1
FROM public.finance_transactions ft
WHERE fcm.f1_transaction_id = ft.id;
```

**Result:**
```
F1.posted_at (ambiguous)
    ↓ Migration M1
F2.effective_date
    ↓ AP-4 (FORBIDDEN)
F1.document_date / F1.accounting_date
    ↓ Circular logic
```

**This creates a provenance loop with NO independent source.**

**Reason 2: Task 5 Finding**

From `PHASE3_5_POSTED_AT_SEMANTIC_FORENSIC.md`:

> **F2.effective_date Provenance:**
> - **Source:** F1.posted_at (100% by migration backfill)
> - **Independent provenance:** NONE (all auto-copied)
> - **Manual overrides:** 0%
> - **Classification:** UNKNOWABLE (inherited ambiguous semantic)

**Reason 3: F2_CASH Must Be UNKNOWABLE**

From Task 7 source-type rules:

> **F2_CASH (67 records, 10%):**
> - **document_date:** UNKNOWABLE
> - **accounting_date:** UNKNOWABLE
> - **Reason:** F2.effective_date has NO independent provenance

### Evidence from Phase 3.5

From `PHASE3_5_SOURCE_TYPE_BACKFILL_RULES.md`:

> **Circular Provenance Problem:**
> ```
> F1.posted_at (ambiguous)
>     ↓ (Migration M1)
> F2.effective_date
>     ↓ (Cannot use as provenance for)
> F1.document_date / F1.accounting_date
>     ↓ (Would create circular logic)
> ```

### Correct Approach

```sql
-- ✅ CORRECT: Preserve NULL for F2_CASH (Option A)
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance (effective_date inherited from ambiguous posted_at)'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```

**Alternative:** Option C (manual review required).

**DO NOT use Option B** (posted_at with risk flag) unless Human Architect explicitly approves after business context review.

---

## AP-5: created_at as Business Date Fallback (🟡 HIGH)

### Anti-Pattern Code

```sql
-- ❌ AVOID: Use created_at as document_date fallback
UPDATE finance_transactions
SET document_date = COALESCE(
    document_date,
    created_at::date  -- System metadata, not business date
);
```

### Why Avoided

**Reason 1: created_at Is System Metadata**

`created_at` represents:
- **When the database row was created**
- NOT when the business event occurred
- NOT when the document was issued

**Semantic mismatch.**

**Reason 2: Temporal Drift**

Business events often occur BEFORE system recording:
- Invoice issued on 2024-12-28 (document_date)
- Row created on 2024-12-30 (created_at)

**Using created_at as document_date introduces 2-day error.**

**Reason 3: Test Data Contamination**

Test data is often created in batches:
- All test records have created_at = batch creation date
- BUT business logic tests different date scenarios
- Using created_at loses test date diversity

### When It Might Be Acceptable

**Only if:**
1. Human Architect explicitly approves
2. Source type has NO other provenance (UNKNOWABLE)
3. Records are flagged with `backfill_classification = 'INFERABLE'` and explicit reason
4. Semantic drift is documented and accepted

**Example (with explicit flag):**
```sql
-- ⚠️ USE WITH CAUTION (requires Human Architect approval)
UPDATE finance_transactions
SET 
    document_date = created_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'created_at',
    backfill_reason = 'Last resort: no provenance, used created_at with known temporal drift risk'
WHERE document_date IS NULL
  AND backfill_classification = 'UNKNOWABLE'
  AND source_type IN ('MANUAL_ENTRY');  -- Specific source types only
```

### Correct Approach

```sql
-- ✅ CORRECT: Preserve NULL if no business date provenance
UPDATE finance_transactions
SET 
    document_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'No business date provenance (created_at is system metadata)'
WHERE document_date IS NULL
  AND source_type NOT IN (SELECT DISTINCT source_type FROM provenance_mapping);
```

---

## AP-6: Backfill Without Metadata Flags (🟡 HIGH)

### Anti-Pattern Code

```sql
-- ❌ AVOID: Backfill without audit trail
UPDATE finance_transactions
SET document_date = some_inferred_value
WHERE document_date IS NULL;
-- No backfill_inferred, backfill_classification, etc.
```

### Why Avoided

**Reason 1: Loses Provenance Audit Trail**

After backfill, cannot distinguish:
- PROVABLE (direct field mapping)
- INFERABLE (policy-based)
- Manually set (before migration)

**All appear as "just a date" in database.**

**Reason 2: Cannot Validate Correctness**

Without metadata:
- Cannot verify backfill policy was applied correctly
- Cannot identify records that need re-review
- Cannot track semantic drift over time

**Reason 3: Compliance Risk**

TT99 requires audit trail:
- Who set the accounting_date?
- Was it system-generated or manually entered?
- What was the reasoning?

**Without metadata, cannot demonstrate compliance.**

### Correct Approach

```sql
-- ✅ CORRECT: Always include backfill metadata
UPDATE finance_transactions
SET 
    document_date = <provenance_value>,
    backfill_inferred = TRUE,  -- or FALSE if PROVABLE
    backfill_classification = 'INFERABLE',  -- or 'PROVABLE', 'UNKNOWABLE'
    backfill_source = 'source_table.column or policy description',
    backfill_reason = 'Human-readable explanation'
WHERE document_date IS NULL
  AND <backfill_condition>;
```

**Required Metadata Schema:**
```sql
ALTER TABLE finance_transactions
ADD COLUMN IF NOT EXISTS backfill_inferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_classification TEXT CHECK (
    backfill_classification IN ('PROVABLE', 'INFERABLE', 'UNKNOWABLE', 'MANUAL_REVIEW_REQUIRED')
),
ADD COLUMN IF NOT EXISTS backfill_source TEXT,
ADD COLUMN IF NOT EXISTS backfill_reason TEXT;
```

---

## AP-7: Single Universal Backfill Rule (🟡 HIGH)

### Anti-Pattern Code

```sql
-- ❌ AVOID: One rule for all source types
UPDATE finance_transactions
SET document_date = posted_at::date
WHERE document_date IS NULL;
-- Ignores source_type-specific semantics
```

### Why Avoided

**Reason 1: Source Types Have Different Semantics**

| Source Type | Document Date Semantic |
|-------------|------------------------|
| F3_AR_INVOICE | Invoice issue date |
| SALES_ORDER | Order placement date |
| AP_PAYMENT | Payment instruction date |
| SPA_BOOKING | Service delivery date |
| F2_CASH | Cash movement date |

**One rule cannot fit all.**

**Reason 2: Different Provenance Strengths**

- F3_AR_INVOICE: PROVABLE (finance_invoices.issue_date)
- SALES_ORDER: INFERABLE (requires investigation)
- F2_CASH: UNKNOWABLE (no provenance)

**Universal rule loses classification granularity.**

**Reason 3: Different Accounting Policies**

- Cash transactions: accounting_date = document_date
- Accrual invoices: accounting_date = delivery_date ≠ document_date
- Service bookings: accounting_date = service_date ≠ booking_date

### Correct Approach

```sql
-- ✅ CORRECT: Source-type-specific rules
UPDATE finance_transactions f1
SET 
    document_date = CASE 
        WHEN f1.source_type = 'F3_AR_INVOICE' THEN (
            SELECT fi.issue_date FROM finance_invoices fi 
            WHERE fi.id = f1.source_id::uuid
        )
        WHEN f1.source_type = 'SALES_ORDER' THEN (
            SELECT so.order_date FROM sales_orders so 
            WHERE so.id = f1.source_id::uuid
        )
        -- Add other source types explicitly
        ELSE NULL
    END,
    backfill_classification = CASE 
        WHEN f1.source_type = 'F3_AR_INVOICE' THEN 'PROVABLE'
        WHEN f1.source_type IN ('SALES_ORDER', 'AP_PAYMENT') THEN 'INFERABLE'
        ELSE 'UNKNOWABLE'
    END,
    backfill_source = CASE 
        WHEN f1.source_type = 'F3_AR_INVOICE' THEN 'finance_invoices.issue_date'
        WHEN f1.source_type = 'SALES_ORDER' THEN 'sales_orders.order_date'
        ELSE 'none'
    END
WHERE f1.document_date IS NULL
  AND f1.lifecycle_state = 'POSTED';
```

---

## AP-8: Blind INFERABLE Without Policy Documentation (🟠 MEDIUM)

### Anti-Pattern Code

```sql
-- ❌ AVOID: INFERABLE without documented reasoning
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_classification = 'INFERABLE'
-- Missing: WHY is this inference valid?
WHERE accounting_date IS NULL;
```

### Why Avoided

**Reason 1: Loses Inference Reasoning**

6 months later:
- Why is accounting_date = document_date?
- What accounting policy was assumed?
- Is this still valid after policy change?

**Without documentation, cannot answer.**

**Reason 2: Cannot Validate Policy Compliance**

- Is this cash basis or accrual basis?
- Does it comply with TT99?
- Does it match actual business practice?

**Cannot verify without documented policy.**

### Correct Approach

```sql
-- ✅ CORRECT: Document inference policy explicitly
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date (per Human Architect decision Q1, approved 2026-08-24)'
WHERE accounting_date IS NULL
  AND document_date IS NOT NULL
  AND source_type IN ('F3_AR_INVOICE', 'SALES_ORDER');  -- Policy applies to these types
```

**Plus:** Document policy in separate artifact:
```markdown
## Accounting Policy Decision (Q1)

**Date:** 2026-08-24  
**Decision:** Cash basis accounting for F3_AR_INVOICE and SALES_ORDER  
**Rationale:** Bella Spa ERP uses cash basis for revenue recognition (immediate recognition on invoice/sale)  
**Source Types:** F3_AR_INVOICE, SALES_ORDER  
**Exception:** SPA_BOOKING uses accrual basis (service date)  
**Approved By:** Human Architect
```

---

## AP-9: Test Data Treated as Production (🟠 MEDIUM)

### Anti-Pattern Code

```sql
-- ❌ AVOID: Backfill test data same as production
UPDATE finance_transactions
SET document_date = posted_at::date
WHERE document_date IS NULL;
-- Includes test data without distinction
```

### Why Avoided

**Reason 1: Test Data Has Arbitrary Dates**

Test records use backdated/future dates for scenario testing:
- Concurrency tests: Multiple transactions with same timestamp
- Regression tests: Historical dates for period closing tests
- Verification tests: Future dates for validation

**These are NOT real business dates.**

**Reason 2: Contaminates Semantic**

Mixing test semantics with production semantics:
- Production: document_date = real invoice issue date
- Test: document_date = arbitrary test scenario date

**Cannot validate correctness.**

**Reason 3: Test Data Should Be Identifiable**

For audit and debugging:
- Which records are test vs production?
- Can test data be excluded from reports?
- Should test data be deleted (Phase 2.5-style)?

### Correct Approach

**Option 1: Separate test data handling**
```sql
-- ✅ CORRECT: Explicit test data classification
UPDATE finance_transactions
SET 
    document_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'Test artifact - no business source'
WHERE source_type IN (
    'CONCURRENCY_TEST',
    'VERIFICATION',
    'F2_REGRESSION',
    'test'
)
AND lifecycle_state = 'POSTED';
```

**Option 2: Delete test data**
```sql
-- Human Architect approval required
DELETE FROM finance_transactions
WHERE source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test')
  AND created_at < '2026-08-24'::date;  -- Historical test data only
```

**Option 3: Backfill for test continuity (with explicit flag)**
```sql
-- IF test continuity requires dates:
UPDATE finance_transactions
SET 
    document_date = posted_at::date,
    accounting_date = posted_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'posted_at (test data only)',
    backfill_reason = 'Test artifact: posted_at used for test continuity'
WHERE source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test')
  AND lifecycle_state = 'POSTED';
```

---

## AP-10: Backfill Before NOT NULL Constraint (🟢 LOW)

### Anti-Pattern Code

```sql
-- ❌ TIMING ISSUE: NOT NULL constraint added before backfill
ALTER TABLE finance_transactions
    ALTER COLUMN document_date SET NOT NULL,
    ALTER COLUMN accounting_date SET NOT NULL;
-- Backfill happens AFTER constraint → fails

-- OR: Constraint added, then backfill, creating race condition
ALTER TABLE finance_transactions
    ALTER COLUMN document_date SET NOT NULL;
-- New POSTED transactions can be inserted with NULL between constraint and backfill
```

### Why Avoided

**Reason 1: Backfill Will Fail**

If constraint added first:
```
ALTER COLUMN SET NOT NULL
    ↓
Existing NULL records → CONSTRAINT VIOLATION
    ↓
Migration fails
```

**Reason 2: Race Condition**

If constraint added before backfill completes:
```
Constraint added
    ↓
New transaction inserted (NULL dates)
    ↓
Backfill completes
    ↓
New record still has NULL → audit gap
```

### Correct Approach

**Execution Order:**
```sql
-- STEP 1: Add backfill metadata columns (nullable)
ALTER TABLE finance_transactions
ADD COLUMN IF NOT EXISTS backfill_inferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_classification TEXT,
ADD COLUMN IF NOT EXISTS backfill_source TEXT,
ADD COLUMN IF NOT EXISTS backfill_reason TEXT;

-- STEP 2: Execute backfill (with metadata)
UPDATE finance_transactions f1
SET 
    document_date = <provenance_value>,
    backfill_inferred = <TRUE/FALSE>,
    backfill_classification = '<PROVABLE/INFERABLE/UNKNOWABLE>',
    backfill_source = '<source>',
    backfill_reason = '<reason>'
WHERE f1.document_date IS NULL
  AND f1.lifecycle_state = 'POSTED'
  AND <backfill_condition>;

-- STEP 3: Verify backfill complete
SELECT 
    COUNT(*) FILTER (WHERE document_date IS NULL) AS null_document_date,
    COUNT(*) FILTER (WHERE accounting_date IS NULL) AS null_accounting_date
FROM finance_transactions
WHERE lifecycle_state = 'POSTED';
-- Expected: 0 (or only UNKNOWABLE records)

-- STEP 4: Add CHECK constraint (lifecycle-based, allows UNKNOWABLE)
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_posted_dates_not_null CHECK (
    (lifecycle_state = 'POSTED' 
     AND (document_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE')
     AND (accounting_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE'))
    OR lifecycle_state = 'DRAFT'
);

-- STEP 5: Update triggers to enforce for NEW records
-- (System generates posted_at, RPC validates document_date/accounting_date)
```

---

## Summary: Anti-Pattern Severity

| Severity | Anti-Patterns | Impact |
|----------|---------------|--------|
| 🔴 **CRITICAL** | AP-1, AP-2, AP-3, AP-4 | Semantic contamination, violates core governance, circular logic |
| 🟡 **HIGH** | AP-5, AP-6, AP-7 | Loses provenance audit trail, incorrect semantics, compliance risk |
| 🟠 **MEDIUM** | AP-8, AP-9 | Documentation gaps, test data contamination |
| 🟢 **LOW** | AP-10 | Execution timing issue, easily avoided |

---

## Enforcement Checklist

Before executing any backfill SQL:

- [ ] ❌ Does it use `posted_at` as document_date or accounting_date fallback? (AP-1, AP-2)
- [ ] ❌ Does it use `COALESCE` cascade with multiple fallbacks? (AP-3)
- [ ] ❌ Does it use `F2.effective_date` as provenance source? (AP-4)
- [ ] ⚠️ Does it use `created_at` without Human Architect approval? (AP-5)
- [ ] ✅ Does it include backfill metadata columns? (AP-6)
- [ ] ✅ Is it source-type-specific (not universal)? (AP-7)
- [ ] ✅ Is inference policy documented in `backfill_reason`? (AP-8)
- [ ] ✅ Is test data handled separately from production? (AP-9)
- [ ] ✅ Is backfill executed BEFORE NOT NULL constraint? (AP-10)

**If any ❌ is checked → BLOCK MIGRATION until corrected.**

---

## Quick Reference: What TO DO

| Instead of Anti-Pattern | Correct Approach |
|-------------------------|------------------|
| `posted_at` fallback | Source-type-specific provenance or preserve NULL |
| COALESCE cascade | Explicit CASE statement with classification |
| F2.effective_date | Classify F2_CASH as UNKNOWABLE, preserve NULL |
| `created_at` fallback | Preserve NULL or require manual review |
| Backfill without metadata | Always include backfill_inferred, backfill_classification, backfill_source, backfill_reason |
| Universal rule | Source-type-specific rules with different classifications |
| Undocumented INFERABLE | Document policy in backfill_reason + separate policy artifact |
| Test data mixed | Separate handling (preserve NULL, delete, or explicit test flag) |
| NOT NULL before backfill | Backfill first, verify, then add constraint |

---

## Principle Reminder

**Core Governance:**
1. ❌ No provenance → No backfill
2. ❌ Ambiguous provenance → Preserve NULL
3. ✅ Inferable provenance → Backfill only with explicit, documented inference rule
4. ❌ posted_at → NEVER use as document_date or accounting_date fallback

**Trade-off Acceptance:**
- Semantic correctness > Database completeness
- Provenance audit trail > Convenience
- Source-type specificity > Universal rules
- Honest UNKNOWABLE > False PROVABLE

---

**Document Status:** ✅ COMPLETE  
**Next Step:** Task 10 (Estimate Backfill Impact)  
**Enforcement:** 🔴 MANDATORY — Anti-patterns MUST NOT be implemented  
**Approval Required:** Human Architect review before any backfill execution
