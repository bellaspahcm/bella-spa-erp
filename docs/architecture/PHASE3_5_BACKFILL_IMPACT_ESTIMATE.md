# Phase 3.5: Backfill Impact Estimate

**Status:** ✅ COMPLETE  
**Date:** 2026-08-24  
**Phase:** 3.5 (Backfill Policy Design)  
**Purpose:** Quantify backfill impact across records, schema, constraints, and dependencies

---

## Executive Summary

This document estimates the **impact** of Phase 3 date backfill policy across multiple dimensions:
- **Record Impact:** 675 POSTED F1 transactions
- **Schema Impact:** 4 new metadata columns + 2 new date columns
- **Constraint Impact:** Phase 3.4 NOT NULL constraints conflict with 234 UNKNOWABLE records
- **Dependency Impact:** F2, F5, RPC, Worker modifications required
- **Risk Impact:** 67 VERY HIGH risk records (F2_CASH) require immediate decision

**Key Finding:** Only **128 records (19%)** can be backfilled with high confidence. The remaining **547 records (81%)** require policy decisions, schema investigation, or manual review.

---

## 1. Record-Level Impact

### 1.1 Overall Distribution

| Classification | Records | Percentage | Status |
|----------------|---------|------------|--------|
| **PROVABLE** | 128 | 19% | ✅ Ready to backfill |
| **INFERABLE** | 313 | 46% | 🔴 Blocked on investigation + Q1 |
| **UNKNOWABLE** | 234 | 35% | 🔴 Blocked on Q2 + Q4 decisions |
| **TOTAL** | **675** | **100%** | — |

**Backfill Confidence:**
- **High Confidence (PROVABLE):** 19%
- **Medium Confidence (INFERABLE):** 46%
- **No Confidence (UNKNOWABLE):** 35%

---

### 1.2 Impact by Source Type

| Source Type | Records | % | document_date Impact | accounting_date Impact | Risk |
|-------------|---------|---|----------------------|------------------------|------|
| **F3_AR_INVOICE** | 128 | 19% | ✅ PROVABLE backfill (128) | 🔴 INFERABLE (128, Q1) | LOW-MED |
| **SALES_ORDER** | 208 | 31% | 🔴 INFERABLE (208, investigation) | 🔴 INFERABLE (208, Q1) | MEDIUM |
| **CONCURRENCY_TEST** | 102 | 15% | 🔴 UNKNOWABLE (102, Q4) | 🔴 UNKNOWABLE (102, Q4) | LOW |
| **AP_PAYMENT** | 74 | 11% | 🔴 INFERABLE (74, investigation) | 🔴 INFERABLE (74, Q1) | HIGH |
| **F2_CASH** | 67 | 10% | 🔴 **UNKNOWABLE (67, Q2)** | 🔴 **UNKNOWABLE (67, Q2)** | **VERY HIGH** |
| **VERIFICATION** | 35 | 5% | 🔴 UNKNOWABLE (35, Q4) | 🔴 UNKNOWABLE (35, Q4) | LOW |
| **SPA_BOOKING** | 31 | 5% | 🔴 INFERABLE (31, investigation) | 🔴 INFERABLE (31, Q1) | MEDIUM |
| **F2_REGRESSION** | 18 | 3% | 🔴 UNKNOWABLE (18, Q4) | 🔴 UNKNOWABLE (18, Q4) | LOW |
| **test** | 12 | 2% | 🔴 UNKNOWABLE (12, Q4) | 🔴 UNKNOWABLE (12, Q4) | LOW |

**Critical:** F2_CASH (67 records, 10%) requires immediate Human Architect decision (Q2).

---

### 1.3 Detailed Impact by Date Field

#### document_date Impact

| Classification | Records | Backfill Strategy | Dependency |
|----------------|---------|-------------------|------------|
| **PROVABLE** | 128 (19%) | Direct field mapping (`finance_invoices.issue_date`) | ✅ None — ready now |
| **INFERABLE** | 313 (46%) | Policy-based from source tables | 🔴 Schema investigation (SALES_ORDER, AP_PAYMENT, SPA_BOOKING) |
| **UNKNOWABLE** | 234 (35%) | Preserve NULL or manual review | 🔴 Q2 (F2_CASH 67), Q4 (Test data 167) |

**Records Backfillable Without Dependencies:** **128 (19%)**

**Records Blocked:** **547 (81%)**

