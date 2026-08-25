# PHASE 3 — F1 DATE CONTRACT DESIGN: INVESTIGATION PLAN

**Date:** 2026-08-24  
**Status:** 🔵 **ANALYSIS ONLY** (no implementation approved)  
**Mode:** READ-ONLY FORENSIC + DESIGN

---

## MISSION

Design 3-date semantic contract for F1 transactions:
1. `document_date` — business document date
2. `accounting_date` — accounting recognition date  
3. `posted_at` — system posting timestamp (existing)

**Prerequisites:**
- ✅ Phase 2.5 complete (0 orphans)
- ✅ M1-M4a contracts intact
- ✅ Kernel integrity verified

---

## GOVERNANCE CONSTRAINTS

### ❌ BLOCKED (No Implementation)

- ❌ NO M-F1-DATES execution
- ❌ NO M-F2-DATES execution
- ❌ NO M4b execution
- ❌ NO Worker modifications
- ❌ NO RPC modifications
- ❌ NO F5.6 implementation
- ❌ NO database schema changes

### ✅ ALLOWED (Analysis & Design)

- ✅ Read existing F1 producers (Workers, RPCs, migrations)
- ✅ Read existing `posted_at` usage
- ✅ Analyze semantic patterns
- ✅ Design date contracts
- ✅ Draft backfill policies
- ✅ Create nullability decision evidence
- ✅ Map TT99/VAS compliance requirements
- ✅ Produce design artifacts (Markdown only)

---

## INVESTIGATION PHASES

### Phase 3.1 — Existing `posted_at` Forensic

**Objective:** Understand current `posted_at` semantic

**Questions to Answer:**
1. Where is `posted_at` created? (Workers? RPCs? Triggers?)
2. Who is the authority? (Application? Database? Business event?)
3. What does it represent?
   - Business event date?
   - Document date?
   - Accounting recognition date?
   - Ledger posting timestamp?
4. Is it immutable?
5. Can it be backfilled?
6. What semantic do current F1 producers use?

**Evidence to Gather:**
- `finance_transactions` table definition
- `posted_at` column constraints
- All F1 INSERT statements (Workers, RPCs, migrations, tests)
- All `posted_at` assignment patterns
- Relationship to `effective_date` in business events

**Deliverable:** `PHASE3_POSTED_AT_FORENSIC.md`

---

### Phase 3.2 — Design 3-Date Semantics

**Objective:** Define clear semantic boundaries for 3 dates

**Design Contract:**

```
document_date
     ↓
When did the business event occur?
When was the business document issued?
(Invoice date, payment date, contract date)

accounting_date
     ↓
When should this be recognized in accounting books?
Which accounting period does this belong to?
(May differ from document_date due to accrual/matching)

posted_at
     ↓
When did the system post this transaction to the ledger?
(System timestamp, audit trail, immutable)
```

**Critical Principle:**  
**DO NOT assume these 3 dates are the same.**

**Questions to Answer:**
1. Can `document_date` be in the past/future relative to `posted_at`?
2. Can `accounting_date` differ from `document_date`? (Accrual accounting)
3. Which date determines accounting period closure?
4. Which date is used for financial reporting?
5. Which date is used for TT99/VAS compliance?
6. Which date is immutable? Which can be adjusted?

**Deliverable:** `PHASE3_DATE_SEMANTIC_CONTRACT.md`

---

### Phase 3.3 — TT99 / VAS Semantic Mapping

**Objective:** Map date semantics to Vietnamese Accounting Standards

**Questions to Answer:**
1. Which date determines accounting period for VAS compliance?
2. TT99 requires "document date" — which of our 3 dates satisfies this?
3. TT99 requires "accounting date" — which of our 3 dates satisfies this?
4. What is the legal/audit requirement for each date?
5. Can any date be NULL in a VAS-compliant transaction?
6. What is the relationship to "invoice date" vs "revenue recognition date"?

**TT99 Requirements to Verify:**
- Document date (Ngày chứng từ)
- Accounting date (Ngày hạch toán)
- Posting date (system requirement)

**Deliverable:** `PHASE3_TT99_DATE_MAPPING.md`

---

### Phase 3.4 — Nullability Decision

