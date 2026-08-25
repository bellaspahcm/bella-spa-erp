# Phase 3.5: Backfill Classification Matrix

**Status:** ✅ ANALYSIS COMPLETE  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Governance:** Provenance Over Convenience

---

## Executive Summary

This matrix consolidates provenance classification for 675 POSTED F1 transactions across 3 date fields (`document_date`, `accounting_date`, `posted_at`) and 9 source types.

**Key Metrics:**
- **PROVABLE:** 128 records (19%) — direct field mapping with semantic guarantee
- **INFERABLE:** 313 records (46%) — policy-based reconstruction (BLOCKED on investigation + decisions)
- **UNKNOWABLE:** 234 records (35%) — insufficient evidence or ambiguous provenance

**Critical Finding:** Only 19% of historical data has provable date provenance. The remaining 81% requires policy inference or preserving NULL.

---

## 1. Master Classification Matrix

| Source Type | Records | % | document_date | accounting_date | posted_at | Status |
|-------------|---------|---|---------------|-----------------|-----------|--------|
| **F3_AR_INVOICE** | 128 | 19% | **PROVABLE** (LOW) | INFERABLE (MED) | System TS | ✅ READY |
| **SALES_ORDER** | 208 | 31% | INFERABLE (MED) | INFERABLE (MED) | System TS | 🔴 BLOCKED |
| **CONCURRENCY_TEST** | 102 | 15% | UNKNOWABLE (LOW) | UNKNOWABLE (LOW) | Caller | 🔴 DECISION |
| **AP_PAYMENT** | 74 | 11% | INFERABLE (HIGH) | INFERABLE (HIGH) | System TS | 🔴 BLOCKED |
| **F2_CASH** | 67 | 10% | **UNKNOWABLE** (VERY HIGH) | **UNKNOWABLE** (VERY HIGH) | Ambiguous | 🔴 BLOCKED |
| **VERIFICATION** | 35 | 5% | UNKNOWABLE (LOW) | UNKNOWABLE (LOW) | Caller | 🔴 DECISION |
| **SPA_BOOKING** | 31 | 5% | INFERABLE (MED) | INFERABLE (MED) | System TS | 🔴 BLOCKED |
| **F2_REGRESSION** | 18 | 3% | UNKNOWABLE (LOW) | UNKNOWABLE (LOW) | Caller | 🔴 DECISION |
| **test** | 12 | 2% | UNKNOWABLE (LOW) | UNKNOWABLE (LOW) | Caller | 🔴 DECISION |
| **TOTAL** | **675** | **100%** | — | — | — | — |

**Legend:**
- **PROVABLE:** Direct field mapping with semantic guarantee
- **INFERABLE:** Policy-based reconstruction with explicit inference rule
- **UNKNOWABLE:** Insufficient evidence or ambiguous provenance
- **(Risk Level):** LOW / MEDIUM / HIGH / VERY HIGH
- **Status:** ✅ READY / 🔴 BLOCKED / 🔴 DECISION

---

## 2. Classification Distribution Summary

### 2.1 By Classification Type

| Classification | document_date | accounting_date | Combined Unique Records |
|----------------|---------------|-----------------|-------------------------|
| **PROVABLE** | 128 (19%) | 0 (0%) | 128 (19%) |
| **INFERABLE** | 313 (46%) | 441 (65%) | 313 (46%)* |
| **UNKNOWABLE** | 234 (35%) | 234 (35%) | 234 (35%) |

*Combined unique: Records where EITHER document_date OR accounting_date is INFERABLE

**Key Insight:** `accounting_date` has ZERO provable sources — it's a NEW semantic field introduced by Phase 3.2.

---

### 2.2 By Risk Level

| Risk Level | Records | % | Source Types |
|------------|---------|---|--------------|
| **LOW** | 167 | 25% | Test data (CONCURRENCY_TEST, VERIFICATION, F2_REGRESSION, test) |
| **MEDIUM** | 367 | 54% | F3_AR_INVOICE (accounting_date), SALES_ORDER, SPA_BOOKING |
| **HIGH** | 74 | 11% | AP_PAYMENT |
| **VERY HIGH** | 67 | 10% | F2_CASH (no provenance) |

