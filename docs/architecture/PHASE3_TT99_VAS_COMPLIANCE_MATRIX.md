# PHASE 3.3 — TT99/VAS COMPLIANCE EVIDENCE MATRIX

**Date:** 2026-08-24  
**Status:** 🔵 IN PROGRESS (ANALYSIS ONLY — NO IMPLEMENTATION)  
**Mode:** COMPLIANCE MAPPING & VALIDATION DESIGN

---

## EXECUTIVE SUMMARY

**Objective:** Map TT99/VAS Vietnamese accounting requirements to Finance OS 3-date contract with complete evidence chains for validation.

**Approach:** Requirement → Accounting Concept → Finance OS Field → Lifecycle Rule → Validation Rule → Test Evidence

**Principle:** "Evidence-based compliance — not just field mapping, but provable validation chains."

---

## TT99/VAS REGULATORY CONTEXT

### Circular 99/2025/TT-BTC

**Issued:** October 27, 2025  
**Effective:** January 1, 2026  
**Applies to:** Fiscal years beginning on or after January 1, 2026

**Key Provisions:**
- Modernized Vietnamese Accounting Standards (VAS)
- Aligns with IFRS principles (preparation for VFRS)
- Simplifies documentation requirements (removed ink color, copy mandates)
- Maintains double-entry bookkeeping (bút toán kép)
- Requires temporal tracking (document date, accounting date, posting date)

### Compliance Scope

**Finance OS Target:** Support TT99 accounting semantics for Vietnamese enterprises

**Important Distinctions:**
- TT99 defines **accounting concepts** (ngày chứng từ, ngày hạch toán)
- Finance OS implements **database schema** to support these concepts
- Compliance = Finance OS fields + lifecycle rules enable TT99-compliant accounting practices

**Not in Scope:**
- Document management system (chứng từ storage)
- Chart of accounts enforcement (tenant-specific)
- Regulatory reporting formats (separate module)

---

## COMPLIANCE EVIDENCE MATRIX

### Matrix Structure

```
TT99 Requirement
        ↓
Accounting Concept (Vietnamese term + English)
        ↓
Finance OS Field Mapping
        ↓
Lifecycle Rule (when set, when immutable)
        ↓
Validation Rule (database constraint + application logic)
        ↓
Test Evidence (how to prove compliance)
```

---

## REQUIREMENT 1: DOCUMENT DATE TRACKING

### TT99 Requirement

**Vietnamese:** Ngày chứng từ (Document Date)

**Regulation:** Every accounting entry must reference a source document (chứng từ gốc) with a document date.

**Purpose:** Establish when the underlying business event occurred or when the document was issued.

**Examples:**
- Invoice: Issue date printed on invoice
- Payment receipt: Date of payment
- Contract: Signing date or effective date
- Delivery note: Shipment date

### Accounting Concept Mapping

| Concept | Definition | TT99 Article | Finance OS Mapping |
|---------|------------|--------------|-------------------|
| **Ngày chứng từ** | Date on source document | Source Document Requirements | `finance_transactions.document_date` |
| **Document immutability** | Cannot alter historical documents | Audit Trail | `document_date` IMMUTABLE after POSTED |
| **Legal authority** | Must match physical/digital document | Document Integrity | Authority: Business event owner |

### Finance OS Field Mapping

**Field:** `finance_transactions.document_date`

**Type:** `DATE`

**Semantic:** Date when the underlying business event occurred or the document was issued.

**Authority:** Business event owner (invoice issuer, payment receiver, contract signer)

**Source:** External document, business transaction, contract

### Lifecycle Rules

| Transaction Status | document_date Mutability | Nullability | Rationale |
|--------------------|-------------------------|-------------|-----------|
| **DRAFT** | MUTABLE | NULLABLE | Document may not be finalized yet |
| **POSTED** | IMMUTABLE | NOT NULL | Entry confirmed, document date locked |
| **REVERSED** | IMMUTABLE | NOT NULL | Audit trail preservation |
| **VOIDED** | IMMUTABLE | NOT NULL | Audit trail preservation |

**Immutability Trigger:**

```sql
-- Enforce document_date immutability after POSTED
CREATE TRIGGER trg_f1_document_date_immutability
BEFORE UPDATE ON finance_transactions
FOR EACH ROW
WHEN (OLD.status IN ('POSTED', 'REVERSED', 'VOIDED'))
EXECUTE FUNCTION f1_document_date_immutability_guard();
```