---

#### accounting_date Impact

| Classification | Records | Backfill Strategy | Dependency |
|----------------|---------|-------------------|------------|
| **PROVABLE** | 0 (0%) | N/A (no source tables with explicit accounting_date field) | N/A |
| **INFERABLE** | 441 (65%) | Policy-based (`= document_date` for cash basis) | 🔴 Q1 (accounting policy) + document_date backfill |
| **UNKNOWABLE** | 234 (35%) | Preserve NULL or manual review | 🔴 Q2 (F2_CASH 67), Q4 (Test data 167) |

**Records Backfillable Without Dependencies:** **0 (0%)**

**All 675 records blocked** on either Q1 (accounting policy) or Q2/Q4 (UNKNOWABLE strategy).

---

## 2. Schema Impact

### 2.1 New Columns Required

#### finance_transactions Table

```sql
ALTER TABLE finance_transactions
-- Phase 3.2: 3-Date Contract
ADD COLUMN IF NOT EXISTS document_date DATE,
ADD COLUMN IF NOT EXISTS accounting_date DATE,
-- posted_at already exists, semantic changed from "ambiguous" to "system timestamp"

-- Phase 3.5: Backfill Metadata
ADD COLUMN IF NOT EXISTS backfill_inferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS backfill_classification TEXT CHECK (
    backfill_classification IN ('PROVABLE', 'INFERABLE', 'UNKNOWABLE', 'MANUAL_REVIEW_REQUIRED')
),
ADD COLUMN IF NOT EXISTS backfill_source TEXT,
ADD COLUMN IF NOT EXISTS backfill_reason TEXT;
```

**Schema Change Impact:**
- **2 new date columns** (document_date, accounting_date)
- **4 new metadata columns** (backfill audit trail)
- **1 semantic change** (posted_at definition)

**Storage Impact:**
- date columns: 4 bytes each × 2 × 675 records = ~5.4 KB
- metadata columns: ~100 bytes avg × 4 × 675 records = ~270 KB
- **Total additional storage: ~275 KB** (negligible for 675 records)

---

### 2.2 Index Impact

**Recommended Indexes:**

```sql
-- 1. Temporal queries (F5 as_of balance)
CREATE INDEX idx_finance_transactions_accounting_date 
    ON finance_transactions(tenant_id, accounting_date)
    WHERE lifecycle_state = 'POSTED';

-- 2. Document date range queries
CREATE INDEX idx_finance_transactions_document_date 
    ON finance_transactions(tenant_id, document_date)
    WHERE lifecycle_state = 'POSTED';

-- 3. Audit trail queries (backfill classification)
CREATE INDEX idx_finance_transactions_backfill_classification 
    ON finance_transactions(backfill_classification)
    WHERE backfill_classification IN ('INFERABLE', 'UNKNOWABLE', 'MANUAL_REVIEW_REQUIRED');
```

**Index Storage Impact:** ~150 KB total (3 indexes on 675 records, partial indexes)

---

## 3. Constraint Impact

### 3.1 Phase 3.4 NOT NULL Constraint Conflict

**Phase 3.4 Constraint Definition:**
```sql
CHECK (
    (lifecycle_state = 'POSTED' 
     AND document_date IS NOT NULL 
     AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
)
```

**Conflict with UNKNOWABLE Classification:**
- **234 records (35%)** have UNKNOWABLE provenance
- **If Option A chosen** (preserve NULL): Constraint violation
- **If Option B chosen** (use posted_at with risk flag): Violates "Provenance Over Convenience"

---

### 3.2 Constraint Resolution Options

**Resolution 1: Relax Constraint for UNKNOWABLE Records (RECOMMENDED)**

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
- ✅ Maintains NOT NULL for future transactions
- ⚠️ Requires backfill_classification column

---