**Highest Risk:** F2_CASH (67 records) — requires immediate Human Architect decision.

---

### 2.3 By Execution Readiness

| Status | Records | % | Description |
|--------|---------|---|-------------|
| ✅ **READY** | 128 | 19% | F3_AR_INVOICE document_date (PROVABLE) |
| 🔴 **BLOCKED** | 380 | 56% | Requires schema investigation (SALES_ORDER, AP_PAYMENT, SPA_BOOKING) OR F2_CASH decision |
| 🔴 **DECISION** | 167 | 25% | Test data — preserve NULL or backfill? |

**Only 19% ready to execute** without additional investigation or decisions.

---

## 3. Detailed Classification Matrix

### 3.1 F3_AR_INVOICE (128 records, 19%)

| Field | Classification | Source | Risk | Dependency | Ready? |
|-------|----------------|--------|------|------------|--------|
| **document_date** | **PROVABLE** | `finance_invoices.issue_date` | LOW | None | ✅ YES |
| **accounting_date** | INFERABLE | `document_date` (cash basis) | MEDIUM | Q1: Accounting policy | 🔴 NO |
| **posted_at** | System TS | `CURRENT_TIMESTAMP` (Phase 3.2) | N/A | N/A | ✅ YES |

**Backfill SQL (document_date):**
```sql
UPDATE finance_transactions f1
SET 
    document_date = fi.issue_date,
    backfill_inferred = FALSE,
    backfill_classification = 'PROVABLE',
    backfill_source = 'finance_invoices.issue_date'
FROM finance_invoices fi
WHERE f1.source_type = 'F3_AR_INVOICE'
  AND f1.source_id = fi.id::TEXT
  AND f1.tenant_id = fi.tenant_id
  AND f1.lifecycle_state = 'POSTED'
  AND f1.document_date IS NULL;
```

**Validation Required:**
- Verify no orphans: `finance_transactions.source_id` → `finance_invoices.id` linkage valid
- Verify `finance_invoices.issue_date IS NOT NULL` for all records

**Blockers:**
- document_date: ✅ NONE
- accounting_date: 🔴 Q1 (accounting policy: cash vs accrual)

---

### 3.2 SALES_ORDER (208 records, 31%)

| Field | Classification | Source | Risk | Dependency | Ready? |
|-------|----------------|--------|------|------------|--------|
| **document_date** | INFERABLE | `sales_orders.order_date`? | MEDIUM | Schema investigation | 🔴 NO |
| **accounting_date** | INFERABLE | `document_date` (cash basis) | MEDIUM | document_date + Q1 | 🔴 NO |
| **posted_at** | System TS | `CURRENT_TIMESTAMP` (Phase 3.2) | N/A | N/A | ✅ YES |

**Investigation Required:**
1. Does `sales_orders` table exist?
2. Schema query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_orders';`
3. Identify date field: `order_date`, `booking_date`, `created_at`?
4. Semantic validation: Which date = "document date"?

**Conditional Backfill (IF order_date exists):**
```sql
UPDATE finance_transactions f1
SET 
    document_date = so.order_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'sales_orders.order_date'
FROM sales_orders so
WHERE f1.source_type = 'SALES_ORDER'
  AND f1.source_id = so.id::TEXT
  AND f1.document_date IS NULL;
```

**Alternative (IF no date field):**
- Classification → UNKNOWABLE
- Preserve NULL

**Blockers:**
- document_date: 🔴 Schema investigation
- accounting_date: 🔴 document_date investigation + Q1 (accounting policy)

---

### 3.3 CONCURRENCY_TEST (102 records, 15%)

| Field | Classification | Source | Risk | Dependency | Ready? |
|-------|----------------|--------|------|------------|--------|
| **document_date** | UNKNOWABLE | Test artifact | LOW | Q4: Test data strategy | 🔴 DECISION |
| **accounting_date** | UNKNOWABLE | Test artifact | LOW | Q4: Test data strategy | 🔴 DECISION |
| **posted_at** | Caller | Caller-provided (test) | N/A | N/A | N/A |

**Backfill Options:**

**Option A (RECOMMENDED): Preserve NULL**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'Test artifact - no business source'
WHERE source_type = 'CONCURRENCY_TEST'
  AND lifecycle_state = 'POSTED';
