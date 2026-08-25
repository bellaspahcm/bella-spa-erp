# PHASE 3.4 — NULLABILITY DECISION

**Date:** 2026-08-24  
**Status:** 🔵 IN PROGRESS (ANALYSIS ONLY — NO IMPLEMENTATION)  
**Mode:** LIFECYCLE-BASED NULLABILITY DESIGN

---

## EXECUTIVE SUMMARY

**Objective:** Define NULL vs NOT NULL strategy for F1 date fields based on lifecycle states, distinguishing database invariants from domain lifecycle invariants.

**Approach:** Not just "NULL or NOT NULL" — answer when NULL is allowed, when required, and who enforces the rule (database vs application).

**Principle:** "Right constraint at right layer — database for data integrity, application for business logic."

---

## NULLABILITY BY LIFECYCLE STATE

### State-Based Nullability Matrix

| Field | DRAFT | POSTED | REVERSED | VOIDED | CLOSED PERIOD |
|-------|-------|--------|----------|--------|---------------|
| **document_date** | NULLABLE | NOT NULL | NOT NULL | NOT NULL | NOT NULL |
| **accounting_date** | NULLABLE | NOT NULL | NOT NULL | NOT NULL | NOT NULL |
| **posted_at** | NULL (required) | NOT NULL | NOT NULL | NOT NULL | NOT NULL |

**Key Insight:** All dates NULLABLE during DRAFT (flexible workflow), but NOT NULL once POSTED (accounting integrity).

---

## FIELD 1: `document_date` NULLABILITY

### Decision: NULLABLE in Schema, Enforced by Lifecycle

**Schema Definition:**

```sql
ALTER TABLE finance_transactions
ADD COLUMN document_date DATE;  -- NULLABLE (no NOT NULL constraint)
```

**Rationale:** Allow flexibility during transaction drafting.

### Nullability by State

| State | Nullability | Enforcement | Rationale |
|-------|-------------|-------------|-----------|
| **DRAFT** | NULLABLE | Application | Document may not be finalized yet |
| **POSTED** | NOT NULL (enforced) | Database CHECK | Cannot post without document date |
| **REVERSED** | NOT NULL (immutable) | Database TRIGGER | Original document_date preserved |
| **VOIDED** | NOT NULL (immutable) | Database TRIGGER | Original document_date preserved |

### Enforcement Strategy

**Layer 1: Database CHECK Constraint**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_document_date_required_when_posted
CHECK (
  (status = 'DRAFT') OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND document_date IS NOT NULL)
);
```

**Layer 2: Application Validation (LedgerService)**

```typescript
// In LedgerService.postTransaction()
async postTransaction(req: PostTransactionRequest): Promise<FinancialTransaction> {
  // Validate document_date presence before posting
  if (!req.document_date) {
    throw new FinanceError(
      'DOCUMENT_DATE_REQUIRED',
      'document_date is required for posting transaction (Ngày chứng từ bắt buộc)'
    );
  }
  
  // ... proceed with posting
}
```

### Use Cases

**Use Case 1: Draft with unknown document date**

```typescript
// User starts creating transaction, document not finalized yet
const draft = await supabase.from('finance_transactions').insert({
  status: 'DRAFT',
  document_date: null,  // ✅ Allowed during draft
  // ...
});
```

**Use Case 2: Update document_date before posting**

```typescript
// User finalizes document, sets document_date
await supabase.from('finance_transactions')
  .update({ document_date: '2026-12-15' })
  .eq('id', draft.id);
```

**Use Case 3: Post transaction (document_date required)**

```typescript
// Posting requires document_date
await ledger.postTransaction({
  document_date: new Date('2026-12-15'),  // ✅ Required
  accounting_date: new Date('2026-12-31'),
  status: 'POSTED',
  // ...
});

// ❌ This fails:
await ledger.postTransaction({
  document_date: null,  // ❌ Not allowed for POSTED
  status: 'POSTED',
});
// Error: DOCUMENT_DATE_REQUIRED
```

### Authority Boundary

**Who provides `document_date`?**

```
Business Event Owner (Invoice Issuer, Payment Receiver)
        ↓
Document (Invoice, Receipt, Contract)
        ↓
Document Date (Printed on Document)
        ↓
Application (LedgerService caller)
        ↓
LedgerService validates presence
        ↓
Database enforces CHECK constraint
        ↓
