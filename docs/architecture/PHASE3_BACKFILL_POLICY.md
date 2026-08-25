# Phase 3: Finance OS Date Backfill Policy

**Document Version:** 1.0  
**Status:** ✅ ANALYSIS COMPLETE — AWAITING HUMAN ARCHITECT APPROVAL  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Author:** Kiro AI Agent  
**Governance:** Provenance Over Convenience

---

## Document Purpose

This is the **authoritative backfill policy** for Finance OS 3-date contract migration (Phase 3.2). It consolidates provenance analysis, classification, backfill rules, anti-patterns, and impact estimates from Phase 3.5 forensic investigation.

**This document must be reviewed and approved by Human Architect before any implementation (M-F1-DATES, M-F2-DATES, M4b, F5.6) proceeds.**

---

## Executive Summary

### The Problem

Finance OS historically conflated 3 distinct date semantics into a single ambiguous `posted_at` field:
1. **Document date** (business event date — "when did it happen?")
2. **Accounting date** (period recognition date — "which period does it affect?")
3. **Posting timestamp** (system recording time — "when was it recorded?")

**Impact:** F5 balance queries, F2 cash movements, and accounting period logic all use ambiguous `posted_at`, making TT99 compliance and semantic correctness impossible to validate.

---

### The Solution (Phase 3.2)

Introduce **3-date contract**:
- `document_date`: Business event date (TT99 "Ngày chứng từ")
- `accounting_date`: Recognition period date (TT99 "Ngày hạch toán")
- `posted_at`: System timestamp (immutable, system-generated only)

---

### The Challenge (Phase 3.5)

**How to backfill 675 POSTED historical transactions** from ambiguous `posted_at` to explicit `document_date` and `accounting_date`?

**Phase 3.5 Finding:** Only **128 records (19%)** have provable date provenance. The remaining **547 records (81%)** require policy inference, schema investigation, or preserving NULL.

---

### Core Governance Principle

> **"Provenance Over Convenience"**
>
> Preserving semantic correctness > Achieving database completeness
>
> If provenance is insufficient → preserve NULL or require manual review.
> Do NOT invent dates.

**Trade-offs Accepted:**
- ✅ Honest UNKNOWABLE > False PROVABLE
- ✅ NULL with audit trail > Invented date without provenance
- ✅ Source-type specificity > Universal convenience rules
- ❌ posted_at NEVER used as document_date or accounting_date fallback

---

## 1. Provenance Classification Summary

### 1.1 Overall Distribution

| Classification | Records | Percentage | Confidence Level |
|----------------|---------|------------|------------------|
| **PROVABLE** | 128 | 19% | HIGH — Direct field mapping with semantic guarantee |
| **INFERABLE** | 313 | 46% | MEDIUM — Policy-based reconstruction with explicit rule |
| **UNKNOWABLE** | 234 | 35% | NONE — Insufficient evidence or ambiguous provenance |
| **TOTAL** | **675** | **100%** | — |

**Key Insight:** Only 19% of historical data has high-confidence provenance.

---

### 1.2 Classification by Date Field

#### document_date

| Classification | Records | Source | Status |
|----------------|---------|--------|--------|
| **PROVABLE** | 128 (19%) | `finance_invoices.issue_date` | ✅ Ready |
| **INFERABLE** | 313 (46%) | Source table date fields (requires investigation) | 🔴 Blocked |
| **UNKNOWABLE** | 234 (35%) | No business source | 🔴 Blocked |

**Critical Finding:** F2_CASH (67 records, 10%) downgraded from INFERABLE to **UNKNOWABLE** after Task 5 forensic revealed F2.effective_date has NO independent provenance (100% auto-copied from ambiguous posted_at).

---

#### accounting_date

| Classification | Records | Source | Status |
|----------------|---------|--------|--------|
| **PROVABLE** | 0 (0%) | N/A (no source tables have explicit accounting_date field) | N/A |
| **INFERABLE** | 441 (65%) | `= document_date` (cash basis policy assumption) | 🔴 Blocked (Q1) |
| **UNKNOWABLE** | 234 (35%) | No business source | 🔴 Blocked (Q2, Q4) |

**Critical Finding:** `accounting_date` is a **NEW semantic field** introduced by Phase 3.2 — cannot be extracted from historical data, must be policy-inferred.

---

### 1.3 Classification by Source Type

