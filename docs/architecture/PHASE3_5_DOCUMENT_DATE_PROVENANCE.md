# Phase 3.5: document_date Provenance Classification

**Status:** ✅ ANALYSIS COMPLETE  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Classification Framework:** PROVABLE / INFERABLE / UNKNOWABLE

---

## Executive Summary

This document classifies the **provenance** (evidence origin) for `document_date` across 675 POSTED F1 transactions, applying the principle **"Provenance Over Convenience"**.

**Key Finding:** Only 19% of F1 transactions have PROVABLE document_date from explicit source table date fields. The remaining 81% require policy-based inference or lack sufficient evidence.

---

## 1. Classification Framework

```
Historical F1 Transaction
         │
         ↓
    Provenance Analysis
         │
    ┌────┼────┐
    ↓    ↓    ↓
PROVABLE │ INFERABLE │ UNKNOWABLE
    ↓    ↓    ↓
Backfill │ Policy + Flag │ Manual Review / NULL
directly │   required    │   or explicit flag
```

### 1.1 Classification Definitions

| Classification | Definition | Backfill Strategy |
|----------------|------------|-------------------|
| **PROVABLE** | Source table has explicit document/issue date field with semantic guarantee | Direct field mapping with validation |
| **INFERABLE** | Can deduce from business logic/policy but requires assumption + explicit flag | Policy-based with `backfill_inferred` flag |
| **UNKNOWABLE** | Insufficient evidence, no source table or no meaningful date field | NULL or manual review required |

### 1.2 Anti-Pattern (REJECTED)

```sql
-- ❌ FORBIDDEN: Convenience fallback to achieve NOT NULL
UPDATE finance_transactions 
SET document_date = COALESCE(
    document_date,
    accounting_date,
    posted_at,
    created_at
);
```

**Why rejected:** Violates **"Provenance Over Convenience"** — invents dates without semantic evidence.

---

## 2. Data Landscape (675 POSTED F1 Transactions)

### 2.1 Source Type Distribution

| Source Type | Count | Percentage | Classification Candidate |
|-------------|-------|------------|--------------------------|
| SALES_ORDER | 208 | 31% | INFERABLE (requires business table investigation) |
| F3_AR_INVOICE | 128 | 19% | **PROVABLE** (finance_invoices.issue_date) |
| CONCURRENCY_TEST | 102 | 15% | UNKNOWABLE (test artifact) |
| AP_PAYMENT | 74 | 11% | INFERABLE (requires finance_payments investigation) |
| F2_CASH | 67 | 10% | INFERABLE (from F2.effective_date) |
| VERIFICATION | 35 | 5% | UNKNOWABLE (test artifact) |
| SPA_BOOKING | 31 | 5% | INFERABLE (requires spa_bookings investigation) |
| F2_REGRESSION | 18 | 3% | UNKNOWABLE (test artifact) |
| test | 12 | 2% | UNKNOWABLE (test artifact) |

### 2.2 Provenance Classification Summary

| Classification | Record Count | Percentage | Notes |
|----------------|--------------|------------|-------|
| **PROVABLE** | 128 | 19% | F3_AR_INVOICE only |
| **INFERABLE** | 380 | 56% | SALES_ORDER, AP_PAYMENT, F2_CASH, SPA_BOOKING |
| **UNKNOWABLE** | 167 | 25% | Test data (CONCURRENCY_TEST, VERIFICATION, F2_REGRESSION, test) |

---

## 3. PROVABLE Classification

### 3.1 F3_AR_INVOICE → finance_invoices.issue_date

**Source Type:** `F3_AR_INVOICE`  
**Record Count:** 128 (19%)  
**Provenance Field:** `finance_invoices.issue_date`  
**Semantic Guarantee:** ✅ YES — `issue_date` explicitly represents invoice document date

#### Evidence

```sql
-- Provenance verification
SELECT 
    f1.id,
    f1.source_id,
    fi.issue_date AS provable_document_date,
    fi.created_at
FROM finance_transactions f1
JOIN finance_invoices fi ON fi.id = f1.source_id::uuid
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'F3_AR_INVOICE';
```

**Validation Required:**
1. `finance_invoices.issue_date IS NOT NULL` for all F3_AR_INVOICE transactions
2. `issue_date` semantic = document date (not accounting date or system timestamp)

#### Backfill Strategy