POSTED Transaction (document_date NOT NULL)
```

**Constraint Type:** Database + Application (dual enforcement)

---

## FIELD 2: `accounting_date` NULLABILITY

### Decision: NULLABLE in Schema, Enforced by Lifecycle + Default Strategy

**Schema Definition:**

```sql
ALTER TABLE finance_transactions
ADD COLUMN accounting_date DATE;  -- NULLABLE (no NOT NULL constraint)
```

**Rationale:** Allow flexibility during drafting + support default from `document_date`.

### Nullability by State

| State | Nullability | Default Behavior | Enforcement | Rationale |
|-------|-------------|------------------|-------------|-----------|
| **DRAFT** | NULLABLE | None | Application | Accountant may not decide period yet |
| **POSTED** | NOT NULL (enforced) | `= document_date` if not provided | Database CHECK + Application | Must assign to accounting period |
| **REVERSED** | NOT NULL (immutable) | N/A | Database TRIGGER | Original accounting_date preserved |
| **VOIDED** | NOT NULL (immutable) | N/A | Database TRIGGER | Original accounting_date preserved |
| **Period CLOSED** | NOT NULL (immutable) | N/A | Database TRIGGER | Cannot change after close |

### Enforcement Strategy

**Layer 1: Database CHECK Constraint**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_accounting_date_required_when_posted
CHECK (
  (status = 'DRAFT') OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND accounting_date IS NOT NULL)
);
```

**Layer 2: Application Default Logic**

```typescript
// In LedgerService.postTransaction()
async postTransaction(req: PostTransactionRequest): Promise<FinancialTransaction> {
  // Default: accounting_date = document_date if not explicitly provided
  const accountingDate = req.accounting_date ?? req.document_date;
  
  if (!accountingDate) {
    throw new FinanceError(
      'ACCOUNTING_DATE_REQUIRED',
      'accounting_date or document_date is required (Ngày hạch toán bắt buộc)'
    );
  }
  
  // Validate accounting period
  await validateAccountingPeriod(accountingDate, req.tenant_id);
  
  // ... proceed with posting using accountingDate
}
```

**Layer 3: Period Lock Enforcement (Application + Database)**

```sql
-- Database trigger: Prevent accounting_date change if period CLOSED
CREATE TRIGGER trg_accounting_date_period_lock
BEFORE UPDATE ON finance_transactions
FOR EACH ROW
WHEN (
  OLD.status IN ('POSTED', 'REVERSED', 'VOIDED') AND
  NEW.accounting_date IS DISTINCT FROM OLD.accounting_date
)
EXECUTE FUNCTION f1_accounting_date_period_lock_guard();

CREATE OR REPLACE FUNCTION f1_accounting_date_period_lock_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_period_status VARCHAR;
BEGIN
  SELECT status INTO v_period_status
  FROM finance_accounting_periods
  WHERE id = OLD.accounting_period_id;
  
  IF v_period_status IN ('CLOSED', 'LOCKED') THEN
    RAISE EXCEPTION 'PERIOD_CLOSED: Cannot modify accounting_date after period closed'
      USING ERRCODE = 'F1021';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Default Strategy

**Rule:** If caller does not provide `accounting_date`, default to `document_date` (cash basis accounting).

**Rationale:**
- Cash basis: Revenue/expense recognized when document issued → `accounting_date = document_date`
- Accrual basis: Accountant explicitly provides `accounting_date` (may differ from `document_date`)

**Example 1: Cash basis (implicit)**

```typescript
// Caller provides only document_date
await ledger.postTransaction({
  document_date: new Date('2026-12-15'),
  // accounting_date NOT provided
  // ...
});

// System defaults: accounting_date = document_date = 2026-12-15
```

**Example 2: Accrual basis (explicit)**

```typescript
// Caller explicitly provides accounting_date (differs from document_date)
await ledger.postTransaction({
  document_date: new Date('2026-12-31'),      // Invoice issued Dec 31
  accounting_date: new Date('2027-01-05'),    // Revenue recognized Jan 5
  // ...
});

// System uses explicit accounting_date = 2027-01-05
```

**Example 3: Accountant adjustment (after POSTED)**

```typescript
// Transaction already POSTED with accounting_date = 2026-12-31
const tx = await getTransaction(txId);