**Resolution 2: Grandfather Clause for Historical Data**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_posted_dates_not_null CHECK (
    (lifecycle_state = 'POSTED' 
     AND created_at > '2026-08-24'::date  -- Future transactions only
     AND document_date IS NOT NULL 
     AND accounting_date IS NOT NULL)
    OR lifecycle_state = 'DRAFT'
    OR created_at <= '2026-08-24'::date  -- Historical data exempted
);
```

**Impact:**
- ✅ Exempts historical data from constraint
- ✅ Enforces NOT NULL for future transactions
- ⚠️ Creates governance gap (historical data not validated)

---

**Resolution 3: Accept Option B (NOT RECOMMENDED)**

Use posted_at as fallback with explicit UNKNOWABLE flag.

**Impact:**
- ✅ Achieves NOT NULL constraint
- ❌ **Violates "Provenance Over Convenience" principle**
- ❌ Propagates semantic ambiguity to new date fields
- ❌ Contradicts Phase 3.5 anti-pattern AP-1/AP-2

---

### 3.3 Constraint Impact Summary

| Resolution | Records Affected | Governance Impact | Recommendation |
|------------|------------------|-------------------|----------------|
| **Resolution 1** | 234 (UNKNOWABLE) | Relaxes constraint for historical data with provenance flag | ✅ **RECOMMENDED** |
| **Resolution 2** | 234 (historical) | Exempts historical data entirely | ⚠️ Acceptable |
| **Resolution 3** | 234 (UNKNOWABLE) | Violates core governance principle | ❌ **NOT RECOMMENDED** |

**Recommendation:** Resolution 1 (relax for UNKNOWABLE with explicit flag).

---

## 4. Dependency Impact

### 4.1 F2 Cash Movements

**Current Implementation:**
```typescript
// ❌ WRONG per Phase 3.2
f2.effective_date = f1.posted_at;
```

**Required Change:**
```typescript
// ✅ CORRECT per Phase 3.2
f2.effective_date = f1.accounting_date;
```

**Impact:**
- **67 existing F2 records:** effective_date currently inherited from ambiguous posted_at
- **Future F2 records:** Must use accounting_date (semantic correction)
- **Migration required:** Update F2 creation logic in RPC/Worker

**Files Affected:**
- RPC: `finance_cash_create_movement()` or equivalent
- Worker: Cash projection logic
- Tests: F2 creation test fixtures

**Risk:** HIGH — Changes F2 temporal authority from ambiguous to explicit

---

### 4.2 F5 Balance Queries

**Current Implementation:**
```sql
-- ❌ WRONG per Phase 3.1
WHERE f1.posted_at <= p_as_of
```

**Required Change:**
```sql
-- ✅ CORRECT per Phase 3.2
WHERE f1.accounting_date <= p_as_of
```

**Impact:**
- **F5 `get_balance_as_of()` queries:** Must filter by accounting_date (not posted_at)
- **F5 temporal logic:** accounting_date determines accounting period (not posted_at)
- **Balance calculation results may change** after backfill (if accounting_date ≠ posted_at)

**Files Affected:**
- F5 Balance RPC: `finance_get_balance_as_of()`
- F5 Projection Worker
- F5 Balance tests

**Risk:** HIGH — Changes balance calculation temporal authority

---

### 4.3 RPC Modifications

**Affected RPCs:**

1. **F1 Transaction Creation RPC:**
   - Must accept `document_date` and `accounting_date` parameters (currently only posted_at?)
   - Must validate: DRAFT allows NULL, POSTED requires NOT NULL (unless UNKNOWABLE)
   - Must NOT accept caller-provided `posted_at` (system-generated only per Phase 3.2)

2. **F2 Cash Movement Creation RPC:**
   - Must use `f1.accounting_date` (not `f1.posted_at`) for `f2.effective_date`

3. **F5 Balance Query RPC:**
   - Must filter by `f1.accounting_date` (not `f1.posted_at`) for `as_of` parameter

**Impact:** **3 RPCs require signature and logic changes**

---

### 4.4 Worker Modifications

**Affected Workers:**

1. **Finance Outbox Worker:**
   - Processes F1 transactions → must validate document_date/accounting_date present
   - Event payload includes new date fields

2. **F2 Projection Worker:**
   - Projects F1 → F2 cash movements
   - Must use accounting_date (not posted_at) for effective_date

3. **F5 Balance Projection Worker:**
   - Calculates balances from F1 transactions
   - Must filter by accounting_date (not posted_at)

**Impact:** **3 Workers require logic changes**

---

## 5. Testing Impact

### 5.1 Test Data Cleanup

**Test Source Types:**
- CONCURRENCY_TEST: 102 records (15%)
- VERIFICATION: 35 records (5%)
- F2_REGRESSION: 18 records (3%)
- test: 12 records (2%)

**Total Test Data:** **167 records (25%)**

**Decision Required (Q4):**
- **Option A:** Preserve NULL (honest semantic)
- **Option B:** Backfill for test continuity (with UNKNOWABLE flag)
- **Option C:** Delete test data (Phase 2.5-style cleanup)

**Impact of Option C (Delete):**
- Remove 167 records (25% reduction)
- Cleaner production database
- Requires Human Architect approval
- May affect regression test baselines

---

### 5.2 Test Suite Updates

**Affected Test Suites:**

1. **F1 Transaction Tests:**
   - Update test fixtures to include document_date/accounting_date
   - Update assertions to validate new date semantics
   - ~50 tests estimated

2. **F2 Cash Movement Tests:**
   - Update F2 creation to use accounting_date (not posted_at)
   - Update effective_date assertions
   - ~30 tests estimated

3. **F5 Balance Tests:**
   - Update as_of queries to use accounting_date
   - Update balance calculation assertions
   - ~40 tests estimated

4. **Integration Tests:**
   - F1 → F2 → F5 end-to-end flows
   - ~20 tests estimated

**Total Test Updates:** ~140 tests estimated

**Test Execution Time Impact:** +10-15% (additional date validation assertions)

---

## 6. Migration Execution Impact

### 6.1 Execution Timeline Estimate

**Phase 1: Schema Changes (5 minutes)**
```
- Add document_date, accounting_date columns (nullable)
- Add backfill metadata columns
- Create indexes
```

**Phase 2: PROVABLE Backfill (2 minutes)**
```
- F3_AR_INVOICE document_date: 128 records
- Validation queries
```

**Phase 3: Schema Investigation (BLOCKED — duration unknown)**
```
- SALES_ORDER: Investigate sales_orders table schema
- AP_PAYMENT: Investigate finance_payments table schema
- SPA_BOOKING: Investigate spa_bookings table schema
```

**Phase 4: INFERABLE Backfill (10 minutes, after Phase 3 complete)**
```
- document_date: 313 records (SALES_ORDER, AP_PAYMENT, SPA_BOOKING)
- accounting_date: 441 records (cash basis policy)
- Validation queries
```

**Phase 5: UNKNOWABLE Handling (depends on Q2/Q4 decisions)**
```
- F2_CASH: 67 records (Option A/B/C)
- Test data: 167 records (preserve NULL / backfill / delete)
```

**Phase 6: Constraint Application (1 minute)**
```
- Add CHECK constraint (Resolution 1 or 2)
- Validation queries
```

**Phase 7: RPC/Worker Deployment (30 minutes)**
```
- Deploy updated F1, F2, F5 RPCs
- Deploy updated Workers
- Smoke tests
```

**Total Estimated Duration:**
- **Minimum (PROVABLE only):** ~40 minutes (Phases 1, 2, 6, 7)
- **Maximum (full backfill):** ~60 minutes (all phases, assuming investigation complete)

**Blockers:**
- Phase 3: Schema investigation (duration UNKNOWN)
- Phase 4: Q1 decision (accounting policy)
- Phase 5: Q2 (F2_CASH) + Q4 (test data) decisions

---

### 6.2 Downtime Impact

**Zero-Downtime Migration:** YES (with caveats)

**Approach:**
1. **Schema changes:** Add columns (nullable) → no downtime
2. **Backfill:** Execute in background → no downtime
3. **Constraint:** Add CHECK constraint → brief validation lock (~1 second)
4. **RPC/Worker deployment:** Rolling deployment → no downtime

**Caveats:**
- New transactions during backfill: Will have NULL dates until backfill completes
- F5 balance queries during backfill: May return inconsistent results (some records use posted_at, some use accounting_date)

**Recommendation:** Execute during low-traffic window (e.g., weekend) to minimize inconsistency window.

---

## 7. Risk Impact Assessment

### 7.1 Risk by Source Type

| Source Type | Records | Risk Level | Risk Factors | Mitigation |
|-------------|---------|------------|--------------|------------|
| **F2_CASH** | 67 (10%) | **VERY HIGH** | No provenance, circular logic, semantic ambiguity | Q2 decision required — preserve NULL or manual review |
| **AP_PAYMENT** | 74 (11%) | **HIGH** | Payment semantic varies by jurisdiction, TT99 compliance | Schema investigation + semantic validation required |
| **F3_AR_INVOICE (acct)** | 128 (19%) | **MEDIUM** | Accounting policy dependency (cash vs accrual) | Q1 decision required |
| **SALES_ORDER** | 208 (31%) | **MEDIUM** | Schema unknown, semantic validation required | Schema investigation required |
| **SPA_BOOKING** | 31 (5%) | **MEDIUM** | Revenue recognition policy dependency | Schema investigation + Q1 decision |
| **Test Data** | 167 (25%) | **LOW** | Test artifacts, no production impact | Q4 decision required |

---

### 7.2 Risk Mitigation Strategy

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **F2_CASH no provenance** | VERY HIGH | 100% | Option A (preserve NULL) or Option C (manual review) — avoid Option B |
| **Accounting policy ambiguity** | HIGH | 80% | Obtain explicit Human Architect confirmation before INFERABLE backfill |
| **Schema investigation incomplete** | HIGH | 60% | Block INFERABLE backfill until schema + semantic validation complete |
| **TT99 compliance (AP_PAYMENT)** | HIGH | 40% | Validate payment date semantics against TT99 requirements |
| **Semantic contamination (posted_at fallback)** | CRITICAL | 0% (blocked) | Enforce anti-patterns AP-1/AP-2 — never use posted_at as fallback |
| **Test data contamination** | MEDIUM | 50% | Separate handling (preserve NULL, delete, or explicit test flag) |
| **F5 balance calculation change** | MEDIUM | 70% | Validate balance results before/after accounting_date switch |
| **Constraint violation (234 UNKNOWABLE)** | MEDIUM | 100% (if Resolution 3) | Use Resolution 1 (relax for UNKNOWABLE) or Resolution 2 (grandfather clause) |

---

### 7.3 Rollback Strategy

**Rollback Capability:**

**Phase 1-2 (Schema + PROVABLE backfill):**
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

**Phase 4-5 (INFERABLE + UNKNOWABLE backfill):**
```sql
-- ⚠️ PARTIAL ROLLBACK (can clear backfill, but semantic already changed)
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_inferred = FALSE,
    backfill_classification = NULL,
    backfill_source = NULL,
    backfill_reason = NULL;
