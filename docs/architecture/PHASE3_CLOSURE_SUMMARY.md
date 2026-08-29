# Phase 3: Finance OS Date Contract — CLOSURE SUMMARY

**Status:** ✅ **PHASE 3 CLOSED**  
**Date:** 2026-08-24  
**Human Architect:** Approved with revisions  
**Next Phase:** Migration Proposal

---

## Phase 3 Objective

Design and validate 3-date contract for Finance OS to resolve ambiguous `posted_at` semantic and enable TT99/VAS compliance.

---

## Phase 3 Deliverables

### 3.1 posted_at Forensic (✅ COMPLETE)
**Document:** `PHASE3_POSTED_AT_FORENSIC.md`

**Finding:** `posted_at` has NO formal semantic definition — used inconsistently across codebase:
- Test code: Caller-provided business date
- Migration M1: Assumed "business/accounting date"
- Phase 3.2 design: System timestamp

**Verdict:** Ambiguous semantic — cannot be used as provenance for document_date or accounting_date.

---

### 3.2 3-Date Semantic Contract (✅ COMPLETE)
**Document:** `PHASE3_DATE_SEMANTIC_CONTRACT.md`

**Contract:**
- `document_date`: Business event date (TT99 "Ngày chứng từ")
  - Authority: Business owner
  - Immutable: After POSTED
  - Lifecycle: NULL in DRAFT, REQUIRED in POSTED

- `accounting_date`: Recognition period date (TT99 "Ngày hạch toán")
  - Authority: Accountant
  - Mutable: Until period CLOSED
  - Lifecycle: NULL in DRAFT, REQUIRED in POSTED
  - **Semantic:** Determined by accounting event/recognition rule (NOT universal cash basis)

- `posted_at`: System timestamp (when lifecycle transitioned to POSTED)
  - Authority: SYSTEM only
  - Immutable: Always
  - Lifecycle: NULL in DRAFT, system-generated in POSTED

**F2 Lineage Correction:**
- ❌ OLD: `F2.effective_date = F1.posted_at`
- ✅ NEW: `F2.effective_date = F1.accounting_date`

**F5 Temporal Logic Correction:**
- ❌ OLD: `WHERE F1.posted_at <= p_as_of`
- ✅ NEW: `WHERE F1.accounting_date <= p_as_of`

---

### 3.3 TT99/VAS Compliance Matrix (✅ COMPLETE)
**Document:** `PHASE3_TT99_VAS_COMPLIANCE_MATRIX.md`

**Mapping:**
- TT99 "Ngày chứng từ" → `document_date`
- TT99 "Ngày hạch toán" → `accounting_date`
- TT99 "Ngày ghi sổ" → `posted_at` (system timestamp)

**Compliance Status:** Designed to support TT99/2025/TT-BTC (effective 2026-01-01)

**Validation Rules Designed:**
- V1.1-V4.1: Immutability, period lock, double-entry
- Test specs: T1.1-T4.1 (not yet implemented)

---

### 3.4 Nullability Decision (✅ COMPLETE)
**Document:** `PHASE3_NULLABILITY_DECISION.md`

**Lifecycle-Based Nullability:**
```
DRAFT:
  document_date → NULL allowed
  accounting_date → NULL allowed
  posted_at → NULL (required)

POSTED:
  document_date → REQUIRED
  accounting_date → REQUIRED
  posted_at → REQUIRED (system-generated)
```

**Default Policy:**
```sql
DEFAULT accounting_date = COALESCE(accounting_date, document_date)
```
⚠️ **Caveat:** This is a DEFAULT for convenience, NOT semantic equivalence. Accountant can override per transaction-type-specific recognition rules.

**Constraint:**
```sql
CHECK (
    (lifecycle_state = 'POSTED' 
     AND (document_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE')
     AND (accounting_date IS NOT NULL OR backfill_classification = 'UNKNOWABLE'))
    OR lifecycle_state = 'DRAFT'
)
```

---

### 3.5 Backfill Policy (✅ COMPLETE)
**Document:** `PHASE3_BACKFILL_POLICY.md`

**Governance Principle:** **"Provenance Over Convenience"**
- ❌ No provenance → No backfill
- ❌ Ambiguous provenance → Preserve NULL
- ✅ Inferable provenance → Backfill only with explicit rule
- ❌ posted_at → NEVER used as fallback

**Provenance Classification (675 POSTED F1 transactions):**
- **PROVABLE:** 128 (19%) — F3_AR_INVOICE document_date only
- **INFERABLE:** 313 (46%) — Requires schema investigation + recognition rules
- **UNKNOWABLE:** 234 (35%) — F2_CASH (67) + test data (167)