// Accountant adjusts period assignment (period still OPEN)
await supabase.from('finance_transactions')
  .update({ accounting_date: '2027-01-31' })  // Move to January
  .eq('id', txId);

// ✅ Allowed if January period status = OPEN
// ❌ Fails if January period status = CLOSED
```

### Authority Boundary

**Who provides `accounting_date`?**

```
Option A: Caller (Accountant)
        ↓
Explicit accounting_date provided
        ↓
LedgerService uses explicit value
        ↓
Database enforces CHECK + period lock

Option B: System Default
        ↓
accounting_date NOT provided
        ↓
LedgerService defaults to document_date
        ↓
Database enforces CHECK + period lock
```

**Constraint Type:** Database + Application (dual enforcement) + Default Logic

---

## FIELD 3: `posted_at` NULLABILITY

### Decision: NULL Required in DRAFT, System-Generated in POSTED

**Schema Definition:**

```sql
ALTER TABLE finance_transactions
ADD COLUMN posted_at TIMESTAMPTZ;  -- NULLABLE (no NOT NULL constraint)
```

**Rationale:** Must be NULL during DRAFT (not yet posted), system-generated when POSTED.

### Nullability by State

| State | Nullability | Value | Enforcement | Rationale |
|-------|-------------|-------|-------------|-----------|
| **DRAFT** | NULL (required) | NULL | Database CHECK | Transaction not yet posted |
| **POSTED** | NOT NULL (enforced) | System-generated UTC timestamp | Database TRIGGER + CHECK | System sets when status → POSTED |
| **REVERSED** | NOT NULL (immutable) | Original timestamp | Database TRIGGER | Audit trail preservation |
| **VOIDED** | NOT NULL (immutable) | Original timestamp | Database TRIGGER | Audit trail preservation |

### Enforcement Strategy

**Layer 1: Database CHECK Constraint**

```sql
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_posted_at_lifecycle
CHECK (
  (status = 'DRAFT' AND posted_at IS NULL) OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND posted_at IS NOT NULL)
);
```

**Layer 2: Database Auto-Set Trigger**

```sql
CREATE TRIGGER trg_posted_at_auto_set
BEFORE INSERT OR UPDATE ON finance_transactions
FOR EACH ROW
EXECUTE FUNCTION f1_posted_at_auto_set();

CREATE OR REPLACE FUNCTION f1_posted_at_auto_set()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set posted_at when status transitions to POSTED
  IF NEW.status = 'POSTED' AND (OLD IS NULL OR OLD.status != 'POSTED') THEN
    IF NEW.posted_at IS NOT NULL THEN
      RAISE EXCEPTION 'POSTED_AT_CANNOT_BE_USER_SUPPLIED: posted_at is system-generated (Thời điểm ghi sổ do hệ thống tạo)'
        USING ERRCODE = 'F1022';
    END IF;
    
    NEW.posted_at := NOW();  -- System-generated UTC timestamp
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Layer 3: Database Immutability Trigger**

```sql
CREATE TRIGGER trg_posted_at_immutability
BEFORE UPDATE ON finance_transactions
FOR EACH ROW
WHEN (OLD.posted_at IS NOT NULL)
EXECUTE FUNCTION f1_posted_at_immutability_guard();

CREATE OR REPLACE FUNCTION f1_posted_at_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.posted_at IS DISTINCT FROM OLD.posted_at THEN
    RAISE EXCEPTION 'POSTED_AT_IMMUTABLE: posted_at cannot be modified (Thời điểm ghi sổ không được thay đổi)'
      USING ERRCODE = 'F1023';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Layer 4: Application Validation**

```typescript
// In LedgerService.postTransaction()
async postTransaction(req: PostTransactionRequest): Promise<FinancialTransaction> {
  // Reject if caller attempts to provide posted_at
  if (req.posted_at !== undefined && req.posted_at !== null) {
    throw new FinanceError(
      'POSTED_AT_CANNOT_BE_USER_SUPPLIED',
      'posted_at is system-generated and cannot be provided by caller'
    );
  }
  
  // Database trigger will set posted_at = NOW() automatically
  // ...
}
```

### Authority Boundary

**Who provides `posted_at`?**

```
SYSTEM ONLY (not user)
        ↓
Database Trigger (on status → POSTED)
        ↓
posted_at = NOW() (UTC)
        ↓