```

**Option B: Backfill for test continuity**
```sql
UPDATE finance_transactions
SET 
    document_date = posted_at::date,
    accounting_date = posted_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'posted_at (test data only)'
WHERE source_type = 'CONCURRENCY_TEST'
  AND lifecycle_state = 'POSTED';
```

**Option C: Delete test data**
- Phase 2.5-style cleanup
- Requires Human Architect approval

**Blockers:**
- 🔴 Q4: Test data strategy decision

---

### 3.4 AP_PAYMENT (74 records, 11%)

| Field | Classification | Source | Risk | Dependency | Ready? |
|-------|----------------|--------|------|------------|--------|
| **document_date** | INFERABLE | `finance_payments.payment_date`? | HIGH | Schema investigation | 🔴 NO |
| **accounting_date** | INFERABLE | `finance_payments.execution_date`? OR `document_date` | HIGH | Schema + Q1 | 🔴 NO |
| **posted_at** | System TS | `CURRENT_TIMESTAMP` (Phase 3.2) | N/A | N/A | ✅ YES |

**Investigation Required:**
1. Schema: `SELECT column_name FROM information_schema.columns WHERE table_name = 'finance_payments';`
2. Identify: `payment_date`, `execution_date`, `value_date`, `requested_date`?
3. Semantic: Which date = document date? Which = accounting date?

**Payment Date Semantics:**
- `payment_date` / `requested_date`: Payment instruction (document date candidate)
- `execution_date` / `value_date`: Bank processing (accounting date candidate)

**Conditional Backfill (IF fields exist):**
```sql
-- document_date
UPDATE finance_transactions f1
SET 
    document_date = fp.payment_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'finance_payments.payment_date'
FROM finance_payments fp
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = fp.id::TEXT
  AND f1.document_date IS NULL;

-- accounting_date (accrual basis preferred)
UPDATE finance_transactions f1
SET 
    accounting_date = fp.execution_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'finance_payments.execution_date'
FROM finance_payments fp
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = fp.id::TEXT
  AND f1.accounting_date IS NULL;
```

**Blockers:**
- document_date: 🔴 Schema investigation + semantic validation
- accounting_date: 🔴 Schema investigation + Q1 (cash vs accrual)

**Risk Note:** Payment accounting varies by jurisdiction (TT99 compliance review required).

---

### 3.5 F2_CASH (67 records, 10%) — CRITICAL

| Field | Classification | Source | Risk | Dependency | Ready? |
|-------|----------------|--------|------|------------|--------|
| **document_date** | **UNKNOWABLE** | F2.effective_date (NO provenance) | **VERY HIGH** | Q2: F2_CASH strategy | 🔴 BLOCKED |
| **accounting_date** | **UNKNOWABLE** | F2.effective_date (NO provenance) | **VERY HIGH** | Q2: F2_CASH strategy | 🔴 BLOCKED |
| **posted_at** | Ambiguous | Test: Caller / Migration: Business date / Phase 3.2: System TS | N/A | N/A | N/A |

**Critical Finding (Task 5):**
- F2.effective_date was 100% auto-copied from F1.posted_at (Migration M1)
- F1.posted_at has INCONSISTENT semantic (ambiguous)
- **F2.effective_date has NO independent provenance**

**Circular Provenance Problem:**
```
F1.posted_at (ambiguous)
    ↓ Migration M1
F2.effective_date
    ↓ Cannot use as provenance for
F1.document_date / F1.accounting_date
    ↓ Would create circular logic
```

**Backfill Options:**

**Option A (RECOMMENDED): Preserve NULL**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance (effective_date inherited from ambiguous posted_at)'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```
- ✅ Honest semantic (no false provenance)
- ❌ Conflicts with Phase 3.4 POSTED NOT NULL constraint

**Option B: Use posted_at with EXPLICIT RISK FLAG**
```sql
UPDATE finance_transactions
SET 
    document_date = posted_at::date,
    accounting_date = posted_at::date,
    backfill_inferred = TRUE,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = 'posted_at (RISK: ambiguous semantic)',
    backfill_reason = 'F2_CASH: No provenance, used posted_at as last resort'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```