### Validation Rules

**V1.1: Document date required for POSTED transactions**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_document_date_required_posted
CHECK (
  (status = 'DRAFT') OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND document_date IS NOT NULL)
);
```

**V1.2: Document date cannot change after POSTED**

```sql
CREATE OR REPLACE FUNCTION f1_document_date_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_date IS DISTINCT FROM OLD.document_date THEN
    RAISE EXCEPTION 'TT99_COMPLIANCE_VIOLATION: document_date is immutable after status = POSTED (Ngày chứng từ không được thay đổi sau khi ghi sổ)'
      USING ERRCODE = 'TT001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**V1.3: Document date must be reasonable (not far future)**

```sql
-- Application-level validation
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_document_date_reasonable
CHECK (
  document_date <= CURRENT_DATE + INTERVAL '365 days'
);
```

### Test Evidence

**Test T1.1: Document date immutability**

```typescript
test('TT99-T1.1: document_date immutable after POSTED', async () => {
  // Step 1: Create and post transaction
  const tx = await ledger.postTransaction({
    document_date: new Date('2026-12-15'),
    accounting_date: new Date('2026-12-31'),
    status: 'POSTED',
    // ...
  });
  
  // Step 2: Attempt to modify document_date (should fail)
  await expect(
    supabase.from('finance_transactions')
      .update({ document_date: '2026-12-20' })
      .eq('id', tx.id)
  ).rejects.toThrow('TT99_COMPLIANCE_VIOLATION');
  
  // Evidence: document_date remains unchanged
  const { data } = await supabase
    .from('finance_transactions')
    .select('document_date')
    .eq('id', tx.id)
    .single();
  
  expect(data.document_date).toBe('2026-12-15');
});
```

**Test T1.2: Document date required for POSTED**

```typescript
test('TT99-T1.2: document_date required when POSTED', async () => {
  // Attempt to post transaction without document_date (should fail)
  await expect(
    ledger.postTransaction({
      document_date: null,  // ❌ Missing
      accounting_date: new Date('2026-12-31'),
      status: 'POSTED',
      // ...
    })
  ).rejects.toThrow('document_date required');
});
```

### Compliance Evidence Chain

```
TT99 Requirement: Ngày chứng từ
        ↓
Finance OS Field: document_date (DATE, NOT NULL when POSTED)
        ↓
Lifecycle Rule: Immutable after POSTED
        ↓
Database Constraint: CHECK + TRIGGER
        ↓
Test Evidence: T1.1 (immutability), T1.2 (NOT NULL)
        ↓
✅ COMPLIANCE SUPPORTED
```

---

## REQUIREMENT 2: ACCOUNTING DATE / PERIOD ASSIGNMENT

### TT99 Requirement

**Vietnamese:** Ngày hạch toán (Accounting Date / Posting Date)

**Regulation:** Transaction must be assigned to the correct accounting period (kỳ kế toán). The accounting date determines which fiscal period the transaction belongs to.

**Purpose:** 
- Determine which accounting period includes this transaction
- Enable period closing and financial statement generation
- Prevent backdating into closed periods

**Critical Rule:** `accounting_date` determines period, NOT `document_date` or system timestamp.

### Accounting Concept Mapping

| Concept | Definition | TT99 Article | Finance OS Mapping |
|---------|------------|--------------|-------------------|
| **Ngày hạch toán** | Date transaction is recognized in accounting books | Accounting Period | `finance_transactions.accounting_date` |
| **Kỳ kế toán** | Fiscal period for reporting | Period Closing | Linked via `accounting_period_id` |
| **Period assignment** | Transaction must belong to correct period | Period Rules | `accounting_date` within period bounds |
| **Period closing** | Transactions cannot be added/modified after close | Book Closing | `accounting_date` immutable after period CLOSED |

### Finance OS Field Mapping

**Field:** `finance_transactions.accounting_date`

**Type:** `DATE`

**Semantic:** Date when the transaction is recognized in the accounting books, determining which accounting period it belongs to.

**Authority:** Accountant / accounting department (or defaults to `document_date`)

**Source:** Accounting policy, recognition rules, period assignment

### Lifecycle Rules