**Objective:** Determine NULL vs NOT NULL for `document_date` and `accounting_date`

**Decision Framework:**

```
F1 created by which event?
       ↓
Does every event legally/business-wise have a document date?
       ↓
Does every event have an accounting date?
       ↓
Can either date be unknown at creation time?
       ↓
Decision: NOT NULL vs NULL + lifecycle constraint
```

**Questions to Answer:**
1. Can F1 be created as DRAFT without `document_date`?
2. Can F1 be created as DRAFT without `accounting_date`?
3. Must `document_date` be known before POSTED status?
4. Must `accounting_date` be known before POSTED status?
5. Can accountant adjust `accounting_date` after initial creation?
6. What are the lifecycle state transitions?

**Options to Evaluate:**

**Option A: Both NOT NULL**
```sql
document_date TIMESTAMPTZ NOT NULL
accounting_date TIMESTAMPTZ NOT NULL
```
- Pros: Strong data integrity, simple queries
- Cons: Requires all dates known at creation, no flexibility

**Option B: NULL + Lifecycle Constraint**
```sql
document_date TIMESTAMPTZ NULL
accounting_date TIMESTAMPTZ NULL

-- Constraint: Must be NOT NULL when status = 'POSTED'
CHECK (
  (status != 'POSTED') OR 
  (document_date IS NOT NULL AND accounting_date IS NOT NULL)
)
```
- Pros: Flexible DRAFT→POSTED lifecycle
- Cons: More complex, NULL handling in queries

**Option C: Hybrid**
```sql
document_date TIMESTAMPTZ NOT NULL  -- Always known
accounting_date TIMESTAMPTZ NULL    -- Set by accountant
```

**Deliverable:** `PHASE3_NULLABILITY_DECISION.md`

---

### Phase 3.5 — Backfill Policy Design

**Objective:** Design evidence-based backfill strategy for existing F1 transactions

**Critical Principle:**

❌ **REJECTED:**
```sql
-- This is NOT acceptable:
UPDATE finance_transactions
SET document_date = posted_at,
    accounting_date = posted_at;
```

✅ **REQUIRED:**
```
Historical F1 classification:

 ├── Provable date
 │   └── Source event has deterministic date
 │       → Deterministic backfill
 │       → Example: F1 created from invoice (use invoice.issued_at)
 │
 ├── Inferable date  
 │   └── Source event date can be inferred via policy
 │       → Policy-based backfill
 │       → Example: F1 from booking payment (use booking.created_at)
 │
 └── Unknowable
     └── Source event lost / no deterministic mapping
         → Remain NULL (if schema allows)
         → OR flag as EXCEPTION / UNVERIFIED
         → OR Human Architect decision required
```

**Questions to Answer:**
1. How many existing F1 transactions in database?
2. What are the source types? (Invoice, Payment, Adjustment, etc.)
3. For each source type, can we deterministically find `document_date`?
4. For each source type, can we deterministically find `accounting_date`?
5. What percentage can be backfilled with high confidence?
6. What percentage requires manual review?
7. Should unknowable dates block migration? Or remain NULL? Or flagged?

**Evidence to Gather:**
```sql
-- F1 distribution by source
SELECT 
  source_type,
  COUNT(*) as f1_count,
  COUNT(DISTINCT source_id) as unique_sources
FROM finance_transactions
WHERE status = 'POSTED'
GROUP BY source_type;

-- Source provenance check
SELECT 
  ft.source_type,
  COUNT(*) as total,
  COUNT(source_table.id) as provable,
  COUNT(*) - COUNT(source_table.id) as unprovable
FROM finance_transactions ft
LEFT JOIN [source_table] ON ft.source_id = [source_table].id
GROUP BY ft.source_type;
```

**Backfill Strategy Template:**