| Source Type | Records | % | document_date | accounting_date | Risk | Status |
|-------------|---------|---|---------------|-----------------|------|--------|
| **F3_AR_INVOICE** | 128 | 19% | **PROVABLE** | INFERABLE | LOW-MED | ✅ READY (doc_date) |
| **SALES_ORDER** | 208 | 31% | INFERABLE | INFERABLE | MEDIUM | 🔴 BLOCKED |
| **CONCURRENCY_TEST** | 102 | 15% | UNKNOWABLE | UNKNOWABLE | LOW | 🔴 DECISION (Q4) |
| **AP_PAYMENT** | 74 | 11% | INFERABLE | INFERABLE | HIGH | 🔴 BLOCKED |
| **F2_CASH** | 67 | 10% | **UNKNOWABLE** | **UNKNOWABLE** | **VERY HIGH** | 🔴 **CRITICAL (Q2)** |
| **VERIFICATION** | 35 | 5% | UNKNOWABLE | UNKNOWABLE | LOW | 🔴 DECISION (Q4) |
| **SPA_BOOKING** | 31 | 5% | INFERABLE | INFERABLE | MEDIUM | 🔴 BLOCKED |
| **F2_REGRESSION** | 18 | 3% | UNKNOWABLE | UNKNOWABLE | LOW | 🔴 DECISION (Q4) |
| **test** | 12 | 2% | UNKNOWABLE | UNKNOWABLE | LOW | 🔴 DECISION (Q4) |

---

## 2. Source-Type-Specific Backfill Rules

### 2.1 F3_AR_INVOICE (128 records, 19%) — READY

**document_date:**
- **Classification:** **PROVABLE**
- **Source:** `finance_invoices.issue_date`
- **Risk:** LOW
- **Status:** ✅ **READY TO EXECUTE**

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

**accounting_date:**
- **Classification:** INFERABLE (Cash Basis)
- **Source:** `= document_date`
- **Risk:** MEDIUM
- **Status:** 🔴 BLOCKED on Q1 (accounting policy confirmation)

**Conditional Backfill (if Q1 = cash basis):**
```sql
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

---

### 2.2 SALES_ORDER (208 records, 31%) — BLOCKED

**document_date:**
- **Classification:** INFERABLE (requires investigation)
- **Source:** `sales_orders.order_date`? (unknown)
- **Risk:** MEDIUM
- **Status:** 🔴 BLOCKED on schema investigation

**Investigation Required:**
1. Does `sales_orders` table exist?
2. Schema query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_orders';`
3. Identify date field: `order_date`, `booking_date`?
4. Semantic validation: Which date = document date?

**accounting_date:**
- **Classification:** INFERABLE (depends on document_date + Q1)
- **Source:** `= document_date` (cash basis assumption)
- **Status:** 🔴 BLOCKED on document_date investigation + Q1

---

### 2.3 AP_PAYMENT (74 records, 11%) — BLOCKED

**document_date:**
- **Classification:** INFERABLE (requires investigation)
- **Source:** `finance_payments.payment_date`? (unknown)
- **Risk:** HIGH (payment semantic varies by jurisdiction, TT99 compliance)
- **Status:** 🔴 BLOCKED on schema investigation

**accounting_date:**
- **Classification:** INFERABLE
- **Source:** `finance_payments.execution_date`? (accrual basis) OR `= document_date` (cash basis)
- **Risk:** HIGH
- **Status:** 🔴 BLOCKED on schema investigation + Q1

---

### 2.4 F2_CASH (67 records, 10%) — CRITICAL

**document_date:**
- **Classification:** **UNKNOWABLE** (Task 5 finding)
- **Reason:** F2.effective_date has NO independent provenance (100% auto-copied from ambiguous F1.posted_at by Migration M1)
- **Risk:** **VERY HIGH**
- **Status:** 🔴 **BLOCKED on Q2 (F2_CASH strategy decision)**

**accounting_date:**
- **Classification:** **UNKNOWABLE** (same reason)
- **Status:** 🔴 **BLOCKED on Q2**

**Options (Q2 Decision Required):**