- ✅ Achieves NOT NULL constraint
- ❌ **Violates "Provenance Over Convenience" principle**
- ❌ Propagates semantic ambiguity to new date fields

**Option C: Manual Review Required**
```sql
UPDATE finance_transactions
SET 
    backfill_classification = 'MANUAL_REVIEW_REQUIRED',
    backfill_reason = 'F2_CASH: Insufficient provenance for automatic backfill'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```
- ✅ Allows business context review per record
- ❌ Requires manual effort for 67 records

**Blockers:**
- 🔴 Q2: F2_CASH strategy decision (Option A/B/C)

**Recommendation:** Option A (preserve NULL) or Option C (manual review). **Avoid Option B** unless business context confirms posted_at was consistently used as business date.

---

### 3.6 VERIFICATION (35 records, 5%)

| Field | Classification | Source | Risk | Dependency | Ready? |
|-------|----------------|--------|------|------------|--------|
| **document_date** | UNKNOWABLE | Test artifact | LOW | Q4: Test data strategy | 🔴 DECISION |
| **accounting_date** | UNKNOWABLE | Test artifact | LOW | Q4: Test data strategy | 🔴 DECISION |
| **posted_at** | Caller | Caller-provided (test) | N/A | N/A | N/A |

**Same as CONCURRENCY_TEST** — see Section 3.3 for backfill options.

---

### 3.7 SPA_BOOKING (31 records, 5%)

| Field | Classification | Source | Risk | Dependency | Ready? |
|-------|----------------|--------|------|------------|--------|
| **document_date** | INFERABLE | `spa_bookings.service_date`? | MEDIUM | Schema investigation | 🔴 NO |
| **accounting_date** | INFERABLE | `document_date` (accrual basis) | MEDIUM | document_date + Q1 | 🔴 NO |
| **posted_at** | System TS | `CURRENT_TIMESTAMP` (Phase 3.2) | N/A | N/A | ✅ YES |

**Investigation Required:**
1. Does `spa_bookings` table exist?
2. Schema: Date fields available?
3. `booking_date` vs `service_date` semantic?

**Recommendation:** `service_date` as document_date (revenue recognized when service performed, not when booked).

**Conditional Backfill (IF service_date exists):**
```sql
UPDATE finance_transactions f1
SET 
    document_date = sb.service_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'spa_bookings.service_date'
FROM spa_bookings sb
WHERE f1.source_type = 'SPA_BOOKING'
  AND f1.source_id = sb.id::TEXT
  AND f1.document_date IS NULL;
```

**Blockers:**
- document_date: 🔴 Schema investigation
- accounting_date: 🔴 document_date investigation + Q1 (accrual basis validation)

---

### 3.8 F2_REGRESSION (18 records, 3%)

**Same as CONCURRENCY_TEST** — see Section 3.3.

---

### 3.9 test (12 records, 2%)

**Same as CONCURRENCY_TEST** — see Section 3.3.

---

## 4. Consolidated Decision Matrix

### 4.1 Human Architect Decisions Required

| Decision ID | Question | Impact | Priority |
|-------------|----------|--------|----------|
| **Q1** | Accounting policy (cash vs accrual vs hybrid)? | 508 records (75%) | **HIGH** |
| **Q2** | F2_CASH strategy (Option A/B/C)? | 67 records (10%) | **CRITICAL** |
| **Q3** | Schema investigation priority (SALES_ORDER first)? | 313 records (46%) | HIGH |
| **Q4** | Test data strategy (preserve NULL / backfill / delete)? | 167 records (25%) | MEDIUM |

**Total Records Blocked on Decisions:** 675 (100%)

**Only F3_AR_INVOICE document_date** (128 records, 19%) can proceed without decisions, but accounting_date still blocked on Q1.

---

### 4.2 Investigation Priority

| Source Type | Records | Priority | Reason |
|-------------|---------|----------|--------|
| **SALES_ORDER** | 208 (31%) | **P0** | Highest volume, business-critical |
| **AP_PAYMENT** | 74 (11%) | **P1** | Financial compliance (TT99) |
| **SPA_BOOKING** | 31 (5%) | **P2** | Lowest volume |

**Recommendation:** Investigate SALES_ORDER first (largest impact).

---

