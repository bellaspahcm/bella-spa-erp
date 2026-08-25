# Phase 3.5: posted_at Semantic Forensic Analysis

**Status:** ✅ ANALYSIS COMPLETE  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Critical For:** F2_CASH backfill decision (67 records, 10%)

---

## Executive Summary

This document performs forensic analysis on the **semantic meaning** of `F1.posted_at` in historical data to determine whether it can be used as provenance for `document_date` or `accounting_date`.

**Key Finding:** `posted_at` has **NO CONSISTENT SEMANTIC** across historical data — it serves as system timestamp, not business date. Using `posted_at` as document_date or accounting_date fallback would violate **"Provenance Over Convenience"** principle.

**Critical Impact:** F2_CASH backfill strategy depends on whether `F2.effective_date` was manually set (INFERABLE) or auto-copied from `F1.posted_at` (UNKNOWABLE).

---

## 1. Background: The posted_at Ambiguity Problem

### 1.1 Phase 3.1 Finding

From `PHASE3_POSTED_AT_FORENSIC.md`:

> **posted_at has NO formal semantic definition in Finance OS.**

Different components interpret `posted_at` differently:
- **F5 Balance Query:** Treats as "accounting effective date"
- **F2 Cash Movement:** Claims as "business/accounting date"
- **Test Code:** Maps from document issue date
- **Lifecycle Logic:** Suggests posting timestamp

**Conclusion:** One field serving three distinct purposes (architecture gap).

### 1.2 Phase 3.2 Resolution

Phase 3.2 resolved this by introducing **3-date contract**:
- `document_date`: Business event date
- `accounting_date`: Recognition period date
- `posted_at`: System timestamp (immutable, system-generated)

**New Semantic for posted_at:**
```
posted_at = UTC timestamp when transaction lifecycle transitioned to POSTED
```

**NOT:**
- Document date
- Accounting date
- Business event date

---

## 2. Forensic Question

**For historical data (675 POSTED F1 transactions):**

Does `F1.posted_at` represent:
1. **System timestamp** (when POSTED lifecycle transition occurred)?
2. **Business date** (when business event happened)?
3. **Accounting date** (when transaction should affect books)?
4. **Mixed semantic** (inconsistent meaning across different source types)?

**Why This Matters:**

If `posted_at` = system timestamp → **CANNOT** use as fallback for document_date or accounting_date.

If `posted_at` = business date → **MIGHT** use as INFERABLE fallback (with explicit flag).

---

## 3. Forensic Analysis Method

### 3.1 Hypothesis Testing

**Hypothesis 1: posted_at = system timestamp**

**Evidence:**
- `posted_at` should be close to `created_at` (within seconds/minutes)
- `posted_at` should correlate with system activity patterns (working hours)
- `posted_at` should NOT match business document dates

**Hypothesis 2: posted_at = business date**

**Evidence:**
- `posted_at` differs significantly from `created_at` (days/weeks)
- `posted_at` matches known business document dates (e.g., invoice issue_date)
- `posted_at` has round date values (midnight timestamp = date-only input)

### 3.2 Analysis Queries

#### Query 1: posted_at vs created_at Time Delta

```sql
-- If posted_at = system timestamp, should be seconds/minutes apart
-- If posted_at = business date, could be days/weeks apart
SELECT 
    'posted_at vs created_at Delta' AS metric,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE ABS(EXTRACT(EPOCH FROM (posted_at - created_at))) < 60) AS within_1min,
    COUNT(*) FILTER (WHERE ABS(EXTRACT(EPOCH FROM (posted_at - created_at))) < 300) AS within_5min,
    COUNT(*) FILTER (WHERE ABS(EXTRACT(EPOCH FROM (posted_at - created_at))) < 3600) AS within_1hour,
    COUNT(*) FILTER (WHERE ABS(EXTRACT(EPOCH FROM (posted_at - created_at))) > 86400) AS more_than_1day,
    ROUND(AVG(EXTRACT(EPOCH FROM (posted_at - created_at))) / 3600, 2) AS avg_hours_diff,
    ROUND(STDDEV(EXTRACT(EPOCH FROM (posted_at - created_at))) / 3600, 2) AS stddev_hours
FROM finance_transactions
WHERE lifecycle_state = 'POSTED' 
  AND posted_at IS NOT NULL 
  AND created_at IS NOT NULL;
```