**Option A (RECOMMENDED): Preserve NULL**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance (effective_date inherited from ambiguous posted_at)'
WHERE source_type = 'F2_CASH';
```
- ✅ Honest semantic
- ❌ Conflicts with Phase 3.4 NOT NULL constraint (requires Resolution 1)

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
- ✅ Achieves NOT NULL
- ❌ **Violates "Provenance Over Convenience" principle**
- ❌ Violates anti-patterns AP-1/AP-2

**Option C: Manual Review Required**
- Requires manual effort for 67 records
- Allows business context review per record

**Recommendation:** **Option A** (preserve NULL with Resolution 1) or **Option C** (manual review). **AVOID Option B** unless Human Architect explicitly approves after business context review.

---

### 2.5 SPA_BOOKING (31 records, 5%) — BLOCKED

**document_date:**
- **Classification:** INFERABLE (requires investigation)
- **Source:** `spa_bookings.service_date`? (unknown)
- **Risk:** MEDIUM
- **Status:** 🔴 BLOCKED on schema investigation

**accounting_date:**
- **Classification:** INFERABLE (accrual basis — service date)
- **Source:** `= document_date`
- **Status:** 🔴 BLOCKED on document_date investigation + Q1

---

### 2.6 Test Data (167 records, 25%) — DECISION REQUIRED

**Source Types:** CONCURRENCY_TEST, VERIFICATION, F2_REGRESSION, test

**document_date & accounting_date:**
- **Classification:** UNKNOWABLE
- **Reason:** Test artifacts with no business source document
- **Risk:** LOW (test data, no production impact)
- **Status:** 🔴 BLOCKED on Q4 (test data strategy)

**Options (Q4 Decision Required):**

**Option A (RECOMMENDED): Preserve NULL**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'Test artifact - no business source'
WHERE source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test');
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
WHERE source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test');
```

**Option C: Delete test data** (Phase 2.5-style cleanup)
```sql
DELETE FROM finance_transactions
WHERE source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test')
  AND created_at < '2026-08-24'::date;
```

**Recommendation:** **Option A** (preserve NULL) or **Option C** (delete if approved).

---

## 3. Anti-Patterns (FORBIDDEN)

### 3.1 Critical Anti-Patterns (🔴 MUST NOT IMPLEMENT)

**AP-1: posted_at as document_date Fallback**
```sql
-- ❌ FORBIDDEN
UPDATE finance_transactions
SET document_date = COALESCE(document_date, posted_at::date);
```
**Why:** posted_at has INCONSISTENT semantic (Task 5 finding). Violates "Provenance Over Convenience".

---

**AP-2: posted_at as accounting_date Fallback**
```sql
-- ❌ FORBIDDEN
UPDATE finance_transactions
SET accounting_date = COALESCE(accounting_date, posted_at::date);
```
**Why:** Same as AP-1, PLUS violates TT99 "Ngày hạch toán" semantic (accounting_date ≠ system timestamp).

---

**AP-3: COALESCE Cascade for Convenience**
```sql
-- ❌ FORBIDDEN
UPDATE finance_transactions
SET document_date = COALESCE(
    document_date,
    accounting_date,
    posted_at::date,
    created_at::date,
    CURRENT_DATE
);
```
**Why:** Multi-level semantic contamination. Invents dates without provenance. Loses audit trail.

---

**AP-4: F2.effective_date as Provenance Source**
```sql
-- ❌ FORBIDDEN
UPDATE finance_transactions f1
SET document_date = f2.effective_date::date
FROM finance_cash_movements f2
WHERE f1.source_type = 'F2_CASH';
```
**Why:** Circular provenance logic. F2.effective_date was 100% auto-copied from ambiguous F1.posted_at (Migration M1). No independent provenance.

---

### 3.2 Additional Anti-Patterns

- **AP-5:** created_at as business date fallback (🟡 HIGH — system metadata, not business date)
- **AP-6:** Backfill without metadata flags (🟡 HIGH — loses audit trail)
- **AP-7:** Single universal backfill rule (🟡 HIGH — ignores source-type semantics)
- **AP-8:** Blind INFERABLE without policy documentation (🟠 MEDIUM)
- **AP-9:** Test data treated as production (🟠 MEDIUM)
- **AP-10:** Backfill before NOT NULL constraint (🟢 LOW — timing issue)

**Full documentation:** `PHASE3_5_ANTI_PATTERNS.md`

---

### 3.3 Enforcement Checklist

Before executing ANY backfill SQL:

- [ ] ❌ Does it use `posted_at` as document_date or accounting_date fallback? (AP-1, AP-2)
- [ ] ❌ Does it use `COALESCE` cascade? (AP-3)
- [ ] ❌ Does it use `F2.effective_date`? (AP-4)
- [ ] ✅ Does it include backfill metadata columns?
- [ ] ✅ Is it source-type-specific (not universal)?
- [ ] ✅ Is inference policy documented in `backfill_reason`?
- [ ] ✅ Is test data handled separately?

**If any ❌ is checked → BLOCK MIGRATION.**

---

## 4. Schema Changes

### 4.1 New Columns

