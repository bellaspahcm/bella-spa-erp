# Phase 3.5: accounting_date Provenance Classification

**Status:** ✅ ANALYSIS COMPLETE  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Classification Framework:** PROVABLE / INFERABLE / UNKNOWABLE

---

## Executive Summary

This document classifies the **provenance** (evidence origin) for `accounting_date` across 675 POSTED F1 transactions.

**Key Finding:** `accounting_date` has **ZERO PROVABLE sources** in current Finance OS. All 675 records require policy-based inference, making this field **100% INFERABLE** or **UNKNOWABLE**.

**Critical Insight:** This validates Phase 3.2 decision to introduce `accounting_date` as a NEW semantic field, distinct from `document_date` and `posted_at`.

---

## 1. Classification Framework

```
Historical F1 Transaction
         │
         ↓
    accounting_date Provenance?
         │
    ┌────┴────┐
    ↓         ↓
PROVABLE?   INFERABLE?
    │         │
    ↓         ↓
   NONE    Policy-based
           reconstruction
         │
    ┌────┴────┐
    ↓         ↓
Cash Basis  Manual
Policy      Review
(=document_date) (UNKNOWABLE)
```

### 1.1 Why accounting_date Has No PROVABLE Source

**Reason:** Finance OS historically conflated 3 distinct date semantics into a single `posted_at` field:

1. **Document date** (business event date)
2. **Accounting date** (period recognition date)
3. **Posting timestamp** (system recording time)

**Evidence from Phase 3.1 Forensic:**
- F5 balance queries use `F1.posted_at` as "as_of accounting date" (WRONG semantic)
- F2.effective_date inherits `F1.posted_at` (WRONG semantic)
- No explicit "accounting period date" field existed before Phase 3 design

**Implication:** `accounting_date` is a **newly introduced semantic**, not extractable from existing source tables.

---

## 2. Provenance Classification by Source Type

### 2.1 F3_AR_INVOICE (128 records, 19%)

**Source Table:** `finance_invoices`  
**Available Date Fields:** `issue_date`, `created_at`  
**Classification:** **INFERABLE (Cash Basis Policy)**

#### Analysis

`finance_invoices` schema:
- `issue_date`: Document date (when invoice was issued)
- NO `accounting_date` or `recognition_date` field

**Accounting Policy Question:**
- Does Bella use **cash basis** (accounting_date = document_date)?
- Or **accrual basis** with separate recognition periods?

#### Backfill Strategy (Cash Basis)

```sql
-- INFERABLE: Cash basis policy (accounting_date = document_date)
UPDATE finance_transactions f1
SET 
    accounting_date = fi.issue_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'finance_invoices.issue_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date'
FROM finance_invoices fi
WHERE f1.source_type = 'F3_AR_INVOICE'
  AND f1.source_id = fi.id::TEXT
  AND f1.tenant_id = fi.tenant_id
  AND f1.accounting_date IS NULL;
```

**Caveat:** If Bella uses accrual accounting with month-end recognition adjustments, this backfill is **semantically incorrect**.

**Risk:** MEDIUM — Requires accounting policy validation.

---

### 2.2 SALES_ORDER (208 records, 31%)

**Source Table:** Unknown (requires investigation)  
**Classification:** **INFERABLE (Cash Basis) or UNKNOWABLE**

#### Analysis

Depends on Task 3 investigation outcome:
- **IF** `sales_orders` has `order_date` → `accounting_date = order_date` (cash basis)
- **IF** no date field → **UNKNOWABLE**

#### Backfill Strategy (Conditional)

```sql
-- INFERABLE: Cash basis policy
UPDATE finance_transactions f1
SET 
    accounting_date = f1.document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date'
WHERE f1.source_type = 'SALES_ORDER'
  AND f1.document_date IS NOT NULL
  AND f1.accounting_date IS NULL;
```

**Prerequisite:** `document_date` must be backfilled first (Task 3).

**Risk:** MEDIUM — Assumes cash basis accounting policy.

---

### 2.3 AP_PAYMENT (74 records, 11%)