## 5. Risk Assessment Matrix

### 5.1 By Source Type

| Source Type | Records | Risk Level | Risk Factors |
|-------------|---------|------------|--------------|
| F2_CASH | 67 (10%) | **VERY HIGH** | No provenance, circular logic, semantic ambiguity |
| AP_PAYMENT | 74 (11%) | **HIGH** | Payment semantic varies by jurisdiction, TT99 compliance |
| F3_AR_INVOICE (acct_date) | 128 (19%) | **MEDIUM** | Accounting policy dependency (cash vs accrual) |
| SALES_ORDER | 208 (31%) | **MEDIUM** | Schema unknown, semantic validation required |
| SPA_BOOKING | 31 (5%) | **MEDIUM** | Revenue recognition policy dependency |
| Test Data | 167 (25%) | **LOW** | Test artifacts, no production impact |

---

### 5.2 Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| **F2_CASH no provenance** | Option A (preserve NULL) or Option C (manual review) — avoid Option B |
| **Accounting policy ambiguity** | Obtain explicit Human Architect confirmation before INFERABLE backfill |
| **Schema investigation incomplete** | Block INFERABLE backfill until schema + semantic validation complete |
| **TT99 compliance (AP_PAYMENT)** | Validate payment date semantics against TT99 "ngày chứng từ" / "ngày hạch toán" requirements |
| **Semantic contamination** | Never use `posted_at` as fallback for document_date or accounting_date |

---

## 6. Execution Dependency Graph

```
Human Architect Decisions (Q1-Q4)
    │
    ├─ Q1: Accounting Policy → affects ALL accounting_date backfill
    ├─ Q2: F2_CASH Strategy → affects 67 records (10%)
    ├─ Q3: Investigation Priority → affects 313 records (46%)
    └─ Q4: Test Data Strategy → affects 167 records (25%)
    ↓
Schema Investigation (Q3)
    │
    ├─ SALES_ORDER → 208 records
    ├─ AP_PAYMENT → 74 records
    └─ SPA_BOOKING → 31 records
    ↓
PROVABLE Backfill (Ready Now)
    │
    └─ F3_AR_INVOICE document_date → 128 records
    ↓
INFERABLE Backfill (After Decisions + Investigation)
    │
    ├─ document_date (SALES_ORDER, AP_PAYMENT, SPA_BOOKING) → 313 records
    └─ accounting_date (ALL INFERABLE sources) → 441 records
    ↓
UNKNOWABLE Handling (After Q2, Q4)
    │
    ├─ F2_CASH → 67 records
    └─ Test Data → 167 records
    ↓
Verification & Audit
```

---

## 7. Phase 3.4 Nullability Constraint Conflict

### 7.1 Constraint Definition

Phase 3.4 established:
```sql
CHECK (
    (lifecycle_state = 'POSTED' 
     AND document_date IS NOT NULL 
     AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
)
```

### 7.2 Conflict with UNKNOWABLE Classification

**F2_CASH (67 records) + Test Data (167 records) = 234 records (35%)**

If Option A (preserve NULL) is chosen for F2_CASH and test data:
- 234 POSTED records will have NULL dates
- **Violates Phase 3.4 NOT NULL constraint**

### 7.3 Resolution Options

**Resolution 1: Relax constraint for UNKNOWABLE records**
```sql
CHECK (
    (lifecycle_state = 'POSTED' 
     AND (document_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE')
     AND (accounting_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE'))
    OR lifecycle_state = 'DRAFT'
)
```

**Resolution 2: Accept Option B (use posted_at with risk flag)**
- Achieves NOT NULL
- **Violates "Provenance Over Convenience" principle**

**Resolution 3: Grandfather clause for historical data**
```sql
CHECK (
    (lifecycle_state = 'POSTED' 
     AND created_at > '2026-08-24'::date  -- Future transactions only
     AND document_date IS NOT NULL 
     AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
    OR created_at <= '2026-08-24'::date  -- Historical data exempted
)
```

**Recommendation:** Resolution 1 (relax for UNKNOWABLE) or Resolution 3 (grandfather clause).

---

## 8. Verification Queries (Post-Backfill)

### 8.1 Classification Distribution

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