```markdown
## Source Type: INVOICE

**F1 Count:** 1,250  
**Provenance:** 100% (1,250/1,250 invoices found)

**Backfill Rule:**
- `document_date = invoices.issued_at`
- `accounting_date = invoices.issued_at` (policy: revenue recognized on invoice date)
- Confidence: HIGH

---

## Source Type: PAYMENT

**F1 Count:** 3,400  
**Provenance:** 98% (3,332/3,400 payments found)

**Backfill Rule:**
- `document_date = payments.payment_date`
- `accounting_date = payments.payment_date` (policy: cash basis)
- Confidence: HIGH for 98%, EXCEPTION for 68 orphans

**Exception Handling:**
- 68 orphan payments → investigate (similar to Phase 2)
- If test data → delete
- If production → Human Architect decision

---

## Source Type: ADJUSTMENT

**F1 Count:** 150  
**Provenance:** 0% (manual adjustments, no source table)

**Backfill Rule:**
- `document_date = posted_at` (best available)
- `accounting_date = posted_at` (manual entry date = accounting date)
- Confidence: MEDIUM (no document, system timestamp is authority)
- Flag: Add `is_manual_adjustment = TRUE` for audit
```

**Deliverable:** `PHASE3_BACKFILL_POLICY.md`

---

## DELIVERABLES (Markdown Only)

### Required Documents

1. **`PHASE3_POSTED_AT_FORENSIC.md`**
   - Current `posted_at` semantic analysis
   - F1 producer inventory
   - Authority mapping

2. **`PHASE3_DATE_SEMANTIC_CONTRACT.md`**
   - 3-date definition
   - Relationship rules
   - Use case mapping

3. **`PHASE3_TT99_DATE_MAPPING.md`**
   - VAS compliance mapping
   - Legal/audit requirements
   - TT99 field correspondence

4. **`PHASE3_NULLABILITY_DECISION.md`**
   - NOT NULL vs NULL analysis
   - Lifecycle constraint design
   - Option comparison with evidence

5. **`PHASE3_BACKFILL_POLICY.md`**
   - Historical F1 classification
   - Source-type backfill rules
   - Confidence levels
   - Exception handling

6. **`PHASE3_MIGRATION_PROPOSAL.md`**
   - Proposed M-F1-DATES DDL (NOT executed)
   - Proposed M-F2-DATES DDL (NOT executed)
   - Proposed backfill DML (NOT executed)
   - Rollback plan
   - Testing strategy

7. **`PHASE3_HUMAN_ARCHITECT_REVIEW_PACKAGE.md`**
   - Executive summary
   - Design decisions with evidence
   - Risk assessment
   - Approval checklist

### Optional Supporting Documents

- `PHASE3_F1_PRODUCER_INVENTORY.md` — Complete list of F1 creators
- `PHASE3_DATE_USAGE_PATTERNS.md` — Current date usage in codebase
- `PHASE3_ACCOUNTING_PERIOD_RULES.md` — Period closure semantic

---

## SUCCESS CRITERIA

Phase 3 is complete when:

1. ✅ All 7 required documents created
2. ✅ All questions answered with evidence
3. ✅ Design contract is internally consistent
4. ✅ TT99/VAS compliance verified
5. ✅ Nullability decision justified
6. ✅ Backfill policy covers 100% of existing F1
7. ✅ Migration proposal is complete (but NOT executed)
8. ✅ Human Architect review package ready

---

## GATE TO PHASE 4

**Phase 3 → Human Architect Review → Phase 4**

**Human Architect Must Approve:**
- Date semantic contract
- Nullability decision
- Backfill policy
- Migration approach
- Exception handling

**Only After Approval:**
- Execute M-F1-DATES
- Execute M-F2-DATES
- Execute backfill
- Modify Workers/RPCs
- Implement F5.6

---

## FORENSIC PRINCIPLES (Phase 2.5 Lessons Applied)

1. **"Semantic Evidence Before Database Assertion"**  
   Don't guess date semantics from column names. Trace to source.

2. **"Provenance Over Convenience"**  
   Don't backfill `document_date = posted_at` just because it's easy.

3. **"Classification Before Remediation"**  
   Classify historical F1 (provable/inferable/unknowable) before deciding backfill.

4. **"Exception Transparency"**  
   If data can't be backfilled with confidence, flag it. Don't hide it.

---

## NEXT STEP

**Start Phase 3.1:** Existing `posted_at` Forensic

**Command:** "tiếp" to begin investigation.

---

**Plan Created:** 2026-08-24  
**Status:** 🟢 APPROVED (Analysis Only)  
**Human Architect:** Approved Phase 3 entry  
**Kiro Session:** Bella AI Coding — Finance OS TT99 Implementation