| Transaction Status | accounting_date Mutability | Period Status | Rationale |
|--------------------|---------------------------|---------------|-----------|
| **DRAFT** | MUTABLE | N/A | Period not yet assigned |
| **POSTED** | MUTABLE | OPEN | Accountant can adjust before period close |
| **POSTED** | IMMUTABLE | CLOSED | Period locked, books finalized |
| **REVERSED** | IMMUTABLE | Any | Audit trail preservation |
| **VOIDED** | IMMUTABLE | Any | Audit trail preservation |

**Critical Distinction:**
- `document_date` immutable after POSTED (document cannot change)
- `accounting_date` mutable until period CLOSED (accountant can adjust recognition)

### Validation Rules

**V2.1: Accounting date required for POSTED transactions**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_accounting_date_required_posted
CHECK (
  (status = 'DRAFT') OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND accounting_date IS NOT NULL)
);
```

**V2.2: Accounting date must fall within assigned period**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_accounting_date_in_period
CHECK (
  accounting_date >= (
    SELECT period_start FROM finance_accounting_periods 
    WHERE id = accounting_period_id
  ) AND accounting_date <= (
    SELECT period_end FROM finance_accounting_periods 
    WHERE id = accounting_period_id
  )
);
```

**V2.3: Accounting date cannot change after period CLOSED**

```sql
CREATE OR REPLACE FUNCTION f1_accounting_date_period_lock_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_period_status VARCHAR;
BEGIN
  -- Check if accounting_date changed
  IF NEW.accounting_date IS DISTINCT FROM OLD.accounting_date THEN
    -- Check period status
    SELECT status INTO v_period_status
    FROM finance_accounting_periods
    WHERE id = OLD.accounting_period_id;
    
    IF v_period_status IN ('CLOSED', 'LOCKED') THEN
      RAISE EXCEPTION 'TT99_COMPLIANCE_VIOLATION: accounting_date cannot be modified after period CLOSED (Không được sửa ngày hạch toán sau khi đóng kỳ kế toán)'
        USING ERRCODE = 'TT002';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_f1_accounting_date_period_lock
BEFORE UPDATE ON finance_transactions
FOR EACH ROW
WHEN (OLD.status IN ('POSTED', 'REVERSED', 'VOIDED'))
EXECUTE FUNCTION f1_accounting_date_period_lock_guard();
```

**V2.4: Cannot post to closed period**

```sql
-- Application-level validation (before INSERT/UPDATE)
async function validateAccountingPeriod(
  accountingDate: Date,
  tenantId: string
): Promise<void> {
  const period = await findPeriodByDate(tenantId, accountingDate);
  
  if (!period) {
    throw new Error('TT99_COMPLIANCE_VIOLATION: No accounting period exists for this date');
  }
  
  if (period.status === 'CLOSED' || period.status === 'LOCKED') {
    throw new Error(
      `TT99_COMPLIANCE_VIOLATION: Cannot post to closed period ${period.name} ` +
      `(Không được ghi sổ vào kỳ kế toán đã đóng)`
    );
  }
}
```

### Test Evidence

**Test T2.1: Accounting date determines period**

```typescript
test('TT99-T2.1: accounting_date determines period assignment', async () => {
  // December period: 2026-12-01 to 2026-12-31
  const decPeriod = await createPeriod({
    name: '2026-12',
    start: '2026-12-01',
    end: '2026-12-31',
    status: 'OPEN'
  });
  
  // Transaction with document_date in Dec, accounting_date in Jan
  const tx = await ledger.postTransaction({
    document_date: new Date('2026-12-31'),  // Document: December
    accounting_date: new Date('2027-01-15'), // Recognition: January
    // ...
  });
  
  // Evidence: Transaction belongs to JANUARY period (via accounting_date)
  const { data } = await supabase
    .from('finance_transactions')
    .select('accounting_period_id')
    .eq('id', tx.id)
    .single();
  
  expect(data.accounting_period_id).not.toBe(decPeriod.id);  // NOT December
  // Should be January period (via accounting_date)
});
```

**Test T2.2: accounting_date immutable after period CLOSED**

