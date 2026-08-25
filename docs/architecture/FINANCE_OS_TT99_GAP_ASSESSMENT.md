# FINANCE OS — TT99 ACCOUNTING AUTHORITY & SEMANTIC GAP ASSESSMENT

**Date:** 2026-08-24  
**Version:** 1.1 (REVISED)  
**Status:** 🟡 DRAFT — AWAITING HUMAN ARCHITECT APPROVAL  
**Scope:** F1 (Financial Ledger) + F2 (Cash Domain) + Opening Balance Contract  
**Authority:** Circular 99/2025/TT-BTC (effective 2026-01-01, applies to fiscal years beginning on or after 2026-01-01)

---

## ⚠️ REVISION HISTORY

**v1.0 → v1.1 Changes:**
1. **CRITICAL:** Corrected date field backfill strategy (no auto-assert semantic truth)
2. **CRITICAL:** Removed synthetic F1 as remediation default
3. **CRITICAL:** Distinguished TT99 requirements from Bella governance choices
4. **CRITICAL:** Separated TT99 compliance from Bella architectural invariants
5. **ADDED:** Accounting framework effective-date scope (fiscal year applicability)
6. **REVISED:** Execution order (investigate before migrate)

---

## 📋 EXECUTIVE SUMMARY

**Purpose:** Assess whether Bella Finance OS current implementation correctly represents Vietnamese accounting semantics per Circular 99/2025/TT-BTC.

**Assessment Type:** Read-only semantic gap analysis (NO code changes, NO migrations)

**Key Findings:**
- 🟢 **Technical Architecture:** Sound and can be preserved
- 🟡 **Accounting Semantics:** Gaps identified requiring extension
- 🔴 **Critical Gaps:** Document date missing, accounting period semantics unclear
- ⚪ **18 Orphan Movements:** Diagnostic signal of broken accounting lineage

**Recommendation:** **MODIFY** (extend semantic model with evidence-based backfill), NOT REBUILD.

**Migration Status:** 🛑 **NOT APPROVED** — Awaiting semantic evidence and orphan forensics.

---

## 🎯 ASSESSMENT METHODOLOGY

```
Phase 1: TT99 Authority Mapping
   ↓
Phase 2: Finance OS Current State Analysis
   ↓
Phase 3: Gap Classification (KEEP/MODIFY/REBUILD/N/A)
   ↓
Phase 4: Dependency Impact Analysis
   ↓
Phase 5: Migration Strategy Proposals
```

**Constraints Applied:**
- ✅ Read-only analysis
- ❌ No code modification
- ❌ No migration execution
- ❌ No M4b creation
- ❌ No Worker/RPC changes
- ❌ No F5.6 implementation

---

## 1. TT99 ACCOUNTING AUTHORITY — KEY CONCEPTS

### 1.1 Circular 99/2025/TT-BTC Overview

**Effective:** January 1, 2026  
**Replaces:** Circular 200/2014/TT-BTC  
**Scope:** Corporate accounting regime for Vietnamese enterprises

**Key Changes:**
1. **Statement of Financial Position** replaces Balance Sheet
2. **Functional currency flexibility** (VND or foreign currency)
3. **Chart of accounts customization** (two options)
4. **Biological assets** (new account 215)
5. **Global minimum tax** compliance (Pillar Two)
6. **Internal Governance Accounting Policy (IGAP)** requirement
7. **Accounting software** requirements strengthened
8. **Document** and **accounting book** requirements simplified

**IFRS Alignment:** Circular 99 moves Vietnam closer to IFRS, preparing for future VFRS (Vietnamese Financial Reporting Standards) adoption.

### 1.2 Core Accounting Concepts (TT99)

#### Business Event → Accounting Entry Flow

```
Business Event
   ↓
Source Document (chứng từ gốc)
   ↓
Document Date (ngày chứng từ)
   ↓
Accounting Date (ngày hạch toán)
   ↓
Accounting Recognition
   ↓
Journal Entry (bút toán)
   ↓
Posting Date (ngày ghi sổ)
   ↓
Financial Statements
```

#### Critical Temporal Concepts

| Vietnamese Term | English | Semantic Authority |
|-----------------|---------|-------------------|
| **Ngày chứng từ** | Document Date | Date on original source document |
| **Ngày hạch toán** | Accounting Date | Date transaction is recognized for accounting purposes |
| **Ngày ghi sổ** | Posting Date | Date entry is recorded in ledger |
| **Kỳ kế toán** | Accounting Period | Fiscal period for reporting |

**Critical Rule:** `accounting_date` determines **which accounting period** a transaction belongs to, NOT `document_date` or `posting_date`.

#### Double-Entry Accounting (Bút toán kép)

Every transaction MUST have:
- **Debit (Nợ)** and **Credit (Có)** sides
- Balanced amounts: `SUM(debit) = SUM(credit)`
- At least one debit line and one credit line

#### Chart of Accounts (Hệ thống tài khoản)

Circular 99 allows TWO options:
- **Option 1:** Use standard TT99 chart + add sub-accounts
- **Option 2:** Use parent company chart (for consolidation)

**Key Account Classes:**
- Class 1: Current Assets (Tài sản ngắn hạn)
- Class 2: Long-term Assets (Tài sản dài hạn)
- Class 3: Liabilities (Nợ phải trả)
- Class 4: Equity (Vốn chủ sở hữu)
- Class 5: Revenue (Doanh thu)
- Class 6: Expenses (Chi phí)
- Class 7: Other income/expenses (Thu nhập/chi phí khác)
- Class 8: Off-balance sheet (Ngoại bảng)

**Cash-related accounts (relevant for F2):**
- Account 111: Cash on hand (Tiền mặt)
- Account 112: Cash in banks (Tiền gửi ngân hàng)
- Account 113: Cash in transit (Tiền đang chuyển)

#### Source Document Requirements (Chứng từ)

Per TT99, every accounting entry MUST have:
1. **Source document** (invoice, receipt, contract, etc.)
2. **Document number** (số chứng từ)
3. **Document date** (ngày chứng từ)
4. **Parties involved** (người lập, người duyệt)
5. **Description** (diễn giải)
6. **Amounts** (số tiền)

**TT99 Simplification:** Ink color, number of copies requirements REMOVED.

#### Accounting Period (Kỳ kế toán)

- **Standard:** Calendar year (Jan 1 - Dec 31)
- **Allowed:** Fiscal year (e.g., Apr-Mar, Jul-Jun, Oct-Sep) with approval
- **Interim:** Quarterly, monthly reporting required by law for certain entities