```

**Phase 7 (RPC/Worker deployment):**
```
-- ❌ DIFFICULT ROLLBACK (requires redeployment of previous RPC/Worker versions)
-- Rollback RPCs/Workers to previous versions
-- Redeploy
```

**Point of No Return:** After Phase 7 (RPC/Worker deployment), rollback becomes expensive.

**Recommendation:** Execute Phases 1-6 first, validate thoroughly, THEN proceed to Phase 7.

---

## 8. Business Impact

### 8.1 Data Quality Impact

**Before Backfill:**
- 675 POSTED transactions with ambiguous date semantic
- F5 balance queries use ambiguous posted_at
- F2.effective_date has no provenance
- No audit trail of date provenance

**After Backfill (Complete):**
- 128 records (19%) with PROVABLE date provenance
- 313 records (46%) with INFERABLE date provenance (policy-documented)
- 234 records (35%) with UNKNOWABLE provenance (honest semantic)
- Full audit trail via backfill metadata columns

**Data Quality Improvement:** +19% PROVABLE, +46% INFERABLE with explicit policy

---

### 8.2 Accounting Compliance Impact

**TT99/VAS Requirements:**
- **Ngày chứng từ** (document_date): Now explicitly tracked (was ambiguous posted_at)
- **Ngày hạch toán** (accounting_date): Now explicitly tracked (was ambiguous posted_at)
- **Period closing enforcement:** Can now validate accounting_date respects period lock

**Compliance Improvement:** Explicit date semantics enable TT99 validation (was impossible with ambiguous posted_at).

---

### 8.3 Reporting Impact

**F5 Balance Reports:**
- **Before:** Balance as_of uses posted_at (ambiguous)
- **After:** Balance as_of uses accounting_date (explicit accounting period semantic)

**Impact:** Balance reports may show **different values** if accounting_date ≠ posted_at.

**Example:**
```
Transaction created 2024-12-30 (posted_at)
Document date 2024-12-28 (document_date)
Accounting recognized 2024-12-31 (accounting_date, month-end close)