```sql
-- PROVABLE backfill
UPDATE finance_transactions f1
SET document_date = fi.issue_date
FROM finance_invoices fi
WHERE f1.source_type = 'F3_AR_INVOICE'
  AND f1.source_id = fi.id::TEXT
  AND f1.tenant_id = fi.tenant_id
  AND f1.document_date IS NULL;
```

**Risk:** LOW — Direct field mapping with explicit semantic.

---

## 4. INFERABLE Classification

### 4.1 SALES_ORDER → Requires Business Table Investigation

**Source Type:** `SALES_ORDER`  
**Record Count:** 208 (31%)  
**Potential Provenance:** Unknown (requires schema investigation)

#### Investigation Required

1. Does `sales_orders` table exist?
2. Does it have `order_date` or `booking_date` field?
3. What is the semantic of that date? (order placement vs booking confirmation vs service date)

#### Backfill Strategy (CONDITIONAL)

```sql
-- IF sales_orders.order_date exists with document date semantic
UPDATE finance_transactions f1
SET 
    document_date = so.order_date,
    backfill_inferred = TRUE,
    backfill_source = 'sales_orders.order_date'
FROM sales_orders so
WHERE f1.source_type = 'SALES_ORDER'
  AND f1.source_id = so.id::TEXT
  AND f1.tenant_id = so.tenant_id
  AND f1.document_date IS NULL;
```

**Risk:** MEDIUM — Requires semantic validation of source date field.

**Alternative if no date field:** Classification → UNKNOWABLE

---

### 4.2 AP_PAYMENT → Requires finance_payments Investigation

**Source Type:** `AP_PAYMENT`  
**Record Count:** 74 (11%)  
**Potential Provenance:** `finance_payments.payment_date` or `execution_date`?

#### Investigation Required

1. Does `finance_payments` table have `payment_date` or `execution_date`?
2. What is the semantic? (payment instruction date vs bank execution date vs document date)

#### Backfill Strategy (CONDITIONAL)

```sql
-- IF finance_payments.payment_date = document date semantic
UPDATE finance_transactions f1
SET 
    document_date = fp.payment_date,
    backfill_inferred = TRUE,
    backfill_source = 'finance_payments.payment_date'
FROM finance_payments fp
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = fp.id::TEXT
  AND f1.tenant_id = fp.tenant_id
  AND f1.document_date IS NULL;
```

**Risk:** MEDIUM — Payment date ≠ document date in many accounting contexts.

**Alternative:** Document date = accounting_date (cash basis policy) with `backfill_inferred = TRUE`

---

### 4.3 F2_CASH → Use F2.effective_date (WITH CAVEAT)

**Source Type:** `F2_CASH`  
**Record Count:** 67 (10%)  
**Provenance:** `finance_cash_movements.effective_date`

#### Critical Caveat

Per Phase 3.2 findings:
- Current implementation: `F2.effective_date` inherits `F1.posted_at` (WRONG)
- Correct semantic: `F2.effective_date` should use `F1.accounting_date`

**Implication:** Historical `F2.effective_date` may NOT represent true business/accounting date if it was auto-filled from `posted_at`.

#### Backfill Strategy (INFERABLE with verification)

```sql
-- Verify F2.effective_date is not just posted_at copy
SELECT 
    f1.id,
    f1.posted_at,
    f2.effective_date,
    (f1.posted_at::date = f2.effective_date::date) AS dates_match
FROM finance_transactions f1
JOIN finance_cash_movements f2 ON f2.transaction_id = f1.id
WHERE f1.source_type = 'F2_CASH';

-- IF dates_match = FALSE (effective_date was manually set):
UPDATE finance_transactions f1
SET 
    document_date = f2.effective_date,
    backfill_inferred = TRUE,
    backfill_source = 'finance_cash_movements.effective_date'
FROM finance_cash_movements f2
WHERE f1.source_type = 'F2_CASH'
  AND f2.transaction_id = f1.id
  AND f1.posted_at::date != f2.effective_date::date;

-- IF dates_match = TRUE (effective_date was auto-copied from posted_at):
-- Classification → UNKNOWABLE (no independent provenance)
```

**Risk:** HIGH — Historical data semantic correctness depends on F2 creation logic.

**Recommendation:** Requires Phase 3.6 (posted_at semantic forensic) before backfill decision.

---

### 4.4 SPA_BOOKING → Requires spa_bookings Investigation