**Source Table:** `finance_payments`  
**Classification:** **INFERABLE (Payment Execution Date) or UNKNOWABLE**

#### Analysis

Payment accounting has distinct date semantics:
- **Payment instruction date:** When payment was requested
- **Payment execution date:** When bank processed payment (VALUE DATE)
- **Accounting recognition date:** When payment affects books

**Question:** Does `finance_payments` have `value_date` or `execution_date`?

#### Backfill Strategy (Execution Date Basis)

```sql
-- INFERABLE: Payment execution date = accounting_date
UPDATE finance_transactions f1
SET 
    accounting_date = fp.execution_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'finance_payments.execution_date',
    backfill_reason = 'Payment execution date as accounting recognition date'
FROM finance_payments fp
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = fp.id::TEXT
  AND f1.tenant_id = fp.tenant_id
  AND f1.accounting_date IS NULL;
```

**Alternative (Cash Basis):**
```sql
-- If no execution_date, use document_date
UPDATE finance_transactions f1
SET 
    accounting_date = f1.document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date'
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.document_date IS NOT NULL
  AND f1.accounting_date IS NULL;
```

**Risk:** HIGH — Payment accounting date semantic varies by jurisdiction and policy.

---

### 2.4 F2_CASH (67 records, 10%)

**Source Table:** `finance_cash_movements`  
**Available Date:** `effective_date`  
**Classification:** **INFERABLE (F2.effective_date) WITH HIGH RISK**

#### Critical Caveat (from Phase 3.2)

Current F2 implementation:
```typescript
// WRONG: F2.effective_date inherits F1.posted_at
f2.effective_date = f1.posted_at;
```

**Should be:**
```typescript
// CORRECT: F2.effective_date inherits F1.accounting_date
f2.effective_date = f1.accounting_date;
```

**Implication:** Historical `F2.effective_date` may NOT represent true accounting date.

#### Backfill Strategy (Conditional)

**Step 1: Verify F2.effective_date provenance**
```sql
-- Check if F2.effective_date was manually set or auto-copied from posted_at
SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE f1.posted_at::date = f2.effective_date::date) AS auto_copied,
    COUNT(*) FILTER (WHERE f1.posted_at::date != f2.effective_date::date) AS manually_set,
    ROUND(100.0 * COUNT(*) FILTER (WHERE f1.posted_at::date != f2.effective_date::date) / COUNT(*), 2) AS manual_pct
FROM finance_transactions f1
JOIN finance_cash_movements f2 ON f2.transaction_id = f1.id
WHERE f1.source_type = 'F2_CASH';
```

**Step 2: Conditional backfill**
```sql
-- IF F2.effective_date was manually set (dates differ):
-- Use F2.effective_date as accounting_date
UPDATE finance_transactions f1
SET 
    accounting_date = f2.effective_date::date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'finance_cash_movements.effective_date',
    backfill_reason = 'Manually set effective_date used as accounting_date'
FROM finance_cash_movements f2
WHERE f1.source_type = 'F2_CASH'
  AND f2.transaction_id = f1.id
  AND f1.posted_at::date != f2.effective_date::date
  AND f1.accounting_date IS NULL;

-- IF F2.effective_date was auto-copied (dates match):
-- Classification → UNKNOWABLE (no independent provenance)
UPDATE finance_transactions f1
SET 
    accounting_date = NULL,
    backfill_inferred = FALSE,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2.effective_date auto-copied from posted_at (no provenance)'
FROM finance_cash_movements f2
WHERE f1.source_type = 'F2_CASH'
  AND f2.transaction_id = f1.id
  AND f1.posted_at::date = f2.effective_date::date;
```

**Risk:** **VERY HIGH** — Requires Phase 3.5 Task 5 (posted_at semantic forensic) completion first.

---

### 2.5 SPA_BOOKING (31 records, 5%)

**Source Table:** `spa_bookings`  
**Classification:** **INFERABLE (Service Date) or Cash Basis**

#### Analysis

Revenue recognition policy for service bookings:
- **Booking date:** When customer made booking (prepayment)
- **Service date:** When service was performed (revenue recognition)

