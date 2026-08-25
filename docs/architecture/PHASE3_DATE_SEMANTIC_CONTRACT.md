# PHASE 3.2 — F1 3-DATE SEMANTIC CONTRACT

**Date:** 2026-08-24  
**Status:** 🔵 IN PROGRESS (DESIGN ONLY — NO IMPLEMENTATION)  
**Mode:** SEMANTIC CONTRACT DESIGN

---

## EXECUTIVE SUMMARY

**Objective:** Define formal semantic contract for 3 dates in F1 transactions: `document_date`, `accounting_date`, `posted_at`.

**Approach:** Contract-first design — define semantics, authority, lifecycle, mutability BEFORE schema.

**Principle:** "Schema is derived from contract, not the other way around."

---

## SEMANTIC CONTRACT DEFINITIONS

### 1. DOCUMENT_DATE — Business Event Date

**What It Represents:**

```
document_date = The date when the underlying business event occurred or the document was issued.
```

**Vietnamese Accounting Term:** **Ngày chứng từ** (Document date)

**Examples:**
- Invoice: The date printed on the invoice (invoice issue date)
- Payment: The date when payment was received or made
- Contract: The contract effective date or signing date
- Adjustment: The date of the event being adjusted

**Semantic Rules:**

| Rule | Definition |
|------|------------|
| **Authority** | Business event owner / document issuer |
| **Source** | External document, business transaction, contract |
| **Timing** | Set at transaction creation time (from source event) |
| **Type** | DATE (calendar date, no time component) or TIMESTAMPTZ (with time if business event has specific time) |
| **Timezone** | Business event timezone (e.g., invoice issued in Vietnam → Asia/Ho_Chi_Minh) |
| **Immutability** | IMMUTABLE after POSTED (cannot change once ledger entry confirmed) |
| **Nullability** | NOT NULL when status = POSTED (must be known for posted transactions) |
| **Backdating** | CAN be in the past (historical document) |
| **Future Dating** | CAN be in future (advance invoice, prepayment) |

**Business Logic:**

```typescript
// Example: Invoice finalization
const transaction = {
  document_date: invoice.issue_date,  // ← From invoice document
  // When: Invoice was issued to customer
  // Who: Sales department / invoice issuer
  // Immutable: Yes, invoice date cannot change
};
```

**Constraints:**

```sql
-- Lifecycle constraint
CHECK (
  (status = 'DRAFT') OR 
  (status = 'POSTED' AND document_date IS NOT NULL)
)

-- Immutability (after POSTED)
-- Trigger: Prevent UPDATE of document_date when status = 'POSTED'
```

**Authority Chain:**

```
Business Event (Invoice, Payment, Contract)
        ↓
Document Date (printed on document)
        ↓
F1.document_date (recorded in ledger)
        ↓
IMMUTABLE (audit trail)
```

**Relationship to Accounting:**

- `document_date` ≠ `accounting_date` in general
- Accrual accounting: revenue/expense recognized in different period than document date
- Example: Invoice issued Dec 31, 2026 (document_date), but revenue recognized Jan 1, 2027 (accounting_date)

**TT99/VAS Semantic Mapping:**

- **Designed to support:** Ngày chứng từ (Document date) requirement
- **Legal intent:** Must match physical document date (if document exists)
- **Audit intent:** Immutable for compliance (cannot alter historical documents)
- **Formal compliance:** Subject to Phase 3.3 detailed mapping and validation

---

### 2. ACCOUNTING_DATE — Accounting Recognition Date

**What It Represents:**

```
accounting_date = The date when the transaction is recognized in the accounting books,
                  determining which accounting period the transaction belongs to.
```

**Vietnamese Accounting Term:** **Ngày hạch toán** (Accounting date / Posting date)

**Examples:**
- Revenue recognition: Date when revenue is recognized (may differ from invoice date)
- Expense recognition: Date when expense is recognized (accrual vs cash basis)
- Accrual: Date of service delivery, not invoice issue
- Period adjustment: Accountant moves transaction to correct period

**Semantic Rules:**