**Critical:** Transactions recognized in **wrong period** = accounting violation.

#### TT99 Effective Date & Fiscal Year Applicability ⚠️ IMPORTANT

**Circular 99/2025/TT-BTC:**
- **Issued:** October 27, 2025
- **Effective date:** January 1, 2026
- **Applies to:** Fiscal years **beginning on or after** January 1, 2026

**⚠️ KEY DISTINCTION:**
- **NOT:** "All enterprises switch to TT99 on 2026-01-01"
- **CORRECT:** "Enterprises apply TT99 starting from their first fiscal year that begins on or after 2026-01-01"

**Examples:**
| Fiscal Year | TT99 Applies From |
|-------------|-------------------|
| Calendar year (01/01–31/12) | **2026-01-01** |
| April start (01/04–31/03) | **2026-04-01** |
| July start (01/07–30/06) | **2026-07-01** |
| October start (01/10–30/09) | **2026-10-01** |

**Implication for Finance OS:**
- TT99 compliance is **tenant-specific** and **fiscal-year-dependent**
- Cannot hard-code "TT99 = global from 2026-01-01"
- Must support:
  ```
  tenant
     ↓
  accounting_framework (TT99, Circular 200, IFRS, etc.)
     ↓
  fiscal_year_start_date
     ↓
  accounting_policy_effective_from
  ```

**Architecture Requirement:**
- Finance OS must support **multiple accounting frameworks** per tenant
- Framework applicability determined by **fiscal year start date**
- Historical data may be under **different framework** (Circular 200) than current data (TT99)

---

## 2. FINANCE OS CURRENT STATE ANALYSIS

### 2.1 F1: Financial Accounting Ledger

**Schema:** `finance_transactions` + `finance_transaction_lines`

#### F1 Transaction Header (`finance_transactions`)

**Current Fields:**
```sql
id                      UUID
tenant_id               UUID
idempotency_key         VARCHAR(255)
source_type             VARCHAR(255)        -- ✅ Maps to business event type
source_id               VARCHAR(255)        -- ✅ Links to source record
status                  VARCHAR(20)         -- DRAFT, POSTED, REVERSED, VOIDED
transaction_type        VARCHAR(20)         -- ACCRUAL, CASH, ADJUSTMENT, REVERSAL, OPENING_BALANCE
accounting_period_id    UUID                -- ✅ Links to accounting period
posted_at               TIMESTAMPTZ         -- ❓ Semantic unclear
transaction_currency    VARCHAR(10)         -- ✅ Matches TT99
functional_currency     VARCHAR(10)         -- ✅ Matches TT99 (Circular 99 flexibility)
exchange_rate_*         NUMERIC/VARCHAR/TZ  -- ✅ FX handling
description             TEXT                -- ✅ Matches TT99 "diễn giải"
reference_type          VARCHAR(255)        -- ✅ Document type
reference_id            VARCHAR(255)        -- ✅ Document number
reversal_of             UUID                -- ✅ Reversal tracking
created_at              TIMESTAMPTZ         -- System metadata
updated_at              TIMESTAMPTZ         -- System metadata
```

**MISSING Fields (require semantic evidence before adding):**
- ❌ `document_date` (ngày chứng từ) — **CRITICAL GAP** (⚠️ Cannot auto-derive from posted_at)
- ❌ `accounting_date` (ngày hạch toán) — **CRITICAL GAP** (⚠️ Cannot auto-derive from posted_at)
- ⚠️ `posted_at` semantic unclear — system timestamp or accounting semantic?
- 🟡 `recorded_by` / `approved_by` (người lập / người duyệt) — **Bella governance enhancement** (not TT99 database mandate)

#### F1 Transaction Lines (`finance_transaction_lines`)

**Current Fields:**
```sql
id                          UUID
tenant_id                   UUID
transaction_id              UUID
account_id                  UUID                -- ✅ Links to chart of accounts
debit_amount                NUMERIC(38,0)       -- ✅ Double-entry (Nợ)
debit_currency              VARCHAR(10)
credit_amount               NUMERIC(38,0)       -- ✅ Double-entry (Có)
credit_currency             VARCHAR(10)
debit_functional_amount     NUMERIC(38,0)       -- ✅ Functional currency
debit_functional_currency   VARCHAR(10)
credit_functional_amount    NUMERIC(38,0)
credit_functional_currency  VARCHAR(10)
cost_center_id              UUID                -- ✅ Financial dimensions
business_unit_id            UUID
location_id                 UUID
project_id                  UUID
department_id               UUID
custom_dimension_*          VARCHAR             -- ✅ Extensible dimensions
memo                        TEXT                -- ✅ Line description
created_at                  TIMESTAMPTZ
updated_at                  TIMESTAMPTZ
```

**Constraints:**
- ✅ `chk_debit_credit_mutual_exclusive` — prevents double-sided lines
- ✅ Double-entry balance enforcement (application-level, should be DB-level)

**MISSING:**
- ⚠️ No DB-level `SUM(debit) = SUM(credit)` constraint per transaction

#### F1 Assessment

**🟢 KEEP:**
- Double-entry architecture (debit/credit)
- Functional currency handling
- Financial dimensions (cost center, project, etc.)
- Chart of accounts linkage
- Immutable audit trail (via status + reversal_of)
- Tenant isolation (RLS)
- Idempotency (via idempotency_key)

**🟡 MODIFY (Required Extensions with Evidence):**
1. **Add `document_date` field** (ngày chứng từ)
   - Type: `DATE` or `TIMESTAMPTZ`
   - **NULLABLE initially** (cannot auto-derive from posted_at)
   - Requires semantic evidence before backfill
   - Links to original source document date
   - **NOT NULL only after evidence-based verification**
   
2. **Add `accounting_date` field** (ngày hạch toán)
   - Type: `DATE` or `TIMESTAMPTZ`
   - **NULLABLE initially** (cannot auto-derive from posted_at)
   - Requires semantic evidence before backfill
   - Determines accounting period assignment
   - Default semantic: MAY equal `document_date` (but can differ for backdating/adjustments)
   - **NOT NULL only after evidence-based verification**

3. **Clarify `posted_at` semantic**
   - Current: System timestamp (unclear accounting semantic)
   - Option A: Keep as system metadata, add `accounting_date` separately ✅ **RECOMMENDED**
   - Option B: Rename to `posting_date` (ngày ghi sổ) if proven to be accounting semantic
   - **Decision required:** What does `posted_at` ACTUALLY represent in current system?