**Critical Finding:** F2_CASH (67 records) downgraded from INFERABLE to UNKNOWABLE after forensic revealed F2.effective_date has NO independent provenance (100% auto-copied from ambiguous F1.posted_at).

**Anti-Patterns Documented:** 10 patterns (4 CRITICAL) explicitly FORBIDDEN:
- AP-1/AP-2: posted_at as fallback
- AP-3: COALESCE cascade
- AP-4: F2.effective_date circular logic
- AP-5 through AP-10: Additional governance violations

---

## Human Architect Decisions (Q1-Q4)

### Q1: Accounting Policy — ✅ APPROVED (REVISED)

**Question:** How should `accounting_date` be determined?

**Decision:** `accounting_date` must represent the **accounting recognition date** according to the applicable accounting event/policy for each transaction type.

**❌ REJECTED:** System-wide Cash Basis assumption

**✅ APPROVED:** Transaction-type-specific recognition rules:
- Cash receipt → recognition date when business event recorded
- Revenue / Accrued revenue → period when revenue recognized
- Prepayment → recognition date of prepayment (NOT revenue recognition date)
- Invoice → recognition date per applicable rule
- Adjustment → accountant-controlled

**Rationale:**
- Finance OS designed as accounting engine/GL with accrual recognition, deferred revenue, reconciliation
- TT99/2025/TT-BTC compliance (effective 2026-01-01)
- Cannot assume universal cash basis for enterprise accounting

---

### Q2: F2_CASH Strategy — ✅ APPROVED (Option C)

**Question:** How to handle F2_CASH 67 records with no provenance?

**Decision:** ✅ **Option C** — Preserve NULL and exclude from temporal calculations

**Rationale:**
- F2.effective_date provenance = UNKNOWN (100% auto-copied from ambiguous posted_at)
- Provenance lost → preserve truth
- Do NOT invent dates that appear reasonable without evidence
- Exclude from temporal calculations rather than contaminate with false provenance

**Implementation:**
```sql
UPDATE finance_transactions
SET 
    document_date = NULL,
    accounting_date = NULL,
    backfill_classification = 'UNKNOWABLE',
    backfill_reason = 'F2_CASH: No independent provenance. Excluded from temporal calculations.'
WHERE source_type = 'F2_CASH';
```

**F5 Temporal Queries:**
```sql
WHERE f1.accounting_date <= p_as_of
  AND f1.backfill_classification != 'UNKNOWABLE';
```

---

### Q3: Schema Investigation Priority — ✅ APPROVED

**Question:** Which source type to investigate first?

**Decision:** ✅ **SALES_ORDER first** (208 records, 31% — highest volume)

**Investigation Order:**
1. SALES_ORDER (208 records)
2. AP_PAYMENT (74 records)
3. SPA_BOOKING (31 records)
4. Remaining INFERABLE sources

---

### Q4: Test Data Strategy — ✅ APPROVED (Controlled Cleanup)

**Question:** How to handle 167 test records?

**Decision:** ✅ **Controlled cleanup** following Phase 2.5 governance

**Principle:**
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

**Cleanup Criteria (ALL must be satisfied):**
1. `source_type` IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test')
2. No business evidence (tenant_id = test tenant OR created_at during test period)
3. Safe boundary (no dependencies on production data)
4. Verification passed (no orphans created by deletion)

---

## Phase 3 Governance Locked

### Core Principles (NON-NEGOTIABLE)

1. **"Provenance Over Convenience"**
   - Semantic correctness > Database completeness

2. **posted_at Semantic**
   - System timestamp ONLY
   - NEVER used as document_date or accounting_date fallback

3. **Lifecycle-Based Nullability**
   - DRAFT: Dates nullable
   - POSTED: Dates required (unless UNKNOWABLE)

4. **Anti-Patterns Enforcement**
   - AP-1 through AP-10 blocked
   - COALESCE fallback chains forbidden
   - Circular provenance logic forbidden

5. **Transaction-Type-Specific Recognition**
   - accounting_date determined by accounting event/policy
   - NO universal cash basis assumption

---

## Phase 3 Impact

### Records
- **Total:** 675 POSTED F1 transactions
- **PROVABLE:** 128 (19%) — ready for migration design
- **INFERABLE:** 313 (46%) — requires schema investigation
- **UNKNOWABLE:** 234 (35%) — preserve NULL or controlled cleanup

### Schema Changes
- **2 new date columns:** `document_date`, `accounting_date`
- **4 new metadata columns:** Backfill audit trail
- **3 new indexes:** Temporal queries
- **Storage:** ~275 KB additional (negligible)

### Dependencies
- **3 RPCs:** F1, F2, F5 require modifications
- **3 Workers:** Finance Outbox, F2 Projection, F5 Balance require modifications
- **~140 tests:** Require updates