| Rule | Definition |
|------|------------|
| **Authority** | Accountant / accounting department |
| **Source** | Accounting policy, recognition rules, accountant decision |
| **Timing** | Set at transaction creation OR adjusted by accountant |
| **Type** | DATE (calendar date, no time component) |
| **Timezone** | Company accounting timezone (e.g., Asia/Ho_Chi_Minh for Vietnam) |
| **Immutability** | MUTABLE before period CLOSED, IMMUTABLE after period CLOSED |
| **Nullability** | NOT NULL when status = POSTED (must assign to accounting period) |
| **Backdating** | YES (accountant can assign to previous period if period still OPEN) |
| **Future Dating** | YES (advance recognition, deferred revenue) |

**Business Logic:**

```typescript
// Example 1: Cash basis (accounting_date = document_date)
const cashTransaction = {
  document_date: payment.payment_date,      // Jan 15, 2027
  accounting_date: payment.payment_date,    // Jan 15, 2027 (same)
  // When cash is received, revenue recognized immediately
};

// Example 2: Accrual basis (accounting_date ≠ document_date)
const accrualTransaction = {
  document_date: invoice.issue_date,        // Dec 31, 2026
  accounting_date: service.delivery_date,   // Jan 5, 2027 (different!)
  // Revenue recognized when service delivered, not when invoice issued
};

// Example 3: Period adjustment by accountant
const adjustedTransaction = {
  document_date: invoice.issue_date,        // Feb 1, 2027
  accounting_date: accountant.assigned_period,  // Jan 31, 2027
  // Accountant assigns to January period (before period closed)
};
```

**Constraints:**

```sql
-- Lifecycle constraint
CHECK (
  (status = 'DRAFT') OR 
  (status = 'POSTED' AND accounting_date IS NOT NULL)
)

-- Period closure constraint
-- Trigger: Prevent UPDATE of accounting_date when accounting_period.status = 'CLOSED'
```

**Authority Chain:**

```
Business Event
        ↓
Accounting Policy (cash vs accrual)
        ↓
Accountant Decision (period assignment)
        ↓
F1.accounting_date
        ↓
MUTABLE (until period CLOSED)
        ↓
Period CLOSED → IMMUTABLE
```

**Mutability Rules:**

| Period Status | accounting_date Mutability | Rationale |
|---------------|---------------------------|-----------|
| **OPEN** | MUTABLE | Accountant can adjust before closing |
| **CLOSED** | IMMUTABLE | Period closed, books locked, audit trail |
| **LOCKED** | IMMUTABLE | Regulatory lock, cannot reopen |

**Relationship to Period Closing:**

```
T1: accounting_date = 2026-12-31  (December period)
        ↓
December period status = OPEN
        ↓
Accountant CAN update accounting_date = 2027-01-31 (move to January)
        ↓
December period status = CLOSED
        ↓
Accountant CANNOT update accounting_date (immutable)
```

**TT99/VAS Semantic Mapping:**

- **Designed to support:** Ngày hạch toán (Accounting date) requirement
- **Period intent:** Determines which accounting period transaction belongs to
- **Reporting intent:** Used for financial statements (balance sheet as of date, income statement for period)
- **Closing intent:** Immutable after period close (regulatory requirement)
- **Formal compliance:** Subject to Phase 3.3 detailed mapping and validation

---

### 3. POSTED_AT — System Posting Timestamp

**What It Represents:**

```
posted_at = The precise timestamp when the transaction was posted to the ledger by the system,
            serving as an immutable audit trail of when the entry was recorded.
```

**Vietnamese Accounting Term:** **Thời điểm ghi sổ** (Ledger posting timestamp) or **Thời điểm hệ thống ghi nhận** (System recognition timestamp)

**Examples:**
- Ledger entry: When accountant clicked "Post" and system recorded the entry
- Audit trail: System timestamp for compliance and debugging
- Temporal ordering: Determine which transaction was recorded first (not which occurred first)

**Semantic Rules:**

| Rule | Definition |
|------|------------|
| **Authority** | SYSTEM (not user-supplied) |
| **Source** | Database server timestamp (`NOW()` at posting time) |
| **Timing** | Set EXACTLY when status changes from DRAFT → POSTED |
| **Type** | TIMESTAMPTZ (timestamp with timezone, full precision) |
| **Timezone** | UTC (server timezone for consistency) |
| **Immutability** | IMMUTABLE (audit trail cannot be altered) |
| **Nullability** | NULL when DRAFT, NOT NULL when POSTED/REVERSED/VOIDED |
| **Backdating** | NO (always current timestamp, cannot set to past) |
| **Future Dating** | NO (always current timestamp, cannot set to future) |