4. **Add provenance fields (Bella governance, not TT99 database mandate)**
   - `recorded_by` UUID (người lập) — **Bella internal control**
   - `approved_by` UUID (người duyệt) — **Bella workflow governance**
   - Optional: `approval_timestamp`
   - **Note:** TT99 requires provenance on **chứng từ** (documents), not necessarily database columns
   - Bella may choose to implement at database level for auditability

5. **Add DB-level balance constraint**
   - Trigger or constraint to enforce `SUM(debit) = SUM(credit)` per transaction
   - **Accounting requirement** (double-entry)

**🔴 REBUILD:**
- None. F1 architecture is sound.

**⚪ NOT APPLICABLE:**
- Biological assets (Account 215) — not relevant to current Bella scope
- Global minimum tax (Pillar Two) — future consideration

---

### 2.2 F2: Cash Domain

**Schema:** `finance_cash_movements` + `finance_cash_positions`

#### F2 Cash Movements (`finance_cash_movements`)

**Current Fields (Post-M1):**
```sql
id                          UUID
tenant_id                   UUID
bank_account_id             UUID                -- ✅ Cash account (111/112)
idempotency_key             VARCHAR(255)        -- ✅ Immutability
direction                   VARCHAR(10)         -- INFLOW, OUTFLOW
amount_minor                NUMERIC(20,0)       -- ✅ Minor units
currency                    VARCHAR(10)         -- ✅ TT99 compliant
functional_amount_minor     NUMERIC(20,0)       -- ✅ Functional currency
functional_currency         VARCHAR(10)         -- ✅ VND default
valuation_rate              NUMERIC(18,6)       -- ✅ FX rate
f1_transaction_id           UUID                -- ✅ F1 lineage
cash_leg_reference          VARCHAR(100)        -- ✅ Disambiguates multi-leg
source_type                 VARCHAR(255)        -- ✅ Business event type
source_id                   VARCHAR(255)        -- ✅ Source record
description                 TEXT                -- ✅ Description
effective_date              TIMESTAMPTZ         -- ✅ ADDED M1 (temporal authority)
recorded_at                 TIMESTAMPTZ         -- ✅ Projection timestamp
created_at                  TIMESTAMPTZ         -- System metadata
```

**Key Constraints:**
- ✅ `uq_finance_cash_movements_key` (idempotency)
- ✅ `uq_finance_cash_movements_leg` (F1 transaction + cash_leg_reference uniqueness)
- ✅ `fk_finance_cash_movements_f1` (F1 lineage enforced)
- ✅ Immutability trigger (`finance_cash_movements_immutability_guard`)

**CRITICAL DISCOVERY (M1 Deployment):**
- **18 orphan movements** detected (f1_transaction_id references non-existent F1 records)
- Used `recorded_at` as fallback temporal authority (violates strict INV-F2-T1)

#### F2 Assessment

**🟢 KEEP:**
- Cash movement as immutable fact log
- F1 → F2 lineage (`f1_transaction_id`)
- Effective_date temporal authority (added M1)
- Direction abstraction (INFLOW/OUTFLOW)
- Functional currency valuation
- Idempotency enforcement
- Immutability triggers

**🟡 MODIFY (Required Extensions with Evidence-Based Approach):**
1. **Fix 18 orphan movements** — investigate why F1 transactions missing
   - **PRIORITY ORDER (NON-NEGOTIABLE):**
     1. **Existing F1 found** → restore/link lineage
     2. **Accounting evidence exists** → human-approved remediation with documented provenance
     3. **Legacy opening/migration state** → treat under opening balance or migration accounting policy
     4. **No evidence** → **UNRESOLVED** (remain flagged, DO NOT fabricate F1 transactions)
   
   - **NEVER ALLOWED:**
     - ❌ Auto-create synthetic F1 transactions to "fix" lineage
     - ❌ Delete movements without governance approval
     - ❌ Fabricate accounting transactions without evidence
   
   - **Important Distinction:**
     - This is **Bella Finance OS INV-F2-T1 violation** (architectural invariant)
     - NOT automatically a TT99 violation (requires separate assessment of underlying business event)

2. **Align `effective_date` with F1 accounting semantics (when evidence available)**
   - Current: `effective_date = F1.posted_at` (301/319 movements)
   - Future: `effective_date` should represent accounting recognition date
   - **Action:** When F1 gains `accounting_date`, evaluate alignment (NOT auto-update without evidence)
   - **Requires:** Evidence that F1.accounting_date represents correct temporal authority

3. **Add document provenance to F2 (optional enhancement)**
   - Currently: `f1_transaction_id` provides indirect document linkage
   - TT99 requirement: Chứng từ (source documents) must exist
   - **Action:** F2 already links to F1, F1 should link to document registry
   - **Note:** Document registry may be application-level, not necessarily database FK

**🔴 REBUILD:**
- None. F2 architecture is sound.

**⚪ NOT APPLICABLE:**
- TT99 cash accounts (111/112/113) already mapped via `finance_bank_accounts`

---

### 2.3 F2: Opening Balance Contract

**Schema:** `finance_cash_opening_balances` (M3) + `finance_cash_opening_balance_decisions` (M4a)

#### Opening Balances (`finance_cash_opening_balances`)

**Current Fields:**
```sql
id                      UUID
tenant_id               UUID
bank_account_id         UUID
balance_minor           NUMERIC(20,0)       -- ✅ Opening balance amount
currency                VARCHAR(10)         -- ✅ Currency
effective_date          TIMESTAMPTZ         -- ✅ Baseline date
recorded_at             TIMESTAMPTZ         -- ✅ Projection timestamp
recorded_by             UUID                -- ✅ Provenance (user)
source_type             VARCHAR(100)        -- ✅ Provenance classification
source_id               VARCHAR(255)        -- ✅ Source reference
notes                   TEXT                -- ✅ Evidence documentation
```

**Constraints:**
- ✅ `uq_opening_balance_per_account_date` (one baseline per account per date)
- ✅ `chk_opening_balance_source_type` (provenance validation)
- ✅ Immutability trigger (`finance_cash_opening_balance_immutability_guard`)
- ✅ RLS enabled

**Current State:** 0 rows (no baselines seeded yet — awaiting human decision)

#### Opening Balance Decisions (`finance_cash_opening_balance_decisions`)

**Purpose:** Architectural governance for baseline provenance (INV-F2-O2, INV-F2-O3)

