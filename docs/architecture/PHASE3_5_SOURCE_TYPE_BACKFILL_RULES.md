# Phase 3.5: Source-Type-Specific Backfill Rules

**Status:** ✅ ANALYSIS COMPLETE  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Governance:** Provenance Over Convenience

---

## Executive Summary

This document defines **source-type-specific backfill rules** for 675 POSTED F1 transactions, applying strict provenance-based governance to prevent semantic contamination.

**Governance Principles:**
1. ❌ **No provenance → No backfill**
2. ❌ **Ambiguous provenance → Preserve NULL**
3. ✅ **Inferable provenance → Backfill only with explicit, documented inference rule**
4. ❌ **posted_at → NEVER use as document_date or accounting_date fallback**

**Key Decision:** F2_CASH classification downgraded from INFERABLE to **UNKNOWABLE** (Task 5 finding: F2.effective_date has no independent provenance).

---

## 1. Backfill Rule Framework

```
Source Type
    ↓
Provenance Analysis (Tasks 3-5)
    ↓
┌────────┼────────┐
↓        ↓        ↓
PROVABLE  INFERABLE  UNKNOWABLE
    ↓        ↓        ↓
Direct   Policy-based  Preserve NULL
Backfill Backfill +    or Manual Review
         Flag
```

### 1.1 Rule Components

Each source-type-specific rule must specify:

1. **document_date Rule:**
   - Classification: PROVABLE / INFERABLE / UNKNOWABLE
   - Source: Exact table.column or inference policy
   - Validation: Required checks before backfill
   - Risk Level: LOW / MEDIUM / HIGH / VERY HIGH

2. **accounting_date Rule:**
   - Classification: PROVABLE / INFERABLE / UNKNOWABLE
   - Source: Explicit field or policy (cash basis / accrual basis)
   - Dependency: document_date backfill completion (if policy = document_date)
   - Risk Level: LOW / MEDIUM / HIGH / VERY HIGH

3. **Backfill Metadata:**
   - `backfill_inferred`: TRUE (policy-based) / FALSE (provable)
   - `backfill_classification`: PROVABLE / INFERABLE / UNKNOWABLE
   - `backfill_source`: Source table.column or policy description
   - `backfill_reason`: Human-readable explanation

---

## 2. Source Type: F3_AR_INVOICE (128 records, 19%)

### 2.1 document_date Rule

**Classification:** **PROVABLE**

**Source:** `finance_invoices.issue_date`

**Backfill SQL:**
```sql
UPDATE finance_transactions f1
SET 
    document_date = fi.issue_date,
    backfill_inferred = FALSE,
    backfill_classification = 'PROVABLE',
    backfill_source = 'finance_invoices.issue_date',
    backfill_reason = 'Direct mapping from invoice issue date'
FROM finance_invoices fi
WHERE f1.source_type = 'F3_AR_INVOICE'
  AND f1.source_id = fi.id::TEXT
  AND f1.tenant_id = fi.tenant_id
  AND f1.lifecycle_state = 'POSTED'
  AND f1.document_date IS NULL;
```

**Validation Required:**
```sql
-- 1. Verify source_id linkage exists
SELECT COUNT(*) AS orphan_count
FROM finance_transactions f1
LEFT JOIN finance_invoices fi 
    ON f1.source_id = fi.id::TEXT 
    AND f1.tenant_id = fi.tenant_id
WHERE f1.source_type = 'F3_AR_INVOICE'
  AND f1.lifecycle_state = 'POSTED'
  AND fi.id IS NULL;
-- Expected: 0 (no orphans)

-- 2. Verify issue_date is NOT NULL
SELECT COUNT(*) AS null_issue_date_count
FROM finance_transactions f1
JOIN finance_invoices fi 
    ON f1.source_id = fi.id::TEXT 
    AND f1.tenant_id = fi.tenant_id
WHERE f1.source_type = 'F3_AR_INVOICE'
  AND f1.lifecycle_state = 'POSTED'
  AND fi.issue_date IS NULL;
-- Expected: 0 (all invoices have issue_date)
```

**Risk Level:** **LOW**

---

### 2.2 accounting_date Rule

**Classification:** **INFERABLE (Cash Basis Policy)**

**Source:** `document_date` (after Task 7.1 backfill)

**Accounting Policy Assumption:** Cash basis (accounting_date = document_date)

**Backfill SQL:**
```sql
-- PREREQUISITE: document_date backfill complete (Task 7.1)
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date'
WHERE source_type = 'F3_AR_INVOICE'
  AND lifecycle_state = 'POSTED'
  AND document_date IS NOT NULL
  AND accounting_date IS NULL;
```

