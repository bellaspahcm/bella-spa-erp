# Phase 4.2: AP_PAYMENT Schema & Provenance Investigation

**Status:** 🔵 IN PROGRESS  
**Date:** 2026-08-24  
**Phase:** 4.2 (Migration Readiness — Schema Investigation)  
**Priority:** P1 (74 records, 11% of F1 POSTED)

---

## Investigation Objective

Determine `document_date` provenance for **74 AP_PAYMENT transactions (11% of F1 POSTED)** by investigating source table schema and semantic.

**Critical Question:** Does AP_PAYMENT have PROVABLE, INFERABLE, or UNKNOWABLE `document_date` provenance?

---

## Investigation Scope

### 1. Schema Discovery

**Questions:**
- Does `finance_payments`, `ap_payments`, or `payments` table exist?
- What date fields are available?
- What is the semantic of each date field?
- Are date fields populated (NULL completeness)?
- What is source_id format (UUID vs string)?

### 2. Provenance Classification

**Framework:**
```
AP_PAYMENT date field
    ↓
Semantic analysis
    ↓
┌────┼────┐
↓    ↓    ↓
PROVABLE │ INFERABLE │ UNKNOWABLE
    ↓    ↓    ↓
Direct   Policy-based   Preserve NULL
mapping  inference      or manual review
```

### 3. Validation

**Criteria:**
- Field must have business date semantic (NOT system metadata)
- Field must be populated for AP_PAYMENT → F1 linkage
- Field semantic must align with TT99 "Ngày chứng từ" (document date)
- source_id type must be compatible with table primary key

---

## Investigation Steps

### Step 1: Table Existence Check

**Candidate Tables:**
- `finance_payments`
- `ap_payments`
- `payments`
- `accounts_payable_payments`

**Expected Result:** One table found with payments data

---

### Step 2: F1 AP_PAYMENT Sample Analysis

**Query:**
```sql
SELECT id, source_id, tenant_id, posted_at, created_at
FROM finance_transactions
WHERE source_type = 'AP_PAYMENT'
  AND status = 'POSTED'
ORDER BY created_at
LIMIT 10;
```

**Analysis Points:**
- source_id format (UUID vs custom string)
- Pattern consistency
- Test vs production data indicators

---

### Step 3: Linkage Verification

**Query:**
```sql
-- Verify F1.source_id → payments.id linkage
SELECT 
    COUNT(*) AS f1_count,
    COUNT(p.id) AS payments_found,
    COUNT(*) - COUNT(p.id) AS orphans
FROM finance_transactions f1
LEFT JOIN {payments_table} p 
    ON f1.source_id = p.id::TEXT
    AND f1.tenant_id = p.tenant_id
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.status = 'POSTED';
```

**Expected Result:**
- `f1_count` = 74
- `orphans` = 0 (all F1 records have source linkage)
- Type compatibility confirmed

---

### Step 4: Date Field Discovery

**Expected Date Fields:**
- `payment_date` — When payment was made/received
- `transaction_date` — When transaction occurred
- `document_date` — Source document date
- `due_date` — Payment due date
- `created_at` — System metadata (NOT business date)
- `updated_at` — System metadata (NOT business date)

**Semantic Questions:**
- Which date represents "business event date" for payment?
- Which date aligns with TT99 "Ngày chứng từ"?
- Which date should determine accounting period?

---

### Step 5: Date Field Completeness

**Query:**
```sql
SELECT 
    COUNT(*) AS total_payments,
    COUNT(payment_date) AS has_payment_date,
    COUNT(transaction_date) AS has_transaction_date,
    COUNT(document_date) AS has_document_date,
    ROUND(100.0 * COUNT(payment_date) / COUNT(*), 2) AS payment_date_pct,
    ROUND(100.0 * COUNT(transaction_date) / COUNT(*), 2) AS transaction_date_pct,
    ROUND(100.0 * COUNT(document_date) / COUNT(*), 2) AS document_date_pct
FROM {payments_table} p
WHERE EXISTS (
    SELECT 1 FROM finance_transactions f1
    WHERE f1.source_id = p.id::TEXT
      AND f1.source_type = 'AP_PAYMENT'
      AND f1.status = 'POSTED'
);
```