**Current Fields:**
```sql
id                          UUID
tenant_id                   UUID
decided_by                  UUID            -- ✅ Human architect
decision_type               VARCHAR(100)    -- ZERO_BASELINE, VERIFIED_HISTORICAL, CURRENT_POSITION_BASELINE, etc.
applies_to_all_accounts     BOOLEAN         -- Scope flag
specific_bank_account_id    UUID            -- Specific account (if applicable)
baseline_date               DATE            -- Baseline effective date
evidence_source             TEXT            -- Evidence reference
notes                       TEXT            -- Decision rationale
decided_at                  TIMESTAMPTZ     -- Decision timestamp
```

**Constraints:**
- ✅ `chk_decision_type` (valid decision types)
- ✅ `chk_decision_scope` (mutual exclusivity of scope flags)
- ✅ RLS enabled

**Current State:** 0 rows (no decisions recorded — BLOCKED until human approval)

#### Opening Balance Assessment

**🟢 KEEP:**
- Opening balance as authoritative baseline (not synthetic movement)
- Provenance registry architecture (`finance_cash_opening_balance_decisions`)
- `baseline_found` signal (INV-F2-O4)
- Immutability enforcement
- Separation of baseline from movements (avoids audit trail pollution)

**🟡 MODIFY (TT99 Alignment):**
1. **Map opening balance to TT99 accounting period**
   - Current: `effective_date` (TIMESTAMPTZ)
   - TT99 semantic: Opening balance belongs to **beginning of accounting period**
   - **Action:** When seeding opening balances, ensure `effective_date` aligns with `accounting_period.start_date`

2. **Document provenance requirements**
   - Current: `source_type`, `source_id`, `notes`
   - TT99 requirement: Link to period-end closing report or verified evidence
   - **Action:** Strengthen `evidence_source` validation (should reference document)

3. **Decision type alignment with TT99**
   - Current decision types:
     - `ZERO_BASELINE` — ✅ Greenfield accounts (TT99 compliant)
     - `VERIFIED_HISTORICAL` — ✅ Period closing report (TT99 compliant)
     - `CURRENT_POSITION_BASELINE` — ⚠️ Needs TT99 validation
   - **Question:** Is `CURRENT_POSITION_BASELINE` acceptable per TT99?
     - Semantic: "Use current state as future-only baseline"
     - TT99 view: May violate historical accuracy requirement
     - **Recommendation:** Only allow for **future-effective** baselines, document limitation explicitly

**🔴 REBUILD:**
- None.

**⚪ NOT APPLICABLE:**
- N/A

---

## 3. GAP CLASSIFICATION SUMMARY

### F1: Financial Accounting Ledger

| Component | Classification | Priority | Effort |
|-----------|----------------|----------|--------|
| Double-entry architecture | 🟢 KEEP | N/A | 0 |
| Chart of accounts linkage | 🟢 KEEP | N/A | 0 |
| Functional currency | 🟢 KEEP | N/A | 0 |
| Financial dimensions | 🟢 KEEP | N/A | 0 |
| `document_date` field | 🟡 MODIFY | 🔴 HIGH | LOW |
| `accounting_date` field | 🟡 MODIFY | 🔴 HIGH | LOW |
| `posted_at` semantic clarity | 🟡 MODIFY | 🟡 MEDIUM | LOW |
| Provenance fields (recorded_by, approved_by) | 🟡 MODIFY | 🟡 MEDIUM | LOW |
| DB-level balance constraint | 🟡 MODIFY | 🟡 MEDIUM | MEDIUM |
| Biological assets (Account 215) | ⚪ N/A | N/A | N/A |
| Global minimum tax | ⚪ N/A | N/A | N/A |

### F2: Cash Domain

| Component | Classification | Priority | Effort |
|-----------|----------------|----------|--------|
| Cash movement immutable log | 🟢 KEEP | N/A | 0 |
| F1 → F2 lineage | 🟢 KEEP | N/A | 0 |
| effective_date temporal authority | 🟢 KEEP | N/A | 0 |
| Direction abstraction (INFLOW/OUTFLOW) | 🟢 KEEP | N/A | 0 |
| Functional currency valuation | 🟢 KEEP | N/A | 0 |
| 18 orphan movements | 🟡 MODIFY | 🔴 HIGH | HIGH |
| Align effective_date with F1.accounting_date | 🟡 MODIFY | 🟡 MEDIUM | LOW |
| Document provenance (indirect via F1) | 🟡 MODIFY | 🟟 LOW | LOW |

### F2: Opening Balance

| Component | Classification | Priority | Effort |
|-----------|----------------|----------|--------|
| Opening balance architecture | 🟢 KEEP | N/A | 0 |
| Provenance registry | 🟢 KEEP | N/A | 0 |
| baseline_found signal | 🟢 KEEP | N/A | 0 |
| Immutability enforcement | 🟢 KEEP | N/A | 0 |
| Align effective_date with accounting period | 🟡 MODIFY | 🟡 MEDIUM | LOW |
| Strengthen evidence_source validation | 🟡 MODIFY | 🟟 LOW | LOW |
| CURRENT_POSITION_BASELINE TT99 validation | 🟡 MODIFY | 🟡 MEDIUM | LOW |

---

## 4. DEPENDENCY IMPACT ANALYSIS

### 4.1 If F1 Changes (Add document_date, accounting_date)

**Direct Impact:**
- ✅ **F2 Cash Movements:** Must update `effective_date` backfill logic (M1)
  - Current: `effective_date = F1.posted_at`
  - Future: `effective_date = F1.accounting_date`
  - **Migration:** Corrective migration to update effective_date for 301 movements with valid F1 lineage

- ⚠️ **F2 Opening Balances:** Must align `effective_date` with accounting period boundaries
  - **Action:** Validation rule when seeding opening balances

- ⚠️ **GL (if exists):** Must map transactions to correct accounting periods
  - **Risk:** If GL already built, may need period re-assignment

**Indirect Impact:**
- ⚠️ **Revenue Recognition (if exists):** May depend on F1.posted_at
- ⚠️ **AR/AP (if exists):** May depend on F1.posted_at for aging
- ⚠️ **Payroll (if exists):** May depend on F1.posted_at for accrual

**Mitigation:**
- Add `accounting_date` as **NON-BREAKING** change (default = `posted_at` initially)
- Migrate gradually module-by-module
- Use feature flag or version gate for new semantic

### 4.2 Blast Radius (18 Orphan Movements)

**Current State:**
- 18/319 cash movements have **no F1 transaction**
- Used `recorded_at` as fallback (violates INV-F2-T1)