**Human Architect Decision Required:**
- [ ] Confirm F3_AR_INVOICE uses **cash basis** (revenue recognized on invoice date)
- [ ] OR accrual basis (revenue recognized on delivery/fulfillment date)?

**Alternative Rule (Accrual Basis):**
```sql
-- IF accrual basis: requires delivery_date from source table
-- Requires investigation: Does finance_invoices have delivery_date?
-- IF NOT → accounting_date remains UNKNOWABLE for accrual accounting
```

**Risk Level:** **MEDIUM** (depends on accounting policy validation)

---

## 3. Source Type: SALES_ORDER (208 records, 31%)

### 3.1 document_date Rule

**Classification:** **INFERABLE (Requires Investigation)**

**Source:** Unknown — requires business table schema investigation

**Investigation Required:**
1. Does `sales_orders` table exist?
2. Schema query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sales_orders';`
3. Identify date fields: `order_date`, `booking_date`, `created_at`?
4. Semantic validation: Which date represents "document date"?

**Backfill SQL (CONDITIONAL):**
```sql
-- IF sales_orders.order_date exists with document date semantic:
UPDATE finance_transactions f1
SET 
    document_date = so.order_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'sales_orders.order_date',
    backfill_reason = 'Order date used as document date'
FROM sales_orders so
WHERE f1.source_type = 'SALES_ORDER'
  AND f1.source_id = so.id::TEXT
  AND f1.tenant_id = so.tenant_id
  AND f1.lifecycle_state = 'POSTED'
  AND f1.document_date IS NULL;
```

**Alternative (No Date Field):**
```sql
-- IF sales_orders has NO explicit date field:
UPDATE finance_transactions
SET 
    document_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'SALES_ORDER: No source table date field available'
WHERE source_type = 'SALES_ORDER'
  AND lifecycle_state = 'POSTED';
```

**Risk Level:** **MEDIUM** (pending investigation)

**Status:** 🔴 **BLOCKED on schema investigation**

---

### 3.2 accounting_date Rule

**Classification:** **INFERABLE (Cash Basis Policy, depends on document_date)**

**Source:** `document_date` (after Task 7.1 investigation & backfill)

**Backfill SQL:**
```sql
-- PREREQUISITE: document_date backfill complete
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis policy: accounting_date = document_date'
WHERE source_type = 'SALES_ORDER'
  AND lifecycle_state = 'POSTED'
  AND document_date IS NOT NULL
  AND accounting_date IS NULL;
```

**Risk Level:** **MEDIUM** (depends on document_date investigation + accounting policy)

**Status:** 🔴 **BLOCKED on document_date investigation + Human Architect policy decision**

---

## 4. Source Type: AP_PAYMENT (74 records, 11%)

### 4.1 document_date Rule

**Classification:** **INFERABLE (Requires Investigation)**

**Source:** Unknown — requires `finance_payments` schema investigation

**Investigation Required:**
1. Schema query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'finance_payments';`
2. Identify date fields: `payment_date`, `execution_date`, `value_date`, `requested_date`?
3. Semantic validation: Which date represents "payment document date"?

**Payment Date Semantics:**
- **Payment instruction date:** When payment was requested (document date candidate)
- **Payment execution date:** When bank processed payment (accounting date candidate)
- **Value date:** When payment affects account balance (accounting date candidate)

**Backfill SQL (CONDITIONAL):**
```sql
-- IF finance_payments.payment_date exists:
UPDATE finance_transactions f1
SET 
    document_date = fp.payment_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'finance_payments.payment_date',
    backfill_reason = 'Payment instruction date as document date'
FROM finance_payments fp
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = fp.id::TEXT
  AND f1.tenant_id = fp.tenant_id
  AND f1.lifecycle_state = 'POSTED'
  AND f1.document_date IS NULL;
```

**Risk Level:** **HIGH** (payment date semantic varies by jurisdiction)

**Status:** 🔴 **BLOCKED on schema investigation + semantic validation**

---

### 4.2 accounting_date Rule

**Classification:** **INFERABLE (Execution Date or Cash Basis)**

**Source:** `finance_payments.execution_date` (preferred) OR `document_date` (fallback)

**Accounting Policy Question:**
- **Accrual basis:** accounting_date = execution_date (when bank processed)
- **Cash basis:** accounting_date = document_date (payment instruction date)

**Backfill SQL (Accrual Basis - Preferred):**
```sql
-- IF finance_payments.execution_date exists:
UPDATE finance_transactions f1
SET 
    accounting_date = fp.execution_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'finance_payments.execution_date',
    backfill_reason = 'Accrual basis: accounting recognized on bank execution date'