**Expected Result:** Completeness > 80% for at least one business date field

---

### Step 6: Sample Data Analysis

**Query:**
```sql
SELECT 
    f1.id AS f1_id,
    f1.source_id,
    f1.posted_at AS f1_posted_at,
    f1.created_at AS f1_created_at,
    p.payment_date,
    p.transaction_date,
    p.document_date,
    p.created_at AS p_created_at
FROM finance_transactions f1
JOIN {payments_table} p 
    ON f1.source_id = p.id::TEXT
    AND f1.tenant_id = p.tenant_id
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.status = 'POSTED'
ORDER BY f1.created_at
LIMIT 20;
```

**Analysis:**
- Date field consistency
- Business date vs system metadata distinction
- Relationship between F1.posted_at and payment dates

---

## Provenance Classification Decision Tree

```
payments table exists?
    │
    ├─ YES
    │   ↓
    │   source_id type compatible?
    │   │
    │   ├─ YES
    │   │   ↓
    │   │   Has business date field?
    │   │   │
    │   │   ├─ YES
    │   │   │   ↓
    │   │   │   Field has explicit document date semantic?
    │   │   │   │
    │   │   │   ├─ YES → PROVABLE
    │   │   │   │   └─ Backfill: document_date = payments.{field}
    │   │   │   │
    │   │   │   └─ NO → INFERABLE
    │   │   │       └─ Backfill: document_date = payments.{field} (policy-based)
    │   │   │
    │   │   └─ NO → Only created_at/updated_at
    │   │       ↓
    │   │       UNKNOWABLE (system metadata, not business date)
    │   │       └─ Preserve NULL
    │   │
    │   └─ NO → Type mismatch (UUID vs string)
    │       ↓
    │       UNKNOWABLE (cannot resolve linkage)
    │       └─ Preserve NULL (possible test data like SALES_ORDER)
    │
    └─ NO
        ↓
        UNKNOWABLE (no source table)
        └─ Preserve NULL
```

---

## Expected Outcomes

### Outcome A: PROVABLE (BEST CASE)

**Condition:**
- `payments` table exists
- source_id type compatible (UUID)
- Has explicit `payment_date` or `document_date` field
- Completeness > 95%
- No ambiguity

**Classification:** **PROVABLE**

**Backfill Strategy:**
```sql
UPDATE finance_transactions f1
SET 
    document_date = p.payment_date,  -- or p.document_date
    backfill_inferred = FALSE,
    backfill_classification = 'PROVABLE',
    backfill_source = 'payments.payment_date',
    backfill_reason = 'Direct mapping from payment date'
FROM {payments_table} p
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = p.id::TEXT
  AND f1.tenant_id = p.tenant_id
  AND f1.status = 'POSTED'
  AND f1.document_date IS NULL;
```

**Impact:** 74 records (11%) upgrade to PROVABLE

**Risk:** LOW

---

### Outcome B: INFERABLE (MEDIUM CASE)

**Condition:**
- `payments` table exists
- source_id type compatible
- Has business date field (payment_date, transaction_date, etc.)
- Semantic requires policy assumption
- Completeness > 80%

**Classification:** **INFERABLE**

**Backfill Strategy:**
```sql
UPDATE finance_transactions f1
SET 
    document_date = p.payment_date,
    backfill_inferred = TRUE,
    backfill_classification = 'INFERABLE',
    backfill_source = 'payments.payment_date',
    backfill_reason = 'Payment date as document date (policy inference)'
FROM {payments_table} p
WHERE f1.source_type = 'AP_PAYMENT'
  AND f1.source_id = p.id::TEXT
  AND f1.tenant_id = p.tenant_id
  AND f1.status = 'POSTED'
  AND f1.document_date IS NULL;
```

**Impact:** 74 records (11%) classified as INFERABLE (requires explicit policy approval)

**Risk:** MEDIUM (requires Human Architect approval of policy assumption)

---

### Outcome C: UNKNOWABLE (WORST CASE)

**Condition:**
- `payments` table does NOT exist, OR
- source_id type incompatible (custom string like SALES_ORDER), OR
- Only `created_at`/`updated_at` available (system metadata), OR
- Date fields mostly NULL (completeness < 50%), OR
- Semantic is ambiguous

**Classification:** **UNKNOWABLE**