**Accounting date = Service date** (accrual basis, revenue recognized when service occurs)

#### Backfill Strategy

```sql
-- INFERABLE: Service date as accounting recognition date
UPDATE finance_transactions f1
SET 
    accounting_date = sb.service_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'spa_bookings.service_date',
    backfill_reason = 'Accrual basis: revenue recognized on service date'
FROM spa_bookings sb
WHERE f1.source_type = 'SPA_BOOKING'
  AND f1.source_id = sb.id::TEXT
  AND f1.tenant_id = sb.tenant_id
  AND f1.accounting_date IS NULL;
```

**Prerequisite:** `spa_bookings.service_date` must exist (Task 3 investigation).

**Risk:** MEDIUM — Requires revenue recognition policy validation.

---

### 2.6 Test Data (167 records, 25%)

**Source Types:** `CONCURRENCY_TEST`, `VERIFICATION`, `F2_REGRESSION`, `test`  
**Classification:** **UNKNOWABLE**

#### Backfill Strategy

```sql
-- Option A: Keep NULL
UPDATE finance_transactions
SET 
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'Test artifact - no accounting period semantic'
WHERE source_type IN (
    'CONCURRENCY_TEST',
    'VERIFICATION',
    'F2_REGRESSION',
    'test'
);

-- Option B: Use document_date (if backfilled) for test continuity
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Test data: cash basis assumption'
WHERE source_type IN (
    'CONCURRENCY_TEST',
    'VERIFICATION',
    'F2_REGRESSION',
    'test'
)
AND document_date IS NOT NULL;
```

**Recommendation:** Option A (keep NULL) — test data does not require accounting period semantic.

**Risk:** LOW — Test data cleanup consideration.

---

## 3. Accounting Policy Dependencies

### 3.1 Cash Basis vs Accrual Basis

**Cash Basis Policy:**
```
accounting_date = document_date
```

**Simplifies backfill:** Once `document_date` is backfilled, `accounting_date` can be derived.

**Accrual Basis Policy:**
```
accounting_date ≠ document_date
(depends on recognition rules: delivery, service completion, month-end close, etc.)
```

**Complicates backfill:** Requires business logic to determine recognition timing.

### 3.2 TT99 Requirement: "Ngày hạch toán"

Per Phase 3.3 TT99 mapping:
- **Ngày hạch toán** = accounting_date
- This is the date that determines accounting period
- MUST respect period closing (cannot modify after period CLOSED)

**Question for Human Architect:** Does Bella currently use:
1. **Cash basis** (document_date = accounting_date)?
2. **Accrual basis** (separate recognition logic)?
3. **Hybrid** (cash for some transaction types, accrual for others)?

---

## 4. Default Policy Validation (from Phase 3.4)

Phase 3.4 established:
```sql
-- Default: accounting_date = document_date if not provided
DEFAULT accounting_date = COALESCE(accounting_date, document_date)
```

**This implies:** Bella's default policy is **CASH BASIS**.

**Validation Required:**
1. Is this default correct for ALL transaction types?
2. Which transaction types require separate accounting_date logic?
   - Accrual invoices (revenue recognition on delivery)?
   - Prepayments (deferred revenue)?
   - Month-end adjustments?
3. Does TT99 require cash basis, or does it support accrual?

---

## 5. Backfill Classification Summary

| Source Type | Record Count | Classification | Provenance Strategy | Risk Level |
|-------------|--------------|----------------|---------------------|------------|
| F3_AR_INVOICE | 128 (19%) | INFERABLE | Cash basis: = document_date | MEDIUM |
| SALES_ORDER | 208 (31%) | INFERABLE | Cash basis: = document_date | MEDIUM |
| AP_PAYMENT | 74 (11%) | INFERABLE | Execution date or document_date | HIGH |
| F2_CASH | 67 (10%) | INFERABLE / UNKNOWABLE | F2.effective_date (if manually set) | VERY HIGH |
| SPA_BOOKING | 31 (5%) | INFERABLE | Service date (accrual basis) | MEDIUM |
| Test Data | 167 (25%) | UNKNOWABLE | NULL or = document_date | LOW |