**Business Logic:**

```typescript
// WRONG: User supplies posted_at (current implementation)
const transaction = {
  status: 'POSTED',
  posted_at: new Date('2026-08-15T12:00:00Z'),  // ❌ User-controlled
};

// CORRECT: System generates posted_at (proposed)
const transaction = {
  status: 'POSTED',
  posted_at: null,  // ← System will set automatically
};

// Database trigger sets posted_at = NOW() when status → POSTED
```

**Constraints:**

```sql
-- Lifecycle constraint
CHECK (
  (status = 'DRAFT' AND posted_at IS NULL) OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND posted_at IS NOT NULL)
)

-- Immutability (always)
-- Trigger: Prevent UPDATE of posted_at once set (audit trail)

-- System authority (cannot be user-supplied)
-- Trigger: Set posted_at = NOW() when status → POSTED, reject manual updates
```

**Authority Chain:**

```
User Action (click "Post" button)
        ↓
Application (calls LedgerService.postTransaction)
        ↓
Database Trigger (status → POSTED)
        ↓
System generates posted_at = NOW()
        ↓
IMMUTABLE (audit trail)
```

**Relationship to Other Dates:**

```
document_date = 2026-12-15  (when invoice was issued)
accounting_date = 2026-12-31  (accountant assigns to December period)
posted_at = 2027-01-05T08:30:00Z  (when entry was recorded in system)

Timeline:
  Dec 15 ──────── Dec 31 ──────── Jan 5
     │                │               │
     │                │               │
  Document        Accounting      Posted
  (business)      (recognition)   (system)
```

**Usage:**

| Consumer | Uses `posted_at` For |
|----------|---------------------|
| **Audit** | When was entry recorded (compliance) |
| **Debugging** | Temporal ordering of transactions |
| **Replication** | Log shipping, event ordering |
| **NOT for F5** | ❌ Do NOT use for as_of filtering (use `accounting_date`) |
| **NOT for F2** | ❌ Do NOT use for effective_date (use `accounting_date`) |

**TT99/VAS Semantic Mapping:**

- **NOT a TT99 requirement** (system timestamp, not accounting field)
- **Audit trail:** Useful for compliance (when books were modified)
- **Debugging:** Helps trace data lineage and system behavior
- **Formal compliance:** Not applicable (internal system field)

---

## LIFECYCLE STATE MATRIX

### State Transition Rules

```
DRAFT
  ↓
POSTED
  ↓
REVERSED / VOIDED
```

### Date Mutability by State

| Date Field | DRAFT | POSTED | REVERSED | VOIDED | CLOSED PERIOD |
|------------|-------|--------|----------|--------|---------------|
| **document_date** | MUTABLE | IMMUTABLE | IMMUTABLE | IMMUTABLE | IMMUTABLE |
| **accounting_date** | MUTABLE | MUTABLE* | IMMUTABLE | IMMUTABLE | IMMUTABLE |
| **posted_at** | NULL | IMMUTABLE | IMMUTABLE | IMMUTABLE | IMMUTABLE |

**\*MUTABLE:** `accounting_date` can be updated while period is OPEN, becomes IMMUTABLE when period CLOSED.

### Nullability by State

| Date Field | DRAFT | POSTED | REVERSED | VOIDED |
|------------|-------|--------|----------|--------|
| **document_date** | NULLABLE | NOT NULL | NOT NULL | NOT NULL |
| **accounting_date** | NULLABLE | NOT NULL | NOT NULL | NOT NULL |
| **posted_at** | NULL | NOT NULL | NOT NULL | NOT NULL |

### Lifecycle Constraints (SQL)