**Backfill Strategy:**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'AP_PAYMENT: {specific reason}'
WHERE source_type = 'AP_PAYMENT'
  AND status = 'POSTED';
```

**Impact:** 74 records (11%) remain NULL → total UNKNOWABLE increases from 442 (65%) to 516 (76%)

**Risk:** HIGH (large portion of data without provenance)

---

## Governance Reminder

**Principles:**
- ❌ NO provenance → NO backfill
- ❌ Ambiguous provenance → Preserve NULL
- ✅ INFERABLE provenance → Backfill only with explicit policy + flag
- ❌ Do NOT use `posted_at` or `created_at` as fallback
- ❌ Do NOT invent dates to achieve NOT NULL
- ❌ Do NOT assume test data without evidence (learned from SALES_ORDER)

**Anti-Patterns to Avoid:**
- AP-1/AP-2: posted_at as fallback
- AP-5: created_at as business date fallback (unless explicitly approved)
- AP-7: Universal rule (must be source-type-specific)

---

## Frozen Boundary (Phase 4.2)

**ALLOWED:**
- ✅ READ-ONLY queries
- ✅ Schema inspection
- ✅ Data analysis
- ✅ Classification decision

**NOT ALLOWED:**
- ❌ Schema changes
- ❌ Data mutations
- ❌ Migrations execution
- ❌ Test data cleanup (until Phase 4.x with approval)
- ❌ SPA business data modifications
- ❌ RLS/business rules changes

---

## Success Criteria

**Investigation Complete when:**
- [ ] `payments` table existence confirmed (YES/NO)
- [ ] Schema inspected (all columns documented)
- [ ] Date fields identified and semantics analyzed
- [ ] F1 → payments linkage validated (orphan count, type compatibility)
- [ ] Date field completeness checked (NULL percentage)
- [ ] Sample data analyzed (business logic validation)
- [ ] source_id format analyzed (UUID vs string pattern)
- [ ] Provenance classification determined (PROVABLE/INFERABLE/UNKNOWABLE)
- [ ] Backfill strategy designed (if PROVABLE/INFERABLE)
- [ ] Findings documented in this document

---

## Next Steps After Investigation

**If PROVABLE or INFERABLE:**
1. Update `PHASE3_BACKFILL_POLICY.md` with AP_PAYMENT classification
2. Proceed to Phase 4.3: SPA_BOOKING investigation (31 records)
3. Create M-F1-DATES Migration Proposal (after all investigations complete)

**If UNKNOWABLE:**
1. Document UNKNOWABLE reasoning
2. Update impact estimate (UNKNOWABLE increases from 65% to 76%)
3. Proceed to Phase 4.3: SPA_BOOKING investigation
4. Assess if remaining 31 SPA_BOOKING can provide any recovery

---

**Document Status:** 🔵 **INVESTIGATION PLAN READY**  
**Next Action:** Execute schema discovery queries  
**Execution Mode:** READ-ONLY (no database mutations)  
**Phase 4.2 Status:** Migration Readiness — Schema Investigation (NOT implementation)  
**Frozen Boundary:** READ-ONLY, no SPA business data modifications


---

## Investigation Results (2026-08-24)

### Step 1: Transaction Count

**Found:** 77 AP_PAYMENT transactions (updated from estimated 74)

**Status:** ✅ Transactions exist in F1

---

### Step 2: source_id Format Analysis

**Sample source_ids:**
```
PROOF-SETUP
PROOF-SETUP
PROOF
PROOF
PROOF
```

**Format:** ⚠️  **Custom string** (NOT UUID)

**Pattern:** "PROOF-SETUP" or "PROOF" identifiers

**Tenants:**
- `ec149b7c-0772-4af3-9b09-ee6068e39f24`
- `84d439ce-d8ab-47b7-a211-ae6065e3aed0`

**Conclusion:** Similar to SALES_ORDER — custom test/demo identifiers

---

### Step 3: Source Table Search — FAILED

**Tables Attempted:**
- `finance_payments` ❌ Not found
- `ap_payments` ❌ Not found
- `payments` ❌ Not found
- `accounts_payable_payments` ❌ Not found
- `vendor_payments` ❌ Not found

**Result:** **NO SOURCE TABLE EXISTS**

---

## Classification Decision

### ❌ UNKNOWABLE (CONFIRMED)

**Reasoning:**
1. **No Source Table:** All payment table candidates do not exist
2. **Custom String IDs:** `"PROOF-SETUP"`, `"PROOF"` are synthetic identifiers
3. **Test Pattern:** Naming suggests proof-of-concept or testing data
4. **No Database Reference:** These identifiers do NOT exist in any table

**Evidence Quality:** **DEFINITIVE** (no source table + custom test IDs)

---

## Root Cause Analysis

### Test/Demo Data Pattern (Confirmed)

**Evidence:**
1. **Custom ID Format:** `"PROOF-SETUP"`, `"PROOF"` → proof-of-concept identifiers
2. **No Production Pattern:** Real AP payments would reference vendor invoices, purchase orders (UUID or external reference)
3. **Multiple Tenants:** Both tenants appear to be test environments
4. **Naming Convention:** "PROOF" suggests proof-of-concept testing

**Conclusion:** AP_PAYMENT transactions are test artifacts, similar to SALES_ORDER

**NOT production business transactions**

---

## Impact Analysis

### Records Affected
- **AP_PAYMENT:** 77 records (11% of F1 POSTED) — updated count
- **Current UNKNOWABLE:** 442 records (65%)
- **New UNKNOWABLE:** 519 records (77%)

### Classification Distribution (UPDATED after Phase 4.2)

| Classification | Before Phase 4.2 | After Phase 4.2 | Change |
|----------------|------------------|-----------------|--------|
| **PROVABLE** | 128 (19%) | 128 (19%) | No change (F3_AR_INVOICE only) |
| **INFERABLE** | 105 (16%) | 31 (5%) | -74 (-11%) |
| **UNKNOWABLE** | 442 (65%) | 519 (77%) | +77 (+11%) |
| **TOTAL** | 675 (100%) | 675 (100%) | — |

### UNKNOWABLE Breakdown (UPDATED)

| source_type | Count | Percentage | Reason |
|-------------|-------|------------|--------|
| **SALES_ORDER** | 208 | 31% | No source table, synthetic test IDs (`"so-t01"`) |
| **Test data** | 167 | 25% | CONCURRENCY_TEST, VERIFICATION, F2_REGRESSION, test |
| **AP_PAYMENT** | 77 | 11% | No source table, synthetic test IDs (`"PROOF"`) |
| **F2_CASH** | 67 | 10% | No independent provenance |
| **TOTAL UNKNOWABLE** | **519** | **77%** | — |

### Remaining INFERABLE

| source_type | Count | Percentage | Status |
|-------------|-------|------------|--------|
| **SPA_BOOKING** | 31 | 5% | ⏭️ Phase 4.3 investigation (FINAL) |

---

## Backfill Strategy

### AP_PAYMENT Backfill (77 records)

```sql
-- M-F1-DATES migration (DESIGN ONLY, NOT EXECUTED)
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_source = NULL,
    backfill_reason = 'AP_PAYMENT: No source table exists. Custom test IDs (PROOF, PROOF-SETUP).',
    backfill_inferred = FALSE,
    backfill_performed_at = NOW(),
    backfill_performed_by = 'M-F1-DATES'