**Overall Classification:**
- **PROVABLE:** 0 (0%)
- **INFERABLE:** 508 (75%) — requires accounting policy validation
- **UNKNOWABLE:** 167 (25%) — test data

---

## 6. Backfill Execution Dependency Chain

```
document_date backfill (Task 3)
        ↓
Accounting Policy Decision
        ↓
    ┌───┴───┐
    ↓       ↓
Cash Basis  Accrual Basis
    ↓       ↓
accounting_date  accounting_date
= document_date  = policy-specific logic
    ↓       ↓
    └───┬───┘
        ↓
F2.effective_date validation (Task 5)
        ↓
F2_CASH accounting_date backfill
```

**Critical Path:**
1. Complete `document_date` backfill (Task 3 investigations)
2. Obtain Human Architect decision on accounting policy (cash vs accrual)
3. Execute `posted_at` semantic forensic (Task 5) for F2_CASH decision
4. Execute `accounting_date` backfill with explicit `backfill_inferred = TRUE`

---

## 7. Backfill Strategy by Accounting Policy

### 7.1 Strategy A: Pure Cash Basis (Simplest)

```sql
-- All transaction types: accounting_date = document_date
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date'
WHERE lifecycle_state = 'POSTED'
  AND document_date IS NOT NULL
  AND accounting_date IS NULL
  AND source_type NOT IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test');
```

**Pros:**
- Simple, consistent backfill
- Matches Phase 3.4 default policy
- Lower risk of semantic errors

**Cons:**
- May not reflect true accounting practice if Bella uses accrual
- Cannot distinguish between document date and accounting period date

---

### 7.2 Strategy B: Hybrid (Transaction-Type-Specific)

```sql
-- Cash basis for most types
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy'
WHERE source_type IN ('SALES_ORDER', 'F3_AR_INVOICE', 'AP_PAYMENT')
  AND document_date IS NOT NULL
  AND accounting_date IS NULL;

-- Accrual basis for service bookings (service date)
UPDATE finance_transactions f1
SET 
    accounting_date = sb.service_date,
    backfill_inferred = TRUE,
    backfill_source = 'spa_bookings.service_date',
    backfill_reason = 'Accrual basis: revenue recognized on service date'
FROM spa_bookings sb
WHERE f1.source_type = 'SPA_BOOKING'
  AND f1.source_id = sb.id::TEXT
  AND f1.accounting_date IS NULL;

-- Special handling for F2_CASH (after Task 5 validation)
-- (See section 2.4 conditional backfill)
```

**Pros:**
- More accurate to real accounting practices
- Distinguishes cash vs accrual transaction types

**Cons:**
- More complex backfill logic
- Higher risk of policy errors
- Requires validation per transaction type

---

## 8. Open Questions for Human Architect

### Q1: Accounting Policy Confirmation
**Does Bella Spa ERP use:**
- [ ] **Cash basis** (accounting_date = document_date for all transactions)
- [ ] **Accrual basis** (separate recognition logic per transaction type)
- [ ] **Hybrid** (cash for some types, accrual for others)

### Q2: Transaction-Type-Specific Rules
**Which transaction types require accounting_date ≠ document_date?**
- [ ] F3_AR_INVOICE: Recognize on invoice date or delivery date?
- [ ] SPA_BOOKING: Recognize on booking date or service date?
- [ ] AP_PAYMENT: Recognize on instruction date or execution date?
- [ ] SALES_ORDER: Recognize on order date or fulfillment date?

### Q3: F2_CASH Risk Acceptance
**Given F2.effective_date may have inherited posted_at incorrectly:**
- [ ] **Option A:** Classify all F2_CASH as UNKNOWABLE until manual review
- [ ] **Option B:** Use F2.effective_date with HIGH RISK flag for manually-set dates only
- [ ] **Option C:** Use document_date (cash basis) and discard F2.effective_date provenance

### Q4: Test Data Handling
**For 167 test records:**
- [ ] Keep accounting_date = NULL
- [ ] Backfill with document_date for test continuity
- [ ] Delete test data as part of Phase 2.5-style cleanup