FROM finance_payments fp
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = fp.id::TEXT
  AND f1.tenant_id = fp.tenant_id
  AND f1.lifecycle_state = 'POSTED'
  AND f1.accounting_date IS NULL;
```

**Backfill SQL (Cash Basis - Fallback):**
```sql
-- IF no execution_date, use document_date:
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Cash basis: accounting_date = document_date (payment instruction)'
WHERE source_type = 'AP_PAYMENT'
  AND lifecycle_state = 'POSTED'
  AND document_date IS NOT NULL
  AND accounting_date IS NULL;
```

**Risk Level:** **HIGH** (payment accounting varies by jurisdiction and policy)

**Status:** 🔴 **BLOCKED on schema investigation + Human Architect accounting policy decision**

---

## 5. Source Type: F2_CASH (67 records, 10%)

### 5.1 document_date Rule

**Classification:** **UNKNOWABLE** (Task 5 Finding)

**Reason:** F2.effective_date has NO independent provenance (100% auto-copied from ambiguous F1.posted_at)

**Evidence:** Task 5 forensic analysis:
- Migration M1 backfilled `F2.effective_date = F1.posted_at`
- F1.posted_at has INCONSISTENT semantic (test data = business date, Phase 3.2 = system timestamp)
- No manual overrides exist (100% match by migration design)

**Backfill Rule:** **PRESERVE NULL**

```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance (effective_date inherited from ambiguous posted_at)'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```

**Alternative Options (Human Architect Decision Required):**

**Option A (RECOMMENDED): Preserve NULL**
- Honest semantic (no false provenance)
- Forces manual review for critical records
- Conflicts with Phase 3.4 POSTED NOT NULL constraint (requires resolution)

**Option B: Use posted_at with EXPLICIT RISK FLAG**
```sql
UPDATE finance_transactions
SET 
    document_date = posted_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'posted_at (RISK: ambiguous semantic)',
    backfill_reason = 'F2_CASH: No provenance, used posted_at as last resort'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```
- Achieves NOT NULL constraint
- **Violates "Provenance Over Convenience" principle**
- Propagates semantic ambiguity

**Option C: Manual Review Required**
```sql
UPDATE finance_transactions
SET 
    backfill_classification = 'MANUAL_REVIEW_REQUIRED',
    backfill_reason = 'F2_CASH: Insufficient provenance for automatic backfill'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```
- Allows business context review per record
- Requires manual effort for 67 records

**Risk Level:** **VERY HIGH** (no provenance, inherited from ambiguous source)

**Status:** 🔴 **BLOCKED on Human Architect decision (Option A/B/C)**

---

### 5.2 accounting_date Rule

**Classification:** **UNKNOWABLE** (same reason as document_date)

**Reason:** F2.effective_date has no independent provenance

**Backfill Rule:** **PRESERVE NULL** (Option A)

```sql
UPDATE finance_transactions
SET 
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance for accounting_date'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```

**Alternative (Option B): Use posted_at with risk flag**
```sql
UPDATE finance_transactions
SET 
    accounting_date = posted_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'posted_at (RISK: ambiguous semantic)',
    backfill_reason = 'F2_CASH: No provenance, used posted_at as last resort'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```

**Risk Level:** **VERY HIGH**

**Status:** 🔴 **BLOCKED on Human Architect decision**

---

## 6. Source Type: SPA_BOOKING (31 records, 5%)

### 6.1 document_date Rule

**Classification:** **INFERABLE (Requires Investigation)**

**Source:** Unknown — requires `spa_bookings` schema investigation

**Investigation Required:**
1. Does `spa_bookings` table exist?
2. Schema query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'spa_bookings';`
3. Identify date fields: `booking_date`, `service_date`, `check_in_date`?
4. Semantic validation: Which date represents "document date"?

**Business Context:**
- `booking_date`: When customer made booking (prepayment document date)
- `service_date`: When service was performed (service delivery date)

**Recommendation:** `service_date` as document_date (service delivery = transaction event)

**Backfill SQL (CONDITIONAL):**
```sql
-- IF spa_bookings.service_date exists:
UPDATE finance_transactions f1
SET 
    document_date = sb.service_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'spa_bookings.service_date',
    backfill_reason = 'Service date as transaction document date'
FROM spa_bookings sb
WHERE f1.source_type = 'SPA_BOOKING'
  AND f1.source_id = sb.id::TEXT
  AND f1.tenant_id = sb.tenant_id
  AND f1.lifecycle_state = 'POSTED'
  AND f1.document_date IS NULL;