**Source Type:** `SPA_BOOKING`  
**Record Count:** 31 (5%)  
**Potential Provenance:** `spa_bookings.booking_date` or `service_date`?

#### Investigation Required

1. Does `spa_bookings` table exist?
2. Does it have `booking_date` (when booking was made) vs `service_date` (when service occurred)?
3. For financial document_date, which is correct? (typically service_date for revenue recognition)

#### Backfill Strategy (CONDITIONAL)

```sql
-- IF spa_bookings.service_date exists
UPDATE finance_transactions f1
SET 
    document_date = sb.service_date,
    backfill_inferred = TRUE,
    backfill_source = 'spa_bookings.service_date'
FROM spa_bookings sb
WHERE f1.source_type = 'SPA_BOOKING'
  AND f1.source_id = sb.id::TEXT
  AND f1.tenant_id = sb.tenant_id
  AND f1.document_date IS NULL;
```

**Risk:** MEDIUM — Service date vs booking date semantic must be clarified.

---

## 5. UNKNOWABLE Classification

### 5.1 Test Data → No Business Provenance

**Source Types:** `CONCURRENCY_TEST`, `VERIFICATION`, `F2_REGRESSION`, `test`  
**Record Count:** 167 (25%)  
**Reason:** Test artifacts with no business source document

#### Backfill Strategy

```sql
-- Option A: Keep NULL with explicit flag
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
);

-- Option B: Use posted_at::date WITH EXPLICIT TEST FLAG
UPDATE finance_transactions
SET 
    document_date = posted_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'posted_at (test data only)'
WHERE source_type IN (
    'CONCURRENCY_TEST',
    'VERIFICATION',
    'F2_REGRESSION',
    'test'
);
```

**Recommendation:** Option A (keep NULL) for test data cleanup consideration.

**Risk:** LOW — Test data does not affect production accounting semantics.

---

## 6. Backfill Schema Design

### 6.1 Required Metadata Fields

Add to `finance_transactions`:

```sql
ALTER TABLE finance_transactions
ADD COLUMN IF NOT EXISTS backfill_inferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_classification TEXT CHECK (
    backfill_classification IN ('PROVABLE', 'INFERABLE', 'UNKNOWABLE')
),
ADD COLUMN IF NOT EXISTS backfill_source TEXT,
ADD COLUMN IF NOT EXISTS backfill_reason TEXT;
```

**Purpose:**
- `backfill_inferred`: Flag records where document_date was policy-derived (not provable)
- `backfill_classification`: Audit trail of provenance strength
- `backfill_source`: Which field/table was used for backfill
- `backfill_reason`: Human-readable explanation for UNKNOWABLE cases

### 6.2 Backfill Audit Queries

```sql
-- Provenance distribution after backfill
SELECT 
    backfill_classification,
    COUNT(*) AS record_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM finance_transactions
WHERE lifecycle_state = 'POSTED'
GROUP BY backfill_classification;

-- Inferred records for audit review
SELECT 
    id,
    source_type,
    document_date,
    backfill_source,
    backfill_reason
FROM finance_transactions
WHERE backfill_inferred = TRUE
ORDER BY created_at DESC
LIMIT 100;
```

---

## 7. Investigation Tasks for INFERABLE Sources

### 7.1 SALES_ORDER (208 records, 31%)

**Required Investigation:**
1. Schema query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sales_orders';`
2. Identify date fields: `order_date`, `booking_date`, `created_at`?
3. Semantic validation: Which date represents "document date" for financial purposes?
4. Sample data review: Check if date fields are populated

**Outcome:** Upgrade to PROVABLE or downgrade to UNKNOWABLE

---

### 7.2 AP_PAYMENT (74 records, 11%)

**Required Investigation:**
1. Schema query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'finance_payments';`
2. Identify date fields: `payment_date`, `execution_date`, `value_date`?
3. Semantic distinction: Payment instruction date vs bank execution date vs document date
4. TT99 compliance: Which date satisfies "ngày chứng từ"?

**Outcome:** Define explicit backfill policy with semantic justification

---

### 7.3 F2_CASH (67 records, 10%)

**Required Investigation:**
1. Analyze `F2.effective_date` provenance: Was it manually set or auto-copied from `F1.posted_at`?
2. Query: `SELECT COUNT(*) FROM finance_transactions f1 JOIN finance_cash_movements f2 ON f2.transaction_id = f1.id WHERE f1.posted_at::date = f2.effective_date::date;`
3. If majority match → UNKNOWABLE (no independent provenance)
4. If minority match → INFERABLE (from manually set effective_date)

**Outcome:** Conditional backfill based on date match analysis

---

### 7.4 SPA_BOOKING (31 records, 5%)

**Required Investigation:**
1. Schema query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'spa_bookings';`
2. Identify: `booking_date` vs `service_date` vs `check_in_date`?
3. Revenue recognition policy: Which date determines document_date?
4. Sample data: Are these dates different or always same?