```typescript
test('TT99-T2.2: accounting_date immutable after period CLOSED', async () => {
  // Step 1: Post transaction in December
  const tx = await ledger.postTransaction({
    accounting_date: new Date('2026-12-15'),
    // ...
  });
  
  // Step 2: Close December period
  await closePeriod('2026-12');
  
  // Step 3: Attempt to change accounting_date (should fail)
  await expect(
    supabase.from('finance_transactions')
      .update({ accounting_date: '2026-12-20' })
      .eq('id', tx.id)
  ).rejects.toThrow('TT99_COMPLIANCE_VIOLATION');
});
```

**Test T2.3: Cannot post to closed period**

```typescript
test('TT99-T2.3: Cannot post transaction to closed period', async () => {
  // Step 1: Close December period
  await closePeriod('2026-12');
  
  // Step 2: Attempt to post transaction in December (should fail)
  await expect(
    ledger.postTransaction({
      accounting_date: new Date('2026-12-25'),  // Closed period
      // ...
    })
  ).rejects.toThrow('Cannot post to closed period');
});
```

### Compliance Evidence Chain

```
TT99 Requirement: Ngày hạch toán + Kỳ kế toán
        ↓
Finance OS Field: accounting_date (DATE, NOT NULL when POSTED)
        ↓
Period Assignment: accounting_date determines period (NOT document_date)
        ↓
Lifecycle Rule: Mutable until period CLOSED, then immutable
        ↓
Database Constraint: CHECK + TRIGGER (period lock)
        ↓
Test Evidence: T2.1 (period assignment), T2.2 (immutability), T2.3 (closed period block)
        ↓
✅ COMPLIANCE SUPPORTED
```

---

## REQUIREMENT 3: POSTING DATE / AUDIT TRAIL

### TT99 Requirement

**Vietnamese:** Ngày ghi sổ (Posting Date / Ledger Recording Date)

**Regulation:** Accounting system must maintain audit trail of when entries were recorded in the ledger.

**Purpose:**
- Audit trail: When was this entry recorded?
- Temporal ordering: Which entry was recorded first?
- Compliance verification: Ensure entries were made in timely manner

**Note:** This is NOT the same as `accounting_date`. Posting date is a system timestamp for audit purposes.

### Accounting Concept Mapping

| Concept | Definition | TT99 Article | Finance OS Mapping |
|---------|------------|--------------|-------------------|
| **Ngày ghi sổ** | Date entry was recorded in ledger | Audit Trail | `finance_transactions.posted_at` |
| **Audit trail** | Immutable record of system actions | Internal Control | `posted_at` generated by system |
| **Temporal ordering** | Which entries were recorded first | System Log | `posted_at` timestamp ordering |

### Finance OS Field Mapping

**Field:** `finance_transactions.posted_at`

**Type:** `TIMESTAMPTZ` (timestamp with timezone)

**Semantic:** System timestamp when the transaction was posted to the ledger (status changed to POSTED).

**Authority:** SYSTEM (not user-supplied)

**Source:** Database server `NOW()` at posting time

### Lifecycle Rules

| Transaction Status | posted_at Value | Mutability | Rationale |
|--------------------|----------------|------------|-----------|
| **DRAFT** | NULL | N/A | Not yet posted |
| **POSTED** | TIMESTAMPTZ (UTC) | IMMUTABLE | System-generated, audit trail |
| **REVERSED** | TIMESTAMPTZ (UTC) | IMMUTABLE | Audit trail preservation |
| **VOIDED** | TIMESTAMPTZ (UTC) | IMMUTABLE | Audit trail preservation |

**Authority Enforcement:**

```sql
-- Trigger: System sets posted_at automatically when status → POSTED
CREATE TRIGGER trg_f1_posted_at_auto_set
BEFORE INSERT OR UPDATE ON finance_transactions
FOR EACH ROW
EXECUTE FUNCTION f1_posted_at_auto_set();

CREATE OR REPLACE FUNCTION f1_posted_at_auto_set()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to POSTED, set posted_at = NOW()
  IF NEW.status = 'POSTED' AND OLD.status != 'POSTED' THEN
    NEW.posted_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Validation Rules

**V3.1: posted_at required for POSTED transactions**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_posted_at_required_posted
CHECK (
  (status = 'DRAFT' AND posted_at IS NULL) OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND posted_at IS NOT NULL)
);
```

**V3.2: posted_at is always immutable**