```

**Risk Level:** **MEDIUM** (pending semantic validation)

**Status:** 🔴 **BLOCKED on schema investigation**

---

### 6.2 accounting_date Rule

**Classification:** **INFERABLE (Accrual Basis - Service Date)**

**Source:** `document_date` (service_date after Task 6.1 backfill)

**Accounting Policy:** Accrual basis (revenue recognized when service performed, not when booking made)

**Backfill SQL:**
```sql
-- PREREQUISITE: document_date backfill complete
UPDATE finance_transactions
SET 
    accounting_date = document_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'document_date',
    backfill_reason = 'Accrual basis: revenue recognized on service date'
WHERE source_type = 'SPA_BOOKING'
  AND lifecycle_state = 'POSTED'
  AND document_date IS NOT NULL
  AND accounting_date IS NULL;
```

**Risk Level:** **MEDIUM** (depends on revenue recognition policy validation)

**Status:** 🔴 **BLOCKED on document_date investigation + Human Architect policy decision**

---

## 7. Source Type: Test Data (167 records, 25%)

### 7.1 Affected Source Types

- `CONCURRENCY_TEST` (102 records, 15%)
- `VERIFICATION` (35 records, 5%)
- `F2_REGRESSION` (18 records, 3%)
- `test` (12 records, 2%)

### 7.2 document_date Rule

**Classification:** **UNKNOWABLE**

**Reason:** Test artifacts with no business source document

**Backfill Rule:** **PRESERVE NULL**

```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'Test artifact - no business source document'
WHERE source_type IN (
    'CONCURRENCY_TEST',
    'VERIFICATION',
    'F2_REGRESSION',
    'test'
)
AND lifecycle_state = 'POSTED';
```

**Alternative (Test Continuity):**
```sql
-- IF test continuity requires dates, use posted_at with explicit test flag:
UPDATE finance_transactions
SET 
    document_date = posted_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'posted_at (test data only)',
    backfill_reason = 'Test artifact: posted_at used for test continuity'
WHERE source_type IN (
    'CONCURRENCY_TEST',
    'VERIFICATION',
    'F2_REGRESSION',
    'test'
)
AND lifecycle_state = 'POSTED';
```

**Risk Level:** **LOW** (test data does not affect production semantics)

**Recommendation:** Preserve NULL or consider test data cleanup (Phase 2.5-style)

---

### 7.3 accounting_date Rule

**Classification:** **UNKNOWABLE**

**Backfill Rule:** **PRESERVE NULL** or use document_date if backfilled

```sql
-- Option 1: Preserve NULL
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
)
AND lifecycle_state = 'POSTED';

-- Option 2: Use document_date (if backfilled for test continuity)
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
AND lifecycle_state = 'POSTED'
AND document_date IS NOT NULL
AND accounting_date IS NULL;
```

**Risk Level:** **LOW**

---

## 8. Backfill Execution Order

### 8.1 Dependency Chain

```
Step 1: PROVABLE backfill (F3_AR_INVOICE document_date)
    ↓
Step 2: Schema Investigation (SALES_ORDER, AP_PAYMENT, SPA_BOOKING)
    ↓
Step 3: Human Architect Decisions
    ├─ Accounting Policy (cash vs accrual)
    ├─ F2_CASH strategy (Option A/B/C)
    └─ Test data strategy (preserve NULL vs backfill)
    ↓
Step 4: INFERABLE backfill (document_date for investigated sources)
    ↓
Step 5: accounting_date backfill (policy-based from document_date)
    ↓
Step 6: UNKNOWABLE handling (F2_CASH, test data)
    ↓
Step 7: Verification & Audit
```

### 8.2 Critical Path Blockers

🔴 **BLOCKED:**
1. Schema investigation (SALES_ORDER, AP_PAYMENT, SPA_BOOKING)
2. Human Architect accounting policy decision (cash vs accrual)
3. Human Architect F2_CASH strategy decision (Option A/B/C)
4. Human Architect test data strategy decision

✅ **READY TO EXECUTE:**
1. F3_AR_INVOICE document_date backfill (PROVABLE, LOW RISK)

---

## 9. Backfill Metadata Schema (Reminder)

```sql
ALTER TABLE finance_transactions
ADD COLUMN IF NOT EXISTS backfill_inferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_classification TEXT CHECK (
    backfill_classification IN ('PROVABLE', 'INFERABLE', 'UNKNOWABLE', 'MANUAL_REVIEW_REQUIRED')
),
ADD COLUMN IF NOT EXISTS backfill_source TEXT,
ADD COLUMN IF NOT EXISTS backfill_reason TEXT;
```

**Purpose:**
- Audit trail of backfill provenance strength
- Flag policy-based inferences vs provable mappings
- Document reasoning for manual review or NULL preservation

---

## 10. Validation Queries (Post-Backfill)

### 10.1 Provenance Distribution

```sql
SELECT 
    backfill_classification,
    COUNT(*) AS record_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM finance_transactions