**Outcome:** Define service-date-based backfill policy

---

## 8. Backfill Impact Estimate

### 8.1 Records by Classification

| Classification | Record Count | Backfill Strategy |
|----------------|--------------|-------------------|
| **PROVABLE** | 128 (19%) | Direct backfill with validation |
| **INFERABLE** | 380 (56%) | Policy-based backfill + flag (pending investigation) |
| **UNKNOWABLE** | 167 (25%) | NULL or manual review |

### 8.2 Backfill Execution Order

1. **Phase 1:** PROVABLE (F3_AR_INVOICE) — 128 records — LOW RISK
2. **Phase 2:** INFERABLE investigation (SALES_ORDER, AP_PAYMENT, SPA_BOOKING) — complete schema/semantic validation
3. **Phase 3:** F2_CASH analysis (effective_date provenance verification) — HIGH RISK
4. **Phase 4:** UNKNOWABLE decision (test data cleanup vs flagging) — LOW RISK

---

## 9. Decision Gates Before Backfill Execution

### Gate 1: Schema Investigation Complete

- [ ] SALES_ORDER: Source table and date field identified ✅/❌
- [ ] AP_PAYMENT: Payment date semantic defined ✅/❌
- [ ] SPA_BOOKING: Service date vs booking date decided ✅/❌
- [ ] F2_CASH: effective_date provenance verified ✅/❌

### Gate 2: Backfill Metadata Schema Approved

- [ ] Metadata columns added to F1 (`backfill_inferred`, `backfill_classification`, etc.)
- [ ] Human Architect approval for schema change

### Gate 3: Backfill Execution Plan Approved

- [ ] Source-specific backfill SQL reviewed
- [ ] Dry-run execution completed
- [ ] Rollback plan documented

---

## 10. Open Questions for Human Architect

1. **INFERABLE Policy Acceptance:** Do you approve using policy-based inference with explicit `backfill_inferred` flag?
2. **UNKNOWABLE Test Data:** Should test data remain NULL or backfill with `posted_at::date` + test flag?
3. **F2_CASH Risk:** Given historical F2.effective_date may inherit posted_at incorrectly, should we classify F2_CASH as UNKNOWABLE until posted_at semantic forensic (Phase 3.6) completes?
4. **Backfill Metadata Schema:** Approve adding 4 backfill audit columns to `finance_transactions`?

---

## 11. Next Steps (Phase 3.5 Continuation)

1. ✅ **Task 3 COMPLETE:** document_date provenance classified
2. ⏭️ **Task 4 NEXT:** accounting_date provenance classification
3. ⏭️ **Task 5:** posted_at semantic forensic (overlaps with F2_CASH decision)
4. ⏭️ **Task 6:** posted_at vs created_at vs document dates validation
5. ⏭️ **Task 7:** Source-type-specific backfill rules design
6. ⏭️ **Task 8:** Backfill classification matrix
7. ⏭️ **Task 9:** Anti-patterns documentation
8. ⏭️ **Task 10:** Backfill impact estimate
9. ⏭️ **Task 11:** `PHASE3_BACKFILL_POLICY.md` (consolidated document)

---

## Appendix A: Provenance Evidence Chain

```
F1 Transaction
    ↓
source_type + source_id
    ↓
Source Table Lookup
    ↓
Date Field Exists?
    ↓
┌───YES────┐       ┌───NO────┐
│          │       │         │
↓          ↓       ↓         ↓
Field has  Field   No date   created_at
explicit   generic field     only
semantic   semantic         
│          │       │         │
↓          ↓       ↓         ↓
PROVABLE   INFERABLE UNKNOWABLE INFERABLE
                              (policy)
```

---

**Document Status:** ✅ COMPLETE  
**Approval Required:** 🔴 BLOCKED on Human Architect review  
**Implementation Blocked:** ❌ M-F1-DATES NOT APPROVED YET