### Timeline
- **Migration execution:** 40-60 minutes
- **Full project:** 6 weeks (phased execution with schema investigation)

### Cost
- **Engineering effort:** ~124 hours (~3 weeks)
- **Engineering cost:** ~$12,400
- **Downtime:** 0 (zero-downtime capable)

---

## Phase 3 Status: CLOSED

**All Phase 3 objectives complete:**
- [x] 3.1 posted_at forensic
- [x] 3.2 3-date semantic contract
- [x] 3.3 TT99/VAS compliance matrix
- [x] 3.4 Nullability decision
- [x] 3.5 Backfill policy

**All Human Architect decisions approved:**
- [x] Q1: Event-based accounting recognition
- [x] Q2: F2_CASH Option C (preserve NULL, exclude)
- [x] Q3: SALES_ORDER investigation first
- [x] Q4: Controlled test cleanup

**Phase 3 governance locked:**
- [x] "Provenance Over Convenience" principle
- [x] Anti-patterns AP-1 through AP-10 enforcement
- [x] Lifecycle-based nullability
- [x] Transaction-type-specific recognition rules

---

## Next Phase: Migration Proposal

**Phase 3 = DESIGN COMPLETE, NOT IMPLEMENTATION APPROVED**

**Migration Proposal must include:**
1. **M-F1-DATES DDL** (add document_date, accounting_date columns) — **NOT executed**
2. **M-F2-DATES DDL** (update F2 to use accounting_date) — **NOT executed**
3. **Dry-run results** with expected row counts
4. **Before/after evidence**
5. **Verification gates**
6. **Rollback plan**

**Implementation BLOCKED until Migration Proposal approved:**
- ❌ M-F1-DATES execution
- ❌ M-F2-DATES execution
- ❌ M4b (F2 opening balance contract)
- ❌ F5.6 (F5 temporal queries use accounting_date)
- ❌ RPC/Worker modifications

**Critical Note:**
> **PROVABLE ≠ automatically authorized to mutate production data**
>
> F3_AR_INVOICE 128 records are **READY FOR MIGRATION DESIGN**, NOT ready for execution.
>
> Migration Gate:
> ```
> Phase 3.5 Backfill Policy
>    ✅ COMPLETE
>    ↓
> Human Architect Decisions (Q1-Q4)
>    ✅ APPROVED
>    ↓
> Migration Proposal
>    ❌ NOT CREATED YET
>    ↓
> Dry-run → Evidence → Verification → Approval → Execute
> ```

---

## Finance OS Phase Timeline

```
FINANCE OS
│
├── Phase 1 Foundation
│   └── ✅ COMPLETE
│
├── Phase 2 Orphan Forensics
│   └── ✅ COMPLETE
│
├── Phase 2.5 Root Cause Forensics
│   └── ✅ COMPLETE (18 test artifacts cleaned)
│
├── Phase 3 F1 Date Contract
│   ├── 3.1 posted_at forensic → ✅
│   ├── 3.2 3-date semantic contract → ✅
│   ├── 3.3 TT99/VAS mapping → ✅
│   ├── 3.4 Nullability → ✅
│   └── 3.5 Backfill policy → ✅
│   └── Status: ✅ CLOSED
│
├── Human Architect Decisions
│   ├── Q1 → ✅ APPROVED (event-based recognition)
│   ├── Q2 → ✅ APPROVED (Option C)
│   ├── Q3 → ✅ APPROVED (SALES_ORDER first)
│   └── Q4 → ✅ APPROVED (controlled cleanup)
│
└── NEXT
    └── Migration Proposal
        ├── M-F1-DATES design
        ├── M-F2-DATES design
        ├── Dry-run
        ├── Evidence
        └── ❌ NOT EXECUTED YET
```

---

## Success Criteria (Phase 3)

**Design Success:**
- [x] 3-date contract defined with clear semantics
- [x] TT99/VAS compliance mapping complete
- [x] Provenance classification complete (675 records)
- [x] Source-type-specific backfill rules designed
- [x] Anti-patterns documented and enforcement confirmed
- [x] Human Architect decisions approved (Q1-Q4)

**Governance Success:**
- [x] "Provenance Over Convenience" principle maintained
- [x] No semantic contamination (posted_at not used as fallback)
- [x] Transaction-type-specific recognition rules established
- [x] Lifecycle-based nullability defined
- [x] Audit trail design complete (backfill metadata)

**Phase 3:** ✅ **ALL SUCCESS CRITERIA MET**

---

**Document Status:** ✅ **PHASE 3 CLOSED**  
**Date:** 2026-08-24  
**Next Phase:** Migration Proposal (design only, not execution)  
**Implementation:** ❌ BLOCKED until Migration Proposal approved separately