**Expected Result:**
- PROVABLE: 128 (19%)
- INFERABLE: 313-441 (46-65%) depending on accounting_date backfill
- UNKNOWABLE: 167-234 (25-35%) depending on F2_CASH decision

---

### 8.2 Risk Distribution

```sql
SELECT 
    source_type,
    backfill_classification,
    COUNT(*) AS record_count
FROM finance_transactions
WHERE lifecycle_state = 'POSTED'
  AND backfill_classification IN ('UNKNOWABLE', 'MANUAL_REVIEW_REQUIRED')
GROUP BY source_type, backfill_classification
ORDER BY record_count DESC;
```

**Monitor:** F2_CASH UNKNOWABLE count (should be 67 if Option A chosen).

---

### 8.3 NULL Compliance

```sql
SELECT 
    source_type,
    COUNT(*) FILTER (WHERE document_date IS NULL) AS null_document_date,
    COUNT(*) FILTER (WHERE accounting_date IS NULL) AS null_accounting_date,
    COUNT(*) AS total
FROM finance_transactions
WHERE lifecycle_state = 'POSTED'
GROUP BY source_type
HAVING COUNT(*) FILTER (WHERE document_date IS NULL OR accounting_date IS NULL) > 0;
```

**Expected:** Only UNKNOWABLE records should have NULL dates (234 max).

---

## 9. Summary Statistics

### 9.1 Overall Provenance Strength

| Metric | Value | Percentage |
|--------|-------|------------|
| **Total POSTED Records** | 675 | 100% |
| **PROVABLE (High Confidence)** | 128 | 19% |
| **INFERABLE (Medium Confidence)** | 313 | 46% |
| **UNKNOWABLE (No Confidence)** | 234 | 35% |

**Provenance Quality:** Only 19% of historical data has high-confidence provenance.

---

### 9.2 Execution Readiness

| Status | Records | Percentage | Action |
|--------|---------|------------|--------|
| ✅ **Ready Now** | 128 | 19% | F3_AR_INVOICE document_date only |
| 🔴 **Blocked on Investigation** | 313 | 46% | SALES_ORDER, AP_PAYMENT, SPA_BOOKING |
| 🔴 **Blocked on Q2 Decision** | 67 | 10% | F2_CASH strategy |
| 🔴 **Blocked on Q4 Decision** | 167 | 25% | Test data strategy |

**Only 19% ready to execute** without blockers.

---

### 9.3 Risk Profile

| Risk Level | Records | Percentage |
|------------|---------|------------|
| **VERY HIGH** | 67 | 10% |
| **HIGH** | 74 | 11% |
| **MEDIUM** | 367 | 54% |
| **LOW** | 167 | 25% |

**Critical Risk:** F2_CASH (67 records, 10%) requires immediate attention.

---

## 10. Recommendations

### 10.1 Immediate Actions

1. ✅ **Execute F3_AR_INVOICE document_date backfill** (128 records, PROVABLE, LOW RISK)
2. 🔴 **Human Architect: Decide F2_CASH strategy** (Q2) — CRITICAL
3. 🔴 **Human Architect: Confirm accounting policy** (Q1) — HIGH PRIORITY
4. 🔴 **Begin schema investigation** (Q3) — SALES_ORDER first

---

### 10.2 Governance Principles (Reminder)

1. ❌ **No provenance → No backfill**
2. ❌ **Ambiguous provenance → Preserve NULL**
3. ✅ **Inferable provenance → Backfill only with explicit, documented inference rule**
4. ❌ **posted_at → NEVER use as document_date or accounting_date fallback**

---

## 11. Next Steps

1. ✅ **Task 8 COMPLETE:** Backfill classification matrix created
2. ⏭️ **Task 9 NEXT:** Document anti-patterns (what NOT to do)
3. ⏭️ **Task 10:** Estimate backfill impact
4. ⏭️ **Task 11:** Consolidated `PHASE3_BACKFILL_POLICY.md`

---

**Document Status:** ✅ COMPLETE  
**Next Step:** Task 9 (Anti-Patterns Documentation)  
**Approval Required:** 🔴 BLOCKED on Human Architect decisions (Q1-Q4)  
**Implementation Blocked:** ❌ M-F1-DATES NOT APPROVED YET