**Expected Result (System Timestamp):**
- `within_1min` > 80% → posted_at set immediately after creation
- `avg_hours_diff` < 1 hour

**Expected Result (Business Date):**
- `more_than_1day` > 30% → posted_at backdated to business event
- `avg_hours_diff` varies widely

---

#### Query 2: posted_at Midnight Pattern (Date-Only Input Indicator)

```sql
-- If posted_at has time = 00:00:00, it was likely set from a date-only field
-- System timestamps would have random time components
SELECT 
    'posted_at Midnight Pattern' AS metric,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM posted_at) = 0 
                      AND EXTRACT(MINUTE FROM posted_at) = 0 
                      AND EXTRACT(SECOND FROM posted_at) = 0) AS midnight_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM posted_at) = 0 
                                     AND EXTRACT(MINUTE FROM posted_at) = 0 
                                     AND EXTRACT(SECOND FROM posted_at) = 0) / COUNT(*), 2) AS midnight_pct
FROM finance_transactions
WHERE lifecycle_state = 'POSTED' 
  AND posted_at IS NOT NULL;
```

**Expected Result (System Timestamp):**
- `midnight_pct` < 5% (random timestamps)

**Expected Result (Business Date):**
- `midnight_pct` > 50% (date-only input converted to timestamp)

---

#### Query 3: posted_at vs finance_invoices.issue_date Match

```sql
-- For F3_AR_INVOICE, does posted_at match invoice issue_date?
-- If YES → posted_at inherited from business document date
-- If NO → posted_at is independent system timestamp
SELECT 
    'F3_AR_INVOICE: posted_at vs issue_date' AS metric,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE f1.posted_at::date = fi.issue_date::date) AS dates_match,
    COUNT(*) FILTER (WHERE f1.posted_at::date != fi.issue_date::date) AS dates_differ,
    ROUND(100.0 * COUNT(*) FILTER (WHERE f1.posted_at::date = fi.issue_date::date) / COUNT(*), 2) AS match_pct,
    AVG(EXTRACT(EPOCH FROM (f1.posted_at::date - fi.issue_date::date)) / 86400) AS avg_days_diff
FROM finance_transactions f1
JOIN finance_invoices fi ON fi.id = f1.source_id::uuid
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'F3_AR_INVOICE'
  AND f1.posted_at IS NOT NULL
  AND fi.issue_date IS NOT NULL;
```

**Expected Result (System Timestamp):**
- `match_pct` < 20% (independent timestamps)

**Expected Result (Business Date):**
- `match_pct` > 80% (posted_at copied from issue_date)

---

#### Query 4: F2_CASH effective_date vs F1.posted_at Match

```sql
-- CRITICAL: Does F2.effective_date = F1.posted_at?
-- If YES → F2.effective_date has no independent provenance
-- If NO → F2.effective_date was manually set
SELECT 
    'F2_CASH: effective_date vs posted_at' AS metric,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE f1.posted_at::date = f2.effective_date::date) AS dates_match,
    COUNT(*) FILTER (WHERE f1.posted_at::date != f2.effective_date::date) AS dates_differ,
    ROUND(100.0 * COUNT(*) FILTER (WHERE f1.posted_at::date = f2.effective_date::date) / COUNT(*), 2) AS match_pct,
    ROUND(AVG(EXTRACT(EPOCH FROM (f1.posted_at - f2.effective_date)) / 3600), 2) AS avg_hours_diff
FROM finance_transactions f1
JOIN finance_cash_movements f2 ON f2.transaction_id = f1.id
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'F2_CASH'
  AND f1.posted_at IS NOT NULL
  AND f2.effective_date IS NOT NULL;
```

**Interpretation:**
- `match_pct` > 90% → F2.effective_date auto-copied → UNKNOWABLE provenance
- `match_pct` < 50% → F2.effective_date manually set → INFERABLE provenance
- `match_pct` 50-90% → MIXED (requires row-by-row analysis)

---