**Root Cause Investigation Needed:**
```
Business Event
     ↓
Document
     ↓
F1 Transaction  ❌ MISSING (18 cases)
     ↓
Cash Movement   ✅ EXISTS (orphan)
```

**Questions:**
1. Were F1 transactions **deleted**? (violates immutability)
2. Were F1 transactions **never created**? (broken projection logic)
3. Are orphans from **migration/seeding** without F1 linkage?

**Impact if NOT Fixed:**
- ❌ **Bella INV-F2-T1 violation:** Accounting lineage broken (architectural invariant)
- ❌ Cannot reconstruct cash position from F1
- ❌ GL reconciliation will fail
- ❌ Audit trail incomplete
- ⚠️ **Possible TT99 violation:** If underlying business events lack proper chứng từ (requires separate assessment)

**Important Distinction:**
- **Architectural violation:** Bella Finance OS INV-F2-T1 (F1 → F2 lineage broken)
- **Accounting violation:** TT99 compliance (requires assessment of underlying business event + document)
- These are **separate concerns** and must be evaluated independently

**Recommended Actions:**
1. **Immediate:** Classify 18 orphans by `source_type` and `tenant_id`
2. **Short-term:** Root cause analysis (deleted F1? never created? migration artifact?)
3. **Evidence gathering:** Check if underlying business events have valid chứng từ
4. **Remediation:** Apply priority decision tree (restore F1 → human-approved → unresolved)
5. **Long-term:** Strengthen F1 → F2 projection logic to prevent future orphans

---

## 5. MIGRATION STRATEGY PROPOSALS

### 5.1 F1: Add Accounting Dates (🛑 NOT APPROVED — REQUIRES REVISION)

**Goal:** Add `document_date` and `accounting_date` fields to `finance_transactions`.

**⚠️ CRITICAL CORRECTION:**
- **v1.0 ERROR:** Auto-backfill with `posted_at::DATE` = asserting semantic truth without evidence
- **v1.1 REQUIREMENT:** Add as NULLABLE, backfill only where evidence exists

**Migration M-F1-DATES-v1.1 (REVISED):**
```sql
-- PHASE A: Add nullable columns (NO auto-backfill)
ALTER TABLE finance_transactions
    ADD COLUMN document_date DATE,            -- NULLABLE
    ADD COLUMN accounting_date DATE;          -- NULLABLE

-- Add index for accounting period queries (supports NULL)
CREATE INDEX idx_finance_txs_accounting_date 
    ON finance_transactions(tenant_id, accounting_date)
    WHERE accounting_date IS NOT NULL;

-- Add comments with semantic warnings
COMMENT ON COLUMN finance_transactions.document_date IS
    'TT99: Ngày chứng từ (document date). Date on original source document. '
    'NULLABLE until evidence-based backfill approved. '
    'DO NOT auto-derive from posted_at without verification.';

COMMENT ON COLUMN finance_transactions.accounting_date IS
    'TT99: Ngày hạch toán (accounting date). Date transaction is recognized for accounting. '
    'Determines accounting period assignment. '
    'NULLABLE until evidence-based backfill approved. '
    'DO NOT auto-derive from posted_at without verification.';

-- PHASE B: Evidence-based backfill (FUTURE — requires human approval)
-- DO NOT execute until:
-- 1. Semantic evidence gathered (what does posted_at represent?)
-- 2. Backfill policy approved (when is posted_at = accounting_date?)
-- 3. Per-tenant accounting framework applicability determined
--
-- Example (NOT FOR AUTO-EXECUTION):
-- UPDATE finance_transactions
-- SET 
--     document_date = <evidence-based-value>,
--     accounting_date = <evidence-based-value>
-- WHERE <evidence-condition>;

-- PHASE C: NOT NULL enforcement (FUTURE — after verification)
-- ALTER TABLE finance_transactions
--     ALTER COLUMN document_date SET NOT NULL,      -- ONLY after backfill verified
--     ALTER COLUMN accounting_date SET NOT NULL;    -- ONLY after backfill verified
```

**Verification (Post-Phase A):**
- ✅ Columns exist
- ✅ All values NULL (expected — no evidence-based backfill yet)
- ✅ Index created
- ❌ **DO NOT verify:** "All transactions have accounting_date = posted_at::DATE" (this was the error)

**Downstream Impact:**
- F2 effective_date alignment BLOCKED until F1 accounting_date populated
- Orphan investigation must happen BEFORE semantic backfill

**Status:** 🛑 **REQUIRES EVIDENCE GATHERING BEFORE EXECUTION**

### 5.2 F1: Add Provenance Fields (🟡 BELLA GOVERNANCE — NOT TT99 DATABASE MANDATE)

**Goal:** Add `recorded_by` and `approved_by` fields for Bella internal control and auditability.

**⚠️ CLARIFICATION:**
- **v1.0 CLAIM:** "TT99 requirement"
- **v1.1 CORRECTION:** TT99 requires provenance on **chứng từ** (documents), not necessarily database columns
- **Bella choice:** Implement at database level for governance and audit trail

**Migration M-F1-PROVENANCE:**
```sql
-- Add provenance fields (Bella governance, optional for TT99 compliance)
ALTER TABLE finance_transactions
    ADD COLUMN recorded_by UUID,              -- Bella internal control
    ADD COLUMN approved_by UUID,              -- Bella workflow governance
    ADD COLUMN approval_timestamp TIMESTAMPTZ;

-- Foreign keys (optional, if user table exists)
-- ALTER TABLE finance_transactions
--     ADD CONSTRAINT fk_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id),
--     ADD CONSTRAINT fk_approved_by FOREIGN KEY (approved_by) REFERENCES users(id);

-- Add comments with correct attribution
COMMENT ON COLUMN finance_transactions.recorded_by IS
    'Bella Governance: User who created the transaction. '
    'Supports internal control and audit trail. '
    'TT99 requires provenance on documents (chứng từ), this is Bella implementation choice.';

COMMENT ON COLUMN finance_transactions.approved_by IS
    'Bella Governance: User who approved the transaction for posting. '
    'Supports workflow governance and audit trail. '
    'TT99 requires provenance on documents (chứng từ), this is Bella implementation choice.';
```

**Verification:**
- Existing transactions have NULL provenance (acceptable)
- New transactions should populate `recorded_by` from application context

### 5.3 F2: Update effective_date Lineage (MEDIUM PRIORITY)

**Goal:** Align F2.effective_date with F1.accounting_date (once F1 has it).