```sql
-- Constraint 1: posted_at must be NULL in DRAFT, NOT NULL in other states
CHECK (
  (status = 'DRAFT' AND posted_at IS NULL) OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND posted_at IS NOT NULL)
)

-- Constraint 2: document_date and accounting_date must be NOT NULL in POSTED
CHECK (
  (status = 'DRAFT') OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND 
   document_date IS NOT NULL AND 
   accounting_date IS NOT NULL)
)

-- Constraint 3: Immutability after POSTED (enforced by trigger)
CREATE TRIGGER trg_f1_date_immutability
BEFORE UPDATE ON finance_transactions
FOR EACH ROW
EXECUTE FUNCTION f1_date_immutability_guard();
```

**Immutability Guard Logic:**

```sql
CREATE OR REPLACE FUNCTION f1_date_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent document_date modification after POSTED
  IF OLD.status IN ('POSTED', 'REVERSED', 'VOIDED') THEN
    IF NEW.document_date IS DISTINCT FROM OLD.document_date THEN
      RAISE EXCEPTION 'F1_DATE_IMMUTABLE: document_date cannot be modified after status = POSTED'
        USING ERRCODE = 'F1020';
    END IF;
  END IF;

  -- Prevent accounting_date modification after period CLOSED
  IF OLD.status IN ('POSTED', 'REVERSED', 'VOIDED') THEN
    -- Check if accounting period is CLOSED
    IF EXISTS (
      SELECT 1 FROM finance_accounting_periods
      WHERE id = OLD.accounting_period_id
        AND status IN ('CLOSED', 'LOCKED')
    ) THEN
      IF NEW.accounting_date IS DISTINCT FROM OLD.accounting_date THEN
        RAISE EXCEPTION 'F1_PERIOD_CLOSED: accounting_date cannot be modified after period CLOSED'
          USING ERRCODE = 'F1021';
      END IF;
    END IF;
  END IF;

  -- Prevent posted_at modification (always immutable)
  IF NEW.posted_at IS DISTINCT FROM OLD.posted_at THEN
    RAISE EXCEPTION 'F1_POSTED_AT_IMMUTABLE: posted_at is system-generated and cannot be modified'
      USING ERRCODE = 'F1022';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## AUTHORITY RULES

### Who Provides Each Date?

| Date Field | Authority | Source | Timing |
|------------|-----------|--------|--------|
| **document_date** | Business event owner | External document, source system | At transaction creation |
| **accounting_date** | Accountant / accounting policy | Recognition rules, period assignment | At creation or adjustment |
| **posted_at** | SYSTEM (automatic) | Database NOW() | At status → POSTED |

### Authority Chain

```
USER (Business Event Owner)
  ↓
  Provides document_date (from invoice, payment, contract)
  ↓
LedgerService.postTransaction(request)
  ↓
  request.document_date = invoice.issue_date
  request.accounting_date = accountant_assigned_period OR document_date (default)
  ↓
DATABASE TRIGGER (on status → POSTED)
  ↓
  posted_at = NOW() (system-generated)
  ↓
LEDGER ENTRY (immutable)
```

### Default Rules

**Scenario 1: No explicit accounting_date provided**

```typescript
// User provides only document_date
const request = {
  document_date: invoice.issue_date,  // 2026-12-15
  accounting_date: undefined,         // Not provided
};

// System default: accounting_date = document_date (cash basis)
const transaction = {
  document_date: '2026-12-15',
  accounting_date: '2026-12-15',  // ← Default same as document_date
  posted_at: null,  // ← Set by system when POSTED
};
```

**Scenario 2: Accountant explicitly assigns period**

```typescript
// Accountant overrides accounting_date
const request = {
  document_date: invoice.issue_date,  // 2026-12-31
  accounting_date: '2027-01-31',      // Move to January period
};

const transaction = {
  document_date: '2026-12-31',
  accounting_date: '2027-01-31',  // ← Explicit override
  posted_at: null,
};
```

---

## BACKDATED TRANSACTION RULES

### Can Transactions Have Historical Dates?

**Question:** Can `document_date` or `accounting_date` be in the past?

**Answer:** YES, with constraints.

### Backdated document_date

**Use Case:** Recording a historical document that was not entered in real-time

```typescript
// Today: 2027-01-10
// Recording an invoice from last month
const transaction = {
  document_date: '2026-12-15',    // ← Past date (OK)
  accounting_date: '2026-12-31',  // ← Past date (OK if period OPEN)
  posted_at: null,                // ← Will be 2027-01-10T... (current time)
};
```

**Rules:**
- ✅ `document_date` CAN be in past (historical document)
- ⚠️ `accounting_date` CAN be in past ONLY IF accounting period still OPEN
- ❌ `posted_at` CANNOT be in past (always current timestamp)

### Backdated accounting_date — Period Status Check

```
Current Date: 2027-01-10