Before: Balance as_of 2024-12-29 INCLUDES transaction (used posted_at)
After:  Balance as_of 2024-12-29 EXCLUDES transaction (uses accounting_date)
```

**Recommendation:** Validate balance reports before/after switch, communicate changes to finance team.

---

## 9. Cost Impact

### 9.1 Engineering Cost

| Phase | Effort (hours) | Resource | Notes |
|-------|----------------|----------|-------|
| **Schema Investigation** | 16 hours | 1 engineer | SALES_ORDER, AP_PAYMENT, SPA_BOOKING schema + semantic validation |
| **Migration Script Development** | 24 hours | 1 engineer | SQL scripts + validation queries + rollback scripts |
| **RPC/Worker Modifications** | 40 hours | 1 engineer | F1, F2, F5 RPC + Worker logic changes |
| **Test Suite Updates** | 32 hours | 1 engineer | ~140 tests (fixtures, assertions, validation) |
| **Migration Execution** | 4 hours | 1 engineer + 1 DBA | Execution + validation + smoke tests |
| **Post-Migration Validation** | 8 hours | 1 engineer | Balance report validation, compliance checks |
| **TOTAL** | **124 hours** | ~3 weeks | 1 engineer full-time |

**Cost Estimate (assuming $100/hour blended rate):** **~$12,400**

---

### 9.2 Infrastructure Cost

**Storage:**
- Additional columns: ~275 KB (negligible)
- Indexes: ~150 KB (negligible)

**Compute:**
- Backfill execution: ~10 minutes CPU time (one-time)
- Ongoing query performance: No significant impact (indexed queries)

**Infrastructure Cost:** **Negligible** (< $1 total)

---

## 10. Decision Impact Matrix

### 10.1 Human Architect Decisions Required

| Decision ID | Question | Records Affected | Cost of Delay | Recommendation |
|-------------|----------|------------------|---------------|----------------|
| **Q1** | Accounting policy (cash vs accrual)? | 441 (65%) | HIGH — blocks accounting_date backfill | Confirm cash basis (accounting_date = document_date) |
| **Q2** | F2_CASH strategy (Option A/B/C)? | 67 (10%) | **CRITICAL** — VERY HIGH risk | **Option A** (preserve NULL) or **Option C** (manual review) |
| **Q3** | Schema investigation priority? | 313 (46%) | HIGH — blocks INFERABLE backfill | Investigate SALES_ORDER first (highest volume) |
| **Q4** | Test data strategy? | 167 (25%) | MEDIUM — test data, low business impact | Option A (preserve NULL) or Option C (delete) |

---

### 10.2 Decision Impact Cascade

```
Q2 (F2_CASH) Decision
    ↓