Immutable (audit trail)
```

**Constraint Type:** Database-only (application rejects user-supplied values)

---

## CONSTRAINT CLASSIFICATION

### Database Invariants vs Domain Lifecycle Invariants

**Principle:** Choose the right layer for each constraint.

| Constraint Type | Layer | Examples | Enforcement |
|-----------------|-------|----------|-------------|
| **Database Invariant** | Schema | NOT NULL, UNIQUE, FK, CHECK (data integrity) | Database |
| **Domain Lifecycle Invariant** | Application | Lifecycle state transitions, period lock (before closed period check) | Application + Database |
| **Accounting Policy** | Application | Default accounting_date logic, recognition rules | Application only |

### Database Invariants (Schema Layer)

**Definition:** Constraints that enforce data integrity at storage level, independent of business logic.

**Examples:**

1. **Foreign Key Integrity**
   ```sql
   FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
   ```

2. **Lifecycle State Validity**
   ```sql
   CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'VOIDED'))
   ```

3. **Debit/Credit Balance**
   ```sql
   -- In finance_transaction_lines
   CHECK (NOT (debit_amount > 0 AND credit_amount > 0))
   ```

4. **Date Required When Posted**
   ```sql
   CHECK (
     (status = 'DRAFT') OR
     (status IN ('POSTED', 'REVERSED', 'VOIDED') AND 
      document_date IS NOT NULL AND 
      accounting_date IS NOT NULL)
   )
   ```

**Rationale:** These constraints protect data integrity regardless of how data is inserted (SQL, RPC, application).

### Domain Lifecycle Invariants (Application + Database Layer)

**Definition:** Constraints that enforce business logic based on lifecycle state, requiring context beyond row-level data.

**Examples:**

1. **Cannot Post to Closed Period**
   ```typescript
   // Application checks period status before allowing post
   const period = await findPeriodByDate(accountingDate, tenantId);
   if (period.status === 'CLOSED') {
     throw new Error('Cannot post to closed period');
   }
   ```
   
   ```sql
   -- Database trigger prevents accounting_date change if period CLOSED
   CREATE TRIGGER trg_accounting_date_period_lock ...
   ```

2. **Document Date Immutability After Posted**
   ```sql
   -- Database trigger (row-level check)
   CREATE TRIGGER trg_document_date_immutability
   BEFORE UPDATE ON finance_transactions
   FOR EACH ROW
   WHEN (OLD.status IN ('POSTED', 'REVERSED', 'VOIDED'))
   EXECUTE FUNCTION f1_document_date_immutability_guard();
   ```

3. **Double-Entry Balance Validation**
   ```typescript
   // Application validates before posting
   const debitTotal = lines.reduce((sum, l) => sum + l.debit, 0);
   const creditTotal = lines.reduce((sum, l) => sum + l.credit, 0);
   if (debitTotal !== creditTotal) {
     throw new Error('Debit must equal Credit');
   }
   ```
   
   ```sql
   -- Database trigger validates on status → POSTED
   CREATE TRIGGER trg_transaction_balanced ...
   ```

**Rationale:** These constraints require business context (period status, transaction status) and are enforced at both application (early validation) and database (final guard).

### Accounting Policy (Application Layer Only)

**Definition:** Business rules that determine values but do not enforce data integrity.

**Examples:**

1. **Default accounting_date from document_date**
   ```typescript
   // Application default logic
   const accountingDate = req.accounting_date ?? req.document_date;
   ```
   
   **Not database constraint** — this is policy, not integrity rule.

2. **Chart of Accounts Selection**
   ```typescript
   // Application determines which account codes are valid per tenant
   const account = await findAccountByCode(tenantId, accountCode);
   if (!account) {
     throw new Error('Invalid account code');
   }
   ```
   
   **Not database constraint** — tenant-specific business logic.

3. **Exchange Rate Source Selection**
   ```typescript
   // Application decides which exchange rate to use
   const rate = req.exchange_rate_override ?? await getSystemRate(currency, date);
   ```
   
   **Not database constraint** — policy decision.

**Rationale:** These are business logic decisions, not data integrity rules. Belong in application layer.

---

## CONSTRAINT ENFORCEMENT MATRIX

| Constraint | Database | Application | Rationale |
|------------|----------|-------------|-----------|
| **document_date NOT NULL when POSTED** | ✅ CHECK | ✅ Validation | Dual enforcement |
| **accounting_date NOT NULL when POSTED** | ✅ CHECK | ✅ Validation | Dual enforcement |
| **posted_at NULL when DRAFT** | ✅ CHECK | ✅ Validation | Dual enforcement |
| **posted_at system-generated** | ✅ TRIGGER | ✅ Reject user value | Dual enforcement |
| **document_date immutable after POSTED** | ✅ TRIGGER | ❌ | Database-only (row-level) |
| **accounting_date immutable after period CLOSED** | ✅ TRIGGER | ✅ Period check | Dual enforcement |
| **posted_at always immutable** | ✅ TRIGGER | ❌ | Database-only (row-level) |
| **Default accounting_date = document_date** | ❌ | ✅ Default logic | Application-only (policy) |
| **Cannot post to closed period** | ✅ TRIGGER | ✅ Period check | Dual enforcement |
| **Debit = Credit** | ✅ TRIGGER | ✅ Validation | Dual enforcement |

**Enforcement Strategy:**

```
Critical Integrity → Database + Application (belt and suspenders)
Row-Level Immutability → Database only (trigger)
Business Policy → Application only (not integrity)
```

---

## DEFAULT VALUE STRATEGY

### Default Rules Summary

| Field | Default Value | Condition | Layer |
|-------|---------------|-----------|-------|
| **document_date** | NONE | Always explicit | Application |
| **accounting_date** | `= document_date` | If not provided | Application |
| **posted_at** | `NOW()` | When status → POSTED | Database (trigger) |

### Detailed Default Logic

**1. document_date**

```typescript
// No default — caller MUST provide document_date
if (!req.document_date) {
  throw new FinanceError('DOCUMENT_DATE_REQUIRED', 'Document date is required');
}
```

**Rationale:** Document date is business event date, must come from external source (invoice, payment, contract).

**2. accounting_date**

```typescript
// Default to document_date if not explicitly provided
const accountingDate = req.accounting_date ?? req.document_date;