User wants accounting_date = 2026-12-31 (December)
        ↓
Check: December period status
        ↓
   ┌─────────┴─────────┐
   ▼                   ▼
OPEN                CLOSED
   │                   │
   ▼                   ▼
ALLOWED            REJECTED
```

**Validation Logic:**

```typescript
async function validateAccountingDate(
  accountingDate: Date,
  tenantId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Find the accounting period for this date
  const period = await findPeriodByDate(tenantId, accountingDate);
  
  if (!period) {
    return { 
      allowed: false, 
      reason: 'No accounting period defined for this date' 
    };
  }
  
  if (period.status === 'CLOSED' || period.status === 'LOCKED') {
    return { 
      allowed: false, 
      reason: `Period ${period.name} is ${period.status}. Cannot post to closed period.` 
    };
  }
  
  return { allowed: true };
}
```

### Future-Dated Transactions

**Use Case:** Advance invoice, prepayment, deferred revenue

```typescript
// Today: 2027-01-10
// Advance invoice for February service
const transaction = {
  document_date: '2027-02-01',    // ← Future date (OK)
  accounting_date: '2027-02-28',  // ← Future date (OK)
  posted_at: null,                // ← Will be 2027-01-10T... (current time)
};
```

**Rules:**
- ✅ `document_date` CAN be in future (advance invoice)
- ✅ `accounting_date` CAN be in future (deferred recognition)
- ❌ `posted_at` CANNOT be in future (always current timestamp)

**Business Implication:**

- Future `accounting_date` → Transaction will NOT appear in current period reports
- F5 `as_of` query will EXCLUDE future transactions: `WHERE accounting_date <= as_of`

---

## F2 TEMPORAL LINEAGE

### Which F1 Date Does F2 Use?

**Question:** F2 cash movements have `effective_date`. Which F1 date should F2 inherit?

**Current State (Phase 3.1 Finding):**

```sql
-- Current backfill (M1)
UPDATE finance_cash_movements fcm
SET effective_date = ft.posted_at  -- ← Uses posted_at (WRONG)
FROM finance_transactions ft
WHERE fcm.f1_transaction_id = ft.id;
```

**Problem:** `posted_at` = system timestamp, NOT accounting effective date.

**Proposed Correction:**

```
F2.effective_date SHOULD inherit F1.accounting_date (NOT posted_at)
```

**Rationale:**

| Reason | Explanation |
|--------|-------------|
| **Semantic match** | F2 `effective_date` means "when cash movement is effective for accounting" = `accounting_date` |
| **F5 consistency** | F5 uses `accounting_date` for as_of filtering → F2 must align |
| **TT99 compliance** | "Ngày hạch toán" (accounting date) determines period |
| **Temporal queries** | "Show cash position as of 2026-12-31" must use accounting_date |

**Corrected Lineage:**

```
F1 Transaction
      ↓
accounting_date (which period)
      ↓
F2 Cash Movement
      ↓
effective_date = F1.accounting_date
      ↓
F5 Temporal Query: WHERE effective_date <= as_of
```

**Migration Impact:**

```sql
-- CORRECTED backfill (M-F2-DATES)
UPDATE finance_cash_movements fcm
SET effective_date = ft.accounting_date  -- ← Use accounting_date (CORRECT)
FROM finance_transactions ft
WHERE fcm.f1_transaction_id = ft.id;
```

**Invariant:**

```
INV-F2-T1 (CORRECTED):
  F2.effective_date = F1.accounting_date (at projection time)