```sql
ALTER TABLE finance_transactions
-- Phase 3.2: 3-Date Contract
ADD COLUMN IF NOT EXISTS document_date DATE,
ADD COLUMN IF NOT EXISTS accounting_date DATE,

-- Phase 3.5: Backfill Metadata (Audit Trail)
ADD COLUMN IF NOT EXISTS backfill_inferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_classification TEXT CHECK (
    backfill_classification IN ('PROVABLE', 'INFERABLE', 'UNKNOWABLE', 'MANUAL_REVIEW_REQUIRED')
),
ADD COLUMN IF NOT EXISTS backfill_source TEXT,
ADD COLUMN IF NOT EXISTS backfill_reason TEXT;
```

**Purpose:**
- `document_date`, `accounting_date`: New date semantics (Phase 3.2)
- `backfill_inferred`: Flag policy-based inferences
- `backfill_classification`: Provenance strength (PROVABLE/INFERABLE/UNKNOWABLE)
- `backfill_source`: Source table.column or policy description
- `backfill_reason`: Human-readable explanation

---

### 4.2 Indexes

```sql
-- Temporal queries (F5 as_of balance)
CREATE INDEX idx_finance_transactions_accounting_date 
    ON finance_transactions(tenant_id, accounting_date)
    WHERE lifecycle_state = 'POSTED';

-- Document date range queries
CREATE INDEX idx_finance_transactions_document_date 
    ON finance_transactions(tenant_id, document_date)
    WHERE lifecycle_state = 'POSTED';

-- Audit trail queries
CREATE INDEX idx_finance_transactions_backfill_classification 
    ON finance_transactions(backfill_classification)
    WHERE backfill_classification IN ('INFERABLE', 'UNKNOWABLE', 'MANUAL_REVIEW_REQUIRED');
```

---

## 5. Constraint Resolution (Phase 3.4 Conflict)

### 5.1 The Conflict

**Phase 3.4 Constraint:**
```sql
CHECK (
    (lifecycle_state = 'POSTED' 
     AND document_date IS NOT NULL 
     AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
)
```

**Problem:** 234 records (35%) have UNKNOWABLE provenance → will have NULL dates if Option A chosen.

---

### 5.2 Resolution 1 (RECOMMENDED)

**Relax constraint for UNKNOWABLE records:**
```sql
ALTER TABLE finance_transactions
DROP CONSTRAINT IF EXISTS chk_posted_dates_not_null;

ALTER TABLE finance_transactions
ADD CONSTRAINT chk_posted_dates_not_null CHECK (
    (lifecycle_state = 'POSTED' 
     AND (document_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE')
     AND (accounting_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE'))
    OR lifecycle_state = 'DRAFT'
);
```

**Impact:**
- ✅ Allows honest semantic (NULL for UNKNOWABLE)
- ✅ Maintains NOT NULL for future transactions (backfill_classification will be NULL for new records)
- ⚠️ Requires backfill_classification column

---

### 5.3 Resolution 2 (Grandfather Clause)

**Exempt historical data:**
```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_posted_dates_not_null CHECK (
    (lifecycle_state = 'POSTED' 
     AND created_at > '2026-08-24'::date
     AND document_date IS NOT NULL 
     AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
    OR created_at <= '2026-08-24'::date
);
```

**Impact:**
- ✅ Exempts historical data
- ✅ Enforces NOT NULL for future transactions
- ⚠️ Creates governance gap (historical data not validated)

---

### 5.4 Resolution 3 (NOT RECOMMENDED)

Accept Option B (use posted_at with risk flag) for F2_CASH and test data.

**Impact:**
- ✅ Achieves NOT NULL
- ❌ **Violates "Provenance Over Convenience" principle**
- ❌ Violates anti-patterns AP-1/AP-2

**Recommendation:** **Resolution 1** (relax for UNKNOWABLE).

---

## 6. Human Architect Decisions Required

### 6.1 Decision Matrix (UPDATED)

| ID | Question | Impact | Priority | Decision Status |
|----|----------|--------|----------|-----------------|
| **Q1** | Accounting policy (transaction-type-specific recognition) | 441 records (65%) | **HIGH** | ✅ **APPROVED** — Event-based recognition rules |
| **Q2** | F2_CASH strategy | 67 records (10%) | **CRITICAL** | ✅ **APPROVED** — Option C (preserve NULL, exclude) |
| **Q3** | Investigation priority | 313 records (46%) | HIGH | ✅ **APPROVED** — SALES_ORDER first |
| **Q4** | Test data strategy | 167 records (25%) | MEDIUM | ✅ **APPROVED** — Controlled cleanup |