```sql
CREATE OR REPLACE FUNCTION f1_posted_at_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.posted_at IS DISTINCT FROM OLD.posted_at THEN
    RAISE EXCEPTION 'TT99_AUDIT_VIOLATION: posted_at is system-generated and immutable (Thời điểm ghi sổ do hệ thống tạo và không được thay đổi)'
      USING ERRCODE = 'TT003';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_f1_posted_at_immutability
BEFORE UPDATE ON finance_transactions
FOR EACH ROW
WHEN (OLD.posted_at IS NOT NULL)
EXECUTE FUNCTION f1_posted_at_immutability_guard();
```

**V3.3: posted_at must be in UTC**

```sql
-- Automatic via TIMESTAMPTZ storage
-- PostgreSQL stores all TIMESTAMPTZ in UTC internally
```

### Test Evidence

**Test T3.1: posted_at generated by system**

```typescript
test('TT99-T3.1: posted_at generated by system when POSTED', async () => {
  const beforePost = new Date();
  
  // Post transaction (posted_at should be set by system)
  const tx = await ledger.postTransaction({
    document_date: new Date('2026-12-15'),
    accounting_date: new Date('2026-12-31'),
    // posted_at NOT provided by caller
    // ...
  });
  
  const afterPost = new Date();
  
  // Evidence: posted_at was set automatically
  expect(tx.posted_at).toBeDefined();
  expect(tx.posted_at.getTime()).toBeGreaterThanOrEqual(beforePost.getTime());
  expect(tx.posted_at.getTime()).toBeLessThanOrEqual(afterPost.getTime());
});
```

**Test T3.2: posted_at immutable**

```typescript
test('TT99-T3.2: posted_at immutable (cannot be modified)', async () => {
  const tx = await ledger.postTransaction({
    accounting_date: new Date('2026-12-31'),
    // ...
  });
  
  const originalPostedAt = tx.posted_at;
  
  // Attempt to modify posted_at (should fail)
  await expect(
    supabase.from('finance_transactions')
      .update({ posted_at: new Date('2026-12-20T00:00:00Z') })
      .eq('id', tx.id)
  ).rejects.toThrow('TT99_AUDIT_VIOLATION');
  
  // Evidence: posted_at unchanged
  const { data } = await supabase
    .from('finance_transactions')
    .select('posted_at')
    .eq('id', tx.id)
    .single();
  
  expect(data.posted_at).toEqual(originalPostedAt);
});
```

**Test T3.3: posted_at NULL for DRAFT**

```typescript
test('TT99-T3.3: posted_at NULL for DRAFT transactions', async () => {
  // Create DRAFT transaction
  const { data: draft } = await supabase
    .from('finance_transactions')
    .insert({
      status: 'DRAFT',
      posted_at: null,  // Must be NULL
      // ...
    })
    .single();
  
  expect(draft.posted_at).toBeNull();
});
```

### Compliance Evidence Chain

```
TT99 Requirement: Ngày ghi sổ (Audit Trail)
        ↓
Finance OS Field: posted_at (TIMESTAMPTZ, system-generated)
        ↓
Authority: SYSTEM (not user)
        ↓
Lifecycle Rule: Set when status → POSTED, always immutable
        ↓
Database Constraint: TRIGGER (auto-set) + TRIGGER (immutability)
        ↓
Test Evidence: T3.1 (system-generated), T3.2 (immutability), T3.3 (NULL for DRAFT)
        ↓
✅ COMPLIANCE SUPPORTED
```

---

## REQUIREMENT 4: DOUBLE-ENTRY BOOKKEEPING

### TT99 Requirement

**Vietnamese:** Bút toán kép (Double-Entry Accounting)

**Regulation:** Every transaction must have balanced debit (Nợ) and credit (Có) entries.

**Purpose:** Maintain accounting equation: Assets = Liabilities + Equity

### Validation Rules

**V4.1: Transaction must have at least one debit and one credit line**