---

## 9. Compliance with Phase 3.4 Nullability Design

Phase 3.4 established:

**DRAFT:**
- `accounting_date` → NULL allowed

**POSTED:**
- `accounting_date` → REQUIRED (CHECK constraint)

**Backfill implication:** All 675 POSTED records MUST have non-NULL `accounting_date` after backfill.

**Strategy:**
1. Apply INFERABLE backfill (cash basis or policy-based)
2. Flag records with `backfill_inferred = TRUE`
3. Records remaining NULL → requires manual review or classification as UNKNOWABLE

---

## 10. Risk Assessment

| Risk Factor | Level | Mitigation |
|-------------|-------|------------|
| Accounting policy assumption (cash vs accrual) | **HIGH** | Require Human Architect confirmation before backfill |
| F2.effective_date provenance contamination | **VERY HIGH** | Complete Task 5 (posted_at forensic) first |
| Source table date field semantic mismatch | MEDIUM | Validate each source type's date field meaning |
| Backfill overwrites manual corrections | MEDIUM | Add `backfill_inferred` flag for audit trail |
| TT99 compliance violation | HIGH | Validate backfilled dates respect period closing rules |

**Highest Risk:** F2_CASH backfill — requires Task 5 completion.

---

## 11. Next Steps

1. ✅ **Task 4 COMPLETE:** accounting_date provenance classified
2. ⏭️ **Task 5 NEXT:** posted_at semantic forensic (CRITICAL for F2_CASH decision)
3. ⏭️ **Task 6:** posted_at vs created_at vs document dates validation
4. ⏭️ **Human Architect Decision:** Confirm accounting policy (cash vs accrual)
5. ⏭️ **Task 7:** Source-type-specific backfill rules (based on policy decision)
6. ⏭️ **Task 8:** Backfill classification matrix
7. ⏭️ **Task 9:** Anti-patterns documentation
8. ⏭️ **Task 10:** Backfill impact estimate
9. ⏭️ **Task 11:** Consolidated `PHASE3_BACKFILL_POLICY.md`

---

## Appendix A: Accounting Date Semantic Distinction

### Why accounting_date ≠ document_date?

**Example 1: Accrual Invoice**
- `document_date`: 2024-12-28 (invoice issued)
- `accounting_date`: 2024-12-31 (month-end revenue recognition)
- **Reason:** Revenue recognized at period close, not invoice date

**Example 2: Prepaid Service**
- `document_date`: 2024-12-15 (payment received)
- `accounting_date`: 2025-01-10 (service performed)
- **Reason:** Deferred revenue recognized when service delivered

**Example 3: Cash Payment (Cash Basis)**
- `document_date`: 2024-12-20 (payment instruction)
- `accounting_date`: 2024-12-20 (same day recognition)
- **Reason:** Cash basis = immediate recognition

### TT99 Requirement

Per TT99, **accounting_date** determines which accounting period the transaction belongs to.

**Period Closing Rule:**
- Once period CLOSED → cannot modify `accounting_date`
- This is enforced by Phase 3.2 lifecycle rules

---

## Appendix B: Provenance vs Policy Inference

**PROVABLE provenance:**
```sql
-- Direct field mapping from source table
accounting_date = source_table.explicit_accounting_date_field
```
→ Finance OS has **ZERO** such sources.

**INFERABLE provenance:**
```sql
-- Policy-based reconstruction
accounting_date = CASE 
    WHEN cash_basis_policy THEN document_date
    WHEN accrual_policy THEN apply_recognition_rules(transaction)
    ELSE UNKNOWABLE
END
```
→ Requires **explicit accounting policy** + `backfill_inferred = TRUE` flag.

**UNKNOWABLE:**
```sql
-- Insufficient evidence
accounting_date = NULL
-- OR require manual review
```

---

**Document Status:** ✅ COMPLETE  
**Dependencies:** Task 5 (posted_at forensic), Human Architect policy decision  
**Approval Required:** 🔴 BLOCKED on accounting policy confirmation  
**Implementation Blocked:** ❌ M-F1-DATES NOT APPROVED YET