---

### 6.2 Q1: Accounting Policy (REVISED)

**Question:** How should `accounting_date` be determined for Finance OS transactions?

**REVISED PRINCIPLE (Human Architect Decision):**

`accounting_date` must represent the **accounting recognition date** according to the applicable accounting event/policy for each transaction type. **DO NOT assume system-wide Cash Basis.**

**Finance OS is designed as accounting engine/GL with:**
- Accrual recognition
- Deferred/unearned revenue
- Reconciliation capabilities
- TT99/2025/TT-BTC compliance (effective 2026-01-01)

**accounting_date Determination by Transaction Type:**

| Transaction Type | accounting_date Semantic |
|------------------|--------------------------|
| **Cash receipt** | Recognition date when business event is recorded |
| **Revenue / Accrued revenue** | Period when revenue is recognized (may differ from invoice date) |
| **Prepayment** | Recognition date of prepayment transaction (NOT revenue recognition date) |
| **Invoice** | Recognition date per applicable accounting rule (may be issue date, delivery date, or period-end) |
| **Adjustment** | Accountant-controlled accounting_date (manual entry) |

**Impact:** Affects 441 records (65%) — accounting_date backfill requires transaction-type-specific recognition rules, NOT universal cash basis

**Decision:** ✅ **APPROVED** — Accounting-date semantics depend on accounting event/recognition rule per transaction type

---

### 6.3 Q2: F2_CASH Strategy (CRITICAL) — APPROVED

**Question:** Given F2.effective_date has NO independent provenance, choose:
- [x] **Option C (APPROVED):** Preserve NULL and exclude from temporal calculations
- [ ] Option A: Preserve NULL, use Resolution 1 (relax constraint for UNKNOWABLE)
- [ ] Option B: Use posted_at with explicit UNKNOWABLE + risk flag

**Human Architect Decision:** ✅ **Option C APPROVED**

**Rationale:**
- F2.effective_date provenance = UNKNOWN (100% auto-copied from ambiguous posted_at)
- Provenance lost → preserve truth: "provenance = UNKNOWN"
- Do NOT invent dates that appear reasonable without evidence
- Exclude from temporal calculations rather than contaminate with false provenance

**Impact:** 67 records (10%), VERY HIGH risk

**Implementation:**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance (effective_date inherited from ambiguous posted_at). Excluded from temporal calculations.'
WHERE source_type = 'F2_CASH'
  AND lifecycle_state = 'POSTED';
```

**Temporal Query Handling:**
```sql
-- F5 balance queries must exclude UNKNOWABLE F2_CASH
WHERE f1.accounting_date <= p_as_of
  AND f1.backfill_classification != 'UNKNOWABLE';