```

---

## F5 TEMPORAL FILTER

### Which F1 Date Does F5 Use for as_of Queries?

**Question:** F5 `finance_journal_entries_as_of(as_of)` filters transactions. Which date should it use?

**Current State (Phase 3.1 Finding):**

```sql
-- Current F5 contract
WHERE ft.posted_at <= p_as_of  -- ← Uses posted_at (WRONG)
```

**Problem:** `posted_at` = system timestamp, NOT accounting effective date.

**Proposed Correction:**

```
F5 as_of filtering SHOULD use F1.accounting_date (NOT posted_at)
```

**Rationale:**

| Reason | Explanation |
|--------|-------------|
| **Business semantic** | "Show books as of 2026-12-31" means "transactions recognized in Dec or earlier" |
| **Period reports** | Income statement for December = `WHERE accounting_date BETWEEN '2026-12-01' AND '2026-12-31'` |
| **TT99 compliance** | Financial reports use accounting date (ngày hạch toán), not system timestamp |
| **Audit trail** | `posted_at` is for audit (when recorded), `accounting_date` is for reporting (which period) |

**Corrected F5 Contract:**

```sql
CREATE OR REPLACE FUNCTION public.finance_journal_entries_as_of(
    p_tenant_id         UUID,
    p_as_of             TIMESTAMPTZ,
    p_contract_version  TEXT
)
RETURNS TABLE (...) AS $$
BEGIN
    -- CORRECTED: Use accounting_date for temporal filtering
    RETURN QUERY
    SELECT
        ft.id                   AS transaction_id,
        -- ...
        ft.accounting_date      AS posting_date,  -- ← CHANGED from posted_at
        -- ...
    FROM finance_transactions ft
    -- ...
    WHERE ft.tenant_id = p_tenant_id
      AND ft.status = 'POSTED'
      AND ft.accounting_date <= p_as_of  -- ← CHANGED from posted_at
    -- ...
END;
$$ LANGUAGE plpgsql;
```

**Business Impact:**

```typescript
// Query: "Show me books as of 2026-12-31"
const journal = await f5.getJournalEntries(tenantId, new Date('2026-12-31'));

// Before (WRONG): Returns transactions where posted_at <= 2026-12-31
//   → Includes T1 recorded in Dec but recognized in Jan (WRONG)
//   → Excludes T2 recorded in Jan but recognized in Dec (WRONG)

// After (CORRECT): Returns transactions where accounting_date <= 2026-12-31
//   → Includes T2 recognized in Dec (recorded later) ✅
//   → Excludes T1 recognized in Jan (recorded earlier) ✅
```

**Use `posted_at` For:**
- Audit trail: "When was this entry recorded?"
- Debugging: "What order were transactions posted?"
- Replication: Event ordering in change streams

**Use `accounting_date` For:**
- Financial reports: "Books as of date"
- Period closing: "Transactions in December period"
- Compliance: TT99/VAS reporting

---

## TIMEZONE STRATEGY

### Storage Timezone

**Decision:** Store all dates in **UTC** at database level.

**Rationale:**
- Consistent storage (no ambiguity)
- PostgreSQL `TIMESTAMPTZ` handles conversion automatically
- Application layer handles display timezone

### Field-Specific Rules

| Field | Storage Type | Storage Timezone | Display Timezone |
|-------|--------------|------------------|------------------|
| **document_date** | DATE or TIMESTAMPTZ | UTC (if TIMESTAMPTZ) | Business event timezone |
| **accounting_date** | DATE | N/A (no timezone) | Company accounting timezone |
| **posted_at** | TIMESTAMPTZ | UTC | UTC or tenant timezone |

### document_date Timezone

**Option A: DATE (no time component)**

```sql
document_date DATE NOT NULL
-- Stores: 2026-12-15 (no timezone)
-- Business semantic: "invoice issued on Dec 15"
```

**Pros:**
- Simple (no timezone ambiguity)
- Matches physical document (invoice date has no time)
- Adequate for most business events

**Cons:**
- Loses time-of-day information (if needed)

**Option B: TIMESTAMPTZ (with time + timezone)**

```sql
document_date TIMESTAMPTZ NOT NULL
-- Stores: 2026-12-15T14:30:00+07:00 → stored as UTC internally
-- Business semantic: "invoice issued at 2:30 PM Hanoi time"
```

**Pros:**
- Preserves time-of-day (useful for payments, contracts)
- Timezone-aware (can convert for display)

**Cons:**
- More complex (timezone conversions)
- Overkill if time-of-day not needed

**Recommendation:** **Use DATE for document_date** (simpler, matches business documents)

### accounting_date Timezone

**Decision:** Use **DATE** (no timezone)

```sql
accounting_date DATE NOT NULL
-- Stores: 2026-12-31 (no timezone)
-- Semantic: "belongs to December 2026 period"
```

**Rationale:**
- Accounting periods are calendar dates (no time component)
- TT99/VAS uses dates, not timestamps
- Simpler period assignment logic

### posted_at Timezone

**Decision:** Use **TIMESTAMPTZ** stored in **UTC**

```sql
posted_at TIMESTAMPTZ
-- Stores: 2027-01-05T08:30:00Z (UTC)
-- Display: Convert to tenant timezone if needed
```

**Rationale:**
- Audit trail needs precision (exact moment of posting)
- UTC avoids DST ambiguity
- Application converts to tenant timezone for display

### Timezone Conversion Rules

**Database Layer:**

```sql
-- Store in UTC (automatic with TIMESTAMPTZ)
INSERT INTO finance_transactions (posted_at)
VALUES (NOW());  -- ← Stored as UTC internally
```

**Application Layer:**

```typescript
// Display in tenant timezone
const tenantTimezone = 'Asia/Ho_Chi_Minh';  // Vietnam