```sql
CREATE OR REPLACE FUNCTION f1_transaction_has_balanced_lines()
RETURNS TRIGGER AS $$
DECLARE
  v_debit_count INTEGER;
  v_credit_count INTEGER;
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Count debit and credit lines
  SELECT 
    COUNT(CASE WHEN debit_amount > 0 THEN 1 END),
    COUNT(CASE WHEN credit_amount > 0 THEN 1 END),
    SUM(debit_functional_amount),
    SUM(credit_functional_amount)
  INTO v_debit_count, v_credit_count, v_total_debit, v_total_credit
  FROM finance_transaction_lines
  WHERE transaction_id = NEW.id;
  
  -- Must have at least one debit and one credit
  IF v_debit_count = 0 OR v_credit_count = 0 THEN
    RAISE EXCEPTION 'TT99_COMPLIANCE_VIOLATION: Transaction must have at least one debit and one credit line (Bút toán kép: phải có cả Nợ và Có)'
      USING ERRCODE = 'TT004';
  END IF;
  
  -- Debit must equal Credit
  IF v_total_debit != v_total_credit THEN
    RAISE EXCEPTION 'TT99_COMPLIANCE_VIOLATION: Debit (%) must equal Credit (%) (Nợ phải bằng Có)'
      USING ERRCODE = 'TT005',
            DETAIL = format('Debit: %s, Credit: %s', v_total_debit, v_total_credit);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Test Evidence

**Test T4.1: Balanced debit/credit**

```typescript
test('TT99-T4.1: Transaction must have balanced debit/credit', async () => {
  await expect(
    ledger.postTransaction({
      lines: [
        { account: '111', debit: 1000000, credit: 0 },      // Debit only
        { account: '511', debit: 0, credit: 900000 },       // Credit (unbalanced!)
      ]
    })
  ).rejects.toThrow('Debit must equal Credit');
});
```

### Compliance Evidence Chain

```
TT99 Requirement: Bút toán kép (Double-Entry)
        ↓
Finance OS: finance_transaction_lines (debit/credit)
        ↓
Validation Rule: SUM(debit) = SUM(credit)
        ↓
Database Constraint: TRIGGER on POSTED status
        ↓
Test Evidence: T4.1 (balanced requirement)
        ↓
✅ COMPLIANCE SUPPORTED
```

---

## NON-TT99 FIELDS

### Fields NOT Required by TT99

The following Finance OS fields serve **internal governance** or **architectural** purposes, but are NOT mandated by TT99 regulations:

| Field | Purpose | Category |
|-------|---------|----------|
| **posted_at** | System audit trail | Internal control (useful but not TT99 mandate) |
| **recorded_by** | User who created entry | Bella governance (not TT99 database mandate) |
| **approved_by** | User who approved entry | Bella governance (not TT99 database mandate) |
| **idempotency_key** | Prevent duplicate submissions | System reliability (not TT99 mandate) |
| **request_hash** | Detect malicious replay | System security (not TT99 mandate) |

**Rationale:**

TT99 requires **source documents** (chứng từ) to have:
- Document number (số chứng từ)
- Parties involved (người lập, người duyệt)

But TT99 does NOT mandate these as **database columns**. They can be stored:
- In document management system
- In application metadata
- In referenced documents

**Finance OS Decision:** Implement `recorded_by` / `approved_by` for **auditability** and **internal control**, but acknowledge these are Bella governance enhancements, not TT99 database mandates.

---

## COMPLIANCE SUMMARY TABLE

| TT99 Requirement | Vietnamese Term | Finance OS Field | Lifecycle Rule | Validation | Test Evidence |
|------------------|-----------------|------------------|----------------|------------|---------------|
| **Document Date** | Ngày chứng từ | `document_date` (DATE) | Immutable after POSTED | V1.1, V1.2, V1.3 | T1.1, T1.2 |
| **Accounting Date** | Ngày hạch toán | `accounting_date` (DATE) | Mutable until period CLOSED | V2.1, V2.2, V2.3, V2.4 | T2.1, T2.2, T2.3 |
| **Posting Date** | Ngày ghi sổ | `posted_at` (TIMESTAMPTZ) | System-generated, immutable | V3.1, V3.2, V3.3 | T3.1, T3.2, T3.3 |
| **Double-Entry** | Bút toán kép | `finance_transaction_lines` | Balanced debit=credit | V4.1 | T4.1 |
| **Accounting Period** | Kỳ kế toán | `accounting_period_id` | Links via accounting_date | V2.2, V2.3, V2.4 | T2.1, T2.3 |

---

## F2 CASH TEMPORAL LINEAGE (CORRECTED)

### TT99 Implication for F2

**Question:** Which F1 date should F2 `effective_date` inherit?

**Answer:** `accounting_date` (NOT `posted_at`)

**Rationale:**

| Date | F2 Semantic Match | TT99 Compliance |
|------|-------------------|-----------------|
| `document_date` | ❌ Cash movement ≠ document date | ❌ |
| `accounting_date` | ✅ When cash is effective for accounting | ✅ |
| `posted_at` | ❌ System timestamp, not accounting date | ❌ |

**Corrected Invariant:**

```
INV-F2-T1 (CORRECTED):
  F2.effective_date = F1.accounting_date (at projection time)
  