```

**Decision:** ✅ **APPROVED** — Option C (preserve NULL, exclude from temporal calculations)

---

### 6.4 Q3: Schema Investigation Priority — APPROVED

**Question:** Which source type should be investigated first?
- [x] **SALES_ORDER (APPROVED)** (208 records, 31% — highest volume)
- [ ] AP_PAYMENT (74 records, 11% — financial compliance)
- [ ] SPA_BOOKING (31 records, 5% — lowest volume)

**Human Architect Decision:** ✅ **APPROVED** — SALES_ORDER first

**Investigation Order:**
1. **SALES_ORDER** (208 records, 31%) — highest volume, highest impact
2. **AP_PAYMENT** (74 records, 11%) — financial compliance, TT99 validation required
3. **SPA_BOOKING** (31 records, 5%) — lowest volume
4. Remaining INFERABLE sources

**Impact:** 313 records (46%) document_date backfill blocked until investigation complete

**Decision:** ✅ **APPROVED** — Investigate SALES_ORDER first

---

### 6.5 Q4: Test Data Strategy — APPROVED

**Question:** For 167 test records:
- [x] **Controlled cleanup (APPROVED)** — Apply Phase 2.5 principle
- [ ] Option A: Preserve NULL (honest semantic)
- [ ] Option B: Backfill with posted_at for test continuity (UNKNOWABLE classification)

**Human Architect Decision:** ✅ **APPROVED** — Controlled test data cleanup

**Principle (from Phase 2.5):**
```
test artifact
+
no business evidence
+
safe boundary
+
verification
→ authorized cleanup
```

**NOT a universal rule:** "If looks like test data → delete"

**Cleanup Criteria (Must ALL be satisfied):**
1. `source_type` IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test')
2. No business evidence (tenant_id = test tenant OR created_at during test period)
3. Safe boundary (no dependencies on production data)
4. Verification passed (no orphans created by deletion)

**Cleanup SQL (with safeguards):**
```sql
-- Step 1: Identify test records with safe boundary
WITH test_candidates AS (
    SELECT id, source_type, tenant_id, created_at
    FROM finance_transactions
    WHERE source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test')
      AND lifecycle_state = 'POSTED'
      AND created_at < '2026-08-24'::date  -- Historical test data only
)
-- Step 2: Verify no production dependencies
SELECT * FROM test_candidates
WHERE NOT EXISTS (
    SELECT 1 FROM finance_cash_movements f2
    WHERE f2.transaction_id = test_candidates.id
      AND f2.tenant_id NOT IN (SELECT id FROM test_tenants)
);
-- Step 3: Manual review before deletion
-- Step 4: Execute deletion with verification
```

**Impact:** 167 records (25%), LOW risk (test data)

**Decision:** ✅ **APPROVED** — Controlled cleanup following Phase 2.5 governance

---

## 7. Execution Timeline & Impact

### 7.1 Phased Execution Strategy

**Phase 1A: Quick Win (Week 1)**
- Execute F3_AR_INVOICE document_date backfill (128 records, PROVABLE, LOW RISK)
- Validate backfill pipeline
- Deploy with monitoring

**Phase 1B: Critical Decision (Week 1)**
- Human Architect decides Q2 (F2_CASH strategy)
- Implement constraint resolution (Resolution 1 or 2)

**Phase 2: Investigation (Weeks 2-3)**
- Schema investigation (SALES_ORDER, AP_PAYMENT, SPA_BOOKING)
- Semantic validation
- Human Architect confirms Q1 (accounting policy)

**Phase 3: INFERABLE Backfill (Week 4)**
- Execute document_date backfill (313 records)
- Execute accounting_date backfill (441 records)
- Validation

**Phase 4: RPC/Worker Deployment (Week 5)**
- Deploy F1, F2, F5 RPC changes
- Deploy Worker changes
- Test suite updates (140 tests)
- Smoke tests

**Phase 5: Validation & Monitoring (Week 6)**
- F5 balance report validation
- TT99 compliance checks
- Post-migration monitoring

**Total Timeline:** **6 weeks** (with parallel work)

---

### 7.2 Impact Summary

| Dimension | Metric | Value |
|-----------|--------|-------|
| **Records** | Total POSTED transactions | 675 |
| **Records** | Ready to backfill (no blockers) | 128 (19%) |
| **Records** | Blocked on decisions | 547 (81%) |
| **Schema** | New columns | 6 (2 dates + 4 metadata) |
| **Storage** | Additional storage | ~275 KB (negligible) |
| **Risk** | VERY HIGH risk records | 67 (F2_CASH, 10%) |
| **Dependencies** | RPCs requiring changes | 3 (F1, F2, F5) |
| **Dependencies** | Workers requiring changes | 3 |
| **Dependencies** | Tests requiring updates | ~140 |
| **Timeline** | Migration execution | 40-60 minutes |
| **Timeline** | Full project timeline | 6 weeks |
| **Downtime** | Expected downtime | 0 (zero-downtime capable) |
| **Cost** | Engineering effort | ~124 hours (~3 weeks) |
| **Cost** | Engineering cost | ~$12,400 |

---

## 8. Success Criteria

### 8.1 Backfill Success

- [ ] 128 PROVABLE records backfilled (F3_AR_INVOICE document_date)
- [ ] 313 INFERABLE records backfilled (document_date, after investigation)
- [ ] 441 INFERABLE records backfilled (accounting_date, after Q1)
- [ ] 234 UNKNOWABLE records handled per Q2/Q4 decisions
- [ ] 0 anti-patterns violated (AP-1 through AP-10)
- [ ] 100% backfill metadata populated (audit trail)

### 8.2 System Success

- [ ] F2.effective_date uses accounting_date (not posted_at)
- [ ] F5 as_of queries use accounting_date (not posted_at)
- [ ] RPC/Worker changes deployed without regression
- [ ] Test suite passes (140 updated tests)
- [ ] Balance reports validated (before/after match expected behavior)

### 8.3 Governance Success

- [ ] "Provenance Over Convenience" principle maintained
- [ ] No semantic contamination (posted_at not used as fallback)
- [ ] Audit trail complete (backfill metadata for all records)
- [ ] TT99 compliance demonstrated (explicit date semantics)

---

## 9. Risk Assessment & Mitigation

### 9.1 Risk Profile

| Risk Level | Records | % | Mitigation |
|------------|---------|---|------------|
| **VERY HIGH** | 67 | 10% | Q2 decision — preserve NULL or manual review |
| **HIGH** | 74 | 11% | Schema investigation + TT99 validation |
| **MEDIUM** | 367 | 54% | Q1 decision + schema investigation |
| **LOW** | 167 | 25% | Q4 decision (test data) |

### 9.2 Critical Risks

**Risk 1: F2_CASH No Provenance (VERY HIGH)**
- **Impact:** 67 records (10%)
- **Mitigation:** Q2 decision required — Option A or C (avoid Option B)

**Risk 2: Accounting Policy Ambiguity (HIGH)**
- **Impact:** 441 records (65%)
- **Mitigation:** Q1 decision required — confirm cash basis before backfill

**Risk 3: Semantic Contamination via posted_at (CRITICAL — blocked)**
- **Impact:** Would affect all records if anti-patterns used
- **Mitigation:** Enforce anti-patterns AP-1/AP-2 — never use posted_at as fallback

---

## 10. Dependencies & Modifications

### 10.1 RPC Modifications Required

1. **F1 Transaction Creation RPC:**
   - Accept `document_date` and `accounting_date` parameters
   - Validate: DRAFT allows NULL, POSTED requires NOT NULL (unless UNKNOWABLE)
   - Block caller-provided `posted_at` (system-generated only)

2. **F2 Cash Movement Creation RPC:**
   - Use `f1.accounting_date` (not `f1.posted_at`) for `f2.effective_date`

3. **F5 Balance Query RPC:**
   - Filter by `f1.accounting_date` (not `f1.posted_at`) for `as_of` parameter

---

### 10.2 Worker Modifications Required

1. **Finance Outbox Worker:**
   - Validate document_date/accounting_date present
   - Include new date fields in event payload

2. **F2 Projection Worker:**
   - Use accounting_date (not posted_at) for effective_date

3. **F5 Balance Projection Worker:**
   - Filter by accounting_date (not posted_at)

---

## 11. Rollback Strategy

**Rollback Capability:**

**Phase 1-3 (Schema + Backfill):**
```sql
-- ✅ EASY ROLLBACK
ALTER TABLE finance_transactions
    DROP COLUMN document_date,
    DROP COLUMN accounting_date,
    DROP COLUMN backfill_inferred,
    DROP COLUMN backfill_classification,
    DROP COLUMN backfill_source,
    DROP COLUMN backfill_reason;