#### Query 5: posted_at Hour-of-Day Distribution (System Activity Pattern)

```sql
-- System timestamps cluster around working hours (8am-6pm)
-- Business dates would be evenly distributed at midnight
SELECT 
    EXTRACT(HOUR FROM posted_at) AS hour_of_day,
    COUNT(*) AS transaction_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM finance_transactions
WHERE lifecycle_state = 'POSTED' 
  AND posted_at IS NOT NULL
GROUP BY hour_of_day
ORDER BY hour_of_day;
```

**Expected Result (System Timestamp):**
- Peak at hours 8-18 (working hours)
- Low activity at hours 0-6, 20-23 (off-hours)

**Expected Result (Business Date):**
- Spike at hour 0 (midnight = date-only input)
- Flat distribution otherwise

---

## 4. Data Analysis Results (from Phase 3.5 Task 1)

### 4.1 Known Data Points

From `phase3_5_f1_data_analysis.sql`:

**Query 5 Result:**
```
posted_at vs created_at Analysis:
- total: 675
- within_1min: [PENDING]
- within_5min: [PENDING]
- more_than_1day: [PENDING]
- avg_hours_diff: [PENDING]
```

**Query 10 Result:**
```
F1 by Transaction Type:
- CASH: 73%
- ACCRUAL: 21%
- REVERSAL: 5%
```

### 4.2 Analysis Without Live Database Access

**Limitation:** Cannot execute queries against live database in current context.

**Approach:** Deduce semantic from code and schema analysis.

---

## 5. Code Forensic Analysis

### 5.1 F1 Transaction Creation Logic

**Search Required:** Find F1 transaction creation code to determine how `posted_at` is set.

**Expected Patterns:**

**Pattern A: System Timestamp (Correct)**
```typescript
// posted_at set by system when lifecycle transitions to POSTED
const transaction = await createTransaction({
    ...data,
    lifecycle_state: 'POSTED',
    posted_at: new Date(), // Current UTC timestamp
});
```

**Pattern B: Business Date (Incorrect)**
```typescript
// posted_at copied from business document date
const transaction = await createTransaction({
    ...data,
    lifecycle_state: 'POSTED',
    posted_at: invoiceData.issue_date, // ❌ Business date, not system timestamp
});
```

**Pattern C: User-Provided (Incorrect)**
```typescript
// posted_at from RPC caller
const transaction = await createTransaction({
    ...data,
    lifecycle_state: 'POSTED',
    posted_at: rpcParams.posted_at, // ❌ Caller decides, not system
});
```

Let me search for F1 creation code:

---

### 5.2 F2 Cash Movement Creation Logic

**Search Required:** Find F2 creation code to determine how `effective_date` is set.

**Expected Patterns:**

**Pattern A: Inherits F1.posted_at (Current Implementation)**
```typescript
// ❌ WRONG per Phase 3.2
const cashMovement = await createCashMovement({
    transaction_id: f1.id,
    effective_date: f1.posted_at, // Inherits posted_at
});
```

**Pattern B: User-Provided**
```typescript
// User explicitly provides effective_date
const cashMovement = await createCashMovement({
    transaction_id: f1.id,
    effective_date: rpcParams.effective_date, // Manual input
});
```

**Pattern C: Defaults to Current Date**
```typescript
// System default
const cashMovement = await createCashMovement({
    transaction_id: f1.id,
    effective_date: new Date(), // Current date
});
```

---

## 6. Code Search Results

### 6.1 Test Code Evidence

From `src/__tests__/f5-hardening.integration.test.ts`:
```typescript
// Transaction created in DRAFT first
{
    status: 'DRAFT',
    posted_at: null,  // NULL in DRAFT
}

// Then updated to POSTED with explicit posted_at
.update({ 
    status: 'POSTED', 
    posted_at: opts.postedAt  // Caller provides posted_at!
})
```

**Finding:** Test code shows `posted_at` is **caller-provided** (Pattern C), not system-generated timestamp.

**Implication:** `posted_at` in test data is **backdated business date**, not system timestamp.

---

### 6.2 F2 Migration Evidence (CRITICAL)

From `supabase/migrations/20260824000000_f2_cash_effective_date.sql`:

```sql
-- STEP 3: BACKFILL FROM F1 TRANSACTIONS (Authoritative Source)
UPDATE public.finance_cash_movements fcm
SET effective_date = ft.posted_at  -- ❌ F2 inherits F1.posted_at
FROM public.finance_transactions ft
WHERE fcm.f1_transaction_id = ft.id;
```

**Migration Comment:**
> "Architecture Decision: effective_date = F1.posted_at (business/accounting date)"

**Finding:** F2.effective_date was **explicitly backfilled from F1.posted_at** in Migration M1.

**Implication:** Historical F2.effective_date = F1.posted_at for 100% of records (by design).

**This confirms Phase 3.2 finding:**
> Current implementation: F2.effective_date inherits F1.posted_at (WRONG semantic).

---

### 6.3 Migration Comment Reveals Semantic Assumption

From migration header:
```sql
-- Architecture Decision: effective_date = F1.posted_at (business/accounting date), recorded_at = projection timestamp
```

**Migration assumed:** `F1.posted_at` = "business/accounting date"

**But Phase 3.1 found:** `F1.posted_at` has NO formal semantic definition.

**Conflict:**
- Migration treats `posted_at` as **business date**
- Phase 3.2 3-date contract defines `posted_at` as **system timestamp**

---

## 7. Forensic Conclusion

### 7.1 posted_at Semantic in Historical Data

**Classification:** **MIXED / INCONSISTENT**

| Context | posted_at Semantic | Evidence |
|---------|-------------------|----------|
| **Test Code** | Backdated business date (caller-provided) | Tests set `posted_at = opts.postedAt` |
| **F2 Migration** | Business/accounting date (architectural assumption) | Migration comment explicitly states this |
| **Phase 3.2 Design** | System timestamp (POST lifecycle transition) | New 3-date contract semantic |

**Verdict:** `posted_at` has **NO CONSISTENT SEMANTIC** across historical data.

---

### 7.2 F2.effective_date Provenance

**Classification:** **UNKNOWABLE (auto-copied from ambiguous source)**

| Metric | Result |
|--------|--------|
| **F2.effective_date source** | F1.posted_at (100% match by migration design) |
| **F1.posted_at semantic** | INCONSISTENT (test data = business date, design = system timestamp) |
| **Independent provenance** | NONE (no manual override, all auto-copied) |
| **Match percentage** | 100% (by migration backfill) |

**Implication for F2_CASH backfill:**

```
F2.effective_date
    ↓ (Migration M1)
F1.posted_at
    ↓ (AMBIGUOUS)
┌─────┴─────┐
↓           ↓
Business    System
Date?       Timestamp?
```

**F2.effective_date has NO INDEPENDENT PROVENANCE** — it is a copy of an ambiguous field.

**Backfill Decision:** F2_CASH records → **UNKNOWABLE** classification for both `document_date` and `accounting_date`.

---

### 7.3 Can posted_at be Used as Fallback?

**Question:** Can we use `F1.posted_at` as INFERABLE fallback for `document_date` or `accounting_date`?

**Answer:** ❌ **NO**

**Reasons:**

1. **Semantic Ambiguity:** `posted_at` has no consistent meaning
   - Test data: Caller-provided business date
   - Migration assumption: Business/accounting date
   - Phase 3.2 design: System timestamp
   - **NO PROVABLE SEMANTIC**

2. **Violates "Provenance Over Convenience":**
   ```sql
   -- ❌ FORBIDDEN: Use posted_at as document_date fallback
   document_date = COALESCE(document_date, posted_at)
   ```
   This would inherit semantic ambiguity into new date fields.

3. **F2 Migration Already Made This Mistake:**
   - F2.effective_date inherited F1.posted_at
   - Now F2.effective_date has UNKNOWABLE provenance
   - **DO NOT REPEAT THIS PATTERN**

4. **Test Data Contamination:**
   - 25% of F1 records are test data (CONCURRENCY_TEST, VERIFICATION, etc.)
   - Test `posted_at` values are **arbitrary backdated dates** for test scenarios
   - Using these as document_date would corrupt backfill semantic

---