NOT:
  F2.effective_date = F1.posted_at (WRONG — system timestamp)
```

**TT99 Alignment:**

Cash position as of date = transactions where `accounting_date <= as_of`

This matches TT99 accounting period concept: "Show me cash position as of 2026-12-31" means transactions with `accounting_date` in December period or earlier.

---

## F5 TEMPORAL FILTER (CORRECTED)

### TT99 Implication for F5

**Question:** Which F1 date should F5 use for `as_of` filtering?

**Answer:** `accounting_date` (NOT `posted_at`)

**Rationale:**

| Use Case | Correct Date | TT99 Compliance |
|----------|--------------|-----------------|
| "Books as of 2026-12-31" | `accounting_date` | ✅ |
| "December period report" | `accounting_date` | ✅ |
| "When was entry recorded?" | `posted_at` | Audit only |

**Corrected F5 Contract:**

```sql
CREATE OR REPLACE FUNCTION finance_journal_entries_as_of(
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ft.accounting_date AS posting_date,  -- ← CHANGED from posted_at
    -- ...
  FROM finance_transactions ft
  WHERE ft.status = 'POSTED'
    AND ft.accounting_date <= p_as_of  -- ← CHANGED from posted_at
  -- ...
END;
$$ LANGUAGE plpgsql;
```

**TT99 Alignment:**

Financial statements for period ending 2026-12-31 = transactions where `accounting_date` in December or earlier.

This is the TT99 definition of accounting period (kỳ kế toán).

---

## VALIDATION TEST SUITE SPECIFICATION

### Test Suite Structure

```
TT99 Compliance Test Suite
│
├── T1: Document Date (Ngày chứng từ)
│   ├── T1.1: Immutability after POSTED
│   └── T1.2: Required for POSTED
│
├── T2: Accounting Date (Ngày hạch toán)
│   ├── T2.1: Determines period assignment
│   ├── T2.2: Immutable after period CLOSED
│   └── T2.3: Cannot post to closed period
│
├── T3: Posting Date (Ngày ghi sổ)
│   ├── T3.1: System-generated
│   ├── T3.2: Immutability
│   └── T3.3: NULL for DRAFT
│
└── T4: Double-Entry (Bút toán kép)
    └── T4.1: Balanced debit/credit
```

### Test Implementation Location

**File:** `src/platform/finance/__tests__/tt99-compliance.test.ts`

**Structure:**

```typescript
describe('TT99/VAS Compliance Test Suite', () => {
  describe('T1: Document Date (Ngày chứng từ)', () => {
    test('T1.1: document_date immutable after POSTED', async () => { /* ... */ });
    test('T1.2: document_date required for POSTED', async () => { /* ... */ });
  });
  
  describe('T2: Accounting Date (Ngày hạch toán)', () => {
    test('T2.1: accounting_date determines period', async () => { /* ... */ });
    test('T2.2: accounting_date immutable after period CLOSED', async () => { /* ... */ });
    test('T2.3: Cannot post to closed period', async () => { /* ... */ });
  });
  
  // ... T3, T4
});
```

---

## NEXT STEPS (WITHIN PHASE 3)

1. ✅ **Phase 3.3 COMPLETE** — TT99/VAS compliance matrix created
2. 🔜 **Phase 3.4** — Finalize nullability decision
3. 🔜 **Phase 3.5** — Design backfill policy
4. 🔜 **Phase 3.6** — Create migration proposal (DDL)
5. 🔜 **Phase 3.7** — Human Architect review package

---

**Document Status:** ✅ APPROVED (Compliance Evidence Design)  
**Created:** 2026-08-24  
**Approved:** 2026-08-24  
**Phase:** 3.3 — TT99/VAS Compliance Evidence Matrix  
**Implementation:** ❌ BLOCKED (design complete, implementation pending)  
**Test Suite:** Specified (not yet implemented)  
**Important:** This document proves Finance OS is **designed to support** TT99/VAS semantics. Actual compliance will be proven after implementation + automated tests + production evidence.