Option A (preserve NULL) → Resolution 1 (relax constraint)
    ↓
Phase 3.4 NOT NULL constraint modified
    ↓
234 records (35%) remain NULL → HONEST SEMANTIC

Q2 (F2_CASH) Decision
    ↓
Option B (use posted_at) → ❌ VIOLATES GOVERNANCE
    ↓
Anti-pattern AP-1/AP-2 triggered
    ↓
Semantic contamination → NOT RECOMMENDED

Q1 (Accounting Policy) Decision
    ↓
Cash Basis → accounting_date = document_date
    ↓
441 records (65%) backfilled with INFERABLE
    ↓
Test suite updates required (~40 tests)

Q1 (Accounting Policy) Decision
    ↓
Accrual Basis → accounting_date ≠ document_date
    ↓
Requires transaction-type-specific recognition logic
    ↓
Higher complexity + risk
```

---

## 11. Summary Statistics

### 11.1 Overall Impact

| Dimension | Metric | Value |
|-----------|--------|-------|
| **Records** | Total POSTED transactions | 675 |
| **Records** | PROVABLE (high confidence) | 128 (19%) |
| **Records** | INFERABLE (medium confidence) | 313 (46%) |
| **Records** | UNKNOWABLE (no confidence) | 234 (35%) |
| **Records** | Ready to backfill (no blockers) | 128 (19%) |
| **Records** | Blocked on decisions | 547 (81%) |
| **Schema** | New date columns | 2 |
| **Schema** | New metadata columns | 4 |
| **Schema** | New indexes | 3 |
| **Storage** | Additional storage | ~275 KB |
| **Risk** | VERY HIGH risk records | 67 (10%) |
| **Risk** | HIGH risk records | 74 (11%) |
| **Cost** | Engineering effort | ~124 hours (~3 weeks) |
| **Cost** | Engineering cost | ~$12,400 |
| **Dependencies** | RPCs requiring changes | 3 |
| **Dependencies** | Workers requiring changes | 3 |
| **Dependencies** | Tests requiring updates | ~140 |
| **Timeline** | Migration execution | 40-60 minutes |
| **Downtime** | Expected downtime | 0 (zero-downtime capable) |

---

### 11.2 Execution Readiness

| Phase | Status | Blockers |
|-------|--------|----------|
| **Schema Changes** | ✅ READY | None |
| **PROVABLE Backfill** | ✅ READY | None (F3_AR_INVOICE document_date only) |
| **Schema Investigation** | 🔴 BLOCKED | Q3 (investigation priority) |
| **INFERABLE Backfill** | 🔴 BLOCKED | Schema investigation + Q1 (accounting policy) |
| **UNKNOWABLE Handling** | 🔴 BLOCKED | Q2 (F2_CASH) + Q4 (test data) |
| **Constraint Application** | 🔴 BLOCKED | Q2 decision (Resolution 1 if Option A) |
| **RPC/Worker Deployment** | 🔴 BLOCKED | All above phases complete |

**Overall Status:** 🔴 **BLOCKED** on 4 Human Architect decisions (Q1-Q4)

---

## 12. Recommendations

### 12.1 Immediate Actions

1. ✅ **Execute F3_AR_INVOICE document_date backfill** (128 records, PROVABLE, LOW RISK)
   - No blockers, can proceed immediately
   - Validates backfill pipeline before larger execution

2. 🔴 **Human Architect: Decide F2_CASH strategy** (Q2) — **CRITICAL PRIORITY**
   - 67 records (10%), VERY HIGH risk
   - Recommend: **Option A** (preserve NULL with Resolution 1) or **Option C** (manual review)
   - **DO NOT choose Option B** (violates governance)

3. 🔴 **Human Architect: Confirm accounting policy** (Q1) — **HIGH PRIORITY**
   - Affects 441 records (65%)
   - Recommend: Confirm cash basis (accounting_date = document_date for F3_AR_INVOICE, SALES_ORDER)

4. 🔴 **Begin schema investigation** (Q3) — **HIGH PRIORITY**
   - Start with SALES_ORDER (208 records, 31% — highest volume)
   - Then AP_PAYMENT (74 records, 11% — TT99 compliance)
   - Finally SPA_BOOKING (31 records, 5% — lowest volume)

---

### 12.2 Phased Execution Strategy

**Phase 1A: Quick Win (Week 1)**
- Execute F3_AR_INVOICE document_date backfill (128 records)
- Validate backfill pipeline
- Deploy with monitoring

**Phase 1B: Critical Decision (Week 1)**
- Human Architect decides Q2 (F2_CASH strategy)
- If Option A → prepare Resolution 1 (relax constraint)
- If Option C → prepare manual review workflow

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
- Test suite updates
- Smoke tests

**Phase 5: Validation & Monitoring (Week 6)**
- F5 balance report validation
- TT99 compliance checks
- Post-migration monitoring

**Total Timeline: 6 weeks** (with parallel work)

---

### 12.3 Success Criteria

**Backfill Success:**
- [ ] 128 PROVABLE records backfilled (F3_AR_INVOICE document_date)
- [ ] 313 INFERABLE records backfilled (document_date, after investigation)
- [ ] 441 INFERABLE records backfilled (accounting_date, after Q1)
- [ ] 234 UNKNOWABLE records handled per Q2/Q4 decisions
- [ ] 0 anti-patterns violated (AP-1 through AP-10)
- [ ] 100% backfill metadata populated (audit trail)

**System Success:**
- [ ] F2.effective_date uses accounting_date (not posted_at)
- [ ] F5 as_of queries use accounting_date (not posted_at)
- [ ] RPC/Worker changes deployed without regression
- [ ] Test suite passes (140 updated tests)
- [ ] Balance reports validated (before/after match expected behavior)

**Governance Success:**
- [ ] "Provenance Over Convenience" principle maintained
- [ ] No semantic contamination (posted_at not used as fallback)
- [ ] Audit trail complete (backfill metadata for all records)
- [ ] TT99 compliance demonstrated (explicit date semantics)

---

**Document Status:** ✅ COMPLETE  
**Next Step:** Task 11 (Consolidated PHASE3_BACKFILL_POLICY.md)  
**Approval Required:** 🔴 BLOCKED on Human Architect decisions (Q1-Q4)  
**Implementation Blocked:** ❌ M-F1-DATES NOT APPROVED YET