WHERE lifecycle_state = 'POSTED'
GROUP BY backfill_classification
ORDER BY record_count DESC;
```

### 10.2 INFERABLE Records Audit

```sql
SELECT 
    source_type,
    backfill_source,
    COUNT(*) AS inferred_count
FROM finance_transactions
WHERE lifecycle_state = 'POSTED'
  AND backfill_inferred = TRUE
GROUP BY source_type, backfill_source
ORDER BY inferred_count DESC;
```

### 10.3 UNKNOWABLE Records Review

```sql
SELECT 
    source_type,
    COUNT(*) AS unknowable_count,
    backfill_reason
FROM finance_transactions
WHERE lifecycle_state = 'POSTED'
  AND backfill_classification = 'UNKNOWABLE'
GROUP BY source_type, backfill_reason
ORDER BY unknowable_count DESC;
```

### 10.4 NULL Constraint Compliance

```sql
-- Check POSTED records with NULL dates (after backfill)
SELECT 
    source_type,
    COUNT(*) AS null_document_date,
    COUNT(*) FILTER (WHERE accounting_date IS NULL) AS null_accounting_date
FROM finance_transactions
WHERE lifecycle_state = 'POSTED'
  AND (document_date IS NULL OR accounting_date IS NULL)
GROUP BY source_type;
```

---

## 11. Open Questions for Human Architect

### Q1: Accounting Policy Confirmation

**Does Bella use:**
- [ ] Cash basis (accounting_date = document_date for most transaction types)
- [ ] Accrual basis (separate recognition logic per transaction type)
- [ ] Hybrid (cash for some types, accrual for others)

**Impact:** Affects accounting_date backfill rules for all source types

---

### Q2: F2_CASH Strategy

**Given F2.effective_date has NO independent provenance:**
- [ ] **Option A (RECOMMENDED):** Preserve NULL, relax POSTED NOT NULL constraint
- [ ] **Option B:** Use posted_at with explicit UNKNOWABLE + risk flag
- [ ] **Option C:** Require manual review for all 67 F2_CASH records

**Impact:** 67 records (10% of POSTED transactions)

---

### Q3: Schema Investigation Priority

**Which source types should be investigated first?**
- [ ] SALES_ORDER (208 records, 31% — highest volume)
- [ ] AP_PAYMENT (74 records, 11% — financial compliance)
- [ ] SPA_BOOKING (31 records, 5% — lowest volume)

**Recommendation:** SALES_ORDER (highest impact)

---

### Q4: Test Data Strategy

**For 167 test records:**
- [ ] Preserve NULL (honest semantic)
- [ ] Backfill with posted_at for test continuity (UNKNOWABLE classification)
- [ ] Delete test data (Phase 2.5-style cleanup)

**Impact:** 25% of POSTED transactions

---

## 12. Summary

| Source Type | Records | document_date | accounting_date | Risk | Status |
|-------------|---------|---------------|-----------------|------|--------|
| F3_AR_INVOICE | 128 (19%) | PROVABLE | INFERABLE (cash) | LOW/MEDIUM | ✅ READY |
| SALES_ORDER | 208 (31%) | INFERABLE | INFERABLE (cash) | MEDIUM | 🔴 BLOCKED |
| AP_PAYMENT | 74 (11%) | INFERABLE | INFERABLE (exec) | HIGH | 🔴 BLOCKED |
| F2_CASH | 67 (10%) | **UNKNOWABLE** | **UNKNOWABLE** | VERY HIGH | 🔴 BLOCKED |
| SPA_BOOKING | 31 (5%) | INFERABLE | INFERABLE (accrual) | MEDIUM | 🔴 BLOCKED |
| Test Data | 167 (25%) | UNKNOWABLE | UNKNOWABLE | LOW | 🔴 DECISION |

**Total PROVABLE:** 128 (19%)  
**Total INFERABLE:** 313 (46%) — pending investigation + policy decision  
**Total UNKNOWABLE:** 234 (35%) — F2_CASH + test data

---

**Document Status:** ✅ COMPLETE  
**Next Step:** Task 8 (Backfill Classification Matrix)  
**Approval Required:** 🔴 BLOCKED on Human Architect decisions (Q1-Q4)  
**Implementation Blocked:** ❌ M-F1-DATES NOT APPROVED YET