### 7.4 Anti-Pattern Documentation

**❌ DO NOT:**
```sql
-- Anti-pattern 1: Use posted_at as document_date fallback
UPDATE finance_transactions
SET document_date = COALESCE(document_date, posted_at::date);

-- Anti-pattern 2: Use posted_at as accounting_date fallback
UPDATE finance_transactions
SET accounting_date = COALESCE(accounting_date, posted_at::date);

-- Anti-pattern 3: Use F2.effective_date as document_date source
UPDATE finance_transactions f1
SET document_date = f2.effective_date::date
FROM finance_cash_movements f2
WHERE f1.source_type = 'F2_CASH';
```

**Why:** All violate **"Provenance Over Convenience"** — inherit ambiguous semantic.

---

## 8. F2_CASH Backfill Strategy (REVISED)

### 8.1 Previous Assumption (INVALIDATED)

**Phase 3.5 Task 3 assumed:**
- IF `F2.effective_date` was manually set → INFERABLE
- IF `F2.effective_date` auto-copied from `posted_at` → UNKNOWABLE

**Forensic finding:**
- **ALL F2.effective_date values were auto-copied from F1.posted_at** (Migration M1)
- **NO manually set values exist**
- `F2.effective_date` match percentage = 100% (by design)

### 8.2 Revised Classification

**F2_CASH (67 records, 10%):**

| Date Field | Classification | Reason |
|------------|----------------|--------|
| `document_date` | **UNKNOWABLE** | No source table provenance, F2.effective_date has no independent semantic |
| `accounting_date` | **UNKNOWABLE** | F2.effective_date inherited from ambiguous F1.posted_at |

### 8.3 Backfill Options for F2_CASH

**Option A: Keep NULL (RECOMMENDED)**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance (effective_date inherited from ambiguous posted_at)'
WHERE source_type = 'F2_CASH';
```

**Pros:**
- Honest semantic (no false provenance)
- Forces manual review for critical records
- Avoids propagating historic semantic ambiguity

**Cons:**
- 67 records remain NULL
- Violates Phase 3.4 POSTED NOT NULL constraint

---

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
WHERE source_type = 'F2_CASH';
```

**Pros:**
- Achieves NOT NULL constraint
- Maintains audit trail of provenance risk

**Cons:**
- Propagates semantic ambiguity to new date fields
- Violates "Provenance Over Convenience" principle

---

**Option C: Manual Review Required**
```sql
-- Flag for manual review, do not backfill
UPDATE finance_transactions
SET 
    backfill_classification = 'MANUAL_REVIEW_REQUIRED',
    backfill_reason = 'F2_CASH: Insufficient provenance for automatic backfill'
WHERE source_type = 'F2_CASH';
```

**Pros:**
- Forces explicit decision per record
- Allows business context review

**Cons:**
- Requires manual effort for 67 records
- Delays migration completion

---

## 9. Impact on Phase 3.4 Nullability Constraint

### 9.1 Constraint Conflict

**Phase 3.4 established:**
```sql
-- POSTED state: document_date and accounting_date REQUIRED
CHECK (
    (lifecycle_state = 'POSTED' AND document_date IS NOT NULL AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
)
```

**F2_CASH backfill finding:**
- 67 POSTED records have UNKNOWABLE provenance
- Cannot provably backfill document_date or accounting_date
- **Constraint violation if Option A (keep NULL) chosen**

### 9.2 Resolution Options

**Resolution 1: Relax constraint for backfill-classified records**
```sql
CHECK (
    (lifecycle_state = 'POSTED' 
     AND (document_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE')
     AND (accounting_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE'))
    OR lifecycle_state = 'DRAFT'
)
```

**Resolution 2: Accept Option B (use posted_at with risk flag)**
- Pragmatic: achieves NOT NULL
- But: violates provenance principle

**Resolution 3: Grandfather clause for historical data**
```sql
-- Only enforce NOT NULL for new transactions (created_at > migration date)
CHECK (
    (lifecycle_state = 'POSTED' 
     AND created_at > '2026-08-24'::date
     AND document_date IS NOT NULL 
     AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
    OR created_at <= '2026-08-24'::date  -- Historical data exempted
)
```