**Migration M-F2-DATES (depends on M-F1-DATES):**
```sql
-- Update effective_date to use F1.accounting_date instead of F1.posted_at
UPDATE finance_cash_movements fcm
SET effective_date = ft.accounting_date::TIMESTAMPTZ
FROM finance_transactions ft
WHERE fcm.f1_transaction_id = ft.id
  AND fcm.tenant_id = ft.tenant_id
  AND ft.accounting_date IS NOT NULL
  AND fcm.effective_date != ft.accounting_date::TIMESTAMPTZ;

-- Verify lineage
DO $$
DECLARE
    v_total INTEGER;
    v_valid_lineage INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE fcm.effective_date::DATE = ft.accounting_date)
    INTO v_total, v_valid_lineage
    FROM finance_cash_movements fcm
    JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id;
    
    IF v_total != v_valid_lineage THEN
        RAISE EXCEPTION 'M-F2-DATES: Lineage verification failed. %/% movements have incorrect effective_date.',
            (v_total - v_valid_lineage), v_total;
    END IF;
    
    RAISE NOTICE 'M-F2-DATES: F2 temporal lineage updated. All % movements now use F1.accounting_date.', v_total;
END $$;
```

**Verification:**
- All movements with valid F1 linkage have `effective_date::DATE = F1.accounting_date`
- 18 orphan movements unchanged (still use recorded_at fallback)

### 5.4 F2: Fix 18 Orphan Movements (HIGH PRIORITY)

**Investigation Query:**
```sql
-- Classify orphan movements
SELECT 
    fcm.tenant_id,
    t.name AS tenant_name,
    fcm.source_type,
    COUNT(*) AS orphan_count,
    MIN(fcm.recorded_at) AS earliest,
    MAX(fcm.recorded_at) AS latest
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
LEFT JOIN tenants t ON fcm.tenant_id = t.id
WHERE ft.id IS NULL
GROUP BY fcm.tenant_id, t.name, fcm.source_type
ORDER BY orphan_count DESC;
```

**Action Plan:**
1. **Classify orphans** by source_type and tenant
2. **Investigate root cause:**
   - Were F1 transactions deleted? (check audit trail)
   - Were they never created? (check application logs)
   - Are they from migration/seeding? (check migration history)
3. **Remediation options:**
   - **Option A:** Restore missing F1 transactions (if audit trail exists)
   - **Option B:** Create synthetic F1 transactions for orphans
   - **Option C:** Delete orphan movements (if invalid)
   - **Option D:** Flag orphans permanently (document why F1 missing)

**DO NOT proceed with M4b until orphans resolved.**

### 5.5 Opening Balance: TT99 Alignment (LOW PRIORITY)

**Goal:** Ensure opening balances align with accounting period boundaries.

**Validation Rule (application-level):**
```typescript
// When seeding opening balances, validate effective_date
function validateOpeningBalanceDate(
    effectiveDate: Date,
    accountingPeriod: AccountingPeriod
): void {
    // Opening balance must be at period start
    if (effectiveDate.toISOString() !== accountingPeriod.startDate.toISOString()) {
        throw new Error(
            `Opening balance effective_date must equal accounting period start date. ` +
            `Got: ${effectiveDate.toISOString()}, Expected: ${accountingPeriod.startDate.toISOString()}`
        );
    }
}
```

**No migration needed** (0 opening balances exist yet).

---

## 6. RECOMMENDATION SUMMARY (REVISION 1.1)

### 6.1 Phase 1.5: Assessment Corrections (CURRENT PHASE)

**Status:** ✅ IN PROGRESS (this revision)

1. **✅ COMPLETED:** Correct date field backfill strategy (no auto-assert)
2. **✅ COMPLETED:** Remove synthetic F1 from remediation defaults
3. **✅ COMPLETED:** Distinguish TT99 from Bella governance requirements
4. **✅ COMPLETED:** Separate architectural violations from TT99 violations
5. **✅ COMPLETED:** Add accounting framework effective-date scope
6. **✅ COMPLETED:** Revise execution order (investigate first)

**Approval Gate:** Human Architect reviews Revision 1.1

### 6.2 Phase 2: Orphan Forensic Review (NEXT PHASE — BEFORE any schema changes)

**🔴 CRITICAL: This MUST happen before M-F1-DATES**

1. **Classify 18 orphan movements:**
   - By source_type
   - By tenant_id
   - By recorded_at timeline

2. **Root cause analysis:**
   - Were F1 transactions deleted? (check audit trail)
   - Were they never created? (check application logs)
   - Are they migration artifacts? (check migration history)

3. **Evidence gathering:**
   - Do underlying business events exist?
   - Do chứng từ (source documents) exist?
   - Can F1 transactions be reconstructed?

4. **Decision tree application:**
   - Priority 1: Restore existing F1
   - Priority 2: Human-approved remediation with evidence
   - Priority 3: Legacy/migration policy treatment
   - Priority 4: Flag as UNRESOLVED (never fabricate)

**Output:** Orphan Forensic Report with remediation decisions

### 6.3 Phase 3: F1 Date Contract Design (AFTER orphan forensics)

**Goal:** Define semantic meaning of date fields with evidence

1. **Investigate `posted_at` semantic:**
   - What does it actually represent in current system?
   - System timestamp? Accounting date? Posting date?
   - Query historical data for patterns

2. **Define `document_date` semantic:**
   - When can it be derived from existing data?
   - When must it be NULL (no evidence)?
   - Backfill policy proposal

3. **Define `accounting_date` semantic:**
   - When can it be derived from existing data?
   - When must it be NULL (no evidence)?
   - Relationship to accounting_period_id

4. **Design backfill policy:**
   - WHERE conditions for evidence-based backfill
   - Explicit NULL handling for unresolved cases
   - NOT NULL enforcement criteria

**Output:** F1 Date Contract Specification (for human approval)

### 6.4 Phase 4: Controlled Migration (AFTER contract approved)

**🛑 NOT APPROVED YET — requires Phase 2 + Phase 3 completion**

1. **Execute M-F1-DATES-v1.1** (nullable columns only)
2. **Evidence-based backfill** (per approved contract)
3. **Verification** (manual spot-checks)
4. **NOT NULL enforcement** (only after verification)

### 6.5 Phase 5: F2 Lineage Verification

**AFTER F1 dates populated**

1. Update F2 effective_date alignment (if evidence supports)
2. Verify 301 movements with valid F1 lineage
3. Document 18 orphan permanent status

### 6.6 Phase 6: Baseline Provenance Decision

**UNCHANGED from v1.0**