```

**Phase 4 (RPC/Worker Deployment):**
```
-- ❌ DIFFICULT ROLLBACK (requires redeployment)
```

**Point of No Return:** After Phase 4 (RPC/Worker deployment), rollback becomes expensive.

**Recommendation:** Execute Phases 1-3 first, validate thoroughly, THEN proceed to Phase 4.

---

## 12. Recommendations

### 12.1 Immediate Actions (UPDATED)

1. ❌ **DO NOT execute any migrations yet** — Phase 3.5 is ANALYSIS COMPLETE, not implementation approved
2. ✅ **Prepare Migration Proposal** — Document M-F1-DATES, M-F2-DATES DDL (NOT executed)
3. ✅ **Begin schema investigation** — SALES_ORDER first (Q3 approved)
4. ✅ **Document transaction-type-specific accounting recognition rules** (Q1 approved)
5. ✅ **Document F2_CASH exclusion logic** (Q2 approved)
6. ✅ **Document test data cleanup criteria** (Q4 approved)

**CRITICAL:** F3_AR_INVOICE 128 records are **READY FOR MIGRATION DESIGN**, NOT ready for execution.

**Migration Gate:**
```
Phase 3.5
   ✅ Backfill policy

Human Architect decisions (Q1-Q4)
   ✅ APPROVED

Migration proposal
   ❌ NOT CREATED YET
   ↓
Dry-run
   ↓
Expected row count
   ↓
Before/after evidence
   ↓
Verification gates
   ↓
Human Architect approval
   ↓