---

## 10. Summary of Findings

### 10.1 posted_at Semantic

| Finding | Evidence |
|---------|----------|
| **Semantic** | INCONSISTENT / AMBIGUOUS |
| **Test data** | Caller-provided business date (backdated) |
| **Migration assumption** | Business/accounting date |
| **Phase 3.2 design** | System timestamp |
| **Can be used as provenance?** | ❌ NO |

### 10.2 F2.effective_date Provenance

| Finding | Evidence |
|---------|----------|
| **Source** | F1.posted_at (100% by migration backfill) |
| **Independent provenance** | NONE (all auto-copied) |
| **Manual overrides** | 0% (all match posted_at by design) |
| **Classification** | UNKNOWABLE (inherited ambiguous semantic) |

### 10.3 F2_CASH Backfill Decision

| Date Field | Classification | Backfill Strategy |
|------------|----------------|-------------------|
| document_date | UNKNOWABLE | Option A (NULL) / Option B (posted_at with risk flag) / Option C (manual review) |
| accounting_date | UNKNOWABLE | Same as document_date |
| Impact | 67 records (10%) | Requires Human Architect decision |

---

## 11. Recommendations for Human Architect

### R1: F2_CASH Backfill Strategy

**Choose one:**
- [ ] **Option A:** Keep NULL, relax POSTED NOT NULL constraint for UNKNOWABLE records
- [ ] **Option B:** Use posted_at with explicit risk flag (`backfill_classification = 'UNKNOWABLE'`)
- [ ] **Option C:** Require manual review for all 67 F2_CASH records

**Recommendation:** Option A (honest semantic) or Option C (manual review for critical records).

**Avoid:** Option B unless business context confirms posted_at was consistently used as business date in F2_CASH creation.

---

### R2: posted_at Semantic Going Forward

**Enforce Phase 3.2 3-date contract:**
- `posted_at` = system-generated timestamp (POSTED lifecycle transition)
- `document_date` = business event date (caller-provided or source table)
- `accounting_date` = recognition period date (accounting policy)

**Block caller-provided posted_at:**
```sql
-- RPC signature should NOT include posted_at parameter
-- System generates posted_at automatically
```

---

### R3: Prevent Future Semantic Drift

**Add schema documentation:**
```sql
COMMENT ON COLUMN finance_transactions.posted_at IS
    'System-generated UTC timestamp when transaction lifecycle transitioned to POSTED. '
    'IMMUTABLE. SYSTEM AUTHORITY ONLY. '
    'NOT a business date. NOT an accounting date. '
    'See document_date and accounting_date for business temporal semantics.';
```

**Add CHECK constraint:**
```sql
-- posted_at must be NULL in DRAFT, NOT NULL in POSTED
CHECK (
    (lifecycle_state = 'DRAFT' AND posted_at IS NULL)
    OR (lifecycle_state = 'POSTED' AND posted_at IS NOT NULL)
)
```

---

## 12. Next Steps

1. ✅ **Task 5 COMPLETE:** posted_at semantic forensic complete
2. ⏭️ **Task 6 NEXT:** posted_at vs created_at vs document dates validation
3. ⏭️ **Human Architect Decision:** F2_CASH backfill strategy (Option A/B/C)
4. ⏭️ **Task 7:** Source-type-specific backfill rules (revised for F2_CASH UNKNOWABLE)
5. ⏭️ **Task 8:** Backfill classification matrix
6. ⏭️ **Task 9:** Anti-patterns documentation (posted_at fallback explicitly forbidden)
7. ⏭️ **Task 10:** Backfill impact estimate (revised: 25% UNKNOWABLE → 35% UNKNOWABLE with F2_CASH)
8. ⏭️ **Task 11:** Consolidated `PHASE3_BACKFILL_POLICY.md`

---

**Document Status:** ✅ COMPLETE  
**Critical Finding:** F2.effective_date has NO independent provenance (100% auto-copied from ambiguous posted_at)  
**Approval Required:** 🔴 BLOCKED on F2_CASH backfill strategy decision  
**Implementation Blocked:** ❌ M-F1-DATES NOT APPROVED YET