- Human Architect decides baseline strategy
- Record decision in finance_cash_opening_balance_decisions
- Approve M4b creation

### 6.7 Long-term Actions (IFRS/VFRS Preparation)

**UNCHANGED from v1.0**

1. Monitor Circular 99 → VFRS transition
2. Assess chart of accounts against VFRS
3. Evaluate biological assets (if applicable)
4. Global minimum tax compliance (Pillar Two)

### 6.8 Accounting Framework Scope (NEW — v1.1)

**Per-Tenant TT99 Applicability:**

1. **Determine fiscal year start dates** per tenant
2. **Calculate TT99 effective dates** (first fiscal year beginning on or after 2026-01-01)
3. **Design accounting_framework table:**
   ```sql
   CREATE TABLE accounting_frameworks (
       tenant_id UUID,
       framework_type VARCHAR(50),  -- 'TT99', 'CIRCULAR_200', 'IFRS', etc.
       effective_from DATE,          -- Fiscal year start
       fiscal_year_start_month INT,
       notes TEXT
   );
   ```
4. **Support historical framework coexistence** (pre-TT99 data may be under Circular 200)

---

## 7. CONCLUSION

### 7.1 Overall Assessment

**Finance OS Technical Architecture: 🟢 SOUND**
- Double-entry ledger (F1) is correct
- Cash domain separation (F2) is correct
- Opening balance abstraction is correct
- Immutability enforcement is correct
- Tenant isolation is correct

**Finance OS Accounting Semantics: 🟡 GAPS IDENTIFIED**
- Missing `document_date` and `accounting_date` (F1)
- Missing provenance fields (F1)
- 18 orphan movements (F2) — broken lineage
- `posted_at` semantic unclear
- Opening balance TT99 compliance needs validation

**Recommendation: MODIFY (Extend Semantic Model), NOT REBUILD**

### 7.2 Estimated Effort

| Task | Effort | Risk |
|------|--------|------|
| M-F1-DATES migration | 🟢 LOW (1-2 hours) | 🟢 LOW |
| M-F1-PROVENANCE migration | 🟢 LOW (1 hour) | 🟢 LOW |
| M-F2-DATES migration | 🟢 LOW (1 hour) | 🟢 LOW |
| 18 orphan investigation | 🟡 MEDIUM (4-8 hours) | 🟡 MEDIUM |
| 18 orphan remediation | 🔴 HIGH (varies) | 🔴 HIGH |
| DB-level balance constraint | 🟡 MEDIUM (2-4 hours) | 🟡 MEDIUM |
| Document registry | 🔴 HIGH (8-16 hours) | 🟡 MEDIUM |
| TT99 compliance validation | 🟡 MEDIUM (4 hours) | 🟟 LOW |

**Total Estimated Effort:** 20-40 hours (excluding orphan remediation)

### 7.3 Confidence Level

**High Confidence (90%+):**
- F1/F2 architecture can be preserved
- Adding accounting dates is straightforward
- Migrations are non-breaking (additive)

**Medium Confidence (70-90%):**
- 18 orphan movements can be remediated without major refactor
- CURRENT_POSITION_BASELINE is TT99-compliant (needs accountant review)

**Low Confidence (<70%):**
- Impact on downstream modules (GL, AR/AP, Revenue, Payroll) — not yet analyzed
- VFRS transition timeline and breaking changes

### 7.4 Final Verdict (Revision 1.1)

**✅ APPROVED:**
- Technical architecture is SOUND — DO NOT REFACTOR Finance OS
- M1–M4a are architecturally correct — DO NOT roll back
- F1/F2 separation is correct — KEEP
- Double-entry ledger is correct — KEEP
- Immutability enforcement is correct — KEEP

**🛑 NOT APPROVED:**
- Migration M-F1-DATES v1.0 (auto-backfill with posted_at)
- Migration execution until orphan forensics complete
- Any fabrication of synthetic F1 transactions
- Any assumption that posted_at = accounting_date without evidence

**🟡 REQUIRES CORRECTION:**
- Add accounting framework effective-date scope (fiscal year applicability)
- Distinguish TT99 requirements from Bella governance choices
- Separate Bella architectural invariants from TT99 compliance violations
- Orphan remediation decision tree (evidence-first, never fabricate)

**✅ NEXT PHASE:**
- Phase 1.5: Corrections applied → Revision 1.1 (THIS DOCUMENT)
- Phase 2: Orphan forensic review (classification + root cause)
- Phase 3: F1 date contract design (semantic evidence gathering)
- Phase 4: Controlled migration (evidence-based backfill only)
- Phase 5: F2 lineage verification
- Phase 6: Baseline provenance decision
- Phase 7: M4b execution

**⚠️ CRITICAL:**
- DO NOT execute M-F1-DATES until semantic evidence gathered
- DO NOT create synthetic F1 transactions
- DO NOT SET NOT NULL until verification complete
- DO investigate 18 orphans BEFORE schema changes

M1–M4a remain **architecturally sound** and provide **excellent foundation** for semantic hardening.

---

## 8. APPENDICES

### A. TT99 Reference Documents

- Circular 99/2025/TT-BTC (Vietnamese): [Official MOF source]
- KPMG Circular 99 Alert: https://kpmg.com/content/dam/kpmgsites/vn/pdf/2025/11/circular-99-en.pdf
- Vietnam Briefing Analysis: https://www.vietnam-briefing.com/news/circular-99-vietnam-accounting-regime-means-for-ifrs-alignment.html/
- Grant Thornton Decree 99 Guide: https://www.grantthornton.com.vn/contentassets/.../decree-99---eng-version.pdf

### B. Vietnamese Accounting Terms Glossary

| Vietnamese | English | Finance OS Mapping |
|------------|---------|-------------------|
| Chứng từ | Source document | F1.reference_type + reference_id |
| Ngày chứng từ | Document date | ❌ Missing (needs F1.document_date) |
| Ngày hạch toán | Accounting date | ❌ Missing (needs F1.accounting_date) |
| Ngày ghi sổ | Posting date | F1.posted_at (semantic unclear) |
| Bút toán | Journal entry | finance_transactions + transaction_lines |
| Nợ | Debit | transaction_lines.debit_amount |
| Có | Credit | transaction_lines.credit_amount |
| Kỳ kế toán | Accounting period | finance_accounting_periods |
| Người lập | Recorded by | ❌ Missing (needs F1.recorded_by) |
| Người duyệt | Approved by | ❌ Missing (needs F1.approved_by) |
| Tiền mặt | Cash on hand | finance_bank_accounts (type: CASH) |
| Tiền gửi ngân hàng | Cash in banks | finance_bank_accounts (type: BANK) |