// Rationale: Cash basis accounting (most common)
// Accountant can override for accrual accounting
```

**Rationale:** 
- Cash basis (default): `accounting_date = document_date`
- Accrual basis (explicit): Accountant provides different `accounting_date`

**3. posted_at**

```sql
-- Database trigger auto-sets posted_at
IF NEW.status = 'POSTED' AND OLD.status != 'POSTED' THEN
  NEW.posted_at := NOW();  -- System-generated UTC timestamp
END IF;
```

**Rationale:** System timestamp for audit trail, cannot be user-supplied.

---

## RPC/SERVICE BOUNDARY VALIDATION

### LedgerService.postTransaction() Validation Chain

```typescript
export async function postTransaction(
  req: PostTransactionRequest
): Promise<FinancialTransaction> {
  
  // ============================================================
  // VALIDATION LAYER 1: Required Fields
  // ============================================================
  
  if (!req.document_date) {
    throw new FinanceError(
      'DOCUMENT_DATE_REQUIRED',
      'document_date is required for posting transaction'
    );
  }
  
  // ============================================================
  // VALIDATION LAYER 2: Default Logic
  // ============================================================
  
  const accountingDate = req.accounting_date ?? req.document_date;
  
  // ============================================================
  // VALIDATION LAYER 3: Business Rules
  // ============================================================
  
  // Reject user-supplied posted_at
  if (req.posted_at !== undefined && req.posted_at !== null) {
    throw new FinanceError(
      'POSTED_AT_CANNOT_BE_USER_SUPPLIED',
      'posted_at is system-generated'
    );
  }
  
  // Validate accounting period exists and is OPEN
  const period = await findPeriodByDate(accountingDate, req.tenant_id);
  if (!period) {
    throw new FinanceError(
      'ACCOUNTING_PERIOD_NOT_FOUND',
      `No accounting period exists for date ${accountingDate}`
    );
  }
  
  if (period.status === 'CLOSED' || period.status === 'LOCKED') {
    throw new FinanceError(
      'PERIOD_CLOSED',
      `Cannot post to closed period ${period.name}`
    );
  }
  
  // ============================================================
  // VALIDATION LAYER 4: Double-Entry Balance
  // ============================================================
  
  const debitTotal = req.lines.reduce((sum, line) => 
    sum + BigInt(line.debit_amount_minor), 0n
  );
  const creditTotal = req.lines.reduce((sum, line) => 
    sum + BigInt(line.credit_amount_minor), 0n
  );
  
  if (debitTotal !== creditTotal) {
    throw new FinanceError(
      'UNBALANCED_TRANSACTION',
      `Debit (${debitTotal}) must equal Credit (${creditTotal})`
    );
  }
  
  // ============================================================
  // DATABASE INSERT (with triggers enforcing final integrity)
  // ============================================================
  
  const { data, error } = await supabase.rpc('finance_post_transaction_v2', {
    p_tenant_id: req.tenant_id,
    p_document_date: req.document_date,
    p_accounting_date: accountingDate,
    p_posted_at: null,  // Database trigger will set
    p_lines: req.lines,
    // ...
  });
  
  if (error) {
    throw new FinanceError('POST_FAILED', error.message);
  }
  
  return data;
}
```

### Database RPC Validation

```sql
CREATE OR REPLACE FUNCTION finance_post_transaction_v2(
  p_tenant_id UUID,
  p_document_date DATE,
  p_accounting_date DATE,
  p_posted_at TIMESTAMPTZ,  -- Must be NULL (trigger will set)
  p_lines JSONB,
  -- ...
)
RETURNS JSONB AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Validate posted_at is NULL (not user-supplied)
  IF p_posted_at IS NOT NULL THEN
    RAISE EXCEPTION 'posted_at must be NULL (system-generated)'
      USING ERRCODE = 'F1024';
  END IF;
  
  -- Insert transaction (triggers will enforce constraints)
  INSERT INTO finance_transactions (
    tenant_id,
    status,
    document_date,
    accounting_date,
    posted_at,  -- Trigger will set to NOW()
    -- ...
  ) VALUES (
    p_tenant_id,
    'POSTED',
    p_document_date,
    p_accounting_date,
    NULL,  -- Trigger sets to NOW()
    -- ...
  ) RETURNING id INTO v_transaction_id;
  
  -- Insert transaction lines
  -- (debit=credit validation happens here)
  
  RETURN jsonb_build_object('transaction_id', v_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## NULLABILITY DECISION SUMMARY

### Approved Strategy

**Approach:** NULLABLE schema with lifecycle-enforced NOT NULL via CHECK constraints.

**Benefits:**
- Flexible DRAFT workflow (dates can be NULL during creation)
- Strong POSTED integrity (dates required via CHECK constraint)
- Clear authority boundaries (system vs user vs accountant)
- Separation of database integrity vs business policy

**Schema DDL:**

```sql
-- All date fields NULLABLE in schema
ALTER TABLE finance_transactions
ADD COLUMN document_date DATE,
ADD COLUMN accounting_date DATE,
ADD COLUMN posted_at TIMESTAMPTZ;

-- Lifecycle-based NOT NULL enforcement
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_dates_required_when_posted
CHECK (
  (status = 'DRAFT') OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND 
   document_date IS NOT NULL AND 
   accounting_date IS NOT NULL AND 
   posted_at IS NOT NULL)
);

-- posted_at lifecycle constraint
ALTER TABLE finance_transactions
ADD CONSTRAINT chk_posted_at_lifecycle
CHECK (
  (status = 'DRAFT' AND posted_at IS NULL) OR
  (status IN ('POSTED', 'REVERSED', 'VOIDED') AND posted_at IS NOT NULL)
);
```

### Field-Specific Decisions

| Field | Schema | DRAFT | POSTED | Default | Authority |
|-------|--------|-------|--------|---------|-----------|
| **document_date** | NULLABLE | NULL ok | NOT NULL (CHECK) | None | User |
| **accounting_date** | NULLABLE | NULL ok | NOT NULL (CHECK) | `= document_date` | User (or default) |
| **posted_at** | NULLABLE | NULL (required) | NOT NULL (TRIGGER) | `NOW()` | System |

---

## NEXT STEPS (WITHIN PHASE 3)

1. ✅ **Phase 3.4 COMPLETE** — Nullability decision finalized
2. 🔜 **Phase 3.5** — Design backfill policy (provable/inferable/unknowable)
3. 🔜 **Phase 3.6** — Create migration proposal (M-F1-DATES DDL, NOT executed)
4. 🔜 **Phase 3.7** — Human Architect review package

---

**Document Status:** ✅ COMPLETE  
**Created:** 2026-08-24  
**Phase:** 3.4 — Nullability Decision  
**Implementation:** ❌ BLOCKED (design complete, migration pending)