const postedAtUTC = transaction.posted_at;  // UTC from database
const postedAtDisplay = postedAtUTC.toLocaleString('vi-VN', {
  timeZone: tenantTimezone
});
// Display: "05/01/2027, 15:30:00" (Vietnam time)
```

**Period Assignment:**

```typescript
// accounting_date is DATE (no timezone)
const accountingDate = '2026-12-31';

// Find period in company accounting timezone
const period = await findPeriodByDate(tenantId, accountingDate);
// Accounting periods use company timezone (e.g., Vietnam)
```

---

## CONTRACT SUMMARY TABLE

| Aspect | document_date | accounting_date | posted_at |
|--------|---------------|-----------------|-----------|
| **Represents** | Business event date | Accounting recognition date | System posting timestamp |
| **Vietnamese** | Ngày chứng từ | Ngày hạch toán | Thời điểm ghi sổ |
| **Authority** | Business event owner | Accountant | SYSTEM |
| **Type** | DATE | DATE | TIMESTAMPTZ |
| **Timezone** | N/A (calendar date) | N/A (calendar date) | UTC |
| **DRAFT** | NULLABLE, MUTABLE | NULLABLE, MUTABLE | NULL |
| **POSTED** | NOT NULL, IMMUTABLE | NOT NULL, MUTABLE* | NOT NULL, IMMUTABLE |
| **CLOSED** | NOT NULL, IMMUTABLE | NOT NULL, IMMUTABLE | NOT NULL, IMMUTABLE |
| **Backdating** | YES | YES (if period OPEN) | NO |
| **Future** | YES | YES | NO |
| **F2 Uses** | NO | YES (`effective_date = accounting_date`) | NO |
| **F5 Uses** | NO | YES (`WHERE accounting_date <= as_of`) | NO (audit only) |
| **TT99** | Designed to support | Designed to support | Not applicable |

**\*MUTABLE:** Until accounting period status = CLOSED

---

## NEXT STEPS (WITHIN PHASE 3)

1. ✅ **Phase 3.2 COMPLETE** — 3-Date semantic contract defined
2. 🔜 **Phase 3.3** — Map to TT99/VAS specific requirements
3. 🔜 **Phase 3.4** — Finalize nullability decision (NULLABLE vs NOT NULL for DRAFT)
4. 🔜 **Phase 3.5** — Design backfill policy (provable/inferable/unknowable)
5. 🔜 **Phase 3.6** — Create migration proposal (DDL, NOT executed)
6. 🔜 **Phase 3.7** — Human Architect review package

---

**Document Status:** ✅ APPROVED (with caveat correction applied)  
**Created:** 2026-08-24  
**Approved:** 2026-08-24  
**Phase:** 3.2 — Semantic Contract Design  
**Implementation:** ❌ BLOCKED (contract-first, schema later)  
**Caveat:** TT99/VAS compliance claims deferred to Phase 3.3 formal mapping