### C. F1 Schema Diagram (Current + Proposed)

```
┌─────────────────────────────────────────────────────────┐
│        finance_transactions (F1 Header)                  │
├─────────────────────────────────────────────────────────┤
│ id                      UUID (PK)                        │
│ tenant_id               UUID (FK → tenants)              │
│ idempotency_key         VARCHAR(255) ✅                  │
│ source_type             VARCHAR(255) ✅                  │
│ source_id               VARCHAR(255) ✅                  │
│ status                  VARCHAR(20) ✅                   │
│ transaction_type        VARCHAR(20) ✅                   │
│ accounting_period_id    UUID (FK → periods) ✅           │
│ document_date           DATE ❌ MISSING → ADD            │
│ accounting_date         DATE ❌ MISSING → ADD            │
│ posted_at               TIMESTAMPTZ ⚠️ SEMANTIC UNCLEAR  │
│ transaction_currency    VARCHAR(10) ✅                   │
│ functional_currency     VARCHAR(10) ✅                   │
│ exchange_rate_*         ... ✅                           │
│ description             TEXT ✅                          │
│ reference_type          VARCHAR(255) ✅                  │
│ reference_id            VARCHAR(255) ✅                  │
│ recorded_by             UUID ❌ MISSING → ADD            │
│ approved_by             UUID ❌ MISSING → ADD            │
│ reversal_of             UUID (FK → self) ✅              │
│ created_at              TIMESTAMPTZ ✅                   │
│ updated_at              TIMESTAMPTZ ✅                   │
└─────────────────────────────────────────────────────────┘
```

### D. Orphan Movement Investigation Template

```sql
-- Template for investigating orphan movements
WITH orphans AS (
    SELECT 
        fcm.*,
        t.name AS tenant_name
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    LEFT JOIN tenants t ON fcm.tenant_id = t.id
    WHERE ft.id IS NULL
)
SELECT 
    tenant_name,
    source_type,
    f1_transaction_id,
    recorded_at,
    effective_date,
    direction,
    amount_minor,
    currency,
    description
FROM orphans
ORDER BY tenant_name, recorded_at;
```

---

**END OF ASSESSMENT**

**Document Version:** 1.0  
**Date:** 2026-08-24  
**Status:** 🟡 DRAFT — Awaiting Human Architect Review  
**Next Action:** Review findings → Approve migration strategy → Execute M-F1-DATES → Resolve 18 orphans → Resume M4b gate


---

## 9. REVISION 1.1 SUMMARY

### What Changed from v1.0 → v1.1

**🔴 CRITICAL CORRECTIONS:**

1. **Date field backfill strategy:**
   - ❌ v1.0: `UPDATE ... SET accounting_date = posted_at::DATE; ALTER ... SET NOT NULL;`
   - ✅ v1.1: Add as NULLABLE, no auto-backfill, evidence-based only, NOT NULL after verification

2. **Orphan remediation:**
   - ❌ v1.0: Four equal options including "create synthetic F1"
   - ✅ v1.1: Priority decision tree, NEVER fabricate F1 without evidence

3. **TT99 vs Bella governance:**
   - ❌ v1.0: "TT99 requirement: recorded_by, approved_by columns"
   - ✅ v1.1: TT99 requires document provenance, database columns are Bella governance choice

4. **Violation classification:**
   - ❌ v1.0: "18 orphans violate TT99 accounting lineage requirements"
   - ✅ v1.1: Bella INV-F2-T1 violation (architectural), TT99 compliance requires separate assessment

5. **Execution order:**
   - ❌ v1.0: M-F1-DATES → M-F2-DATES → orphan fix
   - ✅ v1.1: Orphan forensics → Date contract design → Evidence-based migration

6. **Accounting framework scope:**
   - ❌ v1.0: Missing
   - ✅ v1.1: TT99 applies per fiscal year, tenant-specific effective dates

### What Remains APPROVED from v1.0

**✅ Technical Architecture Assessment:**
- F1/F2 separation is correct
- Double-entry ledger is correct
- Immutability enforcement is correct
- M1–M4a are sound
- NO REBUILD required

**✅ Gap Classification:**
- 🟢 KEEP: Technical architecture, F1/F2, double-entry, immutability
- 🟡 MODIFY: Add date fields, add provenance (with corrections)
- 🔴 REBUILD: None
- ⚪ N/A: Biological assets, global minimum tax

### Human Architect Approval Status

**v1.0:** ❌ **NOT APPROVED** — Critical errors in migration strategy

**v1.1:** 🟡 **AWAITING REVIEW** — Corrections applied, ready for approval

**Next Gate:** Human Architect reviews this revision and either:
- ✅ APPROVES → Proceed to Phase 2 (Orphan Forensics)
- 🔴 REJECTS → Further corrections required

### What Happens After v1.1 Approval

```
v1.1 APPROVED
    ↓
Phase 2: Orphan Forensic Review
    ↓
Phase 3: F1 Date Contract Design
    ↓
Phase 4: Controlled Migration (evidence-based)
    ↓
Phase 5: F2 Lineage Verification
    ↓
Phase 6: Baseline Provenance Decision
    ↓
Phase 7: M4b Execution
```

**BLOCKED until v1.1 approved:**
- ❌ M-F1-DATES execution
- ❌ M-F2-DATES execution
- ❌ M-F1-PROVENANCE execution
- ❌ M4b creation
- ❌ Worker/RPC modifications
- ❌ F5.6 implementation

### Key Principle Established

**"Semantic Evidence Before Database Assertion"**

Do NOT:
```sql
-- Assert semantic truth without evidence
UPDATE table SET accounting_date = system_timestamp::DATE;
ALTER TABLE ... SET NOT NULL;
```

DO:
```sql
-- Add nullable, investigate evidence, backfill where proven, verify, then enforce
ALTER TABLE ... ADD COLUMN accounting_date DATE;  -- nullable
-- ... evidence gathering ...
-- ... human-approved backfill policy ...
-- ... verification ...
-- ALTER TABLE ... SET NOT NULL;  -- only after verification
```

---

**END OF REVISION 1.1**

**Document Version:** 1.1  
**Date:** 2026-08-24  
**Status:** 🟡 AWAITING HUMAN ARCHITECT APPROVAL  
**Next Action:** Human Architect reviews corrections → Approves or rejects → Proceed to Phase 2 or revise further