Execute
```

---

### 12.2 Final Approval Status (UPDATED)

**Phase 3 Status:** ✅ **ANALYSIS COMPLETE — ALL DECISIONS APPROVED**

**Human Architect Decisions:**
- [x] Q1: Accounting policy confirmed — **Event-based recognition rules** (NOT system-wide cash basis)
- [x] Q2: F2_CASH strategy approved — **Option C** (preserve NULL, exclude from temporal calculations)
- [x] Q3: Schema investigation priority confirmed — **SALES_ORDER first**
- [x] Q4: Test data strategy approved — **Controlled cleanup** (Phase 2.5 governance)

**Phase 3 Governance:**
- [x] Constraint resolution confirmed — **Resolution 1** (relax for UNKNOWABLE)
- [x] Anti-patterns enforcement confirmed — **AP-1 through AP-10 blocked**
- [x] "Provenance Over Convenience" principle maintained
- [x] Execution timeline documented (6 weeks phased)
- [x] Success criteria defined

**Phase 3:** ✅ **CLOSED**

---

**Next Phase:** **Migration Proposal**

**Migration proposal must include:**
1. M-F1-DATES DDL (add document_date, accounting_date columns) — **NOT executed**
2. M-F2-DATES DDL (update F2 to use accounting_date) — **NOT executed**
3. Dry-run results with row counts
4. Before/after evidence
5. Verification gates
6. Rollback plan

**Implementation BLOCKED until Migration Proposal approved:**
- ❌ M-F1-DATES execution
- ❌ M-F2-DATES execution
- ❌ M4b (F2 opening balance contract)
- ❌ F5.6 (F5 temporal queries use accounting_date)
- ❌ RPC/Worker modifications

**Approval Checklist:**
- [x] Q1: Accounting policy confirmed (event-based recognition)
- [x] Q2: F2_CASH strategy approved (Option C)
- [x] Q3: Schema investigation priority confirmed (SALES_ORDER first)
- [x] Q4: Test data strategy approved (controlled cleanup)
- [x] Constraint resolution confirmed (Resolution 1)
- [x] Anti-patterns enforcement confirmed
- [x] Execution timeline documented
- [x] Success criteria defined
- [ ] **Migration Proposal created** — NEXT STEP
- [ ] **Human Architect approves Migration Proposal** — REQUIRED BEFORE EXECUTION

---

## 13. Related Documents

**Phase 3 Analysis:**
- `PHASE3_POSTED_AT_FORENSIC.md` — posted_at ambiguous semantic (Phase 3.1)
- `PHASE3_DATE_SEMANTIC_CONTRACT.md` — 3-date contract design (Phase 3.2)
- `PHASE3_TT99_VAS_COMPLIANCE_MATRIX.md` — TT99 mapping (Phase 3.3)
- `PHASE3_NULLABILITY_DECISION.md` — Nullability by lifecycle (Phase 3.4)

**Phase 3.5 Backfill Policy:**
- `PHASE3_5_DOCUMENT_DATE_PROVENANCE.md` — document_date classification (Task 3)
- `PHASE3_5_ACCOUNTING_DATE_PROVENANCE.md` — accounting_date classification (Task 4)
- `PHASE3_5_POSTED_AT_SEMANTIC_FORENSIC.md` — posted_at forensic (Task 5)
- `PHASE3_5_SOURCE_TYPE_BACKFILL_RULES.md` — Source-type rules (Task 7)
- `PHASE3_5_BACKFILL_CLASSIFICATION_MATRIX.md` — Classification matrix (Task 8)
- `PHASE3_5_ANTI_PATTERNS.md` — Anti-patterns (Task 9)
- `PHASE3_5_BACKFILL_IMPACT_ESTIMATE.md` — Impact estimate (Task 10)

---

## Document Status

**Version:** 1.0  
**Status:** ✅ **PHASE 3 CLOSED — ALL DECISIONS APPROVED**  
**Date:** 2026-08-24  
**Human Architect Decisions:** Q1-Q4 ✅ APPROVED  
**Next Step:** Create Migration Proposal (M-F1-DATES, M-F2-DATES design — NOT executed)  
**Implementation Status:** ❌ **BLOCKED** — Migration Proposal must be approved separately before any execution

---

**CRITICAL GOVERNANCE:**
- ❌ NO migrations executed yet (Phase 3.5 = analysis only)
- ❌ F3_AR_INVOICE 128 records = READY FOR DESIGN, NOT ready for execution
- ✅ Q1: Event-based accounting recognition (NOT system-wide cash basis)
- ✅ Q2: F2_CASH preserve NULL, exclude from temporal (Option C)
- ✅ Q3: SALES_ORDER investigation first
- ✅ Q4: Controlled test cleanup (Phase 2.5 governance)
- ✅ Anti-patterns AP-1 through AP-10 enforcement confirmed
- ✅ "Provenance Over Convenience" principle maintained

---

**END OF DOCUMENT**