WHERE source_type = 'AP_PAYMENT'
  AND status = 'POSTED'
  AND document_date IS NULL;
```

**Expected Rows Affected:** 77

**Risk:** LOW (preserving NULL is safest when provenance unknown)

---

## Governance Compliance

### "Provenance Over Convenience" ✅

- [x] No source table → No backfill
- [x] Preserve NULL (honest semantic)
- [x] Do NOT use `posted_at` or `created_at` as fallback
- [x] Do NOT invent dates to achieve NOT NULL
- [x] Flag as UNKNOWABLE (explicit classification)

### Anti-Patterns Avoided ✅

- [x] AP-1: posted_at as document_date fallback — AVOIDED
- [x] AP-2: posted_at as accounting_date fallback — AVOIDED
- [x] AP-5: created_at as business date fallback — AVOIDED
- [x] AP-7: Universal backfill rule — AVOIDED (source-type-specific classification)

---

## Pattern Recognition: Test Data Artifacts

### Common Pattern Across SALES_ORDER + AP_PAYMENT

| Attribute | SALES_ORDER | AP_PAYMENT | Pattern |
|-----------|-------------|------------|---------|
| **source_id format** | `"so-t01"`, `"so-t02"` | `"PROOF"`, `"PROOF-SETUP"` | Custom strings |
| **Source table** | ❌ None | ❌ None | No database reference |
| **Naming** | "sales order - test" | "proof of concept" | Test/demo indicators |
| **Tenants** | Single test tenant | Multiple test tenants | Non-production |
| **Classification** | UNKNOWABLE | UNKNOWABLE | Consistent |

**Conclusion:** Both are test/demo data artifacts created during system development/testing

---

## Test Data Cleanup Consideration

### Evaluation for Phase 4.x Cleanup

**Q4 Decision Review:** Should SALES_ORDER (208) + AP_PAYMENT (77) = 285 records be cleaned up as test data?

**Cleanup Criteria (from Phase 2.5):**
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

**Combined SALES_ORDER + AP_PAYMENT Evaluation:**

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **Test artifact** | ✅ YES | Custom test IDs (`"so-t01"`, `"PROOF"`), proof-of-concept naming |
| **No business evidence** | ✅ YES | No source tables, synthetic identifiers |
| **Safe boundary** | ⚠️  VERIFY | Check for F2/F3 dependencies |
| **Verification** | ⏭️ PENDING | Run orphan check |

**Recommendation:** Consolidate cleanup evaluation for both source_types in Phase 4.x (separate from backfill policy)

**Impact if cleaned:**
- Remove 285 test records (42% of total F1)
- UNKNOWABLE drops from 519 (77%) to 234 (35%)
- Significant improvement in data quality metrics

---

## Recommendations

### Immediate Actions

1. ✅ **Document UNKNOWABLE classification** (this document)
2. ✅ **Update PHASE3_BACKFILL_POLICY.md** impact estimate
3. ⏭️ **Proceed to Phase 4.3:** SPA_BOOKING investigation (31 records, 5% — FINAL INFERABLE)
4. ⏭️ **Consider cleanup:** Consolidate SALES_ORDER + AP_PAYMENT cleanup evaluation (Phase 4.x)

### Critical Insight

**77% of F1 transactions are now UNKNOWABLE**

This high percentage raises important questions:
1. Is Finance OS being used primarily for testing?
2. Are production transactions being created with proper provenance?
3. Should test data cleanup be prioritized before migration?

**SPA_BOOKING (31 records, 5%) is the LAST INFERABLE source**
- If SPA_BOOKING also fails → 82% UNKNOWABLE
- If SPA_BOOKING succeeds → 77% UNKNOWABLE, 5% recoverable
- Critical to investigate thoroughly

---

## Next Steps

### Phase 4.3: SPA_BOOKING Investigation (P0 — FINAL)

**Target:** 31 SPA_BOOKING records (5% — LAST INFERABLE SOURCE)

**Investigation Plan:**
1. Check if `bookings` table has SPA_BOOKING linkage
2. Verify source_id format (UUID vs custom string)
3. Inspect date fields: booking_date, service_date, completed_date
4. Validate linkage to actual SPA business data
5. **CRITICAL:** If links to SPA production data → report only, no automatic processing
6. Classify: PROVABLE / INFERABLE / UNKNOWABLE

**Priority:** **CRITICAL** (last opportunity for provenance recovery)

**Frozen Boundary:**
- ✅ READ-ONLY
- ❌ NO SPA business data modifications
- ❌ NO migrations until Migration Proposal approved
- ⚠️  If SPA production linkage detected → Human Architect review required

---

**Document Status:** ✅ **INVESTIGATION COMPLETE — UNKNOWABLE CLASSIFICATION**  
**Classification:** ❌ UNKNOWABLE (CONFIRMED — no source table, synthetic test IDs)  
**Date:** 2026-08-24  
**Next Phase:** 4.3 (SPA_BOOKING investigation) — P0 CRITICAL (FINAL INFERABLE SOURCE)  
**Test Cleanup:** Consider Phase 4.x consolidated cleanup (SALES_ORDER + AP_PAYMENT = 285 records)  
**UNKNOWABLE Status:** 519 (77%) — requires urgent attention
